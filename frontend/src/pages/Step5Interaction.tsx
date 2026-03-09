import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { StepProgress } from "@/components/layout/StepProgress";
import { useSimulationStore } from "@/store/simulationStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { simulationApi } from "@/api/simulation";
import { humanizeAgentId } from "@/utils/humanize";

interface ChatMessage {
  role: "user" | "agent";
  content: string;
  agentId?: string;
}

interface AgentInfo {
  id: string;
  name: string;
  persona: string;
}

export default function Step5Interaction() {
  const { t, i18n } = useTranslation();
  const { projectId } = useParams();
  const { simId, setSimulation, setStatus } = useSimulationStore();
  const [selectedAgent, setSelectedAgent] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load simulation from API if not in store (e.g. page refresh)
  const { data: simList } = useQuery({
    queryKey: ["simulations-by-project", projectId],
    queryFn: () => simulationApi.listByProject(projectId!).then((r) => r.data.data),
    enabled: !!projectId && !simId,
  });

  // Hydrate store from API data on first load
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!simList || simList.length === 0 || simId || hydratedRef.current) return;
    hydratedRef.current = true;
    const latest = simList[0];
    setSimulation(latest.id, latest.engine as "oasis" | "concordia");
    setStatus(latest.status);
  }, [simList, simId, setSimulation, setStatus]);

  const effectiveSimId = simId || (simList?.[0]?.id ?? null);

  // Load agents from API
  const { data: apiAgents } = useQuery({
    queryKey: ["simulation-agents", effectiveSimId],
    queryFn: () => simulationApi.listAgents(effectiveSimId!).then((r) => r.data.data as AgentInfo[]),
    enabled: !!effectiveSimId,
  });

  const { events, connected, send } = useWebSocket(
    effectiveSimId ? `/ws/simulations/${effectiveSimId}` : "",
  );

  // Combine API agents with any agent IDs from WebSocket events
  const agentList = useMemo(() => {
    const agentMap = new Map<string, AgentInfo>();
    if (apiAgents) {
      for (const agent of apiAgents) {
        agentMap.set(agent.id, agent);
      }
    }
    for (const ev of events) {
      const agentId = ev.agent_id as string | undefined;
      if (agentId && !agentMap.has(agentId)) {
        agentMap.set(agentId, { id: agentId, name: "", persona: "" });
      }
    }
    return Array.from(agentMap.values());
  }, [apiAgents, events]);

  const effectiveAgent = selectedAgent || agentList[0]?.id || "";

  const getAgentDisplayName = useCallback((agentId: string) => {
    const agent = agentList.find((a) => a.id === agentId);
    if (agent?.name) return agent.name;
    return humanizeAgentId(agentId);
  }, [agentList]);

  // Process interview responses
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
      locale: i18n.language,
    });
    setInput("");
  };

  return (
    <div className="space-y-6">
      <StepProgress currentStep={5} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy">{t("step5.title")}</h2>
          <p className="text-gray-500">{t("step5.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs text-gray-400">{connected ? t("common.connected") : t("common.disconnected")}</span>
        </div>
      </div>

      {!effectiveSimId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
          {t("step5.noSimulation")}
        </div>
      )}

      {effectiveSimId && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Agent Selector */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-sm font-semibold text-gray-600">{t("step5.agents")}</h3>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {agentList.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">
                  {t("step5.loadingAgents")}
                </div>
              ) : (
                agentList.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent.id)}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-b-0 transition-colors cursor-pointer
                      ${effectiveAgent === agent.id ? "bg-violet/10 text-violet font-medium" : "hover:bg-gray-50 text-gray-700"}
                    `}
                  >
                    <div>{agent.name || humanizeAgentId(agent.id)}</div>
                    {agent.persona && (
                      <div className="text-[10px] text-text-muted truncate">{agent.persona}</div>
                    )}
                  </button>
                ))
              )}
            </div>

            <div>
              <input
                type="text"
                placeholder={t("step5.enterAgentId")}
                value={effectiveAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
              />
            </div>
          </div>

          {/* Chat Panel */}
          <div className="lg:col-span-3 flex flex-col bg-white rounded-lg border border-gray-200 h-[calc(100vh-280px)] min-h-[300px]">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 text-sm pt-8">
                  {t("step5.startChatting")}
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
                        {getAgentDisplayName(msg.agentId)}
                      </div>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-gray-200 p-3 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={effectiveAgent ? t("step5.typeQuestion") : t("step5.selectAgentFirst")}
                disabled={!effectiveAgent}
                className="flex-1 px-3 py-2 border border-gray-300 rounded disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!effectiveAgent || !input.trim()}
                className="bg-violet text-white px-4 py-2 rounded hover:bg-violet/90 disabled:opacity-50 cursor-pointer"
              >
                {t("common.send")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
