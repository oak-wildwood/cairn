import { describe, expect, it } from "vitest";
import { EXAMPLE_CONNECTIONS, EXAMPLE_PARTS } from "./exampleData";
import { connectionEdgeKey } from "./layout";
import { SELF_ID } from "./types";

/**
 * The seed map is the first thing a visitor sees, and its connections are
 * meant to model real IFS relationships (see AGENTS.md's note on
 * protector/exile bonds), not just look plausible. These guard the two ways
 * that could quietly stop being true as the data is edited.
 */
describe("EXAMPLE_CONNECTIONS", () => {
  it("only names parts that exist, or Self", () => {
    const ids = new Set(EXAMPLE_PARTS.map((part) => part.id));
    for (const connection of EXAMPLE_CONNECTIONS) {
      expect(connection.sourceId === SELF_ID || ids.has(connection.sourceId)).toBe(
        true,
      );
      expect(connection.targetId === SELF_ID || ids.has(connection.targetId)).toBe(
        true,
      );
    }
  });

  it("never repeats the same directed edge twice", () => {
    const keys = EXAMPLE_CONNECTIONS.map((connection) =>
      connectionEdgeKey(connection.sourceId, connection.targetId),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
