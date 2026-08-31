<script lang="ts">
  import { wrapLabel } from "../layout";
  import { isLowDefinition, NODE, ROLES } from "../theme";
  import type { Part, Point } from "../types";

  interface Props {
    part: Part;
    position: Point;
  }

  const { part, position }: Props = $props();

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

<g transform="translate({position.x}, {position.y})">
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
