// @vitest-environment jsdom
import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { autosaveMap } from "./autosave.svelte";
import { loadState } from "./persistence";
import { store } from "./store.svelte";
import { makePart } from "./testParts";
import { SCHEMA_VERSION } from "./types";
import type { PersistedState } from "./types";

let teardown: (() => void) | undefined;

/** Register the effect inside a root and run it once, as mounting App would. */
function startAutosave(save?: (state: PersistedState) => void): void {
  teardown = $effect.root(() => autosaveMap(save));
  flushSync();
}

beforeEach(() => {
  store.startFresh("");
});

afterEach(() => {
  teardown?.();
  teardown = undefined;
  vi.useRealTimers();
  localStorage.clear();
});

describe("autosaveMap", () => {
  it("saves the map as plain data, and again after every change", () => {
    store.ownerName = "Demo User";
    store.parts = [makePart({ id: "a" })];
    const save = vi.fn<(state: PersistedState) => void>();

    startAutosave(save);

    expect(save).toHaveBeenCalledTimes(1);
    const first = save.mock.calls[0][0];
    expect(first).toEqual({
      schemaVersion: SCHEMA_VERSION,
      parts: [makePart({ id: "a" })],
      connections: [],
      ownerName: "Demo User",
    });
    // A reactive proxy can't be structured-cloned; a snapshot can.
    expect(() => structuredClone(first)).not.toThrow();

    store.addConnection("a", "self");
    flushSync();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.lastCall?.[0].connections).toHaveLength(1);
  });

  it("re-saves on an edit deep inside a part, not only on reassignment", () => {
    store.parts = [makePart({ id: "a", name: "The Fixer" })];
    const save = vi.fn<(state: PersistedState) => void>();
    startAutosave(save);

    store.parts[0].name = "The Analyst";
    flushSync();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.lastCall?.[0].parts[0].name).toBe("The Analyst");
  });

  it("declines to persist while the untouched sample is showing", () => {
    store.showingExample = true;
    const save = vi.fn<(state: PersistedState) => void>();
    startAutosave(save);

    // Assigning directly leaves `showingExample` alone, unlike the store's
    // own mutations, so this is a change to the sample that must not save.
    store.parts = [makePart({ id: "a" })];
    flushSync();
    expect(save).not.toHaveBeenCalled();

    // The moment it stops being the sample, it is the user's and is saved.
    store.showingExample = false;
    flushSync();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.lastCall?.[0].parts).toEqual([makePart({ id: "a" })]);
  });

  it("writes to localStorage once the debounce settles, by default", () => {
    vi.useFakeTimers();
    store.parts = [makePart({ id: "a" })];
    startAutosave();

    expect(loadState()).toBeNull();
    vi.runAllTimers();
    expect(loadState()?.parts).toEqual([makePart({ id: "a" })]);
  });
});
