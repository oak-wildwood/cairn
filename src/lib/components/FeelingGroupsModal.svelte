<script lang="ts">
  /**
   * Where someone says which of their feelings are the same feeling under
   * different words — "scared", "afraid", "fear" — so the legend's feeling
   * filter treats them as one. The grouping is theirs to declare; nothing
   * here suggests or guesses one (see `feelings.ts` for why).
   *
   * Edits apply as they are made rather than on a Save, unlike `PartModal`:
   * each one is small, none is destructive — deleting a group leaves every
   * part's feelings exactly as they were — and a draft copy of the whole list
   * would only add a way to lose work by pressing Escape.
   */
  import { tick } from "svelte";
  import FeelingsMultiSelect from "./FeelingsMultiSelect.svelte";
  import { feelingCounts } from "../feelings";
  import type { FeelingGroup, Part } from "../types";

  interface Props {
    groups: readonly FeelingGroup[];
    /** For the vocabulary each group's picker offers. */
    parts: readonly Part[];
    /** Creates an empty group and returns its id. */
    onadd: () => string;
    onrename: (id: string, name: string) => void;
    onassign: (id: string, feelings: string[]) => void;
    ondelete: (id: string) => void;
    onclose: () => void;
  }

  const { groups, parts, onadd, onrename, onassign, ondelete, onclose }: Props =
    $props();

  let dialog = $state<HTMLDialogElement | null>(null);

  /** `showModal` for the inert backdrop and Escape-to-close, as `DataStorageModal`. */
  $effect(() => {
    dialog?.showModal();
  });

  /**
   * Every feeling on a part, plus every feeling already in a group whether or
   * not a part carries it yet — a group can name "terrified" before anything
   * on the map is. Those count 0, which is the truth, rather than the 1
   * `FeelingsMultiSelect` would otherwise assume for a tag it hasn't seen.
   */
  const vocabulary = $derived.by(() => {
    const counts = feelingCounts(parts);
    for (const group of groups) {
      for (const feeling of group.feelings) {
        if (!counts.has(feeling)) counts.set(feeling, 0);
      }
    }
    return counts;
  });

  function nameInputId(id: string): string {
    return `feeling-group-name-${id}`;
  }

  /** Add a group and put the caret in its name, which is what comes next. */
  async function addGroup(): Promise<void> {
    const id = onadd();
    await tick();
    document.getElementById(nameInputId(id))?.focus();
  }
</script>

<dialog bind:this={dialog} onclose={onclose} aria-label="Feeling groups">
  <form method="dialog" class="form">
    <h2 class="title">Feeling groups</h2>

    <p class="body">
      Group words that name the same feeling for you. Filtering the map by any
      one of them then shows every part carrying any of them. A feeling sits in
      one group at most, so adding it here moves it out of another.
    </p>

    {#if groups.length === 0}
      <p class="empty">No groups yet.</p>
    {:else}
      <ul class="groups">
        {#each groups as group (group.id)}
          <li class="group">
            <div class="group-head">
              <label class="label" for={nameInputId(group.id)}>Group name</label>
              <button
                type="button"
                class="remove"
                aria-label="Delete group {group.name || 'without a name'}"
                onclick={() => ondelete(group.id)}
              >
                Delete
              </button>
            </div>
            <!-- Committed on `change`, not each keystroke, so the store's trim
                 can't eat the space someone is typing between two words. -->
            <input
              id={nameInputId(group.id)}
              class="input"
              value={group.name}
              autocomplete="off"
              placeholder="e.g., fear"
              onchange={(event) => onrename(group.id, event.currentTarget.value)}
            />
            <FeelingsMultiSelect
              tagCounts={vocabulary}
              selected={group.feelings}
              onChange={(feelings) => onassign(group.id, feelings)}
              allowCreate
              label="Add feelings"
              eyebrow="Feelings in this group"
              dropDirection="down"
            />
          </li>
        {/each}
      </ul>
    {/if}

    <div class="actions">
      <button class="button" type="button" onclick={addGroup}>+ Add a group</button>
      <button class="button primary" type="submit">Done</button>
    </div>
  </form>
</dialog>

<style>
  /*
   * DERIVED: the original design has no screen for managing feeling groups.
   * Every value below is `StartFreshModal`'s and `DataStorageModal`'s — the
   * same surface, title, body, label, input and button treatment — so this
   * reads as one more of the app's dialogs rather than a new visual language.
   * The one addition is the per-group divider, drawn in `--pill-border`, the
   * dialog's own edge colour.
   */
  dialog {
    width: min(32rem, calc(100vw - 2rem));
    max-height: calc(100vh - 4rem);
    padding: 0;
    border: 1px solid var(--pill-border);
    border-radius: 14px;
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

  .body,
  .empty {
    margin: 0 0 1rem;
    color: var(--text-muted);
    font-size: var(--body-text-size);
    line-height: var(--body-text-line-height);
  }

  .empty {
    font-style: italic;
  }

  .groups {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 0;
    border-top: 1px solid var(--pill-border);
  }

  .group-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .label {
    color: var(--text-eyebrow);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.4px;
    text-transform: uppercase;
  }

  .remove {
    padding: 0;
    border: none;
    background: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .remove:hover {
    color: var(--text-primary);
  }

  .remove:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
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

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.625rem;
    margin-top: 1rem;
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
