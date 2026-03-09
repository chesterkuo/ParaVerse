import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "./Sidebar";
import { useUiStore } from "@/store/uiStore";

export function AppShell() {
  const { isAuthenticated } = useAuth();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  if (!isAuthenticated) return <Navigate to="/login" />;

  return (
    <div className="flex h-screen bg-bg">
      {sidebarOpen && <Sidebar />}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
