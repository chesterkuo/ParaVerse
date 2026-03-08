import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { errorHandler } from "./middleware/errorHandler";
import { auth } from "./routes/auth";

const app = new Hono();
app.use("*", errorHandler);
app.use("*", cors());
app.use("*", honoLogger());
app.get("/health", (c) => c.json({ status: "ok" }));

const api = new Hono();
api.route("/auth", auth);
app.route("/api/v1", api);

const port = parseInt(process.env.PORT || "5001");
console.log(`ParaVerse API running on port ${port}`);

export default { port, fetch: app.fetch };
