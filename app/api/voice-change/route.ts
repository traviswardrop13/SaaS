import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Speech-to-speech — re-voices a recording into the app's coach voice via
 * ElevenLabs Voice Changer. Rachel's SLP delivery (pacing, warmth, the way
 * she models each sound) is preserved; only the timbre becomes Sarah's.
 *
 * Guarded like /api/isolate: founder key on production, open on preview
 * deployments (unguessable URL + rate limit) for batch processing.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { key: "voice-change", limit: 60, windowSec: 3600 });
  if (rl) return rl;

  const isPreview = process.env.VERCEL_ENV === "preview";
  const want = process.env.FOUNDER_KEY || "";
  const got = req.headers.get("x-founder-key") || "";
  if (!isPreview && (!want || got !== want)) {
    return NextResponse.json({ ok: false, error: "locked" }, { status: 401 });
  }

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "no ELEVENLABS_API_KEY" }, { status: 500 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "multipart form expected" }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof File)) return NextResponse.json({ ok: false, error: "audio file required" }, { status: 400 });
  if (audio.size > 4 * 1024 * 1024) return NextResponse.json({ ok: false, error: "audio too large" }, { status: 413 });
  const voiceId = String(form.get("voice") || process.env.ELEVENLABS_VOICE_ID || "RJ94BzgbkIV3dGoYvkpb").slice(0, 40);

  const out = new FormData();
  out.append("audio", audio, audio.name || "clip.mp3");
  out.append("model_id", "eleven_multilingual_sts_v2");
  // keep her expressiveness; stay close to the target voice's timbre
  out.append("voice_settings", JSON.stringify({ stability: 0.5, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true }));

  const r = await fetch(
    `https://api.elevenlabs.io/v1/speech-to-speech/${voiceId}?output_format=mp3_44100_128`,
    { method: "POST", headers: { "xi-api-key": key }, body: out },
  );
  if (!r.ok) {
    const detail = (await r.text().catch(() => "")).slice(0, 300);
    return NextResponse.json({ ok: false, error: `voice change failed (${r.status})`, detail }, { status: 502 });
  }
  return new NextResponse(await r.arrayBuffer(), {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
