import { useParams, Link } from "react-router-dom";
import { Check } from "lucide-react";

const STEPS = [
  { num: 1, label: "Knowledge Graph" },
  { num: 2, label: "Environment" },
  { num: 3, label: "Simulation" },
  { num: 4, label: "Report" },
  { num: 5, label: "Interaction" },
];

export function StepProgress({ currentStep }: { currentStep: number }) {
  const { projectId } = useParams();

  return (
    <div className="mb-8">
      <div className="flex items-center">
        {STEPS.map((step, idx) => {
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
                  {step.label}
                </span>
              </Link>
              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-3 ${step.num < currentStep ? "bg-violet/30" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
