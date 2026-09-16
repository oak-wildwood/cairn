<script lang="ts">
  import { ROLES, SECTOR_ROLES } from "../theme";
  import type { Part, SectorRole } from "../types";

  /** `null` is "All parts" — no role filter applied. */
  export type Filter = SectorRole | null;

  interface Props {
    parts: readonly Part[];
    activeFilter?: Filter;
    onFilter?: (filter: Filter) => void;
    /** Whether the "Active only" toggle is on. Independent of `activeFilter`
     * — a role and this can combine, e.g. "active managers". */
    activeOnlyFilter?: boolean;
    onToggleActiveOnly?: () => void;
    /** The tags the legend is filtering to. Empty means no tag filter. */
    tagFilter?: readonly string[];
    onToggleTag?: (tag: string) => void;
    /** Clears every selected tag from the trigger's own "Clear" action. */
    onClearTags?: () => void;
    /** Replaces the whole tag selection — used by the popover's "Clear all". */
    onSetTagFilter?: (tags: string[]) => void;
  }

  const {
    parts,
    activeFilter = null,
    onFilter,
    activeOnlyFilter = false,
    onToggleActiveOnly,
    tagFilter = [],
    onToggleTag,
    onClearTags,
    onSetTagFilter,
  }: Props = $props();

  const counts = $derived(
    SECTOR_ROLES.reduce<Record<SectorRole, number>>(
      (totals, role) => {
        totals[role] = parts.filter((part) => part.role === role).length;
        return totals;
      },
      { manager: 0, firefighter: 0, exile: 0 },
    ),
  );

  const activeCount = $derived(parts.filter((part) => part.active).length);

  const LABELS: Readonly<Record<SectorRole, string>> = {
    manager: "Managers",
    firefighter: "Firefighters",
    exile: "Exiles",
  };

  /**
   * The tag vocabulary and its counts, built by flattening `feelings` across
   * every part rather than tracked as a field of its own — `feelings` already
   * is the tag list, so there is nothing else to keep in sync.
   */
  const tagCounts = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const part of parts) {
      for (const tag of part.feelings) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return counts;
  });

  const hasTags = $derived(tagCounts.size > 0);

  const sortedTags = $derived(
    [...tagCounts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    ),
  );

  let tagSearch = $state("");

  const filteredTags = $derived.by(() => {
    const query = tagSearch.trim().toLowerCase();
    if (query === "") return sortedTags;
    return sortedTags.filter(([tag]) => tag.toLowerCase().includes(query));
  });

  let partsOpen = $state(false);
  let partsTrigger = $state<HTMLButtonElement | null>(null);
  let partsPanel = $state<HTMLDivElement | null>(null);

  let tagsOpen = $state(false);
  let tagsTrigger = $state<HTMLDivElement | null>(null);
  let tagsPanel = $state<HTMLDivElement | null>(null);
  /**
   * The popover's on-screen position, captured once when it opens rather than
   * derived live from the trigger. The trigger's own left edge moves as its
   * chip row grows or shrinks — `.legend`'s `justify-content: center` re-flows
   * the whole row around it — so tracking the trigger continuously just moves
   * the drift from one edge to the other. Freezing the anchor at open time is
   * what actually keeps the popover still while you check boxes inside it.
   */
  let tagsAnchor = $state<{ left: number; bottom: number } | null>(null);

  function openParts(): void {
    tagsOpen = false;
    partsOpen = true;
  }

  function closeParts(options: { refocus: boolean } = { refocus: false }): void {
    partsOpen = false;
    if (options.refocus) partsTrigger?.focus();
  }

  function measureTagsAnchor(): void {
    const rect = tagsTrigger?.getBoundingClientRect();
    if (!rect) return;
    tagsAnchor = { left: rect.left, bottom: window.innerHeight - rect.top + 8 };
  }

  function openTags(): void {
    if (!hasTags) return;
    partsOpen = false;
    measureTagsAnchor();
    tagsOpen = true;
  }

  function closeTags(options: { refocus: boolean } = { refocus: false }): void {
    tagsOpen = false;
    tagSearch = "";
    if (options.refocus) tagsTrigger?.focus();
  }

  function selectRole(role: Filter): void {
    onFilter?.(role);
    closeParts({ refocus: true });
  }

  function handleTagsTriggerClick(): void {
    if (!hasTags) return;
    if (tagsOpen) closeTags();
    else openTags();
  }

  function handleTagsTriggerKeydown(event: KeyboardEvent): void {
    if (!hasTags) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (tagsOpen) closeTags();
    else openTags();
  }

  function removeTag(event: MouseEvent, tag: string): void {
    // Stops the click from also bubbling to the trigger's own onclick, which
    // would reopen (or close) the popover as a side effect of removing a chip.
    event.stopPropagation();
    onToggleTag?.(tag);
  }

  function clearTagsFromTrigger(event: MouseEvent): void {
    event.stopPropagation();
    onClearTags?.();
  }

  /**
   * Close-on-dismiss mechanics, copied from `MapMenu.svelte`: registered only
   * while the popover is open, on the capture phase so a click landing inside
   * an interactive descendant still counts as "outside" this panel. Escape
   * stops propagation before closing so `App.svelte`'s window-level Escape
   * handler doesn't also clear the selected part.
   */
  $effect(() => {
    if (!partsOpen) return;

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (partsPanel?.contains(target) || partsTrigger?.contains(target)) {
        return;
      }
      closeParts();
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeParts({ refocus: true });
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  });

  $effect(() => {
    if (!tagsOpen) return;

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (tagsPanel?.contains(target) || tagsTrigger?.contains(target)) {
        return;
      }
      closeTags();
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeTags({ refocus: true });
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", measureTagsAnchor);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", measureTagsAnchor);
    };
  });
</script>

<div class="legend">
  <div class="dropdown">
    <button
      bind:this={partsTrigger}
      type="button"
      class="pill"
      class:active={partsOpen}
      aria-haspopup="listbox"
      aria-expanded={partsOpen}
      onclick={() => (partsOpen ? closeParts() : openParts())}
    >
      {#if activeFilter !== null}
        <span
          class="dot"
          style:--dot={ROLES[activeFilter].accent}
          aria-hidden="true"
        ></span>
      {/if}
      <span>{activeFilter === null ? "All parts" : LABELS[activeFilter]}</span>
      <span class="chevron" class:open={partsOpen} aria-hidden="true"></span>
    </button>

    {#if partsOpen}
      <div
        bind:this={partsPanel}
        class="popover parts-popover"
        role="listbox"
        aria-label="Filter by part"
      >
        <p class="eyebrow">Filter by part</p>
        <div class="radio-list">
          <label class="option-row">
            <input
              type="radio"
              name="part-filter"
              checked={activeFilter === null}
              onclick={() => selectRole(null)}
              onchange={() => selectRole(null)}
            />
            <span class="option-label">All parts</span>
            <span class="option-count">{parts.length}</span>
          </label>
          {#each SECTOR_ROLES as role (role)}
            <label class="option-row">
              <input
                type="radio"
                name="part-filter"
                checked={activeFilter === role}
                onclick={() => selectRole(role)}
                onchange={() => selectRole(role)}
              />
              <span
                class="dot"
                style:--dot={ROLES[role].accent}
                aria-hidden="true"
              ></span>
              <span class="option-label">{LABELS[role]}</span>
              <span class="option-count">{counts[role]}</span>
            </label>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <button
    type="button"
    class="pill toggle"
    class:active={activeOnlyFilter}
    aria-pressed={activeOnlyFilter}
    onclick={() => onToggleActiveOnly?.()}
  >
    <span class="check" aria-hidden="true">{activeOnlyFilter ? "✓" : ""}</span>
    Active only · {activeCount}
  </button>

  <!-- A divider rather than folding Feelings into the row above: it filters on a
       different facet (theme/dynamic rather than role), and ANDs against the
       other two rather than replacing either. -->
  <span class="divider" aria-hidden="true"></span>

  <div class="dropdown">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      bind:this={tagsTrigger}
      class="tags-control"
      class:active={tagsOpen}
      class:has-tags={tagFilter.length > 0}
      role="button"
      tabindex={hasTags ? 0 : -1}
      aria-disabled={!hasTags}
      aria-haspopup="true"
      aria-expanded={tagsOpen}
      onclick={handleTagsTriggerClick}
      onkeydown={handleTagsTriggerKeydown}
    >
      {#if tagFilter.length === 0}
        <span class="tags-label">Feelings</span>
      {:else}
        {#each tagFilter as tag (tag)}
          <span class="chip">
            {tag}
            <button
              type="button"
              class="chip-remove"
              aria-label="Remove feeling {tag}"
              onclick={(event) => removeTag(event, tag)}
            >
              ×
            </button>
          </span>
        {/each}
        <button
          type="button"
          class="clear-action"
          onclick={clearTagsFromTrigger}
        >
          Clear
        </button>
      {/if}
      <span class="chevron" class:open={tagsOpen} aria-hidden="true"></span>
    </div>

    {#if tagsOpen && tagsAnchor}
      <div
        bind:this={tagsPanel}
        class="popover tags-popover"
        role="dialog"
        aria-label="Filter by feeling"
        style:left="{tagsAnchor.left}px"
        style:bottom="{tagsAnchor.bottom}px"
      >
        <p class="eyebrow">Filter by feeling</p>
        <input
          class="search"
          type="text"
          placeholder="Search feelings"
          aria-label="Search feelings"
          bind:value={tagSearch}
        />
        <ul class="tag-list">
          {#each filteredTags as [tag, count] (tag)}
            <li>
              <label class="option-row">
                <input
                  type="checkbox"
                  checked={tagFilter.includes(tag)}
                  onchange={() => onToggleTag?.(tag)}
                />
                <span class="option-label">{tag}</span>
                <span class="option-count">{count}</span>
              </label>
            </li>
          {:else}
            <li class="empty">No matching feelings.</li>
          {/each}
        </ul>
        <div class="popover-footer">
          <button
            type="button"
            class="text-action"
            onclick={() => onSetTagFilter?.([])}
          >
            Clear all
          </button>
          <button
            type="button"
            class="done-button"
            onclick={() => closeTags({ refocus: true })}
          >
            Done
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  .dropdown {
    position: relative;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
    height: 36px;
    padding: 0 1.25rem;
    border: 1.3px solid var(--pill-border);
    border-radius: 18px;
    background: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition:
      color 160ms ease,
      border-color 160ms ease;
  }

  .pill:hover,
  .pill.active {
    color: var(--text-bright);
    border-color: var(--text-muted);
  }

  .pill:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .dot {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--dot);
  }

  .divider {
    align-self: center;
    width: 1px;
    height: 20px;
    background: var(--pill-border);
  }

  .check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border: 1.3px solid currentColor;
    border-radius: 50%;
    font-size: 10px;
    line-height: 1;
  }

  /* CSS border-triangle chevron, shared by both triggers. */
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

  /* Both popovers anchor upward: the legend sits at the bottom of the
     viewport, so a downward popover would run off the page. */
  .popover {
    position: absolute;
    bottom: calc(100% + 8px);
    z-index: 20;
    width: 200px;
    padding: 14px;
    border: 1px solid var(--pill-border);
    border-radius: 10px;
    background: var(--surface-raised);
    box-shadow:
      0 -16px 40px rgb(0 0 0 / 50%),
      0 -2px 8px rgb(0 0 0 / 40%);
  }

  .parts-popover {
    left: 0;
  }

  /* Positioned in JS (see `measureTagsAnchor`) rather than relative to
     `.dropdown` — `left`/`bottom` are frozen to where the trigger was at open
     time, so the popover doesn't creep as its own chip row keeps growing. */
  .tags-popover {
    position: fixed;
    width: 260px;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: var(--text-eyebrow);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .radio-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
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

  .option-row input[type="radio"],
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

  /* Default state: looks like a normal pill. */
  .tags-control {
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

  .tags-control:hover,
  .tags-control.active {
    color: var(--text-bright);
    border-color: var(--text-muted);
  }

  .tags-control:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .tags-control[aria-disabled="true"] {
    opacity: 0.5;
    cursor: default;
    pointer-events: none;
  }

  .tags-label {
    flex: 1 1 auto;
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
