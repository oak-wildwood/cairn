<script lang="ts">
  import { wrapLabel } from "../layout";
  import { isLowDefinition, NODE, ROLES } from "../theme";
  import type { Part, Point } from "../types";

  interface Props {
    part: Part;
    position: Point;
    selected: boolean;
    onselect: (id: string) => void;
    /** Commit a dragged position, in diagram space. */
    onmove: (id: string, point: Point) => void;
  }

  const { part, position, selected, onselect, onmove }: Props = $props();

  /**
   * How far the pointer must travel before this stops being a click and starts
   * being a drag. Small enough that a deliberate nudge registers, large enough
   * to absorb the few pixels a hand moves during an ordinary click.
   */
  const DRAG_THRESHOLD_PX = 4;

  let element = $state<SVGGElement | null>(null);

  interface Gesture {
    pointerId: number;
    /** Where the pointer went down, in client space, for the threshold test. */
    originX: number;
    originY: number;
    /** Grab offset, so the node doesn't snap its centre to the cursor. */
    offsetX: number;
    offsetY: number;
    dragging: boolean;
  }

  let gesture: Gesture | null = null;

  /**
   * A drag that passed the threshold has to swallow the `click` that follows
   * it, or letting go of a node would also open its detail panel.
   */
  let suppressClick = false;

  /**
   * Client pixels to diagram units. `getScreenCTM` accounts for the viewBox,
   * `preserveAspectRatio` and the element's on-screen size in one step, which
   * matters here because the diagram rescales whenever the detail panel opens
   * — a hand-rolled ratio would be stale the moment it does.
   */
  function toDiagramSpace(event: PointerEvent): Point | null {
    const svg = element?.ownerSVGElement;
    const screenToLocal = svg?.getScreenCTM()?.inverse();
    if (!screenToLocal) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      screenToLocal,
    );
    return { x: point.x, y: point.y };
  }

  function handlePointerDown(event: PointerEvent): void {
    // Secondary buttons open context menus; they are not the start of a drag.
    if (event.button !== 0) return;
    const pointerPosition = toDiagramSpace(event);
    if (!pointerPosition) return;

    element?.setPointerCapture(event.pointerId);
    gesture = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      offsetX: position.x - pointerPosition.x,
      offsetY: position.y - pointerPosition.y,
      dragging: false,
    };
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    if (!gesture.dragging) {
      const travelled = Math.hypot(
        event.clientX - gesture.originX,
        event.clientY - gesture.originY,
      );
      if (travelled < DRAG_THRESHOLD_PX) return;
      gesture.dragging = true;
    }

    const pointerPosition = toDiagramSpace(event);
    if (!pointerPosition) return;
    onmove(part.id, {
      x: pointerPosition.x + gesture.offsetX,
      y: pointerPosition.y + gesture.offsetY,
    });
  }

  function handlePointerUp(event: PointerEvent): void {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    element?.releasePointerCapture(event.pointerId);
    suppressClick = gesture.dragging;
    gesture = null;
  }

  /**
   * Kept as a `click` handler rather than folded into `pointerup`: assistive
   * technology activates a control by dispatching `click`, with no pointer
   * events at all, so moving selection onto the pointer path would make the
   * nodes unreachable that way.
   */
  function handleClick(): void {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    onselect(part.id);
  }

  /**
   * Enter and Space activate, matching a real button. Keyboard repositioning
   * is deliberately not implemented — the plan calls it a reasonable thing to
   * punt, and this is that punt: a node can be selected, read and edited from
   * the keyboard, but not moved.
   */
  function handleKey(event: KeyboardEvent): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onselect(part.id);
  }

  const tokens = $derived(ROLES[part.role]);

  /**
   * "emerging" / "unwitnessed" parts are drawn as the comp draws them: a
   * thinner dashed circle with no glow and a dimmed label. This is driven by
   * status, and is a different thing from a connector's dash, which encodes
   * whether the edge touches Self.
   */
  const lowDefinition = $derived(isLowDefinition(part.status));

  const lines = $derived(wrapLabel(part.name));

  /**
   * Shrink the label when the longest line would otherwise run past the
   * circle's edge — the comp does the same, setting "Alarmist" a point
   * smaller than "The Analyst".
   */
  const labelSize = $derived.by(() => {
    const longest = Math.max(...lines.map((line) => line.length));
    const fitted = NODE.labelWidth / (longest * NODE.glyphWidthRatio);
    return Math.max(NODE.minLabelSize, Math.min(NODE.labelSize, fitted));
  });
  const meta = $derived(`${part.role} · ${part.status}`.toUpperCase());

  /** Centre a one- or two-line label on the node's midline. */
  const firstLineY = $derived(
    lines.length === 1
      ? labelSize * 0.36
      : labelSize * 0.36 - NODE.lineHeight / 2,
  );
</script>

<g
  class="node"
  transform="translate({position.x}, {position.y})"
  role="button"
  tabindex="0"
  aria-label="{part.name}, {part.role}, {part.status}"
  aria-pressed={selected}
  bind:this={element}
  onclick={handleClick}
  onkeydown={handleKey}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
>
  {#if selected}
    <!-- DERIVED: the comp has no selected state. A concentric ring in the
         role's own accent marks it without introducing a new colour. -->
    <circle
      r={NODE.radius + 9}
      fill="none"
      stroke={tokens.accent}
      stroke-width="1.4"
      opacity="0.55"
    />
  {/if}

  <circle
    r={NODE.radius}
    fill={tokens.nodeFill}
    stroke={tokens.accent}
    stroke-width={lowDefinition ? NODE.mutedStrokeWidth : NODE.strokeWidth}
    stroke-dasharray={lowDefinition ? NODE.mutedDashArray : undefined}
    opacity={lowDefinition ? NODE.mutedOpacity : 1}
    filter={lowDefinition ? undefined : "url(#glow)"}
  />

  {#each lines as line, index (index)}
    <text
      y={firstLineY + index * NODE.lineHeight}
      fill={lowDefinition ? NODE.mutedLabelColor : NODE.labelColor}
      font-size={labelSize}
      text-anchor="middle">{line}</text
    >
  {/each}

  <text
    y={NODE.metaOffset}
    fill={lowDefinition ? tokens.accentMuted : tokens.accent}
    font-size={NODE.metaSize}
    letter-spacing={NODE.metaLetterSpacing}
    font-weight="600"
    text-anchor="middle">{meta}</text
  >
</g>

<style>
  .node {
    cursor: grab;
    /* Stops a touch drag scrolling the page instead of moving the node, and
       stops a mouse drag selecting the label text underneath it. */
    touch-action: none;
    user-select: none;
  }

  .node:active {
    cursor: grabbing;
  }

  .node:focus {
    outline: none;
  }

  .node:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 4px;
    border-radius: 50%;
  }
</style>
