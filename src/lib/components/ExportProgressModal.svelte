<script lang="ts">
  /**
   * A click shield while `pdfExport.ts` drives the real selection through
   * every part in turn.
   *
   * `showModal` rather than an `open` attribute, matching `StartFreshModal`
   * and `PartModal`: it makes the rest of the page inert for free, which is
   * what stops a click landing on the diagram or panel mid-export and racing
   * the export loop's own `store.select` calls.
   */
  interface Props {
    current: number;
    total: number;
  }

  const { current, total }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    dialog?.showModal();
  });

  /**
   * There is nothing to cancel back to yet — closing this on Escape would
   * drop the shield while the export loop is still mid-flight underneath,
   * which is the exact interaction this exists to prevent.
   */
  function handleCancel(event: Event): void {
    event.preventDefault();
  }
</script>

<dialog bind:this={dialog} oncancel={handleCancel} aria-label="Exporting PDF">
  <div class="content" role="status" aria-live="polite">
    <div class="spinner" aria-hidden="true"></div>
    <p class="text">Exporting part {current} of {total}…</p>
  </div>
</dialog>

<style>
  dialog {
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

  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2.25rem 2.75rem;
  }

  .spinner {
    width: 26px;
    height: 26px;
    border: 3px solid var(--pill-border);
    border-top-color: var(--focus-ring);
    border-radius: 50%;
    animation: spin 800ms linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .text {
    margin: 0;
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 600;
  }
</style>
