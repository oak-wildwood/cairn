import { describe, expect, it } from "vitest";
import { feelingCounts } from "./feelings";
import { makePart } from "./testFixtures";

describe("feelingCounts", () => {
  it("is empty when no part carries any feelings", () => {
    expect(feelingCounts([makePart({ feelings: [] })]).size).toBe(0);
  });

  it("counts how many parts carry each feeling", () => {
    const parts = [
      makePart({ id: "p1", feelings: ["sad", "angry"] }),
      makePart({ id: "p2", feelings: ["sad"] }),
    ];
    const counts = feelingCounts(parts);
    expect(counts.get("sad")).toBe(2);
    expect(counts.get("angry")).toBe(1);
  });

  it("treats differently-cased tags as distinct, since it trusts its input", () => {
    const parts = [
      makePart({ id: "p1", feelings: ["Sad"] }),
      makePart({ id: "p2", feelings: ["sad"] }),
    ];
    const counts = feelingCounts(parts);
    expect(counts.get("Sad")).toBe(1);
    expect(counts.get("sad")).toBe(1);
  });
});
