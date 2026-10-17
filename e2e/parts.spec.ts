import { EXAMPLE_CONNECTIONS, EXAMPLE_PARTS } from "../src/lib/exampleData";
import { SECTORS } from "../src/lib/layout";
import {
  SELF_ID,
  addPart,
  allPartNodes,
  connection,
  connectors,
  detailPanel,
  dragNode,
  drawConnection,
  expect,
  mapOf,
  nodePosition,
  part,
  partNode,
  seedMap,
  selectPart,
  skipTour,
  storedMap,
  test,
} from "./fixtures";

test.beforeEach(async ({ page }) => {
  await skipTour(page);
});

/** 0° = north, increasing clockwise — `layout.ts`'s bearing convention. */
function bearingOf({ x, y }: { x: number; y: number }): number {
  return ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
}

test("each role lands in its own sector, and unknown on the outer ring", async ({
  page,
}) => {
  await seedMap(page, mapOf([]));
  await page.goto("./");

  await addPart(page, { name: "The Fixer", role: "manager" });
  await addPart(page, { name: "The Avoider", role: "firefighter" });
  await addPart(page, { name: "The Kid", role: "exile" });
  await addPart(page, { name: "The Unseen One", role: "unknown" });
  await expect(allPartNodes(page)).toHaveCount(4);

  const placed = {
    manager: await nodePosition(partNode(page, "The Fixer")),
    firefighter: await nodePosition(partNode(page, "The Avoider")),
    exile: await nodePosition(partNode(page, "The Kid")),
  };
  for (const [role, position] of Object.entries(placed)) {
    const sector = SECTORS[role as keyof typeof SECTORS];
    const bearing = bearingOf(position);
    expect(bearing, `${role} bearing`).toBeGreaterThan(sector.startDeg);
    expect(bearing, `${role} bearing`).toBeLessThan(sector.endDeg);
  }

  const unknown = await nodePosition(partNode(page, "The Unseen One"));
  const innermost = Math.max(...Object.values(placed).map(({ x, y }) => Math.hypot(x, y)));
  expect(Math.hypot(unknown.x, unknown.y)).toBeGreaterThan(innermost);
});

test("deleting a part removes every connector touching it, for good", async ({
  page,
}) => {
  await page.goto("./");
  await expect(connectors(page)).toHaveCount(EXAMPLE_CONNECTIONS.length);

  const touching = EXAMPLE_CONNECTIONS.filter(
    ({ sourceId, targetId }) => sourceId === "the-kid" || targetId === "the-kid",
  );
  // The Kid sits at both ends of the sample's connectors, so this covers a
  // dangling source as well as a dangling target.
  expect(touching.some(({ sourceId }) => sourceId === "the-kid")).toBe(true);
  expect(touching.some(({ targetId }) => targetId === "the-kid")).toBe(true);

  await selectPart(page, "The Kid");
  await detailPanel(page).getByRole("button", { name: "Delete part" }).click();
  await detailPanel(page).getByRole("button", { name: "Confirm delete" }).click();

  await expect(partNode(page, "The Kid")).toHaveCount(0);
  const remaining = EXAMPLE_CONNECTIONS.length - touching.length;
  await expect(connectors(page)).toHaveCount(remaining);

  await expect.poll(async () => (await storedMap(page))?.parts.length).toBe(
    EXAMPLE_PARTS.length - 1,
  );
  const stored = await storedMap(page);
  expect(
    stored?.connections.filter(
      ({ sourceId, targetId }) => sourceId === "the-kid" || targetId === "the-kid",
    ),
  ).toEqual([]);

  await page.reload();
  await expect(allPartNodes(page)).toHaveCount(EXAMPLE_PARTS.length - 1);
  await expect(connectors(page)).toHaveCount(remaining);
});

test("connections are per direction, and only a reciprocal pair has arrowheads", async ({
  page,
}) => {
  // Placed by hand, side by side and clear of Self, so a drag between them
  // crosses nothing else.
  await seedMap(
    page,
    mapOf([
      part({ id: "the-fixer", name: "The Fixer", role: "manager", x: -220, y: -260 }),
      part({ id: "the-kid", name: "The Kid", role: "exile", x: 220, y: -260 }),
    ]),
  );
  await page.goto("./");
  const fixer = partNode(page, "The Fixer");
  const kid = partNode(page, "The Kid");
  await expect(connectors(page)).toHaveCount(0);

  await drawConnection(page, fixer, kid);
  await expect(connectors(page)).toHaveCount(1);
  // A lone connector carries no arrowhead — the original design drew none.
  await expect(connectors(page).first()).not.toHaveAttribute("marker-end");
  await page.keyboard.press("Escape");

  await drawConnection(page, kid, fixer);
  await expect(connectors(page)).toHaveCount(2);
  for (const path of await connectors(page).all()) {
    await expect(path).toHaveAttribute("marker-end", /^url\(#arrow-/);
  }
  await page.keyboard.press("Escape");

  // The same direction a second time is refused: the target isn't offered,
  // so releasing over it is a cancel.
  await drawConnection(page, fixer, kid);
  await page.keyboard.press("Escape");
  await expect(connectors(page)).toHaveCount(2);

  await expect
    .poll(async () =>
      (await storedMap(page))?.connections
        .map(({ sourceId, targetId }) => `${sourceId}->${targetId}`)
        .sort(),
    )
    .toEqual(["the-fixer->the-kid", "the-kid->the-fixer"]);
});

test("line and outline styles say what they mean", async ({ page }) => {
  await seedMap(
    page,
    mapOf(
      [
        // Capitalised on purpose: `status` is matched case-insensitively.
        part({ id: "alarmist", name: "Alarmist", role: "firefighter", status: "Emerging" }),
        part({ id: "the-analyst", name: "The Analyst", role: "manager", status: "befriended" }),
      ],
      [
        connection("c-self-alarmist", SELF_ID, "alarmist", "witnessing"),
        connection("c-analyst-alarmist", "the-analyst", "alarmist", "polarized with"),
      ],
    ),
  );
  await page.goto("./");

  // A connector's dash is its kind: solid if Self is an endpoint, dotted
  // between two parts.
  await expect(page.locator('path[aria-label="witnessing"]')).not.toHaveAttribute(
    "stroke-dasharray",
  );
  await expect(page.locator('path[aria-label="polarized with"]')).toHaveAttribute(
    "stroke-dasharray",
    "1 6",
  );

  // A node's dash is its status: low-definition for "emerging", whatever
  // its case, and not for any other status.
  await expect(
    partNode(page, "Alarmist").locator('circle[stroke-dasharray="3 4"]'),
  ).toHaveCount(1);
  await expect(partNode(page, "The Analyst").locator("circle[stroke-dasharray]")).toHaveCount(0);
});

test("a dragged part stays put across a reload, and its siblings don't move", async ({
  page,
}) => {
  await page.goto("./");
  const names = EXAMPLE_PARTS.map(({ name }) => name);
  const positionsOf = async (): Promise<Record<string, string | null>> =>
    Object.fromEntries(
      await Promise.all(
        names.map(async (name) => [name, await partNode(page, name).getAttribute("transform")]),
      ),
    );

  const before = await positionsOf();
  await dragNode(page, partNode(page, "The Fixer"), 70, 50);
  const after = await positionsOf();

  expect(after["The Fixer"]).not.toBe(before["The Fixer"]);
  for (const name of names.filter((name) => name !== "The Fixer")) {
    expect(after[name], name).toBe(before[name]);
  }

  // The sample's Fixer has no hand-placed position until this drag gives it
  // one, so a number here is the drag having been saved.
  await expect
    .poll(async () => {
      const fixer = (await storedMap(page))?.parts.find(({ id }) => id === "the-fixer");
      return typeof fixer?.x;
    })
    .toBe("number");

  await page.reload();
  await expect(allPartNodes(page)).toHaveCount(EXAMPLE_PARTS.length);
  expect(await positionsOf()).toEqual(after);
});
