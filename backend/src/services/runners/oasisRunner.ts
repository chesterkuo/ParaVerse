import { BaseRunner } from "./baseRunner";
import type { IpcCommand } from "@shared/types/simulation";
import path from "path";

const SUPPORTED_COMMANDS = new Set([
  "start_simulation",
  "inject_event",
  "interview_agent",
  "get_status",
  "stop_simulation",
] as const);

export class OasisRunner extends BaseRunner {
  get pythonPath(): string {
    if (process.env.OASIS_PYTHON) return process.env.OASIS_PYTHON;
    // Try venv Python first
    const venvPython = path.resolve(
      import.meta.dir,
      "../../../simulations/oasis/.venv/bin/python3"
    );
    try {
      const stat = Bun.file(venvPython);
      if (stat.size > 0) return venvPython;
    } catch { /* fallback */ }
    return "python3";
  }

  get scriptPath(): string {
    return path.resolve(
      import.meta.dir,
      "../../../simulations/oasis/run_oasis_simulation.py"
    );
  }

  get supportedCommands(): Set<string> {
    return new Set(SUPPORTED_COMMANDS);
  }

  async sendCommand(cmd: IpcCommand): Promise<void> {
    if (!SUPPORTED_COMMANDS.has(cmd.type as any)) {
      throw new Error(
        `Unsupported command for OASIS runner: ${cmd.type}. Supported: ${[...SUPPORTED_COMMANDS].join(", ")}`
      );
    }
    return super.sendCommand(cmd);
  }
}
