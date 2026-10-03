/**
 * The size arithmetic behind the PNG and PDF exports, kept apart from the
 * canvas and DOM work in `export.ts` and `pdfExport.ts` so it can be tested
 * without either.
 */

/**
 * Rendered at 2x so an export stands up to a retina screen, to being printed
 * and to being zoomed into, rather than at the CSS size where the type would
 * go soft. Shared by both exports so a PNG and a PDF page of the same map come
 * out at the same resolution.
 */
export const EXPORT_SCALE = 2;

/** CSS px -> PDF pt, at the standard 96 CSS px per 72pt inch. */
export const PX_TO_PT = 72 / 96;

export interface Size {
  width: number;
  height: number;
}

/** A canvas's pixel size for a diagram `width` x `height` units across. */
export function rasterSize({ width, height }: Size): Size {
  return {
    width: Math.round(width * EXPORT_SCALE),
    height: Math.round(height * EXPORT_SCALE),
  };
}

/**
 * The PNG export's one canvas: the diagram on the left, `gap` pixels, then the
 * panel, top-aligned the way `.workspace`'s flex row aligns them live. Tall
 * enough for whichever of the two is taller, so neither is cropped.
 */
export function compositeLayout(
  diagram: Size,
  panel: Size,
  gap: number,
): Size & { panelX: number } {
  return {
    width: diagram.width + gap + panel.width,
    height: Math.max(diagram.height, panel.height),
    panelX: diagram.width + gap,
  };
}

/**
 * How tall a capture must be to show all of a panel. The visible height is
 * a floor — a part with little to say still fills the height it has on
 * screen — and the scrolled content height takes over once a part has more to
 * say than that, so a screenshot with no scrollbar isn't cut off mid-sentence.
 */
export function captureHeight(visibleHeight: number, contentHeight: number): number {
  return Math.max(visibleHeight, contentHeight);
}

/**
 * A PDF page's size in points for a canvas captured at `EXPORT_SCALE`, so the
 * page is the screenshot's CSS size rather than its doubled pixel size.
 */
export function pdfPageSize(canvas: Size): Size {
  return {
    width: (canvas.width / EXPORT_SCALE) * PX_TO_PT,
    height: (canvas.height / EXPORT_SCALE) * PX_TO_PT,
  };
}
