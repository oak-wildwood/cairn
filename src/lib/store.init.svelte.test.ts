// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFixtureMap } from "./devFixtures";
import { EXAMPLE_CONNECTIONS, EXAMPLE_PARTS } from "./exampleData";
import { saveState } from "./persistence";
import { SCHEMA_VERSION } from "./types";
import type { PersistedState } from "./types";
import { makePart } from "./testParts";

/**
 * The store's initial state is decided once, at import: whatever
 * localStorage and `?parts=` say at that moment is all it ever reads. So
 * each test here sets both up first and then imports a fresh copy of the
 * module, rather than resetting the shared singleton the way
 * store.svelte.test.ts does — `startFresh` would overwrite exactly the
 * fields under test.
 */
async function freshStore() {
  vi.resetModules();
  const { store } = await import("./store.svelte");
  return store;
}

const STORED: PersistedState = {
  schemaVersion: SCHEMA_VERSION,
  parts: [makePart({ id: "a", name: "The Fixer" }), makePart({ id: "b" })],
  connections: [{ id: "c1", sourceId: "a", targetId: "b", label: "protects" }],
  ownerName: "Demo User",
  feelingGroups: [{ id: "g1", name: "fear", feelings: ["scared", "afraid"] }],
};

// Reset before every test, not only after, so a failure that strands the
// URL or storage can't leak into the next test's import.
beforeEach(() => {
  localStorage.clear();
  history.pushState({}, "", "/");
});

afterEach(() => {
  localStorage.clear();
  history.pushState({}, "", "/");
});

describe("initial state at import", () => {
  it("seeds the sample map, marked as the sample, when nothing is stored", async () => {
    const store = await freshStore();

    expect(store.parts).toEqual(EXAMPLE_PARTS);
    expect(store.connections).toEqual(EXAMPLE_CONNECTIONS);
    expect(store.showingExample).toBe(true);
    expect(store.ownerName).toBe("");
    expect(store.feelingGroups).toEqual([]);
  });

  it("restores a stored map as the user's own, with its owner and groups", async () => {
    saveState(STORED);

    const store = await freshStore();

    expect(store.parts).toEqual(STORED.parts);
    expect(store.connections).toEqual(STORED.connections);
    expect(store.showingExample).toBe(false);
    expect(store.ownerName).toBe("Demo User");
    expect(store.feelingGroups).toEqual(STORED.feelingGroups);
  });

  it("starts with no groups for a stored map saved before they existed", async () => {
    const { feelingGroups: _feelingGroups, ...withoutGroups } = STORED;
    saveState(withoutGroups);

    const store = await freshStore();

    expect(store.parts).toEqual(STORED.parts);
    expect(store.feelingGroups).toEqual([]);
  });

  it("leaves the owner empty for a stored map saved before it had one", async () => {
    const { ownerName: _ownerName, ...withoutOwner } = STORED;
    saveState(withoutOwner);

    const store = await freshStore();

    expect(store.parts).toEqual(STORED.parts);
    expect(store.ownerName).toBe("");
  });

  it("restores an emptied map as empty, not as the sample", async () => {
    saveState({ ...STORED, parts: [], connections: [] });

    const store = await freshStore();

    expect(store.parts).toEqual([]);
    expect(store.connections).toEqual([]);
    expect(store.showingExample).toBe(false);
  });

  it("shows a ?parts= fixture as a sample when nothing is stored", async () => {
    history.pushState({}, "", "/?parts=3");
    const fixture = makeFixtureMap(3);

    const store = await freshStore();

    expect(store.parts).toEqual(fixture.parts);
    expect(store.connections).toEqual(fixture.connections);
    expect(store.showingExample).toBe(true);
  });

  // The fixture wins on screen but must stay marked as the sample, so the
  // save effect declines to write it over the stored map.
  it("prefers a ?parts= fixture over a stored map, without claiming it as the user's", async () => {
    saveState(STORED);
    history.pushState({}, "", "/?parts=3");
    const fixture = makeFixtureMap(3);

    const store = await freshStore();

    expect(store.parts).toEqual(fixture.parts);
    expect(store.connections).toEqual(fixture.connections);
    expect(store.showingExample).toBe(true);
    // Nor its groups: they describe the stored map's feelings, not the fixture's.
    expect(store.feelingGroups).toEqual([]);
  });

  it("starts with no filter of any kind", async () => {
    const store = await freshStore();

    expect(store.activeFilter).toBeNull();
    expect(store.activeOnlyFilter).toBe(false);
    expect(store.tagFilter).toEqual([]);
    expect(store.hasActiveFilter).toBe(false);
  });
});
