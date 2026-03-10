import { Hono } from "hono";
import { apiReference } from "@scalar/hono-api-reference";
import { openApiSpec } from "../openapi/spec";

const docs = new Hono();

docs.get("/openapi.json", (c) => c.json(openApiSpec));

docs.get(
  "/",
  apiReference({
    spec: { content: openApiSpec },
    theme: "kepler",
    layout: "modern",
    defaultHttpClient: { targetKey: "javascript", clientKey: "fetch" },
  }),
);

export { docs };
