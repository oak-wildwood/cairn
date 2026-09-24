import { describe, expect, it } from "vitest";
import { isLowDefinition } from "./theme";

describe("isLowDefinition", () => {
  it("matches the known low-definition statuses", () => {
    expect(isLowDefinition("emerging")).toBe(true);
    expect(isLowDefinition("unwitnessed")).toBe(true);
  });

  it("matches case-insensitively and trims whitespace", () => {
    expect(isLowDefinition("Emerging")).toBe(true);
    expect(isLowDefinition("  UNWITNESSED  ")).toBe(true);
  });

  it("is false for other statuses, including blank and 'active'", () => {
    expect(isLowDefinition("witnessed")).toBe(false);
    expect(isLowDefinition("")).toBe(false);
    expect(isLowDefinition("active")).toBe(false);
  });
});
