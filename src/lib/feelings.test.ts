import { describe, expect, it } from "vitest";
import { feelingCounts } from "./feelings";
import type { Part } from "./types";

function makePart(feelings: string[]): Part {
  return {
    id: crypto.randomUUID(),
    name: "Part",
    role: "manager",
    description: "",
    feelings,
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
  };
}

describe("feelingCounts", () => {
  it("returns an empty map for no parts", () => {
    expect(feelingCounts([])).toEqual(new Map());
  });

  it("counts how many parts carry each feeling", () => {
    const parts = [
      makePart(["anxious", "sad"]),
      makePart(["anxious"]),
      makePart([]),
    ];
    expect(feelingCounts(parts)).toEqual(
      new Map([
        ["anxious", 2],
        ["sad", 1],
      ]),
    );
  });

  it("counts a feeling repeated within one part's own list separately", () => {
    const parts = [makePart(["anxious", "anxious"])];
    expect(feelingCounts(parts).get("anxious")).toBe(2);
  });
});
