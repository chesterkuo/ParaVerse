"""Build social simulation agents using CAMEL ChatAgent.

Since camel-oasis requires Python <3.12, we use camel-ai's ChatAgent directly
to create social media simulation agents with persona-driven behavior.
"""
import os
from typing import Any

from camel.agents import ChatAgent
from camel.models import ModelFactory
from camel.types import ModelPlatformType


def build_oasis_agents(
    agent_configs: list[dict[str, Any]],
    model_name: str,
    api_key: str,
    base_url: str,
) -> list[dict[str, Any]]:
    """Create CAMEL ChatAgent-backed social simulation agents.

    Args:
        agent_configs: List of agent persona dicts with keys: id, name, persona, demographics
        model_name: LLM model name for agent inference
        api_key: API key for the LLM
        base_url: Base URL for the LLM API

    Returns:
        List of agent dicts with 'id', 'name', 'agent' (ChatAgent), 'persona'
    """
    # Set env vars for CAMEL model
    os.environ["OPENAI_COMPATIBILIY_API_KEY"] = api_key

    model = ModelFactory.create(
        model_platform=ModelPlatformType.OPENAI_COMPATIBLE_MODEL,
        model_type=model_name,
        api_key=api_key,
        url=base_url,
    )

    agents = []
    for config in agent_configs:
        demographics = config.get("demographics", {})
        persona_text = (
            f"You are {config['name']}, a social media user.\n"
            f"Role: {demographics.get('role', 'general user')}\n"
            f"Age range: {demographics.get('age_range', '25-45')}\n"
            f"Occupation: {demographics.get('occupation', 'professional')}\n"
            f"Group: {demographics.get('group', 'general')}\n\n"
            f"Personality and background:\n{config.get('persona', '')}\n\n"
            f"You participate in social media discussions. Stay in character.\n"
            f"Express opinions, react to posts, and interact with others naturally.\n"
            f"Keep responses concise (1-3 sentences for posts, 1-2 for reactions)."
        )

        agent = ChatAgent(
            system_message=persona_text,
            model=model,
            message_window_size=20,
        )

        agents.append({
            "id": config["id"],
            "name": config["name"],
            "agent": agent,
            "persona": persona_text,
            "demographics": demographics,
        })

    return agents
