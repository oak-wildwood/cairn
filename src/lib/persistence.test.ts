import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadState, parseMap, saveState, saveStateDebounced } from "./persistence";
import { SCHEMA_VERSION, SELF_ID } from "./types";
import type { PersistedState } from "./types";
import { makePart } from "./testSupport";

function validState(overrides: Partial<PersistedState> = {}): PersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    parts: [makePart({ id: "a" }), makePart({ id: "b" })],
    connections: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  history.pushState({}, "", "/");
});

describe("parseMap", () => {
  it("returns null for text that isn't JSON", () => {
    expect(parseMap("not json")).toBeNull();
  });

  it("returns null for JSON that doesn't match the schema", () => {
    expect(parseMap(JSON.stringify({ hello: "world" }))).toBeNull();
  });

  it("accepts a well-formed current-schema blob", () => {
    const state = validState();
    expect(parseMap(JSON.stringify(state))).toEqual(state);
  });

  it("lowercases feelings so the same tag can't be split by case", () => {
    const state = validState({
      parts: [makePart({ id: "a", feelings: ["Anxious", "anxious", "Sad"] })],
    });
    const result = parseMap(JSON.stringify(state));
    expect(result?.parts[0].feelings).toEqual(["anxious", "sad"]);
  });

  it("drops a connection naming a part that no longer exists", () => {
    const state = validState({
      parts: [makePart({ id: "a" })],
      connections: [
        { id: "c1", sourceId: "a", targetId: "ghost", label: "protects" },
        { id: "c2", sourceId: "a", targetId: SELF_ID, label: "connected to" },
      ],
    });
    const result = parseMap(JSON.stringify(state));
    expect(result?.connections.map((c) => c.id)).toEqual(["c2"]);
  });

  it("drops a self-loop connection", () => {
    const state = validState({
      parts: [makePart({ id: "a" })],
      connections: [{ id: "c1", sourceId: "a", targetId: "a", label: "" }],
    });
    expect(parseMap(JSON.stringify(state))?.connections).toEqual([]);
  });

  it("dedupes an exact repeat of the same direction, but keeps the reverse edge", () => {
    const state = validState({
      parts: [makePart({ id: "a" }), makePart({ id: "b" })],
      connections: [
        { id: "c1", sourceId: "a", targetId: "b", label: "protects" },
        { id: "c2", sourceId: "a", targetId: "b", label: "protects again" },
        { id: "c3", sourceId: "b", targetId: "a", label: "triggers" },
      ],
    });
    const result = parseMap(JSON.stringify(state));
    expect(result?.connections.map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("migrates a schema-1 blob, recovering status \"active\" into the active flag", () => {
    const { active: _active, ...legacyPart } = makePart({
      id: "a",
      status: "Active",
    });
    const legacy = {
      schemaVersion: 1,
      parts: [legacyPart],
      connections: [],
    };
    const result = parseMap(JSON.stringify(legacy));
    expect(result?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result?.parts[0]).toMatchObject({ status: "", active: true });
  });

  it("migrates a schema-1 blob, leaving any other status untouched and inactive", () => {
    const { active: _active, ...legacyPart } = makePart({
      id: "a",
      status: "witnessed",
    });
    const legacy = { schemaVersion: 1, parts: [legacyPart], connections: [] };
    const result = parseMap(JSON.stringify(legacy));
    expect(result?.parts[0]).toMatchObject({ status: "witnessed", active: false });
  });
});

describe("loadState / saveState", () => {
  it("returns null when nothing has been stored", () => {
    expect(loadState()).toBeNull();
  });

  it("round-trips a saved map", () => {
    const state = validState();
    saveState(state);
    expect(loadState()).toEqual(state);
  });

  it("returns null for a corrupted blob rather than throwing", () => {
    localStorage.setItem("cairn.map.v1", "{not json");
    expect(loadState()).toBeNull();
  });

  it("never reads or writes the real map on the demo route", () => {
    saveState(validState());
    history.pushState({}, "", "/demo/");
    expect(loadState()).toBeNull();

    localStorage.clear();
    history.pushState({}, "", "/demo/");
    saveState(validState());
    history.pushState({}, "", "/");
    expect(loadState()).toBeNull();
  });
});

describe("saveStateDebounced", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces a burst of writes into one, after the delay", () => {
    saveStateDebounced(validState({ ownerName: "first" }));
    saveStateDebounced(validState({ ownerName: "second" }));
    expect(loadState()).toBeNull();

    vi.runAllTimers();

    expect(loadState()?.ownerName).toBe("second");
  });
});
