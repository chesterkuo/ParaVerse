import { api } from "./client";

export const simulationApi = {
  listByProject: (projectId: string) =>
    api.get(`/simulations/by-project/${projectId}`),
  create: (data: { project_id: string; config: { scenario_type: string; agent_count: number; tick_count: number; seed_context: string; platform?: string; branches?: unknown[] } }) =>
    api.post("/simulations", data),
  start: (id: string) => api.post(`/simulations/${id}/start`),
  getStatus: (id: string) => api.get(`/simulations/${id}/status`),
  getEvents: (id: string, limit?: number, offset?: number) =>
    api.get(`/simulations/${id}/events`, { params: { limit, offset } }),
  interview: (id: string, agentId: string, question: string) =>
    api.post(`/simulations/${id}/interview`, { agent_id: agentId, question }),
  fork: (id: string, branchLabel: string, overrideVars: Record<string, unknown>) =>
    api.post(`/simulations/${id}/fork`, { branch_label: branchLabel, override_vars: overrideVars }),
  checkpoint: (id: string) =>
    api.post(`/simulations/${id}/checkpoint`),
  listCheckpoints: (id: string) =>
    api.get(`/simulations/${id}/checkpoints`),
  loadCheckpoint: (id: string, filename: string) =>
    api.post(`/simulations/${id}/checkpoints/load`, { filename }),
  manualAction: (id: string, action: Record<string, unknown>) =>
    api.post(`/simulations/${id}/manual-action`, { action }),
  listAgents: (simulationId: string) =>
    api.get(`/simulations/${simulationId}/agents`),
  getTaskStatus: (taskId: string) => api.get(`/tasks/${taskId}`),
};
