<script lang="ts">
  import DemoBanner from "./lib/components/DemoBanner.svelte";
  import { EXAMPLE_OWNER_NAME } from "./lib/exampleData";
  import Diagram from "./lib/components/Diagram.svelte";
  import Legend from "./lib/components/Legend.svelte";
  import PartDetailPanel from "./lib/components/PartDetailPanel.svelte";
  import PartModal from "./lib/components/PartModal.svelte";
  import StartFreshModal from "./lib/components/StartFreshModal.svelte";
  import Toolbar from "./lib/components/Toolbar.svelte";
  import { downloadMap } from "./lib/backup";
  import { parseMap, saveState, saveStateDebounced } from "./lib/persistence";
  import { store } from "./lib/store.svelte";
  import { SCHEMA_VERSION } from "./lib/types";
  import type { PersistedState } from "./lib/types";

  /**
   * The store owns the data; this component reads it and hands the diagram
   * plain props, so `Diagram.svelte` stays a pure function of its inputs
   * rather than reaching into module state of its own.
   */
  /**
   * The heading claims the map for whoever it belongs to, the sample included —
   * it reads "Parts Map for Demo User" rather than switching to a different
   * phrasing only the sample uses, so the shape of the title never changes
   * under someone as they take the map over.
   *
   * Owner is read off `showingExample` rather than seeded into the store, so
   * there is one source of truth for "is this the sample" and no demo name to
   * clear later. The generic title survives for the one case with no name at
   * all: a map started fresh by someone who left the field blank. "Parts Map
   * for" with nothing after it would be worse than not having asked.
   */
  const owner = $derived(
    store.showingExample ? EXAMPLE_OWNER_NAME : store.ownerName,
  );
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
  function snapshotState(): PersistedState {
    return {
      schemaVersion: SCHEMA_VERSION,
      parts: $state.snapshot(store.parts),
      connections: $state.snapshot(store.connections),
      ownerName: store.ownerName,
    };
  }

  $effect(() => {
    // An untouched sample map is never written. Persisting it would make the
    // seed indistinguishable from a real map on the next load — the banner
    // would drop, and `exampleData.ts` would quietly become the user's own.
    if (store.showingExample) return;

    saveStateDebounced(snapshotState());
  });

  /**
   * What the last map-file action did, shown beside the toolbar and cleared on
   * the next one. A restore that quietly does nothing is indistinguishable
   * from a restore that worked on an empty map, and a rejected file needs to
   * say so — there is no other signal that the pick went nowhere.
   */
  let fileNotice = $state<{ tone: "ok" | "bad"; text: string } | null>(null);

  function handleBackUp(): void {
    downloadMap(snapshotState());
    fileNotice = { tone: "ok", text: "Saved a copy to your downloads." };
  }

  async function handleRestore(file: File): Promise<void> {
    let text: string;
    try {
      text = await file.text();
    } catch {
      fileNotice = { tone: "bad", text: `Couldn't read ${file.name}.` };
      return;
    }

    const restoredMap = parseMap(text);
    if (!restoredMap) {
      // Deliberately does not touch the store: a map already on screen is
      // worth more than a file that failed to parse, so a bad pick is a no-op
      // rather than a wipe.
      fileNotice = {
        tone: "bad",
        text: `${file.name} isn't a Cairn map file. Nothing was changed.`,
      };
      return;
    }

    store.replaceAll(
      restoredMap.parts,
      restoredMap.connections,
      restoredMap.ownerName ?? "",
    );
    saveState(snapshotState());
    const count = restoredMap.parts.length;
    fileNotice = {
      tone: "ok",
      text: `Restored ${count} ${count === 1 ? "part" : "parts"} from ${file.name}.`,
    };
  }

  let startingFresh = $state(false);

  function handleStartFresh(ownerName: string): void {
    store.startFresh(ownerName);
    /**
     * Written now rather than left to the debounced `$effect`. Replacing the
     * whole map is a single deliberate act, not the tail of a stream of edits,
     * and someone who clears the sample and immediately reloads would
     * otherwise be met by the sample again — the write never fired, so the
     * blob is still absent and `showingExample` comes back true. Restoring a
     * backup has the same shape and does the same.
     */
    saveState(snapshotState());
    startingFresh = false;
    fileNotice = {
      tone: "ok",
      text:
        ownerName.trim() === ""
          ? "Cleared. This map is yours now."
          : `Cleared. This map is yours now, ${ownerName.trim()}.`,
    };
  }

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
        <p class="wordmark">Cairn</p>
      </div>
      <div class="counts">
        <p class="count">
          {store.parts.length}
          {store.parts.length === 1 ? "part" : "parts"}
        </p>
        <p class="count-meta">{activeCount} active this week</p>
      </div>
    </header>

    <hr class="rule" />

    <div class="page-heading">
      <h1 class="title">
        {#if owner === ""}
          My Parts Map
        {:else}
          Parts Map for <span class="owner">{owner}</span>
        {/if}
      </h1>
      <Toolbar
        onAddPart={() => store.startAdding()}
        onBackUp={handleBackUp}
        onRestore={handleRestore}
        onStartFresh={() => (startingFresh = true)}
      />
    </div>

    {#if fileNotice}
      <p class="file-notice" class:bad={fileNotice.tone === "bad"} role="status">
        {fileNotice.text}
      </p>
    {/if}

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
          activeFilter={store.activeFilter}
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
      <Legend
        parts={store.parts}
        activeFilter={store.activeFilter}
        onFilter={(filter) => store.setFilter(filter)}
      />
      <div class="footer-spacer" aria-hidden="true"></div>
    </footer>
  </main>
</div>

{#if startingFresh}
  <!--
    The sample map is nobody's work, so clearing it loses nothing and the
    dialog shouldn't say otherwise — only a map they own earns the
    can't-be-undone warning.
  -->
  <StartFreshModal
    hasContent={!store.showingExample &&
      (store.parts.length > 0 || store.connections.length > 0)}
    onsubmit={handleStartFresh}
    oncancel={() => (startingFresh = false)}
  />
{/if}

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
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
  }

  /**
   * The app's only product identity in-page — the original design had no logo,
   * so this is a deliberate addition beside the header rather than a change to
   * it.
   */
  .brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .mark {
    display: block;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
  }

  .wordmark {
    margin: 0;
    color: var(--text-bright);
    font-family: var(--font-display);
    font-size: 26px;
    font-style: italic;
    font-weight: 500;
  }

  .page-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
  }

  .file-notice {
    margin: 0.75rem 0 0;
    color: var(--text-muted);
    font-size: 13px;
  }

  .file-notice.bad {
    color: #e38f6b;
  }

  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 42px;
    font-style: italic;
    font-weight: 500;
    line-height: 1;
  }

  /**
   * The one part of the heading that is somebody's own words, so it is set
   * apart from the fixed label around it: upright against the italic, and in
   * Self's gold rather than the body's off-white. Both changes point the same
   * way — this slot is filled in, not printed — and the gold is already the
   * colour this app uses for the centre of a person's own map.
   */
  .owner {
    color: #e8c98c;
    font-style: normal;
  }

  .counts {
    text-align: right;
  }

  .count {
    margin: 0;
    color: var(--text-bright);
    font-size: 16px;
    font-weight: 500;
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
