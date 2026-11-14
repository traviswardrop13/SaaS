// TTSROUTE1: execute the actual server route with fake vendors; no network/audio.
// Regression proof: TTS_ROUTE_REF=86e6598 node tests/ttsroutetest.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.TTS_ROUTE_REF
  ? execFileSync("git", ["show", `${process.env.TTS_ROUTE_REF}:app/api/tts/route.ts`], { cwd: root, encoding: "utf8" })
  : readFileSync(path.join(root, "app/api/tts/route.ts"), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const EL = { ELEVENLABS_API_KEY: "private-eleven-test-key" };
const OA = { OPENAI_API_KEY: "private-openai-test-key" };
const secret = "private-vendor-account-detail";
const pcm = (value = 1) => new Response(new Uint8Array([value, 0, value, 0]));
// ── Real-shaped fake clips for the loudness pins (24 Sep 2026) ──
const RATE = 24000;
const dB = (amp) => 20 * Math.log10(amp);
const amp = (db) => Math.pow(10, db / 20);
function clip(samples) {
  const view = new DataView(new ArrayBuffer(samples.length * 2));
  samples.forEach((x, i) => view.setInt16(i * 2, Math.max(-32768, Math.min(32767, Math.round(x * 32768))), true));
  return new Response(view.buffer);
}
async function decode(response) {
  const buf = await response.arrayBuffer(), view = new DataView(buf);
  return Float64Array.from({ length: buf.byteLength / 2 }, (_, i) => view.getInt16(i * 2, true) / 32768);
}
const rms = (x, from = 0, to = x.length) => { let s = 0; for (let i = from; i < to; i++) s += x[i] * x[i]; return Math.sqrt(s / (to - from)); };
const peakOf = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
// A "line": pause, speech, a long pause mid-line, speech, pause — half of it is
// silence (with a faint -70 dB floor), so a level taken over the whole clip
// would land the speech 3 dB hot. Returns the samples and where the speech is.
function line(peak) {
  const seg = (s) => Math.round(s * RATE), parts = [["pause", 0.31], ["speech", 0.6], ["pause", 0.6], ["speech", 0.6], ["pause", 0.31]];
  const out = [], speech = [];
  let noise = 12345;
  for (const [kind, secs] of parts) {
    const start = out.length;
    for (let i = 0; i < seg(secs); i++) {
      noise = (noise * 1103515245 + 12345) % 2147483648;
      out.push(kind === "speech" ? peak * Math.sin(2 * Math.PI * 220 * i / RATE) : amp(-70) * (noise / 1073741824 - 1));
    }
    if (kind === "speech") speech.push([start, out.length]);
  }
  return { samples: out, speech };
}
const speechLevel = (x, spans) => {
  let s = 0, n = 0;
  for (const [a, b] of spans) for (let i = a; i < b; i++) { s += x[i] * x[i]; n++; }
  return dB(Math.sqrt(s / n));
};
class NextResponse extends Response {
  static json(body, init = {}) {
    return new NextResponse(JSON.stringify(body), {
      ...init, headers: { "Content-Type": "application/json", ...init.headers },
    });
  }
}
const SELF = "https://www.speaksona.com";
const DEFAULT_VOICE = "qBDvhofpxp92JgXJxDjB";
// A second allowed voice: the deployment's configured one.
const EL2 = { ...EL, ELEVENLABS_VOICE_ID: "configured-voice" };
function fixture(env = EL, vendor = () => pcm(), limited = null) {
  const calls = [], timers = new Map(), exports = {}, settings = { ...env }, logs = [];
  // The budget stub keeps lib/rateLimit's contract: refuse past the cap and
  // charge nothing when it refuses. `spends` records every ask.
  const budget = { counts: new Map(), spends: [], limits: [] };
  async function spendBudget(key, amount, cap, windowSec) {
    budget.spends.push({ key, amount, cap, windowSec });
    const cur = budget.counts.get(key) || 0;
    if (cur + amount > cap) return false;
    budget.counts.set(key, cur + amount);
    return true;
  }
  let timerId = 0;
  const context = {
    exports, process: { env: settings }, AbortController, Response, Uint8Array, ArrayBuffer, Error, URL, Headers, Date,
    console: { warn: (...a) => logs.push(a.join(" ")), log: (...a) => logs.push(a.join(" ")), error: (...a) => logs.push(a.join(" ")) },
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    async fetch(url, options) {
      const call = { url, options, body: JSON.parse(options.body) };
      calls.push(call);
      return vendor(call, calls.length);
    },
    require(id) {
      if (id === "next/server") return { NextResponse };
      if (id === "@/lib/rateLimit") return {
        rateLimit: async (_req, opts) => { budget.limits.push(opts); return limited; },
        spendBudget,
        clientIp: (req) => req.headers.get("x-real-ip") || "anon",
        ipBucket: (ip) => ip,
      };
      throw new Error(`Unexpected route import ${id}`);
    },
  };
  vm.runInNewContext(code, context, { filename: "app/api/tts/route.ts" });
  let parsed = 0;
  return {
    calls, timers, logs, env: settings, budget,
    get parsed() { return parsed; },
    // A same-origin POST from a Sona page, as the iPhone app's web view and
    // the website both send it. `headers` replaces the default headers.
    post: (body = { text: "Ready to play?" }, headers = { origin: SELF, "x-real-ip": "203.0.113.7" }) =>
      exports.POST({ url: `${SELF}/api/tts`, headers: new Headers(headers), json: async () => { parsed++; return body; } }),
    get: () => exports.GET(),
    expire() { for (const { fn } of [...timers.values()]) fn(); },
  };
}
function expectVoice(response, provider, model, cache = "miss") {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "audio/L16; rate=24000; channels=1");
  assert.equal(response.headers.get("x-sona-voice-provider"), provider);
  assert.equal(response.headers.get("x-sona-voice-model"), model);
  assert.equal(response.headers.get("x-sona-voice-cache"), cache);
  // v9 (28 Sep 2026): Eleven v4 Turbo for every line (v8, 24 Sep: levelled
  // clips + calmer settings + a fixed seed). Must match TTS_CACHE_VERSION in
  // public/sona.js (pinned below).
  assert.equal(response.headers.get("x-sona-voice-revision"), "v9");
}
async function expectFailure(response, status = 502) {
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type"), /json/);
  const body = await response.text();
  assert.equal(JSON.parse(body).ok, false);
  assert.ok(!body.includes(secret), "must not expose vendor response/error text");
  assert.ok(!body.includes(EL.ELEVENLABS_API_KEY));
  assert.ok(!body.includes(OA.OPENAI_API_KEY));
}
const tests = [];
const test = (name, run) => tests.push({ name, run });

test("ElevenLabs preserves chosen voice, uses the calm delivery, reports actual provider", async () => {
  // The chosen voice (Echo's, what every page sends) wins over a deployment
  // configured to another voice: both are on the allow-list.
  const f = fixture(EL2);
  const response = await f.post({ text: "Ready?", voice: DEFAULT_VOICE, stable: true });
  expectVoice(response, "elevenlabs", "eleven_v4_turbo");
  assert.equal(f.calls[0].body.model_id, "eleven_v4_turbo");
  assert.ok(f.calls[0].url.includes(`/${DEFAULT_VOICE}?output_format=pcm_24000`));
  // Rewritten deliberately, 24 Sep 2026 (was stability 0.55, style 0.3): Travis
  // asked for "relaxed and sweet, like talking to a little kid". style 0 and
  // stability 0.7 calm it. similarity_boost and speed are UNCHANGED on
  // purpose — speed is also the practice word's rate, which is Rachel's call.
  assert.deepEqual(f.calls[0].body.voice_settings, {
    stability: 0.7, similarity_boost: 0.85, style: 0, speed: 0.93, use_speaker_boost: true,
  });
  assert.equal(f.calls[0].body.text, "Ready?");
  assert.ok(f.calls[0].options.signal instanceof AbortSignal);
  assert.equal(f.timers.size, 0, "completed request must release its deadline");
});

test("Identical effective speech is cached; changing delivery/model/voice produces new audio", async () => {
  const f = fixture(EL2, (_, count) => pcm(count));
  const first = await f.post({ text: "[excited] Hello" });
  expectVoice(first, "elevenlabs", "eleven_v4_turbo");
  const cached = await f.post({ text: "Hello" });
  expectVoice(cached, "elevenlabs", "eleven_v4_turbo", "hit");
  assert.equal(f.calls.length, 1, "cache uses text actually sent to this model");
  assert.deepEqual(new Uint8Array(await first.arrayBuffer()), new Uint8Array(await cached.arrayBuffer()));
  f.env.ELEVENLABS_SPEED = "0.90";
  expectVoice(await f.post({ text: "Hello" }), "elevenlabs", "eleven_v4_turbo");
  assert.equal(f.calls[1].body.voice_settings.speed, 0.9);
  f.env.ELEVENLABS_PRIMARY_MODEL = "eleven_v4";
  expectVoice(await f.post({ text: "Hello" }), "elevenlabs", "eleven_v4");
  await f.post({ text: "Hello", voice: DEFAULT_VOICE });
  assert.equal(f.calls.length, 4);
  assert.ok(f.calls[3].url.includes(`/${DEFAULT_VOICE}?`));
});

test("A live speed change cannot replay a clip made with old settings", async () => {
  const f = fixture();
  await f.post({ text: "Hello" });
  f.env.ELEVENLABS_SPEED = "0.90";
  await f.post({ text: "Hello" });
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].body.voice_settings.speed, 0.9);
});

test("Configured model change cannot replay the old model's cache", async () => {
  const f = fixture();
  await f.post({ text: "Hello" });
  f.env.ELEVENLABS_PRIMARY_MODEL = "eleven_v4";
  await f.post({ text: "Hello" });
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].body.model_id, "eleven_v4");
});

test("Long story text stays out of the short-prompt cache", async () => {
  const f = fixture();
  await f.post({ text: "A".repeat(121) });
  await f.post({ text: "A".repeat(121) });
  assert.equal(f.calls.length, 2);
});

test("v3 opt-in sends only supported controls and keeps delivery tags", async () => {
  const f = fixture({ ...EL, ELEVENLABS_V3: "1" });
  await f.post({ text: "[excited] Hello" });
  assert.deepEqual(f.calls[0].body.voice_settings, { stability: 0.5 });
  assert.equal(f.calls[0].body.model_id, "eleven_v3");
  assert.equal(f.calls[0].body.text, "[excited] Hello");
});

test("v3 fallback reports and caches the model that really synthesized the clip", async () => {
  const f = fixture({ ...EL, ELEVENLABS_V3: "1" }, (_, count) => count === 1
    ? new Response(secret, { status: 403 }) : pcm());
  expectVoice(await f.post({ text: "[excited] Hello" }), "elevenlabs", "eleven_v4_turbo");
  assert.equal(f.calls[1].body.text, "Hello");
  assert.ok(f.calls[0].options.signal);
  assert.equal(f.calls[0].options.signal, f.calls[1].options.signal, "fallback shares the same deadline");
  expectVoice(await f.post({ text: "Hello" }), "elevenlabs", "eleven_v4_turbo", "hit");
  assert.equal(f.calls.length, 2);
});

test("OpenAI maps an ElevenLabs profile voice to its configured builtin voice", async () => {
  const f = fixture({ ...OA, OPENAI_TTS_VOICE: "coral" });
  await f.post({ text: "Hello", voice: "qBDvhofpxp92JgXJxDjB" });
  assert.equal(f.calls[0].body.voice, "coral");
  assert.equal(f.calls[0].body.response_format, "pcm");
});

test("OpenAI accepts an explicit builtin voice and reports its actual model", async () => {
  const f = fixture(OA);
  expectVoice(await f.post({ text: "Hello", voice: "echo" }), "openai", "gpt-4o-mini-tts");
  assert.equal(f.calls[0].body.voice, "echo");
});

test("OpenAI defaults to shimmer for an incompatible profile voice", async () => {
  const f = fixture(OA);
  await f.post({ text: "Hello", voice: "an-elevenlabs-voice" });
  assert.equal(f.calls[0].body.voice, "shimmer");
});

for (const [name, env] of [["ElevenLabs", EL], ["OpenAI", OA]]) {
  test(`${name} vendor errors do not return vendor bodies or pretend to be audio`, async () => {
    const f = fixture(env, () => new Response(secret, { status: 401 }));
    await expectFailure(await f.post());
  });
  test(`${name} network errors do not expose exception details`, async () => {
    const f = fixture(env, () => { throw new Error(secret); });
    await expectFailure(await f.post());
  });
  test(`${name} empty and malformed PCM are failures, never cached`, async () => {
    const f = fixture(env, (_, count) => new Response(new Uint8Array(count === 1 ? [] : [1])));
    await expectFailure(await f.post());
    await expectFailure(await f.post());
    // ElevenLabs: a broken body from v4 Turbo moves on to v2 (also broken
    // here), so two models per line; nothing cached either time.
    assert.equal(f.calls.length, name === "ElevenLabs" ? 4 : 2);
  });
  test(`${name} vendor work is bounded below the browser timeout`, async () => {
    const f = fixture(env, ({ options }) => new Promise((_, reject) => {
      options.signal?.addEventListener("abort", () => reject(new Error(secret)), { once: true });
    }));
    const request = f.post();
    // POST first awaits rateLimit, request.json and the two character
    // budgets; let it reach the vendor.
    for (let i = 0; i < 40 && !f.calls.length; i++) await Promise.resolve();
    assert.equal(f.calls.length, 1);
    assert.equal(f.timers.size, 1, "one total deadline is armed");
    const deadline = [...f.timers.values()][0].ms;
    assert.ok(deadline > 0 && deadline <= 6000);
    f.expire();
    await expectFailure(await request, 504);
    assert.equal(f.timers.size, 0);
    assert.equal(f.calls.length, 1, "timeout does not start another vendor request");
  });
}

test("Response-body downloads also share the deadline", async () => {
  const f = fixture(EL, ({ options }) => ({
    ok: true,
    arrayBuffer: () => new Promise((_, reject) => options.signal?.addEventListener("abort", () => reject(new Error(secret)))),
  }));
  const request = f.post();
  for (let i = 0; i < 40 && !f.calls.length; i++) await Promise.resolve();
  for (let i = 0; i < 12; i++) await Promise.resolve();
  assert.equal(f.timers.size, 1);
  f.expire();
  await expectFailure(await request, 504);
  assert.equal(f.calls.length, 1, "a spent deadline does not start the fallback");
});

test("Health identifies the configured provider without claiming synthesis succeeded", async () => {
  for (const [env, provider, voice] of [[EL, "elevenlabs", "qBDvhofpxp92JgXJxDjB"], [OA, "openai", "shimmer"], [{}, "none", null]]) {
    const f = fixture(env);
    const response = await f.get();
    const raw = await response.text(), body = JSON.parse(raw);
    assert.equal(body.provider, provider);
    assert.equal(body.configured, provider !== "none");
    assert.equal(body.synthesisVerified, false);
    assert.equal(body.voiceId, voice);
    assert.equal(body.revision, "v9"); // 28 Sep 2026: bumped with Eleven v4 Turbo
    if (provider === "elevenlabs") {
      assert.equal(body.model, "eleven_v4_turbo", "health names the model every line is made with");
      assert.equal(body.fallbackModel, "eleven_multilingual_v2");
    }
    assert.match(body.hint, /profile voice overrides/);
    assert.ok(!raw.includes(EL.ELEVENLABS_API_KEY) && !raw.includes(OA.OPENAI_API_KEY));
    assert.equal(f.calls.length, 0, "health does not call a vendor");
  }
});

// ── A fixed seed (24 Sep 2026): every phone gets the same take of a line ──
test("Every ElevenLabs request carries one fixed integer seed", async () => {
  const f = fixture({ ...EL, ELEVENLABS_V3: "1" }, (_, count) => count === 1 ? new Response(secret, { status: 403 }) : pcm());
  await f.post({ text: "Nice one." });
  await f.post({ text: "Well done." });
  await f.post({ text: "Pick a game.", voice: "another-voice" });
  const seeds = f.calls.map((c) => c.body.seed);
  assert.equal(seeds.length, 4, "v3 attempt, v4 Turbo fallback, and two more lines");
  assert.ok(Number.isInteger(seeds[0]) && seeds[0] >= 0 && seeds[0] <= 4294967295, "an integer ElevenLabs accepts");
  assert.ok(seeds.every((s) => s === seeds[0]), "the same seed for every line, model and voice");
});

// ── Loudness levelling (24 Sep 2026) ──
// Every line is brought to one speech level (-20 dBFS RMS over the spoken
// part) with one gain per clip, peaks at or under -3 dBFS, 10 ms fades, and
// near-silence never turned up.
for (const [name, env] of [["ElevenLabs", EL], ["OpenAI", OA]]) {
  test(`${name}: a quiet line and a loud line both come out within 1 dB of -20 dBFS`, async () => {
    for (const peak of [0.02, 0.95]) { // about -37 dBFS and -3.5 dBFS of speech
      const { samples, speech } = line(peak);
      const before = speechLevel(Float64Array.from(samples), speech);
      const out = await decode(await fixture(env, () => clip(samples)).post({ text: "Nice one." }));
      const after = speechLevel(out, speech);
      assert.equal(out.length, samples.length, "levelling never changes the clip's length");
      assert.ok(Math.abs(after - -20) <= 1, `${before.toFixed(1)} dB of speech came out at ${after.toFixed(2)} dB`);
      assert.ok(dB(peakOf(out)) <= -3, `peak ${dB(peakOf(out)).toFixed(2)} dBFS`);
    }
  });
}

test("Peaks are capped at -3 dBFS by the same single gain, never by squashing", async () => {
  // Quiet speech (-33 dBFS) with three sharp spikes: reaching -20 would send
  // the spikes over full scale, so the peak cap wins and the whole clip moves
  // together. The ratio out/in is the same at every sample: no compression.
  const n = RATE, x = Array.from({ length: n }, (_, i) => 0.03 * Math.sin(2 * Math.PI * 180 * i / RATE));
  for (const at of [6000, 12000, 18000]) x[at] = 0.9;
  const out = await decode(await fixture(EL, () => clip(x)).post({ text: "Ready?" }));
  assert.ok(dB(peakOf(out)) <= -3, `peak ${dB(peakOf(out)).toFixed(3)} dBFS`);
  assert.ok(dB(peakOf(out)) > -3.1, "the cap is what limited the gain");
  const g = out[12000] / (Math.round(0.9 * 32768) / 32768);
  for (let i = 240; i < n - 240; i++) {
    const input = Math.round(x[i] * 32768) / 32768;
    if (Math.abs(input) > 0.01) assert.ok(Math.abs(out[i] / input - g) < 0.002, `sample ${i}: gain ${out[i] / input} vs ${g}`);
  }
});

test("Both ends fade over 10 ms, so no line starts or stops with a click", async () => {
  // A full-scale-edge square wave from the first sample to the last: without a
  // fade the clip would jump straight to full level.
  const n = Math.round(RATE * 0.5), x = Array.from({ length: n }, (_, i) => (Math.floor(i / 20) % 2 ? -0.1 : 0.1));
  const out = await decode(await fixture(EL, () => clip(x)).post({ text: "Ready?" }));
  const full = Math.abs(out[n >> 1]);
  assert.ok(full > 0.09, "the body of the clip is at its levelled level");
  assert.equal(out[0], 0, "first sample is silent");
  assert.equal(out[n - 1], 0, "last sample is silent");
  assert.ok(Math.abs(Math.abs(out[120]) / full - 0.5) < 0.02, "halfway up 5 ms in");
  assert.ok(Math.abs(Math.abs(out[n - 1 - 120]) / full - 0.5) < 0.02, "halfway down 5 ms from the end");
  assert.ok(Math.abs(Math.abs(out[240]) / full - 1) < 0.01 && Math.abs(Math.abs(out[n - 1 - 240]) / full - 1) < 0.01, "fades are exactly 10 ms");
  for (let i = 1; i < 240; i++) assert.ok(Math.abs(out[i]) >= Math.abs(out[i - 1]) - 1 / 32768, "fade-in only rises");
});

test("Near-silence is never turned up", async () => {
  // Two near-silent clips: one under the pause gate entirely (-51 dBFS), one
  // just above it but still under the -40 dBFS speech floor (-41 dBFS).
  for (const peak of [0.004, 0.012]) {
    const n = RATE, x = Array.from({ length: n }, (_, i) => peak * Math.sin(2 * Math.PI * 200 * i / RATE));
    const out = await decode(await fixture(EL, () => clip(x)).post({ text: "Ready?" }));
    assert.ok(peakOf(out) <= peakOf(x) + 1 / 32768, `peak ${dB(peakOf(x)).toFixed(1)} dBFS was raised to ${dB(peakOf(out)).toFixed(1)}`);
    for (let i = 240; i < n - 240; i += 97) assert.ok(Math.round(out[i] * 32768) === Math.round(x[i] * 32768), `gain is exactly 1 in the body (sample ${i})`);
  }
});

test("The levelled clip is what is cached; a cache hit is not levelled twice", async () => {
  const { samples } = line(0.02);
  const f = fixture(EL, () => clip(samples));
  const first = new Uint8Array(await (await f.post({ text: "Well done." })).arrayBuffer());
  const hit = await f.post({ text: "Well done." });
  expectVoice(hit, "elevenlabs", "eleven_v4_turbo", "hit");
  assert.equal(f.calls.length, 1);
  const raw = new Uint8Array(await clip(samples).arrayBuffer());
  assert.notDeepEqual(first, raw, "the response is the levelled clip, not the vendor's bytes");
  assert.deepEqual(new Uint8Array(await hit.arrayBuffer()), first, "the hit is byte-identical to the levelled miss");
});

// ── One version everywhere (v8 24 Sep 2026, v9 28 Sep 2026) ──
// The phone keys its saved clips by TTS_CACHE_VERSION; the server stamps
// VOICE_REVISION. If they drift, families replay the old unlevelled takes
// forever. Pages that fall back to a literal when Sona is missing must fall
// back to the SAME version, or that page alone keeps the old clips.
test("Server revision, device cache version and every page fallback agree on v9", async () => {
  const sona = readFileSync(path.join(root, "public/sona.js"), "utf8");
  const device = sona.match(/const TTS_CACHE_VERSION = "([^"]+)";/)?.[1];
  const server = source.match(/const VOICE_REVISION = "([^"]+)";/)?.[1];
  assert.equal(server, "v9");
  assert.equal(device, server, "sona.js TTS_CACHE_VERSION moves with the route's VOICE_REVISION");
  const { readdirSync } = await import("node:fs");
  const stale = [];
  for (const file of readdirSync(path.join(root, "public")).filter((f) => /\.(html|js)$/.test(f))) {
    const text = readFileSync(path.join(root, "public", file), "utf8");
    for (const m of text.matchAll(/TTS_CACHE_VERSION\)?\s*\|\|\s*["'](v\d+)["']/g)) if (m[1] !== device) stale.push(`${file}: ${m[0]}`);
  }
  assert.deepEqual(stale, [], "a page falls back to an older voice version");
});

// ── Eleven v4 Turbo for every line (Travis, 28 Sep 2026) ──
test("Every line is made with Eleven v4 Turbo, with the calm settings and no tags", async () => {
  const f = fixture();
  expectVoice(await f.post({ text: "[excited] You did it. Let's play." }), "elevenlabs", "eleven_v4_turbo");
  assert.equal(f.calls.length, 1, "one request: no v2 round trip first");
  assert.equal(f.calls[0].body.model_id, "eleven_v4_turbo");
  assert.deepEqual(f.calls[0].body.voice_settings, {
    stability: 0.7, similarity_boost: 0.85, style: 0, speed: 0.93, use_speaker_boost: true,
  });
  assert.equal(f.calls[0].body.text, "You did it. Let's play.", "v4 would perform a tag; the calm register strips it");
});

test("A leftover ELEVENLABS_MODEL=v2 in production cannot undo the switch", async () => {
  const f = fixture({ ...EL, ELEVENLABS_MODEL: "eleven_multilingual_v2" });
  expectVoice(await f.post({ text: "Nice one." }), "elevenlabs", "eleven_v4_turbo");
  const health = await (await f.get()).json();
  assert.equal(health.model, "eleven_v4_turbo");
});

test("If v4 Turbo refuses a voice, that voice falls back to v2 and stops paying for the refusal", async () => {
  // The two allowed voices: Echo's (refused by v4 here) and the configured one.
  const f = fixture(EL2, ({ body }) => body.model_id === "eleven_v4_turbo" && body.text !== "ok"
    ? new Response(secret, { status: 422 }) : pcm());
  expectVoice(await f.post({ text: "Nice one.", voice: DEFAULT_VOICE }), "elevenlabs", "eleven_multilingual_v2");
  assert.deepEqual(f.calls.map((c) => c.body.model_id), ["eleven_v4_turbo", "eleven_multilingual_v2"]);
  assert.equal(f.calls[0].options.signal, f.calls[1].options.signal, "the fallback shares the same deadline");
  await f.post({ text: "Well done.", voice: DEFAULT_VOICE });
  assert.deepEqual(f.calls.slice(2).map((c) => c.body.model_id), ["eleven_multilingual_v2"], "the refused voice skips v4 Turbo next time");
  expectVoice(await f.post({ text: "ok" }), "elevenlabs", "eleven_v4_turbo");
  assert.ok(f.calls[3].url.includes("/configured-voice?"));
  assert.equal(f.calls[3].body.model_id, "eleven_v4_turbo", "one voice's refusal never moves other families off v4 Turbo");
});

test("A busy or failing v4 Turbo falls back for that line only, and is tried again next time", async () => {
  for (const status of [429, 500, 503]) {
    const f = fixture(EL, (_, count) => count === 1 ? new Response(secret, { status }) : pcm());
    expectVoice(await f.post({ text: "Nice one." }), "elevenlabs", "eleven_multilingual_v2");
    await f.post({ text: "Well done." });
    assert.equal(f.calls[2].body.model_id, "eleven_v4_turbo", `a ${status} is not remembered as a refusal`);
  }
});

test("A bad key is not remembered as a v4 Turbo refusal", async () => {
  const f = fixture(EL, (_, count) => count <= 2 ? new Response(secret, { status: 401 }) : pcm());
  await expectFailure(await f.post({ text: "Nice one." }));
  assert.deepEqual(f.calls.map((c) => c.body.model_id), ["eleven_v4_turbo", "eleven_multilingual_v2"]);
  expectVoice(await f.post({ text: "Nice one." }), "elevenlabs", "eleven_v4_turbo");
});

// ── Stand-ins are played, never kept (review of the v4 switch, 28 Sep 2026) ──
// The phone keys saved clips by voice|revision|text — not model — so a v2 clip
// saved under v9 while v4 Turbo was busy would replay the old voice forever.
test("A clip made by the usual model says keep; a stand-in after a busy v4 Turbo says don't", async () => {
  const ok = fixture();
  assert.equal((await ok.post({ text: "Nice one." })).headers.get("x-sona-voice-keep"), "1");
  assert.equal((await ok.post({ text: "Nice one." })).headers.get("x-sona-voice-keep"), "1", "a server cache hit of the usual clip is kept too");
  for (const status of [429, 500, 503]) {
    const f = fixture(EL, ({ body }) => body.model_id === "eleven_v4_turbo" ? new Response(secret, { status }) : pcm());
    const r = await f.post({ text: "Nice one." });
    expectVoice(r, "elevenlabs", "eleven_multilingual_v2");
    assert.equal(r.headers.get("x-sona-voice-keep"), "0", `a stand-in after a ${status} is not kept`);
    const hit = await f.post({ text: "Nice one." });
    expectVoice(hit, "elevenlabs", "eleven_multilingual_v2", "hit");
    assert.equal(hit.headers.get("x-sona-voice-keep"), "0", "a server-cached stand-in is still a stand-in");
    assert.equal(f.calls.filter((c) => c.body.model_id === "eleven_v4_turbo").length, 2, "v4 Turbo is asked again every time");
  }
});

test("A dropped connection or broken body from v4 Turbo still reaches v2, as a stand-in", async () => {
  for (const fail of [() => { throw new Error(secret); }, () => new Response(new Uint8Array([1]))]) {
    const f = fixture(EL, (call) => call.body.model_id === "eleven_v4_turbo" ? fail() : pcm());
    const r = await f.post({ text: "Nice one." });
    expectVoice(r, "elevenlabs", "eleven_multilingual_v2");
    assert.equal(r.headers.get("x-sona-voice-keep"), "0");
    expectVoice(await f.post({ text: "Well done." }), "elevenlabs", "eleven_multilingual_v2");
    assert.equal(f.calls.filter((c) => c.body.model_id === "eleven_v4_turbo").length, 2, "not remembered as a refusal");
  }
});

test("After a refusal the v2 clip plays but is never kept: the phone's v9 key means v4 Turbo", async () => {
  // Second review, 28 Sep 2026: a mistyped ELEVENLABS_PRIMARY_MODEL or a
  // retired model refuses EVERY voice. Kept, those v2 takes would outlive the fix.
  const f = fixture(EL, ({ body }) => body.model_id === "eleven_v4_turbo" ? new Response(secret, { status: 422 }) : pcm());
  const first = await f.post({ text: "Nice one.", voice: "old-clone" });
  expectVoice(first, "elevenlabs", "eleven_multilingual_v2");
  assert.equal(first.headers.get("x-sona-voice-keep"), "0");
  const next = await f.post({ text: "Well done.", voice: "old-clone" });
  assert.equal(next.headers.get("x-sona-voice-keep"), "0", "the remembered-refusal path is not kept either");
  assert.equal(f.calls.length, 3, "the refusal was remembered after v2 answered: no doomed v4 call");
  const hit = await f.post({ text: "Well done.", voice: "old-clone" });
  expectVoice(hit, "elevenlabs", "eleven_multilingual_v2", "hit");
  assert.equal(hit.headers.get("x-sona-voice-keep"), "0", "nor a server cache hit of it");
});

test("A refusal answered from v2's server cache is still remembered", async () => {
  let refuse = false;
  const f = fixture(EL, ({ body }) => refuse && body.model_id === "eleven_v4_turbo" ? new Response(secret, { status: 422 }) : pcm());
  f.env.ELEVENLABS_PRIMARY_MODEL = "eleven_multilingual_v2";
  await f.post({ text: "Nice one.", voice: "v" }); // puts v2's clip in the server cache
  delete f.env.ELEVENLABS_PRIMARY_MODEL; refuse = true;
  const r = await f.post({ text: "Nice one.", voice: "v" }); // v4 refuses, v2 answers from the cache
  expectVoice(r, "elevenlabs", "eleven_multilingual_v2", "hit");
  f.calls.length = 0;
  await f.post({ text: "Well done.", voice: "v" });
  assert.deepEqual(f.calls.map((c) => c.body.model_id), ["eleven_multilingual_v2"]);
});

test("With the v3 opt-in: busy v3 makes v4 a stand-in; refused v3 leaves v4 kept", async () => {
  const busy = fixture({ ...EL, ELEVENLABS_V3: "1" }, ({ body }) => body.model_id === "eleven_v3" ? new Response(secret, { status: 503 }) : pcm());
  const a = await busy.post({ text: "Nice one." });
  expectVoice(a, "elevenlabs", "eleven_v4_turbo");
  assert.equal(a.headers.get("x-sona-voice-keep"), "0");
  const refused = fixture({ ...EL, ELEVENLABS_V3: "1" }, ({ body }) => body.model_id === "eleven_v3" ? new Response(secret, { status: 403 }) : pcm());
  const b = await refused.post({ text: "Nice one." });
  expectVoice(b, "elevenlabs", "eleven_v4_turbo");
  assert.equal(b.headers.get("x-sona-voice-keep"), "1");
});

test("A 401 on v4 Turbo that v2 then answers is a stand-in, and v4 is tried again", async () => {
  const f = fixture(EL, (_, count) => count === 1 ? new Response(secret, { status: 401 }) : pcm());
  const r = await f.post({ text: "Nice one." });
  expectVoice(r, "elevenlabs", "eleven_multilingual_v2");
  assert.equal(r.headers.get("x-sona-voice-keep"), "0");
  await f.post({ text: "Well done." });
  assert.equal(f.calls[2].body.model_id, "eleven_v4_turbo", "a 401 is the key, not a refusal of the model");
});

test("A refusal is remembered only when v2 then answers: a voice every model rejects is not pinned to v2", async () => {
  let down = true;
  const f = fixture(EL, () => down ? new Response(secret, { status: 404 }) : pcm());
  await expectFailure(await f.post({ text: "Nice one.", voice: "flaky-voice" }));
  assert.deepEqual(f.calls.map((c) => c.body.model_id), ["eleven_v4_turbo", "eleven_multilingual_v2"]);
  down = false;
  expectVoice(await f.post({ text: "Nice one.", voice: "flaky-voice" }), "elevenlabs", "eleven_v4_turbo");
});

// ── TTSBUDGET1 (14 Nov 2026, audit server.md B1) ──
test("An unknown voice is spoken in Echo's voice, never put in the vendor URL", async () => {
  const f = fixture();
  for (const voice of ["made-up", "../../v1/user", "x?y=1#z", "another-voice"]) {
    expectVoice(await f.post({ text: `Nice one ${f.calls.length}.`, voice }), "elevenlabs", "eleven_v4_turbo");
  }
  assert.equal(f.calls.length, 4);
  for (const c of f.calls) {
    assert.equal(c.url, `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE}?output_format=pcm_24000`);
  }
});

test("A configured voice id is URL-encoded into the vendor's address", async () => {
  const f = fixture({ ...EL, ELEVENLABS_VOICE_ID: "a/b?c#d" });
  expectVoice(await f.post({ text: "Hello" }), "elevenlabs", "eleven_v4_turbo");
  assert.equal(f.calls[0].url, "https://api.elevenlabs.io/v1/text-to-speech/a%2Fb%3Fc%23d?output_format=pcm_24000");
});

test("Another website's page is refused before anything else; a request with no Origin is not", async () => {
  for (const headers of [
    { origin: "https://evil.example" },
    { origin: "https://speaksona.com.evil.example" },
    { origin: "null" },
    { "sec-fetch-site": "cross-site" },
    { "sec-fetch-site": "same-site" },
    { origin: SELF, "sec-fetch-site": "cross-site" },
  ]) {
    const f = fixture();
    const r = await f.post(undefined, headers);
    assert.equal(r.status, 403, JSON.stringify(headers));
    assert.equal(f.calls.length, 0);
    assert.equal(f.parsed, 0, "the body is never read");
    assert.equal(f.budget.limits.length, 0, "refused before it costs a rate-limit call");
  }
  for (const headers of [{}, { origin: SELF }, { "sec-fetch-site": "same-origin" }, { origin: SELF, "sec-fetch-site": "same-origin" }]) {
    const f = fixture();
    expectVoice(await f.post(undefined, headers), "elevenlabs", "eleven_v4_turbo");
  }
});

test("The per-IP limit is 60 a minute, counted by an IPv6 address's /64", async () => {
  const f = fixture();
  await f.post();
  assert.deepEqual({ ...f.budget.limits[0] }, { key: "tts", limit: 60, windowSec: 60, v6prefix: true });
});

test("A body over 4 KB is refused before it is read", async () => {
  const f = fixture();
  const r = await f.post(undefined, { origin: SELF, "content-length": "4097" });
  await expectFailure(r, 413);
  assert.equal(f.parsed, 0);
  assert.equal(f.calls.length, 0);
  expectVoice(await f.post(undefined, { origin: SELF, "content-length": "4096" }), "elevenlabs", "eleven_v4_turbo");
});

test("Text over 200 characters is refused, never cut; 200 is spoken whole", async () => {
  for (const env of [EL, OA]) {
    const f = fixture(env);
    await expectFailure(await f.post({ text: "a".repeat(201) }), 413);
    assert.equal(f.calls.length, 0);
    assert.equal(f.budget.spends.length, 0, "nothing charged");
    const r = await f.post({ text: "b".repeat(200) });
    assert.equal(r.status, 200);
    const sent = f.calls[0].body.text ?? f.calls[0].body.input;
    assert.equal(sent, "b".repeat(200));
  }
});

test("Every line Echo can say fits the length cap (VOICE_SCRIPT.md parts B and C, and the parked chapters)", async () => {
  const max = Number(source.match(/const MAX_TEXT = (\d+);/)?.[1]);
  assert.equal(max, 200);
  const md = readFileSync(path.join(root, "VOICE_SCRIPT.md"), "utf8").split("\n");
  let part = "", section = "", col = -1, n = 0;
  const long = [];
  for (const l of md) {
    if (l.startsWith("## Part ")) part = l[8];
    if (l.startsWith("### ")) { section = l.split(" ")[1]; col = -1; }
    if (!/^[BC]$/.test(part) && section !== "E1") continue;
    if (section === "E1") {
      const m = l.match(/^\d+\. (.*)$/);
      if (m) { n++; if (m[1].length > max) long.push(`E1: ${m[1]}`); }
      continue;
    }
    if (!l.startsWith("|")) continue;
    const cells = l.replace(/\\\|/g, "¦").replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells.includes("Say this")) { col = cells.indexOf("Say this"); continue; }
    if (col < 0 || /^[-: ]*$/.test(cells[col] || "")) continue;
    n++;
    if (cells[col].length > max) long.push(`${section}: ${cells[col]}`);
  }
  assert.ok(n > 900, `read ${n} lines: the sheet's layout changed`);
  assert.deepEqual(long, [], "a line over MAX_TEXT would quietly play in the phone's voice");
});

test("Characters are charged only when a vendor is asked: per IP an hour, everyone a UTC day", async () => {
  const f = fixture(EL, () => pcm());
  expectVoice(await f.post({ text: "[excited] Hello there" }), "elevenlabs", "eleven_v4_turbo");
  const day = new Date().toISOString().slice(0, 10);
  assert.deepEqual(f.budget.spends.map((s) => ({ ...s })), [
    { key: "rl:ttschars:203.0.113.7", amount: "Hello there".length, cap: 15000, windowSec: 3600 },
    { key: `tts:chars:${day}`, amount: "Hello there".length, cap: 200000, windowSec: 172800 },
  ], "the charge is the text actually sent (tags stripped), with the default caps");
  expectVoice(await f.post({ text: "Hello there" }), "elevenlabs", "eleven_v4_turbo", "hit");
  assert.equal(f.budget.spends.length, 2, "a server cache hit is free");
  // A fallback model inside the same request is not charged again.
  const g = fixture(EL, ({ body }) => body.model_id === "eleven_v4_turbo" ? new Response(secret, { status: 503 }) : pcm());
  await g.post({ text: "Nice one." });
  assert.equal(g.calls.length, 2);
  assert.equal(g.budget.spends.length, 2);
  // OpenAI is charged the same way.
  const o = fixture(OA);
  await o.post({ text: "Hello" });
  assert.deepEqual(o.budget.spends.map((s) => s.amount), [5, 5]);
});

test("Over a budget the route fails like a vendor outage: 503, Retry-After, no vendor call, never kept", async () => {
  for (const [env, over, retry] of [
    [{ ...EL, TTS_DAILY_CHARS: "20" }, "daily", (s) => s > 0 && s <= 86400],
    [{ ...EL, TTS_IP_HOURLY_CHARS: "20" }, "ip", (s) => s === 3600],
    [{ ...OA, TTS_DAILY_CHARS: "20" }, "daily (OpenAI)", (s) => s > 0 && s <= 86400],
  ]) {
    const f = fixture(env, (_, count) => pcm(count));
    assert.equal((await f.post({ text: "a".repeat(15) })).status, 200, over);
    const r = await f.post({ text: "b".repeat(15) });
    assert.equal(r.status, 503, over);
    assert.ok(retry(Number(r.headers.get("retry-after"))), `${over}: Retry-After ${r.headers.get("retry-after")}`);
    assert.equal(r.headers.get("x-sona-voice-keep"), "0");
    const body = await r.clone().json();
    assert.equal(body.budget, true);
    await expectFailure(r, 503);
    assert.equal(f.calls.length, 1, `${over}: no vendor call once over`);
    // A refused request charged nothing: a short line still fits.
    assert.equal((await f.post({ text: "c".repeat(5) })).status, 200, `${over}: a refusal charged nothing`);
    assert.equal(f.calls.length, 2);
  }
  const f = fixture({ ...EL, TTS_DAILY_CHARS: "5" });
  await f.post({ text: "Hello there" });
  await f.post({ text: "Hello again" });
  assert.equal(f.logs.filter((l) => /daily character budget reached/.test(l)).length, 1, "logged once a day");
  assert.ok(f.logs.every((l) => !/Hello/.test(l)), "never the text");
});

test("A bad budget setting falls back to the default, never to no budget", async () => {
  for (const v of ["", "0", "-5", "abc", "1.5"]) {
    const f = fixture({ ...EL, TTS_DAILY_CHARS: v, TTS_IP_HOURLY_CHARS: v });
    await f.post({ text: "Hello" });
    assert.deepEqual(f.budget.spends.map((s) => s.cap), [15000, 200000], v);
  }
});

test("lib/rateLimit's spendBudget refuses without a partial charge, and counts in memory without a store", async () => {
  const src = readFileSync(path.join(root, "lib/rateLimit.ts"), "utf8");
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const load = (kv) => {
    const ex = {};
    vm.runInNewContext(out, {
      exports: ex, Date, Map, Number, Math, String, Array,
      require(id) {
        if (id === "node:crypto") return { default: {} };
        if (id === "next/server") return { NextResponse };
        if (id === "@/lib/slpAuth") return kv;
        throw new Error(id);
      },
    });
    return ex;
  };
  const mem = load({ kvConfigured: () => false, kvCmd: async () => undefined });
  assert.equal(await mem.spendBudget("k", 8, 10, 60), true);
  assert.equal(await mem.spendBudget("k", 3, 10, 60), false, "8 + 3 passes 10");
  assert.equal(await mem.spendBudget("k", 2, 10, 60), true, "the refusal charged nothing");
  assert.equal(await mem.spendBudget("k", 1, 10, 60), false);
  // With a store: one script, marked rl:spend, that checks before it charges.
  const evals = [];
  const kv = load({ kvConfigured: () => true, kvCmd: async (cmd) => { evals.push(cmd); return evals.length === 1 ? 8 : -1; } });
  assert.equal(await kv.spendBudget("tts:chars:x", 8, 10, 60), true);
  assert.equal(await kv.spendBudget("tts:chars:x", 3, 10, 60), false);
  assert.match(evals[0][1], /^-- rl:spend/);
  assert.equal(JSON.stringify(evals[0].slice(2)), JSON.stringify([1, "tts:chars:x", 8, 10, 60]));
  const script = evals[0][1];
  assert.ok(script.indexOf("return -1") < script.indexOf("INCRBY"), "refuses before it charges");
  assert.match(script, /EXPIRE/);
  // A store that does not answer: counted in memory, never refused for that.
  const down = load({ kvConfigured: () => true, kvCmd: async () => undefined });
  assert.equal(await down.spendBudget("d", 5, 10, 60), true);
  assert.equal(await down.spendBudget("d", 6, 10, 60), false);
  assert.match(src, /export function clientIp/);
});

test("A fallback leaves a log line with the model and status, never the words", async () => {
  const f = fixture(EL, ({ body }) => body.model_id === "eleven_v4_turbo" ? new Response(secret, { status: 503 }) : pcm());
  await f.post({ text: "Ready, Mia? Say rabbit." });
  assert.ok(f.logs.some((l) => /eleven_v4_turbo/.test(l) && /503/.test(l)), f.logs.join(" / "));
  assert.ok(f.logs.every((l) => !/Mia|rabbit/.test(l) && !l.includes(secret)), "no spoken text or vendor body in logs");
  // The thrown path too: the error carries the words and the vendor detail.
  const t = fixture(EL, ({ body }) => { if (body.model_id === "eleven_v4_turbo") throw new Error(`${secret} Ready, Mia? Say rabbit.`); return pcm(); });
  await t.post({ text: "Ready, Mia? Say rabbit.", voice: "voice-id-xyz" });
  assert.ok(t.logs.some((l) => /eleven_v4_turbo/.test(l)), t.logs.join(" / "));
  assert.ok(t.logs.every((l) => !/Mia|rabbit|voice-id-xyz/.test(l) && !l.includes(secret)), t.logs.join(" / "));
});

test("Every page that keeps clips on the phone skips a stand-in", async () => {
  const { readdirSync } = await import("node:fs");
  const missing = [];
  for (const file of readdirSync(path.join(root, "public")).filter((f) => /\.(html|js)$/.test(f))) {
    const text = readFileSync(path.join(root, "public", file), "utf8");
    const saves = /ttsPut\(|cache\(job, key, fresh\)/.test(text) && text.includes('"/api/tts"');
    // The header must be READ in code, not merely named in a comment.
    const reads = /(headers\.get|header)\("X-Sona-Voice-Keep"\)/.test(text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ""));
    if (saves && !reads) missing.push(file);
  }
  assert.deepEqual(missing, [], "these pages save clips without checking X-Sona-Voice-Keep");
});

test("Missing configuration, blank input, and rate limits never call a vendor", async () => {
  const missing = fixture({});
  await expectFailure(await missing.post(), 500);
  assert.equal(missing.calls.length, 0);
  const blank = fixture();
  await expectFailure(await blank.post({ text: " " }), 400);
  assert.equal(blank.calls.length, 0);
  const limited = fixture(EL, () => pcm(), NextResponse.json({ ok: false }, { status: 429 }));
  await expectFailure(await limited.post(), 429);
  assert.equal(limited.calls.length, 0);
});

let failed = 0;
for (const { name, run } of tests) {
  try { await run(); console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
console.log(`TTS route: ${tests.length - failed}/${tests.length} passed${process.env.TTS_ROUTE_REF ? ` (baseline ${process.env.TTS_ROUTE_REF})` : ""}`);
process.exitCode = failed ? 1 : 0;
