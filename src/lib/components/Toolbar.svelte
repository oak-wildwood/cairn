<script lang="ts">
  import MapMenu from "./MapMenu.svelte";

  /**
   * "Export" is Milestone 9's PNG and is still unwired, so it says so and is
   * disabled rather than sitting there as a live control that does nothing —
   * a button that no-ops on click reads as a bug, not as work in progress.
   *
   * The map-file actions live behind `MapMenu` beside it rather than as
   * buttons of their own — they are infrequent, and three more pills crowded
   * out the primary action.
   */
  interface Props {
    onAddPart?: () => void;
    onExport?: () => void;
    onBackUp: () => void;
    onRestore: (file: File) => void;
    onStartFresh: () => void;
  }

  const {
    onAddPart,
    onExport,
    onBackUp,
    onRestore,
    onStartFresh,
  }: Props = $props();
</script>

<div class="toolbar">
  <div class="actions">
    <button type="button" class="button primary" onclick={onAddPart}>
      + Add a part
    </button>
    <button
      type="button"
      class="button"
      onclick={onExport}
      disabled
      title="PNG export isn't built yet"
    >
      Export <span class="tbd">TBD</span>
    </button>
    <MapMenu {onBackUp} {onRestore} {onStartFresh} />
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.625rem;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .button {
    height: 38px;
    padding: 0 1.375rem;
    border: 1.3px solid var(--button-border);
    border-radius: 19px;
    background: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition:
      color 160ms ease,
      border-color 160ms ease;
  }

  .button.primary {
    color: var(--text-bright);
  }

  .button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  /* Hover is an affordance, and there is nothing here to afford yet. */
  .button:disabled:hover {
    color: var(--text-muted);
    border-color: var(--button-border);
  }

  /* Set apart from the label so "Export TBD" doesn't read as the name of the
     thing. Small caps rather than a filled badge: the toolbar has one primary
     action and a pill here would out-shout it. */
  .tbd {
    margin-left: 0.375rem;
    padding: 0.0625rem 0.3125rem;
    border: 1px solid currentColor;
    border-radius: 3px;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    vertical-align: 1px;
  }

  .button:hover {
    color: var(--text-primary);
    border-color: var(--text-muted);
  }

  .button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
