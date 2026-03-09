import type { EngineType, ScenarioType } from "@shared/types/project";
import { ENGINE_MAP } from "@shared/types/project";

export const ENGINE_COLORS: Record<EngineType, string> = {
  oasis: "#F59E0B",
  concordia: "#00C4B4",
};

export const ENGINE_LABELS: Record<EngineType, string> = {
  oasis: "OASIS",
  concordia: "Concordia",
};

export function getEngineForScenario(scenario: ScenarioType): EngineType {
  return ENGINE_MAP[scenario];
}

export const SCENARIO_LABELS: Record<ScenarioType, string> = {
  fin_sentiment: "FinSentiment",
  content_lab: "ContentLab",
  crisis_pr: "CrisisSimulator",
  policy_lab: "PolicyLab",
  war_game: "WarGame",
  train_lab: "TrainLab",
};
