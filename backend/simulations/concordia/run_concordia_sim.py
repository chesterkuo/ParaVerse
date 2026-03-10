#!/usr/bin/env python3
"""Main Concordia simulation runner.

Communicates with the TypeScript backend via JSON-line IPC over stdin/stdout.
Uses Concordia's Sequential engine with EntityAgent and custom game masters.
"""
import json
import os
import signal
import sys
import traceback
from typing import Any

from concordia_ipc import (
    load_checkpoint,
    read_command,
    save_checkpoint,
    send_agent_action,
    send_error,
    send_event,
    send_simulation_complete,
    send_status,
)


class ConcordiaSimulation:
    """Manages a Concordia simulation with real EntityAgent instances."""

    def __init__(self, config: dict[str, Any]):
        self.config = config
        self.simulation_id: str = config.get("simulation_id", "unknown")
        self.scenario_type: str = config.get("scenario_type", "policy_lab")
        self.tick_count: int = config.get("tick_count", 20)
        self.seed_context: str = config.get("seed_context", "")
        self.agents: list = []
        self.game_master = None
        self.model = None
        self.running: bool = False
        self.current_tick: int = 0

    def setup(self) -> None:
        """Initialize simulation components."""
        from gemini_model import GeminiLanguageModel
        from agent_factory import create_concordia_agents
        from game_masters import (
            BaseGameMaster,
            CrisisPrGameMaster,
            PolicyLabGameMaster,
            WarGameGameMaster,
            TrainLabGameMaster,
        )
        from game_masters.nested_war_game_gm import NestedWarGameGM

        # Create the language model
        self.model = GeminiLanguageModel(
            model_name=os.environ.get("LLM_MODEL_GENERAL", "gemini-2.5-flash"),
            api_key=os.environ.get("LLM_API_KEY", ""),
            base_url=os.environ.get("LLM_BASE_URL", ""),
        )

        # Create agents
        agent_profiles = self.config.get("agents", [])
        self.agents = create_concordia_agents(agent_profiles, self.model)

        send_status("agents_created", {
            "simulation_id": self.simulation_id,
            "agent_count": len(self.agents),
            "agent_names": [a.name for a in self.agents],
        })

        # Setup game master
        if self.scenario_type == "war_game" and self.config.get("nested_config"):
            self.game_master = NestedWarGameGM(self.config, self.model)
        else:
            SCENARIO_GM_MAP = {
                "crisis_pr": CrisisPrGameMaster,
                "policy_lab": PolicyLabGameMaster,
                "war_game": WarGameGameMaster,
                "train_lab": TrainLabGameMaster,
            }
            gm_class = SCENARIO_GM_MAP.get(self.scenario_type, BaseGameMaster)
            self.game_master = gm_class(self.config)

        # Build agent dicts for game master (backward compat)
        agent_dicts = [
            {"name": a.name, "id": a.name}
            for a in self.agents
        ]
        self.game_master.setup(agent_dicts)

        # Give agents initial observations
        premise = self._build_premise()
        for agent in self.agents:
            agent.observe(premise)

        send_status("configured", {
            "simulation_id": self.simulation_id,
            "scenario_type": self.scenario_type,
            "agent_count": len(self.agents),
            "game_master": gm_class.__name__,
        })

    def _build_premise(self) -> str:
        """Build the simulation premise from config."""
        parts = []
        if self.seed_context:
            parts.append(self.seed_context)

        scenario_descriptions = {
            "crisis_pr": "A crisis PR scenario is unfolding. A company faces a public relations crisis and must decide how to respond.",
            "policy_lab": "A policy debate is taking place. Participants discuss and evaluate proposed policies.",
            "war_game": "A geopolitical scenario is developing. Actors must navigate complex international dynamics.",
            "fin_sentiment": "Financial markets are reacting to news. Participants express their financial sentiment and make decisions.",
            "content_lab": "A content creation workshop is underway. Participants create and evaluate content.",
            "train_lab": "A training simulation is in progress. Participants practice skills and decision-making.",
        }
        desc = scenario_descriptions.get(self.scenario_type, "A simulation is in progress.")
        parts.append(desc)

        if self.game_master and self.game_master.grounded_vars:
            vars_text = ", ".join(
                f"{k}={v:.1f}" for k, v in self.game_master.grounded_vars.items()
            )
            parts.append(f"Current metrics: {vars_text}")

        return "\n".join(parts)

    def run(self) -> None:
        """Main simulation loop using manual tick-based execution."""
        self.running = True
        send_status("running", {"simulation_id": self.simulation_id})

        while self.running and self.current_tick < self.tick_count:
            # Check for commands (non-blocking)
            cmd = read_command(blocking=False)
            if cmd is not None:
                self.handle_command(cmd)
                if not self.running:
                    break
                continue  # Process commands before next tick

            # Run one tick
            self.current_tick += 1
            self._run_tick()

            # Check game master completion
            if self.game_master and self.game_master.is_complete():
                break

        # Simulation complete
        stats = self._get_stats()
        send_simulation_complete(stats)

    def _run_tick(self) -> None:
        """Execute a single simulation tick."""
        tick = self.current_tick

        # Advance game master (updates grounded vars)
        if self.game_master:
            self.game_master.advance_tick()

        # Build tick observation
        observation = self._build_tick_observation(tick)

        # Each agent observes and acts
        for agent in self.agents:
            if not self.running:
                break

            try:
                # Agent observes the situation
                agent.observe(observation)

                # Agent decides on action
                action = agent.act()

                # Emit the action
                send_agent_action(
                    agent_id=agent.name,
                    content=action,
                    sim_timestamp=tick,
                    metadata={
                        "scenario": self.scenario_type,
                        "grounded_vars": dict(self.game_master.grounded_vars) if self.game_master else {},
                    },
                )

                # Other agents observe this action
                action_observation = f"{agent.name}: {action}"
                for other in self.agents:
                    if other.name != agent.name:
                        other.observe(action_observation)

            except Exception as e:
                send_error(f"Agent {agent.name} tick {tick} error: {e}")

        # Emit progress
        progress = round(tick / self.tick_count * 100)
        send_event("status", progress=progress, events_count=tick * len(self.agents))

    def _build_tick_observation(self, tick: int) -> str:
        """Build the observation text for the current tick."""
        parts = [f"[Tick {tick}/{self.tick_count}]"]

        if self.game_master and self.game_master.grounded_vars:
            vars_text = ", ".join(
                f"{k}={v:.1f}" for k, v in self.game_master.grounded_vars.items()
            )
            parts.append(f"Current state: {vars_text}")

        return " ".join(parts)

    def handle_command(self, cmd: dict[str, Any]) -> None:
        """Handle an incoming IPC command."""
        cmd_type = cmd.get("type", "")

        if cmd_type == "stop_simulation":
            self.running = False
            send_status("stopping", {"reason": cmd.get("reason", "user_requested")})

        elif cmd_type == "inject_event":
            content = cmd.get("content", "")
            for agent in self.agents:
                agent.observe(f"[Breaking] {content}")
            if self.game_master:
                self.game_master.inject_event(cmd.get("event", {"content": content}))

        elif cmd_type == "interview_agent":
            self._handle_interview(cmd)

        elif cmd_type == "get_status":
            details: dict[str, Any] = {"tick": self.current_tick, "max_ticks": self.tick_count}
            if self.game_master:
                details["grounded_vars"] = self.game_master.grounded_vars
            send_status("running", details)

        elif cmd_type == "save_checkpoint":
            state = self._get_state()
            save_checkpoint(state, cmd.get("path"))

        elif cmd_type == "load_checkpoint":
            state = load_checkpoint(cmd.get("path", ""))
            if state:
                self._restore_state(state)

        elif cmd_type == "inject_manual_action":
            agent_id = cmd.get("agent_id", "")
            action = cmd.get("action", "")
            # Broadcast as observation
            obs = f"{agent_id} (manual action): {action}"
            for agent in self.agents:
                agent.observe(obs)
            send_agent_action(
                agent_id=agent_id,
                content=f"[Manual] {action}",
                sim_timestamp=self.current_tick,
                metadata={"manual": True},
            )

        elif cmd_type == "set_grounded_var":
            if self.game_master:
                self.game_master.set_grounded_var(
                    cmd.get("name", ""),
                    float(cmd.get("value", 0)),
                )

        elif cmd_type == "fork_scenario":
            if self.game_master:
                self.game_master.fork_branch(
                    cmd.get("branch_label", "unnamed"),
                    cmd.get("override_vars", {}),
                )

        else:
            send_error(f"Unknown command: {cmd_type}")

    def _handle_interview(self, cmd: dict[str, Any]) -> None:
        """Interview a specific agent using the LLM."""
        agent_id = cmd.get("agent_id", "")
        question = cmd.get("question") or cmd.get("prompt", "What do you think?")

        target = None
        for agent in self.agents:
            if agent.name == agent_id:
                target = agent
                break

        if not target:
            send_error(f"Agent {agent_id} not found")
            return

        try:
            # Use the model directly for interview
            prompt = (
                f"You are {target.name} in a simulation.\n"
                f"An interviewer asks: {question}\n\n"
                f"Respond in character (2-4 sentences)."
            )
            response = self.model.sample_text(prompt, max_tokens=300, temperature=0.7)
            send_event(
                "interview_response",
                agent_id=agent_id,
                question=question,
                response=response,
                tick=self.current_tick,
            )
        except Exception as e:
            send_error(f"Interview failed: {e}")

    def _get_stats(self) -> dict[str, Any]:
        return {
            "simulation_id": self.simulation_id,
            "total_ticks": self.current_tick,
            "agent_count": len(self.agents),
            "grounded_vars": dict(self.game_master.grounded_vars) if self.game_master else {},
            "branches": len(self.game_master.branches) if self.game_master else 0,
        }

    def _get_state(self) -> dict[str, Any]:
        state: dict[str, Any] = {
            "simulation_id": self.simulation_id,
            "config": self.config,
            "current_tick": self.current_tick,
        }
        if self.game_master:
            state["gm_tick"] = self.game_master.tick
            state["grounded_vars"] = dict(self.game_master.grounded_vars)
            state["branches"] = list(self.game_master.branches)
        return state

    def _restore_state(self, state: dict[str, Any]) -> None:
        self.current_tick = state.get("current_tick", 0)
        if self.game_master and "gm_tick" in state:
            self.game_master.tick = state["gm_tick"]
            self.game_master.grounded_vars = state.get("grounded_vars", {})
            self.game_master.branches = state.get("branches", [])
        send_status("state_restored", {"tick": self.current_tick})


def main() -> None:
    """Entry point. Reads start_simulation command from stdin."""
    cmd = read_command()
    if cmd is None or cmd.get("type") != "start_simulation":
        send_error("Expected start_simulation command")
        sys.exit(1)

    config = cmd.get("config", {})
    sim = ConcordiaSimulation(config)

    def handle_signal(signum: int, frame: Any) -> None:
        sim.running = False

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    try:
        sim.setup()
        sim.run()
    except Exception as e:
        send_error(f"Simulation error: {e}\n{traceback.format_exc()}")
        sys.exit(1)


if __name__ == "__main__":
    main()
