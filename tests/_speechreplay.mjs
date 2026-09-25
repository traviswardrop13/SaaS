// Deterministic replay of charge.html's practice engine, for SPEECHEV1.
// speechEvidence() and EVID are extracted VERBATIM from public/charge.html, so
// the rule under test is the one that ships. The tick loop in run() mirrors
// charge.html's tick() (energy detector + evidence wiring); keep the two in
// step. This replay stops at the requested count; pausetest covers the live
// completion tail and interruptions. The AnalyserNode is emulated (Blackman window, |X|/N, dB, 128-sample
// render quanta; smoothing 0.8 on the 512 analyser, 0 on the evidence one).
// The old engine (every event a try at onset) runs alongside for comparison.
// Same code as ~/Documents/SaaS/output/sona-noise-guard-2026-09-23/emu.mjs,
// where the 878-scenario matrix behind the thresholds lives.
import { readFileSync } from 'node:fs';
import { ROOT } from './_env.mjs';

export function loadEvidence(file = (process.env.SONATEST_PUBLIC_ROOT || ROOT) + '/charge.html') {
  const src = readFileSync(file, 'utf8');
  const a = src.indexOf('var EVID='), b = src.indexOf('// ---- rapid-fire rep engine');
  if (a < 0 || b < 0) throw new Error('evidence block not found in ' + file);
  const out = new Function(src.slice(a, b) + '\nreturn {speechEvidence, EVID};')();
  // The room constants (24 Sep 2026), read from the page so the replay's bar
  // and its voice-not-a-room rule are the ones that ship. An older build
  // (SONATEST_PUBLIC_ROOT) without them replays as it worked: the median, and
  // no ceiling.
  const num = (name, dflt) => { const m = src.match(new RegExp('\\b' + name + '=([0-9.]+)')); return m ? +m[1] : dflt; };
  out.ROOM = { pct: num('ROOM_PCT', 0.5), max: num('ROOM_MAX', Infinity), learn: num('LEARN_FRAMES', 8), min: num('ROOM_MIN', 4), ms: num('ROOM_MS', 300), gap: num('GAP_RUN', 0) };
  // The page's room (24-25 Sep 2026): the one reading taken before Echo
  // speaks and carried into every window (pageRoom below), and what a
  // window's own quieter reading does to it: roomReading and roomLower,
  // extracted verbatim. Older builds replay as they worked: 24 Sep's per-bin
  // minimum of the two backgrounds; #139's build has no page room (null).
  const c = src.indexOf('// ONE READING, WHOLE'), d = src.indexOf('// Evidence reads its own unsmoothed analyser');
  if (c >= 0 && d > c) out.page = new Function('var room=null;\n' + src.slice(c, d) + '\nreturn {reading: roomReading, lower: function (r, level, bg) { room = r; roomLower(level, bg); return room; }};')();
  else if (src.includes('room.bg[k]=Math.min(room.bg[k],bg[k])')) out.page = {
    reading: (level, bg) => ({ rms: level, bg }),
    lower: (r, level, bg) => { r.rms = level; if (bg) for (let k = 0; k < bg.length; k++) r.bg[k] = Math.min(r.bg[k], bg[k]); return r; },
  };
  else if (src.includes('function roomLower')) throw new Error('roomLower is in ' + file + ' but not between its ONE READING, WHOLE markers');
  else out.page = null;
  return out;
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const ur = re[i + k], ui = im[i + k], xr = re[i + k + h], xi = im[i + k + h];
        const vr = xr * cr - xi * ci, vi = xr * ci + xi * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + h] = ur - vr; im[i + k + h] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
const WIN = {};
function blackman(N) { if (!WIN[N]) { const w = new Float64Array(N); for (let i = 0; i < N; i++) w[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / N) + 0.08 * Math.cos(4 * Math.PI * i / N); WIN[N] = w; } return WIN[N]; }

export class Analyser {
  constructor(sig, fftSize, smoothing = 0.8, float = true) {
    this.sig = sig; this.fftSize = fftSize; this.frequencyBinCount = fftSize / 2; this.smoothingTimeConstant = smoothing;
    this.minDecibels = -100; this.maxDecibels = -30; this.pos = 0; this.prev = null; this.lastPos = -1;
    if (!float) { this.getFloatTimeDomainData = undefined; this.getFloatFrequencyData = undefined; }
  }
  sample(k) { return k >= 0 && k < this.sig.length ? this.sig[k] : 0; }
  mags() {
    const N = this.fftSize;
    if (this.prev && this.prev.length !== N / 2) this.prev = null;
    if (this.lastPos === this.pos && this.prev) return this.prev;
    const w = blackman(N), re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = this.sample(this.pos - N + i) * w[i];
    fft(re, im);
    if (!this.prev) this.prev = new Float64Array(N / 2);
    const t = this.smoothingTimeConstant;
    for (let k = 0; k < N / 2; k++) this.prev[k] = t * this.prev[k] + (1 - t) * Math.hypot(re[k], im[k]) / N;
    this.lastPos = this.pos; return this.prev;
  }
  getFloatTimeDomainData(d) { for (let i = 0; i < d.length; i++) d[i] = this.sample(this.pos - this.fftSize + i); }
  getByteTimeDomainData(d) { for (let i = 0; i < d.length; i++) d[i] = Math.max(0, Math.min(255, Math.floor(128 * (1 + this.sample(this.pos - this.fftSize + i))))); }
  getFloatFrequencyData(d) { const m = this.mags(); for (let k = 0; k < d.length; k++) d[k] = 20 * Math.log10(m[k]); }
  getByteFrequencyData(d) { const m = this.mags(); for (let k = 0; k < d.length; k++) d[k] = Math.max(0, Math.min(255, Math.floor(255 / 70 * (20 * Math.log10(m[k]) + 100)))); }
}

// charge.html's roomLevel (the pct-th percentile of the non-zero readings)
// and roomBar (3x the room, 0.035 at least, 3 x ROOM_MAX at most).
const level = (list, pct) => { const v = list.filter(x => x > 0).sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) * pct)] : 0; };
const byteRms = (an, td) => { an.getByteTimeDomainData(td); let sum = 0; for (let i = 0; i < td.length; i++) { const d = (td[i] - 128) / 128; sum += d * d; } return Math.sqrt(sum / td.length); };
const evSize = rate => rate >= 88200 ? 2048 : rate >= 32000 ? 1024 : 512;
// charge.html's starved(): a frame with sound in it and a run of exact zeros
// in the evidence analyser's samples (an analyser only part full, or a
// starved path) is not read as the room. GAP_RUN from the page; an older
// build has no such rule.
const starvedBy = (run) => (ev, level) => {
  if (!run || !(level > 0) || !ev.getFloatTimeDomainData) return false;
  const x = new Float32Array(ev.fftSize); ev.getFloatTimeDomainData(x);
  for (let i = 0, n = 0; i < x.length; i++) { if (x[i] !== 0) n = 0; else if (++n >= run) return true; }
  return false;
};

// charge.html's measureRoom: the page's one reading of the room on a fresh
// mic (`sig` starts as it opens), before Echo speaks. ROOM_MS from the first
// frame that is not digital zeros, its quiet end (ROOM_PCT), and the
// speech-evidence background from its own unsmoothed analyser. null when the
// page would have no room: too few frames, or louder than any room.
export function pageRoom(sig, rate, { fps = 60, evidence = loadEvidence() } = {}) {
  const { speechEvidence, ROOM, page } = evidence; if (!page) return null;
  const an = new Analyser(sig, 512, 0.8), ev = new Analyser(sig, evSize(rate), 0), td = new Uint8Array(512), probe = speechEvidence(); probe.attach(ev, rate);
  const list = [], starved = starvedBy(ROOM.gap); let began = null;
  for (let now = 0; now < 600 + ROOM.ms + 400; now += 1000 / fps) {
    const pos = Math.floor(now / 1000 * rate / 128) * 128; an.pos = pos; ev.pos = pos;
    const r = byteRms(an, td), gap = starved(ev, r);
    if (began === null && r > 0 && !gap) began = now;
    if (began === null) { if (now > 600) return null; continue; }
    if (!gap) { list.push(r); probe.calibrate(now); }
    if (now - began >= ROOM.ms) {
      const low = level(list, ROOM.pct), bg = probe.measured();
      return list.filter(x => x > 0).length >= ROOM.min && bg && low <= ROOM.max ? page.reading(low, bg) : null;
    }
  }
  return null;
}

// Replay one listening segment over `sig` (the whole mic stream, starting at
// the moment the segment opens). Returns tries for the new and old engines.
// `room`: the page's reading (pageRoom), carried in as charge.html does: the
// window listens from its first frame and its own first quarter-second may
// lower it (readRoom). Without one, the window measures itself.
export function run(sig, rate, { fps = 60, jitter = 0, NEED = 100, evidence = loadEvidence(), float = true, seed = 1, room = null } = {}) {
  const { speechEvidence, EVID, ROOM } = evidence;
  const bar = (x) => Math.min(3 * ROOM.max, Math.max(0.035, x * 3.0));
  const an = new Analyser(sig, 512, 0.8), ev = new Analyser(sig, evSize(rate), 0, float);
  const td = new Uint8Array(512);
  const evid = speechEvidence(); evid.attach(ev, rate);
  const starved = starvedBy(ROOM.gap);
  // The page's room is the page's: a copy, since a lowering may change it.
  let page = room && evidence.page ? { ...room, bg: room.bg && Float32Array.from(room.bg) } : null, read = false;
  // lastRep starts far in the past: the engine's clock is performance.now(), never near 0
  let voiced = 0, silent = 0, inBurst = false, thr = 0, lastRep = -1e9, counted = false, burstAt = 0, reps = 0, learn = null, voice = false; const calRms = [];
  let ov = 0, os = 0, oin = false, olast = -1e9, oreps = 0, othr = 0, calSum = 0, calN = 0;
  const at = [], oldAt = [];
  let s = seed >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const endMs = sig.length / rate * 1000, dt = 1000 / fps;
  const countRep = (now, why) => { counted = true; reps++; lastRep = burstAt; at.push({ t: Math.round(now), why }); return reps >= NEED; };
  // charge.html's learnRoom and heardTry: a window whose own quarter-second
  // was a voice learns the room from its first LEARN_FRAMES quiet frames, and
  // meanwhile counts a try only once it ends, and only if voiced or a hiss.
  const learnRoom = (now, rms) => {
    if (starved(ev, rms)) return;
    learn.push(rms); evid.calibrate(now);
    if (learn.length < ROOM.learn) return;
    const low = level(learn, ROOM.pct), bg = evid.measured();
    if (bg) evid.floor(bg);
    thr = bar(low); learn = null;
  };
  const heardTry = () => learn ? /^(voiced|sibilant|energy)$/.test(evid.route()) : evid.brief();
  // With the page's room the window hears from its first frame.
  if (page) { evid.floor(page.bg); thr = bar(page.rms); }
  for (let now = 0; now < endMs; now += dt * (1 + jitter * (rnd() - 0.5))) {
    const pos = Math.floor(now / 1000 * rate / 128) * 128; an.pos = pos; ev.pos = pos;
    const rms = byteRms(an, td), active = now;
    if (active < 250) { calSum += rms; calN++; if (!starved(ev, rms)) { calRms.push(rms); evid.calibrate(now); } if (!thr) continue; }
    else if (!read) {
      read = true; othr = Math.max(0.035, calSum / Math.max(1, calN) * 3.0);
      const low = level(calRms, ROOM.pct);
      if (page) {
        // charge.html's readRoom with the page's room: a real, quieter
        // reading may lower it (roomLower); a voice is never a room.
        const bg = evid.measured();
        if (low <= ROOM.max && calRms.filter(x => x > 0).length >= ROOM.min && bg && low < page.rms) page = evidence.page.lower(page, low, bg);
        evid.floor(page.bg); thr = bar(page.rms);
      } else {
        // No page reading: the window's 20th percentile, as charge.html's
        // readRoom (the median until 24 Sep 2026), never a voice's (ROOM.max).
        voice = low > ROOM.max; thr = bar(low);
        if (voice) { evid.resample(); learn = []; }
      }
    }
    // OLD engine (origin/main): mean threshold, every event is a try at onset
    if (othr) {
      if (rms > othr) { ov++; os = 0; if (!oin && ov >= 4 && now - olast > 350) { oin = true; olast = now; oreps++; oldAt.push(Math.round(now)); } }
      else { os++; ov = 0; if (os >= 8) oin = false; }
    }
    // NEW engine (mirrors charge.html tick())
    if (rms > thr) {
      voiced++; silent = 0;
      if (!inBurst && voiced >= 4 && now - lastRep > 350) { inBurst = true; burstAt = now; }
      if (!counted) { if (evid.frame(now) && inBurst && !learn && countRep(now, 'ev')) break; }
    } else {
      silent++; voiced = 0;
      if (!inBurst) { evid.drop(); if (learn && rms <= ROOM.max) learnRoom(now, rms); }
      if (inBurst && !counted && (silent >= 8 || evid.quietFor(now) >= EVID.quietMs) && heardTry() && countRep(now, 'short')) break;
      if (silent >= 8) { inBurst = false; counted = false; evid.drop(); }
    }
  }
  return { reps, old: oreps, at, oldAt, thr, voice, learned: voice && !learn };
}

// ---- stream builders ----
export function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2147483648 - 1; }; }
export const dbfs = d => Math.pow(10, d / 20);
export function rms(x) { let s = 0; for (const v of x) s += v * v; return Math.sqrt(s / x.length); }
// Steady room noise at an RMS level in dBFS: 'white', 'pink', or 'hum' (room hum: 120Hz + harmonics).
export function room(n, rate, kind, level, seed = 99) {
  const r = rng(seed), x = new Float32Array(n); let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = r();
    if (kind === 'white') x[i] = w;
    else if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913; x[i] = b0 + b1 + b2 + w * 0.1848; }
    else if (kind === 'hum') { const t = i / rate; for (let k = 1; k <= 6; k++) x[i] += Math.sin(2 * Math.PI * 120 * k * t) / k; x[i] += 0.3 * w; }
  }
  const k = dbfs(level) / rms(x); for (let i = 0; i < n; i++) x[i] *= k; return x;
}
// The suite's generator (repguardtest.mjs), plus extras used only here.
export function fixture(kind, rate, o = {}) {
  const duration = o.duration || 1.8, fin = o.fadeIn ?? 0.025, fout = o.fadeOut ?? 0.025;
  const x = new Float32Array(Math.ceil(rate * duration)); let state = o.seed ?? 104729, f1 = 0, f2 = 0, b0 = 0, b1 = 0, b2 = 0; const this_ = {};
  const noise = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2147483648 - 1; };
  for (let i = 0; i < x.length; i++) {
    const t = i / rate, edge = Math.min(1, t / fin, (duration - t) / fout), n = noise(); let v = 0;
    switch (kind) {
      case 'tone': v = .24 * Math.sin(2 * Math.PI * (o.f || 440) * t); break;
      case 'hum': v = .24 * (Math.sin(2 * Math.PI * 110 * t) + .35 * Math.sin(2 * Math.PI * 220 * t) + .12 * Math.sin(2 * Math.PI * 330 * t)); break;
      case 'white noise': v = .28 * n; break;
      case 'breath': f1 = .84 * f1 + .16 * n; v = .55 * f1; break;
      case 'clicks': { const p = t % .45; if (p < .008) v = .65 * n * Math.exp(-p * 650); break; }
      case 'claps': { const p = t % .5; if (p < .07) v = .65 * n * Math.exp(-p * 65); break; }
      case 'harmonics': for (let j = 1; j <= 10; j++) v += .045 / Math.sqrt(j) * Math.sin(2 * Math.PI * 180 * j * t); break;
      case 'hum200': v = .24 * (Math.sin(2 * Math.PI * 200 * t) + .35 * Math.sin(2 * Math.PI * 400 * t) + .12 * Math.sin(2 * Math.PI * 600 * t)); break;
      case 'mains': for (let j = 1; j <= 8; j++) v += .08 / j * Math.sin(2 * Math.PI * 60 * j * t); break;
      case 'buzz120': for (let j = 1; j <= 12; j++) v += .06 / j * Math.sin(2 * Math.PI * 120 * j * t); break; // transformer buzz
      case 'saw': for (let j = 1; j <= 40; j++) v += .12 / j * Math.sin(2 * Math.PI * 150 * j * t); break;
      case 'vibrato': v = .24 * Math.sin(2 * Math.PI * 440 * t + 3 * Math.sin(2 * Math.PI * 5 * t)); break;
      case 'beeps': { const p = t % .6; if (p < .3) v = .3 * Math.sin(2 * Math.PI * 880 * t); break; }
      case 'chime': { const p = t % .9; v = .3 * Math.exp(-p * 4) * (Math.sin(2 * Math.PI * 523 * p) + .6 * Math.sin(2 * Math.PI * 1410 * p) + .4 * Math.sin(2 * Math.PI * 2690 * p)); break; }
      case 'hiss': f1 = .5 * f1 + .5 * n; v = .2 * (n - f1); break;
      case 'fan': f1 = .97 * f1 + .03 * n; f2 = .9 * f2 + .1 * n; v = 1.2 * f1 + .08 * f2 + .02 * Math.sin(2 * Math.PI * 120 * t); break;
      case 'pink': b0 = .99765 * b0 + n * .0990460; b1 = .96300 * b1 + n * .2965164; b2 = .57000 * b2 + n * 1.0526913; v = .12 * (b0 + b1 + b2 + n * .1848); break;
      case 'rumble': f1 = (o.pole || .99) * f1 + (1 - (o.pole || .99)) * n; v = 5 * f1; break;
      case 'knocks': { const p = t % .6; if (p < .05) v = .8 * Math.exp(-p * 90) * Math.sin(2 * Math.PI * 180 * p) + .2 * n * Math.exp(-p * 200); break; }
      case 'swellnoise': v = .28 * n * (.35 + .65 * Math.sin(Math.PI * t / duration)); break;
      case 'drift': v = .28 * n * Math.pow(10, -(o.dbPerS || 5) * t / 20); break; // gain drift
      case 'square': v = .2 * Math.sign(Math.sin(2 * Math.PI * (o.f || 440) * t)); break; // toy/timer beep
      case 'sweep': v = .24 * Math.sin(2 * Math.PI * (300 * t + 200 * t * t)) * Math.min(1, t / .6); break; // swelling narrow tone
      case 'child': { // synthetic child voice: glottal pulses with jitter/shimmer, one resonance, aspiration
        if (i === 0) { this_.ph = 0; this_.y1 = 0; this_.y2 = 0; this_.z1 = 0; this_.z2 = 0; }
        const f0 = (o.f0 || 320) * (1 + 0.02 * Math.sin(2 * Math.PI * 4 * t) + 0.01 * noise());
        this_.ph += f0 / rate; let pulse = 0; if (this_.ph >= 1) { this_.ph -= 1; pulse = 1 + 0.1 * noise(); }
        const F = o.F1 || 300, bw = o.bw || 120, r = Math.exp(-Math.PI * bw / rate), c = 2 * r * Math.cos(2 * Math.PI * F / rate);
        const src = pulse + (o.breath || 0.02) * noise();
        const y = src + c * this_.y1 - r * r * this_.y2; this_.y2 = this_.y1; this_.y1 = y;
        const F2 = o.F2 || 2200, r2 = Math.exp(-Math.PI * 200 / rate), c2 = 2 * r2 * Math.cos(2 * Math.PI * F2 / rate);
        const z = src + c2 * this_.z1 - r2 * r2 * this_.z2; this_.z2 = this_.z1; this_.z1 = z;
        v = 0.02 * y + (o.F2amp ?? 0.004) * z; break;
      }
      default: throw new Error('unknown fixture ' + kind);
    }
    x[i] = v * edge * (o.gain ?? 1);
  }
  return x;
}
// A mic stream: `lead` s of silence (the suite waits 350ms before playing),
// then each [signal, atSeconds] clip, then `tail` s; optional steady room noise.
export function stream(rate, clips, { lead = 0.35, tail = 0.8, roomKind = null, roomDb = -60, seed = 99 } = {}) {
  let end = 0; for (const [x, at] of clips) end = Math.max(end, (at ?? lead) + x.length / rate);
  const n = Math.ceil(rate * (end + tail)), s = new Float32Array(n);
  for (const [x, at] of clips) { const o = Math.round(rate * (at ?? lead)); for (let i = 0; i < x.length && o + i < n; i++) s[o + i] += x[i]; }
  if (roomKind) { const r = room(n, rate, roomKind, roomDb, seed); for (let i = 0; i < n; i++) s[i] += r[i]; }
  return s;
}
export const gain = (x, g) => { const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = x[i] * g; return y; };
export const clip = (x, rate, sec, fadeMs = 0) => { const n = Math.min(x.length, Math.round(rate * sec)), y = x.slice(0, n), f = Math.round(rate * fadeMs / 1000); for (let i = 0; i < f && i < n; i++) y[n - 1 - i] *= i / f; return y; };
