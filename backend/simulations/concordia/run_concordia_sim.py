#!/usr/bin/env python3
"""Main Concordia simulation runner.

Communicates with the TypeScript backend via JSON-line IPC over stdin/stdout.
Receives configuration as a CLI argument, then listens for commands on stdin.
Supports checkpointing, branching, and grounded variables.
"""

import json
import sys
import signal
from typing import Any, Dict, List, Optional

from concordia_ipc import (
    load_checkpoint,
    read_command,
    save_checkpoint,
    send_agent_action,
    send_error,
    send_event,
    send_simulation_complete,
    send_status,
)
from agent_factory import create_concordia_agents
from game_masters import BaseGameMaster, CrisisPrGameMaster

try:
    from concordia.agents import entity_agent
except ImportError:
    entity_agent = None


SCENARIO_GM_MAP: Dict[str, type] = {
    "crisis_pr": CrisisPrGameMaster,
}


class ConcordiaSimulation:
    """Manages a Concordia simulation."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.simulation_id: str = config.get("simulation_id", "unknown")
        self.scenario_type: str = config.get("scenario_type", "policy_lab")
        self.agents: List[Dict[str, Any]] = []
        self.game_master: Optional[BaseGameMaster] = None
        self.running: bool = False

    def setup(self) -> None:
        """Initialize simulation components."""
        agent_profiles = self.config.get("agent_profiles", [])
        self.agents = create_concordia_agents(agent_profiles)

        gm_class = SCENARIO_GM_MAP.get(self.scenario_type, BaseGameMaster)
        self.game_master = gm_class(self.config)
        self.game_master.setup(self.agents)

        send_status("configured", {
            "simulation_id": self.simulation_id,
            "scenario_type": self.scenario_type,
            "agent_count": len(self.agents),
            "game_master": gm_class.__name__,
        })

    def run_tick(self) -> None:
        """Execute a single simulation tick."""
        if self.game_master is None:
            return

        self.game_master.advance_tick()

        for agent in self.agents:
            send_agent_action(
                agent_id=agent["name"],
                content=f"[Tick {self.game_master.tick}] Agent action placeholder",
                sim_timestamp=self.game_master.tick,
            )

    def run(self) -> None:
        """Main simulation loop."""
        self.running = True
        send_status("running", {"simulation_id": self.simulation_id})

        while self.running and self.game_master and not self.game_master.is_complete():
            cmd = read_command()
            if cmd is not None:
                self.handle_command(cmd)
            else:
                self.run_tick()

        stats = {}
        if self.game_master:
            stats = {
                "simulation_id": self.simulation_id,
                "total_ticks": self.game_master.tick,
                "agent_count": len(self.agents),
                "grounded_vars": self.game_master.grounded_vars,
                "branches": len(self.game_master.branches),
            }
        send_simulation_complete(stats)

    def handle_command(self, cmd: Dict[str, Any]) -> None:
        """Handle an incoming IPC command."""
        cmd_type = cmd.get("type", "")

        if cmd_type == "stop_simulation":
            self.running = False
            send_status("stopping", {"reason": cmd.get("reason", "unknown")})

        elif cmd_type == "inject_event":
            if self.game_master:
                self.game_master.inject_event(cmd.get("event", {}))

        elif cmd_type == "interview_agent":
            agent_id = cmd.get("agent_id", "")
            send_event("interview_response", agent_id=agent_id, response="Interview placeholder")

        elif cmd_type == "get_status":
            details: Dict[str, Any] = {}
            if self.game_master:
                details = {
                    "tick": self.game_master.tick,
                    "max_ticks": self.game_master.max_ticks,
                    "agent_count": len(self.agents),
                    "grounded_vars": self.game_master.grounded_vars,
                }
            send_status("running", details)

        elif cmd_type == "save_checkpoint":
            state = self._get_state()
            path = cmd.get("path")
            save_checkpoint(state, path)

        elif cmd_type == "load_checkpoint":
            path = cmd.get("path", "")
            state = load_checkpoint(path)
            if state:
                self._restore_state(state)

        elif cmd_type == "inject_manual_action":
            agent_id = cmd.get("agent_id", "")
            action = cmd.get("action", "")
            send_agent_action(
                agent_id=agent_id,
                content=f"[Manual] {action}",
                sim_timestamp=self.game_master.tick if self.game_master else 0,
                metadata={"manual": True, **(cmd.get("metadata", {}))},
            )

        elif cmd_type == "set_grounded_var":
            if self.game_master:
                name = cmd.get("name", "")
                value = float(cmd.get("value", 0))
                self.game_master.set_grounded_var(name, value)

        elif cmd_type == "fork_scenario":
            if self.game_master:
                label = cmd.get("branch_label", "unnamed")
                override_vars = cmd.get("override_vars", {})
                self.game_master.fork_branch(label, override_vars)

        else:
            send_error(f"Unknown command: {cmd_type}")

    def _get_state(self) -> Dict[str, Any]:
        """Capture current simulation state for checkpointing."""
        state: Dict[str, Any] = {
            "simulation_id": self.simulation_id,
            "config": self.config,
            "agents": self.agents,
        }
        if self.game_master:
            state["tick"] = self.game_master.tick
            state["grounded_vars"] = dict(self.game_master.grounded_vars)
            state["branches"] = list(self.game_master.branches)
        return state

    def _restore_state(self, state: Dict[str, Any]) -> None:
        """Restore simulation state from a checkpoint."""
        self.agents = state.get("agents", [])
        if self.game_master and "tick" in state:
            self.game_master.tick = state["tick"]
            self.game_master.grounded_vars = state.get("grounded_vars", {})
            self.game_master.branches = state.get("branches", [])
        send_status("state_restored", {"tick": state.get("tick", 0)})


def main() -> None:
    """Entry point. Reads start_simulation command from stdin."""
    # Wait for start_simulation command
    cmd = read_command()
    if cmd is None or cmd.get("type") != "start_simulation":
        send_error("Expected start_simulation command")
        sys.exit(1)

    config = cmd.get("config", {})
    sim = ConcordiaSimulation(config)

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
