import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { StepProgress } from "@/components/layout/StepProgress";
import { useSimulationStore } from "@/store/simulationStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { humanizeAgentId } from "@/utils/humanize";

interface ChatMessage {
  role: "user" | "agent";
  content: string;
  agentId?: string;
}

export default function Step5Interaction() {
  const simId = useSimulationStore((s) => s.simId);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { events, connected, send } = useWebSocket(
    simId ? `/ws/simulations/${simId}` : "",
  );

  // Derive unique agent IDs from events (no setState needed)
  const agentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ev of events) {
      const agentId = ev.agent_id as string | undefined;
      if (agentId) ids.add(agentId);
    }
    return Array.from(ids);
  }, [events]);

  // Auto-select first agent when none selected
  const effectiveAgent = selectedAgent || agentIds[0] || "";

  // Process interview responses via ref-based tracking
  const lastProcessedIdx = useRef(0);
  const processNewEvents = useCallback(() => {
    if (events.length <= lastProcessedIdx.current) return;
    const newMessages: ChatMessage[] = [];
    for (let i = lastProcessedIdx.current; i < events.length; i++) {
      const ev = events[i];
      if (ev.type === "interview_response") {
        newMessages.push({
          role: "agent",
          content: (ev.response as string) ?? (ev.content as string) ?? "",
          agentId: ev.agent_id as string,
        });
      }
    }
    lastProcessedIdx.current = events.length;
    if (newMessages.length > 0) {
      setMessages((prev) => [...prev, ...newMessages]);
    }
  }, [events]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { processNewEvents(); }, [processNewEvents]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim() || !effectiveAgent) return;
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    send({
      type: "interview_agent",
      agent_id: effectiveAgent,
      question: input,
    });
    setInput("");
  };

  return (
    <div className="space-y-6">
      <StepProgress currentStep={5} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy">Step 5: Deep Interaction</h2>
          <p className="text-gray-500">Chat with agents and explore insights.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs text-gray-400">{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

      {!simId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
          No simulation found. Please complete previous steps first.
        </div>
      )}

      {simId && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Agent Selector */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-sm font-semibold text-gray-600">Agents</h3>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {agentIds.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">
                  No agents available
                </div>
              ) : (
                agentIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => setSelectedAgent(id)}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-b-0 transition-colors
                      ${effectiveAgent === id ? "bg-violet/10 text-violet font-medium" : "hover:bg-gray-50 text-gray-700"}
                    `}
                  >
                    {humanizeAgentId(id)}
                  </button>
                ))
              )}
            </div>

            {/* Manual agent ID input */}
            <div>
              <input
                type="text"
                placeholder="Enter agent ID..."
                value={effectiveAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
              />
            </div>
          </div>

          {/* Chat Panel */}
          <div className="lg:col-span-3 flex flex-col bg-white rounded-lg border border-gray-200 h-[500px]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 text-sm pt-8">
                  Select an agent and start chatting
                </div>
              )}
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-violet text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {msg.role === "agent" && msg.agentId && (
                      <div className="text-[10px] text-gray-400 mb-0.5">
                        {humanizeAgentId(msg.agentId)}
                      </div>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-3 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={effectiveAgent ? "Type your question..." : "Select an agent first"}
                disabled={!effectiveAgent}
                className="flex-1 px-3 py-2 border border-gray-300 rounded disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!effectiveAgent || !input.trim()}
                className="bg-violet text-white px-4 py-2 rounded hover:bg-violet/90 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
