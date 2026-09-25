import { beforeEach, describe, expect, it } from "vitest";
import { store } from "./store.svelte";
import { SELF_ID } from "./types";
import { makePart } from "./testSupport";

/**
 * `store` is a module-level singleton (see store.svelte.ts), so every test
 * resets it through `startFresh` rather than re-importing the module.
 */
beforeEach(() => {
  store.startFresh("");
});

describe("deletePart", () => {
  it("removes the part and every connection naming it, at either end", () => {
    store.parts = [makePart({ id: "a" }), makePart({ id: "b" }), makePart({ id: "c" })];
    store.connections = [
      { id: "c1", sourceId: "a", targetId: "b", label: "protects" },
      { id: "c2", sourceId: "c", targetId: "a", label: "triggers" },
      { id: "c3", sourceId: "b", targetId: "c", label: "polarized with" },
    ];

    store.deletePart("a");

    expect(store.parts.map((part) => part.id)).toEqual(["b", "c"]);
    expect(store.connections.map((connection) => connection.id)).toEqual(["c3"]);
  });

  it("clears the selection when the deleted part was selected", () => {
    store.parts = [makePart({ id: "a" })];
    store.select("a");
    store.deletePart("a");
    expect(store.selectedPartId).toBeNull();
  });
});

describe("addConnection / hasConnection", () => {
  it("allows a reverse edge but refuses to repeat the same direction", () => {
    store.parts = [makePart({ id: "a" }), makePart({ id: "b" })];

    store.addConnection("a", "b");
    expect(store.hasConnection("a", "b")).toBe(true);
    expect(store.hasConnection("b", "a")).toBe(false);

    // Same direction again: refused.
    store.addConnection("a", "b");
    expect(store.connections).toHaveLength(1);

    // Reverse direction: a distinct relation, so it's allowed.
    store.addConnection("b", "a");
    expect(store.connections).toHaveLength(2);
    expect(store.hasConnection("b", "a")).toBe(true);
  });

  it("refuses a connection from a part to itself", () => {
    store.parts = [makePart({ id: "a" })];
    store.addConnection("a", "a");
    expect(store.connections).toHaveLength(0);
  });

  it("allows Self as either endpoint", () => {
    store.parts = [makePart({ id: "a" })];
    store.addConnection("a", SELF_ID);
    expect(store.hasConnection("a", SELF_ID)).toBe(true);
  });
});

describe("visiblePartIds", () => {
  it("combines the role, active-only and tag filters", () => {
    store.parts = [
      makePart({ id: "a", role: "manager", active: true, feelings: ["shame"] }),
      makePart({ id: "b", role: "manager", active: false, feelings: ["shame"] }),
      makePart({ id: "c", role: "exile", active: true, feelings: ["shame"] }),
    ];

    store.setFilter("manager");
    store.toggleActiveOnlyFilter();
    store.setTagFilter(["shame"]);

    expect(store.visiblePartIds).toEqual(["a"]);
  });
});

describe("toggleActive", () => {
  it("flips only the targeted part", () => {
    store.parts = [
      makePart({ id: "a", active: false }),
      makePart({ id: "b", active: false }),
    ];
    store.toggleActive("a");
    expect(store.parts.find((part) => part.id === "a")?.active).toBe(true);
    expect(store.parts.find((part) => part.id === "b")?.active).toBe(false);
  });
});

describe("startFresh", () => {
  it("empties the map and clears every filter and selection", () => {
    store.parts = [makePart({ id: "a" })];
    store.connections = [{ id: "c1", sourceId: "a", targetId: SELF_ID, label: "" }];
    store.select("a");
    store.setFilter("manager");
    store.toggleActiveOnlyFilter();
    store.setTagFilter(["shame"]);

    store.startFresh("Someone");

    expect(store.parts).toEqual([]);
    expect(store.connections).toEqual([]);
    expect(store.selectedPartId).toBeNull();
    expect(store.activeFilter).toBeNull();
    expect(store.activeOnlyFilter).toBe(false);
    expect(store.tagFilter).toEqual([]);
    expect(store.ownerName).toBe("Someone");
    expect(store.showingExample).toBe(false);
  });
});
