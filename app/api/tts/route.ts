import { NextRequest, NextResponse } from "next/server";
// Only next/server and @/lib/rateLimit: tools/levelclips.mjs and
// tests/ttsroutetest.mjs load this file in a sandbox that allows nothing else.
import { rateLimit, spendBudget, clientIp, ipBucket } from "@/lib/rateLimit";

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
 *   ELEVENLABS_PRIMARY_MODEL (default "eleven_v4_turbo" — the model every line is made with)
 *   ELEVENLABS_MODEL    (default "eleven_multilingual_v2" — only when the primary model refuses or fails)
 *   ELEVENLABS_V3="1"   opt in to trying eleven_v3 first (different cadence)
 *   OPENAI_TTS_VOICE / OPENAI_TTS_MODEL
 */
export const runtime = "nodejs";

// v9 (28 Sep 2026): every line is made with Eleven v4 Turbo instead of
// Multilingual v2. v8 (24 Sep 2026) was loudness levelling (levelPcm below),
// calmer settings and a fixed seed. Bumped together with TTS_CACHE_VERSION in
// public/sona.js — the phone keys its saved clips by that value, so bumping only
// one side leaves families replaying the old model's takes forever.
const VOICE_REVISION = "v9";
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

// ── Who may spend Echo's voice, and how much (TTSBUDGET1, 14 Nov 2026) ──────
// The route is the one way Sona pays ElevenLabs per character, and it needs no
// sign-in (a family's phone has none). The audit of 13 Nov 2026 (server.md
// B1) found anyone could loop it: 120 requests a minute of 800 characters,
// any voice string put into the vendor's URL, and no ceiling at all.
//  - Other websites are refused: a browser always sends a foreign Origin (and
//    Sec-Fetch-Site "cross-site") on a cross-site POST. A request with neither
//    header is let through, so the iPhone app (a web view on speaksona.com,
//    every fetch relative) can never lose Echo's voice to a missing header.
//    This stops other pages, not scripts: the budgets below guard the money.
//  - MAX_TEXT: the longest line any page sends is the parked chapter reader's
//    184 characters; live lines stop at about 126 (Grow a Flower's intro).
//    tests/ttsroutetest.mjs holds every line in VOICE_SCRIPT.md under it.
//  - Characters are charged only when a vendor is really asked (a server
//    cache hit is free), per IP for an hour (privacy.html: an address is kept
//    "for up to an hour") and for everyone for a UTC day. Over either, the
//    route answers as it does when the vendor is down, and every page plays
//    the phone's own voice instead. TTS_IP_HOURLY_CHARS and TTS_DAILY_CHARS
//    set the caps (Travis chose 200,000 a day).
const MAX_TEXT = 200;
const MAX_BODY_BYTES = 4096;
const TTS_PER_MIN = 60;
const DEFAULT_IP_HOURLY_CHARS = 15000;
const DEFAULT_DAILY_CHARS = 200000;
function envCap(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
function foreignOrigin(req: Request): boolean {
  let self = "";
  try { self = new URL(req.url).origin; } catch { /* no URL: judged by the headers alone */ }
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  return Boolean((origin && origin !== self) || (site && site !== "same-origin"));
}
let budgetWarnedOn = "";
/** Charge `chars`; 0 when allowed, else the Retry-After seconds. */
async function chargeChars(req: Request, chars: number): Promise<number> {
  const ipCap = envCap(process.env.TTS_IP_HOURLY_CHARS, DEFAULT_IP_HOURLY_CHARS);
  if (!(await spendBudget(`rl:ttschars:${ipBucket(clientIp(req))}`, chars, ipCap, 3600))) return 3600;
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const dayCap = envCap(process.env.TTS_DAILY_CHARS, DEFAULT_DAILY_CHARS);
  if (await spendBudget(`tts:chars:${day}`, chars, dayCap, 2 * 86400)) return 0;
  if (budgetWarnedOn !== day) {
    budgetWarnedOn = day;
    console.warn("tts: daily character budget reached"); // never the text
  }
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((midnight - now.getTime()) / 1000));
}
function budgetRefusal(provider: string, retryAfter: number) {
  return NextResponse.json(
    { ok: false, error: "Echo's voice is resting.", budget: true },
    { status: 503, headers: { ...voiceHeaders(provider, "none", "miss", false), "Retry-After": String(retryAfter) } },
  );
}
const PCM_HEADERS = {
  "Content-Type": "audio/L16; rate=24000; channels=1",
  "Cache-Control": "no-store",
} as const;

// Warm-instance memo + cache (module scope survives across requests on the same
// serverless instance). Kills the two biggest sources of TTS dead air:
//  1. refused — once a model rejects a voice (eleven_v3 on an account without v3
//     access, or v4 Turbo on a voice it cannot use), stop paying a doomed round
//     trip before the fallback on every single call. Keyed by model AND voice:
//     one family's voice being refused must not move every other family off v4.
//     Capped anyway (the voice is now one of two allowed ids, elevenVoice).
//  2. audioCache — the game loop repeats a small set of short prompts ("say rrrr",
//     "your turn!", praise lines) constantly; serve identical clips instantly.
const refused = new Set<string>();
const REFUSED_MAX = 200;
function rememberRefusal(k: string) {
  if (refused.size >= REFUSED_MAX) refused.clear();
  refused.add(k);
}
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
    // ELEVEN V4 TURBO FOR EVERY LINE (Travis, 28 Sep 2026, after an A/B listen
    // against v2 and v4). Same pace as v4 — identical timing on every test line —
    // but a clip is ready in about 0.7 s instead of 1.2 s, and a child waits
    // through that gap before every prompt. It is its own variable rather than
    // ELEVENLABS_MODEL because production may still set ELEVENLABS_MODEL to
    // v2 from before, and the switch must not depend on someone remembering to
    // delete it: that setting now only names the fallback.
    primaryModel: process.env.ELEVENLABS_PRIMARY_MODEL || "eleven_v4_turbo",
    // Only when the primary model refuses or fails: the model Echo used through
    // 28 Sep, so a child still hears Echo rather than the phone's robot voice.
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
  // without her ears on the practice words. Eleven v4 Turbo takes these same
  // controls (checked against the live API, 28 Sep 2026), so the settings did
  // not change with it — but the voice did: on every voice a family can pick,
  // v4 Turbo speaks higher and moves its pitch more than v2 did. Those are
  // Rachel's ears on the practice words, not a settings question.
  return {
    stability: 0.7,
    similarity_boost: 0.85,
    style: 0,
    speed: config.speed,
    use_speaker_boost: true,
  };
}
function elevenVoice(requested: string | undefined, config: ReturnType<typeof elevenConfig>) {
  // Every page sends the profile voice, which getProfile() pins to Echo's
  // (DEFAULT_ELEVEN_VOICE). Anything else is spoken in the configured voice,
  // never refused (an old cached page still hears Echo) and never put into the
  // vendor's URL. A voice picker that comes back must add its ids here.
  const allowed = new Set([DEFAULT_ELEVEN_VOICE, config.voiceId]);
  return requested && allowed.has(requested) ? requested : config.voiceId;
}
function openaiVoice(requested?: string) {
  // Pages send the child's ElevenLabs profile voice. It is not an OpenAI voice.
  return requested && OPENAI_VOICES.has(requested)
    ? requested : process.env.OPENAI_TTS_VOICE || "shimmer";
}
function voiceHeaders(provider: string, model: string, cache: "hit" | "miss" = "miss", keep = true) {
  return {
    "X-Sona-Voice-Provider": provider,
    "X-Sona-Voice-Model": model,
    "X-Sona-Voice-Cache": cache,
    "X-Sona-Voice-Revision": VOICE_REVISION,
    // "0" = a stand-in: the fallback made this clip because the usual model
    // was busy, broken or refused just now. Play it, never save it on the phone.
    // The phone keys saved clips by voice, revision and text — not model — so a
    // saved stand-in would replay the old model's take of that line forever.
    "X-Sona-Voice-Keep": keep ? "1" : "0",
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

function pcmResponse(buf: ArrayBuffer, provider: string, model: string, cache: "hit" | "miss" = "miss", keep = true) {
  assertPcm(buf);
  return new NextResponse(buf.slice(0), {
    status: 200, headers: { ...PCM_HEADERS, ...voiceHeaders(provider, model, cache, keep) },
  });
}

export async function POST(req: NextRequest) {
  if (foreignOrigin(req)) return NextResponse.json({ ok: false }, { status: 403 });
  const limited = await rateLimit(req, { key: "tts", limit: TTS_PER_MIN, windowSec: 60, v6prefix: true });
  if (limited) return limited;
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "request is too large" }, { status: 413 });
  }
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
    text = typeof b?.text === "string" ? b.text : "";
    if (typeof b?.voice === "string" && b.voice) voiceOverride = b.voice;
    // `stable` remains accepted for old clients; it no longer changes delivery.
  } catch {
    // no body
  }
  if (!text.trim()) {
    return NextResponse.json({ ok: false, error: "text is required" }, { status: 400 });
  }
  // Refused whole, never cut: a cut line would be spoken wrong. Every page
  // plays the phone's own voice on any non-200.
  if (text.length > MAX_TEXT) {
    return NextResponse.json({ ok: false, error: "text is too long" }, { status: 413 });
  }

  const provider = elevenKey ? "elevenlabs" : "openai";
  let model = "none";
  // One budget includes all vendor attempts and response-body reads. A
  // fallback cannot start another full timeout after the browser has given up.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VENDOR_TIMEOUT_MS);
  try {
    if (elevenKey) {
      const config = elevenConfig();
      const voiceId = elevenVoice(voiceOverride, config);
      // Charged once a request, on the first attempt that misses the server
      // cache: a fallback model inside the same request is not charged again.
      let charged = false;
      // v4 Turbo for every line; v2 only if it refuses or fails, so the child
      // still hears Echo. v3 is still an explicit environment opt-in. The
      // fallback is never skipped: it is the last voice before the robot one.
      const attempts = [
        ...(config.wantV3 ? [config.v3Model] : []),
        config.primaryModel,
        config.fallbackModel,
      ].filter((candidate, i, arr) => arr.indexOf(candidate) === i)
       .filter((candidate) => candidate === config.fallbackModel || !refused.has(`${candidate}|${voiceId}`));

      let lastStatus: number | undefined;
      // standIn: an earlier model in THIS request was busy or broken, so the
      // clip that answers is a stand-in the phone must not keep. refusals: the
      // models that refused this voice, remembered only once a later model has
      // answered — that success proves the key, voice and text were fine, so
      // the refusal really was about the model. (Remembered on the refusal
      // alone, a voice or text that every model rejects would pin that voice
      // to the fallback for the life of the server.)
      let standIn = false;
      const refusals: string[] = [];
      const finalModel = attempts[attempts.length - 1];
      // The phone may keep a clip only if the model the v9 key stands for made
      // it, on an ordinary answer. A fallback clip is never kept — not after a
      // busy v4, and not after a refusal either: the route cannot tell "v4
      // refuses this voice" from "v4 refuses everyone right now" (a retired
      // model, a mistyped ELEVENLABS_PRIMARY_MODEL), and a phone that saved
      // the old voice under v9 would keep it after the cause was fixed. All ten
      // family voices work on v4 Turbo (28 Sep 2026), so this costs nothing.
      const keepable = (m: string) => !standIn && (m !== config.fallbackModel || config.primaryModel === config.fallbackModel);
      for (model of attempts) {
        const isV3 = model === config.v3Model || model === "eleven_v3";
        const settings = elevenSettings(model, config);
        // v3 performs [tags] and v4 would too; v2 would read them aloud. Only
        // the v3 opt-in keeps them: since the calm rewrite of 24 Sep no line
        // asks Echo for a performance, so every other model gets them stripped.
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
          if (hit) { refusals.forEach(rememberRefusal); return pcmResponse(hit, provider, model, "hit", keepable(model)); }
        }
        // A dropped connection or a broken body from a model that has another
        // behind it moves on to that one while the deadline allows: the child
        // should hear Echo in the older voice rather than the robot voice.
        // The last model, or a spent deadline, still ends the request.
        if (!charged) {
          charged = true;
          const wait = await chargeChars(req, sendText.length);
          if (wait) return budgetRefusal(provider, wait);
        }
        let r: Response;
        let buf: ArrayBuffer | null = null;
        try {
          r = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=pcm_24000`,
            {
              method: "POST",
              headers: { "xi-api-key": elevenKey, "Content-Type": "application/json" },
              body: JSON.stringify({ text: sendText, model_id: model, voice_settings: settings, seed: VOICE_SEED }),
              signal: controller.signal,
            },
          );
          // Level once, then cache the LEVELLED clip: a cache hit is already
          // levelled and must not be levelled again.
          if (r.ok) buf = levelPcm(await r.arrayBuffer());
        } catch (e) {
          if (controller.signal.aborted || model === finalModel) throw e;
          console.warn(`tts: ${model} failed without an answer; trying the next model`);
          standIn = true;
          continue;
        }
        if (buf) {
          refusals.forEach(rememberRefusal);
          const response = pcmResponse(buf, provider, model, "miss", keepable(model));
          if (cacheable) cacheSet(cacheKey, buf);
          return response;
        }
        // A refusal of this model for this voice (remembered once a later model
        // answers); a 401 counts only for v3 (an account without v3 access),
        // because for any other model a 401 is the key itself, and the fallback
        // would meet the same one. Busy or broken (429, 5xx) is a stand-in and
        // never remembered: next time may work.
        if (model !== config.fallbackModel && [400, 403, 404, 422, ...(isV3 ? [401] : [])].includes(r.status)) refusals.push(`${model}|${voiceId}`);
        else standIn = true;
        // Model and status only: the text can hold a child's name.
        if (model !== finalModel) console.warn(`tts: ${model} answered ${r.status}; trying the next model`);
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
    const wait = await chargeChars(req, text.length);
    if (wait) return budgetRefusal(provider, wait);
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
    ? (config.wantV3 ? config.v3Model : config.primaryModel)
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
