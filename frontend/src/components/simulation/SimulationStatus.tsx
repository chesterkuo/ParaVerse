const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-gray-100", text: "text-gray-600", label: "Pending" },
  configuring: { bg: "bg-blue-100", text: "text-blue-700", label: "Configuring" },
  running: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Running" },
  completed: { bg: "bg-green-100", text: "text-green-700", label: "Completed" },
  failed: { bg: "bg-red-100", text: "text-red-700", label: "Failed" },
};

interface SimulationStatusProps {
  status: string;
  stats: Record<string, unknown>;
  groundedVars: Record<string, number>;
}

export function SimulationStatus({ status, stats, groundedVars }: SimulationStatusProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const statEntries = Object.entries(stats);
  const varEntries = Object.entries(groundedVars);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      {/* Status Badge */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-500">Status</span>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
          {style.label}
        </span>
      </div>

      {/* Stats Grid */}
      {statEntries.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Stats</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {statEntries.map(([key, value]) => (
              <div key={key} className="bg-gray-50 rounded-md p-2">
                <div className="text-xs text-gray-400">{key.replace(/_/g, " ")}</div>
                <div className="text-sm font-semibold text-navy">{String(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grounded Variables */}
      {varEntries.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Grounded Variables
          </h4>
          <div className="space-y-1.5">
            {varEntries.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{key.replace(/_/g, " ")}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-concordia rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-gray-500 w-12 text-right">
                    {(value * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
