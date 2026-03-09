import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { simulationApi } from "@/api/simulation";

interface CheckpointInfo {
  filename: string;
  tick: number;
  timestamp: string;
  size_bytes: number;
}

export function CheckpointManager({
  simulationId,
  disabled,
}: {
  simulationId: string;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();

  const {
    data: checkpoints,
    isLoading,
    isError,
  } = useQuery<CheckpointInfo[]>({
    queryKey: ["checkpoints", simulationId],
    queryFn: async () => {
      const res = await simulationApi.listCheckpoints(simulationId);
      return res.data.data?.checkpoints ?? res.data.checkpoints ?? [];
    },
    refetchInterval: 15_000,
    enabled: !!simulationId,
  });

  const saveMutation = useMutation({
    mutationFn: () => simulationApi.checkpoint(simulationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkpoints", simulationId] });
    },
  });

  const loadMutation = useMutation({
    mutationFn: (filename: string) =>
      simulationApi.loadCheckpoint(simulationId, filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simulationStatus", simulationId] });
      queryClient.invalidateQueries({ queryKey: ["checkpoints", simulationId] });
    },
  });

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimestamp = (ts: string): string => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-600">Checkpoints</h3>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={disabled || saveMutation.isPending}
          className="bg-concordia text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-concordia/90 disabled:opacity-50"
        >
          {saveMutation.isPending ? "Saving..." : "Save Checkpoint"}
        </button>
      </div>

      {saveMutation.isError && (
        <p className="text-xs text-red-600">Failed to save checkpoint</p>
      )}
      {saveMutation.isSuccess && (
        <p className="text-xs text-green-600">Checkpoint saved</p>
      )}
      {loadMutation.isError && (
        <p className="text-xs text-red-600">Failed to load checkpoint</p>
      )}

      {isLoading && (
        <p className="text-xs text-gray-400 py-4 text-center">Loading checkpoints...</p>
      )}

      {isError && (
        <p className="text-xs text-red-500 py-4 text-center">Failed to load checkpoint list</p>
      )}

      {!isLoading && !isError && (!checkpoints || checkpoints.length === 0) && (
        <p className="text-xs text-gray-400 py-4 text-center">No checkpoints saved yet</p>
      )}

      {checkpoints && checkpoints.length > 0 && (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {checkpoints.map((cp) => (
            <li
              key={cp.filename}
              className="flex items-center justify-between border border-gray-100 rounded p-2 text-xs"
            >
              <div className="space-y-0.5 min-w-0 flex-1">
                <p className="font-medium text-gray-700 truncate">Tick {cp.tick}</p>
                <p className="text-gray-400">
                  {formatTimestamp(cp.timestamp)} &middot; {formatBytes(cp.size_bytes)}
                </p>
              </div>
              <button
                onClick={() => loadMutation.mutate(cp.filename)}
                disabled={disabled || loadMutation.isPending}
                className="ml-2 border border-gray-300 px-2.5 py-1 rounded text-xs hover:bg-gray-50 disabled:opacity-50 shrink-0"
              >
                {loadMutation.isPending ? "Loading..." : "Load"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
