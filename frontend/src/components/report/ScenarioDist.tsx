import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ScenarioDataPoint {
  name: string;
  probability: number;
  impact: number;
}

export function ScenarioDist({ data }: { data: ScenarioDataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-400 text-sm">
        No scenario distribution data
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} domain={[0, 1]} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(value) => Number(value).toFixed(3)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="probability" fill="#6C3FC5" radius={[4, 4, 0, 0]} />
          <Bar dataKey="impact" fill="#F59E0B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
