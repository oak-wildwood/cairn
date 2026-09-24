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
  type MapFilters,
} from "./layout";
import { SELF_ID } from "./types";
import type { Part } from "./types";

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: "part-1",
    name: "A Part",
    role: "manager",
    description: "",
    feelings: [],
    bodyLocation: "",
    trigger: "",
    positiveIntention: "",
    fears: "",
    origins: "",
    notes: "",
    status: "",
    active: false,
    x: null,
    y: null,
    ...overrides,
  };
}

describe("polarToPoint / pointToBearing", () => {
  it("puts 0° due north (negative y, x unchanged)", () => {
    expect(polarToPoint(0, 100)).toEqual({ x: 0, y: -100 });
  });

  it("puts 90° due east, confirming clockwise bearing", () => {
    const { x, y } = polarToPoint(90, 100);
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(0);
  });

  it("round-trips through pointToBearing", () => {
    for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const point = polarToPoint(bearing, 200);
      expect(pointToBearing(point)).toBeCloseTo(bearing);
    }
  });

  it("normalises pointToBearing to [0, 360)", () => {
    expect(pointToBearing({ x: 0, y: 100 })).toBeCloseTo(180);
  });
});

describe("computeLayout", () => {
  it("places a lone manager inside the manager sector", () => {
    const parts = [makePart({ id: "m1", role: "manager" })];
    const position = computeLayout(parts).get("m1")!;
    const bearing = pointToBearing(position);
    expect(bearing).toBeGreaterThanOrEqual(270);
    expect(bearing).toBeLessThanOrEqual(350);
  });

  it("places a lone firefighter inside the firefighter sector", () => {
    const parts = [makePart({ id: "f1", role: "firefighter" })];
    const bearing = pointToBearing(computeLayout(parts).get("f1")!);
    expect(bearing).toBeGreaterThanOrEqual(5);
    expect(bearing).toBeLessThanOrEqual(130);
  });

  it("places a lone exile inside the exile sector", () => {
    const parts = [makePart({ id: "e1", role: "exile" })];
    const bearing = pointToBearing(computeLayout(parts).get("e1")!);
    expect(bearing).toBeGreaterThanOrEqual(140);
    expect(bearing).toBeLessThanOrEqual(275);
  });

  it("spills an overflowing sector onto a further-out ring", () => {
    // The manager sector (270-350) only fits two parts per ring at
    // MIN_ARC_SPACING, so a third has to land on a wider-radius ring.
    const parts = [
      makePart({ id: "m1", role: "manager" }),
      makePart({ id: "m2", role: "manager" }),
      makePart({ id: "m3", role: "manager" }),
    ];
    const positions = computeLayout(parts);
    const radiusOf = (id: string): number => {
      const { x, y } = positions.get(id)!;
      return Math.hypot(x, y);
    };
    const firstRingRadius = radiusOf("m1");
    expect(radiusOf("m2")).toBeCloseTo(firstRingRadius);
    expect(radiusOf("m3")).toBeGreaterThan(firstRingRadius);
  });

  it("uses a manual override verbatim without reshuffling siblings", () => {
    const withoutOverride = computeLayout([
      makePart({ id: "m1", role: "manager" }),
      makePart({ id: "m2", role: "manager" }),
    ]).get("m2")!;

    const positions = computeLayout([
      makePart({ id: "m1", role: "manager", x: 12, y: 34 }),
      makePart({ id: "m2", role: "manager" }),
    ]);

    expect(positions.get("m1")).toEqual({ x: 12, y: 34 });
    expect(positions.get("m2")).toEqual(withoutOverride);
  });

  it("puts an unknown-role part on the outer full-circle ring", () => {
    const parts = [makePart({ id: "u1", role: "unknown" })];
    const { x, y } = computeLayout(parts).get("u1")!;
    // BASE_RADIUS (255) + RING_GAP (120)
    expect(Math.hypot(x, y)).toBeCloseTo(375);
  });
});

describe("connectionStyle", () => {
  it("is solid when Self is either endpoint", () => {
    expect(connectionStyle(SELF_ID, "p1")).toBe("solid");
    expect(connectionStyle("p1", SELF_ID)).toBe("solid");
  });

  it("is dashed between two parts", () => {
    expect(connectionStyle("p1", "p2")).toBe("dashed");
  });
});

describe("connectionEdgeKey", () => {
  it("is stable for the same direction", () => {
    expect(connectionEdgeKey("a", "b")).toBe(connectionEdgeKey("a", "b"));
  });

  it("differs by direction, so a reciprocal pair can coexist", () => {
    expect(connectionEdgeKey("a", "b")).not.toBe(connectionEdgeKey("b", "a"));
  });
});

describe("connectionOpacity", () => {
  it("dims a connector touching an unknown-role endpoint", () => {
    expect(connectionOpacity("unknown", "manager", 1)).toBeCloseTo(0.6);
    expect(connectionOpacity("manager", "unknown", 1)).toBeCloseTo(0.6);
  });

  it("leaves a connector between two known roles at full opacity", () => {
    expect(connectionOpacity("manager", "exile", 1)).toBe(1);
  });
});

describe("partCaption", () => {
  it("joins only the segments that have something to say", () => {
    expect(partCaption({ role: "manager", status: "", active: false })).toBe(
      "manager",
    );
    expect(
      partCaption({ role: "manager", status: "emerging", active: false }),
    ).toBe("manager · emerging");
    expect(partCaption({ role: "manager", status: "", active: true })).toBe(
      "manager · active",
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
  const noFilters: MapFilters = {
    activeFilter: null,
    activeOnlyFilter: false,
    tagFilter: [],
  };

  it("passes everything when no filter is set", () => {
    expect(survivesFilters("manager", false, [], noFilters)).toBe(true);
  });

  it("filters by role", () => {
    const filters: MapFilters = { ...noFilters, activeFilter: "exile" };
    expect(survivesFilters("exile", false, [], filters)).toBe(true);
    expect(survivesFilters("manager", false, [], filters)).toBe(false);
  });

  it("filters to active-only parts", () => {
    const filters: MapFilters = { ...noFilters, activeOnlyFilter: true };
    expect(survivesFilters("manager", true, [], filters)).toBe(true);
    expect(survivesFilters("manager", false, [], filters)).toBe(false);
  });

  it("OR's the tag filter against a part's feelings", () => {
    const filters: MapFilters = { ...noFilters, tagFilter: ["sad", "angry"] };
    expect(survivesFilters("manager", false, ["sad"], filters)).toBe(true);
    expect(survivesFilters("manager", false, ["tired"], filters)).toBe(false);
  });

  it("requires every active filter to pass at once", () => {
    const filters: MapFilters = {
      activeFilter: "manager",
      activeOnlyFilter: true,
      tagFilter: ["shame"],
    };
    expect(survivesFilters("manager", true, ["shame"], filters)).toBe(true);
    // Right role and tag, but not active.
    expect(survivesFilters("manager", false, ["shame"], filters)).toBe(false);
  });
});

describe("wrapLabel", () => {
  it("keeps a short name on one line", () => {
    expect(wrapLabel("The Fixer")).toEqual(["The Fixer"]);
  });

  it("splits a long multi-word name across two balanced lines", () => {
    expect(wrapLabel("The Unseen One")).toEqual(["The", "Unseen One"]);
  });

  it("cannot split a single long word", () => {
    expect(wrapLabel("Antidisestablishmentarianism")).toEqual([
      "Antidisestablishmentarianism",
    ]);
  });

  it("trims surrounding whitespace", () => {
    expect(wrapLabel("  The Fixer  ")).toEqual(["The Fixer"]);
  });
});

describe("computeViewBox", () => {
  it("stays at the minimum frame when content fits inside it", () => {
    expect(computeViewBox([{ x: 0, y: 0 }])).toEqual({
      x: -450,
      y: -370,
      width: 900,
      height: 770,
    });
  });

  it("grows uniformly about its own centre for content that overflows it", () => {
    const base = computeViewBox([{ x: 0, y: 0 }]);
    const grown = computeViewBox([{ x: 0, y: -1000 }]);

    expect(grown.width).toBeGreaterThan(base.width);
    // Aspect ratio is preserved: growth is a uniform scale, not a refit.
    expect(grown.width / grown.height).toBeCloseTo(base.width / base.height, 1);

    const baseCentre = { x: base.x + base.width / 2, y: base.y + base.height / 2 };
    const grownCentre = {
      x: grown.x + grown.width / 2,
      y: grown.y + grown.height / 2,
    };
    expect(grownCentre.x).toBeCloseTo(baseCentre.x, 0);
    expect(grownCentre.y).toBeCloseTo(baseCentre.y, 0);
  });
});
