<script lang="ts">
  /**
   * Milestone 1 is a static render, so these buttons are present and styled to
   * the comp but not yet wired. They gain behaviour in Milestones 4 and 9.
   */
  interface Props {
    onAddPart?: () => void;
    onExport?: () => void;
  }

  const { onAddPart, onExport }: Props = $props();
</script>

<div class="toolbar">
  <h2 class="heading">System Map</h2>
  <div class="actions">
    <button type="button" class="button primary" onclick={onAddPart}>
      + Add a part
    </button>
    <button type="button" class="button" onclick={onExport}>Export</button>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.625rem;
  }

  .heading {
    margin: 0;
    color: var(--text-bright);
    font-family: var(--font-display);
    font-size: 28px;
    font-style: italic;
    font-weight: 500;
  }

  .actions {
    display: flex;
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

  .button:hover {
    color: var(--text-primary);
    border-color: var(--text-muted);
  }

  .button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
