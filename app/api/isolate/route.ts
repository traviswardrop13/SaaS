import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Voice isolation — strips room echo/noise from a recording via ElevenLabs'
 * Audio Isolation API. Used for cleaning Rachel's coaching clips before they
 * ship in the app and before voice-clone training.
 *
 * Guarded: on production it requires the founder key; on preview deployments
 * it's open (unguessable URL, rate-limited) so clips can be processed during
 * development without extra setup.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { key: "isolate", limit: 60, windowSec: 3600 });
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
  if (audio.size > 25 * 1024 * 1024) return NextResponse.json({ ok: false, error: "audio too large" }, { status: 413 });

  const out = new FormData();
  out.append("audio", audio, audio.name || "clip.wav");

  const r = await fetch("https://api.elevenlabs.io/v1/audio-isolation", {
    method: "POST",
    headers: { "xi-api-key": key },
    body: out,
  });
  if (!r.ok) {
    const detail = (await r.text().catch(() => "")).slice(0, 300);
    return NextResponse.json({ ok: false, error: `isolation failed (${r.status})`, detail }, { status: 502 });
  }
  return new NextResponse(await r.arrayBuffer(), {
    status: 200,
    headers: { "Content-Type": r.headers.get("content-type") || "audio/mpeg", "Cache-Control": "no-store" },
  });
}
