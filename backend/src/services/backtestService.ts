import { createBacktest, updateBacktest } from "../db/queries/backtests";
import { createTask, updateTask } from "../db/queries/tasks";
import { getSimulationEvents } from "../db/queries/simulations";
import { getSimulationService } from "./simulationService";
import { getLlmService } from "./llmService";
import { logger } from "../utils/logger";
import type { SimConfig } from "@shared/types/simulation";

interface BacktestInput {
  projectId: string;
  ownerId: string;
  name: string;
  historicalContext: Record<string, unknown>;
}

interface SentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
}

export function distributionSimilarity(
  a: SentimentDistribution,
  b: SentimentDistribution
): number {
  const vecA = [a.positive, a.neutral, a.negative];
  const vecB = [b.positive, b.neutral, b.negative];

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < 3; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

export class BacktestService {
  private get simService() {
    return getSimulationService();
  }

  private get llmService() {
    return getLlmService();
  }

  async runBacktest(input: BacktestInput): Promise<{ backtestId: string; taskId: string }> {
    const backtest = await createBacktest({
      projectId: input.projectId,
      ownerId: input.ownerId,
      name: input.name,
      historicalContext: input.historicalContext,
    });

    const task = await createTask("backtest", backtest.id, input.ownerId);

    // Fire and forget — caller polls task status
    this.doBacktest(backtest.id, task.id, input).catch((err) => {
      logger.error({ err, backtestId: backtest.id }, "Backtest failed unexpectedly");
    });

    return { backtestId: backtest.id, taskId: task.id };
  }

  private async doBacktest(
    backtestId: string,
    taskId: string,
    input: BacktestInput
  ): Promise<void> {
    try {
      await updateTask(taskId, { status: "running", progress: 10 });
      await updateBacktest(backtestId, { status: "running" });

      // 1. Create and start simulation
      const config: SimConfig = {
        scenario_type: "fin_sentiment",
        ...input.historicalContext,
      };

      const simId = await this.simService.startSimulation(input.projectId, config);
      await updateBacktest(backtestId, { simulation_id: simId });
      await updateTask(taskId, { progress: 20 });

      // 2. Poll simulation status until completed or failed (max 10 minutes)
      const MAX_POLL_MS = 10 * 60 * 1000;
      const POLL_INTERVAL_MS = 3000;
      const startTime = Date.now();

      let simCompleted = false;
      while (Date.now() - startTime < MAX_POLL_MS) {
        const status = await this.simService.getStatus(simId);
        if (status.dbStatus === "completed") {
          simCompleted = true;
          break;
        }
        if (status.dbStatus === "failed") {
          throw new Error(`Simulation failed: ${status.errors.join(", ")}`);
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      if (!simCompleted) {
        throw new Error("Simulation timed out after 10 minutes");
      }

      await updateTask(taskId, { progress: 60 });

      // 3. Load events and classify sentiment
      const events = await getSimulationEvents(simId, {
        eventType: "agent_action",
        limit: 1000,
      });

      const eventTexts = events
        .map((e) => e.content)
        .filter(Boolean)
        .join("\n---\n");

      const predicted = await this.llmService.chatJson<SentimentDistribution>(
        [
          {
            role: "system",
            content:
              "You are a financial sentiment classifier. Analyze the following simulation event texts and return the overall sentiment distribution as JSON with keys: positive, neutral, negative. Each value should be a decimal between 0 and 1, and they must sum to 1.0.",
          },
          {
            role: "user",
            content: `Classify the sentiment distribution of these simulation events:\n\n${eventTexts}`,
          },
        ],
        { temperature: 0.1 }
      );

      await updateTask(taskId, { progress: 80 });

      // 4. Compute accuracy via cosine similarity
      const actual = (input.historicalContext.actual_distribution ?? {
        positive: 0.33,
        neutral: 0.34,
        negative: 0.33,
      }) as SentimentDistribution;

      const accuracy = distributionSimilarity(predicted, actual);

      // 5. Update backtest record
      await updateBacktest(backtestId, {
        predicted_distribution: predicted,
        accuracy_score: accuracy,
        status: "completed",
        completed_at: new Date().toISOString(),
      });

      await updateTask(taskId, {
        status: "completed",
        progress: 100,
        result: {
          accuracy_score: accuracy,
          predicted_distribution: predicted,
          actual_distribution: actual,
        },
      });

      logger.info({ backtestId, accuracy }, "Backtest completed");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, backtestId }, "Backtest failed");

      await updateBacktest(backtestId, {
        status: "failed",
        error: message,
      });

      await updateTask(taskId, {
        status: "failed",
        error: message,
      });
    }
  }
}

let instance: BacktestService | null = null;
export function getBacktestService(): BacktestService {
  if (!instance) instance = new BacktestService();
  return instance;
}
