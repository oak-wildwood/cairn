// @vitest-environment jsdom
import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { store } from "./store.svelte";
import { makePart } from "./testParts";
import { hasSeenTour, TOUR_STEPS } from "./tour";
import { TourState } from "./tourState.svelte";

const FIRST_PANEL_STEP = TOUR_STEPS.findIndex((step) => step.requiresPart);
const LAST_PANEL_STEP = TOUR_STEPS.findLastIndex((step) => step.requiresPart);

let tour: TourState;
let teardown: (() => void) | undefined;

/** A tour with its step-driving effect running, as App mounts it. */
function startTracking(): void {
  tour = new TourState();
  teardown = $effect.root(() => tour.trackSelection());
  flushSync();
}

/** Step forward to `index`, flushing the effect at every step on the way. */
function stepTo(index: number): void {
  while (tour.stepIndex < index) {
    tour.next();
    flushSync();
  }
}

beforeEach(() => {
  store.startFresh("");
  store.parts = [makePart({ id: "first" }), makePart({ id: "mine" })];
});

afterEach(() => {
  teardown?.();
  teardown = undefined;
  localStorage.clear();
});

describe("the step list this suite relies on", () => {
  it("opens with a step that doesn't need a part, then a run that does", () => {
    expect(TOUR_STEPS[0].requiresPart).toBeFalsy();
    expect(FIRST_PANEL_STEP).toBeGreaterThan(0);
    expect(LAST_PANEL_STEP).toBeLessThan(TOUR_STEPS.length - 1);
  });
});

describe("TourState.trackSelection", () => {
  it("does nothing while the tour isn't running", () => {
    startTracking();
    store.select("mine");
    flushSync();
    expect(store.selectedPartId).toBe("mine");
  });

  it("opens the first part for the panel steps and gives the user's selection back after", () => {
    store.select("mine");
    startTracking();
    tour.start();
    flushSync();
    expect(store.selectedPartId).toBe("mine");

    stepTo(FIRST_PANEL_STEP);
    expect(store.selectedPartId).toBe("first");

    stepTo(LAST_PANEL_STEP);
    expect(store.selectedPartId).toBe("first");

    stepTo(LAST_PANEL_STEP + 1);
    expect(store.selectedPartId).toBe("mine");
  });

  it("closes the panel again after the panel steps when nothing was open before", () => {
    startTracking();
    tour.start();
    stepTo(FIRST_PANEL_STEP);
    expect(store.selectedPartId).toBe("first");

    tour.back();
    flushSync();
    expect(store.selectedPartId).toBeNull();
  });

  it("puts the tour's part back if the user opens another one on a panel step", () => {
    startTracking();
    tour.start();
    stepTo(FIRST_PANEL_STEP);
    store.select("mine");
    flushSync();
    expect(store.selectedPartId).toBe("first");
  });

  it("puts the user's selection back if they open a part on a non-panel step", () => {
    startTracking();
    tour.start();
    flushSync();
    store.select("mine");
    flushSync();
    expect(store.selectedPartId).toBeNull();
  });

  it("leaves the selection alone on a panel step when the map has no parts", () => {
    store.parts = [];
    startTracking();
    tour.start();
    stepTo(FIRST_PANEL_STEP);
    expect(store.selectedPartId).toBeNull();
  });
});

describe("TourState navigation", () => {
  it("won't step back past the first step", () => {
    startTracking();
    tour.start();
    tour.back();
    expect(tour.stepIndex).toBe(0);
    expect(tour.active).toBe(true);
  });

  it("ends on the step after the last, restoring the selection and remembering it was seen", () => {
    store.select("mine");
    startTracking();
    tour.start();
    stepTo(TOUR_STEPS.length - 1);
    expect(tour.active).toBe(true);
    expect(hasSeenTour()).toBe(false);

    tour.next();
    flushSync();
    expect(tour.active).toBe(false);
    expect(hasSeenTour()).toBe(true);
    expect(store.selectedPartId).toBe("mine");
  });

  it("restores the user's selection when skipped from a panel step", () => {
    store.select("mine");
    startTracking();
    tour.start();
    stepTo(FIRST_PANEL_STEP);

    tour.end();
    flushSync();
    expect(store.selectedPartId).toBe("mine");
    expect(hasSeenTour()).toBe(true);
  });
});
