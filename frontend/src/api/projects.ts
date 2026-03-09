import { api } from "./client";

export const projectsApi = {
  list: (cursor?: string) => api.get("/projects", { params: { cursor } }),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: { name: string; scenario_type: string }) => api.post("/projects", data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  uploadDocument: (projectId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/projects/${projectId}/documents`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  buildGraph: (projectId: string) => api.post(`/projects/${projectId}/graph/build`),
  getGraph: (projectId: string) => api.get(`/projects/${projectId}/graph`),
  searchGraph: (projectId: string, query: string) =>
    api.post(`/projects/${projectId}/graph/search`, { query }),
};
