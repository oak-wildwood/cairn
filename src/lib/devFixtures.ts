import { SELF_ID } from "./types";
import type { Connection, Part, PartRole } from "./types";

/**
 * Generated maps for exercising the layout at sizes the six-part sample never
 * reaches.
 *
 * The sample is deliberately small — it is the first thing a visitor sees, and
 * it is drawn from the original design's six parts. But PLAN.md targets 10–40
 * parts, and almost everything that goes wrong at that size is invisible at
 * six: sectors overflow onto outer rings, the frame has to grow to hold them,
 * connector labels crowd, and an export has to fit the lot. This makes those
 * sizes reachable without hand-building a map every time.
 *
 * **Development only.** It is reached by a `?parts=` query string and guarded
 * by `import.meta.env.DEV`, which Vite resolves at build time so the whole
 * module drops out of a production bundle. It also never persists: the store
 * seeds a fixture with `showingExample` left true, so the save effect declines
 * to write and a real map in localStorage cannot be overwritten by loading
 * one.
 *
 * The names are transparently synthetic — "Manager 3", not a plausible part
 * name — so that a screenshot of a fixture can never be mistaken for somebody
 * s real map. No real parts data belongs in this repo.
 */

const ROLE_CYCLE: readonly PartRole[] = [
  "manager",
  "firefighter",
  "exile",
  "manager",
  "exile",
  "firefighter",
];

/** Cycled so every fixture exercises the dashed low-definition treatments. */
const STATUS_CYCLE: readonly string[] = [
  "active",
  "active",
  "emerging",
  "witnessed",
  "active",
  "unwitnessed",
];

function makePart(index: number, role: PartRole, status: string): Part {
  const ordinal = index + 1;
  return {
    id: `fixture-${ordinal}`,
    name: `${role === "unknown" ? "Unplaced" : role[0].toUpperCase() + role.slice(1)} ${ordinal}`,
    role,
    description: `Generated fixture part ${ordinal}.`,
    feelings: ["placeholder"],
    bodyLocation: "—",
    trigger: "—",
    positiveIntention: "—",
    fears: "—",
    origins: "—",
    notes: "Generated for layout testing.",
    status,
    x: null,
    y: null,
  };
}

/**
 * A map of `count` parts, cycling roles so the three sectors fill at roughly
 * the rate a real map would, and every sixth part left `unknown` so the
 * outside ring is exercised too.
 */
export function makeFixtureMap(count: number): {
  parts: Part[];
  connections: Connection[];
} {
  const parts: Part[] = [];
  for (let index = 0; index < count; index += 1) {
    const role = index % 6 === 5 ? "unknown" : ROLE_CYCLE[index % ROLE_CYCLE.length];
    parts.push(makePart(index, role, STATUS_CYCLE[index % STATUS_CYCLE.length]));
  }

  // Enough connectors to crowd the canvas the way a real map does, without
  // trying to say anything true about IFS: every third part reaches Self, and
  // the rest chain to the part before them.
  const connections: Connection[] = parts.map((part, index) => ({
    id: `fixture-c-${index + 1}`,
    sourceId: index % 3 === 0 ? SELF_ID : parts[index - 1].id,
    targetId: part.id,
    label: index % 3 === 0 ? "witnessing" : "protects",
  }));

  return { parts, connections: connections.slice(1) };
}

/**
 * The fixture named by `?parts=<n>`, or null when there isn't one. Clamped
 * rather than validated away: a nonsense value should still land somewhere
 * useful instead of silently doing nothing.
 */
export function fixtureFromQuery(
  search: string = location.search,
): { parts: Part[]; connections: Connection[] } | null {
  if (!import.meta.env.DEV) return null;
  const requested = new URLSearchParams(search).get("parts");
  if (requested === null) return null;
  const count = Number.parseInt(requested, 10);
  if (!Number.isFinite(count) || count <= 0) return null;
  return makeFixtureMap(Math.min(count, 60));
}
