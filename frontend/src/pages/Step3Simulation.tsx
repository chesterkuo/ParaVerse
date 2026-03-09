import { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { simulationApi } from "@/api/simulation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSimulationStore } from "@/store/simulationStore";
import { StepProgress } from "@/components/layout/StepProgress";
import { SimulationStatus } from "@/components/simulation/SimulationStatus";
import { AgentFeed } from "@/components/simulation/AgentFeed";
import { EventTimeline } from "@/components/simulation/EventTimeline";
import { ScenarioBranch } from "@/components/simulation/ScenarioBranch";

export default function Step3Simulation() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { simId, engine, status, events, groundedVars, setStatus, addEvent, setGroundedVars, setSimulation } =
    useSimulationStore();

  // Load simulation from API if not in store (e.g. page refresh)
  const { data: simList } = useQuery({
    queryKey: ["simulations-by-project", projectId],
    queryFn: () => simulationApi.listByProject(projectId!).then((r) => r.data.data),
    enabled: !!projectId && !simId,
  });

  // Hydrate store from API data on first load
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!simList || simList.length === 0 || simId || hydratedRef.current) return;
    hydratedRef.current = true;
    const latest = simList[0]; // already sorted by created_at DESC
    setSimulation(latest.id, latest.engine as "oasis" | "concordia");
    setStatus(latest.status);
    if (latest.grounded_vars && Object.keys(latest.grounded_vars).length > 0) {
      setGroundedVars(latest.grounded_vars);
    }
  }, [simList, simId, setSimulation, setStatus, setGroundedVars]);

  // Load events from API for completed/running simulations
  const effectiveSimId = simId || (simList?.[0]?.id ?? null);
  const { data: apiEvents } = useQuery({
    queryKey: ["simulation-events", effectiveSimId],
    queryFn: () => simulationApi.getEvents(effectiveSimId!, 1000).then((r) => r.data.data),
    enabled: !!effectiveSimId && events.length === 0,
  });

  // Hydrate events from API
  const eventsHydratedRef = useRef(false);
  useEffect(() => {
    if (!apiEvents || apiEvents.length === 0 || eventsHydratedRef.current) return;
    if (events.length > 0) return; // already have events from websocket
    eventsHydratedRef.current = true;
    for (const ev of apiEvents) {
      addEvent({
        event_type: ev.event_type,
        content: ev.content ?? undefined,
        sim_timestamp: ev.sim_timestamp,
        agent_id: ev.agent_id ?? undefined,
        metadata: ev.metadata,
      });
    }
  }, [apiEvents, events.length, addEvent]);

  const { events: wsEvents, connected } = useWebSocket(
    simId ? `/ws/simulations/${simId}` : "",
  );

  // Process incoming WebSocket events (track last processed index)
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
      } else if (ev.type === "branch_update") {
        addEvent({
          event_type: "branch_update",
          content: (ev.label as string) ?? "",
          sim_timestamp: (ev.tick as number) ?? 0,
          metadata: ev as Record<string, unknown>,
        });
      }
    }
    lastProcessedIdx.current = wsEvents.length;
  }, [wsEvents, addEvent, setGroundedVars, setStatus]);

  const startMutation = useMutation({
    mutationFn: () => simulationApi.start(simId!),
    onSuccess: () => setStatus("running"),
  });

  const isConcordia = engine === "concordia";
  const isCompleted = status === "completed";
  const canStart = simId && (status === "pending" || status === "configuring");

  // Mock branches for Concordia demo
  const branches = isConcordia
    ? [
        { label: "Baseline", description: "Default scenario parameters", reputation: 0.72, emotionTrend: [0.3, 0.5, 0.2, -0.1, 0.4] },
        { label: "Aggressive", description: "Higher conflict parameters", reputation: 0.45, emotionTrend: [-0.2, -0.4, -0.1, 0.1, -0.3] },
        { label: "Cooperative", description: "Emphasis on collaboration", reputation: 0.88, emotionTrend: [0.5, 0.6, 0.7, 0.8, 0.9] },
      ]
    : [];

  return (
    <div className="space-y-6">
      <StepProgress currentStep={3} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy">Step 3: Simulation</h2>
          <p className="text-gray-500">Run and monitor the simulation in real-time.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs text-gray-400">{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

      {!simId && !simList?.length && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
          No simulation configured. Please go back to Step 2 to create a simulation.
        </div>
      )}

      {(simId || simList?.length) && (
        <>
          {/* Controls */}
          <div className="flex items-center gap-3">
            {canStart && (
              <button
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="bg-violet text-white px-6 py-2 rounded hover:bg-violet/90 disabled:opacity-50 cursor-pointer"
              >
                {startMutation.isPending ? "Starting..." : "Start Simulation"}
              </button>
            )}
            {isCompleted && (
              <button
                onClick={() => navigate(`/projects/${projectId}/step/4`)}
                className="bg-navy text-white px-6 py-2 rounded hover:bg-navy/90 cursor-pointer"
              >
                View Report
              </button>
            )}
          </div>

          {/* Status */}
          <SimulationStatus status={status} stats={{}} groundedVars={groundedVars} />

          {/* Main content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-600">Event Feed</h3>
              <AgentFeed events={events} />
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-600">Timeline</h3>
              <EventTimeline events={events} />
            </div>
          </div>

          {/* Concordia branches */}
          {isConcordia && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-600">Scenario Branches</h3>
              <ScenarioBranch branches={branches} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
