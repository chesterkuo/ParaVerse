import { useCallback } from "react";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    localStorage.setItem("access_token", res.data.data.access_token);
    localStorage.setItem("refresh_token", res.data.data.refresh_token);
    setUser(res.data.data.user);
  }, [setUser]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await authApi.register({ email, password, name });
    localStorage.setItem("access_token", res.data.data.access_token);
    localStorage.setItem("refresh_token", res.data.data.refresh_token);
    setUser(res.data.data.user);
  }, [setUser]);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  }, [setUser]);

  return { user, login, register, logout, isAuthenticated: !!user };
}
