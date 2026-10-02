/* The say-it card in the five round games (Fruit Slice, Piano Tiles, Block
   Stacker, Sound Sprint, Flappy Glide): Echo's voice that asks for the sound.
   Each page keeps its own microphone (openReviveMic, closeReviveMic,
   listenFor), its own ear (what counts as the child is unchanged) and its own
   idea of what a heard sound does; this file holds only the voice, which
   would otherwise be five copies. Static ES5,
   loaded after sona.js. Nothing here records or sends audio: loudness and
   sound-shape numbers only, on the phone. */
(function (global) {
  "use strict";

  // ── ECHO ASKS OUT LOUD (2 Oct 2026) ──
  // Travis, in the iPhone app: "there's no voice telling them to say it. Most
  // of these kids can't read ... it took a while to catch the audio. It was
  // kind of frozen". Only Fruit Slice spoke its card; the other four opened
  // the mic under a line of text. Now every card says three things in a row:
  // Echo's "To keep playing, say", Rachel's own recorded take of the sound
  // (one take, /coach/say-echo/<S>-sound.wav, never a voice guessing at a
  // phoneme), then Echo's "Go!" (Travis: "i also wanna try to have the 11
  // labs voice say 'Go!'"), so a child who can't read hears that it is their
  // turn. Only then does the page open its mic, a short tail after the last
  // word, so none of it can be heard as the child.
  //
  // How each line plays is the rule every listening page keeps:
  //   - in the iPhone app, as media (Sona.mediaPCM), never Web Audio: there a
  //     page that has had the mic open plays Web Audio as a quiet phone call,
  //     and the ring/silent switch silences it. mediaPCM gives up on a line
  //     that never starts within four seconds;
  //   - on the website, through Web Audio on the page's own context, which the
  //     child's taps on the game have already woken: a browser refuses an
  //     <audio> started outside a tap, and the card opens between rounds;
  //   - Rachel's take the same way: an <audio> in the app (skipped if it has
  //     not started within TAKE_START_MS), decoded into Web Audio on the web;
  //   - a line the phone refused outright is said by the browser's own voice
  //     instead (the robot is better than silence for a child who can't
  //     read), cut off at its cap so it can never run on into the mic.
  //
  // Why it could look frozen, and what changed (review of 2 Oct 2026):
  //   - Echo's two lines are asked for when the page loads, not when the
  //     first card opens, and kept in the phone's own voice cache (the
  //     IndexedDB "sona-tts" store that Say & Play and Feed Echo share, keyed
  //     voice|TTS_CACHE_VERSION|text), so a card never waits on the network
  //     once they have been heard;
  //   - a line still on its way when Echo needs it gets LINE_WAIT_MS, counted
  //     from when he is ready to speak, then the card goes on without it;
  //   - Echo waits only for what is really still sounding (a mic still
  //     closing, a chime still ringing), never for the mic's own quiet window;
  //   - a media element that never starts stops the rest of the ask: the next
  //     one would not start either, and the child has already waited.
  var ASK = "To keep playing, say", GO = "Go!";
  var LINE_WAIT_MS = 2500, TAKE_START_MS = 3000, FAST_FAIL_MS = 1500, SYNTH_START_MS = 1200, SYNTH_CAP_MS = 5000;
  // after a voice line has ended, the mic waits this long (the tail every
  // listening page keeps: Say & Play, Feed Echo, the books)
  var VOICE_TAIL_MS = 250;
  // How long each chime rings, so Echo starts after it and not on top of it
  // (sayplay.js's SFX_MS, with the round games' own sounds). Unknown: 600.
  var CHIME_MS = { tap: 120, coin: 200, star: 250, swish: 200, drop: 250, splat: 250, gold: 300, wrong: 350, correct: 400, reward: 600, complete: 700, giant: 800 };
  function chimeMs(n) { return CHIME_MS[n] || 600; }

  function profile() { try { return global.Sona.getProfile() || {}; } catch (e) { return {}; } }
  function volume() { var v = Number(profile().volume); return isFinite(v) && profile().volume != null ? Math.max(0, Math.min(1, v)) : 0.8; }
  function voiceOn() { var p = profile(); return !(p.voiceOn === false || Number(p.volume) === 0); }
  function asMedia() { var S = global.Sona; return !!(S && S.mediaPCM && S.voiceAsMedia && S.voiceAsMedia()); }

  // the phone's voice cache, shared with sayplay.js and arcade-feed.html
  function ttsDB() { return new Promise(function (res, rej) { try { var r = indexedDB.open("sona-tts", 1); r.onupgradeneeded = function () { r.result.createObjectStore("clips"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; } catch (e) { rej(e); } }); }
  function ttsGet(k) { return ttsDB().then(function (db) { return new Promise(function (res) { try { var rq = db.transaction("clips").objectStore("clips").get(k); rq.onsuccess = function () { res(rq.result || null); }; rq.onerror = function () { res(null); }; } catch (e) { res(null); } }); }).then(null, function () { return null; }); }
  function ttsPut(k, buf) { ttsDB().then(function (db) { try { db.transaction("clips", "readwrite").objectStore("clips").put(buf, k); } catch (e) {} }).then(null, function () {}); }
  function ttsKey(text) { var S = global.Sona; return (profile().voiceId || "echo") + "|" + ((S && S.TTS_CACHE_VERSION) || "v9") + "|" + text; }

  // One promise per line for the page: the bytes, or null. A line that could
  // not load is asked for again the next time it is needed.
  var lines = {};
  function line(text) {
    if (lines[text]) return lines[text];
    var key = ttsKey(text), got;
    got = ttsGet(key).then(function (cached) {
      if (cached && cached.byteLength) return cached;
      var ctl = null, timer = 0, keep = true;
      try { ctl = new AbortController(); timer = setTimeout(function () { ctl.abort(); }, 7000); } catch (e) { ctl = null; }
      return fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text, voice: profile().voiceId || "", stable: true }), signal: ctl ? ctl.signal : undefined })
        .then(function (r) {
          if (!r.ok) return null;
          // "0": a stand-in while the usual voice model was busy: play it, never keep it
          keep = !(r.headers && r.headers.get && r.headers.get("X-Sona-Voice-Keep") === "0");
          return r.arrayBuffer();
        })
        .then(function (b) { clearTimeout(timer); b = b && b.byteLength ? b : null; if (b && keep) ttsPut(key, b); return b; },
          function () { clearTimeout(timer); return null; });
    }).then(null, function () { return null; }).then(function (b) {
      if (!b && lines[text] === got) delete lines[text];
      return b;
    });
    lines[text] = got;
    return got;
  }

  // Rachel's take, fetched once: on the website it is decoded into Web Audio
  // (by the page's context); in the app this only warms the phone's cache,
  // and her <audio> plays the address itself.
  var takes = {};
  function takeBytes(url) {
    if (!takes[url]) takes[url] = fetch(url).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(null, function () { return null; })
      .then(function (b) { if (!b) delete takes[url]; return b; });
    return takes[url];
  }

  // page: up() is true while the card wants Echo (it is showing, no sound
  // power in progress); wait() is how many ms until the speaker is free (a
  // mic request still settling or a mic still open, the phone's switch back
  // from a mic just closed, a chime still ringing); note(text) sets the
  // card's status line (the page picks Echo's pose from speaking()); clip()
  // is the address of Rachel's take of the practice sound, or "" for none;
  // ctx() is the page's own Web Audio context (the website's voice);
  // listen(spoke) opens the mic once Echo is done, VOICE_TAIL_MS after his
  // last word if he spoke.
  function voice(page) {
    var gen = 0, speaking = false, halts = [];
    function live(g) { return g === gen && !document.hidden && page.up(); }
    function onHalt(fn) { halts.push(fn); return function () { var i = halts.indexOf(fn); if (i >= 0) halts.splice(i, 1); }; }
    function stop() {
      gen++; speaking = false;
      var h = halts; halts = []; for (var i = 0; i < h.length; i++) { try { h[i](); } catch (e) {} }
    }
    function ctx() { try { return page.ctx ? page.ctx() : null; } catch (e) { return null; } }

    // the website: the child's taps wake the page's context before any card
    // needs it (an iPhone runs Web Audio only after a touch has unlocked it)
    if (!asMedia()) {
      var wake = function () {
        if (!voiceOn()) return;
        var c = ctx(); if (!c || c.state !== "suspended") return;
        try { c.resume(); var b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {}
      };
      document.addEventListener("pointerdown", wake, { passive: true, capture: true });
      document.addEventListener("touchend", wake, { passive: true, capture: true });
    }
    // asked for as the page loads, so the first card has them in hand
    if (voiceOn()) { line(ASK); line(GO); try { var u0 = page.clip(); if (u0) takeBytes(u0); } catch (e) {} }

    // Web Audio on a context that runs (one that is still asleep gets a beat
    // to wake, as sona.js's own voice does); resolves "ended", "failed" or
    // "stopped"
    function playBuffer(make, g) {
      return new Promise(function (done) {
        var c = ctx(), src = null, over = false, timer = 0, off = null;
        function finish(how) { if (over) return; over = true; clearTimeout(timer); if (off) off(); try { if (src) { src.onended = null; src.stop(); } } catch (e) {} done(how); }
        if (!c) { done("failed"); return; }
        function go() {
          if (over) return;
          if (!live(g)) { finish("stopped"); return; }
          if (c.state !== "running") { finish("failed"); return; }
          try {
            var buf = make(c); src = c.createBufferSource(); src.buffer = buf;
            var gn = c.createGain(); gn.gain.value = volume(); src.connect(gn); gn.connect(c.destination);
            src.onended = function () { finish("ended"); };
            // onended is not trusted to arrive: its own length and a beat end it
            timer = setTimeout(function () { finish("ended"); }, Math.ceil(buf.duration * 1000) + 1500);
            src.start(0);
          } catch (e) { finish("failed"); }
        }
        off = onHalt(function () { finish("stopped"); });
        if (c.state === "suspended") {
          var woke = false, once = function () { if (woke) return; woke = true; clearTimeout(timer); go(); };
          try { c.resume().then(once, once); } catch (e) { once(); }
          if (!woke) timer = setTimeout(once, 400);
        } else go();
      });
    }
    function pcmBuffer(bytes) {
      return function (c) {
        var d = new DataView(bytes), n = bytes.byteLength >> 1, b = c.createBuffer(1, n, 24000), ch = b.getChannelData(0);
        for (var i = 0; i < n; i++) ch[i] = d.getInt16(i * 2, true) / 32768;
        return b;
      };
    }
    // the browser's own voice, for a line the phone refused to play. One
    // that has not begun within SYNTH_START_MS (an iPhone that wants a tap
    // first) is given up, and so is the rest of this ask's voice (st.stuck).
    function synth(text, g, st) {
      return new Promise(function (done) {
        var SS = global.speechSynthesis, over = false, timer = 0, off = null;
        function finish(how) { if (over) return; over = true; clearTimeout(timer); if (off) off(); if (how !== "ended") { try { SS.cancel(); } catch (e) {} } done(how); }
        if (!live(g) || st.stuck || !SS || !global.SpeechSynthesisUtterance) { done("failed"); return; }
        try {
          var u = new global.SpeechSynthesisUtterance(text); u.rate = 0.95; u.pitch = 1.05; u.volume = volume();
          u.onstart = function () {
            // begun: capped and then cut off, so a voice that never says it
            // is done can never be still talking when the mic opens
            clearTimeout(timer); timer = setTimeout(function () { finish("capped"); }, SYNTH_CAP_MS);
          };
          u.onend = function () { finish("ended"); }; u.onerror = function () { finish("failed"); };
          off = onHalt(function () { finish("stopped"); });
          timer = setTimeout(function () { st.stuck = true; finish("never"); }, SYNTH_START_MS);
          try { SS.cancel(); } catch (e) {}
          SS.speak(u);
        } catch (e) { finish("failed"); }
      });
    }
    // one of Echo's lines: wait for its bytes until the deadline, then play
    // them; a line the phone refused at once goes to the browser's voice, one
    // that never started ends the ask's media (st.stuck)
    function sayLine(text, g, st) {
      if (!live(g) || st.stuck) return Promise.resolve();
      var left = st.deadline - Date.now();
      return new Promise(function (got) {
        var t = setTimeout(function () { got(null); }, Math.max(0, left));
        line(text).then(function (b) { clearTimeout(t); got(b); });
      }).then(function (b) {
        if (!b || !live(g)) return;
        if (!asMedia()) return playBuffer(pcmBuffer(b), g).then(function (how) { if (how === "failed") return synth(text, g, st); });
        var t0 = Date.now(), m = global.Sona.mediaPCM(b, { volume: volume() }), off = onHalt(function () { m.stop(); });
        return m.done.then(function (how) {
          off();
          if (how !== "failed" || !live(g)) return;
          if (Date.now() - t0 > FAST_FAIL_MS) { st.stuck = true; return; }
          return synth(text, g, st);
        });
      });
    }
    // Rachel's take, only while the shared switch says so (sona.js
    // HUMAN_CLIPS), as practice reads it
    function sayTake(g, st) {
      var S = global.Sona, url = "";
      try { url = page.clip(); } catch (e) {}
      if (!url || !live(g) || st.stuck || !(S.humanClipsOn && S.humanClipsOn())) return Promise.resolve();
      if (!asMedia()) {
        // her bytes and their decoding get TAKE_START_MS between them, as
        // the app's element does to start: a slow network skips her take
        return new Promise(function (res) {
          var t = setTimeout(function () { res(null); }, TAKE_START_MS);
          takeBytes(url).then(function (b) {
            var c = ctx();
            if (!b || !c || !c.decodeAudioData) { clearTimeout(t); res(null); return; }
            // decodeAudioData takes the bytes away: decode a copy
            var fin = function (buf) { clearTimeout(t); res(buf || null); };
            try { var p = c.decodeAudioData(b.slice(0), fin, function () { fin(null); }); if (p && p.then) p.then(fin, function () { fin(null); }); } catch (e) { fin(null); }
          });
        }).then(function (buf) { if (buf && live(g)) return playBuffer(function () { return buf; }, g); });
      }
      return new Promise(function (done) {
        var a = null, over = false, started = false, timer = 0, off = null;
        function finish() { if (over) return; over = true; clearTimeout(timer); if (off) off(); try { a.onended = null; a.onerror = null; a.onplaying = null; a.pause(); a.removeAttribute("src"); a.load(); } catch (e) {} done(); }
        function go() {
          if (started || over) return; started = true; clearTimeout(timer);
          // her take is about a second; a phone that never says "ended" is
          // let go after a generous cap
          timer = setTimeout(finish, 8000);
        }
        try { a = new Audio(url); a.volume = volume(); } catch (e) { done(); return; }
        off = onHalt(finish);
        a.onplaying = go; a.onended = finish;
        a.onerror = function () { if (!started) st.stuck = true; finish(); };
        // an element that has not started in TAKE_START_MS is skipped, and so
        // is the rest of this ask's media
        timer = setTimeout(function () { if (!started) { st.stuck = true; finish(); } }, TAKE_START_MS);
        try { var r = a.play(); if (r && r.then) r.then(go, function () { finish(); }); } catch (e) { finish(); }
      });
    }
    // The mic permission, where the browser will say: a phone that has said
    // no to the mic gets no ask at all (it would end the round straight after
    // telling a child to talk). Anything else, or no answer within 300 ms,
    // and Echo asks.
    function micRefused() {
      return new Promise(function (res) {
        var t = setTimeout(function () { res(false); }, 300);
        try {
          global.navigator.permissions.query({ name: "microphone" })
            .then(function (s) { clearTimeout(t); res(!!s && s.state === "denied"); }, function () { clearTimeout(t); res(false); });
        } catch (e) { clearTimeout(t); res(false); }
      });
    }
    function speak() {
      stop();
      var g = gen;
      // Voice off, or muted: the card is the card, and its mic opens at once.
      if (!voiceOn()) { page.listen(false); return; }
      speaking = true; page.note("Listen to Echo…");
      micRefused().then(function (no) {
        if (!live(g)) { if (g === gen) speaking = false; return; }
        // no mic: the page's own path (the request fails, the round ends kindly)
        if (no) { speaking = false; page.listen(false); return; }
        // A mic request that is still settling may own the iPhone's audio
        // session: Echo waits for it to land and close before the speaker
        // route starts, and for a chime still ringing.
        (function wait() {
          // hidden, or the card gone: this ask is over (the page asks again
          // when it is back on screen)
          if (!live(g)) { if (g === gen) speaking = false; return; }
          var ms = page.wait();
          if (ms > 0) { setTimeout(wait, Math.min(ms, 40)); return; }
          var st = { deadline: Date.now() + LINE_WAIT_MS, stuck: false };
          // a line that fails in any way is skipped: the card never waits on it
          function skip() {}
          sayLine(ASK, g, st).then(null, skip)
            .then(function () { return sayTake(g, st); }).then(null, skip)
            .then(function () { return sayLine(GO, g, st); }).then(null, skip)
            .then(function () {
              if (g !== gen) return;
              speaking = false; page.note("Get ready…"); page.listen(true);
            });
        })();
      });
    }
    // Speaking only for the card that is up: a flag left behind can never
    // hold a sound power's mic shut.
    return { speak: speak, stop: stop, speaking: function () { return speaking && page.up(); } };
  }

  global.SayIt = { voice: voice, chimeMs: chimeMs, ASK: ASK, GO: GO, VOICE_TAIL_MS: VOICE_TAIL_MS, LINE_WAIT_MS: LINE_WAIT_MS };
})(window);
