import { NextRequest, NextResponse } from "next/server";

/**
 * Speech-to-text for the app's listening side (the call + lesson fallback).
 *
 * Browsers' built-in SpeechRecognition is unreliable on iOS, so clients record
 * the child's turn (MediaRecorder) and post the audio here; we transcribe with
 * ElevenLabs Scribe using the same ELEVENLABS_API_KEY the voice already uses.
 *
 * Request:  multipart/form-data with `audio` (the recording)
 * Response: { ok: true, text } | { ok: false, error }
 */
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // a 5-min call turn is far below this

export async function POST(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Server is missing ELEVENLABS_API_KEY." },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Expected multipart form data." }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ ok: false, error: "audio file is required." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "audio too large." }, { status: 413 });
  }

  try {
    const out = new FormData();
    out.append("file", audio, (audio as File).name || "turn.m4a");
    out.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v1");
    out.append("language_code", "en");
    out.append("tag_audio_events", "false");

    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: out,
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `STT error (${r.status})`, detail: detail.slice(0, 300) },
        { status: 502 },
      );
    }
    const j = (await r.json()) as { text?: string };
    return NextResponse.json({ ok: true, text: (j.text || "").trim() });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "STT request failed." },
      { status: 502 },
    );
  }
}
