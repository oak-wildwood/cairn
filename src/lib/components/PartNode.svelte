<script lang="ts">
  import { wrapLabel } from "../layout";
  import { isLowDefinition, NODE, ROLES } from "../theme";
  import type { Part, Point } from "../types";

  interface Props {
    part: Part;
    position: Point;
    selected: boolean;
    onselect: (id: string) => void;
  }

  const { part, position, selected, onselect }: Props = $props();

  /**
   * Enter and Space activate, matching a real button. Milestone 5 adds a drag
   * gesture on this same node, at which point the pointer path grows a
   * movement threshold — the keyboard path here stays as it is.
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
  onclick={() => onselect(part.id)}
  onkeydown={handleKey}
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
    cursor: pointer;
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
