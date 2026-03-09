import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { projectsApi } from "@/api/projects";
import { simulationApi } from "@/api/simulation";
import { StepProgress } from "@/components/layout/StepProgress";
import { useSimulationStore } from "@/store/simulationStore";
import { ENGINE_MAP } from "@shared/types/project";
import type { ScenarioType } from "@shared/types/project";

export default function Step2Setup() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const setSimulation = useSimulationStore((s) => s.setSimulation);

  const [agentCount, setAgentCount] = useState(10);
  const [tickCount, setTickCount] = useState(20);
  const [seedContext, setSeedContext] = useState("");
  const [platform, setPlatform] = useState<"twitter" | "reddit">("twitter");

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
      <h2 className="text-xl font-bold text-navy">Step 2: Environment Setup</h2>
      <p className="text-gray-500">Configure agents and simulation parameters.</p>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5 max-w-lg">
        {/* Agent Count */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Agent Count</label>
          <input
            type="number"
            min={1}
            max={100}
            value={agentCount}
            onChange={(e) => setAgentCount(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-violet"
          />
        </div>

        {/* Tick Count */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tick Count</label>
          <input
            type="number"
            min={1}
            max={500}
            value={tickCount}
            onChange={(e) => setTickCount(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-violet"
          />
        </div>

        {/* Seed Context */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Seed Context</label>
          <textarea
            rows={3}
            value={seedContext}
            onChange={(e) => setSeedContext(e.target.value)}
            placeholder="Describe the initial scenario context..."
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-violet resize-none"
          />
        </div>

        {/* Platform (OASIS only) */}
        {isOasis && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as "twitter" | "reddit")}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-violet"
            >
              <option value="twitter">Twitter</option>
              <option value="reddit">Reddit</option>
            </select>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <span
            className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white"
            style={{ backgroundColor: isOasis ? "#F59E0B" : "#00C4B4" }}
          >
            {engine.toUpperCase()}
          </span>
          <span className="text-xs text-gray-400">Engine selected based on scenario type</span>
        </div>
      </div>

      {createMutation.isError && (
        <p className="text-sm text-red-600">Failed to create simulation. Please try again.</p>
      )}

      <button
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending}
        className="bg-violet text-white px-6 py-2 rounded hover:bg-violet/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {createMutation.isPending ? "Creating..." : "Create Simulation"}
      </button>
    </div>
  );
}
