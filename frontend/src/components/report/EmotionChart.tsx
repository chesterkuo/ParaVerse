import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface EmotionDataPoint {
  tick: number;
  positive: number;
  neutral: number;
  negative: number;
}

export function EmotionChart({ data }: { data: EmotionDataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-400 text-sm">
        No emotion data available
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
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
            domain={[0, 1]}
            label={{ value: "Score", angle: -90, position: "insideLeft", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(value) => Number(value).toFixed(3)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="positive" stroke="#22C55E" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="neutral" stroke="#6B7280" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="negative" stroke="#EF4444" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
