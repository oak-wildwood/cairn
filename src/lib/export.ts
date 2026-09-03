import { fileStamp } from "./backup";

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
 *
 * Throws if the browser cannot rasterise the SVG or produce a blob, so the
 * caller can say so rather than leaving a click that appears to do nothing.
 */
export async function exportMapPng(
  svg: SVGSVGElement,
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

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("The map could not be encoded as a PNG.");

  // A blob rather than the plan's `toDataURL`: at 2x this image is megabytes,
  // and a data URL would build all of it as one base64 string first.
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(now);
  link.click();
  URL.revokeObjectURL(url);
}
