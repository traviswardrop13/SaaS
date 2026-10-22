// THE FAKE IPHONE MICROPHONE (12 Oct 2026). Not a suite: the stand-in for
// SonaSpeechPlugin.swift's own microphone (micPermission, micOpen, micClose
// and the micpcm / micend / microute / micready events), for the suites that
// check Sona's own mic in the iPhone app (nativemictest first).
//
// Why a shared fake: in the app the page no longer captures with
// getUserMedia (that is what put the phone into phone-call audio). The
// phone's own code opens the mic and hands the page its samples as events,
// and sona.js turns them back into a stream, an AudioNode and a recorder.
// Every listening page then hears the child through that seam. A suite that
// wants to know a page still hears the child, still never plays into a live
// mic and still closes it on every exit, needs a phone that behaves the way
// the Swift does: answers over a bridge hop, chunks of mono Float32 as base64,
// each event its own task, a close that lands a moment after it is asked for.
//
//   import { nativeMic } from "./_nativemic.mjs";
//   await context.addInitScript(mySuitesOwnFakes, cfg);   // FIRST: its getUserMedia, its log
//   await context.addInitScript(nativeMic, { mode: "new", micLog: "__quiet" });
//
// SELF-CONTAINED ON PURPOSE: addInitScript ships only the function's own text
// (see _phone.mjs), so nativeMic() names nothing outside its own body.
//
// ── cfg (everything optional) ─────────────────────────────────────────────
//   mode       "new" (the build with Sona's own mic: the default) · "old"
//              (available, requestPermission, start, stop and the listener
//              calls only: every App Store build before it) · "proxy" (an
//              old build behind a bridge that answers every unknown method
//              with a function that rejects "not implemented on ios") ·
//              "none" (the app, with no SonaSpeech at all: Plugins {}) ·
//              "browser" (no Capacitor at all, unless `capacitor` names one)
//   capacitor  a shape of window.Capacitor to start from: "empty" ({}),
//              "noPlugins" (isNativePlatform() true, no Plugins), "webBridge"
//              (isNativePlatform() false: Capacitor's web build)
//   perm       "granted" (default) | "denied" | "prompt"; onAsk: what iOS's
//              own dialog answers when asked: "grant" | "deny" | "hang"
//   openDelay  ms the phone takes to answer micOpen
//   openFail   null | "busy" | "nomic" | "engine" | "nolistener", or a list
//              (one per open, in order; null in it = that open succeeds).
//              A string fails the FIRST open only.
//   answerFirst  true (default): micOpen resolves before the first chunk;
//              false: the first chunk is delivered before the answer
//   firstDelay ms of nothing at all before the first chunk is due
//   warmZeros  ms of exact zeros at the start of every stream (a mic warming up)
//   frames     1024 (default) | 4800 … samples a chunk; rate 48000 | 44100 …
//   jitter     ms: each chunk is delivered up to this much late (in order),
//              and at least jitterMin late
//   source     what the mic hears with nobody speaking: "hiss" (the default:
//              a real mic's own faint white hiss, hissDb, -60 dBFS) ·
//              "silence" (exact zeros) · "tone" (toneHz 300, toneAmp 0.2) ·
//              "fan" (pink noise at fanDb, -35 dBFS) · "voice" (hiss, plus a
//              loud voiced 187.5 Hz sound while the suite's own voice flag,
//              window[micLog].voice, or __nm.world.voice is on)
//   closeDelay ms between micClose being asked and its answer (default 20).
//              The phone's own state changes at once (the bridge message is
//              posted as the call is made); only the page's answer waits.
//   micLog     the global of the suite's own mic log ("__quiet"): each native
//              open, and each getUserMedia this fake answers, is pushed there
//              as { asked, start, end } on that log's now() clock, end
//              stamped when micClose RESOLVES (or the phone ended the stream)
//   world      true (default): getUserMedia answers a real MediaStream of the
//              SAME room and the same child (a MediaStreamDestination), so a
//              page on the web mic and a page on Sona's own mic hear one
//              world. false: the suite's own getUserMedia answers (counted).
//   gum        "deny": getUserMedia refuses (NotAllowedError)
//   ctxRate    every AudioContext a page makes runs at this rate
//   audit      true (default): every sound a page starts (Web Audio sources,
//              media elements, the browser's voice) is logged in __nm.sounds
//              with the time it started and ended, against __nm.mics
//   speechMs   how long the browser's voice "speaks" a line (default 300)
//   text       what Apple's check hears (stop()'s text); speech: false makes
//              it unavailable
//   capLogging Capacitor.isLoggingEnabled to start with (default true, as a
//              Debug build)
//   audioSession  true: navigator.audioSession as WebKit has it from iOS 16.4
//              (default false: no such thing, as Chromium). A page's own
//              getter starts at "auto" on every load, but the override a write
//              sets is the web process's, held across page loads (kept in
//              sessionStorage here, as the phone's state is), and while that
//              held override is anything but "auto" or "play-and-record" every
//              getUserMedia is refused with InvalidStateError (WebKit's
//              MediaDevices::getUserMedia reads the override, not the getter).
//              __nm.as: sets[] (this page's writes: { v, at, gum }), log()
//              (every write in the tab, { v, page }), gum[] (the held type at
//              each getUserMedia), refused, heldAtLoad, held(), hold(v)
//   sound      whose demo say() plays by default (R) · worldRate: the web
//              mic's world, 48000 · staleChunkMs: how long a stream left
//              open by the last page waits for its next chunk (100)
//   A native open also adds one to the suite's own log's `requests`, when it
//   keeps one: to a suite counting "the mic was asked for", it was.
//
// ── window.__nm, in the page ──────────────────────────────────────────────
//   opens      micOpen calls (each { at, args, g, failed }) · opened, closed
//              (streams that went live / ended) · closeCalls[] (micClose's
//              arguments) · gum (getUserMedia calls) · perms[] (micPermission's
//              arguments) · starts[] (start()'s options) · chunks (delivered)
//              · events[] (micend/microute/micready) · listeners (names)
//              · mics[] { kind: "native"|"web", asked, start, end, g }
//              · sounds[] { kind, start, end, live, len, src, text }
//              · kept: the same counts from the pages before this one in the
//              tab (the phone outlives a page), and live(): the phone's open
//              stream, if any
//   ctl        interrupt() · interruptEnd() (micready) · route(rate, gapMs) ·
//              timeout() · reset() · background() · stalled() · end(reason)
//              (the phone ends the stream, with that reason) · stall(ms)
//              (no chunks for ms, the samples lost) · room(f32, rate) (a
//              steady room, looped, into both mics) · dropListeners()
//              (Capacitor's reset: the next chunk closes the mic,
//              "nolistener") · blockMain(ms) · feed(f32, rate) · say(db, ms,
//              sound, from) (Rachel's demo of the sound, into both mics) ·
//              voice(on) · staleChunk(g) · crash() (the page dies: what it
//              asks never reaches the phone, which keeps its stream for the
//              next page) · set(patch) (the live config)
// Counts persist in sessionStorage on every change, so they add up across a
// tab's page loads, as the phone's own state does.
export function nativeMic(cfg) {
  cfg = Object.assign({ mode: "new", perm: "granted", onAsk: "grant", openDelay: 0, openFail: null, answerFirst: true,
    firstDelay: 0, warmZeros: 0, frames: 1024, rate: 48000, jitter: 0, source: "hiss", hissDb: -60, fanDb: -35,
    toneHz: 300, toneAmp: 0.2, closeDelay: 20, jitterMin: 0, micLog: null, world: true, audit: true, speechMs: 300, text: "",
    speech: true, capLogging: true }, cfg || {});
  // the blank first document has no storage, and nothing to fake
  try { sessionStorage.getItem("__nm"); } catch (e) { return; }
  const now = () => performance.now();
  const later = (fn, ms) => setTimeout(fn, ms || 0);
  const RealAC = window.AudioContext || window.webkitAudioContext;
  const KEY = "__nmPhone";
  let kept = {}; try { kept = JSON.parse(sessionStorage.getItem(KEY) || "{}") || {}; } catch (e) { kept = {}; }
  const N = window.__nm = { cfg, opens: [], opened: 0, closed: 0, closeCalls: [], gum: 0, perms: [], starts: [], chunks: 0,
    events: [], listeners: [], mics: [], sounds: [], kept: kept, g: kept.g || 0, ctl: {}, ends: [], stale: [], blocked: [] };
  const persist = () => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ g: N.g, live: N.liveNow ? { g: N.liveNow.g, rate: N.liveNow.rate, frames: N.liveNow.frames } : null,
        opens: (kept.opens || 0) + N.opens.length, opened: (kept.opened || 0) + N.opened, closed: (kept.closed || 0) + N.closed,
        closeCalls: (kept.closeCalls || 0) + N.closeCalls.length, gum: (kept.gum || 0) + N.gum, perms: (kept.perms || 0) + N.perms.length,
        pagehideCloses: (kept.pagehideCloses || 0) + (N.pagehideCloses || 0) }));
    } catch (e) {}
  };
  // the suite's own mic log, on its own clock
  const LOG = () => (cfg.micLog && window[cfg.micLog]) || null;
  const stamp = () => { const l = LOG(); return l && typeof l.now === "function" ? l.now() : now(); };
  // (unlogged: a getUserMedia the suite's own fake answers, and logs itself)
  const micRec = (kind, unlogged) => {
    const r = { kind, asked: stamp(), start: null, end: null, g: null, at: now() };
    N.mics.push(r);
    const l = LOG(); if (!unlogged && l && Array.isArray(l.mics)) l.mics.push(r);
    return r;
  };
  N.micOn = () => N.mics.some((m) => m.end == null);
  // a deterministic generator, so a run is the same run every time
  let seed = 12345;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

  // ── the world: the room and the child, heard by whichever mic is open ──
  const W = N.world = { sounds: [], voice: false, clips: {}, ctx: null, bus: null, voiceGain: null };
  const voiceOn = () => { const l = LOG(); return !!(W.voice || (l && l.voice) || (l && l.talking > 0)); };
  // the floor, sample by sample, with its own state per stream
  function floorGen(rate) {
    const src = cfg.source, hiss = Math.pow(10, cfg.hissDb / 20) * Math.sqrt(3), fan = Math.pow(10, cfg.fanDb / 20) * 5;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, ph = 0, vp = 0, st = 777;
    const r = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 2147483648 - 1; };
    return function () {
      if (src === "silence") return 0;
      if (src === "tone") { ph += 2 * Math.PI * cfg.toneHz / rate; return cfg.toneAmp * Math.sin(ph); }
      if (src === "fan") {   // Paul Kellet's pink filter
        const w = r();
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        const p = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
        return fan * p * 0.11;
      }
      let x = hiss * r();
      if (src === "voice" && voiceOn()) {
        vp += 2 * Math.PI * 187.5 / rate;
        for (let k = 1; k <= 12; k++) x += 0.24 / k * Math.sin(k * vp);
      }
      return x;
    };
  }
  // A sound held at the stream's own rate is read sample for sample, from
  // the sample the stream was at when it began; any other is read by time.
  function soundsAt(t, l, j) {
    let x = 0;
    for (let k = 0; k < W.sounds.length; k++) {
      const s = W.sounds[k], same = s.alt[l.rate];
      if (same) {
        const key = l.g + ":" + l.rate + ":" + l.openAt;
        if (s.i0[key] == null) s.i0[key] = Math.round((s.at - l.openAt - cfg.firstDelay) * l.rate / 1000);
        const i = j - s.i0[key];
        if (i >= 0 && i < same.length) x += s.gain * same[i];
        continue;
      }
      const idx = (t - s.at) * s.rate / 1000;
      if (idx < 0 || idx >= s.pcm.length - 1) continue;
      const i = Math.floor(idx), f = idx - i;
      x += s.gain * (s.pcm[i] * (1 - f) + s.pcm[i + 1] * f);
    }
    return x;
  }
  // A steady room a suite supplies (ctl.room): looped, heard by every mic
  // from the moment it opens. At the stream's own rate it is read sample for
  // sample from the stream's first sample; at any other, by time.
  function roomAt(t, l, j) {
    const R = W.room; if (!R) return 0;
    if (R.rate === l.rate) return R.pcm[j % R.pcm.length];
    const idx = (((t - R.at) * R.rate / 1000) % R.pcm.length + R.pcm.length) % R.pcm.length, i = Math.floor(idx), f = idx - i;
    return R.pcm[i] * (1 - f) + R.pcm[(i + 1) % R.pcm.length] * f;
  }
  function roomToWorld() {
    const R = W.room, ctx = W.ctx; if (!R || !ctx || R.node) return;
    try {
      const b = ctx.createBuffer(1, R.pcm.length, R.rate); b.getChannelData(0).set(R.pcm);
      const s = ctx.createBufferSource(); s.__nmWorld = true; s.buffer = b; s.loop = true; s.connect(W.bus); s.start(); R.node = s;
    } catch (e) {}
  }
  N.ctl.room = (f32, rate) => { W.room = { pcm: f32, rate: rate || 48000, at: now(), node: null }; roomToWorld(); };
  // the web mic's half of the world: a real stream of the same room
  function worldCtx() {
    if (W.ctx) return W.ctx;
    const ctx = W.ctx = new RealAC({ sampleRate: cfg.worldRate || 48000 });
    W.bus = ctx.createGain(); W.bus.__nmWorld = true;
    const floorLen = ctx.sampleRate * 8, gen = floorGen(ctx.sampleRate);
    if (cfg.source !== "silence") {
      const b = ctx.createBuffer(1, floorLen, ctx.sampleRate), d = b.getChannelData(0);
      const keepVoice = cfg.source === "voice";
      const saved = W.voice; W.voice = false;
      for (let i = 0; i < floorLen; i++) d[i] = gen();
      W.voice = saved;
      const s = ctx.createBufferSource(); s.__nmWorld = true; s.buffer = b; s.loop = true; s.connect(W.bus); s.start();
      if (keepVoice) {
        const vb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), vd = vb.getChannelData(0);
        for (let i = 0; i < vd.length; i++) { const p = 2 * Math.PI * 187.5 * i / ctx.sampleRate; let x = 0; for (let k = 1; k <= 12; k++) x += 0.24 / k * Math.sin(k * p); vd[i] = x; }
        const vs = ctx.createBufferSource(); vs.__nmWorld = true; vs.buffer = vb; vs.loop = true;
        W.voiceGain = ctx.createGain(); W.voiceGain.gain.value = 0; vs.connect(W.voiceGain); W.voiceGain.connect(W.bus); vs.start();
        setInterval(() => { try { W.voiceGain.gain.value = voiceOn() ? 1 : 0; } catch (e) {} }, 10);
      }
    }
    roomToWorld();
    return ctx;
  }
  // Rachel's demo, decoded at a rate (Chromium's own resampler does the rest)
  async function clip(name, rate) {
    const key = name + "@" + rate;
    if (W.clips[key]) return W.clips[key];
    if (!W.bytes) W.bytes = {};
    if (!W.bytes[name]) W.bytes[name] = await (await fetch("/coach/say/" + name + "-demo.mp3")).arrayBuffer();
    const off = new OfflineAudioContext(1, 1, rate);
    const buf = await off.decodeAudioData(W.bytes[name].slice(0));
    return (W.clips[key] = buf.getChannelData(0).slice());
  }
  // a sound into the world now: both mics hear it from this moment
  function schedule(pcm, rate, gain, alt) {
    const at = now(), a = Object.assign({}, alt || {}); a[rate] = pcm;
    W.sounds.push({ at, pcm, rate, gain, alt: a, i0: {} });
    W.sounds = W.sounds.filter((s) => now() - s.at < s.pcm.length * 1000 / s.rate + 2000);
    if (cfg.world !== false && W.ctx) {
      try {
        const ctx = W.ctx, b = ctx.createBuffer(1, pcm.length, rate); b.getChannelData(0).set(pcm);
        const s = ctx.createBufferSource(), g = ctx.createGain(); s.__nmWorld = true; s.buffer = b; g.gain.value = gain;
        s.connect(g); g.connect(W.bus); s.start();
      } catch (e) {}
    }
  }
  N.ctl.feed = (f32, rate) => schedule(f32, rate || 48000, 1);
  // the child: Rachel's recorded demo of a sound (cfg.sound unless named),
  // db from its own level, for ms, from `from` seconds into it
  N.ctl.say = async (db, ms, sound, from) => {
    const name = sound || cfg.sound || "R", rates = [48000];
    if (cfg.rate !== 48000) rates.push(cfg.rate);
    const pcms = await Promise.all(rates.map((r) => clip(name, r)));
    const cut = (pcm, r) => { const a = Math.round((from || 0) * r); return pcm.subarray(a, Math.min(pcm.length, a + Math.round(ms * r / 1000))); };
    const alt = {}; rates.forEach((r, i) => { alt[r] = cut(pcms[i], r); });
    schedule(alt[48000], 48000, Math.pow(10, (db || 0) / 20), alt);
  };
  N.ctl.voice = (on) => { W.voice = !!on; };

  // ── the plugin ──
  const L = {};
  const has = (name) => !!(L[name] && L[name].length);
  // every event its own task, as evaluateJavaScript delivers it
  function notify(name, data) {
    if (name !== "micpcm") N.events.push({ name, g: data.g, reason: data.reason, rate: data.sampleRate, at: now() });
    (L[name] || []).slice().forEach((fn) => later(() => { try { fn(JSON.parse(JSON.stringify(data))); } catch (e) {} }));
  }
  const fail = (code, message) => Object.assign(new Error(message || code), { code, message: message || code });
  const failPlan = Array.isArray(cfg.openFail) ? cfg.openFail.slice() : cfg.openFail ? [cfg.openFail] : [];
  let live = null;
  Object.defineProperty(N, "liveNow", { get: () => live });
  N.live = () => (live ? { g: live.g, rate: live.rate, frames: live.frames, seq: live.seq } : null);
  function b64(f32) {
    const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
    let s = "";
    for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return btoa(s);
  }
  function render(l, startMs, n) {
    const out = new Float32Array(n), dt = 1000 / l.rate;
    for (let i = 0; i < n; i++) {
      const t = startMs + i * dt, x = l.floor() + soundsAt(t, l, l.emitted + i) + roomAt(t, l, l.emitted + i);
      out[i] = (t - l.openAt < cfg.warmZeros) ? 0 : x;
    }
    return out;
  }
  function chunk(l) {
    const n = l.frames, startMs = l.openAt + cfg.firstDelay + l.emitted * 1000 / l.rate;
    const pcm = render(l, startMs, n);
    l.emitted += n; l.seq++;
    const data = { g: l.g, q: l.seq, r: l.rate, n, d: b64(pcm) };
    const late = cfg.jitter ? cfg.jitterMin + rnd() * Math.max(0, cfg.jitter - cfg.jitterMin) : 0;
    const at = Math.max(l.lastDeliver, now() + late);
    l.lastDeliver = at;
    later(() => {
      if (live !== l) return;                              // a chunk from an open already closed
      if (!has("micpcm")) { closeLive("nolistener"); return; }
      N.chunks++; l.delivered++;
      notify("micpcm", data);
    }, at - now());
  }
  function emitter(l) {
    const period = l.frames * 1000 / l.rate;
    const tick = () => {
      if (live !== l) return;
      const t = now();
      const due = Math.floor((t - l.openAt - cfg.firstDelay) * l.rate / 1000);
      if (l.stallUntil && t < l.stallUntil) { l.emitted = Math.max(l.emitted, due - (due % l.frames)); l.timer = later(tick, period / 2); return; }
      while (l.emitted + l.frames <= due) chunk(l);
      l.timer = later(tick, Math.max(2, period / 4));
    };
    tick();
  }
  function closeLive(reason) {
    const l = live; if (!l) return null;
    live = null; N.g += 1; clearTimeout(l.timer);
    N.closed++; N.ends.push({ g: l.g, reason, at: now() });
    if (reason !== "closed") l.rec.end = stamp();          // the phone ended it: the page hears at once
    notify("micend", { g: l.g, reason, v: 1 });
    persist();
    return l;
  }
  function openLive(args, rec, resolve) {
    if (live) closeLive("replaced");
    N.g += 1;
    const rate = cfg.rate, frames = Math.min(8192, Math.max(256, cfg.frames || (args && args.frames) || 1024));
    const l = live = { g: N.g, rate, frames, openAt: now(), emitted: 0, seq: 0, lastDeliver: 0, delivered: 0, rec, floor: floorGen(rate), timer: 0 };
    rec.g = l.g; N.opened++;
    persist();
    const ans = { g: l.g, sampleRate: rate, channels: 1, mode: "default", route: { input: "iPhone Microphone", inputType: "MicrophoneBuiltIn", output: "Speaker", outputType: "Speaker" }, v: 1 };
    if (cfg.answerFirst !== false) { rec.start = stamp(); resolve(ans); emitter(l); return; }
    // the first chunk beats the answer here
    l.openAt = now() - cfg.firstDelay - frames * 1000 / rate;
    chunk(l);
    later(() => later(() => { rec.start = stamp(); resolve(ans); emitter(l); }, 2));
  }
  function ask(done) {
    const a = cfg.onAsk;
    if (a === "hang") return;
    later(() => { cfg.perm = a === "deny" ? "denied" : "granted"; done(cfg.perm === "granted"); }, 30);
  }
  const P = {
    available: () => new Promise((r) => later(() => r({ available: !!cfg.speech, onDevice: true, authorized: !!cfg.speech, denied: false }))),
    requestPermission: () => new Promise((r) => later(() => r({ granted: true }))),
    start: (o) => new Promise((resolve, reject) => {
      const opts = o ? JSON.parse(JSON.stringify(o)) : {};
      N.starts.push(opts);
      later(() => {
        if (opts.g != null && !(live && live.g === opts.g)) { reject(fail("nostream", "that microphone has closed")); return; }
        N.recognizing = true; resolve({ started: true });
      });
    }),
    stop: () => new Promise((r) => later(() => { N.recognizing = false; r({ text: cfg.text || "", onDevice: true }); })),
    addListener: (name, fn) => {
      (L[name] = L[name] || []).push(fn); N.listeners.push(name);
      const handle = { remove: () => { const a = L[name] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); return Promise.resolve(); } };
      return Object.assign(Promise.resolve(handle), handle);
    },
    removeAllListeners: () => { for (const k in L) L[k] = []; return Promise.resolve(); },
  };
  const NEW = {
    micPermission: (o) => new Promise((resolve) => {
      const opts = o ? JSON.parse(JSON.stringify(o)) : {};
      N.perms.push(opts); persist();
      later(() => {
        if (cfg.perm === "prompt" && opts.request) { ask((yes) => resolve({ state: yes ? "granted" : "denied", v: 1 })); return; }
        resolve({ state: cfg.perm, v: 1 });
      });
    }),
    micOpen: (o) => new Promise((resolve, reject) => {
      const args = o ? JSON.parse(JSON.stringify(o)) : {};
      const call = { at: now(), args, g: null, failed: null };
      N.opens.push(call); persist();
      // the suite's own count of mic requests counts this one too
      const lg = LOG(); if (lg && typeof lg.requests === "number") lg.requests++;
      const rec = micRec("native");
      const no = (code) => { call.failed = code; rec.end = stamp(); persist(); reject(fail(code)); };
      const go = () => {
        if (!has("micpcm")) { no("nolistener"); return; }   // the dialog can be answered after the page has gone
        const code = failPlan.length ? failPlan.shift() : null;
        if (code) { later(() => no(code), cfg.openDelay); return; }
        later(() => {
          if (!has("micpcm")) { no("nolistener"); return; }
          openLive(args, rec, (ans) => { call.g = ans.g; resolve(ans); });
        }, cfg.openDelay);
      };
      later(() => {
        if (!has("micpcm")) { no("nolistener"); return; }
        if (cfg.perm === "denied") { no("denied"); return; }
        if (cfg.perm === "prompt") { ask((yes) => { if (yes) go(); else no("denied"); }); return; }
        go();
      });
    }),
    micClose: (o) => {
      const args = o ? JSON.parse(JSON.stringify(o)) : {};
      N.closeCalls.push(Object.assign({ at: now() }, args));
      // the phone acts on the call at once; the page hears back a moment later
      let closedRec = null;
      if (N.crashed) return new Promise(() => {});           // the page died: the message never reached the phone
      if (live && (args.g == null || args.g === live.g)) { const l = closeLive("closed"); closedRec = l && l.rec; }
      if (N.unloading) N.pagehideCloses = (N.pagehideCloses || 0) + 1;
      persist();
      return new Promise((resolve) => later(() => { if (closedRec && closedRec.end == null) closedRec.end = stamp(); resolve({ closed: true, ms: cfg.closeDelay, v: 1 }); }, cfg.closeDelay));
    },
  };
  let plugin;
  if (cfg.mode === "new") plugin = Object.assign({}, P, NEW);
  else if (cfg.mode === "old") plugin = Object.assign({}, P);
  else if (cfg.mode === "proxy") {
    N.unknown = [];
    // "then" and "toJSON" stay undefined: a plugin object that answered them
    // would be swallowed by the first promise it was returned through
    plugin = new Proxy(Object.assign({}, P), { get(t, k) {
      const v = t[k];
      if (v !== undefined || typeof k !== "string" || k === "then" || k === "toJSON" || k === "$$typeof") return v;
      return function () { N.unknown.push(k); return Promise.reject(Object.assign(new Error('"SonaSpeech.' + k + '()" is not implemented on ios'), { code: "UNIMPLEMENTED" })); };
    } });
  }
  N.plugin = plugin;
  // merged into whatever Capacitor the page has, now or later (a suite or
  // another fake may assign window.Capacitor wholesale after this runs)
  function install(C) {
    if (!C || typeof C !== "object") return C;
    if (!C.Plugins || typeof C.Plugins !== "object") C.Plugins = {};
    if (plugin) C.Plugins.SonaSpeech = plugin;
    if (!("isLoggingEnabled" in C)) C.isLoggingEnabled = !!cfg.capLogging;
    return C;
  }
  const SHAPES = { empty: () => ({}), noPlugins: () => ({ isNativePlatform: () => true, getPlatform: () => "ios" }),
    webBridge: () => ({ isNativePlatform: () => false, getPlatform: () => "web", Plugins: {} }) };
  const shaped = cfg.capacitor && SHAPES[cfg.capacitor] ? SHAPES[cfg.capacitor]() : null;
  if (cfg.mode === "browser") { if (shaped) window.Capacitor = shaped; }
  else {
    let cap = install(shaped || window.Capacitor || { isNativePlatform: () => true, getPlatform: () => "ios", Plugins: {} });
    Object.defineProperty(window, "Capacitor", { configurable: true, get: () => cap, set: (v) => { cap = install(v); } });
  }

  // ── the phone's controls ──
  N.ctl.set = (patch) => { Object.assign(cfg, patch || {}); if (patch && "openFail" in patch) { failPlan.length = 0; const f = patch.openFail; (Array.isArray(f) ? f : f ? [f] : []).forEach((x) => failPlan.push(x)); } return true; };
  N.ctl.interrupt = () => { closeLive("interrupted"); };
  N.ctl.interruptEnd = () => { if (has("micready")) notify("micready", { reason: "interruption", v: 1 }); };
  N.ctl.timeout = () => { closeLive("timeout"); };
  N.ctl.reset = () => { closeLive("reset"); };
  N.ctl.background = () => { closeLive("background"); };
  N.ctl.stalled = () => { closeLive("stalled"); };
  N.ctl.end = (reason) => { closeLive(reason || "closed"); };   // any other reason the phone gives
  N.ctl.routeClose = () => { closeLive("route"); };
  N.ctl.stall = (ms) => { if (live) live.stallUntil = now() + ms; };
  // the hardware changed under the stream: the same open carries on at a new
  // rate, after gapMs with no samples (a real engine restart has one)
  N.ctl.route = (rate, gapMs) => {
    const l = live; if (!l) return;
    l.rate = rate || l.rate; l.openAt = now(); l.emitted = 0; l.floor = floorGen(l.rate); l.restarts = (l.restarts || 0) + 1;
    if (gapMs > 0) l.stallUntil = now() + gapMs;
    notify("microute", { g: l.g, sampleRate: l.rate, restarts: l.restarts, route: { input: "iPhone Microphone", output: "Speaker" }, v: 1 });
  };
  // Capacitor drops every listener when the page navigates or reloads
  N.ctl.dropListeners = () => { for (const k in L) L[k] = []; };
  N.ctl.blockMain = (ms) => { const end = now() + ms; N.blocked.push({ at: now(), ms }); while (now() < end) { /* the main thread is busy */ } };
  // a chunk for an open the page no longer holds (or never did)
  // the page dies (a crash, a killed web process): nothing it says reaches
  // the phone any more, so the stream it held stays open for the next page
  N.ctl.crash = () => { N.crashed = true; persist(); };
  N.ctl.staleChunk = (g) => { const pcm = new Float32Array(1024).fill(0.01); N.stale.push(g); notify("micpcm", { g, q: 1, r: 48000, n: 1024, d: b64(pcm) }); };

  // ── what was live when the last page left: the phone still holds it ──
  // (its next chunk finds no listener and closes it, unless the new page's
  // own micClose({ all: true }) gets there first)
  if (kept.live && plugin && cfg.mode === "new") {
    const rec = micRec("native"); rec.start = rec.asked; rec.g = kept.live.g; rec.stale = true;
    const l = live = { g: kept.live.g, rate: kept.live.rate, frames: kept.live.frames, openAt: now(), emitted: 0, seq: 0, lastDeliver: 0, delivered: 0, rec, floor: floorGen(kept.live.rate), timer: 0, stale: true };
    N.staleLive = l.g;
    later(() => emitter(l), cfg.staleChunkMs == null ? 100 : cfg.staleChunkMs);
  }
  window.addEventListener("pagehide", () => { N.unloading = true; }, true);
  window.addEventListener("pagehide", () => { persist(); });

  // ── navigator.audioSession (cfg.audioSession), as WebKit has it ──
  const AS_KEY = "__nmAS", AS_LOG = "__nmASlog";
  let asHeld = "auto"; try { asHeld = sessionStorage.getItem(AS_KEY) || "auto"; } catch (e) {}
  const AS = N.as = { on: !!cfg.audioSession, sets: [], gum: [], refused: 0, heldAtLoad: asHeld, held: () => asHeld,
    hold: (v) => { asHeld = v; try { sessionStorage.setItem(AS_KEY, v); } catch (e) {} },
    log: () => { try { return JSON.parse(sessionStorage.getItem(AS_LOG) || "[]"); } catch (e) { return []; } } };
  if (cfg.audioSession) {
    const TYPES = ["auto", "playback", "transient", "transient-solo", "ambient", "play-and-record"];
    let mine = "auto";                                       // this document's own: "auto" on every load
    const session = { state: "inactive", onstatechange: null, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
    Object.defineProperty(session, "type", { enumerable: true, get: () => mine, set: (v) => {
      v = String(v);
      if (TYPES.indexOf(v) < 0) return;                      // an IDL enum: an unknown value is ignored
      mine = v; AS.sets.push({ v, at: now(), gum: N.gum }); AS.hold(v);
      try { const l = AS.log(); l.push({ v, page: location.pathname }); sessionStorage.setItem(AS_LOG, JSON.stringify(l)); } catch (e) {}
    } });
    Object.defineProperty(navigator, "audioSession", { configurable: true, value: session });
  }

  // ── the web mic: the same world, as a real MediaStream ──
  try {
    if (!navigator.mediaDevices) Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {} });
    const suites = navigator.mediaDevices.getUserMedia ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices) : null;
    navigator.mediaDevices.getUserMedia = function (c) {
      N.gum++; persist();
      const rec = micRec("web", cfg.world === false && !!suites);
      if (cfg.audioSession) {
        AS.gum.push(asHeld);
        if (asHeld !== "auto" && asHeld !== "play-and-record") {
          AS.refused++; rec.end = stamp();
          return Promise.reject(new DOMException("AudioSession category is not compatible with audio capture.", "InvalidStateError"));
        }
      }
      if (cfg.gum === "deny") { rec.end = stamp(); return Promise.reject(new DOMException("Permission denied", "NotAllowedError")); }
      let p;
      if (cfg.world !== false) p = (async () => { const ctx = worldCtx(); try { await ctx.resume(); } catch (e) {} const d = ctx.createMediaStreamDestination(); d.__nmWorld = true; W.bus.connect(d); return d.stream; })();
      else p = suites ? Promise.resolve(suites(c)) : Promise.reject(new DOMException("no microphone", "NotFoundError"));
      return p.then((stream) => {
        rec.start = stamp();
        try {
          stream.getTracks().forEach((t) => {
            const stop = t.stop;
            t.stop = function () { if (rec.end == null) rec.end = stamp(); return stop.apply(this, arguments); };
          });
        } catch (e) {}
        return stream;
      }, (e) => { rec.end = stamp(); throw e; });
    };
  } catch (e) {}

  // every AudioContext a page makes, at ctxRate
  if (cfg.ctxRate && RealAC) {
    const Rated = function (o) { return new RealAC(Object.assign({ sampleRate: cfg.ctxRate }, o || {})); };
    Rated.prototype = RealAC.prototype;
    window.AudioContext = window.webkitAudioContext = Rated;
  }

  // ── every sound the page makes, against the mics ──
  if (cfg.audit !== false) {
    const S = N.sounds;
    const AS = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
    if (AS) {
      const start = AS.start, stop = AS.stop;
      AS.start = function (when) {
        try {
          const world = this.__nmWorld || (W.ctx && this.context === W.ctx);
          const len = this.buffer ? this.buffer.length : null;
          if (!world && !(len != null && len <= 1)) {   // the iOS unlock blip: one silent sample
            const lead = Math.max(0, ((when || 0) - this.context.currentTime) * 1000);
            const rec = { kind: this instanceof OscillatorNode ? "osc" : "buf", start: now() + lead, end: Infinity, live: N.micOn(), len,
              ctxRate: this.context.sampleRate };
            if (this.buffer && !this.loop) rec.end = rec.start + this.buffer.duration * 1000 / ((this.playbackRate && this.playbackRate.value) || 1);
            this.__nmRec = rec; S.push(rec);
            this.addEventListener("ended", () => { rec.end = Math.min(rec.end, now()); });
          }
        } catch (e) {}
        return start.apply(this, arguments);
      };
      AS.stop = function (when) {
        try { const rec = this.__nmRec; if (rec) { const at = now() + Math.max(0, ((when || 0) - this.context.currentTime) * 1000); rec.end = Math.min(rec.end, at); } } catch (e) {}
        return stop.apply(this, arguments);
      };
    }
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const el = this, rec = { kind: "media", start: now(), end: Infinity, live: N.micOn(), src: String(el.currentSrc || el.src || "") };
      S.push(rec);
      const end = () => { rec.end = Math.min(rec.end, now()); };
      el.addEventListener("ended", end, { once: true }); el.addEventListener("pause", end, { once: true }); el.addEventListener("error", end, { once: true });
      let p; try { p = play.apply(this, arguments); } catch (e) { end(); throw e; }
      return Promise.resolve(p).catch((e) => { end(); throw e; });
    };
    if (window.speechSynthesis) {
      const pending = new Set();
      speechSynthesis.speak = (u) => {
        const rec = { kind: "speech", text: String(u.text), start: now(), end: Infinity, live: N.micOn() };
        S.push(rec); pending.add(rec);
        later(() => { if (u.onstart) try { u.onstart(); } catch (e) {} }, 5);
        rec.timer = later(() => { if (!pending.delete(rec)) return; rec.end = now(); if (u.onend) try { u.onend(); } catch (e) {} }, cfg.speechMs);
      };
      speechSynthesis.cancel = () => { pending.forEach((rec) => { clearTimeout(rec.timer); rec.end = now(); }); pending.clear(); };
      speechSynthesis.getVoices = () => [];
    }
  }
  persist();
}

// For suites whose AudioContext is a stand-in (micquietgamestest and the
// like): Sona's own mic needs a worklet, so this adds the least of one —
// ctx.audioWorklet.addModule, an AudioWorkletNode stub with a port — and a
// createGain whose connect(an) sets the suite's own analyser field from the
// gain's .mediaStream, the way each suite's createMediaStreamSource stand-in
// already does. cfg.field names that field: "src" (micquietgamestest),
// "stream" (arcadespeechhelptest, tilesspeechtest), "st" (sayitcardtest),
// "graph" (pauseaudiotest). cfg.wrap: "source" sets an[field] to
// { stream, on: true, connect, disconnect } (an.src's shape), else to the
// stream itself. SELF-CONTAINED, as nativeMic is. Register it after the
// suite's own fake AudioContext.
export function fakeWorkletPatch(cfg) {
  cfg = cfg || {};
  const AC = window.AudioContext;
  if (!AC || !AC.prototype) return;
  const P = AC.prototype, field = cfg.field || "src";
  if (!P.audioWorklet) Object.defineProperty(P, "audioWorklet", { configurable: true, get: () => ({ addModule: () => Promise.resolve() }) });
  window.AudioWorkletNode = function () {
    this.port = { postMessage() {}, onmessage: null };
    this.connect = () => {}; this.disconnect = () => {};
  };
  const make = P.createGain;
  P.createGain = function () {
    const g = make.apply(this, arguments), connect = g.connect, disconnect = g.disconnect;
    g.connect = function (an) {
      if (g.mediaStream && an && typeof an === "object") {
        const st = g.mediaStream;
        if (cfg.wrap === "source") { g.__src = g.__src || { stream: st, on: true, connect() {}, disconnect() { this.on = false; } }; g.__src.on = true; an[field] = g.__src; }
        else an[field] = st;
      }
      return connect ? connect.apply(this, arguments) : undefined;
    };
    g.disconnect = function () { if (g.__src) g.__src.on = false; return disconnect ? disconnect.apply(this, arguments) : undefined; };
    return g;
  };
}
