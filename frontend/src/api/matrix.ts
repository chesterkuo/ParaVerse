import { api } from "./client";
import type { AcceptanceMatrix } from "@shared/types/simulation";
import type { ApiResponse } from "@shared/types/api";

export const matrixApi = {
  getAcceptanceMatrix: (simulationId: string) =>
    api.get<ApiResponse<AcceptanceMatrix>>(`/simulations/${simulationId}/acceptance-matrix`).then((r) => r.data.data),
};
