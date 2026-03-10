import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

interface Props {
  trajectoryA: number[];
  trajectoryB: number[];
  labelA?: string;
  labelB?: string;
}

export function SentimentComparisonChart({ trajectoryA, trajectoryB, labelA = "Outcome A", labelB = "Outcome B" }: Props) {
  const data = trajectoryA.map((val, i) => ({
    tick: i + 1,
    [labelA]: val,
    [labelB]: trajectoryB[i] ?? 0,
  }));

  return (
    <div className="bg-white rounded-xl border p-6">
      <h3 className="text-lg font-semibold mb-4">Sentiment Trajectory Comparison</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="tick" />
          <YAxis domain={[0, 1]} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={labelA} stroke="#3b82f6" strokeWidth={2} />
          <Line type="monotone" dataKey={labelB} stroke="#ef4444" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
