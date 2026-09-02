import { connectionEdgeKey } from "./layout";
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

/**
 * Previews share an origin with production — GitHub Pages serves
 * `/cairn/` and `/cairn/pr-preview/pr-<n>/` from `oak-wildwood.github.io` —
 * and localStorage is scoped to origin, not path. On a single key, testing a
 * preview writes into the map the live site reads, and two previews overwrite
 * each other.
 *
 * So a preview gets a bucket of its own and production keeps the bare key:
 * changing the key production has always used would orphan a stored map, and
 * that map is the whole point of persisting one.
 *
 * Read off `location.pathname` rather than `import.meta.env.BASE_URL`, which
 * cannot tell these apart — `base` is relative in `vite.config.ts`, so
 * BASE_URL is the literal "./" on every deploy.
 */
function storageKey(): string {
  const base = "cairn.map.v1";
  // Matches the preview folder itself, so the key doesn't change between
  // `/pr-preview/pr-9/` and `/pr-preview/pr-9/index.html`.
  const preview = location.pathname.match(/\/pr-preview\/[^/]+\//);
  return preview ? `${base}:${preview[0]}` : base;
}

const STORAGE_KEY = storageKey();

/** How long the map must sit still before a write. */
const SAVE_DELAY_MS = 400;

/**
 * The demo page (`demo/index.html`, served at `/demo/` — see
 * `vite.config.ts`) is a second static entry alongside the real app, not a
 * mode the main app can be switched into. It exists so someone can look at
 * the seed map in one tab while their own map stays open in another, so it
 * must never read or write the real map's storage key: doing either would
 * let the two tabs fight over the same blob.
 */
function isDemoRoute(): boolean {
  return /\/demo\/?$/.test(location.pathname);
}

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
    state.connections.every(isConnection) &&
    // Absent is valid — see the field's note in types.ts. Only a present-but-
    // wrong-typed value makes the blob unusable.
    (state.ownerName === undefined || isString(state.ownerName))
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
  // A pair may hold one connection per direction, so this dedupes on the
  // directed key and leaves a legitimate reverse edge alone. Only an exact
  // repeat of the same direction is dropped — a hand-edited blob, or one
  // written under the older unordered rule, can still carry those, and a
  // repeat is unusable rather than merely untidy since the two connectors bow
  // identically and sit on top of each other. The first one wins.
  const seen = new Set<string>();

  return {
    ...state,
    connections: state.connections.filter((connection) => {
      if (!resolves(connection.sourceId) || !resolves(connection.targetId)) {
        return false;
      }
      if (connection.sourceId === connection.targetId) return false;
      const key = connectionEdgeKey(connection.sourceId, connection.targetId);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  };
}

/**
 * Parse a map out of JSON text, or null when it isn't one.
 *
 * A file the user picked off disk is exactly as untrusted as a hand-edited
 * localStorage blob — more so, since it may have been written by an older
 * build or by hand — so it goes through the same field-by-field checks and the
 * same tidy-up rather than a looser path of its own.
 */
export function parseMap(text: string): PersistedState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isPersistedState(parsed)) return null;
  return withResolvableConnections(parsed);
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
  if (isDemoRoute()) return null;

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
  if (isDemoRoute()) return;

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
  if (isDemoRoute()) return;

  clearTimeout(pending);
  pending = setTimeout(() => saveState(state), SAVE_DELAY_MS);
}
