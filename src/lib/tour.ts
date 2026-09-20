/**
 * The guided tour's step config and its "have they seen it" flag.
 *
 * Steps point at real UI by a `data-tour` marker (the same pattern as
 * `data-export-hide` in `pdfExport.ts`) rather than by prop-drilling element
 * refs through every component between here and there. `TourOverlay.svelte`
 * resolves each step's `target` with `document.querySelector` and measures
 * it fresh every frame, so it stays correct across resizes, panel-open
 * transitions and the diagram's own pan/zoom without this module knowing
 * anything about layout.
 */

export type TourPlacement = "top" | "bottom" | "left" | "right";

export interface TourStep {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** Matches `[data-tour="<value>"]`. Null centers the tooltip with no
   * spotlight, for a step whose element can't exist yet — there is no
   * fallback demo content to point at on an empty map. */
  readonly target: string | null;
  readonly placement: TourPlacement;
  /** This step points at the detail panel, so it needs a part selected —
   * `App.svelte` opens one of the user's own parts for the duration. */
  readonly requiresPart?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "map",
    title: "Your map",
    body: "Self sits at the centre, with your parts placed around it by role. Drag to pan, and scroll or pinch to zoom in and out.",
    target: "canvas",
    placement: "top",
  },
  {
    id: "select-part",
    title: "Open a part",
    body: "Click any part to open everything you've recorded about it.",
    target: "part-node",
    placement: "right",
  },
  {
    id: "start-fresh",
    title: "Make the map yours",
    body: "This menu backs your map up to a file, restores one, or clears the sample so you can start fresh with your own parts.",
    target: "map-menu-trigger",
    placement: "bottom",
  },
  {
    id: "add-part",
    title: "Add a part",
    body: "Add a manager, firefighter, or exile — it places itself in the right sector of the map automatically.",
    target: "add-part",
    placement: "bottom",
  },
  {
    id: "feelings",
    title: "Tag its feelings",
    body: "Add feelings straight from a part's detail panel, without opening the full edit form.",
    target: "detail-feelings",
    placement: "left",
    requiresPart: true,
  },
  {
    id: "fields",
    title: "Everything about a part",
    body: "Body location, trigger, positive intention, fears, origins, notes — a part's whole worksheet lives here, filled in as you learn it.",
    target: "detail-fields",
    placement: "left",
    requiresPart: true,
  },
  {
    id: "feelings-filter",
    title: "Filter by feeling",
    body: "Narrow the map down to the parts carrying a particular feeling.",
    target: "feelings-filter",
    placement: "top",
  },
  {
    id: "active-filter",
    title: "Active this week",
    body: "Toggle this to see only the parts that are currently showing up for you.",
    target: "active-filter",
    placement: "top",
  },
  {
    id: "export",
    title: "Take it with you",
    body: "Save the map as an image, export a per-part PDF worksheet, or back the whole map up to a file you can restore later.",
    target: "export",
    placement: "bottom",
  },
];

const SEEN_KEY = "cairn.tour.v1.seen";

/**
 * Whether the tour has already run to completion or been skipped, so
 * `App.svelte` knows not to trigger it again on the next visit. Defaults to
 * "seen" when storage can't be read — a tour that can't remember itself is a
 * repeat nuisance, not a broken app, and erring toward not-interrupting is
 * the safer failure.
 */
export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Best-effort — storage being full or blocked just means the tour offers
    // itself again next visit rather than losing anything a user made.
  }
}
