// Build the ONE take of each target sound that plays in the letter's place
// inside Echo's words ("…and make your [rrrr] sound, five times."), on every
// round game's say-it card and in every sound power.
//   node tools/soundclips.mjs          # all 19 → public/coach/say-echo/<S>-sound.wav
//   node tools/soundclips.mjs L F      # only those
// Decodes with Chromium (tests/_env.mjs), the decoder the app's pages use, so
// the windows below are read off the very samples a page gets. No API key.
//
// EVERY TAKE IS RACHEL'S OWN VOICE. Travis, 1 Oct 2026, picked her own R by ear
// ("use number 4"); then, of the L on Fruit Slice's practice page: "it said the
// weirdest sound. But it didn't say the actual one ... we need to either insert
// her voice right there or re-record". Until 2 Oct 2026 the voiced takes were
// hers re-voiced into Echo's voice (tools/revoice.mjs) and the voiceless ones
// v4 Turbo's own. Measured then (LPC formant medians, voicing by
// autocorrelation), the voice changer had bent the very cue a child copies:
// - R: third formant 1,430 → 2,900 Hz, toward /w/ (the "wabbit" error);
// - L: second formant 740 → 2,260 Hz: an "ee", not an L (what Travis heard);
// - N and Z: a vowel's first formant (880–920 Hz), and Z lost its hiss
//   (energy above 3 kHz 22 % → 1 %);
// - V, THV, D and J: formants moved 200–600 Hz;
// and v4 Turbo's F came out 44 % voiced with its energy near 780 Hz: a vowel
// where an F is a soft hiss.
//
// WHERE EACH TAKE COMES FROM (TAKES): her short demo of the sound
// (/coach/say/<S>-demo.mp3) where it is clean, else the same sound performed
// inside her whole July line (/coach/say/<S>.mp3, "… — p! p! p!"). The demos
// were turned up after recording and their room noise with them: L's and CH's
// sit 20–30 dB noisier than their lines, and L's demo shows no clear voice at
// all. Every window was read off a spectrogram and a 10 ms burst map: no
// breath, no click, no next word; a stop keeps its burst and its puff, never a
// held "uh" (VOICE_SCRIPT.md: "a held /p/ teaches a schwa").
// CLEAN-UP that leaves the sound alone: a high-pass at 900 Hz on the hisses
// (F S SH TH CH: nothing of theirs lives below it, the room's rumble does) and
// at 80 Hz on the rest, run forward and back so a pop is not smeared. R is
// exactly the take Travis picked. Fades: 10 ms in; out over the take's own
// decay (a pop's puff dies away, it is not cut off).
// LEVEL: as loud as Echo's words to the ear — equal A-weighted loudness with a
// reference v4 Turbo line at /api/tts's level (TARGET_A, measured 29 Sep 2026;
// the set has sat there since) — peaks never over −3 dBFS. A pop's burst or a
// hum's every period can reach that ceiling first: then a look-ahead limiter
// takes the top off those peaks alone, eased over 2 ms, never more than 3 dB.
// WAV, 24 kHz mono 16-bit, the rate Echo's words arrive in (charge.html
// refuses any other). storytest pins the format, the level, the sources and
// that every voiced take is voiced and every hiss is not.
import { readFileSync, writeFileSync } from "node:fs";
import { aWeightedLevel } from "./aweight.mjs";
import { chromium, launchOpts } from "../tests/_env.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = ROOT + "public/coach/say/", DIR = ROOT + "public/coach/say-echo/";
const RATE = 24000, TARGET_A = -3.04;
// sound: [her recording, from s, to s, high-pass Hz, fade-out ms]
export const TAKES = {
  P: ["P.mp3", 7.585, 7.79, 80, 60],          // "… — p! p! p!": the second pop
  B: ["B-demo.mp3", 0.03, 0.45, 80, 30],
  M: ["M-demo.mp3", 0.02, 1.24, 80, 30],      // take 1 of 3
  N: ["N-demo.mp3", 3.28, 4.31, 80, 30],      // take 3: the others end on a click
  T: ["T.mp3", 12.15, 12.355, 80, 40],        // stops before the breath at 12.37 s
  D: ["D-demo.mp3", 0.04, 0.45, 80, 30],
  K: ["K.mp3", 7.655, 7.88, 80, 50],          // the first "k!"
  G: ["G-demo.mp3", 0.04, 0.55, 80, 40],
  F: ["F.mp3", 9.36, 10.28, 900, 30],         // "… blow soft — ffff."
  V: ["V-demo.mp3", 1.84, 3.24, 80, 30],      // take 2: take 1 opens on a breath
  S: ["S.mp3", 9.68, 10.66, 900, 30],         // "… — sss like a snake."
  Z: ["Z-demo.mp3", 1.48, 2.80, 80, 30],      // take 2 of 3
  SH: ["SH-demo.mp3", 0.02, 1.30, 900, 30],   // take 1 of 2
  CH: ["CH.mp3", 13.70, 13.99, 900, 40],      // "… like a little train — ch!"
  J: ["J-demo.mp3", 0.06, 0.62, 80, 40],      // take 1 of 2
  L: ["L.mp3", 9.97, 10.86, 80, 40],          // "… — lll, la la la.": the lll
  R: ["R-demo.mp3", 0.00, 1.24, 0, 10],       // take 1, Travis's pick (1 Oct 2026)
  TH: ["TH.mp3", 11.34, 11.98, 900, 30],      // "… blow soft — th.", after its click
  THV: ["THV-demo.mp3", 3.25, 4.30, 80, 30],  // take 3: 1 and 2 carry clicks
};

// 2nd-order Butterworth high-pass, forward then backward: no phase shift.
function highpass(x, fc) {
  if (!fc) return Float64Array.from(x);
  const w = Math.tan(Math.PI * fc / RATE), q = Math.SQRT1_2, n = 1 / (1 + w / q + w * w);
  const b0 = n, b1 = -2 * n, b2 = n, a1 = 2 * (w * w - 1) * n, a2 = (1 - w / q + w * w) * n;
  const run = (y) => { const o = new Float64Array(y.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < y.length; i++) { const v = b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = y[i]; y2 = y1; y1 = v; o[i] = v; } return o; };
  return run(run(x).reverse()).reverse();
}
// Look-ahead peak limiter: each sample over the ceiling pulls the gain down
// around it, eased in and out over 2 ms, so only the peaks themselves move.
function limit(x, ceil) {
  const H = 48, g = new Float64Array(x.length).fill(1);
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]); if (a <= ceil) continue;
    const need = ceil / a;
    for (let j = Math.max(0, i - H); j <= Math.min(x.length - 1, i + H); j++) { const v = 1 - (1 - need) * (0.5 + 0.5 * Math.cos(Math.PI * (j - i) / (H + 1))); if (v < g[j]) g[j] = v; }
  }
  return x.map((v, i) => v * g[i]);
}
const amp = (db) => Math.pow(10, db / 20), peakOf = (y) => y.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
function finish(take, fadeOutMs) {
  // Fades first, so the level is measured on exactly what will play.
  const fin = 240, fout = Math.round(fadeOutMs * RATE / 1000);
  const x = take.map((v, i) => v * Math.min(1, i / fin, (take.length - 1 - i) / fout));
  const ceil = Math.floor(amp(-3) * 32768 - 1) / 32768;
  let gain = 1, y = x;
  for (let k = 0; k < 10; k++) {
    const lin = x.map((v) => v * gain), pk = peakOf(lin);
    y = pk > ceil ? limit(lin, Math.max(ceil, pk / amp(3))) : lin;
    const step = amp(TARGET_A - aWeightedLevel(y, RATE)); gain *= step;
    if (Math.abs(20 * Math.log10(step)) < 0.01) break;
  }
  const pk = peakOf(y);
  return pk > ceil ? y.map((v) => v * ceil / pk) : y;
}
function wav(x) {
  const n = x.length * 2, h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + n, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(n, 40);
  const d = Buffer.alloc(n); x.forEach((v, i) => d.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32768))), i * 2));
  return Buffer.concat([h, d]);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const only = process.argv.slice(2), sounds = only.length ? only : Object.keys(TAKES);
  const bad = sounds.filter((s) => !TAKES[s]);
  if (bad.length) { console.error("soundclips: no take for " + bad.join(", ")); process.exit(1); }
  const browser = await chromium.launch(launchOpts());
  try {
    const page = await browser.newPage();
    for (const s of sounds) {
      const [file, from, to, hp, fadeOut] = TAKES[s];
      // Decode and resample to 24 kHz mono exactly as a page would.
      const b64 = await page.evaluate(async (src) => {
        const bin = Uint8Array.from(atob(src), (c) => c.charCodeAt(0));
        const buf = await new OfflineAudioContext(1, 1, 24000).decodeAudioData(bin.buffer);
        const oc = new OfflineAudioContext(1, Math.ceil(buf.duration * 24000), 24000), node = oc.createBufferSource();
        node.buffer = buf; node.connect(oc.destination); node.start();
        const u8 = new Uint8Array((await oc.startRendering()).getChannelData(0).buffer.slice(0));
        let out = ""; for (let i = 0; i < u8.length; i += 0x8000) out += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return btoa(out);
      }, readFileSync(SRC + file).toString("base64"));
      const raw = Buffer.from(b64, "base64"), x = new Float32Array(raw.buffer, raw.byteOffset, raw.length >> 2);
      // Filter with 0.2 s of context either side, so the filter has settled at the cut.
      const a = Math.round(from * RATE), z = Math.round(to * RATE), lo = Math.max(0, a - 4800);
      const y = highpass(x.slice(lo, Math.min(x.length, z + 4800)), hp), out = finish(y.slice(a - lo, z - lo), fadeOut);
      writeFileSync(DIR + s + "-sound.wav", wav(out));
      console.log(`${s.padEnd(4)}${(out.length / RATE).toFixed(2)} s  ← ${file} ${from.toFixed(3)}–${to.toFixed(3)} s, high-pass ${hp || "none"}  A ${aWeightedLevel(out, RATE).toFixed(2)}  peak ${(20 * Math.log10(peakOf(out))).toFixed(1)} dBFS`);
    }
  } finally { await browser.close(); }
}
