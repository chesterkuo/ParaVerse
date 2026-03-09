import { StepProgress } from "@/components/layout/StepProgress";

export default function Step4Report() {
  return (
    <div>
      <StepProgress currentStep={4} />
      <h2 className="text-xl font-bold text-navy">Step 4: Report</h2>
      <p className="text-gray-500 mt-2">View the generated analysis report.</p>
    </div>
  );
}
