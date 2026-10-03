<svelte:options namespace="svg" />

<script lang="ts">
  /**
   * The active-this-week badge: a filled circle with a check when active, an
   * empty ring when not. Drawn on the map's nodes and in the detail panel's
   * Active pill, so the two always read as the same mark.
   */
  import { ACTIVE_TOGGLE } from "../theme";

  interface Props {
    active: boolean;
    /** The part's role accent, for the ring and the fill. */
    accent: string;
    /** The node's own fill, which the check is cut out in. */
    nodeFill: string;
  }

  const { active, accent, nodeFill }: Props = $props();
</script>

<circle
  r={ACTIVE_TOGGLE.radius}
  fill={active ? accent : "none"}
  stroke={accent}
  stroke-width={ACTIVE_TOGGLE.strokeWidth}
/>
{#if active}
  <path
    d={ACTIVE_TOGGLE.checkPath}
    fill="none"
    stroke={nodeFill}
    stroke-width={ACTIVE_TOGGLE.checkStrokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
  />
{/if}
