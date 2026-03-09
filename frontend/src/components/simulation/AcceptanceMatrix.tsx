import { useQuery } from "@tanstack/react-query";
import { matrixApi } from "@/api/matrix";
import type { StakeholderAcceptance } from "@shared/types/simulation";

function scoreColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 50) return "bg-yellow-400";
  if (score >= 30) return "bg-orange-400";
  return "bg-red-500";
}

function scoreBgClass(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-800";
  if (score >= 50) return "bg-yellow-100 text-yellow-800";
  if (score >= 30) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

interface AcceptanceMatrixProps {
  simulationId: string;
}

export function AcceptanceMatrixHeatmap({ simulationId }: AcceptanceMatrixProps) {
  const { data: matrix, isLoading, isError, error } = useQuery({
    queryKey: ["acceptance-matrix", simulationId],
    queryFn: () => matrixApi.getAcceptanceMatrix(simulationId),
    enabled: !!simulationId,
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-48 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load acceptance matrix{error instanceof Error ? `: ${error.message}` : "."}
      </div>
    );
  }

  if (!matrix || matrix.cells.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-400 text-center">
        No acceptance matrix data available yet.
      </div>
    );
  }

  const { groups, branches, cells } = matrix;

  // Build a lookup map: `${group}|${branch}` -> cell
  const cellMap = new Map<string, StakeholderAcceptance>();
  for (const cell of cells) {
    cellMap.set(`${cell.stakeholder_group}|${cell.branch_label}`, cell);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-600">Acceptance Matrix</h3>
        <span className="text-[10px] text-gray-400">
          Updated {new Date(matrix.generated_at).toLocaleTimeString()}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-200">
                Group
              </th>
              {branches.map((branch) => (
                <th
                  key={branch}
                  className="text-center px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-200"
                >
                  {branch}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group} className="border-b border-gray-100 last:border-b-0">
                <td className="px-3 py-2 text-sm font-medium text-gray-700 whitespace-nowrap">
                  {group}
                </td>
                {branches.map((branch) => {
                  const cell = cellMap.get(`${group}|${branch}`);
                  if (!cell) {
                    return (
                      <td key={branch} className="px-3 py-2 text-center text-gray-300">
                        --
                      </td>
                    );
                  }
                  const score = Math.round(cell.acceptance_score);
                  return (
                    <td key={branch} className="px-3 py-2">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${scoreBgClass(score)}`}
                        >
                          {score}%
                        </span>
                        <div className="w-full max-w-[80px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${scoreColor(score)}`}
                            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400">
                          n={cell.sample_size}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Score</span>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-500" />
          <span className="text-[10px] text-gray-500">>=70</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-400" />
          <span className="text-[10px] text-gray-500">50-69</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-orange-400" />
          <span className="text-[10px] text-gray-500">30-49</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500" />
          <span className="text-[10px] text-gray-500">&lt;30</span>
        </div>
      </div>
    </div>
  );
}
