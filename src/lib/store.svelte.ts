import { EXAMPLE_CONNECTIONS, EXAMPLE_PARTS } from "./exampleData";
import type { Connection, Part } from "./types";

/**
 * The map's shared reactive state.
 *
 * A class rather than a bare `$state` object so the fields stay reassignable
 * across module boundaries — an exported `let` cannot be, and reassignment is
 * how a whole-map replacement (loading a persisted blob) will arrive later.
 *
 * The example data is seeded here for now. It is generic placeholder content,
 * not anyone's real map — see PLAN.md's portfolio note.
 */
class MapStore {
  parts = $state<Part[]>([...EXAMPLE_PARTS]);
  connections = $state<Connection[]>([...EXAMPLE_CONNECTIONS]);
}

export const store = new MapStore();
