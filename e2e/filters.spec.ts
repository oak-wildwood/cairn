import type { Page } from "@playwright/test";
import { EXAMPLE_PARTS } from "../src/lib/exampleData";
import type { Part } from "../src/lib/types";
import { expect, fadeOf, partNode, skipTour, test, toast } from "./fixtures";

/**
 * The sample map is the fixture here: its six parts already spread across
 * every role, both values of `active`, and overlapping feelings.
 */

test.beforeEach(async ({ page }) => {
  await skipTour(page);
  await page.goto("./");
});

/** Expect exactly the parts `shown` at full strength and the rest faded. */
async function expectShown(page: Page, shown: (part: Part) => boolean): Promise<void> {
  for (const part of EXAMPLE_PARTS) {
    await expect
      .poll(() => fadeOf(partNode(page, part.name)), { message: part.name })
      .toBe(shown(part) ? "1" : "0.18");
  }
}

async function filterRole(page: Page, label: "Managers" | "Firefighters" | "Exiles"): Promise<void> {
  await page.getByRole("button", { name: "All parts" }).click();
  await page.getByRole("listbox", { name: "Filter by part" }).getByText(label).click();
}

async function filterFeeling(page: Page, feeling: string): Promise<void> {
  const filter = page.locator('[data-tour="feelings-filter"]');
  await filter.getByRole("button", { name: "Feelings" }).click();
  const popover = page.getByRole("dialog", { name: "Filter by feeling" });
  await popover.locator(`li[data-tag="${feeling}"] input[type="checkbox"]`).check();
  await popover.getByRole("button", { name: "Done" }).click();
}

test("nothing is faded until a filter is on", async ({ page }) => {
  await expectShown(page, () => true);
});

test("the role filter dims every other role", async ({ page }) => {
  await filterRole(page, "Managers");
  await expectShown(page, (part) => part.role === "manager");
});

test("active only dims the parts that aren't active", async ({ page }) => {
  await page.getByRole("button", { name: /^Active only/ }).click();
  await expectShown(page, (part) => part.active);
});

test("the feeling filter dims parts without that feeling", async ({ page }) => {
  await filterFeeling(page, "sad");
  await expectShown(page, (part) => part.feelings.includes("sad"));
});

test("combined filters must all pass", async ({ page }) => {
  // Every "sad" part in the sample is inactive, so together these exclude
  // everything — where either one alone would leave something showing.
  expect(EXAMPLE_PARTS.some((part) => part.feelings.includes("sad"))).toBe(true);
  expect(EXAMPLE_PARTS.some((part) => part.active)).toBe(true);

  await filterFeeling(page, "sad");
  await page.getByRole("button", { name: /^Active only/ }).click();
  await expectShown(page, (part) => part.active && part.feelings.includes("sad"));
  await expectShown(page, () => false);
});

test("a filtered PDF export with nothing matching is refused", async ({ page }) => {
  await filterRole(page, "Exiles");
  await page.getByRole("button", { name: /^Active only/ }).click();
  await expectShown(page, () => false);

  let downloads = 0;
  page.on("download", () => (downloads += 1));

  await page.getByRole("button", { name: "Export PDF" }).click();
  const dialog = page.getByRole("dialog", { name: "Export PDF" });
  await expect(dialog.getByRole("radio", { name: "Only the parts shown" })).toBeChecked();
  await dialog.getByRole("button", { name: "Export", exact: true }).click();

  await expect(toast(page)).toHaveText("No parts match the current filters.");
  // Long enough for a download that had started to have been reported.
  await page.waitForTimeout(1000);
  expect(downloads).toBe(0);
});
