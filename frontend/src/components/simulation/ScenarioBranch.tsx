interface BranchData {
  label: string;
  description: string;
  reputation?: number;
  emotionTrend?: number[];
}

function MiniBarChart({ data }: { data: number[] }) {
  const max = Math.max(...data.map(Math.abs), 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm transition-all"
          style={{
            height: `${(Math.abs(v) / max) * 100}%`,
            backgroundColor: v >= 0 ? "#00C4B4" : "#EF4444",
            minHeight: 2,
          }}
        />
      ))}
    </div>
  );
}

export function ScenarioBranch({ branches }: { branches: BranchData[] }) {
  if (branches.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-400 text-sm">
        No scenario branches
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {branches.map((branch, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-gray-200 bg-white overflow-hidden"
          style={{ borderTop: "3px solid #00C4B4" }}
        >
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-navy">{branch.label}</span>
              {branch.reputation != null && (
                <span className="text-xs font-mono text-concordia">
                  Rep: {branch.reputation.toFixed(1)}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{branch.description}</p>
            {branch.emotionTrend && branch.emotionTrend.length > 0 && (
              <div>
                <div className="text-[10px] text-gray-400 mb-1">Emotion Trend</div>
                <MiniBarChart data={branch.emotionTrend} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
