<script lang="ts">
  import { FONTS, HANDLE, SELF } from "../theme";
  import type { Point } from "../types";

  /**
   * The fixed centre of the map. Self is not a part — it has no role, no
   * detail panel and no drag-to-reposition — but it is a valid connection
   * endpoint, so it carries the same hover handles a part does.
   *
   * It sits at the origin of diagram space by definition.
   */

  interface Props {
    /** True while a connection is being drawn and could land on Self. */
    dropTarget: boolean;
    /** True while any connection is being drawn, from any node. */
    drawing: boolean;
    onconnectstart: () => void;
    /**
     * Self used to be `pointer-events: none`, so a click on it fell through to
     * the backdrop and cleared the selection. Now that it has handles it has
     * to receive pointer events, so it forwards that same clear itself rather
     * than silently becoming a dead spot on the canvas.
     */
    onclear: () => void;
  }

  const { dropTarget, drawing, onconnectstart, onclear }: Props = $props();

  let hovered = $state(false);
  const showHandles = $derived(hovered && !drawing);

  const HANDLE_POSITIONS: readonly Point[] = [
    { x: 0, y: -SELF.radius },
    { x: SELF.radius, y: 0 },
    { x: 0, y: SELF.radius },
    { x: -SELF.radius, y: 0 },
  ];

  function handleConnectStart(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    onconnectstart();
  }
</script>

<!--
  The hover handlers only reveal the connection handles, which are themselves
  pointer-only. `img` keeps Self announced as the labelled graphic it is
  rather than promoting it to a control that can't be activated.
-->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<g
  class="self-node"
  role="img"
  aria-label="Self"
  onpointerenter={() => (hovered = true)}
  onpointerleave={() => (hovered = false)}
>
  <!--
    Pointer-events off: this circle is well past Self's actual body, purely
    a glow. Left hit-testable, it would swallow the backdrop's click-to-clear
    and drag-to-pan for a wide ring around the centre of the canvas.
  -->
  <circle
    r={SELF.radius * SELF.glowRadiusRatio}
    fill="url(#selfGlow)"
    pointer-events="none"
  />

  {#if dropTarget}
    <circle
      r={SELF.radius + HANDLE.dropTargetRadius}
      fill="none"
      stroke={SELF.stroke}
      stroke-width={HANDLE.dropTargetWidth}
      opacity="0.9"
    />
  {/if}

  <!--
    Carries the click that used to land on the backdrop behind Self. It is not
    a control — Self has no detail panel and nothing to activate — so it takes
    no role and no place in the tab order.
  -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <circle
    class="body"
    r={SELF.radius}
    fill={SELF.fill}
    stroke={SELF.stroke}
    stroke-width={SELF.strokeWidth}
    filter="url(#glow)"
    onclick={onclear}
  />

  <text
    y={SELF.labelSize * 0.36}
    fill={SELF.labelColor}
    font-size={SELF.labelSize}
    font-family={FONTS.display}
    font-style="italic"
    text-anchor="middle">Self</text
  >

  <g class="handles" class:visible={showHandles} aria-hidden="true">
    {#each HANDLE_POSITIONS as handle, index (index)}
      <!-- Pointer-only, for the reasons set out in PartNode. -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <circle
        class="handle"
        cx={handle.x}
        cy={handle.y}
        r={HANDLE.radius}
        fill={SELF.stroke}
        stroke={SELF.fill}
        stroke-width="1.5"
        onpointerdown={handleConnectStart}
      />
    {/each}
  </g>
</g>

<style>
  .self-node text {
    pointer-events: none;
  }

  .handles {
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms ease;
  }

  .handles.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .handle {
    cursor: crosshair;
  }
</style>
