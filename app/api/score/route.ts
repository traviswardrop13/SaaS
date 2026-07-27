import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Speechace scoring proxy.
 *
 * The mobile app uploads the kid's recording here; this route forwards it to
 * Speechace's scoring API using a server-side key (never sent to the device),
 * then normalizes the response down to what the lesson screen actually needs.
 *
 * Expected multipart fields from the client:
 *   - `audio`         (file)   the kid's recording
 *   - `text`          (string) the target word or phrase, e.g. "rabbit"
 *   - `targetSound`   (string) one of S/R/L/SH/TH/THV/CH/K/G/F/Z/V/J/P/T/M/N (optional)
 *   - `userId`        (string) stable id for the child (helps Speechace tune)
 *
 * Response shape (kid-friendly, framework-agnostic):
 *   {
 *     ok: true,
 *     overall: 0..100,            // word-level score
 *     targetPhoneme: 0..100|null, // score for the target sound specifically
 *     rating: "great" | "ok" | "tryAgain",
 *     transcript: string,         // what Speechace heard
 *     raw: { ... }                // full Speechace payload for debugging
 *   }
 */

const SPEECHACE_URL =
  "https://api.speechace.co/api/scoring/text/v9/json";

// Map of our internal sound codes to the phoneme labels Speechace returns.
// Speechace uses ARPAbet-style labels — single phones for most, digraphs for
// the others. We compare case-insensitively and ignore stress digits.
// INVARIANT: every entry in Sona.ALL_SOUNDS (public/sona.js) must have a key
// here. A missing one silently force-fails every attempt at that sound (the
// child is marked wrong for a correct production, and the ladder never
// advances) — B and D were missing for exactly that reason. tests/soundmap.mjs
// asserts this map stays in sync; add the sound to BOTH places or neither.
const PHONEME_FOR: Record<string, string[]> = {
  S: ["S"],
  R: ["R"],
  L: ["L"],
  SH: ["SH"],
  TH: ["TH"],
  THV: ["DH"],
  CH: ["CH"],
  K: ["K"],
  G: ["G"],
  F: ["F"],
  Z: ["Z"],
  V: ["V"],
  J: ["JH"],
  P: ["P"],
  T: ["T"],
  M: ["M"],
  N: ["N"],
  B: ["B"],
  D: ["D"],
};

// Scoring thresholds — tunable knobs.
// Calibrated against real Speechace responses for the R-isolation lesson:
//   "rah"     → word 67 / R 99   → all phones ≈ 80+ avg  → great
//   "ree"     → word 67 / R 98   → R high but AH weak    → tryAgain
//   "rye"     → word 34 / R 60   → both phones weak      → tryAgain
// The discriminator that actually works is the *average* phoneme score
// across the prompt's phones — Speechace's word-level quality_score is too
// lenient for vowel substitutions (rah and ree both yielded 67), while the
// target-phoneme score alone is too forgiving (any R word scores R ~98).
const GREAT = 75;
const OK = 50;
const PHONEME_MIN = 55;

function rate(opts: {
  score: number;
  overall: number | null;
  targetPhoneme: number | null;
  targetSound: string | null;
  text: string;
}): { rating: "great" | "ok" | "tryAgain"; feedback: string | null } {
  const { score, targetPhoneme, targetSound, text } = opts;
  const sound = targetSound ?? "sound";

  // Honest gating for clinician trust: never confidently pass unless the TARGET
  // sound was actually heard. "great" needs the target strong; "ok" needs it at
  // least detected; if the scorer couldn't confirm the target at all, it's
  // "tryAgain" (no benefit-of-the-doubt pass). With no specific target set, fall
  // back to the overall score.
  const targetStrong = targetSound == null || (targetPhoneme != null && targetPhoneme >= PHONEME_MIN);
  const targetHeard = targetSound == null || targetPhoneme != null;
  let rating: "great" | "ok" | "tryAgain";
  if (score >= GREAT && targetStrong) {
    rating = "great";
  } else if (score >= OK && targetHeard) {
    rating = "ok";
  } else {
    rating = "tryAgain";
  }

  let feedback: string | null = null;
  if (rating !== "great") {
    if (targetSound != null && targetPhoneme == null) {
      // Couldn't confirm the target sound at all — don't pretend it was right.
      feedback = `I didn't quite hear the ${sound} sound — listen, then try again!`;
    } else if (targetPhoneme != null && targetPhoneme < PHONEME_MIN) {
      // The target sound itself was weak.
      feedback = `Let's work on the ${sound} sound — listen, then say "${text}" again!`;
    } else {
      // Target sound was fine but the whole syllable didn't match (e.g. said
      // "ree" for "rah") — nudge toward the exact prompt.
      feedback = `Good ${sound}! Now say the whole sound: "${text}".`;
    }
  }
  return { rating, feedback };
}

type SpeechacePhone = { phone?: string; quality_score?: number };
type SpeechaceWord = {
  word?: string;
  quality_score?: number;
  phone_score_list?: SpeechacePhone[];
};

function pickTargetPhonemeScore(
  words: SpeechaceWord[],
  targetSound: string | null,
): number | null {
  if (!targetSound) return null;
  const labels = PHONEME_FOR[targetSound.toUpperCase()];
  if (!labels) return null;
  // Best (highest) target-phoneme score across all words — if the kid says
  // "rabbit," there's only one R; if they say "round red," we take the
  // strongest one so a single mumble doesn't tank the score.
  let best: number | null = null;
  for (const w of words) {
    for (const p of w.phone_score_list ?? []) {
      const phone = (p.phone ?? "").toUpperCase().replace(/[0-9]/g, "");
      if (!labels.includes(phone)) continue;
      const s = p.quality_score;
      if (typeof s !== "number") continue;
      if (best === null || s > best) best = s;
    }
  }
  return best;
}

/**
 * Lightweight health check. Open this URL in a browser (a GET request) to
 * confirm the route is deployed and whether the Speechace key is configured.
 * Never returns the key itself — just whether it's present.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "score",
    hasKey: Boolean(process.env.SPEECHACE_API_KEY),
    hint: "POST audio + text here to score pronunciation.",
  });
}

export async function POST(req: NextRequest) {
  const _rl = await rateLimit(req, { key: "score", limit: 120, windowSec: 60 }); if (_rl) return _rl;
  const key = process.env.SPEECHACE_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Server is missing SPEECHACE_API_KEY." },
      { status: 500 },
    );
  }

  let inForm: FormData;
  try {
    inForm = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected multipart/form-data." },
      { status: 400 },
    );
  }

  const audio = inForm.get("audio");
  const text = (inForm.get("text") as string | null)?.trim();
  const targetSound = (inForm.get("targetSound") as string | null)?.trim() || null;
  const userId = (inForm.get("userId") as string | null)?.trim() || "anonymous";
  const mode =
    (inForm.get("mode") as string | null)?.trim() === "phoneme"
      ? "phoneme"
      : "full";

  if (!(audio instanceof Blob) || !text) {
    return NextResponse.json(
      { ok: false, error: "audio file and text are required." },
      { status: 400 },
    );
  }

  // A sound we can't measure must fail LOUDLY, never quietly. Without this the
  // phoneme lookup returns null, targetHeard goes false, and the round is rated
  // "tryAgain" — a fabricated miss logged against a child who said it right.
  // ok:false makes every caller fall through to its "unknown" branch, which is
  // never written to the attempt log.
  if (targetSound && !PHONEME_FOR[targetSound.toUpperCase()]) {
    console.error("[score] no phoneme mapping for targetSound=" + targetSound + " — add it to PHONEME_FOR");
    return NextResponse.json(
      { ok: false, error: "unscorable-sound", targetSound },
      { status: 422 },
    );
  }

  // Speechace wants the key + dialect + user_id as query params, and the audio
  // + text as multipart fields.
  const url = `${SPEECHACE_URL}?key=${encodeURIComponent(
    key,
  )}&dialect=en-us&user_id=${encodeURIComponent(userId)}`;

  const outForm = new FormData();
  outForm.append("text", text);
  outForm.append(
    "user_audio_file",
    audio,
    (audio as File).name || "audio.m4a",
  );

  let raw: any;
  try {
    const r = await fetch(url, { method: "POST", body: outForm });
    raw = await r.json();
    if (!r.ok || raw.status === "error") {
      return NextResponse.json(
        {
          ok: false,
          error: raw?.short_message || raw?.detail_message || "Scoring failed.",
          raw,
        },
        { status: 502 },
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Network error talking to Speechace." },
      { status: 502 },
    );
  }

  // Speechace's v9 response nests the score under text_score.
  const ts = raw.text_score ?? {};
  const overall =
    typeof ts.quality_score === "number" ? ts.quality_score : null;
  const words: SpeechaceWord[] = Array.isArray(ts.word_score_list)
    ? ts.word_score_list
    : [];
  const targetPhoneme = pickTargetPhonemeScore(words, targetSound);
  const transcript = words
    .map((w) => w.word)
    .filter(Boolean)
    .join(" ");

  // Compact per-phoneme breakdown — handy for tuning and on-device debugging.
  const phones = words.flatMap((w) =>
    (w.phone_score_list ?? []).map((p) => ({
      phone: (p.phone ?? "").toUpperCase().replace(/[0-9]/g, ""),
      score:
        typeof p.quality_score === "number" ? Math.round(p.quality_score) : null,
    })),
  );

  // Speechace also returns a word-level quality_score; useful as a fallback
  // and visible in debug for comparison.
  const wordAvg = (() => {
    const scs = words
      .map((w) => w.quality_score)
      .filter((s): s is number => typeof s === "number");
    return scs.length
      ? Math.round(scs.reduce((a, b) => a + b, 0) / scs.length)
      : null;
  })();

  // Average ALL expected phonemes. This is the right primary signal: when a
  // kid says "ree" for "rah", R scores ~98 but AH scores low, so the average
  // (~50–60) tells us the prompt as a whole wasn't matched — unlike the word
  // score (67 for both) or the target-phoneme score (always ~98 for an R).
  const phoneAvg = (() => {
    const scs = phones
      .map((p) => p.score)
      .filter((s): s is number => typeof s === "number");
    return scs.length
      ? Math.round(scs.reduce((a, b) => a + b, 0) / scs.length)
      : null;
  })();

  // "phoneme" mode (isolation): lenient — did the child make the target
  // sound at all? Score on the target phoneme. "full" mode (syllables+):
  // strict — the whole utterance must match, so average all phonemes.
  // "full" mode (words+): weight the TARGET sound heavily — articulation practice is
  // about the target phoneme, not the incidental ones. A kid who nails the R in
  // "rabbit" but has a still-developing B/T should pass on R; a w-for-r substitution
  // (weak R) should fail. Blend 70% target + 30% overall intelligibility so they
  // can't pass by mumbling. "phoneme" mode (isolation) stays lenient.
  const TARGET_WEIGHT = 0.7;
  const wordScore = phoneAvg ?? overall ?? wordAvg ?? 0;
  const score =
    mode === "phoneme"
      ? // Honest: only credit the rep when SpeechAce actually heard the TARGET
        // sound. If it can't confirm the target, score 0 → "tryAgain" (no false
        // "Great!" for noise or an unparseable/wrong production).
        (targetPhoneme != null ? targetPhoneme : 0)
      : targetPhoneme != null
        ? Math.round(TARGET_WEIGHT * targetPhoneme + (1 - TARGET_WEIGHT) * wordScore)
        : (wordScore || targetPhoneme || 0);
  const { rating, feedback } = rate({
    score,
    overall,
    targetPhoneme,
    targetSound,
    text,
  });

  return NextResponse.json({
    ok: true,
    mode,
    score: Math.round(score),
    overall,
    wordAvg,
    phoneAvg,
    targetPhoneme,
    phones,
    rating,
    feedback,
    transcript,
    raw,
  });
}
