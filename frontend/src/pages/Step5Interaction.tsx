import { StepProgress } from "@/components/layout/StepProgress";

export default function Step5Interaction() {
  return (
    <div>
      <StepProgress currentStep={5} />
      <h2 className="text-xl font-bold text-navy">Step 5: Deep Interaction</h2>
      <p className="text-gray-500 mt-2">Chat with agents and explore insights.</p>
    </div>
  );
}
