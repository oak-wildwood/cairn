<script lang="ts">
  /**
   * The privacy explanation the README already gives (see "Data & privacy")
   * surfaced inside the app itself — reachable from the tour's last step and
   * from the map menu at any time after, so it isn't something someone only
   * hears once and has to remember.
   */
  interface Props {
    onclose: () => void;
  }

  const { onclose }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);

  /**
   * `showModal` rather than an `open` attribute, matching `StartFreshModal`:
   * it makes the rest of the page inert and gives Escape-to-close for free.
   */
  $effect(() => {
    dialog?.showModal();
  });
</script>

<dialog bind:this={dialog} onclose={onclose} aria-label="Where your data lives">
  <form method="dialog" class="form">
    <h2 class="title">Where your data lives</h2>

    <p class="body">
      This map is stored only in this browser, on this device — there's no
      account, no server, and no cloud sync. Nothing you enter here is ever
      sent anywhere.
    </p>

    <p class="body">
      That also means it won't follow you to a different browser or device on
      its own. To move a map, or keep a copy somewhere safer, use
      <strong>Back up to a file</strong> from the menu, then
      <strong>Restore from a file</strong> wherever you want it next.
    </p>

    <div class="actions">
      <button class="button primary" type="submit">Got it</button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    width: min(28rem, calc(100vw - 2rem));
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
    font-size: 15px;
    line-height: 1.6;
  }

  .body strong {
    color: var(--text-primary);
    font-weight: 600;
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
