/**
 * Cloud scoring client — uploads a kid's recording to our scoring API and
 * returns a kid-friendly result. The API key lives only on the server.
 *
 * Not yet wired into the lesson flow: that needs a dev build with audio
 * recording (expo-audio). This file is the contract both sides will use.
 */

import type { TargetSound } from "./scoring";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://sona-app.vercel.app";

export type CloudScore = {
  ok: boolean;
  /** primary 0..100 score the rating is based on (whole-utterance match) */
  score?: number;
  /** word/utterance-level score 0..100, or null if Speechace declined */
  overall: number | null;
  /** target-phoneme score 0..100 — the specific sound being taught */
  targetPhoneme: number | null;
  /** per-phoneme breakdown, for calibration/debug */
  phones?: { phone: string; score: number | null }[];
  rating: "great" | "ok" | "tryAgain";
  /** kid-friendly coaching line from the backend, if not a "great" */
  feedback?: string | null;
  /** what the recognizer heard */
  transcript: string;
  error?: string;
};

export async function scoreAudio(opts: {
  /** local file URI from expo-audio's recording.getURI() */
  audioUri: string;
  /** the target word/phrase, e.g. "rabbit" */
  text: string;
  targetSound?: TargetSound;
  /** stable id for the child — helps Speechace tune to the speaker */
  userId?: string;
}): Promise<CloudScore> {
  const form = new FormData();
  // React Native FormData accepts the { uri, name, type } object shape.
  form.append("audio", {
    uri: opts.audioUri,
    name: "audio.m4a",
    type: "audio/m4a",
  } as unknown as Blob);
  form.append("text", opts.text);
  if (opts.targetSound) form.append("targetSound", opts.targetSound);
  if (opts.userId) form.append("userId", opts.userId);

  try {
    console.log("[SCORE] POST", `${API_URL}/api/score`, "audio:", opts.audioUri);
    const r = await fetch(`${API_URL}/api/score`, {
      method: "POST",
      body: form,
    });
    const json = (await r.json()) as CloudScore;
    console.log("[SCORE] response", r.status, JSON.stringify(json).slice(0, 300));
    return json;
  } catch (e: any) {
    console.log("[SCORE] fetch error:", e?.message);
    return {
      ok: false,
      overall: null,
      targetPhoneme: null,
      rating: "tryAgain",
      transcript: "",
      error: e?.message ?? "Network error",
    };
  }
}
