import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

/** Minimal event shape — compatible with both store events and full SimEvent */
interface PolicyEvent {
  event_type: string;
  sim_timestamp: number;
  metadata?: Record<string, unknown> | string;
}

const TRACKED_VARS = ["public_approval", "policy_support", "opposition_strength", "media_coverage"] as const;

const VAR_COLORS: Record<string, string> = {
  public_approval: "#22C55E",      // green
  policy_support: "#3B82F6",       // blue
  opposition_strength: "#EF4444",  // red
  media_coverage: "#F59E0B",       // amber
};

const VAR_LABELS: Record<string, string> = {
  public_approval: "Public Approval",
  policy_support: "Policy Support",
  opposition_strength: "Opposition Strength",
  media_coverage: "Media Coverage",
};

interface PolicyDataPoint {
  tick: number;
  [key: string]: number;
}

function parseMetadata(meta: unknown): Record<string, unknown> {
  if (typeof meta === "string") {
    try {
      return JSON.parse(meta);
    } catch {
      return {};
    }
  }
  if (meta && typeof meta === "object") return meta as Record<string, unknown>;
  return {};
}

export function PolicyImpactChart({ events }: { events: PolicyEvent[] }) {
  const data = useMemo(() => {
    const groundedEvents = events.filter((e) => e.event_type === "grounded_var");
    if (groundedEvents.length === 0) return [];

    // Group by tick
    const tickMap = new Map<number, Record<string, number>>();

    for (const ev of groundedEvents) {
      const meta = parseMetadata(ev.metadata);
      const name = meta.name as string | undefined;
      const value = meta.value as number | undefined;

      if (!name || value === undefined || !TRACKED_VARS.includes(name as typeof TRACKED_VARS[number])) continue;

      let entry = tickMap.get(ev.sim_timestamp);
      if (!entry) {
        entry = {};
        tickMap.set(ev.sim_timestamp, entry);
      }
      entry[name] = value;
    }

    // Build sorted data points
    const ticks = Array.from(tickMap.keys()).sort((a, b) => a - b);
    const result: PolicyDataPoint[] = [];

    // Carry forward last known values for continuity
    const lastKnown: Record<string, number> = {};

    for (const tick of ticks) {
      const values = tickMap.get(tick)!;
      for (const v of TRACKED_VARS) {
        if (values[v] !== undefined) lastKnown[v] = values[v];
      }
      result.push({ tick, ...lastKnown });
    }

    return result;
  }, [events]);

  if (data.length === 0) return null;

  // Determine which vars are actually present
  const activeVars = TRACKED_VARS.filter((v) => data.some((d) => d[v] !== undefined));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">Policy Impact Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="tick"
            tick={{ fontSize: 12 }}
            label={{ value: "Tick", position: "insideBottom", offset: -5, fontSize: 12 }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            domain={[0, 100]}
            label={{ value: "Value", angle: -90, position: "insideLeft", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(value: number, name: string) => [value.toFixed(1), VAR_LABELS[name] ?? name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value: string) => VAR_LABELS[value] ?? value}
          />
          {activeVars.map((v) => (
            <Line
              key={v}
              type="monotone"
              dataKey={v}
              stroke={VAR_COLORS[v]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
