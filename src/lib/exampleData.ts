import type { Connection, Part } from "./types";
import { SELF_ID } from "./types";

/**
 * The six example parts the Nocturnal design was drawn around, with the same
 * names, roles and statuses. Generic placeholder content only — no real
 * personal data belongs in this repo (see PLAN.md's portfolio note).
 *
 * Most `x`/`y` are null so `computeLayout` places them: the original artwork's
 * coordinate space was illustrative of relative arrangement, not the live
 * viewport. Listed in the order that reproduces that arrangement within each
 * sector.
 *
 * Two carry a hand-placed position instead, because the sector layout alone
 * collided two connector labels with node captions: "polarized with" ran
 * through The Analyst's "MANAGER · ACTIVE", and "triggers" sat on top of The
 * Unseen One's name. Nudging those two apart is cheaper than retuning the
 * sector maths for every map to fix one arrangement of six parts, and this is
 * the map every first-time visitor sees.
 *
 * Overriding a position does not reshuffle the others: `computeLayout` applies
 * overrides last, and an overridden part still consumes its slot in the sector
 * distribution. Rounded to whole units — a drag reports far more precision
 * than a 900-unit viewBox can show.
 */
/**
 * Who the sample map belongs to, so its heading reads the same way a real
 * one does — "Parts Map for Demo User" rather than a second, generic phrasing
 * that only the sample ever uses. Generic by design, like the parts.
 */
export const EXAMPLE_OWNER_NAME = "Demo User";

export const EXAMPLE_PARTS: readonly Part[] = [
  {
    id: "the-fixer",
    name: "The Fixer",
    role: "manager",
    description:
      "Keeps a running commentary on everything I do, looking for the flaw before anyone else can find it.",
    feelings: ["harsh", "vigilant", "tired"],
    bodyLocation: "Jaw and shoulders",
    trigger: "Sending work to someone before it feels finished",
    positiveIntention:
      "If it catches the mistake first, no one else gets the chance to be disappointed in me.",
    fears: "That being seen as careless means being rejected outright.",
    origins: "A household where praise arrived only after a correction.",
    notes:
      "Softens noticeably when it's thanked for the effort rather than argued with.",
    status: "active",
    x: null,
    y: null,
  },
  {
    id: "the-analyst",
    name: "The Analyst",
    role: "manager",
    description:
      "Builds the schedule, the contingency, and the contingency's contingency.",
    feelings: ["busy", "braced", "capable"],
    bodyLocation: "Forehead, behind the eyes",
    trigger: "Unstructured time, or a decision without enough information",
    positiveIntention:
      "If everything is anticipated, nothing can arrive that we can't handle.",
    fears: "Being caught unprepared in front of other people.",
    origins: "Long stretches as a child where no adult was tracking what came next.",
    notes: "Pulls against the part that wants rest — the two rarely agree.",
    status: "active",
    x: -57,
    y: -198,
  },
  {
    id: "the-avoider",
    name: "The Avoider",
    role: "firefighter",
    description:
      "Reaches for the phone the moment a feeling gets close enough to name.",
    feelings: ["numb", "restless", "far away"],
    bodyLocation: "Hands and chest",
    trigger: "The first minute of sitting still with nothing to do",
    positiveIntention:
      "Puts distance between me and a feeling that seems like it would be too much.",
    fears: "That if the scrolling stopped, the grief underneath would not.",
    origins: "Arrived around the same time The Kid's memories did.",
    notes: "Shows up fastest late at night.",
    status: "active",
    x: null,
    y: null,
  },
  {
    id: "alarmist",
    name: "Alarmist",
    role: "firefighter",
    description:
      "Runs the worst version of events, out loud, until the room feels dangerous.",
    feelings: ["panicked", "urgent"],
    bodyLocation: "Throat",
    trigger: "An unanswered message, a change in someone's tone",
    positiveIntention:
      "If we've already imagined the worst, it can't land as a surprise.",
    fears: "Being blindsided.",
    origins: "Not yet clear — this part has only recently started speaking up.",
    notes: "Still getting to know this one.",
    status: "emerging",
    x: null,
    y: null,
  },
  {
    id: "the-kid",
    name: "The Kid",
    role: "exile",
    description:
      "Young, carries the memory of being left waiting and deciding that meant something about her.",
    feelings: ["sad", "small", "hopeful"],
    bodyLocation: "Centre of the chest",
    trigger: "Being left out of something, however small",
    positiveIntention:
      "Holds the belief that connection is worth wanting, even after it hurt.",
    fears: "Being forgotten again by someone who promised not to.",
    origins: "Around six years old.",
    notes:
      "Has been witnessed once. Noticeably calmer since, and the protectors have eased.",
    status: "witnessed",
    x: null,
    y: null,
  },
  {
    id: "the-unseen-one",
    name: "The Unseen One",
    role: "exile",
    description:
      "Barely surfaced. Shows up as a heaviness rather than a memory or a voice.",
    feelings: ["exhausted", "sad", "forgotten"],
    bodyLocation: "Low back, and somewhere behind the ribs",
    trigger: "Unclear so far",
    positiveIntention: "Not yet known.",
    fears: "Not yet known.",
    origins: "Unknown — earlier than The Kid, going by how it feels.",
    notes: "Approach slowly. The protectors get loud when this one gets close.",
    status: "unwitnessed",
    x: -256,
    y: 192,
  },
];

/**
 * Direction matters: a connector takes its color from its source, which is why
 * the The Kid -> The Fixer edge is exile pink rather than manager blue — it is
 * the wound reaching the protector, not the other way round.
 *
 * The Nocturnal design drew five connectors, and these are those five plus the
 * return leg of two of them. A design settles how a connector *looks*, not
 * which relationships an IFS map contains — it was one illustrative picture of
 * six parts, and a protector/exile bond drawn one-way is a half-drawn bond.
 * IFS has the exile activating its protector while that protector works to
 * suppress the exile: both directions, at once, between the same pair. So The
 * Kid triggers The Fixer *and* The Fixer protects The Kid; The Kid triggers The
 * Avoider *and* The Avoider protects The Kid. Rendering these as reciprocal
 * pairs is what earns them arrowheads (see Connection.svelte).
 *
 * Polarization is the exception and stays a single connector: The Fixer and The
 * Analyst are in a mutual standoff, which is symmetric, so one line states it.
 */
export const EXAMPLE_CONNECTIONS: readonly Connection[] = [
  {
    id: "c-fixer-self",
    sourceId: "the-fixer",
    targetId: SELF_ID,
    label: "connected to",
  },
  {
    id: "c-self-kid",
    sourceId: SELF_ID,
    targetId: "the-kid",
    label: "witnessing",
  },
  {
    id: "c-fixer-analyst",
    sourceId: "the-fixer",
    targetId: "the-analyst",
    label: "polarized with",
  },
  {
    id: "c-kid-fixer",
    sourceId: "the-kid",
    targetId: "the-fixer",
    label: "triggers",
  },
  {
    id: "c-fixer-kid",
    sourceId: "the-fixer",
    targetId: "the-kid",
    label: "protects",
  },
  {
    id: "c-avoider-kid",
    sourceId: "the-avoider",
    targetId: "the-kid",
    label: "protects",
  },
  {
    id: "c-kid-avoider",
    sourceId: "the-kid",
    targetId: "the-avoider",
    label: "triggers",
  },
];
