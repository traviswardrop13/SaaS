/* Rocket Blast is a pull-back toy, not a spoken countdown animation.
   SayPlay owns every word, microphone turn, repetition and sound. */
(function () {
  "use strict";
  var api, cv, ctx, art = {}, W = 390, H = 844, raf = 0, last = 0, clock = 0;
  var active = false, paused = false, away = false, won = false, stage = 0, stages = 5, arrived = 0, retries = 0, power = 0;
  var state = "ready", origin = { x: 0.5, y: 1 }, ship = { x: 0.5, y: 1, vx: 0, vy: 0 }, pull = { x: 0, y: 0 };
  var target = { x: 0.5, y: 0.5 }, assist = { radius: 0.12, wind: 0, fullPath: false };
  var top = 120, bottom = 740, foot = 490, shipH = 70, shipW = 50, maxPull = 0.27, minPull = 0.035, gain = 6.2, gravity = 1.25;
  var normalRadius = 0.085, easyRadius = 0.125, flightTime = 0, owner = null, ownerSurface = null, grab = { x: 0, y: 0 }, keyboardPull = false, trail = [], launches = 0;
  var TARGET_X = [0.5, 0.72, 0.28, 0.66, 0.34], RISE = [0.52, 0.63, 0.57, 0.68, 0.64], WINDS = [0, 0.022, -0.02, 0.026, -0.024], POWER = 10;
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function canPlay() { return active && !paused && !away && !won && !document.hidden; }
  function banner(text) { if ($("rocketBanner").textContent !== text) $("rocketBanner").textContent = text; }
  function img(name) { var i = art[name]; return i && i.complete && i.naturalWidth ? i : null; }
  function loadArt() {
    [["bg", "rocket-bg.webp"], ["ship", "space-lander-idle-v1.webp"], ["mint", "rocket-planet-mint-v1.webp"], ["lavender", "rocket-planet-lavender-v1.webp"], ["rings", "space-planet-ring.webp"], ["star", "star.webp"]].forEach(function (p) { var i = new Image(); i.onload = draw; i.src = "/assets/crafted/game/" + p[1]; art[p[0]] = i; });
  }
  function radius() { return state === "flight" || state === "arrived" ? assist.radius : power > 0 ? easyRadius : normalRadius; }
  function wind() { return state === "flight" ? assist.wind : power > 0 ? 0 : WINDS[stage]; }
  function point(p) { return { x: p.x, y: p.y * W / H }; }
  function setAtPad() { ship.x = origin.x; ship.y = origin.y; ship.vx = 0; ship.vy = 0; pull.x = 0; pull.y = 0; flightTime = 0; keyboardPull = false; state = "ready"; trail = []; }
  function level() {
    var room = Math.max(70, bottom - top), rise = Math.max(0.04, (origin.y * W - top - easyRadius * W - 3) / W);
    target.x = TARGET_X[stage]; target.y = origin.y - Math.min(RISE[stage], rise * (stage === 0 ? 0.88 : 0.96));
    // The same width-based ballistic equations work on a short landscape
    // board: a shorter pull then has enough spring strength to reach a side ring.
    var needed = Math.sqrt(gravity * (rise + Math.sqrt(rise * rise + 0.24 * 0.24))) * 1.3;
    gain = Math.max(6.2, needed / (maxPull * 0.85));
    assist = { radius: power > 0 ? easyRadius : normalRadius, wind: power > 0 ? 0 : WINDS[stage], fullPath: power > 0 };
  }
  function fit() {
    if (!cv) return;
    var oldRatio = H / W, rect = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, rect.width); H = Math.max(1, rect.height); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    top = $("rocketBanner").getBoundingClientRect().bottom - rect.top + 12;
    bottom = $("rocketControls").getBoundingClientRect().top - rect.top - 12;
    var room = Math.max(80, bottom - top); shipH = Math.min(94, W * 0.19, room * 0.27); shipW = shipH * 367 / 512;
    normalRadius = Math.min(clamp(W * 0.085, 28, 54), room * 0.165) / W; easyRadius = Math.min(clamp(W * 0.125, 36, 76), room * 0.21) / W;
    foot = clamp(H * 0.588, top + room * 0.52, bottom - Math.min(W * 0.29, room * 0.25) - shipH * 0.1);
    origin = { x: 0.5, y: (foot - shipH * 0.485) / W };
    maxPull = Math.min(0.27, Math.max(0.045, (bottom - origin.y * W - shipH / 2 - 6) / W)); minPull = Math.min(0.035, maxPull * 0.25);
    var oldAssist = assist; cancelPull(); level();
    if (state === "flight") { ship.y = ship.y / oldRatio * H / W; assist = oldAssist; }
    else if (state === "arrived") { ship.x = target.x; ship.y = target.y; }
    else setAtPad();
    hud(); draw();
  }
  function snapshot() {
    var path = prediction(), o = point(origin), s = point(ship), t = point(target);
    window.__rocket = { active: active, paused: paused, stage: stage, stages: stages, arrived: arrived, retries: retries, launches: launches, won: won, state: state, power: power,
      origin: o, rocket: { x: s.x, y: s.y, w: shipW / W, h: shipH / H }, pull: { x: pull.x, y: pull.y, length: Math.sqrt(pull.x * pull.x + pull.y * pull.y), min: minPull, max: maxPull },
      velocity: { x: ship.vx, y: ship.vy }, velocityPixels: { x: ship.vx * W, y: ship.vy * W }, target: { x: t.x, y: t.y, r: radius() }, gain: gain, gravity: gravity, wind: wind(), path: path,
      assist: { radius: assist.radius, wind: assist.wind, fullPath: assist.fullPath }, held: owner !== null, pointerId: owner, keyboardPull: keyboardPull, flightTime: flightTime, width: W, height: H,
      coordinates: "x/y normalized to canvas; pull, radius, velocity and acceleration use canvas width. Flight starts at the actual pulled rocket position." };
  }
  function hud() {
    if (!cv) return;
    var enabled = canPlay(), button = $("rocketPull"); button.disabled = !enabled || state === "flight" || state === "arrived"; button.hidden = state === "flight" || state === "arrived";
    button.style.left = (ship.x * W) + "px"; button.style.top = (ship.y * W) + "px"; button.style.width = Math.max(64, shipW * 1.5) + "px"; button.style.height = Math.max(64, shipH * 1.12) + "px";
    button.setAttribute("aria-pressed", state === "pulling" ? "true" : "false");
    $("rocketHelp").disabled = !enabled || owner !== null; $("rocketRetry").disabled = !enabled || (state !== "flight" && state !== "pulling");
    $("rocketPower").hidden = power <= 0; $("rocketPowerFill").style.width = Math.max(0, power / POWER * 100) + "%";
    $("rocketHint").textContent = state === "flight" ? "Up, up... aim for the glow!" : state === "pulling" ? "Let go to fly!" : "Pull down. Let go!";
    snapshot();
  }
  function background() {
    var i = img("bg");
    if (i) { var scale = Math.max(W / i.naturalWidth, H / i.naturalHeight), w = i.naturalWidth * scale, h = i.naturalHeight * scale; ctx.drawImage(i, (W - w) / 2, foot - h * 0.588, w, h); }
    else { var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#272c55"); g.addColorStop(0.65, "#767394"); g.addColorStop(1, "#d5bea7"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = "rgba(33,39,69,.09)"; ctx.fillRect(0, 0, W, H);
    // Faint little destination stars are scenery, never touch targets.
    for (var n = 0; n < 12; n++) { var sx = ((n * 137.13 + 23) % 100) / 100 * W, sy = top + ((n * 47.7) % 100) / 100 * Math.max(40, origin.y * W - top); ctx.fillStyle = "rgba(255,248,209,.65)"; ctx.beginPath(); ctx.arc(sx, sy, n % 3 === 0 ? 2 : 1, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawTarget() {
    var x = target.x * W, y = target.y * W, r = radius() * W, i = img(stage === 1 || stage === 4 ? "rings" : stage === 3 ? "lavender" : "mint");
    ctx.save(); ctx.translate(x, y); ctx.shadowColor = "#efffe0"; ctx.shadowBlur = 22; ctx.fillStyle = "rgba(224,255,223,.14)"; ctx.beginPath(); ctx.arc(0, 0, r + 7, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    if (i) { var size = r * (stage === 1 || stage === 4 ? 1.85 : 1.52), sc = size / Math.max(i.naturalWidth, i.naturalHeight); ctx.drawImage(i, -i.naturalWidth * sc / 2, -i.naturalHeight * sc / 2, i.naturalWidth * sc, i.naturalHeight * sc); }
    else { var wash = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 1, 0, 0, r); wash.addColorStop(0, stage === 3 ? "#e0d1ec" : "#cbe3d8"); wash.addColorStop(1, stage === 3 ? "#9588b9" : "#83b5af"); ctx.fillStyle = wash; ctx.beginPath(); ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "rgba(93,126,137,.22)"; [[-.3,-.2,.2],[.28,.12,.16],[-.1,.4,.12]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0] * r, p[1] * r, p[2] * r, 0, Math.PI * 2); ctx.fill(); }); }
    ctx.strokeStyle = "#fff4bd"; ctx.lineWidth = 4; ctx.shadowColor = "#fffbd5"; ctx.shadowBlur = 13; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,245,.7)"; ctx.lineWidth = 1.5; ctx.setLineDash([2, 7]); ctx.beginPath(); ctx.arc(0, 0, r + 7, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    for (var n = 0; n < arrived; n++) { var a = -Math.PI / 2 + n * Math.PI * 2 / 5; ctx.fillStyle = "#fff5bf"; ctx.beginPath(); ctx.arc(Math.cos(a) * (r + 12), Math.sin(a) * (r + 12), 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function prediction() {
    if (!canPlay() || (state !== "pulling" && state !== "flight")) return [];
    var flying = state === "flight", vx = flying ? ship.vx : -pull.x * gain, vy = flying ? ship.vy : -pull.y * gain, full = flying ? assist.fullPath : power > 0, limit = full ? 3.2 : 0.32, result = [], wx = flying ? assist.wind : wind();
    for (var t = 0; t <= limit; t += 0.045) {
      var x = ship.x + vx * t + wx * t * t / 2, y = ship.y + vy * t + gravity * t * t / 2;
      if (x < -0.05 || x > 1.05 || y * W > bottom + 20 || y * W < top - shipH) break;
      result.push({ x: x, y: y * W / H }); if (Math.pow(x - target.x, 2) + Math.pow(y - target.y, 2) <= radius() * radius()) break;
    }
    return result;
  }
  function drawAim() {
    var path = prediction();
    ctx.save(); path.forEach(function (p, n) { if (n % 2) return; ctx.fillStyle = n < 5 ? "#fff9df" : "rgba(235,255,234,.73)"; ctx.beginPath(); ctx.arc(p.x * W, p.y * H, n < 5 ? 3 : 2.2, 0, Math.PI * 2); ctx.fill(); }); ctx.restore();
  }
  function drawLauncher() {
    var x = origin.x * W, y = foot, r = Math.min(W * 0.145, 70);
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = "rgba(51,57,74,.2)"; ctx.beginPath(); ctx.ellipse(0, 3, r, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#9cd2ca"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.24, 0, 0, Math.PI * 2); ctx.stroke();
    if (state === "pulling") { ctx.strokeStyle = "#e5dcbd"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-r * 0.65, -6); ctx.lineTo((ship.x - origin.x) * W, (ship.y - origin.y) * W - shipH * 0.15); ctx.lineTo(r * 0.65, -6); ctx.stroke(); }
    else if (state === "ready" && canPlay()) { var ay = origin.y * W + shipH * 0.65 - y, len = Math.min(maxPull * W * 0.58, 45); ctx.strokeStyle = "rgba(255,249,220,.88)"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(0, ay + len); ctx.moveTo(-8, ay + len - 9); ctx.lineTo(0, ay + len); ctx.lineTo(8, ay + len - 9); ctx.stroke(); }
    ctx.restore();
  }
  function drawShip() {
    var x = ship.x * W, y = ship.y * W, angle = state === "flight" ? Math.atan2(ship.vx, -ship.vy) : state === "pulling" ? clamp(-pull.x * 1.3, -0.35, 0.35) : 0;
    if (state === "arrived") angle = Math.sin(clock * 3) * 0.08;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    if (state === "flight") { var flame = shipH * (0.23 + Math.sin(clock * 35) * 0.035), nozzle = shipH * 0.43; ctx.fillStyle = "#f3cd7d"; ctx.beginPath(); ctx.moveTo(-shipW * 0.1, nozzle); ctx.quadraticCurveTo(-shipW * 0.13, nozzle + flame * 0.6, 0, nozzle + flame); ctx.quadraticCurveTo(shipW * 0.13, nozzle + flame * 0.6, shipW * 0.1, nozzle); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff9de"; ctx.beginPath(); ctx.ellipse(0, nozzle + flame * 0.28, shipW * 0.055, flame * 0.35, 0, 0, Math.PI * 2); ctx.fill(); }
    var i = img("ship");
    if (i) ctx.drawImage(i, -shipW / 2, -shipH / 2, shipW, shipH);
    else { ctx.fillStyle = "#faf3df"; ctx.beginPath(); ctx.moveTo(0, -shipH / 2); ctx.bezierCurveTo(shipW * 0.52, -shipH * 0.2, shipW * 0.3, shipH * 0.4, shipW * 0.24, shipH * 0.44); ctx.lineTo(-shipW * 0.24, shipH * 0.44); ctx.bezierCurveTo(-shipW * 0.3, shipH * 0.4, -shipW * 0.52, -shipH * 0.2, 0, -shipH / 2); ctx.fill(); ctx.fillStyle = "#b76b73"; ctx.beginPath(); ctx.moveTo(0, -shipH / 2); ctx.lineTo(shipW * 0.25, -shipH * 0.24); ctx.lineTo(-shipW * 0.25, -shipH * 0.24); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#71b5c4"; ctx.beginPath(); ctx.arc(0, -shipH * 0.08, shipW * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#c5bca2"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "#b76b73"; ctx.fillRect(-shipW * 0.44, shipH * 0.27, shipW * 0.2, shipH * 0.22); ctx.fillRect(shipW * 0.24, shipH * 0.27, shipW * 0.2, shipH * 0.22); }
    ctx.restore();
  }
  function draw() { if (!ctx) return; ctx.clearRect(0, 0, W, H); background(); drawTarget(); drawLauncher(); drawAim(); drawShip(); }
  function cancelPull() {
    var id = owner, surface = ownerSurface; owner = null; ownerSurface = null;
    if (id !== null && surface) try { if (surface.hasPointerCapture(id)) surface.releasePointerCapture(id); } catch (e) {}
    if (state === "pulling") setAtPad();
  }
  function setPull(x, y) {
    var length = Math.sqrt(x * x + y * y); if (length > maxPull) { x *= maxPull / length; y *= maxPull / length; }
    pull.x = x; pull.y = y; ship.x = origin.x + x; ship.y = origin.y + y; state = "pulling"; hud(); draw();
  }
  function pointerPoint(event) { var rect = cv.getBoundingClientRect(); return { x: (event.clientX - rect.left) / W, y: (event.clientY - rect.top) / W }; }
  function down(event) {
    if (!canPlay() || state === "flight" || state === "arrived" || owner !== null || (event.button !== undefined && event.button !== 0)) return;
    event.preventDefault(); var p = pointerPoint(event); owner = event.pointerId; ownerSurface = event.currentTarget; grab.x = p.x - ship.x; grab.y = p.y - ship.y; keyboardPull = false; state = "pulling";
    try { ownerSurface.setPointerCapture(owner); } catch (e) {} banner("Pull down, aim, and let go!"); hud();
  }
  function move(event) { if (event.pointerId !== owner || !canPlay()) return; event.preventDefault(); var p = pointerPoint(event); setPull(p.x - grab.x - origin.x, p.y - grab.y - origin.y); }
  function release(event, canceled) {
    if (event.pointerId !== owner) return; event.preventDefault(); var id = owner, surface = ownerSurface; owner = null; ownerSurface = null;
    if (surface) try { if (surface.hasPointerCapture(id)) surface.releasePointerCapture(id); } catch (e) {}
    if (canceled || !canPlay()) { setAtPad(); hud(); draw(); return; } launch();
  }
  function launch() {
    if (!canPlay() || state !== "pulling") return;
    var length = Math.sqrt(pull.x * pull.x + pull.y * pull.y);
    if (pull.y < minPull || length < minPull || pull.y < Math.abs(pull.x) * 0.25) { setAtPad(); banner("Pull the rocket down, then let go"); hud(); draw(); return; }
    assist = { radius: power > 0 ? easyRadius : normalRadius, wind: power > 0 ? 0 : WINDS[stage], fullPath: power > 0 };
    ship.vx = -pull.x * gain; ship.vy = -pull.y * gain; state = "flight"; keyboardPull = false; flightTime = 0; launches++; trail = []; banner("Fly through the glowing ring!"); api.sfx("tap"); hud();
  }
  function retry() { if (!canPlay()) return; cancelPull(); retries++; setAtPad(); banner("Another try! Pull down and aim for the glow"); hud(); draw(); }
  function segmentHits(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy, t = length2 ? clamp(((target.x - a.x) * dx + (target.y - a.y) * dy) / length2, 0, 1) : 0;
    return Math.pow(a.x + dx * t - target.x, 2) + Math.pow(a.y + dy * t - target.y, 2) <= assist.radius * assist.radius;
  }
  function land() { ship.x = target.x; ship.y = target.y; ship.vx = 0; ship.vy = 0; state = "arrived"; arrived = Math.max(arrived, stage + 1); active = false; banner(arrived === stages ? "Five little space adventures!" : "You flew to a new little world!"); api.sfx("correct"); hud(); draw(); api.done(); }
  function tick(dt) {
    if (!canPlay()) return; clock += dt; power = Math.max(0, power - dt);
    if (state === "flight") {
      flightTime += dt; var before = { x: ship.x, y: ship.y };
      ship.x += ship.vx * dt + assist.wind * dt * dt / 2; ship.y += ship.vy * dt + gravity * dt * dt / 2; ship.vx += assist.wind * dt; ship.vy += gravity * dt;
      if (segmentHits(before, ship)) { land(); return; }
      if (ship.x < -0.12 || ship.x > 1.12 || ship.y * W < top - shipH || ship.y * W > bottom + shipH || flightTime > 5) { retry(); return; }
    }
    hud();
  }
  function frame(now) { var dt = last ? Math.min(0.045, (now - last) / 1000) : 0; last = now; tick(dt); draw(); raf = requestAnimationFrame(frame); }
  function earnPower() { power = POWER; paused = false; active = true; last = 0; if (state === "flight") { assist.radius = Math.max(assist.radius, easyRadius); assist.wind = 0; assist.fullPath = true; } banner(state === "flight" ? "A wider ring for your rocket!" : "Big ring! Pull down, aim, and let go"); hud(); }
  function pause() { paused = true; last = 0; cancelPull(); hud(); }
  function controls() {
    var button = $("rocketPull"); button.addEventListener("pointerdown", down); button.addEventListener("pointermove", move); button.addEventListener("pointerup", function (e) { release(e, false); }); button.addEventListener("pointercancel", function (e) { release(e, true); }); button.addEventListener("lostpointercapture", function (e) { release(e, true); });
    button.addEventListener("keydown", function (event) {
      if (!canPlay() || state === "flight" || state === "arrived" || owner !== null) return;
      var key = event.key, dx = 0, dy = 0, stepSize = maxPull * (event.shiftKey ? 0.035 : 0.13);
      if (key === "ArrowDown") dy = stepSize; else if (key === "ArrowUp") dy = -stepSize; else if (key === "ArrowLeft") dx = -stepSize; else if (key === "ArrowRight") dx = stepSize;
      else if (key === "Enter" || key === " ") { event.preventDefault(); if (!event.repeat) launch(); return; }
      else if (key === "Escape") { event.preventDefault(); cancelPull(); hud(); draw(); return; } else return;
      event.preventDefault(); keyboardPull = true; setPull(pull.x + dx, pull.y + dy); banner("Press Enter to let go!");
    });
    $("rocketRetry").onclick = retry; $("rocketHelp").onclick = function () { if (canPlay() && owner === null) api.practice(); };
    window.addEventListener("resize", fit); window.addEventListener("blur", function () { cancelPull(); hud(); }); document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    window.addEventListener("pagehide", function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; }); window.addEventListener("pageshow", function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
  }
  function reset() { cancelPull(); active = false; paused = false; won = false; stage = 0; arrived = 0; retries = 0; launches = 0; power = 0; clock = 0; last = 0; level(); setAtPad(); banner("Ready for a little rocket adventure?"); hud(); draw(); }
  window.Rocket = {
    init: function (a, n) { api = a; stages = n || 5; cv = $("rocketCanvas"); ctx = cv.getContext("2d"); loadArt(); controls(); fit(); reset(); raf = requestAnimationFrame(frame); },
    onWord: function (index) { cancelPull(); stage = index; level(); setAtPad(); earnPower(); },
    onHelp: earnPower, pause: pause, resume: function (playing) { paused = playing === false; last = 0; hud(); }, reset: reset,
    finale: function () { cancelPull(); active = false; won = true; power = 0; state = "arrived"; banner("Five worlds, flown by you!"); hud(); draw(); }
  };
})();
