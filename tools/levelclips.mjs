#!/usr/bin/env node
// tools/levelclips.mjs — bring every clip in a folder to the level of a TTS line.
//
//   node tools/levelclips.mjs                  levels public/coach/say-echo/ in place
//   node tools/levelclips.mjs <dir> [--force]  another folder; --force re-encodes
//                                              clips that are already at level
//
// WHY. /api/tts levels every generated line once, on the server: -20 dB RMS over
// the spoken frames, no peak above -3 dB. A recorded clip plays as-is, so it was
// the one sound left that could jump: ElevenLabs speech-to-speech handed back
// the re-voiced set 2–5 dB hotter than the lines around it with peaks at the
// ceiling (25 Sep 2026), and a take from a phone is anyone's guess. Travis's
// complaint was exactly that jump ("too loud or too quiet").
//
// HOW. Chromium decodes the clip (the decoder the app plays it with). The gain
// is the tts route's OWN levelPcm — run unchanged out of route.ts, not a copy
// that can drift — on a 24 kHz render of the clip; that one gain is applied to
// the full-rate audio with the same 10 ms fades, and lamejs writes the mp3 back
// (mono, the clip's own rate, 128 kbps: what ElevenLabs delivered). One
// multiplication, no compression, same as the route. A clip already within
// 0.3 dB is left alone, so running this twice never re-encodes anything.
//
// Needs `npm i --no-save lamejs`. It is not a dependency of the app: nothing
// that ships encodes audio, and no test needs it (storytest only decodes).
import { createServer } from "http";
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { createRequire } from "module";
import vm from "vm";
import { fileURLToPath } from "url";
import path from "path";
import { chromium, launchOpts } from "../tests/_env.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const DIR = path.resolve(ROOT, args.find((a) => !a.startsWith("--")) || "public/coach/say-echo");
const SKIP_DB = 0.3;

// ── the route's levelPcm, unchanged ──────────────────────────────────────────
const ts = require("typescript");
const routeSrc = readFileSync(path.join(ROOT, "app/api/tts/route.ts"), "utf8");
const code = ts.transpileModule(routeSrc, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  + "\nexports.__levelPcm = levelPcm; exports.__fade = LEVEL_FADE; exports.__frame = LEVEL_FRAME;";
const sandbox = {
  exports: {}, process: { env: {} }, AbortController, Response, Uint8Array, ArrayBuffer, Error, setTimeout, clearTimeout,
  fetch() { throw new Error("levelclips never talks to a voice service"); },
  require(id) {
    if (id === "next/server") return { NextResponse: class extends Response {} };
    if (id === "@/lib/rateLimit") return { rateLimit: async () => null };
    throw new Error("Unexpected route import " + id);
  },
};
vm.runInNewContext(code, sandbox, { filename: "app/api/tts/route.ts" });
const { __levelPcm: levelPcm, __fade: FADE24, __frame: FRAME24 } = sandbox.exports;
const RATE24 = 24000;
if (FRAME24 !== 480) throw new Error("levelPcm no longer works on 24 kHz PCM — update this tool");

// ── lamejs (1.2.1 forgets its own globals under Node) ────────────────────────
let lamejs;
try {
  globalThis.MPEGMode = require("lamejs/src/js/MPEGMode.js");
  globalThis.Lame = require("lamejs/src/js/Lame.js");
  globalThis.BitStream = require("lamejs/src/js/BitStream.js");
  lamejs = require("lamejs");
} catch (e) {
  console.error("lamejs is not installed — run `npm i --no-save lamejs` first.", String(e).slice(0, 120));
  process.exit(2);
}

// The same reading /api/tts levels to (20 ms frames, -50 dB pause gate, -20 dB
// relative gate, RMS over what is left), so the log speaks the route's units.
function measure(x, rate) {
  const n = x.length; let peak = 0;
  for (let i = 0; i < n; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; }
  const F = Math.round(rate * 0.02), frames = [];
  for (let s = 0; s < n; s += F) { const e = Math.min(n, s + F); let sum = 0; for (let i = s; i < e; i++) sum += x[i] * x[i]; frames.push({ sum, len: e - s }); }
  const db = (a) => 20 * Math.log10(a || 1e-12), amp = (d) => Math.pow(10, d / 20);
  const spoken = frames.filter((f) => f.sum / f.len >= amp(-50) ** 2);
  let rms = 0;
  if (spoken.length) {
    const mean = spoken.reduce((t, f) => t + f.sum, 0) / spoken.reduce((t, f) => t + f.len, 0);
    const speech = spoken.filter((f) => f.sum / f.len >= mean * amp(-20) ** 2);
    rms = Math.sqrt(speech.reduce((t, f) => t + f.sum, 0) / speech.reduce((t, f) => t + f.len, 0));
  }
  return { peak: +db(peak).toFixed(1), rms: +db(rms).toFixed(1) };
}
const clamp16 = (v) => Math.max(-32768, Math.min(32767, Math.round(v)));

const files = readdirSync(DIR).filter((f) => f.endsWith(".mp3")).sort();
if (!files.length) { console.error("no .mp3 files in " + DIR); process.exit(1); }
const srv = createServer((req, res) => {
  const f = decodeURIComponent(new URL(req.url, "http://x").pathname.slice(1));
  if (!f) { res.writeHead(200, { "content-type": "text/html" }); res.end("<html></html>"); return; }
  try { const b = readFileSync(path.join(DIR, f)); res.writeHead(200, { "content-type": "audio/mpeg" }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const browser = await chromium.launch(launchOpts());
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${srv.address().port}/`);

let changed = 0, kept = 0, failed = 0;
// Chromium decodes at the clip's own rate (the audio written back) and at
// 24 kHz (what the route's levelling reads).
async function decodeFile(name) {
  return page.evaluate(async (name) => {
    const ab = await (await fetch("/" + encodeURIComponent(name) + "?" + Date.now())).arrayBuffer();
    const probe = await new AudioContext().decodeAudioData(ab.slice(0));
    const rate = probe.sampleRate;
    const full = await new OfflineAudioContext(1, 1, rate).decodeAudioData(ab.slice(0));
    const low = await new OfflineAudioContext(1, 1, 24000).decodeAudioData(ab.slice(0));
    const b64 = (f32) => { const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength); let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
    return { rate, channels: full.numberOfChannels, full: b64(full.getChannelData(0)), low: b64(low.getChannelData(0)) };
  }, name).then((got) => {
    const fb = Buffer.from(got.full, "base64"), lb = Buffer.from(got.low, "base64");
    return { rate: got.rate, channels: got.channels, full: new Float32Array(fb.buffer, fb.byteOffset, fb.length / 4), low: new Float32Array(lb.buffer, lb.byteOffset, lb.length / 4) };
  });
}
// The one gain the route would apply: levelPcm on the 24 kHz render, read back
// as the least-squares ratio of its output to its input (fades excluded).
function routeGain(low) {
  const pcm = new ArrayBuffer(low.length * 2), dv = new DataView(pcm);
  for (let i = 0; i < low.length; i++) dv.setInt16(i * 2, clamp16(low[i] * 32768), true);
  const out = new DataView(levelPcm(pcm));
  let num = 0, den = 0;
  for (let i = FADE24; i < low.length - FADE24; i++) { const a = dv.getInt16(i * 2, true), b = out.getInt16(i * 2, true); num += a * b; den += a * a; }
  return den ? num / den : 1;
}
function encode(full, rate, gain) {
  const fade = Math.round(rate * (FADE24 / RATE24)), n = full.length, s16 = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    let g = gain;
    if (i < fade) g *= i / fade;
    const fromEnd = n - 1 - i;
    if (fromEnd < fade) g *= fromEnd / fade;
    s16[i] = clamp16(full[i] * g * 32768);
  }
  const enc = new lamejs.Mp3Encoder(1, rate, 128), parts = [];
  for (let i = 0; i < n; i += 1152) { const c = enc.encodeBuffer(s16.subarray(i, i + 1152)); if (c.length) parts.push(Buffer.from(new Uint8Array(c.buffer, c.byteOffset, c.byteLength))); }
  const tail = enc.flush(); if (tail.length) parts.push(Buffer.from(new Uint8Array(tail.buffer, tail.byteOffset, tail.byteLength)));
  return Buffer.concat(parts);
}
const dB = (g) => 20 * Math.log10(g);
for (const f of files) {
  let d;
  try { d = await decodeFile(f); } catch (e) { console.log("fail", f, "could not decode:", String(e).slice(0, 100)); failed++; continue; }
  const before = measure(d.full, d.rate);
  let gain = routeGain(d.low);
  if (Math.abs(dB(gain)) < SKIP_DB && !FORCE) { console.log("ok  ", f.padEnd(14), "at level", JSON.stringify(before)); kept++; continue; }
  // Write, then read the file back the way the app will and correct once: the
  // mp3 round trip lands about half a dB under the target (lamejs scales its
  // input by 0.95), and a clip should measure right AS DECODED, not as encoded.
  writeFileSync(path.join(DIR, f), encode(d.full, d.rate, gain));
  let back = await decodeFile(f), fix = routeGain(back.low);
  if (Math.abs(dB(fix)) >= 0.1) { gain *= fix; writeFileSync(path.join(DIR, f), encode(d.full, d.rate, gain)); back = await decodeFile(f); }
  console.log("set ", f.padEnd(14), (dB(gain) >= 0 ? "+" : "") + dB(gain).toFixed(1) + " dB", JSON.stringify(before), "→", JSON.stringify(measure(back.full, back.rate)), d.rate + " Hz" + (d.channels > 1 ? " (mono of " + d.channels + ")" : ""));
  changed++;
}
await browser.close(); srv.close();
console.log(`DONE levelled=${changed} at-level=${kept} failed=${failed} of ${files.length} in ${path.relative(ROOT, DIR)}`);
process.exit(failed ? 1 : 0);
