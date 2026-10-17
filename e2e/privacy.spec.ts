import { readFile } from "node:fs/promises";
import {
  FONT_HOSTS,
  addPart,
  allPartNodes,
  connectors,
  drawConnection,
  expect,
  openMapMenu,
  partNode,
  skipTour,
  test,
  toast,
} from "./fixtures";

/**
 * The README promises that nothing a person enters leaves their browser, and
 * AGENTS.md makes "no network calls" a hard rule. These check both against
 * the running app rather than against a reading of the source.
 */

test("a whole session sends nothing off the app's own origin", async ({
  page,
  baseURL,
}) => {
  // Both exports walk the rendered page through html-to-image, and the PDF
  // does so once per part.
  test.setTimeout(120_000);
  const origin = new URL(baseURL ?? "").origin;
  const sameOrigin: string[] = [];
  const foreign: { url: URL; method: string; body: string | null }[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    // data: and blob: URLs are the exports being assembled in memory.
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin === origin) sameOrigin.push(url.pathname);
    else foreign.push({ url, method: request.method(), body: request.postData() });
  });

  await skipTour(page);
  await page.goto("./");

  // Something a person would type, so the check below can look for it.
  // Synthetic like `devFixtures.ts`'s names, and unlike any of the seed's.
  const typed = "Exile 7";
  await addPart(page, { name: typed, role: "exile" });
  await expect(partNode(page, typed)).toBeVisible();

  await drawConnection(page, partNode(page, typed), partNode(page, "The Fixer"));
  await expect(connectors(page)).toHaveCount(8);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /Active only/ }).click();

  const png = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save image" }).click();
  await (await png).path();

  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).click();
  await page
    .getByRole("dialog", { name: "Export PDF" })
    .getByRole("button", { name: "Export", exact: true })
    .click();
  await (await pdf).path();

  const backup = page.waitForEvent("download");
  await (await openMapMenu(page)).getByRole("menuitem", { name: "Back up to a file" }).click();
  const backupPath = await (await backup).path();

  await page.locator('input[type="file"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: await readFile(backupPath),
  });
  await expect(toast(page)).toHaveText("Restored 7 parts from backup.json.");
  await expect(allPartNodes(page)).toHaveCount(7);

  // The listener has to have seen the app load at all, or an empty `foreign`
  // below would only mean it was never attached.
  expect(sameOrigin.length).toBeGreaterThan(0);

  // The one exception, and a known one: `index.html` links the two web fonts
  // from Google Fonts. That request carries no map data — it goes out before
  // the app has read storage — but it does tell Google someone opened the
  // page, so self-hosting the fonts is the follow-up that lets this list go.
  // Anything else here is a new call that breaks the README's promise.
  const unexpected = foreign.filter(({ url }) => !FONT_HOSTS.includes(url.hostname));
  expect(unexpected.map(({ url }) => url.href)).toEqual([]);

  // And even the font requests never carry anything a person entered.
  for (const { url, method, body } of foreign) {
    expect(method).toBe("GET");
    expect(body).toBeNull();
    expect(decodeURIComponent(url.href)).not.toContain(typed);
  }
});

test("the app still works when storage is blocked", async ({ page }) => {
  // A private window or blocked site data throws on any touch of
  // localStorage, rather than returning null.
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage is blocked", "SecurityError");
      },
    });
  });
  await page.goto("./");

  // The block took effect — otherwise everything below proves nothing.
  expect(
    await page.evaluate(() => {
      try {
        void window.localStorage;
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);

  await expect(page.getByRole("heading", { name: "Parts Map for Demo User" })).toBeVisible();
  await expect(allPartNodes(page)).toHaveCount(6);
  // `hasSeenTour` reads unreadable storage as "seen", so the tour stays away
  // rather than offering itself on every visit.
  await expect(page.getByRole("dialog", { name: "Your map" })).toBeHidden();

  await addPart(page, { name: "Manager 7", role: "manager" });
  await expect(allPartNodes(page)).toHaveCount(7);

  // Past `persistence.ts`'s 400ms save debounce, so a save that throws would
  // have done so by now — the `hermetic` fixture fails the test on it.
  await page.waitForTimeout(800);

  await page.reload();
  // Nothing could be saved, so the edit is gone and the sample is back.
  await expect(allPartNodes(page)).toHaveCount(6);
});
