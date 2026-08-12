/**
 * Word ↔ sound matching. Given a word and a target sound, does that word
 * actually contain the sound, and where?
 *
 * This used to live alongside the SpeechAce scorer. The scorer is gone —
 * nothing uploads audio any more — but this half never had anything to do with
 * it: /api/story uses it to pick story words that genuinely practise the
 * child's sound. Spelling-based and imperfect by design; it chooses content,
 * it never judges a child.
 */

import type { RecognitionAlternative } from "./speech";

export type TargetSound =
  | "S"
  | "R"
  | "L"
  | "SH"
  | "TH"
  | "CH"
  | "K"
  | "G"
  | "F"
  | "P"
  | "T"
  | "M"
  | "N";
export type SoundPosition = "initial" | "medial" | "final";

/**
 * Articulation hierarchy — the evidence-based progression a child works
 * through for any new sound. Each level builds on the one before it, and
 * the child must demonstrate good accuracy at one level before unlocking
 * the next.
 *
 * Sentences and conversation aren't shipped yet; they'll appear in a later
 * pass once we have content / an AI prompt loop for spontaneous use.
 */
export type LessonLevel =
  | "isolation"
  | "syllables"
  | "words"
  | "phrases"
  | "sentences";



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
    case "K":
      return [/k/, /c(?=[aou])/, /ck/];
    case "G":
      return [/g(?![h])/];
    case "F":
      return [/f/, /ph/];
    case "P":
      return [/p(?!h)/];
    case "T":
      return [/t(?!h)/];
    case "M":
      return [/m/];
    case "N":
      return [/n(?!g)/];
  }
}

export function hasTargetSound(
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
const SUBSTITUTIONS: Partial<
  Record<TargetSound, Array<{ wrong: RegExp; hint: string }>>
> = {
  R: [
    { wrong: /\bw/, hint: "I heard a W. Try roaring like a lion — rrrr!" },
  ],
  L: [
    {
      wrong: /\bw/,
      hint: "I heard a W. Lift your tongue tip up to the bumpy spot — laaa!",
    },
    { wrong: /\by/, hint: "Tip of your tongue up — laaa, not yaaa!" },
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
  SH: [{ wrong: /\bs/, hint: "Round your lips like a fish — shhhh!" }],
  CH: [
    { wrong: /\bsh/, hint: "Pop the train sound — ch ch choo!" },
    { wrong: /\bt(?!h)/, hint: "Squish T and SH together — ch!" },
  ],
  K: [
    {
      wrong: /\bt(?!h)/,
      hint: "I heard a T. Try saying it from the back of your throat — k!",
    },
  ],
  G: [
    {
      wrong: /\bd/,
      hint: "I heard a D. From the back of your throat — g!",
    },
  ],
  F: [
    { wrong: /\bp/, hint: "Top teeth on bottom lip — fffff, not p!" },
    { wrong: /\bb/, hint: "Top teeth on bottom lip — fffff, not b!" },
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
  blend: string | undefined,
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

  // For cluster-reduction lessons (e.g. "spoon"), require the full blend
  // in the heard word — saying "soon" should not get full credit even if
  // it's similar in spelling.
  const blendOk = blend
    ? heardTokens.some((tok) => tok.startsWith(blend.toLowerCase()))
    : true;

  // Did at least one heard token contain the target sound in the right slot?
  const soundOk = heardTokens.some((tok) =>
    hasTargetSound(tok, sound, position),
  );

  let combined = 0.7 * bestWord + 0.3 * (soundOk ? 1 : 0);
  if (bestWord >= 0.8 && soundOk) combined = Math.max(combined, bestWord);
  // Penalize a reduced cluster — even a perfect spelling match without the
  // blend can't earn a "great" rating.
  if (!blendOk) combined = Math.min(combined, 0.6);

  return { score: combined, matchedAgainst: bestAgainst };
}
