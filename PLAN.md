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

- Vite + Svelte 5 (runes), plain JS — no TypeScript, kept small on purpose for a
  solo prototype.
- D3 used only for its math: `d3-shape` (bezier curve helpers) and `d3-scale`. No
  `d3-selection` / DOM joins — Svelte owns the DOM entirely.
- No component library, no CSS framework — hand-rolled to match the Nocturnal comp
  (SVG filters for glow, radial gradients) exactly.
- No backend, no auth, no build-time data.

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

## Data model

```js
// Part
{
  id: string,              // uuid
  name: string,
  role: "manager" | "firefighter" | "exile" | "unknown",
  description: string,
  bodyLocation: string,
  trigger: string,
  positiveIntention: string,
  fears: string,
  origins: string,
  notes: string,
  status: string,           // free text, e.g. "active", "emerging", "witnessed", "unwitnessed"
  x: number | null,         // manual override; null = use computed layout position
  y: number | null,
}

// Connection
{
  id: string,
  sourceId: string,         // Part.id, or "self"
  targetId: string,         // Part.id
  label: string,            // e.g. "protects", "triggers", "soothes"
  style: "solid" | "dashed",
}

// Persisted blob (localStorage)
{ schemaVersion: 1, parts: Part[], connections: Connection[] }
```

The field list comes directly from IFS practitioner worksheets (name, role,
description, body location, trigger, positive intention, fears, origins, notes) —
not invented from scratch.

## File structure

```
src/
  main.js
  App.svelte
  lib/
    store.svelte.js          // $state: parts, connections, activeFilter, editingPartId
    layout.js                 // pure fns: zone -> angle range, index -> position
    theme.js                  // Nocturnal palette + type tokens as constants
    persistence.js            // localStorage load/save, debounced, versioned
    export.js                 // SVG -> canvas -> PNG download
    components/
      Diagram.svelte           // the <svg>, owns filters/defs, iterates connections then parts
      SelfNode.svelte
      PartNode.svelte          // circle + glow filter + labels; drag handling
      Connection.svelte        // one bezier path, styled by relationship type
      PartModal.svelte         // add/edit form, all worksheet-derived fields
      Legend.svelte            // filter pills, counts via $derived
      Toolbar.svelte           // "+ Add a part" / "Export" buttons
```

None of this exists yet beyond `App.svelte` as a placeholder — it gets built out
milestone by milestone below.

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

1. **Static render** — hardcode 6 example parts (Inner Critic, The Planner, The
   Scroller, Catastrophizer, Little One, The Forgotten One), render the full
   Nocturnal-styled diagram with no interactivity. Goal: pixel-match the comp before
   any state management exists.
2. **Store + reactive render** — move the hardcoded data into `store.svelte.js`;
   `Diagram.svelte` renders from the store via `{#each}`.
3. **Add/Edit Part modal** — `PartModal.svelte` with all worksheet-derived fields;
   wire to store (add new part, edit existing, delete).
4. **Drag to reposition** — pointer events on `PartNode.svelte`, writes manual
   `x`/`y` override to the store.
5. **Filter legend** — `Legend.svelte` toggles `activeFilter`; `Diagram.svelte` dims/
   hides non-matching parts (opacity, not removal — positions stay stable).
6. **Persistence** — `persistence.js` loads on mount, saves on a debounced `$effect`
   watching the store; versioned blob per the data model above.
7. **PNG export** — `export.js`: clone the `<svg>`, ensure all styling is inline SVG
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
