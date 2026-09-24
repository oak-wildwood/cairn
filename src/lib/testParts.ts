import type { Part } from "./types";

/**
 * A blank part for tests, with only the fields a test cares about overridden —
 * one definition so a new `Part` field is added here once rather than in every
 * test file.
 *
 * `x`/`y` default to `null`, never `0`: `(0, 0)` is Self's own position, and a
 * zero default would pin every test part to the centre of the diagram.
 */
export function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: "part-1",
    name: "Part",
    role: "manager",
    description: "",
    feelings: [],
    bodyLocation: "",
    trigger: "",
    positiveIntention: "",
    fears: "",
    origins: "",
    notes: "",
    status: "",
    active: false,
    x: null,
    y: null,
    ...overrides,
  };
}
