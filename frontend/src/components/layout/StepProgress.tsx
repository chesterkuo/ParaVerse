import { useParams, Link } from "react-router-dom";

const STEPS = [
  { num: 1, label: "Knowledge Graph" },
  { num: 2, label: "Environment Setup" },
  { num: 3, label: "Simulation" },
  { num: 4, label: "Report" },
  { num: 5, label: "Interaction" },
];

export function StepProgress({ currentStep }: { currentStep: number }) {
  const { projectId } = useParams();

  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((step) => (
        <Link
          key={step.num}
          to={`/projects/${projectId}/step/${step.num}`}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
            ${step.num === currentStep
              ? "bg-violet text-white"
              : step.num < currentStep
              ? "bg-violet/20 text-violet"
              : "bg-gray-200 text-gray-400"
            }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold
            ${step.num === currentStep
              ? "bg-white/30 text-white"
              : step.num < currentStep
              ? "bg-violet/30 text-violet"
              : "bg-gray-300 text-gray-500"
            }`}>
            {step.num}
          </span>
          {step.label}
        </Link>
      ))}
    </div>
  );
}
