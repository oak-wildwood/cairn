<script lang="ts">
  import {
    computeLayout,
    computeViewBox,
    connectionEdgeKey,
  } from "../layout";
  import {
    BACKDROP,
    CONNECTION,
    CONNECTOR_COLORS,
    BACKGROUND_GRADIENT,
    FILTER_FADE,
    GLOW_FILTER,
    NODE,
    ROLES,
    SECTOR_LABEL_POSITIONS,
    SECTOR_ROLES,
    SELF,
    SOFT_BLUR_FILTER,
    STAR_COLOR,
    STARS,
    TYPE_SCALE,
    WASH_GEOMETRY,
    WHEEL_ZOOM,
    ZOOM,
  } from "../theme";
  import { SELF_ID } from "../types";
  import type {
    Connection,
    EndpointId,
    Part,
    Point,
    SectorRole,
  } from "../types";
  import ConnectionPath from "./Connection.svelte";
  import PartNode from "./PartNode.svelte";
  import SelfNode from "./SelfNode.svelte";

  interface Props {
    parts: readonly Part[];
    connections: readonly Connection[];
    selectedPartId: string | null;
    onselect: (id: string) => void;
    onclear: () => void;
    onmove: (id: string, point: Point) => void;
    ontoggleactive: (id: string) => void;
    onconnectcreate: (sourceId: EndpointId, targetId: EndpointId) => void;
    selectedConnectionId: string | null;
    onconnectselect: (id: string) => void;
    onconnectlabel: (id: string, label: string) => void;
    onconnectdelete: (id: string) => void;
    onconnectclose: () => void;
    /** The role the legend is filtering to, or null for "All". */
    activeFilter: SectorRole | null;
    /** Whether the legend's "Active only" toggle is on. */
    activeOnlyFilter: boolean;
    /**
     * The live `<svg>`, bound out so the toolbar can render it to a PNG.
     * Exposed rather than exporting from in here: this component owns the
     * element, and handing out a reference keeps the export logic in one
     * module instead of splitting it across the diagram.
     */
    element?: SVGSVGElement | null;
  }

  let {
    parts,
    connections,
    selectedPartId,
    onselect,
    onclear,
    onmove,
    ontoggleactive,
    onconnectcreate,
    selectedConnectionId,
    onconnectselect,
    onconnectlabel,
    onconnectdelete,
    onconnectclose,
    activeFilter,
    activeOnlyFilter,
    element = $bindable(null),
  }: Props = $props();

  /**
   * The in-flight connector. Local rather than in the store: it never
   * persists, never outlives the gesture, and nothing outside this subtree
   * reads it. Putting transient pointer state in the shared store would mean
   * the debounced save effect wakes on every pointermove.
   */
  let drawing = $state<{ sourceId: EndpointId; point: Point } | null>(null);

  const positions = $derived(computeLayout(parts));
  /**
   * The frame grows with the map. `theme.ts`'s `VIEWBOX` is the minimum, so a
   * map that fits is composed exactly as designed; a larger one stands back
   * rather than losing parts off the edge.
   */
  const viewBox = $derived(computeViewBox(positions.values()));
  const partsById = $derived(new Map(parts.map((part) => [part.id, part])));

  /**
   * User-driven zoom and pan, local like `drawing` above: they're a way of
   * looking at the map, not a fact about one, so they stay out of the store
   * and never persist. zoom 1 / pan (0, 0) means "no zoom, no pan" — the
   * frame `computeViewBox` already fits.
   */
  let zoom = $state(1);
  let pan = $state<Point>({ x: 0, y: 0 });

  /** The un-zoomed, un-panned frame's own centre. */
  const viewCenter = $derived({
    x: viewBox.x + viewBox.width / 2,
    y: viewBox.y + viewBox.height / 2,
  });

  /**
   * Zoom and pan shrink, grow and shift the *viewBox* around `viewCenter`
   * rather than scaling or translating a wrapping `<g>`. A `<g transform>`
   * would move rendered nodes away from the coordinates `toDiagramSpace` and
   * the drag/connect hit tests still use, breaking those gestures at any
   * zoom or pan but the identity one. Resizing and offsetting the viewBox
   * instead changes what the SVG's own user space *is*, so `getScreenCTM()`
   * keeps mapping the cursor to the same part coordinates regardless of
   * either.
   */
  const scaledViewBox = $derived.by(() => {
    const width = viewBox.width / zoom;
    const height = viewBox.height / zoom;
    return {
      x: viewCenter.x + pan.x - width / 2,
      y: viewCenter.y + pan.y - height / 2,
      width,
      height,
    };
  });

  /**
   * Change zoom while keeping `pivot` (a diagram-space point) fixed under
   * wherever it already is on screen. A button click passes the current
   * view centre as `pivot`, which leaves `pan` untouched — the same
   * "zoom around the middle" behaviour this had before pan existed.
   */
  function setZoom(nextZoom: number, pivot: Point): void {
    const clamped = Math.min(ZOOM.max, Math.max(ZOOM.min, nextZoom));
    if (clamped === zoom) return;
    const factor = zoom / clamped;
    const center = { x: viewCenter.x + pan.x, y: viewCenter.y + pan.y };
    pan = {
      x: pivot.x - (pivot.x - center.x) * factor - viewCenter.x,
      y: pivot.y - (pivot.y - center.y) * factor - viewCenter.y,
    };
    zoom = clamped;
  }

  function currentCenter(): Point {
    return { x: viewCenter.x + pan.x, y: viewCenter.y + pan.y };
  }

  function zoomIn(): void {
    setZoom(zoom * ZOOM.step, currentCenter());
  }

  function zoomOut(): void {
    setZoom(zoom / ZOOM.step, currentCenter());
  }

  function resetView(): void {
    zoom = 1;
    pan = { x: 0, y: 0 };
  }

  /**
   * Turn a wheel/trackpad tick into a zoom multiplier. `deltaMode` says what
   * unit `deltaY` is in — almost always pixels, but some mice report lines
   * and paging devices report pages — so each gets its own `WHEEL_ZOOM`
   * scale before the exponent turns it into a smooth multiplicative step.
   */
  function wheelZoomFactor(event: WheelEvent): number {
    const scale =
      event.deltaMode === 1
        ? WHEEL_ZOOM.line
        : event.deltaMode === 2
          ? WHEEL_ZOOM.page
          : WHEEL_ZOOM.pixel;
    return Math.pow(2, -event.deltaY * scale);
  }

  /**
   * Both plain wheel rotation and trackpad two-finger scroll zoom — per
   * PLAN.md's "mouse wheel and trackpad scroll to zoom" — and a trackpad
   * pinch arrives as a ctrl-key wheel event, so it falls through the same
   * path. `preventDefault` is required in both cases or the browser scrolls
   * the page (plain wheel) or zooms it (ctrl+wheel) instead.
   */
  function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY === 0) return;
    const pivot = toDiagramSpace(event);
    if (!pivot) return;
    setZoom(zoom * wheelZoomFactor(event), pivot);
  }

  const ORIGIN: Point = { x: 0, y: 0 };

  /**
   * Client pixels to diagram space, for anything that resolves a pointer or
   * wheel position against the live viewBox. `WheelEvent` and `PointerEvent`
   * both carry `clientX`/`clientY`, so either can be passed here.
   */
  function toDiagramSpace(event: {
    clientX: number;
    clientY: number;
  }): Point | null {
    const screenToLocal = element?.getScreenCTM()?.inverse();
    if (!screenToLocal) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      screenToLocal,
    );
    return { x: point.x, y: point.y };
  }

  /**
   * How far the pointer must travel before a backdrop press stops being a
   * click-to-clear-selection and starts being a pan. Mirrors `PartNode`'s own
   * `DRAG_THRESHOLD_PX`: small enough that a deliberate drag registers, large
   * enough to absorb the few pixels a hand moves during an ordinary click.
   */
  const PAN_THRESHOLD_PX = 4;

  interface PanGesture {
    pointerId: number;
    originX: number;
    originY: number;
    /** Frozen at gesture start: converting both endpoints through the same
     * matrix gives an accurate diagram-space delta without feedback from the
     * viewBox this gesture is itself rewriting every move. */
    ctm: DOMMatrix;
    startPan: Point;
    dragging: boolean;
  }

  let panGesture: PanGesture | null = null;

  /**
   * A drag that passed the threshold has to swallow the `click` that follows
   * it, or releasing the pan would also clear the selection.
   */
  let suppressBackdropClick = false;

  function handleBackdropPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const ctm = element?.getScreenCTM();
    if (!ctm) return;
    (event.currentTarget as SVGRectElement).setPointerCapture(
      event.pointerId,
    );
    panGesture = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      ctm,
      startPan: { ...pan },
      dragging: false,
    };
  }

  function handleBackdropPointerMove(event: PointerEvent): void {
    if (!panGesture || event.pointerId !== panGesture.pointerId) return;

    if (!panGesture.dragging) {
      const travelled = Math.hypot(
        event.clientX - panGesture.originX,
        event.clientY - panGesture.originY,
      );
      if (travelled < PAN_THRESHOLD_PX) return;
      panGesture.dragging = true;
    }

    const inverse = panGesture.ctm.inverse();
    const start = new DOMPoint(
      panGesture.originX,
      panGesture.originY,
    ).matrixTransform(inverse);
    const current = new DOMPoint(
      event.clientX,
      event.clientY,
    ).matrixTransform(inverse);
    pan = {
      x: panGesture.startPan.x - (current.x - start.x),
      y: panGesture.startPan.y - (current.y - start.y),
    };
  }

  function handleBackdropPointerUp(event: PointerEvent): void {
    if (!panGesture || event.pointerId !== panGesture.pointerId) return;
    (event.currentTarget as SVGRectElement).releasePointerCapture(
      event.pointerId,
    );
    suppressBackdropClick = panGesture.dragging;
    panGesture = null;
  }

  /**
   * Kept as a `click` handler rather than folded into `pointerup`, matching
   * `PartNode`: assistive technology activates a control by dispatching
   * `click` with no pointer events at all.
   */
  function handleBackdropClick(): void {
    if (suppressBackdropClick) {
      suppressBackdropClick = false;
      return;
    }
    onclear();
  }

  interface ResolvedEndpoint {
    id: EndpointId;
    point: Point;
    radius: number;
    role: Part["role"] | typeof SELF_ID;
    /** Self has no `active` field and always counts as active for filtering. */
    active: boolean;
  }

  function resolve(id: EndpointId): ResolvedEndpoint | null {
    if (id === SELF_ID) {
      return { id, point: ORIGIN, radius: SELF.radius, role: SELF_ID, active: true };
    }
    const part = partsById.get(id);
    const point = positions.get(id);
    if (!part || !point) return null;
    return { id, point, radius: NODE.radius, role: part.role, active: part.active };
  }

  function startConnection(sourceId: EndpointId): void {
    const from = resolve(sourceId);
    if (from) drawing = { sourceId, point: from.point };
  }

  /**
   * The endpoint the in-flight connector would land on: the first whose circle
   * contains the pointer. Hit-testing by distance rather than by DOM target,
   * because the connector's own live line sits under the cursor and would
   * otherwise be what the pointer reports hitting.
   */
  /**
   * The directed edges that already exist. A node is offered as a drop target
   * unless the edge being drawn would repeat one of these — so a pair that is
   * already connected one way is still a valid target for the other way, which
   * is the whole point of keying this by direction. A node that would repeat an
   * edge gets no highlight ring, and releasing over it cancels like empty
   * canvas; refusing the drop silently after the fact would look like the
   * gesture had simply failed.
   */
  const connectedEdges = $derived(
    new Set(
      connections.map((connection) =>
        connectionEdgeKey(connection.sourceId, connection.targetId),
      ),
    ),
  );

  /**
   * Connections whose pair also holds the reverse edge. They need to be drawn
   * apart from each other, and only this component can see both at once.
   */
  const reciprocalIds = $derived(
    new Set(
      connections
        .filter((connection) =>
          connectedEdges.has(
            connectionEdgeKey(connection.targetId, connection.sourceId),
          ),
        )
        .map((connection) => connection.id),
    ),
  );

  const dropTargetId = $derived.by((): EndpointId | null => {
    if (!drawing) return null;
    const { point, sourceId } = drawing;

    const available = (candidate: EndpointId): boolean =>
      candidate !== sourceId &&
      !connectedEdges.has(connectionEdgeKey(sourceId, candidate));

    if (available(SELF_ID) && Math.hypot(point.x, point.y) <= SELF.radius) {
      return SELF_ID;
    }

    for (const part of parts) {
      if (!available(part.id)) continue;
      const at = positions.get(part.id);
      if (!at) continue;
      if (Math.hypot(point.x - at.x, point.y - at.y) <= NODE.radius) {
        return part.id;
      }
    }
    return null;
  });

  /**
   * Listeners go on the window, not the svg, so releasing outside the diagram
   * still ends the gesture instead of leaving a connector stuck to the cursor.
   */
  $effect(() => {
    if (!drawing) return;

    // Mutates `point` rather than replacing `drawing`. Replacing it would
    // change the value this effect read to decide a drag was in progress, so
    // the effect would re-run and tear down and re-register these three
    // listeners on every pointermove — hundreds of times across one drag, for
    // no behavioural difference.
    const move = (event: PointerEvent): void => {
      const point = toDiagramSpace(event);
      if (point && drawing) drawing.point = point;
    };

    const up = (): void => {
      const target = dropTargetId;
      const source = drawing?.sourceId;
      drawing = null;
      // Releasing over empty canvas cancels, which is why this is the only
      // place a connection is created.
      if (source !== undefined && target !== null && target !== source) {
        onconnectcreate(source, target);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  });

  /** The live connector, drawn from the source's edge to the cursor. */
  const drawingPath = $derived.by(() => {
    if (!drawing) return null;
    const from = resolve(drawing.sourceId);
    if (!from) return null;
    const dx = drawing.point.x - from.point.x;
    const dy = drawing.point.y - from.point.y;
    const length = Math.hypot(dx, dy);
    if (length <= from.radius) return null;
    return {
      x1: from.point.x + (dx / length) * from.radius,
      y1: from.point.y + (dy / length) * from.radius,
      x2: drawing.point.x,
      y2: drawing.point.y,
    };
  });

  /**
   * Whether an endpoint survives the current filters.
   *
   * Self always does, for both filters. It carries no `PartRole` and no
   * `active` field — but it is the fixed centre every connector runs to, and
   * fading it would leave the map a ring around nothing. A part with role
   * "unknown" matches no sector, so it fades under a role filter, which is
   * correct: it is not yet a manager, firefighter or exile. The two filters
   * are independent — "active" managers and "all" managers are both valid
   * combinations — so both have to pass.
   */
  function survives(
    role: Part["role"] | typeof SELF_ID,
    active: boolean,
  ): boolean {
    const survivesRole =
      activeFilter === null || role === SELF_ID || role === activeFilter;
    const survivesActive = !activeOnlyFilter || role === SELF_ID || active;
    return survivesRole && survivesActive;
  }

  /**
   * The fade is applied to a wrapping `<g>` rather than folded into the
   * node's or connector's own opacity, and that separation is the point.
   * A connector's opacity already means something specific — dimmed says an
   * endpoint's role is still "unknown" (`connectionOpacity`) — so writing the
   * filter into that number would make one channel carry two meanings. Group
   * opacity composites over the top instead: the connector still states
   * exactly what it stated, and the whole group is pushed back behind the
   * filtered-in ones.
   */
  function fade(visible: boolean): number {
    return visible ? 1 : FILTER_FADE;
  }

  /** Drop any connector whose endpoints don't resolve rather than throwing. */
  const drawableConnections = $derived(
    connections
      .map((connection) => {
        const source = resolve(connection.sourceId);
        const target = resolve(connection.targetId);
        return source && target ? { connection, source, target } : null;
      })
      .filter((entry) => entry !== null),
  );
</script>

<div class="diagram-wrap">
<svg
  bind:this={element}
  class="diagram"
  class:drawing={drawing !== null}
  viewBox="{scaledViewBox.x} {scaledViewBox.y} {scaledViewBox.width} {scaledViewBox.height}"
  data-fit-viewbox="{viewBox.x} {viewBox.y} {viewBox.width} {viewBox.height}"
  preserveAspectRatio="xMidYMid meet"
  onwheel={handleWheel}
  role="img"
  aria-label="Radial map of parts around Self"
>
  <defs>
    <radialGradient
      id="bgGrad"
      gradientUnits="userSpaceOnUse"
      cx={BACKGROUND_GRADIENT.cx}
      cy={BACKGROUND_GRADIENT.cy}
      r={BACKGROUND_GRADIENT.r}
    >
      {#each BACKGROUND_GRADIENT.stops as stop (stop.offset)}
        <stop offset={stop.offset} stop-color={stop.color} />
      {/each}
    </radialGradient>

    <radialGradient id="selfGlow" cx="50%" cy="50%" r="50%">
      {#each SELF.glowStops as stop (stop.offset)}
        <stop
          offset={stop.offset}
          stop-color={stop.color}
          stop-opacity={stop.opacity}
        />
      {/each}
    </radialGradient>

    <!--
      One arrowhead per connector colour. A `<marker>` can't portably inherit
      the stroke of the line that placed it, so the colour is baked in and
      Connection.svelte names the marker matching its own. `markerUnits`
      defaults to "strokeWidth", so each head scales with the line it caps, and
      `refX` at the tip puts the point on the node's edge where the path ends.
      Only reciprocal connectors reference these — see Connection.svelte.
    -->
    {#each Object.entries(CONNECTOR_COLORS) as [key, color] (key)}
      <marker
        id="arrow-{key}"
        viewBox="0 0 8 8"
        refX="8"
        refY="4"
        markerWidth={CONNECTION.arrowSize}
        markerHeight={CONNECTION.arrowSize}
        orient="auto"
      >
        <path d="M0,0 L8,4 L0,8 Z" fill={color} />
      </marker>
    {/each}

    <filter
      id="glow"
      x={GLOW_FILTER.region.x}
      y={GLOW_FILTER.region.y}
      width={GLOW_FILTER.region.width}
      height={GLOW_FILTER.region.height}
    >
      <feGaussianBlur stdDeviation={GLOW_FILTER.stdDeviation} result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter
      id="softBlur"
      x={SOFT_BLUR_FILTER.region.x}
      y={SOFT_BLUR_FILTER.region.y}
      width={SOFT_BLUR_FILTER.region.width}
      height={SOFT_BLUR_FILTER.region.height}
    >
      <feGaussianBlur stdDeviation={SOFT_BLUR_FILTER.stdDeviation} />
    </filter>
  </defs>

  <!--
    Clicking the backdrop clears the selection; dragging it pans the canvas.
    The click is a pointer convenience with two keyboard equivalents already
    in place — the panel's close button and Escape — so the element
    deliberately stays out of the tab order rather than becoming a focusable
    control that reads as "background".
  -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <rect
    class="backdrop"
    x={BACKDROP.x}
    y={BACKDROP.y}
    width={BACKDROP.size}
    height={BACKDROP.size}
    fill="url(#bgGrad)"
    onpointerdown={handleBackdropPointerDown}
    onpointermove={handleBackdropPointerMove}
    onpointerup={handleBackdropPointerUp}
    onclick={handleBackdropClick}
  />

  <!-- nebula washes marking the three sectors. Decorative, so pointer-events
       is off — left on, their filled ellipses would sit over the backdrop
       and swallow the click-to-clear and drag-to-pan gestures meant for it. -->
  {#each SECTOR_ROLES as role (role)}
    <ellipse
      cx={WASH_GEOMETRY[role].cx}
      cy={WASH_GEOMETRY[role].cy}
      rx={WASH_GEOMETRY[role].rx}
      ry={WASH_GEOMETRY[role].ry}
      fill={ROLES[role].wash.color}
      opacity={ROLES[role].wash.opacity}
      filter="url(#softBlur)"
      pointer-events="none"
    />
  {/each}

  <g fill={STAR_COLOR} pointer-events="none">
    {#each STARS as star, index (index)}
      <circle cx={star.x} cy={star.y} r={star.r} opacity={star.opacity} />
    {/each}
  </g>

  {#each SECTOR_ROLES as role (role)}
    <text
      class="sector-label"
      x={SECTOR_LABEL_POSITIONS[role].x}
      y={SECTOR_LABEL_POSITIONS[role].y}
      fill={ROLES[role].sectorLabel}
      font-size={TYPE_SCALE.sectorLabel.size}
      letter-spacing={TYPE_SCALE.sectorLabel.letterSpacing}
      font-weight={TYPE_SCALE.sectorLabel.weight}
      opacity={TYPE_SCALE.sectorLabel.opacity}
      text-anchor={SECTOR_LABEL_POSITIONS[role].anchor}
      >{role.toUpperCase()}S</text
    >
  {/each}

  <!-- connectors first, so nodes sit above them -->
  {#each drawableConnections as entry (entry.connection.id)}
    <!-- A connector fades unless both of its endpoints survive the filter:
         a full-strength line running to a faded node would read as a
         relationship to something that isn't there. -->
    <g
      class="filterable"
      opacity={fade(
        survives(entry.source.role, entry.source.active) &&
          survives(entry.target.role, entry.target.active),
      )}
    >
      <ConnectionPath
        connection={entry.connection}
        source={entry.source}
        target={entry.target}
        selected={entry.connection.id === selectedConnectionId}
        reciprocal={reciprocalIds.has(entry.connection.id)}
        onselect={onconnectselect}
        onlabelchange={onconnectlabel}
        ondelete={onconnectdelete}
        onclose={onconnectclose}
      />
    </g>
  {/each}

  <SelfNode
    dropTarget={dropTargetId === SELF_ID}
    drawing={drawing !== null}
    onconnectstart={() => startConnection(SELF_ID)}
    {onclear}
  />

  {#if drawingPath}
    <line
      class="drawing-line"
      x1={drawingPath.x1}
      y1={drawingPath.y1}
      x2={drawingPath.x2}
      y2={drawingPath.y2}
      stroke={CONNECTION.selfColor}
      stroke-width={CONNECTION.solidWidth}
      stroke-dasharray="4 4"
      stroke-linecap="round"
      opacity="0.8"
    />
  {/if}

  {#each parts as part (part.id)}
    {@const position = positions.get(part.id)}
    {#if position}
      <g class="filterable" opacity={fade(survives(part.role, part.active))}>
        <PartNode
          {part}
          {position}
          selected={part.id === selectedPartId}
          dropTarget={dropTargetId === part.id}
          drawing={drawing !== null}
          onconnectstart={startConnection}
          {onselect}
          {onmove}
          {ontoggleactive}
        />
      </g>
    {/if}
  {/each}
</svg>

  <div class="zoom-controls" role="group" aria-label="Zoom">
    <button
      type="button"
      class="zoom-button"
      onclick={zoomOut}
      disabled={zoom <= ZOOM.min}
      aria-label="Zoom out"
    >
      −
    </button>
    <button
      type="button"
      class="zoom-button reset"
      onclick={resetView}
      disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
      aria-label="Reset zoom and pan"
    >
      Reset
    </button>
    <button
      type="button"
      class="zoom-button"
      onclick={zoomIn}
      disabled={zoom >= ZOOM.max}
      aria-label="Zoom in"
    >
      +
    </button>
  </div>
</div>

<style>
  .diagram-wrap {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
  }

  .diagram {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Keeps the crosshair while drawing even as the pointer crosses nodes that
     would otherwise show their own grab cursor. */
  .diagram.drawing {
    cursor: crosshair;
  }

  .drawing-line {
    pointer-events: none;
  }

  .backdrop {
    touch-action: none;
  }

  /* Grab affordance for panning, matching the grab/grabbing pair PartNode
     uses for dragging a part. Scoped to "not drawing" so a connector in
     progress keeps the crosshair over empty canvas — an explicit cursor
     here would otherwise win over the inherited one from .diagram.drawing
     below, since inheritance only applies where nothing is set directly. */
  .diagram:not(.drawing) .backdrop {
    cursor: grab;
  }

  .diagram:not(.drawing) .backdrop:active {
    cursor: grabbing;
  }

  /* Floated over the canvas's bottom-right corner rather than living in the
     toolbar: zoom is a way of looking at the map, so it reads as part of the
     diagram itself rather than a top-level action alongside "Add a part".
     No background or border of its own — each button already carries its
     own, so the group reads as three quiet marks on the canvas rather than
     a panel sitting on top of it. */
  .zoom-controls {
    position: absolute;
    right: 1rem;
    bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.3125rem;
  }

  .zoom-button {
    height: 32px;
    min-width: 32px;
    padding: 0 0.75rem;
    border: 1.3px solid var(--button-border);
    border-radius: 16px;
    background: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    transition:
      color 160ms ease,
      border-color 160ms ease;
  }

  .zoom-button.reset {
    min-width: unset;
  }

  .zoom-button:hover:not(:disabled) {
    color: var(--text-primary);
    border-color: var(--text-muted);
  }

  .zoom-button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .zoom-button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* The filter fades rather than cuts, so switching pills reads as the same
     map being re-weighted instead of a different map being drawn. */
  .filterable {
    transition: opacity 200ms ease;
  }

  /* Decorative, like the washes and stars above: left hit-testable, it would
     shadow the backdrop's click-to-clear and drag-to-pan wherever a caption
     sits. */
  .sector-label {
    user-select: none;
    pointer-events: none;
  }
</style>
