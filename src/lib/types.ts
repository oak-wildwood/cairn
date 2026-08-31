/**
 * Core domain types for Cairn.
 *
 * `role` and `style` are string-literal unions rather than enums: no runtime
 * footprint, and cleaner under `isolatedModules`. Invalid values are caught at
 * compile time everywhere they're used — the modal form, the filter legend, and
 * connector styling all narrow against the same union.
 */

/**
 * "unknown" is a real, functional role — a part that has been noticed but not
 * yet identified as protector or exile — not a type-level fallback. It is a
 * selectable option in the Add/Edit Part modal. It dims the connectors touching
 * it (`connectionOpacity`); it does not change their dash, which encodes edge
 * kind instead. See the three treatments spelled out in `layout.ts`.
 */
export type PartRole = "manager" | "firefighter" | "exile" | "unknown";

/** The three roles that own an angular sector in the radial layout. */
export type SectorRole = Exclude<PartRole, "unknown">;

/** Derived at render time from the two endpoint ids — never stored. */
export type ConnectionStyle = "solid" | "dashed";

/** The Self node is a valid connection endpoint but is not a `Part`. */
export const SELF_ID = "self";
export type SelfId = typeof SELF_ID;

/** A connection endpoint is either a part's id or the fixed Self node. */
export type EndpointId = string | SelfId;

/**
 * Self has no `PartRole`, but connection styling has to consider both
 * endpoints, so it gets its own endpoint-role tag. Self is never "unknown".
 */
export type EndpointRole = PartRole | SelfId;

/**
 * A point in diagram space. The origin is the Self node at the centre of the
 * canvas, x grows right and y grows down (SVG convention), so a bearing of 0°
 * points at negative y. See `layout.ts`.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * The field list is taken from IFS practitioner worksheets rather than invented:
 * name, role, description, feelings, body location, trigger, positive intention,
 * fears, origins, notes.
 */
export interface Part {
  id: string;
  name: string;
  role: PartRole;
  description: string;
  /** Short tags, e.g. ["exhausted", "sad", "forgotten"]. */
  feelings: string[];
  bodyLocation: string;
  trigger: string;
  positiveIntention: string;
  fears: string;
  origins: string;
  notes: string;
  /** Free text, e.g. "active", "emerging", "witnessed", "unwitnessed". */
  status: string;
  /** Manual drag override; null means "use the computed layout position". */
  x: number | null;
  y: number | null;
}

export interface Connection {
  id: string;
  sourceId: EndpointId;
  /**
   * Self is a valid endpoint at either end — the comp draws both a
   * Fixer -> Self edge and a Self -> Kid edge.
   */
  targetId: EndpointId;
  /** The relationship, e.g. "protects", "triggers", "soothes". May be empty. */
  label: string;
}

/** The persisted localStorage blob. */
export interface PersistedState {
  schemaVersion: 1;
  parts: Part[];
  connections: Connection[];
}

export const SCHEMA_VERSION = 1 satisfies PersistedState["schemaVersion"];
