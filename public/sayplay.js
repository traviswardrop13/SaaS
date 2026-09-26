/* Say & Play: the engine behind the twenty say-it-to-play games
   (Travis, 26 Sep 2026: "10 more games for ages 3-4 and 10 more games for
   ages 5-8. keep them super simple and incorporating practice into it").

   One loop, every game: a picture of the child's practice word, Echo says
   the word, the mic opens, the child says it, and the game takes one step
   (the balloon grows, the car zooms, the robot gets an arm). No timer, no
   losing, nothing is scored, and the last step always ends on a win.

   Each game page (arcade-<key>.html, written by tools/gameart/build.mjs)
   carries its drawn scene and calls SayPlay.start(game) with its steps. This
   file owns everything else, once, so twenty games can't drift apart.

   What the mic is allowed to do, same hard lines as Feed Echo and the arcade
   keep-playing card:
   - It hears loudness and the sound's rough shape only (voiced vs hiss). It
     records nothing, uploads nothing and scores nothing. A spoken move is
     PLAY, never practice data: nothing here calls logAttempt, bumpReps,
     recordSession, recordRung, rotAdvance or awards a sticker. Whether a word
     said in a game should count toward the day's practice is Rachel's call;
     until she makes it, it doesn't.
   - Only a voice moves a game. Silence never does, and there is no tap that
     stands in for talking: a child who doesn't speak gets the word again,
     not a free step (that would teach that not talking works).
   - It is open only while it is the child's turn, never under Echo's voice
     or a chime. On an iPhone a page holding the mic runs as a phone call, so
     every sound waits for the mic to close and SETTLE_MS more, and the mic
     never opens until the page has been quiet (quietUntil).
   - It closes the moment the child is heard, on "Hear it", at the finish,
     and whenever the page is hidden. */
(function () {
  "use strict";
  var S = window.Sona;
  var G = null, $ = function (id) { return document.getElementById(id); };
  var profile = {};

  // ── timings ── (the same numbers Feed Echo and simple-play.js keep)
  var SETTLE_MS = 200, QUIET_MS = 900, VOICE_TAIL_MS = 250;
  var FLOOR_MS = 450, HEARD_MS = 3000, LISTEN_MS = 12000, STEP_MS = 1400, FINALE_MS = 2800;
  var quietUntil = 0, micClosedAt = -1e9, chimesDue = 0, chimeEnd = 0;
  var SFX_MS = { tap: 120, correct: 400, complete: 700 };

  // ── state ──
  var phase = "boot", paused = false, step = 0, turnLive = false, heardThisTurn = false, listening = false;
  var SOUND = "R", WORDS = [], word = null, used = [], parts = {}, stageHTML = "";

  function setPhase(p) { phase = p; document.body.setAttribute("data-phase", paused ? "paused" : p); publish(); }
  // What tests read (the page's internals stay inside this closure otherwise).
  function publish() {
    try { window.__sayplay = { phase: phase, step: step, steps: G ? G.steps.length : 0, sound: SOUND, word: word && word.w, paused: paused, listening: listening }; } catch (e) {}
  }

  // ── audio: Echo's voice (cached on this phone), chimes, and their order ──
  var audioCtx = null, speaking = false, ttsPlaying = false, audioGeneration = 0, audioPaused = !!document.hidden, audioStop = null, audioSuspend = Promise.resolve();
  function audioAllowed(generation) { return !document.hidden && !audioPaused && generation === audioGeneration; }
  function stopAudio() {
    audioGeneration++; audioPaused = true;
    var stop = audioStop; audioStop = null; if (stop) stop();
    speaking = false; ttsPlaying = false;
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    try { if (S && S.sfx && S.sfx.stop) S.sfx.stop(); } catch (e) {}
    try { if (audioCtx && audioCtx.suspend) audioSuspend = Promise.resolve(audioCtx.suspend()).catch(function () {}); } catch (e) {}
  }
  function getCtx() {
    if (document.hidden || audioPaused) throw new Error("Say & Play audio is paused");
    if (!audioCtx) { var AC = window.AudioContext || window.webkitAudioContext; audioCtx = new AC(); }
    if (audioCtx.state === "suspended") { var generation = audioGeneration; audioSuspend.then(function () { if (audioAllowed(generation) && audioCtx.state === "suspended") return audioCtx.resume(); }).catch(function () {}); }
    return audioCtx;
  }
  // iOS unlock: every game starts on a tap (the Play button), and any tap
  // unlocks the context, so Echo is heard from the first word.
  function unlockOnTap() {
    function un() { if (document.hidden || paused) return; audioPaused = false; try { var c = getCtx(); var b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {} }
    document.addEventListener("pointerdown", un, { passive: true, capture: true });
  }
  function ttsDB() { return new Promise(function (res, rej) { try { var r = indexedDB.open("sona-tts", 1); r.onupgradeneeded = function () { r.result.createObjectStore("clips"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; } catch (e) { rej(e); } }); }
  function ttsGet(k) { return ttsDB().then(function (db) { return new Promise(function (res) { var tx = db.transaction("clips"); var rq = tx.objectStore("clips").get(k); rq.onsuccess = function () { res(rq.result || null); }; rq.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function ttsPut(k, buf) { ttsDB().then(function (db) { try { db.transaction("clips", "readwrite").objectStore("clips").put(buf, k); } catch (e) {} }).catch(function () {}); }
  function volume() { var n = profile.volume == null ? 0.8 : Number(profile.volume); return isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.8; }
  function playPCM(b, generation) {
    return new Promise(function (res) {
      if (!audioAllowed(generation)) return res();
      var done = false, source = null, timer = null; ttsPlaying = true;
      function fin() { if (done) return; done = true; clearTimeout(timer); if (audioStop === cancel) audioStop = null; if (generation === audioGeneration) ttsPlaying = false; res(); }
      function cancel() { try { if (source) source.stop(); } catch (e) {} fin(); }
      audioStop = cancel;
      try {
        var c = getCtx(), n = b.byteLength >> 1, ab = c.createBuffer(1, n, 24000), ch = ab.getChannelData(0), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
        for (var i = 0; i < n; i++) ch[i] = dv.getInt16(i * 2, true) / 32768;
        source = c.createBufferSource(); source.buffer = ab; var g = c.createGain(); g.gain.value = volume();
        source.connect(g); g.connect(c.destination); source.onended = fin; source.start();
        // A context the phone never let start would hold this turn forever
        // (onended never fires), so the word's own length plus a beat ends it.
        timer = setTimeout(fin, n / 24 + 1500);
      } catch (e) { fin(); }
    });
  }
  function speakFallback(t, generation) {
    return new Promise(function (res) {
      if (!audioAllowed(generation) || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return res();
      var done = false, timer = null;
      function fin() { if (done) return; done = true; clearTimeout(timer); if (audioStop === cancel) audioStop = null; if (generation === audioGeneration) ttsPlaying = false; res(); }
      function cancel() { try { window.speechSynthesis.cancel(); } catch (e) {} fin(); }
      audioStop = cancel;
      try {
        var u = new SpeechSynthesisUtterance(t); u.rate = 0.95; u.pitch = 1.05; u.volume = volume();
        u.onend = fin; u.onerror = fin; timer = setTimeout(fin, 9000); ttsPlaying = true; window.speechSynthesis.speak(u);
      } catch (e) { fin(); }
    });
  }
  function fetchVoice(t) {
    var ctl = window.AbortController ? new AbortController() : null, to = ctl ? setTimeout(function () { ctl.abort(); }, 8000) : 0;
    return fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t, voice: profile.voiceId || "", stable: true }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(to); return r.ok ? r.arrayBuffer() : null; }, function () { clearTimeout(to); return null; });
  }
  function settleLeft() { return Math.max(0, micClosedAt + SETTLE_MS - performance.now()); }
  // Nothing starts while the phone is still answering a mic request (an
  // iPhone is recording before getUserMedia returns), inside SETTLE_MS of a
  // close, or before a chime that was waiting on the same mic has had its turn.
  function micQuiet() {
    return new Promise(function (done) {
      (function check() {
        if (micAsking || chimesDue > 0) { setTimeout(check, 60); return; }
        var wait = Math.max(settleLeft(), chimeEnd - performance.now());
        if (wait > 0) { setTimeout(check, wait); return; }
        done();
      })();
    });
  }
  function quietLeft() { return quietUntil - performance.now(); }
  function say(t) {
    var generation = audioGeneration;
    if (!t || !audioAllowed(generation) || profile.voiceOn === false || volume() === 0 || speaking) return Promise.resolve();
    speaking = true;
    var key = (profile.voiceId || "echo") + "|" + ((S && S.TTS_CACHE_VERSION) || "v8") + "|" + t;
    return micQuiet().then(function () { return ttsGet(key); }).then(function (cached) {
      if (!audioAllowed(generation)) return true;
      if (cached) return playPCM(new Uint8Array(cached), generation).then(function () { return true; });
      return fetchVoice(t).then(function (b) { if (!audioAllowed(generation)) return true; if (!b) return false; ttsPut(key, b); return playPCM(new Uint8Array(b), generation).then(function () { return true; }); });
    }).then(function (played) { if (!played && audioAllowed(generation)) return speakFallback(t, generation); })
      .catch(function () { if (audioAllowed(generation)) return speakFallback(t, generation); })
      .then(function () { if (generation === audioGeneration) speaking = false; quietUntil = Math.max(quietUntil, performance.now() + VOICE_TAIL_MS); });
  }
  // A chime never plays over an open mic. One asked for while the phone is
  // still answering a mic request, or inside SETTLE_MS of a close, waits.
  function sfx(n, then, due) {
    if (document.hidden || audioPaused || micStream) { if (due) chimesDue--; return; }
    var wait = micClosedAt + SETTLE_MS - performance.now();
    if (micAsking || wait > 0) {
      if (!due) chimesDue++;
      if (!micAsking) quietUntil = Math.max(quietUntil, performance.now() + wait + QUIET_MS);
      setTimeout(function () { sfx(n, then, true); }, micAsking ? 60 : wait); return;
    }
    if (due) chimesDue--;
    quietUntil = Math.max(quietUntil, performance.now() + QUIET_MS);
    chimeEnd = Math.max(chimeEnd, performance.now() + (SFX_MS[n] || 400));
    try { if (profile.soundOn !== false && S && S.sfx && S.sfx[n]) S.sfx[n](); } catch (e) {}
    if (then) then();
  }

  // ── the mic: one short listening window per turn ──
  var micStream = null, micAsking = false, micGen = 0, micSrc = null, micRaf = 0, micT = 0, listenT = 0, roomFloor = -1;
  function p20(list) { var a = list.slice().sort(function (x, y) { return x - y; }); return a[Math.floor((a.length - 1) * 0.2)]; }
  function micStop() {
    micGen++; clearTimeout(micT); clearTimeout(listenT); if (micRaf) cancelAnimationFrame(micRaf); micRaf = 0;
    try { if (micSrc) micSrc.disconnect(); } catch (e) {} micSrc = null;
    if (micStream) { try { micStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} micStream = null; micClosedAt = performance.now(); }
    showTurn(false);
  }
  function listenable() { return turnLive && !heardThisTurn && !speaking && !ttsPlaying && !document.hidden && !audioPaused && !paused; }
  // A voiced burst must also SOUND like the practice sound's family (voiced vs
  // hiss): a clap or a squeal can't move an R child's game. Shape numbers only.
  function famOK(shp) {
    if (!shp || !shp.m) return true;
    var cent = shp.fm / shp.m, high = shp.hm / shp.m, fam = (S && S.soundFamily) ? S.soundFamily(SOUND) : "any";
    if (fam === "low") return !(cent > 1800 && high > 0.22);
    if (fam === "hiss") return !(cent < 1100 && high < 0.10);
    return true;
  }
  function micOpen() {
    if (!listenable() || micStream || micAsking) return;
    var wait = Math.max(quietLeft(), settleLeft());
    if (wait > 0) { clearTimeout(micT); micT = setTimeout(micOpen, wait); return; }
    var gen = ++micGen; micAsking = true;
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (stream) {
      micAsking = false;
      if (gen !== micGen || !listenable()) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} micClosedAt = performance.now(); if (listenable()) micOpen(); return; }
      micStream = stream;
      try { localStorage.setItem("sona.micok", "1"); } catch (e) {}
      var an, td, fd, binHz;
      try {
        var ctx = getCtx(); micSrc = ctx.createMediaStreamSource(stream); an = ctx.createAnalyser(); an.fftSize = 512; micSrc.connect(an);
        td = new Uint8Array(an.fftSize); fd = new Uint8Array(an.frequencyBinCount); binHz = ctx.sampleRate / an.fftSize;
      } catch (e) { micStop(); nudge(); return; }
      var heard = [], ready = false;
      clearTimeout(listenT);
      listenT = setTimeout(function () { if (gen === micGen) { micStop(); nudge(); } }, LISTEN_MS);
      (function tick() {
        if (gen !== micGen) return;
        var now = performance.now();
        // belt and braces: nothing plays while the mic is open, and if
        // anything did, its frames are dropped, never judged
        if (speaking || ttsPlaying || now < quietUntil) { heard = []; micRaf = requestAnimationFrame(tick); return; }
        an.getByteTimeDomainData(td);
        var sum = 0; for (var i = 0; i < td.length; i++) { var d = (td[i] - 128) / 128; sum += d * d; }
        var shape = null; if (S && S.frameShape) { an.getByteFrequencyData(fd); shape = S.frameShape(fd, binHz); }
        heard.push({ t: now, r: Math.sqrt(sum / td.length), s: shape });
        while (now - heard[0].t > HEARD_MS) heard.shift();
        // the room's quiet level belongs to the page and only goes down, so
        // a child who answers the instant the mic opens isn't taken for noise
        if (now - heard[0].t >= FLOOR_MS) {
          var w = []; for (var k = heard.length - 1; k >= 0 && now - heard[k].t <= FLOOR_MS; k--) w.push(heard[k].r);
          var q = p20(w); if (roomFloor < 0 || q < roomFloor) roomFloor = q;
        }
        if (roomFloor >= 0) {
          if (!ready) { ready = true; showTurn(true); }
          var thr = Math.max(0.04, roomFloor * 3), voiced = 0, shp = null;
          for (var j = 0; j < heard.length; j++) {
            var f = heard[j];
            if (f.r > thr) {
              voiced++;
              if (f.s) { if (!shp) shp = { m: 0, fm: 0, hm: 0 }; shp.m += f.s.m; shp.fm += f.s.fm; shp.hm += f.s.hm; }
              if (voiced >= 5) { if (!famOK(shp)) { voiced = 0; shp = null; } else { gotIt(); return; } }
            } else { voiced = 0; shp = null; }
          }
        }
        micRaf = requestAnimationFrame(tick);
      })();
    }).catch(function (e) {
      micAsking = false;
      micClosedAt = Math.max(micClosedAt, performance.now());
      if (e && e.name === "NotAllowedError") { turnLive = false; showTurn(false); denied(); return; }
      nudge();
    });
  }
  function denied() { setPhase("denied"); if (S && S.micDenied) S.micDenied({ back: "/today.html" }); }
  // "Your turn" means the mic can hear right now, and nothing else.
  function showTurn(on) {
    listening = !!on; publish();
    try {
      document.body.setAttribute("data-listen", on ? "on" : "off");
      $("micState").textContent = on ? "Your turn!" : (turnLive ? "Listen" : "");
      $("echoFace").src = on ? "/coach/echo/echo-listening.svg" : "/coach/echo/echo-idle.svg";
    } catch (e) {}
  }
  // No voice in the listening window: the mic closes and waits for a tap to
  // listen again. The tap only reopens the mic; it never moves the game.
  function nudge() {
    if (!turnLive) return;
    try { $("micState").textContent = "Tap the mic, then say it"; $("micBtn").hidden = false; } catch (e) {}
    setPhase("nudge");
  }

  // ── the first time: a grown-up says yes to the mic ──
  // The OS prompt rides directly on the grown-up's tap, and "Not now" never
  // burns it (a denied OS dialog is near-unrecoverable): the game explains and
  // goes home, and asks again next time, the same as practice does.
  function micReady() {
    return new Promise(function (done) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { noMic(); return; }
      try { if (localStorage.getItem("sona.micok") === "1") return done(); } catch (e) {}
      var q = (navigator.permissions && navigator.permissions.query) ? navigator.permissions.query({ name: "microphone" }).catch(function () { return null; }) : Promise.resolve(null);
      q.then(function (st) {
        if (st && st.state === "granted") { try { localStorage.setItem("sona.micok", "1"); } catch (e) {} return done(); }
        try { $("micPromise").textContent = (S && S.MIC_PROMISE) || ""; } catch (e) {}
        $("primer").classList.add("show"); setPhase("primer");
        $("primerYes").onclick = function () {
          if (paused || document.hidden) return;
          $("primer").classList.remove("show");
          micAsking = true;
          navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (stream) {
            micAsking = false;
            try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
            micClosedAt = performance.now();
            try { localStorage.setItem("sona.micok", "1"); } catch (e) {}
            done();
          }).catch(function (e) {
            micAsking = false; micClosedAt = Math.max(micClosedAt, performance.now());
            if (e && e.name === "NotAllowedError") { denied(); return; }
            done(); // no mic right now: the turn will offer "Tap the mic"
          });
        };
        $("primerNo").onclick = function () { if (paused || document.hidden) return; notNow(); };
      });
    });
  }
  function byeCard(title, text) {
    var card = $("primer").querySelector(".ovlCard");
    card.innerHTML = '<img class="ovlEcho" src="/coach/echo/echo-idle.svg" alt="" />'
      + "<h2></h2><p></p>"
      + '<p class="small">Grown-ups: you can turn the microphone on whenever you like, from this screen or your phone’s Settings.</p>'
      + '<button class="btn" id="byeBtn">Okay</button>';
    card.querySelector("h2").textContent = title;
    card.querySelector("p").textContent = text;
    card.querySelector("#byeBtn").onclick = home;
    $("primer").classList.add("show"); setPhase("bye");
  }
  function notNow() { byeCard("That’s okay!", "Echo needs to hear you to play this game. We’ll ask again next time you’re ready."); }
  function noMic() { byeCard("Echo can’t hear here", "This game needs a microphone, and this browser doesn’t have one Echo can use."); }

  // ── the scene: parts the steps move, grow, show and hide ──
  // a part may start small or turned (data-s, data-r); steps move it from there
  function part(id) {
    if (parts[id]) return parts[id];
    var el = $("p-" + id), s = el ? parseFloat(el.getAttribute("data-s")) : NaN, r = el ? parseFloat(el.getAttribute("data-r")) : NaN;
    return (parts[id] = { el: el, x: 0, y: 0, s: isFinite(s) ? s : 1, r: isFinite(r) ? r : 0 });
  }
  function place(p) { var m = p.el && p.el.querySelector(".pm"); if (m) m.style.transform = "translate(" + p.x + "px," + p.y + "px) rotate(" + p.r + "deg) scale(" + p.s + ")"; }
  function fx(p, name) {
    var a = p.el && p.el.querySelector(".pa"); if (!a) return;
    a.setAttribute("class", "pa"); void a.getBoundingClientRect(); a.setAttribute("class", "pa fx-" + name);
  }
  function act(a) {
    var p = part(a.id); if (!p.el) return;
    if (a.a === "show") { p.el.classList.remove("hid"); p.el.classList.remove("gone"); fx(p, a.fx || "pop"); }
    else if (a.a === "hide") { p.el.classList.add("gone"); }
    else if (a.a === "move") { p.x = a.x; p.y = a.y; if (a.s != null) p.s = a.s; if (a.r != null) p.r = a.r; place(p); }
    else if (a.a === "by") { p.x += a.x || 0; p.y += a.y || 0; place(p); }
    else if (a.a === "scale") { p.s = a.s; place(p); }
    else if (a.a === "turn") { p.r = a.r; place(p); }
    else if (a.a === "fx") { fx(p, a.fx); }
  }
  var runTimers = [];
  function run(list) {
    (list || []).forEach(function (a) {
      if (a.at) runTimers.push(setTimeout(function () { act(a); }, a.at)); else act(a);
    });
  }
  function resetStage() {
    runTimers.forEach(clearTimeout); runTimers = [];
    $("stage").innerHTML = stageHTML; parts = {};
  }

  // ── words: the child's rotation sound, short picture words first ──
  function pool(sound) {
    var ws = (S && S.wordsFor) ? (S.wordsFor(sound, "i") || []) : [];
    return ws.filter(function (w) { return w && w.w && w.e; }).sort(function (a, b) { return a.w.length - b.w.length; }).slice(0, 10);
  }
  function pickWord() {
    var i, tries = 0;
    do { i = (Math.random() * WORDS.length) | 0; tries++; } while (WORDS.length > 1 && (used.indexOf(i) >= 0 || (word && WORDS[i] === word)) && tries < 40);
    used.push(i); if (used.length >= WORDS.length) used = [];
    return WORDS[i];
  }
  function paintDots() {
    var h = ""; for (var i = 0; i < G.steps.length; i++) h += '<i class="' + (i < step ? "on" : "") + '"></i>';
    try { $("dots").innerHTML = h; $("dots").setAttribute("aria-label", step + " of " + G.steps.length); } catch (e) {}
  }

  // ── a turn: show the word, Echo says it, the child says it, the game moves ──
  function nextTurn(same) {
    micStop(); heardThisTurn = false; clearTimeout(nextTurn._t);
    if (!same || !word) word = pickWord();
    try {
      $("pic").innerHTML = (S && S.pic) ? S.pic(word.w, word.e, 64) : word.e;
      $("word").textContent = word.w;
      $("micBtn").hidden = true;
      $("cheer").textContent = "";
      $("turnPanel").classList.remove("yay");
    } catch (e) {}
    turnLive = true; setPhase("turn"); showTurn(false);
    // Echo models the word, alone and calm, then the mic opens for the child
    say("Say... " + word.w + ".").then(function () {
      if (!turnLive) return;
      quietUntil = Math.max(quietUntil, performance.now() + VOICE_TAIL_MS);
      micOpen();
    });
  }
  var CHEERS = ["Yes!", "You did it!", "Great talking!", "Wow!", "Nice!", "Super!"];
  function gotIt() {
    if (!turnLive) return;
    heardThisTurn = true; turnLive = false; micStop();
    step++; paintDots();
    try {
      $("cheer").textContent = CHEERS[step % CHEERS.length]; $("micBtn").hidden = true; $("micState").textContent = "";
      $("turnPanel").classList.add("yay");
    } catch (e) {}
    run(G.steps[step - 1]);
    sfx("correct");
    setPhase("step");
    if (step >= G.steps.length) nextTurn._t = setTimeout(finish, STEP_MS);
    else nextTurn._t = setTimeout(function () { if (!paused) nextTurn(); }, STEP_MS);
  }
  function finish() {
    micStop(); turnLive = false; setPhase("finale");
    try { $("turnPanel").classList.add("done"); } catch (e) {}
    run(G.finale);
    sfx("complete", function () { try { if (S && S.confetti) S.confetti({ count: 120, duration: 2000 }); } catch (e) {} });
    clearTimeout(finish._t);
    finish._t = setTimeout(showEnd, FINALE_MS);
  }
  function showEnd() {
    if (paused) return;
    try { $("endTitle").textContent = G.done.title; $("endSub").textContent = G.done.sub; } catch (e) {}
    $("endOvl").classList.add("show"); setPhase("end");
  }
  function again() {
    $("endOvl").classList.remove("show");
    try { $("turnPanel").classList.remove("done"); } catch (e) {}
    resetStage(); step = 0; paintDots(); used = [];
    sfx("tap"); nextTurn();
  }
  function home() { stopAudio(); micStop(); location.href = "/today.html"; }

  // ── pause: a hidden page stops everything; coming back needs one tap ──
  function pause() {
    stopAudio(); micStop();
    if (phase !== "turn" && phase !== "nudge" && phase !== "step" && phase !== "finale") return;
    paused = true; turnLive = false; clearTimeout(nextTurn._t); clearTimeout(finish._t);
    $("pauseOvl").classList.add("show"); setPhase(phase);
  }
  function resume() {
    if (!paused) return;
    paused = false; audioPaused = false; $("pauseOvl").classList.remove("show");
    if (step >= G.steps.length) { showEnd(); return; }
    // paused mid-turn: the same word again; paused after a step: the next one
    nextTurn(phase !== "step");
  }

  function begin() {
    if (phase !== "ready") return;
    $("startOvl").classList.remove("show"); setPhase("starting");
    micReady().then(function () { if (!paused) nextTurn(); });
  }
  function start(game) {
    G = game;
    if (!S) return;
    // Catalog access is checked before any mic or audio work starts.
    if (!S.gameAccess(G.key).allowed) { document.body.hidden = true; S.gameBounce(G.key); return; }
    profile = S.getProfile ? S.getProfile() : {};
    SOUND = String((S.rotSound && S.rotSound()) || "R").toUpperCase();
    WORDS = pool(SOUND); if (!WORDS.length) { SOUND = "R"; WORDS = pool("R"); }
    // the grown-up reads the practice sound on the start card; the bar keeps
    // the game's name, which is all that fits beside eight dots on a phone
    try { $("startSound").textContent = "Today’s sound: " + ((S.soundLabel) ? S.soundLabel(SOUND) : SOUND); } catch (e) {}
    stageHTML = $("stage").innerHTML;
    paintDots(); unlockOnTap();
    $("close").onclick = home; $("goHome").onclick = home; $("again").onclick = again; $("startBtn").onclick = begin;
    $("hear").onclick = function () { if (!turnLive || paused) return; nextTurn(true); };
    $("micBtn").onclick = function () {
      if (!turnLive || paused) return;
      $("micBtn").hidden = true; audioPaused = false; setPhase("turn"); showTurn(false); micOpen();
    };
    $("resume").onclick = resume;
    S.onBackground(pause);
    $("startOvl").classList.add("show"); setPhase("ready");
  }
  window.SayPlay = { start: start };
})();
