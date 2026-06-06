/**
 * Session planner — turns a child's plan into an ordered list of target words
 * for a live "Session with Leo". Pulls word-level practice from the skills in
 * their focus plan (or all skills if unscreened), prioritizing skills that
 * aren't mastered yet, and round-robins across skills so a session feels
 * varied rather than 8 R-words in a row.
 */
import type { Child } from "./store";
import { visibleSkills } from "./store";
import type { TargetSound, SoundPosition } from "./scoring";

export type SessionTarget = {
  word: string;
  emoji?: string;
  targetSound: TargetSound;
  position: SoundPosition;
  skillId: string;
  /** "phoneme" for isolation-style, "full" otherwise — matches lesson scoring */
  mode: "phoneme" | "full";
};

export type SessionLength = "quick" | "full";
export const SESSION_WORDS: Record<SessionLength, number> = {
  quick: 6,
  full: 12,
};

export function buildSession(child: Child, length: SessionLength): SessionTarget[] {
  const skills = visibleSkills(child);
  // For each skill, gather word-level items (the meat of articulation practice).
  const perSkill: SessionTarget[][] = skills.map((skill) => {
    const out: SessionTarget[] = [];
    for (const lesson of skill.lessons) {
      if (lesson.level !== "words") continue;
      for (const w of lesson.words) {
        out.push({
          word: w.text,
          emoji: w.emoji,
          targetSound: lesson.targetSound,
          position: lesson.position,
          skillId: skill.id,
          mode: "full",
        });
      }
    }
    return shuffle(out);
  });

  // Round-robin across skills until we hit the target count.
  const want = SESSION_WORDS[length];
  const picked: SessionTarget[] = [];
  let added = true;
  while (picked.length < want && added) {
    added = false;
    for (const list of perSkill) {
      if (list.length === 0) continue;
      const next = list.shift();
      if (next) {
        picked.push(next);
        added = true;
        if (picked.length >= want) break;
      }
    }
  }
  return picked;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
