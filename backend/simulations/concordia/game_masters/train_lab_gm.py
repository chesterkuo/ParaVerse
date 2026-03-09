"""Training Lab game master for Concordia simulations.

Manages training and decision-making scenarios with skill progression,
performance tracking, and adaptive difficulty.
"""

from typing import Any, Dict, List, Optional

from game_masters.base_gm import BaseGameMaster
from concordia_ipc import send_grounded_var, send_status


class TrainLabGameMaster(BaseGameMaster):
    """Game master for training and decision-making simulations.

    Tracks skill_level and supports branches for training approaches:
    - Branch A: Intensive training (high pressure, fast learning)
    - Branch B: Mentored learning (guided, steady pace)
    - Branch C: Self-directed (autonomous, variable pace)
    """

    DEFAULT_BRANCHES = [
        {
            "label": "Branch A: Intensive Training",
            "description": "High-pressure drills with immediate feedback and strict evaluation",
            "override_vars": {"training_intensity": 0.9, "feedback_frequency": 0.9},
        },
        {
            "label": "Branch B: Mentored Learning",
            "description": "Guided practice with experienced mentor and gradual challenge increase",
            "override_vars": {"training_intensity": 0.5, "feedback_frequency": 0.7},
        },
        {
            "label": "Branch C: Self-Directed",
            "description": "Autonomous learning with resources available on demand",
            "override_vars": {"training_intensity": 0.3, "feedback_frequency": 0.3},
        },
    ]

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.skill_level: float = config.get("initial_skill", 20.0)
        self.performance_score: float = config.get("initial_performance", 50.0)
        self.confidence: float = config.get("initial_confidence", 40.0)
        self.scenario_difficulty: float = config.get("initial_difficulty", 30.0)

    def _initialize_grounded_vars(self) -> None:
        self.set_grounded_var("skill_level", self.skill_level)
        self.set_grounded_var("performance_score", self.performance_score)
        self.set_grounded_var("confidence", self.confidence)
        self.set_grounded_var("scenario_difficulty", self.scenario_difficulty)

    def setup(self, agents: List[Dict[str, Any]]) -> None:
        super().setup(agents)
        for branch_config in self.DEFAULT_BRANCHES:
            self.fork_branch(
                label=branch_config["label"],
                override_vars=branch_config["override_vars"],
            )
        send_status("train_lab_ready", {
            "branches": [b["label"] for b in self.branches],
            "initial_skill": self.skill_level,
        })

    def _on_tick(self) -> None:
        self._update_skill()
        self._update_performance()
        self._update_confidence()
        self._adapt_difficulty()

    def _update_skill(self) -> None:
        learning_rate = 0.5
        performance_bonus = (self.performance_score - 50) * 0.01
        self.skill_level = max(
            0.0, min(100.0, self.skill_level + learning_rate + performance_bonus)
        )
        self.set_grounded_var("skill_level", self.skill_level)

    def _update_performance(self) -> None:
        gap = self.skill_level - self.scenario_difficulty
        self.performance_score = max(
            0.0, min(100.0, 50.0 + gap * 0.5)
        )
        self.set_grounded_var("performance_score", self.performance_score)

    def _update_confidence(self) -> None:
        target = self.performance_score
        self.confidence += (target - self.confidence) * 0.1
        self.confidence = max(0.0, min(100.0, self.confidence))
        self.set_grounded_var("confidence", self.confidence)

    def _adapt_difficulty(self) -> None:
        if self.skill_level > self.scenario_difficulty + 10:
            self.scenario_difficulty = min(100.0, self.scenario_difficulty + 1.0)
        self.set_grounded_var("scenario_difficulty", self.scenario_difficulty)

    def is_complete(self) -> bool:
        if self.skill_level >= 95:
            return True
        return super().is_complete()
