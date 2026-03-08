import { describe, test, expect } from "bun:test";
import { getEngineForScenario } from "../../../src/services/simulationService";
import { ConcordiaRunner } from "../../../src/services/runners/concordiaRunner";
import { OasisRunner } from "../../../src/services/runners/oasisRunner";
import type { ScenarioType } from "@shared/types/project";

describe("SimulationService", () => {
  test("getEngineForScenario returns correct engine types", () => {
    expect(getEngineForScenario("fin_sentiment")).toBe("oasis");
    expect(getEngineForScenario("content_lab")).toBe("oasis");
    expect(getEngineForScenario("crisis_pr")).toBe("concordia");
    expect(getEngineForScenario("policy_lab")).toBe("concordia");
    expect(getEngineForScenario("war_game")).toBe("concordia");
    expect(getEngineForScenario("train_lab")).toBe("concordia");
  });

  test("validates Concordia-only commands", () => {
    const oasisRunner = new OasisRunner();
    const concordiaRunner = new ConcordiaRunner();

    const concordiaOnlyCommands = [
      "save_checkpoint",
      "load_checkpoint",
      "inject_manual_action",
      "set_grounded_var",
      "fork_scenario",
    ];

    for (const cmd of concordiaOnlyCommands) {
      expect(oasisRunner.supportedCommands.has(cmd)).toBe(false);
      expect(concordiaRunner.supportedCommands.has(cmd)).toBe(true);
    }
  });
});
