// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasSeenTour, markTourSeen, MOBILE_TOUR_STEPS, TOUR_STEPS, tourSteps } from "./tour";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tourSteps", () => {
  it("is the desktop tour on a computer and the phone tour on a phone", () => {
    expect(tourSteps(false)).toBe(TOUR_STEPS);
    expect(tourSteps(true)).toBe(MOBILE_TOUR_STEPS);
  });

  // The phone has no export buttons (see Toolbar's `hideExport`), so a step
  // spotlighting them would point at nothing and sit centred, unexplained.
  it("leaves the export step out of the phone tour but keeps it on desktop", () => {
    expect(TOUR_STEPS.some((step) => step.target === "export")).toBe(true);
    expect(MOBILE_TOUR_STEPS.some((step) => step.target === "export")).toBe(false);
  });

  it("gives every step in each tour a distinct id", () => {
    for (const steps of [TOUR_STEPS, MOBILE_TOUR_STEPS]) {
      expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);
    }
  });
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
