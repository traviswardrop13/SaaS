/**
 * The "find the tricky sounds" screener — Sona's personalization engine.
 *
 * A first-time child names ~13 pictures; the mic + Speechace score each one
 * for the specific target sound. Sounds that come back low get added to the
 * child's plan. A parent can also flag sounds they already know are tricky
 * (the hybrid half). The resulting plan is just a list of `focusAreas`, which
 * the existing home path + unlock ladder already turns into a personalized,
 * level-by-level progression — so every child only sees what they need.
 *
 * This v1 runs on our current sound set (9 single sounds + 3 blend families +
 * final consonants). The probe list and plan logic expand as we add content.
 */
import { SKILLS, skillDevRank } from "./lessons";
import type { CloudScore } from "./cloudScoring";
import type { SoundPosition, TargetSound } from "./scoring";

export type Probe = {
  id: string;
  /** the word the child names (also what Leo models) */
  word: string;
  /** picture cue */
  emoji: string;
  targetSound: TargetSound;
  position: SoundPosition;
  /** which Skill this probe maps to if it comes back tricky */
  skillId: string;
  /**
   * "phoneme" = did they make the target sound at all (single sounds).
   * "full" = whole-word match, so a reduced cluster ("soon" for "spoon") or a
   * dropped ending ("cu" for "cup") scores low and is correctly flagged.
   */
  mode: "phoneme" | "full";
};

/**
 * One representative, easily-pictured probe per skill. The cluster and final
 * probes double as process detectors (cluster reduction, final consonant
 * deletion); the K/G probes expose fronting.
 */
export const SCREENER_PROBES: Probe[] = [
  { id: "pr-k", word: "cat", emoji: "🐱", targetSound: "K", position: "initial", skillId: "k-sounds", mode: "phoneme" },
  { id: "pr-g", word: "goat", emoji: "🐐", targetSound: "G", position: "initial", skillId: "g-sounds", mode: "phoneme" },
  { id: "pr-f", word: "fish", emoji: "🐟", targetSound: "F", position: "initial", skillId: "f-sounds", mode: "phoneme" },
  { id: "pr-final", word: "cup", emoji: "☕", targetSound: "P", position: "final", skillId: "final-sounds", mode: "full" },
  { id: "pr-s", word: "sun", emoji: "☀️", targetSound: "S", position: "initial", skillId: "s-sounds", mode: "phoneme" },
  { id: "pr-l", word: "lion", emoji: "🦁", targetSound: "L", position: "initial", skillId: "l-sounds", mode: "phoneme" },
  { id: "pr-sh", word: "ship", emoji: "🚢", targetSound: "SH", position: "initial", skillId: "sh-sounds", mode: "phoneme" },
  { id: "pr-ch", word: "cheese", emoji: "🧀", targetSound: "CH", position: "initial", skillId: "ch-sounds", mode: "phoneme" },
  { id: "pr-sblend", word: "spoon", emoji: "🥄", targetSound: "S", position: "initial", skillId: "s-blends", mode: "full" },
  { id: "pr-lblend", word: "flower", emoji: "🌸", targetSound: "L", position: "initial", skillId: "l-blends", mode: "full" },
  { id: "pr-z", word: "zebra", emoji: "🦓", targetSound: "Z", position: "initial", skillId: "z-sounds", mode: "phoneme" },
  { id: "pr-v", word: "van", emoji: "🚐", targetSound: "V", position: "initial", skillId: "v-sounds", mode: "phoneme" },
  { id: "pr-j", word: "juice", emoji: "🧃", targetSound: "J", position: "initial", skillId: "j-sounds", mode: "phoneme" },
  { id: "pr-r", word: "rabbit", emoji: "🐰", targetSound: "R", position: "initial", skillId: "r-sounds", mode: "phoneme" },
  { id: "pr-th", word: "thumb", emoji: "👍", targetSound: "TH", position: "initial", skillId: "th-sounds", mode: "phoneme" },
  { id: "pr-rblend", word: "tree", emoji: "🌳", targetSound: "R", position: "initial", skillId: "r-blends", mode: "full" },
];

export type ProbeResult = {
  probeId: string;
  skillId: string;
  /** 0..100, or null if it couldn't be scored (no speech / network) */
  score: number | null;
  /** below threshold → goes in the plan */
  tricky: boolean;
  /** true when we never got a usable score (skipped or failed) */
  unknown: boolean;
};

/** A target scoring under this (out of 100) is treated as needing practice. */
export const TRICKY_THRESHOLD = 70;

/** Turn one probe's cloud score into a pass/needs-practice result. */
export function evaluateProbe(probe: Probe, cloud: CloudScore | null): ProbeResult {
  if (!cloud || !cloud.ok) {
    return { probeId: probe.id, skillId: probe.skillId, score: null, tricky: false, unknown: true };
  }
  // Phoneme probes judge the specific target sound; full probes judge the
  // whole word (so reductions/deletions count against it).
  const raw =
    probe.mode === "phoneme"
      ? cloud.targetPhoneme ?? cloud.score ?? null
      : cloud.score ?? cloud.phoneAvg ?? null;
  if (raw == null) {
    return { probeId: probe.id, skillId: probe.skillId, score: null, tricky: false, unknown: true };
  }
  return {
    probeId: probe.id,
    skillId: probe.skillId,
    score: raw,
    tricky: raw < TRICKY_THRESHOLD,
    unknown: false,
  };
}

/** Record a child "skipped" a probe (wouldn't say it) — counts as unknown. */
export function skippedResult(probe: Probe): ProbeResult {
  return { probeId: probe.id, skillId: probe.skillId, score: null, tricky: false, unknown: true };
}

/**
 * Build the personalized plan: the union of AI-flagged tricky skills and any
 * skills the parent flagged, ordered easiest-first by developmental norm so a
 * young child starts with achievable sounds before late ones (R, TH).
 */
export function buildPlan(
  results: ProbeResult[],
  parentFlaggedSkillIds: string[],
): string[] {
  const set = new Set<string>();
  for (const r of results) if (r.tricky) set.add(r.skillId);
  for (const sid of parentFlaggedSkillIds) set.add(sid);
  // Keep only ids we actually have skills for.
  const valid = Array.from(set).filter((id) => SKILLS.some((s) => s.id === id));
  return valid.sort((a, b) => skillDevRank(a) - skillDevRank(b));
}

/** Did the AI portion produce any usable scores at all? */
export function hasUsableScores(results: ProbeResult[]): boolean {
  return results.some((r) => !r.unknown);
}
