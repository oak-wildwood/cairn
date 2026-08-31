<script lang="ts">
  import { curveNatural, line } from "d3-shape";
  import { connectionOpacity, connectionStyle } from "../layout";
  import { CONNECTION, CONNECTOR_COLORS } from "../theme";
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
    /** Selected means "its label editor is open" — the two are one state. */
    selected: boolean;
    /**
     * True when the same pair also holds the reverse edge. Decided by the
     * diagram, which is the only place that can see both connections.
     */
    reciprocal: boolean;
    onselect: (id: string) => void;
    onlabelchange: (id: string, label: string) => void;
    ondelete: (id: string) => void;
    onclose: () => void;
  }

  const {
    connection,
    source,
    target,
    selected,
    reciprocal,
    onselect,
    onlabelchange,
    ondelete,
    onclose,
  }: Props = $props();

  const style = $derived(connectionStyle(source.id, target.id));
  const fromSelf = $derived(source.id === SELF_ID);
  const touchesSelf = $derived(
    source.id === SELF_ID || target.id === SELF_ID,
  );

  /** A connector takes its color from its source; Self's is gold. */
  const colorKey = $derived(
    fromSelf || source.role === SELF_ID ? "self" : source.role,
  );
  const stroke = $derived(CONNECTOR_COLORS[colorKey]);

  /**
   * An arrowhead only where direction is otherwise unreadable. A lone
   * connector between two nodes needs none — there is nothing to confuse it
   * with, and the original design drew none — but the two arcs of a reciprocal pair look
   * identical apart from their labels, so each names which end it points at.
   */
  const markerEnd = $derived(
    reciprocal ? `url(#arrow-${colorKey})` : undefined,
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

  /** Sized for a short relationship word plus the delete affordance. */
  const LABEL_WIDTH = 132;
  const LABEL_HEIGHT = 24;

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

    // When an endpoint is Self, `mid` sits on the origin and is always
    // collinear with the chord, so the dot product below is exactly zero and
    // its sign is floating-point noise — flipping every pointer-move mid-drag
    // reads as the curve flickering between mirror images. Key off which
    // field holds Self instead; that's fixed for the connection's lifetime.
    const away = touchesSelf
      ? source.id === SELF_ID ? 1 : -1
      : mid.x * perp.x + mid.y * perp.y >= 0 ? 1 : -1;
    // A reciprocal pair would otherwise draw one arc twice. `perp` flips with
    // direction and so does `away`, so the two flips cancel and both bows land
    // on exactly the same point — which is what made a second connection
    // useless before. A term that does *not* carry `away` breaks the symmetry,
    // because `perp` alone still flips it: the two arcs then split evenly
    // either side of the single bow they used to share, and the shared one
    // stays where it was for every non-reciprocal connector.
    const chord = Math.hypot(end.x - start.x, end.y - start.y);
    const spread = reciprocal ? CONNECTION.reciprocalSpread : 0;
    const offset = chord * (CONNECTION.bowRatio * away + spread);

    const bow: Point = {
      x: mid.x + perp.x * offset,
      y: mid.y + perp.y * offset,
    };

    // The curve passes through `bow`, so it doubles as the label anchor —
    // no need to sample the path to find a point that sits on the line.
    return { path: toPath([start, bow, end]), anchor: bow };
  });

  let input = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (selected) input?.focus();
  });

  function commit(): void {
    if (input) onlabelchange(connection.id, input.value);
  }

  function handleKey(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      commit();
      onclose();
    }
    if (event.key === "Escape") {
      // Escape abandons the edit; the label reverts to whatever was stored.
      onclose();
    }
  }
</script>

{#if d}
  <path
    d={d.path}
    fill="none"
    {stroke}
    stroke-width={strokeWidth}
    stroke-dasharray={style === "dashed" ? CONNECTION.dashArray : undefined}
    stroke-linecap="round"
    marker-end={markerEnd}
    opacity={selected ? 1 : opacity}
    filter="url(#glow)"
    aria-label={connection.label}
  />

  <!--
    A 1.8px line is far too thin to hit reliably, so an invisible fat stroke
    carries the clicks. `pointer-events: stroke` keeps it to the line itself
    rather than the area the curve encloses.
  -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <path
    class="hit-area"
    d={d.path}
    fill="none"
    stroke="transparent"
    stroke-width="14"
    onclick={() => onselect(connection.id)}
  />

  {#if selected}
    <foreignObject
      x={d.anchor.x - LABEL_WIDTH / 2}
      y={d.anchor.y - LABEL_HEIGHT / 2}
      width={LABEL_WIDTH}
      height={LABEL_HEIGHT}
    >
      <div class="editor">
        <input
          bind:this={input}
          class="label-input"
          value={connection.label}
          placeholder="protects, triggers…"
          aria-label="Relationship label"
          onblur={commit}
          onkeydown={handleKey}
        />
        <!--
          Deletes on pointerdown, not click. On click the sequence is
          mousedown -> the input blurs -> `commit` writes the label -> Svelte
          re-renders -> mouseup lands on a replaced element, and no click ever
          completes, so the button silently does nothing. `preventDefault`
          stops the blur so the press is the whole interaction.
        -->
        <button
          class="delete"
          type="button"
          aria-label="Delete connection"
          onpointerdown={(event) => {
            event.preventDefault();
            ondelete(connection.id);
          }}
        >
          &times;
        </button>
      </div>
    </foreignObject>
  {:else if connection.label !== ""}
    <!--
      The same click the hit-area already carries, so the label doesn't become
      a dead patch sitting on top of a live line. Not a separate control, and
      not separately reachable — connections are pointer-edited, and the
      detail panel is where they can be read without one.
    -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <text
      class="label"
      x={d.anchor.x}
      y={d.anchor.y}
      fill={CONNECTION.labelColor}
      font-size={CONNECTION.labelSize}
      text-anchor="middle"
      dominant-baseline="middle"
      onclick={() => onselect(connection.id)}>{connection.label}</text
    >
  {/if}
{/if}

<style>
  .hit-area {
    cursor: pointer;
    pointer-events: stroke;
  }

  .label {
    cursor: pointer;
    /* Paints the connector out from behind the words without a background
       rect, which would have to be sized from the text at runtime. */
    paint-order: stroke;
    stroke: #12141f;
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .editor {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 100%;
  }

  .label-input {
    flex: 1 1 auto;
    min-width: 0;
    height: 22px;
    box-sizing: border-box;
    padding: 0 6px;
    border: 1px solid var(--focus-ring);
    border-radius: 6px;
    background: #12141f;
    color: var(--text-primary);
    font-family: var(--font-ui);
    font-size: 11px;
  }

  .label-input:focus {
    outline: none;
  }

  .delete {
    flex-shrink: 0;
    width: 20px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--pill-border);
    border-radius: 6px;
    background: #12141f;
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
  }

  .delete:hover {
    color: #e38f6b;
    border-color: #c1876e;
  }
</style>
