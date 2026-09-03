<script lang="ts">
  import { partCaption, polarToPoint, wrapLabel } from "../layout";
  import { ACTIVE_TOGGLE, HANDLE, isLowDefinition, NODE, ROLES } from "../theme";
  import type { Part, Point } from "../types";

  interface Props {
    part: Part;
    position: Point;
    selected: boolean;
    onselect: (id: string) => void;
    /** Commit a dragged position, in diagram space. */
    onmove: (id: string, point: Point) => void;
    /** Begin drawing a connection out of this node. */
    onconnectstart: (id: string) => void;
    /** Flip this part's `active` flag, without opening the edit modal. */
    ontoggleactive: (id: string) => void;
    /** True while a connection is being drawn and could land here. */
    dropTarget: boolean;
    /** True while any connection is being drawn, from any node. */
    drawing: boolean;
  }

  const {
    part,
    position,
    selected,
    onselect,
    onmove,
    onconnectstart,
    ontoggleactive,
    dropTarget,
    drawing,
  }: Props = $props();

  let hovered = $state(false);
  let focused = $state(false);

  /**
   * Handles appear on hover and on keyboard focus. They stay hidden while a
   * connection is being drawn — at that point every other node is a potential
   * target, and four handles lighting up under the cursor would read as four
   * things to aim at rather than one.
   */
  const showHandles = $derived((hovered || focused) && !drawing);

  /** Cardinal points on the circumference, in the node's own local space. */
  const HANDLE_POSITIONS: readonly Point[] = [
    { x: 0, y: -NODE.radius },
    { x: NODE.radius, y: 0 },
    { x: 0, y: NODE.radius },
    { x: -NODE.radius, y: 0 },
  ];

  /**
   * A diagonal bearing rather than a cardinal one, so this never lands on top
   * of one of the four connection handles above.
   */
  const ACTIVE_TOGGLE_POSITION = polarToPoint(45, NODE.radius);

  function handleConnectStart(event: PointerEvent): void {
    if (event.button !== 0) return;
    // Without this the node's own pointerdown also fires and the node starts
    // following the cursor while the connector is being drawn out of it.
    event.stopPropagation();
    onconnectstart(part.id);
  }

  /**
   * A click-based toggle rather than pointerdown: unlike drawing a
   * connection, there's no drag to beat to the punch, so the ordinary click
   * gesture is the right one. Still stops propagation on both events —
   * pointerdown so the node's own drag-gesture tracking never engages, click
   * so the node's body-click handler doesn't also open the detail panel.
   */
  function handleToggleActive(event: MouseEvent): void {
    event.stopPropagation();
    ontoggleactive(part.id);
  }

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
   * "emerging" / "unwitnessed" parts are drawn low-definition: a
   * thinner dashed circle with no glow and a dimmed label. This is driven by
   * status, and is a different thing from a connector's dash, which encodes
   * whether the edge touches Self.
   */
  const lowDefinition = $derived(isLowDefinition(part.status));

  const lines = $derived(wrapLabel(part.name));

  /**
   * Shrink the label when the longest line would otherwise run past the
   * circle's edge — the original design does the same, setting "Alarmist" a point
   * smaller than "The Analyst".
   */
  const labelSize = $derived.by(() => {
    const longest = Math.max(...lines.map((line) => line.length));
    const fitted = NODE.labelWidth / (longest * NODE.glyphWidthRatio);
    return Math.max(NODE.minLabelSize, Math.min(NODE.labelSize, fitted));
  });
  const meta = $derived(partCaption(part).toUpperCase());
  const ariaLabel = $derived(
    `${part.name}, ${partCaption(part)}`.replaceAll(" · ", ", "),
  );

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
  aria-label={ariaLabel}
  aria-pressed={selected}
  bind:this={element}
  onclick={handleClick}
  onkeydown={handleKey}
  onpointerenter={() => (hovered = true)}
  onpointerleave={() => (hovered = false)}
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
>
  {#if dropTarget}
    <!-- Ring marking this node as somewhere the in-flight connector can land. -->
    <circle
      r={NODE.radius + HANDLE.dropTargetRadius}
      fill="none"
      stroke={tokens.accent}
      stroke-width={HANDLE.dropTargetWidth}
      opacity="0.9"
    />
  {/if}

  {#if selected}
    <!-- DERIVED: the original design has no selected state. A concentric ring in the
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

  <g class="handles" class:visible={showHandles} aria-hidden="true">
    {#each HANDLE_POSITIONS as handle, index (index)}
      <!--
        Drawing a connection is a pointer-only affordance. The handles are
        hidden from assistive technology rather than made focusable, because a
        focusable control that does nothing on Enter is worse than none: there
        is no keyboard path for drawing a connection, and the plan allows
        punting gestures of this class. Existing connections stay readable
        without a pointer — the detail panel lists every one touching a part.
      -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <circle
        class="handle"
        cx={handle.x}
        cy={handle.y}
        r={HANDLE.radius}
        fill={tokens.accent}
        stroke={tokens.nodeFill}
        stroke-width="1.5"
        onpointerdown={handleConnectStart}
      />
    {/each}
  </g>

  <!--
    Unlike the connection handles above, this stays visible at rest — it is
    the part's active/inactive state, not just a way to change it, so hiding
    it behind hover would defeat the point. Pointer-only for the same reason
    as the handles: a nested focusable control inside this node's own
    role="button" would be invalid structure, and the Edit modal's "Active
    this week" checkbox already gives keyboard users the same action.
  -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <g
    class="active-toggle"
    transform="translate({ACTIVE_TOGGLE_POSITION.x}, {ACTIVE_TOGGLE_POSITION.y})"
    aria-hidden="true"
    onpointerdown={(event) => event.stopPropagation()}
    onclick={handleToggleActive}
  >
    <title>{part.active ? "Mark inactive" : "Mark active this week"}</title>
    <!-- Wider than the drawn circle below, so a small badge doesn't also
         have to be a precise click. -->
    <circle class="hit-area" r={ACTIVE_TOGGLE.hitRadius} fill="transparent" />
    <circle
      r={ACTIVE_TOGGLE.radius}
      fill={part.active ? tokens.accent : "none"}
      stroke={tokens.accent}
      stroke-width={ACTIVE_TOGGLE.strokeWidth}
    />
    {#if part.active}
      <path
        d={ACTIVE_TOGGLE.checkPath}
        fill="none"
        stroke={tokens.nodeFill}
        stroke-width={ACTIVE_TOGGLE.checkStrokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    {/if}
  </g>
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

  .handles {
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms ease;
  }

  .handles.visible {
    opacity: 1;
    /* Only grabbable once visible — an invisible handle is a trap. */
    pointer-events: auto;
  }

  .handle {
    cursor: crosshair;
  }

  .active-toggle {
    cursor: pointer;
  }

  .active-toggle circle:not(.hit-area) {
    transition: fill 150ms ease;
  }

  .node:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 4px;
    border-radius: 50%;
  }
</style>
