"""Agent factory for Concordia simulations.

Builds Concordia EntityAgent objects from ParaVerse agent profiles.
"""

from typing import Any, Dict, List, Optional

try:
    from concordia.agents import entity_agent
    from concordia.components import agent as agent_components
except ImportError:
    entity_agent = None
    agent_components = None


def build_agent_config(
    name: str,
    persona: str,
    demographics: Dict[str, Any],
    goal: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a Concordia agent configuration dictionary."""
    return {
        "name": name,
        "persona": persona,
        "demographics": demographics,
        "goal": goal or _infer_goal(demographics),
        "components": _build_default_components(name, persona),
    }


def _infer_goal(demographics: Dict[str, Any]) -> str:
    """Infer a default goal from demographics."""
    group = demographics.get("group", "general")
    goals = {
        "supporter": "Advocate for the policy and convince others of its benefits",
        "opponent": "Argue against the policy and highlight its drawbacks",
        "undecided": "Evaluate both sides and form an informed opinion",
        "consumer": "Express concerns and seek accountability from the brand",
        "media_reporter": "Investigate and report on the crisis objectively",
        "brand_loyalist": "Defend the brand while acknowledging valid concerns",
        "critic": "Hold the brand accountable and demand transparency",
        "domestic_public": "Protect personal interests and safety",
        "foreign_public": "Monitor the situation and assess impact",
        "media": "Report accurately and provide context",
        "diplomat": "Seek resolution through negotiation",
        "stakeholder": "Ensure outcomes align with stakeholder interests",
        "regulator": "Ensure compliance and proper governance",
    }
    return goals.get(group, "Participate meaningfully in the simulation")


def _build_default_components(name: str, persona: str) -> List[Dict[str, str]]:
    """Build default component configuration for a Concordia agent."""
    return [
        {"type": "memory", "description": f"Memory for {name}"},
        {"type": "observation", "description": f"Observations for {name}"},
        {"type": "planning", "description": f"Planning for {name}"},
    ]


def create_concordia_agents(
    agent_profiles: List[Dict[str, Any]],
    model_name: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Create Concordia agent configurations from ParaVerse profiles."""
    agents = []
    for profile in agent_profiles:
        agent = build_agent_config(
            name=profile["name"],
            persona=profile.get("persona", ""),
            demographics=profile.get("demographics", {}),
            goal=profile.get("goal"),
        )
        if model_name:
            agent["model_name"] = model_name
        agents.append(agent)
    return agents
