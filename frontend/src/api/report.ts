import { api } from "./client";

export const reportApi = {
  generate: (simulationId: string) => api.post(`/simulations/${simulationId}/report`),
  get: (simulationId: string) => api.get(`/simulations/${simulationId}/report`),
};
