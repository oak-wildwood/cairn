<script lang="ts">
  /**
   * Shown once on a phone-sized screen: the map is fully readable there, but
   * some things were built around a pointer and a wide screen and are left
   * out. Matches `DataStorageModal`'s shape.
   */
  interface Props {
    onclose: () => void;
  }

  const { onclose }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    dialog?.showModal();
  });
</script>

<dialog bind:this={dialog} onclose={onclose} aria-label="Best on a computer">
  <form method="dialog" class="form">
    <h2 class="title">Best on a computer</h2>

    <p class="body">
      You can read your map, add and edit parts, and use the filters here. A few
      things are left out on a phone because they need a mouse or a wide screen:
    </p>

    <ul class="list">
      <li>Saving the map as an image or a PDF</li>
      <li>Dragging parts to new positions</li>
      <li>Drawing connections between parts, and editing their labels</li>
    </ul>

    <p class="body">
      For the full experience, open Cairn on a computer. You can move your map
      there with <strong>Back up to a file</strong> in the menu.
    </p>

    <div class="actions">
      <button class="button primary" type="submit">Got it</button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    width: min(28rem, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
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
    margin: 0 0 1rem;
    color: var(--text-muted);
    font-size: var(--body-text-size);
    line-height: var(--body-text-line-height);
  }

  .list {
    margin: 0 0 1rem;
    padding-left: 1.25rem;
    color: var(--text-muted);
    font-size: var(--body-text-size);
    line-height: var(--body-text-line-height);
  }

  .body strong {
    color: var(--text-primary);
    font-weight: 600;
    font-style: italic;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  .button {
    height: 36px;
    padding: 0 1.25rem;
    border: 1.3px solid var(--button-border);
    border-radius: 18px;
    background: none;
    color: var(--text-bright);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition:
      color 160ms ease,
      border-color 160ms ease;
  }

  .button:hover {
    border-color: var(--text-muted);
  }

  .button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
