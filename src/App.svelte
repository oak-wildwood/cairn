<script lang="ts">
  import { onMount } from "svelte";
  import DataStorageModal from "./lib/components/DataStorageModal.svelte";
  import DemoBanner from "./lib/components/DemoBanner.svelte";
  import { EXAMPLE_OWNER_NAME } from "./lib/exampleData";
  import Diagram from "./lib/components/Diagram.svelte";
  import ExportProgressModal from "./lib/components/ExportProgressModal.svelte";
  import Legend from "./lib/components/Legend.svelte";
  import PartDetailPanel from "./lib/components/PartDetailPanel.svelte";
  import PartModal from "./lib/components/PartModal.svelte";
  import StartFreshModal from "./lib/components/StartFreshModal.svelte";
  import Toolbar from "./lib/components/Toolbar.svelte";
  import TourOverlay from "./lib/components/TourOverlay.svelte";
  import { downloadMap } from "./lib/backup";
  import { exportMapPng } from "./lib/export";
  import { exportPartsPdf } from "./lib/pdfExport";
  import { isDemoRoute, parseMap, saveState, saveStateDebounced } from "./lib/persistence";
  import { store } from "./lib/store.svelte";
  import { hasSeenTour, markTourSeen, TOUR_STEPS } from "./lib/tour";
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

  /**
   * `demo/index.html` builds to `dist/demo/index.html` (see
   * `vite.config.ts`), one directory deeper than the root entry it shares
   * this bundle with. `import.meta.env.BASE_URL` is the literal "./" on
   * every deploy (see `persistence.ts`), so using it unadjusted here points
   * the logo at `/demo/logo-96.png`, which doesn't exist — the real files
   * sit one level up, alongside the root `index.html`.
   */
  const logoBase = isDemoRoute()
    ? `${import.meta.env.BASE_URL}../`
    : import.meta.env.BASE_URL;
  const activeCount = $derived(
    store.parts.filter((part) => part.active).length,
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

  /** The diagram's live `<svg>`, bound out of `Diagram` so it can be exported. */
  let diagramSvg = $state<SVGSVGElement | null>(null);

  /**
   * The live workspace (diagram + detail panel), bound out so the PDF export
   * can screenshot it as it actually appears on screen — a detached clone
   * would never show the panel `store.select` opens.
   */
  let workspaceEl = $state<HTMLElement | null>(null);

  /**
   * Drives `ExportProgressModal`, which doubles as a click shield: the
   * export loop drives the real `store.select` through every part in turn,
   * so a click landing on the diagram or panel mid-export would race it.
   * `showModal` makes the rest of the page inert for the pointer, and
   * `handleWindowKey` below separately guards Escape/Delete, which are
   * window-level listeners a modal's inertness doesn't reach. Non-null for
   * the exact duration of an export, so it doubles as that boolean too — the
   * whole toolbar disables while it's set, since adding, editing or deleting
   * a part mid-walk could select an id the export has already passed or one
   * it hasn't reached yet.
   */
  let exportProgress = $state<{ current: number; total: number } | null>(null);
  const exportingPdf = $derived(exportProgress !== null);

  async function handleExport(): Promise<void> {
    if (!diagramSvg) return;
    // Only when a part is actually selected — `store.selectedPart` and the
    // panel `workspaceEl` renders are the same condition, so this is never
    // null while the other is truthy.
    const panel = store.selectedPart
      ? (workspaceEl?.querySelector<HTMLElement>("aside") ?? null)
      : null;
    try {
      await exportMapPng(diagramSvg, panel);
      fileNotice = { tone: "ok", text: "Saved a PNG to your downloads." };
    } catch {
      // Rasterising is the browser's to do and can fail for reasons this app
      // can't see. Saying so beats a click that appears to do nothing.
      fileNotice = { tone: "bad", text: "Couldn't render the map as a PNG." };
    }
  }

  async function handleExportPdf(): Promise<void> {
    if (!workspaceEl || store.parts.length === 0) return;

    // Snapshotted so the user's own filter and selection come back exactly
    // as they left them, regardless of what the export itself selects.
    const priorSelection = store.selectedPartId;
    const priorFilter = store.activeFilter;
    const priorActiveOnly = store.activeOnlyFilter;
    const priorTags = [...store.tagFilter];
    const partIds = store.parts.map((part) => part.id);

    // A filtered-out part would render dimmed or hidden on its own page
    // otherwise — every page should show its part in full regardless of
    // whatever filter happens to be on in the legend.
    store.setFilter(null);
    if (store.activeOnlyFilter) store.toggleActiveOnlyFilter();
    if (store.tagFilter.length > 0) store.setTagFilter([]);

    exportProgress = { current: 1, total: partIds.length };
    try {
      await exportPartsPdf(
        workspaceEl,
        partIds,
        (id) => store.select(id),
        (done, total) => {
          exportProgress = { current: done, total };
        },
      );
      fileNotice = {
        tone: "ok",
        text: `Saved a ${partIds.length}-page PDF to your downloads.`,
      };
    } catch {
      // Screenshotting and PDF assembly both happen in the browser and can
      // fail for reasons this app can't see. Saying so beats a click that
      // appears to do nothing.
      fileNotice = { tone: "bad", text: "Couldn't build the PDF." };
    } finally {
      if (priorSelection !== null) store.select(priorSelection);
      else store.clearSelection();
      store.setFilter(priorFilter);
      if (store.activeOnlyFilter !== priorActiveOnly) store.toggleActiveOnlyFilter();
      store.setTagFilter(priorTags);
      exportProgress = null;
    }
  }

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
  let showingDataInfo = $state(false);

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
   * The guided tour's own state. `tourPriorSelection` snapshots whatever was
   * selected (or nothing) before the tour started, so the `requiresPart`
   * effect below can drive `store.selectedPartId` for its own steps without
   * losing whatever the user had open when they launched it from the menu.
   */
  let tourActive = $state(false);
  let tourStepIndex = $state(0);
  let tourPriorSelection: string | null = null;

  function startTour(): void {
    tourPriorSelection = store.selectedPartId;
    tourStepIndex = 0;
    tourActive = true;
  }

  function endTour(): void {
    tourActive = false;
    markTourSeen();
    if (tourPriorSelection !== null) store.select(tourPriorSelection);
    else store.clearSelection();
  }

  function tourNext(): void {
    if (tourStepIndex >= TOUR_STEPS.length - 1) {
      endTour();
      return;
    }
    tourStepIndex += 1;
  }

  function tourBack(): void {
    if (tourStepIndex === 0) return;
    tourStepIndex -= 1;
  }

  // The demo page is a second static entry for looking at the seed map
  // alongside a real one (see `isDemoRoute` in persistence.ts) — it isn't a
  // first visit to the real app, so it shouldn't offer the tour either.
  onMount(() => {
    if (!isDemoRoute() && !hasSeenTour()) startTour();
  });

  /**
   * Several steps ("select-part" on, through "connection") point at the
   * detail panel, which only exists once a part is selected. Rather than
   * have every such step open and close it, one effect keeps
   * `store.selectedPartId` matching what the current step needs and puts it
   * back to `tourPriorSelection` the moment it doesn't — the tour always
   * opens `store.parts[0]`, the same part `part-node` ("select-part")
   * resolves to via `document.querySelector`, so it's one consistent part
   * throughout rather than whichever one a real click happened to land on.
   */
  $effect(() => {
    if (!tourActive) return;
    const step = TOUR_STEPS[tourStepIndex];
    if (!step) return;

    if (step.requiresPart) {
      const demoId = store.parts[0]?.id;
      if (demoId !== undefined && store.selectedPartId !== demoId) {
        store.select(demoId);
      }
    } else if (store.selectedPartId !== tourPriorSelection) {
      if (tourPriorSelection !== null) store.select(tourPriorSelection);
      else store.clearSelection();
    }
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
    // `DataStorageModal` can be open on top of the tour (the last step
    // links to it) as well as on its own from the map menu. Either way its
    // own Escape should just close it — falling through to the tour branch
    // below would end the tour behind it as a side effect of dismissing an
    // informational dialog.
    if (showingDataInfo) return;

    // The tour's own Escape-to-skip, rather than falling through to
    // deselect-the-part below — `.shell` is `inert` while it's open (see
    // the markup), so nothing there could hold focus for Escape to reach
    // anyway.
    if (tourActive) {
      if (event.key === "Escape") endTour();
      return;
    }

    // `ExportProgressModal`'s own inertness stops pointer interaction, but a
    // window-level keydown listener isn't scoped to it — Escape clearing the
    // export loop's own selection out from under it is exactly the race the
    // modal exists to prevent.
    if (exportingPdf) return;

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

<!-- `inert` while the tour is open: it's the simplest way to make the whole
     app un-clickable and un-tabbable behind the overlay at once, matching
     the "purely observational" MVP — no separate full-viewport click
     shield needed in TourOverlay itself. -->
<div class="shell" inert={tourActive}>
  {#if store.showingExample}
    <DemoBanner />
  {/if}

  <main class="app">
    <header class="header">
      <div class="brand">
        <img
          class="mark"
          src="{logoBase}logo-96.png"
          srcset="{logoBase}logo-96.png 1x, {logoBase}logo-192.png 2x"
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
        onExport={handleExport}
        onExportPdf={handleExportPdf}
        onBackUp={handleBackUp}
        onRestore={handleRestore}
        onStartFresh={() => (startingFresh = true)}
        onStartTour={startTour}
        exporting={exportingPdf}
      />
    </div>

    {#if fileNotice}
      <p class="file-notice" class:bad={fileNotice.tone === "bad"} role="status">
        {fileNotice.text}
      </p>
    {/if}

    <hr class="rule" />

    <section class="workspace" bind:this={workspaceEl}>
      <div class="canvas">
        <Diagram
          bind:element={diagramSvg}
          parts={store.parts}
          connections={store.connections}
          selectedPartId={store.selectedPartId}
          onselect={(id) => store.select(id)}
          onclear={() => store.clearSelection()}
          onmove={(id, point) => store.movePart(id, point)}
          ontoggleactive={(id) => store.toggleActive(id)}
          onconnectcreate={(sourceId, targetId) =>
            store.addConnection(sourceId, targetId)}
          selectedConnectionId={store.selectedConnectionId}
          onconnectselect={(id) => store.selectConnection(id)}
          onconnectlabel={(id, label) => store.setConnectionLabel(id, label)}
          onconnectdelete={(id) => store.deleteConnection(id)}
          onconnectclose={() => store.clearConnectionSelection()}
          activeFilter={store.activeFilter}
          activeOnlyFilter={store.activeOnlyFilter}
          tagFilter={store.tagFilter}
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
          onfeelings={(id, feelings) => store.setFeelings(id, feelings)}
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
        activeOnlyFilter={store.activeOnlyFilter}
        onToggleActiveOnly={() => store.toggleActiveOnlyFilter()}
        tagFilter={store.tagFilter}
        onTagFilterChange={(tags) => store.setTagFilter(tags)}
      />
      <!-- Balances `.footer-note`'s width so `Legend` stays centered, the
           same job the old empty spacer did — but the classic bottom-right
           spot for exactly this kind of link means it earns its keep rather
           than sitting there as dead weight. -->
      <p class="footer-data">
        <button type="button" onclick={() => (showingDataInfo = true)}>
          About your data
        </button>
      </p>
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
      parts={store.parts}
      oncancel={() => store.stopEditing()}
      onsubmit={(draft) => {
        const target = store.editing;
        if (target?.kind === "existing") store.updatePart(target.id, draft);
        else store.addPart(draft);
      }}
    />
  {/key}
{/if}

{#if exportProgress}
  <ExportProgressModal current={exportProgress.current} total={exportProgress.total} />
{/if}

{#if tourActive}
  <TourOverlay
    stepIndex={tourStepIndex}
    onNext={tourNext}
    onBack={tourBack}
    onClose={endTour}
    onShowDataInfo={() => (showingDataInfo = true)}
  />
{/if}

{#if showingDataInfo}
  <DataStorageModal onclose={() => (showingDataInfo = false)} />
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
    /* The detail panel's/modal's surface, a step above the darkest background
       stop — also the Legend popovers' surface. */
    --surface-raised: #12141f;
    --font-display: "Cormorant Garamond", Georgia, "Times New Roman", serif;
    --font-ui: "Manrope", ui-sans-serif, system-ui, -apple-system, sans-serif;
    /* Mirrors `theme.ts`'s `TYPE_SCALE.bodyText` — kept in sync by hand, the
       same as every other token above. This is the size for prose someone
       reads (a dialog's explanation, a screen's intro copy), not compact
       chrome — any new dialog or screen should reach for these two rather
       than picking its own body size. */
    --body-text-size: 14px;
    --body-text-line-height: 1.5;
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

  /* Every button in this app is a control, never a place to read or copy
     text from, so a click-drag over one should move the thing it triggers
     (a drag on the canvas, a text selection elsewhere) rather than select
     its own label. */
  :global(button) {
    user-select: none;
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
  .footer-data {
    flex: 1 1 0;
    margin: 0;
  }

  .footer-note {
    color: var(--text-footer);
    font-family: var(--font-display);
    font-size: 20px;
    font-style: italic;
  }

  .footer-data {
    text-align: right;
  }

  .footer-data button {
    padding: 0;
    border: none;
    background: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
    transition: color 160ms ease;
  }

  .footer-data button:hover {
    color: var(--text-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .footer-data button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  @media (max-width: 720px) {
    .footer {
      flex-direction: column;
      align-items: stretch;
    }

    .footer-data {
      text-align: center;
    }
  }
</style>
