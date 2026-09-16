<script lang="ts">
  import FeelingsMultiSelect from "./FeelingsMultiSelect.svelte";
  import { feelingCounts } from "../feelings";
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
    /** Replaces the whole tag selection. */
    onTagFilterChange?: (tags: string[]) => void;
  }

  const {
    parts,
    activeFilter = null,
    onFilter,
    activeOnlyFilter = false,
    onToggleActiveOnly,
    tagFilter = [],
    onTagFilterChange,
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

  /** The feeling vocabulary and its counts, for `FeelingsMultiSelect` below. */
  const tagCounts = $derived(feelingCounts(parts));

  let partsOpen = $state(false);
  let partsTrigger = $state<HTMLButtonElement | null>(null);
  let partsPanel = $state<HTMLDivElement | null>(null);

  function openParts(): void {
    partsOpen = true;
  }

  function closeParts(options: { refocus: boolean } = { refocus: false }): void {
    partsOpen = false;
    if (options.refocus) partsTrigger?.focus();
  }

  function selectRole(role: Filter): void {
    onFilter?.(role);
    closeParts({ refocus: true });
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

  <FeelingsMultiSelect
    tagCounts={tagCounts}
    selected={tagFilter}
    onChange={(tags) => onTagFilterChange?.(tags)}
    label="Feelings"
    eyebrow="Filter by feeling"
    dropDirection="up"
  />
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

  .option-row input[type="radio"] {
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
</style>
