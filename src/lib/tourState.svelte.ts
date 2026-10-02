import { store } from "./store.svelte";
import { markTourSeen, TOUR_STEPS } from "./tour";

/**
 * The guided tour's own state. `priorSelection` snapshots whatever was
 * selected (or nothing) before the tour started, so `trackSelection` can
 * drive `store.selectedPartId` for its own steps without losing whatever the
 * user had open when they launched it from the menu.
 *
 * Lives here rather than in `App.svelte` so the step-driving effect can be
 * tested without mounting the whole app.
 */
export class TourState {
  active = $state(false);
  stepIndex = $state(0);
  private priorSelection: string | null = null;

  start(): void {
    this.priorSelection = store.selectedPartId;
    this.stepIndex = 0;
    this.active = true;
  }

  end(): void {
    this.active = false;
    markTourSeen();
    this.restoreSelection();
  }

  next(): void {
    if (this.stepIndex >= TOUR_STEPS.length - 1) {
      this.end();
      return;
    }
    this.stepIndex += 1;
  }

  back(): void {
    if (this.stepIndex === 0) return;
    this.stepIndex -= 1;
  }

  private restoreSelection(): void {
    if (this.priorSelection !== null) store.select(this.priorSelection);
    else store.clearSelection();
  }

  /**
   * Several steps ("select-part" on, through "connection") point at the
   * detail panel, which only exists once a part is selected. Rather than
   * have every such step open and close it, one effect keeps
   * `store.selectedPartId` matching what the current step needs and puts it
   * back to `priorSelection` the moment it doesn't — the tour always opens
   * `store.parts[0]`, the same part `part-node` ("select-part") resolves to
   * via `document.querySelector`, so it's one consistent part throughout
   * rather than whichever one a real click happened to land on.
   *
   * Registers an `$effect`, so call it while a component is initialising
   * (or inside `$effect.root`).
   */
  trackSelection(): void {
    $effect(() => {
      if (!this.active) return;
      const step = TOUR_STEPS[this.stepIndex];
      if (!step) return;

      if (step.requiresPart) {
        const demoId = store.parts[0]?.id;
        if (demoId !== undefined && store.selectedPartId !== demoId) {
          store.select(demoId);
        }
      } else if (store.selectedPartId !== this.priorSelection) {
        this.restoreSelection();
      }
    });
  }
}
