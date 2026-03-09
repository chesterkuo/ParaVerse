import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Mutex for token refresh to prevent race conditions
let refreshPromise: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retried) {
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        // Reuse in-flight refresh request
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken })
            .then((res) => {
              localStorage.setItem("access_token", res.data.data.access_token);
              localStorage.setItem("refresh_token", res.data.data.refresh_token);
              return res.data.data.access_token as string;
            });
        }

        const newToken = await refreshPromise;
        refreshPromise = null;

        error.config._retried = true;
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return api(error.config);
      } catch {
        refreshPromise = null;
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
