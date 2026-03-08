import { ENGINE_MAP, type ScenarioType, type EngineType } from "@shared/types/project";
import type { IpcCommand, IpcEvent, SimConfig } from "@shared/types/simulation";
import { BaseRunner } from "./runners/baseRunner";
import { OasisRunner } from "./runners/oasisRunner";
import { ConcordiaRunner } from "./runners/concordiaRunner";
import {
  createSimulation,
  updateSimulation,
  getSimulation,
} from "../db/queries/simulations";
import { logger } from "../utils/logger";

const CONCORDIA_ONLY_COMMANDS = new Set([
  "save_checkpoint",
  "load_checkpoint",
  "inject_manual_action",
  "set_grounded_var",
  "fork_scenario",
]);

export function getEngineForScenario(scenarioType: ScenarioType): EngineType {
  return ENGINE_MAP[scenarioType];
}

export class SimulationService {
  private runners = new Map<string, BaseRunner>();

  async startSimulation(
    projectId: string,
    config: SimConfig
  ): Promise<string> {
    const engine = getEngineForScenario(config.scenario_type);

    const simRow = await createSimulation({
      projectId,
      engine,
      config: config as unknown as Record<string, unknown>,
    });

    const runner =
      engine === "oasis" ? new OasisRunner() : new ConcordiaRunner();

    runner.onEvent(async (event: IpcEvent) => {
      try {
        await this.handleEvent(simRow.id, event);
      } catch (err) {
        logger.error({ err, simId: simRow.id }, "Error handling event");
      }
    });

    await updateSimulation(simRow.id, {
      status: "running",
      started_at: new Date().toISOString(),
    });

    await runner.start(simRow.id, config as unknown as Record<string, unknown>);
    this.runners.set(simRow.id, runner);

    logger.info({ simId: simRow.id, engine, scenario: config.scenario_type }, "Simulation started");
    return simRow.id;
  }

  async stopSimulation(simId: string, reason?: string): Promise<void> {
    const runner = this.runners.get(simId);
    if (!runner) {
      throw new Error(`No running simulation found: ${simId}`);
    }

    await runner.stop(reason);
    this.runners.delete(simId);

    await updateSimulation(simId, {
      status: "completed",
      completed_at: new Date().toISOString(),
    });

    logger.info({ simId, reason }, "Simulation stopped");
  }

  async getStatus(simId: string): Promise<{
    running: boolean;
    dbStatus: string | null;
    errors: string[];
  }> {
    const runner = this.runners.get(simId);
    const simRow = await getSimulation(simId);

    return {
      running: runner?.isRunning ?? false,
      dbStatus: simRow?.status ?? null,
      errors: runner?.errors ?? [],
    };
  }

  async forwardCommand(simId: string, cmd: IpcCommand): Promise<void> {
    const runner = this.runners.get(simId);
    if (!runner) {
      throw new Error(`No running simulation found: ${simId}`);
    }

    if (CONCORDIA_ONLY_COMMANDS.has(cmd.type) && !(runner instanceof ConcordiaRunner)) {
      throw new Error(
        `Command "${cmd.type}" is only supported by the Concordia engine`
      );
    }

    await runner.sendCommand(cmd);
  }

  private async handleEvent(simId: string, event: IpcEvent): Promise<void> {
    logger.debug({ simId, eventType: event.type }, "Simulation event");

    if (event.type === "grounded_var") {
      const sim = await getSimulation(simId);
      if (sim) {
        const vars = { ...sim.grounded_vars, [event.name as string]: event.value as number };
        await updateSimulation(simId, { grounded_vars: vars });
      }
    }

    if (event.type === "simulation_complete") {
      await updateSimulation(simId, {
        status: "completed",
        completed_at: new Date().toISOString(),
        stats: (event.stats as Record<string, unknown>) || {},
      });
      this.runners.delete(simId);
    }

    if (event.type === "error") {
      logger.error({ simId, error: event.message }, "Simulation error event");
      await updateSimulation(simId, { status: "failed" });
    }
  }
}

let instance: SimulationService | null = null;
export function getSimulationService(): SimulationService {
  if (!instance) instance = new SimulationService();
  return instance;
}
