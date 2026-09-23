import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isDemoRoute,
  loadState,
  parseMap,
  saveState,
  saveStateDebounced,
} from "./persistence";
import { SCHEMA_VERSION, SELF_ID } from "./types";
import type { Part, PersistedState } from "./types";

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: "the-fixer",
    name: "The Fixer",
    role: "manager",
    description: "",
    feelings: [],
    bodyLocation: "",
    trigger: "",
    positiveIntention: "",
    fears: "",
    origins: "",
    notes: "",
    status: "",
    active: false,
    x: null,
    y: null,
    ...overrides,
  };
}

function makeState(overrides: Partial<PersistedState> = {}): PersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    parts: [makePart()],
    connections: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  history.pushState({}, "", "/");
});

describe("isDemoRoute", () => {
  it("is true on /demo and /demo/", () => {
    history.pushState({}, "", "/demo");
    expect(isDemoRoute()).toBe(true);
    history.pushState({}, "", "/demo/");
    expect(isDemoRoute()).toBe(true);
  });

  it("is false everywhere else", () => {
    history.pushState({}, "", "/");
    expect(isDemoRoute()).toBe(false);
    history.pushState({}, "", "/demonstration");
    expect(isDemoRoute()).toBe(false);
  });
});

describe("parseMap", () => {
  it("returns null for text that isn't JSON", () => {
    expect(parseMap("not json")).toBeNull();
  });

  it("returns null for JSON that doesn't match the schema", () => {
    expect(parseMap(JSON.stringify({ hello: "world" }))).toBeNull();
  });

  it("parses a valid current-schema blob", () => {
    const state = makeState();
    expect(parseMap(JSON.stringify(state))).toEqual(state);
  });

  it("lowercases and dedupes feelings", () => {
    const state = makeState({
      parts: [makePart({ feelings: ["Anxious", "anxious", "Sad"] })],
    });
    const result = parseMap(JSON.stringify(state));
    expect(result?.parts[0].feelings).toEqual(["anxious", "sad"]);
  });

  it("drops connections naming a part that doesn't exist", () => {
    const state = makeState({
      connections: [
        { id: "c1", sourceId: "the-fixer", targetId: "ghost", label: "" },
      ],
    });
    expect(parseMap(JSON.stringify(state))?.connections).toEqual([]);
  });

  it("keeps a connection touching Self", () => {
    const state = makeState({
      connections: [
        { id: "c1", sourceId: SELF_ID, targetId: "the-fixer", label: "" },
      ],
    });
    expect(parseMap(JSON.stringify(state))?.connections).toHaveLength(1);
  });

  it("drops a self-loop connection", () => {
    const state = makeState({
      connections: [
        { id: "c1", sourceId: "the-fixer", targetId: "the-fixer", label: "" },
      ],
    });
    expect(parseMap(JSON.stringify(state))?.connections).toEqual([]);
  });

  it("dedupes an exact repeat of the same directed edge, keeping the first", () => {
    const state = makeState({
      parts: [makePart({ id: "a" }), makePart({ id: "b" })],
      connections: [
        { id: "first", sourceId: "a", targetId: "b", label: "protects" },
        { id: "second", sourceId: "a", targetId: "b", label: "triggers" },
      ],
    });
    const result = parseMap(JSON.stringify(state));
    expect(result?.connections).toEqual([
      { id: "first", sourceId: "a", targetId: "b", label: "protects" },
    ]);
  });

  it("keeps both directions of a reciprocal pair", () => {
    const state = makeState({
      parts: [makePart({ id: "a" }), makePart({ id: "b" })],
      connections: [
        { id: "c1", sourceId: "a", targetId: "b", label: "protects" },
        { id: "c2", sourceId: "b", targetId: "a", label: "triggers" },
      ],
    });
    expect(parseMap(JSON.stringify(state))?.connections).toHaveLength(2);
  });

  it("migrates a legacy schema-1 part with status 'active' into active:true", () => {
    const legacy = {
      schemaVersion: 1,
      parts: [{ ...makePart(), status: "Active" }],
      connections: [],
    };
    // Legacy parts never carried `active` — strip it to model schema 1 exactly.
    delete (legacy.parts[0] as { active?: boolean }).active;

    const result = parseMap(JSON.stringify(legacy));
    expect(result?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result?.parts[0].active).toBe(true);
    expect(result?.parts[0].status).toBe("");
  });

  it("carries over a non-'active' legacy status untouched", () => {
    const legacy = {
      schemaVersion: 1,
      parts: [{ ...makePart(), status: "emerging" }],
      connections: [],
    };
    delete (legacy.parts[0] as { active?: boolean }).active;

    const result = parseMap(JSON.stringify(legacy));
    expect(result?.parts[0].active).toBe(false);
    expect(result?.parts[0].status).toBe("emerging");
  });
});

describe("loadState / saveState", () => {
  it("returns null when nothing is stored", () => {
    expect(loadState()).toBeNull();
  });

  it("round-trips a saved state", () => {
    const state = makeState();
    saveState(state);
    expect(loadState()).toEqual(state);
  });

  it("returns null for unparseable stored JSON", () => {
    localStorage.setItem("cairn.map.v1", "{not json");
    expect(loadState()).toBeNull();
  });

  it("never reads or writes on the demo route", () => {
    saveState(makeState());
    history.pushState({}, "", "/demo/");
    expect(loadState()).toBeNull();

    saveState(makeState({ ownerName: "Should Not Persist" }));
    history.pushState({}, "", "/");
    expect(loadState()?.ownerName).toBeUndefined();
  });
});

describe("saveStateDebounced", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces a burst of calls into a single write of the latest state", () => {
    saveStateDebounced(makeState({ ownerName: "first" }));
    saveStateDebounced(makeState({ ownerName: "second" }));
    saveStateDebounced(makeState({ ownerName: "third" }));

    expect(loadState()).toBeNull();

    vi.runAllTimers();

    expect(loadState()?.ownerName).toBe("third");
  });
});
