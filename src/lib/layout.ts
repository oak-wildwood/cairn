import { scalePoint } from "d3-scale";
import { CONNECTION, isLowDefinition, NODE, VIEWBOX } from "./theme";
import type { ConnectorColorKey } from "./theme";
import { SELF_ID } from "./types";
import type {
  Connection,
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
 * Derived from the design's node diameter (~95) plus room for the label beneath.
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
 *   - node stroke dash "3 4" -> status is emerging/unwitnessed (`nodeStrokeDashArray`)
 *   - dimmed connector       -> an endpoint's role is still "unknown"
 */
export function connectionStyle(
  sourceId: EndpointId,
  targetId: EndpointId,
): ConnectionStyle {
  return sourceId === SELF_ID || targetId === SELF_ID ? "solid" : "dashed";
}

/**
 * A single key identifying one *directed* edge. A->B and B->A are different
 * keys, and a pair is allowed to hold both.
 *
 * That is a domain rule rather than a convenience. IFS treats protection and
 * triggering as two distinct relations that routinely hold between the same
 * pair at once, in opposite directions: an exile activates its protector while
 * that protector works to suppress the exile. Collapsing a pair to one edge
 * would leave the map unable to state the thing it exists to state — and the
 * seed data already draws both `protects` and `triggers`. Polarization is the
 * symmetric case, and a user simply draws that one once.
 *
 * What this key still forbids is the same direction twice, which is the actual
 * failure it was introduced for: two A->B connectors bow identically, sit
 * exactly on top of each other, and interleave their labels into nonsense.
 */
export function connectionEdgeKey(
  sourceId: EndpointId,
  targetId: EndpointId,
): string {
  return `${sourceId}\u0000${targetId}`;
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
 * A node's stroke dash, which encodes *status* alone: "emerging" and
 * "unwitnessed" parts are drawn low-definition, whatever their role and
 * whatever connects to them. Takes only the status so that neither of the
 * other two treatments above can leak into this one.
 */
export function nodeStrokeDashArray(status: string): string | undefined {
  return isLowDefinition(status) ? NODE.mutedDashArray : undefined;
}

/**
 * The ids of connections whose pair also holds the reverse edge. Only these
 * get arrowheads, and only these are spread apart — see `connectorCurve`.
 */
export function reciprocalConnectionIds(
  connections: readonly Pick<Connection, "id" | "sourceId" | "targetId">[],
): Set<string> {
  const edges = new Set(
    connections.map((connection) =>
      connectionEdgeKey(connection.sourceId, connection.targetId),
    ),
  );
  return new Set(
    connections
      .filter((connection) =>
        edges.has(connectionEdgeKey(connection.targetId, connection.sourceId)),
      )
      .map((connection) => connection.id),
  );
}

/**
 * An arrowhead only where direction is otherwise unreadable. A lone
 * connector between two nodes needs none — there is nothing to confuse it
 * with, and the original design drew none — but the two arcs of a reciprocal
 * pair look identical apart from their labels, so each names which end it
 * points at. The marker ids are the ones `Diagram.svelte` defines.
 */
export function connectorMarkerEnd(
  reciprocal: boolean,
  colorKey: ConnectorColorKey,
): string | undefined {
  return reciprocal ? `url(#arrow-${colorKey})` : undefined;
}

/** One end of a connector: where its node sits and how big it is. */
export interface ConnectorEndpoint {
  id: EndpointId;
  point: Point;
  /** Node radius, so the line stops at the circle's edge rather than centre. */
  radius: number;
}

/**
 * The three points a connector's curve passes through. `bow` is on the curve,
 * so it doubles as the label anchor.
 */
export interface ConnectorCurve {
  start: Point;
  bow: Point;
  end: Point;
}

/**
 * Trim the chord by each node's radius so the line meets the circles' edges,
 * then bow it off that chord. The bow always pushes away from Self, so
 * connectors arc around the centre instead of cutting across it.
 *
 * Null when the nodes overlap and there is nothing to draw.
 */
export function connectorCurve(
  source: ConnectorEndpoint,
  target: ConnectorEndpoint,
  reciprocal: boolean,
): ConnectorCurve | null {
  const dx = target.point.x - source.point.x;
  const dy = target.point.y - source.point.y;
  const length = Math.hypot(dx, dy);

  // Overlapping nodes leave nothing to draw.
  if (length <= source.radius + target.radius) return null;

  const ux = dx / length;
  const uy = dy / length;

  const start: Point = {
    x: source.point.x + ux * source.radius,
    y: source.point.y + uy * source.radius,
  };
  const end: Point = {
    x: target.point.x - ux * target.radius,
    y: target.point.y - uy * target.radius,
  };

  const mid: Point = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const perp: Point = { x: uy, y: -ux };

  // When an endpoint is Self, `mid` sits on the origin and is always
  // collinear with the chord, so the dot product below is exactly zero and
  // its sign is floating-point noise — flipping every pointer-move mid-drag
  // reads as the curve flickering between mirror images. Key off which
  // field holds Self instead; that's fixed for the connection's lifetime.
  const touchesSelf = source.id === SELF_ID || target.id === SELF_ID;
  const away = touchesSelf
    ? source.id === SELF_ID ? 1 : -1
    : mid.x * perp.x + mid.y * perp.y >= 0 ? 1 : -1;
  // A reciprocal pair would otherwise draw one arc twice. `perp` flips with
  // direction and so does `away`, so the two flips cancel and both bows land
  // on exactly the same point — which is what made a second connection
  // useless before. A term that does *not* carry `away` breaks the symmetry,
  // because `perp` alone still flips it: the two arcs then split evenly
  // either side of the single bow they used to share, and the shared one
  // stays where it was for every non-reciprocal connector.
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  const spread = reciprocal ? CONNECTION.reciprocalSpread : 0;
  const offset = chord * (CONNECTION.bowRatio * away + spread);

  const bow: Point = {
    x: mid.x + perp.x * offset,
    y: mid.y + perp.y * offset,
  };

  return { start, bow, end };
}

/**
 * The compact "role · status · active" caption shown on a node and echoed in
 * its detail panel — one place for the join so the two don't drift apart.
 * `status` and `active` are independent (see `types.ts`), and either can be
 * empty/false, so segments are only included when they have something to
 * say — a blank `status` must not leave a dangling "· ·" behind.
 */
export function partCaption(part: Pick<Part, "role" | "status" | "active">): string {
  const segments: string[] = [part.role];
  if (part.status.trim() !== "") segments.push(part.status.trim());
  if (part.active) segments.push("active");
  return segments.join(" · ");
}

/** The legend's three filters, bundled — see `MapStore`'s fields of the same names. */
export interface MapFilters {
  activeFilter: SectorRole | null;
  activeOnlyFilter: boolean;
  tagFilter: readonly string[];
}

/**
 * Whether a part survives the legend's filters — the one place this is
 * decided, so `Diagram.svelte`'s dimming and a PDF export's "only the parts
 * shown" scope can't quietly disagree about which parts that means. The
 * three filters are independent — "active" managers tagged "shame" is a
 * valid combination — so all three have to pass; tags themselves are OR'd
 * against each other, since a part usually carries more than one.
 *
 * Self has no role, no `active` field and no `feelings`, so it is never
 * asked here — `Diagram.svelte` keeps that special case ("Self always
 * survives") local to itself rather than folding a non-`Part` case into this
 * signature.
 *
 * The part's own fields are positional rather than bundled into an object:
 * `Diagram.svelte` calls this once per part and twice per connection on
 * every render, so a wrapper object here would mean allocating one on every
 * one of those calls for no reason — `filters`, the same for all of them in
 * one render, is the one still worth bundling.
 */
export function survivesFilters(
  role: Part["role"],
  active: boolean,
  feelings: readonly string[],
  filters: MapFilters,
): boolean {
  const survivesRole = filters.activeFilter === null || role === filters.activeFilter;
  const survivesActive = !filters.activeOnlyFilter || active;
  const survivesTags =
    filters.tagFilter.length === 0 ||
    feelings.some((tag) => filters.tagFilter.includes(tag));
  return survivesRole && survivesActive && survivesTags;
}

/**
 * Split a part name across at most two lines, the way the design wraps "The
 * Fixer" and "The Unseen One".
 */
export function wrapLabel(name: string, maxChars = 12): [string] | [string, string] {
  const trimmed = name.trim();
  if (trimmed.length <= maxChars) return [trimmed];

  const words = trimmed.split(/\s+/);
  if (words.length === 1) return [trimmed];

  // Minimise the longest of the two lines, breaking ties toward the earlier
  // split. That reproduces the design's own wrapping for both of its wrapped
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


/* -------------------------------------------------------------------------- */
/* Framing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * How far a node's rendering reaches past its own centre.
 *
 * `NODE.radius` alone is not the answer: the "ROLE · STATUS" caption hangs
 * below the circle, and it is wider than the circle is. The side figure is
 * derived from the caption's own metrics rather than guessed — at
 * `metaSize` 10.5 and `glyphWidthRatio` 0.5, plus 1.5 of letter-spacing, a
 * glyph advances about 6.75 units, so a long caption like
 * "FIREFIGHTER · UNWITNESSED" runs to roughly 170 wide, or 85 either side of
 * centre. Rounded up to 90 for the descenders on a longer free-text status.
 */
const NODE_EXTENT = {
  /** The circle, plus room for the ring a selected node draws. */
  up: NODE.radius + 8,
  /** The caption's baseline, plus its own height. */
  down: NODE.metaOffset + NODE.metaSize,
  side: 90,
} as const;

/**
 * Growth is quantised to 5% steps so that dragging a node past the edge nudges
 * the frame outward in small jumps rather than rescaling the whole diagram
 * continuously under the pointer.
 */
const SCALE_STEP = 0.05;

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The frame to draw the diagram in: `theme.ts`'s composition, widened only as
 * far as the content demands.
 *
 * `VIEWBOX` is a settled design value and stays the *minimum* frame, so a map
 * that fits inside it is composed exactly as the design intended — the nebula
 * washes, sector labels and star field all sit where they were placed. What it
 * cannot be is a hard limit. The sectors overflow onto rings 120 units further
 * out (`RING_GAP`), and the manager sector is narrow enough to hold only two
 * parts on the first ring, so a fourth manager already lands past the fixed
 * top edge. With a fixed frame that part is not merely cropped in an export —
 * it is invisible in the app, with nothing to say it exists.
 *
 * The frame therefore scales *uniformly about its own centre* rather than
 * being fitted to a bounding box of the content. Fitting a box would change the
 * aspect ratio and slide the centre, distorting a composition that is radial
 * around Self by construction. Scaling keeps every relationship in the design
 * intact and simply stands further back.
 */
export function computeViewBox(positions: Iterable<Point>): ViewBox {
  const centreX = VIEWBOX.x + VIEWBOX.width / 2;
  const centreY = VIEWBOX.y + VIEWBOX.height / 2;
  const halfWidth = VIEWBOX.width / 2;
  const halfHeight = VIEWBOX.height / 2;

  let scale = 1;
  for (const { x, y } of positions) {
    const sideReach = Math.abs(x - centreX) + NODE_EXTENT.side;
    const verticalReach = Math.max(
      centreY - (y - NODE_EXTENT.up),
      y + NODE_EXTENT.down - centreY,
    );
    scale = Math.max(scale, sideReach / halfWidth, verticalReach / halfHeight);
  }

  scale = Math.ceil(scale / SCALE_STEP) * SCALE_STEP;

  return {
    x: Math.round(centreX - halfWidth * scale),
    y: Math.round(centreY - halfHeight * scale),
    width: Math.round(VIEWBOX.width * scale),
    height: Math.round(VIEWBOX.height * scale),
  };
}
