import type { ScenarioType } from "./project";

export interface SimConfig {
  scenario_type: ScenarioType;
  agent_count: number;
  tick_count: number;
  seed_context: string;
  platform?: "twitter" | "reddit";
  branches?: BranchConfig[];
  custom_params?: Record<string, unknown>;
}

export interface BranchConfig {
  label: string;
  description: string;
  override_vars: Record<string, unknown>;
}

export interface Simulation {
  id: string;
  project_id: string;
  engine: string;
  status: "pending" | "configuring" | "running" | "completed" | "failed";
  config: SimConfig;
  checkpoint_path?: string;
  grounded_vars: Record<string, number>;
  stats: Record<string, unknown>;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface SimEvent {
  id: number;
  simulation_id: string;
  branch_id?: string;
  agent_id?: string;
  event_type: string;
  platform?: string;
  content?: string;
  sim_timestamp: number;
  metadata: Record<string, unknown>;
}

export interface IpcCommand {
  type: "start_simulation" | "inject_event" | "interview_agent" | "get_status" | "stop_simulation" | "save_checkpoint" | "load_checkpoint" | "inject_manual_action" | "set_grounded_var" | "fork_scenario";
  [key: string]: unknown;
}

export interface IpcEvent {
  type: "agent_action" | "grounded_var" | "branch_update" | "simulation_complete" | "error" | "interview_response" | "status";
  [key: string]: unknown;
}

export interface StakeholderAcceptance {
  stakeholder_group: string;
  branch_label: string;
  acceptance_score: number;
  sentiment: "positive" | "neutral" | "negative";
  sample_size: number;
}

export interface AcceptanceMatrix {
  simulation_id: string;
  groups: string[];
  branches: string[];
  cells: StakeholderAcceptance[];
  generated_at: string;
}
