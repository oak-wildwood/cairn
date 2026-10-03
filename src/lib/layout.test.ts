import { describe, expect, it } from "vitest";
import {
  BASE_RADIUS,
  computeLayout,
  computeViewBox,
  connectionEdgeKey,
  connectionOpacity,
  connectionStyle,
  connectorCurve,
  connectorMarkerEnd,
  nodeStrokeDashArray,
  partCaption,
  pointToBearing,
  polarToPoint,
  reciprocalConnectionIds,
  SECTORS,
  survivesFilters,
  wrapLabel,
} from "./layout";
import { CONNECTION, CONNECTOR_COLORS, NODE, VIEWBOX } from "./theme";
import type { ConnectorColorKey } from "./theme";
import { SELF_ID } from "./types";
import type { Point } from "./types";
import { makePart } from "./testParts";

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
    // Due west: atan2 alone returns -90 here.
    expect(pointToBearing({ x: -1, y: 0 })).toBeCloseTo(270);
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
    // And nothing else: a phantom entry in any sector's bucket would take a
    // slot and shift the real parts along.
    expect(positions.size).toBe(parts.length);
  });

  it("gives a lone part in each sector that sector's midpoint", () => {
    // One part per sector, so a phantom slot in any bucket moves it off-center.
    const positions = computeLayout([
      makePart({ id: "m", role: "manager" }),
      makePart({ id: "f", role: "firefighter" }),
      makePart({ id: "e", role: "exile" }),
    ]);
    for (const [id, role] of [["m", "manager"], ["f", "firefighter"], ["e", "exile"]] as const) {
      const { startDeg, endDeg } = SECTORS[role];
      expect(pointToBearing(positions.get(id)!)).toBeCloseTo((startDeg + endDeg) / 2);
    }
  });

  it("ignores a half-set override: x without y is not a position", () => {
    // `null` means unset (see AGENTS.md: x/y are null, never 0, when unset).
    // Pinning on x alone would put the part at (x, null) - effectively y = 0.
    const computed = computeLayout([makePart({ id: "p", role: "manager" })]);
    const halfX = computeLayout([makePart({ id: "p", role: "manager", x: 40, y: null })]);
    const halfY = computeLayout([makePart({ id: "p", role: "manager", x: null, y: 40 })]);
    expect(halfX.get("p")).toEqual(computed.get("p"));
    expect(halfY.get("p")).toEqual(computed.get("p"));
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

  it("insets every part from its sector's edges, keeping it out of the overlaps", () => {
    // Manager (270–350) and exile (140–275) share 270–275. Only scalePoint's
    // padding(0.5) keeps the first and last part of each ring off the
    // boundary; without it the last exile lands on 275 and the first manager
    // on 270, both inside the other's sector.
    const roles = ["manager", "firefighter", "exile"] as const;
    const parts = roles.flatMap((role) =>
      [1, 2].map((n) => makePart({ id: `${role}-${n}`, role })),
    );
    const positions = computeLayout(parts);

    for (const part of parts) {
      const { startDeg, endDeg } = SECTORS[part.role as (typeof roles)[number]];
      const bearing = pointToBearing(positions.get(part.id)!);
      expect(bearing).toBeGreaterThan(startDeg + 5);
      expect(bearing).toBeLessThan(endDeg - 5);
    }
  });

  it("puts a lone part in the middle of its sector, not at its start", () => {
    const positions = computeLayout([makePart({ id: "m", role: "manager" })]);
    expect(pointToBearing(positions.get("m")!)).toBeCloseTo(310);
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

describe("computeLayout: ring capacity", () => {
  // The manager sector is 80 degrees wide. At MIN_ARC_SPACING 130 the first
  // ring (radius 255) holds floor(255 * 80deg / 130) = 2 parts, the second
  // (radius 375) 4 and the third (radius 495) 5.
  const managers = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      makePart({ id: `m${index}`, role: "manager" }),
    );
  const radiusOf = (positions: Map<string, Point>, id: string) => {
    const { x, y } = positions.get(id)!;
    return Math.round(Math.hypot(x, y));
  };

  it("fits exactly two managers on the first ring, then one more spills outward", () => {
    const positions = computeLayout(managers(3));
    expect(radiusOf(positions, "m0")).toBe(BASE_RADIUS);
    expect(radiusOf(positions, "m1")).toBe(BASE_RADIUS);
    expect(radiusOf(positions, "m2")).toBe(BASE_RADIUS + 120);
  });

  it("fills each ring to capacity, in order, and every ring sits further out", () => {
    const positions = computeLayout(managers(7));
    const radii = Array.from({ length: 7 }, (_, index) => radiusOf(positions, `m${index}`));
    expect(radii).toEqual([255, 255, 375, 375, 375, 375, 495]);
    // The second ring holds four, spread evenly over the sector with half a
    // step of margin at each end: 20 degrees apart from 280 to 340.
    const bearings = [2, 3, 4, 5].map((index) =>
      pointToBearing(positions.get(`m${index}`)!),
    );
    bearings.forEach((bearing, index) => expect(bearing).toBeCloseTo(280 + 20 * index));
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

  it("trims padding around a status that has something to say", () => {
    expect(partCaption({ role: "exile", status: "  witnessed ", active: false })).toBe(
      "exile · witnessed",
    );
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

  it("keeps a name of exactly maxChars on one line, but wraps one char longer", () => {
    expect(wrapLabel("Twelve Chars")).toEqual(["Twelve Chars"]);
    expect(wrapLabel("Thirteen Char")).toEqual(["Thirteen", "Char"]);
    expect(wrapLabel("ab cd ef", 8)).toEqual(["ab cd ef"]);
    expect(wrapLabel("ab cd efg", 8)).toEqual(["ab cd", "efg"]);
  });

  it("searches every split point, not just the first", () => {
    // Splits leave longest lines of 17, 13 and 12: only the third is best.
    expect(wrapLabel("An Old Quiet Watcher")).toEqual(["An Old Quiet", "Watcher"]);
    // Both inner splits leave 13 as the longest line; the earlier one wins.
    expect(wrapLabel("The Old Quiet Watcher")).toEqual(["The Old", "Quiet Watcher"]);
  });

  it("trims before measuring", () => {
    expect(wrapLabel("  Self  ")).toEqual(["Self"]);
  });
});

describe("computeViewBox", () => {
  const centreX = VIEWBOX.x + VIEWBOX.width / 2;
  const centreY = VIEWBOX.y + VIEWBOX.height / 2;

  /** `computeViewBox` rounds `x` and `width` separately, so a correct frame
   * can sit up to half a unit off centre on each axis. */
  function expectCentred(box: { x: number; y: number; width: number; height: number }) {
    expect(Math.abs(box.x + box.width / 2 - centreX)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.y + box.height / 2 - centreY)).toBeLessThanOrEqual(1);
  }

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

    expect(box.width).toBeGreaterThan(VIEWBOX.width);
    expect(box.height).toBeGreaterThan(VIEWBOX.height);
    // Aspect ratio is preserved — this is a uniform scale, not a bounding-box fit.
    expect(box.width / box.height).toBeCloseTo(VIEWBOX.width / VIEWBOX.height, 1);
    // The frame stands further back around the same centre; it doesn't slide.
    expectCentred(box);
  });

  it("grows for a node far below Self too, not only to the side", () => {
    // Directly below the centre, so only the vertical reach can force growth.
    const box = computeViewBox([{ x: centreX, y: centreY + 1500 }]);
    expect(box.height).toBeGreaterThan(VIEWBOX.height);
    expect(box.width / box.height).toBeCloseTo(VIEWBOX.width / VIEWBOX.height, 1);
    expectCentred(box);
  });

  it("measures a node above Self by its upward reach alone", () => {
    // Reach is 15 + 731 + 54 = 800 past the frame's half-height of 385, so
    // 2.08x: the next 5% step is 2.10x. Adding rather than subtracting the
    // node's up-extent, or measuring from the wrong edge, lands elsewhere.
    // A 2.10x step, not 2.05x: 770 x 2.05 is exactly 1578.5, where rounding
    // would depend on float error in the stepped scale.
    const box = computeViewBox([{ x: 0, y: -731 }]);
    expect(box.width).toBe(Math.round(VIEWBOX.width * 2.1));
    expect(box.height).toBe(Math.round(VIEWBOX.height * 2.1));
  });

  it("measures a node below Self by its caption's downward reach alone", () => {
    // Reach is 741 + 73.5 - 15 = 799.5: 2.08x, so 2.10x.
    const box = computeViewBox([{ x: 0, y: 741 }]);
    expect(box.width).toBe(Math.round(VIEWBOX.width * 2.1));
    expect(box.height).toBe(Math.round(VIEWBOX.height * 2.1));
  });

  it("measures a node to either side by its offset from the centre", () => {
    // 819 + 90 = 909 against a half-width of 450: 2.02x, so 2.05x.
    for (const x of [819, -819]) {
      const box = computeViewBox([{ x, y: 0 }]);
      expect(box.width).toBe(Math.round(VIEWBOX.width * 2.05));
    }
  });

  it("grows in 5% steps - a point just past the frame gives exactly 1.05x", () => {
    // Chosen so the point's horizontal reach (its offset plus the 90-unit
    // caption allowance) is 2% past the frame: enough to force growth, not
    // enough to reach the next 5% step after this one.
    const point: Point = { x: centreX + (VIEWBOX.width / 2) * 1.02 - 90, y: centreY };
    const box = computeViewBox([point]);
    expect(box.width).toBe(Math.round(VIEWBOX.width * 1.05));
    expect(box.height).toBe(Math.round(VIEWBOX.height * 1.05));
  });
});

describe("wrapLabel: edge cases", () => {
  it("breaks ties toward the earlier split", () => {
    // "Alpha" / "X" / "Omega": splitting after word 1 or after word 2 both
    // leave a 7-character longest line, so the earlier split wins.
    expect(wrapLabel("Alpha X Omega")).toEqual(["Alpha", "X Omega"]);
  });

  it("collapses repeated whitespace", () => {
    expect(wrapLabel("The    Unseen     One")).toEqual(["The", "Unseen One"]);
  });
});

describe("computeLayout: the unknown ring", () => {
  it("spreads unknown parts around a ring outside the sectors, not on them", () => {
    const unknowns = ["u1", "u2", "u3"].map((id) => makePart({ id, role: "unknown" }));
    const manager = makePart({ id: "m", role: "manager" });
    const positions = computeLayout([manager, ...unknowns]);
    const radius = (id: string) => Math.hypot(positions.get(id)!.x, positions.get(id)!.y);

    const points = unknowns.map((part) => positions.get(part.id)!);
    expect(new Set(points.map(({ x, y }) => `${x},${y}`)).size).toBe(3);
    // Unplaced parts have no sector, so they sit on their own ring further
    // out than any sector's first ring rather than among the placed parts.
    for (const part of unknowns) {
      expect(radius(part.id)).toBeGreaterThan(radius(manager.id));
    }
  });
});

describe("nodeStrokeDashArray", () => {
  it("dashes emerging and unwitnessed parts, whatever the case or padding", () => {
    for (const status of ["emerging", "Emerging", "UNWITNESSED", "  unwitnessed "]) {
      expect(nodeStrokeDashArray(status)).toBe("3 4");
    }
  });

  it("leaves every other status solid", () => {
    for (const status of ["", "witnessed", "unburdened", "emerging slowly"]) {
      expect(nodeStrokeDashArray(status)).toBeUndefined();
    }
  });

  it("never uses the connector's dash, which means something else", () => {
    expect(NODE.mutedDashArray).not.toBe(CONNECTION.dashArray);
  });
});

describe("reciprocalConnectionIds", () => {
  it("marks both halves of a pair that runs each way, and nothing else", () => {
    const ids = reciprocalConnectionIds([
      { id: "protects", sourceId: "a", targetId: "b" },
      { id: "triggers", sourceId: "b", targetId: "a" },
      { id: "lone", sourceId: "a", targetId: "c" },
      { id: "to-self", sourceId: "c", targetId: SELF_ID },
    ]);
    expect([...ids].sort()).toEqual(["protects", "triggers"]);
  });

  it("treats a pair sharing endpoints in the same direction as not reciprocal", () => {
    expect(
      reciprocalConnectionIds([
        { id: "one", sourceId: "a", targetId: "b" },
        { id: "two", sourceId: "a", targetId: "b" },
      ]).size,
    ).toBe(0);
  });
});

describe("connectorMarkerEnd", () => {
  const keys = Object.keys(CONNECTOR_COLORS) as ConnectorColorKey[];

  it("gives a reciprocal connector the arrowhead in its own colour", () => {
    for (const key of keys) {
      expect(connectorMarkerEnd(true, key)).toBe(`url(#arrow-${key})`);
    }
  });

  it("gives a lone connector no arrowhead", () => {
    for (const key of keys) {
      expect(connectorMarkerEnd(false, key)).toBeUndefined();
    }
  });
});

describe("connectorCurve", () => {
  const radius = 46;
  const a = { id: "a", point: { x: -200, y: -150 }, radius };
  const b = { id: "b", point: { x: 220, y: -120 }, radius };

  const distance = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);

  it("starts and ends on the circles' edges rather than their centres", () => {
    const curve = connectorCurve(a, b, false)!;
    expect(distance(curve.start, a.point)).toBeCloseTo(radius);
    expect(distance(curve.end, b.point)).toBeCloseTo(radius);
  });

  it("draws nothing for overlapping nodes", () => {
    expect(connectorCurve(a, { ...b, point: { x: -180, y: -150 } }, false)).toBeNull();
  });

  it("draws nothing when the circles exactly touch, and something just past that", () => {
    const left = { id: "a", point: { x: 0, y: 0 }, radius };
    expect(connectorCurve(left, { id: "b", point: { x: 2 * radius, y: 0 }, radius }, false)).toBeNull();
    expect(
      connectorCurve(left, { id: "b", point: { x: 2 * radius + 1, y: 0 }, radius }, false),
    ).not.toBeNull();
  });

  it("bows a chord that passes through Self towards its perp, not away from it", () => {
    // Collinear with Self, so the dot product is exactly zero: ties go to
    // `away` = 1, which for an eastward chord bows to the north.
    const west = { id: "a", point: { x: -200, y: 0 }, radius };
    const east = { id: "b", point: { x: 200, y: 0 }, radius };
    const { bow } = connectorCurve(west, east, false)!;
    expect(bow.x).toBeCloseTo(0);
    expect(bow.y).toBeCloseTo(-CONNECTION.bowRatio * (400 - 2 * radius));
  });

  it("bows every part-to-part connector away from Self, wherever the pair sits", () => {
    for (let bearing = 0; bearing < 360; bearing += 40) {
      for (const offset of [-60, 25, 90]) {
        const first = { id: "a", point: polarToPoint(bearing, 250), radius };
        const second = { id: "b", point: polarToPoint(bearing + offset + 80, 300), radius };
        for (const [from, to] of [[first, second], [second, first]]) {
          const { start, bow, end } = connectorCurve(from, to, false)!;
          const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
          // Only meaningful when the chord is off-centre enough to have a side.
          if (Math.abs(mid.x * (end.y - start.y) - mid.y * (end.x - start.x)) < 1) continue;
          expect(Math.hypot(bow.x, bow.y)).toBeGreaterThan(Math.hypot(mid.x, mid.y));
        }
      }
    }
  });

  it("bows out of Self counter-clockwise from either end", () => {
    // Self to a part due north: the bow lands west of the line (negative x),
    // and the reverse connector shares that arc.
    const self = { id: SELF_ID, point: { x: 0, y: 0 }, radius: 40 };
    const north = { id: "a", point: { x: 0, y: -255 }, radius };
    expect(connectorCurve(self, north, false)!.bow.x).toBeLessThan(0);
    expect(connectorCurve(north, self, false)!.bow.x).toBeLessThan(0);
  });

  it("pushes the forward arc of a reciprocal pair along its own perp by the spread", () => {
    const shared = connectorCurve(a, b, false)!;
    const there = connectorCurve(a, b, true)!;
    const chord = distance(shared.start, shared.end);
    // a -> b runs (ux, uy); perp is (uy, -ux).
    const ux = (b.point.x - a.point.x) / distance(a.point, b.point);
    const uy = (b.point.y - a.point.y) / distance(a.point, b.point);
    expect(there.bow.x - shared.bow.x).toBeCloseTo(uy * chord * CONNECTION.reciprocalSpread);
    expect(there.bow.y - shared.bow.y).toBeCloseTo(-ux * chord * CONNECTION.reciprocalSpread);
  });

  it("bows away from Self rather than across it", () => {
    const curve = connectorCurve(a, b, false)!;
    const mid = {
      x: (curve.start.x + curve.end.x) / 2,
      y: (curve.start.y + curve.end.y) / 2,
    };
    expect(Math.hypot(curve.bow.x, curve.bow.y)).toBeGreaterThan(
      Math.hypot(mid.x, mid.y),
    );
  });

  it("would put two opposite lone connectors on the same arc", () => {
    // Why the spread below exists: `perp` and `away` both flip with direction
    // and cancel out, so without it a reciprocal pair draws as one line.
    const there = connectorCurve(a, b, false)!;
    const back = connectorCurve(b, a, false)!;
    expect(distance(there.bow, back.bow)).toBeCloseTo(0);
  });

  it("bows the two arcs of a reciprocal pair apart, either side of the shared one", () => {
    const shared = connectorCurve(a, b, false)!;
    const there = connectorCurve(a, b, true)!;
    const back = connectorCurve(b, a, true)!;

    const chord = distance(shared.start, shared.end);
    expect(distance(there.bow, back.bow)).toBeCloseTo(
      2 * chord * CONNECTION.reciprocalSpread,
    );
    expect((there.bow.x + back.bow.x) / 2).toBeCloseTo(shared.bow.x);
    expect((there.bow.y + back.bow.y) / 2).toBeCloseTo(shared.bow.y);
  });

  it("bows every connector out of Self to the same side, wherever the part sits", () => {
    // `mid` lies on the line through Self here, so the dot product that picks
    // a side for other connectors is zero and its sign is floating-point
    // noise. Left to that, some bearings would bow clockwise and some
    // counter-clockwise, and a drag would flicker between mirror images.
    const self = { id: SELF_ID, point: { x: 0, y: 0 }, radius: 40 };
    const sides = new Set<number>();
    for (let bearing = 0; bearing < 360; bearing += 3) {
      const part = { id: "a", point: polarToPoint(bearing, 255), radius };
      for (const [from, to] of [[self, part], [part, self]]) {
        const { bow } = connectorCurve(from, to, false)!;
        // Which side of the Self-to-part line the bow sits on.
        sides.add(Math.sign(part.point.x * bow.y - part.point.y * bow.x));
      }
    }
    expect([...sides]).toHaveLength(1);
  });
});
