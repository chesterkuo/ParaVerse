"""Build OASIS agents from persona JSON configs."""
from typing import Any


def build_oasis_agents(agent_configs: list[dict[str, Any]], model_name: str, api_key: str, base_url: str):
    """
    Convert persona configs to OASIS-compatible agent objects.

    Args:
        agent_configs: List of agent persona dicts with keys: id, name, persona, demographics
        model_name: LLM model name for agent inference
        api_key: API key for the LLM
        base_url: Base URL for the LLM API

    Returns:
        List of configured OASIS agent objects
    """
    try:
        from camel.models import ModelFactory
        from camel.types import ModelPlatformType, ModelType
        from oasis.social_agent import SocialAgent
        from oasis.social_platform.typing import ActionType
    except ImportError as e:
        raise ImportError(f"OASIS dependencies not installed: {e}. Run: pip install camel-ai camel-oasis")

    agents = []
    for config in agent_configs:
        persona_text = (
            f"Name: {config['name']}\n"
            f"Role: {config['demographics'].get('role', 'general user')}\n"
            f"Personality: {config['persona']}\n"
            f"Age: {config['demographics'].get('age_range', '25-45')}\n"
            f"Occupation: {config['demographics'].get('occupation', 'professional')}"
        )

        model = ModelFactory.create(
            model_platform=ModelPlatformType.OPENAI_COMPATIBLE_MODEL,
            model_type=model_name,
            api_key=api_key,
            url=base_url,
        )

        agent = SocialAgent(
            agent_id=config["id"],
            model=model,
            persona=persona_text,
        )
        agents.append(agent)

    return agents
