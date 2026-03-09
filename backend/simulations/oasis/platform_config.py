"""Platform simulation for social media interactions.

Implements a lightweight social media platform simulation using CAMEL agents.
Each tick, agents see a feed of recent posts and decide whether to post, reply, or react.
"""
import random
from typing import Any


class SocialPost:
    """A social media post or reply."""

    def __init__(
        self,
        author_id: str,
        author_name: str,
        content: str,
        tick: int,
        post_type: str = "post",
        parent_id: str | None = None,
    ):
        self.id = f"post_{tick}_{author_id}_{random.randint(1000,9999)}"
        self.author_id = author_id
        self.author_name = author_name
        self.content = content
        self.tick = tick
        self.post_type = post_type  # post, reply, repost
        self.parent_id = parent_id
        self.reactions: dict[str, str] = {}  # agent_id -> reaction_type

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "author_id": self.author_id,
            "author_name": self.author_name,
            "content": self.content,
            "tick": self.tick,
            "post_type": self.post_type,
            "parent_id": self.parent_id,
            "reactions": self.reactions,
        }


class SocialPlatform:
    """Simulates a social media platform with a feed and interactions."""

    def __init__(self, platform_type: str = "twitter", max_feed_size: int = 10):
        self.platform_type = platform_type
        self.max_feed_size = max_feed_size
        self.posts: list[SocialPost] = []
        self.trending_topics: list[str] = []

    def add_post(self, post: SocialPost) -> None:
        self.posts.append(post)

    def get_feed(self, agent_id: str, count: int = 5) -> list[SocialPost]:
        """Get recent posts for an agent's feed (excluding their own)."""
        others = [p for p in self.posts if p.author_id != agent_id]
        return others[-count:]

    def get_recent_posts(self, count: int = 10) -> list[SocialPost]:
        return self.posts[-count:]

    def format_feed(self, agent_id: str) -> str:
        """Format the feed as text for an agent to read."""
        feed = self.get_feed(agent_id)
        if not feed:
            return "The feed is empty. No posts yet."

        lines = [f"=== {self.platform_type.upper()} Feed ==="]
        for post in feed:
            prefix = f"@{post.author_name}"
            if post.post_type == "reply" and post.parent_id:
                prefix += " (reply)"
            reactions_str = ""
            if post.reactions:
                reaction_counts: dict[str, int] = {}
                for r in post.reactions.values():
                    reaction_counts[r] = reaction_counts.get(r, 0) + 1
                reactions_str = " | " + ", ".join(
                    f"{k}: {v}" for k, v in reaction_counts.items()
                )
            lines.append(f"{prefix}: {post.content}{reactions_str}")
        return "\n".join(lines)


def create_twitter_platform(num_agents: int) -> SocialPlatform:
    return SocialPlatform(platform_type="twitter", max_feed_size=min(num_agents * 2, 20))


def create_reddit_platform(num_agents: int) -> SocialPlatform:
    return SocialPlatform(platform_type="reddit", max_feed_size=min(num_agents * 3, 30))
