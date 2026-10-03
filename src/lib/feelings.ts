import type { FeelingGroup, Part } from "./types";

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

/**
 * The one spelling two feelings are compared under: trimmed and lowercased,
 * matching what `FeelingsMultiSelect` does to a feeling as it is created and
 * what `persistence.ts` does to every feeling on load.
 */
export function normalizeFeeling(feeling: string): string {
  return feeling.trim().toLowerCase();
}

/**
 * Feeling groups are an equivalence relation the person declares — "these
 * words name the same feeling" — rather than one the app infers. Nothing here
 * stems words, looks them up in a thesaurus or scores how alike they are:
 * "scared" and "fear" share no letters worth matching on, and "anxious" and
 * "scared" are one feeling for some people and two for others. Only the
 * person can say, so the person says, and the rest is plain set logic.
 *
 * "The same feeling as" has to be reflexive, symmetric and transitive to mean
 * anything, and a partition is exactly what gives those three: so a feeling
 * belongs to at most one group. Were "afraid" allowed in both a "fear" group
 * and an "anxiety" group, filtering by "fear" would match "anxious" through
 * it, which nobody said.
 *
 * This tidies any list of groups into that shape — every feeling normalized,
 * empty strings dropped, repeats within a group collapsed, and a feeling
 * already claimed by an earlier group dropped from later ones (the first
 * group wins, as the first connection does in `persistence.ts`). A repeated
 * group id is dropped the same way, since the store edits groups by id.
 * Names are trimmed; an empty group or an unnamed one is kept, because a
 * group the person has just created starts that way.
 */
export function normalizeFeelingGroups(
  groups: readonly FeelingGroup[],
): FeelingGroup[] {
  const seenIds = new Set<string>();
  const claimed = new Set<string>();
  const result: FeelingGroup[] = [];
  for (const group of groups) {
    if (seenIds.has(group.id)) continue;
    seenIds.add(group.id);
    const feelings: string[] = [];
    for (const raw of group.feelings) {
      const feeling = normalizeFeeling(raw);
      if (feeling === "" || claimed.has(feeling)) continue;
      claimed.add(feeling);
      feelings.push(feeling);
    }
    result.push({ id: group.id, name: group.name.trim(), feelings });
  }
  return result;
}

/**
 * Set one group's feelings, moving any of them out of whichever other group
 * held them — the later, explicit choice wins over the earlier one, which is
 * what someone picking "afraid" into "fear" means. Returns the whole list,
 * still a partition; an unknown id leaves it as it was.
 */
export function assignFeelingsToGroup(
  groups: readonly FeelingGroup[],
  id: string,
  feelings: readonly string[],
): FeelingGroup[] {
  const target = groups.find((group) => group.id === id);
  if (target === undefined) return [...groups];
  // The updated target goes first, so `normalizeFeelingGroups`' first-wins
  // rules both take its feelings out of every other group and drop the
  // target's old copy, which repeats its id further down.
  const byId = new Map(
    normalizeFeelingGroups([{ ...target, feelings: [...feelings] }, ...groups]).map(
      (group) => [group.id, group],
    ),
  );
  return groups.map((group) => byId.get(group.id) ?? group);
}

/**
 * Every feeling that counts as one of `feelings` — each one itself, plus the
 * rest of its group when it has one. A feeling outside every group stands
 * for only itself, so with no groups at all this is just `feelings`. Order
 * follows `feelings`, with each group's members after the feeling that
 * brought them in, and nothing repeats.
 *
 * This is what makes a group do something: the legend's feeling filter is
 * expanded through it, so filtering by "scared" also shows the parts tagged
 * "afraid" or "fear".
 */
export function expandFeelings(
  feelings: readonly string[],
  groups: readonly FeelingGroup[],
): string[] {
  const groupOf = new Map<string, FeelingGroup>();
  for (const group of groups) {
    for (const feeling of group.feelings) groupOf.set(feeling, group);
  }
  const expanded = new Set<string>();
  for (const feeling of feelings) {
    expanded.add(feeling);
    for (const sibling of groupOf.get(feeling)?.feelings ?? []) {
      expanded.add(sibling);
    }
  }
  return [...expanded];
}
