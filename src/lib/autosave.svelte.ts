import { saveStateDebounced } from "./persistence";
import { store } from "./store.svelte";
import { SCHEMA_VERSION } from "./types";
import type { PersistedState } from "./types";

/**
 * The map as it would be written to storage or a backup file.
 *
 * `$state.snapshot` does the deep read that registers every part and
 * connection as a dependency, and hands back plain objects for JSON in the
 * same step — serialising the reactive proxies directly would be both
 * untracked and wrong.
 */
export function snapshotState(): PersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    parts: $state.snapshot(store.parts),
    connections: $state.snapshot(store.connections),
    ownerName: store.ownerName,
    feelingGroups: $state.snapshot(store.feelingGroups),
  };
}

/**
 * Write the map back to localStorage whenever it settles.
 *
 * Registers an `$effect`, so call it while a component is initialising (or
 * inside `$effect.root`). `save` is a parameter so a test can watch what is
 * written without waiting out the debounce.
 */
export function autosaveMap(
  save: (state: PersistedState) => void = saveStateDebounced,
): void {
  $effect(() => {
    // An untouched sample map is never written. Persisting it would make the
    // seed indistinguishable from a real map on the next load — the banner
    // would drop, and `exampleData.ts` would quietly become the user's own.
    if (store.showingExample) return;

    save(snapshotState());
  });
}
