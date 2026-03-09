const AGENT_NAMES = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel",
  "India", "Juliet", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa",
  "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "Xray",
];

const agentNameMap = new Map<string, string>();
let nextIdx = 0;

export function humanizeAgentId(id: string): string {
  let name = agentNameMap.get(id);
  if (!name) {
    name = nextIdx < AGENT_NAMES.length
      ? `Agent ${AGENT_NAMES[nextIdx]}`
      : `Agent ${nextIdx + 1}`;
    agentNameMap.set(id, name);
    nextIdx++;
  }
  return name;
}

const EVENT_LABELS: Record<string, string> = {
  agent_action: "Action",
  grounded_var: "Variable Update",
  branch_update: "Branch Update",
  simulation_complete: "Complete",
  error: "Error",
  interview_response: "Response",
  status: "Status",
};

export function humanizeEventType(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType.replace(/_/g, " ");
}
