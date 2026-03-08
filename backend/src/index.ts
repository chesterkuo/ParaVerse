import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";

const app = new Hono();
app.use("*", cors());
app.use("*", honoLogger());
app.get("/health", (c) => c.json({ status: "ok" }));

const port = parseInt(process.env.PORT || "5001");
console.log(`ParaVerse API running on port ${port}`);

export default { port, fetch: app.fetch };
