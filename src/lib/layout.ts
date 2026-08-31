import { scalePoint } from "d3-scale";
import { SELF_ID } from "./types";
import type {
  ConnectionStyle,
  EndpointId,
  EndpointRole,
  Part,
  Point,
  SectorRole,
} from "./types";

/**
 * Radial layout math. Pure functions only — no DOM, no d3-selection. `d3-scale`
 * is used for what it is genuinely good at here (even distribution across a
 * range with edge padding) and nothing else.
 *
 * Bearing convention: 0° points north (12 o'clock) and increases clockwise.
 * Diagram space puts Self at the origin (0, 0), so the SVG uses a centred
 * viewBox and every stored coordinate — including a part's dragged `x`/`y`
 * override — is relative to Self.
 */

export interface Sector {
  /** Bearing in degrees, clockwise from north. */
  readonly startDeg: number;
  readonly endDeg: number;
}

/**
 * The three role sectors. These are the plan's published ranges verbatim.
 *
 * Note they are not a clean partition of the circle: manager (270–350) and
 * exile (140–275) overlap across 270–275, and there are unassigned gaps at
 * 130–140 and 350–5. The overlap never manifests because parts are distributed
 * with `padding(0.5)` below, which insets the first and last node by half a
 * step and so keeps nodes off their sector's boundaries entirely.
 */
export const SECTORS: Readonly<Record<SectorRole, Sector>> = {
  manager: { startDeg: 270, endDeg: 350 },
  firefighter: { startDeg: 5, endDeg: 130 },
  exile: { startDeg: 140, endDeg: 275 },
};

/** Distance from Self to the first ring of parts, in diagram units. */
export const BASE_RADIUS = 255;

/** How much further out each additional ring sits when a sector overflows. */
const RING_GAP = 120;

/**
 * Minimum arc length between adjacent node centres on a ring. A ring holds as
 * many parts as it can at this spacing; the rest spill to the next ring out.
 * Derived from the comp's node diameter (~95) plus room for the label beneath.
 */
const MIN_ARC_SPACING = 130;

/**
 * Parts whose role is still "unknown" have no sector — that is the point of the
 * role. They orbit outside the three sectors on a full-circle ring, which reads
 * as "noticed but not yet placed" without inventing a fourth sector.
 *
 * This is a provisional answer to PLAN.md's open question about "unknown"; the
 * layout has to put them somewhere, and crashing or stacking them at the origin
 * is not an option once the modal offers the role.
 */
const UNKNOWN_RING: Sector = { startDeg: 0, endDeg: 360 };
const UNKNOWN_RADIUS = BASE_RADIUS + RING_GAP;

/** Convert a bearing and radius into a point in diagram space. */
export function polarToPoint(bearingDeg: number, radius: number): Point {
  const radians = (bearingDeg * Math.PI) / 180;
  return {
    x: radius * Math.sin(radians),
    y: -radius * Math.cos(radians),
  };
}

/** The bearing of a point in diagram space, normalised to [0, 360). */
export function pointToBearing({ x, y }: Point): number {
  const degrees = (Math.atan2(x, -y) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

/**
 * How many parts fit on one ring of the given radius across the given arc,
 * at no less than MIN_ARC_SPACING between neighbours. Always at least one, so
 * a very tight sector still makes progress instead of looping forever.
 */
function ringCapacity(radius: number, sector: Sector): number {
  const spanRadians = ((sector.endDeg - sector.startDeg) * Math.PI) / 180;
  const arcLength = Math.abs(radius * spanRadians);
  return Math.max(1, Math.floor(arcLength / MIN_ARC_SPACING));
}

/**
 * Split a sector's parts across concentric rings, filling each ring to capacity
 * before starting the next one further out.
 */
function splitIntoRings(
  ids: readonly string[],
  sector: Sector,
  baseRadius: number,
): { radius: number; ids: string[] }[] {
  const rings: { radius: number; ids: string[] }[] = [];
  let remaining = ids;
  let ring = 0;

  while (remaining.length > 0) {
    const radius = baseRadius + ring * RING_GAP;
    const capacity = ringCapacity(radius, sector);
    rings.push({ radius, ids: remaining.slice(0, capacity) });
    remaining = remaining.slice(capacity);
    ring += 1;
  }

  return rings;
}

/**
 * Place one ring's parts evenly along its arc.
 *
 * `padding(0.5)` insets the group by half a step at each end, so the parts sit
 * centred within their sector with equal margins rather than pinned to its
 * edges — and a lone part lands in the middle of its sector rather than at the
 * start of it.
 */
function placeRing(
  ids: readonly string[],
  sector: Sector,
  radius: number,
  into: Map<string, Point>,
): void {
  const angle = scalePoint<string>()
    .domain(ids as string[])
    .range([sector.startDeg, sector.endDeg])
    .padding(0.5);

  for (const id of ids) {
    // scalePoint returns undefined only for a value outside its domain, and we
    // are iterating the domain itself.
    const bearing = angle(id) ?? sector.startDeg;
    into.set(id, polarToPoint(bearing, radius));
  }
}

/**
 * Resolve every part's position in diagram space.
 *
 * A part with a manual `x`/`y` override (set by dragging) uses it verbatim, but
 * still consumes its slot in the sector distribution — so dragging one part
 * never reshuffles its untouched siblings.
 */
export function computeLayout(parts: readonly Part[]): Map<string, Point> {
  const positions = new Map<string, Point>();

  const bySector: Record<SectorRole, string[]> = {
    manager: [],
    firefighter: [],
    exile: [],
  };
  const unknown: string[] = [];

  for (const part of parts) {
    if (part.role === "unknown") {
      unknown.push(part.id);
    } else {
      bySector[part.role].push(part.id);
    }
  }

  for (const role of Object.keys(bySector) as SectorRole[]) {
    const sector = SECTORS[role];
    for (const ring of splitIntoRings(bySector[role], sector, BASE_RADIUS)) {
      placeRing(ring.ids, sector, ring.radius, positions);
    }
  }

  for (const ring of splitIntoRings(unknown, UNKNOWN_RING, UNKNOWN_RADIUS)) {
    placeRing(ring.ids, UNKNOWN_RING, ring.radius, positions);
  }

  // Manual overrides win, applied last so they can't be clobbered by a ring.
  for (const part of parts) {
    if (part.x !== null && part.y !== null) {
      positions.set(part.id, { x: part.x, y: part.y });
    }
  }

  return positions;
}

/**
 * Solid or dashed encodes the *kind* of relationship, not how sure of it we are.
 *
 * A line touching Self is a part's access to Self — the axis healing happens on
 * — and renders solid. A line between two parts is an inter-part dynamic
 * ("protects", "polarized") and renders dotted. The comp draws all five of its
 * connectors this way.
 *
 * Note this deliberately does *not* key off the "unknown" role. Dash pattern is
 * already carrying edge kind, so it cannot also carry how surfaced a part is;
 * `connectionOpacity` below dims unsurfaced connectors instead. That keeps the
 * three dashed treatments in this app distinct rather than overloaded:
 *   - connector dash "1 6"  -> edge kind (here)
 *   - node stroke dash "3 4" -> status is emerging/unwitnessed (theme.ts)
 *   - dimmed connector       -> an endpoint's role is still "unknown"
 */
export function connectionStyle(
  sourceId: EndpointId,
  targetId: EndpointId,
): ConnectionStyle {
  return sourceId === SELF_ID || targetId === SELF_ID ? "solid" : "dashed";
}

/**
 * A single key identifying the pair two endpoints form, regardless of which
 * way round they are given. Two parts hold at most one connection between
 * them, so A->B and B->A are the same edge and collide on this key.
 *
 * Direction still means something and is still stored — the detail panel reads
 * it to say "protects ->" versus "<- triggers" — but it does not earn a second
 * line on the canvas. Two connectors between the same pair bow the same way
 * and land on top of each other, labels and all.
 */
export function connectionPairKey(a: EndpointId, b: EndpointId): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

/**
 * Connectors touching a part whose role is still "unknown" are dimmed, since
 * the dash pattern is spoken for. Self is never unknown.
 */
export function connectionOpacity(
  sourceRole: EndpointRole,
  targetRole: EndpointRole,
  base: number,
): number {
  const unsurfaced = sourceRole === "unknown" || targetRole === "unknown";
  return unsurfaced ? base * 0.6 : base;
}

/**
 * Split a part name across at most two lines, the way the comp wraps "The
 * Fixer" and "The Unseen One".
 */
export function wrapLabel(name: string, maxChars = 12): [string] | [string, string] {
  const trimmed = name.trim();
  if (trimmed.length <= maxChars) return [trimmed];

  const words = trimmed.split(/\s+/);
  if (words.length === 1) return [trimmed];

  // Minimise the longest of the two lines, breaking ties toward the earlier
  // split. That reproduces the comp's own wrapping for both of its wrapped
  // labels: "The / Fixer" and "The / Unseen One".
  let bestSplit = 1;
  let bestLongest = Infinity;

  for (let i = 1; i < words.length; i += 1) {
    const head = words.slice(0, i).join(" ").length;
    const tail = words.slice(i).join(" ").length;
    const longest = Math.max(head, tail);
    if (longest < bestLongest) {
      bestLongest = longest;
      bestSplit = i;
    }
  }

  return [words.slice(0, bestSplit).join(" "), words.slice(bestSplit).join(" ")];
}
