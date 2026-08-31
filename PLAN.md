# Cairn — Implementation Plan

Cairn is a radial map for Internal Family Systems (IFS) parts work: a fixed **Self**
node at the center, with **parts** (managers, firefighters, exiles) placed around it
in role-based sectors, connected by curved lines showing how they relate.

This document is the build plan. It is not yet executed — see **Milestones** below for
where to start.

## Goal

A single-page, client-only prototype: a radial diagram of parts around a fixed Self
node, an add/edit form per part, localStorage persistence, PNG export. Styled per the
**Nocturnal** direction — dark cosmic background, glowing role-colored nodes, soft
nebula washes marking the three sectors, Cormorant Garamond + Manrope type.

The comp is checked into this repo, not just described in prose:
`design/nocturnal-comp.svg` (source markup — exact hex colors, gradient stops,
filter `stdDeviation`s, coordinates; prefer this over eyeballing pixels) and
`design/nocturnal-comp.png` (flattened reference render, for a quick visual
gut-check). Milestone 1's "pixel-match" and Milestone 10's polish pass both mean:
match `nocturnal-comp.svg`'s actual values.

## Stack

- Vite + Svelte 5 (runes), **TypeScript**, `strict: true`. This project is meant to
  read as current, professional-grade front-end work, not just a personal-scale
  prototype — type everything, don't reach for `any`.
- TypeScript is pinned to the latest **5.x/6.x** line (`^6.0.3` as of this writing),
  not the newest major (TypeScript 7, the Go-native rewrite): `svelte-check` doesn't
  support TS 7 yet (peer range `^5.0.0 || ^6.0.0`), and a broken type-checker would
  undercut the "state of the art" goal more than a one-major-behind pin does. Revisit
  this pin once `svelte-check` catches up — check `npm view svelte-check peerDependencies`
  before bumping.
- D3 used only for its math: `d3-shape` (bezier curve helpers) and `d3-scale`. No
  `d3-selection` / DOM joins — Svelte owns the DOM entirely.
- No component library, no CSS framework — hand-rolled to match the Nocturnal comp
  (SVG filters for glow, radial gradients) exactly.
- No backend, no auth, no build-time data.
- `npm run check` (`svelte-check`) must be clean — 0 errors, 0 warnings — before any
  milestone below is considered done. It already passes on the current scaffold;
  keep it that way rather than accumulating type debt to fix later.

### Why this stack (short version)

- **Three.js** was ruled out — this is a flat 2D diagram, not 3D.
- **Vanilla JS + D3** gives excellent diagram primitives but no opinion on UI state,
  so the modal/filters/list would need hand-written DOM-sync boilerplate.
- **React + React Flow** (and Svelte Flow) give free drag/pan/zoom/state, but their
  layout engines are graph/tree-oriented, not suited to fixed angular sectors around
  a center — we'd fight the library for the exact radial-sector look.
- **AntV G6 / Cytoscape.js / Sigma.js / vis-network** are built for large,
  auto-laid-out abstract networks — wrong tool at ~10–40 hand-positioned nodes.
- **Konva.js / react-konva** (canvas-based) would lose CSS styling and DOM-based
  modals for no performance benefit at this scale.
- **visx** was the closest runner-up (same "D3 does math, framework does DOM"
  philosophy) — Svelte's templating just needs less ceremony per component.

### Code quality bar

This is a public, portfolio-visible repo, and the goal stated for it is explicitly
"best of class / state of the art" — the agent executing this plan should hold to
that, not just get milestones green:

- `strict: true` TypeScript, no `any` without a comment explaining why it's
  unavoidable (e.g. a third-party type gap). Prefer precise types over casting.
- No dead code, no commented-out attempts, no TODO left unresolved at a milestone
  boundary — open a note in this file's Open Questions instead if something's
  genuinely deferred.
- Modal form fields get real `<label for>` associations; drag and filter
  interactions should be operable without a mouse where that's not disproportionate
  effort (filter pills are plain buttons — trivial; full keyboard drag-repositioning
  of nodes is a reasonable thing to explicitly punt on, but say so if punted).
- Match `design/nocturnal-comp.svg`'s actual values (colors, blur radii, font sizes)
  rather than approximating "something dark and glowy" — that file is the spec, not
  a mood board. Its coordinate space (900×1100 viewBox) is illustrative of relative
  layout only — it's not this app's actual viewport, which is a live diagram at
  whatever size the browser gives it — but every color, gradient stop, filter value,
  and font choice in it is exact and should be copied, not approximated.
- Keep components small and single-purpose per the file structure below; if a
  component grows past doing the one thing its name says, that's a signal to split
  it, not a milestone to rush through.

## Data model

These are real `interface`/type declarations to add under `src/lib/types.ts` — not
pseudocode. Keep `role` and `style` as string-literal unions (not `enum`; Svelte/Vite
projects generally prefer literal unions — no runtime footprint, cleaner
`isolatedModules` behavior) so invalid values are caught at compile time everywhere
they're used (modal form, filters, connector styling).

```ts
export type PartRole = "manager" | "firefighter" | "exile" | "unknown";
// "unknown" means a part that hasn't been fully identified/named yet — a real,
// functional role value, not a placeholder, so it must be a selectable option in
// the Add/Edit Part modal rather than just a type-level fallback. It dims the
// connectors touching it (connectionOpacity below); it does not change their dash.
export type ConnectionStyle = "solid" | "dashed";

export interface Part {
  id: string;               // uuid
  name: string;
  role: PartRole;
  description: string;
  feelings: string[];       // short tags, e.g. ["exhausted", "sad", "forgotten"]
  bodyLocation: string;
  trigger: string;
  positiveIntention: string;
  fears: string;
  origins: string;
  notes: string;
  status: string;           // free text, e.g. "active", "emerging", "witnessed", "unwitnessed"
                             // — free text by design (see rationale above the code
                             // block), but the dashed-circle-stroke rule (PartNode,
                             // per the comp) keys off this value, so match it
                             // case-insensitively against "emerging"/"unwitnessed"
                             // rather than assuming exact casing
  x: number | null;         // manual override; null = use computed layout position
  y: number | null;
}

export interface Connection {
  id: string;
  sourceId: string;         // Part.id, or "self"
  targetId: string;         // Part.id
  label: string;            // e.g. "protects", "triggers", "soothes"
}
// ConnectionStyle is not stored on Connection — it's derived at render time from
// the endpoint ids: solid if either endpoint is Self (a part's access to Self),
// dashed between two parts (an inter-part dynamic). See connectionStyle() below.

// Persisted blob (localStorage)
export interface PersistedState {
  schemaVersion: 1;
  parts: Part[];
  connections: Connection[];
}
```

The field list comes directly from IFS practitioner worksheets (name, role,
description, feelings, body location, trigger, positive intention, fears, origins,
notes) — not invented from scratch.

## File structure

```
src/
  main.ts
  vite-env.d.ts
  App.svelte
  lib/
    types.ts                  // Part, Connection, PartRole, ConnectionStyle, PersistedState
    store.svelte.ts           // $state: parts, connections, activeFilter,
                               // selectedPartId (detail panel), editingPartId (modal;
                               // null id = adding new), drawingConnection
                               // ({ sourceId, pointerX, pointerY } | null, live
                               // in-progress drag-to-connect), selectedConnectionId
    layout.ts                 // pure fns: zone -> angle range, index -> position;
                               // connectionStyle(sourceId, targetId) -> "solid" if
                               // either endpoint is Self, else "dashed";
                               // connectionOpacity(sourceRole, targetRole, base)
                               // dims a connector when an endpoint's role is still
                               // "unknown". Three distinct treatments — connector
                               // dash = edge kind, node stroke dash = status
                               // (PartNode), dimmed connector = unsurfaced role —
                               // each channel is spoken for, so don't overload one
    theme.ts                  // Nocturnal palette + type tokens as constants
    persistence.ts            // localStorage load/save, debounced, versioned
    export.ts                 // SVG -> canvas -> PNG download
    components/
      Diagram.svelte           // the <svg>, owns filters/defs, iterates connections then parts
      SelfNode.svelte          // fixed, centered; hover shows connection handles
                                // (no drag-to-reposition, no detail panel)
      PartNode.svelte          // circle + glow filter + labels; dashed circle stroke
                                // when status is "emerging"/"unwitnessed" per the
                                // comp (status-driven, distinct from connection
                                // dashing, which is role-driven — see layout.ts);
                                // hover shows connection handles; pointer gestures
                                // disambiguate click (open detail panel) vs
                                // body-drag (reposition) vs handle-drag (draw
                                // connection)
      Connection.svelte        // one bezier path; solid/dashed via layout.ts's
                                // connectionStyle(), not a stored field; selectable;
                                // renders the inline label editor (foreignObject/
                                // HTML overlay) at its midpoint
      PartDetailPanel.svelte   // read-only side panel, all worksheet-derived fields
                                // plus a read-only Connections list; Edit / Delete
                                // actions for the part itself
      PartModal.svelte         // add/edit form, all worksheet-derived fields
      Legend.svelte            // filter pills, counts via $derived
      Toolbar.svelte           // "+ Add a part" / "Export" buttons
```

Every `.svelte` file's `<script>` tag is `<script lang="ts">`. Nothing beyond
`App.svelte` (placeholder), `main.ts`, and `vite-env.d.ts` exists yet — it gets built
out milestone by milestone below, each one starting from `types.ts` where new shapes
are needed rather than inlining ad hoc types in a component.

## Layout math

Bearing convention: 0° = north/12 o'clock, clockwise.

- Managers: 270°–350°
- Firefighters: 5°–130°
- Exiles: 140°–275°

For each part: angle = evenly distributed within its zone's arc by index among parts
sharing that zone; radius = a base value, bumped outward if a zone has more parts than
comfortably fit at one radius. `layout.ts` exports a pure function
`computeLayout(parts) -> Map<partId, {x, y}>` with no DOM or D3-selection involvement.

Those ranges are not a clean partition: manager and exile overlap across 270°–275°,
and 130°–140° and 350°–5° belong to no sector. That never shows because parts are
distributed with `scalePoint().padding(0.5)`, which insets the first and last node by
half a step and so keeps them off their sector's boundaries. Removing the padding
puts parts into the overlap.

An `"unknown"`-role part has no sector by definition, so it orbits outside all three
on a full-circle ring — see Open questions.

Drag writes `part.x` / `part.y` directly (no longer `null`); the layout function is
only consulted for parts where `x`/`y` are `null`. A part with an override still
consumes its slot in the sector distribution, so dragging one part never reshuffles
its untouched siblings. A "Re-arrange" action (post-v1) would just reset all parts'
`x`/`y` to `null`.

Connector appearance is also decided here, by two pure functions:
`connectionStyle(sourceId, targetId)` returns `"solid"` when either endpoint is Self
and `"dashed"` between two parts — the dash encodes the *kind* of edge, not how sure
of it we are — and `connectionOpacity(sourceRole, targetRole, base)` dims a connector
whose endpoint role is still `"unknown"`. Keeping those separate is deliberate: the
dash pattern is already carrying edge kind, so it cannot also carry how surfaced a
part is.

## Milestones

Each milestone's definition of done includes `npm run check` passing with 0
errors/warnings and `npm run build` succeeding — not just "looks right in the dev
server." Commit at milestone boundaries, not mid-milestone.

1. **Static render** — hardcode the same 6 example parts as `design/nocturnal-comp.svg`
   (The Fixer, The Analyst, The Avoider, Alarmist, The Kid, The Unseen One — same
   names, roles, and statuses) typed against `types.ts`, render the full
   Nocturnal-styled diagram with no interactivity. Goal: pixel-match
   `design/nocturnal-comp.svg` before any state management exists — background
   gradient, nebula washes, star field, Self glow, node strokes/fills per role, the
   dashed-stroke treatment the comp uses for "emerging"/"unwitnessed" statuses, and
   type all copied from that file's actual values.
2. **Store + reactive render** — move the hardcoded data into `store.svelte.ts`;
   `Diagram.svelte` renders from the store via `{#each}`.
3. **Detail panel (read-only)** — `PartDetailPanel.svelte`, a side panel (not a
   modal/overlay) that opens when a part is clicked, showing all worksheet-derived
   fields read-only (description, feelings as tags, body location, trigger, positive
   intention, fears, origins, notes, status). Includes a **Connections** section
   listing every connection touching this part in either direction (as source or
   target), each row showing the relationship label and the other part's name — read
   only at this milestone. Closes via an X or by clicking another part / empty
   canvas. Includes explicit "Edit" and "Delete" actions for the part itself — this
   milestone does not yet make those actions do anything beyond opening the modal
   from Milestone 4 (Edit) and removing the part from the store (Delete). Click must
   be disambiguated from the drag gesture added in Milestone 6, so a click that ends
   without meaningful pointer movement opens the panel; a drag does not.
4. **Add/Edit Part modal** — `PartModal.svelte` with all worksheet-derived fields;
   wire to store (add new part via the Toolbar's "+ Add a part", edit existing via
   the detail panel's "Edit" action). Delete lives on the detail panel, not the
   modal. Deleting a part must also delete every `Connection` where it's the
   `sourceId` or `targetId` — no dangling references left in the store.
5. **Drag to reposition** — pointer events on `PartNode.svelte`, writes manual
   `x`/`y` override to the store. This establishes the pointer-gesture foundation
   (down / move / up, drag-distance threshold to distinguish a drag from a click)
   that Milestone 6 extends for connection-drawing.
6. **Connections via canvas drag** — Excalidraw-style direct manipulation, replacing
   the earlier idea of a form/dropdown-based "add connection" control:
   - **Hover**: hovering a part shows small connection handles on its circumference
     (distinct from the node body, which still initiates the Milestone 5 move-drag).
     `SelfNode` gets the same hover handles — Self is a valid drag-to-connect
     endpoint, matching the data model's existing `sourceId`/`targetId: "self"`.
     Connections to/from Self render and edit identically to part-to-part ones;
     Self has no drag-to-reposition or detail panel, so only the handle gesture
     applies to it.
   - **Draw**: pointer-down on a handle and dragging shows a live line following the
     cursor; dragging over another part (or Self) highlights it as a valid drop
     target; releasing over it creates a `Connection` (`sourceId`/`targetId` from
     the two endpoints); releasing over empty canvas cancels. Its solid/dashed
     rendering is automatic from `connectionStyle()` (Layout math), not something
     set at creation time.
   - **Label**: immediately after a connection is created, a small inline text input
     appears at the connection's midpoint (an absolutely-positioned HTML input over
     the SVG, or a `foreignObject` — not a native SVG `<text>`, which can't be
     edited in place) so the relationship label can be typed right away; blurring
     with an empty label is allowed (editable later) rather than forcing a value.
   - **Edit**: clicking an existing connection's line or label selects it and
     reopens that same inline input to change the label.
   - **Delete**: with a connection selected, a small delete affordance (or the
     Delete/Backspace key) removes it from the store.
   - Three gestures on `PartNode` must now be disambiguated: pointer-down on a
     handle → draw connection; pointer-down on the body that moves past a drag
     threshold → reposition (Milestone 5); pointer-down and up with no meaningful
     movement → open the detail panel (Milestone 3).
   - The detail panel's Connections list (Milestone 3) stays a read-only summary,
     matching the reference inspiration — all creating, editing, and deleting of
     connections happens on the canvas, not in the panel.
7. **Filter legend** — `Legend.svelte` toggles `activeFilter`; `Diagram.svelte` dims/
   hides non-matching parts (opacity, not removal — positions stay stable).
8. **Persistence** — `persistence.ts` loads on mount, saves on a debounced `$effect`
   watching the store; versioned blob per the data model above. Validate the parsed
   JSON against the expected shape before trusting it (a hand-edited or stale
   localStorage blob shouldn't crash the app) — a small type guard, not a schema
   library.
9. **PNG export** — `export.ts`: clone the `<svg>`, ensure all styling is inline SVG
   attributes (not external CSS classes) so the clone is self-contained, serialize via
   `XMLSerializer`, draw to an offscreen canvas at 2x for crispness, `toDataURL` ->
   trigger download.
10. **Polish pass** — diff against the Nocturnal comp: glow filter tuning, nebula
    wash placement, font loading (self-host or `<link>` Google Fonts with fallback
    stacks), connector curve smoothness.

## Acceptance criteria for v1

- Clicking a part opens a read-only detail panel with all of its fields; Edit and
  Delete actions from there reach the modal and store respectively.
- Add, edit, and delete a part via the modal; changes persist across a page reload.
- Self is always centered; new parts auto-place within their role's sector; existing
  parts can be dragged and keep their position after reload.
- Drag from one part (or Self) to another on the canvas to create a connection
  between them; type its relationship label inline immediately after creating it;
  click an existing connection to edit that label or delete it. Connections render
  as curved lines, colored by the source part's role, solid when either endpoint is
  Self and dashed between two parts, dimmed while an endpoint's role is still
  "unknown", and update
  immediately as they're added/edited/deleted. A part's detail panel lists its
  connections read-only, for reference.
- Filter pills (All / Managers / Firefighters / Exiles) toggle visibility with live
  counts.
- "Export" produces a PNG that visually matches the on-screen state.
- Visual result matches the Nocturnal comp closely enough to be recognizably the same
  design, not just "inspired by."

## Explicitly out of scope for v1

- "Open conversation" / guided-dialogue or journaling feature with a part (seen in
  reference inspiration, not this app) — a plausible v2.
- Daily check-in / Self-energy 1–5 tracking (a plausible v2).
- Any multi-user, sharing, or account system.
- Any backend, API, or persistence beyond localStorage.
- Botanical / Neumorphic theming — explored as alternate comps, not being built now.
- A keyboard path for *drawing* connections. Decided, not deferred: the handles
  are a pointer affordance and are hidden from assistive technology rather than
  made focusable, because a focusable control that does nothing on Enter is
  worse than none. What stays reachable without a pointer: a part can be
  selected, read and edited, its connections are listed read-only in the detail
  panel, and a selected connection can be deleted with the Delete key.

## Portfolio note

This repo is public and intended to also show real front-end work — component
architecture, state management, hand-rolled SVG/animation, no framework crutch. Any
demo/seed data used for a deployed preview must stay generic (the example parts
above); no real personal data goes in this repo.

## Open questions

- What does an `"unknown"` role actually mean, and does its treatment follow?
  Answered provisionally in code, because the layout and the palette both had to put
  it *somewhere* once the modal offers the role: `layout.ts` orbits unknown parts on
  a full-circle ring outside the three sectors (reads as "noticed but not yet
  placed", without inventing a fourth sector), and `theme.ts` gives them a neutral
  lavender-grey marked `DERIVED` rather than one of the three sector hues. Both are
  reversible once "not fully surfaced" has a fuller definition.
- Deploy target for a live demo, if any (static host, or just local dev) — not
  required for v1, worth deciding before adding export/share features.
- CI currently only checks PR titles (from `gh repo-init`). Worth adding a workflow
  that runs `npm run check` and `npm run build` on PRs once there's real code to
  break — not needed while the repo is just the scaffold.
