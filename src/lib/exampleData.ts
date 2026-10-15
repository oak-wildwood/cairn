import type { Connection, Part } from "./types";
import { SELF_ID } from "./types";

/**
 * The six example parts the Nocturnal design was drawn around, with the same
 * names. Generic placeholder content only — no real
 * personal data belongs in this repo (see PLAN.md's portfolio note).
 *
 * Most `x`/`y` are null so `computeLayout` places them: the original artwork's
 * coordinate space was illustrative of relative arrangement, not the live
 * viewport. Listed in the order that reproduces that arrangement within each
 * sector.
 *
 * Five carry a hand-placed position instead, arranged by eye in the running
 * app. The sector layout alone ran "polarized with" through The Analyst's
 * caption, and the unknown ring puts its first part at 180°, directly on the
 * "EXILES" caption and under The Kid. Alarmist sits out to the right instead,
 * clear of every sector caption, with The Unseen One drawn across beneath it so
 * the one connector between them stays short and crosses nothing. Nudging these
 * by hand is cheaper than retuning the sector maths for every map to fix one
 * arrangement of six parts, and this is the map every first-time visitor sees.
 *
 * Beyond the original design, the sample is tuned to show what the app does
 * with features added since: Alarmist's role is "unknown", so the outer ring
 * and a dimmed connector both appear; only two parts are active this week, so
 * the active-only filter has something to hide; and feelings recur across
 * parts, so filtering by one picks out a group rather than a single node.
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
    feelings: ["harsh", "vigilant", "tired", "anxious"],
    bodyLocation: "Jaw and shoulders",
    trigger: "Sending work to someone before it feels finished",
    positiveIntention:
      "If it catches the mistake first, no one else gets the chance to be disappointed in me.",
    fears: "That being seen as careless means being rejected outright.",
    origins: "A household where praise arrived only after a correction.",
    notes:
      "Softens noticeably when it's thanked for the effort rather than argued with.",
    status: "",
    active: true,
    x: null,
    y: null,
  },
  {
    id: "the-analyst",
    name: "The Analyst",
    role: "manager",
    description:
      "Builds the schedule, the contingency, and the contingency's contingency.",
    feelings: ["busy", "braced", "vigilant", "anxious"],
    bodyLocation: "Forehead, behind the eyes",
    trigger: "Unstructured time, or a decision without enough information",
    positiveIntention:
      "If everything is anticipated, nothing can arrive that we can't handle.",
    fears: "Being caught unprepared in front of other people.",
    origins: "Long stretches as a child where no adult was tracking what came next.",
    notes: "Pulls against the part that wants rest — the two rarely agree.",
    status: "",
    active: false,
    x: -57,
    y: -198,
  },
  {
    id: "the-avoider",
    name: "The Avoider",
    role: "firefighter",
    description:
      "Reaches for the phone the moment a feeling gets close enough to name.",
    feelings: ["numb", "restless", "far away", "tired"],
    bodyLocation: "Hands and chest",
    trigger: "The first minute of sitting still with nothing to do",
    positiveIntention:
      "Puts distance between me and a feeling that seems like it would be too much.",
    fears: "That if the scrolling stopped, the grief underneath would not.",
    origins: "Arrived around the same time The Kid's memories did.",
    notes: "Shows up fastest late at night.",
    status: "",
    active: false,
    x: 206,
    y: -153,
  },
  {
    id: "alarmist",
    name: "Alarmist",
    role: "unknown",
    description:
      "Runs the worst version of events, out loud, until the room feels dangerous.",
    feelings: ["panicked", "urgent", "anxious", "vigilant"],
    bodyLocation: "Throat",
    trigger: "An unanswered message, a change in someone's tone",
    positiveIntention:
      "If we've already imagined the worst, it can't land as a surprise.",
    fears: "Being blindsided.",
    origins: "Not yet clear — this part has only recently started speaking up.",
    notes:
      "Still getting to know this one — not yet clear whether it is planning ahead or putting out fires.",
    status: "emerging",
    active: true,
    x: 323,
    y: -14,
  },
  {
    id: "the-kid",
    name: "The Kid",
    role: "exile",
    description:
      "Young, carries the memory of being left waiting and deciding that meant something about her.",
    feelings: ["sad", "small", "hopeful", "lonely"],
    bodyLocation: "Center of the chest",
    trigger: "Being left out of something, however small",
    positiveIntention:
      "Holds the belief that connection is worth wanting, even after it hurt.",
    fears: "Being forgotten again by someone who promised not to.",
    origins: "Around six years old.",
    notes:
      "Has been witnessed once. Noticeably calmer since, and the protectors have eased.",
    status: "witnessed",
    active: false,
    x: -8,
    y: 207,
  },
  {
    id: "the-unseen-one",
    name: "The Unseen One",
    role: "exile",
    description:
      "Barely surfaced. Shows up as a heaviness rather than a memory or a voice.",
    feelings: ["exhausted", "sad", "forgotten", "lonely"],
    bodyLocation: "Low back, and somewhere behind the ribs",
    trigger: "Unclear so far",
    positiveIntention: "Not yet known.",
    fears: "Not yet known.",
    origins: "Unknown — earlier than The Kid, going by how it feels.",
    notes: "Approach slowly. The protectors get loud when this one gets close.",
    status: "unwitnessed",
    active: false,
    x: 172,
    y: 203,
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
 * pairs is what earns them arrowheads (see `connectorMarkerEnd` in layout.ts).
 *
 * Polarization is the exception and stays a single connector: The Fixer and The
 * Analyst are in a mutual standoff, which is symmetric, so one line states it.
 *
 * Alarmist -> The Unseen One is not from the design either. It is here so the
 * sample has a connector dimmed by an unknown-role endpoint, and it is the
 * bond The Unseen One's notes already describe: the protectors get loud when
 * it gets close, and their noise stirs it up in turn.
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
  {
    id: "c-alarmist-unseen",
    sourceId: "alarmist",
    targetId: "the-unseen-one",
    label: "sets off",
  },
];
