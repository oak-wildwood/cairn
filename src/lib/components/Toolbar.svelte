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
    /** True while a PDF export is walking every part's selection in turn. */
    exporting?: boolean;
  }

  const {
    onAddPart,
    onExport,
    onExportPdf,
    onBackUp,
    onRestore,
    onStartFresh,
    exporting = false,
  }: Props = $props();
</script>

<div class="toolbar">
  <div class="actions">
    <button
      type="button"
      class="button primary"
      onclick={onAddPart}
      disabled={exporting}
    >
      + Add a part
    </button>
    <button type="button" class="button" onclick={onExport} disabled={exporting}>
      Save image
    </button>
    <button type="button" class="button" onclick={onExportPdf} disabled={exporting}>
      Export PDF
    </button>
    <MapMenu {onBackUp} {onRestore} {onStartFresh} disabled={exporting} />
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.625rem;
  }

  .actions {
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
</style>
