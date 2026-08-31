<script lang="ts">
  import { cubicOut } from "svelte/easing";
  import type { TransitionConfig } from "svelte/transition";
  import { ROLES } from "../theme";
  import { SELF_ID } from "../types";
  import type { Connection, EndpointId, Part } from "../types";

  interface Props {
    part: Part;
    /** Every connection touching this part, in either direction. */
    connections: readonly Connection[];
    /** The rest of the map, for naming a connection's other endpoint. */
    parts: readonly Part[];
    onclose: () => void;
    onedit: (id: string) => void;
    ondelete: (id: string) => void;
  }

  const { part, connections, parts, onclose, onedit, ondelete }: Props =
    $props();

  const accent = $derived(ROLES[part.role].accent);

  /**
   * The worksheet's long-form fields, in the order an IFS worksheet asks them.
   * Empty ones still render — what a part hasn't answered yet is part of the
   * picture, and hiding the row would make the worksheet look complete.
   */
  const fields = $derived([
    { label: "Description", value: part.description },
    { label: "Body location", value: part.bodyLocation },
    { label: "Trigger", value: part.trigger },
    { label: "Positive intention", value: part.positiveIntention },
    { label: "Fears", value: part.fears },
    { label: "Origins", value: part.origins },
    { label: "Notes", value: part.notes },
  ]);

  const nameFor = (id: EndpointId): string =>
    id === SELF_ID
      ? "Self"
      : (parts.find((candidate) => candidate.id === id)?.name ?? "Unknown");

  const relations = $derived(
    connections.map((connection) => ({
      id: connection.id,
      label: connection.label,
      outgoing: connection.sourceId === part.id,
      other: nameFor(
        connection.sourceId === part.id
          ? connection.targetId
          : connection.sourceId,
      ),
    })),
  );

  /**
   * Open and close by growing the panel's own axis, rather than sliding an
   * already-full-size panel into place.
   *
   * Animating the size is what keeps the diagram still: the canvas is this
   * element's flex sibling, so as the panel grows the SVG rescales smoothly
   * through its own `preserveAspectRatio` instead of snapping to a new width
   * the instant the panel mounts. The map jumping was the jarring half.
   *
   * The translate is a small settle on top of that, and the fade stops the
   * text arriving before there is room for it.
   */
  function reveal(node: HTMLElement): TransitionConfig {
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Matches the stylesheet's breakpoint: a sidebar grows sideways, a panel
    // docked underneath grows upward.
    const sideways = matchMedia("(min-width: 901px)").matches;
    const extent = sideways ? node.offsetWidth : node.offsetHeight;

    return {
      duration: reduceMotion ? 0 : 260,
      easing: cubicOut,
      css: (t, u) =>
        sideways
          ? `width: ${t * extent}px; opacity: ${t}; transform: translateX(${u * 18}px);`
          : `height: ${t * extent}px; opacity: ${t}; transform: translateY(${u * 14}px);`,
    };
  }

  /**
   * Delete is a two-step press rather than a native `confirm()`. The data here
   * is somebody's account of their own mind and there is no undo yet, so a
   * single stray click should not be able to destroy a part — but a blocking
   * browser dialog is a heavier interruption than this warrants.
   */
  let confirmingDelete = $state(false);

  function handleDelete(): void {
    if (!confirmingDelete) {
      confirmingDelete = true;
      return;
    }
    ondelete(part.id);
  }

  // Any change of part resets the pending confirmation, so a second part never
  // inherits the first one's armed Delete button.
  $effect(() => {
    part.id;
    confirmingDelete = false;
  });
</script>

<aside class="panel" aria-label="Part details" transition:reveal>
  <div class="inner">
    <header class="head">
      <div>
        <p class="meta" style:color={accent}>
          {part.role.toUpperCase()} · {part.status.toUpperCase()}
        </p>
        <h2 class="name">{part.name}</h2>
      </div>
      <button class="close" type="button" onclick={onclose} aria-label="Close">
        &times;
      </button>
    </header>

    {#if part.feelings.length > 0}
      <ul class="feelings">
        {#each part.feelings as feeling (feeling)}
          <li class="feeling" style:border-color={accent} style:color={accent}>
            {feeling}
          </li>
        {/each}
      </ul>
    {/if}

    <dl class="fields">
      {#each fields as field (field.label)}
        <dt>{field.label}</dt>
        <dd class:empty={field.value.trim() === ""}>
          {field.value.trim() === "" ? "Not recorded yet" : field.value}
        </dd>
      {/each}
    </dl>

    <section class="relations">
      <h3 class="section-title">Connections</h3>
      {#if relations.length === 0}
        <p class="empty">No connections yet.</p>
      {:else}
        <ul class="relation-list">
          {#each relations as relation (relation.id)}
            <li class="relation">
              <span class="relation-label" class:empty={relation.label === ""}>
                {relation.label === "" ? "Unlabelled" : relation.label}
              </span>
              <span class="arrow" aria-hidden="true">
                {relation.outgoing ? "→" : "←"}
              </span>
              <span class="relation-other">{relation.other}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <footer class="actions">
      <button class="primary" type="button" onclick={() => onedit(part.id)}>
        Edit
      </button>
      <button
        class="danger"
        class:armed={confirmingDelete}
        type="button"
        onclick={handleDelete}
      >
        {confirmingDelete ? "Confirm delete" : "Delete part"}
      </button>
      {#if confirmingDelete}
        <button
          class="quiet"
          type="button"
          onclick={() => (confirmingDelete = false)}
        >
          Cancel
        </button>
      {/if}
    </footer>
  </div>
</aside>

<style>
  /*
   * DERIVED: the original design has no detail panel, so none of this is
   * inherited. The surface is a step above the darkest background stop (#0B0C12)
   * and below its mid stop (#171A28), which keeps the panel legible against
   * the canvas without introducing a colour the palette doesn't already use.
   */
  .panel {
    display: flex;
    width: 22rem;
    flex-shrink: 0;
    /* Clips the inner wrapper while the panel is still growing — without it
       the content spills over the canvas for the length of the transition. */
    overflow: hidden;
    border-left: 1px solid var(--rule);
    background: #12141f;
    color: var(--text-primary);
  }

  /*
   * Holds the content at full size throughout, so the copy is revealed rather
   * than reflowed. Text rewrapping mid-animation is the part that reads cheap.
   */
  .inner {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 22rem;
    flex-shrink: 0;
    box-sizing: border-box;
    padding: 1.5rem;
    overflow-y: auto;
  }

  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .meta {
    margin: 0 0 0.375rem;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 1.5px;
  }

  .name {
    margin: 0;
    font-family: var(--font-display);
    font-size: 28px;
    font-style: italic;
    font-weight: 500;
    line-height: 1.1;
  }

  .close {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: 1px solid var(--pill-border);
    border-radius: 50%;
    background: none;
    color: var(--text-muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }

  .close:hover {
    color: var(--text-bright);
  }

  .feelings {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .feeling {
    padding: 0.25rem 0.625rem;
    border: 1px solid;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    opacity: 0.9;
  }

  .fields {
    margin: 0;
  }

  .fields dt {
    margin-bottom: 0.25rem;
    color: var(--text-eyebrow);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  .fields dd {
    margin: 0 0 1.125rem;
    font-size: 14px;
    line-height: 1.5;
  }

  .fields dd:last-child {
    margin-bottom: 0;
  }

  .section-title {
    margin: 0 0 0.75rem;
    color: var(--text-eyebrow);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  .empty {
    color: var(--text-muted);
    font-style: italic;
  }

  .relations {
    padding-top: 1.25rem;
    border-top: 1px solid var(--rule);
  }

  .relations p {
    margin: 0;
    font-size: 14px;
  }

  .relation-list {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .relation {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 14px;
  }

  .relation-label {
    color: var(--text-bright);
  }

  .arrow {
    color: var(--text-muted);
  }

  .relation-other {
    color: var(--text-muted);
  }

  .actions {
    display: flex;
    gap: 0.625rem;
    margin-top: auto;
    padding-top: 1.25rem;
    border-top: 1px solid var(--rule);
  }

  .actions button {
    padding: 0.5rem 0.9375rem;
    border-radius: 19px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .primary {
    border: 1.3px solid var(--button-border);
    background: none;
    color: var(--text-bright);
  }

  .primary:hover {
    border-color: var(--text-muted);
    color: var(--text-primary);
  }

  .danger {
    border: 1px solid var(--pill-border);
    background: none;
    color: var(--text-muted);
    margin-left: auto;
  }

  .danger:hover,
  .danger.armed {
    border-color: #c1876e;
    color: #e38f6b;
  }

  .quiet {
    border: 1px solid transparent;
    background: none;
    color: var(--text-muted);
  }

  .quiet:hover {
    color: var(--text-bright);
  }

  .inner :global(button:focus-visible),
  .close:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  /* Below the breakpoint the panel stops being a sidebar and sits under the
     diagram, so a narrow window doesn't squeeze the map to nothing. */
  @media (max-width: 900px) {
    .panel {
      width: auto;
      max-height: 45vh;
      border-left: none;
      border-top: 1px solid var(--rule);
    }

    .inner {
      width: 100%;
    }
  }
</style>
