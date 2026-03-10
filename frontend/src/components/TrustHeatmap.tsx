import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from "recharts";
import { useTranslation } from "react-i18next";

interface TrustHeatmapProps {
  data: { tick: number; [countryKey: string]: number }[];
  countries: string[];
}

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"];

export function TrustHeatmap({ data, countries }: TrustHeatmapProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-xl border p-6">
      <h3 className="text-lg font-semibold mb-4">{t("warGame.trustIndex", "Trust Index")} by Country</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="tick" label={{ value: "Tick", position: "insideBottom", offset: -5 }} />
          <YAxis domain={[0, 100]} label={{ value: "Trust Index", angle: -90, position: "insideLeft" }} />
          <Tooltip />
          {countries.map((country, i) => (
            <Line
              key={country}
              type="monotone"
              dataKey={`${country}_trust_index`}
              name={country}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
