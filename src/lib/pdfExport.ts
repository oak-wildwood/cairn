import { jsPDF } from "jspdf";
import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { fileStamp } from "./backup";

/**
 * Rendering one PDF page per part, each a screenshot of the live workspace
 * (diagram + open detail panel) with that part selected.
 *
 * Unlike `export.ts`'s PNG export, this captures an attached, on-screen DOM
 * node rather than a serialised, detached SVG clone — `html-to-image` clones
 * the live tree into a `<foreignObject>`-wrapped SVG, so the cascade travels
 * with it and none of `export.ts`'s inline-the-computed-style machinery is
 * needed here.
 *
 * The panel's title is set in Cormorant Garamond, `index.html`'s Google Fonts
 * import — italic, and narrower than the `Georgia`/serif fallback in
 * `--font-display`. `html-to-image` captures a name into a `<foreignObject>`
 * as real HTML, so if the real font isn't embedded in that snapshot it falls
 * back to the wider serif and wraps a name the live panel fits on one line.
 * `getFontEmbedCSS` only embeds a font it finds actually in use in the given
 * node's current subtree, so it has to run *after* the first part is
 * selected and the panel (carrying the only Cormorant Garamond text inside
 * `workspace`) has mounted — asking beforehand, while no panel exists yet,
 * silently drops the font from every page's embed, not just the first.
 * Computed once there and reused for the rest (no new network request — the
 * browser already fetched the font to render the page — and no repeat scan).
 */

/** `cairn-map-parts-2026-08-31.pdf`. Shares its stem with the PNG/JSON exports. */
export function pdfExportFileName(now: Date): string {
  return `cairn-map-parts-${fileStamp(now)}.pdf`;
}

/**
 * Matches `export.ts`'s `SCALE`: rendered at 2x so a page stands up to being
 * printed or zoomed into, rather than at the CSS size where the type would
 * go soft.
 */
const SCALE = 2;

/** CSS px -> PDF pt, at the standard 96 CSS px per 72pt inch. */
const PX_TO_PT = 72 / 96;

/**
 * How long to wait for `PartDetailPanel`'s `reveal` transition to settle
 * before capturing anyway. `reveal` dispatches a real `introend` event when
 * it finishes — immediately, under `prefers-reduced-motion` — so this is a
 * safety net for a missed event, not the primary signal.
 */
const TRANSITION_TIMEOUT_MS = 1000;

/**
 * Resolve once the open detail panel's opening transition has settled, or
 * after `TRANSITION_TIMEOUT_MS` if no panel appears. A part with no
 * worksheet content still opens a panel, so the event should always fire,
 * but a selection that somehow fails to open one should not hang the export.
 */
function waitForPanelReveal(workspace: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const panel = workspace.querySelector<HTMLElement>("aside");
    if (!panel) {
      resolve();
      return;
    }
    const timeout = setTimeout(resolve, TRANSITION_TIMEOUT_MS);
    panel.addEventListener(
      "introend",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

/** Wait for Svelte to flush the DOM after a state change, plus one paint. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Leave out controls that only make sense in the live app: the panel's close
 * button and its Edit / Delete / Confirm delete row. A PDF page has no click
 * handler behind either, so keeping them would export dead buttons rather
 * than a record of the part.
 *
 * This only reaches plain HTML — `html-to-image` clones an `<svg>` subtree
 * with one native `element.cloneNode(true)` rather than walking it node by
 * node (`clone-node.js`'s `cloneChildren` bails out as soon as the cloned
 * node is itself an `<svg>`), so `filter` is never called for anything
 * inside the diagram. `hideHandlesForCapture` below handles that case — no
 * pun intended — by hiding the live elements before the capture instead.
 */
function isExportContent(node: HTMLElement): boolean {
  if (!node.classList) return true;
  if (node.classList.contains("close")) return false;
  if (node.tagName === "FOOTER" && node.classList.contains("actions")) return false;
  return true;
}

/**
 * Every node's connection handles (`PartNode.svelte`/`SelfNode.svelte`,
 * `.handles`) are normally invisible (`opacity: 0`) except on hover or
 * focus, but they live inside the diagram's `<svg>`, where `filter` above
 * can't reach them (see `isExportContent`) — so instead of excluding them
 * from the clone, this hides the live elements outright for the moment of
 * capture and restores them straight after. `export.ts`'s PNG export hits
 * the identical problem for the identical reason: "miss it and every node
 * exports wearing four handles it doesn't have on screen."
 */
function hideHandlesForCapture(workspace: HTMLElement): () => void {
  const handles = Array.from(workspace.querySelectorAll<SVGElement>(".handles"));
  const previousDisplay = handles.map((el) => el.style.display);
  for (const el of handles) el.style.display = "none";

  return () => {
    handles.forEach((el, index) => {
      el.style.display = previousDisplay[index];
    });
  };
}

/**
 * Wider than the live sidebar's 22rem, for the PDF page only: the panel's
 * long-form fields read cramped at the width the app uses next to the live,
 * interactive diagram. Applied as a temporary inline override on the live
 * `.panel`/`.inner` nodes right before a capture and cleared right after, so
 * the on-screen app is never left wider than its designed width — only
 * above the 900px breakpoint, where the panel is a fixed-width sidebar
 * rather than a full-width strip under the diagram.
 */
const EXPORT_PANEL_WIDTH = "26rem";

/**
 * Temporarily widen the open panel for one capture. Returns a function that
 * puts each overridden node's width back exactly as found, including "no
 * inline width at all" when the live app had none.
 */
function widenPanelForCapture(workspace: HTMLElement): () => void {
  if (!matchMedia("(min-width: 901px)").matches) return () => {};

  const targets = [
    workspace.querySelector<HTMLElement>(".panel"),
    workspace.querySelector<HTMLElement>(".panel .inner"),
  ].filter((el): el is HTMLElement => el !== null);

  const previousWidths = targets.map((el) => el.style.width);
  for (const el of targets) el.style.width = EXPORT_PANEL_WIDTH;

  return () => {
    targets.forEach((el, index) => {
      el.style.width = previousWidths[index];
    });
  };
}

/**
 * Render one page per part into a multi-page PDF and hand it to the browser
 * as a download.
 *
 * `workspace` is captured as it stands at the moment each part is selected,
 * so it has to be the live, on-screen element — a detached clone would never
 * show the panel `selectPart` opens. Pages are sized to their own screenshot
 * rather than a fixed page size: the panel's height tracks how much a part
 * has answered and how many connections it has, and a fixed page would mean
 * picking a background colour to fill the gap around a smaller image.
 * `.workspace` lays the diagram and panel side by side above the 900px
 * breakpoint, so every capture is wide — pages are created in landscape to
 * match that shape rather than a portrait frame around a wide image.
 *
 * `onProgress` fires once per part, after that part's page is added, so a
 * caller can show "Exporting part 3 of 9…" while the real selection cycles
 * through the map.
 */
export async function exportPartsPdf(
  workspace: HTMLElement,
  partIds: readonly string[],
  selectPart: (id: string) => void,
  onProgress?: (done: number, total: number) => void,
  now: Date = new Date(),
): Promise<void> {
  if (partIds.length === 0) return;

  let fontEmbedCSS: string | undefined;
  let doc: jsPDF | null = null;

  for (const [index, id] of partIds.entries()) {
    selectPart(id);
    await nextFrame();
    await waitForPanelReveal(workspace);

    // First iteration only: the panel has just mounted, so this is the
    // earliest point at which its Cormorant Garamond title is actually in
    // the DOM for `getFontEmbedCSS` to find.
    if (fontEmbedCSS === undefined) {
      fontEmbedCSS = await getFontEmbedCSS(workspace);
    }

    const restorePanelWidth = widenPanelForCapture(workspace);
    const restoreHandles = hideHandlesForCapture(workspace);
    await nextFrame();
    const canvas = await toCanvas(workspace, {
      pixelRatio: SCALE,
      fontEmbedCSS,
      filter: isExportContent,
    });
    restoreHandles();
    restorePanelWidth();
    const width = (canvas.width / SCALE) * PX_TO_PT;
    const height = (canvas.height / SCALE) * PX_TO_PT;
    // JPEG rather than PNG: the workspace is full of soft radial glows behind
    // each node, and lossless PNG compresses that gradient noise so poorly
    // that a handful of pages ran to well over 100MB. JPEG's lossy encoding
    // is built for exactly this kind of photographic-style content, and at
    // this quality the text in the detail panel stays crisp.
    const image = canvas.toDataURL("image/jpeg", 0.92);

    if (!doc) {
      doc = new jsPDF({ orientation: "landscape", unit: "pt", format: [width, height] });
    } else {
      doc.addPage([width, height], "landscape");
    }
    doc.addImage(image, "JPEG", 0, 0, width, height);

    onProgress?.(index + 1, partIds.length);
  }

  if (!doc) return;

  // A blob rather than a data URL, matching `exportMapPng`/`downloadMap`: a
  // many-page PDF at 2x is easily megabytes, and a data URL would build all
  // of it as one base64 string first.
  const url = URL.createObjectURL(doc.output("blob"));
  const link = document.createElement("a");
  link.href = url;
  link.download = pdfExportFileName(now);
  link.click();
  URL.revokeObjectURL(url);
}
