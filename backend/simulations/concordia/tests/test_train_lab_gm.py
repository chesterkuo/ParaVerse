"""Tests for TrainLabGameMaster."""
import sys
import os
import types

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

ipc_stub = types.ModuleType("concordia_ipc")
ipc_stub.send_event = lambda *a, **kw: None
ipc_stub.send_grounded_var = lambda *a, **kw: None
ipc_stub.send_status = lambda *a, **kw: None
sys.modules["concordia_ipc"] = ipc_stub

from game_masters.train_lab_gm import TrainLabGameMaster


def test_initial_grounded_vars():
    gm = TrainLabGameMaster({"simulation_id": "test", "tick_count": 10})
    gm.setup([{"name": "Trainee", "id": "t1"}])
    assert "skill_level" in gm.grounded_vars
    assert "performance_score" in gm.grounded_vars
    assert "confidence" in gm.grounded_vars
    assert "scenario_difficulty" in gm.grounded_vars
    print("PASS: test_initial_grounded_vars")


def test_default_branches():
    gm = TrainLabGameMaster({"simulation_id": "test", "tick_count": 10})
    gm.setup([])
    assert len(gm.branches) == 3
    print("PASS: test_default_branches")


def test_skill_progression():
    gm = TrainLabGameMaster({"simulation_id": "test", "tick_count": 20})
    gm.setup([])
    initial_skill = gm.grounded_vars["skill_level"]
    for _ in range(10):
        gm.advance_tick()
    assert gm.tick == 10
    assert gm.grounded_vars["skill_level"] > initial_skill
    print("PASS: test_skill_progression")


def test_mastery_completion():
    gm = TrainLabGameMaster({"simulation_id": "test", "tick_count": 100})
    gm.setup([])
    gm.skill_level = 95.0
    gm.set_grounded_var("skill_level", 95.0)
    assert gm.is_complete()
    print("PASS: test_mastery_completion")


if __name__ == "__main__":
    test_initial_grounded_vars()
    test_default_branches()
    test_skill_progression()
    test_mastery_completion()
    print("\nAll TrainLab GM tests passed!")
