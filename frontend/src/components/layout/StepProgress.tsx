import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

const STEP_KEYS = [
  { num: 1, key: "steps.knowledgeGraph" },
  { num: 2, key: "steps.environment" },
  { num: 3, key: "steps.simulation" },
  { num: 4, key: "steps.report" },
  { num: 5, key: "steps.interaction" },
];

export function StepProgress({ currentStep }: { currentStep: number }) {
  const { projectId } = useParams();
  const { t } = useTranslation();

  return (
    <div className="mb-8">
      <div className="flex items-center">
        {STEP_KEYS.map((step, idx) => {
          const isActive = step.num === currentStep;
          const isCompleted = step.num < currentStep;
          return (
            <div key={step.num} className="flex items-center flex-1 last:flex-initial">
              <Link
                to={`/projects/${projectId}/step/${step.num}`}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all
                  ${isActive
                    ? "bg-violet text-white shadow-md shadow-violet/30"
                    : isCompleted
                    ? "bg-violet/15 text-violet"
                    : "bg-gray-200 text-text-muted group-hover:bg-gray-300"
                  }`}
                >
                  {isCompleted ? <Check size={14} strokeWidth={3} /> : step.num}
                </div>
                <span className={`text-sm font-medium hidden sm:inline transition-colors
                  ${isActive ? "text-text-primary" : isCompleted ? "text-violet" : "text-text-muted group-hover:text-text-secondary"}`}
                >
                  {t(step.key)}
                </span>
              </Link>
              {/* Connector line */}
              {idx < STEP_KEYS.length - 1 && (
                <div className={`flex-1 h-px mx-3 ${step.num < currentStep ? "bg-violet/30" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
