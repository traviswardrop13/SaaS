// Build the ONE take of each target sound that plays in the letter's place
// inside Echo's v4 Turbo words ("…and make your [rrrr] sound, five times.") —
// Travis, 29 Sep 2026: v4 Turbo for every word, a recording only for the split
// second of the sound itself.
//   node tools/soundclips.mjs        # → public/coach/say-echo/<S>-sound.wav
// Needs ELEVENLABS_API_KEY (env or .env.local) for the voiceless takes, and
// macOS's afconvert to decode Rachel's demos. A dev tool: the app only loads
// the files it writes.
//
// WHERE EACH TAKE COMES FROM, measured (29 Sep 2026), not assumed:
// - R is Rachel's OWN voice: take 1 of her raw demo (/coach/say/R-demo.mp3),
//   picked by ear by Travis on 1 Oct 2026 ("use number 4"). The voice
//   changer moved her R's third formant from about 1,430 Hz to about 2,900
//   (LPC medians, measured 1 Oct 2026) — toward /w/, the "wabbit" the child is
//   here to fix — and a gentler setting (stability 0.85, similarity 0.25)
//   still left it near 1,850.
// - The other VOICED sounds (B D G J M N V Z L THV) are Rachel's re-voiced demos
//   (/coach/say-echo/<S>-demo.mp3, tools/revoice.mjs). The voice changer keeps
//   a voiced sound voiced, and her production is the clinical model. Each take
//   is picked BY HAND from the burst map below, never "the first burst": for
//   K the first burst was room noise the voice changer had turned into a
//   vowel, L's first burst ran on into "la la la", S's carried a breath.
// - VOICELESS sounds (P T K CH F S SH TH) are v4 Turbo's own, in Echo's voice.
//   The voice changer VOICES them: her raw F measures 7–22 % voiced frames,
//   the re-voiced F 100 %; SH 1 % → 27–58 %; TH 0 % → 53–67 %; CH 8–18 % →
//   70–94 % — a buzz where a child must hear a whisper, on the very pairs the
//   cues separate ("Like F, but buzz your voice"). v4 Turbo renders them
//   unvoiced (0–6 % for S SH TH T K P CH), the stops as short bursts, never
//   letter names. Her raw takes are also clean but never play (storytest).
// Every take is levelled to sound as loud as Echo's words to the ear: equal
// A-weighted loudness with a reference v4 Turbo line at /api/tts's level, one
// gain, peaks ≤ −3 dBFS — a plain RMS match left hisses ~3–4 dB louder and
// hums ~4–6 dB quieter than the words around them. 10 ms fades. WAV, 24 kHz
// mono 16-bit, the rate Echo's words arrive in (charge.html refuses others).
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { aWeightedLevel } from "./aweight.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const DIR = ROOT + "public/coach/say-echo/";
const RATE = 24000;
// Rachel's re-voiced demos: [from, to] seconds, margins included, read off a
// 10 ms burst map (onset/offset at 30 dB under the peak).
const DEMO = {
  B: [0.05, 0.34], D: [0.07, 0.35], G: [0.07, 0.43], J: [0.08, 0.47],
  M: [0.05, 1.23], N: [0.08, 1.09], V: [0.08, 1.30], Z: [0.08, 1.04],
  L: [0.00, 0.57], THV: [0.09, 0.98],
};
// Rachel's own (raw) demos, same burst map: the sounds the voice changer bends.
const OWN = { R: [0.00, 1.24] };
// v4 Turbo: what it is sent, and which burst of the render to keep.
const V4 = {
  P: ["p... p... p", 0], T: ["t... t... t", 0], K: ["k... k... k", 0], CH: ["ch... ch... ch", 0],
  F: ["ffffff", "longest"], S: ["ssssss", 0], SH: ["shhhhhh", 0], TH: ["thhhhhh", 0],
};
// Exactly the route's delivery (app/api/tts/route.ts): voice, model, settings, seed.
const VOICE = "qBDvhofpxp92JgXJxDjB", MODEL = "eleven_v4_turbo", SEED = 20260924;
const SETTINGS = { stability: 0.7, similarity_boost: 0.85, style: 0, speed: 0.93, use_speaker_boost: true };
const REFERENCE = "sound, five times.";

const key = process.env.ELEVENLABS_API_KEY || (existsSync(ROOT + ".env.local") && (readFileSync(ROOT + ".env.local", "utf8").match(/^ELEVENLABS_API_KEY=["']?([^"'\s]+)/m) || [])[1]);
if (!key) { console.error("soundclips: ELEVENLABS_API_KEY is not set (env or .env.local)."); process.exit(1); }
async function tts(text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=pcm_24000`, {
    method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS, seed: SEED }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status} for "${text}"`);
  const b = Buffer.from(await r.arrayBuffer());
  return Float64Array.from({ length: b.length >> 1 }, (_, i) => b.readInt16LE(i * 2) / 32768);
}
const tmp = mkdtempSync(join(tmpdir(), "soundclips-"));
function decode(mp3) {
  const out = join(tmp, "d.wav");
  execFileSync("afconvert", ["-f", "WAVE", "-d", `LEI16@${RATE}`, "-c", "1", mp3, out]);
  const b = readFileSync(out); let off = 12;
  while (off < b.length) {
    const id = b.toString("ascii", off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === "data") return Float64Array.from({ length: size >> 1 }, (_, i) => b.readInt16LE(off + 8 + i * 2) / 32768);
    off += 8 + size;
  }
  throw new Error("no data chunk in " + mp3);
}
// Bursts of a render: 10 ms frames over peak − 30 dB, split on gaps > 60 ms.
function bursts(x) {
  const F = 240, db = [];
  for (let s = 0; s + F <= x.length; s += F) { let e = 0; for (let i = s; i < s + F; i++) e += x[i] * x[i]; db.push(10 * Math.log10(e / F + 1e-12)); }
  const thr = Math.max(...db) - 30, out = []; let st = -1, gap = 0;
  db.forEach((d, i) => { if (d > thr) { if (st < 0) st = i; gap = 0; } else if (st >= 0 && ++gap > 6) { out.push([st * F, (i - gap + 1) * F]); st = -1; gap = 0; } });
  if (st >= 0) out.push([st * F, db.length * F]);
  return out;
}
function v4Take(x, pick) {
  const b = bursts(x);
  const i = pick === "longest" ? b.reduce((best, s, k) => (s[1] - s[0] > b[best][1] - b[best][0] ? k : best), 0) : pick;
  const [a, z] = b[i], prev = i > 0 ? b[i - 1][1] : 0, next = i + 1 < b.length ? b[i + 1][0] : x.length;
  return x.slice(Math.max(prev, a - Math.round(0.05 * RATE)), Math.min(next, z + Math.round(0.08 * RATE)));
}
const amp = (db) => Math.pow(10, db / 20);
// /api/tts's own levelling (levelPcm): −20 dBFS RMS over the spoken frames.
function routeLevel(x) {
  const F = 480, frames = [];
  for (let s = 0; s < x.length; s += F) { const e = Math.min(x.length, s + F); let sum = 0; for (let i = s; i < e; i++) sum += x[i] * x[i]; frames.push({ sum, len: e - s }); }
  const spoken = frames.filter((f) => f.sum / f.len >= amp(-50) ** 2);
  const mean = spoken.reduce((t, f) => t + f.sum, 0) / spoken.reduce((t, f) => t + f.len, 0);
  const speech = spoken.filter((f) => f.sum / f.len >= mean * amp(-20) ** 2);
  const rms = Math.sqrt(speech.reduce((t, f) => t + f.sum, 0) / speech.reduce((t, f) => t + f.len, 0));
  return x.map((v) => v * amp(-20) / rms);
}
function finish(x, targetA) {
  // Which frames count as spoken depends on the level (a fixed −50 dBFS
  // floor), so a short burst's measure moves with its gain: settle it.
  let gain = 1;
  for (let i = 0; i < 6; i++) gain *= amp(targetA - aWeightedLevel(x.map((v) => v * gain), RATE));
  const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  gain = Math.min(gain, (Math.floor(amp(-3) * 32768 - 1) / 32768) / peak);
  const fade = Math.min(240, x.length >> 1);
  return x.map((v, i) => v * gain * Math.min(1, i / fade, (x.length - 1 - i) / fade));
}
function wav(x) {
  const n = x.length * 2, h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + n, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(n, 40);
  const d = Buffer.alloc(n); x.forEach((v, i) => d.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32768))), i * 2));
  return Buffer.concat([h, d]);
}
try {
  const targetA = aWeightedLevel(routeLevel(await tts(REFERENCE)), RATE);
  console.log(`reference "${REFERENCE}" at the route's level: ${targetA.toFixed(1)} dB A-weighted`);
  for (const s of ["P", "B", "M", "N", "T", "D", "K", "G", "F", "V", "S", "Z", "SH", "CH", "J", "L", "R", "TH", "THV"]) {
    let take, from;
    if (OWN[s]) { const x = decode(ROOT + "public/coach/say/" + s + "-demo.mp3"), [a, z] = OWN[s]; take = x.slice(Math.round(a * RATE), Math.round(z * RATE)); from = `Rachel's own demo ${a.toFixed(2)}–${z.toFixed(2)} s`; }
    else if (DEMO[s]) { const x = decode(DIR + s + "-demo.mp3"), [a, z] = DEMO[s]; take = x.slice(Math.round(a * RATE), Math.round(z * RATE)); from = `Rachel's demo ${a.toFixed(2)}–${z.toFixed(2)} s`; }
    else { const [text, pick] = V4[s]; take = v4Take(await tts(text), pick); from = `v4 Turbo "${text}" (burst ${pick})`; }
    const out = finish(take, targetA);
    writeFileSync(DIR + s + "-sound.wav", wav(out));
    console.log(`${s.padEnd(4)} ${(out.length / RATE).toFixed(2)} s  ← ${from}`);
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }
