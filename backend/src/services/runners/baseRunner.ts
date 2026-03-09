import path from "path";
import { logger } from "../../utils/logger";
import type { IpcCommand, IpcEvent } from "@shared/types/simulation";

export function parseJsonlLine(line: string): IpcEvent | null {
  if (!line || !line.trim()) return null;
  try {
    return JSON.parse(line.trim()) as IpcEvent;
  } catch {
    return null;
  }
}

export function serializeCommand(cmd: IpcCommand): string {
  return JSON.stringify(cmd) + "\n";
}

export type EventHandler = (event: IpcEvent) => void;

const MAX_STDERR_ENTRIES = 100;

export abstract class BaseRunner {
  protected process: ReturnType<typeof Bun.spawn> | null = null;
  protected eventHandlers: EventHandler[] = [];
  protected stderrBuffer: string[] = [];

  abstract get pythonPath(): string;
  abstract get scriptPath(): string;

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const idx = this.eventHandlers.indexOf(handler);
      if (idx >= 0) this.eventHandlers.splice(idx, 1);
    };
  }

  protected emit(event: IpcEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (err) {
        logger.error({ err }, "Event handler error");
      }
    }
  }

  async start(simId: string, config: Record<string, unknown>): Promise<void> {
    const maxMemory = parseInt(process.env.SIM_MAX_MEMORY_MB || "2048");

    // Set cwd to the script's directory so relative imports work
    const scriptDir = path.dirname(this.scriptPath);

    this.process = Bun.spawn([this.pythonPath, this.scriptPath], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      cwd: scriptDir,
      env: {
        ...process.env,
        SIMULATION_ID: simId,
        MAX_MEMORY_MB: String(maxMemory),
        PYTHONPATH: scriptDir,
      },
    });

    this.readStdout();
    this.readStderr();

    // Send start command via stdin
    await this.sendCommand({
      type: "start_simulation",
      config: { simulation_id: simId, ...config },
    } as IpcCommand);

    logger.info({ simId, script: this.scriptPath }, "Runner started");
  }

  private async readStdout(): Promise<void> {
    if (!this.process?.stdout) return;
    const reader = this.process.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const event = parseJsonlLine(line);
          if (event) {
            this.emit(event);
          }
        }
      }

      if (buffer.trim()) {
        const event = parseJsonlLine(buffer);
        if (event) this.emit(event);
      }
    } catch (err) {
      logger.error({ err }, "Error reading stdout");
    }
  }

  private async readStderr(): Promise<void> {
    if (!this.process?.stderr) return;
    const reader = this.process.stderr.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (this.stderrBuffer.length >= MAX_STDERR_ENTRIES) {
          this.stderrBuffer.shift();
        }
        this.stderrBuffer.push(text);
        logger.warn({ text }, "Runner stderr");
      }
    } catch (err) {
      logger.error({ err }, "Error reading stderr");
    }
  }

  async sendCommand(cmd: IpcCommand): Promise<void> {
    if (!this.process?.stdin) {
      throw new Error("Runner process not started");
    }
    this.process.stdin.write(serializeCommand(cmd));
    this.process.stdin.flush();
  }

  async stop(reason?: string): Promise<void> {
    if (!this.process) return;

    try {
      await this.sendCommand({ type: "stop_simulation", reason: reason || "user_requested" });
    } catch {
      // Process may already be dead
    }

    const gracefulTimeout = setTimeout(() => {
      if (this.isRunning) {
        logger.warn("Graceful shutdown timed out, killing process");
        this.process?.kill();
      }
    }, 5000);

    try {
      await this.process.exited;
    } finally {
      clearTimeout(gracefulTimeout);
    }

    logger.info({ reason }, "Runner stopped");
    this.process = null;
  }

  get isRunning(): boolean {
    return this.process !== null && this.process.exitCode === null;
  }

  get errors(): string[] {
    return [...this.stderrBuffer];
  }
}
