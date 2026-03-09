"""Main OASIS simulation runner using CAMEL ChatAgent.

Communicates with Bun backend via stdin/stdout JSONL.
Each tick: agents observe the social feed, then decide to post/reply/react.
"""
import json
import os
import sys
import select
import traceback
import random
from oasis_ipc import read_commands, emit_event, emit_error, emit_status


# Global state
_agents = []
_platform = None
_events_count = 0
_current_tick = 0
_total_ticks = 0
_running = False


def run():
    for cmd in read_commands():
        cmd_type = cmd.get("type")

        if cmd_type == "start_simulation":
            try:
                handle_start(cmd.get("config", {}))
            except Exception as e:
                emit_error(f"start_simulation failed: {e}\n{traceback.format_exc()}")

        elif cmd_type == "inject_event":
            try:
                handle_inject(cmd)
            except Exception as e:
                emit_error(f"inject_event failed: {e}")

        elif cmd_type == "interview_agent":
            try:
                handle_interview(cmd)
            except Exception as e:
                emit_error(f"interview_agent failed: {e}")

        elif cmd_type == "get_status":
            handle_status()

        elif cmd_type == "stop_simulation":
            emit_event({"type": "simulation_complete", "stats": get_stats()})
            sys.exit(0)

        else:
            emit_error(f"Unknown command: {cmd_type}")


def check_pending_command():
    """Non-blocking check for pending stdin commands between ticks."""
    if select.select([sys.stdin], [], [], 0.1)[0]:
        line = sys.stdin.readline().strip()
        if line:
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                pass
    return None


def process_inter_tick_commands():
    """Process any commands received between ticks."""
    global _running
    while True:
        cmd = check_pending_command()
        if cmd is None:
            break
        cmd_type = cmd.get("type")
        if cmd_type == "inject_event":
            handle_inject(cmd)
        elif cmd_type == "interview_agent":
            handle_interview(cmd)
        elif cmd_type == "get_status":
            handle_status()
        elif cmd_type == "stop_simulation":
            _running = False
            break
        else:
            emit_error(f"Unknown command during simulation: {cmd_type}")


def handle_start(config: dict):
    global _agents, _platform, _events_count, _current_tick, _total_ticks, _running

    agent_configs = config.get("agents", [])
    total_ticks = config.get("tick_count", 50)
    platform_type = config.get("platform", "twitter")
    seed_context = config.get("seed_context", "")
    model_name = os.environ.get("LLM_MODEL_GENERAL", "gemini-2.5-flash")
    api_key = os.environ.get("LLM_API_KEY", "")
    base_url = os.environ.get("LLM_BASE_URL", "")

    _total_ticks = total_ticks
    _running = True

    try:
        from agent_factory import build_oasis_agents
        from platform_config import create_twitter_platform, create_reddit_platform, SocialPost

        # Build agents
        _agents = build_oasis_agents(agent_configs, model_name, api_key, base_url)
        emit_status(progress=5, events_count=0)

        # Create platform
        if platform_type == "reddit":
            _platform = create_reddit_platform(len(_agents))
        else:
            _platform = create_twitter_platform(len(_agents))

        # Inject seed context as initial post
        if seed_context:
            seed_post = SocialPost(
                author_id="system",
                author_name="NewsBot",
                content=seed_context,
                tick=0,
                post_type="post",
            )
            _platform.add_post(seed_post)
            _events_count += 1
            emit_event({
                "type": "agent_action",
                "agent_id": "system",
                "action": "seed_post",
                "content": seed_context,
                "tick": 0,
                "metadata": {"source": "seed_context", "platform": platform_type},
            })

        # Run simulation loop
        for tick in range(1, total_ticks + 1):
            if not _running:
                break

            _current_tick = tick

            # Check for commands between ticks
            process_inter_tick_commands()
            if not _running:
                break

            # Shuffle agents for fairness
            tick_agents = list(_agents)
            random.shuffle(tick_agents)

            for agent_data in tick_agents:
                if not _running:
                    break
                try:
                    run_agent_tick(agent_data, tick, platform_type, SocialPost)
                except Exception as e:
                    emit_error(f"Agent {agent_data['name']} tick {tick} error: {e}")

            # Emit progress every tick (simulations are usually short)
            emit_status(
                progress=round(tick / total_ticks * 100),
                events_count=_events_count,
            )

        # Done
        emit_event({
            "type": "simulation_complete",
            "stats": get_stats(),
        })

    except ImportError as e:
        emit_error(f"Dependencies not installed: {e}. Install with: pip install camel-ai[openai]")
    except Exception as e:
        emit_error(f"Simulation error: {e}\n{traceback.format_exc()}")


def run_agent_tick(agent_data: dict, tick: int, platform_type: str, SocialPost):
    """Run a single agent's turn in the simulation."""
    global _events_count

    agent = agent_data["agent"]
    agent_id = agent_data["id"]
    agent_name = agent_data["name"]

    # Build the prompt with current feed
    feed_text = _platform.format_feed(agent_id)

    prompt = (
        f"Tick {tick} on {platform_type}.\n\n"
        f"{feed_text}\n\n"
        f"As {agent_name}, what would you do? Choose ONE action:\n"
        f"1. POST: Write a new post about your thoughts on the current topics\n"
        f"2. REPLY: Reply to a specific post in the feed\n"
        f"3. REACT: React to a post (like, dislike, repost)\n"
        f"4. SKIP: Do nothing this turn\n\n"
        f"Respond in this exact JSON format:\n"
        f'{{"action": "post|reply|react|skip", "content": "your text", "target_author": "name if replying/reacting"}}'
    )

    try:
        response = agent.step(prompt)
        response_text = response.msgs[0].content if response.msgs else ""

        # Parse agent response
        action_data = _parse_agent_action(response_text)
        action_type = action_data.get("action", "skip")
        content = action_data.get("content", "")
        target = action_data.get("target_author", "")

        if action_type == "skip" or not content:
            return

        # Create the post/reply on the platform
        if action_type == "post":
            post = SocialPost(
                author_id=agent_id,
                author_name=agent_name,
                content=content,
                tick=tick,
                post_type="post",
            )
            _platform.add_post(post)

        elif action_type == "reply":
            # Find the target post
            parent_id = None
            for p in reversed(_platform.posts):
                if p.author_name.lower() == target.lower():
                    parent_id = p.id
                    break
            post = SocialPost(
                author_id=agent_id,
                author_name=agent_name,
                content=content,
                tick=tick,
                post_type="reply",
                parent_id=parent_id,
            )
            _platform.add_post(post)

        elif action_type == "react":
            # Add reaction to the target's most recent post
            for p in reversed(_platform.posts):
                if p.author_name.lower() == target.lower():
                    p.reactions[agent_id] = content  # content = reaction type
                    break

        _events_count += 1
        emit_event({
            "type": "agent_action",
            "agent_id": agent_id,
            "action": action_type,
            "content": content,
            "tick": tick,
            "metadata": {
                "platform": platform_type,
                "agent_name": agent_name,
                "target": target,
            },
        })

    except Exception as e:
        emit_error(f"Agent {agent_name} LLM call failed: {e}")


def _parse_agent_action(text: str) -> dict:
    """Parse the agent's JSON action response."""
    # Try to extract JSON from the response
    text = text.strip()

    # Try direct JSON parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find JSON in markdown code block
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            try:
                return json.loads(part)
            except json.JSONDecodeError:
                continue

    # Try to find JSON between braces
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass

    # Fallback: treat entire text as a post
    if len(text) > 10:
        return {"action": "post", "content": text[:280], "target_author": ""}

    return {"action": "skip", "content": "", "target_author": ""}


def handle_inject(cmd: dict):
    """Inject an external event/post into the simulation."""
    global _events_count
    from platform_config import SocialPost

    event_content = cmd.get("content", "")
    tick = cmd.get("tick", _current_tick)

    if _platform is not None:
        post = SocialPost(
            author_id="system",
            author_name="Injected",
            content=event_content,
            tick=tick,
            post_type="post",
        )
        _platform.add_post(post)

    _events_count += 1
    emit_event({
        "type": "agent_action",
        "agent_id": "system",
        "action": "injected_event",
        "content": event_content,
        "tick": tick,
        "metadata": {"injected": True},
    })


def handle_interview(cmd: dict):
    """Interview a specific agent."""
    agent_id = cmd.get("agent_id")
    question = cmd.get("question") or cmd.get("prompt", "What do you think about the current situation?")

    if not _agents:
        emit_error("No agents available")
        return

    target = None
    for a in _agents:
        if a["id"] == agent_id or a["name"] == agent_id:
            target = a
            break

    if not target:
        emit_error(f"Agent {agent_id} not found")
        return

    try:
        # Give agent context about the current state
        feed_text = _platform.format_feed(target["id"]) if _platform else "No feed available."
        interview_prompt = (
            f"An interviewer asks you: {question}\n\n"
            f"Current social media context:\n{feed_text}\n\n"
            f"Respond naturally in character as {target['name']}. "
            f"Give a thoughtful response (2-4 sentences)."
        )

        response = target["agent"].step(interview_prompt)
        response_text = response.msgs[0].content if response.msgs else "No response"

        emit_event({
            "type": "interview_response",
            "agent_id": agent_id,
            "question": question,
            "response": response_text,
            "tick": _current_tick,
        })
    except Exception as e:
        emit_error(f"Interview failed: {e}")


def handle_status():
    emit_status(
        progress=round(_current_tick / max(_total_ticks, 1) * 100),
        events_count=_events_count,
    )


def get_stats() -> dict:
    return {
        "total_events": _events_count,
        "ticks": _current_tick,
        "total_ticks": _total_ticks,
        "agent_count": len(_agents),
    }


if __name__ == "__main__":
    run()
