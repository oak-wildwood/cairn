import { test as base, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { makePart } from "../src/lib/testParts";
import { SCHEMA_VERSION, SELF_ID } from "../src/lib/types";
import type { Connection, Part, PersistedState } from "../src/lib/types";

/**
 * Shared fixtures and helpers for the end-to-end suite.
 *
 * Every part here takes one of the six generic names in `exampleData.ts` or a
 * transparently synthetic one in the style of `devFixtures.ts` ("Manager 7").
 * AGENTS.md's no-real-data rule covers these files, their traces and anything
 * they screenshot.
 */

export { expect };

/** `persistence.ts`'s storage key. */
export const MAP_KEY = "cairn.map.v1";
/** `tour.ts`'s "seen it" flag. */
export const TOUR_KEY = "cairn.tour.v1.seen";

/** The Google Fonts stylesheet `index.html` links to, and the font files it names. */
export const FONT_HOSTS: readonly string[] = ["fonts.googleapis.com", "fonts.gstatic.com"];

export const test = base.extend<{ hermetic: void }>({
  /**
   * On for every test. Requests that would leave the app's own origin are
   * aborted rather than sent, so no run depends on a third party being up and
   * nothing a test types can reach one. The privacy spec still sees them: a
   * `request` event fires before routing decides anything. A test's own
   * `page.route` takes precedence over this one.
   *
   * It also fails any test during which the page threw an uncaught error, so
   * a crash nobody asserted on still turns the run red.
   */
  hermetic: [
    async ({ context, page, baseURL }, use) => {
      const origin = new URL(baseURL ?? "http://localhost").origin;
      // On the context, so a second tab a test opens is covered too.
      await context.route(
        (url) => url.origin !== origin,
        (route) => route.abort(),
      );

      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await use();

      expect(errors, "uncaught errors in the page").toEqual([]);
    },
    { auto: true },
  ],
});

/** Mark the tour as seen, so it doesn't make the rest of the page inert. */
export async function skipTour(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    // An init script also runs on documents with no storage of their own
    // (about:blank), where touching it throws.
    try {
      localStorage.setItem(key, "1");
    } catch {
      // Nothing to mark on a page that isn't the app.
    }
  }, TOUR_KEY);
}

/**
 * Put `state` in storage before the app first loads, once per test. Guarded
 * by a sessionStorage flag (which survives a reload) so a reload reads back
 * what the app saved rather than the seed again.
 */
export async function seedMap(page: Page, state: PersistedState): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        if (sessionStorage.getItem("e2e-seeded") === "1") return;
        sessionStorage.setItem("e2e-seeded", "1");
        localStorage.setItem(key, value);
      } catch {
        // See `skipTour`.
      }
    },
    [MAP_KEY, JSON.stringify(state)] as const,
  );
}

export function mapOf(
  parts: Part[],
  connections: Connection[] = [],
  ownerName = "",
): PersistedState {
  return { schemaVersion: SCHEMA_VERSION, parts, connections, ownerName };
}

export function part(overrides: Partial<Part> & Pick<Part, "id" | "name">): Part {
  return makePart(overrides);
}

export function connection(
  id: string,
  sourceId: string,
  targetId: string,
  label = "",
): Connection {
  return { id, sourceId, targetId, label };
}

export { SELF_ID };

/** What the app last wrote to storage, or null if it never has. */
export async function storedMap(page: Page): Promise<PersistedState | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as PersistedState);
  }, MAP_KEY);
}

/** A part's node on the canvas. Its accessible name is "<name>, <caption>". */
export function partNode(page: Page, name: string): Locator {
  return page.locator(`svg.diagram g.node[aria-label^="${name},"]`);
}

export function allPartNodes(page: Page): Locator {
  return page.locator("svg.diagram g.node");
}

/** The drawn line of every connector — not its invisible hit area. */
export function connectors(page: Page): Locator {
  return page.locator("svg.diagram g.filterable > path:not(.hit-area)");
}

/**
 * The filter fade sits on the `<g class="filterable">` wrapping each node,
 * not on the node itself — see `Diagram.svelte`.
 */
export async function fadeOf(node: Locator): Promise<string | null> {
  return node.locator("xpath=..").getAttribute("opacity");
}

interface ClientPoint {
  x: number;
  y: number;
}

/** A node's centre, in client pixels, through the SVG's live transform. */
export async function nodeCenter(node: Locator): Promise<ClientPoint> {
  return node.evaluate((element) => {
    const matrix = (element as SVGGElement).getScreenCTM();
    if (!matrix) throw new Error("node has no screen CTM");
    const point = new DOMPoint(0, 0).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  });
}

/** The top connection handle on a node's rim, in client pixels. */
async function topHandle(node: Locator): Promise<ClientPoint> {
  return node.evaluate((element) => {
    const handle = element.querySelector<SVGCircleElement>("circle.handle");
    const matrix = handle?.getScreenCTM();
    if (!handle || !matrix) throw new Error("node has no connection handle");
    const point = new DOMPoint(
      handle.cx.baseVal.value,
      handle.cy.baseVal.value,
    ).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  });
}

/**
 * Draw a connector the way a person does: hover the source to show its
 * handles, press on one, and release over the target.
 */
export async function drawConnection(
  page: Page,
  from: Locator,
  to: Locator,
): Promise<void> {
  const start = await nodeCenter(from);
  await page.mouse.move(start.x, start.y);
  const handle = await topHandle(from);
  await page.mouse.move(handle.x, handle.y, { steps: 2 });
  await page.mouse.down();
  const end = await nodeCenter(to);
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

/** Press on a node's centre and drag it by a client-pixel offset. */
export async function dragNode(
  page: Page,
  node: Locator,
  dx: number,
  dy: number,
): Promise<void> {
  const start = await nodeCenter(node);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 10 });
  await page.mouse.up();
}

/** The `translate(x, y)` a node is drawn at, in diagram units. */
export async function nodePosition(node: Locator): Promise<{ x: number; y: number }> {
  const transform = await node.getAttribute("transform");
  const match = /translate\(\s*(-?[\d.e-]+)[ ,]+(-?[\d.e-]+)\s*\)/.exec(transform ?? "");
  if (!match) throw new Error(`unexpected node transform: ${transform}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

/** Select a part from the keyboard — deterministic, unlike a click on SVG. */
export async function selectPart(page: Page, name: string): Promise<void> {
  await partNode(page, name).focus();
  await page.keyboard.press("Enter");
  await expect(detailPanel(page).getByRole("heading", { name })).toBeVisible();
}

export function detailPanel(page: Page): Locator {
  return page.getByRole("complementary", { name: "Part details" });
}

/** Add a part through the toolbar's modal. */
export async function addPart(
  page: Page,
  fields: { name: string; role: Part["role"]; status?: string },
): Promise<void> {
  await page.getByRole("button", { name: "+ Add a part" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a part" });
  await dialog.getByLabel("Name", { exact: true }).fill(fields.name);
  await dialog.getByLabel("Role", { exact: true }).selectOption(fields.role);
  if (fields.status !== undefined) {
    await dialog.getByLabel("Status", { exact: true }).fill(fields.status);
  }
  await dialog.getByRole("button", { name: "Add part", exact: true }).click();
  await expect(dialog).toBeHidden();
}

export async function openMapMenu(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Menu" }).click();
  return page.getByRole("menu");
}

/** The message in the toast `App.svelte` shows after a map-file action. */
export function toast(page: Page): Locator {
  return page.locator(".toast .text");
}
