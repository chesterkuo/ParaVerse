import { describe, test, expect } from "bun:test";
import { OasisRunner } from "../../../../src/services/runners/oasisRunner";

describe("OasisRunner", () => {
  test("script path contains run_oasis_simulation.py", () => {
    const runner = new OasisRunner();
    expect(runner.scriptPath).toContain("run_oasis_simulation.py");
  });

  test("supports expected commands but NOT fork_scenario", () => {
    const runner = new OasisRunner();
    const cmds = runner.supportedCommands;
    expect(cmds.has("start_simulation")).toBe(true);
    expect(cmds.has("inject_event")).toBe(true);
    expect(cmds.has("interview_agent")).toBe(true);
    expect(cmds.has("get_status")).toBe(true);
    expect(cmds.has("stop_simulation")).toBe(true);
    expect(cmds.has("fork_scenario")).toBe(false);
  });
});
