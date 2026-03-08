"""IPC layer for Concordia simulation runner.

Handles JSON-line communication between the TypeScript backend and the Python
Concordia simulation process over stdin/stdout. Extends basic IPC with
checkpoint save/load capabilities.
"""

import json
import os
import pickle
import sys
from typing import Any, Dict, Optional


def send_event(event_type: str, **kwargs: Any) -> None:
    """Send a JSON-line event to the parent process via stdout."""
    event = {"type": event_type, **kwargs}
    sys.stdout.write(json.dumps(event) + "\n")
    sys.stdout.flush()


def read_command() -> Optional[Dict[str, Any]]:
    """Read a JSON-line command from stdin. Returns None on EOF."""
    try:
        line = sys.stdin.readline()
        if not line:
            return None
        return json.loads(line.strip())
    except (json.JSONDecodeError, IOError):
        return None


def send_error(message: str, details: Optional[Dict[str, Any]] = None) -> None:
    """Send an error event."""
    send_event("error", message=message, details=details or {})


def send_agent_action(
    agent_id: str,
    content: str,
    sim_timestamp: int = 0,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Send an agent action event."""
    send_event(
        "agent_action",
        agent_id=agent_id,
        content=content,
        sim_timestamp=sim_timestamp,
        metadata=metadata or {},
    )


def send_grounded_var(name: str, value: float, tick: int = 0) -> None:
    """Send a grounded variable update."""
    send_event("grounded_var", name=name, value=value, tick=tick)


def send_branch_update(
    branch_id: str, label: str, status: str, details: Optional[Dict[str, Any]] = None
) -> None:
    """Send a branch update event."""
    send_event(
        "branch_update",
        branch_id=branch_id,
        label=label,
        status=status,
        details=details or {},
    )


def send_status(status: str, details: Optional[Dict[str, Any]] = None) -> None:
    """Send a status event."""
    send_event("status", status=status, details=details or {})


def send_simulation_complete(stats: Optional[Dict[str, Any]] = None) -> None:
    """Send simulation complete event."""
    send_event("simulation_complete", stats=stats or {})


def save_checkpoint(state: Any, path: Optional[str] = None) -> str:
    """Save simulation state to a checkpoint file using pickle."""
    if path is None:
        path = f"/tmp/concordia_checkpoint_{os.getpid()}.pkl"
    os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(state, f)
    send_status("checkpoint_saved", {"path": path})
    return path


def load_checkpoint(path: str) -> Any:
    """Load simulation state from a checkpoint file."""
    if not os.path.exists(path):
        send_error(f"Checkpoint not found: {path}")
        return None
    with open(path, "rb") as f:
        state = pickle.load(f)
    send_status("checkpoint_loaded", {"path": path})
    return state
