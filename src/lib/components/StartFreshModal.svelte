<script lang="ts">
  /**
   * Clearing the sample map and claiming the new one, in a single step.
   *
   * The warning and the name field are deliberately the same dialog rather
   * than a confirm followed by a prompt. Typing a name is already a deliberate
   * act, so it confirms the erase better than a second button would, and it
   * puts the reassuring half of the story — this becomes *your* map — next to
   * the destructive half instead of after it.
   */
  interface Props {
    /** True once there is something to lose, which changes what we warn about. */
    hasContent: boolean;
    onsubmit: (ownerName: string) => void;
    oncancel: () => void;
  }

  const { hasContent, onsubmit, oncancel }: Props = $props();

  let name = $state("");
  let dialog = $state<HTMLDialogElement | null>(null);
  let input = $state<HTMLInputElement | null>(null);

  /**
   * `showModal` rather than an `open` attribute, matching `PartModal`: it is
   * what gives us the inert backdrop, the focus trap and Escape-to-close for
   * free instead of hand-rolling all three.
   *
   * The field is then focused explicitly. `showModal` does focus the first
   * focusable descendant on its own, but that is a positional accident — add
   * a control above the input and the caret silently lands somewhere else,
   * with the only symptom being a name that doesn't get typed.
   */
  $effect(() => {
    dialog?.showModal();
    input?.focus();
  });

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    onsubmit(name);
  }
</script>

<dialog bind:this={dialog} onclose={oncancel} aria-label="Start a fresh map">
  <form method="dialog" class="form" onsubmit={handleSubmit}>
    <h2 class="title">Start a fresh map</h2>

    <p class="body">
      {#if hasContent}
        This clears every part and connection on the map. If you want them,
        back up to a file first — this can't be undone.
      {:else}
        The sample map makes way for your own. Nothing of yours is on it yet.
      {/if}
    </p>

    <label class="label" for="owner-name">Whose map is this?</label>
    <!--
      A local label for a heading, not an identity field. Left fillable,
      password managers offer to complete it and cover the dialog with a vault
      prompt, which is a strange thing to meet while clearing your own map.
      The two vendor attributes are what those extensions actually read;
      `autocomplete` alone they routinely ignore.
    -->
    <input
      bind:this={input}
      id="owner-name"
      class="input"
      bind:value={name}
      placeholder="Your name"
      autocomplete="off"
      data-1p-ignore
      data-lpignore="true"
    />
    <p class="hint">
      Used for the heading, and kept on this device with everything else.
      Leave it blank if you'd rather not.
    </p>

    <div class="actions">
      <button class="button" type="button" onclick={oncancel}>Cancel</button>
      <button class="button primary" type="submit">Start fresh</button>
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
    font-size: 13px;
    line-height: 1.55;
  }

  .label {
    margin-bottom: 0.4375rem;
    color: var(--text-eyebrow);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.4px;
    text-transform: uppercase;
  }

  .input {
    height: 38px;
    padding: 0 0.75rem;
    border: 1px solid var(--pill-border);
    border-radius: 8px;
    background: rgb(255 255 255 / 3%);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 14px;
  }

  .input:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .hint {
    margin: 0.5rem 0 0;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.45;
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
