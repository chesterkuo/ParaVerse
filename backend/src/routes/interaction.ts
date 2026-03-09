import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { getSimulationService } from "../services/simulationService";
import { verifyAccessToken } from "../services/authService";
import { query } from "../db/client";
import { logger } from "../utils/logger";
import { getAgentById } from "../db/queries/agents";
import { getSimulationEvents } from "../db/queries/simulations";
import { getLlmService } from "../services/llmService";

const { upgradeWebSocket, websocket } = createBunWebSocket();

const interaction = new Hono();

// WS /ws/simulations/:id — real-time simulation events
interaction.get(
  "/simulations/:id",
  upgradeWebSocket((c) => {
    const simId = c.req.param("id");
    const token = c.req.query("token");

    let unsubscribe: (() => void) | null = null;

    return {
      async onOpen(_evt, ws) {
        // Authenticate via query param token
        if (!token) {
          (ws as any).send(JSON.stringify({ type: "error", message: "Authentication required" }));
          ws.close(4001, "Authentication required");
          return;
        }

        try {
          await verifyAccessToken(token);
        } catch {
          (ws as any).send(JSON.stringify({ type: "error", message: "Invalid token" }));
          ws.close(4001, "Invalid token");
          return;
        }

        logger.info({ simId }, "WebSocket connected for simulation");

        const simService = getSimulationService();
        const runner = simService.getRunner(simId);

        if (runner) {
          unsubscribe = runner.onEvent((event) => {
            try {
              (ws as any).send(JSON.stringify(event));
            } catch {
              // Client disconnected
            }
          });
        }
      },

      async onMessage(evt, ws) {
        try {
          const cmd = JSON.parse(String(evt.data));
          const simService = getSimulationService();
          const runner = simService.getRunner(simId);

          if (runner && cmd.type) {
            runner.sendCommand(cmd);
          } else if (cmd.type === "interview_agent" && cmd.agent_id && cmd.question) {
            // Simulation completed — use LLM to generate in-character response
            handleOfflineInterview(simId, cmd.agent_id, cmd.question, ws, cmd.locale).catch((err) => {
              logger.error({ err, simId, agentId: cmd.agent_id }, "Offline interview failed");
              try {
                (ws as any).send(JSON.stringify({
                  type: "interview_response",
                  agent_id: cmd.agent_id,
                  response: "Sorry, I'm unable to respond right now. Please try again later.",
                }));
              } catch { /* disconnected */ }
            });
          }
        } catch {
          (ws as any).send(JSON.stringify({ type: "error", message: "Invalid command" }));
        }
      },

      onClose() {
        unsubscribe?.();
        logger.info({ simId }, "WebSocket disconnected");
      },
    };
  })
);

// WS /ws/interactions/:id — deep conversation with agents
interaction.get(
  "/interactions/:id",
  upgradeWebSocket((c) => {
    const sessionId = c.req.param("id");
    const token = c.req.query("token");

    let interviewUnsubscribe: (() => void) | null = null;

    return {
      async onOpen(_evt, ws) {
        if (!token) {
          (ws as any).send(JSON.stringify({ type: "error", message: "Authentication required" }));
          ws.close(4001, "Authentication required");
          return;
        }

        try {
          await verifyAccessToken(token);
        } catch {
          (ws as any).send(JSON.stringify({ type: "error", message: "Invalid token" }));
          ws.close(4001, "Invalid token");
          return;
        }

        logger.info({ sessionId }, "Interaction session opened");
      },

      onMessage(evt, ws) {
        try {
          const msg = JSON.parse(String(evt.data));

          // Store message in interaction session
          query(
            `UPDATE interaction_sessions
             SET messages = array_append(messages, $2::jsonb)
             WHERE id = $1`,
            [sessionId, JSON.stringify({ role: "user", content: msg.content, timestamp: new Date().toISOString() })]
          );

          // If targeting a specific agent in a running simulation
          if (msg.simulation_id && msg.agent_id) {
            const simService = getSimulationService();
            const runner = simService.getRunner(msg.simulation_id);
            if (runner) {
              runner.sendCommand({
                type: "interview_agent",
                agent_id: msg.agent_id,
                prompt: msg.content,
              });

              // Clean up previous listener before adding new one
              interviewUnsubscribe?.();
              interviewUnsubscribe = runner.onEvent((event) => {
                if ((event as any).type === "interview_response" && (event as any).agent_id === msg.agent_id) {
                  (ws as any).send(JSON.stringify(event));

                  query(
                    `UPDATE interaction_sessions
                     SET messages = array_append(messages, $2::jsonb)
                     WHERE id = $1`,
                    [sessionId, JSON.stringify({ role: "agent", content: (event as any).response, timestamp: new Date().toISOString() })]
                  );
                }
              });
            }
          }
        } catch {
          (ws as any).send(JSON.stringify({ type: "error", message: "Invalid message format" }));
        }
      },

      onClose() {
        interviewUnsubscribe?.();
        logger.info({ sessionId }, "Interaction session closed");
      },
    };
  })
);

const LOCALE_INSTRUCTIONS: Record<string, string> = {
  en: "Respond in English.",
  "zh-CN": "请用简体中文回答。",
  "zh-TW": "請用繁體中文回答。",
  ko: "한국어로 답변해 주세요.",
  ja: "日本語で回答してください。",
  fr: "Répondez en français.",
  es: "Responde en español.",
  vi: "Vui lòng trả lời bằng tiếng Việt.",
  th: "กรุณาตอบเป็นภาษาไทย",
  nl: "Antwoord in het Nederlands.",
};

async function handleOfflineInterview(
  simId: string,
  agentId: string,
  question: string,
  ws: any,
  locale?: string
): Promise<void> {
  const agent = await getAgentById(agentId);
  if (!agent) {
    ws.send(JSON.stringify({
      type: "interview_response",
      agent_id: agentId,
      response: "Agent not found.",
    }));
    return;
  }

  // Load recent simulation events for this agent to give context
  const events = await getSimulationEvents(simId, {
    limit: 20,
    eventType: "agent_action",
  });
  const agentEvents = events.filter((e) => e.agent_id === agentId);
  const recentActions = agentEvents
    .slice(0, 10)
    .map((e) => e.content)
    .filter(Boolean)
    .join("\n");

  const localeInstruction = locale && LOCALE_INSTRUCTIONS[locale]
    ? LOCALE_INSTRUCTIONS[locale]
    : LOCALE_INSTRUCTIONS.en;

  const systemPrompt = `You are ${agent.name}, a simulated agent in a social simulation.

Your persona: ${agent.persona}
Your demographics: ${JSON.stringify(agent.demographics)}

${recentActions ? `Your recent actions in the simulation:\n${recentActions}\n` : ""}

Stay in character. Answer the interviewer's question based on your persona, beliefs, and experiences in the simulation. Be concise but insightful. Respond in 2-4 sentences.

${localeInstruction}`;

  const llm = getLlmService();
  const response = await llm.chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ], { temperature: 0.8, maxTokens: 3200 });

  ws.send(JSON.stringify({
    type: "interview_response",
    agent_id: agentId,
    response,
  }));
}

export { interaction, websocket };
