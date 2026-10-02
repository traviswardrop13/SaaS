// Loudness as the ear hears it, for levelling a recorded sound against Echo's
// words (tools/soundclips.mjs) and for pinning that it stays levelled
// (tests/storytest.mjs). A plain RMS match weighs every frequency alike, so a
// hiss (energy high up, where the ear is sensitive) comes out louder than the
// words around it and a hum (energy low down) quieter.
//
// A-weighting (IEC 61672), applied EXACTLY per frequency: each 20 ms frame's
// power spectrum (512-point FFT, Hann window) is weighted by the A curve's
// magnitude at every bin. At /api/tts's 24 kHz a bilinear IIR version is off
// by ~12 dB at 10 kHz — where a hiss lives — because the curve's 12.2 kHz
// poles sit above Nyquist. Only RELATIVE levels are ever compared (a sound
// against a line, through this same measure), so absolute calibration does
// not matter. Frames are chosen as /api/tts chooses them: 20 ms, above
// −50 dBFS, then those within 20 dB of their mean.

const N = 512;
export function fftPower(re) { // 512 samples in, power per bin out
  const im = new Float64Array(N);
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  const p = new Float64Array(N / 2 + 1);
  for (let k = 0; k <= N / 2; k++) p[k] = re[k] * re[k] + im[k] * im[k];
  return p;
}
function aCurve(f) {
  const f2 = f * f;
  const ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return ra * ra; // power weight
}
export function aWeightedLevel(x, fs) {
  const F = Math.round(fs * 0.02), amp = (d) => Math.pow(10, d / 20);
  const W = Array.from({ length: N / 2 + 1 }, (_, k) => aCurve((k * fs) / N));
  const hann = Array.from({ length: F }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (F - 1)));
  const frames = [];
  for (let s = 0; s < x.length; s += F) {
    const e = Math.min(x.length, s + F); let raw = 0;
    const buf = new Float64Array(N);
    for (let i = s; i < e; i++) { raw += x[i] * x[i]; buf[i - s] = x[i] * hann[i - s]; }
    const p = fftPower(buf); let wt = 0;
    for (let k = 1; k <= N / 2; k++) wt += p[k] * W[k];
    frames.push({ raw, wt, len: e - s });
  }
  const spoken = frames.filter((f) => f.raw / f.len >= amp(-50) ** 2);
  if (!spoken.length) return -Infinity;
  const mean = spoken.reduce((t, f) => t + f.raw, 0) / spoken.reduce((t, f) => t + f.len, 0);
  const speech = spoken.filter((f) => f.raw / f.len >= mean * amp(-20) ** 2);
  const ms = speech.reduce((t, f) => t + f.wt, 0) / speech.reduce((t, f) => t + f.len, 0);
  return 10 * Math.log10(ms + 1e-24);
}
