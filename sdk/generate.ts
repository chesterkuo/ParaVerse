/**
 * Generate TypeScript types from OpenAPI spec.
 * Usage: cd sdk && bun run generate.ts
 */
import { mkdirSync, writeFileSync } from "fs";
import { execSync } from "child_process";

// Dynamic import of spec from backend
const specModule = await import("../backend/src/openapi/spec");
const spec = specModule.openApiSpec || specModule.default || specModule.spec;

mkdirSync("generated", { recursive: true });
writeFileSync("generated/openapi.json", JSON.stringify(spec, null, 2));

// Generate types
execSync("bunx openapi-typescript generated/openapi.json -o generated/api-types.ts", { stdio: "inherit" });

console.log("✓ SDK types generated at generated/api-types.ts");
