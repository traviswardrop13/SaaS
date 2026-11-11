/* Peekaboo, on the Say & Play engine (ages 3-4). Codex's memory cottage,
   rebuilt so the word plays the game (review, 17 Oct 2026: on simple-play.js
   a child could finish all five finds without saying a word, and its word
   glow only ever worked on an app build no family has).

   THE WORD HIDES THE PICTURE; THE FINGER FINDS IT. sayplay.js owns every
   word turn, the mic and its quiet rules, the start card, pausing and the
   end card, as it does for Bubble Pop, Hoops, Soccer Goal and Dino Dig. When
   the engine hears the word (two times: the engine's number; whether a
   three-year-old should say it twice is Rachel's call), the word's picture
   peeks out of a door, the door closes over it, the doors trade places
   gently, and the child taps the door it went behind. The right door opens
   on the picture, and the step counts after a short cheer. Before the word
   there is nothing to find: every door is shut and does nothing. This file
   never touches the mic.

   EVERY FIND ENDS (Rachel's rule: end on a success), with no more speaking.
   A wrong door wiggles and shows its empty room. From the first wrong tap
   the right door glows and an arrow points at it; from the second, a tap on
   any door opens the right one. Waiting is never a miss, and nothing opens a
   door by itself: the finger still finds it.

   ECHO'S CLUE (optional): the pill asks for the word again (api.practice);
   heard, the right door glows for the rest of that find. Unanswered, the
   engine gives the same move straight back, from exactly where it stopped.

   Nothing about the doors is random: where the picture starts and every swap
   come from the find number and the round, and the snapshot (__peekaboo)
   says where it is. Nothing here is practice data: no attempt, rep, coin or
   sticker is written. */
(function () {
  "use strict";
  var api = null, count = 5, cv = null, ctx = null, room = null, calm = false;
  var W = 390, H = 844, DPR = 1;
  var raf = 0, lastT = 0, clock = 0, running = false, frozen = false;
  // the layout, in CSS px of the board (the whole app box)
  var doorTop = 300, doorW = 80, doorH = 122, roofH = 32, floorH = 14, findsTop = 0, showFinds = true, picSize = 60;
  // where each find's picture peeks out (plus the round), and how many times
  // the doors trade places: gentle, one to three
  var START = [1, 0, 2, 1, 2], SWAPS = [1, 1, 2, 2, 3];
  var PEEK_S = 1.9, HIDE_S = 0.6, SWAP_S = 1.25, REST_S = 0.22, OPEN_S = 0.4, DONE_S = 1.15, TAP_GAP = 0.3, NUDGE_S = 10, WIGGLE_S = 0.7;
  // what Echo says: each line is exactly what the child does next
  var LINES = { watch: "Watch the doors!", find: "Tap the door it is behind!", glow: "Tap the glowing door!" };

  // idle (the word turn: nothing to find) | peek (the picture is out) | hide
  // (its door closes) | shuffle | search | found (the cheer, then the next
  // word) | finale
  var mode = "idle", find = 0, round = 0, positions = [0, 1, 2], correctDoor = 0, startSlot = 1, word = "";
  var swaps = [], swapIndex = 0, swapProgress = 0, rest = 0, modeAt = 0;
  var misses = 0, helpGlow = false, lastTap = -9, lastAct = 0, nudged = false, doneAt = 0;
  // holds: the picture behind each door; finds: the pictures found. Each is
  // { w: the word, fb: what the engine drew for it, kept for the day the
  // painted word pictures fail to load }
  var open = [0, 0, 0], openTo = [0, 0, 0], wiggle = [0, 0, 0], holds = [null, null, null], finds = [];
  // where the move stood when the engine last gave it back (tests read it:
  // a help nobody answered must not move a door)
  var lastResume = null, foundAt = 0, lastBeat = 0;

  function el(id) { return document.getElementById(id); }
  function sp() { return window.__sayplay || {}; }
  function glowOn() { return misses >= 1 || helpGlow; }
  function ladder() { return misses >= 2 ? 2 : misses >= 1 ? 1 : 0; }
  function playing() { return running && !frozen && !document.hidden && sp().phase === "play"; }
  function sound(n) { try { if (api && api.sfx) api.sfx(n); } catch (e) {} }
  function say(t) { try { return Promise.resolve(api && api.instruct ? api.instruct(t) : null); } catch (e) { return Promise.resolve(); } }
  // Echo's lines one after another: the engine says nothing over itself, so
  // a line asked for while he is still talking waits for the one before,
  // and is said only if it is still true then (when). With nothing waiting
  // it starts at once, before the engine can replay an older line.
  var queued = 0, chain = Promise.resolve();
  function line(text, when) {
    function go() { if (when && !when()) return Promise.resolve(); return say(typeof text === "function" ? text() : text); }
    var p = queued ? chain.then(go) : go();
    queued++;
    chain = p.then(function () { queued--; }, function () { queued--; });
    return p;
  }
  // a line that only belongs to this find's search
  function searching(s) { return function () { return mode === "search" && find === s && !doneAt && playing(); }; }
  function searchLine() { return glowOn() ? LINES.glow : LINES.find; }
  function setMode(m) { mode = m; modeAt = clock; }

  // ── the word's picture (the painted one Feed Echo uses, or what the
  // engine drew for this word) ──
  function picFor(pic, size) {
    var h = null;
    try { h = window.SonaCraftedWords && window.SonaCraftedWords.picture(pic.w, size); } catch (e) {}
    return h || '<span class="peek-art-fallback">' + (pic.fb || "") + "</span>";
  }
  function drawn() { try { return el("pic").innerHTML; } catch (e) { return ""; } }
  function hold(i, pic) {
    holds[i] = pic && pic.w ? pic : null;
    try { el("peekObject" + i).innerHTML = holds[i] ? picFor(holds[i], picSize) : ""; } catch (e) {}
  }
  function paintFinds() {
    var box = el("peekFinds"); if (!box) return;
    var h = "";
    for (var i = 0; i < finds.length; i++) h += '<span class="peek-find">' + picFor(finds[i], 40) + "</span>";
    box.innerHTML = h; box.hidden = !showFinds;
    box.setAttribute("aria-label", finds.length + " of " + count + " pictures found");
  }

  // ── where things are ──
  function slotX(slot) { return W * (0.19 + 0.31 * slot); }
  // a door's centre x and top y, mid-swap too
  function doorAt(id) {
    var slot = positions.indexOf(id), x = slotX(slot), y = doorTop;
    if (mode === "shuffle" && swapIndex < swaps.length) {
      var sw = swaps[swapIndex];
      if (slot === sw.a || slot === sw.b) {
        var to = slot === sw.a ? sw.b : sw.a, t = swapProgress, e = t * t * (3 - 2 * t);
        x = slotX(slot) + (slotX(to) - slotX(slot)) * e;
        y += Math.sin(t * Math.PI) * doorH * (slot === sw.a ? -0.12 : 0.08);
      }
    }
    return { id: id, slot: slot, x: x, y: y };
  }
  // The swaps for one find. Every swap but a 3-swap find's middle one moves
  // the picture's door, and the last never brings it back to where it peeked
  // out, so the door the child must find has really moved. The middle swap
  // of three trades the other two doors.
  function buildSwaps(n, s) {
    var list = [], cur = startSlot, k = s + round;
    for (var i = 0; i < n; i++) {
      if (n === 3 && i === 1) { var o1 = (cur + 1) % 3, o2 = (cur + 2) % 3; list.push({ a: Math.min(o1, o2), b: Math.max(o1, o2) }); continue; }
      var opts = [(cur + 1) % 3, (cur + 2) % 3], pick = opts[(k + i) % 2];
      if (i === n - 1 && pick === startSlot) pick = opts[1 - (k + i) % 2];
      list.push({ a: Math.min(cur, pick), b: Math.max(cur, pick) });
      cur = pick;
    }
    return list;
  }

  // ── layout: the cottage sits between the banner and the lowest thing at
  // the bottom (the play buttons, or the word panel with its "Back to the
  // game" pill), so nothing covers a door in any phase ──
  function fit() {
    if (!cv) return;
    var r = cv.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var top = H * 0.12, bottom = H * 0.7;
    try {
      top = el("peekBanner").getBoundingClientRect().bottom - r.top + 10;
      var ctl = el("peekControls").getBoundingClientRect().top - r.top, tp = el("turnPanel").getBoundingClientRect().top - r.top, hb = el("helpBack");
      bottom = Math.min(ctl, tp - (hb && !hb.hidden ? 0 : 52)) - 10;
    } catch (e) {}
    var span = Math.max(120, bottom - top), findsH = 54, wide = W * 0.26 / (368 / 562);
    showFinds = true;
    var h = Math.min(250, (span - findsH) / 1.38, wide);
    if (h < 104) { showFinds = false; h = Math.min(250, span / 1.38, wide); }
    doorH = h; doorW = h * 368 / 562; roofH = Math.max(32, h * 0.24); floorH = h * 0.12;
    var group = roofH + doorH + floorH + (showFinds ? findsH : 0);
    doorTop = top + Math.max(0, (span - group) / 2) + roofH;
    findsTop = doorTop + doorH + floorH + 8;
    try { el("peekFinds").style.top = findsTop + "px"; } catch (e2) {}
    picSize = Math.max(24, Math.floor(Math.min(doorW * 0.78, doorH * 0.62)));
    for (var i = 0; i < 3; i++) if (holds[i]) hold(i, holds[i]);
    paintFinds(); draw(); hud(); publish();
  }

  // ── the room and the cottage (the doors are buttons over it) ──
  function rounded(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (room && room.complete && room.naturalWidth) {
      var sc = Math.max(W / room.naturalWidth, H / room.naturalHeight), iw = room.naturalWidth * sc, ih = room.naturalHeight * sc;
      ctx.drawImage(room, (W - iw) / 2, (H - ih) / 2, iw, ih);
    } else {
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#e4ecd4"); g.addColorStop(1, "#d3b580"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // the cottage wall behind the doors
    var x = W * 0.045, y = doorTop - doorH * 0.07, w = W * 0.91, h = doorH * 1.1 + floorH, g2 = ctx.createLinearGradient(0, y, 0, y + h);
    g2.addColorStop(0, "#fff2d7"); g2.addColorStop(1, "#e5c69a");
    ctx.save(); ctx.shadowColor = "rgba(85,72,48,.18)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 7; ctx.fillStyle = g2; rounded(x, y, w, h, 13); ctx.fill(); ctx.restore();
    // its roof
    var eave = doorTop - doorH * 0.05, peak = doorTop - roofH - doorH * 0.04, roof = ctx.createLinearGradient(0, peak, 0, eave);
    roof.addColorStop(0, "#a6c3af"); roof.addColorStop(1, "#6e9a91"); ctx.fillStyle = roof;
    ctx.beginPath(); ctx.moveTo(W * 0.02, eave); ctx.lineTo(W * 0.5, peak); ctx.lineTo(W * 0.98, eave); ctx.quadraticCurveTo(W * 0.5, eave + doorH * 0.04, W * 0.02, eave); ctx.fill();
    ctx.strokeStyle = "rgba(241,246,213,.45)"; ctx.lineWidth = 2;
    for (var n = 0; n < 9; n++) { var xx = W * (0.08 + n * 0.105); ctx.beginPath(); ctx.moveTo(xx, eave); ctx.lineTo(W * 0.5 + (xx - W * 0.5) * 0.55, eave - (eave - peak) * 0.55); ctx.stroke(); }
    // the doorstep the doors stand on
    ctx.fillStyle = "#b6976a"; rounded(W * 0.025, doorTop + doorH + floorH * 0.35, W * 0.95, Math.max(8, floorH * 0.7), 5); ctx.fill();
  }

  // ── what the child sees moving: the doors, the glow, the arrow ──
  function bannerText() {
    // a word turn (Echo's clue too): the word comes first
    var ph = sp().phase;
    if (ph === "turn" || ph === "nudge") return "Say the word two times!";
    if (mode === "peek") return "Here is your picture!";
    if (mode === "hide" || mode === "shuffle") return "Watch the doors!";
    if (mode === "search") return glowOn() ? "Tap the glowing door!" : "Tap the door it is behind!";
    if (mode === "found") return "Peekaboo! You found it!";
    if (mode === "finale") return "You found all five!";
    return "Say the word two times!";
  }
  var lastBanner = "";
  function hud() {
    if (!cv) return;
    var can = playing() && mode === "search" && !doneAt, glow = glowOn() && (mode === "shuffle" || mode === "search");
    for (var i = 0; i < 3; i++) {
      var d = doorAt(i), b = el("peekDoor" + i); if (!b) continue;
      var wig = wiggle[i] > 0 ? Math.sin(wiggle[i] * 26) * (calm ? 2 : 5) * (wiggle[i] / WIGGLE_S) : 0;
      b.style.left = (d.x - doorW / 2).toFixed(1) + "px"; b.style.top = d.y.toFixed(1) + "px";
      b.style.width = doorW.toFixed(1) + "px"; b.style.height = doorH.toFixed(1) + "px";
      b.style.transform = wig ? "rotate(" + wig.toFixed(2) + "deg)" : "";
      el("peekLeaf" + i).style.transform = "rotateY(" + (-104 * open[i]).toFixed(1) + "deg)";
      el("peekObject" + i).style.visibility = open[i] > 0.02 ? "visible" : "hidden";
      b.classList.toggle("hint", glow && i === correctDoor);
      b.classList.toggle("found", (mode === "found" || mode === "finale") && open[i] > 0.5);
      if (b.disabled !== !can) b.disabled = !can;
      var label = ["The left door", "The middle door", "The right door"][d.slot] + (glow && i === correctDoor ? ". It is glowing." : ".");
      if (b.getAttribute("aria-label") !== label) b.setAttribute("aria-label", label);
    }
    var arrow = el("peekArrow");
    if (arrow) {
      var show = glowOn() && mode === "search";
      if (arrow.hidden === show) arrow.hidden = !show;
      if (show) { var c = doorAt(correctDoor), bob = calm ? 0 : Math.sin(clock * 5) * 4; arrow.style.left = (c.x - 17).toFixed(1) + "px"; arrow.style.top = (c.y - 34 + bob).toFixed(1) + "px"; }
    }
    var t = bannerText(); if (t !== lastBanner) { lastBanner = t; try { el("peekBanner").textContent = t; } catch (e) {} }
    try {
      el("peekHelp").disabled = !canHelp();
      el("peekHearStep").disabled = !(playing() && (mode === "peek" || mode === "hide" || mode === "shuffle" || mode === "search") && !doneAt);
    } catch (e2) {}
  }
  function canHelp() { return playing() && (mode === "shuffle" || mode === "search") && !glowOn() && !doneAt; }

  // ── the clock: only while the game plays (not paused, page in view) ──
  function step(dt) {
    for (var i = 0; i < 3; i++) {
      if (open[i] !== openTo[i]) { var d = dt / OPEN_S; open[i] = open[i] < openTo[i] ? Math.min(openTo[i], open[i] + d) : Math.max(openTo[i], open[i] - d); }
      if (wiggle[i] > 0) { wiggle[i] -= dt; if (wiggle[i] <= 0) { wiggle[i] = 0; if (!(i === correctDoor && (mode === "found" || mode === "finale"))) openTo[i] = 0; } }
    }
    // the cheer, then the next word: on this clock, so a pause holds it
    if (doneAt && clock >= doneAt) { doneAt = 0; findDone(); return; }
    if (mode === "peek" && clock - modeAt >= PEEK_S) {
      setMode("hide"); openTo[correctDoor] = 0; sound("drop");
      line(LINES.watch, function () { return (mode === "hide" || mode === "shuffle") && playing(); });
    } else if (mode === "hide" && clock - modeAt >= HIDE_S) {
      setMode("shuffle"); swapIndex = 0; swapProgress = 0; rest = 0.15;
    } else if (mode === "shuffle") {
      if (rest > 0) rest -= dt;
      else {
        swapProgress = Math.min(1, swapProgress + dt / SWAP_S);
        if (swapProgress >= 1) {
          var sw = swaps[swapIndex], keep = positions[sw.a]; positions[sw.a] = positions[sw.b]; positions[sw.b] = keep;
          swapIndex++; swapProgress = 0; rest = REST_S;
          if (swapIndex >= swaps.length) startSearch();
        }
      }
    } else if (mode === "search" && !nudged && clock - lastAct >= NUDGE_S) {
      // nobody has tapped for a while: Echo says it once more (never a help)
      nudged = true; line(searchLine, searching(find));
    }
  }
  function startSearch() {
    setMode("search"); lastAct = clock; nudged = false;
    // after "Watch the doors!" has finished (or at once, if it never played)
    line(searchLine, searching(find));
  }
  function frame(now) {
    raf = 0; if (!running) return;
    var dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
    if (!frozen && !document.hidden) { clock += dt; step(dt); }
    hud(); publish();
    raf = requestAnimationFrame(frame);
  }

  // ── the finger ──
  function tap(id) {
    if (!playing() || mode !== "search" || doneAt) return;
    if (clock - lastTap < TAP_GAP) return;              // a double tap is one tap
    lastTap = clock; lastAct = clock;
    // the right door, or (from the second wrong tap) any door, opens on it
    if (id === correctDoor || misses >= 2) { foundIt(); return; }
    misses++;
    wiggle[id] = WIGGLE_S; openTo[id] = 0.42;           // a peek inside: an empty room
    sound("tap");
    if (misses === 1) line(LINES.glow, searching(find));
    publish();
  }
  function foundIt() {
    setMode("found");
    for (var i = 0; i < 3; i++) { if (i !== correctDoor) { wiggle[i] = 0; openTo[i] = 0; } }
    openTo[correctDoor] = 1; wiggle[correctDoor] = 0;
    sound("correct"); foundAt = clock;
    try { api.cheer("Peekaboo!"); api.hint(""); } catch (e) {}
    // the next word waits for the cheer (sayplay.js asks for it 250 ms after
    // done(), and asking stops every chime)
    doneAt = clock + DONE_S;
    publish();
  }
  function findDone() {
    finds.push(holds[correctDoor] || { w: word, fb: drawn() }); paintFinds();
    openTo[correctDoor] = 0; lastBeat = +(clock - foundAt).toFixed(3);
    setMode("idle"); find++;
    publish();
    if (api) api.done();
  }

  // ── what the engine calls ──
  function publish() {
    try {
      var doors = [];
      for (var i = 0; i < 3; i++) { var d = doorAt(i); doors.push({ id: i, slot: d.slot, x: +d.x.toFixed(1), y: +d.y.toFixed(1), w: +doorW.toFixed(1), h: +doorH.toFixed(1), open: +open[i].toFixed(2), holds: holds[i] ? holds[i].w : "" }); }
      window.__peekaboo = { mode: mode, find: find, count: count, round: round, word: word, correctDoor: correctDoor, correctSlot: positions.indexOf(correctDoor), startSlot: startSlot,
        positions: positions.slice(), swaps: swaps.map(function (s) { return { a: s.a, b: s.b }; }), swapIndex: swapIndex, swapProgress: +swapProgress.toFixed(3),
        misses: misses, ladder: ladder(), glow: glowOn(), helpGlow: helpGlow, frozen: frozen, playing: playing(), celebrating: !!doneAt,
        finds: finds.map(function (f) { return f.w; }), doors: doors, showFinds: showFinds, lastResume: lastResume, lastBeat: lastBeat, width: W, height: H, clock: +clock.toFixed(3) };
    } catch (e) {}
  }
  var Peekaboo = {
    init: function (engineApi, n) {
      api = engineApi; count = n || 5;
      try { calm = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}
      cv = el("peekCanvas"); ctx = cv.getContext("2d");
      // held, not thrown away: a picture nobody holds is collected and loads late
      room = new Image(); room.onload = draw; room.src = "/assets/crafted/game/monster-salon-v1.webp";
      [0, 1, 2].forEach(function (i) { var b = el("peekDoor" + i); if (b) b.onclick = function () { tap(i); }; });
      el("peekHelp").onclick = function () { if (canHelp()) api.practice(); };
      el("peekHearStep").onclick = function () {
        if (!playing() || doneAt) return;
        if (mode === "search") line(searchLine, searching(find)); else if (mode === "peek" || mode === "hide" || mode === "shuffle") line(LINES.watch);
      };
      window.addEventListener("resize", fit);
      running = true; fit(); lastT = performance.now(); raf = requestAnimationFrame(frame);
    },
    // the engine heard the word: the picture peeks out of a door
    onWord: function (s) {
      if (s >= count) return;
      frozen = false; find = s; misses = 0; helpGlow = false; lastTap = -9; doneAt = 0; nudged = false;
      word = sp().word || "";
      startSlot = (START[s % START.length] + round) % 3; correctDoor = positions[startSlot];
      swaps = buildSwaps(SWAPS[s % SWAPS.length], s); swapIndex = 0; swapProgress = 0; rest = 0;
      var pic = { w: word, fb: drawn() };
      for (var i = 0; i < 3; i++) { hold(i, i === correctDoor ? pic : null); wiggle[i] = 0; openTo[i] = i === correctDoor ? 1 : 0; }
      setMode("peek");
      try { api.hint(""); } catch (e) {}
      hud(); publish();
    },
    // Echo's clue was heard: the right door glows for the rest of this find
    onHelp: function () {
      helpGlow = true; frozen = false; lastT = performance.now();
      if (mode === "search") line(LINES.glow, searching(find));
      hud(); publish();
    },
    pause: function () { frozen = true; publish(); },
    // true: the same move goes on from exactly where it stopped
    resume: function (playingNow) {
      frozen = playingNow === false; lastT = performance.now();
      if (!frozen) lastResume = { mode: mode, find: find, swapIndex: swapIndex, swapProgress: +swapProgress.toFixed(3), positions: positions.slice(), clock: +clock.toFixed(3) };
      if (!frozen && mode === "search" && !doneAt) line(searchLine, searching(find));
      hud(); publish();
    },
    reset: function () {
      round++; positions = [0, 1, 2]; correctDoor = 0; startSlot = 1; word = ""; finds = []; lastResume = null; lastBeat = 0;
      swaps = []; swapIndex = 0; swapProgress = 0; rest = 0; misses = 0; helpGlow = false; doneAt = 0; frozen = false;
      for (var i = 0; i < 3; i++) { open[i] = 0; openTo[i] = 0; wiggle[i] = 0; hold(i, null); }
      setMode("idle"); paintFinds(); hud(); publish();
    },
    finale: function () {
      doneAt = 0; setMode("finale");
      // every door opens on one of the pictures just found
      for (var i = 0; i < 3; i++) { wiggle[i] = 0; openTo[i] = 1; hold(i, finds[finds.length - 1 - i] || null); }
      if (typeof Peekaboo.onFinale === "function") try { Peekaboo.onFinale(); } catch (e) {}
      hud(); publish();
    },
    snapshot: function () { publish(); return window.__peekaboo; },
  };
  window.Peekaboo = Peekaboo;
})();
