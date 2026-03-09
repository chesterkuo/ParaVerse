import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useTaskStatus } from "@/hooks/useSimulation";

interface TaskProgressProps {
  taskId: string | null;
  taskType?: string;
  onComplete?: () => void;
}

export function TaskProgress({ taskId, taskType, onComplete }: TaskProgressProps) {
  const { t } = useTranslation();
  const { data } = useTaskStatus(taskId);
  const calledRef = useRef(false);

  useEffect(() => {
    if (data?.status === "completed" && !calledRef.current) {
      calledRef.current = true;
      onComplete?.();
    }
  }, [data?.status, onComplete]);

  useEffect(() => {
    calledRef.current = false;
  }, [taskId]);

  if (!taskId || !data) return null;

  const progress = typeof data.progress === "number" ? data.progress : 0;
  const pct = Math.round(progress * 100);
  const isFailed = data.status === "failed";
  const isCompleted = data.status === "completed";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">
          {taskType ?? t("task.label")}
        </span>
        <span className={`text-xs font-semibold ${isFailed ? "text-red-600" : isCompleted ? "text-green-600" : "text-violet"}`}>
          {pct}%
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isFailed ? "bg-red-500" : isCompleted ? "bg-green-500" : "bg-violet"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-gray-500">
        {isFailed ? t("task.failed") : isCompleted ? t("task.completed") : t("task.inProgress")}
      </div>
      {isFailed && data.error && (
        <p className="text-xs text-red-600 mt-1">{String(data.error)}</p>
      )}
    </div>
  );
}
