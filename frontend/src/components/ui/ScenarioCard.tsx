interface ScenarioCardProps {
  label: string;
  description: string;
  engine: "oasis" | "concordia";
  selected?: boolean;
  onClick?: () => void;
}

const ENGINE_BORDER: Record<string, string> = {
  oasis: "border-oasis",
  concordia: "border-concordia",
};

export function ScenarioCard({ label, description, engine, selected, onClick }: ScenarioCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border-2 p-4 transition-all hover:shadow-md w-full
        ${selected ? `${ENGINE_BORDER[engine]} bg-white shadow-md` : "border-gray-200 bg-white hover:border-gray-300"}
      `}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-navy">{label}</span>
        <span
          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
          style={{ backgroundColor: engine === "oasis" ? "#F59E0B" : "#00C4B4" }}
        >
          {engine.toUpperCase()}
        </span>
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </button>
  );
}
