# Agent instructions

Instructions for AI coding agents working in this repository. Humans should read the README.

`PLAN.md` is the specification — the data model, the layout maths, and the milestone
this repo is on. Read the relevant milestone before starting work; this file only
covers what `PLAN.md` and the code do not say.

## What this project is, and why it constrains you

From the source this reads like a small graph-visualisation app. It isn't. It is a
fixed-geometry diagram at 10–40 hand-placed nodes: the layout is angular sectors
rather than anything force-directed, and the colours, gradient stops, filter
deviations and type are a settled design rather than choices to make afresh. That is
why there is no graph library, no CSS framework, and why D3 appears only as maths.

**`src/lib/theme.ts` is the design spec.** These values began in a "Nocturnal" comp
that was never checked in and is no longer part of this project, so do not go looking
for it, and do not write a comment, doc or commit message that points at one — there
is nothing for anyone else to open. What is in `theme.ts` *is* the design, and it is
the tie-breaker in any visual disagreement. A cleaner-looking approximation is a
regression.

That file's DERIVED marker records provenance, not a file you could diff against. An
unmarked value was settled by the original design: treat it as considered, and change
it only deliberately, on purpose, with a reason. A DERIVED value was reasoned out
here for something the original never covered — hover states, drag, the detail panel,
the modal, reciprocal connectors, arrowheads — and carries that reasoning in its
comment; those are open to revisit on their merits. Adding an invented value unmarked
erases the distinction the file exists to preserve.

Nothing about the visual design was ever the authority on domain content — which
parts exist, and which relationships hold between them. That is IFS. Where the two
appear to disagree about substance rather than appearance, IFS wins: `exampleData.ts`
keeps the original six generic parts, but its connections answer to the domain, and a
protector/exile bond drawn one-way is a half-drawn bond however it was first drawn.

## Hard rules

- **Never import `d3-selection`, or any D3 that touches the DOM.** Svelte owns the
  DOM entirely. Two systems mutating the same nodes produces bugs that only appear
  under reactivity, intermittently, far from the change that caused them. `d3-shape`
  and `d3-scale` are here for their maths and nothing else.
- **No network calls, no backend, no analytics, no telemetry.** The README promises
  users that their data never leaves the browser. One `fetch` makes that a lie, and
  the data in question is a person's account of their own mind.
- **No real parts data in the repo, ever** — not in fixtures, not in a screenshot, not
  in a commit message. This repo is public. Demo data stays the six generic names
  already in `exampleData.ts`.
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
- **Connections are per *direction*, not per pair.** `connectionEdgeKey` is
  deliberately ordered: A->B and B->A are different relations and a pair may hold
  both, because IFS routinely has an exile activating its protector while that
  protector suppresses the exile. Re-sorting that key to collapse a pair — the
  obvious "fix" when two connectors look redundant — leaves the map unable to state
  the thing it exists to state. What the key does forbid is the *same* direction
  twice, which is the failure it was written for.
- **Arrowheads appear only on reciprocal pairs.** The original design drew none, so a lone
  connector has none; the two arcs of a reciprocal pair get one each because
  otherwise nothing on the canvas says which way either runs. Adding them
  everywhere for consistency is a regression against the settled design, and dropping them
  from reciprocal pairs makes those two arcs unreadable.
- **Reciprocal arcs separate because one term skips the `away` flip.** In
  `layout.ts`'s `connectorCurve`, `perp` and `away` both flip with direction, so they
  cancel and two opposite connectors would otherwise bow onto the same point. The
  `reciprocalSpread` term is added *without* `away` on purpose — `perp` alone flips
  it, and that is what splits the pair. Multiplying it by `away` for symmetry puts
  the two arcs back on top of each other.
- **`status` is free text and must be matched case-insensitively.** `theme.ts`'s
  `isLowDefinition` trims and lowercases before comparing. An `=== "emerging"` added
  elsewhere silently drops `"Emerging"`, and the node just renders wrong rather than
  failing. `active: boolean` is a separate field, not one more value of `status` —
  it's whether a part is currently showing up, orthogonal to how well it's known, so
  a part can be active and witnessed at once. Loading an older map with `status:
  "active"` and no `active` field goes through `persistence.ts`'s schema-1 migration
  rather than being read literally.
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
- **A feeling belongs to at most one feeling group.** Groups are a partition
  because "names the same feeling" has to be transitive. A feeling in two groups
  would join them, and filtering by one would match the other. Any code that
  writes `feelingGroups` goes through `assignFeelingsToGroup` or
  `normalizeFeelingGroups` in `feelings.ts`. Groups are only ever declared by the
  person: no stemming, synonym list or similarity score decides that two
  feelings are the same.
- **Deleting a part must delete every connection naming it,** as `sourceId` or
  `targetId`. A dangling id survives into localStorage and outlives the session that
  created it.
- **The sectors overlap and leave gaps** — manager is 270–350, exile is 140–275, so
  270–275 belongs to both, and 130–140 and 350–5 belong to neither. This is only
  survivable because `scalePoint().padding(0.5)` insets the first and last node by
  half a step, keeping nodes off their sector boundaries. Dropping the padding, or
  moving to `scaleLinear`, puts parts into the overlap.
- **In `theme.ts`, an unmarked value is a claim that the original design settled
  it.** Anything reasoned out here instead is marked `DERIVED` with that reasoning.
  Adding an invented value unmarked erases the distinction the file exists to
  preserve — and since the original artwork is gone, nobody can recover which was
  which by inspection.

## Working in this repo

- `npm run check` (**0 errors and 0 warnings**), `npm test` and `npm run build` must all
  pass before a milestone counts as done — not "looks right in the dev server". CI
  (`ci.yml`) enforces the same three steps.
- `design/` is gitignored apart from the three `cairn-icon-*` files, so anything
  dropped in there is local scratch: it will not be committed and will not exist for
  anyone else. Nothing in it is a spec, and no doc or comment should cite it as one.
  If something there ever needs to be authoritative, un-ignore it in the same commit
  that starts relying on it.
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

## Testing

A suite that passes while the code it covers is broken reads as protection and gives
none, which is worse than no suite. These rules exist because a review of the first
Vitest PRs (#73, #84) found exactly that.

- **Every test must be able to fail.** Before adding a test, break the code it covers
  and watch the test fail; say in the PR what you broke. The anti-patterns, all found
  in that review:
  - *Passing when the unit returns `null` or a constant.* A `parseMap` idempotence
    test passed when `parseMap` returned `null` (`null` → `"null"` → `null`), and the
    tour tests passed with `hasSeenTour` hard-coded to `true` because nothing checked
    the `false` case. Assert the specific output, and cover both sides of every boolean.
  - *Asserting a constant equals its own copy.* Allowed only to guard a documented
    policy (the six generic demo names in `exampleData.ts`), and it must carry a
    comment saying so.
  - *Mocking the unit under test.* Mock its dependencies, never the thing being tested.
- **Mutation testing checks the first rule mechanically.** `npm run test:mutation`
  runs StrykerJS over `src/lib`: it changes the code (`>` to `>=`, `sin` to `cos`, a
  return to `null`) and reruns the suite, and a mutant no test fails on is a place
  where no test can. `stryker.config.mjs` records what is in scope and why, and the
  score floor (`thresholds.break`). Raise the floor as survivors are killed; never
  lower it without a reason in the PR. Kill a survivor with a test that asserts
  behavior, not by pinning a constant. A mutant that is genuinely equivalent gets
  `// Stryker disable next-line <mutator>: <reason>`, never an unexplained disable,
  and only when no killable mutant shares the line. There is deliberately no
  coverage-percentage gate: coverage counts lines run, not lines checked.
- **Every invariant has a test.** Each item under "Invariants that are easy to break by
  accident" needs a test that fails when it is violated, and changing an invariant
  updates its test in the same PR. The review found that rotating the whole diagram 90°
  (breaking the bearing convention) still passed the suite.
- **Environment.** Node by default. Add `// @vitest-environment jsdom` to a file only if
  it needs `localStorage`, `document` or `location`.
- **Mocks and cleanup.** Use `vi.spyOn` or `vi.stubGlobal` rather than assigning to a
  global. The one exception is an API jsdom doesn't implement at all, such as
  `URL.createObjectURL`, where there is no original for `vi.spyOn` to wrap: assign it,
  and `delete` it in `afterEach` (see `backup.test.ts`). Restore in `afterEach`, never
  at the end of a test body — a failing assertion skips the rest of the body and the
  leak hits the next test. That includes URL changes made with `history.pushState`.
- **Svelte.** Tests that use runes are named `*.svelte.test.ts`. Test an `$effect`
  inside `$effect.root` and call `flushSync`. Component tests use
  `@testing-library/svelte` on jsdom (not Vitest browser mode; real-browser coverage
  belongs to Playwright), and call its `cleanup` in `afterEach`. Prefer putting logic
  in modules over components so it can be tested without one.
- **Fixtures.** Use the shared `makePart` helper in `src/lib/testParts.ts` and the six
  generic names. The no-real-data and no-network hard rules apply to tests, fixtures
  and snapshots as much as to app code.
- **Agents must be able to run the tests.** `claude.yml` and `claude-nightly.yml` list
  `allowed_tools` explicitly, and both include `Bash(npm test:*)` (which also allows
  `npm test -- <file>`). Keep it there when editing either list, and add any new test
  script alongside it, or the definition of done above can't be met by the agents that
  author most PRs here.
- **PR body.** `.github/pull_request_template.md` only pre-fills the web UI, and
  `gh pr create --body` skips it. Include its checklist in your PR body yourself. The
  title is what becomes the commit message; the body does not survive the squash.
