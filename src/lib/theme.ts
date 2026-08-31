import type { PartRole, SectorRole } from "./types";

/**
 * The Nocturnal palette and type tokens. **This file is the design spec.**
 *
 * These values came from a Nocturnal comp that was never checked in and is not
 * part of this project any more, so there is nothing left to diff against and
 * nothing to go and re-measure: what is written here *is* the design, and it is
 * the tie-breaker in any visual disagreement.
 *
 * The DERIVED marker is therefore about provenance, not about a file you could
 * open. An unmarked value was settled by the original Nocturnal design — treat
 * it as considered, and change it only deliberately. A DERIVED value was
 * reasoned out here for something that design never covered, and its comment
 * carries the reasoning; those are open to revisit on their merits.
 *
 * The original artwork was laid out on a 900x1100 page, which was illustrative
 * of relative layout only — the live diagram sizes to the viewport — so
 * coordinates were never copied verbatim. Colors, gradient stops, filter
 * deviations, stroke widths and type were.
 */

/* -------------------------------------------------------------------------- */
/* Background                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * radialGradient #bgGrad. The source artwork declared it in objectBoundingBox
 * units (cx 50%, cy 40%, r 80% of its 900x1100 page); here it is pinned to user
 * space instead, so the wash keeps the same geometry no matter how wide the
 * viewport makes the backdrop rect. The centre is that artwork's (450, 440)
 * expressed as an offset from Self.
 */
export const BACKGROUND_GRADIENT = {
  cx: 0,
  cy: -160,
  r: 800,
  stops: [
    { offset: "0%", color: "#20263A" },
    { offset: "55%", color: "#171A28" },
    { offset: "100%", color: "#0B0C12" },
  ],
} as const;

/**
 * The backdrop rect is drawn far larger than the viewBox so the gradient still
 * covers the canvas at any aspect ratio, instead of leaving bars at the sides.
 */
export const BACKDROP = { x: -1500, y: -1500, size: 3000 } as const;

/** Star field: fill #F4F1E8, radii 1.2–1.6, opacity 0.3–0.5. */
export const STAR_COLOR = "#F4F1E8";

/* -------------------------------------------------------------------------- */
/* Filters                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * filter #glow — feGaussianBlur stdDeviation 3, merged *under* SourceGraphic.
 * Region is -60%/220% so the bloom isn't clipped.
 */
export const GLOW_FILTER = {
  stdDeviation: 3,
  region: { x: "-60%", y: "-60%", width: "220%", height: "220%" },
} as const;

/** filter #softBlur — the nebula washes. */
export const SOFT_BLUR_FILTER = {
  stdDeviation: 46,
  region: { x: "-100%", y: "-100%", width: "300%", height: "300%" },
} as const;

/* -------------------------------------------------------------------------- */
/* Self                                                                        */
/* -------------------------------------------------------------------------- */

export const SELF = {
  /** radialGradient #selfGlowN, painted on a circle of r = 140 (2.06x the node). */
  glowStops: [
    { offset: "0%", color: "#F6E7C4", opacity: 0.95 },
    { offset: "45%", color: "#E8C98C", opacity: 0.3 },
    { offset: "100%", color: "#E8C98C", opacity: 0 },
  ],
  glowRadiusRatio: 140 / 68,
  radius: 68,
  fill: "#161A28",
  stroke: "#E8C98C",
  strokeWidth: 1.4,
  labelColor: "#F6E7C4",
  labelSize: 24,
} as const;

/* -------------------------------------------------------------------------- */
/* Roles                                                                       */
/* -------------------------------------------------------------------------- */

export interface RoleTokens {
  /** Node stroke and the connection color when this role is the source. */
  readonly accent: string;
  /** Dimmed accent for the meta caption under a low-definition node. */
  readonly accentMuted: string;
  /** The sector caption around the canvas edge — its own desaturated tone. */
  readonly sectorLabel: string;
  /** Filter-pill label text, tinted toward the role. */
  readonly pillText: string;
  readonly nodeFill: string;
  /** The nebula wash marking this role's sector. */
  readonly wash: { readonly color: string; readonly opacity: number };
}

export const ROLES: Readonly<Record<PartRole, RoleTokens>> = {
  manager: {
    accent: "#8FA3E3",
    pillText: "#B9BEDA",
    // DERIVED: the source design has no low-definition manager node, so there
    // is no muted manager accent to inherit. Matched to the shift it applies for
    // firefighter (#E38F6B -> #C1876E) and exile (#D9A0C9 -> #B87BB0).
    accentMuted: "#7C8BC4",
    sectorLabel: "#8A93C4",
    nodeFill: "#1A1F30",
    wash: { color: "#5A6BC0", opacity: 0.2 },
  },
  firefighter: {
    accent: "#E38F6B",
    pillText: "#E0B9A6",
    accentMuted: "#C1876E",
    sectorLabel: "#D9997A",
    nodeFill: "#1A1F30",
    wash: { color: "#C97A50", opacity: 0.18 },
  },
  exile: {
    accent: "#D9A0C9",
    pillText: "#DEBFD6",
    accentMuted: "#B87BB0",
    sectorLabel: "#C592BB",
    nodeFill: "#221B26",
    wash: { color: "#B87BB0", opacity: 0.18 },
  },
  // DERIVED: the source design shows no "unknown" part. A neutral lavender-grey already
  // in the palette (the eyebrow tone) reads as "noticed but not yet identified"
  // without claiming one of the three sector hues. See PLAN.md's open question.
  unknown: {
    accent: "#9AA0C0",
    pillText: "#C2C6D8",
    accentMuted: "#7E839C",
    sectorLabel: "#9AA0C0",
    nodeFill: "#1A1F30",
    wash: { color: "#9AA0C0", opacity: 0.12 },
  },
};

/** Only the three sector roles get a nebula wash and an edge caption. */
export const SECTOR_ROLES: readonly SectorRole[] = [
  "manager",
  "firefighter",
  "exile",
];

/**
 * The live diagram's coordinate space puts Self at the origin. These are the
 * source artwork's canvas-region coordinates (its y 230–1000 band, between the two
 * hairline rules) re-expressed as offsets from Self at (450, 600).
 */
export const VIEWBOX = { x: -450, y: -370, width: 900, height: 770 } as const;

/** Nebula wash marking each sector, in Self-centred diagram space. */
export const WASH_GEOMETRY: Readonly<
  Record<SectorRole, { cx: number; cy: number; rx: number; ry: number }>
> = {
  manager: { cx: -190, cy: -160, rx: 250, ry: 215 },
  firefighter: { cx: 210, cy: -180, rx: 250, ry: 215 },
  exile: { cx: -20, cy: 240, rx: 270, ry: 195 },
};

/** The sector captions, in Self-centred diagram space. */
export const SECTOR_LABEL_POSITIONS: Readonly<
  Record<SectorRole, { x: number; y: number; anchor: "start" | "middle" | "end" }>
> = {
  manager: { x: -320, y: -300, anchor: "start" },
  firefighter: { x: 320, y: -300, anchor: "end" },
  exile: { x: 0, y: 365, anchor: "middle" },
};

/**
 * The star field, restricted to the stars that fall inside the canvas
 * region and re-expressed in Self-centred diagram space.
 */
export const STARS: readonly {
  x: number;
  y: number;
  r: number;
  opacity: number;
}[] = [
  { x: -300, y: -340, r: 1.2, opacity: 0.35 },
  { x: 370, y: -320, r: 1.2, opacity: 0.3 },
  { x: 90, y: -330, r: 1.2, opacity: 0.3 },
  { x: -380, y: 0, r: 1.4, opacity: 0.4 },
  { x: 390, y: 40, r: 1.4, opacity: 0.4 },
  { x: -250, y: 150, r: 1.2, opacity: 0.3 },
  { x: -330, y: 320, r: 1.6, opacity: 0.4 },
  { x: 350, y: 350, r: 1.2, opacity: 0.3 },
];

/* -------------------------------------------------------------------------- */
/* Part nodes                                                                  */
/* -------------------------------------------------------------------------- */

export const NODE = {
  /**
   * DERIVED: the source design's node radii vary 42–56 with nothing in the data model to
   * drive the difference (it tracks neither role nor status), so the live
   * diagram uses one radius near their mean.
   */
  radius: 46,
  /** A fully-defined part: solid stroke, glow filter. */
  strokeWidth: 1.8,
  /** A low-definition part ("emerging"/"unwitnessed"): dashed, thinner, no glow. */
  mutedStrokeWidth: 1.3,
  mutedDashArray: "3 4",
  mutedOpacity: 0.85,
  labelColor: "#EDEAE0",
  mutedLabelColor: "#C9C6BC",
  labelSize: 13.5,
  /** Long names shrink to stay inside the circle rather than spilling over. */
  minLabelSize: 11,
  /** Usable label width across the circle, allowing for the curve at the edges. */
  labelWidth: 82,
  /** Rough advance width of a Manrope glyph, as a fraction of font size. */
  glyphWidthRatio: 0.5,
  /** The "ROLE · STATUS" caption beneath the circle. */
  metaSize: 10.5,
  metaLetterSpacing: 1.5,
  /** Distance from node centre to the meta caption baseline. */
  metaOffset: 63,
  lineHeight: 17,
} as const;

/**
 * Statuses that render as a low-definition node — dashed stroke, no glow,
 * dimmed label. Matched case-insensitively because `status` is free text.
 */
const LOW_DEFINITION_STATUSES: readonly string[] = ["emerging", "unwitnessed"];

export function isLowDefinition(status: string): boolean {
  return LOW_DEFINITION_STATUSES.includes(status.trim().toLowerCase());
}

/**
 * DERIVED: the source design is a static render with no interaction, so it has no
 * connection handles, no drop-target highlight and no connector labels. These
 * are sized against the node geometry above — a handle reads as an
 * affordance on a 46px node without competing with it.
 */
export const HANDLE = {
  radius: 5.5,
  /** Ring drawn around a node the pointer could drop a connection onto. */
  dropTargetRadius: 9,
  dropTargetWidth: 1.6,
  /** Handles fade rather than pop, so hovering across a node isn't strobing. */
  fadeMs: 120,
} as const;

/* -------------------------------------------------------------------------- */
/* Connections                                                                 */
/* -------------------------------------------------------------------------- */

export const CONNECTION = {
  solidWidth: 1.8,
  solidOpacity: 0.85,
  dashedWidth: 1.6,
  dashedOpacity: 0.75,
  /** Connector dashes are dotted, not the node stroke's "3 4". */
  dashArray: "1 6",
  /**
   * How far a connector bows off its chord, as a fraction of chord length.
   * The source design's quadratic control points sit 0.07–0.17 off the chord; this is
   * the middle of that range.
   */
  bowRatio: 0.12,
  /** DERIVED: the source design draws no connector labels; this matches the node meta. */
  labelSize: 10.5,
  labelColor: "#C6C9DA",
  /** Padding behind a label so it doesn't sit directly on its own line. */
  labelPadX: 5,
  labelPadY: 3,
  /** A connector with Self as its source takes Self's gold. */
  selfColor: "#E8C98C",
  selfWidth: 2,
  selfOpacity: 0.9,
  /**
   * DERIVED: extra bow, as a fraction of chord, applied to a connector whose
   * pair also holds the reverse edge. Without it the two draw as one arc — see
   * the derivation in Connection.svelte. 0.09 against a `bowRatio` of 0.12
   * splits them roughly 0.21/0.03 off the chord: far enough apart that neither
   * label touches the other, while the inner arc still reads as a curve rather
   * than a straight line.
   */
  reciprocalSpread: 0.09,
  /**
   * DERIVED: the source design draws no arrowheads, and connectors here don't get one
   * either — except on a reciprocal pair, where two arcs run between the same
   * nodes and nothing else says which way either runs. Measured in
   * stroke-widths so the head stays proportional to the line it caps.
   */
  arrowSize: 6,
} as const;

/**
 * Every colour a connector can take, keyed so a connector and its arrowhead
 * `<marker>` can name the same one. Markers can't inherit their line's stroke
 * portably, so each colour gets its own marker and connectors pick theirs by
 * key rather than by hex.
 */
export const CONNECTOR_COLORS = {
  self: CONNECTION.selfColor,
  manager: ROLES.manager.accent,
  firefighter: ROLES.firefighter.accent,
  exile: ROLES.exile.accent,
  unknown: ROLES.unknown.accent,
} as const;

export type ConnectorColorKey = keyof typeof CONNECTOR_COLORS;

/* -------------------------------------------------------------------------- */
/* Text and chrome                                                             */
/* -------------------------------------------------------------------------- */

export const FONTS = {
  display: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  ui: "'Manrope', ui-sans-serif, system-ui, -apple-system, sans-serif",
} as const;

export const TEXT = {
  /** Headings and the strongest body text. */
  primary: "#F1EEE7",
  /** Node labels, pill labels, "6 parts". */
  bright: "#EDEAE0",
  muted: "#8A8FA8",
  /** The letterspaced eyebrow above the title. */
  eyebrow: "#9AA0C0",
  /** The italic serif footer line. */
  footer: "#C9BFA0",
} as const;

export const CHROME = {
  rule: "#2C3148",
  /** Toolbar buttons. */
  buttonBorder: "#4A5170",
  /** Filter pills, a touch dimmer than the toolbar. */
  pillBorder: "#3A4058",
  pillRadius: 18,
  buttonRadius: 19,
} as const;

export const TYPE_SCALE = {
  eyebrow: { size: 13, letterSpacing: 3, weight: 600 },
  title: { size: 42, weight: 500 },
  count: { size: 16, weight: 600 },
  countMeta: { size: 13 },
  button: { size: 13, weight: 600 },
  pill: { size: 12.5, weight: 600 },
  // DERIVED: the source design's sector labels are 12px; bumped a step for legibility.
  sectorLabel: { size: 13, letterSpacing: 3, weight: 600, opacity: 0.75 },
  footer: { size: 16 },
} as const;
