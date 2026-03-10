import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SentimentComparisonChart } from "@/components/SentimentComparisonChart";
import { api } from "@/api/client";

export default function ContentLabResults() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const compareId = searchParams.get("compareWith");

  const { data: comparison, isLoading } = useQuery({
    queryKey: ["contentlab-compare", id, compareId],
    queryFn: () =>
      api.post(`/simulations/${id}/compare`, { compareWithId: compareId }).then((r) => r.data?.data || r.data),
    enabled: !!compareId,
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">ContentLab: Outcome Comparison</h1>

      {isLoading && compareId && (
        <div className="text-gray-500">Loading comparison...</div>
      )}

      {comparison && (
        <>
          <SentimentComparisonChart
            trajectoryA={comparison.trajectoryA || []}
            trajectoryB={comparison.trajectoryB || []}
          />
          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-lg font-semibold mb-2">Analysis</h3>
            <p>Divergence Score: <span className="font-mono font-bold">{comparison.divergenceScore?.toFixed(3)}</span></p>
            <p>Winning Outcome: <span className="font-bold text-blue-600">{comparison.winnerIndex === 0 ? "Outcome A" : "Outcome B"}</span></p>
          </div>
        </>
      )}

      {!compareId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            To compare outcomes, run two simulations and add <code className="bg-yellow-100 px-1 rounded">?compareWith=SIM_ID</code> to the URL.
          </p>
        </div>
      )}
    </div>
  );
}
