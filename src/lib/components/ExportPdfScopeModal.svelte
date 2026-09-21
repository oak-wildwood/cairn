<script lang="ts">
  /**
   * Asks which parts a PDF export should walk, only shown when the legend
   * has a filter on — with nothing filtered there is nothing to decide, and
   * `App.svelte` skips straight to exporting every part instead of showing a
   * choice between two identical outcomes.
   *
   * Defaults to the filtered set: someone who narrowed the legend before
   * reaching for Export PDF almost always wants a worksheet of *that* slice,
   * not a reminder to go turn the filter off first.
   */
  export type ExportPdfScope = "filtered" | "all";

  interface Props {
    onsubmit: (scope: ExportPdfScope) => void;
    oncancel: () => void;
  }

  const { onsubmit, oncancel }: Props = $props();

  let scope = $state<ExportPdfScope>("filtered");
  let dialog = $state<HTMLDialogElement | null>(null);

  /**
   * `showModal` rather than an `open` attribute, matching `StartFreshModal`:
   * it is what gives us the inert backdrop, the focus trap and
   * Escape-to-close for free instead of hand-rolling all three.
   */
  $effect(() => {
    dialog?.showModal();
  });

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    onsubmit(scope);
  }
</script>

<dialog bind:this={dialog} onclose={oncancel} aria-label="Export PDF">
  <form method="dialog" class="form" onsubmit={handleSubmit}>
    <h2 class="title">Export PDF</h2>

    <p class="body">
      The legend is filtering the map right now. Export every part, or just
      the ones your filters are showing?
    </p>

    <div class="options" role="radiogroup" aria-label="Which parts to export">
      <label class="option">
        <input
          type="radio"
          name="export-pdf-scope"
          value="filtered"
          bind:group={scope}
        />
        Only the parts shown
      </label>
      <label class="option">
        <input
          type="radio"
          name="export-pdf-scope"
          value="all"
          bind:group={scope}
        />
        Every part
      </label>
    </div>

    <div class="actions">
      <button class="button" type="button" onclick={oncancel}>Cancel</button>
      <button class="button primary" type="submit">Export</button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    width: min(26rem, calc(100vw - 2rem));
    padding: 0;
    border: 1px solid var(--pill-border);
    border-radius: 14px;
    /* The detail panel's surface, a step above the darkest background stop. */
    background: #12141f;
    color: var(--text-primary);
  }

  dialog::backdrop {
    background: rgb(6 7 12 / 66%);
  }

  .form {
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
  }

  .title {
    margin: 0 0 0.625rem;
    color: var(--text-bright);
    font-family: var(--font-display);
    font-size: 24px;
    font-style: italic;
    font-weight: 500;
  }

  .body {
    margin: 0 0 1.25rem;
    color: var(--text-muted);
    font-size: var(--body-text-size);
    line-height: var(--body-text-line-height);
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    color: var(--text-primary);
    font-size: 14px;
    cursor: pointer;
  }

  .option input {
    accent-color: var(--focus-ring);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.625rem;
    margin-top: 1.5rem;
  }

  .button {
    height: 36px;
    padding: 0 1.25rem;
    border: 1.3px solid var(--button-border);
    border-radius: 18px;
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

  .button:hover {
    color: var(--text-primary);
    border-color: var(--text-muted);
  }

  .button.primary {
    color: var(--text-bright);
  }

  .button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
