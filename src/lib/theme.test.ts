import { describe, expect, it } from "vitest";
import { isLowDefinition } from "./theme";

describe("isLowDefinition", () => {
  it("matches the low-definition statuses case-insensitively", () => {
    expect(isLowDefinition("emerging")).toBe(true);
    expect(isLowDefinition("Emerging")).toBe(true);
    expect(isLowDefinition("UNWITNESSED")).toBe(true);
    expect(isLowDefinition("  unwitnessed  ")).toBe(true);
  });

  it("doesn't match a well-defined or empty status", () => {
    expect(isLowDefinition("witnessed")).toBe(false);
    expect(isLowDefinition("")).toBe(false);
    expect(isLowDefinition("active")).toBe(false);
  });
});
