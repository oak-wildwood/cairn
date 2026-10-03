// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { computeLayout } from "./layout";
import { store } from "./store.svelte";
import { SELF_ID } from "./types";
import { makePart } from "./testParts";

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

describe("updatePart", () => {
  it("replaces the part's fields but keeps its id, leaving the others alone", () => {
    const other = makePart({ id: "b", name: "The Analyst" });
    store.parts = [makePart({ id: "a", name: "The Fixer" }), other];
    store.startEditing("a");
    store.showingExample = true;

    // A draft carrying a stray id must not be able to change the part's own.
    const { id: _ignored, ...draft } = makePart({ name: "The Avoider", role: "exile" });
    store.updatePart("a", { ...draft, id: "smuggled" } as typeof draft);

    expect(store.parts).toEqual([
      makePart({ id: "a", name: "The Avoider", role: "exile" }),
      other,
    ]);
    expect(store.editing).toBeNull();
    expect(store.showingExample).toBe(false);
  });
});

describe("movePart", () => {
  it("writes an override on the moved part only, leaving the others null rather than 0", () => {
    store.parts = [makePart({ id: "a" }), makePart({ id: "b" })];
    store.showingExample = true;

    store.movePart("a", { x: 12, y: -34 });

    expect(store.parts[0]).toMatchObject({ id: "a", x: 12, y: -34 });
    expect(store.parts[1].x).toBeNull();
    expect(store.parts[1].y).toBeNull();
    expect(store.showingExample).toBe(false);
  });

  it("keeps the moved part's slot, so its siblings don't reshuffle", () => {
    store.parts = [
      makePart({ id: "a", role: "manager" }),
      makePart({ id: "b", role: "manager" }),
      makePart({ id: "c", role: "manager" }),
    ];
    const before = computeLayout(store.parts);

    store.movePart("a", { x: 400, y: 400 });
    const after = computeLayout(store.parts);

    expect(after.get("a")).toEqual({ x: 400, y: 400 });
    expect(after.get("b")).toEqual(before.get("b"));
    expect(after.get("c")).toEqual(before.get("c"));
  });
});

describe("setFeelings", () => {
  it("replaces the feelings of the targeted part only", () => {
    store.parts = [
      makePart({ id: "a", feelings: ["tired"] }),
      makePart({ id: "b", feelings: ["tired"] }),
    ];
    store.showingExample = true;

    store.setFeelings("a", ["anxious", "proud"]);

    expect(store.parts[0].feelings).toEqual(["anxious", "proud"]);
    expect(store.parts[1].feelings).toEqual(["tired"]);
    expect(store.showingExample).toBe(false);
  });
});

describe("replaceAll", () => {
  it("swaps in the whole map and drops every selection, edit and filter", () => {
    store.parts = [makePart({ id: "old" })];
    store.select("old");
    store.startEditing("old");
    store.setFilter("exile");
    store.toggleActiveOnlyFilter();
    store.setTagFilter(["shame"]);
    store.showingExample = true;

    const parts = [makePart({ id: "a" }), makePart({ id: "b" })];
    const connections = [{ id: "c1", sourceId: "a", targetId: "b", label: "protects" }];
    store.replaceAll(parts, connections, "Demo User");

    expect(store.parts).toEqual(parts);
    expect(store.connections).toEqual(connections);
    expect(store.ownerName).toBe("Demo User");
    expect(store.selectedPartId).toBeNull();
    expect(store.selectedConnectionId).toBeNull();
    expect(store.editing).toBeNull();
    expect(store.activeFilter).toBeNull();
    expect(store.activeOnlyFilter).toBe(false);
    expect(store.tagFilter).toEqual([]);
    expect(store.showingExample).toBe(false);
  });
});

describe("deleteConnection", () => {
  it("removes only that connection, and clears its selection", () => {
    store.connections = [
      { id: "c1", sourceId: "a", targetId: "b", label: "protects" },
      { id: "c2", sourceId: "b", targetId: "a", label: "triggers" },
    ];
    store.selectConnection("c1");
    store.showingExample = true;

    store.deleteConnection("c1");

    expect(store.connections.map((connection) => connection.id)).toEqual(["c2"]);
    expect(store.selectedConnectionId).toBeNull();
    expect(store.showingExample).toBe(false);
  });

  it("leaves a different connection's selection alone", () => {
    store.connections = [
      { id: "c1", sourceId: "a", targetId: "b", label: "" },
      { id: "c2", sourceId: "b", targetId: "a", label: "" },
    ];
    store.selectConnection("c2");

    store.deleteConnection("c1");

    expect(store.selectedConnectionId).toBe("c2");
  });
});

describe("setConnectionLabel", () => {
  it("trims and writes the label on the targeted connection only", () => {
    store.connections = [
      { id: "c1", sourceId: "a", targetId: "b", label: "" },
      { id: "c2", sourceId: "b", targetId: "a", label: "triggers" },
    ];
    store.showingExample = true;

    store.setConnectionLabel("c1", "  protects  ");

    expect(store.connections).toEqual([
      { id: "c1", sourceId: "a", targetId: "b", label: "protects" },
      { id: "c2", sourceId: "b", targetId: "a", label: "triggers" },
    ]);
    expect(store.showingExample).toBe(false);
  });
});
