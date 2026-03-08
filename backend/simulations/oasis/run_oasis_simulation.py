#!/usr/bin/env python3
"""Main OASIS simulation runner.

Communicates with the TypeScript backend via JSON-line IPC over stdin/stdout.
Receives configuration as a CLI argument, then listens for commands on stdin.
"""

import json
import sys
import signal
from typing import Any, Dict, List, Optional

from oasis_ipc import (
    read_command,
    send_agent_action,
    send_error,
    send_event,
    send_simulation_complete,
    send_status,
)
from agent_factory import create_oasis_agents
from platform_config import get_platform_config

try:
    from camel.agents import ChatAgent
    from oasis.social_platform.platform import Platform
    from oasis.social_agent.agent import SocialAgent
except ImportError:
    ChatAgent = None
    Platform = None
    SocialAgent = None


class OasisSimulation:
    """Manages an OASIS social simulation."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.simulation_id: str = config.get("simulation_id", "unknown")
        self.agents: List[Dict[str, Any]] = []
        self.platform_config: Dict[str, Any] = {}
        self.running: bool = False
        self.tick: int = 0
        self.max_ticks: int = config.get("tick_count", 100)

    def setup(self) -> None:
        """Initialize the simulation components."""
        platform_name = self.config.get("platform", "twitter")
        self.platform_config = get_platform_config(platform_name)

        agent_profiles = self.config.get("agent_profiles", [])
        self.agents = create_oasis_agents(agent_profiles)

        send_status("configured", {
            "simulation_id": self.simulation_id,
            "agent_count": len(self.agents),
            "platform": platform_name,
            "max_ticks": self.max_ticks,
        })

    def run_tick(self) -> None:
        """Execute a single simulation tick."""
        self.tick += 1
        for agent in self.agents:
            send_agent_action(
                agent_id=agent["name"],
                content=f"[Tick {self.tick}] Agent action placeholder",
                platform=self.platform_config.get("platform_name", "twitter"),
                sim_timestamp=self.tick,
            )

    def run(self) -> None:
        """Main simulation loop."""
        self.running = True
        send_status("running", {"simulation_id": self.simulation_id})

        while self.running and self.tick < self.max_ticks:
            cmd = read_command()
            if cmd is not None:
                self.handle_command(cmd)
            else:
                self.run_tick()

        send_simulation_complete({
            "simulation_id": self.simulation_id,
            "total_ticks": self.tick,
            "agent_count": len(self.agents),
        })

    def handle_command(self, cmd: Dict[str, Any]) -> None:
        """Handle an incoming IPC command."""
        cmd_type = cmd.get("type", "")

        if cmd_type == "stop_simulation":
            self.running = False
            send_status("stopping", {"reason": cmd.get("reason", "unknown")})

        elif cmd_type == "inject_event":
            send_status("event_injected", {
                "event": cmd.get("event", {}),
                "tick": self.tick,
            })

        elif cmd_type == "interview_agent":
            agent_id = cmd.get("agent_id", "")
            send_event("interview_response", agent_id=agent_id, response="Interview placeholder")

        elif cmd_type == "get_status":
            send_status("running", {
                "tick": self.tick,
                "max_ticks": self.max_ticks,
                "agent_count": len(self.agents),
            })

        else:
            send_error(f"Unknown command: {cmd_type}")


def main() -> None:
    """Entry point."""
    if len(sys.argv) < 2:
        send_error("Missing configuration argument")
        sys.exit(1)

    try:
        config = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        send_error(f"Invalid configuration JSON: {e}")
        sys.exit(1)

    sim = OasisSimulation(config)

    def handle_signal(signum: int, frame: Any) -> None:
        sim.running = False

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    try:
        sim.setup()
        sim.run()
    except Exception as e:
        send_error(f"Simulation error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
