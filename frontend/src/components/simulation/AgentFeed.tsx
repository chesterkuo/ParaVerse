import { useRef, useEffect } from "react";
import { humanizeAgentId, humanizeEventType } from "@/utils/humanize";

interface SimEvent {
  event_type: string;
  content?: string;
  sim_timestamp: number;
  agent_id?: string;
  metadata?: Record<string, unknown>;
}

const EVENT_COLORS: Record<string, string> = {
  agent_action: "#6C3FC5",
  grounded_var: "#F59E0B",
  branch_update: "#00C4B4",
  simulation_complete: "#22C55E",
  error: "#EF4444",
  interview_response: "#3B82F6",
  status: "#94A3B8",
};

function getEventColor(eventType: string): string {
  return EVENT_COLORS[eventType] ?? "#6C3FC5";
}

export function AgentFeed({ events }: { events: SimEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-violet/10 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-violet/40 animate-pulse" />
        </div>
        <p className="text-sm text-text-muted">Waiting for events...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-y-auto max-h-[500px]">
      <div className="p-4 space-y-1.5">
        {events.map((event, idx) => (
          <div
            key={idx}
            className="flex gap-3 rounded-lg p-3 hover:bg-bg transition-colors"
            style={{ borderLeft: `3px solid ${getEventColor(event.event_type)}` }}
          >
            <div className="flex-shrink-0 text-xs text-text-muted font-mono w-10 pt-0.5">
              T{event.sim_timestamp}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold text-white"
                  style={{ backgroundColor: getEventColor(event.event_type) }}
                >
                  {humanizeEventType(event.event_type)}
                </span>
                {event.agent_id && (
                  <span className="text-xs text-text-muted font-medium">
                    {humanizeAgentId(event.agent_id)}
                  </span>
                )}
              </div>
              {event.content && (
                <p className="text-sm text-text-secondary break-words leading-relaxed">{event.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
