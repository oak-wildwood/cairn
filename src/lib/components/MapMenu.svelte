<script lang="ts">
  /**
   * The map-file actions — back up, restore, start fresh — folded behind one
   * control beside Export.
   *
   * They are infrequent and none of them is the thing someone came to the page
   * to do, so spending three pill-widths of the heading row on them crowded out
   * "+ Add a part", which is the thing. A menu keeps them one click away
   * without giving them the same weight as the primary action.
   */
  interface Props {
    onBackUp: () => void;
    onRestore: (file: File) => void;
    /**
     * Opens the confirm-and-name dialog rather than clearing on the spot — the
     * menu deliberately owns no destructive action of its own.
     */
    onStartFresh: () => void;
  }

  const { onBackUp, onRestore, onStartFresh }: Props = $props();

  let open = $state(false);
  let trigger = $state<HTMLButtonElement | null>(null);
  let panel = $state<HTMLDivElement | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  function close(options: { refocus: boolean } = { refocus: false }): void {
    open = false;
    if (options.refocus) trigger?.focus();
  }

  function handleFile(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    // Picking the same file twice in a row fires no `change` unless the value
    // is cleared first, which reads as the restore silently failing.
    input.value = "";
    if (file) {
      close();
      onRestore(file);
    }
  }

  /**
   * Close on anything that means "I'm done here": Escape, or a pointer landing
   * outside both the panel and the button that opened it. Registered only
   * while open, so a closed menu costs nothing.
   */
  $effect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panel?.contains(target) || trigger?.contains(target)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      // Stop the window handler in App from also reading this Escape as
      // "deselect the open part" — closing the menu is the whole gesture.
      event.stopPropagation();
      close({ refocus: true });
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  });
</script>

<div class="menu">
  <button
    bind:this={trigger}
    class="trigger"
    type="button"
    aria-label="Map file actions"
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={() => (open ? close() : (open = true))}
  >
    <svg width="16" height="4" viewBox="0 0 16 4" aria-hidden="true">
      <circle cx="2" cy="2" r="1.6" fill="currentColor" />
      <circle cx="8" cy="2" r="1.6" fill="currentColor" />
      <circle cx="14" cy="2" r="1.6" fill="currentColor" />
    </svg>
  </button>

  {#if open}
    <div bind:this={panel} class="panel" role="menu">
      <button class="item" type="button" role="menuitem" onclick={() => {
        close();
        onBackUp();
      }}>
        Back up to a file
      </button>

      <button
        class="item"
        type="button"
        role="menuitem"
        onclick={() => fileInput?.click()}
      >
        Restore from a file
      </button>

      <hr class="separator" />
      <button
        class="item danger"
        type="button"
        role="menuitem"
        onclick={() => {
          close();
          onStartFresh();
        }}
      >
        Start fresh…
      </button>
    </div>
  {/if}

  <!--
    Owned by Svelte and driven from the menu item, so the panel keeps one
    visual language rather than carrying a lone native file control.
  -->
  <input
    bind:this={fileInput}
    class="file"
    type="file"
    accept="application/json,.json"
    aria-hidden="true"
    tabindex="-1"
    onchange={handleFile}
  />
</div>

<style>
  .menu {
    position: relative;
  }

  .trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    padding: 0;
    border: 1.3px solid var(--button-border);
    border-radius: 19px;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    transition:
      color 160ms ease,
      border-color 160ms ease;
  }

  .trigger:hover,
  .trigger[aria-expanded="true"] {
    color: var(--text-primary);
    border-color: var(--text-muted);
  }

  .trigger:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  /* Right-aligned to the trigger so the panel grows inward, away from the
     viewport edge this button sits against. */
  .panel {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    min-width: 15rem;
    padding: 0.375rem;
    border: 1px solid var(--pill-border);
    border-radius: 12px;
    /* The detail panel's surface, a step above the darkest background stop. */
    background: #12141f;
    box-shadow: 0 12px 32px rgb(0 0 0 / 45%);
  }

  .item {
    padding: 0.5rem 0.625rem;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    transition:
      color 160ms ease,
      background-color 160ms ease;
  }

  .item:hover {
    color: var(--text-primary);
    background: rgb(255 255 255 / 4%);
  }

  .item:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }

  .separator {
    height: 1px;
    margin: 0.375rem 0.625rem;
    border: none;
    background: var(--rule);
  }

  /* The detail panel's delete ember, so the colour means the same thing in
     both places. The ellipsis in the label says a dialog follows, so this is
     a warning rather than a point of no return. */
  .item.danger:hover {
    color: #e38f6b;
  }

  .file {
    display: none;
  }
</style>
