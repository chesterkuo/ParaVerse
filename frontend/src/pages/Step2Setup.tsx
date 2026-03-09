import { StepProgress } from "@/components/layout/StepProgress";

export default function Step2Setup() {
  return (
    <div>
      <StepProgress currentStep={2} />
      <h2 className="text-xl font-bold text-navy">Step 2: Environment Setup</h2>
      <p className="text-gray-500 mt-2">Configure agents and simulation parameters.</p>
    </div>
  );
}
