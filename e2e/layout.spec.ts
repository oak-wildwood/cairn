import { makeFixtureMap } from "../src/lib/devFixtures";
import { allPartNodes, expect, mapOf, seedMap, skipTour, test } from "./fixtures";

test("a 40-part map fits inside the frame", async ({ page }) => {
  // `?parts=40` is compiled out of a production build, so the generated map
  // goes in through storage instead — the same way a real one would.
  const { parts, connections } = makeFixtureMap(40);
  await skipTour(page);
  await seedMap(page, mapOf(parts, connections));
  await page.goto("./");
  await expect(allPartNodes(page)).toHaveCount(40);

  const outside = await page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>("svg.diagram");
    if (!svg) throw new Error("no diagram");
    const frame = svg.getBoundingClientRect();
    const misplaced: string[] = [];
    for (const node of svg.querySelectorAll<SVGGElement>("g.node")) {
      // The node's own circle, not the group: the group's box also takes in
      // the caption under it and the hidden connection handles.
      const box = node.querySelector(":scope > circle:not(.handle)")?.getBoundingClientRect();
      if (!box) throw new Error("node has no circle");
      if (
        box.left < frame.left ||
        box.right > frame.right ||
        box.top < frame.top ||
        box.bottom > frame.bottom
      ) {
        misplaced.push(node.getAttribute("aria-label") ?? "?");
      }
    }
    return misplaced;
  });
  expect(outside).toEqual([]);
});

/**
 * GitHub Pages serves the site from /cairn/, and `vite.config.ts`'s relative
 * `base: "./"` is what lets one build work there and at a domain root. This
 * serves the same build under /cairn/ by rewriting requests onto the preview
 * server, and refuses anything asked for outside that prefix — which is
 * exactly what a root-absolute asset URL would do.
 */
test("the build works served under a subpath", async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? "").origin;
  const PREFIX = "/cairn";
  const escaped: string[] = [];

  await page.route(
    (url) => url.origin === origin,
    async (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith(`${PREFIX}/`)) {
        escaped.push(url.pathname);
        await route.fulfill({ status: 404, body: "outside the subpath" });
        return;
      }
      url.pathname = url.pathname.slice(PREFIX.length);
      await route.fulfill({ response: await route.fetch({ url: url.href }) });
    },
  );
  await skipTour(page);

  for (const path of [`${PREFIX}/`, `${PREFIX}/demo/`]) {
    await page.goto(`${origin}${path}`);
    await expect(page.getByRole("heading", { name: "Parts Map for Demo User" })).toBeVisible();
    await expect(allPartNodes(page)).toHaveCount(6);
    // The logo is the one image the app itself loads, and the demo entry
    // reaches it from a directory deeper.
    const logo = page.getByRole("img", { name: "Cairn" }).first();
    await expect
      .poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth), {
        message: `logo on ${path}`,
      })
      .toBeGreaterThan(0);
  }

  expect(escaped).toEqual([]);
});
