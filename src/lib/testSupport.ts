import type { Part } from "./types";

/**
 * A minimal, schema-valid part for tests that only care about a few fields.
 * Every free-text field defaults to "" and role defaults to "manager" so a
 * test only has to spell out what it's actually exercising.
 */
export function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: "test-part",
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
