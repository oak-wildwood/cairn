import { describe, expect, it } from "vitest";
import { feelingCounts } from "./feelings";
import { makePart } from "./testSupport";

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
