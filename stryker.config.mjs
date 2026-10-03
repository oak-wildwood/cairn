// @ts-check
//
// Mutation testing for the unit suite (`npm run test:mutation`).
//
// Coverage says which lines a test *ran*; a mutation score says whether the
// suite *notices* when those lines change. Stryker flips a `>` to `>=`, swaps
// `sin` for `cos`, replaces a return with `null`, and reruns the tests — a
// mutant nothing fails on is a concrete place where no test can fail. That is
// the signal this repo gates on. There is deliberately no coverage-% gate.

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  vitest: { configFile: "vite.config.ts" },

  // Pure modules under src/lib only. Components are out: Stryker doesn't
  // mutate `.svelte` files, and logic that matters belongs in a module anyway.
  mutate: [
    "src/lib/**/*.ts",
    "!src/lib/**/*.test.ts",
    // Test-support code, not product code: a mutant here changes what the
    // tests feed in, not what the app does.
    "!src/lib/testParts.ts",
    "!src/lib/devFixtures.ts",
    // Types only — nothing to mutate, listed so the omission reads as chosen.
    "!src/lib/types.ts",
    // The demo map is content: names, descriptions, labels and coordinates
    // for six generic parts. Its rules (the six names, resolvable endpoints,
    // the reciprocal pairs) are checked in exampleData.test.ts, but a mutant
    // that rewrites a description can only be killed by asserting the copy
    // equals itself. The tour's step copy is fenced off in-source in tour.ts
    // for the same reason, leaving its storage logic mutated.
    "!src/lib/exampleData.ts",
    // DOM and canvas rendering (PNG and PDF export). #69 moved their size
    // arithmetic into exportGeometry.ts, which is mutated; what's left here
    // is html-to-image and jsPDF calls a Node unit test can't reach.
    "!src/lib/export.ts",
    "!src/lib/pdfExport.ts",
    // theme.ts is NOT excluded here, but most of it is: it is the design
    // spec, and a mutant that changes a color or a stroke width can only be
    // killed by a test asserting the constant equals its own copy, which the
    // testing conventions (#87) forbid. So the value tables are fenced off
    // in-source with `// Stryker disable all` and only the logic
    // (`isLowDefinition` and the statuses it matches) is restored. The fence
    // lives in the file rather than as a line range here so it moves with
    // the code instead of silently drifting onto the wrong lines.
  ],

  // Local and CI output only. No dashboard reporter, nor anything else that
  // uploads: the app makes no network calls, the tooling shouldn't set a
  // different example, and mutant source snippets don't belong on someone
  // else's server.
  reporters: ["clear-text", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/mutation.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  clearTextReporter: { allowColor: false, reportTests: false, logTests: false },

  // Re-test only the mutants a change could affect. Local runs reuse this
  // file, and the mutation workflow (#97) caches it between CI runs.
  incremental: true,
  incrementalFile: "reports/stryker-incremental.json",

  // Ratcheted floor. `break` sits a few points under the recorded baseline so
  // the run fails on a regression rather than on noise. Raise it as survivors
  // are killed; never lower it without saying why in the PR.
  //
  // Baseline history (overall score, all files in scope):
  //   #88 (PR #96)  75.27%  floor 72. Most of the gap is store.svelte.ts
  //                         (93 mutants no test reaches) and layout.ts's
  //                         ring-capacity, label-wrap and viewBox arithmetic;
  //                         both are filed as follow-ups.
  //   #69 (PR #92)  84.37%  floor 81. #92's store, effect and export-geometry
  //                         tests, measured with this config on main after
  //                         both merged. What's left is #94 (store) and #95
  //                         (layout).
  //
  //   #95           88.18%  floor 85. layout.ts at 98.83%. Its three survivors
  //                         are equivalent (see below); what's left overall is
  //                         #94 (store).
  //
  // The three layout.ts survivors at the #95 baseline are all equivalent:
  //   - `bowRatio * away` -> `bowRatio / away` in connectorCurve: `away` is
  //     only ever 1 or -1, so the quotient is the product.
  //   - `i < words.length` -> `i <= words.length` in wrapLabel: the extra
  //     pass has an empty tail, so its longest line is the whole name,
  //     which no real split can beat.
  //   - `x - centreX` -> `x + centreX` in computeViewBox: `VIEWBOX` is centred
  //     on x = 0, so centreX is 0.
  // They are left surviving for the same reason as the ones below: each line
  // also holds a mutant the suite kills, and a disable would hide it.
  //
  // The nine persistence.ts survivors at the #95 baseline are all equivalent
  // (ten at #88; isPart's guard has been killed since):
  //   - `typeof value !== "object"` -> false in the other four shape guards:
  //     the field checks after it reject a primitive anyway.
  //   - the three `catch {}` bodies in parseMap and loadState, and
  //     `raw === null` -> false: each fall-through hands readPersistedState
  //     an undefined or null that it rejects one step later.
  //   - `isDemoRoute()` -> false in saveStateDebounced: saveState checks the
  //     route again when the timer fires.
  // They are left surviving rather than disabled because
  // `Stryker disable next-line` can only name a mutator for the whole line,
  // and on each of those lines that would also hide a sibling mutant the
  // suite does kill.
  thresholds: { high: 90, low: 80, break: 85 },

  tempDirName: ".stryker-tmp",
  cleanTempDir: true,
};
