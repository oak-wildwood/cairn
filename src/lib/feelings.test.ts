import { describe, expect, it } from "vitest";
import {
  assignFeelingsToGroup,
  expandFeelings,
  feelingCounts,
  normalizeFeeling,
  normalizeFeelingGroups,
} from "./feelings";
import { makePart } from "./testParts";
import type { FeelingGroup } from "./types";

describe("feelingCounts", () => {
  it("returns an empty map for no parts", () => {
    expect(feelingCounts([])).toEqual(new Map());
  });

  it("tallies how many parts carry each feeling", () => {
    const parts = [
      makePart({ id: "a", feelings: ["sad", "tired"] }),
      makePart({ id: "b", feelings: ["sad"] }),
      makePart({ id: "c", feelings: [] }),
    ];
    expect(feelingCounts(parts)).toEqual(
      new Map([
        ["sad", 2],
        ["tired", 1],
      ]),
    );
  });
});

function group(id: string, feelings: string[], name = ""): FeelingGroup {
  return { id, name, feelings };
}

describe("normalizeFeeling", () => {
  it("trims and lowercases", () => {
    expect(normalizeFeeling("  Scared ")).toBe("scared");
  });
});

describe("normalizeFeelingGroups", () => {
  it("normalizes members, drops blanks and collapses repeats within a group", () => {
    expect(
      normalizeFeelingGroups([group("g1", [" Scared", "scared", "  ", "AFRAID"])]),
    ).toEqual([group("g1", ["scared", "afraid"])]);
  });

  it("trims the name", () => {
    expect(normalizeFeelingGroups([group("g1", [], "  fear ")])).toEqual([
      group("g1", [], "fear"),
    ]);
  });

  // The partition rule: "the same feeling as" has to be transitive, so a
  // feeling in two groups would silently join them.
  it("keeps a feeling only in the first group that claims it", () => {
    expect(
      normalizeFeelingGroups([
        group("g1", ["scared", "afraid"]),
        group("g2", ["Afraid", "worried"]),
      ]),
    ).toEqual([group("g1", ["scared", "afraid"]), group("g2", ["worried"])]);
  });

  it("drops a later group repeating an earlier group's id", () => {
    expect(
      normalizeFeelingGroups([group("g1", ["scared"]), group("g1", ["sad"])]),
    ).toEqual([group("g1", ["scared"])]);
  });

  it("keeps an empty, unnamed group, as a just-created one is", () => {
    expect(normalizeFeelingGroups([group("g1", [])])).toEqual([group("g1", [])]);
  });
});

describe("assignFeelingsToGroup", () => {
  const groups = [
    group("g1", ["scared", "afraid"], "fear"),
    group("g2", ["sad", "low"], "sadness"),
  ];

  it("sets the target group's feelings, normalized, and leaves its name", () => {
    expect(assignFeelingsToGroup(groups, "g1", ["scared", "Fear"])).toEqual([
      group("g1", ["scared", "fear"], "fear"),
      group("g2", ["sad", "low"], "sadness"),
    ]);
  });

  it("moves a feeling out of the group that held it, keeping group order", () => {
    expect(assignFeelingsToGroup(groups, "g2", ["sad", "low", "afraid"])).toEqual([
      group("g1", ["scared"], "fear"),
      group("g2", ["sad", "low", "afraid"], "sadness"),
    ]);
  });

  it("changes nothing for an id no group has", () => {
    expect(assignFeelingsToGroup(groups, "ghost", ["sad"])).toEqual(groups);
  });
});

describe("expandFeelings", () => {
  const groups = [
    group("g1", ["scared", "afraid", "fear"]),
    group("g2", ["sad", "low"]),
  ];

  it("returns the feelings unchanged when there are no groups", () => {
    expect(expandFeelings(["scared", "tired"], [])).toEqual(["scared", "tired"]);
  });

  it("adds every other member of each feeling's group, without repeats", () => {
    expect(expandFeelings(["afraid", "fear", "tired"], groups)).toEqual([
      "afraid",
      "scared",
      "fear",
      "tired",
    ]);
  });

  it("does not reach into a group none of the feelings belong to", () => {
    expect(expandFeelings(["low"], groups)).toEqual(["low", "sad"]);
  });

  it("returns nothing for nothing", () => {
    expect(expandFeelings([], groups)).toEqual([]);
  });
});
