interface SimEvent {
  event_type: string;
  content?: string;
  sim_timestamp: number;
  agent_id?: string;
  metadata?: Record<string, unknown>;
}

const TYPE_COLORS: Record<string, string> = {
  agent_action: "bg-violet text-white",
  grounded_var: "bg-oasis text-white",
  branch_update: "bg-concordia text-white",
  simulation_complete: "bg-green-500 text-white",
  error: "bg-red-500 text-white",
  interview_response: "bg-blue-500 text-white",
  status: "bg-gray-500 text-white",
};

function getTypeClass(t: string): string {
  return TYPE_COLORS[t] ?? "bg-gray-400 text-white";
}

export function EventTimeline({ events }: { events: SimEvent[] }) {
  // Group events by tick (sim_timestamp)
  const tickMap = new Map<number, SimEvent[]>();
  for (const ev of events) {
    const tick = ev.sim_timestamp;
    const arr = tickMap.get(tick);
    if (arr) arr.push(ev);
    else tickMap.set(tick, [ev]);
  }

  const ticks = Array.from(tickMap.entries()).sort(([a], [b]) => a - b);

  if (ticks.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-400 text-sm">
        No events yet
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-y-auto max-h-[400px]">
      <div className="p-3 space-y-2">
        {ticks.map(([tick, tickEvents]) => {
          const types = Array.from(new Set(tickEvents.map((e) => e.event_type)));
          const visibleTypes = types.slice(0, 5);
          const overflow = types.length - 5;

          return (
            <div key={tick} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-md">
              <div className="flex-shrink-0 w-16">
                <div className="text-sm font-semibold text-navy">Tick {tick}</div>
                <div className="text-[10px] text-gray-400">{tickEvents.length} event{tickEvents.length !== 1 ? "s" : ""}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {visibleTypes.map((t) => (
                  <span key={t} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getTypeClass(t)}`}>
                    {t}
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-600">
                    +{overflow} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
