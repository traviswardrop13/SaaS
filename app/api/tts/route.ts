import { NextRequest, NextResponse } from "next/server";

/**
 * Text-to-speech for the live coach (LITE avatar path).
 *
 * Returns raw PCM audio — 24 kHz, 16-bit signed, mono — which is exactly the
 * format LiveAvatar's `repeatAudio()` expects. The browser turns these bytes
 * into a binary string and hands them to the avatar to lip-sync.
 *
 * Provider auto-selects by which key is set (ElevenLabs preferred for warmth):
 *   - ELEVENLABS_API_KEY  -> ElevenLabs (pcm_24000)
 *   - OPENAI_API_KEY      -> OpenAI TTS (pcm)
 *
 * This is the vendor-independence seam: the avatar only renders a face; the
 * words (Claude) and the voice (here) are ours, and swappable.
 *
 * Optional env:
 *   ELEVENLABS_VOICE_ID (default "21m00Tcm4TlvDq8ikWAM" — Rachel, warm female)
 *   ELEVENLABS_MODEL    (default "eleven_turbo_v2_5" — low latency)
 *   OPENAI_TTS_VOICE / OPENAI_TTS_MODEL
 */
export const runtime = "nodejs";

const PCM_HEADERS = {
  "Content-Type": "audio/L16; rate=24000; channels=1",
  "Cache-Control": "no-store",
} as const;

export async function POST(req: NextRequest) {
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!elevenKey && !openaiKey) {
    return NextResponse.json(
      { ok: false, error: "Server is missing ELEVENLABS_API_KEY (or OPENAI_API_KEY)." },
      { status: 500 },
    );
  }

  let text = "";
  let voiceOverride: string | undefined;
  try {
    const b = await req.json();
    text = typeof b?.text === "string" ? b.text.slice(0, 800) : "";
    if (typeof b?.voice === "string" && b.voice) voiceOverride = b.voice;
  } catch {
    // no body
  }
  if (!text.trim()) {
    return NextResponse.json({ ok: false, error: "text is required" }, { status: 400 });
  }

  try {
    if (elevenKey) {
      const voiceId =
        voiceOverride || process.env.ELEVENLABS_VOICE_ID || "RJ94BzgbkIV3dGoYvkpb"; // Sona brand voice
      const model = process.env.ELEVENLABS_MODEL || "eleven_turbo_v2_5";
      const r = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_24000`,
        {
          method: "POST",
          headers: { "xi-api-key": elevenKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            model_id: model,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
            },
          }),
        },
      );
      if (!r.ok) {
        const detail = await r.text().catch(() => "");
        return NextResponse.json(
          {
            ok: false,
            error: `ElevenLabs error (${r.status})`,
            // pcm_24000 output needs a paid ElevenLabs plan — surfaced here if so
            detail: detail.slice(0, 500),
          },
          { status: 502 },
        );
      }
      return new NextResponse(await r.arrayBuffer(), { status: 200, headers: PCM_HEADERS });
    }

    // Fallback: OpenAI TTS (pcm = 24kHz/16-bit/mono)
    const voice = voiceOverride || process.env.OPENAI_TTS_VOICE || "shimmer";
    const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, voice, input: text, response_format: "pcm" }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `OpenAI TTS error (${r.status})`, detail: detail.slice(0, 500) },
        { status: 502 },
      );
    }
    return new NextResponse(await r.arrayBuffer(), { status: 200, headers: PCM_HEADERS });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "TTS request failed." },
      { status: 502 },
    );
  }
}
