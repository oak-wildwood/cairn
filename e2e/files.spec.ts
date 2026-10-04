import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { EXAMPLE_CONNECTIONS, EXAMPLE_PARTS } from "../src/lib/exampleData";
import type { PersistedState } from "../src/lib/types";
import {
  allPartNodes,
  connectors,
  expect,
  openMapMenu,
  partNode,
  skipTour,
  storedMap,
  test,
  toast,
} from "./fixtures";

const STAMP = String.raw`\d{4}-\d{2}-\d{2}`;
const BANNER = /^Sample data — these parts and connections are for demonstration only/;

test.beforeEach(async ({ page }) => {
  await skipTour(page);
  await page.goto("./");
});

async function startFresh(page: Page, ownerName: string): Promise<void> {
  await (await openMapMenu(page)).getByRole("menuitem", { name: "Start fresh…" }).click();
  const dialog = page.getByRole("dialog", { name: "Start a fresh map" });
  await dialog.getByLabel("Whose map is this?").fill(ownerName);
  await dialog.getByRole("button", { name: "Start fresh" }).click();
  await expect(dialog).toBeHidden();
}

test("backing up and restoring round-trips the map", async ({ page }) => {
  const download = page.waitForEvent("download");
  await (await openMapMenu(page)).getByRole("menuitem", { name: "Back up to a file" }).click();
  const backup = await download;
  expect(backup.suggestedFilename()).toMatch(new RegExp(`^cairn-map-${STAMP}\\.json$`));
  const text = await readFile(await backup.path(), "utf8");
  const saved = JSON.parse(text) as PersistedState;
  expect(saved.parts.map(({ name }) => name)).toEqual(EXAMPLE_PARTS.map(({ name }) => name));
  expect(saved.connections).toHaveLength(EXAMPLE_CONNECTIONS.length);

  await startFresh(page, "");
  await expect(allPartNodes(page)).toHaveCount(0);

  await page.locator('input[type="file"]').setInputFiles({
    name: backup.suggestedFilename(),
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });

  await expect(toast(page)).toHaveText(
    `Restored ${EXAMPLE_PARTS.length} parts from ${backup.suggestedFilename()}.`,
  );
  await expect(allPartNodes(page)).toHaveCount(EXAMPLE_PARTS.length);
  for (const { name } of EXAMPLE_PARTS) {
    await expect(partNode(page, name)).toBeVisible();
  }
  await expect(connectors(page)).toHaveCount(EXAMPLE_CONNECTIONS.length);
  // Written straight away rather than on the debounce, and identical to the
  // file it came from.
  expect(await storedMap(page)).toEqual(saved);
});

test("restoring a file that isn't a map changes nothing", async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ hello: "world" })),
  });

  await expect(toast(page)).toHaveText("notes.json isn't a Cairn map file. Nothing was changed.");
  await expect(allPartNodes(page)).toHaveCount(EXAMPLE_PARTS.length);
  await expect(connectors(page)).toHaveCount(EXAMPLE_CONNECTIONS.length);
  // Still the untouched sample, so still unsaved.
  await expect(page.getByRole("status").filter({ hasText: BANNER })).toBeVisible();
  expect(await storedMap(page)).toBeNull();
});

test("start fresh asks first, and cancelling leaves the map alone", async ({ page }) => {
  await (await openMapMenu(page)).getByRole("menuitem", { name: "Start fresh…" }).click();
  const dialog = page.getByRole("dialog", { name: "Start a fresh map" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(allPartNodes(page)).toHaveCount(EXAMPLE_PARTS.length);
  expect(await storedMap(page)).toBeNull();

  await startFresh(page, "Test Owner");
  await expect(allPartNodes(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Parts Map for Test Owner" })).toBeVisible();
  await expect(toast(page)).toHaveText("Cleared. This map is yours now, Test Owner.");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Parts Map for Test Owner" })).toBeVisible();
  await expect(allPartNodes(page)).toHaveCount(0);
});

test.describe("exports", () => {
  // html-to-image renders the live page, and the PDF does it once per part.
  test.describe.configure({ timeout: 120_000 });

  test("Save image downloads a PNG", async ({ page }) => {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save image" }).click();
    const png = await download;
    expect(png.suggestedFilename()).toMatch(new RegExp(`^cairn-map-${STAMP}\\.png$`));
    const bytes = await readFile(await png.path());
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    await expect(toast(page)).toHaveText("Saved a PNG to your downloads.");
  });

  async function exportPdf(page: Page, scope?: "Every part" | "Only the parts shown"): Promise<Buffer> {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PDF" }).click();
    if (scope) {
      const dialog = page.getByRole("dialog", { name: "Export PDF" });
      await dialog.getByRole("radio", { name: scope }).check();
      await dialog.getByRole("button", { name: "Export", exact: true }).click();
    }
    const pdf = await download;
    expect(pdf.suggestedFilename()).toMatch(new RegExp(`^cairn-map-parts-${STAMP}\\.pdf$`));
    const bytes = await readFile(await pdf.path());
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    return bytes;
  }

  test("Export PDF downloads one page per part", async ({ page }) => {
    await exportPdf(page);
    await expect(toast(page)).toHaveText(`Saved a ${EXAMPLE_PARTS.length}-page PDF to your downloads.`);
  });

  test("a filtered PDF covers every part or only the shown ones, as asked", async ({ page }) => {
    await page.getByRole("button", { name: "All parts" }).click();
    await page.getByRole("listbox", { name: "Filter by part" }).getByText("Managers").click();
    const managers = EXAMPLE_PARTS.filter(({ role }) => role === "manager").length;
    expect(managers).toBeLessThan(EXAMPLE_PARTS.length);

    await exportPdf(page, "Every part");
    await expect(toast(page)).toHaveText(`Saved a ${EXAMPLE_PARTS.length}-page PDF to your downloads.`);

    await exportPdf(page, "Only the parts shown");
    await expect(toast(page)).toHaveText(`Saved a ${managers}-page PDF to your downloads.`);
  });
});
