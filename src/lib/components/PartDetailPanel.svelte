<script lang="ts">
  import { tick, untrack } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, type TransitionConfig } from "svelte/transition";
  import FeelingsMultiSelect from "./FeelingsMultiSelect.svelte";
  import { feelingCounts } from "../feelings";
  import { partCaption } from "../layout";
  import { reducedMotion, sheet } from "../phone.svelte";
  import type { Snippet } from "svelte";
  import { ACTIVE_TOGGLE, ROLES } from "../theme";
  import ActiveBadge from "./ActiveBadge.svelte";
  import { SELF_ID } from "../types";
  import type { Connection, EndpointId, Part } from "../types";

  interface Props {
    part: Part;
    /** Every connection touching this part, in either direction. */
    connections: readonly Connection[];
    /** The rest of the map, for naming a connection's other endpoint and for
     * the feelings vocabulary `FeelingsMultiSelect` suggests from. */
    parts: readonly Part[];
    onclose: () => void;
    onedit: (id: string) => void;
    ondelete: (id: string) => void;
    /** Quick-edits this part's feelings, bypassing the edit modal. */
    onfeelings: (id: string, feelings: string[]) => void;
    /** Flips whether this part is active this week, bypassing the edit modal. */
    ontoggleactive: (id: string) => void;
    /** The app's logo and wordmark, for the "Back to map" bar that an
     * expanded phone sheet leaves showing above it. */
    brand: Snippet;
  }

  let {
    part,
    connections,
    parts,
    onclose,
    onedit,
    ondelete,
    onfeelings,
    ontoggleactive,
    brand,
  }: Props = $props();

  const accent = $derived(ROLES[part.role].accent);
  const nodeFill = $derived(ROLES[part.role].nodeFill);

  /** The pill under the name already says whether the part is active, so the
   * caption above it leaves that out rather than saying it twice. */
  const caption = $derived(partCaption({ ...part, active: false }));

  const tagCounts = $derived(feelingCounts(parts));

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
    // An expanded sheet is the whole screen; shrinking it from the top down
    // on close would read as the map being wiped in rather than the panel
    // going away, so it just goes.
    const reduceMotion = reducedMotion.matches || floating;
    // Matches the stylesheet's breakpoints: a sidebar (on a desktop, or a
    // landscape phone) grows sideways, a panel docked underneath grows upward.
    const sideways = matchMedia(
      "(min-width: 901px), (max-height: 560px) and (orientation: landscape)",
    ).matches;
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

  /**
   * Feelings default to a plain readonly tag list; clicking the small "Edit"
   * (or "Add feelings") link swaps it for `FeelingsMultiSelect`, which closes
   * itself back to readonly on Done, Escape, or an outside click via
   * `onClose`.
   */
  let editingFeelings = $state(false);

  /**
   * Selecting a different part resets the pending confirmation and drops
   * back to the readonly feelings view, so a second part never inherits the
   * first one's armed Delete button or open quick editor. Keyed against a
   * remembered id rather than just reading `part.id` — `setFeelings` in the
   * store rebuilds `part` as a new object on every edit (same id, new
   * reference), and reading `part.id` alone would rerun this on every
   * keystroke of editing, collapsing the quick editor the instant it wrote
   * through.
   */
  let lastPartId = $state(untrack(() => part.id));

  /**
   * The panel is one element across part changes, so without this the next
   * part opens scrolled to wherever the last one was left — on a phone, with
   * its header above the fold.
   */
  let scrollEl = $state<HTMLElement | null>(null);

  /**
   * The portrait-phone bottom sheet. Docked, it sits under the map in the
   * page's flow like the tablet layout's panel. Scrolling it up expands it:
   * it becomes `position: fixed` at exactly where it was docked, then its top
   * edge travels up to just under the "Back to map" bar, covering the map,
   * the header and the footer. Collapsing runs the same move in reverse and
   * drops it back into the flow once it has landed.
   *
   * The sides travel the same way: they start at the page's padding and
   * widen to the screen's edges, while `--sheet-inset` pads the content in by
   * exactly as much over the same curve. So the surface grows to full width
   * and everything on it, Edit and Delete included, stays where it was.
   *
   * While it is fixed, `spacerEl` holds its docked place in the page, so the
   * canvas doesn't grow into the gap behind it — and so there is somewhere
   * to measure the way back to, even if the page scrolled in the meantime.
   */
  type SheetMode = "docked" | "expanded" | "collapsing";
  let sheetMode = $state<SheetMode>("docked");
  const floating = $derived(sheetMode !== "docked");
  /** The fixed sheet's `top`/`bottom`/`left`/`right`; null while docked. */
  let edges = $state<{ top: string; bottom: string; left: string; right: string } | null>(
    null,
  );
  let sheetInset = $state("0px");
  let dockedHeight = $state(0);
  let panelEl = $state<HTMLElement | null>(null);
  let spacerEl = $state<HTMLElement | null>(null);

  function edgesOf(rect: DOMRect): NonNullable<typeof edges> {
    return {
      top: `${rect.top}px`,
      bottom: `${innerHeight - rect.bottom}px`,
      left: `${rect.left}px`,
      right: `${innerWidth - rect.right}px`,
    };
  }

  async function expand(): Promise<void> {
    if (floating || !sheet.matches || !panelEl) return;
    const rect = panelEl.getBoundingClientRect();
    dockedHeight = rect.height;
    edges = edgesOf(rect);
    sheetMode = "expanded";
    await tick();
    // Commits the docked position as the starting point, so the change below
    // transitions rather than landing in the same style recalculation.
    void panelEl?.offsetHeight;
    edges = { top: "var(--sheet-bar-height)", bottom: "0px", left: "0px", right: "0px" };
    sheetInset = `${rect.left}px`;
  }

  function collapse(): void {
    if (sheetMode !== "expanded") return;
    if (spacerEl) edges = edgesOf(spacerEl.getBoundingClientRect());
    sheetInset = "0px";
    sheetMode = "collapsing";
    if (reducedMotion.matches) dock();
  }

  function dock(): void {
    sheetMode = "docked";
    edges = null;
    sheetInset = "0px";
  }

  function handleTransitionEnd(event: TransitionEvent): void {
    if (event.target !== panelEl || event.propertyName !== "top") return;
    if (sheetMode === "collapsing") dock();
  }

  // Rotating to landscape turns the sheet back into a sidebar, which has
  // nothing to expand into.
  $effect(() => {
    if (!sheet.matches && floating) dock();
  });

  /**
   * A drag up anywhere on the docked sheet expands it; a drag down on the
   * expanded one collapses it, but only when the gesture began with its
   * content already scrolled to the top — otherwise scrolling back up
   * through a long worksheet would throw the user out of it at the end.
   */
  const DRAG_THRESHOLD = 12;
  const PULL_DOWN_THRESHOLD = 64;
  let touchStartY: number | null = null;
  let startedAtTop = false;

  /**
   * Overlays opened from inside the panel — the feelings popover, its
   * clear-confirm dialog — are in its DOM though drawn above it, so their
   * gestures bubble here. Scrolling one is not a gesture at the sheet.
   */
  function inOverlay(event: Event): boolean {
    return (
      event.target instanceof Element &&
      event.target.closest('dialog, [role="dialog"]') !== null
    );
  }

  function handleTouchStart(event: TouchEvent): void {
    if (inOverlay(event)) {
      touchStartY = null;
      return;
    }
    touchStartY = event.touches[0]?.clientY ?? null;
    startedAtTop = (scrollEl?.scrollTop ?? 0) <= 0;
  }

  function handleTouchMove(event: TouchEvent): void {
    const y = event.touches[0]?.clientY;
    if (touchStartY === null || y === undefined) return;
    const dy = y - touchStartY;
    if (sheetMode === "docked" && dy < -DRAG_THRESHOLD) {
      touchStartY = null;
      void expand();
    } else if (sheetMode === "expanded" && startedAtTop && dy > PULL_DOWN_THRESHOLD) {
      touchStartY = null;
      collapse();
    }
  }

  function handleWheel(event: WheelEvent): void {
    if (inOverlay(event)) return;
    if (event.deltaY > 0) void expand();
  }

  // Catches what the two above don't, such as keyboard scrolling.
  function handleScroll(): void {
    if ((scrollEl?.scrollTop ?? 0) > 0) void expand();
  }

  $effect(() => {
    if (part.id === lastPartId) return;
    lastPartId = part.id;
    confirmingDelete = false;
    editingFeelings = false;
    if (scrollEl) scrollEl.scrollTop = 0;
  });
</script>

{#if floating}
  <div class="spacer" style:height="{dockedHeight}px" bind:this={spacerEl}></div>
{/if}

{#if sheetMode === "expanded"}
  <!-- Everything the expanded sheet leaves showing: enough to say which app
       this is, and the way back. -->
  <div class="sheet-bar" transition:fade={{ duration: 200 }}>
    {@render brand()}
    <button type="button" class="sheet-back" onclick={collapse}>Back to map</button>
  </div>
{/if}

<aside
  class="panel"
  class:sheet={floating}
  aria-label="Part details"
  data-tour="detail-panel"
  style:top={edges?.top}
  style:bottom={edges?.bottom}
  style:left={edges?.left}
  style:right={edges?.right}
  style:--sheet-inset={sheetInset}
  bind:this={panelEl}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  onwheel={handleWheel}
  ontransitionend={handleTransitionEnd}
  transition:reveal
>
  <div class="inner">
    <div class="scroll" bind:this={scrollEl} onscroll={handleScroll}>
      <header class="head">
        <div class="title">
          <p class="meta" style:color={accent}>
            {caption.toUpperCase()}
          </p>
          <h2 class="name">{part.name}</h2>
          <!-- The map's own active badge, as a labelled pill: same filled
               circle and check when active, same empty ring when not. -->
          <button
            type="button"
            class="active-toggle"
            class:on={part.active}
            style:--accent={accent}
            aria-pressed={part.active}
            onclick={() => ontoggleactive(part.id)}
          >
            <svg
              width={ACTIVE_TOGGLE.radius * 2 + 2}
              height={ACTIVE_TOGGLE.radius * 2 + 2}
              viewBox="{-ACTIVE_TOGGLE.radius - 1} {-ACTIVE_TOGGLE.radius - 1} {ACTIVE_TOGGLE.radius * 2 + 2} {ACTIVE_TOGGLE.radius * 2 + 2}"
              aria-hidden="true"
            >
              <ActiveBadge active={part.active} {accent} {nodeFill} />
            </svg>
            Active this week
          </button>
        </div>
        <!-- data-export-hide: read by both export.ts and pdfExport.ts, which
             hide every element carrying it before screenshotting this panel —
             a live control has no click handler on a saved image or a printed
             page. -->
        <button
          class="close"
          type="button"
          onclick={onclose}
          aria-label="Close"
          data-export-hide
        >
          &times;
        </button>
      </header>

      {#if editingFeelings}
        <!-- data-export-hide: the quick editor is a live control, and both the
             PDF and PNG exports always see the panel in its default (closed)
             state anyway. -->
        <div data-export-hide>
          <FeelingsMultiSelect
            tagCounts={tagCounts}
            selected={part.feelings}
            onChange={(feelings) => onfeelings(part.id, feelings)}
            onClose={() => (editingFeelings = false)}
            allowCreate
            confirmClear
            autoOpen
            label="Add feelings"
            eyebrow="Feelings"
            dropDirection="down"
          />
        </div>
      {:else}
        <div class="feelings-row" data-tour="detail-feelings">
          {#if part.feelings.length > 0}
            <ul class="feelings">
              {#each part.feelings as feeling (feeling)}
                <li class="feeling" style:border-color={accent} style:color={accent}>
                  {feeling}
                </li>
              {/each}
            </ul>
          {/if}
          <!-- data-export-hide: a live control, same as the close button. -->
          <button
            type="button"
            class="edit-feelings"
            class:cta={part.feelings.length === 0}
            style:color={part.feelings.length === 0 ? accent : undefined}
            data-export-hide
            onclick={() => (editingFeelings = true)}
          >
            {part.feelings.length > 0 ? "Edit" : "+ feelings"}
          </button>
        </div>
      {/if}

      <dl class="fields" data-tour="detail-fields">
        {#each fields as field (field.label)}
          <dt>{field.label}</dt>
          <dd class:empty={field.value.trim() === ""}>
            {field.value.trim() === "" ? "Not recorded yet" : field.value}
          </dd>
        {/each}
      </dl>

      <section class="relations" data-tour="detail-connections">
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
    </div>

    <!-- data-export-hide: see the close button above. -->
    <footer class="actions" data-export-hide>
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
    width: 22rem;
    flex-shrink: 0;
    box-sizing: border-box;
    min-height: 0;
  }

  /*
   * DERIVED: the original design has no detail panel, so it never had to say
   * what happens once a worksheet's fields outgrow the space for them. Edit
   * and Delete are the two controls a part's own page can't be read without,
   * so `.scroll` carries the overflow alone and `.actions` sits outside it —
   * a long worksheet scrolls under a footer that never moves, rather than
   * carrying the controls out of view with it.
   */
  .scroll {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    flex: 1 1 auto;
    min-height: 0;
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

  /*
   * Fills the header row rather than shrink-wrapping the name. On screen the
   * two are indistinguishable — the caption and the name are left-aligned
   * either way, and `space-between` pins the close button to the right edge
   * either way — but a shrink-wrapped box is exactly as wide as the name's
   * own text, with no slack at all, and that is what breaks the exports.
   *
   * `export.ts` and `pdfExport.ts` both screenshot this panel through
   * `html-to-image`, which copies every element's *resolved* computed style
   * onto its clone — so a shrink-wrapped box arrives frozen at the `width`
   * and `height` the live title happened to measure. Render the name a hair
   * wider in that clone than it was live and it wraps to a second line inside
   * a box still one line tall, and, because the frozen height cannot grow,
   * that line lands on top of the feelings pills instead of pushing them
   * down. A hair wider is not hypothetical: the title is set in Cormorant
   * Garamond, and any capture that falls back to the wider Georgia (see
   * `pdfExport.ts` on why the font embed has to run after the panel mounts)
   * renders it well past a zero-slack box. Filling the row gives the name the
   * panel's whole width instead, which no fallback for a name that fits on
   * screen comes close to overflowing — and it does not change where a name
   * wraps live, since a shrink-wrapped box was already capped at that width.
   */
  .title {
    flex-grow: 1;
  }

  /*
   * DERIVED: the original design has no detail panel. The pill borrows the
   * feeling pills' shape and the part's role accent; off, it drops to the
   * muted grey and pill border every other inactive control here uses, so
   * the two states differ in more than the badge alone.
   */
  .active-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.4375rem;
    margin-top: 0.75rem;
    padding: 0.3125rem 0.75rem 0.3125rem 0.5rem;
    border: 1px solid var(--pill-border);
    border-radius: 999px;
    background: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition:
      color 160ms ease,
      border-color 160ms ease;
  }

  .active-toggle svg {
    display: block;
  }

  .active-toggle:hover {
    color: var(--text-bright);
  }

  .active-toggle.on {
    border-color: var(--accent);
    color: var(--accent);
  }

  .active-toggle.on:hover {
    opacity: 0.85;
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
    /*
     * DERIVED: the original design's titles were always short enough to sit
     * on one line, so it never had to say how a wrapped one should look.
     * `balance` splits a two-line name evenly instead of leaving a lone
     * orphan word on the second line (e.g. "Andy the" / "Avoider") if a
     * longer real name ever does wrap here, in the live panel or in the PDF
     * export's widened one.
     */
    text-wrap: balance;
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

  .feelings-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  /*
   * `display: contents` rather than `display: flex`: a flex `<ul>` sizes
   * itself to exactly its pills' combined width (shrink-to-fit), and
   * `pdfExport.ts`'s capture freezes that width as a literal pixel value on
   * a clone it then re-rasterises. With zero slack between the frozen width
   * and the frozen pills' own frozen widths, the sub-pixel rounding that
   * survives that round trip is occasionally enough to tip the last pill
   * onto a second row inside a box sized for one — which, because the box's
   * own height was *also* frozen from the single-row live layout, lands the
   * overflow line on top of whatever sits below it. `display: contents`
   * removes the `<ul>` as a sizing box entirely, so its pills wrap against
   * `.feelings-row`'s width instead — which has real slack (see `.title`
   * above for the same fix against the same class of bug, for the name).
   * The list semantics survive on the `<li>` elements themselves.
   */
  .feelings {
    display: contents;
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

  .edit-feelings {
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition:
      color 160ms ease,
      opacity 160ms ease;
  }

  .edit-feelings:hover {
    color: var(--text-bright);
  }

  /*
   * DERIVED: no feelings recorded yet is the one point in this panel meant
   * to prompt an action rather than just report one, so it borrows the
   * part's own role accent (already used for its meta caption and its
   * feeling tags) instead of the muted grey every other inline control
   * uses — a colour the panel already has a reason to show, not an
   * invented one. The pill shape matches `.feeling` right next to it, so an
   * empty part reads as "one pill waiting to be filled" rather than a
   * stray line of text.
   */
  .edit-feelings.cta {
    padding: 0.25rem 0.625rem;
    border: 1px solid currentColor;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
  }

  .edit-feelings.cta:hover {
    opacity: 0.8;
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

  /*
   * The direction and the part on the other end keep their size; the label is
   * the only one of the three that gives.
   *
   * All three are flex items in one row, and flex hands a shortfall out in
   * proportion to how wide each item wants to be — so a label long enough to
   * overflow the row takes the arrow and the name down with it, and a name as
   * short as "The Kid" gets squeezed under its own one-line width and breaks
   * into "The" / "Kid" alongside a label that is already wrapping. Which rows
   * in a panel break is not obvious from looking at the panel as a whole: it
   * turns on each row's own label and its own name, so one connection can
   * read cleanly while the next one staggers. A label is free text and reads fine
   * wrapped; a part's name is the thing being named and does not, so the
   * whole shortfall belongs to the label, which stops at its longest word.
   *
   * `white-space: nowrap` is the export's share of the same problem. With
   * nothing left to shrink it, the name's box ends up exactly as wide as its
   * own text, and `export.ts` and `pdfExport.ts` freeze that width onto the
   * clone they screenshot — the trap `.title` above is written up for. Let
   * the clone render the name a hair wider than it measured, as it does
   * whenever the web font embed falls back, and it would break in two in the
   * picture and nowhere else. Overrunning its box by a pixel is the better
   * failure of the two.
   */
  .arrow {
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .relation-other {
    flex-shrink: 0;
    white-space: nowrap;
    color: var(--text-muted);
  }

  .actions {
    display: flex;
    flex-shrink: 0;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem 1.5rem;
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

  .spacer {
    flex-shrink: 0;
  }

  /*
   * DERIVED: the original design has no phone layout. The bar is the page
   * background, so the sheet below it reads as the raised surface.
   */
  .sheet-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--sheet-bar-height);
    padding: 0 1rem;
    box-sizing: border-box;
    border-bottom: 1px solid var(--rule);
    background: var(--surface-page);
    color: var(--text-primary);
    /* Nothing behind it should scroll while the sheet covers the page. */
    touch-action: none;
  }

  .sheet-back {
    padding: 0.5rem 0;
    border: none;
    background: none;
    color: var(--text-bright);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .sheet-back:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  /*
   * DERIVED: the original design has no phone layout. The expanded sheet
   * keeps the panel's own surface and rule, so it reads as the same panel
   * grown rather than a new screen. The motion is `--sheet-duration` and
   * `--sheet-easing`, shared with `PartModal.svelte`'s phone sheet.
   */
  .panel.sheet {
    position: fixed;
    z-index: 5;
    width: auto;
    max-height: none;
    overscroll-behavior: contain;
    transition-property: top, bottom, left, right;
    transition-duration: var(--sheet-duration);
    transition-timing-function: var(--sheet-easing);
  }

  .panel.sheet .inner {
    padding-inline: var(--sheet-inset);
    transition: padding-inline var(--sheet-duration) var(--sheet-easing);
  }

  .panel.sheet .scroll {
    overscroll-behavior: contain;
  }

  @media (prefers-reduced-motion: reduce) {
    .panel.sheet,
    .panel.sheet .inner {
      transition: none;
    }
  }

  /* A landscape phone: a strip under the map would get a few lines of a
     screen this short, so the panel goes back to being a sidebar, narrower
     than the desktop's so the map keeps most of the width. Same query as
     `App.svelte`'s matching rule, which turns the workspace back into a row. */
  @media (max-height: 560px) and (orientation: landscape) {
    .panel {
      width: min(22rem, 42vw);
      /* No taller than the canvas beside it, which fills the screen —
         beyond that the panel scrolls inside itself as it does on a
         desktop, rather than stretching the canvas to its own length. */
      max-height: calc(100vh - 2rem);
      max-height: calc(100dvh - 2rem);
      border-top: none;
      border-left: 1px solid var(--rule);
    }

    .inner {
      width: min(22rem, 42vw);
    }
  }
</style>
