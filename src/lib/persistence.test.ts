// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadState, parseMap, saveState, saveStateDebounced } from "./persistence";
import { SCHEMA_VERSION, SELF_ID } from "./types";
import type { Connection, PersistedState } from "./types";
import { makePart } from "./testParts";

function validState(overrides: Partial<PersistedState> = {}): PersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    parts: [makePart({ id: "a" }), makePart({ id: "b" })],
    connections: [],
    ...overrides,
  };
}

/** A valid map with no parts, for tests that supply their own or need none. */
function emptyState(overrides: Partial<PersistedState> = {}): PersistedState {
  return validState({ parts: [], ...overrides });
}

/** A schema-1 part: every `Part` field except `active`. */
function makeLegacyPart(overrides: Record<string, unknown> = {}) {
  const { active: _active, ...rest } = makePart();
  return { ...rest, ...overrides };
}

// The URL is reset before every test, not at the end of the ones that change
// it, so a failing demo-route test can't strand the rest of the file on
// /demo/, where loadState and saveState silently do nothing.
beforeEach(() => {
  localStorage.clear();
  history.pushState({}, "", "/");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
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

  it("rejects a future schemaVersion", () => {
    const state = { ...emptyState(), schemaVersion: 3 as never };
    expect(parseMap(JSON.stringify(state))).toBeNull();
  });

  it("is idempotent: parsing its own output again changes nothing", () => {
    const raw = JSON.stringify(
      emptyState({
        parts: [makePart({ id: "a", feelings: ["Sad", "sad"] }), makePart({ id: "b" })],
        connections: [
          { id: "c1", sourceId: "a", targetId: "b", label: "protects" },
          { id: "c2", sourceId: "a", targetId: "b", label: "protects again" },
          { id: "c3", sourceId: "a", targetId: "ghost", label: "dangling" },
        ],
      }),
    );

    const once = parseMap(raw);
    // Without this, a parseMap that rejected the input would pass:
    // null stringifies to "null", which parses back to null.
    expect(once).not.toBeNull();
    expect(once?.parts[0].feelings).toEqual(["sad"]);
    expect(once?.connections.map((c) => c.id)).toEqual(["c1"]);

    const twice = parseMap(JSON.stringify(once));
    expect(twice).toEqual(once);
  });

  describe("field validation", () => {
    it("rejects a role outside the four", () => {
      const state = emptyState({
        parts: [makePart({ role: "protector" as never })],
      });
      expect(parseMap(JSON.stringify(state))).toBeNull();
    });

    it("rejects x as a string", () => {
      const state = emptyState({
        parts: [{ ...makePart(), x: "0" as never, y: 0 }],
      });
      expect(parseMap(JSON.stringify(state))).toBeNull();
    });

    it("accepts x as a number, including 0", () => {
      const state = emptyState({ parts: [makePart({ x: 0, y: 0 })] });
      const result = parseMap(JSON.stringify(state));
      expect(result?.parts[0].x).toBe(0);
      expect(result?.parts[0].y).toBe(0);
    });

    it("accepts x as null", () => {
      const state = emptyState({ parts: [makePart({ x: null, y: null })] });
      const result = parseMap(JSON.stringify(state));
      expect(result?.parts[0].x).toBeNull();
      expect(result?.parts[0].y).toBeNull();
    });

    it("rejects a non-string feeling", () => {
      const state = emptyState({
        parts: [{ ...makePart(), feelings: ["sad", 1] as never }],
      });
      expect(parseMap(JSON.stringify(state))).toBeNull();
    });

    it("rejects ownerName present but not a string", () => {
      const state = { ...emptyState(), ownerName: 42 as never };
      expect(parseMap(JSON.stringify(state))).toBeNull();
    });
  });

  describe("schema-1 migration", () => {
    it("recovers status \"active\" into the active flag", () => {
      const legacy = {
        schemaVersion: 1,
        parts: [makeLegacyPart({ id: "a", status: "Active" })],
        connections: [],
      };
      const result = parseMap(JSON.stringify(legacy));
      expect(result?.schemaVersion).toBe(SCHEMA_VERSION);
      expect(result?.parts[0]).toMatchObject({ status: "", active: true });
    });

    it('trims and ignores case, turning "  ACTIVE " into active:true, status:""', () => {
      const legacy = {
        schemaVersion: 1,
        parts: [makeLegacyPart({ status: "  ACTIVE " })],
        connections: [],
      };
      const result = parseMap(JSON.stringify(legacy));
      expect(result?.parts[0].active).toBe(true);
      expect(result?.parts[0].status).toBe("");
    });

    it("leaves any other status untouched and inactive", () => {
      const legacy = {
        schemaVersion: 1,
        parts: [makeLegacyPart({ id: "a", status: "witnessed" })],
        connections: [],
      };
      const result = parseMap(JSON.stringify(legacy));
      expect(result?.parts[0]).toMatchObject({ status: "witnessed", active: false });
    });

    it("keeps a custom status's trimmed text and leaves active false", () => {
      const legacy = {
        schemaVersion: 1,
        parts: [makeLegacyPart({ status: "  Contemplative  " })],
        connections: [],
      };
      const result = parseMap(JSON.stringify(legacy));
      expect(result?.parts[0].active).toBe(false);
      expect(result?.parts[0].status).toBe("Contemplative");
    });

    it("also normalizes feelings and cleans up connections on the migrated map", () => {
      const partA = makeLegacyPart({ id: "a", feelings: ["Sad", "sad"] });
      const partB = makeLegacyPart({ id: "b" });
      const connections: Connection[] = [
        { id: "c1", sourceId: "a", targetId: "b", label: "protects" },
        // Same direction twice - the second is dropped.
        { id: "c2", sourceId: "a", targetId: "b", label: "protects again" },
        // Dangling - "ghost" isn't a part.
        { id: "c3", sourceId: "a", targetId: "ghost", label: "dangling" },
      ];
      const legacy = { schemaVersion: 1, parts: [partA, partB], connections };
      const result = parseMap(JSON.stringify(legacy));

      expect(result?.parts[0].feelings).toEqual(["sad"]);
      expect(result?.connections).toEqual([
        { id: "c1", sourceId: "a", targetId: "b", label: "protects" },
      ]);
    });
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

  it("loadState returns null when getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadState()).toBeNull();
  });

  it("saveState doesn't throw when setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota full");
    });
    expect(() => saveState(emptyState())).not.toThrow();
  });
});

describe("saveStateDebounced", () => {
  // Real timers come back in the file-level afterEach.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("coalesces a burst of writes into one, after the delay", () => {
    saveStateDebounced(validState({ ownerName: "first" }));
    saveStateDebounced(validState({ ownerName: "second" }));
    expect(loadState()).toBeNull();

    vi.runAllTimers();

    expect(loadState()?.ownerName).toBe("second");
  });

  it("doesn't save on the demo route, even after the timer fires", () => {
    history.pushState({}, "", "/demo/");
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    saveStateDebounced(emptyState());
    vi.runAllTimers();

    expect(setItemSpy).not.toHaveBeenCalled();
  });
});
