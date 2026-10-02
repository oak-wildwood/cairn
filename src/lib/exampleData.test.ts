import { describe, expect, it } from "vitest";
import { connectionEdgeKey } from "./layout";
import { parseMap } from "./persistence";
import { EXAMPLE_CONNECTIONS, EXAMPLE_OWNER_NAME, EXAMPLE_PARTS } from "./exampleData";
import { SCHEMA_VERSION, SELF_ID } from "./types";

const GENERIC_NAMES = [
  "The Fixer",
  "The Analyst",
  "The Avoider",
  "Alarmist",
  "The Kid",
  "The Unseen One",
];

/**
 * The seed map is the first thing a visitor sees, so a hand edit to it must
 * not ship a connection the loader would drop. These check the structure:
 * every endpoint resolves, no direction appears twice, and at least one pair
 * runs both ways so the demo shows reciprocal arcs. Whether each bond is
 * drawn in the right direction (AGENTS.md's note on protector/exile pairs)
 * is a judgment about IFS, and these tests don't check it.
 */
describe("EXAMPLE_CONNECTIONS", () => {
  it("resolves every endpoint to a part or self", () => {
    const ids = new Set(EXAMPLE_PARTS.map((part) => part.id));
    for (const connection of EXAMPLE_CONNECTIONS) {
      expect(
        connection.sourceId === SELF_ID || ids.has(connection.sourceId),
      ).toBe(true);
      expect(
        connection.targetId === SELF_ID || ids.has(connection.targetId),
      ).toBe(true);
    }
  });

  it("never runs the same direction twice", () => {
    const keys = EXAMPLE_CONNECTIONS.map((connection) =>
      connectionEdgeKey(connection.sourceId, connection.targetId),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has at least one reciprocal pair", () => {
    const keys = new Set(
      EXAMPLE_CONNECTIONS.map((connection) =>
        connectionEdgeKey(connection.sourceId, connection.targetId),
      ),
    );
    const hasReciprocal = EXAMPLE_CONNECTIONS.some(
      (connection) =>
        keys.has(connectionEdgeKey(connection.targetId, connection.sourceId)),
    );
    expect(hasReciprocal).toBe(true);
  });
});

describe("the seed map as a whole", () => {
  it("passes parseMap unchanged", () => {
    const state = {
      schemaVersion: SCHEMA_VERSION,
      parts: EXAMPLE_PARTS,
      connections: EXAMPLE_CONNECTIONS,
      ownerName: EXAMPLE_OWNER_NAME,
    };
    expect(parseMap(JSON.stringify(state))).toEqual(state);
  });

  // Deliberately a copy of the constant: it enforces AGENTS.md's hard rule
  // that demo data stays these six generic names, so a real part name can't
  // slip into this public repo through the seed map.
  it("uses exactly the six generic part names", () => {
    expect(EXAMPLE_PARTS.map((part) => part.name)).toEqual(GENERIC_NAMES);
  });
});
