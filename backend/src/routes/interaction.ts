import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { getSimulationService } from "../services/simulationService";
import { verifyAccessToken } from "../services/authService";
import { query } from "../db/client";
import { logger } from "../utils/logger";

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

      onMessage(evt, ws) {
        try {
          const cmd = JSON.parse(String(evt.data));
          const simService = getSimulationService();
          const runner = simService.getRunner(simId);
          if (runner && cmd.type) {
            runner.sendCommand(cmd);
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

export { interaction, websocket };
