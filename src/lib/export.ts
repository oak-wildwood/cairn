import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { downloadBlob, fileStamp } from "./backup";

/**
 * Rendering the map as a PNG the user can keep or share.
 *
 * The diagram is already an `<svg>`, so the work here is not drawing it again
 * — it is making a *self-contained* copy. The live SVG leans on the document
 * around it for things that never appear in its own markup: the font comes
 * from `body`, and a connector label's dark halo comes from a scoped CSS rule.
 * A serialized clone is rendered in isolation, with no stylesheet and no
 * cascade, so anything the CSS was contributing has to be written onto the
 * clone as inline style first or it silently disappears.
 *
 * When a part is selected, its detail panel is appended beside the diagram —
 * the same idea as `pdfExport.ts`'s one-page-per-part capture, but for the
 * single part the user already has open rather than every part in turn. The
 * panel is plain HTML, not SVG, so it is captured with `html-to-image`
 * instead of the clone-and-inline-style approach above: cloning it as SVG
 * would lose the cascade the same way the diagram's clone would if this file
 * didn't put it back.
 *
 * Everything stays local — this reads the DOM and writes a file, and makes no
 * network request of any kind.
 */

/** `cairn-map-2026-08-31.png`, matching the backup file's naming. */
export function exportFileName(now: Date): string {
  return `cairn-map-${fileStamp(now)}.png`;
}

/**
 * Rendered at 2x so the PNG stands up to a retina screen and to being zoomed
 * into, rather than at the CSS size where the type would go soft.
 */
const SCALE = 2;

/**
 * The properties the cascade contributes to how the diagram *rasterises*.
 *
 * Deliberately a whitelist rather than every computed property. Copying the
 * whole computed style would bloat the markup enormously and, worse, would
 * write out `transform` as a resolved matrix — which in SVG2 overrides the
 * `transform` attribute the layout depends on, moving every node.
 *
 * - the font group: part labels inherit their family from `body`, so without
 *   this the export falls back to a serif and no longer matches the screen
 * - `opacity`: how a filtered-out part is faded, and also how connection
 *   handles are hidden (`.handles { opacity: 0 }`) — miss it and every node
 *   exports wearing four handles it doesn't have on screen
 * - the stroke group and `paint-order`: the dark halo that `.label` paints
 *   behind connector labels so they stay readable where they cross a line
 *
 * `fill` is left out on purpose. Every fill in the diagram is already a
 * presentation attribute, so it survives serialisation on its own, and a
 * computed `fill` can come back as an absolute `url(...)` reference that no
 * longer resolves once the markup is standing alone.
 */
const INLINED_PROPERTIES: readonly string[] = [
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "letter-spacing",
  "opacity",
  "paint-order",
  "stroke",
  "stroke-width",
  "stroke-linejoin",
];

/**
 * Copy the cascade onto the clone, element for element.
 *
 * Walks both trees in parallel by index, which is sound only because the clone
 * is still structurally identical to the original — so this has to run before
 * anything is removed from it.
 */
function inlineComputedStyle(source: SVGSVGElement, clone: SVGSVGElement): void {
  const from = [source, ...source.querySelectorAll("*")];
  const to = [clone, ...clone.querySelectorAll("*")];

  for (let index = 0; index < from.length; index += 1) {
    const target = to[index];
    if (!(target instanceof SVGElement)) continue;
    const computed = getComputedStyle(from[index]);
    const declarations = INLINED_PROPERTIES.map(
      (property) => `${property}:${computed.getPropertyValue(property)}`,
    );
    target.setAttribute("style", declarations.join(";"));
  }
}

/**
 * Strip the parts of the canvas that are controls rather than map.
 *
 * A label editor, the connection handles and the in-flight connector are all
 * mid-gesture UI. None of them belong in a picture of the map, and the
 * `<foreignObject>` editor would not survive the trip anyway — HTML inside an
 * SVG loaded as an image is not rendered.
 */
function removeInteractionChrome(clone: SVGSVGElement): void {
  for (const node of clone.querySelectorAll(
    "foreignObject, .handles, .drawing-line",
  )) {
    node.remove();
  }
}

/**
 * Wider than the live sidebar's 22rem, for the exported image only — matches
 * `pdfExport.ts`'s `EXPORT_PANEL_WIDTH`. The panel's long-form fields read
 * cramped at the width the app uses next to the live, interactive diagram.
 */
const EXPORT_PANEL_WIDTH = "26rem";

/**
 * The page's own background (`App.svelte`'s `body`, and the same value as
 * the panel's own "darkest background stop" comment). Used to fill the gap
 * this file draws between the diagram and the panel, and any leftover height
 * below whichever of the two is shorter — without it those areas would come
 * out transparent instead of matching what the live page looks like there.
 */
const PAGE_BACKGROUND = "#0b0c12";

/**
 * Screenshot the open detail panel as its own canvas.
 *
 * Widens the panel to `EXPORT_PANEL_WIDTH` and hides every
 * `data-export-hide` element — the close button, the quick feelings editor,
 * the Edit/Delete row — none of which belong in a picture of the part, same
 * as `pdfExport.ts`'s identical capture of the same panel. Both overrides
 * mutate the live, on-screen element for the moment of the capture and are
 * put back immediately after, `setProperty(property, "")` restoring "no
 * inline value at all" when that's what was there before.
 *
 * What is *not* overridden here is the panel's own layout: `html-to-image`
 * freezes each element's computed size onto its clone, so anything the live
 * panel sizes to its exact content comes out with no room to reflow in. See
 * `PartDetailPanel.svelte`'s `.title`, which fills its row for that reason.
 */
async function capturePanelCanvas(panel: HTMLElement): Promise<HTMLCanvasElement> {
  const inner = panel.querySelector<HTMLElement>(".inner");
  const widened = [panel, inner].filter((el): el is HTMLElement => el !== null);
  const previousWidths = widened.map((el) => el.style.getPropertyValue("width"));
  for (const el of widened) el.style.setProperty("width", EXPORT_PANEL_WIDTH);

  const hidden = Array.from(panel.querySelectorAll<HTMLElement>("[data-export-hide]"));
  const previousDisplay = hidden.map((el) => el.style.getPropertyValue("display"));
  for (const el of hidden) el.style.setProperty("display", "none");

  // The panel's on-screen height is not its content's height: `.workspace`
  // is a flex row, so the panel is stretched to whatever the diagram beside
  // it happens to be and `.inner` scrolls off whatever doesn't fit. That is
  // right on screen and wrong in a picture — `html-to-image` sizes its
  // `<foreignObject>` viewport from one `clientHeight` reading taken up
  // front, so a part with more to say than that height exports cut off
  // mid-sentence, with nothing left to scroll. Taking the larger of the two
  // lets all of it through, while a part with less to say still fills the
  // diagram's height the way it does on screen.
  //
  // Read last, because both overrides above change how much room the content
  // needs: the wider panel rewraps every paragraph, and hiding the controls
  // takes a row of buttons out. `pdfExport.ts` needs the same room and gets
  // it a different way, since it captures the whole workspace rather than
  // the panel alone.
  const previousHeight = panel.style.getPropertyValue("height");
  if (inner) {
    panel.style.setProperty(
      "height",
      `${Math.max(panel.clientHeight, inner.scrollHeight)}px`,
    );
  }

  try {
    const fontEmbedCSS = await getFontEmbedCSS(panel);
    return await toCanvas(panel, { pixelRatio: SCALE, fontEmbedCSS });
  } finally {
    panel.style.setProperty("height", previousHeight);
    widened.forEach((el, index) => el.style.setProperty("width", previousWidths[index]));
    hidden.forEach((el, index) => el.style.setProperty("display", previousDisplay[index]));
  }
}

/**
 * Lay the panel beside the diagram on one canvas, top-aligned the way
 * `.workspace`'s flex row aligns them live. `gap` is read from that live
 * element rather than hard-coded, so this stays correct if the CSS gap ever
 * changes.
 */
function compositeWithPanel(
  diagram: HTMLCanvasElement,
  panel: HTMLCanvasElement,
  gap: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = diagram.width + gap + panel.width;
  canvas.height = Math.max(diagram.height, panel.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  context.fillStyle = PAGE_BACKGROUND;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(diagram, 0, 0);
  context.drawImage(panel, diagram.width + gap, 0);
  return canvas;
}

/**
 * Serialise the diagram to a standalone SVG data URI.
 *
 * Percent-encoded rather than base64: the map is full of characters outside
 * Latin-1 — the "·" in every node caption, the em dashes in the copy — and
 * `btoa` throws on all of them.
 */
function toDataUri(clone: SVGSVGElement): string {
  const markup = new XMLSerializer().serializeToString(clone);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

/**
 * Render the live diagram to a PNG and hand it to the browser as a download.
 * When `panel` is given — the open detail panel of whichever part is
 * selected — it is appended beside the diagram, so a saved image can show
 * the highlighted part together with what it says about it.
 *
 * Throws if the browser cannot rasterise the SVG or produce a blob, so the
 * caller can say so rather than leaving a click that appears to do nothing.
 */
export async function exportMapPng(
  svg: SVGSVGElement,
  panel: HTMLElement | null = null,
  now: Date = new Date(),
): Promise<void> {
  // The live viewBox tracks the user's zoom and pan, so it's cropped or
  // off-centre exactly when the view is. `Diagram.svelte` also stamps the
  // un-zoomed, un-panned frame onto `data-fit-viewbox`, and that — not
  // whatever the screen happens to be showing — is the picture people want
  // when they save an image of the whole map.
  const [x, y, width, height] = (svg.dataset.fitViewbox ?? "")
    .split(" ")
    .map(Number);

  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineComputedStyle(svg, clone);
  removeInteractionChrome(clone);

  // The serialised copy is its own document, so it needs the namespace and a
  // concrete size — it has no parent element to be sized by.
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const image = new Image();
  image.src = toDataUri(clone);
  // `decode` rejects on a malformed SVG, where `onload` would simply never
  // fire and leave this hanging.
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * SCALE);
  canvas.height = Math.round(height * SCALE);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");
  // No background fill: the diagram's own backdrop rect spans 3000 units from
  // (-1500, -1500), which covers the 900x770 viewBox many times over.
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let output: HTMLCanvasElement = canvas;
  if (panel) {
    const panelCanvas = await capturePanelCanvas(panel);
    const gap = panel.parentElement
      ? parseFloat(getComputedStyle(panel.parentElement).columnGap) * SCALE
      : 0;
    output = compositeWithPanel(canvas, panelCanvas, gap);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    output.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("The map could not be encoded as a PNG.");

  // A blob rather than the plan's `toDataURL`: at 2x this image is megabytes,
  // and a data URL would build all of it as one base64 string first.
  downloadBlob(blob, exportFileName(now));
}
