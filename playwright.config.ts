import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (`npm run test:e2e`): the production build in a real
 * browser, with real localStorage, downloads, file pickers and reloads.
 * Logic and single components belong to the Vitest suite under `src/`; these
 * cover what that suite structurally can't — the app as someone meets it.
 */

const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a test that only passes the second time is a flake to fix,
  // and a retry would hide it behind a green tick.
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}/`,
    // Traces only ever hold the seed map and the generated fixtures in
    // `e2e/fixtures.ts` — never real parts data — and stay out of git (see
    // .gitignore).
    trace: "retain-on-failure",
    // The detail panel and the tour animate; with reduced motion they land
    // in one frame, so no test has to wait out a transition.
    contextOptions: { reducedMotion: "reduce" },
  },
  // Chromium only until the suite is stable; Firefox and WebKit follow.
  projects: [
    {
      name: "chromium",
      // Wider than `App.svelte`'s 900px breakpoint so the detail panel sits
      // beside the map, and well clear of `phone.svelte.ts`'s phone query.
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  // The production build rather than the dev server: what ships is what's
  // tested, `base: "./"` included.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
