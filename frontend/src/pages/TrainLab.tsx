import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { simulationApi } from "@/api/simulation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSimulationStore } from "@/store/simulationStore";
import { SimulationStatus } from "@/components/simulation/SimulationStatus";
import { AgentFeed } from "@/components/simulation/AgentFeed";
import { CheckpointManager } from "@/components/simulation/CheckpointManager";
import { ScoringDashboard } from "@/components/simulation/ScoringDashboard";

export default function TrainLab() {
  const { t } = useTranslation();
  const { projectId } = useParams();
  void projectId;
  const { simId, status, events, groundedVars, setStatus, addEvent, setGroundedVars } =
    useSimulationStore();

  const [actionText, setActionText] = useState("");

  const { events: wsEvents, connected } = useWebSocket(
    simId ? `/ws/simulations/${simId}` : "",
  );

  const lastProcessedIdx = useRef(0);
  useEffect(() => {
    if (wsEvents.length <= lastProcessedIdx.current) return;
    for (let i = lastProcessedIdx.current; i < wsEvents.length; i++) {
      const ev = wsEvents[i];
      if (ev.type === "agent_action" || ev.type === "interview_response") {
        addEvent({
          event_type: ev.type,
          content: (ev.content as string) ?? "",
          sim_timestamp: (ev.tick as number) ?? 0,
          agent_id: ev.agent_id as string | undefined,
          metadata: ev as Record<string, unknown>,
        });
      } else if (ev.type === "grounded_var") {
        setGroundedVars((ev.vars ?? ev.data ?? {}) as Record<string, number>);
      } else if (ev.type === "status") {
        setStatus((ev.status as string) ?? "running");
      } else if (ev.type === "simulation_complete") {
        setStatus("completed");
      } else if (ev.type === "error") {
        setStatus("failed");
        addEvent({
          event_type: "error",
          content: (ev.message as string) ?? "Unknown error",
          sim_timestamp: (ev.tick as number) ?? 0,
        });
      }
    }
    lastProcessedIdx.current = wsEvents.length;
  }, [wsEvents, addEvent, setGroundedVars, setStatus]);

  const manualActionMutation = useMutation({
    mutationFn: (action: Record<string, unknown>) =>
      simulationApi.manualAction(simId!, action),
  });

  const handleSubmitAction = () => {
    if (!actionText.trim() || !simId) return;
    manualActionMutation.mutate({ text: actionText });
    setActionText("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy">{t("trainLab.title")}</h2>
          <p className="text-gray-500">{t("trainLab.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs text-gray-400">{connected ? t("common.connected") : t("common.disconnected")}</span>
        </div>
      </div>

      {!simId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
          {t("trainLab.noSimulation")}
        </div>
      )}

      {simId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-sm font-semibold text-gray-600">{t("trainLab.manualAction")}</h3>
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <textarea
                rows={4}
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder={t("trainLab.actionPlaceholder")}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-concordia resize-none text-sm"
              />
              <button
                onClick={handleSubmitAction}
                disabled={!actionText.trim() || manualActionMutation.isPending}
                className="w-full bg-concordia text-white py-2 rounded hover:bg-concordia/90 disabled:opacity-50 text-sm font-medium"
              >
                {manualActionMutation.isPending ? t("trainLab.injecting") : t("trainLab.injectAction")}
              </button>
              {manualActionMutation.isError && (
                <p className="text-xs text-red-600">{t("trainLab.injectFailed")}</p>
              )}
            </div>

            <CheckpointManager simulationId={simId!} disabled={status !== "running"} />
            <ScoringDashboard groundedVars={groundedVars} scenarioType="train_lab" />
            <SimulationStatus status={status} stats={{}} groundedVars={groundedVars} />
          </div>

          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-semibold text-gray-600">{t("trainLab.eventFeed")}</h3>
            <AgentFeed events={events} />
          </div>
        </div>
      )}
    </div>
  );
}
