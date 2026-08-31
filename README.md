# Cairn

A radial map for [Internal Family Systems](https://ifs-institute.com/) (IFS) parts
work — a fixed **Self** node at the center, with **parts** (managers, firefighters,
exiles) placed around it in role-based sectors and connected by lines that show how
they relate.

IFS is a therapy model that treats the mind as made up of distinct "parts" —
protective managers, reactive firefighters, and the wounded exiles they're protecting
— orbiting a calm, compassionate core ("Self"). Mapping parts visually, rather than
just journaling about them, is a common practice between sessions; Cairn is a small,
free tool for doing that mapping yourself.

## Status

Early scaffold. The project structure, dependencies, and full build plan are in
place; the actual diagram and app logic aren't built yet. See
[`PLAN.md`](./PLAN.md) for the milestone-by-milestone plan and current state.

## Getting started

Requires Node 18+.

```sh
npm install
npm start
```

This opens a local dev server (Vite prints the URL, typically
`http://localhost:5173`).

Other scripts:

| Command           | What it does                        |
| ------------------ | ------------------------------------ |
| `npm start` / `npm run dev` | Local dev server with hot reload |
| `npm run build`    | Production build, output to `dist/` |
| `npm run preview`  | Serve the production build locally  |
| `npm run check`    | Type-check the whole project (`svelte-check`) |

## Stack

- **Svelte 5** (runes) for UI and state, in **TypeScript**
- **Vite** for dev server and build
- **D3** (`d3-shape`, `d3-scale` only) used purely as a geometry library — no
  `d3-selection` or DOM binding; Svelte owns the DOM entirely
- No component library, no CSS framework — the diagram's look (SVG filters,
  gradients, hand-tuned curves) doesn't map cleanly onto an off-the-shelf UI kit
  anyway

The stack choice was deliberate: D3's usual pattern of selecting and mutating the DOM
directly overlaps awkwardly with a UI framework doing the same thing, so this project
uses D3 only for what it's uniquely good at — the geometry math (bezier curve
control points, angle/radius conversions) — and lets Svelte's own templating own
everything that touches the page. More on the reasoning, and the layout options that
were ruled out, in [`PLAN.md`](./PLAN.md).

## Data & privacy

Everything runs client-side; there's no backend. Data is stored in the browser's
`localStorage` only — nothing is sent anywhere. Any example data in this repo (part
names like "The Fixer" or "The Kid") is generic placeholder content for
development and demos, not anyone's real information.

## Roadmap

See [`PLAN.md`](./PLAN.md) for the full milestone list, data model, and acceptance
criteria for v1.

## Design & inspiration

The general idea of drawing IFS parts around a central Self node, with click-through
detail and labeled relationship lines, is a common practice in the IFS community and
isn't unique to any one tool. Some interaction and layout ideas here were inspired by
existing IFS parts-mapping apps. Cairn is an independent, unaffiliated implementation
built as a personal Svelte learning exercise, not a commercial product, and isn't
endorsed by or connected to any other app in this space.

## License

MIT — see [`LICENSE`](./LICENSE).
