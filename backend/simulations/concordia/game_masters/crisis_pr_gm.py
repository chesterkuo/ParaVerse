"""Crisis PR game master for Concordia simulations.

Manages a crisis PR scenario with brand reputation tracking and
A/B/C response strategy branches.
"""

from typing import Any, Dict, List, Optional

from game_masters.base_gm import BaseGameMaster
from concordia_ipc import send_grounded_var, send_status


class CrisisPrGameMaster(BaseGameMaster):
    """Game master for crisis PR simulations.

    Tracks brand_reputation_score and supports three response branches:
    - Branch A: Immediate public apology
    - Branch B: Defensive / deny responsibility
    - Branch C: Silent / no comment strategy
    """

    DEFAULT_BRANCHES = [
        {
            "label": "Branch A: Public Apology",
            "description": "Immediate, transparent public apology with corrective action plan",
            "override_vars": {"response_strategy": "apology", "transparency": 0.9},
        },
        {
            "label": "Branch B: Defensive Response",
            "description": "Deny responsibility, deflect blame, emphasize past record",
            "override_vars": {"response_strategy": "defensive", "transparency": 0.3},
        },
        {
            "label": "Branch C: No Comment",
            "description": "Silent strategy, wait for news cycle to move on",
            "override_vars": {"response_strategy": "silent", "transparency": 0.1},
        },
    ]

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.brand_reputation_score: float = 75.0
        self.crisis_severity: float = config.get("crisis_severity", 0.7)
        self.media_pressure: float = 0.0
        self.public_anger: float = 0.0

    def _initialize_grounded_vars(self) -> None:
        """Set initial grounded variables for crisis PR."""
        self.set_grounded_var("brand_reputation_score", self.brand_reputation_score)
        self.set_grounded_var("crisis_severity", self.crisis_severity)
        self.set_grounded_var("media_pressure", self.media_pressure)
        self.set_grounded_var("public_anger", self.public_anger)

    def setup(self, agents: List[Dict[str, Any]]) -> None:
        """Setup crisis PR game master and create default branches."""
        super().setup(agents)
        for branch_config in self.DEFAULT_BRANCHES:
            self.fork_branch(
                label=branch_config["label"],
                override_vars=branch_config["override_vars"],
            )
        send_status("crisis_pr_ready", {
            "branches": [b["label"] for b in self.branches],
            "initial_reputation": self.brand_reputation_score,
        })

    def _on_tick(self) -> None:
        """Update crisis dynamics each tick."""
        self._update_media_pressure()
        self._update_reputation()
        self._update_public_anger()

    def _update_media_pressure(self) -> None:
        """Media attention decays over time but spikes with events."""
        decay = 0.02
        self.media_pressure = max(0.0, self.media_pressure - decay)
        self.set_grounded_var("media_pressure", self.media_pressure)

    def _update_reputation(self) -> None:
        """Update brand reputation based on current dynamics."""
        impact = -self.crisis_severity * self.media_pressure * 2.0
        self.brand_reputation_score = max(
            0.0, min(100.0, self.brand_reputation_score + impact)
        )
        self.set_grounded_var("brand_reputation_score", self.brand_reputation_score)

    def _update_public_anger(self) -> None:
        """Public sentiment tracks loosely with reputation."""
        target = self.brand_reputation_score / 100.0
        self.public_anger += (target - self.public_anger) * 0.1
        self.public_anger = max(0.0, min(1.0, self.public_anger))
        self.set_grounded_var("public_anger", self.public_anger)

    def is_complete(self) -> bool:
        """Crisis simulation ends when ticks exhausted or reputation hits zero."""
        if self.brand_reputation_score <= 0:
            return True
        return super().is_complete()
