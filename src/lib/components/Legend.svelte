<script lang="ts">
  import { ROLES, SECTOR_ROLES } from "../theme";
  import type { Part, SectorRole } from "../types";

  /** `null` is the "All" pill — no filter applied. */
  export type Filter = SectorRole | null;

  interface Props {
    parts: readonly Part[];
    activeFilter?: Filter;
    onFilter?: (filter: Filter) => void;
    /** Whether the "Active only" toggle is on. Independent of `activeFilter`
     * — a role and this can combine, e.g. "active managers". */
    activeOnlyFilter?: boolean;
    onToggleActiveOnly?: () => void;
  }

  const {
    parts,
    activeFilter = null,
    onFilter,
    activeOnlyFilter = false,
    onToggleActiveOnly,
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
</script>

<div class="legend">
  <button
    type="button"
    class="pill"
    class:active={activeFilter === null}
    aria-pressed={activeFilter === null}
    onclick={() => onFilter?.(null)}
  >
    All {parts.length}
  </button>

  {#each SECTOR_ROLES as role (role)}
    <button
      type="button"
      class="pill"
      class:active={activeFilter === role}
      aria-pressed={activeFilter === role}
      style:--dot={ROLES[role].accent}
      style:--pill-text={ROLES[role].pillText}
      onclick={() => onFilter?.(role)}
    >
      <span class="dot" aria-hidden="true"></span>
      {LABELS[role]} · {counts[role]}
    </button>
  {/each}

  <!--
    A divider rather than a fifth pill: the role pills are mutually
    exclusive (one `activeFilter` value at a time), but "active only" isn't
    exclusive with any of them — "active managers" is a valid combination —
    so it gets a visibly different control in the same row, not one more
    option in that group.
  -->
  <span class="divider" aria-hidden="true"></span>

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
</div>

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem;
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
    color: var(--pill-text, var(--text-bright));
    border-color: var(--text-muted);
  }

  .pill:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .dot {
    width: 10px;
    height: 10px;
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
</style>
