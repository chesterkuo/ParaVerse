import { useTranslation } from "react-i18next";
import { Activity, BarChart3 } from "lucide-react";

interface SimulationStatusProps {
  status: string;
  stats: Record<string, unknown>;
  groundedVars: Record<string, number>;
}

export function SimulationStatus({ status, stats, groundedVars }: SimulationStatusProps) {
  const { t } = useTranslation();

  const STATUS_STYLES: Record<string, { bg: string; text: string; labelKey: string; dot: string }> = {
    pending:      { bg: "bg-gray-100", text: "text-gray-600", labelKey: "simulation.pending", dot: "bg-gray-400" },
    configuring:  { bg: "bg-blue-50", text: "text-blue-700", labelKey: "simulation.configuring", dot: "bg-blue-500" },
    running:      { bg: "bg-amber-50", text: "text-amber-700", labelKey: "simulation.running", dot: "bg-amber-500 animate-pulse" },
    completed:    { bg: "bg-emerald-50", text: "text-emerald-700", labelKey: "simulation.completed", dot: "bg-emerald-500" },
    failed:       { bg: "bg-red-50", text: "text-red-700", labelKey: "simulation.failed", dot: "bg-red-500" },
  };

  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const statEntries = Object.entries(stats);
  const varEntries = Object.entries(groundedVars);

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-text-muted" />
          <span className="text-sm font-medium text-text-secondary">{t("simulation.status")}</span>
        </div>
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
          {t(style.labelKey)}
        </span>
      </div>

      {statEntries.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <BarChart3 size={14} className="text-text-muted" />
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t("simulation.statistics")}</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {statEntries.map(([key, value]) => (
              <div key={key} className="bg-bg rounded-lg p-3">
                <div className="text-[11px] text-text-muted uppercase tracking-wider mb-1">{key.replace(/_/g, " ")}</div>
                <div className="text-sm font-semibold text-text-primary">{String(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {varEntries.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            {t("simulation.groundedVars")}
          </h4>
          <div className="space-y-2.5">
            {varEntries.map(([key, value]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-text-secondary capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="text-xs font-mono text-text-muted">
                    {(value * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-concordia to-concordia/70 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
