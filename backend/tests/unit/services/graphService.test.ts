import { describe, test, expect } from "bun:test";
import { parseOntologyResponse } from "../../../src/services/graphService";

describe("graphService", () => {
  test("parseOntologyResponse extracts entities and relations", () => {
    const result = parseOntologyResponse({
      entities: [
        { type: "person", name: "John Doe", description: "CEO of Acme" },
        { type: "org", name: "Acme Corp", description: "Technology company" },
      ],
      relations: [{ source: "John Doe", target: "Acme Corp", type: "leads", weight: 1.0 }],
    });
    expect(result.entities).toHaveLength(2);
    expect(result.relations).toHaveLength(1);
  });
  test("parseOntologyResponse handles empty input", () => {
    const result = parseOntologyResponse({ entities: [], relations: [] });
    expect(result.entities).toHaveLength(0);
    expect(result.relations).toHaveLength(0);
  });
});
