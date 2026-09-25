import { describe, expect, it } from "vitest";
import {
  computeLayout,
  computeViewBox,
  connectionEdgeKey,
  connectionOpacity,
  connectionStyle,
  partCaption,
  pointToBearing,
  polarToPoint,
  survivesFilters,
  wrapLabel,
} from "./layout";
import { VIEWBOX } from "./theme";
import { SELF_ID } from "./types";
import { makePart } from "./testSupport";

describe("polarToPoint", () => {
  it("puts 0 degrees due north of Self (negative y, per the SVG convention)", () => {
    const { x, y } = polarToPoint(0, 100);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(-100);
  });

  it("increases clockwise, so 90 degrees is due east", () => {
    const { x, y } = polarToPoint(90, 100);
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(0);
  });

  it("180 degrees is due south, 270 degrees is due west", () => {
    const south = polarToPoint(180, 100);
    expect(south.x).toBeCloseTo(0);
    expect(south.y).toBeCloseTo(100);

    const west = polarToPoint(270, 100);
    expect(west.x).toBeCloseTo(-100);
    expect(west.y).toBeCloseTo(0);
  });
});

describe("pointToBearing", () => {
  it("round-trips with polarToPoint across the full circle", () => {
    for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const point = polarToPoint(bearing, 150);
      expect(pointToBearing(point)).toBeCloseTo(bearing);
    }
  });

  it("normalises to [0, 360)", () => {
    expect(pointToBearing({ x: 0, y: -1 })).toBeGreaterThanOrEqual(0);
    expect(pointToBearing({ x: 0, y: -1 })).toBeLessThan(360);
  });
});

describe("computeLayout", () => {
  it("places every part somewhere", () => {
    const parts = [
      makePart({ id: "m1", role: "manager" }),
      makePart({ id: "f1", role: "firefighter" }),
      makePart({ id: "e1", role: "exile" }),
      makePart({ id: "u1", role: "unknown" }),
    ];
    const positions = computeLayout(parts);
    for (const part of parts) {
      expect(positions.has(part.id)).toBe(true);
    }
  });

  it("uses a manual x/y override verbatim instead of the computed sector position", () => {
    const parts = [makePart({ id: "dragged", role: "manager", x: 12, y: -34 })];
    const positions = computeLayout(parts);
    expect(positions.get("dragged")).toEqual({ x: 12, y: -34 });
  });

  it("overriding one part's position doesn't reshuffle its siblings", () => {
    const untouched = [
      makePart({ id: "a", role: "manager" }),
      makePart({ id: "b", role: "manager" }),
      makePart({ id: "c", role: "manager" }),
    ];
    const withOverride = untouched.map((part) =>
      part.id === "b" ? { ...part, x: 999, y: 999 } : part,
    );

    const baseline = computeLayout(untouched);
    const overridden = computeLayout(withOverride);

    expect(overridden.get("a")).toEqual(baseline.get("a"));
    expect(overridden.get("c")).toEqual(baseline.get("c"));
    expect(overridden.get("b")).toEqual({ x: 999, y: 999 });
  });

  it("spills onto an outer ring when a sector can't fit everyone at once", () => {
    // The manager sector is only 80 degrees wide, so packing enough parts
    // into it forces a second ring further out than BASE_RADIUS.
    const parts = Array.from({ length: 12 }, (_, index) =>
      makePart({ id: `m${index}`, role: "manager" }),
    );
    const positions = computeLayout(parts);
    const radii = parts.map((part) => {
      const { x, y } = positions.get(part.id)!;
      return Math.hypot(x, y);
    });
    expect(new Set(radii.map((r) => Math.round(r))).size).toBeGreaterThan(1);
  });
});

describe("connectionStyle", () => {
  it("is solid when either endpoint is Self", () => {
    expect(connectionStyle(SELF_ID, "a")).toBe("solid");
    expect(connectionStyle("a", SELF_ID)).toBe("solid");
  });

  it("is dashed between two parts", () => {
    expect(connectionStyle("a", "b")).toBe("dashed");
  });
});

describe("connectionEdgeKey", () => {
  it("treats A->B and B->A as different keys", () => {
    expect(connectionEdgeKey("a", "b")).not.toBe(connectionEdgeKey("b", "a"));
  });

  it("is stable for the same direction", () => {
    expect(connectionEdgeKey("a", "b")).toBe(connectionEdgeKey("a", "b"));
  });
});

describe("connectionOpacity", () => {
  it("dims a connector touching an unknown-role endpoint", () => {
    expect(connectionOpacity("unknown", "manager", 1)).toBeCloseTo(0.6);
    expect(connectionOpacity("manager", "unknown", 1)).toBeCloseTo(0.6);
  });

  it("leaves a connector between two placed roles at full opacity", () => {
    expect(connectionOpacity("manager", "exile", 1)).toBe(1);
    expect(connectionOpacity(SELF_ID, "manager", 1)).toBe(1);
  });
});

describe("partCaption", () => {
  it("joins role, status and active only when each has something to say", () => {
    expect(partCaption({ role: "manager", status: "", active: false })).toBe(
      "manager",
    );
    expect(
      partCaption({ role: "exile", status: "emerging", active: false }),
    ).toBe("exile · emerging");
    expect(partCaption({ role: "exile", status: "", active: true })).toBe(
      "exile · active",
    );
    expect(
      partCaption({ role: "exile", status: "witnessed", active: true }),
    ).toBe("exile · witnessed · active");
  });

  it("trims a blank status rather than leaving a dangling separator", () => {
    expect(partCaption({ role: "manager", status: "   ", active: false })).toBe(
      "manager",
    );
  });
});

describe("survivesFilters", () => {
  const noFilters = { activeFilter: null, activeOnlyFilter: false, tagFilter: [] };

  it("passes everything when no filter is set", () => {
    expect(survivesFilters("manager", false, [], noFilters)).toBe(true);
  });

  it("filters by role", () => {
    const filters = { ...noFilters, activeFilter: "manager" as const };
    expect(survivesFilters("manager", false, [], filters)).toBe(true);
    expect(survivesFilters("exile", false, [], filters)).toBe(false);
  });

  it("filters by active-only", () => {
    const filters = { ...noFilters, activeOnlyFilter: true };
    expect(survivesFilters("manager", true, [], filters)).toBe(true);
    expect(survivesFilters("manager", false, [], filters)).toBe(false);
  });

  it("ORs tags against each other, but requires at least one match", () => {
    const filters = { ...noFilters, tagFilter: ["shame", "grief"] };
    expect(survivesFilters("manager", false, ["shame"], filters)).toBe(true);
    expect(survivesFilters("manager", false, ["joy"], filters)).toBe(false);
    expect(survivesFilters("manager", false, [], filters)).toBe(false);
  });

  it("requires every active filter to pass at once", () => {
    const filters = {
      activeFilter: "manager" as const,
      activeOnlyFilter: true,
      tagFilter: ["shame"],
    };
    expect(survivesFilters("manager", true, ["shame"], filters)).toBe(true);
    // Right role and tag, but not active.
    expect(survivesFilters("manager", false, ["shame"], filters)).toBe(false);
    // Active and tagged, but wrong role.
    expect(survivesFilters("exile", true, ["shame"], filters)).toBe(false);
  });
});

describe("wrapLabel", () => {
  it("leaves a short name on one line", () => {
    expect(wrapLabel("Self")).toEqual(["Self"]);
  });

  it("leaves an unsplittable single long word on one line", () => {
    const longWord = "Supercalifragilisticexpialidocious";
    expect(wrapLabel(longWord)).toEqual([longWord]);
  });

  it("splits a long name to minimise the longer of the two lines", () => {
    // Matches the design's own wrap of this exact label (see the comment on
    // wrapLabel in layout.ts).
    expect(wrapLabel("The Unseen One")).toEqual(["The", "Unseen One"]);
  });

  it("trims before measuring", () => {
    expect(wrapLabel("  Self  ")).toEqual(["Self"]);
  });
});

describe("computeViewBox", () => {
  it("stays at the design's minimum frame when nothing pushes past it", () => {
    expect(computeViewBox([{ x: 0, y: 0 }])).toEqual({
      x: VIEWBOX.x,
      y: VIEWBOX.y,
      width: VIEWBOX.width,
      height: VIEWBOX.height,
    });
  });

  it("stays at the minimum frame for no positions at all", () => {
    expect(computeViewBox([])).toEqual({
      x: VIEWBOX.x,
      y: VIEWBOX.y,
      width: VIEWBOX.width,
      height: VIEWBOX.height,
    });
  });

  it("grows uniformly about the design's centre to hold a far-out node", () => {
    const box = computeViewBox([{ x: 2000, y: 0 }]);
    const centreX = VIEWBOX.x + VIEWBOX.width / 2;
    const centreY = VIEWBOX.y + VIEWBOX.height / 2;

    expect(box.width).toBeGreaterThan(VIEWBOX.width);
    expect(box.height).toBeGreaterThan(VIEWBOX.height);
    // Aspect ratio is preserved — this is a uniform scale, not a bounding-box fit.
    expect(box.width / box.height).toBeCloseTo(VIEWBOX.width / VIEWBOX.height, 1);
    // The frame stands further back around the same centre; it doesn't slide
    // (allowing a little slack for the independent rounding of x and width).
    expect(Math.abs(box.x + box.width / 2 - centreX)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.y + box.height / 2 - centreY)).toBeLessThanOrEqual(1);
  });
});
