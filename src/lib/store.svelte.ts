import { EXAMPLE_CONNECTIONS, EXAMPLE_PARTS } from "./exampleData";
import { connectionPairKey } from "./layout";
import { loadState } from "./persistence";
import type {
  Connection,
  EndpointId,
  Part,
  PartDraft,
  Point,
} from "./types";

/**
 * Read once, at import, so the store is already correct on its first render.
 * Loading inside an effect instead would let the debounced save fire against
 * the seed data first and overwrite a real map before it was ever restored.
 */
const restored = loadState();

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
  parts = $state<Part[]>(restored?.parts ?? [...EXAMPLE_PARTS]);
  connections = $state<Connection[]>(
    restored?.connections ?? [...EXAMPLE_CONNECTIONS],
  );

  /**
   * Whether what's on screen is still the untouched sample map. A stored map
   * is the user's own by definition, and so is one they have edited — telling
   * someone their own parts are "for demonstration only" would be a lie in
   * exactly the place the app is asking them to be honest.
   *
   * An emptied map stays a real map: absence of a stored blob is what marks
   * the sample, not absence of parts.
   */
  showingExample = $state(restored === null);

  /** The part whose detail panel is open, or null when nothing is selected. */
  selectedPartId = $state<string | null>(null);

  /**
   * What the add/edit modal is doing, or null when it is closed.
   *
   * The plan describes this as an `editingPartId` where null means "adding
   * new", but that needs a second flag to say whether the modal is open at
   * all, and two fields that must agree is a bug waiting to happen. One
   * nullable union can't represent a contradictory state.
   */
  editing = $state<{ kind: "new" } | { kind: "existing"; id: string } | null>(
    null,
  );

  readonly editingPart = $derived.by(() => {
    const target = this.editing;
    if (target?.kind !== "existing") return null;
    return this.parts.find((part) => part.id === target.id) ?? null;
  });

  readonly selectedPart = $derived(
    this.parts.find((part) => part.id === this.selectedPartId) ?? null,
  );

  select(id: string): void {
    this.selectedPartId = id;
    this.selectedConnectionId = null;
  }

  clearSelection(): void {
    this.selectedPartId = null;
    this.selectedConnectionId = null;
  }

  /**
   * Remove a part and every connection naming it, at either end. Leaving a
   * connection behind would put an id in the store — and later in
   * localStorage — that resolves to nothing.
   */
  deletePart(id: string): void {
    this.showingExample = false;
    this.parts = this.parts.filter((part) => part.id !== id);
    this.connections = this.connections.filter(
      (connection) =>
        connection.sourceId !== id && connection.targetId !== id,
    );
    if (this.selectedPartId === id) this.selectedPartId = null;
  }

  startAdding(): void {
    this.editing = { kind: "new" };
  }

  startEditing(id: string): void {
    this.editing = { kind: "existing", id };
  }

  stopEditing(): void {
    this.editing = null;
  }

  /** Add a part and select it, so the map shows what was just created. */
  addPart(draft: PartDraft): void {
    this.showingExample = false;
    const part: Part = { id: crypto.randomUUID(), ...draft };
    this.parts = [...this.parts, part];
    this.selectedPartId = part.id;
    this.editing = null;
  }

  updatePart(id: string, draft: PartDraft): void {
    this.showingExample = false;
    this.parts = this.parts.map((part) =>
      part.id === id ? { ...draft, id } : part,
    );
    this.editing = null;
  }

  /**
   * The connection whose label is being edited, or null.
   *
   * Selecting a connection and editing its label are the same state here,
   * because the plan makes them the same gesture: clicking a connector opens
   * its label editor, and a newly drawn one opens it immediately. A second
   * field for "selected but not editing" would have no way to be reached.
   *
   * The in-progress drag itself is deliberately *not* here — it lives in
   * `Diagram.svelte`. It is transient interaction state that never persists,
   * never outlives the gesture, and is read by nothing outside that subtree.
   */
  selectedConnectionId = $state<string | null>(null);

  /** True when these two endpoints already hold a connection, either way round. */
  hasConnectionBetween(a: EndpointId, b: EndpointId): boolean {
    const key = connectionPairKey(a, b);
    return this.connections.some(
      (connection) =>
        connectionPairKey(connection.sourceId, connection.targetId) === key,
    );
  }

  /**
   * Create a connection and open its label editor, per the plan's flow.
   *
   * Refuses a pair that is already connected. The diagram also declines to
   * offer such a node as a drop target, so this guard should be unreachable
   * from the canvas — it is here for the paths that don't go through a drag.
   */
  addConnection(sourceId: EndpointId, targetId: EndpointId): void {
    if (sourceId === targetId) return;
    if (this.hasConnectionBetween(sourceId, targetId)) return;
    this.showingExample = false;
    const connection: Connection = {
      id: crypto.randomUUID(),
      sourceId,
      targetId,
      label: "",
    };
    this.connections = [...this.connections, connection];
    this.selectedConnectionId = connection.id;
  }

  selectConnection(id: string): void {
    this.selectedConnectionId = id;
    // A connector and a part are never both selected: two open editors would
    // compete for Escape and for the Delete key.
    this.selectedPartId = null;
  }

  clearConnectionSelection(): void {
    this.selectedConnectionId = null;
  }

  /** Blurring with an empty label is allowed — it stays editable later. */
  setConnectionLabel(id: string, label: string): void {
    this.showingExample = false;
    this.connections = this.connections.map((connection) =>
      connection.id === id ? { ...connection, label: label.trim() } : connection,
    );
  }

  deleteConnection(id: string): void {
    this.showingExample = false;
    this.connections = this.connections.filter(
      (connection) => connection.id !== id,
    );
    if (this.selectedConnectionId === id) this.selectedConnectionId = null;
  }

  /**
   * Write a dragged position as a manual override. `computeLayout` consults it
   * verbatim from here on and stops placing this part in its sector — the part
   * still consumes its slot there, so its untouched siblings don't reshuffle
   * underneath it.
   */
  movePart(id: string, { x, y }: Point): void {
    this.showingExample = false;
    this.parts = this.parts.map((part) =>
      part.id === id ? { ...part, x, y } : part,
    );
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
