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

  it("reads a visit recorded by an earlier session", () => {
    window.localStorage.setItem("cairn.tour.v1.seen", "1");
    expect(hasSeenTour()).toBe(true);
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

  // A contract with browsers that have already dismissed the tour: renaming
  // the key would replay it for every returning visitor. Pinning the literal
  // is deliberate (see AGENTS.md, Testing).
  it("records the visit under the cairn.tour.v1.seen key", () => {
    markTourSeen();
    expect(window.localStorage.getItem("cairn.tour.v1.seen")).toBe("1");
  });

  it("round-trips with hasSeenTour", () => {
    markTourSeen();
    expect(hasSeenTour()).toBe(true);
  });
});
