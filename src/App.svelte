<script lang="ts">
  import DemoBanner from "./lib/components/DemoBanner.svelte";
  import Diagram from "./lib/components/Diagram.svelte";
  import Legend from "./lib/components/Legend.svelte";
  import Toolbar from "./lib/components/Toolbar.svelte";
  import { EXAMPLE_CONNECTIONS, EXAMPLE_PARTS } from "./lib/exampleData";

  /**
   * Milestone 1: a static render of the Nocturnal comp. The example data is
   * still hardcoded here — Milestone 2 moves it into `store.svelte.ts` and this
   * component starts reading from the store instead.
   */
  const parts = EXAMPLE_PARTS;
  const connections = EXAMPLE_CONNECTIONS;

  const activeCount = $derived(
    parts.filter((part) => part.status.trim().toLowerCase() === "active").length,
  );
</script>

<div class="shell">
  <DemoBanner />

  <main class="app">
    <header class="header">
      <div class="brand">
        <img
          class="mark"
          src="/logo-96.png"
          srcset="/logo-96.png 1x, /logo-192.png 2x"
          alt="Cairn"
          width="44"
          height="44"
        />
        <div>
          <p class="eyebrow">YOUR INNER LANDSCAPE</p>
          <h1 class="title">System Map</h1>
        </div>
      </div>
      <div class="counts">
        <p class="count">{parts.length} parts</p>
        <p class="count-meta">{activeCount} active this week</p>
      </div>
    </header>

    <hr class="rule" />

    <Toolbar />

    <hr class="rule" />

    <section class="canvas">
      <Diagram {parts} {connections} />
    </section>

    <hr class="rule" />

    <footer class="footer">
      <p class="footer-note">Mark the way through.</p>
      <Legend {parts} />
      <div class="footer-spacer" aria-hidden="true"></div>
    </footer>
  </main>
</div>

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

  /**
   * The app's only product identity in-page — the comp has no logo, so this is
   * a deliberate addition beside its header rather than a change to it. The
   * mark carries the name for screen readers via its alt text, which is why no
   * visible "Cairn" wordmark is needed next to it.
   */
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

  .eyebrow {
    margin: 0 0 0.5rem;
    color: var(--text-eyebrow);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 3px;
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

  .canvas {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
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
    font-size: 16px;
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
