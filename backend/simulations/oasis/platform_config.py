"""Platform configuration for OASIS social simulation."""


def create_twitter_platform(num_agents: int):
    """Create a Twitter-like platform environment."""
    try:
        from oasis.social_platform.platform import Platform
        from oasis.social_platform.config import PlatformConfig
    except ImportError as e:
        raise ImportError(f"OASIS not installed: {e}")

    config = PlatformConfig(
        platform_type="twitter",
        num_agents=num_agents,
        recommendation_algorithm="interest_based",
        max_posts_per_tick=5,
        trending_decay_factor=0.95,
    )
    return Platform(config)


def create_reddit_platform(num_agents: int):
    """Create a Reddit-like platform environment."""
    try:
        from oasis.social_platform.platform import Platform
        from oasis.social_platform.config import PlatformConfig
    except ImportError as e:
        raise ImportError(f"OASIS not installed: {e}")

    config = PlatformConfig(
        platform_type="reddit",
        num_agents=num_agents,
        recommendation_algorithm="hot_ranking",
        max_posts_per_tick=3,
    )
    return Platform(config)
