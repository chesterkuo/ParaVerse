import { BaseRunner } from "./baseRunner";
import type { IpcCommand } from "@shared/types/simulation";
import path from "path";

const SUPPORTED_COMMANDS = new Set([
  "start_simulation",
  "inject_event",
  "interview_agent",
  "get_status",
  "stop_simulation",
  "save_checkpoint",
  "load_checkpoint",
  "inject_manual_action",
  "set_grounded_var",
  "fork_scenario",
] as const);

export class ConcordiaRunner extends BaseRunner {
  get pythonPath(): string {
    return process.env.CONCORDIA_PYTHON || "python3";
  }

  get scriptPath(): string {
    return path.resolve(
      import.meta.dir,
      "../../../simulations/concordia/run_concordia_sim.py"
    );
  }

  get supportedCommands(): Set<string> {
    return new Set(SUPPORTED_COMMANDS);
  }

  async sendCommand(cmd: IpcCommand): Promise<void> {
    if (!SUPPORTED_COMMANDS.has(cmd.type as any)) {
      throw new Error(
        `Unsupported command for Concordia runner: ${cmd.type}. Supported: ${[...SUPPORTED_COMMANDS].join(", ")}`
      );
    }
    return super.sendCommand(cmd);
  }

  async forkScenario(branchLabel: string, overrideVars: Record<string, unknown>): Promise<void> {
    await this.sendCommand({
      type: "fork_scenario",
      branch_label: branchLabel,
      override_vars: overrideVars,
    });
  }

  async saveCheckpoint(path?: string): Promise<void> {
    await this.sendCommand({
      type: "save_checkpoint",
      path: path,
    });
  }

  async loadCheckpoint(path: string): Promise<void> {
    await this.sendCommand({
      type: "load_checkpoint",
      path,
    });
  }

  async injectManualAction(agentId: string, action: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.sendCommand({
      type: "inject_manual_action",
      agent_id: agentId,
      action,
      metadata: metadata || {},
    });
  }

  async setGroundedVar(name: string, value: number): Promise<void> {
    await this.sendCommand({
      type: "set_grounded_var",
      name,
      value,
    });
  }
}
