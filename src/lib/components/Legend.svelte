<script lang="ts">
  import { ROLES, SECTOR_ROLES } from "../theme";
  import type { Part, SectorRole } from "../types";

  /** `null` is the "All" pill — no filter applied. */
  export type Filter = SectorRole | null;

  interface Props {
    parts: readonly Part[];
    activeFilter?: Filter;
    onFilter?: (filter: Filter) => void;
  }

  const { parts, activeFilter = null, onFilter }: Props = $props();

  const counts = $derived(
    SECTOR_ROLES.reduce<Record<SectorRole, number>>(
      (totals, role) => {
        totals[role] = parts.filter((part) => part.role === role).length;
        return totals;
      },
      { manager: 0, firefighter: 0, exile: 0 },
    ),
  );

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
</style>
