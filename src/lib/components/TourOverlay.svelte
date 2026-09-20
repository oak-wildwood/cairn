<script lang="ts">
  import { TOUR_STEPS } from "../tour";
  import type { TourPlacement } from "../tour";
  import { TOUR } from "../theme";

  interface Props {
    stepIndex: number;
    onNext: () => void;
    onBack: () => void;
    onClose: () => void;
  }

  const { stepIndex, onNext, onBack, onClose }: Props = $props();

  const step = $derived(TOUR_STEPS[stepIndex]);
  const isFirst = $derived(stepIndex === 0);
  const isLast = $derived(stepIndex === TOUR_STEPS.length - 1);

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /**
   * The spotlighted element's rect, re-measured every animation frame rather
   * than on `resize`/`scroll` alone. The panel this often points at
   * (`PartDetailPanel`) animates its own width open on a CSS transition when
   * a `requiresPart` step selects a part, so the target is still moving for
   * a couple hundred ms after the step becomes active — polling is simpler
   * than wiring a listener for every way this app's own layout can shift.
   */
  let rect = $state<DOMRect | null>(null);
  let tooltipEl = $state<HTMLElement | null>(null);
  let tooltipSize = $state({ width: 320, height: 140 });
  let viewport = $state({ width: window.innerWidth, height: window.innerHeight });

  function rectsEqual(a: DOMRect | null, b: DOMRect | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return (
      a.top === b.top &&
      a.left === b.left &&
      a.width === b.width &&
      a.height === b.height
    );
  }

  $effect(() => {
    let frame = requestAnimationFrame(function measure() {
      const selector = step.target;
      const el = selector
        ? document.querySelector<HTMLElement>(`[data-tour="${selector}"]`)
        : null;
      const nextRect = el ? el.getBoundingClientRect() : null;
      if (!rectsEqual(rect, nextRect)) rect = nextRect;

      if (tooltipEl) {
        const size = tooltipEl.getBoundingClientRect();
        if (size.width !== tooltipSize.width || size.height !== tooltipSize.height) {
          tooltipSize = { width: size.width, height: size.height };
        }
      }

      frame = requestAnimationFrame(measure);
    });
    return () => cancelAnimationFrame(frame);
  });

  $effect(() => {
    const onResize = (): void => {
      viewport = { width: window.innerWidth, height: window.innerHeight };
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  // Every step lands keyboard focus on the tooltip itself, since the rest of
  // the page goes `inert` while the tour is open (see App.svelte) and so
  // can't hold focus anyway.
  $effect(() => {
    void stepIndex;
    tooltipEl?.focus();
  });

  const GAP = 16;
  const MARGIN = 12;

  const layout = $derived.by(() => {
    const tw = tooltipSize.width || 320;
    const th = tooltipSize.height || 140;
    const vw = viewport.width;
    const vh = viewport.height;
    const targetRect = rect;

    if (!targetRect) {
      return {
        top: vh / 2 - th / 2,
        left: vw / 2 - tw / 2,
        arrow: null as TourPlacement | null,
      };
    }

    const place = (p: TourPlacement): { top: number; left: number } => {
      switch (p) {
        case "top":
          return {
            top: targetRect.top - th - GAP,
            left: targetRect.left + targetRect.width / 2 - tw / 2,
          };
        case "bottom":
          return {
            top: targetRect.bottom + GAP,
            left: targetRect.left + targetRect.width / 2 - tw / 2,
          };
        case "left":
          return {
            top: targetRect.top + targetRect.height / 2 - th / 2,
            left: targetRect.left - tw - GAP,
          };
        case "right":
          return {
            top: targetRect.top + targetRect.height / 2 - th / 2,
            left: targetRect.right + GAP,
          };
      }
    };

    let placement = step.placement;
    let pos = place(placement);

    // A single flip to the opposite side covers every target this tour
    // actually points at — none sit close enough to two viewport edges at
    // once to need a second fallback.
    if (placement === "top" && pos.top < MARGIN) {
      placement = "bottom";
      pos = place(placement);
    } else if (placement === "bottom" && pos.top + th > vh - MARGIN) {
      placement = "top";
      pos = place(placement);
    } else if (placement === "left" && pos.left < MARGIN) {
      placement = "right";
      pos = place(placement);
    } else if (placement === "right" && pos.left + tw > vw - MARGIN) {
      placement = "left";
      pos = place(placement);
    }

    return {
      top: Math.min(Math.max(pos.top, MARGIN), vh - th - MARGIN),
      left: Math.min(Math.max(pos.left, MARGIN), vw - tw - MARGIN),
      arrow: placement,
    };
  });

  const spotlightStyle = $derived.by(() => {
    if (!rect) return "";
    const pad = TOUR.spotlightPadding;
    return [
      `top: ${rect.top - pad}px`,
      `left: ${rect.left - pad}px`,
      `width: ${rect.width + pad * 2}px`,
      `height: ${rect.height + pad * 2}px`,
    ].join("; ");
  });
</script>

<!-- `display: contents` below, so this wrapper only exists to set the TOUR
     tokens as custom properties once and let them cascade — it must not
     become a positioning `contain`er, or every `position: fixed` child
     inside it would anchor to this box instead of the viewport. -->
<div
  class="tour-root"
  style:--tour-scrim={TOUR.scrimColor}
  style:--tour-spotlight-radius="{TOUR.spotlightRadius}px"
  style:--tour-ring={TOUR.spotlightRing}
  style:--tour-ring-width="{TOUR.spotlightRingWidth}px"
>
  {#if rect}
    <div class="tour-spotlight" style={spotlightStyle} aria-hidden="true"></div>
  {:else}
    <div class="tour-dim" aria-hidden="true"></div>
  {/if}

  <div
    bind:this={tooltipEl}
    class="tour-tooltip"
    class:no-transition={reduceMotion}
    style:top="{layout.top}px"
    style:left="{layout.left}px"
    role="dialog"
    aria-modal="true"
    aria-labelledby="tour-title"
    aria-describedby="tour-body"
    tabindex="-1"
  >
    {#if layout.arrow}
      <div class="tour-arrow arrow-{layout.arrow}" aria-hidden="true"></div>
    {/if}

    <button class="tour-close" type="button" aria-label="Close tour" onclick={onClose}>
      &times;
    </button>

    <p class="tour-eyebrow">Step {stepIndex + 1} of {TOUR_STEPS.length}</p>
    <h2 id="tour-title" class="tour-title">{step.title}</h2>
    <p id="tour-body" class="tour-body">{step.body}</p>

    <div class="tour-dots" aria-hidden="true">
      {#each TOUR_STEPS as dotStep, i (dotStep.id)}
        <span class="dot" class:active={i === stepIndex}></span>
      {/each}
    </div>

    <div class="tour-actions">
      <button type="button" class="tour-skip" onclick={onClose}>Skip</button>
      <div class="tour-actions-right">
        {#if !isFirst}
          <button type="button" class="tour-back" onclick={onBack}>Back</button>
        {/if}
        <button type="button" class="tour-next" onclick={onNext}>
          {isLast ? "Done" : "Next"}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .tour-root {
    display: contents;
  }
  /* DERIVED values (scrim color, spotlight ring/padding/radius) come from
     `theme.ts`'s TOUR tokens — see the comment there for why. Everything
     else here (borders, radii, text colors, focus rings) reuses the CSS
     custom properties App.svelte already declares for the rest of the
     app's chrome, the same way MapMenu.svelte and Legend.svelte do. */

  .tour-dim {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: var(--tour-scrim);
    pointer-events: none;
  }

  .tour-spotlight {
    position: fixed;
    z-index: 300;
    border-radius: var(--tour-spotlight-radius);
    box-shadow:
      0 0 0 9999px var(--tour-scrim),
      0 0 0 var(--tour-ring-width) var(--tour-ring);
    pointer-events: none;
    transition:
      top 200ms ease,
      left 200ms ease,
      width 200ms ease,
      height 200ms ease;
  }

  .tour-tooltip {
    position: fixed;
    z-index: 310;
    width: 320px;
    max-width: calc(100vw - 24px);
    box-sizing: border-box;
    padding: 1.25rem;
    border: 1px solid var(--pill-border);
    border-radius: 14px;
    background: var(--surface-raised);
    box-shadow: 0 12px 32px rgb(0 0 0 / 45%);
    color: var(--text-primary);
    transition:
      top 200ms ease,
      left 200ms ease;
  }

  .tour-tooltip.no-transition {
    transition: none;
  }

  .tour-tooltip:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .tour-arrow {
    position: absolute;
    width: 12px;
    height: 12px;
    background: var(--surface-raised);
    border: 1px solid var(--pill-border);
    transform: rotate(45deg);
  }

  .arrow-top {
    bottom: -7px;
    left: calc(50% - 6px);
    border-top: none;
    border-left: none;
  }

  .arrow-bottom {
    top: -7px;
    left: calc(50% - 6px);
    border-bottom: none;
    border-right: none;
  }

  .arrow-left {
    right: -7px;
    top: calc(50% - 6px);
    border-left: none;
    border-bottom: none;
  }

  .arrow-right {
    left: -7px;
    top: calc(50% - 6px);
    border-right: none;
    border-top: none;
  }

  .tour-close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: 1px solid var(--pill-border);
    border-radius: 50%;
    background: none;
    color: var(--text-muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }

  .tour-close:hover {
    color: var(--text-bright);
  }

  .tour-close:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .tour-eyebrow {
    margin: 0 1.75rem 0.375rem 0;
    color: var(--text-eyebrow);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  .tour-title {
    margin: 0 0 0.5rem;
    font-family: var(--font-display);
    font-size: 22px;
    font-style: italic;
    font-weight: 500;
  }

  .tour-body {
    margin: 0 0 1rem;
    color: var(--text-primary);
    font-size: 14px;
    line-height: 1.5;
  }

  .tour-dots {
    display: flex;
    gap: 6px;
    margin-bottom: 1rem;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--pill-border);
  }

  .dot.active {
    background: var(--tour-ring);
  }

  .tour-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .tour-actions-right {
    display: flex;
    gap: 0.5rem;
  }

  .tour-skip,
  .tour-back,
  .tour-next {
    height: 32px;
    padding: 0 1rem;
    border-radius: 16px;
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition:
      color 160ms ease,
      border-color 160ms ease;
  }

  .tour-skip {
    border: 1px solid transparent;
    background: none;
    color: var(--text-muted);
  }

  .tour-skip:hover {
    color: var(--text-bright);
  }

  .tour-back {
    border: 1.3px solid var(--button-border);
    background: none;
    color: var(--text-muted);
  }

  .tour-back:hover {
    color: var(--text-primary);
    border-color: var(--text-muted);
  }

  .tour-next {
    border: 1.3px solid var(--tour-ring);
    background: none;
    color: var(--tour-ring);
  }

  .tour-next:hover {
    background: rgb(232 201 140 / 12%);
  }

  .tour-skip:focus-visible,
  .tour-back:focus-visible,
  .tour-next:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
