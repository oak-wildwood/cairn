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
- Match the Nocturnal comp's actual values (colors, blur radii, font sizes) rather
  than approximating "something dark and glowy" — the comp is the spec.
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
export type ConnectionStyle = "solid" | "dashed";

export interface Part {
  id: string;               // uuid
  name: string;
  role: PartRole;
  description: string;
  bodyLocation: string;
  trigger: string;
  positiveIntention: string;
  fears: string;
  origins: string;
  notes: string;
  status: string;           // free text, e.g. "active", "emerging", "witnessed", "unwitnessed"
  x: number | null;         // manual override; null = use computed layout position
  y: number | null;
}

export interface Connection {
  id: string;
  sourceId: string;         // Part.id, or "self"
  targetId: string;         // Part.id
  label: string;            // e.g. "protects", "triggers", "soothes"
  style: ConnectionStyle;
}

// Persisted blob (localStorage)
export interface PersistedState {
  schemaVersion: 1;
  parts: Part[];
  connections: Connection[];
}
```

The field list comes directly from IFS practitioner worksheets (name, role,
description, body location, trigger, positive intention, fears, origins, notes) —
not invented from scratch.

## File structure

```
src/
  main.ts
  vite-env.d.ts
  App.svelte
  lib/
    types.ts                  // Part, Connection, PartRole, ConnectionStyle, PersistedState
    store.svelte.ts           // $state: parts, connections, activeFilter, editingPartId
    layout.ts                 // pure fns: zone -> angle range, index -> position
    theme.ts                  // Nocturnal palette + type tokens as constants
    persistence.ts            // localStorage load/save, debounced, versioned
    export.ts                 // SVG -> canvas -> PNG download
    components/
      Diagram.svelte           // the <svg>, owns filters/defs, iterates connections then parts
      SelfNode.svelte
      PartNode.svelte          // circle + glow filter + labels; drag handling
      Connection.svelte        // one bezier path, styled by relationship type
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
comfortably fit at one radius. `layout.js` exports a pure function
`computeLayout(parts) -> Map<partId, {x, y}>` with no DOM or D3-selection involvement.

Drag writes `part.x` / `part.y` directly (no longer `null`); the layout function is
only consulted for parts where `x`/`y` are `null`. A "Re-arrange" action (post-v1)
would just reset all parts' `x`/`y` to `null`.

## Milestones

Each milestone's definition of done includes `npm run check` passing with 0
errors/warnings and `npm run build` succeeding — not just "looks right in the dev
server." Commit at milestone boundaries, not mid-milestone.

1. **Static render** — hardcode 6 example parts (Inner Critic, The Planner, The
   Scroller, Catastrophizer, Little One, The Forgotten One) typed against `types.ts`,
   render the full Nocturnal-styled diagram with no interactivity. Goal: pixel-match
   the comp before any state management exists.
2. **Store + reactive render** — move the hardcoded data into `store.svelte.ts`;
   `Diagram.svelte` renders from the store via `{#each}`.
3. **Add/Edit Part modal** — `PartModal.svelte` with all worksheet-derived fields;
   wire to store (add new part, edit existing, delete).
4. **Drag to reposition** — pointer events on `PartNode.svelte`, writes manual
   `x`/`y` override to the store.
5. **Filter legend** — `Legend.svelte` toggles `activeFilter`; `Diagram.svelte` dims/
   hides non-matching parts (opacity, not removal — positions stay stable).
6. **Persistence** — `persistence.ts` loads on mount, saves on a debounced `$effect`
   watching the store; versioned blob per the data model above. Validate the parsed
   JSON against the expected shape before trusting it (a hand-edited or stale
   localStorage blob shouldn't crash the app) — a small type guard, not a schema
   library.
7. **PNG export** — `export.ts`: clone the `<svg>`, ensure all styling is inline SVG
   attributes (not external CSS classes) so the clone is self-contained, serialize via
   `XMLSerializer`, draw to an offscreen canvas at 2x for crispness, `toDataURL` ->
   trigger download.
8. **Polish pass** — diff against the Nocturnal comp: glow filter tuning, nebula wash
   placement, font loading (self-host or `<link>` Google Fonts with fallback stacks),
   connector curve smoothness.

## Acceptance criteria for v1

- Add, edit, and delete a part via the modal; changes persist across a page reload.
- Self is always centered; new parts auto-place within their role's sector; existing
  parts can be dragged and keep their position after reload.
- Connections render as curved lines, styled solid/dashed by relationship type,
  colored by the source part's role.
- Filter pills (All / Managers / Firefighters / Exiles) toggle visibility with live
  counts.
- "Export" produces a PNG that visually matches the on-screen state.
- Visual result matches the Nocturnal comp closely enough to be recognizably the same
  design, not just "inspired by."

## Explicitly out of scope for v1

- Daily check-in / Self-energy 1–5 tracking (a plausible v2).
- Any multi-user, sharing, or account system.
- Any backend, API, or persistence beyond localStorage.
- Botanical / Neumorphic theming — explored as alternate comps, not being built now.

## Portfolio note

This repo is public and intended to also show real front-end work — component
architecture, state management, hand-rolled SVG/animation, no framework crutch. Any
demo/seed data used for a deployed preview must stay generic (the example parts
above); no real personal data goes in this repo.

## Open questions

- Deploy target for a live demo, if any (static host, or just local dev) — not
  required for v1, worth deciding before adding export/share features.
- CI currently only checks PR titles (from `gh repo-init`). Worth adding a workflow
  that runs `npm run check` and `npm run build` on PRs once there's real code to
  break — not needed while the repo is just the scaffold.
