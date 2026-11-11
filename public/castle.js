/* Castle Builder: each word the child says two times brings the next castle
   piece to the crane hook. The finger slides the crane and holds Lower: a
   touchdown over the glowing slot locks the piece in, a touchdown beside it
   lifts the piece back up for another go. SayPlay owns every word, the
   microphone, Echo's voice and the two sayings; this file never touches them.

   EVERY PIECE ENDS IN ITS SLOT (CLAUDE.md, "Every ball ends in a basket").
   A miss is a real touchdown beside the slot, never time spent waiting, and
   each one makes this piece easier (pieceMisses, reset by the next word):
   - miss 0: the game as designed. The load swings on its rope and the
     window is narrow; the steady-rope word makes it calm and wide.
   - after 1 miss: the swing is about half and slower to start, the window
     about 1.6x.
   - after 2 misses: the rope hangs still, the slot glows, a gold stop on
     the rail shows where to slide and an arrow over the slot says lower.
   - from the 3rd miss: holding Lower glides the trolley over the slot and
     the piece snaps in.
   A child aged 2 to 4 gets the glow from the first miss and the glide from
   the second. No help ever lowers a piece by itself: the finger still holds
   Lower, and no timer finishes a step. The steady-rope word stays a bonus
   on top; nothing here needs it. */
(function () {
  "use strict";
  var api, cv, ctx, W = 390, H = 844, raf = 0, last = 0, time = 0, clock = 0;
  var active = false, paused = false, away = false, stage = 0, stages = 8, placed = 0, won = false;
  var power = 0, craneX = 0.2, rope = 24, minRope = 24, maxRope = 500, railY = 150, groundY = 650, unit = 320;
  var swing = 0.035, velocity = 0, lowering = false, hoisting = false, misses = 0, pieceMisses = 0, little = false;
  var drag = null, dragSurface = null, dragOffset = 0, lowerPointer = null, lowerSurface = null, lowerKey = false;
  // doneAt: the celebration beat. The step is reported this long after the
  // piece locks in, on the game's own clock, so the chime is heard whole and
  // a pause in between holds it rather than skipping it (hoops.js does this)
  var doneAt = 0, dones = 0, sparks = [], shine = 0, dirty = true, calm = false;
  var art = {}, slots = [], POWER = 10, BEAT = 1.15;
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
  // Every line the banner can show. Each fits one line on a 320 px phone,
  // and fit() still makes room for the tallest, so none covers the rail.
  var SAY = {
    ready: "Say the word to get a piece",
    slide: "Slide over the glow. Hold Lower",
    help: "Steady rope! Now hold Lower",
    ask: "Say it for a steady rope",
    drag: "Slide over the glowing spot",
    lower: "Easy does it. Hold to lower",
    key: "Hold to lower. Let go to stop",
    lift: "Up it goes!",
    close: "So close! Try again",
    nearly: "Nearly! Try again",
    again1: "Slide, then hold Lower",
    again2: "Slide to the arrow. Hold Lower",
    again3: "Hold Lower. It will fit!",
    fit: "A perfect fit!",
    built: "A castle built by you!",
    finale: "Your own little castle!"
  };
  var BANNERS = Object.keys(SAY).map(function (k) { return SAY[k]; });
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function canPlay() { return active && !paused && !away && !won && !document.hidden; }
  function live() { return !paused && !away && !document.hidden; }
  function image(name) { var i = art[name]; return i && i.complete && i.naturalWidth ? i : null; }
  // ── the ladder ──
  function ladder() { var m = pieceMisses; return little ? (m >= 2 ? 3 : m >= 1 ? 2 : 0) : Math.min(3, m); }
  function baseTolerance() { return clamp(W * 0.03, 8, 15); }
  function tolerance() {
    var b = baseTolerance(), t = b * (power > 0 ? 2.2 : 1), lv = ladder();
    if (lv >= 1) t = Math.max(t, b * 1.6);
    if (lv >= 2) t = Math.max(t, b * 2.4);
    if (lv >= 3) t = Math.max(t, b * 3, slot().width / 2);
    return t;
  }
  // how much of the rope's push-and-pull is left: none once the rope holds still
  function steadyFactor() { var lv = ladder(), f = power > 0 ? 0.12 : 1; return lv >= 2 ? 0 : lv >= 1 ? Math.min(f, 0.5) : f; }
  function damping() { var lv = ladder(), d = power > 0 ? 4 : 0.6; return lv >= 2 ? Math.max(d, 6) : lv >= 1 ? Math.max(d, 1.6) : d; }
  // how hard a slide sets the load swinging
  function kick() { var lv = ladder(), k = power > 0 ? 0.3 : 1; return lv >= 2 ? Math.min(k, 0.1) : lv >= 1 ? Math.min(k, 0.5) : k; }
  function againLine() { var lv = ladder(); return lv >= 3 ? SAY.again3 : lv >= 2 ? SAY.again2 : SAY.again1; }
  function slot() { return slots[stage] || { x: W * 0.5, y: groundY - 30, width: 60, height: 60, bottom: groundY }; }
  function piece() {
    var s = slot(), x = craneX * W + Math.sin(swing) * rope, top = railY + Math.cos(swing) * rope;
    return { x: x, y: top + s.height / 2, width: s.width, height: s.height, top: top, bottom: top + s.height, key: PARTS[stage].key };
  }
  function limits() { var half = slot().width / W / 2; return { min: Math.max(0.08, half + 0.02), max: Math.min(0.92, 0.98 - half) }; }
  function stopX() { var edge = limits(); return clamp(slot().x / W, edge.min, edge.max); }
  function moveCrane(x) {
    var edge = limits(), next = clamp(x, edge.min, edge.max);
    velocity -= (next - craneX) * 1.8 * kick(); craneX = next;
  }
  function loadArt() {
    var names = [["bg", "castle-beach-v1.webp"]];
    PARTS.forEach(function (p) { names.push([p.key, "castle-" + p.key + "-v1.webp"]); });
    names.forEach(function (p) { var i = new Image(); i.onload = function () { dirty = true; }; i.src = "/assets/crafted/game/" + p[1]; art[p[0]] = i; });
  }
  // the bottom of the tallest banner line, so a line that wraps on a narrow
  // phone (or with large text) still never covers the rail or the trolley
  function bannerRoom(top) {
    var b = $("castleBanner"), keep = b.textContent, low = 0;
    b.setAttribute("aria-live", "off");
    for (var i = 0; i < BANNERS.length; i++) { b.textContent = BANNERS[i]; low = Math.max(low, b.getBoundingClientRect().bottom); }
    b.textContent = keep; b.setAttribute("aria-live", "polite");
    return low - top;
  }
  // the piece name and the steady-rope bar sit over the sand: the castle
  // stands above them, so neither ever covers a slot (the bar is measured
  // even while it is hidden, so the slots never move when it appears)
  function pillsTop() {
    var name = $("castlePieceName").getBoundingClientRect(), bar = $("castlePower"), was = bar.hidden, h;
    bar.hidden = false; h = bar.getBoundingClientRect().height; bar.hidden = was;
    return Math.min(name.top, name.bottom - h);
  }
  function fit() {
    if (!cv) return;
    var r = cv.getBoundingClientRect(), oldRange = maxRope - minRope, ropeFraction = oldRange > 0 ? (rope - minRope) / oldRange : 0;
    W = Math.max(1, r.width); H = Math.max(1, r.height); var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    railY = bannerRoom(r.top) + 44; groundY = Math.min(H * 0.8, $("castleControls").getBoundingClientRect().top - r.top - 24, pillsTop() - r.top - 6);
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
  // a thick arrow, cream under teal, so it reads on sky and on sand
  function arrow(x1, y1, x2, y2) {
    var a = Math.atan2(y2 - y1, x2 - x1), head = 13;
    [["#fffbe6", 10], ["#258995", 5]].forEach(function (pen) {
      ctx.strokeStyle = pen[0]; ctx.lineWidth = pen[1]; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.moveTo(x2 - head * Math.cos(a - 0.6), y2 - head * Math.sin(a - 0.6)); ctx.lineTo(x2, y2); ctx.lineTo(x2 - head * Math.cos(a + 0.6), y2 - head * Math.sin(a + 0.6));
      ctx.stroke();
    });
  }
  // after two misses: the slot glows, a gold stop on the rail shows where the
  // trolley goes (with a track toward it), and an arrow over the slot says lower
  function guide() {
    if (!active || won || ladder() < 2) return;
    var s = slot(), beat = calm ? 0.6 : 0.5 + 0.5 * Math.sin(clock * 4), tx = craneX * W, target = stopX() * W;
    ctx.save();
    ctx.shadowColor = "#ffcf4a"; ctx.shadowBlur = 16 + 14 * beat; ctx.fillStyle = "rgba(255,241,176," + (0.24 + 0.18 * beat).toFixed(3) + ")";
    rounded(s.x - s.width / 2 - 7, s.y - s.height / 2 - 7, s.width + 14, s.height + 14, 11); ctx.fill();
    ctx.strokeStyle = "#ffcf4a"; ctx.lineWidth = 4; ctx.stroke(); ctx.shadowBlur = 0;
    rounded(target - 29, railY - 23, 58, 31, 10); ctx.stroke();
    if (Math.abs(target - tx) > 34) { var dir = target > tx ? 1 : -1; arrow(tx + dir * 34, railY + 18, target - dir * 10, railY + 18); }
    var top = s.y - s.height / 2, bob = calm ? 0 : beat * 6, from = Math.max(railY + 46, top - 64);
    if (top - from > 22) arrow(s.x, from + bob, s.x, top - 10 + bob);
    ctx.restore();
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
  // the game's own cheer when a piece locks in: a warm glow round the slot,
  // and (with motion on) a ring of little sparkles
  function burst(s) {
    shine = 1; sparks = [];
    if (calm) return;
    for (var i = 0; i < 18; i++) { var a = i / 18 * Math.PI * 2, v = 90 + (i % 3) * 45; sparks.push({ x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, life: 0.9, c: ["#ffd76a", "#78baca", "#d79598"][i % 3] }); }
  }
  function cheerFx() {
    var s = slots[placed - 1];
    if (shine > 0 && s) {
      ctx.save(); ctx.globalAlpha = shine; ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 5; ctx.shadowColor = "#ffcf4a"; ctx.shadowBlur = 22;
      rounded(s.x - s.width / 2 - 6, s.y - s.height / 2 - 6, s.width + 12, s.height + 12, 12); ctx.stroke(); ctx.restore();
    }
    sparks.forEach(function (p) { ctx.save(); ctx.globalAlpha = Math.max(0, p.life / 0.9); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
  }
  function ageFx(dt) {
    if (shine > 0) shine = Math.max(0, shine - dt / 1.1);
    sparks = sparks.filter(function (p) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; return p.life > 0; });
  }
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H); background();
    for (var n = 0; n < placed; n++) drawPart(PARTS[n].key, slots[n], 1);
    ghost(); guide(); if (!won) crane(); cheerFx();
  }
  function normalized(p) { return { x: p.x / W, y: p.y / H, width: p.width / W, height: p.height / H, bottom: p.bottom / H, top: (p.top == null ? p.y - p.height / 2 : p.top) / H }; }
  function publish() {
    var p = piece(), s = slot(), edge = limits(), pp = normalized(p), lv = ladder(); pp.key = p.key;
    window.__castle = { active: active, paused: paused, stage: stage, stages: stages, placed: placed, power: power, craneX: craneX, railY: railY / H,
      piece: pp, slot: normalized(s), slots: slots.map(normalized), groundY: groundY / H, rope: rope / H, minRope: minRope / H, maxRope: maxRope / H, height: p.y / H, swing: swing, swingVelocity: velocity,
      swingEnvelope: power > 0 ? 0.025 : 0.2, steadyFactor: steadyFactor(), tolerance: tolerance() / W, tolerancePx: tolerance(), baseTolerancePx: baseTolerance(), lowering: lowering, hoisting: hoisting,
      dragging: drag !== null, pointerId: drag, misses: misses, pieceMisses: pieceMisses, ladder: lv, little: little, guide: active && !won && lv >= 2, glide: active && !won && lv >= 3, stopX: stopX(),
      doneIn: doneAt ? Math.max(0, doneAt - clock) : 0, dones: dones, banner: $("castleBanner").textContent,
      won: won, craneMin: edge.min, craneMax: edge.max, width: W, heightPixels: H,
      coordinates: "normalized-to-canvas; swing is radians; tolerance uses canvas width; rope uses canvas height" };
  }
  function hud() {
    var allowed = canPlay(), b = $("castleTrolley"); b.hidden = !active || won; b.disabled = !allowed;
    b.style.left = (craneX * W) + "px"; b.style.top = (railY - 13) + "px";
    b.classList.toggle("guide", allowed && ladder() >= 2 && Math.abs(craneX - stopX()) * W > tolerance());
    $("castleLower").disabled = !allowed || hoisting; $("castleLower").setAttribute("aria-pressed", lowering ? "true" : "false");
    $("castleHoist").disabled = !allowed || hoisting || lowering || rope <= minRope + 1;
    $("castleHelp").disabled = !allowed || lowering || drag !== null;
    $("castlePower").hidden = !(active && power > 0 && !won); $("castlePowerFill").style.width = power / POWER * 100 + "%";
    $("castlePieceName").textContent = won ? "Your castle is ready!" : PARTS[stage].label;
    dirty = true; publish();
  }
  function banner(text) { $("castleBanner").textContent = text; if (cv) publish(); }
  function stopDrag() {
    var surface = dragSurface, id = drag; drag = null; dragSurface = null;
    try { if (surface && id !== null && surface.hasPointerCapture(id)) surface.releasePointerCapture(id); } catch (e) {}
  }
  function stopLower() {
    var surface = lowerSurface, id = lowerPointer; lowering = false; lowerPointer = null; lowerSurface = null; lowerKey = false;
    try { if (surface && id !== null && surface.hasPointerCapture(id)) surface.releasePointerCapture(id); } catch (e) {}
  }
  function startHoist(text) { if (!canPlay()) return; stopLower(); hoisting = true; banner(typeof text === "string" ? text : SAY.lift); hud(); }
  function point(event) { var r = cv.getBoundingClientRect(); return { x: (event.clientX - r.left) / W, y: event.clientY - r.top }; }
  function down(event) {
    if (!canPlay() || drag !== null || lowering || (event.button != null && event.button !== 0)) return;
    var p = point(event); if (Math.abs(p.x * W - craneX * W) > 42 || Math.abs(p.y - (railY - 13)) > 34) return;
    event.preventDefault(); drag = event.pointerId; dragSurface = event.currentTarget; dragOffset = p.x - craneX;
    try { dragSurface.setPointerCapture(drag); } catch (e) {}
    banner(ladder() >= 2 ? SAY.again2 : SAY.drag); hud();
  }
  function move(event) { if (event.pointerId !== drag || !canPlay()) return; moveCrane(point(event).x - dragOffset); hud(); }
  function up(event) { if (event.pointerId !== drag) return; stopDrag(); hud(); }
  function lowerDown(event) {
    if (!canPlay() || hoisting || lowerPointer !== null || lowerKey || drag !== null || (event.button != null && event.button !== 0)) return;
    event.preventDefault(); lowerPointer = event.pointerId; lowerSurface = event.currentTarget; lowering = true;
    try { lowerSurface.setPointerCapture(lowerPointer); } catch (e) {}
    banner(SAY.lower); hud();
  }
  function lowerUp(event) { if (event.pointerId !== lowerPointer) return; stopLower(); hud(); }
  function trolleyKeys(event) {
    if (!canPlay() || drag !== null || lowering) return;
    var amount = event.shiftKey ? 0.012 : 0.035;
    if (event.key === "ArrowLeft") moveCrane(craneX - amount); else if (event.key === "ArrowRight") moveCrane(craneX + amount); else return;
    event.preventDefault(); hud();
  }
  function lowerKeys(event) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault(); if (!canPlay() || hoisting || lowerPointer !== null || event.repeat) return;
    lowerKey = true; lowering = true; banner(SAY.key); hud();
  }
  function controls() {
    [cv, $("castleTrolley")].forEach(function (s) { s.addEventListener("pointerdown", down); s.addEventListener("pointermove", move); s.addEventListener("pointerup", up); s.addEventListener("pointercancel", up); s.addEventListener("lostpointercapture", up); });
    $("castleTrolley").addEventListener("keydown", trolleyKeys);
    var lower = $("castleLower"); lower.addEventListener("pointerdown", lowerDown); lower.addEventListener("pointerup", lowerUp); lower.addEventListener("pointercancel", lowerUp); lower.addEventListener("lostpointercapture", lowerUp); lower.addEventListener("keydown", lowerKeys);
    lower.addEventListener("keyup", function (event) { if ((event.key === " " || event.key === "Enter") && lowerKey) { event.preventDefault(); stopLower(); hud(); } });
    lower.addEventListener("blur", function () { if (lowerKey) { stopLower(); hud(); } });
    $("castleHoist").onclick = function () { startHoist(SAY.lift); }; $("castleHelp").onclick = function () { if (canPlay() && !lowering && drag === null && api.practice()) banner(SAY.ask); };
    window.addEventListener("resize", fit); document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    window.addEventListener("pagehide", function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; });
    window.addEventListener("pageshow", function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
    // the banner's real font can arrive after the first fit: make room again
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!lowering && drag === null) fit(); }); } catch (e) {}
  }
  function contact() {
    var p = piece(), s = slot();
    if (!lowering || p.bottom < s.bottom - 0.5) return;
    stopLower();
    if (Math.abs(p.x - s.x) <= tolerance()) locked(); else missed();
  }
  // in its slot: the chime and the cheer now, the step after the beat
  function locked() {
    placed = Math.max(placed, stage + 1); active = false; power = 0; hoisting = false; pieceMisses = 0; stopDrag();
    burst(slots[stage] || slot());
    banner(placed === stages ? SAY.built : SAY.fit);
    try { api.sfx("correct"); if (api.face) api.face("cheer"); if (api.cheer) api.cheer("A perfect fit!"); } catch (e) {}
    doneAt = clock + BEAT; hud(); draw();
  }
  // a touchdown beside the slot: the same piece lifts back up, and this piece
  // gets easier (see the ladder at the top of this file)
  function missed() {
    misses++; pieceMisses++;
    startHoist(ladder() >= 2 ? SAY.nearly : SAY.close); api.sfx("tap");
  }
  function tick(dt) {
    if (!canPlay()) return;
    time += dt; power = Math.max(0, power - dt);
    velocity += (-8.5 * Math.sin(swing) - damping() * velocity + Math.sin(time * 1.6 + stage) * 0.8 * steadyFactor()) * dt;
    swing = clamp(swing + velocity * dt, -0.28, 0.28);
    if (hoisting) { rope = Math.max(minRope, rope - Math.max(90, H * 0.45) * dt); if (rope <= minRope) { hoisting = false; banner(againLine()); } }
    else if (lowering) {
      // from the third miss a held Lower glides the trolley over the slot:
      // the finger still lowers the piece, the crane only lines it up
      if (ladder() >= 3) craneX += (stopX() - craneX) * Math.min(1, dt * 4);
      rope = Math.min(maxRope, rope + Math.max(65, Math.min(200, H * 0.27)) * dt); contact();
    }
    hud();
  }
  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
    if (live()) {
      clock += dt;
      if (doneAt && clock >= doneAt) { doneAt = 0; dones++; publish(); if (api) api.done(); }
      if (shine > 0 || sparks.length) { ageFx(dt); dirty = true; }
    }
    tick(dt);
    // a still board is not drawn again until something on it changes
    if (dirty) { dirty = false; draw(); }
    raf = requestAnimationFrame(frame);
  }
  function earnPower(text) { power = POWER; paused = false; active = true; last = 0; banner(text); hud(); }
  function pause() { paused = true; last = 0; stopLower(); stopDrag(); hud(); }
  function reset() {
    stopLower(); stopDrag(); active = false; paused = false; stage = 0; placed = 0; won = false; power = 0; rope = minRope; craneX = 0.2; swing = 0.035; velocity = 0; hoisting = false; misses = 0; pieceMisses = 0; time = 0; last = 0;
    doneAt = 0; sparks = []; shine = 0;
    banner(SAY.ready); hud(); draw();
  }
  window.Castle = {
    init: function (a, n) {
      api = a; stages = n || 8; cv = $("castleCanvas"); ctx = cv.getContext("2d");
      try { calm = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}
      loadArt(); controls(); fit(); reset(); raf = requestAnimationFrame(frame);
    },
    // the word brought the next piece: a new piece starts with no misses
    onWord: function (index) { stage = index; pieceMisses = 0; doneAt = 0; rope = minRope; swing = 0.035; velocity = 0; hoisting = false; stopLower(); stopDrag(); var edge = limits(); craneX = clamp(index % 2 ? 0.8 : 0.2, edge.min, edge.max); earnPower(SAY.slide); },
    // the optional help word: a steady rope for the same piece, misses kept
    onHelp: function () { earnPower(SAY.help); },
    pause: pause,
    // back to the move (a help ask nobody answered ends here too): the
    // banner says what to do next, never the ask that is over
    resume: function (playing) { paused = playing === false; last = 0; if (!paused && $("castleBanner").textContent === SAY.ask) banner(againLine()); hud(); },
    reset: reset,
    finale: function () { stopLower(); stopDrag(); active = false; power = 0; won = true; doneAt = 0; banner(SAY.finale); hud(); draw(); },
    // ages 2 to 4 (the page asks Sona): the gentler ladder
    setLittle: function (on) { little = !!on; if (cv) hud(); },
    BANNERS: BANNERS
  };
})();
