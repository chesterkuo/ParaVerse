export interface ParaVerseClientConfig {
  baseURL: string;
  token?: string;
}

export function createParaVerseClient(config: ParaVerseClientConfig) {
  const headers = (): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (config.token) h["Authorization"] = `Bearer ${config.token}`;
    return h;
  };

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${config.baseURL}${path}`, {
      method,
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json() as any;
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json.data;
  }

  return {
    // Auth
    login: (email: string, password: string) =>
      request<{ accessToken: string; refreshToken: string }>("POST", "/api/v1/auth/login", { email, password }),
    register: (email: string, password: string, name: string) =>
      request<any>("POST", "/api/v1/auth/register", { email, password, name }),

    // Projects
    listProjects: () => request<any[]>("GET", "/api/v1/projects"),
    createProject: (data: { name: string; description?: string; scenario_type: string }) =>
      request<any>("POST", "/api/v1/projects", data),
    getProject: (id: string) => request<any>("GET", `/api/v1/projects/${id}`),

    // Documents & Graph
    buildGraph: (projectId: string) =>
      request<any>("POST", `/api/v1/projects/${projectId}/graph/build`),
    getGraph: (projectId: string) =>
      request<any>("GET", `/api/v1/projects/${projectId}/graph`),

    // Simulations
    createSimulation: (data: { project_id: string; config: Record<string, unknown> }) =>
      request<any>("POST", "/api/v1/simulations", data),
    startSimulation: (id: string) =>
      request<any>("POST", `/api/v1/simulations/${id}/start`),
    getSimulationStatus: (id: string) =>
      request<any>("GET", `/api/v1/simulations/${id}/status`),
    getSimulationEvents: (id: string, params?: { limit?: number; cursor?: string }) => {
      const qs = new URLSearchParams();
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.cursor) qs.set("cursor", params.cursor);
      const query = qs.toString();
      return request<any[]>("GET", `/api/v1/simulations/${id}/events${query ? `?${query}` : ""}`);
    },
    compareSimulations: (id: string, compareWithId: string) =>
      request<any>("POST", `/api/v1/simulations/${id}/compare`, { compareWithId }),

    // Reports
    generateReport: (simId: string) =>
      request<any>("POST", `/api/v1/simulations/${simId}/report`),
    getReport: (simId: string) =>
      request<any>("GET", `/api/v1/simulations/${simId}/report`),

    // Interview
    interviewAgent: (simId: string, agentId: string, question: string) =>
      request<any>("POST", `/api/v1/simulations/${simId}/interview`, { agent_id: agentId, question }),

    // Tasks
    getTask: (taskId: string) =>
      request<any>("GET", `/api/v1/tasks/${taskId}`),

    // Admin
    requestWarGameAccess: (data: { organization_name: string; organization_type: string; justification: string }) =>
      request<any>("POST", "/api/v1/admin/wargame-request", data),
    getMyWarGameRequest: () =>
      request<any>("GET", "/api/v1/admin/wargame-request/me"),

    // Utility
    setToken: (token: string) => { config.token = token; },
  };
}
