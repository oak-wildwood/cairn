<script lang="ts">
  /**
   * A transient message floated over the bottom-left of the canvas (it
   * positions against the nearest positioned ancestor), so reporting
   * what a file action did costs the layout no space. A failure uses
   * `role="alert"` so it is announced at once; a success is a polite status.
   */
  interface Props {
    tone: "ok" | "bad";
    text: string;
    ondismiss: () => void;
  }

  const { tone, text, ondismiss }: Props = $props();
</script>

<div class="toast" class:bad={tone === "bad"} role={tone === "bad" ? "alert" : "status"}>
  <span class="text">{text}</span>
  <button type="button" class="close" aria-label="Dismiss message" onclick={ondismiss}>
    ×
  </button>
</div>

<style>
  /* DERIVED: the surface is the raised-panel token, the failure tint reuses
     the colour the inline notice already used. Nothing in the original design
     covered transient messages. */
  .toast {
    position: absolute;
    left: 1rem;
    bottom: 1rem;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: min(32rem, calc(100% - 2rem));
    padding: 0.625rem 0.875rem 0.625rem 1.125rem;
    border: 1px solid var(--pill-border);
    border-radius: 12px;
    background: var(--surface-raised);
    color: var(--text-primary);
    font-size: 13px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  }

  .toast.bad {
    border-color: #e38f6b;
    color: #e38f6b;
  }

  .close {
    flex-shrink: 0;
    padding: 0 0.25rem;
    border: none;
    background: none;
    color: inherit;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }

  .close:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
