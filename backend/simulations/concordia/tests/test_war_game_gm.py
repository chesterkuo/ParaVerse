"""Tests for WarGameGameMaster."""
import sys
import os
import types

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

ipc_stub = types.ModuleType("concordia_ipc")
ipc_stub.send_event = lambda *a, **kw: None
ipc_stub.send_grounded_var = lambda *a, **kw: None
ipc_stub.send_status = lambda *a, **kw: None
sys.modules["concordia_ipc"] = ipc_stub

from game_masters.war_game_gm import WarGameGameMaster


def test_initial_grounded_vars():
    gm = WarGameGameMaster({"simulation_id": "test", "tick_count": 10})
    gm.setup([{"name": "Nation A", "id": "n1"}])
    assert "diplomatic_tension" in gm.grounded_vars
    assert "military_readiness" in gm.grounded_vars
    assert "economic_stability" in gm.grounded_vars
    assert "alliance_strength" in gm.grounded_vars
    print("PASS: test_initial_grounded_vars")


def test_default_branches():
    gm = WarGameGameMaster({"simulation_id": "test", "tick_count": 10})
    gm.setup([])
    assert len(gm.branches) == 3
    print("PASS: test_default_branches")


def test_escalation_mechanics():
    gm = WarGameGameMaster({"simulation_id": "test", "tick_count": 50})
    gm.setup([])
    for _ in range(10):
        gm.advance_tick()
    assert gm.tick == 10
    print("PASS: test_escalation_mechanics")


def test_conflict_threshold_completion():
    gm = WarGameGameMaster({"simulation_id": "test", "tick_count": 100})
    gm.setup([])
    gm.diplomatic_tension = 100.0
    gm.set_grounded_var("diplomatic_tension", 100.0)
    assert gm.is_complete()
    print("PASS: test_conflict_threshold_completion")


if __name__ == "__main__":
    test_initial_grounded_vars()
    test_default_branches()
    test_escalation_mechanics()
    test_conflict_threshold_completion()
    print("\nAll WarGame GM tests passed!")
