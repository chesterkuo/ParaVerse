import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TrustHeatmap } from "@/components/TrustHeatmap";
import { api } from "@/api/client";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function WarGameDashboard() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const { data: simulation } = useQuery({
    queryKey: ["simulation", id],
    queryFn: () => api.get(`/simulations/${id}/status`).then((r) => r.data),
  });

  const { data: eventsResponse } = useQuery({
    queryKey: ["simulation-events", id],
    queryFn: () => api.get(`/simulations/${id}/events?limit=500`).then((r) => r.data),
  });

  const events = eventsResponse?.data || eventsResponse || [];
  const nestedConfig = simulation?.data?.config?.nested_config || simulation?.config?.nested_config;
  const countries: string[] = nestedConfig?.countries?.map((c: Record<string, unknown>) => c.id) || [];

  const varSnapshots = (Array.isArray(events) ? events : [])
    .filter((e: Record<string, unknown>) => e.event_type === "grounded_vars_update")
    .map((e: Record<string, unknown>) => ({
      tick: e.tick as number,
      ...(e.metadata as Record<string, unknown>),
    }));

  const infoPenetration = varSnapshots.map((s: Record<string, unknown>) => ({
    tick: s.tick,
    rate: (s.information_penetration_rate as number) || 0,
  }));

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t("warGame.dashboard", "WarGame Analysis Dashboard")}</h1>

      {countries.length > 0 && varSnapshots.length > 0 ? (
        <TrustHeatmap data={varSnapshots as { tick: number; [key: string]: number }[]} countries={countries} />
      ) : (
        <div className="bg-gray-50 rounded-xl border p-6 text-center text-gray-500">
          {t("warGame.noData", "No simulation data available yet.")}
        </div>
      )}

      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold mb-4">{t("warGame.infoPenetration", "Information Penetration Rate")}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={infoPenetration}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tick" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold mb-4">{t("warGame.countryBreakdown", "Country Breakdown")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {countries.map((c: string) => {
            const latest = varSnapshots[varSnapshots.length - 1] || {};
            const trust = (latest as Record<string, unknown>)[`${c}_trust_index`] ?? 50;
            const belief = (latest as Record<string, unknown>)[`${c}_belief_score`] ?? 50;
            return (
              <div key={c} className="border rounded-lg p-4">
                <h4 className="font-semibold text-lg">{c}</h4>
                <p className="text-sm text-gray-600">
                  {t("warGame.trustIndex", "Trust Index")}: <span className="font-mono">{String(trust)}/100</span>
                </p>
                <p className="text-sm text-gray-600">
                  {t("warGame.beliefScore", "Belief Score")}: <span className="font-mono">{String(belief)}/100</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
