import { create } from "zustand";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  getToken: () => string | null;
}

function parseUserFromToken(): User | null {
  const token = localStorage.getItem("access_token");
  if (!token) return null;
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    return { id: payload.sub, email: payload.email, name: payload.name || "" };
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: parseUserFromToken(),
  setUser: (user) => set({ user }),
  getToken: () => localStorage.getItem("access_token"),
}));
