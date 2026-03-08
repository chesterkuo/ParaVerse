export interface AgentProfile {
  id: string;
  simulation_id: string;
  name: string;
  persona: string;
  demographics: {
    age_range: string;
    gender: string;
    occupation: string;
    income_level?: string;
    education?: string;
    personality_type?: string;
    [key: string]: unknown;
  };
  memory: Record<string, unknown>[];
}

export interface AgentDemographicDistribution {
  group_name: string;
  percentage: number;
  traits: Record<string, string>;
}
