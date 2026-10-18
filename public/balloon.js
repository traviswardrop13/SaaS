/* Balloon Party: the word earns useful pump power; real button presses fill
   the balloon, and a real drag-and-release decorates the party. SayPlay owns
   every word, mic, voice and rep. No wind, timer or helper attaches a balloon.
   All published positions are normalized to partyCanvas; goal.r uses width.

   EVERY BALLOON GETS TO THE PARTY (the Hoops rule, for ages 3-4, so the
   gentler ladder). A miss is a real try that did not land: a release (or
   Enter) outside the ring, or a tap on the full balloon with no pull.
   Idle time is never a miss. misses 0: the game as drawn. 1: the ring glows,
   grows and an arrow points to it, and a release within 2.5 rings is pulled
   in. 2 and on: almost anything works, a pull upward or a tap on the
   balloon floats it in. The finger still makes every move; nothing attaches
   by itself. The word's power (and the help word's) also doubles the ring. */
(function () {
  "use strict";
  var api, cv, ctx, W = 390, H = 844, raf = 0, last = 0, time = 0;
  var active = false, paused = false, away = false, stage = 0, stages = 5, delivered = 0, won = false;
  var inflation = 0, power = 0, pumps = 0, drops = 0, misses = 0, balloon = { x: 0.5, y: 0.64 };
  // clock: real play seconds (not paused, page shown), for the pull-in glide
  // and the celebration beat before api.done(), as hoops.js keeps it.
  var clock = 0, doneAt = 0, pull = null, told = {}, canTint = true;
  var goal = { x: 0.5, y: 0.3, r: 0.105 }, goals = [], home = { x: 0.5, y: 0.64 };
  var drag = null, dragSurface = null, dragOffset = { x: 0, y: 0 }, dragStart = null, moved = false;
  var bodyW = 74, playTop = 100, playBottom = 650, pumpTimer = 0, sparkles = [], art = {};
  var POWER = 10, WIND = 0.018, HUES = [0, 65, 150, 210, 290], PULL_S = 0.32, BEAT_S = 1.15;
  var COLORS = ["#ef6a78", "#eac85d", "#67c8b9", "#74b8e8", "#b690d7"];
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function canPlay() { return active && !paused && !away && !won && !document.hidden; }
  function full() { return inflation >= 1; }
  function gain() { return power > 0 ? 0.34 : 0.17; }
  function level() { return Math.min(2, misses); }
  // How far from the ring's centre a release still lands, in rings.
  function reach() { return Math.max([1, 2.5, 3][level()], power > 0 ? 2 : 1); }
  // The ring as drawn: bigger once the child needs it (never the full reach,
  // so the five rings of the garland stay apart).
  function ringScale() { return Math.max([1, 1.45, 1.7][level()], power > 0 ? 1.3 : 1); }
  function windNow() { return power > 0 || misses > 0 ? 0 : WIND; }
  function say(key, text) { if (told[key]) return; told[key] = true; try { api.instruct(text); } catch (e) {} }
  function loadArt() {
    [["bg", "balloon-bg.webp"], ["balloon", "balloon-red.webp"]].forEach(function (p) {
      var image = new Image(); image.onload = function () { draw(); }; image.src = "/assets/crafted/game/" + p[1]; art[p[0]] = image;
    });
  }
  function image(name) { var i = art[name]; return i && i.complete && i.naturalWidth ? i : null; }
  function fit() {
    if (!cv) return;
    var r = cv.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    var dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    playTop = Math.max(75, $("partyBanner").getBoundingClientRect().bottom - r.top + 12);
    playBottom = Math.max(playTop + 140, $("partyControls").getBoundingClientRect().top - r.top - 12);
    var room = playBottom - playTop, ring = clamp(W * 0.105, 29, 43), base = playTop + Math.min(95, room * 0.24);
    var xs = [0.5, 0.32, 0.68, 0.14, 0.86], offsets = [0, 12, 12, 34, 34];
    goals = xs.map(function (x, i) { return { x: x, y: (base + offsets[i]) / H, r: ring / W }; });
    goal = goals[stage]; home = { x: 0.5, y: (playTop + room * 0.73) / H };
    bodyW = Math.min(78, W * 0.2, room * 0.42);
    if (!active && !delivered) { balloon.x = home.x; balloon.y = home.y; }
    cancelDrag(false); hud(); draw();
  }
  function cover(i) {
    var scale = Math.max(W / i.naturalWidth, H / i.naturalHeight), w = i.naturalWidth * scale, h = i.naturalHeight * scale;
    ctx.drawImage(i, (W - w) / 2, (H - h) / 2, w, h);
  }
  function drawBalloon(p, amount, color, size, bob) {
    var x = p.x * W, y = p.y * H + bob, w = size * (0.32 + 0.68 * amount), i = image("balloon");
    ctx.save(); ctx.translate(x, y);
    // The colours are one red sprite turned by a canvas filter. A WebKit
    // without canvas filters would paint five red balloons, so there every
    // balloon but the red one is drawn in its own colour instead.
    if (i && (color === 0 || canTint)) {
      // The source is half envelope and half string. Scale by envelope width,
      // not the tall image box; keep the actual painted string visible.
      if (color) ctx.filter = "hue-rotate(" + HUES[color] + "deg)";
      var h = w * i.naturalHeight / i.naturalWidth;
      ctx.drawImage(i, -w / 2, -w * 0.61, w, h);
    } else {
      // Asset failure still leaves a visible, graspable balloon and a string.
      // No hue filter is set here, so fallback colours remain their own.
      ctx.strokeStyle = "#f9edd5"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, w * 0.6); ctx.bezierCurveTo(-w * 0.2, w, w * 0.25, w * 1.25, 0, w * 1.8); ctx.stroke();
      var g = ctx.createRadialGradient(-w * 0.22, -w * 0.28, 2, 0, 0, w * 0.7); g.addColorStop(0, "#fff6e9"); g.addColorStop(0.38, COLORS[color]); g.addColorStop(1, COLORS[color]);
      ctx.fillStyle = g; ctx.strokeStyle = COLORS[color]; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.5, w * 0.61, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, w * 0.58); ctx.lineTo(-4, w * 0.68); ctx.lineTo(4, w * 0.68); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function garland() {
    var order = [3, 1, 0, 2, 4];
    ctx.strokeStyle = "rgba(89,94,59,.75)"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath();
    order.forEach(function (n, i) { var p = goals[n]; if (!p) return; if (i) ctx.lineTo(p.x * W, p.y * H); else ctx.moveTo(p.x * W, p.y * H); }); ctx.stroke();
    goals.forEach(function (p, i) {
      if (i < delivered) return;
      var lit = (active || pull) && i === stage, radius = p.r * W * (lit ? ringScale() : 1);
      ctx.save(); ctx.translate(p.x * W, p.y * H);
      ctx.fillStyle = lit ? "rgba(255,250,235,.48)" : "rgba(255,250,235,.20)";
      ctx.strokeStyle = lit ? "#fff9dc" : "rgba(255,250,235,.75)"; ctx.lineWidth = lit ? 5 : 2;
      if (lit) { ctx.shadowColor = "#1f98a6"; ctx.shadowBlur = misses ? 22 + 8 * Math.sin(clock * 5) : 15; if (misses) ctx.fillStyle = "rgba(255,250,235,.7)"; } else ctx.setLineDash([4, 7]);
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (lit) { ctx.shadowBlur = 0; ctx.strokeStyle = "#258995"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, radius + 5, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    });
    for (var n = 0; n < delivered; n++) drawBalloon(goals[n], 1, n, Math.min(68, W * 0.16), 0);
  }
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H); var bg = image("bg");
    if (bg) cover(bg); else { var wash = ctx.createLinearGradient(0, 0, 0, H); wash.addColorStop(0, "#c9ecf1"); wash.addColorStop(0.6, "#eff2ce"); wash.addColorStop(1, "#c4d9a3"); ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H); }
    if (!goals.length) return;
    garland();
    if (!won && (delivered <= stage || pull)) {
      var wobble = drag === null && canPlay() ? Math.sin(time * 2.2) * 2 : 0;
      drawBalloon(balloon, inflation, stage, bodyW, wobble);
      // A quiet, visual pump gauge; the actual rep count stays SayPlay's.
      if (!full() && active) {
        var cy = balloon.y * H + bodyW * 0.9;
        for (var dot = 0; dot < 6; dot++) { ctx.fillStyle = inflation >= (dot + 1) / 6 ? "#258995" : "rgba(255,250,235,.9)"; ctx.beginPath(); ctx.arc(balloon.x * W + (dot - 2.5) * 12, cy, 4, 0, Math.PI * 2); ctx.fill(); }
      }
      // The dashed path to the ring; after a miss it stays up while the
      // child pulls, gets bolder, and ends in an arrow at the ring.
      if (full() && canPlay() && (drag === null || misses)) {
        var gx = goal.x * W, gy = goal.y * H, bx = balloon.x * W, by = balloon.y * H - bodyW * 0.75, cy2 = Math.max(gy + bodyW, by - 10);
        ctx.save(); ctx.strokeStyle = misses ? "#fff9dc" : "rgba(255,250,235,.85)"; ctx.lineWidth = misses ? 4 : 2; ctx.setLineDash(misses ? [8, 8] : [4, 7]); ctx.lineCap = "round";
        if (misses) { ctx.shadowColor = "#1f98a6"; ctx.shadowBlur = 6; }
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx, cy2, gx, gy); ctx.stroke();
        if (misses && Math.abs(by - gy) + Math.abs(bx - gx) > 30) {
          var ax = gx - bx, ay = gy - cy2, al = Math.sqrt(ax * ax + ay * ay) || 1, tipY = gy + goal.r * W * ringScale() + 4, tipX = gx;
          ax /= al; ay /= al; if (ay > -0.3) { ay = -1; ax = 0; }
          ctx.setLineDash([]); ctx.fillStyle = "#258995"; ctx.beginPath();
          ctx.moveTo(tipX, tipY); ctx.lineTo(tipX - ax * 22 - ay * 12, tipY - ay * 22 + ax * 12); ctx.lineTo(tipX - ax * 22 + ay * 12, tipY - ay * 22 - ax * 12); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
    }
    sparkles.forEach(function (s) { var life = 1 - s.age / 0.7; if (life <= 0) return; ctx.globalAlpha = life; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x + s.vx * s.age, s.y + s.vy * s.age + s.age * s.age * 35, 2.5 + life, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1;
  }
  function publish() {
    window.__balloon = { active: active, paused: paused, stage: stage, stages: stages, inflation: inflation, power: power, pumpGain: gain(), wind: windNow(), misses: misses, level: level(), reach: reach(), ringScale: ringScale(), pulling: !!pull, celebrating: doneAt > 0,
      balloon: { x: balloon.x, y: balloon.y }, goal: { x: goal.x, y: goal.y, r: goal.r }, dragging: drag !== null, pointerId: drag,
      delivered: delivered, won: won, pumps: pumps, drops: drops, full: full(), banner: $("partyBanner").textContent, width: W, height: H, coordinates: "normalized-to-canvas; goal radius uses canvas width" };
  }
  function hud() {
    var allowed = canPlay(), b = $("partyBalloon"), grip = bodyW * 1.45;
    $("partyPump").disabled = !allowed || full(); $("partyPumpLabel").textContent = full() ? "Ready!" : "Pump";
    $("partyHelp").disabled = !allowed || drag !== null;
    $("partyPower").hidden = !(active && power > 0 && !won); $("partyPowerFill").style.width = (power / POWER * 100) + "%"; $("partyPower").firstElementChild.textContent = full() ? "Big ring" : "Big pumps";
    b.hidden = !full() || !active || won; b.disabled = !allowed;
    b.style.left = (balloon.x * W) + "px"; b.style.top = (balloon.y * H) + "px"; b.style.width = grip + "px"; b.style.height = (bodyW * 1.75) + "px";
    b.setAttribute("aria-label", "Full balloon. Pull it to the glowing ring, then let go. Keyboard: arrow keys, then Enter.");
    publish();
  }
  function banner(text) { $("partyBanner").textContent = text; }
  function pump() {
    if (!canPlay() || full() || drag !== null) return;
    inflation = Math.min(1, inflation + gain()); pumps++;
    $("partyPump").classList.remove("pumping"); void $("partyPump").offsetWidth; $("partyPump").classList.add("pumping");
    clearTimeout(pumpTimer); pumpTimer = setTimeout(function () { $("partyPump").classList.remove("pumping"); }, 250);
    api.sfx("tap"); banner(full() ? "Pull it into the glowing ring!" : power > 0 ? "Big pumps! Keep going!" : "Pump, pump, pump!");
    if (full()) say("full", "Now pull your balloon into the ring.");
    hud(); draw();
  }
  function point(event) { var r = cv.getBoundingClientRect(); return { x: (event.clientX - r.left) / W, y: (event.clientY - r.top) / H }; }
  function nearBalloon(p) {
    var dx = (p.x - balloon.x) * W, dy = (p.y - balloon.y) * H;
    return dx * dx / Math.pow(bodyW * 0.72, 2) + dy * dy / Math.pow(bodyW * 0.85, 2) <= 1 || Math.abs(dx) < bodyW * 0.32 && dy > 0 && dy < bodyW * 1.15;
  }
  function setPoint(p) { balloon.x = clamp(p.x, 0.08, 0.92); balloon.y = clamp(p.y, Math.max(0.09, (playTop - bodyW * 0.2) / H), Math.min(0.88, (playBottom + bodyW * 0.4) / H)); }
  function releaseCapture() {
    var surface = dragSurface, id = drag; drag = null; dragSurface = null; dragStart = null; moved = false;
    try { if (surface && id !== null && surface.hasPointerCapture(id)) surface.releasePointerCapture(id); } catch (e) {}
  }
  function cancelDrag(returnHome) {
    if (drag === null) return;
    releaseCapture();
    if (returnHome) { balloon.x = home.x; balloon.y = home.y; banner("Let's try the ring again!"); }
    hud();
  }
  // One try at the ring: a release after a pull (still=false), or a still
  // tap or Enter (still=true). It lands, gliding into the ring, or it is a
  // miss, which only ever makes the next try easier.
  function attempt(still) {
    if (!canPlay() || !full()) return;
    var dx = (balloon.x - goal.x) * W, dy = (balloon.y - goal.y) * H, r = goal.r * W, d = Math.sqrt(dx * dx + dy * dy);
    var lands = still ? level() >= 2 : (d <= r * reach() || level() >= 2 && (home.y - balloon.y) * H >= 24);
    if (!lands) {
      misses++; drops++;
      if (!still) { balloon.x = home.x; balloon.y = home.y; }
      banner(misses >= 2 ? "Nearly! Pull it up, then let go." : "So close! Pull it to the glowing ring.");
      try { api.cheer(misses >= 2 ? "Nearly!" : "So close!"); api.face("think"); } catch (e) {}
      say("miss", "Pull it up to the glowing ring, then let go.");
      hud(); draw(); return;
    }
    releaseCapture(); active = false; power = 0; pull = { x: balloon.x, y: balloon.y, t: 0 };
    banner("Up it goes!"); hud(); draw();
  }
  function attach() { attempt(false); }
  // The glide is over: the balloon is on the garland. A cheer now, and the
  // step counts about a second later (doneAt), so the chime and the sparkles
  // are not cut off by the next word.
  function deliver() {
    pull = null; balloon.x = goal.x; balloon.y = goal.y; misses = 0;
    delivered = Math.max(delivered, stage + 1);
    for (var n = 0; n < 12; n++) sparkles.push({ x: goal.x * W, y: goal.y * H, vx: Math.cos(n * Math.PI / 6) * 45, vy: Math.sin(n * Math.PI / 6) * 45 - 15, age: 0, color: COLORS[n % COLORS.length] });
    banner(delivered === stages ? "Our party is ready!" : "A balloon for the party!");
    try { api.cheer("Hooray!"); api.face("cheer"); } catch (e) {}
    api.sfx("correct"); doneAt = clock + BEAT_S; hud(); draw();
  }
  function down(event) {
    if (!canPlay() || !full() || drag !== null || (event.button != null && event.button !== 0)) return;
    var p = point(event); if (!nearBalloon(p)) return;
    event.preventDefault(); drag = event.pointerId; dragSurface = event.currentTarget; dragStart = p; moved = false; dragOffset = { x: p.x - balloon.x, y: p.y - balloon.y };
    try { dragSurface.setPointerCapture(drag); } catch (e) {}
    banner("Into the ring, then let go"); hud();
  }
  function move(event) {
    if (event.pointerId !== drag || !canPlay()) return;
    var p = point(event);
    if (dragStart && Math.abs((p.x - dragStart.x) * W) + Math.abs((p.y - dragStart.y) * H) > 6) moved = true;
    setPoint({ x: p.x - dragOffset.x, y: p.y - dragOffset.y }); hud(); draw();
  }
  function up(event) {
    if (event.pointerId !== drag) return;
    var didMove = moved; releaseCapture();
    if (!canPlay()) { hud(); return; }
    // a still tap is a try too: a miss until the ladder lets a tap float it in
    attempt(!didMove);
  }
  function cancel(event) { if (event.pointerId !== drag) return; cancelDrag(true); draw(); }
  function keyboard(event) {
    if (!canPlay() || !full() || drag !== null) return;
    var p = { x: balloon.x, y: balloon.y }, amount = event.shiftKey ? 0.015 : 0.05;
    if (event.key === "ArrowLeft") p.x -= amount;
    else if (event.key === "ArrowRight") p.x += amount;
    else if (event.key === "ArrowUp") p.y -= amount;
    else if (event.key === "ArrowDown") p.y += amount;
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); attempt(Math.abs(p.x - home.x) + Math.abs(p.y - home.y) < 0.01); return; }
    else return;
    event.preventDefault(); setPoint(p); banner("Move to the ring, then press Enter"); hud(); draw();
  }
  function controls() {
    [cv, $("partyBalloon")].forEach(function (surface) {
      surface.addEventListener("pointerdown", down); surface.addEventListener("pointermove", move); surface.addEventListener("pointerup", up);
      surface.addEventListener("pointercancel", cancel); surface.addEventListener("lostpointercapture", cancel);
    });
    $("partyBalloon").addEventListener("keydown", keyboard);
    $("partyPump").onclick = pump;
    $("partyHelp").onclick = function () { if (canPlay() && drag === null) api.practice(); };
    window.addEventListener("resize", fit);
    document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    window.addEventListener("pagehide", function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; });
    window.addEventListener("pageshow", function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
  }
  function tick(dt) {
    var live = !paused && !away && !document.hidden;
    if (live) {
      clock += dt;
      sparkles.forEach(function (s) { s.age += dt; }); sparkles = sparkles.filter(function (s) { return s.age < 0.7; });
      if (pull) {
        pull.t += dt; var k = Math.min(1, pull.t / PULL_S), e = 1 - (1 - k) * (1 - k);
        balloon.x = pull.x + (goal.x - pull.x) * e; balloon.y = pull.y + (goal.y - pull.y) * e;
        if (k >= 1) deliver();
      }
      // done() once, after the beat, and only while the game is really playing
      if (doneAt && clock >= doneAt) { doneAt = 0; hud(); if (api) api.done(); return; }
    }
    if (!canPlay()) { hud(); return; }
    time += dt; power = Math.max(0, power - dt);
    // Floating is gentle and bounded. Even a balloon that happens to drift
    // into its ring cannot attach: only a deliberate release or key does it.
    if (full() && drag === null && windNow() > 0) balloon.x = clamp(balloon.x + Math.sin(time * 1.2 + stage) * WIND * dt, 0.16, 0.84);
    hud();
  }
  function frame(now) { var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; tick(dt); draw(); raf = requestAnimationFrame(frame); }
  function earnPower() { power = POWER; paused = false; active = true; last = 0; banner(full() ? "Big ring! Pull it in." : "Big pumps! Let's fill your balloon"); hud(); }
  function pause() { paused = true; last = 0; cancelDrag(false); clearTimeout(pumpTimer); $("partyPump").classList.remove("pumping"); hud(); }
  function reset() {
    releaseCapture(); active = false; paused = false; inflation = 0; power = 0; pumps = 0; drops = 0; misses = 0; delivered = 0; stage = 0; won = false; sparkles = []; time = 0; last = 0;
    doneAt = 0; pull = null; told = {};
    goal = goals[0] || goal; balloon.x = home.x; balloon.y = home.y; banner("Let's make a balloon party!"); hud(); draw();
  }
  window.Balloon = {
    init: function (a, n) { api = a; stages = n || 5; cv = $("partyCanvas"); ctx = cv.getContext("2d"); canTint = "filter" in ctx; loadArt(); controls(); fit(); reset(); raf = requestAnimationFrame(frame); },
    onWord: function (index) {
      stage = index; goal = goals[stage]; inflation = 0; pumps = 0; misses = 0; doneAt = 0; pull = null; told = {};
      releaseCapture(); balloon.x = home.x; balloon.y = home.y; earnPower(); say("pump", "Tap the pump to fill your balloon.");
    },
    onHelp: earnPower,
    pause: pause,
    resume: function (playing) { paused = playing === false; last = 0; hud(); },
    reset: reset,
    finale: function () { releaseCapture(); active = false; power = 0; won = true; doneAt = 0; pull = null; banner("Five balloons. One happy party!"); hud(); draw(); }
  };
})();
