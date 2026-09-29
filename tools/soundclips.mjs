// Cut ONE clean take of each target sound out of Rachel's re-voiced demos, for
// the moment Echo's v4 Turbo voice hands over to her performed sound
// ("…and make your [rrrr] sound, five times.") — Travis, 29 Sep 2026: v4 Turbo
// for every word, her recording only for the split second of the sound itself,
// because no TTS model performs every bare sound cleanly.
//   node tools/soundclips.mjs      # public/coach/say-echo/<S>-demo.mp3 → <S>-sound.wav
// The demos hold the sound one to seven times (S: seven takes over 15 s), which
// is right for a demo and wrong mid-sentence. This keeps the FIRST burst: the
// spoken stretch between two ≥200 ms gaps quieter than 30 dB under the clip's
// peak, with 60 ms before it and 100 ms after, 10 ms fades at both ends. Then
// it is levelled exactly as /api/tts levels a line (−20 dBFS RMS over the
// spoken frames, peaks ≤ −3 dBFS, one gain, no compression), so the sound sits
// at the loudness of the words around it. WAV, 24 kHz mono — the format every
// browser and the iOS web view play, and the rate /api/tts speaks at.
// Decoding uses macOS's afconvert: this is a dev tool; the app only loads the files.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DIR = new URL("../public/coach/say-echo/", import.meta.url).pathname;
const SOUNDS = ["P", "B", "M", "N", "T", "D", "K", "G", "F", "V", "S", "Z", "SH", "CH", "J", "L", "R", "TH", "THV"];
const RATE = 24000, FRAME = 480; // 20 ms
const tmp = mkdtempSync(join(tmpdir(), "soundclips-"));

function readPcm(wavPath) {
  const b = readFileSync(wavPath); let off = 12;
  while (off < b.length) {
    const id = b.toString("ascii", off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === "data") return Float64Array.from({ length: size >> 1 }, (_, i) => b.readInt16LE(off + 8 + i * 2) / 32768);
    off += 8 + size;
  }
  throw new Error("no data chunk in " + wavPath);
}
function firstBurst(x) {
  const db = [];
  for (let s = 0; s + FRAME <= x.length; s += FRAME) { let e = 0; for (let i = s; i < s + FRAME; i++) e += x[i] * x[i]; db.push(10 * Math.log10(e / FRAME + 1e-12)); }
  const thr = Math.max(...db) - 30;
  let start = -1, gap = 0;
  for (let i = 0; i < db.length; i++) {
    if (db[i] > thr) { if (start < 0) start = i; gap = 0; }
    else if (start >= 0 && ++gap > 10) return [start, i - gap];
  }
  if (start < 0) throw new Error("no sound found");
  return [start, db.length - 1];
}
// levelPcm from app/api/tts/route.ts, on floats.
const amp = (db) => Math.pow(10, db / 20);
function level(x) {
  const frames = [];
  for (let s = 0; s < x.length; s += FRAME) { const e = Math.min(x.length, s + FRAME); let sum = 0; for (let i = s; i < e; i++) sum += x[i] * x[i]; frames.push({ sum, len: e - s }); }
  const spoken = frames.filter((f) => f.sum / f.len >= amp(-50) ** 2);
  let gain = 1;
  if (spoken.length) {
    const mean = spoken.reduce((t, f) => t + f.sum, 0) / spoken.reduce((t, f) => t + f.len, 0);
    const speech = spoken.filter((f) => f.sum / f.len >= mean * amp(-20) ** 2);
    const rms = Math.sqrt(speech.reduce((t, f) => t + f.sum, 0) / speech.reduce((t, f) => t + f.len, 0));
    if (rms >= amp(-40)) gain = amp(-20) / rms;
  }
  const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  if (peak > 0) gain = Math.min(gain, (Math.floor(amp(-3) * 32768 - 1) / 32768) / peak);
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
  for (const s of SOUNDS) {
    const decoded = join(tmp, s + ".wav");
    execFileSync("afconvert", ["-f", "WAVE", "-d", `LEI16@${RATE}`, "-c", "1", DIR + s + "-demo.mp3", decoded]);
    const x = readPcm(decoded), [a, z] = firstBurst(x);
    const from = Math.max(0, a * FRAME - Math.round(0.06 * RATE)), to = Math.min(x.length, (z + 1) * FRAME + Math.round(0.10 * RATE));
    const out = level(x.slice(from, to));
    writeFileSync(DIR + s + "-sound.wav", wav(out));
    console.log(`${s.padEnd(4)} ${(from / RATE).toFixed(2)}–${(to / RATE).toFixed(2)} s of ${(x.length / RATE).toFixed(2)} s → ${s}-sound.wav (${(out.length / RATE).toFixed(2)} s)`);
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }
