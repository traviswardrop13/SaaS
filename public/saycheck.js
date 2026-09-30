/* SayCheck: Say & Play's speech check, for a page that asks a child to say
   one word (the picture books' key word first; family redesign brief,
   28 Sep 2026: "The child repeats one key word on every page before the page
   turns ... use the same speech check the games use").

   It is the SAME check, copied rather than shared, because sayplay.js keeps
   its listener inside its own closure and its tests pin that source as it
   stands. A rule that lives in two places drifts, so tests/booktest.mjs fails
   if any timing below, the loudness bar or the family check stops matching
   sayplay.js. Change one, change both.

   What the mic is allowed to do, the same hard lines Say & Play keeps:
   - It hears loudness and the sound's rough shape only (voiced vs hiss). It
     records nothing, uploads nothing and scores nothing, and writes nothing
     but "sona.micok" (the grown-up already said yes). A word said here is
     PLAY, never practice data: nothing here calls logAttempt, bumpReps,
     recordSession, recordRung, rotAdvance or awards anything. Whether it
     should count is Rachel's call; until she makes it, it doesn't.
   - It can tell "a voice of the right family" apart from silence and from a
     sound of the other family. It cannot tell the word, so a page must never
     call a "heard" right or wrong: it means Echo heard the child.
   - It is open only for the child's turn. On an iPhone a page holding the mic
     runs as a phone call, so nothing plays while a track is live or while a
     request is still being answered (the phone is already recording then),
     nor within SETTLE_MS of a close; and the mic never opens until the page
     has been quiet. A page's own voice goes through quiet() and hold(), so its
     lines keep the same rules as Echo's here.

   ES5, classic script, needs /sona.js first. window.SayCheck = { say, listen,
   stop, chime, ready, permit, quiet, hold }. */
(function () {
  "use strict";
  var S = window.Sona;

  // ── timings ── (sayplay.js's numbers; booktest pins them equal)
  var SETTLE_MS = 200, QUIET_MS = 900, VOICE_TAIL_MS = 250;
  var FLOOR_MS = 450, HEARD_MS = 3000, LISTEN_MS = 12000;
  // Say & Play silently resets a burst that sounds like the other family and
  // keeps listening. A page that counts tries needs that as an answer, so a
  // wrong-family burst followed by this much quiet is one try ("shape").
  var TRY_GAP_MS = 400;
  var SFX_MS = { tap: 120, correct: 400, complete: 700, star: 220 };

  function now() { return performance.now(); }
  function prof() { try { return (S && S.getProfile) ? (S.getProfile() || {}) : {}; } catch (e) { return {}; } }
  function vol() { var v = prof().volume, n = Number(v == null ? 0.8 : v); return isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.8; }

  // ── the phone's quiet: what every sound waits on ──
  var asking = false, stream = null, micClosedAt = -1e9, quietUntil = 0, chimeEnd = 0, chimesDue = 0;
  var speaking = false, holds = 0, vgen = 0;
  function settleLeft() { return Math.max(0, micClosedAt + SETTLE_MS - now()); }
  // Runs fn once no mic is live or being asked for, SETTLE_MS after the last
  // close, and after any chime still ringing. With `my`, a stop() in the
  // meantime drops it (Echo's line and chimes); without, it always runs (the
  // page's own voice, whose promise must settle so its buttons never stick).
  function whenQuiet(fn, my, dropped) {
    (function check() {
      if (my != null && my !== vgen) { if (dropped) dropped(); return; }
      if (asking || stream) { setTimeout(check, 60); return; }
      var w = Math.max(settleLeft(), chimeEnd - now());
      if (w > 0) { setTimeout(check, w); return; }
      fn();
    })();
  }
  function quiet(fn) { whenQuiet(fn); }
  // The page's own voice (a book's narration) is playing: the mic won't open
  // and anything it hears is dropped, and VOICE_TAIL_MS follows the release.
  function hold(on) {
    if (on) { holds++; return; }
    if (holds > 0) holds--;
    quietUntil = Math.max(quietUntil, now() + VOICE_TAIL_MS);
  }

  // ── audio out ──
  var ctx = null;
  function getCtx() {
    if (!ctx) { var AC = window.AudioContext || window.webkitAudioContext; ctx = new AC(); }
    // Safari also has "interrupted" (a call, or the mic switching the phone's
    // audio over), and a context that isn't running feeds the analyser silence
    if (ctx.state !== "running" && ctx.state !== "closed" && !document.hidden) {
      try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
    return ctx;
  }
  // iOS: a context only plays once a tap has touched it
  document.addEventListener("pointerdown", function () {
    if (document.hidden) return;
    try { var c = getCtx(), b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {}
  }, { passive: true, capture: true });

  // the same device cache Say & Play keeps, so a word Echo has said once
  // never goes back to the voice service on this phone
  function ttsDB() { return new Promise(function (res, rej) { try { var r = indexedDB.open("sona-tts", 1); r.onupgradeneeded = function () { r.result.createObjectStore("clips"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; } catch (e) { rej(e); } }); }
  // A cache that never answers (WebKit has shipped an IndexedDB open that
  // hangs) would hold Echo's line, and so the mic, forever: after a beat it
  // counts as a miss and the voice service answers instead.
  function ttsGet(k) {
    return new Promise(function (done) {
      var t = setTimeout(function () { done(null); }, 1500);
      ttsDB().then(function (db) { return new Promise(function (res) { try { var rq = db.transaction("clips").objectStore("clips").get(k); rq.onsuccess = function () { res(rq.result || null); }; rq.onerror = function () { res(null); }; } catch (e) { res(null); } }); })
        .catch(function () { return null; })
        .then(function (v) { clearTimeout(t); done(v); });
    });
  }
  function ttsPut(k, buf) { ttsDB().then(function (db) { try { db.transaction("clips", "readwrite").objectStore("clips").put(buf, k); } catch (e) {} }).catch(function () {}); }
  function fetchVoice(t) {
    var ctl = window.AbortController ? new AbortController() : null, to = ctl ? setTimeout(function () { ctl.abort(); }, 8000) : 0;
    return fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t, voice: prof().voiceId || "", stable: true }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        clearTimeout(to);
        if (!r.ok) return null;
        // "0": a stand-in while the usual voice model was busy. Play it, never
        // save it: phones key clips by voice and text, not model, so a saved
        // stand-in would replay the old voice forever (the same rule as sayplay.js).
        var keep = !(r.headers && r.headers.get && r.headers.get("X-Sona-Voice-Keep") === "0");
        return r.arrayBuffer().then(function (b) { return b ? { bytes: b, keep: keep } : null; });
      }, function () { clearTimeout(to); return null; });
  }

  // One line of Echo's at a time; stop() cuts it and still calls its done.
  var line = null;
  function say(text, done) {
    done = done || function () {};
    if (line) line.cancel();
    if (!text || prof().voiceOn === false || vol() === 0 || document.hidden) { done(); return; }
    var my = vgen, fin = false, src = null, timer = 0, synthOn = false;
    var me = { cancel: cancel };
    line = me; speaking = true;   // the mic won't open under a line that is coming
    function end() {
      if (fin) return; fin = true; clearTimeout(timer);
      if (line === me) { line = null; speaking = false; }
      quietUntil = Math.max(quietUntil, now() + VOICE_TAIL_MS);
      done();
    }
    function cancel() {
      try { if (src) src.stop(); } catch (e) {}
      try { if (synthOn && window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
      end();
    }
    function synth() {
      if (fin || !window.speechSynthesis || !window.SpeechSynthesisUtterance) { end(); return; }
      try {
        var u = new SpeechSynthesisUtterance(text); u.rate = 0.95; u.pitch = 1.05; u.volume = vol();
        u.onend = end; u.onerror = end; timer = setTimeout(end, 9000); synthOn = true; window.speechSynthesis.speak(u);
      } catch (e) { end(); }
    }
    function play(b) {
      if (fin) return;
      try {
        var c = getCtx();
        // a context the phone never let start would hold this line forever
        if (c.state !== "running") { synth(); return; }
        var n = b.byteLength >> 1, ab = c.createBuffer(1, n, 24000), ch = ab.getChannelData(0), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
        for (var i = 0; i < n; i++) ch[i] = dv.getInt16(i * 2, true) / 32768;
        src = c.createBufferSource(); src.buffer = ab; var g = c.createGain(); g.gain.value = vol();
        src.connect(g); g.connect(c.destination); src.onended = end; src.start();
        timer = setTimeout(end, n / 24 + 1500);
      } catch (e) { synth(); }
    }
    var key = (prof().voiceId || "echo") + "|" + ((S && S.TTS_CACHE_VERSION) || "v9") + "|" + text;
    whenQuiet(function () {
      if (fin) return;
      ttsGet(key).then(function (cached) {
        if (fin) return;
        if (my !== vgen || document.hidden) { end(); return; }
        if (cached) { play(new Uint8Array(cached)); return; }
        fetchVoice(text).then(function (got) {
          if (fin) return;
          if (my !== vgen || document.hidden) { end(); return; }
          var b = got && got.bytes;
          if (!b || !b.byteLength) { synth(); return; }
          if (got.keep) ttsPut(key, b);
          play(new Uint8Array(b));
        });
      });
    }, my, end);
  }

  // A chime never plays over an open mic, nor while one is being asked for,
  // nor inside SETTLE_MS of a close; and the mic waits QUIET_MS after it.
  function chime(name) {
    var my = vgen; chimesDue++;
    quietUntil = Math.max(quietUntil, now() + QUIET_MS);
    whenQuiet(function () {
      chimesDue--;
      if (document.hidden) return;
      quietUntil = Math.max(quietUntil, now() + QUIET_MS);
      chimeEnd = Math.max(chimeEnd, now() + (SFX_MS[name] || 400));
      try { if (prof().soundOn !== false && S && S.sfx && S.sfx[name]) S.sfx[name](); } catch (e) {}
    }, my, function () { chimesDue--; });
  }

  // ── the mic: one listening window at a time ──
  var gen = 0, src = null, raf = 0, listenT = 0, openT = 0, roomFloor = -1;
  function p20(list) { var a = list.slice().sort(function (x, y) { return x - y; }); return a[Math.floor((a.length - 1) * 0.2)]; }
  function micStop() {
    gen++; clearTimeout(listenT); clearTimeout(openT); if (raf) cancelAnimationFrame(raf); raf = 0;
    try { if (src) src.disconnect(); } catch (e) {} src = null;
    if (stream) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} stream = null; micClosedAt = now(); }
  }
  // Everything stops: the mic, Echo's line, and any chime still waiting.
  function stop() {
    micStop(); vgen++;
    if (line) line.cancel();
  }
  // A refusal, no mic at all, or a mic that wouldn't open this time (busy,
  // interrupted): each is its own answer, and none of them is silence.
  function errKind(e) {
    var n = e && e.name;
    if (n === "NotAllowedError" || n === "SecurityError") return "denied";
    if (n === "NotFoundError" || n === "OverconstrainedError") return "nomic";
    return "failed";
  }
  // A voiced burst must also SOUND like the practice sound's family (voiced vs
  // hiss): a clap or a squeal can't pass for an R. Shape numbers only.
  function famOK(shp, sound) {
    if (!shp || !shp.m) return true;
    var cent = shp.fm / shp.m, high = shp.hm / shp.m, fam = (S && S.soundFamily) ? S.soundFamily(sound) : "any";
    if (fam === "low") return !(cent > 1800 && high > 0.22);
    if (fam === "hiss") return !(cent < 1100 && high < 0.10);
    return true;
  }
  // One listening window. cb(outcome), exactly once unless stop() comes first:
  //   "heard"  a voiced burst of the sound's family (the mic is already closed)
  //   "shape"  a voiced burst of the other family, then quiet: one real try
  //   "quiet"  LISTEN_MS with no voice
  //   "hidden" the page was hidden before the mic could open
  //   "denied" the mic is refused;  "nomic" there is no mic to use
  //   "failed" the mic wouldn't open this time (busy, interrupted)
  // onLive() fires once, when the mic can actually hear (the room's floor is
  // known): that, and nothing earlier, is "Your turn".
  function listen(sound, cb, onLive) {
    micStop();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { cb("nomic"); return; }
    var my = gen;
    (function open() {
      if (my !== gen) return;
      if (document.hidden) { cb("hidden"); return; }
      var w = Math.max(quietUntil - now(), settleLeft(), chimeEnd - now());
      if (asking || speaking || holds > 0 || chimesDue > 0 || w > 0) { openT = setTimeout(open, Math.max(w, 60)); return; }
      asking = true;
      navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (st) {
        asking = false;
        if (my !== gen || document.hidden) {
          try { st.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
          micClosedAt = now();
          if (my === gen) cb("hidden");
          return;
        }
        stream = st;
        try { localStorage.setItem("sona.micok", "1"); } catch (e) {}
        var c, an, td, fd, binHz;
        try {
          c = getCtx(); src = c.createMediaStreamSource(st); an = c.createAnalyser(); an.fftSize = 512; src.connect(an);
          td = new Uint8Array(an.fftSize); fd = new Uint8Array(an.frequencyBinCount); binHz = c.sampleRate / an.fftSize;
        } catch (e) { micStop(); cb("failed"); return; }
        var heard = [], live = false, failed = false, lastLoud = 0;
        listenT = setTimeout(function () { if (my !== gen) return; micStop(); cb(failed ? "shape" : "quiet"); }, LISTEN_MS);
        (function tick() {
          if (my !== gen) return;
          var t = now();
          // belt and braces: nothing plays while the mic is open, and if
          // anything did, its frames are dropped, never judged
          if (speaking || holds > 0 || t < quietUntil) { heard = []; raf = requestAnimationFrame(tick); return; }
          an.getByteTimeDomainData(td);
          var sum = 0; for (var i = 0; i < td.length; i++) { var d = (td[i] - 128) / 128; sum += d * d; }
          var shape = null; if (S && S.frameShape) { an.getByteFrequencyData(fd); shape = S.frameShape(fd, binHz); }
          heard.push({ t: t, r: Math.sqrt(sum / td.length), s: shape });
          while (t - heard[0].t > HEARD_MS) heard.shift();
          // the room's quiet level belongs to the page and only goes down, so
          // a child who answers the instant the mic opens isn't taken for noise
          if (t - heard[0].t >= FLOOR_MS) {
            var q = []; for (var k = heard.length - 1; k >= 0 && t - heard[k].t <= FLOOR_MS; k--) q.push(heard[k].r);
            var fl = p20(q); if (roomFloor < 0 || fl < roomFloor) roomFloor = fl;
          }
          if (roomFloor >= 0) {
            if (!live) { live = true; if (onLive) { try { onLive(); } catch (e) {} } }
            var thr = Math.max(0.04, roomFloor * 3), voiced = 0, shp = null;
            for (var j = 0; j < heard.length; j++) {
              var f = heard[j];
              if (f.r > thr) {
                voiced++;
                if (f.s) { if (!shp) shp = { m: 0, fm: 0, hm: 0 }; shp.m += f.s.m; shp.fm += f.s.fm; shp.hm += f.s.hm; }
                if (voiced >= 5) { if (!famOK(shp, sound)) { voiced = 0; shp = null; failed = true; } else { micStop(); cb("heard"); return; } }
              } else { voiced = 0; shp = null; }
            }
            if (heard[heard.length - 1].r > thr) lastLoud = t;
            if (failed && t - lastLoud >= TRY_GAP_MS) { micStop(); cb("shape"); return; }
          }
          raf = requestAnimationFrame(tick);
        })();
      }).catch(function (e) {
        asking = false; micClosedAt = Math.max(micClosedAt, now());
        if (my === gen) cb(errKind(e));
      });
    })();
  }

  // ── the first time: a grown-up says yes ──
  // ready(cb): "go" (the mic was already allowed), "ask" (show the grown-up
  // a primer first), or "nomic". It never asks the phone for the mic.
  function ready(cb) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { cb("nomic"); return; }
    try { if (localStorage.getItem("sona.micok") === "1") { cb("go"); return; } } catch (e) {}
    // an engine that doesn't know "microphone" may throw rather than reject
    var q = Promise.resolve(null);
    try { if (navigator.permissions && navigator.permissions.query) q = Promise.resolve(navigator.permissions.query({ name: "microphone" })).catch(function () { return null; }); } catch (e) {}
    q.then(function (st) {
      if (st && st.state === "granted") { try { localStorage.setItem("sona.micok", "1"); } catch (e) {} cb("go"); return; }
      cb("ask");
    });
  }
  // permit(cb): call it straight from the grown-up's "Yes" tap, so the phone's
  // own prompt rides on that tap. The track is closed at once; cb("ok"),
  // "denied", "nomic" or "failed" (no mic right now).
  function permit(cb) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { cb("nomic"); return; }
    micStop(); asking = true;
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (st) {
      asking = false;
      try { st.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      micClosedAt = now();
      try { localStorage.setItem("sona.micok", "1"); } catch (e) {}
      cb("ok");
    }).catch(function (e) { asking = false; micClosedAt = Math.max(micClosedAt, now()); cb(errKind(e)); });
  }

  // a hidden page never holds the mic or keeps talking
  if (S && S.onBackground) S.onBackground(stop);

  window.SayCheck = { say: say, listen: listen, stop: stop, chime: chime, ready: ready, permit: permit, quiet: quiet, hold: hold };
})();
