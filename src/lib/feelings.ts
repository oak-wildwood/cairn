import type { Part } from "./types";

/**
 * Every feeling in use across the map and how many parts carry it — the tag
 * vocabulary, built by flattening `feelings` across every part rather than
 * tracked as a field of its own, since `feelings` already is the tag list.
 * Shared by the legend's feeling filter, the detail panel's quick editor and
 * the add/edit modal, so the three never drift apart on what counts as a
 * known feeling.
 */
export function feelingCounts(parts: readonly Part[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const part of parts) {
    for (const tag of part.feelings) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}
