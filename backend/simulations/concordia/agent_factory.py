"""Agent factory for Concordia simulations.

Builds Concordia EntityAgent objects from ParaVerse agent profiles.
"""
from typing import Any

from concordia.agents.entity_agent import EntityAgent
from concordia.components.agent.concat_act_component import ConcatActComponent
from concordia.components.agent.instructions import Instructions
from concordia.components.agent.memory import ListMemory
from concordia.components.agent.observation import (
    ObservationsSinceLastPreAct,
    ObservationToMemory,
)
from concordia.components.agent.plan import Plan
from concordia.language_model.language_model import LanguageModel


def create_concordia_agents(
    agent_profiles: list[dict[str, Any]],
    model: LanguageModel,
) -> list[EntityAgent]:
    """Create Concordia EntityAgent instances from ParaVerse profiles.

    Args:
        agent_profiles: List of agent profile dicts with name, persona, demographics
        model: Concordia LanguageModel instance

    Returns:
        List of configured EntityAgent objects
    """
    agents = []
    for profile in agent_profiles:
        name = profile["name"]
        persona = profile.get("persona", "")
        demographics = profile.get("demographics", {})
        goal = profile.get("goal") or _infer_goal(demographics)

        agent = _build_entity_agent(name, persona, goal, model)
        agents.append(agent)

    return agents


def _build_entity_agent(
    name: str,
    persona: str,
    goal: str,
    model: LanguageModel,
) -> EntityAgent:
    """Build a single Concordia EntityAgent with standard components."""
    # Memory component
    initial_memories = [
        f"{name}'s background: {persona}",
        f"{name}'s current goal: {goal}",
    ]
    memory = ListMemory(memory_bank=initial_memories)

    # Observation component - stores observations into memory
    obs_to_memory = ObservationToMemory()
    observations = ObservationsSinceLastPreAct()

    # Instructions component
    instructions = Instructions(agent_name=name)

    # Planning component
    plan = Plan(
        model=model,
        components=[
            observations.get_pre_act_label(),
        ],
    )

    # Acting component - combines all context to decide actions
    act_component = ConcatActComponent(
        model=model,
        component_order=[
            instructions.get_pre_act_label(),
            observations.get_pre_act_label(),
            plan.get_pre_act_label(),
        ],
    )

    # Build the agent
    agent = EntityAgent(
        agent_name=name,
        act_component=act_component,
        context_components={
            "__memory__": memory,
            "__obs_to_memory__": obs_to_memory,
            instructions.get_pre_act_label(): instructions,
            observations.get_pre_act_label(): observations,
            plan.get_pre_act_label(): plan,
        },
    )

    return agent


def _infer_goal(demographics: dict[str, Any]) -> str:
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
