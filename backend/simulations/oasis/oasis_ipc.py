"""IPC protocol for OASIS simulation engine."""
import sys
import json
from typing import Any, Generator


def read_commands() -> Generator[dict, None, None]:
    """Read JSONL commands from stdin."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError as e:
            emit_event({"type": "error", "message": f"Invalid command JSON: {e}"})


def emit_event(event: dict[str, Any]) -> None:
    """Write a JSONL event to stdout."""
    sys.stdout.write(json.dumps(event, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def emit_error(message: str) -> None:
    """Emit an error event."""
    emit_event({"type": "error", "message": message})


def emit_status(progress: int, events_count: int) -> None:
    """Emit a status event."""
    emit_event({"type": "status", "progress": progress, "events_count": events_count})
