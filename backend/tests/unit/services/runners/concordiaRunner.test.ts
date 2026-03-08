import { describe, test, expect } from "bun:test";
import { ConcordiaRunner } from "../../../../src/services/runners/concordiaRunner";

describe("ConcordiaRunner", () => {
  test("script path contains run_concordia_sim.py", () => {
    const runner = new ConcordiaRunner();
    expect(runner.scriptPath).toContain("run_concordia_sim.py");
  });

  test("supports all commands including Concordia-specific ones", () => {
    const runner = new ConcordiaRunner();
    const cmds = runner.supportedCommands;

    // Base commands
    expect(cmds.has("start_simulation")).toBe(true);
    expect(cmds.has("inject_event")).toBe(true);
    expect(cmds.has("interview_agent")).toBe(true);
    expect(cmds.has("get_status")).toBe(true);
    expect(cmds.has("stop_simulation")).toBe(true);

    // Concordia-specific commands
    expect(cmds.has("save_checkpoint")).toBe(true);
    expect(cmds.has("load_checkpoint")).toBe(true);
    expect(cmds.has("inject_manual_action")).toBe(true);
    expect(cmds.has("set_grounded_var")).toBe(true);
    expect(cmds.has("fork_scenario")).toBe(true);
  });
});
