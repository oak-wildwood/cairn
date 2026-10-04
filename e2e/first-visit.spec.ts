import { EXAMPLE_PARTS } from "../src/lib/exampleData";
import {
  MAP_KEY,
  TOUR_KEY,
  addPart,
  allPartNodes,
  detailPanel,
  expect,
  mapOf,
  part,
  partNode,
  seedMap,
  selectPart,
  skipTour,
  storedMap,
  test,
} from "./fixtures";

const BANNER = /^Sample data — these parts and connections are for demonstration only/;

test("a fresh visit shows the sample map and offers the tour", async ({ page }) => {
  await page.goto("./");

  // Plain selectors rather than roles: the tour makes everything behind it
  // `inert`, which takes it out of the accessibility tree.
  await expect(page.locator("h1")).toHaveText("Parts Map for Demo User");
  await expect(page.locator(".demo-banner")).toHaveText(BANNER);
  await expect(page.locator("svg.diagram")).toBeVisible();

  await expect(allPartNodes(page)).toHaveCount(EXAMPLE_PARTS.length);
  for (const { name } of EXAMPLE_PARTS) {
    await expect(partNode(page, name)).toBeVisible();
  }

  const tour = page.getByRole("dialog", { name: "Your map" });
  await expect(tour).toBeVisible();
  await expect(tour.getByText("Step 1 of 12")).toBeVisible();

  // Looking is not editing: the untouched sample is never written to storage.
  expect(await storedMap(page)).toBeNull();
});

test("skipping the tour sticks across a reload", async ({ page }) => {
  await page.goto("./");
  const tour = page.getByRole("dialog", { name: "Your map" });
  await expect(tour).toBeVisible();

  await tour.getByRole("button", { name: "Skip" }).click();
  await expect(tour).toBeHidden();
  expect(await page.evaluate((key) => localStorage.getItem(key), TOUR_KEY)).toBe("1");

  await page.reload();
  await expect(allPartNodes(page)).toHaveCount(EXAMPLE_PARTS.length);
  await expect(page.getByRole("dialog", { name: "Your map" })).toBeHidden();
});

test("an added part and an edited field survive a reload", async ({ page }) => {
  await skipTour(page);
  await seedMap(page, mapOf([]));
  await page.goto("./");
  await expect(allPartNodes(page)).toHaveCount(0);

  await addPart(page, { name: "The Analyst", role: "manager" });
  await selectPart(page, "The Analyst");
  await detailPanel(page).getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit part" });
  await dialog.getByLabel("Body location", { exact: true }).fill("Forehead, behind the eyes");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();

  // Saves are debounced, so wait for the write before reloading over it.
  await expect
    .poll(async () => (await storedMap(page))?.parts[0]?.bodyLocation)
    .toBe("Forehead, behind the eyes");

  await page.reload();
  await expect(allPartNodes(page)).toHaveCount(1);
  await selectPart(page, "The Analyst");
  await expect(detailPanel(page).getByText("Forehead, behind the eyes")).toBeVisible();
});

test("the demo page shows the sample and leaves the real map alone", async ({
  page,
  context,
}) => {
  await skipTour(page);
  const own = mapOf([part({ id: "the-kid", name: "The Kid", role: "exile" })]);
  await seedMap(page, own);
  await page.goto("./");
  await expect(allPartNodes(page)).toHaveCount(1);
  const before = await page.evaluate((key) => localStorage.getItem(key), MAP_KEY);

  // A second tab in the same browser: same origin, same localStorage.
  const demo = await context.newPage();
  await demo.goto("./demo/");
  await expect(demo.getByRole("heading", { name: "Parts Map for Demo User" })).toBeVisible();
  await expect(allPartNodes(demo)).toHaveCount(EXAMPLE_PARTS.length);
  // The demo isn't a first visit to the app, so it never offers the tour.
  await expect(demo.getByRole("dialog", { name: "Your map" })).toBeHidden();

  await addPart(demo, { name: "Manager 7", role: "manager" });
  await expect(allPartNodes(demo)).toHaveCount(EXAMPLE_PARTS.length + 1);
  // Past the save debounce, so a write would have landed by now.
  await demo.waitForTimeout(800);

  expect(await page.evaluate((key) => localStorage.getItem(key), MAP_KEY)).toBe(before);

  await demo.reload();
  await expect(allPartNodes(demo)).toHaveCount(EXAMPLE_PARTS.length);

  await page.reload();
  await expect(allPartNodes(page)).toHaveCount(1);
  await expect(partNode(page, "The Kid")).toBeVisible();
});
