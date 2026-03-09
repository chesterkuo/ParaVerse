import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { projectsApi } from "@/api/projects";
import { EngineTag } from "@/components/ui/EngineTag";
import { getEngineForScenario, SCENARIO_LABELS } from "@/utils/engineLabel";
import { formatDate } from "@/utils/formatters";
import type { ScenarioType } from "@shared/types/project";

const SCENARIOS: ScenarioType[] = ["fin_sentiment", "content_lab", "crisis_pr", "policy_lab", "war_game", "train_lab"];

export default function Home() {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [scenario, setScenario] = useState<ScenarioType>("fin_sentiment");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: projects } = useQuery({
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy">Projects</h1>
        <button onClick={() => setShowCreate(true)} className="bg-violet text-white px-4 py-2 rounded hover:bg-violet/90">
          New Project
        </button>
      </div>

      {showCreate && (
        <div className="bg-white p-6 rounded-lg shadow mb-6 space-y-4">
          <input type="text" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded" />
          <div className="grid grid-cols-3 gap-3">
            {SCENARIOS.map((s) => (
              <button key={s} onClick={() => setScenario(s)}
                className={`p-3 rounded border-2 text-left ${scenario === s ? "border-violet" : "border-gray-200"}`}>
                <div className="font-medium text-sm">{SCENARIO_LABELS[s]}</div>
                <EngineTag type={getEngineForScenario(s)} />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate()} className="bg-navy text-white px-4 py-2 rounded">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded border">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects?.map((p: { id: string; name: string; scenario_type: string; created_at: string }) => (
          <button key={p.id} onClick={() => navigate(`/projects/${p.id}/step/1`)}
            className="bg-white p-4 rounded-lg shadow hover:shadow-md text-left transition-shadow">
            <h3 className="font-semibold text-navy">{p.name}</h3>
            <div className="flex items-center gap-2 mt-2">
              <EngineTag type={getEngineForScenario(p.scenario_type as ScenarioType)} />
              <span className="text-xs text-gray-500">{SCENARIO_LABELS[p.scenario_type as ScenarioType]}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">{formatDate(p.created_at)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
