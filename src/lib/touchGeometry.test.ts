import { describe, expect, it } from "vitest";
import { clampPopoverLeft, overlapsVertically, pinchView } from "./touchGeometry";
import type { PinchStart } from "./touchGeometry";

const LIMITS = { min: 0.5, max: 2.5 };

/**
 * A start state with nothing at an identity value, so a mutant that drops
 * any one term (or swaps one for another) moves the result.
 */
const START: PinchStart = {
  anchor: { x: -120, y: 80 },
  distance: 100,
  zoom: 1.2,
  scale: 0.6,
  viewCenter: { x: 10, y: -20 },
  elementCenter: { x: 200, y: 300 },
};

/**
 * Where diagram point `point` is drawn on screen for a given zoom and pan,
 * by the same rule the `<svg>` follows: the view's centre (`viewCenter +
 * pan`) is drawn at the element's centre, at `scale` pixels per unit.
 * Independent of `pinchView`, so it checks the answer rather than restating
 * the formula.
 */
function toClient(
  point: { x: number; y: number },
  zoom: number,
  pan: { x: number; y: number },
): { x: number; y: number } {
  const scale = (START.scale * zoom) / START.zoom;
  return {
    x: START.elementCenter.x + (point.x - (START.viewCenter.x + pan.x)) * scale,
    y: START.elementCenter.y + (point.y - (START.viewCenter.y + pan.y)) * scale,
  };
}

describe("pinchView", () => {
  it("scales the zoom by how far the fingers have spread", () => {
    expect(pinchView(START, { x: 0, y: 0 }, 150, LIMITS).zoom).toBeCloseTo(1.8);
    expect(pinchView(START, { x: 0, y: 0 }, 50, LIMITS).zoom).toBeCloseTo(0.6);
  });

  it("leaves the zoom alone while the spread is unchanged", () => {
    expect(pinchView(START, { x: 0, y: 0 }, 100, LIMITS).zoom).toBeCloseTo(1.2);
  });

  it("clamps the zoom to the limits at both ends", () => {
    expect(pinchView(START, { x: 0, y: 0 }, 1000, LIMITS).zoom).toBe(2.5);
    expect(pinchView(START, { x: 0, y: 0 }, 1, LIMITS).zoom).toBe(0.5);
  });

  it("keeps the anchor under the fingers' midpoint as they move and spread", () => {
    const midpoint = { x: 260, y: 220 };
    const { zoom, pan } = pinchView(START, midpoint, 170, LIMITS);
    const drawnAt = toClient(START.anchor, zoom, pan);
    expect(drawnAt.x).toBeCloseTo(midpoint.x);
    expect(drawnAt.y).toBeCloseTo(midpoint.y);
  });

  it("keeps the anchor under the midpoint even once the zoom is clamped", () => {
    const midpoint = { x: 140, y: 390 };
    const { zoom, pan } = pinchView(START, midpoint, 5, LIMITS);
    expect(zoom).toBe(0.5);
    const drawnAt = toClient(START.anchor, zoom, pan);
    expect(drawnAt.x).toBeCloseTo(midpoint.x);
    expect(drawnAt.y).toBeCloseTo(midpoint.y);
  });

  it("pans by exactly the drag when the fingers move without spreading", () => {
    // Start: the anchor sits under (cx, cy). Moving both fingers 30px right
    // and 60px down at an unchanged spread is a plain drag.
    const startClient = toClient(START.anchor, START.zoom, { x: 0, y: 0 });
    const still = pinchView(START, startClient, 100, LIMITS).pan;
    const moved = pinchView(
      START,
      { x: startClient.x + 30, y: startClient.y + 60 },
      100,
      LIMITS,
    ).pan;
    // At 0.6px per unit, 30px and 60px are 50 and 100 units; dragging the
    // map right and down moves the view's centre left and up.
    expect(moved.x - still.x).toBeCloseTo(-50);
    expect(moved.y - still.y).toBeCloseTo(-100);
  });

  it("returns zero pan when the anchor is the view centre under the element centre", () => {
    const centred: PinchStart = {
      ...START,
      anchor: { ...START.viewCenter },
    };
    const { pan } = pinchView(centred, START.elementCenter, 180, LIMITS);
    expect(pan.x).toBeCloseTo(0);
    expect(pan.y).toBeCloseTo(0);
  });
});

describe("clampPopoverLeft", () => {
  it("keeps the preferred left edge when the popover fits there", () => {
    expect(clampPopoverLeft(40, 290, 1280, 8)).toBe(40);
  });

  it("slides a popover left just far enough to clear the right edge", () => {
    // 390 - 8 - 290 = 92: its right edge lands exactly `margin` inside.
    expect(clampPopoverLeft(200, 290, 390, 8)).toBe(92);
  });

  it("keeps the popover off the left edge too", () => {
    expect(clampPopoverLeft(2, 290, 1280, 8)).toBe(8);
  });

  it("allows a left edge exactly at either limit", () => {
    expect(clampPopoverLeft(8, 290, 1280, 8)).toBe(8);
    expect(clampPopoverLeft(92, 290, 390, 8)).toBe(92);
  });

  it("pins the left edge when the viewport is narrower than the popover", () => {
    expect(clampPopoverLeft(100, 290, 250, 8)).toBe(8);
  });
});

describe("overlapsVertically", () => {
  it("is true when the trigger is inside the visible span", () => {
    expect(overlapsVertically(100, 140, 50, 500)).toBe(true);
  });

  it("is true when the trigger is only partly in view", () => {
    expect(overlapsVertically(30, 70, 50, 500)).toBe(true);
    expect(overlapsVertically(480, 520, 50, 500)).toBe(true);
  });

  it("is false once the trigger is fully above or below the span", () => {
    expect(overlapsVertically(10, 50, 50, 500)).toBe(false);
    expect(overlapsVertically(500, 540, 50, 500)).toBe(false);
  });
});
