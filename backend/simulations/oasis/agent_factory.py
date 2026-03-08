"""Agent factory for OASIS simulations.

Creates and configures OASIS social agents from ParaVerse agent profiles.
"""

from typing import Any, Dict, List, Optional

try:
    from camel.agents import ChatAgent
    from camel.messages import BaseMessage
    from camel.types import ModelType
except ImportError:
    ChatAgent = None
    BaseMessage = None
    ModelType = None


def build_agent_profile(
    name: str,
    persona: str,
    demographics: Dict[str, Any],
    model_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Build an agent profile dictionary for OASIS."""
    return {
        "name": name,
        "persona": persona,
        "demographics": demographics,
        "model_type": model_type or "gpt-4o-mini",
        "system_message": _build_system_message(name, persona, demographics),
    }


def _build_system_message(
    name: str, persona: str, demographics: Dict[str, Any]
) -> str:
    """Build a system message for the agent's LLM."""
    group = demographics.get("group", "general")
    occupation = demographics.get("occupation", "unknown")
    personality = demographics.get("personality_type", "")

    return (
        f"You are {name}, a simulated social media user.\n"
        f"Background: {persona}\n"
        f"Demographic group: {group}\n"
        f"Occupation: {occupation}\n"
        f"Personality: {personality}\n\n"
        "Respond authentically as this persona would. "
        "Keep responses concise and natural."
    )


def create_oasis_agents(
    agent_profiles: List[Dict[str, Any]],
    model_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Create OASIS agent configurations from ParaVerse profiles."""
    agents = []
    for profile in agent_profiles:
        agent = build_agent_profile(
            name=profile["name"],
            persona=profile.get("persona", ""),
            demographics=profile.get("demographics", {}),
            model_type=model_type,
        )
        agents.append(agent)
    return agents
