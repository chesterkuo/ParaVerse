"""Base game master for Concordia simulations.

Provides the foundation for scenario-specific game masters that control
simulation flow, inject events, and manage grounded variables.
"""

from typing import Any, Dict, List, Optional

from ..concordia_ipc import send_event, send_grounded_var, send_status


class BaseGameMaster:
    """Base class for Concordia game masters."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.simulation_id: str = config.get("simulation_id", "unknown")
        self.tick: int = 0
        self.max_ticks: int = config.get("tick_count", 100)
        self.grounded_vars: Dict[str, float] = {}
        self.branches: List[Dict[str, Any]] = []
        self.agents: List[Dict[str, Any]] = []

    def setup(self, agents: List[Dict[str, Any]]) -> None:
        """Initialize the game master with agents."""
        self.agents = agents
        self._initialize_grounded_vars()
        send_status("gm_ready", {
            "simulation_id": self.simulation_id,
            "agent_count": len(agents),
            "grounded_vars": self.grounded_vars,
        })

    def _initialize_grounded_vars(self) -> None:
        """Override to set initial grounded variables."""
        pass

    def set_grounded_var(self, name: str, value: float) -> None:
        """Set a grounded variable and emit an event."""
        self.grounded_vars[name] = value
        send_grounded_var(name, value, self.tick)

    def get_grounded_var(self, name: str, default: float = 0.0) -> float:
        """Get a grounded variable value."""
        return self.grounded_vars.get(name, default)

    def advance_tick(self) -> None:
        """Advance the simulation by one tick."""
        self.tick += 1
        self._on_tick()

    def _on_tick(self) -> None:
        """Override for per-tick game master logic."""
        pass

    def inject_event(self, event: Dict[str, Any]) -> None:
        """Inject an event into the simulation."""
        send_status("event_injected", {
            "event": event,
            "tick": self.tick,
        })

    def fork_branch(
        self, label: str, override_vars: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a new simulation branch."""
        branch = {
            "id": f"branch_{len(self.branches)}",
            "label": label,
            "fork_tick": self.tick,
            "override_vars": override_vars or {},
            "grounded_vars": dict(self.grounded_vars),
        }
        if override_vars:
            branch["grounded_vars"].update(override_vars)
        self.branches.append(branch)
        send_event("branch_update",
            branch_id=branch["id"],
            label=label,
            status="created",
        )
        return branch

    def is_complete(self) -> bool:
        """Check if the simulation should end."""
        return self.tick >= self.max_ticks
