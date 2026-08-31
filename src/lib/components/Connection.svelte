<script lang="ts">
  import { curveNatural, line } from "d3-shape";
  import { connectionOpacity, connectionStyle } from "../layout";
  import { CONNECTION, ROLES } from "../theme";
  import { SELF_ID } from "../types";
  import type { Connection, EndpointId, EndpointRole, Point } from "../types";

  interface Endpoint {
    id: EndpointId;
    point: Point;
    /** Node radius, so the line stops at the circle's edge rather than centre. */
    radius: number;
    role: EndpointRole;
  }

  interface Props {
    connection: Connection;
    source: Endpoint;
    target: Endpoint;
  }

  const { connection, source, target }: Props = $props();

  const style = $derived(connectionStyle(source.id, target.id));
  const fromSelf = $derived(source.id === SELF_ID);

  /** A connector takes its color from its source; Self's is gold. */
  const stroke = $derived(
    fromSelf || source.role === SELF_ID
      ? CONNECTION.selfColor
      : ROLES[source.role].accent,
  );

  const strokeWidth = $derived(
    style === "dashed"
      ? CONNECTION.dashedWidth
      : fromSelf
        ? CONNECTION.selfWidth
        : CONNECTION.solidWidth,
  );

  const baseOpacity = $derived(
    style === "dashed"
      ? CONNECTION.dashedOpacity
      : fromSelf
        ? CONNECTION.selfOpacity
        : CONNECTION.solidOpacity,
  );

  const opacity = $derived(
    connectionOpacity(source.role, target.role, baseOpacity),
  );

  const toPath = line<Point>()
    .x((p) => p.x)
    .y((p) => p.y)
    .curve(curveNatural);

  /**
   * Trim the chord by each node's radius so the line meets the circles' edges,
   * then bow it off that chord. The bow always pushes away from Self, so
   * connectors arc around the centre instead of cutting across it.
   */
  const d = $derived.by(() => {
    const dx = target.point.x - source.point.x;
    const dy = target.point.y - source.point.y;
    const length = Math.hypot(dx, dy);

    // Overlapping nodes leave nothing to draw.
    if (length <= source.radius + target.radius) return null;

    const ux = dx / length;
    const uy = dy / length;

    const start: Point = {
      x: source.point.x + ux * source.radius,
      y: source.point.y + uy * source.radius,
    };
    const end: Point = {
      x: target.point.x - ux * target.radius,
      y: target.point.y - uy * target.radius,
    };

    const mid: Point = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const perp: Point = { x: uy, y: -ux };
    const away = mid.x * perp.x + mid.y * perp.y >= 0 ? 1 : -1;
    const offset = Math.hypot(end.x - start.x, end.y - start.y) *
      CONNECTION.bowRatio * away;

    const bow: Point = {
      x: mid.x + perp.x * offset,
      y: mid.y + perp.y * offset,
    };

    return toPath([start, bow, end]);
  });
</script>

{#if d}
  <path
    {d}
    fill="none"
    {stroke}
    stroke-width={strokeWidth}
    stroke-dasharray={style === "dashed" ? CONNECTION.dashArray : undefined}
    stroke-linecap="round"
    {opacity}
    filter="url(#glow)"
    aria-label={connection.label}
  />
{/if}
