const LEGEND_ITEMS = [
  { type: "person", color: "#6C3FC5", label: "Person" },
  { type: "org", color: "#F59E0B", label: "Organization" },
  { type: "event", color: "#EF4444", label: "Event" },
  { type: "concept", color: "#00C4B4", label: "Concept" },
  { type: "location", color: "#3B82F6", label: "Location" },
];

export function GraphControls() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Node Types
      </h4>
      <div className="flex flex-wrap gap-3">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.type} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
