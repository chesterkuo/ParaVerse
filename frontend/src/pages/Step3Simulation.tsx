import { StepProgress } from "@/components/layout/StepProgress";

export default function Step3Simulation() {
  return (
    <div>
      <StepProgress currentStep={3} />
      <h2 className="text-xl font-bold text-navy">Step 3: Simulation</h2>
      <p className="text-gray-500 mt-2">Run and monitor the simulation in real-time.</p>
    </div>
  );
}
