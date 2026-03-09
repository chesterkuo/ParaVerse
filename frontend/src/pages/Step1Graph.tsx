import { StepProgress } from "@/components/layout/StepProgress";

export default function Step1Graph() {
  return (
    <div>
      <StepProgress currentStep={1} />
      <h2 className="text-xl font-bold text-navy">Step 1: Knowledge Graph</h2>
      <p className="text-gray-500 mt-2">Upload seed documents and build the knowledge graph.</p>
    </div>
  );
}
