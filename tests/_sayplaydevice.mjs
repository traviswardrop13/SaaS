// Shared fake on-device speech/audio for Say & Play integration tests.
export function fakeDevice(cfg) {
  const T0 = performance.now();
  if(cfg.fastPlay) Math.random=()=>0.46; // deterministic exhausted-bank fallback
  const now = () => (performance.now() - T0) / 1000;
  const h = window.__quiet = { cfg, now, mics: [], sounds: [], sfx: [], gains: [], speech: [], requests: 0, inflight: 0, gumPlan: [], voice: false, hidden: false, speaking: 0, voicedFrames: 0, leakFrames: 0 };
  // Two counts (24 Sep 2026). live(): tracks the page holds right now, which
  // is what "the mic is open and listening" waits on. micOn(): the audit's
  // count, which ALSO holds a request still being answered: on an iPhone
  // recording starts (and the phone flips into call audio) before
  // getUserMedia returns, so a word that starts while a request is pending is
  // already under the mic although the page never sees a live track. This
  // audit used to count a mic only once its request resolved, and missed
  // Echo's word starting under exactly that.
  h.live = () => h.mics.filter((m) => m.start != null && m.end == null).length;
  h.micOn = () => h.mics.filter((m) => m.end == null).length;
  h.playingNow = () => { const t = now(); return h.speaking > 0 || h.sounds.some((s) => s.start <= t && t < s.end); };
  Object.defineProperty(document, "hidden", { configurable: true, get: () => h.hidden });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h.hidden ? "hidden" : "visible") });
  h.background = () => { h.hidden = true; document.dispatchEvent(new Event("visibilitychange")); };
  h.foreground = () => { h.hidden = false; document.dispatchEvent(new Event("visibilitychange")); };

  Object.defineProperty(navigator, "permissions", { configurable: true, value: { query: () => Promise.resolve({ state: cfg.permission || "granted" }) } });
  // A request answers at once unless scripted: cfg.gumDelay, or one
  // h.gumPlan entry per request ({ delay } or { delay, fail }), models a
  // phone that takes a while to answer (an iPhone switching into call audio,
  // a permission sheet) or an OS that cuts a pending request short. The
  // page's track goes live only when the answer arrives, but the audit's mic
  // interval runs from `asked` (the request going out) to `end` (the track
  // stopped, or the request failing).
  navigator.mediaDevices.getUserMedia = () => {
    h.requests++;
    if (cfg.micMode === "deny") return Promise.reject(new DOMException("Denied", "NotAllowedError"));
    const plan = h.gumPlan.shift() || { delay: cfg.gumDelay || 0 };
    const rec = { asked: now(), start: null, end: null }; h.mics.push(rec);
    const open = () => {
      rec.start = now();
      const track = { kind: "audio", readyState: "live", stop() { if (this.readyState !== "ended") { this.readyState = "ended"; rec.end = now(); } } };
      rec.track = track;
      return { getTracks: () => [track], getAudioTracks: () => [track] };
    };
    if (!plan.delay && !plan.fail) return Promise.resolve(open());
    h.inflight++;
    return new Promise((resolve, reject) => setTimeout(() => {
      h.inflight--;
      if (plan.fail) { rec.end = now(); reject(new DOMException("Interrupted", "AbortError")); } else resolve(open());
    }, plan.delay || 0));
  };

  function param(v) {
    const p = { _v: v, sets: [] };
    p.setValueAtTime = (x, t) => p.sets.push(["set", x, t]);
    p.linearRampToValueAtTime = (x, t) => p.sets.push(["lin", x, t]);
    p.exponentialRampToValueAtTime = (x, t) => p.sets.push(["exp", x, t]);
    p.setTargetAtTime = () => {}; p.cancelScheduledValues = () => {};
    Object.defineProperty(p, "value", { get: () => p._v, set: (x) => { p._v = x; p.sets.push(["value", x]); } });
    return p;
  }
  function endAt(t) { return t == null || t < now() ? now() : t; }
  function AC() { this.state = "running"; this.sampleRate = 48000; this.destination = {}; }
  Object.defineProperty(AC.prototype, "currentTime", { get: now });
  AC.prototype.resume = function () { this.state = "running"; return Promise.resolve(); };
  AC.prototype.suspend = function () { this.state = "suspended"; return Promise.resolve(); };
  AC.prototype.close = function () { this.state = "closed"; return Promise.resolve(); };
  AC.prototype.createGain = function () { const g = { gain: param(1), at: now(), connect() {}, disconnect() {} }; h.gains.push(g); return g; };
  AC.prototype.createOscillator = function () {
    const o = { type: "sine", frequency: param(440), connect() {}, disconnect() {}, onended: null,
      start(t) { o.rec = { kind: "osc", start: Math.max(now(), t || 0), end: Infinity, live: h.micOn() }; h.sounds.push(o.rec); },
      stop(t) { if (o.rec) o.rec.end = Math.min(o.rec.end, endAt(t)); } };
    return o;
  };
  AC.prototype.createBuffer = function (c, n, sr) { sr = sr || this.sampleRate; return { length: n, sampleRate: sr, duration: n / sr, numberOfChannels: c, getChannelData: () => new Float32Array(n) }; };
  AC.prototype.createBufferSource = function () {
    const s = { buffer: null, connect() {}, disconnect() {}, onended: null,
      start(t) {
        if (!s.buffer || s.buffer.length <= 1) return;   // the iOS unlock blip: one silent sample
        s.rec = { kind: "buf", len: s.buffer.length, start: Math.max(now(), t || 0), live: h.micOn() };
        s.rec.end = s.rec.start + s.buffer.duration; h.sounds.push(s.rec);
        s.timer = setTimeout(() => { if (s.onended) s.onended(); }, (s.rec.end - now()) * 1000);
      },
      stop(t) { if (s.rec) s.rec.end = Math.min(s.rec.end, endAt(t)); clearTimeout(s.timer); if (s.onended) s.onended(); } };
    return s;
  };
  AC.prototype.createBiquadFilter = function () { return { type: "lowpass", Q: param(1), frequency: param(350), gain: param(0), connect() {}, disconnect() {} }; };
  AC.prototype.createMediaStreamSource = function (stream) { return { stream, on: false, connect(an) { an.src = this; this.on = true; }, disconnect() { this.on = false; } }; };
  AC.prototype.createAnalyser = function () {
    const an = { fftSize: 2048, src: null, context: this, connect() {}, disconnect() {} };
    Object.defineProperty(an, "frequencyBinCount", { get: () => an.fftSize / 2 });
    // What the mic hears: the child when h.voice is on — and ANY sound the
    // page is playing right now, because a phone's mic hears its own speaker.
    an.hears = () => { if (!an.src || !an.src.on) return false; const tr = an.src.stream.getTracks()[0]; return tr.readyState === "live" && (h.voice || h.playingNow()); };
    an.getByteTimeDomainData = (d) => { const v = an.hears(); if (v) h.voicedFrames++; if (v && !h.voice) h.leakFrames++; for (let i = 0; i < d.length; i++) d[i] = v ? (i % 2 ? 200 : 56) : 128; };
    // a low, voiced shape (energy under ~1 kHz): the family an /r/ child's
    // voice — and Sona's chimes — would show
    an.getByteFrequencyData = (d) => { const v = an.hears(); d.fill(0); if (v) for (let i = 1; i <= 10 && i < d.length; i++) d[i] = 220; };
    return an;
  };
  window.AudioContext = window.webkitAudioContext = AC;
  // A media element is a sound like any other (the iPhone app plays Echo's
  // voice and Bubble Pop's pops this way): it joins the audit, so one that
  // starts under a mic, or rings into the next one, is caught. cfg.refuseMedia
  // models a phone that will not start one.
  HTMLMediaElement.prototype.play = function () {
    if (cfg.refuseMedia) return Promise.reject(new DOMException("refused", "NotAllowedError"));
    const t = now(); h.sounds.push({ kind: "media", start: t, end: t + (isFinite(this.duration) && this.duration > 0 ? this.duration : 0.4), live: h.micOn() });
    return Promise.resolve();
  };

  if (window.speechSynthesis) {
    const pending = new Set();
    speechSynthesis.speak = (u) => {
      const rec = { kind: "speech", text: String(u.text), start: now(), end: Infinity, live: h.micOn() };
      h.sounds.push(rec); h.speech.push(rec.text); h.speaking++; pending.add(rec);
      rec.timer = setTimeout(() => { if (!pending.delete(rec)) return; rec.end = now(); h.speaking--; if (u.onend) u.onend(); }, cfg.speechMs || 400);
    };
    speechSynthesis.cancel = () => { pending.forEach((rec) => { clearTimeout(rec.timer); rec.end = now(); h.speaking--; }); pending.clear(); };
    speechSynthesis.getVoices = () => [];
  }

  // Sona's own chimes stay real (they reach the fake Web Audio above); each
  // call is also logged by name, with how many mic tracks were live
  let sona;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set(value) {
    sona = value;
    value.confetti = () => {};
    Object.keys(value.sfx || {}).forEach((k) => { const real = value.sfx[k]; if (typeof real !== "function" || k === "stop") return; value.sfx[k] = function () { h.sfx.push({ name: k, at: now(), live: h.micOn() }); return real.apply(this, arguments); }; });
  } });

  if (!localStorage.getItem("sona.test.sayplaySeed")) {
    localStorage.setItem("sona.test.sayplaySeed", "1");
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done"); localStorage.setItem("sona.freeera5.v1", "done");
    // earlyAdopter: a family holding every game, so this holds whichever way pricing points
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Mia", childAge: cfg.age || "7", focusSounds: ["R"], onboarded: true, earlyAdopter: cfg.premium !== false,
      voiceOn: cfg.voiceOn !== false, soundOn: cfg.soundOn !== false, volume: cfg.volume == null ? 0.6 : cfg.volume }));
    if (cfg.micok) localStorage.setItem("sona.micok", "1");
    // anything else a scenario starts with (Dino Dig's round of dinosaurs)
    if (cfg.seed) Object.keys(cfg.seed).forEach((k) => localStorage.setItem(k, cfg.seed[k]));
    if (cfg.paid) {
      sessionStorage.setItem("sona.paidui", "1");
      localStorage.setItem("sona.demo.v1", JSON.stringify({ started: Date.now() - 100 * 3600000, done: Date.now() - 90000 }));
    }
  }
}

