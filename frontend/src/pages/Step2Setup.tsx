import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { projectsApi } from "@/api/projects";
import { simulationApi } from "@/api/simulation";
import { StepProgress } from "@/components/layout/StepProgress";
import { useSimulationStore } from "@/store/simulationStore";
import { ENGINE_MAP } from "@shared/types/project";
import type { ScenarioType } from "@shared/types/project";
import { Lightbulb, ChevronDown, ChevronUp, Info } from "lucide-react";

export default function Step2Setup() {
  const { t } = useTranslation();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const setSimulation = useSimulationStore((s) => s.setSimulation);

  const [agentCount, setAgentCount] = useState(10);
  const [tickCount, setTickCount] = useState(20);
  const [seedContext, setSeedContext] = useState("");
  const [platform, setPlatform] = useState<"twitter" | "reddit">("twitter");
  const [showGuide, setShowGuide] = useState(true);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId!).then((r) => r.data.data),
    enabled: !!projectId,
  });

  const scenarioType = (project?.scenario_type ?? "fin_sentiment") as ScenarioType;
  const engine = ENGINE_MAP[scenarioType];
  const isOasis = engine === "oasis";

  const createMutation = useMutation({
    mutationFn: () =>
      simulationApi.create({
        project_id: projectId!,
        config: {
          scenario_type: scenarioType,
          agent_count: agentCount,
          tick_count: tickCount,
          seed_context: seedContext,
          ...(isOasis ? { platform } : {}),
        },
      }),
    onSuccess: (res) => {
      const sim = res.data.data;
      setSimulation(sim.id, engine);
      navigate(`/projects/${projectId}/step/3`);
    },
  });

  return (
    <div className="space-y-6">
      <StepProgress currentStep={2} />
      <h2 className="text-xl font-bold text-navy">{t("step2.title")}</h2>
      <p className="text-gray-500">{t("step2.subtitle")}</p>

      {/* Seed Context Guidance Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-blue-100/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-800">{t("step2.guidanceTitle")}</span>
          </div>
          {showGuide ? <ChevronUp size={16} className="text-blue-500" /> : <ChevronDown size={16} className="text-blue-500" />}
        </button>
        {showGuide && (
          <div className="px-5 pb-4 space-y-3">
            <p className="text-sm text-blue-700">{t("step2.guidanceGeneral")}</p>

            {/* Scenario-specific seed context guidance */}
            <div className="bg-white/60 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-1.5">
                <Info size={14} className="text-violet" />
                <span className="text-xs font-semibold text-violet uppercase tracking-wider">
                  {t(`scenarios.${scenarioType}`)}
                </span>
              </div>
              <p className="text-sm text-blue-800">
                {t(`scenarios.${scenarioType}_seed_guide`)}
              </p>
            </div>

            {/* Example */}
            <div className="bg-white/40 rounded-lg p-4 border border-blue-100">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
                {t(`scenarios.${scenarioType}`)} — Example
              </p>
              <p className="text-xs text-blue-700 leading-relaxed whitespace-pre-wrap">
                {t(`scenarios.${scenarioType}_seed_example`)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5 max-w-2xl">
        {/* Agent Count */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("step2.agentCount")}</label>
          <input
            type="number" min={1} max={100} value={agentCount}
            onChange={(e) => setAgentCount(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-violet"
          />
          <p className="text-xs text-text-muted mt-1.5">{t("step2.agentCountTip")}</p>
        </div>

        {/* Tick Count */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("step2.tickCount")}</label>
          <input
            type="number" min={1} max={500} value={tickCount}
            onChange={(e) => setTickCount(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-violet"
          />
          <p className="text-xs text-text-muted mt-1.5">{t("step2.tickCountTip")}</p>
        </div>

        {/* Seed Context */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("step2.seedContext")}</label>
          <textarea
            rows={6} value={seedContext}
            onChange={(e) => setSeedContext(e.target.value)}
            placeholder={t("step2.seedContextPlaceholder")}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-violet resize-none"
          />
          <p className="text-xs text-text-muted mt-1.5">{t("step2.seedContextTip")}</p>
        </div>

        {/* Platform (OASIS only) */}
        {isOasis && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("step2.platform")}</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as "twitter" | "reddit")}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-violet"
            >
              <option value="twitter">{t("step2.twitter")}</option>
              <option value="reddit">{t("step2.reddit")}</option>
            </select>
            <p className="text-xs text-text-muted mt-1.5">{t("step2.platformTip")}</p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <span
            className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white"
            style={{ backgroundColor: isOasis ? "#F59E0B" : "#00C4B4" }}
          >
            {engine.toUpperCase()}
          </span>
          <span className="text-xs text-gray-400">{t("step2.engineInfo")}</span>
        </div>
      </div>

      {createMutation.isError && (
        <p className="text-sm text-red-600">{t("step2.createFailed")}</p>
      )}

      <button
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending}
        className="bg-violet text-white px-6 py-2 rounded hover:bg-violet/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {createMutation.isPending ? t("step2.creating") : t("step2.createSimulation")}
      </button>
    </div>
  );
}
