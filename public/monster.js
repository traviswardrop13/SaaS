/* Monster Makeover: physical salon tools and retained work on one friendly
   monster. SayPlay owns the words, microphone, repetitions and all voice.
   The word (said two times) earns each job; the finger does the job.

   Every job ends without the child speaking (the Hoops rule). The ladder,
   per job, reset by the next word:
   - tap jobs (brush, snip, stamp, bow, glasses, crown) step up on misses:
     1 miss: the salon-power tolerances whatever the power says;
     2 misses: the next target glows, an arrow shows where and how, and
       the windows are about 2 to 2.5 times the start;
     3 misses: any try roughly the right way on our friend works.
   - rubbing jobs (scrub, rinse) step up on seconds of real finger work
     with nothing finished: 4 s easier, 8 s glow and arrow, 12 s anywhere
     on our friend works. Nothing ever finishes by itself: a finger must
     scrub or hold the shower. The help word stays an extra on top. */
(function () {
  "use strict";
  var STEP_LINES = [
    "Move the sponge back and forth over each muddy patch.",
    "Hold the shower over each bubbly patch to rinse it away.",
    "Brush down each curly bit of fur.",
    "Swipe the scissors across each dotted tuft.",
    "Choose a color, then tap each glowing spot.",
    "Drag the bow to the glowing spot below the smile.",
    "Drag the glasses onto the monster's face.",
    "Drag the crown onto the monster's head."
  ];
  var MODES = ["scrub", "rinse", "comb", "snip", "stamp", "bow", "glasses", "crown"];
  var LABELS = ["Scrub the muddy fur", "Rinse the bubbles", "Brush the curls", "Snip the tufts", "Choose some colorful spots", "A bow for our friend", "Try the yellow glasses", "Time for a crown"];
  var COLORS = ["#72bcc1", "#e7a3b4", "#e2cf85"], MUD = [[0.27, 0.56], [0.72, 0.56], [0.38, 0.7], [0.63, 0.76], [0.44, 0.88]];
  var COMB = [[0.3, 0.23], [0.5, 0.2], [0.7, 0.23]], SNIP = [[0.36, 0.12], [0.5, 0.09], [0.64, 0.12]], SPOTS = [[0.33, 0.61], [0.67, 0.61], [0.39, 0.78], [0.63, 0.8]];
  var api, cv, ctx, W = 390, H = 844, raf = 0, last = 0, time = 0, art = {};
  var M = { x: 195, y: 410, w: 260, h: 310 }, trayY = 690, workTop = 140, workBottom = 640;
  var active = false, paused = false, away = false, stage = 0, stages = 8, completed = 0, won = false, power = 0;
  var mud = [], foam = [], combed = [false, false, false], snipped = [false, false, false], spots = [], selectedColor = 0, placements = { bow: false, glasses: false, crown: false };
  var cursor = { x: 0.27, y: 0.56 }, held = false, keyHeld = false, drag = null, dragSurface = null, previous = null, path = [], accessory = null, keyboardAccessory = false;
  var strokes = 0, misses = 0, POWER = 10;
  // the ladder (see the top of this file) and the celebration beat: the
  // job is reported to SayPlay this long after it is finished, counting
  // only time the game is playing, so the chime and the sparkle are heard
  // and seen before the next word is asked (which stops chimes).
  var jobMisses = 0, stuck = 0, rubLevel = 0, lastMove = -9, BEAT = 1.15, doneAt = 0, dones = 0, sparkle = 0, calm = false;
  var LINES = {
    scrub: ["Scrub the muddy fur", "Keep scrubbing the mud", "Scrub the glowing mud", "Scrub anywhere on our friend"],
    rinse: ["Rinse the bubbles", "Hold the shower on bubbles", "Hold the shower on the glow", "Hold the shower on our friend"],
    comb: ["Brush down along an arrow", "So close! Brush down an arrow", "Brush down the glowing curl", "Brush down on our friend"],
    snip: ["Swipe across a dotted tuft", "So close! Swipe across a tuft", "Swipe across the glowing tuft", "Swipe sideways on our friend"],
    stamp: ["Try another glowing fur spot", "So close! Tap a glowing spot", "Nearly! Tap the big glow", "Tap anywhere on our friend"],
    wear: ["Still yours. Try the glowing spot", "So close! Try the glowing spot", "Follow the arrow to the glow", "Drop it anywhere on our friend"]
  };
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function canPlay() { return active && !paused && !away && !won && !document.hidden; }
  function mode() { return MODES[stage]; }
  function rubbing() { return stage <= 1; }
  function ladder() { return rubbing() ? rubLevel : Math.min(3, jobMisses); }
  function lineKey() { return stage >= 5 ? "wear" : mode(); }
  function ladderLine() { return LINES[lineKey()][ladder()]; }
  // every tolerance is the easiest of what the power and the ladder give
  function pick(off, on, l1, l2) { var lv = ladder(), v = power > 0 ? on : off; if (lv >= 1) v = Math.max(v, l1); if (lv >= 2) v = Math.max(v, l2); return v; }
  function pickLow(off, on, l1, l2) { var lv = ladder(), v = power > 0 ? on : off; if (lv >= 1) v = Math.min(v, l1); if (lv >= 2) v = Math.min(v, l2); return v; }
  function radius() { return pick(0.085, 0.14, 0.14, 0.2); }
  function required() { return ladder() >= 3 ? 0.1 : pickLow(0.3, 0.18, 0.18, 0.12); }
  function magnet() { return pick(0.12, 0.2, 0.2, 0.3); }
  function rinseRate() { return ladder() >= 3 ? 2.5 : pick(1, 1.5, 1.5, 2.2); }
  function stampRadius() { return pick(0.07, 0.105, 0.105, 0.2); }
  // anywhere on our friend: the monster's own box, a little margin round it
  function onMonster(p) { return p.x >= -0.1 && p.x <= 1.1 && p.y >= -0.1 && p.y <= 1.1; }
  function image(name) { var i = art[name]; return i && i.complete && i.naturalWidth ? i : null; }
  function world(p) { return { x: M.x - M.w / 2 + p.x * M.w, y: M.y - M.h / 2 + p.y * M.h }; }
  function local(p) { return { x: (p.x - M.x + M.w / 2) / M.w, y: (p.y - M.y + M.h / 2) / M.h }; }
  function distance(a, b) { var dx = a.x - b.x, dy = (a.y - b.y) * M.h / M.w; return Math.sqrt(dx * dx + dy * dy); }
  function tray() { return W > H && H < 500 ? { x: 72, y: workTop + 65, r: 34 } : { x: W * 0.5, y: trayY, r: 38 }; }
  function accessoryAnchor(name) { return name === "bow" ? { x: 0.5, y: 0.6 } : name === "glasses" ? { x: 0.505, y: 0.323 } : { x: 0.5, y: 0.08 }; }
  function accessoryLocal() { return accessoryAnchor(mode()); }
  function loadArt() {
    [["bg", "monster-salon-v1.webp"], ["base", "monster-base-v1.webp"], ["sponge", "puppy-sponge.webp"], ["shower", "monster-shower-v1.webp"], ["comb", "monster-comb-v1.webp"], ["scissors", "monster-scissors-v1.webp"], ["bow", "/assets/crafted/hat-bow.webp"], ["glasses", "monster-glasses-v1.webp"], ["crown", "/assets/crafted/hat-crown.webp"]].forEach(function (p) { var i = new Image(); i.onload = draw; i.src = p[1].charAt(0) === "/" ? p[1] : "/assets/crafted/game/" + p[1]; art[p[0]] = i; });
  }
  function makeState() {
    mud = MUD.map(function (p) { return { x: p[0], y: p[1], r: 0.075, work: 0, clean: false }; }); foam = [];
    MUD.forEach(function (p, patch) { for (var y = -1; y <= 1; y++) for (var x = -1; x <= 1; x++) foam.push({ x: p[0] + x * 0.039, y: p[1] + y * 0.035, patch: patch, wet: 0, clear: false }); });
    combed = [false, false, false]; snipped = [false, false, false]; spots = SPOTS.map(function (p) { return { x: p[0], y: p[1], color: null, done: false }; }); placements = { bow: false, glasses: false, crown: false };
  }
  function fit() {
    if (!cv) return;
    var rect = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.max(1, rect.width); H = Math.max(1, rect.height); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    workTop = $("monsterBanner").getBoundingClientRect().bottom - rect.top + 44; var controlsTop = $("monsterControls").getBoundingClientRect().top - rect.top;
    trayY = controlsTop - 58; workBottom = trayY - 48; var span = Math.max(80, workBottom - workTop), height = Math.min(W * 0.92, span * 0.94);
    M = { x: W * 0.5, y: workTop + span * 0.52, w: height * 512 / 507, h: height };
    if (W > H && H < 500) { workTop = $("monsterBanner").getBoundingClientRect().bottom - rect.top + 15; workBottom = controlsTop - 8; span = Math.max(70, workBottom - workTop); height = span * 0.86; M = { x: W * 0.6, y: workTop + span * 0.53, w: height * 512 / 507, h: height }; }
    stopGesture(); hud(); draw();
  }
  function sprite(name, x, y, w, h, alpha) {
    var i = image(name); if (!i) return false; var scale = Math.min(w / i.naturalWidth, h / i.naturalHeight), sw = i.naturalWidth * scale, sh = i.naturalHeight * scale;
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.drawImage(i, x - sw / 2, y - sh / 2, sw, sh); ctx.restore(); return true;
  }
  function background() {
    var i = image("bg");
    if (i) { var scale = Math.max(W / i.naturalWidth, H / i.naturalHeight), w = i.naturalWidth * scale, h = i.naturalHeight * scale; ctx.drawImage(i, (W - w) / 2, (H - h) / 2, w, h); }
    else { var wash = ctx.createLinearGradient(0, 0, 0, H); wash.addColorStop(0, "#d3e7e4"); wash.addColorStop(0.55, "#f6ead5"); wash.addColorStop(1, "#dfc8a1"); ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = "rgba(125,104,93,.16)"; ctx.beginPath(); ctx.ellipse(M.x, M.y + M.h * 0.48, M.w * 0.44, M.w * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  }
  function base() {
    if (sprite("base", M.x, M.y, M.w, M.h, 1)) return;
    ctx.save(); ctx.translate(M.x, M.y); ctx.fillStyle = "#aa86be"; ctx.strokeStyle = "#8f70a8"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, M.h * 0.04, M.w * 0.42, M.h * 0.41, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    [-1, 1].forEach(function (side) { ctx.fillStyle = "#b995c8"; ctx.beginPath(); ctx.ellipse(side * M.w * 0.42, M.h * 0.06, M.w * 0.1, M.h * 0.16, side * -0.4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(side * M.w * 0.2, M.h * 0.44, M.w * 0.17, M.h * 0.07, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#d49ba9"; ctx.beginPath(); ctx.moveTo(side * M.w * 0.26, -M.h * 0.31); ctx.lineTo(side * M.w * 0.3, -M.h * 0.49); ctx.lineTo(side * M.w * 0.14, -M.h * 0.36); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff7dc"; ctx.beginPath(); ctx.ellipse(side * M.w * 0.16, -M.h * 0.15, M.w * 0.12, M.h * 0.09, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#423b50"; ctx.beginPath(); ctx.arc(side * M.w * 0.16, -M.h * 0.15, M.w * 0.055, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = "#6f4d70"; ctx.beginPath(); ctx.ellipse(0, M.h * 0.025, M.w * 0.13, M.h * 0.07, 0, 0, Math.PI); ctx.fill(); ctx.restore();
  }
  function dirtAndFoam() {
    mud.forEach(function (p, index) {
      if (p.clean) return; var at = world(p), r = p.r * M.w, amount = Math.min(0.85, p.work / 0.3);
      ctx.save(); ctx.globalAlpha = 1 - amount * 0.65; ctx.translate(at.x, at.y); ctx.rotate(index * 0.71);
      var shade = ctx.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.08, 0, 0, r); shade.addColorStop(0, "#b69a73"); shade.addColorStop(0.48, "#a0805a"); shade.addColorStop(1, "#876a4a"); ctx.fillStyle = shade;
      ctx.shadowColor = "rgba(87,65,41,.16)"; ctx.shadowBlur = r * 0.14; ctx.shadowOffsetY = r * 0.05;
      ctx.beginPath(); ctx.moveTo(-r * 0.85, -r * 0.05);
      ctx.bezierCurveTo(-r * 1.1, -r * 0.4, -r * 0.65, -r * 0.83, -r * 0.34, -r * 0.7);
      ctx.bezierCurveTo(-r * 0.12, -r * 1.03, r * 0.28, -r * 0.93, r * 0.45, -r * 0.62);
      ctx.bezierCurveTo(r * 0.97, -r * 0.69, r * 1.08, -r * 0.16, r * 0.79, r * 0.09);
      ctx.bezierCurveTo(r * 1.04, r * 0.42, r * 0.53, r * 0.83, r * 0.2, r * 0.72);
      ctx.bezierCurveTo(-r * 0.13, r * 1.02, -r * 0.49, r * 0.74, -r * 0.64, r * 0.49);
      ctx.bezierCurveTo(-r * 1.06, r * 0.53, -r * 1.13, r * 0.1, -r * 0.85, -r * 0.05); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      for (var speck = 0; speck < 9; speck++) { var a = speck * 2.37 + index, spread = r * (0.23 + speck % 3 * 0.16); ctx.fillStyle = speck % 2 ? "rgba(202,179,138,.55)" : "rgba(104,82,54,.32)"; ctx.beginPath(); ctx.ellipse(Math.cos(a) * spread, Math.sin(a) * spread, r * (0.045 + speck % 2 * 0.025), r * 0.035, a, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
    foam.forEach(function (f, index) { if (!mud[f.patch].clean || f.clear) return; var p = world(f), r = M.w * (0.024 + index % 3 * 0.006); ctx.save(); ctx.globalAlpha = 0.94 * (1 - f.wet * 0.7); ctx.fillStyle = "#fff9ed"; ctx.strokeStyle = "#cae1df"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); });
  }
  function furClump(p, w, h, tidy, lean) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(lean);
    var shade = ctx.createLinearGradient(-w * 0.35, -h * 0.5, w * 0.25, h * 0.55); shade.addColorStop(0, "#c89af0"); shade.addColorStop(0.45, "#b47cde"); shade.addColorStop(1, "#9b65c9"); ctx.fillStyle = shade;
    ctx.beginPath();
    if (tidy) { ctx.moveTo(-w * 0.5, h * 0.25); ctx.bezierCurveTo(-w * 0.35, -h * 0.7, w * 0.08, -h * 0.43, w * 0.5, -h * 0.2); ctx.bezierCurveTo(w * 0.2, h * 0.38, -w * 0.1, h * 0.64, -w * 0.5, h * 0.25); }
    else { ctx.moveTo(-w * 0.37, h * 0.47); ctx.bezierCurveTo(-w * 0.6, h * 0.05, -w * 0.22, -h * 0.49, w * 0.03, -h * 0.64); ctx.bezierCurveTo(w * 0.6, -h * 0.37, w * 0.5, h * 0.03, w * 0.16, h * 0.16); ctx.bezierCurveTo(w * 0.37, -h * 0.04, w * 0.08, -h * 0.22, -w * 0.02, -h * 0.12); ctx.bezierCurveTo(-w * 0.23, h * 0.05, w * 0.08, h * 0.42, -w * 0.37, h * 0.47); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(219,177,246,.7)"; ctx.lineWidth = Math.max(0.6, M.w * 0.0025); ctx.lineCap = "round";
    ctx.beginPath(); if (tidy) { ctx.moveTo(-w * 0.31, h * 0.08); ctx.quadraticCurveTo(-w * 0.02, -h * 0.28, w * 0.28, -h * 0.13); } else { ctx.moveTo(-w * 0.3, h * 0.25); ctx.bezierCurveTo(-w * 0.35, -h * 0.05, -w * 0.11, -h * 0.34, w * 0.02, -h * 0.43); } ctx.stroke(); ctx.restore();
  }
  function fur() {
    COMB.forEach(function (t, index) { furClump(world({ x: t[0], y: t[1] }), M.w * 0.075, M.h * (combed[index] ? 0.018 : 0.075), combed[index], combed[index] ? 0.1 : (index - 1) * 0.16); });
    SNIP.forEach(function (t, index) { if (!snipped[index]) furClump(world({ x: t[0], y: t[1] }), M.w * 0.055, M.h * 0.095, false, (index - 1) * 0.24); });
  }
  function coloredSpots() {
    spots.forEach(function (s) { if (!s.done) return; var p = world(s), r = M.w * 0.052, g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.4, 1, p.x, p.y, r); g.addColorStop(0, "#fff2d7"); g.addColorStop(0.4, COLORS[s.color]); g.addColorStop(1, COLORS[s.color]); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); });
  }
  function accessoryArt(name, p, alpha) {
    var width = M.w * (name === "bow" ? 0.42 : name === "glasses" ? 0.53 : 0.43), height = M.w * (name === "bow" ? 0.25 : name === "glasses" ? 0.32 : 0.31);
    if (sprite(name, p.x, p.y, width, height, alpha)) return;
    ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.fillStyle = name === "glasses" ? "#e8d17b" : "#d99ba9"; ctx.strokeStyle = name === "glasses" ? "#bca45b" : "#b98595"; ctx.lineWidth = 4;
    if (name === "glasses") { [-1, 1].forEach(function (side) { ctx.beginPath(); ctx.arc(side * width * 0.23, 0, width * 0.2, 0, Math.PI * 2); ctx.stroke(); }); ctx.beginPath(); ctx.moveTo(-width * 0.03, -3); ctx.quadraticCurveTo(0, -8, width * 0.03, -3); ctx.stroke(); }
    else if (name === "bow") { [-1, 1].forEach(function (side) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(side * width * 0.45, -height * 0.4); ctx.quadraticCurveTo(side * width * 0.6, 0, side * width * 0.45, height * 0.4); ctx.closePath(); ctx.fill(); }); ctx.beginPath(); ctx.arc(0, 0, height * 0.18, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = "#e4cb7a"; ctx.beginPath(); ctx.moveTo(-width / 2, height / 2); ctx.lineTo(-width * 0.55, -height * 0.4); ctx.lineTo(-width * 0.22, 0); ctx.lineTo(0, -height * 0.55); ctx.lineTo(width * 0.22, 0); ctx.lineTo(width * 0.55, -height * 0.4); ctx.lineTo(width / 2, height / 2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  function placedAccessories() {
    if (placements.bow) accessoryArt("bow", world(accessoryAnchor("bow")), 1);
    if (placements.glasses) accessoryArt("glasses", world(accessoryAnchor("glasses")), 1);
    if (placements.crown) accessoryArt("crown", world(accessoryAnchor("crown")), 1);
  }
  function guideLine(a, b) { var from = world(a), to = world(b); ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); }
  function guides() {
    if (!active || won) return; ctx.save(); ctx.strokeStyle = "rgba(255,250,220,.95)"; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.shadowColor = "#368c96"; ctx.shadowBlur = 5;
    if (stage === 2) COMB.forEach(function (t, index) { if (combed[index]) return; guideLine({ x: t[0], y: t[1] - 0.08 }, { x: t[0], y: t[1] + 0.08 }); var p = world({ x: t[0], y: t[1] + 0.08 }); ctx.beginPath(); ctx.moveTo(p.x - 5, p.y - 7); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x + 5, p.y - 7); ctx.stroke(); });
    else if (stage === 3) SNIP.forEach(function (t, index) { if (!snipped[index]) guideLine({ x: t[0] - 0.1, y: t[1] }, { x: t[0] + 0.1, y: t[1] }); });
    else if (stage === 4) spots.forEach(function (s) { if (s.done) return; var p = world(s); ctx.beginPath(); ctx.arc(p.x, p.y, M.w * stampRadius(), 0, Math.PI * 2); ctx.stroke(); });
    else if (stage >= 5 && !placements[mode()]) { var at = world(accessoryLocal()); accessoryArt(mode(), at, 0.25); ctx.beginPath(); ctx.arc(at.x, at.y, magnet() * M.w, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  // after two misses (or 8 s of rubbing): the next target glows and an arrow
  // shows where and how. Local positions; dir says which arrow.
  function glowTarget() {
    var n;
    if (stage === 0) { for (n = 0; n < mud.length; n++) if (!mud[n].clean) return { p: { x: mud[n].x, y: mud[n].y }, dir: "rub", r: 0.13 }; }
    else if (stage === 1) { for (n = 0; n < foam.length; n++) if (!foam[n].clear) return { p: { x: mud[foam[n].patch].x, y: mud[foam[n].patch].y }, dir: "point", r: 0.14 }; }
    else if (stage === 2) { for (n = 0; n < COMB.length; n++) if (!combed[n]) return { p: { x: COMB[n][0], y: COMB[n][1] }, dir: "down", r: 0.11 }; }
    else if (stage === 3) { for (n = 0; n < SNIP.length; n++) if (!snipped[n]) return { p: { x: SNIP[n][0], y: SNIP[n][1] }, dir: "side", r: 0.1 }; }
    else if (stage === 4) { for (n = 0; n < spots.length; n++) if (!spots[n].done) return { p: { x: spots[n].x, y: spots[n].y }, dir: "point", r: 0.12 }; }
    else if (!placements[mode()]) return { p: accessoryLocal(), dir: "drag", r: 0.16 };
    return null;
  }
  function guiding() { return active && !won && ladder() >= 2; }
  function arrow(from, to) {
    var a = Math.atan2(to.y - from.y, to.x - from.x), head = Math.max(12, M.w * 0.05);
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    [["#fffaf0", 9], ["#e0a23a", 5]].forEach(function (pen) {
      ctx.strokeStyle = pen[0]; ctx.lineWidth = pen[1]; ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y);
      ctx.moveTo(to.x - head * Math.cos(a - 0.5), to.y - head * Math.sin(a - 0.5)); ctx.lineTo(to.x, to.y); ctx.lineTo(to.x - head * Math.cos(a + 0.5), to.y - head * Math.sin(a + 0.5)); ctx.stroke();
    });
    ctx.restore();
  }
  function glow() {
    if (!guiding()) return; var g = glowTarget(); if (!g) return;
    var at = world(g.p), bob = calm ? 0 : Math.sin(time * 5), r = M.w * g.r * (1 + 0.06 * bob), u = M.w * 0.1;
    ctx.save(); var shine = ctx.createRadialGradient(at.x, at.y, r * 0.2, at.x, at.y, r); shine.addColorStop(0, "rgba(255,236,150,.6)"); shine.addColorStop(1, "rgba(255,226,120,0)");
    ctx.fillStyle = shine; ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(224,162,58,.9)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(at.x, at.y, r * 0.8, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    var lift = calm ? 0 : bob * 4;
    if (g.dir === "down") arrow({ x: at.x, y: at.y - M.h * 0.08 }, { x: at.x, y: at.y + M.h * 0.08 });
    else if (g.dir === "side") arrow({ x: at.x - M.w * 0.1, y: at.y }, { x: at.x + M.w * 0.1, y: at.y });
    else if (g.dir === "rub") { arrow({ x: at.x - u, y: at.y + lift }, { x: at.x + u, y: at.y + lift }); arrow({ x: at.x + u, y: at.y + u * 0.5 + lift }, { x: at.x - u, y: at.y + u * 0.5 + lift }); }
    else if (g.dir === "drag") { var t = tray(); arrow({ x: t.x, y: t.y - t.r - 4 }, { x: at.x, y: at.y + r * 0.6 }); }
    else arrow({ x: at.x, y: at.y - r - u * 1.2 + lift }, { x: at.x, y: at.y - r * 0.55 + lift });
  }
  function sparkles() {
    if (sparkle <= 0) return; var k = sparkle / BEAT;
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = "#ffe08a"; ctx.strokeStyle = "#e0a23a"; ctx.lineWidth = 1.5;
    for (var n = 0; n < 8; n++) {
      var a = n * Math.PI / 4 + (calm ? 0 : time * 0.8), d = M.w * (0.46 + (calm ? 0 : (1 - k) * 0.08)), x = M.x + Math.cos(a) * d, y = M.y + Math.sin(a) * d * 0.9, r = Math.max(6, M.w * 0.03);
      ctx.beginPath(); for (var q = 0; q < 8; q++) { var rr = q % 2 ? r * 0.42 : r, b = q * Math.PI / 4; ctx[q ? "lineTo" : "moveTo"](x + Math.cos(b) * rr, y + Math.sin(b) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  function tool() {
    if (!active || won || stage >= 5) return;
    var p = world(cursor), name = ["sponge", "shower", "comb", "scissors", "stamp"][stage], size = Math.max(38, M.w * (stage === 3 ? 0.34 : 0.3)), i = image(name);
    if (stage === 1 && held && canPlay()) { ctx.save(); ctx.strokeStyle = "rgba(167,220,225,.9)"; ctx.lineWidth = 2; for (var n = -2; n <= 2; n++) { var dy = (time * 75 + n * 13) % 25; ctx.beginPath(); ctx.moveTo(p.x + n * 4 - 6, p.y - 26 + dy); ctx.lineTo(p.x + n * 5, p.y - 16 + dy); ctx.stroke(); } ctx.restore(); }
    if (stage === 4) { ctx.fillStyle = COLORS[selectedColor]; ctx.strokeStyle = "#866e54"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, size * 0.18, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); return; }
    if (i) { var scale = Math.min(size / i.naturalWidth, size / i.naturalHeight), w = i.naturalWidth * scale, h = i.naturalHeight * scale; var anchor = stage === 1 ? { x: 0.16, y: 0.38 } : stage === 2 ? { x: 0.5, y: 0.95 } : stage === 3 ? { x: 0.1, y: 0.5 } : { x: 0.5, y: 0.5 }; ctx.drawImage(i, p.x - w * anchor.x, p.y - h * anchor.y - (stage === 1 ? 28 : 0), w, h); }
    else { ctx.fillStyle = stage === 0 ? "#e9d58b" : "#83c1c5"; ctx.strokeStyle = "#547f83"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y, size * 0.3, size * 0.18, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); if (stage === 2) for (var tooth = -2; tooth <= 2; tooth++) { ctx.beginPath(); ctx.moveTo(p.x + tooth * size * 0.09, p.y); ctx.lineTo(p.x + tooth * size * 0.09, p.y + size * 0.27); ctx.stroke(); } }
  }
  function draw() {
    if (!ctx) return; ctx.clearRect(0, 0, W, H); background(); base(); coloredSpots(); dirtAndFoam(); fur(); placedAccessories(); guides(); glow(); tool();
    if (stage >= 5 && active && !placements[mode()]) { var t = tray(); ctx.fillStyle = "rgba(255,249,231,.95)"; ctx.strokeStyle = "rgba(171,143,100,.45)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); if (!accessory) accessoryArt(mode(), t, 1); }
    if (accessory) accessoryArt(accessory.type, { x: accessory.x * W, y: accessory.y * H }, 1);
    sparkles();
  }
  function rinseCoverage() { return foam.filter(function (f) { return f.clear; }).length / foam.length; }
  function norm(p) { return { x: p.x / W, y: p.y / H }; }
  function publish() {
    var t = tray(), at = world(accessoryLocal()), cp = world(cursor);
    window.__monster = { active: active, paused: paused, stage: stage, stages: stages, mode: mode(), completed: completed, won: won, power: power, monster: { x: M.x / W, y: M.y / H, w: M.w / W, h: M.h / H }, tool: norm(cp),
      toolRadius: radius() * M.w / W, strokeRequired: required() * M.w / W, directionAllowance: tol().allow, magnet: magnet() * M.w / W, rinseRate: rinseRate(), rinseCoverage: rinseCoverage(),
      mud: mud.map(function (p) { var q = norm(world(p)); return { x: q.x, y: q.y, r: p.r * M.w / W, work: p.work * M.w / W, required: required() * M.w / W, clean: p.clean }; }),
      foam: foam.map(function (p) { var q = norm(world(p)); return { x: q.x, y: q.y, r: 0.03 * M.w / W, patch: p.patch, wet: p.wet, clear: p.clear }; }),
      comb: COMB.map(function (p, index) { var q = norm(world({ x: p[0], y: p[1] })); return { x: q.x, y: q.y, from: norm(world({ x: p[0], y: p[1] - 0.08 })), to: norm(world({ x: p[0], y: p[1] + 0.08 })), done: combed[index] }; }),
      snips: SNIP.map(function (p, index) { var q = norm(world({ x: p[0], y: p[1] })); return { x: q.x, y: q.y, from: norm(world({ x: p[0] - 0.1, y: p[1] })), to: norm(world({ x: p[0] + 0.1, y: p[1] })), done: snipped[index] }; }),
      spots: spots.map(function (p) { var q = norm(world(p)); return { x: q.x, y: q.y, r: stampRadius() * M.w / W, color: p.color, done: p.done }; }),
      palette: COLORS.slice(), selectedColor: selectedColor, tray: { x: t.x / W, y: t.y / H, r: t.r / W }, accessoryTarget: { x: at.x / W, y: at.y / H, r: magnet() * M.w / W },
      accessory: accessory ? { type: accessory.type, x: accessory.x, y: accessory.y } : null, placements: { bow: placements.bow, glasses: placements.glasses, crown: placements.crown }, held: held, dragging: drag !== null, pointerId: drag, strokes: strokes, misses: misses, width: W, height: H,
      ladder: ladder(), jobMisses: jobMisses, stuck: stuck, guide: guiding(), anywhere: active && !won && ladder() >= 3, glow: (function () { var g = guiding() && glowTarget(); return g ? norm(world(g.p)) : null; })(),
      clock: time, doneIn: doneAt, dones: dones, banner: $("monsterBanner").textContent,
      coordinates: "normalized-to-canvas; radii, work and required distances use canvas width" };
  }
  function hud() {
    var allowed = canPlay(), t = tray(), toolButton = $("monsterTool"); document.body.setAttribute("data-monster-mode", mode());
    toolButton.hidden = !active || won; toolButton.disabled = !allowed; toolButton.style.left = M.x + "px"; toolButton.style.top = M.y + "px"; toolButton.style.width = Math.max(48, Math.min(W - 20, M.w * 1.15)) + "px"; toolButton.style.height = Math.max(48, M.h * 1.2) + "px";
    $("monsterHelp").disabled = !allowed || held || !!accessory; $("monsterHearStep").disabled = !allowed || held || !!accessory;
    $("monsterAccessory").hidden = !active || stage < 5 || won || placements[mode()]; $("monsterAccessory").disabled = !allowed;
    $("monsterAccessory").style.left = t.x + "px"; $("monsterAccessory").style.top = t.y + "px"; $("monsterAccessory").style.width = t.r * 2 + "px"; $("monsterAccessory").style.height = t.r * 2 + "px"; $("monsterAccessory").setAttribute("aria-label", "Pick up the " + mode() + ", move with arrows, then press Enter to place it");
    $("monsterPalette").hidden = stage !== 4; for (var n = 0; n < COLORS.length; n++) { $("monsterColor" + n).disabled = !allowed || held; $("monsterColor" + n).setAttribute("aria-pressed", selectedColor === n ? "true" : "false"); }
    $("monsterPower").hidden = !(active && power > 0 && !won); $("monsterPowerFill").style.width = power / POWER * 100 + "%";
    $("monsterToolCard").hidden = stage >= 4; var name = ["sponge", "shower", "comb", "scissors"][Math.min(stage, 3)], preview = $("monsterToolPreview");
    if (preview.getAttribute("data-tool") !== name) { preview.setAttribute("data-tool", name); preview.src = "/assets/crafted/game/" + (name === "sponge" ? "puppy-sponge.webp" : "monster-" + name + "-v1.webp"); } $("monsterToolName").textContent = LABELS[stage]; publish();
  }
  function banner(text) { $("monsterBanner").textContent = text; }
  function releaseCapture() { var s = dragSurface, id = drag; drag = null; dragSurface = null; try { if (s && id !== null && s.hasPointerCapture(id)) s.releasePointerCapture(id); } catch (e) {} }
  function stopGesture() { releaseCapture(); held = false; keyHeld = false; previous = null; path = []; accessory = null; keyboardAccessory = false; }
  // the job is finished: the chime and the sparkle now, the step a beat
  // later (tick), so the next word never cuts the celebration short
  function complete() { if (!canPlay()) return; completed = Math.max(completed, stage + 1); active = false; power = 0; stopGesture(); banner(stage === 7 ? "What a wonderful makeover!" : "Looking happier already!"); api.sfx("correct"); if (api.face) api.face("cheer"); sparkle = BEAT; doneAt = BEAT; hud(); draw(); }
  // a real try that did not finish anything: the next rung of the ladder
  function missed() {
    var before = ladder(); misses++; jobMisses++; banner(ladderLine());
    if (ladder() >= 2 && ladder() > before && api.instruct) api.instruct(ladderLine());
  }
  // rubbing jobs: seconds of real finger work with nothing finished
  function rubbed(dt) {
    stuck += dt; var lv = stuck >= 12 ? 3 : stuck >= 8 ? 2 : stuck >= 4 ? 1 : 0;
    if (lv > rubLevel) { rubLevel = lv; banner(ladderLine()); if (lv >= 2 && api.instruct) api.instruct(ladderLine()); }
  }
  function nearestMud(p) { var best = null, d = 9; mud.forEach(function (m) { if (!m.clean && distance(m, p) < d) { d = distance(m, p); best = m; } }); return best; }
  function scrub(p, distanceMoved) {
    var anywhere = ladder() >= 3 && onMonster(p), near = anywhere ? nearestMud(p) : null;
    mud.forEach(function (m) { if (m.clean || (m !== near && distance(m, p) > m.r + radius())) return; m.work += distanceMoved; if (m.work >= required()) { m.clean = true; stuck = 0; api.sfx("tap"); } });
    if (mud.every(function (m) { return m.clean; })) complete();
  }
  function strokeTo(p) {
    if (!canPlay() || !previous) return; var len = distance(previous, p), steps = Math.max(1, Math.ceil(len / 0.035)), start = previous;
    if (len < 0.005) { cursor = p; return; }
    lastMove = time;
    if (stage === 0) for (var n = 1; n <= steps && canPlay(); n++) scrub({ x: start.x + (p.x - start.x) * n / steps, y: start.y + (p.y - start.y) * n / steps }, len / steps);
    if (stage === 2 || stage === 3) path.push(p); cursor = p; previous = p; hud(); draw();
  }
  // brush and snip windows: the start, salon power or rung 1, then rung 2
  function tol() {
    return stage === 2 ? { dy: pickLow(0.11, 0.1, 0.1, 0.05), allow: pick(0.65, 1.4, 1.4, 2.5), x: pick(0.09, 0.14, 0.14, 0.2), touch: pick(0.09, 0.14, 0.14, 0.2), ends: ladder() >= 2 ? 0.06 : 0 }
      : { dx: pickLow(0.13, 0.09, 0.09, 0.06), allow: pick(0.35, 0.8, 0.8, 1), y: pick(0.045, 0.07, 0.07, 0.12), touch: pick(0.045, 0.07, 0.07, 0.12), ends: ladder() >= 2 ? 0.05 : 0 };
  }
  function pathTouches(target, brushing) {
    var ratio = M.h / M.w, k = tol(), tolerance = k.touch;
    for (var n = 1; n < path.length; n++) {
      var a = path[n - 1], b = path[n], dx = b.x - a.x, dy = (b.y - a.y) * ratio, length2 = dx * dx + dy * dy;
      if (!length2) continue;
      // The part of the real path that meets the fur must move the right
      // way too; a distant U-shaped detour is not a brush or a snip.
      if (brushing ? (dy <= 0 || Math.abs(dx) > dy * k.allow) : (Math.abs(dx) < 0.001 || Math.abs(dy) > Math.abs(dx) * k.allow)) continue;
      var tx = target.x - a.x, ty = (target.y - a.y) * ratio, along = clamp((tx * dx + ty * dy) / length2, 0, 1);
      if (Math.sqrt(Math.pow(tx - dx * along, 2) + Math.pow(ty - dy * along, 2)) <= tolerance) return true;
    }
    return false;
  }
  function finishStroke() {
    if (!canPlay()) return;
    if (stage === 4) {
      var found = null, best = 9, anywhere = ladder() >= 3 && onMonster(cursor);
      spots.forEach(function (s) { var d = distance(s, cursor); if (!s.done && (anywhere || d <= stampRadius()) && d < best) { best = d; found = s; } });
      if (found) { found.done = true; found.color = selectedColor; api.sfx("tap"); }
      if (spots.every(function (s) { return s.done; })) complete(); else if (!found) missed(); return;
    }
    if ((stage !== 2 && stage !== 3) || path.length < 2) return;
    var a = path[0], b = path[path.length - 1], dx = b.x - a.x, dy = (b.y - a.y) * M.h / M.w, match = -1, k = tol();
    var targets = stage === 2 ? COMB : SNIP, done = stage === 2 ? combed : snipped;
    // a tiny wobble is not a try at all: nothing happens and nothing counts
    if (Math.sqrt(dx * dx + dy * dy) < 0.03) return;
    for (var n = 0; n < targets.length; n++) {
      if (done[n]) continue; var t = { x: targets[n][0], y: targets[n][1] };
      if (stage === 2) { if (dy < k.dy || Math.abs(dx) > dy * k.allow || a.y > t.y + k.ends || b.y < t.y - k.ends || Math.abs((a.x + b.x) / 2 - t.x) > k.x) continue; }
      else { if (Math.abs(dx) < k.dx || Math.abs(dy) > Math.abs(dx) * k.allow || Math.min(a.x, b.x) > t.x + k.ends || Math.max(a.x, b.x) < t.x - k.ends || Math.abs((a.y + b.y) / 2 - t.y) * M.h / M.w > k.y) continue; }
      if (!pathTouches(t, stage === 2)) continue;
      match = n; break;
    }
    // rung 3: a brush down (or a sideways snip) anywhere on our friend does
    // the next one; the finger still has to make the stroke
    if (match < 0 && ladder() >= 3 && onMonster({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }) && (stage === 2 ? dy >= 0.03 && Math.abs(dx) <= dy * 3 : Math.abs(dx) >= 0.04 && Math.abs(dy) <= Math.abs(dx) * 2)) {
      for (n = 0; n < done.length; n++) if (!done[n]) { match = n; break; }
    }
    if (match >= 0) { done[match] = true; api.sfx("tap"); if (done.every(function (d) { return d; })) complete(); else banner(stage === 2 ? "Smooth fur. Brush the next curl" : "A neat tuft. Try the next line"); }
    else missed();
  }
  function placeAccessory() {
    if (!accessory || !canPlay()) return; var p = local({ x: accessory.x * W, y: accessory.y * H });
    var moved = keyboardAccessory || Math.abs(accessory.x - accessory.sx) * W + Math.abs(accessory.y - accessory.sy) * H > 12;
    if (distance(p, accessoryLocal()) <= magnet() || (moved && ladder() >= 3 && onMonster(p))) { placements[mode()] = true; complete(); }
    // a tap on the tray that never moved the bow is not a try
    else { accessory = null; keyboardAccessory = false; if (moved) missed(); else banner(ladderLine()); }
  }
  function point(event) { var r = cv.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
  function startStroke(p) { cursor = p; previous = p; path = [p]; held = true; strokes++; }
  function down(event) {
    if (!canPlay() || stage >= 5 || drag !== null || keyHeld || (event.button != null && event.button !== 0)) return;
    var p = local(point(event)); if (p.x < -0.12 || p.x > 1.12 || p.y < -0.12 || p.y > 1.12) return;
    event.preventDefault(); drag = event.pointerId; dragSurface = event.currentTarget; try { dragSurface.setPointerCapture(drag); } catch (e) {} startStroke(p); hud(); draw();
  }
  function move(event) {
    if (event.pointerId !== drag || !canPlay()) return; var p = point(event);
    if (accessory) { accessory.x = p.x / W; accessory.y = p.y / H; cursor = local(p); hud(); draw(); } else strokeTo(local(p));
  }
  function up(event) { if (event.pointerId !== drag) return; releaseCapture(); held = false; if (canPlay()) { if (accessory) placeAccessory(); else finishStroke(); } previous = null; path = []; hud(); draw(); }
  function cancel(event) { if (event.pointerId !== drag) return; stopGesture(); hud(); draw(); }
  function accessoryDown(event) {
    if (!canPlay() || stage < 5 || accessory || drag !== null || (event.button != null && event.button !== 0)) return;
    event.preventDefault(); var p = point(event); accessory = { type: mode(), x: p.x / W, y: p.y / H, sx: p.x / W, sy: p.y / H }; drag = event.pointerId; dragSurface = event.currentTarget;
    try { dragSurface.setPointerCapture(drag); } catch (e) {} hud(); draw();
  }
  function toolKey(event) {
    if (!canPlay() || drag !== null) return; var p = { x: cursor.x, y: cursor.y }, step = event.shiftKey ? 0.025 : 0.075;
    if (event.key === "ArrowLeft") p.x -= step; else if (event.key === "ArrowRight") p.x += step; else if (event.key === "ArrowUp") p.y -= step * M.w / M.h; else if (event.key === "ArrowDown") p.y += step * M.w / M.h;
    else if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (event.repeat) return; if (stage >= 5) { if (keyboardAccessory) placeAccessory(); } else { keyHeld = true; startStroke(cursor); } hud(); draw(); return; }
    else if (event.key === "Escape") { stopGesture(); hud(); draw(); return; } else return;
    event.preventDefault(); p.x = clamp(p.x, -0.15, 1.15); p.y = clamp(p.y, -0.15, 1.15);
    if (keyboardAccessory) { cursor = p; var w = world(p); accessory.x = w.x / W; accessory.y = w.y / H; } else if (keyHeld) strokeTo(p); else cursor = p; hud(); draw();
  }
  function controls() {
    [cv, $("monsterTool")].forEach(function (s) { s.addEventListener("pointerdown", down); s.addEventListener("pointermove", move); s.addEventListener("pointerup", up); s.addEventListener("pointercancel", cancel); s.addEventListener("lostpointercapture", cancel); });
    $("monsterTool").addEventListener("keydown", toolKey); $("monsterTool").addEventListener("keyup", function (event) { if ((event.key === " " || event.key === "Enter") && keyHeld) { event.preventDefault(); keyHeld = false; held = false; finishStroke(); previous = null; path = []; hud(); draw(); } });
    $("monsterTool").addEventListener("blur", function () { if (keyHeld) { held = false; keyHeld = false; previous = null; path = []; hud(); } });
    var a = $("monsterAccessory"); a.addEventListener("pointerdown", accessoryDown); a.addEventListener("pointermove", move); a.addEventListener("pointerup", up); a.addEventListener("pointercancel", cancel); a.addEventListener("lostpointercapture", cancel);
    a.addEventListener("keydown", function (event) { if ((event.key !== "Enter" && event.key !== " ") || !canPlay() || stage < 5 || accessory) return; event.preventDefault(); var p = tray(); accessory = { type: mode(), x: p.x / W, y: p.y / H, sx: p.x / W, sy: p.y / H }; cursor = local(p); keyboardAccessory = true; $("monsterTool").focus(); hud(); draw(); });
    for (var n = 0; n < COLORS.length; n++) (function (index) { $("monsterColor" + index).onclick = function () { if (canPlay() && stage === 4 && !held) { selectedColor = index; hud(); draw(); } }; })(n);
    $("monsterHelp").onclick = function () { if (canPlay() && !held && !accessory) api.practice(); };
    $("monsterHearStep").onclick = function () { if (canPlay() && !held && !accessory && api.instruct) api.instruct(ladder() >= 2 ? ladderLine() : STEP_LINES[stage]); };
    window.addEventListener("resize", fit); document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); }); window.addEventListener("pagehide", function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; }); window.addEventListener("pageshow", function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
  }
  function tick(dt) {
    if (paused || away || document.hidden) return;
    if (sparkle > 0) sparkle = Math.max(0, sparkle - dt);
    // the celebration beat counts only playing time; done() exactly once
    if (doneAt > 0) { time += dt; doneAt = Math.max(0, doneAt - dt); if (doneAt === 0) { dones++; hud(); if (api) api.done(); } return; }
    if (!canPlay()) return; time += dt; power = Math.max(0, power - dt);
    if (stage === 1 && held) {
      var near = null;
      if (ladder() >= 3 && onMonster(cursor)) { var best = 9; foam.forEach(function (f) { var d = distance(f, cursor); if (!f.clear && d < best) { best = d; near = f.patch; } }); }
      foam.forEach(function (f) { if (f.clear || (f.patch !== near && distance(f, cursor) > radius())) return; f.wet = Math.min(1, f.wet + dt * rinseRate()); if (f.wet >= 1) { f.clear = true; stuck = 0; } });
      if (foam.every(function (f) { return f.clear; })) { complete(); return; }
    }
    // real finger work: the shower held down, or the sponge moving
    if (rubbing() && held && (stage === 1 || time - lastMove < 0.4)) rubbed(dt);
    hud();
  }
  function frame(now) { var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; tick(dt); draw(); raf = requestAnimationFrame(frame); }
  function earnPower() { power = POWER; paused = false; active = true; last = 0; banner(ladder() > 0 ? ladderLine() : LABELS[stage]); hud(); }
  function pause() { paused = true; last = 0; stopGesture(); hud(); }
  function reset() { stopGesture(); active = false; paused = false; stage = 0; completed = 0; won = false; power = 0; selectedColor = 0; cursor = { x: MUD[0][0], y: MUD[0][1] }; strokes = 0; misses = 0; time = 0; last = 0; jobMisses = 0; stuck = 0; rubLevel = 0; lastMove = -9; doneAt = 0; dones = 0; sparkle = 0; makeState(); banner("A little monster salon"); hud(); draw(); }
  window.Monster = {
    init: function (a, n) { api = a; stages = n || 8; cv = $("monsterCanvas"); ctx = cv.getContext("2d"); try { calm = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {} makeState(); loadArt(); controls(); fit(); reset(); raf = requestAnimationFrame(frame); },
    // the word earned this job: a new job starts at the bottom of the ladder
    onWord: function (index) { stage = index; jobMisses = 0; stuck = 0; rubLevel = 0; doneAt = 0; stopGesture(); cursor = stage < 2 ? { x: MUD[0][0], y: MUD[0][1] } : stage === 2 ? { x: COMB[0][0], y: COMB[0][1] - 0.08 } : stage === 3 ? { x: SNIP[0][0] - 0.1, y: SNIP[0][1] } : stage === 4 ? { x: SPOTS[0][0], y: SPOTS[0][1] } : accessoryLocal(); earnPower(); if (api.instruct) api.instruct(STEP_LINES[stage]); },
    onHelp: earnPower,
    pause: pause,
    resume: function (playing) { paused = playing === false; last = 0; hud(); },
    reset: reset,
    BANNERS: (function () { var out = ["A little monster salon", "Looking happier already!", "What a wonderful makeover!", "Smooth fur. Brush the next curl", "A neat tuft. Try the next line", "A makeover made by you!"].concat(LABELS); for (var k in LINES) out = out.concat(LINES[k]); return out; })(),
    finale: function () { stopGesture(); active = false; power = 0; won = true; doneAt = 0; banner("A makeover made by you!"); hud(); draw(); }
  };
})();
