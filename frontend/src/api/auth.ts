import { api } from "./client";

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  refresh: (refresh_token: string) =>
    api.post("/auth/refresh", { refresh_token }),
};
