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

  /** The part whose detail panel is open, or null when nothing is selected. */
  selectedPartId = $state<string | null>(null);

  readonly selectedPart = $derived(
    this.parts.find((part) => part.id === this.selectedPartId) ?? null,
  );

  select(id: string): void {
    this.selectedPartId = id;
  }

  clearSelection(): void {
    this.selectedPartId = null;
  }

  /**
   * Remove a part and every connection naming it, at either end. Leaving a
   * connection behind would put an id in the store — and later in
   * localStorage — that resolves to nothing.
   */
  deletePart(id: string): void {
    this.parts = this.parts.filter((part) => part.id !== id);
    this.connections = this.connections.filter(
      (connection) =>
        connection.sourceId !== id && connection.targetId !== id,
    );
    if (this.selectedPartId === id) this.selectedPartId = null;
  }

  /** Every connection touching a part, in either direction. */
  connectionsFor(id: string): Connection[] {
    return this.connections.filter(
      (connection) =>
        connection.sourceId === id || connection.targetId === id,
    );
  }
}

export const store = new MapStore();
