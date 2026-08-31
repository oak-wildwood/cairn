<script lang="ts">
  import { FONTS, SELF } from "../theme";

  /**
   * The fixed centre of the map. Self is not a part — it has no role, no
   * detail panel and no drag-to-reposition, so this component stays a pure
   * render. It sits at the origin of diagram space by definition.
   */
</script>

<g class="self-node" aria-label="Self">
  <circle r={SELF.radius * SELF.glowRadiusRatio} fill="url(#selfGlow)" />
  <circle
    r={SELF.radius}
    fill={SELF.fill}
    stroke={SELF.stroke}
    stroke-width={SELF.strokeWidth}
    filter="url(#glow)"
  />
  <text
    y={SELF.labelSize * 0.36}
    fill={SELF.labelColor}
    font-size={SELF.labelSize}
    font-family={FONTS.display}
    font-style="italic"
    text-anchor="middle">Self</text
  >
</g>

<style>
  .self-node {
    pointer-events: none;
  }
</style>
