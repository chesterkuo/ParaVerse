"""Nested War Game game master for Concordia simulations.

Implements a master-GM / sub-GM architecture where each country runs as an
independent sub-GM with its own agent pool and grounded variables. The master
GM coordinates cross-country interactions via LLM-computed spillover effects.
"""

from typing import Any, Dict, List, Optional

from game_masters.base_gm import BaseGameMaster
from concordia_ipc import send_event, send_grounded_var, send_status


# Language-specific system prompts injected into each agent call so that
# agents respond in the appropriate language for their country.
LANGUAGE_PROMPTS: Dict[str, str] = {
    "en": "Respond in English.",
    "zh-Hans": "Please respond in Simplified Chinese (简体中文).",
    "zh-Hant": "Please respond in Traditional Chinese (繁體中文).",
    "ja": "日本語で回答してください。",
    "ko": "한국어로 응답해 주세요.",
}

# Cross-border spillover prompt template used by the master GM to compute
# how events in one country affect trust/belief in neighbouring countries.
SPILLOVER_PROMPT = """You are a geopolitical analyst. Given the following events that occurred
in different countries during this simulation tick, estimate the cross-border
spillover effects on trust and belief scores.

Events by country:
{events_text}

Current trust indices:
{trust_text}

For each country, output a JSON object with keys being country IDs and values
being objects with "trust_delta" (float, -10 to +10) and "belief_delta"
(float, -10 to +10). Also include "information_penetration_rate" (float, 0-100)
representing how much information crosses borders.

Respond ONLY with valid JSON, no explanation."""


class CountrySubGM:
    """Sub-game-master for a single country within the nested war game.

    Each country has its own agent pool, trust index, belief score, and
    local event log. The sub-GM runs independently each tick, generating
    agent responses with language-specific instructions.
    """

    def __init__(
        self,
        country_id: str,
        language: str,
        agents: List[Dict[str, Any]],
        trust_index_init: float = 50.0,
    ):
        self.country_id = country_id
        self.language = language
        self.agents = agents
        self.trust_index: float = trust_index_init
        self.belief_score: float = 50.0
        self.local_events: List[Dict[str, Any]] = []

    def run_tick(
        self,
        external_events: List[str],
        llm_client: Any,
        tick: int,
    ) -> List[Dict[str, Any]]:
        """Run one tick for this country's agents.

        Args:
            external_events: Events from other countries (spillover).
            llm_client: Concordia-compatible language model.
            tick: Current tick number.

        Returns:
            List of event dicts produced by agents in this country.
        """
        lang_prompt = LANGUAGE_PROMPTS.get(self.language, LANGUAGE_PROMPTS["en"])
        events: List[Dict[str, Any]] = []

        # Build context for agents
        context_parts = [
            f"[Country {self.country_id} — Tick {tick}]",
            f"Trust index: {self.trust_index:.1f}, Belief score: {self.belief_score:.1f}",
        ]
        if external_events:
            context_parts.append("External events: " + "; ".join(external_events))
        context = "\n".join(context_parts)

        for agent in self.agents:
            agent_name = agent.get("name", agent.get("id", "unknown"))
            prompt = (
                f"{lang_prompt}\n\n"
                f"You are {agent_name}, a stakeholder in country {self.country_id}.\n"
                f"{context}\n\n"
                f"What action do you take this tick? Respond concisely (1-3 sentences)."
            )

            try:
                response = llm_client.sample_text(
                    prompt, max_tokens=300, temperature=0.8
                )
                event = {
                    "country_id": self.country_id,
                    "agent_id": agent_name,
                    "content": response,
                    "tick": tick,
                }
                events.append(event)
                self.local_events.append(event)
            except Exception as e:
                events.append({
                    "country_id": self.country_id,
                    "agent_id": agent_name,
                    "content": f"[Error: {e}]",
                    "tick": tick,
                    "error": True,
                })

        return events

    def update_variables(self, trust_delta: float, belief_delta: float) -> None:
        """Update trust index and belief score, clamping to [0, 100]."""
        self.trust_index = max(0.0, min(100.0, self.trust_index + trust_delta))
        self.belief_score = max(0.0, min(100.0, self.belief_score + belief_delta))


class NestedWarGameGM(BaseGameMaster):
    """Master game master that coordinates multiple country sub-GMs.

    Each country runs as an independent CountrySubGM with its own agents
    and grounded variables. The master computes cross-border spillover
    effects via LLM after each tick.

    Branches:
        - Diplomatic: focus on negotiation and de-escalation
        - Military: focus on deterrence and force projection
        - Economic: focus on trade and sanctions
    """

    DEFAULT_BRANCHES = [
        {
            "label": "Diplomatic",
            "description": "Pursue dialogue, summits, and multilateral negotiations",
            "override_vars": {"strategy": "diplomatic", "aggression": 0.1},
        },
        {
            "label": "Military",
            "description": "Increase military readiness and demonstrate force capability",
            "override_vars": {"strategy": "military", "aggression": 0.7},
        },
        {
            "label": "Economic",
            "description": "Apply economic pressure through trade restrictions and sanctions",
            "override_vars": {"strategy": "economic", "aggression": 0.4},
        },
    ]

    def __init__(self, config: Dict[str, Any], llm_client: Any = None):
        super().__init__(config)
        self.llm_client = llm_client
        self.sub_gms: Dict[str, CountrySubGM] = {}
        self.information_penetration_rate: float = 0.0
        self.previous_spillover: Dict[str, List[str]] = {}

        # Initialize sub-GMs from nested_config
        nested_config = config.get("nested_config", {})
        countries = nested_config.get("countries", [])
        for country in countries:
            country_id = country["id"]
            language = country.get("language", "en")
            agent_count = country.get("agent_count", 5)
            trust_init = country.get("trust_index_init", 50.0)

            # Create placeholder agent dicts; real agents are assigned in setup
            agents = [
                {"name": f"{country_id}_agent_{i}", "id": f"{country_id}_agent_{i}"}
                for i in range(agent_count)
            ]
            self.sub_gms[country_id] = CountrySubGM(
                country_id=country_id,
                language=language,
                agents=agents,
                trust_index_init=trust_init,
            )

    def _initialize_grounded_vars(self) -> None:
        """Set initial per-country grounded variables."""
        for country_id, sub_gm in self.sub_gms.items():
            self.set_grounded_var(f"{country_id}_trust_index", sub_gm.trust_index)
            self.set_grounded_var(f"{country_id}_belief_score", sub_gm.belief_score)
        self.set_grounded_var("information_penetration_rate", self.information_penetration_rate)

    def get_initial_grounded_vars(self) -> Dict[str, float]:
        """Return a dict with per-country vars and information_penetration_rate."""
        result: Dict[str, float] = {}
        for country_id, sub_gm in self.sub_gms.items():
            result[f"{country_id}_trust_index"] = sub_gm.trust_index
            result[f"{country_id}_belief_score"] = sub_gm.belief_score
        result["information_penetration_rate"] = self.information_penetration_rate
        return result

    def setup(self, agents: List[Dict[str, Any]]) -> None:
        """Initialize the nested GM with agents and create branches."""
        super().setup(agents)
        for branch_config in self.DEFAULT_BRANCHES:
            self.fork_branch(
                label=branch_config["label"],
                override_vars=branch_config["override_vars"],
            )
        send_status("nested_war_game_ready", {
            "countries": list(self.sub_gms.keys()),
            "branches": [b["label"] for b in self.branches],
        })

    def _on_tick(self) -> None:
        """Run one tick: each country runs independently, then compute spillover."""
        self._run_country_ticks()
        self._compute_spillover()
        self._update_grounded_vars()

    def _run_country_ticks(self) -> None:
        """Run each country's sub-GM independently."""
        all_events: Dict[str, List[Dict[str, Any]]] = {}

        for country_id, sub_gm in self.sub_gms.items():
            # Get spillover events from previous tick
            external_events = self.previous_spillover.get(country_id, [])
            events = sub_gm.run_tick(external_events, self.llm_client, self.tick)
            all_events[country_id] = events

            # Emit agent actions
            for event in events:
                if not event.get("error"):
                    from concordia_ipc import send_agent_action
                    send_agent_action(
                        agent_id=event["agent_id"],
                        content=event["content"],
                        sim_timestamp=self.tick,
                        metadata={
                            "country_id": country_id,
                            "trust_index": sub_gm.trust_index,
                            "belief_score": sub_gm.belief_score,
                        },
                    )

        self._last_tick_events = all_events

    def _compute_spillover(self) -> None:
        """Use LLM to compute cross-border spillover effects."""
        if not self.llm_client or not hasattr(self, "_last_tick_events"):
            return

        events_text_parts = []
        trust_text_parts = []
        for country_id, events in self._last_tick_events.items():
            summaries = [e["content"] for e in events if not e.get("error")]
            if summaries:
                events_text_parts.append(
                    f"{country_id}: " + " | ".join(summaries[:3])
                )
            sub_gm = self.sub_gms[country_id]
            trust_text_parts.append(
                f"{country_id}: trust={sub_gm.trust_index:.1f}, belief={sub_gm.belief_score:.1f}"
            )

        if not events_text_parts:
            return

        prompt = SPILLOVER_PROMPT.format(
            events_text="\n".join(events_text_parts),
            trust_text="\n".join(trust_text_parts),
        )

        try:
            import json
            response = self.llm_client.sample_text(prompt, max_tokens=500, temperature=0.3)
            # Try to parse JSON from response
            response = response.strip()
            if response.startswith("```"):
                # Strip markdown code fences
                lines = response.split("\n")
                response = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            spillover_data = json.loads(response)

            # Apply spillover deltas
            new_spillover: Dict[str, List[str]] = {cid: [] for cid in self.sub_gms}
            for country_id, deltas in spillover_data.items():
                if country_id == "information_penetration_rate":
                    self.information_penetration_rate = max(
                        0.0, min(100.0, float(deltas))
                    )
                    continue
                if country_id not in self.sub_gms:
                    continue
                if isinstance(deltas, dict):
                    trust_delta = float(deltas.get("trust_delta", 0))
                    belief_delta = float(deltas.get("belief_delta", 0))
                    self.sub_gms[country_id].update_variables(trust_delta, belief_delta)

                    # Build spillover messages for next tick
                    for other_id in self.sub_gms:
                        if other_id != country_id:
                            new_spillover[other_id].append(
                                f"Events in {country_id} shifted trust by {trust_delta:+.1f}"
                            )

            self.previous_spillover = new_spillover

        except (json.JSONDecodeError, Exception) as e:
            send_event("status", status="spillover_parse_error", details={"error": str(e)})
            # Apply small random drift as fallback
            for sub_gm in self.sub_gms.values():
                sub_gm.update_variables(-0.5, -0.3)

    def _update_grounded_vars(self) -> None:
        """Sync sub-GM state to grounded variables."""
        for country_id, sub_gm in self.sub_gms.items():
            self.set_grounded_var(f"{country_id}_trust_index", sub_gm.trust_index)
            self.set_grounded_var(f"{country_id}_belief_score", sub_gm.belief_score)
        self.set_grounded_var("information_penetration_rate", self.information_penetration_rate)

    def is_complete(self) -> bool:
        """Check if simulation should end.

        Ends if max ticks reached or any country trust_index hits extreme
        values (<=5 or >=95).
        """
        for sub_gm in self.sub_gms.values():
            if sub_gm.trust_index <= 5 or sub_gm.trust_index >= 95:
                return True
        return super().is_complete()

    def get_branches(self) -> List[Dict[str, Any]]:
        """Return the default branches: Diplomatic, Military, Economic."""
        return [
            {"label": b["label"], "description": b["description"]}
            for b in self.DEFAULT_BRANCHES
        ]
