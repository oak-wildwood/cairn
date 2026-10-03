<script lang="ts">
  import { curveNatural, line } from "d3-shape";
  import {
    connectionOpacity,
    connectionStyle,
    connectorCurve,
    connectorMarkerEnd,
  } from "../layout";
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
    /** False on a phone: a selected connection shows its label as text, with no
     * input to edit it and no delete button. */
    editable?: boolean;
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
    editable = true,
    onselect,
    onlabelchange,
    ondelete,
    onclose,
  }: Props = $props();

  const style = $derived(connectionStyle(source.id, target.id));
  const fromSelf = $derived(source.id === SELF_ID);

  /** A connector takes its color from its source; Self's is gold. */
  const colorKey = $derived(
    fromSelf || source.role === SELF_ID ? "self" : source.role,
  );
  const stroke = $derived(CONNECTOR_COLORS[colorKey]);

  /** Only on a reciprocal pair — see `connectorMarkerEnd`. */
  const markerEnd = $derived(connectorMarkerEnd(reciprocal, colorKey));

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

  /** The curve passes through `bow`, so it doubles as the label anchor. */
  const d = $derived.by(() => {
    const curve = connectorCurve(source, target, reciprocal);
    if (!curve) return null;
    return {
      path: toPath([curve.start, curve.bow, curve.end]),
      anchor: curve.bow,
    };
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

  {#if selected && editable}
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
    /* A drag that starts on the label text should open the editor, not
       select the words underneath it. */
    user-select: none;
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
