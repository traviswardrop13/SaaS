/* Space Trip: eight actual piloted landings. Each word the child says two
   times starts the next flight. Gravity, inertia and held engines move the
   rocket; only a soft pad contact can finish a leg. SayPlay owns speech,
   audio, microphone and every repetition; this file never touches them.

   EVERY FLIGHT ENDS ON ITS PAD (CLAUDE.md, "Every ball ends in a basket").
   A miss is a real touchdown that did not land (too fast, beside the pad) or
   a bump into a rock, never time spent waiting: the rocket sits still at the
   start until a finger flies it. Each miss makes this flight easier
   (legRetries, reset by the next word):
   - miss 0: the game as designed. The word's easy flight lasts ten seconds.
   - after 1 miss: the rocket falls about half as hard and drifts less, and a
     landing may be about 1.5x faster and 1.5x wider off the pad's middle.
   - after 2 misses: the pad glows, a ghost rocket shows where to stand and
     an arrow points down at it; the last stretch above the pad slows the
     rocket by itself, so letting go over the glow lands; a rock nudges the
     rocket aside instead of starting over; windows about 2.2x.
   - from the 3rd miss: the glow pulls the rocket over the pad as it falls,
     and any touchdown near it lands. Tap Engine, then let go.
   A child aged 2 to 4 gets the glow from the first miss and the pull from
   the second. No help ever flies the rocket by itself: it waits at the start
   until a finger touches Engine or an arrow, and no timer finishes a step.
   The easy-flight word stays a bonus on top; nothing here needs it.

   A landing is celebrated for BEAT seconds of play (the chime, the banner, a
   ring of light) before the step is reported, so the next "Say..." never
   cuts the chime off (hoops.js does the same with doneAt). */
(function () {
  "use strict";
  var api, cv, ctx, W = 390, H = 844, raf = 0, last = 0, time = 0, clock = 0, art = {};
  var active = false, paused = false, away = false, stage = 0, stages = 8, landed = 0, won = false, power = 0, little = false, calm = false;
  var ship = { x: 0.77, y: 0.3, vx: 0, vy: 0 }, spawn = { x: 0.77, y: 0.3 }, pad = { x: 0.5, y: 0.8, w: 0.32 };
  var shipW = 42, shipH = 74, playTop = 150, groundY = 680, obstacles = [], piloted = false, retries = 0, legRetries = 0;
  var leftOwner = null, rightOwner = null, thrustOwner = null, leftSurface = null, rightSurface = null, thrustSurface = null, thumbOrigin = 0, thumbSteer = 0;
  var keys = { left: false, right: false, thrust: false }, thrust = false, steering = 0, cushion = false, nudged = 0;
  // doneAt: when (on this game's own play clock) the landing is reported
  var doneAt = 0, dones = 0, cheerAt = -9, BEAT = 1.15;
  var PAD_X = [0.5, 0.72, 0.28, 0.58, 0.22, 0.78, 0.4, 0.6], PAD_W = [0.32, 0.3, 0.3, 0.28, 0.29, 0.28, 0.27, 0.26];
  var GRAVITY = [0.12, 0.13, 0.115, 0.14, 0.125, 0.145, 0.13, 0.15];
  var ROCKS = [[], [], [[0.53, 0.54, 0.045]], [[0.24, 0.62, 0.05]], [[0.61, 0.54, 0.045]], [[0.45, 0.57, 0.04]], [[0.71, 0.64, 0.04]], [[0.24, 0.5, 0.04], [0.81, 0.58, 0.04]]];
  var POWER = 10, THRUST = 0.34, STEER = 0.36;
  // Every line the banner can show (kind words only: never "missed",
  // "wrong" or a score). fit() makes room for the tallest, so a line that
  // wraps on a narrow phone never covers the flying space.
  var SAY = {
    ready: "Ready for a little space trip?",
    word: "Easy flight! Hold Engine to go",
    help: "Easy flight! Aim for the glow",
    fly: "Aim for the glow. Land gently",
    pad1: "So close! Aim for the glow",
    hard1: "So close! Tap Engine to slow down",
    rock1: "Go around the rock. Try again!",
    again2: "Nearly! Land by the arrow",
    again3: "Tap Engine, then let go",
    landed: "A soft landing. Nice flying!",
    all: "Eight gentle landings!",
    won: "A space trip, flown by you!"
  };
  var BANNERS = Object.keys(SAY).map(function (k) { return SAY[k]; });
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function live() { return !paused && !away && !document.hidden; }
  function canPlay() { return active && live() && !won; }
  // ── the ladder: 0 as designed, 1 easier, 2 glow + arrow + cushion, 3 pull ──
  function ladder() { var m = legRetries; return little ? (m >= 2 ? 3 : m >= 1 ? 2 : 0) : Math.min(3, m); }
  function gravity() {
    var f = power > 0 ? 0.55 : 1, lv = ladder();
    if (lv >= 3) f = Math.min(f, 0.42); else if (lv >= 2) f = Math.min(f, 0.45); else if (lv >= 1) f = Math.min(f, 0.5);
    return GRAVITY[stage] * f;
  }
  function damping() { var d = power > 0 ? 1.6 : 0.65, lv = ladder(); return lv >= 2 ? Math.max(d, 1.6) : lv >= 1 ? Math.max(d, 1.1) : d; }
  function verticalDamping() { var d = power > 0 ? 0.18 : 0.05; return ladder() >= 1 ? Math.max(d, 0.1) : d; }
  function safeVy() { var v = power > 0 ? 0.19 : 0.135, lv = ladder(); return lv >= 2 ? Math.max(v, 0.3) : lv >= 1 ? Math.max(v, 0.21) : v; }
  function safeVx() { var v = power > 0 ? 0.18 : 0.12, lv = ladder(); return lv >= 2 ? Math.max(v, 0.27) : lv >= 1 ? Math.max(v, 0.18) : v; }
  // how far the rocket's middle may be from the pad's middle: on the pad
  function onPad() { return Math.max(0.02, pad.w / 2 - shipW * 0.35 / W); }
  function tolerance() {
    var base = onPad(), t = base + (power > 0 ? 0.035 : 0), lv = ladder();
    if (lv >= 3) return Math.max(t, pad.w / 2 + 0.15);
    if (lv >= 2) return Math.max(t, base * 2.2);
    if (lv >= 1) return Math.max(t, base * 1.5);
    return t;
  }
  function image(name) { var i = art[name]; return i && i.complete && i.naturalWidth ? i : null; }
  function loadArt() {
    [["bg", "space-bg.webp"], ["ship", "space-lander-idle-v1.webp"], ["ground", "space-moon-ground-v1.webp"], ["rock", "space-rock-v1.webp"], ["star", "star.webp"]].forEach(function (p) { var i = new Image(); i.onload = draw; i.src = "/assets/crafted/game/" + p[1]; art[p[0]] = i; });
  }
  function level() {
    pad = { x: PAD_X[stage], y: groundY / H, w: PAD_W[stage] };
    spawn = { x: pad.x > 0.5 ? 0.23 : 0.77, y: (playTop + shipH / 2 + 16) / H };
    var rockScale = Math.min(W, (groundY - playTop) * 1.2);
    obstacles = ROCKS[stage].map(function (r) {
      var radius = r[2] * rockScale, y = playTop + (groundY - playTop) * r[1];
      // A wide, short viewport must not turn a small moon rock into a wall
      // around the launch point. Keep the whole rocket's spawn box clear.
      if (Math.abs((r[0] - spawn.x) * W) < radius + shipW * 0.3 + 8) y = Math.max(y, spawn.y * H + shipH * 0.42 + radius + 12);
      return { x: r[0], y: y / H, r: radius / W };
    });
  }
  // the bottom of the tallest banner line, so no line ever covers the sky
  function bannerBottom(top) {
    var b = $("spaceBanner"), keep = b.textContent, low = 0;
    b.setAttribute("aria-live", "off");
    for (var i = 0; i < BANNERS.length; i++) { b.textContent = BANNERS[i]; low = Math.max(low, b.getBoundingClientRect().bottom); }
    b.textContent = keep; b.setAttribute("aria-live", "polite");
    return low - top;
  }
  function fit() {
    if (!cv) return;
    var rect = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    playTop = bannerBottom(rect.top) + 24;
    groundY = $("spaceControls").getBoundingClientRect().top - rect.top - (W > H && H < 500 ? 28 : 80);
    // the pads sit on the ground: keep the ground above the Easy flight pill
    // and the speed pill, or a pad at the side hides under one of them
    ["spaceHelp", "spaceStatus"].forEach(function (id) { var r = $(id).getBoundingClientRect(); if (r.height > 0) groundY = Math.min(groundY, r.top - rect.top - 14); });
    var room = Math.max(65, groundY - playTop); shipH = Math.min(90, W * 0.22, room * 0.28); shipW = shipH * 367 / 512;
    stopInputs(); level();
    if (!piloted) { ship.x = spawn.x; ship.y = spawn.y; } else { ship.x = clamp(ship.x, shipW / W, 1 - shipW / W); ship.y = clamp(ship.y, (playTop + shipH / 2) / H, pad.y - shipH / H / 2); }
    hud(); draw();
  }
  function background() {
    var i = image("bg");
    if (i) { var scale = Math.max(W / i.naturalWidth, H / i.naturalHeight), w = i.naturalWidth * scale, h = i.naturalHeight * scale; ctx.drawImage(i, (W - w) / 2, (H - h) / 2, w, h); }
    else { var wash = ctx.createLinearGradient(0, 0, 0, H); wash.addColorStop(0, "#232749"); wash.addColorStop(0.65, "#494375"); wash.addColorStop(1, "#77738b"); ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H); }
    var floor = ctx.createLinearGradient(0, groundY, 0, H); floor.addColorStop(0, "#d7c3a5"); floor.addColorStop(1, "#a99a85"); ctx.fillStyle = floor; ctx.fillRect(0, groundY, W, H - groundY);
    var ground = image("ground");
    if (ground) { var gh = W * ground.naturalHeight / ground.naturalWidth; ctx.drawImage(ground, 0, groundY - gh * 0.4175, W, gh); }
    else { ctx.fillStyle = "#e1ceb1"; ctx.beginPath(); ctx.moveTo(0, groundY + 8); ctx.quadraticCurveTo(W * 0.2, groundY - 10, W * 0.45, groundY + 3); ctx.quadraticCurveTo(W * 0.7, groundY - 6, W, groundY + 9); ctx.lineTo(W, groundY + 40); ctx.lineTo(0, groundY + 40); ctx.closePath(); ctx.fill(); }
  }
  function guiding() { return active && !won && ladder() >= 2; }
  function drawPad() {
    var x = pad.x * W, y = pad.y * H, w = pad.w * W, lv = active && !won ? ladder() : 0, easy = power > 0 || lv >= 1, pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(time * 4);
    ctx.save(); ctx.translate(x, y);
    // from the 3rd miss: a soft column of light, the pull that brings it in
    if (lv >= 3) { var beam = ctx.createLinearGradient(0, -(y - playTop), 0, 0); beam.addColorStop(0, "rgba(157,223,210,0)"); beam.addColorStop(1, "rgba(157,223,210,.30)"); ctx.fillStyle = beam; ctx.fillRect(-w / 2, -(y - playTop), w, y - playTop); }
    ctx.fillStyle = lv >= 2 ? "rgba(157,223,210," + (0.32 + pulse * 0.2) + ")" : easy ? "rgba(157,223,210,.23)" : "rgba(246,244,205,.16)";
    ctx.beginPath(); ctx.ellipse(0, 0, w / 2 + (lv >= 2 ? W * 0.06 : easy ? W * 0.035 : 0), lv >= 2 ? 19 : 13, 0, 0, Math.PI * 2); ctx.fill();
    if (lv < 2) { ctx.strokeStyle = "rgba(245,252,220,.6)"; ctx.lineWidth = 2; ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.moveTo(0, -65); ctx.lineTo(0, -12); ctx.stroke(); ctx.setLineDash([]); }
    ctx.strokeStyle = "#887b67"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-w / 2, 8); ctx.lineTo(-w / 2 + 9, -2); ctx.lineTo(w / 2 - 9, -2); ctx.lineTo(w / 2, 8); ctx.stroke();
    ctx.fillStyle = "#e8efe0"; ctx.fillRect(-w / 2, -5, w, 8); ctx.fillStyle = "#4d9da4"; ctx.fillRect(-w / 2 + 5, -5, w - 10, 4);
    [-1, 1].forEach(function (side) { ctx.fillStyle = "#e9d69c"; ctx.shadowColor = "#f7efb7"; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(side * w / 2, -5, 4, 0, Math.PI * 2); ctx.fill(); }); ctx.restore();
  }
  // a thick arrow, cream under teal, so it reads on the sky and the sand
  function arrow(x1, y1, x2, y2) {
    var a = Math.atan2(y2 - y1, x2 - x1), head = 15;
    [["#fffbe6", 11], ["#258995", 5]].forEach(function (pen) {
      ctx.strokeStyle = pen[0]; ctx.lineWidth = pen[1]; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.moveTo(x2 - head * Math.cos(a - 0.6), y2 - head * Math.sin(a - 0.6)); ctx.lineTo(x2, y2); ctx.lineTo(x2 - head * Math.cos(a + 0.6), y2 - head * Math.sin(a + 0.6));
      ctx.stroke();
    });
  }
  // after two misses: a ghost rocket standing on the pad shows exactly where
  // to land, an arrow points down at it, and a dotted track runs to it
  function drawGuide() {
    if (!guiding()) return;
    var gx = pad.x * W, gy = pad.y * H - shipH / 2, i = image("ship"), bob = calm ? 0 : Math.sin(time * 3) * 5;
    ctx.save(); ctx.globalAlpha = 0.38;
    if (i) ctx.drawImage(i, gx - shipW / 2, gy - shipH * 0.485, shipW, shipH);
    else { ctx.fillStyle = "#e9e3cf"; ctx.beginPath(); ctx.ellipse(gx, gy, shipW * 0.38, shipH * 0.46, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.strokeStyle = "rgba(245,252,220,.85)"; ctx.lineWidth = 2.5; ctx.setLineDash([5, 6]);
    ctx.beginPath(); ctx.ellipse(gx, gy, shipW * 0.62, shipH * 0.58, 0, 0, Math.PI * 2); ctx.stroke();
    var sx = ship.x * W, sy = ship.y * H + shipH * 0.5;
    if (Math.abs(sx - gx) > shipW * 0.5 || gy - sy > shipH) { ctx.strokeStyle = "rgba(245,252,220,.55)"; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(gx, sy, gx, gy - shipH * 0.62); ctx.stroke(); }
    ctx.setLineDash([]);
    var top = Math.max(playTop + 6, gy - shipH * 0.6 - 74), tip = gy - shipH * 0.6 - 8;
    arrow(gx, top + bob, gx, tip + bob);
    ctx.restore();
  }
  function drawRocks() {
    obstacles.forEach(function (o) {
      var x = o.x * W, y = o.y * H, r = o.r * W, i = image("rock");
      if (i) { var scale = Math.min(2 * r / i.naturalWidth, 2 * r / i.naturalHeight), w = i.naturalWidth * scale, h = i.naturalHeight * scale; ctx.drawImage(i, x - w / 2, y - h / 2, w, h); }
      else { var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 1, x, y, r); g.addColorStop(0, "#c9bda7"); g.addColorStop(1, "#867d75"); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.85, -0.2, 0, Math.PI * 2); ctx.fill(); }
    });
  }
  function drawShip() {
    var x = ship.x * W, y = ship.y * H, i = image("ship"); ctx.save(); ctx.translate(x, y);
    // the pad's cushion slowing the last stretch (after two misses)
    if (cushion && canPlay()) { ctx.fillStyle = "rgba(157,223,210,.35)"; ctx.beginPath(); ctx.ellipse(0, shipH * 0.55, shipW * 0.7, shipH * 0.16, 0, 0, Math.PI * 2); ctx.fill(); }
    if (canPlay() && thrust && piloted) {
      var flame = shipH * (0.28 + Math.sin(time * 29) * 0.04); ctx.fillStyle = "#f5dc86"; ctx.beginPath(); ctx.moveTo(-shipW * 0.2, shipH * 0.36); ctx.quadraticCurveTo(-shipW * 0.18, shipH * 0.55, 0, shipH * 0.46 + flame); ctx.quadraticCurveTo(shipW * 0.18, shipH * 0.55, shipW * 0.2, shipH * 0.36); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff8d2"; ctx.beginPath(); ctx.ellipse(0, shipH * 0.5, shipW * 0.09, flame * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    }
    // The painted feet meet source y=.985. Offset that anchor onto the
    // published physical bottom, so a successful landing never floats.
    if (i) ctx.drawImage(i, -shipW / 2, -shipH * 0.485, shipW, shipH);
    else {
      ctx.fillStyle = "#e9e3cf"; ctx.strokeStyle = "#9b8f7b"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -shipH / 2); ctx.bezierCurveTo(shipW * 0.5, -shipH * 0.3, shipW * 0.35, shipH * 0.25, shipW * 0.25, shipH * 0.37); ctx.lineTo(-shipW * 0.25, shipH * 0.37); ctx.bezierCurveTo(-shipW * 0.35, shipH * 0.25, -shipW * 0.5, -shipH * 0.3, 0, -shipH / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#bf7b76"; ctx.beginPath(); ctx.moveTo(0, -shipH / 2); ctx.lineTo(shipW * 0.25, -shipH * 0.25); ctx.lineTo(-shipW * 0.25, -shipH * 0.25); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#7ebbc7"; ctx.beginPath(); ctx.arc(0, -shipH * 0.1, shipW * 0.19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#ad7771"; ctx.lineWidth = 4; [-1, 1].forEach(function (side) { ctx.beginPath(); ctx.moveTo(side * shipW * 0.22, shipH * 0.22); ctx.lineTo(side * shipW * 0.42, shipH * 0.46); ctx.lineTo(side * shipW * 0.25, shipH * 0.46); ctx.stroke(); });
    }
    if (!piloted && active) { ctx.strokeStyle = "rgba(242,250,219,.7)"; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.ellipse(0, shipH * 0.6, shipW * 0.75, 6, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  // the landing's celebration: a ring of light from the pad (one still glow
  // under Reduce Motion)
  function drawCheer() {
    var age = clock - cheerAt; if (age < 0 || age > BEAT || won) return;
    var x = pad.x * W, y = pad.y * H, k = calm ? 0.6 : age / BEAT, r = shipW * (0.8 + k * 2.2);
    ctx.save(); ctx.globalAlpha = calm ? 0.55 : Math.max(0, 1 - k);
    ctx.strokeStyle = "#f7efb7"; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, y - shipH * 0.4, r, r * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    var star = image("star"), size = Math.min(34, W * 0.08);
    if (star) for (var n = 0; n < 5; n++) { var a = -Math.PI * (0.1 + n * 0.2); ctx.drawImage(star, x + Math.cos(a) * r - size / 2, y - shipH * 0.4 + Math.sin(a) * r * 0.55 - size / 2, size, size); }
    ctx.restore();
  }
  function draw() {
    if (!ctx) return; ctx.clearRect(0, 0, W, H); background(); drawPad(); drawRocks(); drawGuide(); drawShip(); drawCheer();
    if (won) { var star = image("star"), size = Math.min(64, W * 0.16); if (star) ctx.drawImage(star, W / 2 - size / 2, playTop + 12, size, size); }
  }
  function input() { thrust = keys.thrust || thrustOwner !== null; steering = clamp((keys.right || rightOwner !== null ? 1 : 0) - (keys.left || leftOwner !== null ? 1 : 0) + thumbSteer, -1, 1); }
  function publish() {
    var lv = ladder();
    window.__space = { active: active, paused: paused, stage: stage, stages: stages, landed: landed, won: won, power: power,
      ship: { x: ship.x, y: ship.y, w: shipW / W, h: shipH / H, width: shipW / W, height: shipH / H, vx: ship.vx, vy: ship.vy },
      pad: { x: pad.x, y: pad.y, w: pad.w, width: pad.w }, vx: ship.vx, vy: ship.vy, gravity: gravity(), thrustAcceleration: THRUST, horizontalAcceleration: STEER, damping: damping(), verticalDamping: verticalDamping(),
      safeSpeed: safeVy(), safeVy: safeVy(), safeVx: safeVx(), tolerance: tolerance(), onPad: onPad(), piloted: piloted, thrust: thrust, steering: steering, retries: retries, legRetries: legRetries,
      misses: legRetries, ladder: lv, little: little, guide: guiding(), pull: active && !won && lv >= 3, cushion: cushion, nudged: nudged,
      celebrating: doneAt > 0, doneAt: doneAt, clock: clock, dones: dones, banner: $("spaceBanner") ? $("spaceBanner").textContent : "",
      obstacles: obstacles.map(function (o) { return { x: o.x, y: o.y, r: o.r }; }), playTop: playTop / H, groundY: groundY / H, spawn: { x: spawn.x, y: spawn.y }, width: W, height: H,
      owners: { left: leftOwner, right: rightOwner, thrust: thrustOwner }, coordinates: "normalized-to-canvas; vx/ax use canvas widths per second; vy/gravity/thrust use canvas heights per second; radii use width; power ticks during active play" };
  }
  function hud() {
    input(); var allowed = canPlay(); ["spaceLeft", "spaceThrust", "spaceRight"].forEach(function (id) { $(id).disabled = !allowed; });
    $("spaceLeft").setAttribute("aria-pressed", steering < -0.05 ? "true" : "false"); $("spaceRight").setAttribute("aria-pressed", steering > 0.05 ? "true" : "false"); $("spaceThrust").setAttribute("aria-pressed", thrust ? "true" : "false");
    $("spaceHelp").disabled = !allowed || thrust || Math.abs(steering) > 0.01;
    $("spacePower").hidden = !(active && power > 0 && !won); $("spacePowerFill").style.width = power / POWER * 100 + "%";
    var soft = (active && ladder() >= 3) || (Math.abs(ship.vy) <= safeVy() && Math.abs(ship.vx) <= safeVx()); $("spaceSpeed").textContent = !piloted ? "Ready to fly" : soft ? "Nice and gentle" : "Little engine bursts"; $("spaceLamp").classList.toggle("soft", soft && piloted);
    publish();
  }
  function banner(text) { $("spaceBanner").textContent = text; }
  function release(surface, id) { try { if (surface && id !== null && surface.hasPointerCapture(id)) surface.releasePointerCapture(id); } catch (e) {} }
  function stopInputs() {
    var l = leftOwner, r = rightOwner, t = thrustOwner, ls = leftSurface, rs = rightSurface, ts = thrustSurface;
    leftOwner = null; rightOwner = null; thrustOwner = null; leftSurface = null; rightSurface = null; thrustSurface = null; thumbSteer = 0; keys = { left: false, right: false, thrust: false }; thrust = false; steering = 0;
    release(ls, l); release(rs, r); release(ts, t);
  }
  // after two misses the banner keeps saying what to do for the whole flight
  function beginPilot() { if (!piloted) { piloted = true; last = 0; if (ladder() < 2) banner(SAY.fly); } }
  function controlDown(event, name) {
    if (!canPlay() || (event.button != null && event.button !== 0)) return;
    if (name === "left" && leftOwner !== null || name === "right" && rightOwner !== null || name === "thrust" && thrustOwner !== null) return;
    event.preventDefault();
    if (name === "left") { leftOwner = event.pointerId; leftSurface = event.currentTarget; }
    else if (name === "right") { rightOwner = event.pointerId; rightSurface = event.currentTarget; }
    else { thrustOwner = event.pointerId; thrustSurface = event.currentTarget; thumbOrigin = event.clientX; thumbSteer = 0; }
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (e) {} beginPilot(); hud();
  }
  function controlUp(event, name) {
    if (name === "left") { if (event.pointerId !== leftOwner) return; var ls = leftSurface, li = leftOwner; leftOwner = null; leftSurface = null; release(ls, li); }
    else if (name === "right") { if (event.pointerId !== rightOwner) return; var rs = rightSurface, ri = rightOwner; rightOwner = null; rightSurface = null; release(rs, ri); }
    else { if (event.pointerId !== thrustOwner) return; var ts = thrustSurface, ti = thrustOwner; thrustOwner = null; thrustSurface = null; thumbSteer = 0; release(ts, ti); }
    hud();
  }
  function keyName(event) { if (event.key === "ArrowLeft") return "left"; if (event.key === "ArrowRight") return "right"; if (event.key === "ArrowUp" || event.key === " " || event.code === "Space") return "thrust"; return ""; }
  function controls() {
    [["spaceLeft", "left"], ["spaceThrust", "thrust"], ["spaceRight", "right"]].forEach(function (p) {
      var s = $(p[0]); s.addEventListener("pointerdown", function (e) { controlDown(e, p[1]); }); s.addEventListener("pointerup", function (e) { controlUp(e, p[1]); }); s.addEventListener("pointercancel", function (e) { controlUp(e, p[1]); }); s.addEventListener("lostpointercapture", function (e) { controlUp(e, p[1]); });
    });
    $("spaceThrust").addEventListener("pointermove", function (event) { if (event.pointerId !== thrustOwner || !canPlay()) return; var dx = event.clientX - thumbOrigin; thumbSteer = Math.abs(dx) < 7 ? 0 : clamp(dx / (W * 0.18), -1, 1); hud(); });
    window.addEventListener("keydown", function (event) { var name = keyName(event); if (!name || !canPlay()) return; event.preventDefault(); if (event.repeat && !keys[name]) return; keys[name] = true; beginPilot(); hud(); });
    // Only a key that was really held as a flight control is swallowed: a
    // browser presses a focused button on Space's keyup, so swallowing every
    // Space would stop a keyboard or switch user pressing Let's fly, Hear it,
    // Keep flying, Fly again or Back to games.
    window.addEventListener("keyup", function (event) { var name = keyName(event); if (!name) return; var was = keys[name]; keys[name] = false; if (was) event.preventDefault(); hud(); });
    $("spaceHelp").onclick = function () { if (canPlay() && !thrust && Math.abs(steering) < 0.01) api.practice(); };
    window.addEventListener("resize", fit); window.addEventListener("blur", function () { stopInputs(); hud(); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    window.addEventListener("pagehide", function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; });
    window.addEventListener("pageshow", function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
  }
  // a real touchdown that did not land, or a rock bump: the same flight again
  // from the start, a little easier (the ladder), with no new word needed
  function retry(reason) {
    retries++; legRetries++; stopInputs(); ship.x = spawn.x; ship.y = spawn.y; ship.vx = 0; ship.vy = 0; piloted = false; cushion = false; last = 0;
    var lv = ladder(); banner(lv >= 3 ? SAY.again3 : lv >= 2 ? SAY.again2 : reason); api.sfx("tap"); hud();
  }
  function rockContact(o) {
    var x = ship.x * W, y = ship.y * H, r = o.r * W, ox = o.x * W, oy = o.y * H;
    var dx = ox - clamp(ox, x - shipW * 0.3, x + shipW * 0.3), dy = oy - clamp(oy, y - shipH * 0.4, y + shipH * 0.42);
    return dx * dx + dy * dy < r * r;
  }
  // after two misses a rock nudges the rocket aside, toward the pad, instead
  // of sending it back to the start
  function rockNudge(o) {
    var x = ship.x * W, y = ship.y * H, r = o.r * W, ox = o.x * W, oy = o.y * H;
    var cx = clamp(ox, x - shipW * 0.3, x + shipW * 0.3), cy = clamp(oy, y - shipH * 0.4, y + shipH * 0.42), dx = cx - ox, dy = cy - oy, d = Math.sqrt(dx * dx + dy * dy);
    if (d >= r) return;
    var nx = 0, ny = -1; if (d > 0.001) { nx = dx / d; ny = dy / d; }
    x += nx * (r - d + 0.5); y += ny * (r - d + 0.5);
    var vx = ship.vx * W, vy = ship.vy * H, vn = vx * nx + vy * ny;
    if (vn < 0) { vx -= vn * nx; vy -= vn * ny; }
    // resting on its top: slide off on the pad's side
    if (ny < -0.5) { var side = pad.x * W >= ox ? 1 : -1; if (vx * side < 30) vx = side * 30; }
    ship.x = x / W; ship.y = y / H; ship.vx = vx / W; ship.vy = vy / H; nudged++;
  }
  function touchdown() {
    ship.y = pad.y - shipH / H / 2; ship.x = clamp(ship.x, pad.x - onPad(), pad.x + onPad()); ship.vx = 0; ship.vy = 0; cushion = false;
    landed = Math.max(landed, stage + 1); active = false; power = 0; stopInputs();
    banner(landed === stages ? SAY.all : SAY.landed);
    try { api.sfx("correct"); if (api.face) api.face("cheer"); if (api.cheer) api.cheer("Soft landing!"); } catch (e) {}
    cheerAt = clock; doneAt = clock + BEAT; hud(); draw();
  }
  function contact() {
    if (ship.y + shipH / H / 2 < pad.y) return;
    var off = Math.abs(ship.x - pad.x), lv = ladder();
    // from the 3rd miss any touchdown near the pad lands (and slides onto it)
    if (piloted && off <= tolerance() && (lv >= 3 || (Math.abs(ship.vx) <= safeVx() && ship.vy <= safeVy()))) touchdown();
    else retry(off > tolerance() ? SAY.pad1 : SAY.hard1);
  }
  function tick(dt) {
    if (!canPlay()) return;
    time += dt; power = Math.max(0, power - dt); input();
    if (!piloted) { hud(); return; }
    var lv = ladder(), ax = steering * STEER - ship.vx * damping();
    // from the 3rd miss the glow pulls the rocket over the pad as it falls;
    // steering still moves it, but never off the pad's light
    if (lv >= 3) ax = steering * STEER * 0.5 + (clamp((pad.x - ship.x) * 1.4, -0.22, 0.22) - ship.vx) * 2.2;
    ship.vx += ax * dt;
    ship.vy += (gravity() - (thrust ? THRUST : 0) - ship.vy * verticalDamping()) * dt;
    // after two misses the last stretch above the pad slows a falling rocket
    var gap = pad.y - (ship.y + shipH / H / 2), cap = safeVy() * 0.75;
    cushion = lv >= 2 && gap < 0.2 && Math.abs(ship.x - pad.x) <= tolerance() + 0.04 && ship.vy > 0;
    if (cushion && ship.vy > cap) ship.vy -= (ship.vy - cap) * Math.min(1, dt * 8);
    ship.vx = clamp(ship.vx, -0.45, 0.45); ship.vy = clamp(ship.vy, -0.48, 0.55);
    ship.x += ship.vx * dt; ship.y += ship.vy * dt;
    var edge = shipW / W / 2 + 0.012, ceiling = (playTop + shipH / 2) / H;
    if (ship.x < edge) { ship.x = edge; ship.vx = Math.max(0, ship.vx * -0.15); } else if (ship.x > 1 - edge) { ship.x = 1 - edge; ship.vx = Math.min(0, ship.vx * -0.15); }
    if (ship.y < ceiling) { ship.y = ceiling; ship.vy = Math.max(0, ship.vy); }
    for (var n = 0; n < obstacles.length; n++) if (rockContact(obstacles[n])) { if (lv >= 2) rockNudge(obstacles[n]); else { retry(SAY.rock1); return; } }
    contact(); hud();
  }
  function frame(now) {
    var dt = last ? Math.min(0.04, (now - last) / 1000) : 0; last = now;
    // the celebration beat runs on play time only: a pause or a hidden page
    // holds it, and the step is reported exactly once when it ends
    if (live()) { clock += dt; if (!active && !won) time += dt; if (doneAt && clock >= doneAt) { doneAt = 0; dones++; publish(); if (api) api.done(); } }
    tick(dt); draw(); raf = requestAnimationFrame(frame);
  }
  function earnPower(line) { power = POWER; paused = false; active = true; last = 0; banner(line); hud(); }
  function pause() { paused = true; last = 0; stopInputs(); hud(); }
  function reset() { stopInputs(); active = false; paused = false; stage = 0; landed = 0; won = false; power = 0; piloted = false; cushion = false; retries = 0; legRetries = 0; nudged = 0; time = 0; last = 0; doneAt = 0; cheerAt = -9; level(); ship = { x: spawn.x, y: spawn.y, vx: 0, vy: 0 }; banner(SAY.ready); hud(); draw(); }
  window.Space = {
    init: function (a, n) {
      api = a; stages = n || 8; cv = $("spaceCanvas"); ctx = cv.getContext("2d");
      try { calm = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}
      loadArt(); controls(); fit(); reset(); raf = requestAnimationFrame(frame);
      // the banner's font can arrive after the first fit: measure again then
      try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!piloted) fit(); }); } catch (e) {}
    },
    // the word brings the next flight: the rocket waits at the start for a finger
    onWord: function (index) { stage = index; stopInputs(); level(); ship = { x: spawn.x, y: spawn.y, vx: 0, vy: 0 }; piloted = false; cushion = false; legRetries = 0; doneAt = 0; earnPower(SAY.word); },
    // the optional help word: easy flight for the same flight, right where it is
    onHelp: function () { earnPower(ladder() >= 2 ? $("spaceBanner").textContent : SAY.help); },
    pause: pause,
    resume: function (playing) { paused = playing === false; last = 0; hud(); },
    reset: reset,
    finale: function () { stopInputs(); active = false; power = 0; doneAt = 0; cushion = false; won = true; banner(SAY.won); hud(); draw(); },
    // ages 2 to 4 get the gentler ladder (the page asks Sona.playStyle)
    setLittle: function (on) { little = !!on; if (cv) hud(); }
  };
})();
