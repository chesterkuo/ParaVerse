import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "./Sidebar";
import { useUiStore } from "@/store/uiStore";
import { Menu } from "lucide-react";

export function AppShell() {
  const { isAuthenticated } = useAuth();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  if (!isAuthenticated) return <Navigate to="/login" />;

  return (
    <div className="flex h-screen bg-bg">
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded-md bg-navy text-white cursor-pointer"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="fixed inset-y-0 left-0 z-40 w-64 lg:static lg:z-auto">
          <Sidebar />
        </aside>
      )}

      <main className="flex-1 overflow-auto p-6 pt-14 lg:pt-6">
        <Outlet />
      </main>
    </div>
  );
}
