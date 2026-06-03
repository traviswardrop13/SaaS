/**
 * Scoring kid speech from the Web Speech API.
 *
 * Why this is non-trivial: browser ASR is biased toward real adult-sounding
 * words. It mishears, "corrects," and gives low confidence on short words —
 * exactly the wrong failure modes for kids practicing speech sounds.
 *
 * Strategy:
 *  1. Take ALL alternatives the recognizer returned (up to 5), not just the
 *     top one — the right answer is often buried in slot 2 or 3.
 *  2. Score every alternative against the target word AND any explicit
 *     accepted variants (homophones like "sun" / "son").
 *  3. Award a "target-sound" bonus when the recognized word at least has the
 *     target phoneme in the correct position — this is the speech-therapy
 *     mindset: we care about the sound, not perfect English.
 *  4. Weight by recognizer confidence so low-confidence guesses can't carry
 *     a result by themselves.
 *  5. If we detect a common developmental substitution in the heard speech
 *     (e.g. "wabbit" for "rabbit"), surface a phoneme-specific hint instead
 *     of a generic "try again."
 */

import type { RecognitionAlternative } from "./speech";

export type TargetSound = "S" | "R" | "L" | "SH" | "TH" | "CH";
export type SoundPosition = "initial" | "medial" | "final";

export type ScoreOptions = {
  target: string;
  accepts?: string[];
  targetSound: TargetSound;
  position: SoundPosition;
};

export type ScoreResult = {
  /** 0..1 combined score */
  similarity: number;
  rating: "great" | "ok" | "tryAgain";
  /** the accepted variant we matched best against */
  matchedAgainst: string;
  /** the alternative transcript we ended up scoring as the best */
  bestHeard: string;
  /** specific phoneme-level feedback if we detected a known substitution */
  hint?: string;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z\s']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        last + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      last = tmp;
    }
  }
  return prev[b.length];
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

/**
 * Spelling-based check for whether `word` contains the target sound in the
 * requested position. Good enough for our curated word list — every target
 * lesson uses words where the spelling reflects the sound.
 */
function patternsFor(sound: TargetSound): RegExp[] {
  switch (sound) {
    case "S":
      return [/s/];
    case "R":
      return [/r/];
    case "L":
      return [/l/];
    case "SH":
      return [/sh/, /ti(?=on)/, /ci/];
    case "TH":
      return [/th/];
    case "CH":
      return [/ch/, /tch/];
  }
}

function hasTargetSound(
  word: string,
  sound: TargetSound,
  position: SoundPosition,
): boolean {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return false;
  for (const pat of patternsFor(sound)) {
    const m = w.match(pat);
    if (!m || m.index === undefined) continue;
    const start = m.index;
    const end = start + m[0].length;
    if (position === "initial" && start === 0) return true;
    if (position === "final" && end === w.length) return true;
    if (position === "medial" && start > 0 && end < w.length) return true;
  }
  return false;
}

/**
 * Common developmental substitutions. Listed roughly in order of how often
 * they show up in early speech. The `wrong` field is a spelling pattern that
 * the recognizer would likely produce if the kid made the substitution.
 */
const SUBSTITUTIONS: Record<
  TargetSound,
  Array<{ wrong: RegExp; hint: string }>
> = {
  R: [
    {
      wrong: /\bw/,
      hint: "I heard a W. Try roaring like a lion — rrrr!",
    },
  ],
  L: [
    {
      wrong: /\bw/,
      hint: "I heard a W. Lift your tongue tip up to the bumpy spot — laaa!",
    },
    {
      wrong: /\by/,
      hint: "Try with the tip of your tongue up — laaa, not yaaa!",
    },
  ],
  TH: [
    {
      wrong: /\bf/,
      hint: "I heard an F. Stick your tongue between your teeth — th!",
    },
    {
      wrong: /\bd/,
      hint: "Tongue peeks between your teeth, not behind them — th!",
    },
  ],
  S: [
    {
      wrong: /\bth/,
      hint: "Keep your tongue behind your teeth — sss, not th!",
    },
  ],
  SH: [
    {
      wrong: /\bs/,
      hint: "Round your lips like a fish — shhhh!",
    },
  ],
  CH: [
    {
      wrong: /\bsh/,
      hint: "Pop the train sound — ch ch choo!",
    },
    {
      wrong: /\bt/,
      hint: "Squish T and SH together — ch!",
    },
  ],
};

function detectSubstitution(
  heard: string,
  sound: TargetSound,
  position: SoundPosition,
): string | undefined {
  // Only check the position the lesson is targeting. Initial-position
  // substitutions are by far the most common, and the simplest to detect
  // from spelling.
  if (position !== "initial") return undefined;
  const subs = SUBSTITUTIONS[sound] ?? [];
  for (const sub of subs) {
    if (sub.wrong.test(heard.toLowerCase())) return sub.hint;
  }
  return undefined;
}

/**
 * Score a single alternative against the targets. Combines whole-word
 * similarity with a target-sound presence bonus.
 */
function scoreOne(
  heardRaw: string,
  targets: string[],
  sound: TargetSound,
  position: SoundPosition,
): { score: number; matchedAgainst: string } {
  const heard = normalize(heardRaw);
  const heardTokens = heard.split(" ").filter(Boolean);

  let bestWord = 0;
  let bestAgainst = targets[0] ?? "";
  for (const t of targets) {
    if (heardTokens.includes(t)) {
      bestWord = 1;
      bestAgainst = t;
      break;
    }
    const whole = similarity(heard, t);
    let perToken = 0;
    for (const tok of heardTokens) {
      perToken = Math.max(perToken, similarity(tok, t));
    }
    const s = Math.max(whole, perToken);
    if (s > bestWord) {
      bestWord = s;
      bestAgainst = t;
    }
  }

  // Did at least one heard token contain the target sound in the right slot?
  const soundOk = heardTokens.some((tok) =>
    hasTargetSound(tok, sound, position),
  );

  // Combine: word match weighted more than sound presence, but if the kid's
  // word doesn't match but DOES contain the target sound (e.g. recognizer
  // misheard "soup" as "scoop"), they still get partial credit.
  let combined = 0.7 * bestWord + 0.3 * (soundOk ? 1 : 0);
  // Bonus if both signals agree.
  if (bestWord >= 0.8 && soundOk) combined = Math.max(combined, bestWord);

  return { score: combined, matchedAgainst: bestAgainst };
}

export function scoreUtterance(
  alternatives: RecognitionAlternative[],
  opts: ScoreOptions,
): ScoreResult {
  const targets = [opts.target, ...(opts.accepts ?? [])].map(normalize);

  if (alternatives.length === 0) {
    return {
      similarity: 0,
      rating: "tryAgain",
      matchedAgainst: targets[0] ?? opts.target,
      bestHeard: "",
      hint: "I didn't catch that. Tap the mic and try again!",
    };
  }

  let best: {
    score: number;
    weighted: number;
    matchedAgainst: string;
    heard: string;
  } | null = null;

  for (const alt of alternatives) {
    const { score, matchedAgainst } = scoreOne(
      alt.transcript,
      targets,
      opts.targetSound,
      opts.position,
    );
    // Confidence floors at 0.4 so a strong word-match with no confidence
    // still beats noise, but a 1.0 match at high confidence wins.
    const confidence = Math.max(0.4, alt.confidence || 0);
    const weighted = score * (0.6 + 0.4 * confidence);
    if (!best || weighted > best.weighted) {
      best = {
        score,
        weighted,
        matchedAgainst,
        heard: alt.transcript,
      };
    }
  }

  const finalScore = best!.score;
  const rating: ScoreResult["rating"] =
    finalScore >= 0.8 ? "great" : finalScore >= 0.55 ? "ok" : "tryAgain";

  let hint: string | undefined;
  if (rating !== "great") {
    hint = detectSubstitution(best!.heard, opts.targetSound, opts.position);
  }

  return {
    similarity: finalScore,
    rating,
    matchedAgainst: best!.matchedAgainst,
    bestHeard: best!.heard,
    hint,
  };
}
