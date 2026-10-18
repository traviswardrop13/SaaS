/* Pizza Chef: one pizza, eight steps. Each word the child says two times
   starts the next cooking step (and lends ten seconds of chef power); the
   finger does all the cooking: rolls the dough, spreads the sauce, sprinkles
   the cheese, drags three toppings of each kind to glowing spots, holds Bake
   and takes the pizza out in the green, then swipes along four dotted lines.
   SayPlay owns speech, audio and all reps; this file never touches them.

   EVERY STEP ENDS (CLAUDE.md, "Every ball ends in a basket"), and the help
   that gets it there never needs speech: the chef power is a bonus on top.
   - The dropped and swiped steps (toppings, the oven, the cuts) count misses
     (stageMisses, reset by the next word). A miss is a real try that did not
     work: a topping dragged off the tray and let go away from a spot, an oven
     that got too hot, a full swipe that cut nothing. A tap that moved nothing
     is never a miss, and waiting never is.
     miss 0: the game as designed.
     after 1: easier. Spots catch a topping 1.5x further away, the oven warms
       a little over half as fast, a cut may be 22 degrees off a line and less
       exact through the middle.
     after 2: shown. The spots glow and an arrow points from the topping to
       the nearest one; the oven needle stops in the green by itself and the
       green glows; the next dotted line glows with an arrow along it.
     from the 3rd: almost anything works. A topping let go anywhere over the
       pizza flies to the nearest spot, and any swipe across the pizza cuts
       the nearest line.
   - The rubbing steps (dough, sauce, cheese) count seconds of finger work
     that has not finished the step yet (effort; holding still is not work):
     after 4 s the spots still bare glow and the tool is a little bigger,
     after 8 s it is much bigger, after 12 s every stroke anywhere over the
     plate counts and also fills the nearest bare spots.
   A child aged 2 to 4 gets the glow from the first miss and the snap from
   the second (2, 4 and 6 s on the rubbing steps). No help finishes a step by
   itself: the finger still makes every move, and no timer completes one.
   Local food coordinates use pizza radii; published coordinates use canvas. */
(function () {
  "use strict";
  var STEP_LINES = [
    "Drag the rolling pin back and forth over the dough.",
    "Spread the sauce all over.",
    "Move your finger to sprinkle cheese all over.",
    "Drag each pepperoni to a glowing spot.",
    "Drag each pepper ring to a glowing spot.",
    "Drag each mushroom to a glowing spot.",
    "Hold Bake, let go in the green, tap Take out.",
    "Swipe along each dotted line to cut your pizza."
  ];
  var MODES = ["roll", "sauce", "cheese", "pepperoni", "pepper", "mushroom", "bake", "cut"];
  var LABELS = ["Roll the dough", "Spread the sauce", "Sprinkle cheese", "Add pepperoni", "Add pepper rings", "Add mushrooms", "Watch the oven", "Slice your pizza"];
  // Every other line the banner can show: short, kind, and one line on a
  // 320 px phone (fit() still makes room for the tallest). Never "missed",
  // "wrong", "fail", "score", "points" or "correct".
  var SAY = {
    start: "Say the word to cook!",
    ask: "Say it for chef power",
    roll: "Roll over the dough",
    spots: "Fill the glowing spots",
    topOk: "Yum! Now another one",
    topTap: "Drag it to a glowing spot",
    topClose: "So close! Try again",
    topArrow: "Follow the arrow",
    topSnap: "Drop it on the pizza",
    hot: "A bit too hot! Try again",
    hotAgain: "Hold Bake again",
    across: "Swipe all the way across",
    middle: "Cut through the middle",
    line: "Follow a dotted line",
    other: "Try another line",
    glow: "Follow the glowing line",
    nearly: "Nearly! Swipe across",
    slice: "A slice! Now another",
    yum: "Looking delicious!",
    share: "Ready to share!",
    finale: "Pizza, made by you!"
  };
  var BANNERS = LABELS.concat(Object.keys(SAY).map(function (k) { return SAY[k]; }));
  var api, cv, ctx, W = 390, H = 844, raf = 0, last = 0, art = {}, clock = 0;
  var B = { x: 195, y: 420, r: 135 }, workTop = 140, workBottom = 650, trayY = 700;
  var active = false, paused = false, away = false, stage = 0, stages = 8, completed = 0, won = false, power = 0;
  var rollWork = 0, strokeDistance = 0, grid = [], sauceDots = [], toppings = [], used = [false, false, false], trayUsed = [false, false, false];
  var heat = 0, baking = false, baked = false, overheated = false, bakePointer = null, bakeSurface = null, bakeKey = false;
  var cuts = [false, false, false, false], cursor = { x: -0.8, y: 0 }, path = [], keyHeld = false;
  var drag = null, dragSurface = null, previous = null, ingredient = null, keyboardIngredient = false, misses = 0, strokes = 0;
  // the ladder: stageMisses for the dropped and swiped steps, effort (seconds
  // of finger work) for the rubbing ones; little = a child aged 2 to 4
  var stageMisses = 0, effort = 0, lastWork = -9, little = false;
  // doneAt: the celebration beat. The step is reported this long after the
  // food is finished, on the game's own clock, so the chime is heard whole
  // and a pause in between holds it rather than skipping it (hoops.js too)
  var doneAt = 0, dones = 0, sparks = [], shine = 0, dirty = true, calm = false;
  var POWER = 10, BEAT = 1.15, ANGLES = [0, Math.PI / 4, Math.PI / 2, Math.PI * 3 / 4];
  var RUB = [4, 8, 12], RUB_LITTLE = [2, 4, 6];
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function live() { return !paused && !away && !document.hidden; }
  function canPlay() { return active && !won && live(); }
  function mode() { return MODES[stage]; }
  function isIngredient() { return stage >= 3 && stage <= 5; }
  function rubbing() { return stage <= 2; }
  // ── the ladder ──
  function ladder() {
    if (rubbing()) { var t = little ? RUB_LITTLE : RUB; return effort >= t[2] ? 3 : effort >= t[1] ? 2 : effort >= t[0] ? 1 : 0; }
    var m = stageMisses;
    return little ? (m >= 2 ? 3 : m >= 1 ? 2 : 0) : Math.min(3, m);
  }
  function brush() { return Math.max(power > 0 ? 0.34 : 0.21, [0.21, 0.26, 0.36, 0.44][ladder()]); }
  function rollingGain() { return Math.max(power > 0 ? 1.8 : 1, [1, 1.4, 2.2, 3][ladder()]); }
  // how far out a rubbing stroke may start, and (rolling) still count, in r²
  function reach() { return rubbing() && ladder() >= 3 ? 2 : 1.35; }
  function rollReach() { return ladder() >= 3 ? 2 : 1; }
  function magnet() { return Math.max(power > 0 ? 0.28 : 0.16, [0.16, 0.24, 0.36, 0.36][ladder()]); }
  function heatRate() { var lv = ladder(), r = power > 0 ? 0.14 : 0.28; return lv >= 2 ? Math.min(r, 0.12) : lv >= 1 ? Math.min(r, 0.16) : r; }
  // A released pizza stays ready when power expires. Speech doubles the
  // reaction window by slowing the heat marker, not by moving its goal.
  function band() { return { min: 0.62, max: 0.82 }; }
  // after two hot ovens the needle stops in the green by itself
  function heatCap() { return ladder() >= 2 ? band().max - 0.01 : 1; }
  function cutTolerance() { return Math.max(power > 0 ? 0.27 : 0.14, [0.14, 0.39, 0.6, Math.PI][ladder()]); }
  function cutCentre() { return Math.max(power > 0 ? 0.3 : 0.18, [0.18, 0.3, 0.4, 0.65][ladder()]); }
  function cutRing() { return [0.8, 0.6, 0.5, 0][ladder()]; }
  function cutLength() { return [1.6, 1.3, 1.1, 1][ladder()]; }
  function ready() { var b = band(); return heat >= b.min && heat <= b.max && !overheated; }
  function image(name) { var i = art[name]; return i && i.complete && i.naturalWidth ? i : null; }
  function loadArt() {
    ["kitchen", "base", "rollingpin", "spoon", "cheese", "pepperoni", "pepper", "mushroom", "cutter", "oven"].forEach(function (name) {
      var i = new Image(); i.onload = function () { dirty = true; }; i.src = "/assets/crafted/game/pizza-" + name + "-v1.webp"; art[name] = i;
    });
  }
  function makeGrid() {
    grid = [];
    for (var row = -7; row <= 7; row++) for (var col = -7; col <= 7; col++) { var x = col * 0.11, y = row * 0.11; if (x * x / (0.75 * 0.75) + y * y / (0.69 * 0.69) <= 1) grid.push({ x: x, y: y, sauce: false, cheese: false }); }
  }
  function coverage(name) { var count = 0; grid.forEach(function (g) { if (g[name]) count++; }); return grid.length ? count / grid.length : 0; }
  function targetLocals() {
    if (stage === 3) return [{ x: -0.42, y: -0.3 }, { x: 0.4, y: -0.29 }, { x: 0, y: 0.43 }];
    if (stage === 4) return [{ x: -0.42, y: 0.29 }, { x: 0.44, y: 0.25 }, { x: 0, y: -0.48 }];
    return [{ x: -0.5, y: -0.02 }, { x: 0.48, y: 0.01 }, { x: 0, y: -0.03 }];
  }
  function world(p) { return { x: B.x + p.x * B.r, y: B.y + p.y * B.r }; }
  function local(p) { return { x: (p.x - B.x) / B.r, y: (p.y - B.y) / B.r }; }
  function tray(index) { return W > H && H < 500 ? { x: 58, y: workTop + 24 + index * 49, r: 24 } : { x: W * (0.25 + index * 0.25), y: trayY, r: Math.max(25, Math.min(35, W * 0.085)) }; }
  // the bottom of the tallest banner line, so a line that wraps on a narrow
  // phone (or with large text) still never covers the pizza
  function bannerRoom(top) {
    var b = $("pizzaBanner"), keep = b.textContent, low = 0;
    b.setAttribute("aria-live", "off");
    for (var i = 0; i < BANNERS.length; i++) { b.textContent = BANNERS[i]; low = Math.max(low, b.getBoundingClientRect().bottom); }
    b.textContent = keep; b.setAttribute("aria-live", "polite");
    return low - top;
  }
  function fit() {
    if (!cv) return;
    var rect = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, rect.width); H = Math.max(1, rect.height); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the pizza sits below the banner's tallest line and below the top row
    // (the speaker button and the chef power bar), so neither covers it
    var bannerBottom = bannerRoom(rect.top), topRow = $("pizzaHearStep").getBoundingClientRect().bottom - rect.top;
    workTop = Math.max(bannerBottom + 32, topRow + 4);
    var controlTop = $("pizzaControls").getBoundingClientRect().top - rect.top;
    trayY = controlTop - 54; workBottom = trayY - 48;
    var span = Math.max(60, workBottom - workTop);
    B = { x: W * 0.5, y: workTop + span * 0.5, r: Math.max(26, Math.min(W * 0.36, span * 0.46)) };
    if (W > H && H < 500) { workTop = bannerBottom + 12; workBottom = controlTop - 8; span = Math.max(60, workBottom - workTop); B = { x: W * 0.6, y: workTop + span / 2, r: Math.max(26, Math.min(W * 0.27, span * 0.45)) }; }
    stopGesture(); stopBake(); hud(); draw();
  }
  function background() {
    var i = image("kitchen");
    if (i) { var scale = Math.max(W / i.naturalWidth, H / i.naturalHeight), w = i.naturalWidth * scale, h = i.naturalHeight * scale; ctx.drawImage(i, (W - w) / 2, (H - h) / 2, w, h); }
    else { var wash = ctx.createLinearGradient(0, 0, 0, H); wash.addColorStop(0, "#e2eee7"); wash.addColorStop(0.4, "#f8efdc"); wash.addColorStop(0.55, "#e5cfaa"); wash.addColorStop(1, "#efd9b4"); ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = "rgba(255,249,228,.76)"; ctx.strokeStyle = "rgba(183,153,104,.55)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(B.x, B.y + B.r * 0.06, B.r * 1.13, B.r * 1.12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  function sprite(name, x, y, w, h, alpha) {
    var i = image(name); if (!i) return false;
    var scale = Math.min(w / i.naturalWidth, h / i.naturalHeight), sw = i.naturalWidth * scale, sh = i.naturalHeight * scale;
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.drawImage(i, x - sw / 2, y - sh / 2, sw, sh); ctx.restore(); return true;
  }
  function ingredientArt(name, x, y, size, alpha) {
    if (sprite(name, x, y, size, size, alpha)) return;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.lineWidth = size * 0.12;
    if (name === "pepperoni") { ctx.fillStyle = "#b75f51"; ctx.strokeStyle = "#995548"; ctx.beginPath(); ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#e1a97c"; [[-0.15, -0.13], [0.17, -0.04], [-0.04, 0.18]].forEach(function (p) { ctx.beginPath(); ctx.arc(size * p[0], size * p[1], size * 0.055, 0, Math.PI * 2); ctx.fill(); }); }
    else if (name === "pepper") { ctx.strokeStyle = "#72a557"; ctx.beginPath(); ctx.moveTo(0, -size * 0.35); ctx.bezierCurveTo(size * 0.5, -size * 0.4, size * 0.35, size * 0.45, 0, size * 0.32); ctx.bezierCurveTo(-size * 0.5, size * 0.43, -size * 0.4, -size * 0.5, 0, -size * 0.35); ctx.stroke(); }
    else { ctx.fillStyle = "#e5d2b2"; ctx.strokeStyle = "#b89a77"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-size * 0.12, size * 0.35); ctx.lineTo(-size * 0.1, 0); ctx.lineTo(size * 0.1, 0); ctx.lineTo(size * 0.13, size * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, -size * 0.07, size * 0.39, size * 0.27, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  function food(x, y, radius) {
    ctx.save(); ctx.translate(x, y); ctx.scale(radius, radius);
    var scale = stage === 0 && completed === 0 ? 0.64 + clamp(rollWork / 7, 0, 1) * 0.36 : 1;
    if (!sprite("base", 0, 0, scale * 2, scale * 2, 1)) { var crust = ctx.createRadialGradient(-0.2, -0.2, 0.15, 0, 0, scale); crust.addColorStop(0, "#f4dfab"); crust.addColorStop(0.82, "#f0d39a"); crust.addColorStop(1, "#d1aa68"); ctx.fillStyle = crust; ctx.beginPath(); ctx.arc(0, 0, scale, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 0.78, 0.72, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#bc6250"; sauceDots.forEach(function (p) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); });
    grid.forEach(function (g, index) {
      if (!g.cheese) return;
      ctx.strokeStyle = index % 2 ? "#e9cb7e" : "#f7e4a5"; ctx.lineWidth = 0.025; ctx.lineCap = "round";
      for (var shred = 0; shred < 4; shred++) { var a = index * 1.7 + shred * 2.1, dx = Math.sin(a * 3) * 0.044, dy = Math.cos(a * 2) * 0.044; ctx.beginPath(); ctx.moveTo(g.x + dx - Math.cos(a) * 0.025, g.y + dy - Math.sin(a) * 0.025); ctx.lineTo(g.x + dx + Math.cos(a) * 0.025, g.y + dy + Math.sin(a) * 0.025); ctx.stroke(); }
    });
    ctx.restore();
    toppings.forEach(function (t) { ingredientArt(t.type, t.x, t.y, t.type === "pepper" ? 0.31 : 0.3, 1); });
    cuts.forEach(function (done, index) { if (!done) return; ctx.strokeStyle = "rgba(106,74,39,.85)"; ctx.lineWidth = 0.025; var a = ANGLES[index]; ctx.beginPath(); ctx.moveTo(-Math.cos(a) * 0.96, -Math.sin(a) * 0.96); ctx.lineTo(Math.cos(a) * 0.96, Math.sin(a) * 0.96); ctx.stroke(); });
    ctx.restore();
  }
  // a thick arrow, cream under teal, so it reads on dough, sauce and wood
  function arrow(x1, y1, x2, y2) {
    var a = Math.atan2(y2 - y1, x2 - x1), head = 14;
    ctx.save(); ctx.setLineDash([]); ctx.shadowBlur = 0;
    [["#fffbe6", 10], ["#258995", 5]].forEach(function (pen) {
      ctx.strokeStyle = pen[0]; ctx.lineWidth = pen[1]; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.moveTo(x2 - head * Math.cos(a - 0.6), y2 - head * Math.sin(a - 0.6)); ctx.lineTo(x2, y2); ctx.lineTo(x2 - head * Math.cos(a + 0.6), y2 - head * Math.sin(a + 0.6));
      ctx.stroke();
    });
    ctx.restore();
  }
  function pulse() { return calm ? 0.6 : 0.5 + 0.5 * Math.sin(clock * 4); }
  // the free spot nearest a point (local), or -1
  function nearestFree(p) {
    var ts = targetLocals(), found = -1, best = Infinity;
    for (var n = 0; n < ts.length; n++) { if (used[n]) continue; var d = Math.sqrt(Math.pow(ts[n].x - p.x, 2) + Math.pow(ts[n].y - p.y, 2)); if (d < best) { best = d; found = n; } }
    return { index: found, distance: best };
  }
  function guides() {
    if (!active || won || stage === 6) return;
    var lv = ladder(), beat = pulse();
    ctx.save(); ctx.translate(B.x, B.y); ctx.scale(B.r, B.r); ctx.lineWidth = 0.02; ctx.strokeStyle = "rgba(38,137,149,.85)";
    if (stage === 0) {
      if (lv >= 1) { ctx.strokeStyle = "#ffcf4a"; ctx.lineWidth = 0.035; ctx.shadowColor = "#ffcf4a"; ctx.shadowBlur = 10 + 10 * beat; }
      ctx.setLineDash([0.06, 0.06]); ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-0.7, 0); ctx.lineTo(0.7, 0); ctx.stroke();
      [-1, 1].forEach(function (side) { ctx.beginPath(); ctx.moveTo(side * 0.6, -0.08); ctx.lineTo(side * 0.72, 0); ctx.lineTo(side * 0.6, 0.08); ctx.stroke(); });
    } else if (stage === 1 || stage === 2) {
      // every bare spot glows once the tool has been at work a while
      grid.forEach(function (g, index) {
        if (g[mode()] || (lv < 1 && index % 7)) return;
        ctx.fillStyle = lv >= 1 ? "rgba(255,214,90," + (0.55 + 0.35 * beat).toFixed(3) + ")" : "rgba(255,249,221,.75)";
        ctx.beginPath(); ctx.arc(g.x, g.y, lv >= 1 ? 0.045 : 0.035, 0, Math.PI * 2); ctx.fill();
      });
    } else if (isIngredient()) {
      targetLocals().forEach(function (t, index) {
        if (used[index]) return; ingredientArt(mode(), t.x, t.y, 0.31, 0.25);
        if (lv >= 2) { ctx.save(); ctx.setLineDash([]); ctx.fillStyle = "rgba(255,226,120," + (0.28 + 0.2 * beat).toFixed(3) + ")"; ctx.strokeStyle = "#ffcf4a"; ctx.lineWidth = 0.04; ctx.shadowColor = "#ffcf4a"; ctx.shadowBlur = 16 + 12 * beat; ctx.beginPath(); ctx.arc(t.x, t.y, magnet(), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); return; }
        ctx.strokeStyle = "rgba(253,255,222,.96)"; ctx.lineWidth = 0.025; ctx.shadowColor = "#278b96"; ctx.shadowBlur = 8 / B.r; ctx.setLineDash([0.04, 0.04]); ctx.beginPath(); ctx.arc(t.x, t.y, magnet(), 0, Math.PI * 2); ctx.stroke();
      });
    } else if (stage === 7) {
      var next = cuts.indexOf(false);
      ANGLES.forEach(function (a, index) {
        if (cuts[index]) return; var lead = index === next;
        ctx.save(); ctx.setLineDash([0.055, 0.06]);
        if (lead && lv >= 2) { ctx.strokeStyle = "#ffcf4a"; ctx.lineWidth = 0.05; ctx.shadowColor = "#ffcf4a"; ctx.shadowBlur = 14 + 12 * beat; }
        else { ctx.strokeStyle = lead ? "#fff9d5" : "rgba(48,132,139,.7)"; ctx.lineWidth = lead ? 0.028 : 0.018; }
        ctx.beginPath(); ctx.moveTo(-Math.cos(a), -Math.sin(a)); ctx.lineTo(Math.cos(a), Math.sin(a)); ctx.stroke(); ctx.restore();
      });
      if (path.length) { ctx.setLineDash([]); ctx.strokeStyle = "#fff6d8"; ctx.lineWidth = 0.02; ctx.beginPath(); path.forEach(function (p, index) { if (index) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke(); }
    }
    ctx.restore();
    // after two misses an arrow shows exactly where to go
    if (lv < 2) return;
    if (isIngredient()) {
      var from = null;
      if (ingredient) from = { x: ingredient.x * W, y: ingredient.y * H };
      else for (var n = 0; n < 3 && !from; n++) if (!trayUsed[n]) from = tray(n);
      if (!from) return;
      var near = nearestFree(local(from)); if (near.index < 0) return;
      var to = world(targetLocals()[near.index]), dx = to.x - from.x, dy = to.y - from.y, len = Math.sqrt(dx * dx + dy * dy), gap = magnet() * B.r + 6;
      if (len > gap + 30) arrow(from.x + dx / len * 30, from.y + dy / len * 30, to.x - dx / len * gap, to.y - dy / len * gap);
    } else if (stage === 7) {
      var lead = cuts.indexOf(false); if (lead < 0) return;
      var a = ANGLES[lead], s = world({ x: -Math.cos(a) * 1.18, y: -Math.sin(a) * 1.18 }), e = world({ x: Math.cos(a) * 1.18, y: Math.sin(a) * 1.18 });
      ctx.save(); ctx.fillStyle = "#ffcf4a"; ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      arrow(s.x, s.y, e.x, e.y);
    }
  }
  function tool() {
    if (!active || won || isIngredient() || stage === 6) return;
    var p = world(cursor), name = ["rollingpin", "spoon", "cheese"][stage] || "cutter", size = B.r * (stage === 0 ? 0.92 : 0.5);
    var i = image(name);
    if (i) {
      var sw = size, sh = stage === 0 ? size * 0.5 : size, scale = Math.min(sw / i.naturalWidth, sh / i.naturalHeight); sw = i.naturalWidth * scale; sh = i.naturalHeight * scale;
      var anchor = stage === 1 ? { x: 0.27, y: 0.29 } : stage === 7 ? { x: 0.27, y: 0.66 } : { x: 0.5, y: 0.5 };
      ctx.drawImage(i, p.x - sw * anchor.x, p.y - sh * anchor.y, sw, sh);
    } else {
      ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = "#ad8f64"; ctx.strokeStyle = "#7f7058"; ctx.lineWidth = 2;
      if (stage === 0) { ctx.fillRect(-size * 0.5, -size * 0.05, size, size * 0.1); ctx.fillStyle = "#e4c693"; ctx.fillRect(-size * 0.3, -size * 0.14, size * 0.6, size * 0.28); }
      else if (stage === 7) { ctx.fillStyle = "#c8d5ce"; ctx.beginPath(); ctx.arc(0, 0, size * 0.26, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#ad8f64"; ctx.fillRect(0, -size * 0.4, size * 0.13, size * 0.4); }
      else { ctx.beginPath(); ctx.ellipse(0, 0, size * 0.2, size * 0.3, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.restore();
    }
  }
  function oven() {
    var ow = Math.min(B.r * 2.4, W * 0.86), oh = Math.min(B.r * 2.4, workBottom - workTop);
    var i = image("oven");
    if (i) { var scale = Math.min(ow / i.naturalWidth, oh / i.naturalHeight); ow = i.naturalWidth * scale; oh = i.naturalHeight * scale; ctx.drawImage(i, B.x - ow / 2, B.y - oh / 2, ow, oh); }
    else { ctx.fillStyle = "#78a9ab"; ctx.strokeStyle = "#4b777a"; ctx.lineWidth = 3; ctx.fillRect(B.x - ow / 2, B.y - oh / 2, ow, oh); ctx.fillStyle = "#524b46"; ctx.fillRect(B.x - ow * 0.38, B.y - oh * 0.25, ow * 0.76, oh * 0.6); }
    ctx.save(); ctx.translate(B.x, B.y + oh * 0.12); ctx.scale(1, 0.58); food(0, 0, Math.min(ow * 0.24, oh * 0.28)); ctx.restore();
    if (heat > 0) { ctx.fillStyle = "rgba(232,193,115," + Math.min(0.2, heat * 0.18) + ")"; ctx.beginPath(); ctx.ellipse(B.x, B.y + oh * 0.12, ow * 0.26, oh * 0.16, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  // the game's own cheer when a step is done: a warm ring round the pizza
  // and (with motion on) a ring of little sparkles
  function burst() {
    shine = 1; sparks = [];
    if (calm) return;
    for (var i = 0; i < 20; i++) { var a = i / 20 * Math.PI * 2, v = 110 + (i % 3) * 45; sparks.push({ x: B.x + Math.cos(a) * B.r * 0.7, y: B.y + Math.sin(a) * B.r * 0.7, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, life: 0.9, c: ["#ffd76a", "#78baca", "#d79598"][i % 3] }); }
  }
  function cheerFx() {
    if (shine > 0) { ctx.save(); ctx.globalAlpha = shine; ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 6; ctx.shadowColor = "#ffcf4a"; ctx.shadowBlur = 22; ctx.beginPath(); ctx.arc(B.x, B.y, B.r * 1.06, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    sparks.forEach(function (p) { ctx.save(); ctx.globalAlpha = Math.max(0, p.life / 0.9); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
  }
  function ageFx(dt) {
    if (shine > 0) { shine = Math.max(0, shine - dt / 1.1); dirty = true; }
    if (sparks.length) { dirty = true; sparks = sparks.filter(function (p) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; return p.life > 0; }); }
  }
  function draw() {
    if (!ctx) return; dirty = false; ctx.clearRect(0, 0, W, H); background();
    if (stage === 6 && !baked) oven(); else { food(B.x, B.y, B.r); guides(); tool(); }
    if (isIngredient() && active) {
      for (var n = 0; n < 3; n++) { var t = tray(n); ctx.fillStyle = "rgba(255,249,231,.94)"; ctx.strokeStyle = "rgba(171,143,100,.45)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); if (!trayUsed[n] && (!ingredient || ingredient.index !== n)) ingredientArt(mode(), t.x, t.y, t.r * 1.45, 1); }
    }
    if (ingredient) ingredientArt(ingredient.type, ingredient.x * W, ingredient.y * H, B.r * 0.34, 1);
    cheerFx();
  }
  function normalizedPoint(p) { return { x: p.x / W, y: p.y / H }; }
  function publish() {
    var targets = [], trays = [], cells = grid.map(function (g) { var p = world(g); return { x: p.x / W, y: p.y / H, sauce: g.sauce, cheese: g.cheese }; });
    if (isIngredient()) { targetLocals().forEach(function (t, index) { var p = world(t); targets.push({ x: p.x / W, y: p.y / H, r: magnet() * B.r / W, filled: used[index], placed: used[index] }); }); for (var n = 0; n < 3; n++) { var t = tray(n); trays.push({ x: t.x / W, y: t.y / H, r: t.r / W, used: trayUsed[n] }); } }
    var cp = world(cursor), b = band(), lv = ladder();
    window.__pizza = { active: active, paused: paused, stage: stage, stages: stages, mode: mode(), completed: completed, won: won, power: power, board: { x: B.x / W, y: B.y / H, r: B.r / W },
      cursor: normalizedPoint(cp), brushRadius: brush() * B.r / W, rollingGain: rollingGain(), rollProgress: clamp(rollWork / 7, 0, 1), strokeDistance: strokeDistance * B.r,
      sauceCoverage: coverage("sauce"), cheeseCoverage: coverage("cheese"), coverageThreshold: stage === 1 ? 0.86 : 0.82, grid: cells, tray: trays, targets: targets,
      ingredient: ingredient ? { index: ingredient.index, type: ingredient.type, x: ingredient.x, y: ingredient.y } : null, dragging: drag !== null, pointerId: drag, strokes: strokes, misses: misses,
      stageMisses: stageMisses, effort: effort, ladder: lv, little: little, guide: active && !won && lv >= 2, snap: active && !won && lv >= 3, magnet: magnet(),
      doneIn: doneAt ? Math.max(0, doneAt - clock) : 0, dones: dones, banner: $("pizzaBanner").textContent,
      heat: heat, heatRate: heatRate(), heatCap: heatCap(), readyBand: b, ready: ready(), baking: baking, baked: baked, overheated: overheated,
      cuts: ANGLES.map(function (a, index) { var start = world({ x: -Math.cos(a), y: -Math.sin(a) }), end = world({ x: Math.cos(a), y: Math.sin(a) }); return { angle: a, done: cuts[index], start: normalizedPoint(start), end: normalizedPoint(end) }; }),
      cutTolerance: cutTolerance(), cutCentre: cutCentre(), cutRing: cutRing(), cutLength: cutLength(), width: W, height: H, coordinates: "normalized-to-canvas; all radii use canvas width; cutTolerance is radians; cutCentre, cutRing and cutLength use pizza radii" };
  }
  function hud() {
    var allowed = canPlay(), bakingMode = stage === 6, b = band(), toolButton = $("pizzaTool"), lv = ladder();
    document.body.setAttribute("data-pizza-mode", mode());
    toolButton.hidden = !active || won || bakingMode; toolButton.disabled = !allowed;
    toolButton.style.left = B.x + "px"; toolButton.style.top = B.y + "px"; toolButton.style.width = B.r * 2.2 + "px"; toolButton.style.height = B.r * 2.2 + "px";
    $("pizzaHelp").disabled = !allowed || drag !== null || keyHeld || baking;
    $("pizzaHearStep").disabled = !allowed || drag !== null || baking;
    $("pizzaBake").hidden = !bakingMode; $("pizzaBake").disabled = !allowed || overheated; $("pizzaBake").setAttribute("aria-pressed", baking ? "true" : "false");
    $("pizzaTakeOut").hidden = !bakingMode || overheated; $("pizzaTakeOut").disabled = !allowed || !ready();
    $("pizzaTakeOut").classList.toggle("guide", allowed && bakingMode && lv >= 2 && ready());
    $("pizzaRetry").hidden = !bakingMode || !overheated; $("pizzaRetry").disabled = !allowed;
    $("pizzaHeat").hidden = !bakingMode; $("pizzaHeat").classList.toggle("guide", bakingMode && active && lv >= 2);
    $("pizzaHeatNeedle").style.left = heat * 100 + "%"; $("pizzaReadyBand").style.left = b.min * 100 + "%"; $("pizzaReadyBand").style.width = (b.max - b.min) * 100 + "%";
    $("pizzaHeatLabel").textContent = overheated ? "Too hot. Tap Try again" : ready() ? "Ready! Take it out" : lv >= 2 ? "Hold Bake to the green" : "Hold Bake";
    $("pizzaHeat").setAttribute("aria-valuenow", Math.round(heat * 100));
    $("pizzaPower").hidden = !(active && power > 0 && !won); $("pizzaPowerFill").style.width = power / POWER * 100 + "%";
    $("pizzaToolCard").hidden = bakingMode || isIngredient();
    $("pizzaToolName").textContent = LABELS[stage]; var preview = $("pizzaToolPreview"), name = ["rollingpin", "spoon", "cheese"][stage] || "cutter";
    if (preview.getAttribute("data-tool") !== name) { preview.setAttribute("data-tool", name); preview.src = "/assets/crafted/game/pizza-" + name + "-v1.webp"; }
    for (var n = 0; n < 3; n++) { var button = $("pizzaIngredient" + n), t = tray(n); button.hidden = !isIngredient() || !active || trayUsed[n]; button.disabled = !allowed || !!(ingredient && ingredient.index !== n); button.style.left = t.x + "px"; button.style.top = t.y + "px"; button.style.width = t.r * 2 + "px"; button.style.height = t.r * 2 + "px"; button.setAttribute("aria-label", "Pick up " + mode() + " " + (n + 1) + ", then use arrows and Enter to place it"); }
    dirty = true; publish();
  }
  function banner(text) { $("pizzaBanner").textContent = text; if (cv) publish(); }
  function stopCapture() { var s = dragSurface, id = drag; drag = null; dragSurface = null; try { if (s && id !== null && s.hasPointerCapture(id)) s.releasePointerCapture(id); } catch (e) {} }
  function stopGesture() { stopCapture(); previous = null; keyHeld = false; path = []; ingredient = null; keyboardIngredient = false; }
  function stopBake() { var s = bakeSurface, id = bakePointer; bakePointer = null; bakeSurface = null; baking = false; bakeKey = false; try { if (s && id !== null && s.hasPointerCapture(id)) s.releasePointerCapture(id); } catch (e) {} }
  // A real try that did not work: one more step of help for this step only
  function missed(line) { misses++; stageMisses++; banner(line()); }
  function complete() {
    if (!canPlay()) return;
    completed = Math.max(completed, stage + 1); active = false; power = 0; stopGesture(); stopBake();
    banner(stage === 7 ? SAY.share : SAY.yum); api.sfx("correct"); burst();
    // the step is reported after the beat (tick), exactly once
    doneAt = clock + BEAT; hud(); draw();
  }
  // lv 3 on the sauce and cheese: each bit of a moving stroke also fills the
  // two bare spots nearest the finger, so rubbing anywhere gets it done
  function fillNearest(p, name) {
    for (var k = 0; k < 2; k++) {
      var pick = null, best = Infinity;
      grid.forEach(function (g) { if (g[name]) return; var d = (g.x - p.x) * (g.x - p.x) + (g.y - p.y) * (g.y - p.y); if (d < best) { best = d; pick = g; } });
      if (!pick) return; pick[name] = true; if (stage === 1) sauceDots.push({ x: pick.x, y: pick.y, r: 0.09 });
    }
  }
  function stamp(p, moving) {
    if (stage !== 1 && stage !== 2) return;
    var r = brush(), name = mode();
    grid.forEach(function (g) { if ((g.x - p.x) * (g.x - p.x) + (g.y - p.y) * (g.y - p.y) <= r * r) g[name] = true; });
    if (stage === 1 && p.x * p.x + p.y * p.y <= 1.3) sauceDots.push({ x: p.x, y: p.y, r: r });
    if (moving && ladder() >= 3) fillNearest(p, name);
    if (coverage(name) >= (stage === 1 ? 0.86 : 0.82)) complete();
  }
  function strokeTo(p) {
    if (!canPlay() || !previous) return;
    var dx = p.x - previous.x, dy = p.y - previous.y, distance = Math.sqrt(dx * dx + dy * dy), steps = Math.max(1, Math.ceil(distance / 0.055)), start = previous;
    if (distance < 0.012) { cursor = p; return; }
    if (rubbing()) lastWork = clock;
    for (var n = 1; n <= steps && canPlay(); n++) {
      var q = { x: start.x + dx * n / steps, y: start.y + dy * n / steps };
      if (stage === 0 && q.x * q.x + q.y * q.y <= rollReach()) { strokeDistance += distance / steps; rollWork += distance / steps * rollingGain(); if (rollWork >= 7) complete(); }
      else if (stage === 1 || stage === 2) stamp(q, true);
    }
    if (stage === 7) path.push(p);
    cursor = p; previous = p; hud(); draw();
  }
  // the banner for the rubbing steps once help has started
  function workLine() { if (rubbing() && ladder() >= 1) banner(stage === 0 ? SAY.roll : SAY.spots); }
  function cut() {
    if (stage !== 7 || path.length < 2) return;
    var a = path[0], b = path[path.length - 1], dx = b.x - a.x, dy = b.y - a.y, length = Math.sqrt(dx * dx + dy * dy);
    // a tap, or a little wiggle, is not a try at a cut
    if (length < 0.45) { banner(SAY.across); return; }
    // the closest the swipe came to the middle, and where along it
    var nearest = Infinity, at = 0;
    for (var n = 1; n < path.length; n++) {
      var p = path[n - 1], q = path[n], sx = q.x - p.x, sy = q.y - p.y, len2 = sx * sx + sy * sy, along = len2 ? clamp(-(p.x * sx + p.y * sy) / len2, 0, 1) : 0;
      var d = Math.sqrt(Math.pow(p.x + sx * along, 2) + Math.pow(p.y + sy * along, 2)); if (d < nearest) { nearest = d; at = n; }
    }
    // it must come in over the crust and go out over it again (a swipe may
    // start or end anywhere on the table); from the 3rd miss, any swipe
    // long enough through the pizza does
    var ring = cutRing(), inside = ring <= 0, outside = ring <= 0;
    for (n = 0; n < path.length; n++) { var r = Math.sqrt(path[n].x * path[n].x + path[n].y * path[n].y); if (r >= ring) { if (n < at) inside = true; else outside = true; } }
    if (!inside || !outside || length < cutLength()) { missed(function () { return cutMissLine(SAY.across); }); return; }
    if (nearest > cutCentre()) { missed(function () { return cutMissLine(SAY.middle); }); return; }
    var angle = Math.atan2(dy, dx); while (angle < 0) angle += Math.PI; while (angle >= Math.PI) angle -= Math.PI;
    // the nearest line still to cut, and the nearest line of all
    var match = -1, best = Infinity, any = -1, anyBest = Infinity;
    ANGLES.forEach(function (guide, index) {
      var delta = Math.abs(angle - guide); delta = Math.min(delta, Math.PI - delta);
      if (delta < anyBest) { anyBest = delta; any = index; }
      if (!cuts[index] && delta < best) { best = delta; match = index; }
    });
    if (match < 0 || best > cutTolerance()) { missed(function () { return cutMissLine(cuts[any] ? SAY.other : SAY.line); }); return; }
    cuts[match] = true; api.sfx("tap"); if (cuts.every(function (done) { return done; })) complete(); else banner(SAY.slice);
  }
  // after a cut that did not work: what to fix first, then what the help shows
  function cutMissLine(first) { var lv = ladder(); return lv >= 3 ? SAY.nearly : lv >= 2 ? SAY.glow : first; }
  function point(event) { var r = cv.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
  // a new touch has done no work yet (the third-of-a-second window is per stroke)
  function startStroke(p) { cursor = p; previous = p; path = [p]; strokes++; lastWork = -9; if (stage === 1 || stage === 2) stamp(p, false); }
  function down(event) {
    if (!canPlay() || isIngredient() || stage === 6 || drag !== null || keyHeld || (event.button != null && event.button !== 0)) return;
    // a cut may start out on the table; the rubbing tools start on the plate
    var p = local(point(event)); if (stage !== 7 && p.x * p.x + p.y * p.y > reach()) return;
    event.preventDefault(); drag = event.pointerId; dragSurface = event.currentTarget; try { dragSurface.setPointerCapture(drag); } catch (e) {}
    startStroke(p); hud(); draw();
  }
  function move(event) {
    if (event.pointerId !== drag || !canPlay()) return;
    var p = point(event);
    if (ingredient) { ingredient.x = p.x / W; ingredient.y = p.y / H; cursor = local(p); hud(); draw(); }
    else strokeTo(local(p));
  }
  function placeIngredient() {
    if (!ingredient || !canPlay()) return;
    var at = { x: ingredient.x * W, y: ingredient.y * H }, p = local(at), ts = targetLocals(), home = tray(ingredient.index), lv = ladder();
    var near = nearestFree(p), moved = Math.sqrt(Math.pow(at.x - home.x, 2) + Math.pow(at.y - home.y, 2));
    var found = near.index >= 0 && near.distance <= magnet() ? near.index : -1;
    // from the 3rd miss: let go anywhere over the pizza (or carried up off
    // the tray toward it) and the topping flies to the nearest spot
    if (found < 0 && lv >= 3 && moved > home.r && (p.x * p.x + p.y * p.y <= 2.25 || at.y < home.y - home.r)) found = near.index;
    if (found >= 0) {
      used[found] = true; trayUsed[ingredient.index] = true; toppings.push({ type: mode(), x: ts[found].x, y: ts[found].y }); api.sfx("tap"); ingredient = null; keyboardIngredient = false;
      if (used.every(function (u) { return u; })) complete(); else banner(SAY.topOk);
    } else if (moved <= home.r * 1.1) { ingredient = null; keyboardIngredient = false; banner(SAY.topTap); }
    else { ingredient = null; keyboardIngredient = false; missed(function () { var l = ladder(); return l >= 3 ? SAY.topSnap : l >= 2 ? SAY.topArrow : SAY.topClose; }); }
  }
  function up(event) {
    if (event.pointerId !== drag) return;
    stopCapture(); if (canPlay()) { if (ingredient) placeIngredient(); else cut(); } previous = null; path = []; lastWork = -9; hud(); draw();
  }
  function cancel(event) { if (event.pointerId !== drag) return; stopGesture(); hud(); draw(); }
  function ingredientDown(event, index) {
    if (!canPlay() || !isIngredient() || trayUsed[index] || ingredient || drag !== null || (event.button != null && event.button !== 0)) return;
    event.preventDefault(); var p = point(event); ingredient = { index: index, type: mode(), x: p.x / W, y: p.y / H }; drag = event.pointerId; dragSurface = event.currentTarget;
    try { dragSurface.setPointerCapture(drag); } catch (e) {} hud(); draw();
  }
  function ingredientKey(event, index) {
    if ((event.key !== "Enter" && event.key !== " ") || !canPlay() || !isIngredient() || trayUsed[index] || ingredient) return;
    event.preventDefault(); var p = tray(index); ingredient = { index: index, type: mode(), x: p.x / W, y: p.y / H }; keyboardIngredient = true; cursor = local(p); $("pizzaTool").focus(); hud(); draw();
  }
  function toolKey(event) {
    if (!canPlay() || drag !== null || stage === 6) return;
    var p = { x: cursor.x, y: cursor.y }, step = event.shiftKey ? 0.06 : 0.15;
    if (event.key === "ArrowLeft") p.x -= step; else if (event.key === "ArrowRight") p.x += step; else if (event.key === "ArrowUp") p.y -= step; else if (event.key === "ArrowDown") p.y += step;
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (event.repeat) return; if (isIngredient()) { if (keyboardIngredient) { placeIngredient(); hud(); draw(); } } else { keyHeld = true; startStroke(cursor); hud(); draw(); } return; }
    else return;
    event.preventDefault(); p.x = clamp(p.x, -1.2, 1.2); p.y = clamp(p.y, -1.2, 1.2);
    if (isIngredient() && keyboardIngredient) { cursor = p; var w = world(p); ingredient.x = w.x / W; ingredient.y = w.y / H; }
    else if (keyHeld) strokeTo(p); else cursor = p;
    hud(); draw();
  }
  function toolKeyUp(event) { if ((event.key === "Enter" || event.key === " ") && keyHeld) { event.preventDefault(); keyHeld = false; if (canPlay()) cut(); previous = null; path = []; hud(); draw(); } }
  function bakeDown(event) {
    if (!canPlay() || stage !== 6 || overheated || bakePointer !== null || bakeKey || (event.button != null && event.button !== 0)) return;
    event.preventDefault(); bakePointer = event.pointerId; bakeSurface = event.currentTarget; baking = true; try { bakeSurface.setPointerCapture(bakePointer); } catch (e) {} hud();
  }
  function bakeUp(event) { if (event.pointerId !== bakePointer) return; stopBake(); hud(); }
  function takeOut() { if (!canPlay() || stage !== 6 || !ready()) return; baked = true; stopBake(); complete(); }
  function retryBake() { if (!canPlay() || stage !== 6 || !overheated) return; stopBake(); heat = 0; overheated = false; banner(SAY.hotAgain); hud(); draw(); }
  function controls() {
    [cv, $("pizzaTool")].forEach(function (s) { s.addEventListener("pointerdown", down); s.addEventListener("pointermove", move); s.addEventListener("pointerup", up); s.addEventListener("pointercancel", cancel); s.addEventListener("lostpointercapture", cancel); });
    $("pizzaTool").addEventListener("keydown", toolKey); $("pizzaTool").addEventListener("keyup", toolKeyUp); $("pizzaTool").addEventListener("blur", function () { if (keyHeld) { keyHeld = false; previous = null; path = []; hud(); } });
    for (var n = 0; n < 3; n++) (function (index) { var s = $("pizzaIngredient" + index); s.addEventListener("pointerdown", function (event) { ingredientDown(event, index); }); s.addEventListener("pointermove", move); s.addEventListener("pointerup", up); s.addEventListener("pointercancel", cancel); s.addEventListener("lostpointercapture", cancel); s.addEventListener("keydown", function (event) { ingredientKey(event, index); }); })(n);
    var bake = $("pizzaBake"); bake.addEventListener("pointerdown", bakeDown); bake.addEventListener("pointerup", bakeUp); bake.addEventListener("pointercancel", bakeUp); bake.addEventListener("lostpointercapture", bakeUp);
    bake.addEventListener("keydown", function (event) { if (event.key !== " " && event.key !== "Enter") return; event.preventDefault(); if (canPlay() && stage === 6 && !overheated && !event.repeat && bakePointer === null) { bakeKey = true; baking = true; hud(); } });
    bake.addEventListener("keyup", function (event) { if ((event.key === " " || event.key === "Enter") && bakeKey) { event.preventDefault(); stopBake(); hud(); } }); bake.addEventListener("blur", function () { if (bakeKey) { stopBake(); hud(); } });
    $("pizzaTakeOut").onclick = takeOut; $("pizzaRetry").onclick = retryBake;
    // optional extra help: the same word again for ten seconds of chef power
    $("pizzaHelp").onclick = function () { if (canPlay() && drag === null && !keyHeld && !baking && api.practice() !== false) banner(SAY.ask); };
    $("pizzaHearStep").onclick = function () { if (canPlay() && drag === null && !baking && api.instruct) api.instruct(STEP_LINES[stage]); };
    window.addEventListener("resize", fit); document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    window.addEventListener("pagehide", function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; });
    window.addEventListener("pageshow", function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
  }
  function tick(dt) {
    // the game's own clock runs only while the page can be seen and is not
    // paused, so the celebration beat waits through a pause, never past it
    if (!live()) return;
    clock += dt; ageFx(dt);
    if (doneAt && clock >= doneAt) { doneAt = 0; dones++; publish(); if (api) api.done(); return; }
    if (!canPlay()) { if (doneAt) publish(); return; }
    power = Math.max(0, power - dt);
    // finger work on a rubbing step: a stroke moved in the last third of a
    // second (holding the tool still is not work)
    if (rubbing() && (drag !== null || keyHeld) && clock - lastWork < 0.35) { var before = ladder(); effort += dt; if (ladder() !== before) workLine(); }
    if (stage === 6 && baking && !overheated) {
      heat = Math.min(heatCap(), heat + dt * heatRate());
      if (heat > band().max) { overheated = true; stopBake(); missed(function () { return SAY.hot; }); }
    }
    hud();
  }
  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; tick(dt);
    // the kitchen is redrawn while the child can cook or a cheer is playing,
    // and otherwise only when something changed (a word turn sits still)
    if (dirty || canPlay() || shine > 0 || sparks.length) draw();
    raf = requestAnimationFrame(frame);
  }
  function earnPower() { power = POWER; paused = false; active = true; last = 0; banner(LABELS[stage]); hud(); }
  function pause() { paused = true; last = 0; stopGesture(); stopBake(); hud(); }
  function reset() {
    stopGesture(); stopBake(); active = false; paused = false; stage = 0; completed = 0; won = false; power = 0; rollWork = 0; strokeDistance = 0; sauceDots = []; toppings = []; used = [false, false, false]; trayUsed = [false, false, false]; heat = 0; baked = false; overheated = false; cuts = [false, false, false, false]; cursor = { x: -0.8, y: 0 }; misses = 0; strokes = 0; last = 0;
    stageMisses = 0; effort = 0; lastWork = -9; doneAt = 0; shine = 0; sparks = [];
    makeGrid(); banner(SAY.start); hud(); draw();
  }
  window.Pizza = {
    init: function (a, n) {
      api = a; stages = n || 8; cv = $("pizzaCanvas"); ctx = cv.getContext("2d");
      try { calm = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}
      makeGrid(); loadArt(); controls(); fit(); reset(); raf = requestAnimationFrame(frame);
      // the banner's lines are measured in the page's own font: measure again
      // once it has loaded, unless a finger is on the kitchen right then
      try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (drag === null && bakePointer === null && !keyHeld && !bakeKey) fit(); }); } catch (e) {}
    },
    // a word heard two times: the next cooking step, with ten seconds of power
    onWord: function (index) { stage = index; stageMisses = 0; effort = 0; lastWork = -9; doneAt = 0; stopGesture(); stopBake(); used = [false, false, false]; trayUsed = [false, false, false]; cursor = { x: -0.8, y: 0 }; earnPower(); if (api.instruct) api.instruct(STEP_LINES[stage]); },
    // the optional help word: the same step, ten more seconds of power
    onHelp: earnPower,
    pause: pause,
    // back to the same move from exactly where it stopped. A help ask that
    // ended with no word also lands here: no power, the step's help unchanged
    resume: function (playing) { paused = playing === false; last = 0; if (!paused && active && $("pizzaBanner").textContent === SAY.ask) banner(LABELS[stage]); hud(); },
    reset: reset,
    finale: function () { stopGesture(); stopBake(); active = false; power = 0; won = true; doneAt = 0; banner(SAY.finale); hud(); draw(); },
    // ages 2 to 4 get the gentler help ladder (the page asks Sona.playStyle)
    setLittle: function (on) { little = !!on; if (cv) hud(); },
    BANNERS: BANNERS,
    STEP_LINES: STEP_LINES
  };
})();
