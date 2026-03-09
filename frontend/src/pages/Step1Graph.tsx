import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { projectsApi } from "@/api/projects";
import { StepProgress } from "@/components/layout/StepProgress";
import { FileUpload } from "@/components/ui/FileUpload";
import { TaskProgress } from "@/components/ui/TaskProgress";
import { KnowledgeGraph } from "@/components/graph/KnowledgeGraph";
import { GraphControls } from "@/components/graph/GraphControls";
import { Info, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";

interface GraphNodeResponse {
  id: string;
  name?: string;
  label?: string;
  type: string;
}

interface GraphEdgeResponse {
  source_node_id?: string;
  source?: string;
  target_node_id?: string;
  target?: string;
  relation_type?: string;
  label?: string;
}

export default function Step1Graph() {
  const { t } = useTranslation();
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadTaskId, setUploadTaskId] = useState<string | null>(null);
  const [buildTaskId, setBuildTaskId] = useState<string | null>(null);
  const [uploadDone, setUploadDone] = useState(false);
  const [buildDone, setBuildDone] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId!).then((r) => r.data.data),
    enabled: !!projectId,
  });
  const scenarioType = project?.scenario_type ?? "fin_sentiment";

  const uploadMutation = useMutation({
    mutationFn: (file: File) => projectsApi.uploadDocument(projectId!, file),
    onSuccess: (res) => {
      setUploadedFile(res.data.data?.filename ?? "document");
      if (res.data.data?.task_id) {
        setUploadTaskId(res.data.data.task_id);
      } else {
        setUploadDone(true);
      }
    },
  });

  const buildMutation = useMutation({
    mutationFn: () => projectsApi.buildGraph(projectId!),
    onSuccess: (res) => {
      if (res.data.data?.task_id) {
        setBuildTaskId(res.data.data.task_id);
      } else {
        setBuildDone(true);
      }
    },
  });

  const handleFileSelect = (file: File) => {
    uploadMutation.mutate(file);
  };

  const { data: graphData } = useQuery({
    queryKey: ["graph", projectId],
    queryFn: () => projectsApi.getGraph(projectId!).then((r) => r.data.data as { nodes: GraphNodeResponse[]; edges?: GraphEdgeResponse[]; links?: GraphEdgeResponse[] }),
    enabled: !!projectId && buildDone,
  });

  const canBuild = uploadDone || uploadedFile;
  const canProceed = buildDone;

  return (
    <div className="space-y-6">
      <StepProgress currentStep={1} />
      <h2 className="text-xl font-bold text-navy">{t("step1.title")}</h2>
      <p className="text-gray-500">{t("step1.subtitle")}</p>

      {/* Guidance Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-blue-100/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-800">{t("step1.guidanceTitle")}</span>
          </div>
          {showGuide ? <ChevronUp size={16} className="text-blue-500" /> : <ChevronDown size={16} className="text-blue-500" />}
        </button>
        {showGuide && (
          <div className="px-5 pb-4 space-y-3">
            <p className="text-sm text-blue-700">{t("step1.guidanceGeneral")}</p>

            {/* Scenario-specific guidance */}
            <div className="bg-white/60 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-1.5">
                <Info size={14} className="text-violet" />
                <span className="text-xs font-semibold text-violet uppercase tracking-wider">
                  {t(`scenarios.${scenarioType}`)}
                </span>
              </div>
              <p className="text-sm text-blue-800">
                {t(`scenarios.${scenarioType}_doc_guide`)}
              </p>
              <p className="text-xs text-blue-600 italic">
                {t(`scenarios.${scenarioType}_doc_examples`)}
              </p>
            </div>

            <p className="text-xs text-blue-500">{t("step1.guidanceFormats")}</p>
          </div>
        )}
      </div>

      {/* File Upload */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-600">{t("step1.uploadDocument")}</h3>
        <FileUpload onFileSelect={handleFileSelect} disabled={uploadMutation.isPending} />
        {uploadMutation.isPending && (
          <p className="text-sm text-violet">{t("step1.uploading")}</p>
        )}
        {uploadMutation.isError && (
          <p className="text-sm text-red-600">{t("step1.uploadFailed")}</p>
        )}
        {uploadedFile && (
          <p className="text-sm text-green-600">{t("step1.uploaded", { filename: uploadedFile })}</p>
        )}
      </div>

      {/* Upload Task Progress */}
      {uploadTaskId && (
        <TaskProgress
          taskId={uploadTaskId}
          taskType="Document Processing"
          onComplete={() => setUploadDone(true)}
        />
      )}

      {/* Build Graph */}
      <div className="space-y-3">
        <button
          onClick={() => buildMutation.mutate()}
          disabled={!canBuild || buildMutation.isPending}
          className="bg-violet text-white px-6 py-2 rounded hover:bg-violet/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {buildMutation.isPending ? t("step1.building") : t("step1.buildGraph")}
        </button>
        {buildMutation.isError && (
          <p className="text-sm text-red-600">{t("step1.buildFailed")}</p>
        )}
      </div>

      {/* Build Task Progress */}
      {buildTaskId && (
        <TaskProgress
          taskId={buildTaskId}
          taskType="Graph Construction"
          onComplete={() => setBuildDone(true)}
        />
      )}

      {/* Next Step */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={() => navigate(`/projects/${projectId}/step/2`)}
          disabled={!canProceed}
          className="bg-navy text-white px-6 py-2 rounded hover:bg-navy/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("common.nextStep")}
        </button>
      </div>

      {graphData?.nodes && graphData.nodes.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-600">{t("step1.knowledgeGraph")}</h3>
          <GraphControls />
          <KnowledgeGraph
            nodes={graphData.nodes.map((n) => ({ id: n.id, label: n.name || n.label || n.id, type: n.type }))}
            links={(graphData.edges || graphData.links || []).map((e) => ({
              source: e.source_node_id || e.source || "",
              target: e.target_node_id || e.target || "",
              label: e.relation_type || e.label,
            }))}
          />
        </div>
      )}
    </div>
  );
}
