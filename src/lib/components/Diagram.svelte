<script lang="ts">
  import { computeLayout } from "../layout";
  import {
    BACKDROP,
    CONNECTION,
    BACKGROUND_GRADIENT,
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
    VIEWBOX,
    WASH_GEOMETRY,
  } from "../theme";
  import { SELF_ID } from "../types";
  import type { Connection, EndpointId, Part, Point } from "../types";
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
    onconnectcreate: (sourceId: EndpointId, targetId: EndpointId) => void;
    selectedConnectionId: string | null;
    onconnectselect: (id: string) => void;
    onconnectlabel: (id: string, label: string) => void;
    onconnectdelete: (id: string) => void;
    onconnectclose: () => void;
  }

  const {
    parts,
    connections,
    selectedPartId,
    onselect,
    onclear,
    onmove,
    onconnectcreate,
    selectedConnectionId,
    onconnectselect,
    onconnectlabel,
    onconnectdelete,
    onconnectclose,
  }: Props = $props();

  let svg = $state<SVGSVGElement | null>(null);

  /**
   * The in-flight connector. Local rather than in the store: it never
   * persists, never outlives the gesture, and nothing outside this subtree
   * reads it. Putting transient pointer state in the shared store would mean
   * the debounced save effect wakes on every pointermove.
   */
  let drawing = $state<{ sourceId: EndpointId; point: Point } | null>(null);

  const positions = $derived(computeLayout(parts));
  const partsById = $derived(new Map(parts.map((part) => [part.id, part])));

  const ORIGIN: Point = { x: 0, y: 0 };

  function toDiagramSpace(event: PointerEvent): Point | null {
    const screenToLocal = svg?.getScreenCTM()?.inverse();
    if (!screenToLocal) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      screenToLocal,
    );
    return { x: point.x, y: point.y };
  }

  interface ResolvedEndpoint {
    id: EndpointId;
    point: Point;
    radius: number;
    role: Part["role"] | typeof SELF_ID;
  }

  function resolve(id: EndpointId): ResolvedEndpoint | null {
    if (id === SELF_ID) {
      return { id, point: ORIGIN, radius: SELF.radius, role: SELF_ID };
    }
    const part = partsById.get(id);
    const point = positions.get(id);
    if (!part || !point) return null;
    return { id, point, radius: NODE.radius, role: part.role };
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
  const dropTargetId = $derived.by((): EndpointId | null => {
    if (!drawing) return null;
    const { point, sourceId } = drawing;

    if (
      sourceId !== SELF_ID &&
      Math.hypot(point.x, point.y) <= SELF.radius
    ) {
      return SELF_ID;
    }

    for (const part of parts) {
      if (part.id === sourceId) continue;
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

    const move = (event: PointerEvent): void => {
      const point = toDiagramSpace(event);
      if (point && drawing) drawing = { ...drawing, point };
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

<svg
  bind:this={svg}
  class="diagram"
  class:drawing={drawing !== null}
  viewBox="{VIEWBOX.x} {VIEWBOX.y} {VIEWBOX.width} {VIEWBOX.height}"
  preserveAspectRatio="xMidYMid meet"
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
    Clicking the backdrop clears the selection. This is a pointer convenience
    with two keyboard equivalents already in place — the panel's close button
    and Escape — so the element deliberately stays out of the tab order rather
    than becoming a focusable control that reads as "background".
  -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <rect
    x={BACKDROP.x}
    y={BACKDROP.y}
    width={BACKDROP.size}
    height={BACKDROP.size}
    fill="url(#bgGrad)"
    onclick={onclear}
  />

  <!-- nebula washes marking the three sectors -->
  {#each SECTOR_ROLES as role (role)}
    <ellipse
      cx={WASH_GEOMETRY[role].cx}
      cy={WASH_GEOMETRY[role].cy}
      rx={WASH_GEOMETRY[role].rx}
      ry={WASH_GEOMETRY[role].ry}
      fill={ROLES[role].wash.color}
      opacity={ROLES[role].wash.opacity}
      filter="url(#softBlur)"
    />
  {/each}

  <g fill={STAR_COLOR}>
    {#each STARS as star, index (index)}
      <circle cx={star.x} cy={star.y} r={star.r} opacity={star.opacity} />
    {/each}
  </g>

  {#each SECTOR_ROLES as role (role)}
    <text
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
    <ConnectionPath
      connection={entry.connection}
      source={entry.source}
      target={entry.target}
      selected={entry.connection.id === selectedConnectionId}
      onselect={onconnectselect}
      onlabelchange={onconnectlabel}
      ondelete={onconnectdelete}
      onclose={onconnectclose}
    />
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
      <PartNode
        {part}
        {position}
        selected={part.id === selectedPartId}
        dropTarget={dropTargetId === part.id}
        drawing={drawing !== null}
        onconnectstart={startConnection}
        {onselect}
        {onmove}
      />
    {/if}
  {/each}
</svg>

<style>
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
</style>
