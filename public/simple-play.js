/* Bubble Pop and Peekaboo share one untimed, five-discovery round.
   Taps reveal pictures; only the optional, already-authorized mic can hear a
   turn. No recording, transcript, accuracy score or tap-based practice credit.

   The mic and the game's own sound never overlap (24 Sep 2026). On an iPhone
   a page holding the mic runs as a phone call: the volume buttons change CALL
   volume and Echo's word and the chimes are processed like a call. The mic
   used to open at Start and stay open under every word and chime. It now
   opens only on a revealed picture, after Echo has finished the word (or
   after the reveal chime's quiet window when the voice is off), and closes
   on Next, on "Hear it", once the child has been heard, at the finish and on
   pause. A chime never plays over an open mic, waits SETTLE_MS after it
   closes, and pushes quietUntil out so its tail can't be heard as the child.
   Neither a chime nor Echo's word starts while a mic request is still being
   answered: an iPhone is already recording by then (see settle()). */
(function () {
  "use strict";
  var S = window.Sona;
  if (!S) return;
  var kind = document.body.getAttribute("data-simple-game"), NEED = 5;
  var dailyEntry = new URLSearchParams(location.search).get("daily") === "1";
  if (!S.gameAccess(kind, { run: dailyEntry }).allowed) { document.body.hidden = true; S.gameBounce(kind); return; }
  function $(id) { return document.getElementById(id); }
  var phase = "intro", paused = false, closed = false, finished = false;
  var found = 0, heard = 0, heardThisTurn = false, target = null, targets = [], used = [], sound = "";
  var selectedDoor = null, focusBeforePause = null, profile = S.getProfile ? S.getProfile() : {};
  var ctx = null, contextSettled = Promise.resolve(), stream = null, source = null, raf = null, micGeneration = 0;
  var voiced = 0, quietUntil = 0, speaking = false, audioGeneration = 0, audioJob = null;
  var SETTLE_MS = 200, VOICE_TAIL_MS = 250, micClosedAt = -1e9, micPending = 0;
  // What counts as "heard" (24 Sep 2026): the bar is 3× the room's quiet
  // level, and that level belongs to the page, not the turn. roomFloor is the
  // 20th-percentile loudness of the quietest FLOOR_MS the mic has heard on
  // this page, and it only ever goes DOWN. The first cut of this change
  // averaged the first 250 ms of every turn instead, which is exactly when a
  // child answers Echo's word ("Your turn. Say it together."): their own
  // voice became the "room", the bar landed above it, and the child who
  // answered fastest never heard "Echo heard you!". A low percentile ignores
  // a voice that fills most of the stretch; only-down means nothing a child
  // says raises it; and the last HEARD_MS of frames are judged against the
  // CURRENT floor, so an answer given before the first quiet breath still
  // counts once that breath comes.
  var FLOOR_MS = 250, HEARD_MS = 3000, roomFloor = -1;
  function p20(list) { var a = list.slice().sort(function (x, y) { return x - y; }); return a[Math.floor((a.length - 1) * 0.2)]; }
  var doors = Array.prototype.slice.call(document.querySelectorAll("[data-door]"));
  function active() { return !closed && !paused && !document.hidden && (phase === "choose" || phase === "reveal"); }
  function volume() { var n = profile.volume == null ? 0.8 : Number(profile.volume); return isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.8; }
  function stopTracks(value) { try { if (value) value.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
  function focus(el) { if (el) try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  function setHidden(id, value) { var el = $(id); if (el) el.hidden = value; }
  function render() {
    document.body.setAttribute("data-phase", paused ? "paused" : phase);
    setHidden("startPanel", phase !== "intro" || paused);
    setHidden("playPanel", (phase !== "choose" && phase !== "reveal") || paused);
    setHidden("pausePanel", !paused);
    setHidden("finishPanel", phase !== "finish" || paused);
    setHidden("hearWord", phase !== "reveal");
    setHidden("nextTurn", phase !== "reveal");
    setHidden("pauseGame", !active());
    if ($("pauseGame")) $("pauseGame").disabled = !active();
    if ($("revealButton")) $("revealButton").disabled = phase !== "choose" || paused;
    doors.forEach(function (door) { door.disabled = phase !== "choose" || paused; door.classList.toggle("open", door === selectedDoor); });
    if ($("playStage")) $("playStage").classList.toggle("revealed", phase === "reveal");
    $("progressText").textContent = found + " of " + NEED + " discoveries";
    Array.prototype.forEach.call($("progressDots").children, function (dot, i) {
      dot.classList.toggle("done", i < found);
      dot.classList.toggle("current", i === found && (phase === "choose" || phase === "reveal"));
      dot.setAttribute("aria-hidden", "true");
    });
    $("heardMessage").textContent = heardThisTurn ? "Echo heard you!" : "";
  }
  function prepareTargets() {
    sound = S.rotSound ? S.rotSound() : "";
    targets = (S.wordsFor && sound ? S.wordsFor(sound, "i") || [] : []).filter(function (w) { return w && w.w && w.e; })
      .sort(function (a, b) { return a.w.length - b.w.length; }).slice(0, 8);
    return targets.length > 0;
  }
  function chooseTurn() {
    stopAudio(); voiced = 0; heardThisTurn = false; selectedDoor = null;
    if (used.length >= targets.length) used = [];
    var choices = targets.filter(function (_, i) { return used.indexOf(i) === -1; });
    target = choices[(Math.random() * choices.length) | 0]; used.push(targets.indexOf(target));
    phase = "choose";
    $("wordLabel").textContent = target.w;
    if (S.pic) $("wordPicture").innerHTML = S.pic(target.w, target.e, 144);
    else $("wordPicture").textContent = target.e;
    $("promptTitle").textContent = kind === "bubbles" ? "Pop a bubble" : "Pick a door";
    $("promptHint").textContent = kind === "bubbles" ? "Tap the bubble to find out." : "Choose any door to find out.";
    render();
  }
  function start() {
    if (closed || paused || document.hidden || (phase !== "intro" && phase !== "finish")) return;
    // Expiration waits for the current discoveries to finish, then applies to
    // a new round. A still-unplayed earned adventure turn keeps its handoff.
    if (!S.gameAccess(kind, { run: dailyEntry && phase === "intro" }).allowed) { closed = true; stopResources(); S.gameBounce(kind); return; }
    profile = S.getProfile ? S.getProfile() : profile;
    if (!prepareTargets()) {
      phase = "intro"; render(); $("startGame").disabled = true;
      var note = document.createElement("p"); note.textContent = "There aren't any pictures ready for this sound yet. You can choose another game in the library.";
      note.setAttribute("role", "status"); $("startPanel").appendChild(note); return;
    }
    // The first deliberate Start begins the same existing demo window as practice.
    if (S.demoStart) S.demoStart();
    found = 0; heard = 0; finished = false; used = [];
    chooseTurn(); unlockContext(); // no mic yet: it opens for a revealed word, never while choosing
    focus(kind === "bubbles" ? $("revealButton") : doors[0]);
  }
  function reveal(door) {
    if (!active() || phase !== "choose") return;
    selectedDoor = door || null; phase = "reveal"; voiced = 0;
    $("promptTitle").textContent = target.w;
    $("promptHint").textContent = "Say it together. Take your time.";
    render(); effect("tap"); sayWord(); focus($("hearWord"));
  }
  function next() {
    if (!active() || phase !== "reveal") return;
    stopAudio(); stopMic(); voiced = 0; found++;
    if (found >= NEED) finish();
    else { chooseTurn(); focus(kind === "bubbles" ? $("revealButton") : doors[0]); }
  }
  function finish() {
    if (finished) return;
    finished = true; phase = "finish"; stopResources();
    // Optional loudness feedback is free play, never measured practice.
    var daily = S.simpleAdventure && S.simpleAdventure(kind, true);
    $("finishTitle").textContent = "Five discoveries!";
    $("finishCopy").textContent = "You found all five pictures. That was fun!";
    $("playAgain").textContent = daily ? "Keep going →" : "Play again ↻";
    render(); effect("complete", true); focus($("playAgain"));
  }
  function pause() {
    if (closed || paused) return;
    if (phase !== "choose" && phase !== "reveal") { stopResources(); return; }
    focusBeforePause = document.activeElement; paused = true; stopResources(); render(); focus($("resumeGame"));
  }
  function resume() {
    if (!paused || closed || document.hidden) return;
    paused = false; profile = S.getProfile ? S.getProfile() : profile;
    if (phase === "reveal") $("promptHint").textContent = "Say it together. Take your time.";
    render(); unlockContext(); openMic();
    focus(focusBeforePause && focusBeforePause.isConnected ? focusBeforePause : $("pauseGame"));
  }
  function stopMic() {
    micGeneration++; if (raf != null) cancelAnimationFrame(raf); raf = null;
    try { if (source) source.disconnect(); } catch (e) {} source = null;
    if (stream) micClosedAt = performance.now();
    stopTracks(stream); stream = null; voiced = 0;
  }
  // Somebody's turn to be heard: a revealed picture, nothing playing, not yet heard.
  function listenable() { return active() && phase === "reveal" && !heardThisTurn && !speaking; }
  function stopResources() {
    stopMic(); stopAudio();
    try { if (S.sfx && S.sfx.stop) S.sfx.stop(); } catch (e) {}
    try { if (ctx) contextSettled = Promise.resolve(ctx.suspend()).catch(function () {}); } catch (e) {}
  }
  function unlockContext() {
    if (closed || paused || document.hidden) return;
    try {
      if (!ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); }
      // A stopped context must not resume later behind a second interruption.
      var generation = micGeneration;
      contextSettled = contextSettled.then(function () {
        if (!closed && !paused && !document.hidden && generation === micGeneration && ctx.state === "suspended") return ctx.resume();
      }).catch(function () {});
    } catch (e) {}
  }
  function openMic() {
    var allowed = false;
    try { allowed = localStorage.getItem("sona.micok") === "1"; } catch (e) {}
    // A remembered grant can be stale. If its current state cannot be checked,
    // skip this optional cheer instead of creating an unexpected OS prompt.
    if (!allowed || !navigator.permissions || !navigator.permissions.query || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    if (!listenable() || stream) return;
    var wait = quietUntil - performance.now();
    if (wait > 0) { var waited = micGeneration; setTimeout(function () { if (waited === micGeneration) openMic(); }, wait); return; }
    var generation = ++micGeneration, inFlight = true, asked = false; micPending++;
    // The request leaves micPending exactly once, whichever handler below
    // sees it end first (24 Sep 2026). It used to be counted down in the
    // success handler AND again in the catch when wiring the mic threw after
    // it, leaving -1, which effect() reads as "a request is in flight": every
    // later chime waited for it forever and the game went silent.
    function requestDone() { if (inFlight) { inFlight = false; micPending--; } }
    Promise.resolve().then(function () { return navigator.permissions.query({ name: "microphone" }); }).then(function (permission) {
      if (!permission || permission.state !== "granted" || generation !== micGeneration || !listenable()) return null;
      asked = true;
      return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }).then(function (value) {
      requestDone();
      if (!value) return;
      if (generation !== micGeneration || !listenable()) { stopTracks(value); micClosedAt = performance.now(); return; }
      stream = value; unlockContext();
      return contextSettled.then(function () {
        if (generation !== micGeneration || !active()) { stopTracks(value); return; }
        if (!ctx || ctx.state !== "running") { stopTracks(value); if (stream === value) { stream = null; micClosedAt = performance.now(); } return; }
        var localSource = ctx.createMediaStreamSource(value), analyser = ctx.createAnalyser();
        source = localSource; analyser.fftSize = 512; localSource.connect(analyser);
        var data = new Uint8Array(analyser.fftSize), frames = [];
        function tick() {
          if (generation !== micGeneration || !active()) return;
          var now = performance.now();
          // belt and braces: nothing plays while this mic is open, and if
          // anything did, its frames would never be judged or join a burst
          if (speaking || now < quietUntil) { frames = []; voiced = 0; raf = requestAnimationFrame(tick); return; }
          analyser.getByteTimeDomainData(data);
          var total = 0; for (var i = 0; i < data.length; i++) { var d = (data[i] - 128) / 128; total += d * d; }
          frames.push({ t: now, r: Math.sqrt(total / data.length) });
          while (now - frames[0].t > HEARD_MS) frames.shift();
          if (now - frames[0].t >= FLOOR_MS) {
            var w = []; for (var k = frames.length - 1; k >= 0 && now - frames[k].t <= FLOOR_MS; k--) w.push(frames[k].r);
            var q = p20(w); if (roomFloor < 0 || q < roomFloor) roomFloor = q;
          }
          if (roomFloor < 0 || phase !== "reveal") { voiced = 0; raf = requestAnimationFrame(tick); return; }
          var threshold = Math.max(0.035, roomFloor * 3.0); voiced = 0;
          for (var j = 0; j < frames.length && voiced < 4; j++) voiced = frames[j].r > threshold ? voiced + 1 : 0;
          // heard once is the whole turn: close the mic, THEN the little chime
          if (voiced >= 4 && !heardThisTurn) { heardThisTurn = true; heard++; $("heardMessage").textContent = "Echo heard you!"; stopMic(); effect("tap"); return; }
          raf = requestAnimationFrame(tick);
        }
        raf = requestAnimationFrame(tick);
      });
      // a request that fails after it reached the phone may already have
      // switched it into call audio: the next sound settles after it too
    }).catch(function () { requestDone(); if (asked) micClosedAt = Math.max(micClosedAt, performance.now()); if (generation === micGeneration) { stopMic(); } });
  }
  function effect(name, final) {
    if (stream) return;   // never over an open mic (nothing asks to: every caller closes it first)
    // a mic request still in flight settles first; then the phone gets
    // SETTLE_MS to switch back before the chime
    if (micPending) { setTimeout(function () { effect(name, final); }, 60); return; }
    var wait = micClosedAt + SETTLE_MS - performance.now();
    if (wait > 0) { quietUntil = Math.max(quietUntil, performance.now() + wait + 700); setTimeout(function () { effect(name, final); }, wait); return; }
    if (closed || paused || document.hidden || (!active() && !final) || profile.soundOn === false || volume() === 0) return;
    quietUntil = Math.max(quietUntil, performance.now() + 700); voiced = 0;
    try { if (S.sfx && S.sfx[name]) S.sfx[name](); } catch (e) {}
  }

  // A word can be superseded by Next, replay, pause or navigation. Cancellation
  // settles all pending work; late cache/network/voice callbacks never play.
  function stopAudio() {
    var wasSpeaking = speaking;
    audioGeneration++; if (audioJob) audioJob.cancel(); audioJob = null; speaking = false; voiced = 0;
    if (wasSpeaking) quietUntil = Math.max(quietUntil, performance.now() + 200);
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
  }
  function operation(job, begin) {
    return new Promise(function (resolve) {
      var ended = false, cleanups = [];
      function cleanup(fn) { if (ended) { try { fn(); } catch (e) {} } else cleanups.push(fn); }
      function done(value) {
        if (ended) return; ended = true;
        var i = job.stops.indexOf(cancel); if (i >= 0) job.stops.splice(i, 1);
        cleanups.forEach(function (fn) { try { fn(); } catch (e) {} }); resolve(job.live() ? value : null);
      }
      function cancel() { done(null); }
      job.stops.push(cancel);
      if (!job.live()) { cancel(); return; }
      try { begin(done, cleanup); } catch (e) { done(null); }
    });
  }
  function cache(job, key, bytes) {
    return operation(job, function (done, cleanup) {
      var db = null, tx = null, ended = false;
      var timer = setTimeout(function () { done(null); }, 7000);
      cleanup(function () { ended = true; clearTimeout(timer); if (tx) try { tx.abort(); } catch (e) {} if (db) db.close(); });
      var request = indexedDB.open("sona-tts", 1);
      request.onupgradeneeded = function () { if (!request.result.objectStoreNames.contains("clips")) request.result.createObjectStore("clips"); };
      request.onerror = function () { done(null); };
      request.onsuccess = function () {
        db = request.result; if (ended || !job.live()) { db.close(); done(null); return; }
        try {
          tx = db.transaction("clips", bytes ? "readwrite" : "readonly");
          var query = bytes ? tx.objectStore("clips").put(bytes, key) : tx.objectStore("clips").get(key);
          if (bytes) tx.oncomplete = function () { tx = null; done(true); };
          else query.onsuccess = function () { done(query.result || null); };
          query.onerror = tx.onerror = function () { done(null); };
        } catch (e) { done(null); }
      };
    });
  }
  // Echo's word waits out the phone's switch back from a mic that has just
  // closed ("Hear it", or a new picture straight after Next), the same
  // SETTLE_MS the chimes wait, so the word never starts under that switch.
  // A mic request the phone has not answered yet is waited for FIRST (24 Sep
  // 2026): an iPhone starts recording before getUserMedia returns, so a word
  // started then plays through call audio even though the page never holds a
  // live track. "Hear it" tapped in that moment used to speak at once and
  // land 100–300 ms before the request; the stale answer is now let land,
  // closed by openMic (which stamps micClosedAt), and settled like any close.
  function settle(job) {
    return operation(job, function (done, cleanup) {
      var timer = null;
      cleanup(function () { clearTimeout(timer); });
      (function check() {
        if (micPending) { timer = setTimeout(check, 60); return; }
        var wait = micClosedAt + SETTLE_MS - performance.now();
        if (wait <= 0) { done(true); return; }
        timer = setTimeout(check, wait);
      })();
    });
  }
  function fetchWord(job, word) {
    return operation(job, function (done, cleanup) {
      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = setTimeout(function () { done(null); }, 7000);
      cleanup(function () { clearTimeout(timer); if (controller) controller.abort(); });
      var options = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: word, voice: profile.voiceId || "", stable: true }) };
      if (controller) options.signal = controller.signal;
      fetch("/api/tts", options).then(function (response) {
        if (!response.ok) { job.reason = "api-error"; job.status = response.status; return null; }
        job.voiceInfo = { source: response.headers.get("X-Sona-Voice-Provider") || "server", model: response.headers.get("X-Sona-Voice-Model"),
          cache: response.headers.get("X-Sona-Voice-Cache"), revision: response.headers.get("X-Sona-Voice-Revision") };
        return response.arrayBuffer();
      }).then(function (bytes) { done(bytes && bytes.byteLength ? bytes : null); }).catch(function () { job.reason = "network-error"; done(null); });
    });
  }
  function pcm(job, bytes) {
    return operation(job, function (done, cleanup) {
      unlockContext();
      var node = null, gain = null, timer = setTimeout(function () { done(false); }, 1000), ended = false;
      cleanup(function () { ended = true; clearTimeout(timer); if (node) { node.onended = null; try { node.stop(); node.disconnect(); } catch (e) {} } if (gain) gain.disconnect(); });
      contextSettled.then(function () {
        if (ended || !job.live()) return;
        if (!ctx || ctx.state !== "running") { done(false); return; }
        try {
          var n = bytes.byteLength >> 1; if (!n) { done(false); return; }
          var buffer = ctx.createBuffer(1, n, 24000), channel = buffer.getChannelData(0), view = new DataView(bytes);
          for (var i = 0; i < n; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
          node = ctx.createBufferSource(); gain = ctx.createGain(); node.buffer = buffer; gain.gain.value = volume(); node.connect(gain); gain.connect(ctx.destination);
          node.onended = function () { done(true); }; clearTimeout(timer);
          timer = setTimeout(function () { done(false); }, Math.ceil(buffer.duration * 1000) + 1500); node.start();
          $("promptHint").textContent = "Listen to Echo.";
          if (S.voiceDiagnostic) S.voiceDiagnostic(job.voiceInfo || { source: "server" });
        } catch (e) { done(false); }
      });
    });
  }
  function browserWord(job, word) {
    return operation(job, function (done, cleanup) {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { done(true); return; }
      var utterance = new SpeechSynthesisUtterance(word); utterance.rate = 0.95; utterance.pitch = 1.05; utterance.volume = volume();
      var timer = setTimeout(function () { done(true); }, 12000);
      cleanup(function () { clearTimeout(timer); utterance.onend = utterance.onerror = null; try { window.speechSynthesis.cancel(); } catch (e) {} });
      utterance.onend = utterance.onerror = function () { done(true); };
      try { if (window.speechSynthesis.paused) window.speechSynthesis.resume(); } catch (e) {}
      if (S.voiceDiagnostic) S.voiceDiagnostic({ source: "browser", reason: job.reason || "fallback", status: job.status });
      $("promptHint").textContent = "Listen to Echo.";
      window.speechSynthesis.speak(utterance);
    });
  }
  function sayWord() {
    if (!active() || phase !== "reveal" || !target) return;
    profile = S.getProfile ? S.getProfile() : profile;
    // no voice: nothing to hear first, so the child's turn starts now (after the reveal chime's quiet window)
    if (profile.voiceOn === false || volume() === 0) { openMic(); return; }
    stopAudio(); stopMic(); // "Hear it" closes the mic before Echo speaks again
    var word = String(target.w), generation = audioGeneration;
    var job = { stops: [], cancelled: false };
    job.live = function () { return !job.cancelled && generation === audioGeneration && active() && phase === "reveal" && target && target.w === word; };
    job.cancel = function () { if (job.cancelled) return; job.cancelled = true; job.stops.slice().forEach(function (stop) { stop(); }); };
    audioJob = job; speaking = true; unlockContext();
    $("promptHint").textContent = "Getting Echo ready…";
    var key = (profile.voiceId || "echo") + "|" + (S.TTS_CACHE_VERSION || "v8") + "|" + word;
    cache(job, key).then(function (bytes) {
      if (!job.live()) return null;
      if (bytes) { job.voiceInfo = { source: "cache", cache: "device", revision: S.TTS_CACHE_VERSION || "v8" }; return bytes; }
      return fetchWord(job, word).then(function (fresh) { if (fresh && job.live()) cache(job, key, fresh); return fresh; });
    }).then(function (bytes) {
      if (!job.live()) return;
      return settle(job).then(function () {
        if (!job.live()) return;
        return (bytes ? pcm(job, bytes) : Promise.resolve(false)).then(function (played) { if (!played && job.live()) return browserWord(job, word); });
      });
    }).catch(function () { if (job.live()) return settle(job).then(function () { if (job.live()) return browserWord(job, word); }); }).then(function () {
      job.cancel(); if (audioJob === job) { audioJob = null; speaking = false; voiced = 0; quietUntil = Math.max(quietUntil, performance.now() + VOICE_TAIL_MS);
        if (active() && phase === "reveal") $("promptHint").textContent = "Your turn. Say it together.";
        openMic(); // the word is finished: now it is the child's turn
      }
    });
  }

  $("startGame").onclick = start; $("playAgain").onclick = function () {
    if (closed || paused || document.hidden) return;
    if (finished && S.simpleAdventure && S.simpleAdventure(kind, false)) {
      closed = true; stopResources(); location.href = "/charge.html?daily=1&banked=0";
    } else start();
  };
  if ($("revealButton")) $("revealButton").onclick = function () { reveal(null); };
  doors.forEach(function (door) { door.onclick = function () { reveal(door); }; });
  $("hearWord").onclick = sayWord; $("nextTurn").onclick = next;
  $("pauseGame").onclick = pause; $("resumeGame").onclick = resume;
  Array.prototype.forEach.call(document.querySelectorAll("a[href]"), function (link) { link.addEventListener("click", function (event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    closed = true; stopResources();
  }); });
  if (S.onBackground) S.onBackground(pause);
  else { document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); }); window.addEventListener("pagehide", pause); }
  window.addEventListener("pageshow", function (event) {
    if (!event.persisted || !closed) return;
    closed = false;
    if (phase === "choose" || phase === "reveal") { paused = true; render(); focus($("resumeGame")); }
  });
  render();
})();
