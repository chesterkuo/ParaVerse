import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { projectsApi } from "@/api/projects";
import { EngineTag } from "@/components/ui/EngineTag";
import { getEngineForScenario, SCENARIO_LABELS } from "@/utils/engineLabel";
import { formatDate } from "@/utils/formatters";
import type { ScenarioType } from "@shared/types/project";
import { Plus, FolderKanban, ArrowRight, X } from "lucide-react";

const SCENARIOS: ScenarioType[] = ["fin_sentiment", "content_lab", "crisis_pr", "policy_lab", "war_game", "train_lab"];

export default function Home() {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [scenario, setScenario] = useState<ScenarioType>("fin_sentiment");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: () => projectsApi.create({ name, scenario_type: scenario }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate(`/projects/${res.data.data.id}/step/1`);
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{t("home.title")}</h1>
          <p className="text-sm text-text-secondary mt-1">{t("home.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-violet text-white pl-4 pr-5 py-2.5 rounded-lg font-medium text-sm hover:bg-violet-light transition-colors cursor-pointer shadow-sm"
        >
          <Plus size={18} />
          {t("home.newProject")}
        </button>
      </div>

      {/* Create Project Modal-style Panel */}
      {showCreate && (
        <div className="bg-surface rounded-xl border border-border shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">{t("home.createNewProject")}</h2>
            <button onClick={() => setShowCreate(false)} className="p-1 rounded-md hover:bg-gray-100 text-text-muted cursor-pointer transition-colors">
              <X size={18} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">{t("home.projectName")}</label>
            <input
              type="text" placeholder={t("home.projectName")} value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-surface text-sm text-text-primary placeholder:text-text-muted"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">{t("home.scenarioType")}</label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {SCENARIOS.map((s) => (
                <button key={s} onClick={() => setScenario(s)}
                  className={`p-4 rounded-xl border-2 text-left cursor-pointer transition-all
                    ${scenario === s
                      ? "border-violet bg-violet/5 shadow-sm"
                      : "border-border hover:border-violet/30 hover:bg-surface-hover"
                    }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-medium text-sm text-text-primary">{SCENARIO_LABELS[s]}</span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">{t(`scenarios.${s}_desc`)}</p>
                  <div className="mt-2">
                    <EngineTag type={getEngineForScenario(s)} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || createMutation.isPending}
              className="flex items-center gap-2 bg-violet text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-violet-light transition-colors cursor-pointer disabled:opacity-50"
            >
              {createMutation.isPending ? t("home.creating") : t("home.createProject")}
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors cursor-pointer">
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface rounded-xl border border-border p-5 animate-pulse">
              <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
              <div className="h-4 w-28 bg-gray-100 rounded mb-3" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && projects?.length === 0 && (
        <div className="text-center py-16 bg-surface rounded-xl border border-border">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet/10 flex items-center justify-center">
            <FolderKanban size={28} className="text-violet" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">{t("home.noProjects")}</h3>
          <p className="text-sm text-text-secondary mb-6">{t("home.noProjectsHint")}</p>
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 bg-violet text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-violet-light transition-colors cursor-pointer">
            <Plus size={16} />
            {t("home.createProject")}
          </button>
        </div>
      )}

      {/* Project Cards */}
      {!isLoading && projects && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p: { id: string; name: string; scenario_type: string; created_at: string }) => (
            <button key={p.id} onClick={() => navigate(`/projects/${p.id}/step/1`)}
              className="group bg-surface p-5 rounded-xl border border-border hover:border-violet/30 hover:shadow-md text-left transition-all cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-text-primary group-hover:text-violet transition-colors">{p.name}</h3>
                <ArrowRight size={16} className="text-text-muted group-hover:text-violet transition-colors mt-0.5" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <EngineTag type={getEngineForScenario(p.scenario_type as ScenarioType)} />
                <span className="text-xs text-text-secondary">{SCENARIO_LABELS[p.scenario_type as ScenarioType]}</span>
              </div>
              <p className="text-xs text-text-muted">{formatDate(p.created_at)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
