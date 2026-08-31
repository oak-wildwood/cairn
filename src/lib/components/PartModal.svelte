<script lang="ts">
  import { untrack } from "svelte";
  import type { Part, PartDraft, PartRole } from "../types";

  interface Props {
    /** The part being edited, or null when adding a new one. */
    part: Part | null;
    onsubmit: (draft: PartDraft) => void;
    oncancel: () => void;
  }

  const { part, onsubmit, oncancel }: Props = $props();

  const ROLE_OPTIONS: readonly { value: PartRole; label: string }[] = [
    { value: "manager", label: "Manager — keeps things under control" },
    { value: "firefighter", label: "Firefighter — reacts when pain breaks through" },
    { value: "exile", label: "Exile — carries the hurt being protected" },
    { value: "unknown", label: "Unknown — noticed, not yet identified" },
  ];

  /**
   * Statuses the diagram reacts to, offered as suggestions rather than a fixed
   * list: `status` is free text by design, and "emerging"/"unwitnessed" only
   * change how a node is drawn — they don't constrain what can be typed.
   */
  const STATUS_SUGGESTIONS = [
    "active",
    "emerging",
    "witnessed",
    "unwitnessed",
  ];

  /**
   * The form is a snapshot, not a live view: it seeds from the part once and
   * only writes back on submit, so a cancelled edit leaves the store alone.
   * `untrack` says that explicitly — without it Svelte reasonably warns that
   * these reads capture only the initial value. `App.svelte` keys the modal,
   * so a different part remounts it rather than reusing this state.
   */
  const initial = untrack(() => part);

  let name = $state(initial?.name ?? "");
  let role = $state<PartRole | "">(initial?.role ?? "");
  let status = $state(initial?.status ?? "active");
  let feelings = $state(initial?.feelings.join(", ") ?? "");
  let description = $state(initial?.description ?? "");
  let bodyLocation = $state(initial?.bodyLocation ?? "");
  let trigger = $state(initial?.trigger ?? "");
  let positiveIntention = $state(initial?.positiveIntention ?? "");
  let fears = $state(initial?.fears ?? "");
  let origins = $state(initial?.origins ?? "");
  let notes = $state(initial?.notes ?? "");

  let dialog = $state<HTMLDialogElement | null>(null);
  let nameInput = $state<HTMLInputElement | null>(null);

  /**
   * `showModal()` rather than an `open` attribute: it brings the focus trap,
   * the inert backdrop and Escape-to-close that a hand-rolled overlay would
   * otherwise have to reimplement.
   *
   * Focus then moves to the first field explicitly. Left alone, Chrome hands
   * it to the scrolling body instead — which lands a focus ring on the whole
   * form and starts the keyboard user one tab away from where they want to be.
   */
  $effect(() => {
    dialog?.showModal();
    nameInput?.focus();
  });

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    // `required` on the inputs means the browser blocks submit before this,
    // but the union type still has to be narrowed for the draft.
    if (role === "") return;

    onsubmit({
      name: name.trim(),
      role,
      status: status.trim(),
      feelings: feelings
        .split(",")
        .map((feeling) => feeling.trim())
        .filter((feeling) => feeling !== ""),
      description: description.trim(),
      bodyLocation: bodyLocation.trim(),
      trigger: trigger.trim(),
      positiveIntention: positiveIntention.trim(),
      fears: fears.trim(),
      origins: origins.trim(),
      notes: notes.trim(),
      // An existing part keeps whatever position it was dragged to; a new one
      // is null/null so `computeLayout` places it in its sector.
      x: part?.x ?? null,
      y: part?.y ?? null,
    });
  }
</script>

<dialog bind:this={dialog} onclose={oncancel} aria-label={part ? "Edit part" : "Add a part"}>
  <form method="dialog" class="form" onsubmit={handleSubmit}>
    <header class="head">
      <h2 class="title">{part ? `Edit ${part.name}` : "Add a part"}</h2>
    </header>

    <div class="body">
      <div class="row">
        <p class="field">
          <label for="part-name">Name</label>
          <input
            id="part-name"
            bind:this={nameInput}
            bind:value={name}
            required
            autocomplete="off"
          />
        </p>

        <p class="field">
          <label for="part-role">Role</label>
          <select id="part-role" bind:value={role} required>
            <option value="" disabled>Choose a role…</option>
            {#each ROLE_OPTIONS as option (option.value)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </p>
      </div>

      <div class="row">
        <p class="field">
          <label for="part-status">Status</label>
          <input
            id="part-status"
            bind:value={status}
            list="part-status-options"
            autocomplete="off"
          />
          <datalist id="part-status-options">
            {#each STATUS_SUGGESTIONS as suggestion (suggestion)}
              <option value={suggestion}></option>
            {/each}
          </datalist>
        </p>

        <p class="field">
          <label for="part-feelings">Feelings</label>
          <input
            id="part-feelings"
            bind:value={feelings}
            placeholder="exhausted, sad, forgotten"
            autocomplete="off"
          />
          <span class="hint">Separate with commas.</span>
        </p>
      </div>

      <p class="field">
        <label for="part-description">Description</label>
        <textarea id="part-description" rows="3" bind:value={description}
        ></textarea>
      </p>

      <p class="field">
        <label for="part-body">Body location</label>
        <input id="part-body" bind:value={bodyLocation} autocomplete="off" />
      </p>

      <p class="field">
        <label for="part-trigger">Trigger</label>
        <textarea id="part-trigger" rows="2" bind:value={trigger}></textarea>
      </p>

      <p class="field">
        <label for="part-intention">Positive intention</label>
        <textarea id="part-intention" rows="2" bind:value={positiveIntention}
        ></textarea>
      </p>

      <p class="field">
        <label for="part-fears">Fears</label>
        <textarea id="part-fears" rows="2" bind:value={fears}></textarea>
      </p>

      <p class="field">
        <label for="part-origins">Origins</label>
        <textarea id="part-origins" rows="2" bind:value={origins}></textarea>
      </p>

      <p class="field">
        <label for="part-notes">Notes</label>
        <textarea id="part-notes" rows="2" bind:value={notes}></textarea>
      </p>
    </div>

    <footer class="actions">
      <button type="button" class="quiet" onclick={oncancel}>Cancel</button>
      <button type="submit" class="primary">
        {part ? "Save changes" : "Add part"}
      </button>
    </footer>
  </form>
</dialog>

<style>
  /*
   * DERIVED: the original design has no modal. The surface matches the detail panel's,
   * and the controls reuse the toolbar's pill geometry so the form reads as
   * part of the same chrome rather than a browser default dropped on top.
   */
  dialog {
    width: min(38rem, calc(100vw - 2rem));
    max-height: min(44rem, calc(100vh - 4rem));
    padding: 0;
    border: 1px solid var(--rule);
    border-radius: 14px;
    background: #12141f;
    color: var(--text-primary);
  }

  dialog::backdrop {
    background: rgb(8 9 14 / 72%);
  }

  .form {
    display: flex;
    flex-direction: column;
    max-height: inherit;
    margin: 0;
  }

  .head {
    padding: 1.5rem 1.5rem 0;
  }

  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 28px;
    font-style: italic;
    font-weight: 500;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    overflow-y: auto;
  }

  .row {
    display: flex;
    gap: 1rem;
  }

  .row .field {
    flex: 1 1 0;
    min-width: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin: 0;
  }

  label {
    color: var(--text-eyebrow);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  input,
  select,
  textarea {
    box-sizing: border-box;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--pill-border);
    border-radius: 8px;
    background: #0e1019;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 14px;
    line-height: 1.45;
  }

  textarea {
    resize: vertical;
  }

  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .hint {
    color: var(--text-muted);
    font-size: 12px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--rule);
  }

  .actions button {
    height: 38px;
    padding: 0 1.375rem;
    border-radius: 19px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .primary {
    border: 1.3px solid var(--button-border);
    background: none;
    color: var(--text-bright);
  }

  .primary:hover {
    border-color: var(--text-muted);
    color: var(--text-primary);
  }

  .quiet {
    border: 1px solid transparent;
    background: none;
    color: var(--text-muted);
  }

  .quiet:hover {
    color: var(--text-bright);
  }

  @media (max-width: 560px) {
    .row {
      flex-direction: column;
    }
  }
</style>
