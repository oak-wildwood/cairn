import { describe, expect, it } from "vitest";
import { isLowDefinition } from "./theme";

describe("isLowDefinition", () => {
  it("matches the low-definition statuses", () => {
    expect(isLowDefinition("emerging")).toBe(true);
    expect(isLowDefinition("unwitnessed")).toBe(true);
  });

  it("matches case-insensitively, since status is free text", () => {
    expect(isLowDefinition("Emerging")).toBe(true);
    expect(isLowDefinition("UNWITNESSED")).toBe(true);
  });

  it("trims surrounding whitespace before comparing", () => {
    expect(isLowDefinition("  emerging  ")).toBe(true);
  });

  it("doesn't match an unrelated or empty status", () => {
    expect(isLowDefinition("witnessed")).toBe(false);
    expect(isLowDefinition("")).toBe(false);
  });
});
