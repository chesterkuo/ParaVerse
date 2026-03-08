"""Platform configuration for OASIS social simulations.

Defines platform-specific settings (Twitter, Reddit) for the OASIS engine.
"""

from typing import Any, Dict, Optional


PLATFORM_DEFAULTS: Dict[str, Dict[str, Any]] = {
    "twitter": {
        "max_post_length": 280,
        "actions": ["post", "repost", "like", "reply", "quote"],
        "visibility": "public",
        "trending_enabled": True,
        "follower_network": True,
    },
    "reddit": {
        "max_post_length": 10000,
        "actions": ["post", "comment", "upvote", "downvote"],
        "visibility": "subreddit",
        "trending_enabled": False,
        "follower_network": False,
    },
}


def get_platform_config(
    platform: str = "twitter",
    overrides: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Get platform configuration with optional overrides."""
    config = PLATFORM_DEFAULTS.get(platform, PLATFORM_DEFAULTS["twitter"]).copy()
    if overrides:
        config.update(overrides)
    config["platform_name"] = platform
    return config


def validate_platform_action(platform: str, action: str) -> bool:
    """Check if an action is valid for the given platform."""
    config = PLATFORM_DEFAULTS.get(platform)
    if not config:
        return False
    return action in config.get("actions", [])
