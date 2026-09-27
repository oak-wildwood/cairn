import type { Part } from "./types";

/**
 * A minimally valid `Part`, overridable per test. Shared by `layout.test.ts`
 * and `persistence.test.ts` so a field added to `Part` only has to be given a
 * default once.
 */
export function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: "part-1",
    name: "Test Part",
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
