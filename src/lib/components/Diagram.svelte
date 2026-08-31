<script lang="ts">
  import { computeLayout } from "../layout";
  import {
    BACKDROP,
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
  }

  const {
    parts,
    connections,
    selectedPartId,
    onselect,
    onclear,
    onmove,
  }: Props = $props();

  const positions = $derived(computeLayout(parts));
  const partsById = $derived(new Map(parts.map((part) => [part.id, part])));

  const ORIGIN: Point = { x: 0, y: 0 };

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
  class="diagram"
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
    />
  {/each}

  <SelfNode />

  {#each parts as part (part.id)}
    {@const position = positions.get(part.id)}
    {#if position}
      <PartNode
        {part}
        {position}
        selected={part.id === selectedPartId}
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
</style>
