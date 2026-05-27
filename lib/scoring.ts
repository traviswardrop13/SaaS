/**
 * Tiny fuzzy match for kid speech. We compare the recognized transcript
 * against the target word and any accepted variants, normalize both, and
 * use a Levenshtein-based similarity. Kids slur and recognizers mishear,
 * so we are forgiving.
 */

export type ScoreResult = {
  /** 0..1 similarity */
  similarity: number;
  /** "great" >=0.8, "ok" >=0.55, "tryAgain" otherwise */
  rating: "great" | "ok" | "tryAgain";
  /** the closest accepted form we matched against */
  matchedAgainst: string;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
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

export function scoreUtterance(
  transcript: string,
  target: string,
  accepts: string[] = [],
): ScoreResult {
  const heard = normalize(transcript);
  const targets = [target, ...accepts].map(normalize);

  // If the kid said a phrase containing the target word, count that as a great match.
  const heardTokens = heard.split(" ");
  for (const t of targets) {
    if (heardTokens.includes(t)) {
      return { similarity: 1, rating: "great", matchedAgainst: t };
    }
  }

  let best = { sim: 0, against: targets[0] ?? target };
  for (const t of targets) {
    // Try whole-utterance similarity and best per-token similarity.
    const whole = similarity(heard, t);
    let perToken = 0;
    for (const tok of heardTokens) {
      perToken = Math.max(perToken, similarity(tok, t));
    }
    const s = Math.max(whole, perToken);
    if (s > best.sim) best = { sim: s, against: t };
  }

  const rating: ScoreResult["rating"] =
    best.sim >= 0.8 ? "great" : best.sim >= 0.55 ? "ok" : "tryAgain";

  return { similarity: best.sim, rating, matchedAgainst: best.against };
}
