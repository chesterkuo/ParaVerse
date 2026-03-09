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
  status: "#6B7280",
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
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-400">
        Waiting for events...
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-y-auto max-h-[500px]">
      <div className="p-3 space-y-2">
        {events.map((event, idx) => (
          <div
            key={idx}
            className="flex gap-3 rounded-md p-2 hover:bg-gray-50 transition-colors"
            style={{ borderLeft: `3px solid ${getEventColor(event.event_type)}` }}
          >
            <div className="flex-shrink-0 text-xs text-gray-400 font-mono w-10 pt-0.5">
              T{event.sim_timestamp}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                  style={{ backgroundColor: getEventColor(event.event_type) }}
                >
                  {humanizeEventType(event.event_type)}
                </span>
                {event.agent_id && (
                  <span className="text-xs text-gray-400">
                    {humanizeAgentId(event.agent_id)}
                  </span>
                )}
              </div>
              {event.content && (
                <p className="text-sm text-gray-700 break-words">{event.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
