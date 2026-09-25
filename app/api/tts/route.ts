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

// v8 (24 Sep 2026): every clip is now loudness-levelled (levelPcm below) and
// made with calmer settings and a fixed seed. Bumped together with
// TTS_CACHE_VERSION in public/sona.js — the phone keys its saved clips by that
// value, so bumping only one side leaves families replaying the old, unlevelled,
// excitable takes forever.
const VOICE_REVISION = "v8";
const VENDOR_TIMEOUT_MS = 6000; // leave room inside the browser's seven-second timeout
const DEFAULT_ELEVEN_VOICE = "qBDvhofpxp92JgXJxDjB";
const OPENAI_VOICES = new Set([
  "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx",
  "sage", "shimmer", "verse", "marin", "cedar",
]);
// One fixed ElevenLabs seed for every request (24 Sep 2026). Without it each
// phone got its own random take of the same line, so a child heard "Nice one."
// in a slightly different voice from one day to the next and a bad take lived
// on that one device forever. Same text + same settings + same seed = the same
// recording everywhere (ElevenLabs calls this best-effort determinism). It is
// part of the cache key, so changing it can never replay an older take.
const VOICE_SEED = 20260924;
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
  // A CALMER VOICE (Travis, 24 Sep 2026: "relaxed and sweet, like talking to a
  // little kid"). style 0.3 exaggerated every line and stability 0.55 let the
  // pitch and energy jump, which was the "jumpy, explosive" sound. style 0 and
  // stability 0.7 steady it; 0.78 was logged as robotic in 7d286f9, so not
  // higher. similarity_boost and speed stay exactly where they were: speed is
  // also the rate of the practice word the child copies, so it is Rachel's
  // call, and similarity is the setting that moved a modelled /r/ toward /w/
  // in the voice changer (app/api/voice-change/route.ts) — not one to touch
  // without her ears on the practice words.
  return {
    stability: 0.7,
    similarity_boost: 0.85,
    style: 0,
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
function assertPcm(buf: ArrayBuffer) {
  // A successful HTTP status with no PCM must never be cached or look like speech.
  if (!buf.byteLength || buf.byteLength % 2) throw new Error("Invalid PCM response");
}

// ── Loudness levelling (24 Sep 2026) ────────────────────────────────────────
// Every line used to play at whatever level the voice service happened to
// produce, so an excited line came out louder than a calm one and the volume
// jumped from line to line. Each clip is now brought to one speech level,
// once, here — before it is cached — so every page's player gets it for free.
//
// ONE GAIN PER CLIP, NO COMPRESSION. The practice word is the model the child
// copies, and the on-device check listens for the hiss of /s/ and /sh/; a
// compressor or limiter would reshape exactly that. A single multiplication
// changes how loud the clip is and nothing about how it sounds.
const LEVEL_TARGET_DB = -20;   // speech level: RMS over the spoken frames only
const LEVEL_PEAK_DB = -3;      // no sample may land above this after the gain
const LEVEL_FRAME = 480;       // 20 ms at 24 kHz
const LEVEL_PAUSE_DB = -50;    // frames quieter than this are pauses, not speech
const LEVEL_RELATIVE_DB = -20; // …and frames this far under the clip's own speech are breaths and tails
const LEVEL_QUIET_DB = -40;    // speech measured below this is near-silence: never turned up
const LEVEL_FADE = 240;        // 10 ms linear fade at each end, so no clip starts or stops with a click
const dbToAmp = (db: number) => Math.pow(10, db / 20);

/** Level 24 kHz 16-bit little-endian mono PCM. Returns a new buffer. */
function levelPcm(buf: ArrayBuffer): ArrayBuffer {
  assertPcm(buf);
  const n = buf.byteLength >> 1;
  const inView = new DataView(buf);
  const x = new Float64Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    x[i] = inView.getInt16(i * 2, true) / 32768;
    const a = Math.abs(x[i]);
    if (a > peak) peak = a;
  }
  // Measure the SPOKEN part only. Averaging in the pauses would read a line
  // with long gaps as quiet and turn its speech up too far.
  const frames: { sum: number; len: number }[] = [];
  for (let s = 0; s < n; s += LEVEL_FRAME) {
    const e = Math.min(n, s + LEVEL_FRAME);
    let sum = 0;
    for (let i = s; i < e; i++) sum += x[i] * x[i];
    frames.push({ sum, len: e - s });
  }
  const pauseGate = dbToAmp(LEVEL_PAUSE_DB) ** 2;
  const spoken = frames.filter((f) => f.sum / f.len >= pauseGate);
  let gain = 1;
  if (spoken.length) {
    const mean = spoken.reduce((t, f) => t + f.sum, 0) / spoken.reduce((t, f) => t + f.len, 0);
    const relGate = mean * dbToAmp(LEVEL_RELATIVE_DB) ** 2;
    const speech = spoken.filter((f) => f.sum / f.len >= relGate);
    const rms = Math.sqrt(speech.reduce((t, f) => t + f.sum, 0) / speech.reduce((t, f) => t + f.len, 0));
    // Near-silence is never turned up: raising it would only raise hiss, and a
    // clip that is mostly nothing must not become something.
    if (rms >= dbToAmp(LEVEL_QUIET_DB)) gain = dbToAmp(LEVEL_TARGET_DB) / rms;
  }
  // The peak cap wins over the target: a spiky line lands a little under
  // -20 dB rather than being squashed to reach it. The cap sits a sample step
  // under -3 dB so rounding back to 16-bit can never nudge a peak over it.
  const peakCap = Math.floor(dbToAmp(LEVEL_PEAK_DB) * 32768 - 1) / 32768;
  if (peak > 0) gain = Math.min(gain, peakCap / peak);
  const fade = Math.min(LEVEL_FADE, n >> 1);
  const out = new ArrayBuffer(n * 2);
  const outView = new DataView(out);
  for (let i = 0; i < n; i++) {
    let g = gain;
    if (fade > 0) {
      if (i < fade) g *= i / fade;
      const fromEnd = n - 1 - i;
      if (fromEnd < fade) g *= fromEnd / fade;
    }
    const v = Math.round(x[i] * g * 32768);
    outView.setInt16(i * 2, Math.max(-32768, Math.min(32767, v)), true);
  }
  return out;
}

function pcmResponse(buf: ArrayBuffer, provider: string, model: string, cache: "hit" | "miss" = "miss") {
  assertPcm(buf);
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
        const cacheKey = JSON.stringify([VOICE_REVISION, provider, voiceId, model, settings, VOICE_SEED, sendText, "pcm_24000"]);
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
            body: JSON.stringify({ text: sendText, model_id: model, voice_settings: settings, seed: VOICE_SEED }),
            signal: controller.signal,
          },
        );
        if (r.ok) {
          // Level once, then cache the LEVELLED clip: a cache hit is already
          // levelled and must not be levelled again.
          const buf = levelPcm(await r.arrayBuffer());
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
    // The fallback voice is levelled to the same target, so a slow ElevenLabs
    // day does not also mean a louder or quieter Echo.
    return pcmResponse(levelPcm(await r.arrayBuffer()), provider, model);
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
