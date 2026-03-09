import { useMemo } from "react";

interface MetricDef {
  key: string;
  label: string;
  color: string;
}

const SCENARIO_METRICS: Record<string, MetricDef[]> = {
  train_lab: [
    { key: "skill_level", label: "Skill Level", color: "bg-blue-500" },
    { key: "performance_score", label: "Performance", color: "bg-emerald-500" },
    { key: "confidence", label: "Confidence", color: "bg-violet-500" },
    { key: "scenario_difficulty", label: "Difficulty", color: "bg-amber-500" },
  ],
  crisis_pr: [
    { key: "brand_reputation_score", label: "Brand Reputation", color: "bg-blue-500" },
    { key: "media_trust", label: "Media Trust", color: "bg-emerald-500" },
    { key: "public_sentiment", label: "Public Sentiment", color: "bg-violet-500" },
  ],
  policy_lab: [
    { key: "public_approval", label: "Public Approval", color: "bg-blue-500" },
    { key: "policy_support", label: "Policy Support", color: "bg-emerald-500" },
    { key: "opposition_strength", label: "Opposition Strength", color: "bg-rose-500" },
    { key: "media_coverage", label: "Media Coverage", color: "bg-amber-500" },
  ],
};

function getLetterGrade(avg: number): { grade: string; color: string } {
  if (avg >= 90) return { grade: "A+", color: "text-emerald-600" };
  if (avg >= 80) return { grade: "A", color: "text-emerald-500" };
  if (avg >= 70) return { grade: "B", color: "text-blue-500" };
  if (avg >= 60) return { grade: "C", color: "text-yellow-600" };
  if (avg >= 50) return { grade: "D", color: "text-orange-500" };
  return { grade: "F", color: "text-red-500" };
}

interface ScoringDashboardProps {
  groundedVars: Record<string, number>;
  scenarioType?: string;
}

export function ScoringDashboard({ groundedVars, scenarioType }: ScoringDashboardProps) {
  const metrics = useMemo(() => {
    const defs = scenarioType ? SCENARIO_METRICS[scenarioType] : undefined;
    if (!defs) return null;
    return defs
      .filter((m) => m.key in groundedVars)
      .map((m) => ({
        ...m,
        value: Math.min(100, Math.max(0, groundedVars[m.key] * 100)),
      }));
  }, [groundedVars, scenarioType]);

  const { avg, letterGrade } = useMemo(() => {
    if (!metrics || metrics.length === 0) return { avg: 0, letterGrade: getLetterGrade(0) };
    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    const a = sum / metrics.length;
    return { avg: a, letterGrade: getLetterGrade(a) };
  }, [metrics]);

  if (!metrics || metrics.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-600">Scoring Dashboard</h3>
        <span className={`text-2xl font-bold ${letterGrade.color}`}>{letterGrade.grade}</span>
      </div>

      <div className="space-y-3">
        {metrics.map((m) => (
          <div key={m.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">{m.label}</span>
              <span className="text-xs font-mono text-gray-500">{m.value.toFixed(1)}</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${m.color}`}
                style={{ width: `${m.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Average Score
        </span>
        <span className="text-sm font-bold text-navy">{avg.toFixed(1)}</span>
      </div>
    </div>
  );
}
