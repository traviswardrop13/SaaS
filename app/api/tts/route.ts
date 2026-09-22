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

const VOICE_REVISION = "v7";
const VENDOR_TIMEOUT_MS = 6000; // leave room inside the browser's seven-second timeout
const DEFAULT_ELEVEN_VOICE = "qBDvhofpxp92JgXJxDjB";
const OPENAI_VOICES = new Set([
  "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx",
  "sage", "shimmer", "verse", "marin", "cedar",
]);
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

function elevenConfig() {
  const v3Model = process.env.ELEVENLABS_V3_MODEL || "eleven_v3";
  return {
    voiceId: process.env.ELEVENLABS_VOICE_ID || DEFAULT_ELEVEN_VOICE,
    v3Model,
    fallbackModel: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
    wantV3: process.env.ELEVENLABS_V3 === "1",
    speed: Math.min(1.05, Math.max(0.85, parseFloat(process.env.ELEVENLABS_SPEED || "") || 0.93)),
  };
}
function elevenSettings(model: string, config: ReturnType<typeof elevenConfig>): Record<string, number | boolean> {
  // v3 supports coarse stability; speaker boost, similarity and speed are not supported.
  if (model === config.v3Model || model === "eleven_v3") return { stability: 0.5 };
  return {
    stability: 0.55,
    similarity_boost: 0.85,
    style: 0.3,
    speed: config.speed,
    use_speaker_boost: true,
  };
}
function openaiVoice(requested?: string) {
  // Pages send the child's ElevenLabs profile voice. It is not an OpenAI voice.
  return requested && OPENAI_VOICES.has(requested)
    ? requested : process.env.OPENAI_TTS_VOICE || "shimmer";
}
function voiceHeaders(provider: string, model: string, cache: "hit" | "miss" = "miss") {
  return {
    "X-Sona-Voice-Provider": provider,
    "X-Sona-Voice-Model": model,
    "X-Sona-Voice-Cache": cache,
    "X-Sona-Voice-Revision": VOICE_REVISION,
  };
}
function pcmResponse(buf: ArrayBuffer, provider: string, model: string, cache: "hit" | "miss" = "miss") {
  // A successful HTTP status with no PCM must never be cached or look like speech.
  if (!buf.byteLength || buf.byteLength % 2) throw new Error("Invalid PCM response");
  return new NextResponse(buf.slice(0), {
    status: 200, headers: { ...PCM_HEADERS, ...voiceHeaders(provider, model, cache) },
  });
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, { key: "tts", limit: 120, windowSec: 60 });
  if (limited) return limited;
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!elevenKey && !openaiKey) {
    return NextResponse.json(
      { ok: false, error: "Speech service is not configured." },
      { status: 500, headers: voiceHeaders("none", "none") },
    );
  }

  let text = "";
  let voiceOverride: string | undefined;
  try {
    const b = await req.json();
    text = typeof b?.text === "string" ? b.text.slice(0, 800) : "";
    if (typeof b?.voice === "string" && b.voice) voiceOverride = b.voice;
    // `stable` remains accepted for old clients; it no longer changes delivery.
  } catch {
    // no body
  }
  if (!text.trim()) {
    return NextResponse.json({ ok: false, error: "text is required" }, { status: 400 });
  }

  const provider = elevenKey ? "elevenlabs" : "openai";
  let model = "none";
  // One budget includes all vendor attempts and response-body reads. A v3
  // fallback cannot start another full timeout after the browser has given up.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VENDOR_TIMEOUT_MS);
  try {
    if (elevenKey) {
      const config = elevenConfig();
      const voiceId = voiceOverride || config.voiceId;
      // Keep the existing v2 voice and delivery until an intentional listening
      // review chooses otherwise. v3 is still an explicit environment opt-in.
      const attempts = [
        ...(config.wantV3 ? [config.v3Model] : []),
        config.fallbackModel,
      ].filter((candidate, i, arr) => arr.indexOf(candidate) === i)
       .filter((candidate) => !(v3Broken && candidate === config.v3Model));

      let lastStatus: number | undefined;
      for (model of attempts) {
        const isV3 = model === config.v3Model || model === "eleven_v3";
        const settings = elevenSettings(model, config);
        // v3 performs [tags]; older models would read them aloud — strip.
        const sendText = isV3 ? text : text.replace(/\[[a-z ]{2,24}\]\s*/gi, "");
        if (!sendText.trim()) {
          return NextResponse.json({ ok: false, error: "text is required" }, { status: 400 });
        }
        // Key by exactly what is synthesized, including the actual attempted
        // model. Changing delivery settings must never replay an older clip.
        const cacheKey = JSON.stringify([VOICE_REVISION, provider, voiceId, model, settings, sendText, "pcm_24000"]);
        const cacheable = sendText.length <= 120;
        if (cacheable) {
          const hit = cacheGet(cacheKey);
          if (hit) return pcmResponse(hit, provider, model, "hit");
        }
        const r = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_24000`,
          {
            method: "POST",
            headers: { "xi-api-key": elevenKey, "Content-Type": "application/json" },
            body: JSON.stringify({ text: sendText, model_id: model, voice_settings: settings }),
            signal: controller.signal,
          },
        );
        if (r.ok) {
          const buf = await r.arrayBuffer();
          const response = pcmResponse(buf, provider, model);
          if (cacheable) cacheSet(cacheKey, buf);
          return response;
        }
        if (isV3 && [400, 401, 403, 404, 422].includes(r.status)) v3Broken = true;
        lastStatus = r.status;
        // Vendor bodies can contain account details. Never forward them.
        void r.body?.cancel().catch(() => {});
        if (controller.signal.aborted) throw new Error("Speech timeout");
      }
      return NextResponse.json(
        { ok: false, error: "ElevenLabs speech request failed.", ...(lastStatus ? { vendorStatus: lastStatus } : {}) },
        { status: 502, headers: voiceHeaders(provider, model) },
      );
    }

    // Fallback when only OpenAI is configured (pcm = 24kHz/16-bit/mono).
    const voice = openaiVoice(voiceOverride);
    model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, voice, input: text, response_format: "pcm" }),
      signal: controller.signal,
    });
    if (!r.ok) {
      void r.body?.cancel().catch(() => {});
      return NextResponse.json(
        { ok: false, error: "OpenAI speech request failed.", vendorStatus: r.status },
        { status: 502, headers: voiceHeaders(provider, model) },
      );
    }
    return pcmResponse(await r.arrayBuffer(), provider, model);
  } catch {
    return NextResponse.json(
      { ok: false, error: controller.signal.aborted ? "Speech request timed out." : "Speech request failed." },
      { status: controller.signal.aborted ? 504 : 502, headers: voiceHeaders(provider, model) },
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Configuration health only: GET never synthesizes or proves vendor access. */
export async function GET() {
  const hasElevenLabsKey = Boolean(process.env.ELEVENLABS_API_KEY);
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
  const provider = hasElevenLabsKey ? "elevenlabs" : hasOpenAIKey ? "openai" : "none";
  const config = elevenConfig();
  const model = provider === "elevenlabs"
    ? (config.wantV3 ? config.v3Model : config.fallbackModel)
    : provider === "openai" ? process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts" : null;
  return NextResponse.json({
    ok: true,
    service: "tts",
    configured: provider !== "none",
    synthesisVerified: false,
    provider,
    revision: VOICE_REVISION,
    hasElevenLabsKey,
    hasOpenAIKey,
    voiceId: provider === "elevenlabs" ? config.voiceId : provider === "openai" ? openaiVoice() : null,
    model,
    fallbackModel: provider === "elevenlabs" ? config.fallbackModel : null,
    v3OptIn: provider === "elevenlabs" && config.wantV3,
    settings: provider === "elevenlabs" && model ? elevenSettings(model, config) : null,
    hint: "Configuration only; a successful POST is required to verify synthesis. POST {text, voice?}; an eligible requested/profile voice overrides this configured default.",
  }, { headers: voiceHeaders(provider, model || "none") });
}
