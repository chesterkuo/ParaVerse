import { useState, useCallback } from "react";
import { authApi } from "@/api/auth";

export function useAuth() {
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return { id: payload.sub, email: payload.email, name: payload.name || "" };
    } catch {
      return null;
    }
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    localStorage.setItem("access_token", res.data.data.access_token);
    localStorage.setItem("refresh_token", res.data.data.refresh_token);
    setUser(res.data.data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await authApi.register({ email, password, name });
    localStorage.setItem("access_token", res.data.data.access_token);
    localStorage.setItem("refresh_token", res.data.data.refresh_token);
    setUser(res.data.data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  }, []);

  return { user, login, register, logout, isAuthenticated: !!user };
}
