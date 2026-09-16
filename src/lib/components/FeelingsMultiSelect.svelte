<script lang="ts">
  /**
   * A chip trigger + searchable checkbox popover for picking feelings, shared
   * by three call sites that each pointed at the same interaction before this
   * existed: the legend's feeling filter (`Legend.svelte`), the detail
   * panel's quick editor (`PartDetailPanel.svelte`) and the add/edit modal's
   * feelings field (`PartModal.svelte`). Filtering and editing both boil down
   * to "pick some feelings out of the known set", so one control does both —
   * `allowCreate` is the only real difference: the legend can only filter by
   * feelings that already exist, while editing a part's own feelings is how a
   * new one enters that vocabulary in the first place.
   */
  interface Props {
    /** The known feeling vocabulary and how many parts carry each, from
     * `feelingCounts` — not this control's own selection. */
    tagCounts: ReadonlyMap<string, number>;
    /** This control's current selection. */
    selected: readonly string[];
    onChange: (feelings: string[]) => void;
    /** Whether typing a feeling nobody has yet can add it as a new one. Off
     * for the legend's filter — selecting a feeling that doesn't exist
     * anywhere can't filter anything in. */
    allowCreate?: boolean;
    /** Trigger text shown when nothing is selected. */
    label: string;
    /** Popover heading and its accessible name. */
    eyebrow: string;
    searchPlaceholder?: string;
    /** Anchors the popover above the trigger (the legend, pinned near the
     * page bottom) or below it (the panel/modal, which have room underneath). */
    dropDirection?: "up" | "down";
  }

  const {
    tagCounts,
    selected,
    onChange,
    allowCreate = false,
    label,
    eyebrow,
    searchPlaceholder = "Search feelings",
    dropDirection = "down",
  }: Props = $props();

  const hasVocabulary = $derived(tagCounts.size > 0);
  const canOpen = $derived(hasVocabulary || allowCreate);

  const sortedTags = $derived(
    [...tagCounts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    ),
  );

  let search = $state("");

  const filteredTags = $derived.by(() => {
    const query = search.trim().toLowerCase();
    if (query === "") return sortedTags;
    return sortedTags.filter(([tag]) => tag.toLowerCase().includes(query));
  });

  const trimmedSearch = $derived(search.trim());

  const canCreate = $derived(
    allowCreate &&
      trimmedSearch !== "" &&
      !selected.some(
        (tag) => tag.toLowerCase() === trimmedSearch.toLowerCase(),
      ) &&
      !sortedTags.some(
        ([tag]) => tag.toLowerCase() === trimmedSearch.toLowerCase(),
      ),
  );

  let open = $state(false);
  let trigger = $state<HTMLDivElement | null>(null);
  let panel = $state<HTMLDivElement | null>(null);

  /**
   * The popover's on-screen position, captured once when it opens rather than
   * derived live from the trigger — see `Legend.svelte`'s identical anchor,
   * which this was lifted from: the trigger's chip row grows and shrinks as
   * feelings are added and removed, and tracking it continuously just moves
   * the drift from one edge to the other.
   */
  let anchor = $state<{ left: number; top?: number; bottom?: number } | null>(
    null,
  );

  function measureAnchor(): void {
    const rect = trigger?.getBoundingClientRect();
    if (!rect) return;
    anchor =
      dropDirection === "up"
        ? { left: rect.left, bottom: window.innerHeight - rect.top + 8 }
        : { left: rect.left, top: rect.bottom + 8 };
  }

  function openPanel(): void {
    if (!canOpen) return;
    measureAnchor();
    open = true;
  }

  function closePanel(options: { refocus: boolean } = { refocus: false }): void {
    open = false;
    search = "";
    if (options.refocus) trigger?.focus();
  }

  function handleTriggerClick(): void {
    if (!canOpen) return;
    if (open) closePanel();
    else openPanel();
  }

  function handleTriggerKeydown(event: KeyboardEvent): void {
    if (!canOpen) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (open) closePanel();
    else openPanel();
  }

  function toggle(tag: string): void {
    onChange(
      selected.includes(tag)
        ? selected.filter((existing) => existing !== tag)
        : [...selected, tag],
    );
  }

  function removeChip(event: MouseEvent, tag: string): void {
    // Stops the click from also bubbling to the trigger's own onclick, which
    // would reopen (or close) the popover as a side effect of removing a chip.
    event.stopPropagation();
    onChange(selected.filter((existing) => existing !== tag));
  }

  function clearFromTrigger(event: MouseEvent): void {
    event.stopPropagation();
    onChange([]);
  }

  function createFromSearch(): void {
    if (!canCreate) return;
    onChange([...selected, trimmedSearch]);
    search = "";
  }

  function handleSearchKeydown(event: KeyboardEvent): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    createFromSearch();
  }

  /**
   * Close-on-dismiss mechanics, copied from `Legend.svelte`'s own feeling
   * popover: registered only while open, on the capture phase so a click
   * landing on an interactive descendant still counts as "outside" this
   * panel. Escape stops propagation before closing so a window-level Escape
   * handler elsewhere (clearing a selected part, say) doesn't also fire.
   */
  $effect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panel?.contains(target) || trigger?.contains(target)) return;
      closePanel();
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closePanel({ refocus: true });
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", measureAnchor);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", measureAnchor);
    };
  });
</script>

<div class="dropdown">
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    bind:this={trigger}
    class="control"
    class:active={open}
    class:has-selection={selected.length > 0}
    role="button"
    tabindex={canOpen ? 0 : -1}
    aria-disabled={!canOpen}
    aria-haspopup="true"
    aria-expanded={open}
    onclick={handleTriggerClick}
    onkeydown={handleTriggerKeydown}
  >
    {#if selected.length === 0}
      <span class="control-label">{label}</span>
    {:else}
      {#each selected as tag (tag)}
        <span class="chip">
          {tag}
          <button
            type="button"
            class="chip-remove"
            aria-label="Remove feeling {tag}"
            data-export-hide
            onclick={(event) => removeChip(event, tag)}
          >
            ×
          </button>
        </span>
      {/each}
      <button
        type="button"
        class="clear-action"
        data-export-hide
        onclick={clearFromTrigger}
      >
        Clear
      </button>
    {/if}
    <span class="chevron" class:open data-export-hide aria-hidden="true"></span>
  </div>

  {#if open && anchor}
    <div
      bind:this={panel}
      class="popover"
      role="dialog"
      aria-label={eyebrow}
      style:left="{anchor.left}px"
      style:top={anchor.top !== undefined ? `${anchor.top}px` : undefined}
      style:bottom={anchor.bottom !== undefined ? `${anchor.bottom}px` : undefined}
    >
      <p class="eyebrow">{eyebrow}</p>
      <input
        class="search"
        type="text"
        placeholder={allowCreate ? `${searchPlaceholder} or add one` : searchPlaceholder}
        aria-label={searchPlaceholder}
        bind:value={search}
        onkeydown={handleSearchKeydown}
      />
      <ul class="tag-list">
        {#if canCreate}
          <li>
            <button type="button" class="create-option" onclick={createFromSearch}>
              Add "{trimmedSearch}" as a new feeling
            </button>
          </li>
        {/if}
        {#each filteredTags as [tag, count] (tag)}
          <li>
            <label class="option-row">
              <input
                type="checkbox"
                checked={selected.includes(tag)}
                onchange={() => toggle(tag)}
              />
              <span class="option-label">{tag}</span>
              <span class="option-count">{count}</span>
            </label>
          </li>
        {:else}
          {#if !canCreate}
            <li class="empty">No matching feelings.</li>
          {/if}
        {/each}
      </ul>
      <div class="popover-footer">
        <button type="button" class="text-action" onclick={() => onChange([])}>
          Clear all
        </button>
        <button
          type="button"
          class="done-button"
          onclick={() => closePanel({ refocus: true })}
        >
          Done
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  /*
   * DERIVED: lifted from `Legend.svelte`'s feeling-filter popover, the
   * original design has neither a legend nor a quick editor to derive this
   * from. Kept visually identical across all three call sites deliberately —
   * the point of sharing this component is that editing a part's feelings
   * looks and behaves like filtering by them.
   */
  .dropdown {
    position: relative;
  }

  /* Default state: looks like a normal pill. */
  .control {
    position: relative;
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    max-width: 320px;
    padding: 4px 14px;
    border: 1.3px solid var(--pill-border);
    border-radius: 18px;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    transition:
      color 160ms ease,
      border-color 160ms ease;
  }

  .control:hover,
  .control.active {
    color: var(--text-bright);
    border-color: var(--text-muted);
  }

  .control:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .control[aria-disabled="true"] {
    opacity: 0.5;
    cursor: default;
    pointer-events: none;
  }

  .control-label {
    flex: 1 1 auto;
  }

  /* CSS border-triangle chevron. */
  .chevron {
    width: 0;
    height: 0;
    flex-shrink: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid currentColor;
    transition: transform 160ms ease;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px 3px 10px;
    border-radius: 999px;
    background: rgb(143 163 227 / 16%);
    color: var(--text-bright);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  .chip-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Visually the × sits close to the chip's label, but the hit area is
       widened past the glyph's own box so a small target isn't the reason
       the removal doesn't land. */
    width: 18px;
    height: 18px;
    margin: -3px -4px -3px 0;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    color: inherit;
    font-family: inherit;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    opacity: 0.75;
    transition:
      opacity 160ms ease,
      background-color 160ms ease;
  }

  .chip-remove:hover {
    opacity: 1;
    background: rgb(255 255 255 / 12%);
  }

  .chip-remove:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .clear-action {
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: color 160ms ease;
  }

  .clear-action:hover {
    color: var(--text-bright);
  }

  .clear-action:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  /* Positioned in JS (see `measureAnchor`) rather than relative to
     `.dropdown` — `left`/`top`/`bottom` are frozen to where the trigger was
     at open time, so the popover doesn't creep as its own chip row keeps
     growing. */
  .popover {
    position: fixed;
    z-index: 20;
    width: 260px;
    padding: 14px;
    border: 1px solid var(--pill-border);
    border-radius: 10px;
    background: var(--surface-raised);
    box-shadow:
      0 16px 40px rgb(0 0 0 / 50%),
      0 2px 8px rgb(0 0 0 / 40%);
  }

  .eyebrow {
    margin: 0 0 10px;
    color: var(--text-eyebrow);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .search {
    box-sizing: border-box;
    width: 100%;
    height: 30px;
    margin-bottom: 10px;
    padding: 0 8px;
    border: 1px solid var(--pill-border);
    border-radius: 6px;
    background: #0e1019;
    color: var(--text-primary);
    font-family: inherit;
    font-size: 12px;
  }

  .search:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .tag-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 200px;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
    /* Firefox; Chromium picks this up too, but gets the fuller treatment below. */
    scrollbar-width: thin;
    scrollbar-color: rgb(255 255 255 / 16%) transparent;
  }

  .tag-list::-webkit-scrollbar {
    width: 8px;
  }

  .tag-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .tag-list::-webkit-scrollbar-thumb {
    border: 2px solid var(--surface-raised);
    border-radius: 999px;
    background-color: rgb(255 255 255 / 16%);
  }

  .tag-list::-webkit-scrollbar-thumb:hover {
    background-color: rgb(255 255 255 / 28%);
  }

  .tag-list .empty {
    padding: 6px 4px;
    color: var(--text-muted);
    font-size: 12px;
  }

  .create-option {
    box-sizing: border-box;
    width: 100%;
    padding: 6px 4px;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--text-bright);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }

  .create-option:hover {
    background: rgb(255 255 255 / 4%);
  }

  .create-option:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .option-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 4px;
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    cursor: pointer;
    user-select: none;
  }

  .option-row:hover {
    background: rgb(255 255 255 / 4%);
  }

  .option-row input[type="checkbox"] {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    accent-color: var(--focus-ring);
  }

  .option-row input:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .option-label {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .option-count {
    flex-shrink: 0;
    color: var(--text-muted);
    font-size: 11px;
  }

  .popover-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--rule);
  }

  .text-action {
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: color 160ms ease;
  }

  .text-action:hover {
    color: var(--text-bright);
  }

  .text-action:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .done-button {
    height: 28px;
    padding: 0 14px;
    border: 1.3px solid var(--button-border);
    border-radius: 14px;
    background: rgb(143 163 227 / 12%);
    color: var(--text-bright);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .done-button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
