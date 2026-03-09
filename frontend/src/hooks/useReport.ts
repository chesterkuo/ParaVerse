import { useQuery, useMutation } from "@tanstack/react-query";
import { reportApi } from "@/api/report";

export function useReport(simulationId: string | null) {
  return useQuery({
    queryKey: ["report", simulationId],
    queryFn: () => reportApi.get(simulationId!).then((r) => r.data.data),
    enabled: !!simulationId,
  });
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: (simulationId: string) => reportApi.generate(simulationId),
  });
}
