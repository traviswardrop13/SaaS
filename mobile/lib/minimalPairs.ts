/**
 * Minimal pairs — the signature phonology method (and the most common product
 * type in real SLP stores). Two words differ by exactly the target sound
 * (key vs tea, snail vs nail). The child hears one and finds the matching
 * picture, training the ear to hear the contrast their mouth keeps collapsing.
 *
 * Tap-based and audio-first — no mic needed, so it's reliable everywhere and
 * complements the spoken-imitation lessons.
 */
import type { TargetSound } from "./scoring";

export type PairWord = { word: string; emoji: string };

export type MinimalPair = {
  /** the word with the correct target sound */
  target: PairWord;
  /** the contrast word (the typical error) */
  foil: PairWord;
};

export type MinimalPairSet = {
  id: string;
  /** e.g. "K vs T" */
  title: string;
  /** friendly process name shown to parents */
  process: string;
  emoji: string;
  targetSound: TargetSound;
  /** the skill this reinforces, so it can surface inside the child's plan */
  skillId: string;
  pairs: MinimalPair[];
};

export const MINIMAL_PAIR_SETS: MinimalPairSet[] = [
  {
    id: "mp-k-t",
    title: "K vs T",
    process: "Back sounds (fronting)",
    emoji: "🦘",
    targetSound: "K",
    skillId: "k-sounds",
    pairs: [
      { target: { word: "key", emoji: "🔑" }, foil: { word: "tea", emoji: "🍵" } },
      { target: { word: "cap", emoji: "🧢" }, foil: { word: "tap", emoji: "🚰" } },
      { target: { word: "cape", emoji: "🦸" }, foil: { word: "tape", emoji: "🧷" } },
    ],
  },
  {
    id: "mp-r-w",
    title: "R vs W",
    process: "Roaring R (gliding)",
    emoji: "🦁",
    targetSound: "R",
    skillId: "r-sounds",
    pairs: [
      { target: { word: "ring", emoji: "💍" }, foil: { word: "wing", emoji: "🪽" } },
      { target: { word: "rock", emoji: "🪨" }, foil: { word: "wok", emoji: "🍳" } },
      { target: { word: "rake", emoji: "🍂" }, foil: { word: "wake", emoji: "⏰" } },
    ],
  },
  {
    id: "mp-cluster",
    title: "Two sounds vs one",
    process: "Don't drop a sound (cluster reduction)",
    emoji: "🌟",
    targetSound: "S",
    skillId: "s-blends",
    pairs: [
      { target: { word: "snail", emoji: "🐌" }, foil: { word: "nail", emoji: "🔨" } },
      { target: { word: "stop", emoji: "🛑" }, foil: { word: "top", emoji: "🔝" } },
      { target: { word: "spot", emoji: "🔴" }, foil: { word: "pot", emoji: "🍲" } },
    ],
  },
  {
    id: "mp-ch-sh",
    title: "CH vs SH",
    process: "Choo-choo CH (deaffrication)",
    emoji: "🚂",
    targetSound: "CH",
    skillId: "ch-sounds",
    pairs: [
      { target: { word: "chip", emoji: "🍟" }, foil: { word: "ship", emoji: "🚢" } },
      { target: { word: "chop", emoji: "🪓" }, foil: { word: "shop", emoji: "🛍️" } },
    ],
  },
];

export function findPairSet(id: string): MinimalPairSet | undefined {
  return MINIMAL_PAIR_SETS.find((s) => s.id === id);
}

/**
 * The sets worth showing this child — ones reinforcing a skill in their plan,
 * or all of them if they have no plan yet.
 */
export function pairSetsForFocus(focusAreas: string[]): MinimalPairSet[] {
  if (!focusAreas || focusAreas.length === 0) return MINIMAL_PAIR_SETS;
  const inPlan = MINIMAL_PAIR_SETS.filter((s) => focusAreas.includes(s.skillId));
  return inPlan.length > 0 ? inPlan : MINIMAL_PAIR_SETS;
}
