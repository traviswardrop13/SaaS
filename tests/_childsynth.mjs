// Child-voice synthesiser (source-filter: glottal pulses with jitter and shimmer,
// pulsed aspiration, child formants, nasal antiresonance), from the 23 Sep
// review of the speech-evidence rule. Used by speechevidencetest.mjs.
// Child-voice synthesiser for the review (source-filter): glottal pulses with
// jitter/shimmer, open-quotient-controlled tilt, pulsed aspiration noise,
// cascade formants, optional nasal antiresonance, fricative noise.
import { rng, dbfs, rms } from './_speechreplay.mjs';
export const VOWELS = {
  // child (5-8y) formant [F, BW] sets
  a: [[1000, 130], [1650, 160], [3300, 250], [4400, 300]],
  i: [[400, 90], [3100, 200], [3700, 250], [4700, 300]],
  u: [[450, 100], [1250, 150], [3300, 250], [4400, 300]],
  e: [[600, 100], [2600, 180], [3500, 250], [4600, 300]],
  o: [[600, 110], [1100, 140], [3300, 250], [4400, 300]],
  // nasal murmurs: poles + a zero
  m: [[320, 70], [1400, 250], [2600, 300], [3900, 350]],
  n: [[320, 70], [1600, 250], [2800, 300], [4000, 350]],
  // voiced lateral / rhotic approximations
  l: [[420, 90], [1500, 150], [3300, 250], [4400, 300]],
  r: [[480, 100], [1350, 150], [1900, 200], [4000, 300]],
};
export const ZEROS = { m: [1200, 150], n: [2200, 200] };
function resonate(x, rate, F, B) {
  const r = Math.exp(-Math.PI * B / rate), th = 2 * Math.PI * F / rate;
  const a1 = 2 * r * Math.cos(th), a2 = -r * r, g = 1 - a1 - a2;
  const y = new Float64Array(x.length); let y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = g * x[i] + a1 * y1 + a2 * y2; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
function antiresonate(x, rate, F, B) {
  const r = Math.exp(-Math.PI * B / rate), th = 2 * Math.PI * F / rate;
  const b1 = -2 * r * Math.cos(th), b2 = r * r, g = 1 / (1 + b1 + b2);
  const y = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = g * (x[i] + b1 * (x[i - 1] || 0) + b2 * (x[i - 2] || 0));
  return y;
}
// glottal source: returns flow-derivative samples
export function glottal(rate, dur, { f0 = 300, f0end = null, jitter = 0.01, shimmer = 0.06, oq = 0.6, breath = 0.1, seed = 5, vib = 0 } = {}) {
  const n = Math.round(rate * dur), flow = new Float64Array(n), asp = new Float64Array(n), r = rng(seed);
  let t = 0, amp = 1;
  while (t < n) {
    const frac = t / n, F = (f0end == null ? f0 : f0 + (f0end - f0) * frac) * (1 + vib * Math.sin(2 * Math.PI * 5.5 * t / rate));
    const T = rate / F * (1 + jitter * r() * 1.7);
    amp = 1 + shimmer * r();
    const Tp = oq * T * 0.7, Tn = oq * T * 0.3;
    for (let k = 0; k < T && t + k < n; k++) {
      let g = 0;
      if (k < Tp) g = 0.5 * (1 - Math.cos(Math.PI * k / Tp));
      else if (k < Tp + Tn) g = Math.cos(Math.PI / 2 * (k - Tp) / Tn);
      flow[Math.floor(t + k)] = amp * g;
      asp[Math.floor(t + k)] = g; // aspiration pulsed by open glottis
    }
    t += T;
  }
  const H = new Float64Array(n), N = new Float64Array(n); let prev = 0, h = 0;
  for (let i = 0; i < n; i++) {
    const d = flow[i] - prev; prev = flow[i];
    const w = r(); h = w - 0.5 * h; // slightly high-passed noise
    H[i] = d; N[i] = (0.3 + asp[i]) * h;
  }
  return { H, N };
}
function tract(x, rate, vowel, o) {
  if (ZEROS[vowel]) x = antiresonate(x, rate, ...ZEROS[vowel]);
  for (const [F, B] of VOWELS[vowel]) if (F < rate / 2 - 500) x = resonate(x, rate, F, B * (o.bwk || 1));
  if (vowel === 'm' || vowel === 'n') { let y = 0; for (let i = 0; i < x.length; i++) { y = 0.7 * y + 0.3 * x[i]; x[i] = y; } }
  return x;
}
export function envelope(x, rate, attackMs = 40, releaseMs = 60) {
  const a = rate * attackMs / 1000, b = rate * releaseMs / 1000, n = x.length;
  for (let i = 0; i < n; i++) x[i] *= Math.min(1, i / a, (n - 1 - i) / b);
  return x;
}
export function norm(x, levelDb) { const k = dbfs(levelDb) / rms(x); const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = x[i] * k; return y; }
// o.hnr: harmonics-to-noise ratio in dB, measured after the tract filter
export function voice(rate, dur, vowel = 'a', o = {}) {
  const g = glottal(rate, dur, o);
  const H = tract(g.H, rate, vowel, o), N = tract(g.N, rate, vowel, o);
  let eh = 0, en = 0; for (let i = 0; i < H.length; i++) { eh += H[i] * H[i]; en += N[i] * N[i]; }
  const k = Math.sqrt(eh / en) * Math.pow(10, -(o.hnr ?? 20) / 20);
  const x = new Float64Array(H.length); for (let i = 0; i < x.length; i++) x[i] = H[i] + k * N[i];
  envelope(x, rate, o.attack ?? 40, o.release ?? 60);
  return norm(x, o.level ?? -18);
}
// fricative: band-shaped noise
export function fric(rate, dur, kind = 's', o = {}) {
  const r = rng(o.seed || 11), n = Math.round(rate * dur); let x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = r();
  const bands = { s: [[7000, 2500], [8500, 2000]], sh: [[3500, 1200], [5000, 1500]], f: [[3000, 6000], [7000, 6000]], th: [[4000, 6000]] }[kind];
  let y = new Float64Array(n);
  for (const [F, B] of bands) { if (F >= rate / 2 - 300) continue; const z = resonate(x, rate, F, B); for (let i = 0; i < n; i++) y[i] += z[i]; }
  // amplitude wobble (breath) in dB
  const wob = o.wobbleDb || 0, rr = rng(o.seed2 || 3); let ph = rr() * 6;
  for (let i = 0; i < n; i++) { const t = i / rate; y[i] *= Math.pow(10, wob * Math.sin(2 * Math.PI * (o.wobHz || 4) * t + ph) / 20); }
  envelope(y, rate, o.attack ?? 40, o.release ?? 60);
  return norm(y, o.level ?? -20);
}
export function cat(...xs) { let n = 0; for (const x of xs) n += x.length; const y = new Float32Array(n); let o = 0; for (const x of xs) { y.set(x, o); o += x.length; } return y; }
export function silence(rate, sec) { return new Float32Array(Math.round(rate * sec)); }
