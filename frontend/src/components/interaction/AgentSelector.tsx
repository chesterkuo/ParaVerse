interface Agent {
  id: string;
  name: string;
  demographics: { group?: string; role?: string };
}

export function AgentSelector({ agents, selectedId, onSelect }: {
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">Select Agent</h3>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {agents.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-4">No agents available</div>
        )}
        {agents.map((agent) => (
          <button key={agent.id} onClick={() => onSelect(agent.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              selectedId === agent.id ? "bg-violet/10 text-violet font-medium" : "hover:bg-gray-50 text-gray-700"
            }`}>
            <div className="font-medium">{agent.name}</div>
            {(agent.demographics.role || agent.demographics.group) && (
              <div className="text-xs text-gray-500">{agent.demographics.role || agent.demographics.group}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
