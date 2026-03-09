import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { projectsApi } from "@/api/projects";
import { useAuth } from "@/hooks/useAuth";
import { useUiStore } from "@/store/uiStore";
import { LayoutDashboard, FolderKanban, LogOut, ChevronLeft } from "lucide-react";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export function Sidebar() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const { projectId } = useParams();
  const { data } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list().then((r) => r.data.data),
  });

  return (
    <div className="w-64 bg-navy text-white flex flex-col h-full">
      {/* Logo + collapse */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
        <Link to="/" className="flex items-center gap-2 cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet to-violet-light flex items-center justify-center">
            <span className="text-white text-sm font-bold">P</span>
          </div>
          <span className="text-base font-semibold text-white">{t("common.appName")}</span>
        </Link>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer lg:hidden"
          aria-label={t("common.collapseSidebar")}
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-auto py-4 px-3 space-y-6">
        {/* Main nav */}
        <div>
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <LayoutDashboard size={18} />
            {t("nav.dashboard")}
          </Link>
        </div>

        {/* Projects */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/30">
            {t("nav.projects")}
          </div>
          <div className="space-y-0.5">
            {data?.map((project: { id: string; name: string }) => {
              const isActive = project.id === projectId;
              return (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}/step/1`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer truncate
                    ${isActive
                      ? "bg-violet/20 text-violet-light font-medium"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                    }`}
                >
                  <FolderKanban size={16} className="shrink-0" />
                  <span className="truncate">{project.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-white/10 space-y-2">
        <LanguageSwitcher />
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-white/50 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
        >
          <LogOut size={16} />
          {t("nav.signOut")}
        </button>
      </div>
    </div>
  );
}
