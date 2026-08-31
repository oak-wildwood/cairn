# Agent instructions

Instructions for AI coding agents working in this repository. Humans should read the README.

`PLAN.md` is the specification — the data model, the layout maths, and the milestone
this repo is on. Read the relevant milestone before starting work; this file only
covers what `PLAN.md` and the code do not say.

## What this project is, and why it constrains you

From the source this reads like a small graph-visualisation app. It isn't. It is a
fixed-geometry diagram reproducing one specific comp, `design/nocturnal-comp.svg`, at
10–40 hand-placed nodes: the layout is angular sectors rather than anything
force-directed, and the colours, gradient stops, filter deviations and type are copied
from that file rather than chosen. That is why there is no graph library, no CSS
framework, and why D3 appears only as maths.

So "match the comp" is a specification, not a mood board. A cleaner-looking
approximation is a regression, and the comp's own values are the tie-breaker in any
visual disagreement.

## Hard rules

- **Never import `d3-selection`, or any D3 that touches the DOM.** Svelte owns the
  DOM entirely. Two systems mutating the same nodes produces bugs that only appear
  under reactivity, intermittently, far from the change that caused them. `d3-shape`
  and `d3-scale` are here for their maths and nothing else.
- **No network calls, no backend, no analytics, no telemetry.** The README promises
  users that their data never leaves the browser. One `fetch` makes that a lie, and
  the data in question is a person's account of their own mind.
- **No real parts data in the repo, ever** — not in fixtures, not in a screenshot, not
  in a commit message. This repo is public. Demo data stays the comp's six generic
  names.
- **Never hand-edit `public/logo-96.png`, `public/logo-192.png`, or
  `design/cairn-icon-transparent.png`.** `tools/make-logo.py` regenerates all three
  from the master, so an edit here is silently overwritten the next time anyone re-cuts
  the sizes. Change the script, or the master, instead.
- **Do not bump TypeScript to 7.** `svelte-check` peers `^5.0.0 || ^6.0.0`, and a
  broken type-checker costs more than being one major behind. Check
  `npm view svelte-check peerDependencies` before touching the pin.

## Invariants that are easy to break by accident

- **Three dashed-or-dimmed treatments exist, and none of them are interchangeable.**
  A connector's dash (`1 6`) encodes edge *kind* — solid if either endpoint is Self,
  dashed between two parts. A node's stroke dash (`3 4`) encodes *status* —
  "emerging" or "unwitnessed". A dimmed connector encodes an endpoint whose *role* is
  still `unknown`. Each channel is fully spoken for, so overloading one to carry a
  second meaning makes the diagram assert something untrue. `layout.ts` is the
  authority on all three.
- **`status` is free text and must be matched case-insensitively.** `theme.ts`'s
  `isLowDefinition` trims and lowercases before comparing. An `=== "emerging"` added
  elsewhere silently drops `"Emerging"`, and the node just renders wrong rather than
  failing.
- **`x`/`y` are `null` when unset, never `0`.** `(0, 0)` is Self's own position, so a
  zero-default pins the part to the centre of the diagram. `computeLayout` applies
  manual overrides last, and an overridden part still consumes its slot in the sector
  distribution — that is what stops dragging one part reshuffling its siblings.
- **Bearings are 0° = north, increasing clockwise** — not the mathematical convention.
  `polarToPoint` uses `sin` for x and `-cos` for y deliberately. "Correcting" it to
  `cos`/`sin` rotates the entire diagram 90° and still looks like a plausible radial
  layout.
- **A connection endpoint may be the literal `"self"`, which is not a `Part.id`.**
  Anything that resolves endpoints by looking them up in the parts list gets
  `undefined` for Self. Self is never `unknown` and never carries a `PartRole`.
- **Deleting a part must delete every connection naming it,** as `sourceId` or
  `targetId`. A dangling id survives into localStorage and outlives the session that
  created it.
- **The sectors overlap and leave gaps** — manager is 270–350, exile is 140–275, so
  270–275 belongs to both, and 130–140 and 350–5 belong to neither. This is only
  survivable because `scalePoint().padding(0.5)` insets the first and last node by
  half a step, keeping nodes off their sector boundaries. Dropping the padding, or
  moving to `scaleLinear`, puts parts into the overlap.
- **In `theme.ts`, an unmarked value is a claim that it was copied from the comp.**
  Anything without a counterpart there is marked `DERIVED` with its reasoning. Adding
  an invented value unmarked erases the distinction the file exists to preserve.

## Working in this repo

- `npm run check` must finish at **0 errors and 0 warnings**, and `npm run build` must
  succeed, before a milestone counts as done — not "looks right in the dev server".
- `design/` is gitignored apart from the three `cairn-icon-*` files, so a new comp
  dropped in there will not be committed and will not exist for anyone else. If a comp
  becomes a spec, un-ignore it deliberately.
- Regenerate the logos with `python3 tools/make-logo.py` from the repo root; see
  `tools/README.md` for why each step of the keying is what it is.

### PR titles become commit messages

This repo squash-merges, and the squashed commit takes the **PR title** as its subject with an
empty body. So the PR title is not a label on a discussion — it is the permanent record of the
change in `git log`, and it is the only part that survives the merge.

Write it as a conventional commit: `type: imperative summary`, lowercase after the colon, no
trailing period, under about 70 characters.

```
feat: add CSV export to the reports page
fix: stop the date filter dropping the last day of the range
test: add coverage for the retry path
docs: record why we hand-roll the parser
ci: run the formatter check on pull requests
refactor: extract the pagination hook
chore: bump the linter to 10.2
```

Use `feat` and `fix` for changes a user would notice, and `refactor` for ones they wouldn't.
`test`, `docs`, `ci` and `chore` cover the rest. When a change spans several types, name the one
that carries the point of the PR rather than the one touching the most files.

Individual commits on the branch don't survive the squash, so they're for the reviewer rather than
for history. Use them to separate things worth reviewing apart — a mechanical reformat from a
behavioural change, say — and don't agonise over their wording.
