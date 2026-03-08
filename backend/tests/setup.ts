import { afterAll } from "bun:test";
import { closePool } from "../src/db/client";
afterAll(async () => { await closePool(); });
