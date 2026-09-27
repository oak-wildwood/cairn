import { describe, expect, it } from "vitest";
import { parseMap } from "./persistence";
import { SCHEMA_VERSION, SELF_ID } from "./types";
import { makePart } from "./testFixtures";

function makeConnection(
  overrides: Partial<{
    id: string;
    sourceId: string;
    targetId: string;
    label: string;
  }> = {},
) {
  return {
    id: "c1",
    sourceId: SELF_ID,
    targetId: "p1",
    label: "",
    ...overrides,
  };
}

describe("parseMap", () => {
  it("returns null for text that isn't JSON", () => {
    expect(parseMap("not json")).toBeNull();
  });

  it("returns null for JSON that isn't a valid map shape", () => {
    expect(parseMap(JSON.stringify({ hello: "world" }))).toBeNull();
  });

  it("returns null when a part has an invalid role", () => {
    const state = {
      schemaVersion: SCHEMA_VERSION,
      parts: [{ ...makePart(), role: "sidekick" }],
      connections: [],
    };
    expect(parseMap(JSON.stringify(state))).toBeNull();
  });

  it("accepts a well-formed current-schema map", () => {
    const state = {
      schemaVersion: SCHEMA_VERSION,
      parts: [makePart({ id: "p1" })],
      connections: [makeConnection()],
    };
    const result = parseMap(JSON.stringify(state));
    expect(result).not.toBeNull();
    expect(result!.parts).toHaveLength(1);
    expect(result!.connections).toHaveLength(1);
  });

  it("drops a connection naming a part that doesn't exist", () => {
    const state = {
      schemaVersion: SCHEMA_VERSION,
      parts: [makePart({ id: "p1" })],
      connections: [makeConnection({ targetId: "ghost" })],
    };
    const result = parseMap(JSON.stringify(state));
    expect(result!.connections).toHaveLength(0);
  });

  it("drops a self-loop connection", () => {
    const state = {
      schemaVersion: SCHEMA_VERSION,
      parts: [makePart({ id: "p1" })],
      connections: [makeConnection({ sourceId: "p1", targetId: "p1" })],
    };
    const result = parseMap(JSON.stringify(state));
    expect(result!.connections).toHaveLength(0);
  });

  it("dedupes an exact repeat of the same directed edge, keeping the reverse", () => {
    const state = {
      schemaVersion: SCHEMA_VERSION,
      parts: [makePart({ id: "p1" }), makePart({ id: "p2" })],
      connections: [
        makeConnection({ id: "c1", sourceId: "p1", targetId: "p2" }),
        makeConnection({ id: "c2", sourceId: "p1", targetId: "p2" }),
        makeConnection({ id: "c3", sourceId: "p2", targetId: "p1" }),
      ],
    };
    const result = parseMap(JSON.stringify(state));
    expect(result!.connections.map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("lowercases feelings and collapses case-only duplicates", () => {
    const state = {
      schemaVersion: SCHEMA_VERSION,
      parts: [makePart({ id: "p1", feelings: ["Anxious", "anxious", "Sad"] })],
      connections: [],
    };
    const result = parseMap(JSON.stringify(state));
    expect(result!.parts[0].feelings.sort()).toEqual(["anxious", "sad"]);
  });

  it("migrates a schema-1 part whose status was the old 'active' marker", () => {
    const legacyPart = { ...makePart({ id: "p1" }), status: "Active" };
    delete (legacyPart as { active?: boolean }).active;
    const state = {
      schemaVersion: 1,
      parts: [legacyPart],
      connections: [],
    };
    const result = parseMap(JSON.stringify(state));
    expect(result!.parts[0].active).toBe(true);
    expect(result!.parts[0].status).toBe("");
  });

  it("carries a schema-1 part's non-'active' status over untouched", () => {
    const legacyPart = { ...makePart({ id: "p1" }), status: "witnessed" };
    delete (legacyPart as { active?: boolean }).active;
    const state = {
      schemaVersion: 1,
      parts: [legacyPart],
      connections: [],
    };
    const result = parseMap(JSON.stringify(state));
    expect(result!.parts[0].active).toBe(false);
    expect(result!.parts[0].status).toBe("witnessed");
  });
});
