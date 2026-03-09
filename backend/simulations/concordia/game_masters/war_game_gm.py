"""War Game game master for Concordia simulations.

Manages geopolitical scenario modeling with diplomatic tension, military
readiness, economic stability, and alliance dynamics.
"""

from typing import Any, Dict, List, Optional

from game_masters.base_gm import BaseGameMaster
from concordia_ipc import send_grounded_var, send_status


class WarGameGameMaster(BaseGameMaster):
    """Game master for geopolitical war game simulations.

    Tracks diplomatic_tension and supports branches for different strategies:
    - Branch A: Diplomatic engagement (de-escalation)
    - Branch B: Military posturing (deterrence)
    - Branch C: Economic sanctions (pressure)
    """

    DEFAULT_BRANCHES = [
        {
            "label": "Branch A: Diplomatic Engagement",
            "description": "Pursue dialogue, summits, and multilateral negotiations",
            "override_vars": {"strategy": "diplomatic", "aggression": 0.1},
        },
        {
            "label": "Branch B: Military Posturing",
            "description": "Increase military readiness and demonstrate force capability",
            "override_vars": {"strategy": "military", "aggression": 0.7},
        },
        {
            "label": "Branch C: Economic Sanctions",
            "description": "Apply economic pressure through trade restrictions and sanctions",
            "override_vars": {"strategy": "economic", "aggression": 0.4},
        },
    ]

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.diplomatic_tension: float = config.get("initial_tension", 50.0)
        self.military_readiness: float = config.get("initial_readiness", 30.0)
        self.economic_stability: float = config.get("initial_stability", 70.0)
        self.alliance_strength: float = config.get("initial_alliance", 50.0)

    def _initialize_grounded_vars(self) -> None:
        self.set_grounded_var("diplomatic_tension", self.diplomatic_tension)
        self.set_grounded_var("military_readiness", self.military_readiness)
        self.set_grounded_var("economic_stability", self.economic_stability)
        self.set_grounded_var("alliance_strength", self.alliance_strength)

    def setup(self, agents: List[Dict[str, Any]]) -> None:
        super().setup(agents)
        for branch_config in self.DEFAULT_BRANCHES:
            self.fork_branch(
                label=branch_config["label"],
                override_vars=branch_config["override_vars"],
            )
        send_status("war_game_ready", {
            "branches": [b["label"] for b in self.branches],
            "initial_tension": self.diplomatic_tension,
        })

    def _on_tick(self) -> None:
        self._update_tension()
        self._update_military()
        self._update_economy()
        self._update_alliances()

    def _update_tension(self) -> None:
        escalation = 0.5
        military_factor = self.military_readiness * 0.01
        self.diplomatic_tension = max(
            0.0, min(100.0, self.diplomatic_tension + escalation + military_factor)
        )
        self.set_grounded_var("diplomatic_tension", self.diplomatic_tension)

    def _update_military(self) -> None:
        if self.diplomatic_tension > 60:
            self.military_readiness = min(100.0, self.military_readiness + 1.0)
        else:
            self.military_readiness = max(0.0, self.military_readiness - 0.3)
        self.set_grounded_var("military_readiness", self.military_readiness)

    def _update_economy(self) -> None:
        tension_cost = self.diplomatic_tension * 0.01
        military_cost = self.military_readiness * 0.005
        self.economic_stability = max(
            0.0, self.economic_stability - tension_cost - military_cost
        )
        self.set_grounded_var("economic_stability", self.economic_stability)

    def _update_alliances(self) -> None:
        if self.diplomatic_tension > 70:
            self.alliance_strength = min(100.0, self.alliance_strength + 0.5)
        elif self.economic_stability < 30:
            self.alliance_strength = max(0.0, self.alliance_strength - 1.0)
        self.set_grounded_var("alliance_strength", self.alliance_strength)

    def is_complete(self) -> bool:
        if self.diplomatic_tension >= 100:
            return True
        if self.diplomatic_tension <= 5 and self.tick > 5:
            return True
        return super().is_complete()
