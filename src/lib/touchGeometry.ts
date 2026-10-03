import type { Point } from "./types";

/**
 * Pure geometry for the phone-sized layout, kept out of the components that
 * use it so it can be unit tested without a DOM.
 */

/**
 * Everything a pinch needs from the moment the second finger lands. Frozen
 * then, and every later move is solved against it, rather than stepping from
 * the previous move: an incremental pinch compounds rounding and clamping
 * error each frame, and the map slowly slides out from under the fingers.
 */
export interface PinchStart {
  /** The diagram-space point under the two fingers' midpoint at the start. */
  anchor: Point;
  /** Distance between the two fingers at the start, in client pixels. */
  distance: number;
  /** The zoom in effect at the start. */
  zoom: number;
  /** Client pixels per diagram unit at the start, at `zoom`. */
  scale: number;
  /** The un-zoomed, un-panned frame's own centre, in diagram space. */
  viewCenter: Point;
  /** The `<svg>`'s own centre in client pixels, which the view centre maps to. */
  elementCenter: Point;
}

/**
 * Zoom and pan for a pinch in progress: the zoom follows the ratio of the
 * fingers' spread to their spread at the start, and the pan keeps
 * `start.anchor` under the fingers' current midpoint — so a pinch both
 * zooms about the fingers and drags the map along with them, the way a
 * phone's own maps do.
 *
 * `pan` is in `Diagram.svelte`'s sense: the offset of the view's centre from
 * `start.viewCenter`, in diagram units. That relies on `preserveAspectRatio`
 * centring the viewBox in the element ("xMid YMid"), so the view's centre is
 * always drawn at `start.elementCenter`.
 */
export function pinchView(
  start: PinchStart,
  midpoint: Point,
  distance: number,
  limits: { min: number; max: number },
): { zoom: number; pan: Point } {
  const zoom = Math.min(
    limits.max,
    Math.max(limits.min, (start.zoom * distance) / start.distance),
  );
  // Pixels per unit scale linearly with zoom: halving the viewBox doubles
  // how large each unit is drawn.
  const scale = (start.scale * zoom) / start.zoom;
  return {
    zoom,
    pan: {
      x:
        start.anchor.x -
        (midpoint.x - start.elementCenter.x) / scale -
        start.viewCenter.x,
      y:
        start.anchor.y -
        (midpoint.y - start.elementCenter.y) / scale -
        start.viewCenter.y,
    },
  };
}

/**
 * The left edge for a popover of `width` that would like to open at
 * `preferred`, moved only as far as it takes to keep the whole popover
 * `margin` inside a viewport `viewportWidth` wide. A trigger near the right
 * of a phone screen would otherwise open its popover half off the edge.
 * When the viewport is too narrow for the popover at all, the left edge
 * wins — the start of a list is the part worth seeing.
 */
export function clampPopoverLeft(
  preferred: number,
  width: number,
  viewportWidth: number,
  margin: number,
): number {
  const maxLeft = viewportWidth - margin - width;
  return Math.max(margin, Math.min(preferred, maxLeft));
}
