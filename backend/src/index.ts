import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { errorHandler } from "./middleware/errorHandler";
import { rateLimit } from "./middleware/rateLimit";
import { auth } from "./routes/auth";
import { projects } from "./routes/projects";
import { graph } from "./routes/graph";
import { simulation } from "./routes/simulation";
import { report } from "./routes/report";
import { tasks } from "./routes/tasks";
import { interaction, websocket } from "./routes/interaction";
import { logger } from "./utils/logger";

const app = new Hono();
app.use("*", errorHandler);
app.use("*", cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use("*", honoLogger());
app.get("/health", (c) => c.json({ status: "ok" }));

const api = new Hono();
api.use("*", rateLimit({ windowMs: 60_000, max: 100, keyPrefix: "rl:api" }));
api.route("/auth", auth);
api.route("/projects", projects);
api.route("/projects", graph);
api.route("/simulations", simulation);
api.route("/simulations", report);
api.route("/tasks", tasks);
app.route("/api/v1", api);
app.route("/ws", interaction);

const port = parseInt(process.env.PORT || "5001");
logger.info({ port }, "ParaVerse API running");

export default { port, fetch: app.fetch, websocket };
