"""Main OASIS simulation runner. Communicates with Bun backend via stdin/stdout JSONL."""
import os
import sys
import traceback
from oasis_ipc import read_commands, emit_event, emit_error, emit_status


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


# Global state
_simulation = None
_agents = []
_events_count = 0
_current_tick = 0
_total_ticks = 0


def handle_start(config: dict):
    global _simulation, _agents, _events_count, _current_tick, _total_ticks

    agent_configs = config.get("agents", [])
    total_ticks = config.get("tick_count", 50)
    platform_type = config.get("platform", "twitter")
    seed_context = config.get("seed_context", "")
    model_name = os.environ.get("LLM_MODEL_GENERAL", "gemini-2.5-flash")
    api_key = os.environ.get("LLM_API_KEY", "")
    base_url = os.environ.get("LLM_BASE_URL", "")

    _total_ticks = total_ticks

    try:
        from agent_factory import build_oasis_agents
        from platform_config import create_twitter_platform, create_reddit_platform

        # Build agents
        _agents = build_oasis_agents(agent_configs, model_name, api_key, base_url)

        # Create platform
        if platform_type == "reddit":
            platform = create_reddit_platform(len(_agents))
        else:
            platform = create_twitter_platform(len(_agents))

        # Inject seed context as initial post
        if seed_context:
            emit_event({
                "type": "agent_action",
                "agent_id": "system",
                "action": "seed_post",
                "content": seed_context,
                "tick": 0,
                "metadata": {"source": "seed_context"},
            })

        # Run simulation loop
        from oasis.simulation import Simulation
        _simulation = Simulation(platform=platform, agents=_agents)

        for tick in range(1, total_ticks + 1):
            _current_tick = tick
            tick_events = _simulation.step()

            for event in tick_events:
                _events_count += 1
                emit_event({
                    "type": "agent_action",
                    "agent_id": str(event.agent_id),
                    "action": event.action_type,
                    "content": getattr(event, "content", ""),
                    "tick": tick,
                    "metadata": {
                        "platform": platform_type,
                        "action_details": getattr(event, "details", {}),
                    },
                })

            # Emit progress every 5 ticks
            if tick % 5 == 0:
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
        emit_error(f"OASIS not installed: {e}. Install with: pip install camel-ai camel-oasis")
    except Exception as e:
        emit_error(f"Simulation error: {e}\n{traceback.format_exc()}")


def handle_inject(cmd: dict):
    global _events_count
    if _simulation is None:
        emit_error("No running simulation")
        return

    event_content = cmd.get("content", "")
    tick = cmd.get("tick", _current_tick)

    _simulation.inject_post(content=event_content, tick=tick)
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
    agent_id = cmd.get("agent_id")
    prompt = cmd.get("prompt", "What do you think about the current situation?")

    if not _agents:
        emit_error("No agents available")
        return

    target = None
    for agent in _agents:
        if str(agent.agent_id) == agent_id:
            target = agent
            break

    if not target:
        emit_error(f"Agent {agent_id} not found")
        return

    try:
        response = target.respond(prompt)
        emit_event({
            "type": "interview_response",
            "agent_id": agent_id,
            "prompt": prompt,
            "response": response,
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
