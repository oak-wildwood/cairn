import { describe, expect, it } from "vitest";
import {
  BASE_RADIUS,
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
import { SELF_ID } from "./types";
import { makePart } from "./testFixtures";

describe("polarToPoint / pointToBearing", () => {
  it("puts 0° due north of the origin", () => {
    expect(polarToPoint(0, 100)).toEqual({ x: 0, y: -100 });
  });

  it("increases clockwise, so 90° is due east", () => {
    const { x, y } = polarToPoint(90, 100);
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(0);
  });

  it("round-trips through pointToBearing", () => {
    for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const point = polarToPoint(bearing, 100);
      expect(pointToBearing(point)).toBeCloseTo(bearing);
    }
  });
});

describe("computeLayout", () => {
  it("centres a lone part in its sector, at the base radius", () => {
    const part = makePart({ id: "p1", role: "manager" });
    const positions = computeLayout([part]);
    // manager spans 270–350deg; a lone part centres at the midpoint.
    const expected = polarToPoint(310, BASE_RADIUS);
    const actual = positions.get("p1")!;
    expect(actual.x).toBeCloseTo(expected.x);
    expect(actual.y).toBeCloseTo(expected.y);
  });

  it("centres a lone unknown-role part on the full-circle unknown ring", () => {
    const part = makePart({ id: "p1", role: "unknown" });
    const positions = computeLayout([part]);
    const expected = polarToPoint(180, BASE_RADIUS + 120);
    const actual = positions.get("p1")!;
    expect(actual.x).toBeCloseTo(expected.x);
    expect(actual.y).toBeCloseTo(expected.y);
  });

  it("spills a sector onto a further ring once it's full", () => {
    // The manager sector (270–350deg, 80deg wide) only fits two parts at
    // MIN_ARC_SPACING on the base ring; a third spills to the next ring out.
    const parts = [
      makePart({ id: "p1", role: "manager" }),
      makePart({ id: "p2", role: "manager" }),
      makePart({ id: "p3", role: "manager" }),
    ];
    const positions = computeLayout(parts);
    const radiusOf = (id: string): number => {
      const { x, y } = positions.get(id)!;
      return Math.hypot(x, y);
    };
    expect(radiusOf("p1")).toBeCloseTo(BASE_RADIUS);
    expect(radiusOf("p2")).toBeCloseTo(BASE_RADIUS);
    expect(radiusOf("p3")).toBeCloseTo(BASE_RADIUS + 120);
  });

  it("lets a manual override win without reshuffling untouched siblings", () => {
    const parts = [
      makePart({ id: "p1", role: "manager" }),
      makePart({ id: "p2", role: "manager" }),
    ];
    const before = computeLayout(parts);
    const untouchedBefore = before.get("p2")!;

    parts[0] = { ...parts[0], x: 999, y: -999 };
    const after = computeLayout(parts);

    expect(after.get("p1")).toEqual({ x: 999, y: -999 });
    expect(after.get("p2")).toEqual(untouchedBefore);
  });
});

describe("connectionStyle", () => {
  it("is solid when either endpoint is Self", () => {
    expect(connectionStyle(SELF_ID, "p1")).toBe("solid");
    expect(connectionStyle("p1", SELF_ID)).toBe("solid");
  });

  it("is dashed between two parts", () => {
    expect(connectionStyle("p1", "p2")).toBe("dashed");
  });
});

describe("connectionEdgeKey", () => {
  it("is directional: A->B and B->A differ", () => {
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

  it("leaves a connector between two known roles at full opacity", () => {
    expect(connectionOpacity("manager", "exile", 1)).toBe(1);
    expect(connectionOpacity(SELF_ID, "manager", 1)).toBe(1);
  });
});

describe("partCaption", () => {
  it("shows only the role when status and active are both empty", () => {
    expect(partCaption({ role: "manager", status: "", active: false })).toBe(
      "manager",
    );
  });

  it("joins role, status and active without a dangling separator", () => {
    expect(
      partCaption({ role: "exile", status: "emerging", active: true }),
    ).toBe("exile · emerging · active");
  });

  it("trims a whitespace-only status to nothing", () => {
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

  it("ORs tags against each other, requiring at least one match", () => {
    const filters = { ...noFilters, tagFilter: ["sad", "angry"] };
    expect(survivesFilters("manager", false, ["sad"], filters)).toBe(true);
    expect(survivesFilters("manager", false, ["afraid"], filters)).toBe(false);
  });

  it("requires all three filters to pass at once", () => {
    const filters = {
      activeFilter: "manager" as const,
      activeOnlyFilter: true,
      tagFilter: ["shame"],
    };
    expect(survivesFilters("manager", true, ["shame"], filters)).toBe(true);
    expect(survivesFilters("manager", true, ["guilt"], filters)).toBe(false);
    expect(survivesFilters("manager", false, ["shame"], filters)).toBe(false);
    expect(survivesFilters("exile", true, ["shame"], filters)).toBe(false);
  });
});

describe("wrapLabel", () => {
  it("keeps a short name on one line", () => {
    expect(wrapLabel("The Kid")).toEqual(["The Kid"]);
  });

  it("can't split a single word, however long", () => {
    expect(wrapLabel("Supercalifragilistic", 10)).toEqual([
      "Supercalifragilistic",
    ]);
  });

  it("splits a long multi-word name to minimise its longest line", () => {
    // "The Unseen One" reproduces the design's own wrapping (see the
    // function's doc comment).
    expect(wrapLabel("The Unseen One")).toEqual(["The", "Unseen One"]);
  });

  it("breaks ties toward the earlier split point", () => {
    expect(wrapLabel("The Fixer", 8)).toEqual(["The", "Fixer"]);
  });
});

describe("computeViewBox", () => {
  it("stays at the design's minimum frame when nothing pushes past it", () => {
    expect(computeViewBox([])).toEqual({ x: -450, y: -370, width: 900, height: 770 });
  });

  it("scales up uniformly, about its own centre, once content pushes past it", () => {
    expect(computeViewBox([{ x: 0, y: -1000 }])).toEqual({
      x: -1260,
      y: -1063,
      width: 2520,
      height: 2156,
    });
  });
});
