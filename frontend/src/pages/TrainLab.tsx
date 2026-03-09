import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { simulationApi } from "@/api/simulation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSimulationStore } from "@/store/simulationStore";
import { SimulationStatus } from "@/components/simulation/SimulationStatus";
import { AgentFeed } from "@/components/simulation/AgentFeed";

export default function TrainLab() {
  const { projectId: _projectId } = useParams();
  const { simId, status, events, groundedVars, setStatus, addEvent, setGroundedVars } =
    useSimulationStore();

  const [actionText, setActionText] = useState("");

  const { events: wsEvents, connected } = useWebSocket(
    simId ? `/ws/simulations/${simId}` : "",
  );

  // Process incoming WebSocket events
  useEffect(() => {
    if (wsEvents.length === 0) return;
    const latest = wsEvents[wsEvents.length - 1];

    if (latest.type === "agent_action" || latest.type === "interview_response") {
      addEvent({
        event_type: latest.type,
        content: (latest.content as string) ?? "",
        sim_timestamp: (latest.tick as number) ?? 0,
        agent_id: latest.agent_id as string | undefined,
        metadata: latest as Record<string, unknown>,
      });
    } else if (latest.type === "grounded_var") {
      const vars = (latest.vars ?? latest.data ?? {}) as Record<string, number>;
      setGroundedVars(vars);
    } else if (latest.type === "status") {
      setStatus((latest.status as string) ?? status);
    } else if (latest.type === "simulation_complete") {
      setStatus("completed");
    } else if (latest.type === "error") {
      setStatus("failed");
      addEvent({
        event_type: "error",
        content: (latest.message as string) ?? "Unknown error",
        sim_timestamp: (latest.tick as number) ?? 0,
      });
    }
  }, [wsEvents.length, wsEvents, addEvent, setGroundedVars, setStatus, status]);

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
          <h2 className="text-xl font-bold text-navy">TrainLab</h2>
          <p className="text-gray-500">Interactive training simulation with manual actions.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs text-gray-400">{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

      {!simId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
          No simulation configured. Create a TrainLab project and set up a simulation first.
        </div>
      )}

      {simId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Manual Action Panel */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-sm font-semibold text-gray-600">Manual Action</h3>
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <textarea
                rows={4}
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="Describe the action to inject..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-concordia resize-none text-sm"
              />
              <button
                onClick={handleSubmitAction}
                disabled={!actionText.trim() || manualActionMutation.isPending}
                className="w-full bg-concordia text-white py-2 rounded hover:bg-concordia/90 disabled:opacity-50 text-sm font-medium"
              >
                {manualActionMutation.isPending ? "Injecting..." : "Inject Action"}
              </button>
              {manualActionMutation.isError && (
                <p className="text-xs text-red-600">Failed to inject action</p>
              )}
            </div>

            {/* Status */}
            <SimulationStatus status={status} stats={{}} groundedVars={groundedVars} />
          </div>

          {/* Event Feed */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-semibold text-gray-600">Event Feed</h3>
            <AgentFeed events={events} />
          </div>
        </div>
      )}
    </div>
  );
}
