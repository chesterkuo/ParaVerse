import { useMutation } from "@tanstack/react-query";
import { simulationApi } from "@/api/simulation";

export function useCheckpoint(simId: string | null) {
  const save = useMutation({
    mutationFn: () => simulationApi.checkpoint(simId!),
  });

  return { save };
}
