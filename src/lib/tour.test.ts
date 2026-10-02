// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasSeenTour, markTourSeen } from "./tour";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hasSeenTour", () => {
  it("is false for a first-time visitor", () => {
    expect(hasSeenTour()).toBe(false);
  });

  it("counts as seen when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(hasSeenTour()).toBe(true);
  });
});

describe("markTourSeen", () => {
  it("doesn't throw when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota full");
    });
    expect(() => markTourSeen()).not.toThrow();
  });

  it("round-trips with hasSeenTour", () => {
    markTourSeen();
    expect(hasSeenTour()).toBe(true);
  });
});
