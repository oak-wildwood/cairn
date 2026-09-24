import { describe, expect, it } from "vitest";
import { isLowDefinition } from "./theme";

describe("isLowDefinition", () => {
  it("matches the low-definition statuses", () => {
    expect(isLowDefinition("emerging")).toBe(true);
    expect(isLowDefinition("unwitnessed")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(isLowDefinition("Emerging")).toBe(true);
    expect(isLowDefinition("UNWITNESSED")).toBe(true);
  });

  it("trims surrounding whitespace before comparing", () => {
    expect(isLowDefinition("  emerging  ")).toBe(true);
  });

  it("is false for any other status, including empty", () => {
    expect(isLowDefinition("witnessed")).toBe(false);
    expect(isLowDefinition("")).toBe(false);
    expect(isLowDefinition("active")).toBe(false);
  });
});
