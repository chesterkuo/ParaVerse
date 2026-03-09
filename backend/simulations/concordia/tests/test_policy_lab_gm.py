"""Tests for PolicyLabGameMaster."""
import sys
import os
import types

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

ipc_stub = types.ModuleType("concordia_ipc")
ipc_stub.send_event = lambda *a, **kw: None
ipc_stub.send_grounded_var = lambda *a, **kw: None
ipc_stub.send_status = lambda *a, **kw: None
sys.modules["concordia_ipc"] = ipc_stub

from game_masters.policy_lab_gm import PolicyLabGameMaster


def test_initial_grounded_vars():
    gm = PolicyLabGameMaster({"simulation_id": "test", "tick_count": 10})
    gm.setup([{"name": "Alice", "id": "a1"}])
    assert "public_approval" in gm.grounded_vars
    assert "policy_support" in gm.grounded_vars
    assert "opposition_strength" in gm.grounded_vars
    assert "media_coverage" in gm.grounded_vars
    print("PASS: test_initial_grounded_vars")


def test_default_branches():
    gm = PolicyLabGameMaster({"simulation_id": "test", "tick_count": 10})
    gm.setup([{"name": "Alice", "id": "a1"}])
    assert len(gm.branches) == 3
    labels = [b["label"] for b in gm.branches]
    assert any("Reform" in l for l in labels)
    print("PASS: test_default_branches")


def test_tick_advances():
    gm = PolicyLabGameMaster({"simulation_id": "test", "tick_count": 10})
    gm.setup([{"name": "Alice", "id": "a1"}])
    for _ in range(5):
        gm.advance_tick()
    assert gm.tick == 5
    print("PASS: test_tick_advances")


def test_completion():
    gm = PolicyLabGameMaster({"simulation_id": "test", "tick_count": 3})
    gm.setup([])
    assert not gm.is_complete()
    for _ in range(3):
        gm.advance_tick()
    assert gm.is_complete()
    print("PASS: test_completion")


if __name__ == "__main__":
    test_initial_grounded_vars()
    test_default_branches()
    test_tick_advances()
    test_completion()
    print("\nAll PolicyLab GM tests passed!")
