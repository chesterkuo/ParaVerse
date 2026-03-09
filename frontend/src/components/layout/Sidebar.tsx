import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "@/api/projects";
import { useAuth } from "@/hooks/useAuth";
import { useUiStore } from "@/store/uiStore";

export function Sidebar() {
  const { logout } = useAuth();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const { data } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list().then((r) => r.data.data),
  });

  return (
    <div className="w-64 bg-navy text-white flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <Link to="/" className="text-xl font-bold text-violet">ParaVerse</Link>
      </div>
      <nav className="flex-1 overflow-auto p-4 space-y-2">
        {data?.map((project: { id: string; name: string }) => (
          <Link
            key={project.id}
            to={`/projects/${project.id}/step/1`}
            className="block px-3 py-2 rounded hover:bg-white/10 text-sm truncate"
          >
            {project.name}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10 space-y-2">
        <button onClick={toggleSidebar} className="text-xs text-white/50 hover:text-white">
          Toggle Sidebar
        </button>
        <button onClick={logout} className="text-xs text-red-400 hover:text-red-300">
          Logout
        </button>
      </div>
    </div>
  );
}
