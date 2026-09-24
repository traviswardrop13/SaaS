/* Bubble Pop and Peekaboo share one untimed, five-discovery round.
   Taps reveal pictures; only the optional, already-authorized mic can hear a
   turn. No recording, transcript, accuracy score or tap-based practice credit. */
(function () {
  "use strict";
  var S = window.Sona;
  if (!S) return;
  var kind = document.body.getAttribute("data-simple-game"), NEED = 5;
  var dailyEntry = new URLSearchParams(location.search).get("daily") === "1";
  if (!S.gameAccess(kind, { run: dailyEntry }).allowed) { S.gameBounce(kind); return; }
  function $(id) { return document.getElementById(id); }
  var phase = "intro", paused = false, closed = false, finished = false;
  var found = 0, heard = 0, heardThisTurn = false, target = null, targets = [], used = [], sound = "";
  var selectedDoor = null, focusBeforePause = null, profile = S.getProfile ? S.getProfile() : {};
  var ctx = null, contextSettled = Promise.resolve(), stream = null, source = null, raf = null, micGeneration = 0;
  var voiced = 0, quietUntil = 0, speaking = false, audioGeneration = 0, audioJob = null;
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
    chooseTurn(); unlockContext(); openMic();
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
    stopAudio(); voiced = 0; found++;
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
    stopTracks(stream); stream = null; voiced = 0;
  }
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
    var generation = ++micGeneration;
    Promise.resolve().then(function () { return navigator.permissions.query({ name: "microphone" }); }).then(function (permission) {
      if (!permission || permission.state !== "granted" || generation !== micGeneration || !active()) return null;
      return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }).then(function (value) {
      if (!value) return;
      if (generation !== micGeneration || !active()) { stopTracks(value); return; }
      stream = value; unlockContext();
      return contextSettled.then(function () {
        if (generation !== micGeneration || !active()) { stopTracks(value); return; }
        if (!ctx || ctx.state !== "running") { stopTracks(value); if (stream === value) stream = null; return; }
        var localSource = ctx.createMediaStreamSource(value), analyser = ctx.createAnalyser();
        source = localSource; analyser.fftSize = 512; localSource.connect(analyser);
        var data = new Uint8Array(analyser.fftSize), threshold = 0, calibration = 0, count = 0, sum = 0, previous = performance.now();
        function tick() {
          if (generation !== micGeneration || !active()) return;
          var now = performance.now(), elapsed = Math.min(50, now - previous); previous = now;
          if (speaking || now < quietUntil) { voiced = 0; raf = requestAnimationFrame(tick); return; }
          analyser.getByteTimeDomainData(data);
          var total = 0; for (var i = 0; i < data.length; i++) { var d = (data[i] - 128) / 128; total += d * d; }
          var rms = Math.sqrt(total / data.length);
          if (calibration < 250) { calibration += elapsed; sum += rms; count++; voiced = 0; raf = requestAnimationFrame(tick); return; }
          if (!threshold) threshold = Math.max(0.035, (sum / Math.max(1, count)) * 3.0);
          if (phase !== "reveal") { voiced = 0; raf = requestAnimationFrame(tick); return; }
          if (rms > threshold) {
            voiced++;
            if (voiced >= 4 && !heardThisTurn) { heardThisTurn = true; heard++; $("heardMessage").textContent = "Echo heard you!"; effect("tap"); }
          } else voiced = 0;
          raf = requestAnimationFrame(tick);
        }
        raf = requestAnimationFrame(tick);
      });
    }).catch(function () { if (generation === micGeneration) { stopMic(); } });
  }
  function effect(name, final) {
    if (closed || paused || document.hidden || (!active() && !final) || profile.soundOn === false || volume() === 0) return;
    quietUntil = performance.now() + 700; voiced = 0;
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
    stopAudio(); profile = S.getProfile ? S.getProfile() : profile;
    if (profile.voiceOn === false || volume() === 0) return;
    var word = String(target.w), generation = audioGeneration;
    var job = { stops: [], cancelled: false };
    job.live = function () { return !job.cancelled && generation === audioGeneration && active() && phase === "reveal" && target && target.w === word; };
    job.cancel = function () { if (job.cancelled) return; job.cancelled = true; job.stops.slice().forEach(function (stop) { stop(); }); };
    audioJob = job; speaking = true; unlockContext();
    $("promptHint").textContent = "Getting Echo ready…";
    var key = (profile.voiceId || "echo") + "|" + (S.TTS_CACHE_VERSION || "v7") + "|" + word;
    cache(job, key).then(function (bytes) {
      if (!job.live()) return null;
      if (bytes) { job.voiceInfo = { source: "cache", cache: "device", revision: S.TTS_CACHE_VERSION || "v7" }; return bytes; }
      return fetchWord(job, word).then(function (fresh) { if (fresh && job.live()) cache(job, key, fresh); return fresh; });
    }).then(function (bytes) {
      if (!job.live()) return;
      return (bytes ? pcm(job, bytes) : Promise.resolve(false)).then(function (played) { if (!played && job.live()) return browserWord(job, word); });
    }).catch(function () { if (job.live()) return browserWord(job, word); }).then(function () {
      job.cancel(); if (audioJob === job) { audioJob = null; speaking = false; voiced = 0; quietUntil = Math.max(quietUntil, performance.now() + 200);
        if (active() && phase === "reveal") $("promptHint").textContent = "Your turn. Say it together.";
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
