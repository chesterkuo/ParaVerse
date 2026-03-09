"""Policy Lab game master for Concordia simulations.

Manages a policy debate scenario tracking public approval, policy support,
opposition strength, and media coverage across policy reform branches.
"""

from typing import Any, Dict, List, Optional

from game_masters.base_gm import BaseGameMaster
from concordia_ipc import send_grounded_var, send_status


class PolicyLabGameMaster(BaseGameMaster):
    """Game master for policy impact simulations.

    Tracks public_approval and supports branches for different reform strategies:
    - Branch A: Aggressive reform (fast change, high risk)
    - Branch B: Gradual reform (slow change, low risk)
    - Branch C: Status quo (no change, monitor only)
    """

    DEFAULT_BRANCHES = [
        {
            "label": "Branch A: Aggressive Reform",
            "description": "Push bold policy changes quickly with strong enforcement",
            "override_vars": {"reform_speed": 0.9, "enforcement": 0.8},
        },
        {
            "label": "Branch B: Gradual Reform",
            "description": "Implement incremental changes with stakeholder buy-in",
            "override_vars": {"reform_speed": 0.3, "enforcement": 0.5},
        },
        {
            "label": "Branch C: Status Quo",
            "description": "Maintain current policies, observe and gather data",
            "override_vars": {"reform_speed": 0.0, "enforcement": 0.3},
        },
    ]

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.public_approval: float = config.get("initial_approval", 50.0)
        self.policy_support: float = config.get("initial_support", 40.0)
        self.opposition_strength: float = config.get("initial_opposition", 30.0)
        self.media_coverage: float = 0.0

    def _initialize_grounded_vars(self) -> None:
        self.set_grounded_var("public_approval", self.public_approval)
        self.set_grounded_var("policy_support", self.policy_support)
        self.set_grounded_var("opposition_strength", self.opposition_strength)
        self.set_grounded_var("media_coverage", self.media_coverage)

    def setup(self, agents: List[Dict[str, Any]]) -> None:
        super().setup(agents)
        for branch_config in self.DEFAULT_BRANCHES:
            self.fork_branch(
                label=branch_config["label"],
                override_vars=branch_config["override_vars"],
            )
        send_status("policy_lab_ready", {
            "branches": [b["label"] for b in self.branches],
            "initial_approval": self.public_approval,
        })

    def _on_tick(self) -> None:
        self._update_media_coverage()
        self._update_public_approval()
        self._update_opposition()

    def _update_media_coverage(self) -> None:
        decay = 0.03
        self.media_coverage = max(0.0, self.media_coverage - decay)
        self.set_grounded_var("media_coverage", self.media_coverage)

    def _update_public_approval(self) -> None:
        target = self.policy_support
        drift = (target - self.public_approval) * 0.05
        opposition_drag = -self.opposition_strength * 0.02
        self.public_approval = max(
            0.0, min(100.0, self.public_approval + drift + opposition_drag)
        )
        self.set_grounded_var("public_approval", self.public_approval)

    def _update_opposition(self) -> None:
        if self.public_approval < 40:
            self.opposition_strength = min(100.0, self.opposition_strength + 0.5)
        else:
            self.opposition_strength = max(0.0, self.opposition_strength - 0.3)
        self.set_grounded_var("opposition_strength", self.opposition_strength)

    def is_complete(self) -> bool:
        if self.public_approval <= 0 or self.public_approval >= 95:
            return True
        return super().is_complete()
