import { SCHEMA_VERSION, SELF_ID } from "./types";
import type { Connection, Part, PartRole, PersistedState } from "./types";

/**
 * localStorage persistence for the whole map.
 *
 * Everything here is defensive on the way in and trusting on the way out. The
 * blob is hand-editable, survives across deploys, and is the one input to this
 * app that nobody validated on the way in — so it is checked field by field
 * before it reaches the store. A stale or tampered blob should cost the user
 * their stored map, not crash the app on load.
 */

const STORAGE_KEY = "cairn.map.v1";

/** How long the map must sit still before a write. */
const SAVE_DELAY_MS = 400;

const ROLES: readonly PartRole[] = [
  "manager",
  "firefighter",
  "exile",
  "unknown",
];

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isPart(value: unknown): value is Part {
  if (typeof value !== "object" || value === null) return false;
  const part = value as Record<string, unknown>;
  return (
    isString(part.id) &&
    isString(part.name) &&
    isString(part.role) &&
    ROLES.includes(part.role as PartRole) &&
    isString(part.description) &&
    Array.isArray(part.feelings) &&
    part.feelings.every(isString) &&
    isString(part.bodyLocation) &&
    isString(part.trigger) &&
    isString(part.positiveIntention) &&
    isString(part.fears) &&
    isString(part.origins) &&
    isString(part.notes) &&
    isString(part.status) &&
    (part.x === null || typeof part.x === "number") &&
    (part.y === null || typeof part.y === "number")
  );
}

function isConnection(value: unknown): value is Connection {
  if (typeof value !== "object" || value === null) return false;
  const connection = value as Record<string, unknown>;
  return (
    isString(connection.id) &&
    isString(connection.sourceId) &&
    isString(connection.targetId) &&
    isString(connection.label)
  );
}

function isPersistedState(value: unknown): value is PersistedState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  return (
    state.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(state.parts) &&
    state.parts.every(isPart) &&
    Array.isArray(state.connections) &&
    state.connections.every(isConnection)
  );
}

/**
 * Drop connections whose endpoints no longer exist. The app maintains this
 * itself — deleting a part cascades — but a blob edited by hand, or written by
 * an older build, can still name a part that isn't there, and a dangling
 * endpoint would silently vanish from the diagram rather than announce itself.
 */
function withResolvableConnections(state: PersistedState): PersistedState {
  const ids = new Set(state.parts.map((part) => part.id));
  const resolves = (id: string): boolean => id === SELF_ID || ids.has(id);
  return {
    ...state,
    connections: state.connections.filter(
      (connection) =>
        resolves(connection.sourceId) && resolves(connection.targetId),
    ),
  };
}

/**
 * The stored map, or null when there is nothing usable to load — no blob yet,
 * unreadable storage, unparseable JSON, or a shape that doesn't validate.
 *
 * Returning null for all four is deliberate: from the caller's point of view
 * "no map to restore" is one situation, and the only sensible response to each
 * is the same.
 */
export function loadState(): PersistedState | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private windows and blocked site data throw on access rather than
    // returning null.
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return isPersistedState(parsed) ? withResolvableConnections(parsed) : null;
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A full or unavailable store shouldn't take the app down mid-edit. The
    // in-memory map stays correct; only the durability is lost.
  }
}

let pending: ReturnType<typeof setTimeout> | undefined;

/**
 * Coalesce a burst of edits into one write. Typing in the modal doesn't reach
 * the store, but dragging will (Milestone 5), and that fires continuously.
 */
export function saveStateDebounced(state: PersistedState): void {
  clearTimeout(pending);
  pending = setTimeout(() => saveState(state), SAVE_DELAY_MS);
}
