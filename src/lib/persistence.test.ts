import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isDemoRoute,
  loadState,
  parseMap,
  saveState,
  saveStateDebounced,
} from "./persistence";
import { SELF_ID } from "./types";
import type { Connection, Part, PersistedState } from "./types";

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: "part-1",
    name: "A Part",
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

function makeConnection(overrides: Partial<Connection> = {}): Connection {
  return {
    id: "conn-1",
    sourceId: SELF_ID,
    targetId: "part-1",
    label: "",
    ...overrides,
  };
}

function makeState(overrides: Partial<PersistedState> = {}): PersistedState {
  return {
    schemaVersion: 2,
    parts: [makePart()],
    connections: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  history.pushState({}, "", "/");
});

afterEach(() => {
  history.pushState({}, "", "/");
});

describe("isDemoRoute", () => {
  it("is false on the real app's route", () => {
    history.pushState({}, "", "/");
    expect(isDemoRoute()).toBe(false);
  });

  it("is true on the demo page, with or without a trailing slash", () => {
    history.pushState({}, "", "/demo");
    expect(isDemoRoute()).toBe(true);
    history.pushState({}, "", "/demo/");
    expect(isDemoRoute()).toBe(true);
    history.pushState({}, "", "/foo/demo/");
    expect(isDemoRoute()).toBe(true);
  });

  it("does not match a path that merely contains 'demo'", () => {
    history.pushState({}, "", "/foodemo");
    expect(isDemoRoute()).toBe(false);
  });
});

describe("parseMap", () => {
  it("returns null for text that isn't JSON", () => {
    expect(parseMap("not json")).toBeNull();
  });

  it("returns null for a shape that doesn't validate", () => {
    expect(parseMap(JSON.stringify({ schemaVersion: 2 }))).toBeNull();
    expect(
      parseMap(JSON.stringify(makeState({ parts: [{ id: "x" }] as unknown as Part[] }))),
    ).toBeNull();
  });

  it("accepts a valid current-schema state", () => {
    const state = makeState();
    expect(parseMap(JSON.stringify(state))).toEqual(state);
  });

  it("drops a connection whose endpoint doesn't resolve", () => {
    const state = makeState({
      connections: [makeConnection({ targetId: "ghost" })],
    });
    expect(parseMap(JSON.stringify(state))?.connections).toEqual([]);
  });

  it("drops a self-loop connection", () => {
    const state = makeState({
      connections: [makeConnection({ sourceId: "part-1", targetId: "part-1" })],
    });
    expect(parseMap(JSON.stringify(state))?.connections).toEqual([]);
  });

  it("keeps both directions of a reciprocal pair", () => {
    const state = makeState({
      parts: [makePart({ id: "a" }), makePart({ id: "b" })],
      connections: [
        makeConnection({ id: "c1", sourceId: "a", targetId: "b" }),
        makeConnection({ id: "c2", sourceId: "b", targetId: "a" }),
      ],
    });
    expect(parseMap(JSON.stringify(state))?.connections).toHaveLength(2);
  });

  it("drops an exact repeat of the same directed edge, keeping the first", () => {
    const state = makeState({
      parts: [makePart({ id: "a" }), makePart({ id: "b" })],
      connections: [
        makeConnection({ id: "c1", sourceId: "a", targetId: "b", label: "first" }),
        makeConnection({ id: "c2", sourceId: "a", targetId: "b", label: "second" }),
      ],
    });
    const result = parseMap(JSON.stringify(state));
    expect(result?.connections).toHaveLength(1);
    expect(result?.connections[0].label).toBe("first");
  });

  it("lowercases and dedupes feelings", () => {
    const state = makeState({
      parts: [makePart({ feelings: ["Anxious", "anxious", "Sad"] })],
    });
    expect(parseMap(JSON.stringify(state))?.parts[0].feelings).toEqual([
      "anxious",
      "sad",
    ]);
  });

  it("migrates a schema-1 part whose status was 'active'", () => {
    const legacyPart = { ...makePart({ status: "Active " }) };
    const legacyPartWithoutActive = { ...legacyPart } as Record<string, unknown>;
    delete legacyPartWithoutActive.active;

    const legacyState = {
      schemaVersion: 1,
      parts: [legacyPartWithoutActive],
      connections: [],
    };

    const result = parseMap(JSON.stringify(legacyState));
    expect(result?.schemaVersion).toBe(2);
    expect(result?.parts[0].status).toBe("");
    expect(result?.parts[0].active).toBe(true);
  });

  it("carries over a non-'active' schema-1 status untouched", () => {
    const legacyPart = { ...makePart({ status: "grieving" }) } as Record<
      string,
      unknown
    >;
    delete legacyPart.active;

    const legacyState = {
      schemaVersion: 1,
      parts: [legacyPart],
      connections: [],
    };

    const result = parseMap(JSON.stringify(legacyState));
    expect(result?.parts[0].status).toBe("grieving");
    expect(result?.parts[0].active).toBe(false);
  });
});

describe("loadState / saveState", () => {
  it("returns null when nothing is stored", () => {
    expect(loadState()).toBeNull();
  });

  it("round-trips a state through save and load", () => {
    const state = makeState();
    saveState(state);
    expect(loadState()).toEqual(state);
  });

  it("returns null for unparseable stored JSON", () => {
    localStorage.setItem("cairn.map.v1", "{not json");
    expect(loadState()).toBeNull();
  });

  it("never reads or writes the real key on the demo route", () => {
    saveState(makeState());
    history.pushState({}, "", "/demo/");
    expect(loadState()).toBeNull();

    localStorage.clear();
    history.pushState({}, "", "/demo/");
    saveState(makeState());
    expect(localStorage.getItem("cairn.map.v1")).toBeNull();
  });
});

describe("saveStateDebounced", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces a burst of writes into the last one", () => {
    saveStateDebounced(makeState({ ownerName: "first" }));
    saveStateDebounced(makeState({ ownerName: "second" }));
    vi.advanceTimersByTime(400);

    expect(loadState()?.ownerName).toBe("second");
  });
});
