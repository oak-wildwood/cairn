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
  SECTORS,
  survivesFilters,
  wrapLabel,
} from "./layout";
import { makePart } from "./testParts";
import { VIEWBOX } from "./theme";
import { SELF_ID } from "./types";
import type { MapFilters } from "./layout";
import type { Point, SectorRole } from "./types";

function bearingOf(positions: Map<string, Point>, id: string): number {
  return pointToBearing(positions.get(id)!);
}

describe("polarToPoint / pointToBearing", () => {
  it("puts 0 degrees at north (negative y)", () => {
    expect(polarToPoint(0, 100)).toEqual({ x: 0, y: -100 });
  });

  it("increases clockwise: 90 degrees is east", () => {
    const { x, y } = polarToPoint(90, 100);
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(0);
  });

  it("180 degrees is south, 270 degrees is west", () => {
    const south = polarToPoint(180, 100);
    expect(south.x).toBeCloseTo(0);
    expect(south.y).toBeCloseTo(100);

    const west = polarToPoint(270, 100);
    expect(west.x).toBeCloseTo(-100);
    expect(west.y).toBeCloseTo(0);
  });

  it("round-trips through pointToBearing", () => {
    for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const point = polarToPoint(bearing, 200);
      expect(pointToBearing(point)).toBeCloseTo(bearing);
    }
  });

  it("normalises a west-of-north point to [0, 360) rather than a negative angle", () => {
    // atan2 alone gives -90 here.
    expect(pointToBearing({ x: -1, y: 0 })).toBeCloseTo(270);
    expect(pointToBearing({ x: 0, y: -1 })).toBe(0);
  });
});

describe("connectionStyle", () => {
  it("is solid when either endpoint is Self", () => {
    expect(connectionStyle(SELF_ID, "the-fixer")).toBe("solid");
    expect(connectionStyle("the-fixer", SELF_ID)).toBe("solid");
  });

  it("is dashed between two parts", () => {
    expect(connectionStyle("the-fixer", "the-kid")).toBe("dashed");
  });
});

describe("connectionEdgeKey", () => {
  it("orders by direction, so A->B and B->A differ", () => {
    expect(connectionEdgeKey("a", "b")).not.toBe(connectionEdgeKey("b", "a"));
  });

  it("keeps ids that concatenate the same apart", () => {
    expect(connectionEdgeKey("a", "bc")).not.toBe(connectionEdgeKey("ab", "c"));
  });
});

describe("connectionOpacity", () => {
  it("dims when either endpoint role is unknown, whichever end it is", () => {
    const dimmed = connectionOpacity("unknown", "manager", 1);
    expect(dimmed).toBeGreaterThan(0);
    expect(dimmed).toBeLessThan(1);
    expect(connectionOpacity("manager", "unknown", 1)).toBe(dimmed);
  });

  it("stays at base opacity when neither endpoint is unknown", () => {
    expect(connectionOpacity("manager", "exile", 0.8)).toBeCloseTo(0.8);
    expect(connectionOpacity(SELF_ID, "manager", 0.8)).toBeCloseTo(0.8);
  });
});

describe("partCaption", () => {
  it("joins role, status and active with middle dots", () => {
    expect(
      partCaption({ role: "manager", status: "witnessed", active: true }),
    ).toBe("manager · witnessed · active");
  });

  it("omits a blank status rather than leaving a dangling separator", () => {
    expect(partCaption({ role: "exile", status: "", active: false })).toBe(
      "exile",
    );
  });

  it("omits active when false, trims whitespace-only status", () => {
    expect(
      partCaption({ role: "firefighter", status: "   ", active: false }),
    ).toBe("firefighter");
  });
});

describe("survivesFilters", () => {
  const noFilters: MapFilters = {
    activeFilter: null,
    activeOnlyFilter: false,
    tagFilter: [],
  };

  it("passes everything when no filters are set", () => {
    expect(survivesFilters("manager", false, [], noFilters)).toBe(true);
  });

  it("filters by role", () => {
    const filters: MapFilters = { ...noFilters, activeFilter: "exile" };
    expect(survivesFilters("manager", false, [], filters)).toBe(false);
    expect(survivesFilters("exile", false, [], filters)).toBe(true);
  });

  it("filters by active-only", () => {
    const filters: MapFilters = { ...noFilters, activeOnlyFilter: true };
    expect(survivesFilters("manager", false, [], filters)).toBe(false);
    expect(survivesFilters("manager", true, [], filters)).toBe(true);
  });

  it("filters by tag, OR'd across the part's own tags", () => {
    const filters: MapFilters = { ...noFilters, tagFilter: ["shame", "grief"] };
    expect(survivesFilters("manager", false, ["anger"], filters)).toBe(false);
    expect(survivesFilters("manager", false, ["shame"], filters)).toBe(true);
  });

  it("requires all three filters to pass at once", () => {
    const filters: MapFilters = {
      activeFilter: "manager",
      activeOnlyFilter: true,
      tagFilter: ["shame"],
    };
    expect(survivesFilters("manager", true, ["shame"], filters)).toBe(true);
    expect(survivesFilters("manager", true, ["grief"], filters)).toBe(false);
    expect(survivesFilters("manager", false, ["shame"], filters)).toBe(false);
    expect(survivesFilters("exile", true, ["shame"], filters)).toBe(false);
  });
});

describe("wrapLabel", () => {
  it("leaves a short name on one line", () => {
    expect(wrapLabel("The Fixer")).toEqual(["The Fixer"]);
  });

  it("leaves a single long word unwrapped, since there's nowhere to break it", () => {
    expect(wrapLabel("Supercalifragilisticexpialidocious")).toEqual([
      "Supercalifragilisticexpialidocious",
    ]);
  });

  it("splits a long name to minimise the longest line", () => {
    expect(wrapLabel("The Unseen One")).toEqual(["The", "Unseen One"]);
  });

  it("respects a custom max length", () => {
    expect(wrapLabel("The Fixer", 5)).toEqual(["The", "Fixer"]);
  });
});

describe("computeLayout", () => {
  it("places a manual override verbatim regardless of role", () => {
    const parts = [makePart({ id: "p1", role: "exile", x: 42, y: -17 })];
    const positions = computeLayout(parts);
    expect(positions.get("p1")).toEqual({ x: 42, y: -17 });
  });

  // A full first ring per sector (2 managers, 4 firefighters, 4 exiles fit at
  // BASE_RADIUS), so the first and last part of each sit as near its edges as
  // the layout ever puts them. One part per sector would land mid-sector with
  // or without padding and prove nothing.
  it("keeps a full sector's end parts off its boundaries, and out of the manager/exile overlap", () => {
    const counts: Record<SectorRole, number> = { manager: 2, firefighter: 4, exile: 4 };
    const parts = (Object.keys(counts) as SectorRole[]).flatMap((role) =>
      Array.from({ length: counts[role] }, (_, i) => makePart({ id: `${role}-${i}`, role })),
    );
    const positions = computeLayout(parts);

    for (const part of parts) {
      const { startDeg, endDeg } = SECTORS[part.role as SectorRole];
      const bearing = bearingOf(positions, part.id);
      expect(Math.hypot(positions.get(part.id)!.x, positions.get(part.id)!.y)).toBeCloseTo(BASE_RADIUS);
      expect(bearing).toBeGreaterThan(startDeg + 1);
      expect(bearing).toBeLessThan(endDeg - 1);
    }

    // Manager is 270–350 and exile 140–275: 270–275 belongs to both.
    for (let i = 0; i < counts.manager; i += 1) {
      expect(bearingOf(positions, `manager-${i}`)).toBeGreaterThan(275);
    }
    for (let i = 0; i < counts.exile; i += 1) {
      expect(bearingOf(positions, `exile-${i}`)).toBeLessThan(270);
    }
  });

  it("spills a sector's overflow onto a further ring, still inside the sector", () => {
    const parts = ["a", "b", "c"].map((id) => makePart({ id, role: "manager" }));
    const positions = computeLayout(parts);

    const radii = parts.map(({ id }) => Math.hypot(positions.get(id)!.x, positions.get(id)!.y));
    expect(radii.filter((r) => Math.abs(r - BASE_RADIUS) < 1e-6)).toHaveLength(2);
    expect(Math.max(...radii)).toBeGreaterThan(BASE_RADIUS);

    for (const { id } of parts) {
      const bearing = bearingOf(positions, id);
      expect(bearing).toBeGreaterThan(SECTORS.manager.startDeg);
      expect(bearing).toBeLessThan(SECTORS.manager.endDeg);
    }
  });

  it("auto-places a part with null x/y, but keeps an explicit (0, 0) as an override", () => {
    const positions = computeLayout([
      makePart({ id: "unset", x: null, y: null }),
      makePart({ id: "at-self", x: 0, y: 0 }),
    ]);
    const unset = positions.get("unset")!;
    expect(Math.hypot(unset.x, unset.y)).toBeCloseTo(BASE_RADIUS);
    expect(positions.get("at-self")).toEqual({ x: 0, y: 0 });
  });

  it("puts an unknown-role part on its own ring outside the sectors' first ring", () => {
    const parts = [makePart({ id: "u1", role: "unknown" })];
    const positions = computeLayout(parts);
    const { x, y } = positions.get("u1")!;
    expect(Math.hypot(x, y)).toBeGreaterThan(BASE_RADIUS);
  });

  it("keeps an overridden part's slot, so its siblings don't reshuffle", () => {
    const withoutOverride = computeLayout([
      makePart({ id: "a", role: "manager" }),
      makePart({ id: "b", role: "manager" }),
      makePart({ id: "c", role: "manager" }),
    ]);
    const withOverride = computeLayout([
      makePart({ id: "a", role: "manager", x: 999, y: 999 }),
      makePart({ id: "b", role: "manager" }),
      makePart({ id: "c", role: "manager" }),
    ]);

    expect(withOverride.get("b")).toEqual(withoutOverride.get("b"));
    expect(withOverride.get("c")).toEqual(withoutOverride.get("c"));
  });
});

describe("computeViewBox", () => {
  it("returns the design's own frame when nothing overflows it", () => {
    expect(computeViewBox([{ x: 0, y: 0 }])).toEqual(VIEWBOX);
  });

  it("returns the design's own frame for no content at all", () => {
    expect(computeViewBox([])).toEqual(VIEWBOX);
  });

  it("scales up, centred, when a point sits outside the frame", () => {
    const box = computeViewBox([{ x: 0, y: -10000 }]);
    expect(box.width).toBeGreaterThan(VIEWBOX.width);
    expect(box.height).toBeGreaterThan(VIEWBOX.height);

    const centreX = VIEWBOX.x + VIEWBOX.width / 2;
    const centreY = VIEWBOX.y + VIEWBOX.height / 2;
    expect(Math.abs(box.x + box.width / 2 - centreX)).toBeLessThan(2);
    expect(Math.abs(box.y + box.height / 2 - centreY)).toBeLessThan(2);
  });
});
