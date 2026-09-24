import { describe, expect, it } from "vitest";
import { feelingCounts } from "./feelings";
import { makePart } from "./testParts";

describe("feelingCounts", () => {
  it("returns an empty map for no parts", () => {
    expect(feelingCounts([])).toEqual(new Map());
  });

  it("counts how many parts carry each feeling", () => {
    const parts = [
      makePart({ id: "a", feelings: ["anxious", "sad"] }),
      makePart({ id: "b", feelings: ["anxious"] }),
      makePart({ id: "c", feelings: [] }),
    ];
    expect(feelingCounts(parts)).toEqual(
      new Map([
        ["anxious", 2],
        ["sad", 1],
      ]),
    );
  });
});
