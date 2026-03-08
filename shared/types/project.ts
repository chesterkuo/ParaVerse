export type ScenarioType = "fin_sentiment" | "content_lab" | "crisis_pr" | "policy_lab" | "war_game" | "train_lab";
export type EngineType = "oasis" | "concordia";

export const ENGINE_MAP: Record<ScenarioType, EngineType> = {
  fin_sentiment: "oasis",
  content_lab: "oasis",
  crisis_pr: "concordia",
  policy_lab: "concordia",
  war_game: "concordia",
  train_lab: "concordia",
};

export interface Project {
  id: string;
  name: string;
  scenario_type: ScenarioType;
  owner_id: string;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface CreateProjectInput {
  name: string;
  scenario_type: ScenarioType;
  settings?: Record<string, unknown>;
}
