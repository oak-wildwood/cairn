<script lang="ts">
  import DemoBanner from "./lib/components/DemoBanner.svelte";
  import Diagram from "./lib/components/Diagram.svelte";
  import Legend from "./lib/components/Legend.svelte";
  import PartDetailPanel from "./lib/components/PartDetailPanel.svelte";
  import PartModal from "./lib/components/PartModal.svelte";
  import Toolbar from "./lib/components/Toolbar.svelte";
  import { saveStateDebounced } from "./lib/persistence";
  import { store } from "./lib/store.svelte";
  import { SCHEMA_VERSION } from "./lib/types";

  /**
   * The store owns the data; this component reads it and hands the diagram
   * plain props, so `Diagram.svelte` stays a pure function of its inputs
   * rather than reaching into module state of its own.
   */
  const activeCount = $derived(
    store.parts.filter((part) => part.status.trim().toLowerCase() === "active")
      .length,
  );

  /**
   * Write the map back to localStorage whenever it settles.
   *
   * `$state.snapshot` does the deep read that registers every part and
   * connection as a dependency, and hands back plain objects for JSON in the
   * same step — serialising the reactive proxies directly would be both
   * untracked and wrong.
   */
  $effect(() => {
    // An untouched sample map is never written. Persisting it would make the
    // seed indistinguishable from a real map on the next load — the banner
    // would drop, and `exampleData.ts` would quietly become the user's own.
    if (store.showingExample) return;

    saveStateDebounced({
      schemaVersion: SCHEMA_VERSION,
      parts: $state.snapshot(store.parts),
      connections: $state.snapshot(store.connections),
    });
  });

  /**
   * Escape is the keyboard equivalent of clicking the canvas to deselect —
   * except while the modal is open, where the dialog owns Escape and closing
   * the form should not also drop the selection behind it.
   */
  /**
   * True when the keystroke belongs to something the user is typing into.
   * Without this, Backspace while correcting a connection's label would delete
   * the connection out from under the cursor.
   */
  function isTyping(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    );
  }

  function handleWindowKey(event: KeyboardEvent): void {
    // The modal owns Escape while it is open; closing the form should not
    // also drop whatever is selected behind it.
    if (store.editing) return;

    if (event.key === "Escape") {
      store.clearSelection();
      return;
    }

    if (event.key !== "Delete" && event.key !== "Backspace") return;
    if (isTyping(event.target)) return;
    if (store.selectedConnectionId === null) return;
    // Backspace still navigates back in some browsers when nothing has focus.
    event.preventDefault();
    store.deleteConnection(store.selectedConnectionId);
  }
</script>

<svelte:window onkeydown={handleWindowKey} />

<div class="shell">
  {#if store.showingExample}
    <DemoBanner />
  {/if}

  <main class="app">
    <header class="header">
      <div class="brand">
        <img
          class="mark"
          src="{import.meta.env.BASE_URL}logo-96.png"
          srcset="{import.meta.env.BASE_URL}logo-96.png 1x, {import.meta.env.BASE_URL}logo-192.png 2x"
          alt="Cairn"
          width="44"
          height="44"
        />
        <h1 class="title">Cairn</h1>
      </div>
      <div class="counts">
        <p class="count">{store.parts.length} parts</p>
        <p class="count-meta">{activeCount} active this week</p>
      </div>
    </header>

    <hr class="rule" />

    <Toolbar onAddPart={() => store.startAdding()} />

    <hr class="rule" />

    <section class="workspace">
      <div class="canvas">
        <Diagram
          parts={store.parts}
          connections={store.connections}
          selectedPartId={store.selectedPartId}
          onselect={(id) => store.select(id)}
          onclear={() => store.clearSelection()}
          onmove={(id, point) => store.movePart(id, point)}
          onconnectcreate={(sourceId, targetId) =>
            store.addConnection(sourceId, targetId)}
          selectedConnectionId={store.selectedConnectionId}
          onconnectselect={(id) => store.selectConnection(id)}
          onconnectlabel={(id, label) => store.setConnectionLabel(id, label)}
          onconnectdelete={(id) => store.deleteConnection(id)}
          onconnectclose={() => store.clearConnectionSelection()}
        />
      </div>

      {#if store.selectedPart}
        {@const selected = store.selectedPart}
        <PartDetailPanel
          part={selected}
          connections={store.connectionsFor(selected.id)}
          parts={store.parts}
          onclose={() => store.clearSelection()}
          onedit={(id) => store.startEditing(id)}
          ondelete={(id) => store.deletePart(id)}
        />
      {/if}
    </section>

    <hr class="rule" />

    <footer class="footer">
      <p class="footer-note">Mark the way through.</p>
      <Legend parts={store.parts} />
      <div class="footer-spacer" aria-hidden="true"></div>
    </footer>
  </main>
</div>

{#if store.editing}
  <!-- Keyed so switching between adding and editing rebuilds the form's local
       state instead of carrying the previous part's answers across. -->
  {#key store.editing}
    <PartModal
      part={store.editingPart}
      oncancel={() => store.stopEditing()}
      onsubmit={(draft) => {
        const target = store.editing;
        if (target?.kind === "existing") store.updatePart(target.id, draft);
        else store.addPart(draft);
      }}
    />
  {/key}
{/if}

<style>
  :global(:root) {
    --text-primary: #f1eee7;
    --text-bright: #edeae0;
    --text-muted: #8a8fa8;
    --text-eyebrow: #9aa0c0;
    --text-footer: #c9bfa0;
    --rule: #2c3148;
    --button-border: #4a5170;
    --pill-border: #3a4058;
    --focus-ring: #8fa3e3;
    --font-display: "Cormorant Garamond", Georgia, "Times New Roman", serif;
    --font-ui: "Manrope", ui-sans-serif, system-ui, -apple-system, sans-serif;
  }

  :global(html),
  :global(body) {
    margin: 0;
    height: 100%;
    background: #0b0c12;
  }

  :global(body) {
    font-family: var(--font-ui);
    -webkit-font-smoothing: antialiased;
  }

  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .app {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
    padding: 2.25rem clamp(1.25rem, 5vw, 3.75rem);
    box-sizing: border-box;
    color: var(--text-primary);
  }

  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.9375rem;
  }

  .mark {
    display: block;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
  }

  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 42px;
    font-style: italic;
    font-weight: 500;
    line-height: 1;
  }

  .counts {
    text-align: right;
  }

  .count {
    margin: 0;
    color: var(--text-bright);
    font-size: 16px;
    font-weight: 600;
  }

  .count-meta {
    margin: 0.375rem 0 0;
    color: var(--text-muted);
    font-size: 13px;
  }

  .rule {
    margin: 0;
    border: none;
    border-top: 1px solid var(--rule);
  }

  .workspace {
    display: flex;
    flex: 1 1 0;
    min-height: 0;
    gap: 1.5rem;
  }

  .canvas {
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    display: flex;
  }

  @media (max-width: 900px) {
    .workspace {
      flex-direction: column;
      gap: 1rem;
    }
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
  }

  .footer-note,
  .footer-spacer {
    flex: 1 1 0;
    margin: 0;
  }

  .footer-note {
    color: var(--text-footer);
    font-family: var(--font-display);
    font-size: 20px;
    font-style: italic;
  }

  @media (max-width: 720px) {
    .footer {
      flex-direction: column;
      align-items: stretch;
    }

    .footer-spacer {
      display: none;
    }
  }
</style>
