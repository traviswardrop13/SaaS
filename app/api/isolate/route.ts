import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { founderKey } from "@/lib/founder";

/**
 * Voice isolation — strips room echo/noise from a recording via ElevenLabs'
 * Audio Isolation API. Used for cleaning Rachel's coaching clips before they
 * ship in the app and before voice-clone training.
 *
 * Guarded: the founder key (x-founder-key header) on every deployment,
 * previews included. No page calls it; it is a founder tool.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // The founder key on every deployment, previews included (14 Nov 2026:
  // a preview used to be open, spending the ElevenLabs key for anyone with
  // its address). Header only, constant time (lib/founder founderKey).
  const denied = founderKey(req);
  if (denied) return denied;
  const rl = await rateLimit(req, { key: "isolate", limit: 60, windowSec: 3600 });
  if (rl) return rl;

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
