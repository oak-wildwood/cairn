import {
  allPartNodes,
  detailPanel,
  expect,
  mapOf,
  partNode,
  seedMap,
  selectPart,
  skipTour,
  test,
} from "./fixtures";

test.beforeEach(async ({ page }) => {
  await skipTour(page);
});

test.describe("Escape", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await selectPart(page, "The Fixer");
  });

  test("closes the map menu without also closing the detail panel", async ({ page }) => {
    const trigger = page.getByRole("button", { name: "Menu" });
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(detailPanel(page)).toBeVisible();

    // With nothing left on top, the next Escape is the app's: deselect.
    await page.keyboard.press("Escape");
    await expect(detailPanel(page)).toBeHidden();
  });

  test("closes the part modal without also closing the detail panel", async ({ page }) => {
    await detailPanel(page).getByRole("button", { name: "Edit", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Edit part" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(detailPanel(page)).toBeVisible();
  });

  test("closes the start-fresh dialog and leaves the map as it was", async ({ page }) => {
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("menuitem", { name: "Start fresh…" }).click();
    const dialog = page.getByRole("dialog", { name: "Start a fresh map" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(allPartNodes(page)).toHaveCount(6);
  });
});

test("a part can be added and selected with the keyboard alone", async ({ page }) => {
  // An empty map, so there's no sample banner and no other part to tab past.
  await seedMap(page, mapOf([]));
  await page.goto("./");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "+ Add a part" })).toBeFocused();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Add a part" });
  await expect(dialog.getByLabel("Name", { exact: true })).toBeFocused();
  await page.keyboard.type("The Kid");
  // Implicit submission: Enter in a text field submits the form, with the
  // role left at its default of "unknown".
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(partNode(page, "The Kid")).toBeVisible();

  // Adding selects the new part; let go of it, then find it again by Tab.
  await page.keyboard.press("Escape");
  await expect(detailPanel(page)).toBeHidden();

  const node = partNode(page, "The Kid");
  for (let presses = 0; presses < 30; presses += 1) {
    if (await node.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(node).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(detailPanel(page).getByRole("heading", { name: "The Kid" })).toBeVisible();
});
