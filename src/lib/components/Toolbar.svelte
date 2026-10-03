<script lang="ts">
  import MapMenu from "./MapMenu.svelte";

  /**
   * "Save image" rather than "Export": the menu beside it also hands back a
   * file, and only one of the two can be loaded again. Someone trying to keep
   * their map safe should not have to guess which. Naming the thing you get —
   * an image, against the menu's "Back up to a file" — is what separates them,
   * and "image" beats "PNG" for an audience who did not come here for file
   * formats.
   *
   * The map-file actions live behind `MapMenu` rather than as buttons of their
   * own — they are infrequent, and three more pills crowded out the primary
   * action.
   */
  interface Props {
    onAddPart?: () => void;
    onExport?: () => void;
    onExportPdf?: () => void;
    onBackUp: () => void;
    onRestore: (file: File) => void;
    onStartFresh: () => void;
    onStartTour: () => void;
    /** True while a PDF export is walking every part's selection in turn. */
    exporting?: boolean;
    /** Leaves out Save image and Export PDF, which are built around the wide
     * desktop layout and give an oddly shaped capture on a phone. */
    hideExport?: boolean;
  }

  const {
    onAddPart,
    onExport,
    onExportPdf,
    onBackUp,
    onRestore,
    onStartFresh,
    onStartTour,
    exporting = false,
    hideExport = false,
  }: Props = $props();
</script>

<div class="toolbar">
  <div class="actions">
    <button
      type="button"
      class="button primary"
      data-tour="add-part"
      onclick={onAddPart}
      disabled={exporting}
    >
      + Add a part
    </button>
    {#if !hideExport}
      <div class="export-group" data-tour="export">
        <button type="button" class="button" onclick={onExport} disabled={exporting}>
          Save image
        </button>
        <button type="button" class="button" onclick={onExportPdf} disabled={exporting}>
          Export PDF
        </button>
      </div>
    {/if}
    <MapMenu {onBackUp} {onRestore} {onStartFresh} {onStartTour} disabled={exporting} />
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.625rem;
  }

  /* Wraps so a narrow screen pushes the last buttons onto a second row
     rather than off the right-hand edge. */
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.625rem;
  }

  /* Groups the two export buttons only so the tour has one element to
     spotlight for both — no visual difference from ungrouped buttons. */
  .export-group {
    display: flex;
    align-items: center;
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
    /* A pill whose label wraps grows taller than its neighbours and reads as
       broken; better the row wrap than the label. */
    white-space: nowrap;
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

  .button:disabled {
    cursor: default;
    opacity: 0.5;
  }

  /* Matches `App.svelte`'s phone breakpoint: tighter pills so all four
     controls usually still share one row at phone width. */
  @media (max-width: 720px), (max-height: 560px) {
    .actions,
    .export-group {
      gap: 0.5rem;
    }

    .button {
      padding: 0 0.875rem;
    }
  }
</style>
