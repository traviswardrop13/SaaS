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
function fixture(env = EL, vendor = () => pcm(), limited = null) {
  const calls = [], timers = new Map(), exports = {}, settings = { ...env };
  let timerId = 0;
  const context = {
    exports, process: { env: settings }, AbortController, Response, Uint8Array, ArrayBuffer, Error,
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    async fetch(url, options) {
      const call = { url, options, body: JSON.parse(options.body) };
      calls.push(call);
      return vendor(call, calls.length);
    },
    require(id) {
      if (id === "next/server") return { NextResponse };
      if (id === "@/lib/rateLimit") return { rateLimit: async () => limited };
      throw new Error(`Unexpected route import ${id}`);
    },
  };
  vm.runInNewContext(code, context, { filename: "app/api/tts/route.ts" });
  return {
    calls, timers, env: settings,
    post: (body = { text: "Ready to play?" }) => exports.POST({ json: async () => body }),
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
  // v8 (24 Sep 2026): levelled clips + calmer settings + a fixed seed. Must
  // match TTS_CACHE_VERSION in public/sona.js (pinned below).
  assert.equal(response.headers.get("x-sona-voice-revision"), "v8");
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
  const f = fixture();
  const response = await f.post({ text: "Ready?", voice: "profile-voice", stable: true });
  expectVoice(response, "elevenlabs", "eleven_multilingual_v2");
  assert.ok(f.calls[0].url.includes("/profile-voice?output_format=pcm_24000"));
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
  const f = fixture(EL, (_, count) => pcm(count));
  const first = await f.post({ text: "[excited] Hello" });
  expectVoice(first, "elevenlabs", "eleven_multilingual_v2");
  const cached = await f.post({ text: "Hello" });
  expectVoice(cached, "elevenlabs", "eleven_multilingual_v2", "hit");
  assert.equal(f.calls.length, 1, "cache uses text actually sent to this model");
  assert.deepEqual(new Uint8Array(await first.arrayBuffer()), new Uint8Array(await cached.arrayBuffer()));
  f.env.ELEVENLABS_SPEED = "0.90";
  expectVoice(await f.post({ text: "Hello" }), "elevenlabs", "eleven_multilingual_v2");
  assert.equal(f.calls[1].body.voice_settings.speed, 0.9);
  f.env.ELEVENLABS_MODEL = "eleven_turbo_v2_5";
  expectVoice(await f.post({ text: "Hello" }), "elevenlabs", "eleven_turbo_v2_5");
  await f.post({ text: "Hello", voice: "another-voice" });
  assert.equal(f.calls.length, 4);
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
  f.env.ELEVENLABS_MODEL = "eleven_turbo_v2_5";
  await f.post({ text: "Hello" });
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].body.model_id, "eleven_turbo_v2_5");
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
  expectVoice(await f.post({ text: "[excited] Hello" }), "elevenlabs", "eleven_multilingual_v2");
  assert.equal(f.calls[1].body.text, "Hello");
  assert.ok(f.calls[0].options.signal);
  assert.equal(f.calls[0].options.signal, f.calls[1].options.signal, "fallback shares the same deadline");
  expectVoice(await f.post({ text: "Hello" }), "elevenlabs", "eleven_multilingual_v2", "hit");
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
    assert.equal(f.calls.length, 2);
  });
  test(`${name} vendor work is bounded below the browser timeout`, async () => {
    const f = fixture(env, ({ options }) => new Promise((_, reject) => {
      options.signal?.addEventListener("abort", () => reject(new Error(secret)), { once: true });
    }));
    const request = f.post();
    // POST first awaits rateLimit and request.json; let it reach the vendor.
    for (let i = 0; i < 8 && !f.calls.length; i++) await Promise.resolve();
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
  for (let i = 0; i < 12; i++) await Promise.resolve();
  assert.equal(f.timers.size, 1);
  f.expire();
  await expectFailure(await request, 504);
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
    assert.equal(body.revision, "v8"); // 24 Sep 2026: bumped with the levelling
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
  assert.equal(seeds.length, 4, "v3 attempt, v2 fallback, and two more lines");
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
  expectVoice(hit, "elevenlabs", "eleven_multilingual_v2", "hit");
  assert.equal(f.calls.length, 1);
  const raw = new Uint8Array(await clip(samples).arrayBuffer());
  assert.notDeepEqual(first, raw, "the response is the levelled clip, not the vendor's bytes");
  assert.deepEqual(new Uint8Array(await hit.arrayBuffer()), first, "the hit is byte-identical to the levelled miss");
});

// ── v8 everywhere (24 Sep 2026) ──
// The phone keys its saved clips by TTS_CACHE_VERSION; the server stamps
// VOICE_REVISION. If they drift, families replay the old unlevelled takes
// forever. Pages that fall back to a literal when Sona is missing must fall
// back to the SAME version, or that page alone keeps the old clips.
test("Server revision, device cache version and every page fallback agree on v8", async () => {
  const sona = readFileSync(path.join(root, "public/sona.js"), "utf8");
  const device = sona.match(/const TTS_CACHE_VERSION = "([^"]+)";/)?.[1];
  const server = source.match(/const VOICE_REVISION = "([^"]+)";/)?.[1];
  assert.equal(server, "v8");
  assert.equal(device, server, "sona.js TTS_CACHE_VERSION moves with the route's VOICE_REVISION");
  const { readdirSync } = await import("node:fs");
  const stale = [];
  for (const file of readdirSync(path.join(root, "public")).filter((f) => /\.(html|js)$/.test(f))) {
    const text = readFileSync(path.join(root, "public", file), "utf8");
    for (const m of text.matchAll(/TTS_CACHE_VERSION\)?\s*\|\|\s*["'](v\d+)["']/g)) if (m[1] !== device) stale.push(`${file}: ${m[0]}`);
  }
  assert.deepEqual(stale, [], "a page falls back to an older voice version");
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
