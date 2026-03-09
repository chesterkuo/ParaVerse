import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { StepProgress } from "@/components/layout/StepProgress";
import { useSimulationStore } from "@/store/simulationStore";
import { useReport, useGenerateReport } from "@/hooks/useReport";
import { TaskProgress } from "@/components/ui/TaskProgress";
import { ReportViewer } from "@/components/report/ReportViewer";
import { EmotionChart } from "@/components/report/EmotionChart";
import { ExportButton } from "@/components/report/ExportButton";
import { AcceptanceMatrixHeatmap } from "@/components/simulation/AcceptanceMatrix";
import { projectsApi } from "@/api/projects";
import type { ScenarioType } from "@shared/types/project";

export default function Step4Report() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const simId = useSimulationStore((s) => s.simId);

  const [reportTaskId, setReportTaskId] = useState<string | null>(null);
  const [reportReady, setReportReady] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId!).then((r) => r.data.data),
    enabled: !!projectId,
  });
  const scenarioType = (project?.scenario_type ?? "") as ScenarioType;
  const isPolicyLab = scenarioType === "policy_lab";

  const { data: report, refetch } = useReport(reportReady ? simId : null);
  const generateMutation = useGenerateReport();

  const handleGenerate = () => {
    if (!simId) return;
    generateMutation.mutate(simId, {
      onSuccess: (res) => {
        const taskId = res.data?.data?.task_id;
        if (taskId) {
          setReportTaskId(taskId);
        } else {
          setReportReady(true);
        }
      },
    });
  };

  const handleReportComplete = () => {
    setReportReady(true);
    refetch();
  };

  // Mock emotion chart data (stable across renders)
  const emotionData = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        tick: i + 1,
        positive: 0.3 + Math.sin(i * 0.7) * 0.2 + 0.1,
        neutral: 0.2 + Math.cos(i * 0.5) * 0.1 + 0.05,
        negative: 0.05 + Math.sin(i * 0.3 + 1) * 0.1 + 0.05,
      })),
    [],
  );

  const sections: { title: string; content: string }[] = report?.sections ?? [];

  return (
    <div className="space-y-6">
      <StepProgress currentStep={4} />
      <h2 className="text-xl font-bold text-navy">Step 4: Report</h2>
      <p className="text-gray-500">View the generated analysis report.</p>

      {!simId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
          No simulation found. Please complete Step 3 first.
        </div>
      )}

      {simId && (
        <>
          {/* Generate button */}
          {!reportReady && !reportTaskId && (
            <button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="bg-violet text-white px-6 py-2 rounded hover:bg-violet/90 disabled:opacity-50"
            >
              {generateMutation.isPending ? "Generating..." : "Generate Report"}
            </button>
          )}

          {generateMutation.isError && (
            <p className="text-sm text-red-600">Report generation failed.</p>
          )}

          {/* Task Progress */}
          {reportTaskId && (
            <TaskProgress
              taskId={reportTaskId}
              taskType="Report Generation"
              onComplete={handleReportComplete}
            />
          )}

          {/* Acceptance Matrix (PolicyLab only) */}
          {isPolicyLab && simId && (
            <AcceptanceMatrixHeatmap simulationId={simId} />
          )}

          {/* Report Content */}
          {reportReady && (
            <div className="space-y-6">
              {/* Emotion Chart */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-600">Sentiment Over Time</h3>
                <EmotionChart data={emotionData} />
              </div>

              {/* Report Sections */}
              {sections.length > 0 && <ReportViewer sections={sections} />}

              {/* Export */}
              <div className="flex items-center gap-3">
                <ExportButton simId={simId} />
              </div>
            </div>
          )}

          {/* Next Step */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={() => navigate(`/projects/${projectId}/step/5`)}
              className="bg-navy text-white px-6 py-2 rounded hover:bg-navy/90"
            >
              Next Step
            </button>
          </div>
        </>
      )}
    </div>
  );
}
