import { useQuery } from "@tanstack/react-query";
import { simulationApi } from "@/api/simulation";

export function useSimulationStatus(simId: string | null) {
  return useQuery({
    queryKey: ["simulation", simId],
    queryFn: () => simulationApi.getStatus(simId!).then((r) => r.data.data),
    enabled: !!simId,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 2000 : false,
  });
}

export function useTaskStatus(taskId: string | null) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => simulationApi.getTaskStatus(taskId!).then((r) => r.data.data),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? 2000 : false;
    },
  });
}
