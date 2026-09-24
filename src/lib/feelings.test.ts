import { describe, expect, it } from "vitest";
import { feelingCounts } from "./feelings";
import type { Part } from "./types";

function makePart(feelings: string[]): Part {
  return {
    id: crypto.randomUUID(),
    name: "A Part",
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
  it("is empty for no parts", () => {
    expect(feelingCounts([])).toEqual(new Map());
  });

  it("counts a tag once per part that carries it", () => {
    const parts = [
      makePart(["sad", "tired"]),
      makePart(["sad"]),
      makePart(["angry"]),
    ];
    expect(feelingCounts(parts)).toEqual(
      new Map([
        ["sad", 2],
        ["tired", 1],
        ["angry", 1],
      ]),
    );
  });

  it("counts a repeated tag on the same part multiple times", () => {
    // feelingCounts flattens whatever is on the part; deduping a part's own
    // list is a different concern (persistence.ts's normalization).
    expect(feelingCounts([makePart(["sad", "sad"])])).toEqual(
      new Map([["sad", 2]]),
    );
  });
});
