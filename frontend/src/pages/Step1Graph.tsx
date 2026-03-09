import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { projectsApi } from "@/api/projects";
import { StepProgress } from "@/components/layout/StepProgress";
import { FileUpload } from "@/components/ui/FileUpload";
import { TaskProgress } from "@/components/ui/TaskProgress";

export default function Step1Graph() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadTaskId, setUploadTaskId] = useState<string | null>(null);
  const [buildTaskId, setBuildTaskId] = useState<string | null>(null);
  const [uploadDone, setUploadDone] = useState(false);
  const [buildDone, setBuildDone] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => projectsApi.uploadDocument(projectId!, file),
    onSuccess: (res) => {
      setUploadedFile(res.data.data?.filename ?? "document");
      // If task_id is returned, track it; otherwise mark done immediately
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

  const canBuild = uploadDone || uploadedFile;
  const canProceed = buildDone;

  return (
    <div className="space-y-6">
      <StepProgress currentStep={1} />
      <h2 className="text-xl font-bold text-navy">Step 1: Knowledge Graph</h2>
      <p className="text-gray-500">Upload seed documents and build the knowledge graph.</p>

      {/* File Upload */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-600">Upload Document</h3>
        <FileUpload onFileSelect={handleFileSelect} disabled={uploadMutation.isPending} />
        {uploadMutation.isPending && (
          <p className="text-sm text-violet">Uploading...</p>
        )}
        {uploadMutation.isError && (
          <p className="text-sm text-red-600">Upload failed. Please try again.</p>
        )}
        {uploadedFile && (
          <p className="text-sm text-green-600">Uploaded: {uploadedFile}</p>
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
          {buildMutation.isPending ? "Building..." : "Build Graph"}
        </button>
        {buildMutation.isError && (
          <p className="text-sm text-red-600">Build failed. Please try again.</p>
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
          Next Step
        </button>
      </div>
    </div>
  );
}
