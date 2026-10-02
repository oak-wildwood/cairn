import { describe, expect, it } from "vitest";
import {
  captureHeight,
  compositeLayout,
  EXPORT_SCALE,
  pdfPageSize,
  rasterSize,
} from "./exportGeometry";

describe("rasterSize", () => {
  it("renders at twice the diagram's size, rounded to whole pixels", () => {
    expect(EXPORT_SCALE).toBe(2);
    expect(rasterSize({ width: 900, height: 770 })).toEqual({ width: 1800, height: 1540 });
    expect(rasterSize({ width: 900.3, height: 770.26 })).toEqual({ width: 1801, height: 1541 });
  });
});

describe("compositeLayout", () => {
  it("puts the panel after the diagram and the gap, as tall as the taller of the two", () => {
    expect(
      compositeLayout({ width: 1800, height: 1540 }, { width: 832, height: 2000 }, 32),
    ).toEqual({ width: 2664, height: 2000, panelX: 1832 });
    expect(
      compositeLayout({ width: 1800, height: 1540 }, { width: 832, height: 900 }, 32),
    ).toEqual({ width: 2664, height: 1540, panelX: 1832 });
  });
});

describe("captureHeight", () => {
  it("grows to fit content that would otherwise scroll out of the picture", () => {
    expect(captureHeight(700, 1200)).toBe(1200);
  });

  it("never shrinks below the height the panel has on screen", () => {
    expect(captureHeight(700, 300)).toBe(700);
  });
});

describe("pdfPageSize", () => {
  it("sizes the page to the capture's CSS size, in points", () => {
    // A 1200x800 CSS px workspace captured at 2x is a 2400x1600 canvas, and
    // 1200 CSS px at 96 per inch is 12.5in, or 900pt.
    expect(pdfPageSize({ width: 2400, height: 1600 })).toEqual({ width: 900, height: 600 });
  });
});
