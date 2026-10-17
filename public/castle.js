/* Castle Builder: move the crane, then hold Lower to make actual aligned
   contact with a planned architectural slot. Speech steadies the rope;
   SayPlay owns every word, microphone, voice and repetition. */
(function () {
  "use strict";
  var api, cv, ctx, W = 390, H = 844, raf = 0, last = 0, time = 0;
  var active = false, paused = false, away = false, stage = 0, stages = 8, placed = 0, won = false;
  var power = 0, craneX = 0.2, rope = 24, minRope = 24, maxRope = 500, railY = 150, groundY = 650, unit = 320;
  var swing = 0.035, velocity = 0, lowering = false, hoisting = false, misses = 0;
  var drag = null, dragSurface = null, dragOffset = 0, lowerPointer = null, lowerSurface = null, lowerKey = false;
  var art = {}, slots = [], POWER = 10;
  var PARTS = [
    { key: "keep", label: "The castle keep", x: 0.5, bottom: 0, w: 0.36, h: 0.36 * 372 / 361 },
    { key: "wall-left", label: "The left wall", x: 0.27, bottom: 0, w: 0.27, h: 0.27 * 190 / 415 },
    { key: "wall-right", label: "The right wall", x: 0.73, bottom: 0, w: 0.27, h: 0.27 * 191 / 406 },
    { key: "tower-left", label: "The left tower", x: 0.1, bottom: 0, w: 0.2, h: 0.2 * 393 / 187 },
    { key: "tower-right", label: "The right tower", x: 0.9, bottom: 0, w: 0.2, h: 0.2 * 391 / 189 },
    { key: "roof", label: "The grand roof", x: 0.5, bottom: 0.336, w: 0.215, h: 0.215 * 259 / 319 },
    { key: "gate", label: "The front gate", x: 0.5, bottom: 0, w: 0.17, h: 0.17 * 317 / 303 },
    { key: "flags", label: "The castle flags", x: 0.5, bottom: 0.42, w: 0.95, h: 0.255 }
  ];
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function canPlay() { return active && !paused && !away && !won && !document.hidden; }
  function image(name) { var i = art[name]; return i && i.complete && i.naturalWidth ? i : null; }
  function tolerance() { return clamp(W * 0.03, 8, 15) * (power > 0 ? 2.2 : 1); }
  function steadyFactor() { return power > 0 ? 0.12 : 1; }
  function slot() { return slots[stage] || { x: W * 0.5, y: groundY - 30, width: 60, height: 60, bottom: groundY }; }
  function piece() {
    var s = slot(), x = craneX * W + Math.sin(swing) * rope, top = railY + Math.cos(swing) * rope;
    return { x: x, y: top + s.height / 2, width: s.width, height: s.height, top: top, bottom: top + s.height, key: PARTS[stage].key };
  }
  function limits() { var half = slot().width / W / 2; return { min: Math.max(0.08, half + 0.02), max: Math.min(0.92, 0.98 - half) }; }
  function moveCrane(x) {
    var edge = limits(), next = clamp(x, edge.min, edge.max);
    velocity -= (next - craneX) * 1.8 * (power > 0 ? 0.3 : 1); craneX = next;
  }
  function loadArt() {
    var names = [["bg", "castle-beach-v1.webp"]];
    PARTS.forEach(function (p) { names.push([p.key, "castle-" + p.key + "-v1.webp"]); });
    names.forEach(function (p) { var i = new Image(); i.onload = draw; i.src = "/assets/crafted/game/" + p[1]; art[p[0]] = i; });
  }
  function fit() {
    if (!cv) return;
    var r = cv.getBoundingClientRect(), oldRange = maxRope - minRope, ropeFraction = oldRange > 0 ? (rope - minRope) / oldRange : 0;
    W = Math.max(1, r.width); H = Math.max(1, r.height); var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var bannerBottom = $("castleBanner").getBoundingClientRect().bottom - r.top;
    railY = bannerBottom + 44; groundY = Math.min(H * 0.8, $("castleControls").getBoundingClientRect().top - r.top - 24);
    minRope = clamp((groundY - railY) * 0.055, 8, 28); maxRope = Math.max(minRope + 25, groundY - railY);
    unit = Math.max(50, Math.min(W * 0.86, (groundY - railY - minRope - 12) / 0.70));
    slots = PARTS.map(function (p) { var w = p.w * unit, h = p.h * unit, bottom = groundY - p.bottom * unit; return { x: W * 0.5 + (p.x - 0.5) * unit, y: bottom - h / 2, width: w, height: h, bottom: bottom }; });
    rope = clamp(minRope + ropeFraction * (maxRope - minRope), minRope, maxRope);
    stopLower(); stopDrag(); var edge = limits(); craneX = clamp(craneX, edge.min, edge.max); hud(); draw();
  }
  function background() {
    var i = image("bg");
    if (i) { var scale = Math.max(W / i.naturalWidth, H / i.naturalHeight), w = i.naturalWidth * scale, h = i.naturalHeight * scale; ctx.drawImage(i, (W - w) / 2, (H - h) / 2, w, h); }
    else { var wash = ctx.createLinearGradient(0, 0, 0, H); wash.addColorStop(0, "#c2e6ee"); wash.addColorStop(0.5, "#e6f3e7"); wash.addColorStop(0.6, "#ddeddf"); wash.addColorStop(0.65, "#ead6a5"); wash.addColorStop(1, "#f4e2ba"); ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = "rgba(157,120,66,.14)"; ctx.beginPath(); ctx.ellipse(W / 2, groundY + 5, unit * 0.53, unit * 0.055, 0, 0, Math.PI * 2); ctx.fill();
  }
  function rounded(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function fallbackPart(key, w, h) {
    ctx.fillStyle = "#e8c995"; ctx.strokeStyle = "#c5a370"; ctx.lineWidth = 2;
    if (key === "roof") { ctx.fillStyle = "#d99491"; ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.lineTo(0, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.closePath(); ctx.fill(); ctx.stroke(); return; }
    if (key === "gate") { ctx.fillStyle = "#88684b"; rounded(-w / 2, -h / 2, w, h, w / 2); ctx.fill(); ctx.stroke(); ctx.strokeStyle = "#c6a06b"; ctx.lineWidth = 2; for (var slat = 1; slat < 4; slat++) { ctx.beginPath(); ctx.moveTo(-w / 2 + slat * w / 4, -h / 3); ctx.lineTo(-w / 2 + slat * w / 4, h / 2); ctx.stroke(); } return; }
    if (key === "flags") {
      [-0.39, 0, 0.39].forEach(function (x, index) { ctx.strokeStyle = "#b49b73"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x * w, h / 2); ctx.lineTo(x * w, -h / 2); ctx.stroke(); ctx.fillStyle = ["#78baca", "#d79598", "#e3cc7c"][index]; ctx.beginPath(); ctx.moveTo(x * w, -h / 2); ctx.lineTo(x * w + w * 0.17, -h * 0.18); ctx.lineTo(x * w, h * 0.05); ctx.closePath(); ctx.fill(); }); return;
    }
    var tower = key.indexOf("tower") === 0, roof = tower ? h * 0.27 : 0, top = -h / 2 + roof;
    rounded(-w / 2, top, w, h - roof, 4); ctx.fill(); ctx.stroke();
    if (tower) { ctx.fillStyle = key === "tower-left" ? "#7db7c7" : "#ddce89"; ctx.beginPath(); ctx.moveTo(-w * 0.58, top); ctx.lineTo(0, -h / 2); ctx.lineTo(w * 0.58, top); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else { ctx.fillStyle = "#efd8ae"; for (var tooth = 0; tooth < 4; tooth++) { var tw = w / 7; ctx.fillRect(-w / 2 + tooth * tw * 2, top - h * 0.08, tw, h * 0.13); } }
    ctx.strokeStyle = "rgba(173,130,76,.38)"; ctx.lineWidth = 1;
    for (var row = 1; row < 4; row++) { var yy = top + (h - roof) * row / 4; ctx.beginPath(); ctx.moveTo(-w / 2 + 2, yy); ctx.lineTo(w / 2 - 2, yy); ctx.stroke(); }
    ctx.fillStyle = "#856d58"; rounded(-w * 0.1, top + (h - roof) * 0.25, w * 0.2, h * 0.13, w * 0.1); ctx.fill();
  }
  function drawPart(key, p, alpha) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = alpha; var i = image(key);
    if (i && key === "flags") {
      // The final crane load remains one piece. Its three painted pole crops
      // have feet at the three real roof apexes, rather than floating above
      // a stretched rectangular group. Source pixels are never altered.
      var u = p.width / 0.95, base = p.height / 2;
      var flags = [
        { sx: 0, sy: 130, sw: 165, sh: 178, poleX: 32, poleY: 168, x: -0.4, y: 0.034, h: 0.11 },
        { sx: 160, sy: 0, sw: 130, sh: 308, poleX: 32, poleY: 298, x: 0, y: -0.082, h: 0.17 },
        // The red tip sits above the yellow flag. Two aligned rectangles
        // retain its whole tip without importing a yellow edge sliver.
        { sx: 290, sy: 0, sw: 44, sh: 130, poleX: -98, poleY: 298, x: 0, y: -0.082, h: 0.17 * 130 / 308 },
        { sx: 290, sy: 130, sw: 153, sh: 178, poleX: 27, poleY: 168, x: 0.4, y: 0.034, h: 0.11 }
      ];
      flags.forEach(function (f) { var scale = u * f.h / f.sh; ctx.drawImage(i, f.sx, f.sy, f.sw, f.sh, u * f.x - f.poleX * scale, base + u * f.y - f.poleY * scale, f.sw * scale, f.sh * scale); });
    } else if (i) ctx.drawImage(i, -p.width / 2, -p.height / 2, p.width, p.height); else fallbackPart(key, p.width, p.height);
    ctx.restore();
  }
  function ghost() {
    if (!active || won) return;
    var s = slot(); drawPart(PARTS[stage].key, s, 0.28);
    ctx.save(); ctx.strokeStyle = "#fcf9da"; ctx.lineWidth = 3; ctx.shadowColor = "#2596a1"; ctx.shadowBlur = 12; ctx.setLineDash([5, 5]);
    rounded(s.x - s.width / 2 - 3, s.y - s.height / 2 - 3, s.width + 6, s.height + 6, 7); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
    ctx.strokeStyle = "#258995"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x - tolerance(), s.bottom + 6); ctx.lineTo(s.x + tolerance(), s.bottom + 6); ctx.stroke(); ctx.restore();
  }
  function crane() {
    ctx.save();
    // A toy gantry and wheeled trolley. Only the load uses pendulum motion.
    ctx.fillStyle = "#f4e7c5"; ctx.strokeStyle = "#bca77c"; ctx.lineWidth = 2;
    rounded(15, railY - 33, W - 30, 12, 4); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(145,127,89,.6)"; ctx.lineWidth = 2; for (var beam = 24; beam < W - 28; beam += 34) { ctx.beginPath(); ctx.moveTo(beam, railY - 31); ctx.lineTo(beam + 24, railY - 23); ctx.stroke(); }
    var x = craneX * W; ctx.fillStyle = "#568b8b"; [-17, 17].forEach(function (dx) { ctx.beginPath(); ctx.arc(x + dx, railY - 22, 6, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = "#73bec3"; ctx.strokeStyle = "#397f86"; ctx.lineWidth = 2; rounded(x - 25, railY - 20, 50, 25, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#e8d6a3"; ctx.beginPath(); ctx.arc(x, railY - 6, 7, 0, Math.PI * 2); ctx.fill();
    if (active && !won) {
      var p = piece(), hookY = p.top;
      ctx.strokeStyle = "#756c5c"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, railY); ctx.lineTo(p.x, hookY); ctx.stroke();
      ctx.strokeStyle = "#b5a077"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, hookY - 5); ctx.lineTo(p.x, hookY + 1); ctx.stroke();
      drawPart(p.key, p, 1);
    }
    ctx.restore();
  }
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H); background();
    for (var n = 0; n < placed; n++) drawPart(PARTS[n].key, slots[n], 1);
    ghost(); if (!won) crane();
  }
  function normalized(p) { return { x: p.x / W, y: p.y / H, width: p.width / W, height: p.height / H, bottom: p.bottom / H, top: (p.top == null ? p.y - p.height / 2 : p.top) / H }; }
  function publish() {
    var p = piece(), s = slot(), edge = limits(), pp = normalized(p); pp.key = p.key;
    window.__castle = { active: active, paused: paused, stage: stage, stages: stages, placed: placed, power: power, craneX: craneX, railY: railY / H,
      piece: pp, slot: normalized(s), rope: rope / H, minRope: minRope / H, maxRope: maxRope / H, height: p.y / H, swing: swing, swingVelocity: velocity,
      swingEnvelope: power > 0 ? 0.025 : 0.2, steadyFactor: steadyFactor(), tolerance: tolerance() / W, tolerancePx: tolerance(), lowering: lowering, hoisting: hoisting,
      dragging: drag !== null, pointerId: drag, misses: misses, won: won, craneMin: edge.min, craneMax: edge.max, width: W, heightPixels: H,
      coordinates: "normalized-to-canvas; swing is radians; tolerance uses canvas width; rope uses canvas height" };
  }
  function hud() {
    var allowed = canPlay(), b = $("castleTrolley"); b.hidden = !active || won; b.disabled = !allowed;
    b.style.left = (craneX * W) + "px"; b.style.top = (railY - 13) + "px";
    $("castleLower").disabled = !allowed || hoisting; $("castleLower").setAttribute("aria-pressed", lowering ? "true" : "false");
    $("castleHoist").disabled = !allowed || hoisting || lowering || rope <= minRope + 1;
    $("castleHelp").disabled = !allowed || lowering || drag !== null;
    $("castlePower").hidden = !(active && power > 0 && !won); $("castlePowerFill").style.width = power / POWER * 100 + "%";
    $("castlePieceName").textContent = won ? "Your castle is ready!" : PARTS[stage].label;
    publish();
  }
  function banner(text) { $("castleBanner").textContent = text; }
  function stopDrag() {
    var surface = dragSurface, id = drag; drag = null; dragSurface = null;
    try { if (surface && id !== null && surface.hasPointerCapture(id)) surface.releasePointerCapture(id); } catch (e) {}
  }
  function stopLower() {
    var surface = lowerSurface, id = lowerPointer; lowering = false; lowerPointer = null; lowerSurface = null; lowerKey = false;
    try { if (surface && id !== null && surface.hasPointerCapture(id)) surface.releasePointerCapture(id); } catch (e) {}
  }
  function startHoist() { if (!canPlay()) return; stopLower(); hoisting = true; banner("Lift it up. Try that slot again"); hud(); }
  function point(event) { var r = cv.getBoundingClientRect(); return { x: (event.clientX - r.left) / W, y: event.clientY - r.top }; }
  function down(event) {
    if (!canPlay() || drag !== null || lowering || (event.button != null && event.button !== 0)) return;
    var p = point(event); if (Math.abs(p.x * W - craneX * W) > 42 || Math.abs(p.y - (railY - 13)) > 34) return;
    event.preventDefault(); drag = event.pointerId; dragSurface = event.currentTarget; dragOffset = p.x - craneX;
    try { dragSurface.setPointerCapture(drag); } catch (e) {}
    banner("Slide above the glowing slot"); hud();
  }
  function move(event) { if (event.pointerId !== drag || !canPlay()) return; moveCrane(point(event).x - dragOffset); hud(); draw(); }
  function up(event) { if (event.pointerId !== drag) return; stopDrag(); hud(); }
  function lowerDown(event) {
    if (!canPlay() || hoisting || lowerPointer !== null || lowerKey || drag !== null || (event.button != null && event.button !== 0)) return;
    event.preventDefault(); lowerPointer = event.pointerId; lowerSurface = event.currentTarget; lowering = true;
    try { lowerSurface.setPointerCapture(lowerPointer); } catch (e) {}
    banner("Easy does it. Hold to lower"); hud();
  }
  function lowerUp(event) { if (event.pointerId !== lowerPointer) return; stopLower(); hud(); }
  function trolleyKeys(event) {
    if (!canPlay() || drag !== null || lowering) return;
    var amount = event.shiftKey ? 0.012 : 0.035;
    if (event.key === "ArrowLeft") moveCrane(craneX - amount); else if (event.key === "ArrowRight") moveCrane(craneX + amount); else return;
    event.preventDefault(); hud(); draw();
  }
  function lowerKeys(event) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault(); if (!canPlay() || hoisting || lowerPointer !== null || event.repeat) return;
    lowerKey = true; lowering = true; banner("Hold to lower. Let go to stop"); hud();
  }
  function controls() {
    [cv, $("castleTrolley")].forEach(function (s) { s.addEventListener("pointerdown", down); s.addEventListener("pointermove", move); s.addEventListener("pointerup", up); s.addEventListener("pointercancel", up); s.addEventListener("lostpointercapture", up); });
    $("castleTrolley").addEventListener("keydown", trolleyKeys);
    var lower = $("castleLower"); lower.addEventListener("pointerdown", lowerDown); lower.addEventListener("pointerup", lowerUp); lower.addEventListener("pointercancel", lowerUp); lower.addEventListener("lostpointercapture", lowerUp); lower.addEventListener("keydown", lowerKeys);
    lower.addEventListener("keyup", function (event) { if ((event.key === " " || event.key === "Enter") && lowerKey) { event.preventDefault(); stopLower(); hud(); } });
    lower.addEventListener("blur", function () { if (lowerKey) { stopLower(); hud(); } });
    $("castleHoist").onclick = startHoist; $("castleHelp").onclick = function () { if (canPlay() && !lowering && drag === null) api.practice(); };
    window.addEventListener("resize", fit); document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    window.addEventListener("pagehide", function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; });
    window.addEventListener("pageshow", function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
  }
  function contact() {
    var p = piece(), s = slot();
    if (!lowering || p.bottom < s.bottom - 0.5) return;
    stopLower();
    if (Math.abs(p.x - s.x) <= tolerance()) {
      placed = Math.max(placed, stage + 1); active = false; power = 0; hoisting = false; stopDrag();
      banner(placed === stages ? "A castle built by you!" : "A perfect home for that piece!"); api.sfx("correct"); hud(); draw(); api.done();
    } else { misses++; startHoist(); api.sfx("tap"); }
  }
  function tick(dt) {
    if (!canPlay()) return;
    time += dt; power = Math.max(0, power - dt);
    velocity += (-8.5 * Math.sin(swing) - (power > 0 ? 4 : 0.6) * velocity + Math.sin(time * 1.6 + stage) * 0.8 * steadyFactor()) * dt;
    swing = clamp(swing + velocity * dt, -0.28, 0.28);
    if (hoisting) { rope = Math.max(minRope, rope - Math.max(90, H * 0.45) * dt); if (rope <= minRope) { hoisting = false; banner("Slide, then hold Lower to try again"); } }
    else if (lowering) { rope = Math.min(maxRope, rope + Math.max(65, Math.min(200, H * 0.27)) * dt); contact(); }
    hud();
  }
  function frame(now) { var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; tick(dt); draw(); raf = requestAnimationFrame(frame); }
  function earnPower() { power = POWER; paused = false; active = true; last = 0; banner("A steady rope! Slide, then hold Lower"); hud(); }
  function pause() { paused = true; last = 0; stopLower(); stopDrag(); hud(); }
  function reset() {
    stopLower(); stopDrag(); active = false; paused = false; stage = 0; placed = 0; won = false; power = 0; rope = minRope; craneX = 0.2; swing = 0.035; velocity = 0; hoisting = false; misses = 0; time = 0; last = 0;
    banner("Slide the crane. Hold Lower"); hud(); draw();
  }
  window.Castle = {
    init: function (a, n) { api = a; stages = n || 8; cv = $("castleCanvas"); ctx = cv.getContext("2d"); loadArt(); controls(); fit(); reset(); raf = requestAnimationFrame(frame); },
    onWord: function (index) { stage = index; rope = minRope; swing = 0.035; velocity = 0; hoisting = false; stopLower(); stopDrag(); var edge = limits(); craneX = clamp(index % 2 ? 0.8 : 0.2, edge.min, edge.max); earnPower(); },
    onHelp: earnPower,
    pause: pause,
    resume: function (playing) { paused = playing === false; last = 0; hud(); },
    reset: reset,
    finale: function () { stopLower(); stopDrag(); active = false; power = 0; won = true; banner("Eight pieces. Your own little castle!"); hud(); draw(); }
  };
})();
