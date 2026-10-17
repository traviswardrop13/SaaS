/* Space Trip: eight actual piloted landings. Gravity, inertia and held
   engines move the rocket; only a soft pad contact can finish a leg.
   SayPlay owns speech, audio, microphone and every repetition. */
(function () {
  "use strict";
  var api, cv, ctx, W = 390, H = 844, raf = 0, last = 0, time = 0, art = {};
  var active = false, paused = false, away = false, stage = 0, stages = 8, landed = 0, won = false, power = 0;
  var ship = { x: 0.77, y: 0.3, vx: 0, vy: 0 }, spawn = { x: 0.77, y: 0.3 }, pad = { x: 0.5, y: 0.8, w: 0.32 };
  var shipW = 42, shipH = 74, playTop = 150, groundY = 680, obstacles = [], piloted = false, retries = 0, legRetries = 0;
  var leftOwner = null, rightOwner = null, thrustOwner = null, leftSurface = null, rightSurface = null, thrustSurface = null, thumbOrigin = 0, thumbSteer = 0;
  var keys = { left: false, right: false, thrust: false }, thrust = false, steering = 0;
  var PAD_X = [0.5, 0.72, 0.28, 0.58, 0.22, 0.78, 0.4, 0.6], PAD_W = [0.32, 0.3, 0.3, 0.28, 0.29, 0.28, 0.27, 0.26];
  var GRAVITY = [0.12, 0.13, 0.115, 0.14, 0.125, 0.145, 0.13, 0.15];
  var ROCKS = [[], [], [[0.53, 0.54, 0.045]], [[0.24, 0.62, 0.05]], [[0.61, 0.54, 0.045]], [[0.45, 0.57, 0.04]], [[0.71, 0.64, 0.04]], [[0.24, 0.5, 0.04], [0.81, 0.58, 0.04]]];
  var POWER = 10, THRUST = 0.34, STEER = 0.36;
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function canPlay() { return active && !paused && !away && !won && !document.hidden; }
  function gravity() { return GRAVITY[stage] * (power > 0 ? 0.55 : 1); }
  function damping() { return power > 0 ? 1.6 : 0.65; }
  function verticalDamping() { return power > 0 ? 0.18 : 0.05; }
  function safeVy() { return power > 0 ? 0.19 : 0.135; }
  function safeVx() { return power > 0 ? 0.18 : 0.12; }
  function tolerance() { return Math.max(0.02, pad.w / 2 - shipW * 0.35 / W) + (power > 0 ? 0.035 : 0); }
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
  function fit() {
    if (!cv) return;
    var rect = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    playTop = $("spaceBanner").getBoundingClientRect().bottom - rect.top + 24;
    groundY = $("spaceControls").getBoundingClientRect().top - rect.top - (W > H && H < 500 ? 28 : 80);
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
  function drawPad() {
    var x = pad.x * W, y = pad.y * H, w = pad.w * W, easy = power > 0;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = easy ? "rgba(157,223,210,.23)" : "rgba(246,244,205,.16)"; ctx.beginPath(); ctx.ellipse(0, 0, w / 2 + (easy ? W * 0.035 : 0), 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(245,252,220,.6)"; ctx.lineWidth = 2; ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.moveTo(0, -65); ctx.lineTo(0, -12); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = "#887b67"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-w / 2, 8); ctx.lineTo(-w / 2 + 9, -2); ctx.lineTo(w / 2 - 9, -2); ctx.lineTo(w / 2, 8); ctx.stroke();
    ctx.fillStyle = "#e8efe0"; ctx.fillRect(-w / 2, -5, w, 8); ctx.fillStyle = "#4d9da4"; ctx.fillRect(-w / 2 + 5, -5, w - 10, 4);
    [-1, 1].forEach(function (side) { ctx.fillStyle = "#e9d69c"; ctx.shadowColor = "#f7efb7"; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(side * w / 2, -5, 4, 0, Math.PI * 2); ctx.fill(); }); ctx.restore();
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
  function draw() {
    if (!ctx) return; ctx.clearRect(0, 0, W, H); background(); drawPad(); drawRocks(); drawShip();
    if (won) { var star = image("star"), size = Math.min(64, W * 0.16); if (star) ctx.drawImage(star, W / 2 - size / 2, playTop + 12, size, size); }
  }
  function input() { thrust = keys.thrust || thrustOwner !== null; steering = clamp((keys.right || rightOwner !== null ? 1 : 0) - (keys.left || leftOwner !== null ? 1 : 0) + thumbSteer, -1, 1); }
  function publish() {
    window.__space = { active: active, paused: paused, stage: stage, stages: stages, landed: landed, won: won, power: power,
      ship: { x: ship.x, y: ship.y, w: shipW / W, h: shipH / H, width: shipW / W, height: shipH / H, vx: ship.vx, vy: ship.vy },
      pad: { x: pad.x, y: pad.y, w: pad.w, width: pad.w }, vx: ship.vx, vy: ship.vy, gravity: gravity(), thrustAcceleration: THRUST, horizontalAcceleration: STEER, damping: damping(), verticalDamping: verticalDamping(),
      safeSpeed: safeVy(), safeVy: safeVy(), safeVx: safeVx(), tolerance: tolerance(), piloted: piloted, thrust: thrust, steering: steering, retries: retries, legRetries: legRetries,
      obstacles: obstacles.map(function (o) { return { x: o.x, y: o.y, r: o.r }; }), playTop: playTop / H, groundY: groundY / H, spawn: { x: spawn.x, y: spawn.y }, width: W, height: H,
      owners: { left: leftOwner, right: rightOwner, thrust: thrustOwner }, coordinates: "normalized-to-canvas; vx/ax use canvas widths per second; vy/gravity/thrust use canvas heights per second; radii use width; power ticks during active play" };
  }
  function hud() {
    input(); var allowed = canPlay(); ["spaceLeft", "spaceThrust", "spaceRight"].forEach(function (id) { $(id).disabled = !allowed; });
    $("spaceLeft").setAttribute("aria-pressed", steering < -0.05 ? "true" : "false"); $("spaceRight").setAttribute("aria-pressed", steering > 0.05 ? "true" : "false"); $("spaceThrust").setAttribute("aria-pressed", thrust ? "true" : "false");
    $("spaceHelp").disabled = !allowed || thrust || Math.abs(steering) > 0.01;
    $("spacePower").hidden = !(active && power > 0 && !won); $("spacePowerFill").style.width = power / POWER * 100 + "%";
    var soft = Math.abs(ship.vy) <= safeVy() && Math.abs(ship.vx) <= safeVx(); $("spaceSpeed").textContent = !piloted ? "Ready to fly" : soft ? "Nice and gentle" : "Little engine bursts"; $("spaceLamp").classList.toggle("soft", soft && piloted);
    publish();
  }
  function banner(text) { $("spaceBanner").textContent = text; }
  function release(surface, id) { try { if (surface && id !== null && surface.hasPointerCapture(id)) surface.releasePointerCapture(id); } catch (e) {} }
  function stopInputs() {
    var l = leftOwner, r = rightOwner, t = thrustOwner, ls = leftSurface, rs = rightSurface, ts = thrustSurface;
    leftOwner = null; rightOwner = null; thrustOwner = null; leftSurface = null; rightSurface = null; thrustSurface = null; thumbSteer = 0; keys = { left: false, right: false, thrust: false }; thrust = false; steering = 0;
    release(ls, l); release(rs, r); release(ts, t);
  }
  function beginPilot() { if (!piloted) { piloted = true; last = 0; banner("Aim for the glow. Land gently"); } }
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
    window.addEventListener("keyup", function (event) { var name = keyName(event); if (!name) return; event.preventDefault(); keys[name] = false; hud(); });
    $("spaceHelp").onclick = function () { if (canPlay() && !thrust && Math.abs(steering) < 0.01) api.practice(); };
    window.addEventListener("resize", fit); window.addEventListener("blur", function () { stopInputs(); hud(); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    window.addEventListener("pagehide", function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; });
    window.addEventListener("pageshow", function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
  }
  function retry(reason) {
    retries++; legRetries++; stopInputs(); ship.x = spawn.x; ship.y = spawn.y; ship.vx = 0; ship.vy = 0; piloted = false; last = 0; banner(reason); api.sfx("tap"); hud();
  }
  function rockContact(o) {
    var x = ship.x * W, y = ship.y * H, r = o.r * W, ox = o.x * W, oy = o.y * H;
    var dx = ox - clamp(ox, x - shipW * 0.3, x + shipW * 0.3), dy = oy - clamp(oy, y - shipH * 0.4, y + shipH * 0.42);
    return dx * dx + dy * dy < r * r;
  }
  function contact() {
    if (ship.y + shipH / H / 2 < pad.y) return;
    if (piloted && Math.abs(ship.x - pad.x) <= tolerance() && Math.abs(ship.vx) <= safeVx() && ship.vy <= safeVy()) {
      ship.y = pad.y - shipH / H / 2; ship.vx = 0; ship.vy = 0; landed = Math.max(landed, stage + 1); active = false; power = 0; stopInputs(); banner(landed === stages ? "Eight gentle landings!" : "A soft landing. Nice flying!"); api.sfx("correct"); hud(); draw(); api.done();
    } else retry(Math.abs(ship.x - pad.x) > tolerance() ? "Try the glowing pad. Same flight!" : "Little engine bursts make a soft landing");
  }
  function tick(dt) {
    if (!canPlay()) return;
    time += dt; power = Math.max(0, power - dt); input();
    if (!piloted) { hud(); return; }
    ship.vx += (steering * STEER - ship.vx * damping()) * dt;
    ship.vy += (gravity() - (thrust ? THRUST : 0) - ship.vy * verticalDamping()) * dt;
    ship.vx = clamp(ship.vx, -0.45, 0.45); ship.vy = clamp(ship.vy, -0.48, 0.55);
    ship.x += ship.vx * dt; ship.y += ship.vy * dt;
    var edge = shipW / W / 2 + 0.012, ceiling = (playTop + shipH / 2) / H;
    if (ship.x < edge) { ship.x = edge; ship.vx = Math.max(0, ship.vx * -0.15); } else if (ship.x > 1 - edge) { ship.x = 1 - edge; ship.vx = Math.min(0, ship.vx * -0.15); }
    if (ship.y < ceiling) { ship.y = ceiling; ship.vy = Math.max(0, ship.vy); }
    for (var n = 0; n < obstacles.length; n++) if (rockContact(obstacles[n])) { retry("Go around that rock. Try again!"); return; }
    contact(); hud();
  }
  function frame(now) { var dt = last ? Math.min(0.04, (now - last) / 1000) : 0; last = now; tick(dt); draw(); raf = requestAnimationFrame(frame); }
  function earnPower() { power = POWER; paused = false; active = true; last = 0; banner("Easy flight. Aim for the glowing pad"); hud(); }
  function pause() { paused = true; last = 0; stopInputs(); hud(); }
  function reset() { stopInputs(); active = false; paused = false; stage = 0; landed = 0; won = false; power = 0; piloted = false; retries = 0; legRetries = 0; time = 0; last = 0; level(); ship = { x: spawn.x, y: spawn.y, vx: 0, vy: 0 }; banner("Ready for a little space trip?"); hud(); draw(); }
  window.Space = {
    init: function (a, n) { api = a; stages = n || 8; cv = $("spaceCanvas"); ctx = cv.getContext("2d"); loadArt(); controls(); fit(); reset(); raf = requestAnimationFrame(frame); },
    onWord: function (index) { stage = index; stopInputs(); level(); ship = { x: spawn.x, y: spawn.y, vx: 0, vy: 0 }; piloted = false; legRetries = 0; earnPower(); },
    onHelp: earnPower,
    pause: pause,
    resume: function (playing) { paused = playing === false; last = 0; hud(); },
    reset: reset,
    finale: function () { stopInputs(); active = false; power = 0; won = true; banner("A space trip, flown by you!"); hud(); draw(); }
  };
})();
