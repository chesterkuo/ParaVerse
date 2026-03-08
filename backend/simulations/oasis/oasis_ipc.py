"""IPC layer for OASIS simulation runner.

Handles JSON-line communication between the TypeScript backend and the Python
OASIS simulation process over stdin/stdout.
"""

import json
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
    platform: str = "twitter",
    sim_timestamp: int = 0,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Send an agent action event."""
    send_event(
        "agent_action",
        agent_id=agent_id,
        content=content,
        platform=platform,
        sim_timestamp=sim_timestamp,
        metadata=metadata or {},
    )


def send_status(status: str, details: Optional[Dict[str, Any]] = None) -> None:
    """Send a status event."""
    send_event("status", status=status, details=details or {})


def send_simulation_complete(stats: Optional[Dict[str, Any]] = None) -> None:
    """Send simulation complete event."""
    send_event("simulation_complete", stats=stats or {})
