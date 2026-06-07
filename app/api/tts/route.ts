import { NextRequest, NextResponse } from "next/server";

/**
 * Text-to-speech for the live coach (LITE avatar path).
 *
 * Returns raw PCM audio — 24 kHz, 16-bit signed, mono — which is exactly the
 * format LiveAvatar's `repeatAudio()` expects, and exactly what OpenAI's TTS
 * `response_format: "pcm"` produces. The browser converts these bytes to a
 * binary string and hands them to the avatar to lip-sync.
 *
 * This is the seam that keeps us vendor-independent: the avatar only renders a
 * face; the words (Claude) and the voice (here) are ours. Swap the provider
 * below (e.g. ElevenLabs `pcm_24000`) without touching the client.
 *
 * Needs env: OPENAI_API_KEY. Optional: OPENAI_TTS_MODEL, OPENAI_TTS_VOICE.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Server is missing OPENAI_API_KEY." },
      { status: 500 },
    );
  }

  let text = "";
  let voice = process.env.OPENAI_TTS_VOICE || "shimmer";
  try {
    const b = await req.json();
    text = typeof b?.text === "string" ? b.text.slice(0, 800) : "";
    if (typeof b?.voice === "string" && b.voice) voice = b.voice;
  } catch {
    // no body
  }
  if (!text.trim()) {
    return NextResponse.json({ ok: false, error: "text is required" }, { status: 400 });
  }

  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";

  try {
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice, // warm, friendly female by default ("shimmer")
        input: text,
        response_format: "pcm", // 24kHz, 16-bit signed, mono — matches LiveAvatar
        // a gentle, encouraging children's-coach delivery (supported by gpt-4o-mini-tts)
        instructions:
          "You are a warm, upbeat speech coach for a young child. Speak slowly and clearly, gently emphasizing target sounds, with a friendly, encouraging tone.",
      }),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `TTS provider error (${r.status})`, detail: detail.slice(0, 500) },
        { status: 502 },
      );
    }

    const audio = await r.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: {
        // raw little-endian 16-bit PCM @ 24kHz, mono
        "Content-Type": "audio/L16; rate=24000; channels=1",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "TTS request failed." },
      { status: 502 },
    );
  }
}
