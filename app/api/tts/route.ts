import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

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
 *   ELEVENLABS_VOICE_ID (default "qBDvhofpxp92JgXJxDjB" — the app's kid coach voice)
 *   ELEVENLABS_MODEL    (default "eleven_multilingual_v2" — natural; turbo = faster)
 *   ELEVENLABS_V3="1"   opt in to trying eleven_v3 first (different cadence)
 *   OPENAI_TTS_VOICE / OPENAI_TTS_MODEL
 */
export const runtime = "nodejs";

const PCM_HEADERS = {
  "Content-Type": "audio/L16; rate=24000; channels=1",
  "Cache-Control": "no-store",
} as const;

// Warm-instance memo + cache (module scope survives across requests on the same
// serverless instance). Kills the two biggest sources of TTS dead air:
//  1. v3Broken — once eleven_v3 rejects (account without v3 access), stop paying
//     a doomed round trip before the v2 fallback on every single call.
//  2. audioCache — the game loop repeats a small set of short prompts ("say rrrr",
//     "your turn!", praise lines) constantly; serve identical clips instantly.
let v3Broken = false;
const audioCache = new Map<string, ArrayBuffer>();
const CACHE_MAX = 48;
function cacheGet(k: string): ArrayBuffer | undefined {
  const v = audioCache.get(k);
  if (v) { audioCache.delete(k); audioCache.set(k, v); } // LRU touch
  return v;
}
function cacheSet(k: string, v: ArrayBuffer) {
  audioCache.set(k, v);
  while (audioCache.size > CACHE_MAX) audioCache.delete(audioCache.keys().next().value as string);
}

export async function POST(req: NextRequest) {
  const _rl = await rateLimit(req, { key: "tts", limit: 120, windowSec: 60 }); if (_rl) return _rl;
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
  // `stable` used to force flat v2 delivery so repeats matched — but clips are
  // cached on-device AND in the warm-instance LRU, so identical replays come
  // from the cache, not from flat generation. Every line now gets the
  // expressive path; `stable` only pins v3 to its "natural" mode.
  let stable = false;
  try {
    const b = await req.json();
    text = typeof b?.text === "string" ? b.text.slice(0, 800) : "";
    if (typeof b?.voice === "string" && b.voice) voiceOverride = b.voice;
    stable = b?.stable === true;
  } catch {
    // no body
  }
  void stable; // accepted for back-compat; v3 always runs in its "natural" mode
  if (!text.trim()) {
    return NextResponse.json({ ok: false, error: "text is required" }, { status: 400 });
  }

  try {
    if (elevenKey) {
      const voiceId =
        voiceOverride || process.env.ELEVENLABS_VOICE_ID || "qBDvhofpxp92JgXJxDjB"; // the app's kid coach voice — matches the profile default every page sends.

      // Serve a cached clip instantly (short, repeated prompts only — never long/unique story text).
      const cacheKey = `el|${voiceId}|${text}`;
      const cacheable = text.length <= 120;
      if (cacheable) { const hit = cacheGet(cacheKey); if (hit) return new NextResponse(hit.slice(0), { status: 200, headers: PCM_HEADERS }); }

      const v3Model = process.env.ELEVENLABS_V3_MODEL || "eleven_v3";
      const fallbackModel = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
      // v2 IS the app's sound — the delivery every family has heard since the
      // field tests. v3 renders the same voice with a different cadence, and a
      // plan upgrade silently unlocking it must never change the coach's voice
      // mid-week (that's how "why is the voice different?" happens). v3 stays
      // opt-in via ELEVENLABS_V3=1 until it's been listened to and chosen.
      const wantV3 = process.env.ELEVENLABS_V3 === "1";
      const attempts = [
        // v3 = the natural-cadence model; audio tags like [excited]/[whispers]
        // in the text become real delivery. Coarse stability only
        // (0=creative, 0.5=natural, 1=robust).
        ...(wantV3 ? [{ model: v3Model, settings: { stability: 0.5, use_speaker_boost: true } }] : []),
        {
          model: fallbackModel,
          settings: {
            stability: 0.5,         // mid = real intonation (0.78 was the "robot" — flat by design)
            similarity_boost: 0.85, // stay close to the voice's natural sample
            style: 0.4,             // enough style for rises/falls without getting theatrical
            speed: 1.0,             // natural pace — 0.87 smeared the rhythm into a drone
            use_speaker_boost: true,
          },
        },
      ].filter((a, i, arr) => arr.findIndex((b) => b.model === a.model) === i)
       .filter((a) => !(v3Broken && a.model === v3Model));

      let lastErr = "";
      for (const a of attempts) {
        // v3 performs [tags]; older models would read them aloud — strip.
        const sendText = a.model === v3Model ? text : text.replace(/\[[a-z ]{2,24}\]\s*/gi, "");
        const r = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_24000`,
          {
            method: "POST",
            headers: { "xi-api-key": elevenKey, "Content-Type": "application/json" },
            body: JSON.stringify({ text: sendText, model_id: a.model, voice_settings: a.settings }),
          },
        );
        if (r.ok) {
          const buf = await r.arrayBuffer();
          if (cacheable) cacheSet(cacheKey, buf);
          return new NextResponse(buf.slice(0), { status: 200, headers: PCM_HEADERS });
        }
        if (a.model === v3Model && (r.status === 400 || r.status === 401 || r.status === 403 || r.status === 404 || r.status === 422)) v3Broken = true; // account lacks v3 — stop trying it
        lastErr = `${a.model}: ${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}`;
      }
      return NextResponse.json(
        { ok: false, error: "ElevenLabs error", detail: lastErr },
        { status: 502 },
      );
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
