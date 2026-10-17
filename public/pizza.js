/* Pizza Chef: one pizza made by actual strokes, coverage, placements, oven
   control and four separate cuts. SayPlay owns speech, audio and all reps.
   Local food coordinates use pizza radii; published coordinates use canvas. */
(function () {
  "use strict";
  var STEP_LINES = [
    "Drag the rolling pin back and forth over the dough.",
    "Spread the sauce with the spoon.",
    "Move your finger to sprinkle cheese all over.",
    "Drag each pepperoni to a glowing spot.",
    "Drag each pepper ring to a glowing spot.",
    "Drag each mushroom to a glowing spot.",
    "Hold Bake. Take it out when the oven is ready.",
    "Swipe across each dotted line to cut your pizza."
  ];
  var MODES = ["roll", "sauce", "cheese", "pepperoni", "pepper", "mushroom", "bake", "cut"];
  var LABELS = ["Roll the dough", "Spread the sauce", "Sprinkle cheese", "Add pepperoni", "Add pepper rings", "Add mushrooms", "Watch the oven", "Slice your pizza"];
  var api, cv, ctx, W = 390, H = 844, raf = 0, last = 0, art = {};
  var B = { x: 195, y: 420, r: 135 }, workTop = 140, workBottom = 650, trayY = 700;
  var active = false, paused = false, away = false, stage = 0, stages = 8, completed = 0, won = false, power = 0;
  var rollWork = 0, strokeDistance = 0, grid = [], sauceDots = [], toppings = [], used = [false, false, false], trayUsed = [false, false, false];
  var heat = 0, baking = false, baked = false, overheated = false, bakePointer = null, bakeSurface = null, bakeKey = false;
  var cuts = [false, false, false, false], cursor = { x: -0.8, y: 0 }, path = [], cuttingPath = [], keyHeld = false;
  var drag = null, dragSurface = null, previous = null, ingredient = null, keyboardIngredient = false, misses = 0, strokes = 0;
  var POWER = 10, ANGLES = [0, Math.PI / 4, Math.PI / 2, Math.PI * 3 / 4];
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function canPlay() { return active && !paused && !away && !won && !document.hidden; }
  function mode() { return MODES[stage]; }
  function isIngredient() { return stage >= 3 && stage <= 5; }
  function brush() { return power > 0 ? 0.34 : 0.21; }
  function rollingGain() { return power > 0 ? 1.8 : 1; }
  function magnet() { return power > 0 ? 0.28 : 0.16; }
  function heatRate() { return power > 0 ? 0.14 : 0.28; }
  // A released pizza stays ready when power expires. Speech doubles the
  // reaction window by slowing the heat marker, not by moving its goal.
  function band() { return { min: 0.62, max: 0.82 }; }
  function cutTolerance() { return power > 0 ? 0.27 : 0.14; }
  function ready() { var b = band(); return heat >= b.min && heat <= b.max && !overheated; }
  function image(name) { var i = art[name]; return i && i.complete && i.naturalWidth ? i : null; }
  function loadArt() {
    ["kitchen", "base", "rollingpin", "spoon", "cheese", "pepperoni", "pepper", "mushroom", "cutter", "oven"].forEach(function (name) {
      var i = new Image(); i.onload = draw; i.src = "/assets/crafted/game/pizza-" + name + "-v1.webp"; art[name] = i;
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
  function fit() {
    if (!cv) return;
    var rect = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, rect.width); H = Math.max(1, rect.height); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    workTop = $("pizzaBanner").getBoundingClientRect().bottom - rect.top + 32;
    var controlTop = $("pizzaControls").getBoundingClientRect().top - rect.top;
    trayY = controlTop - 54; workBottom = trayY - 48;
    var span = Math.max(60, workBottom - workTop);
    B = { x: W * 0.5, y: workTop + span * 0.5, r: Math.max(26, Math.min(W * 0.36, span * 0.46)) };
    if (W > H && H < 500) { workTop = $("pizzaBanner").getBoundingClientRect().bottom - rect.top + 12; workBottom = controlTop - 8; span = Math.max(60, workBottom - workTop); B = { x: W * 0.6, y: workTop + span / 2, r: Math.max(26, Math.min(W * 0.27, span * 0.45)) }; }
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
  function guides() {
    if (!active || won || stage === 6) return;
    ctx.save(); ctx.translate(B.x, B.y); ctx.scale(B.r, B.r); ctx.lineWidth = 0.02; ctx.strokeStyle = "rgba(38,137,149,.85)";
    if (stage === 0) {
      ctx.setLineDash([0.06, 0.06]); ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-0.7, 0); ctx.lineTo(0.7, 0); ctx.stroke();
      [-1, 1].forEach(function (side) { ctx.beginPath(); ctx.moveTo(side * 0.6, -0.08); ctx.lineTo(side * 0.72, 0); ctx.lineTo(side * 0.6, 0.08); ctx.stroke(); });
    } else if (stage === 1 || stage === 2) {
      grid.forEach(function (g, index) { if (g[mode()] || index % 7) return; ctx.fillStyle = "rgba(255,249,221,.75)"; ctx.beginPath(); ctx.arc(g.x, g.y, 0.035, 0, Math.PI * 2); ctx.fill(); });
    } else if (isIngredient()) {
      targetLocals().forEach(function (t, index) { if (used[index]) return; ingredientArt(mode(), t.x, t.y, 0.31, 0.25); ctx.strokeStyle = "rgba(253,255,222,.96)"; ctx.lineWidth = 0.025; ctx.shadowColor = "#278b96"; ctx.shadowBlur = 8 / B.r; ctx.setLineDash([0.04, 0.04]); ctx.beginPath(); ctx.arc(t.x, t.y, magnet(), 0, Math.PI * 2); ctx.stroke(); });
    } else if (stage === 7) {
      ANGLES.forEach(function (a, index) { if (cuts[index]) return; ctx.setLineDash([0.055, 0.06]); ctx.strokeStyle = index === cuts.indexOf(false) ? "#fff9d5" : "rgba(48,132,139,.7)"; ctx.lineWidth = index === cuts.indexOf(false) ? 0.028 : 0.018; ctx.beginPath(); ctx.moveTo(-Math.cos(a), -Math.sin(a)); ctx.lineTo(Math.cos(a), Math.sin(a)); ctx.stroke(); });
      if (path.length) { ctx.setLineDash([]); ctx.strokeStyle = "#fff6d8"; ctx.lineWidth = 0.02; ctx.beginPath(); path.forEach(function (p, index) { if (index) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke(); }
    }
    ctx.restore();
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
  function draw() {
    if (!ctx) return; ctx.clearRect(0, 0, W, H); background();
    if (stage === 6 && !baked) oven(); else { food(B.x, B.y, B.r); guides(); tool(); }
    if (isIngredient() && active) {
      for (var n = 0; n < 3; n++) { var t = tray(n); ctx.fillStyle = "rgba(255,249,231,.94)"; ctx.strokeStyle = "rgba(171,143,100,.45)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); if (!trayUsed[n] && (!ingredient || ingredient.index !== n)) ingredientArt(mode(), t.x, t.y, t.r * 1.45, 1); }
    }
    if (ingredient) ingredientArt(ingredient.type, ingredient.x * W, ingredient.y * H, B.r * 0.34, 1);
  }
  function normalizedPoint(p) { return { x: p.x / W, y: p.y / H }; }
  function publish() {
    var targets = [], trays = [], cells = grid.map(function (g) { var p = world(g); return { x: p.x / W, y: p.y / H, sauce: g.sauce, cheese: g.cheese }; });
    if (isIngredient()) { targetLocals().forEach(function (t, index) { var p = world(t); targets.push({ x: p.x / W, y: p.y / H, r: magnet() * B.r / W, filled: used[index], placed: used[index] }); }); for (var n = 0; n < 3; n++) { var t = tray(n); trays.push({ x: t.x / W, y: t.y / H, r: t.r / W, used: trayUsed[n] }); } }
    var cp = world(cursor), b = band();
    window.__pizza = { active: active, paused: paused, stage: stage, stages: stages, mode: mode(), completed: completed, won: won, power: power, board: { x: B.x / W, y: B.y / H, r: B.r / W },
      cursor: normalizedPoint(cp), brushRadius: brush() * B.r / W, rollingGain: rollingGain(), rollProgress: clamp(rollWork / 7, 0, 1), strokeDistance: strokeDistance * B.r,
      sauceCoverage: coverage("sauce"), cheeseCoverage: coverage("cheese"), coverageThreshold: stage === 1 ? 0.86 : 0.82, grid: cells, tray: trays, targets: targets,
      ingredient: ingredient ? { index: ingredient.index, type: ingredient.type, x: ingredient.x, y: ingredient.y } : null, dragging: drag !== null, pointerId: drag, strokes: strokes, misses: misses,
      heat: heat, heatRate: heatRate(), readyBand: b, ready: ready(), baking: baking, baked: baked, overheated: overheated,
      cuts: ANGLES.map(function (a, index) { var start = world({ x: -Math.cos(a), y: -Math.sin(a) }), end = world({ x: Math.cos(a), y: Math.sin(a) }); return { angle: a, done: cuts[index], start: normalizedPoint(start), end: normalizedPoint(end) }; }),
      cutTolerance: cutTolerance(), width: W, height: H, coordinates: "normalized-to-canvas; all radii use canvas width; cutTolerance is radians" };
  }
  function hud() {
    var allowed = canPlay(), bakingMode = stage === 6, b = band(), toolButton = $("pizzaTool");
    document.body.setAttribute("data-pizza-mode", mode());
    toolButton.hidden = !active || won || bakingMode; toolButton.disabled = !allowed;
    toolButton.style.left = B.x + "px"; toolButton.style.top = B.y + "px"; toolButton.style.width = B.r * 2.2 + "px"; toolButton.style.height = B.r * 2.2 + "px";
    $("pizzaHelp").disabled = !allowed || drag !== null || keyHeld || baking;
    $("pizzaHearStep").disabled = !allowed || drag !== null || baking;
    $("pizzaBake").hidden = !bakingMode; $("pizzaBake").disabled = !allowed || overheated; $("pizzaBake").setAttribute("aria-pressed", baking ? "true" : "false");
    $("pizzaTakeOut").hidden = !bakingMode || overheated; $("pizzaTakeOut").disabled = !allowed || !ready();
    $("pizzaRetry").hidden = !bakingMode || !overheated; $("pizzaRetry").disabled = !allowed;
    $("pizzaHeat").hidden = !bakingMode; $("pizzaHeatNeedle").style.left = heat * 100 + "%"; $("pizzaReadyBand").style.left = b.min * 100 + "%"; $("pizzaReadyBand").style.width = (b.max - b.min) * 100 + "%";
    $("pizzaHeatLabel").textContent = overheated ? "Too hot. Try again" : ready() ? "Ready! Take it out" : "Hold Bake";
    $("pizzaHeat").setAttribute("aria-valuenow", Math.round(heat * 100));
    $("pizzaPower").hidden = !(active && power > 0 && !won); $("pizzaPowerFill").style.width = power / POWER * 100 + "%";
    $("pizzaToolCard").hidden = bakingMode || isIngredient();
    $("pizzaToolName").textContent = LABELS[stage]; var preview = $("pizzaToolPreview"), name = ["rollingpin", "spoon", "cheese"][stage] || "cutter";
    if (preview.getAttribute("data-tool") !== name) { preview.setAttribute("data-tool", name); preview.src = "/assets/crafted/game/pizza-" + name + "-v1.webp"; }
    for (var n = 0; n < 3; n++) { var button = $("pizzaIngredient" + n), t = tray(n); button.hidden = !isIngredient() || !active || trayUsed[n]; button.disabled = !allowed || !!(ingredient && ingredient.index !== n); button.style.left = t.x + "px"; button.style.top = t.y + "px"; button.style.width = t.r * 2 + "px"; button.style.height = t.r * 2 + "px"; button.setAttribute("aria-label", "Pick up " + mode() + " " + (n + 1) + ", then use arrows and Enter to place it"); }
    publish();
  }
  function banner(text) { $("pizzaBanner").textContent = text; }
  function stopCapture() { var s = dragSurface, id = drag; drag = null; dragSurface = null; try { if (s && id !== null && s.hasPointerCapture(id)) s.releasePointerCapture(id); } catch (e) {} }
  function stopGesture() { stopCapture(); previous = null; keyHeld = false; path = []; cuttingPath = []; ingredient = null; keyboardIngredient = false; }
  function stopBake() { var s = bakeSurface, id = bakePointer; bakePointer = null; bakeSurface = null; baking = false; bakeKey = false; try { if (s && id !== null && s.hasPointerCapture(id)) s.releasePointerCapture(id); } catch (e) {} }
  function complete() {
    if (!canPlay()) return; completed = Math.max(completed, stage + 1); active = false; power = 0; stopGesture(); stopBake(); banner(stage === 7 ? "Your pizza is ready to share!" : "Looking delicious!"); api.sfx("correct"); hud(); draw(); api.done();
  }
  function stamp(p) {
    if (stage !== 1 && stage !== 2) return;
    var r = brush(), name = mode();
    grid.forEach(function (g) { if ((g.x - p.x) * (g.x - p.x) + (g.y - p.y) * (g.y - p.y) <= r * r) g[name] = true; });
    if (stage === 1 && p.x * p.x + p.y * p.y <= 1.3) sauceDots.push({ x: p.x, y: p.y, r: r });
    if (coverage(name) >= (stage === 1 ? 0.86 : 0.82)) complete();
  }
  function strokeTo(p) {
    if (!canPlay() || !previous) return;
    var dx = p.x - previous.x, dy = p.y - previous.y, distance = Math.sqrt(dx * dx + dy * dy), steps = Math.max(1, Math.ceil(distance / 0.055)), start = previous;
    if (distance < 0.012) { cursor = p; return; }
    for (var n = 1; n <= steps && canPlay(); n++) {
      var q = { x: start.x + dx * n / steps, y: start.y + dy * n / steps };
      if (stage === 0 && q.x * q.x + q.y * q.y <= 1) { strokeDistance += distance / steps; rollWork += distance / steps * rollingGain(); if (rollWork >= 7) complete(); }
      else if (stage === 1 || stage === 2) stamp(q);
    }
    if (stage === 7) path.push(p);
    cursor = p; previous = p; hud(); draw();
  }
  function cut() {
    if (stage !== 7 || path.length < 2) return;
    var a = path[0], b = path[path.length - 1], dx = b.x - a.x, dy = b.y - a.y, length = Math.sqrt(dx * dx + dy * dy);
    if (Math.sqrt(a.x * a.x + a.y * a.y) < 0.8 || Math.sqrt(b.x * b.x + b.y * b.y) < 0.8 || length < 1.6 || a.x * b.x + a.y * b.y > -0.45) { misses++; banner("Swipe right across the pizza"); return; }
    var nearest = Infinity;
    for (var n = 1; n < path.length; n++) { var p = path[n - 1], q = path[n], sx = q.x - p.x, sy = q.y - p.y, len2 = sx * sx + sy * sy, along = len2 ? clamp(-(p.x * sx + p.y * sy) / len2, 0, 1) : 0; nearest = Math.min(nearest, Math.sqrt(Math.pow(p.x + sx * along, 2) + Math.pow(p.y + sy * along, 2))); }
    if (nearest > (power > 0 ? 0.3 : 0.18)) { misses++; banner("Cut across the middle"); return; }
    var angle = Math.atan2(dy, dx); while (angle < 0) angle += Math.PI; while (angle >= Math.PI) angle -= Math.PI;
    var match = -1, best = Infinity;
    ANGLES.forEach(function (guide, index) { var delta = Math.abs(angle - guide); delta = Math.min(delta, Math.PI - delta); if (delta < best) { best = delta; match = index; } });
    if (best > cutTolerance() || cuts[match]) { misses++; banner(cuts[match] ? "Try another dotted line" : "Follow a dotted line"); return; }
    cuts[match] = true; api.sfx("tap"); if (cuts.every(function (done) { return done; })) complete(); else banner("A slice! Try the next dotted line");
  }
  function point(event) { var r = cv.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
  function startStroke(p) { cursor = p; previous = p; path = [p]; strokes++; if (stage === 1 || stage === 2) stamp(p); }
  function down(event) {
    if (!canPlay() || isIngredient() || stage === 6 || drag !== null || keyHeld || (event.button != null && event.button !== 0)) return;
    var p = local(point(event)); if (p.x * p.x + p.y * p.y > 1.35) return;
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
    var p = local({ x: ingredient.x * W, y: ingredient.y * H }), ts = targetLocals(), found = -1;
    for (var n = 0; n < ts.length; n++) if (!used[n] && Math.sqrt(Math.pow(ts[n].x - p.x, 2) + Math.pow(ts[n].y - p.y, 2)) <= magnet()) { found = n; break; }
    if (found >= 0) { used[found] = true; trayUsed[ingredient.index] = true; toppings.push({ type: mode(), x: ts[found].x, y: ts[found].y }); api.sfx("tap"); ingredient = null; keyboardIngredient = false; if (used.every(function (u) { return u; })) complete(); else banner("Another topping for your pizza!"); }
    else { misses++; ingredient = null; keyboardIngredient = false; banner("Still yours. Try a glowing spot"); }
  }
  function up(event) {
    if (event.pointerId !== drag) return;
    stopCapture(); if (canPlay()) { if (ingredient) placeIngredient(); else cut(); } previous = null; path = []; hud(); draw();
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
  function retryBake() { if (!canPlay() || stage !== 6 || !overheated) return; stopBake(); heat = 0; overheated = false; banner("Try again. Take it out when ready"); hud(); draw(); }
  function controls() {
    [cv, $("pizzaTool")].forEach(function (s) { s.addEventListener("pointerdown", down); s.addEventListener("pointermove", move); s.addEventListener("pointerup", up); s.addEventListener("pointercancel", cancel); s.addEventListener("lostpointercapture", cancel); });
    $("pizzaTool").addEventListener("keydown", toolKey); $("pizzaTool").addEventListener("keyup", toolKeyUp); $("pizzaTool").addEventListener("blur", function () { if (keyHeld) { keyHeld = false; previous = null; path = []; hud(); } });
    for (var n = 0; n < 3; n++) (function (index) { var s = $("pizzaIngredient" + index); s.addEventListener("pointerdown", function (event) { ingredientDown(event, index); }); s.addEventListener("pointermove", move); s.addEventListener("pointerup", up); s.addEventListener("pointercancel", cancel); s.addEventListener("lostpointercapture", cancel); s.addEventListener("keydown", function (event) { ingredientKey(event, index); }); })(n);
    var bake = $("pizzaBake"); bake.addEventListener("pointerdown", bakeDown); bake.addEventListener("pointerup", bakeUp); bake.addEventListener("pointercancel", bakeUp); bake.addEventListener("lostpointercapture", bakeUp);
    bake.addEventListener("keydown", function (event) { if (event.key !== " " && event.key !== "Enter") return; event.preventDefault(); if (canPlay() && stage === 6 && !overheated && !event.repeat && bakePointer === null) { bakeKey = true; baking = true; hud(); } });
    bake.addEventListener("keyup", function (event) { if ((event.key === " " || event.key === "Enter") && bakeKey) { event.preventDefault(); stopBake(); hud(); } }); bake.addEventListener("blur", function () { if (bakeKey) { stopBake(); hud(); } });
    $("pizzaTakeOut").onclick = takeOut; $("pizzaRetry").onclick = retryBake;
    $("pizzaHelp").onclick = function () { if (canPlay() && drag === null && !keyHeld && !baking) api.practice(); };
    $("pizzaHearStep").onclick = function () { if (canPlay() && drag === null && !baking && api.instruct) api.instruct(STEP_LINES[stage]); };
    window.addEventListener("resize", fit); document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    window.addEventListener("pagehide", function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; });
    window.addEventListener("pageshow", function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
  }
  function tick(dt) {
    if (!canPlay()) return; power = Math.max(0, power - dt);
    if (stage === 6 && baking && !overheated) { heat = Math.min(1, heat + dt * heatRate()); if (heat > band().max) { overheated = true; stopBake(); banner("A little too hot. Try again"); } }
    hud();
  }
  function frame(now) { var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; tick(dt); draw(); raf = requestAnimationFrame(frame); }
  function earnPower() { power = POWER; paused = false; active = true; last = 0; banner(LABELS[stage]); hud(); }
  function pause() { paused = true; last = 0; stopGesture(); stopBake(); hud(); }
  function reset() {
    stopGesture(); stopBake(); active = false; paused = false; stage = 0; completed = 0; won = false; power = 0; rollWork = 0; strokeDistance = 0; sauceDots = []; toppings = []; used = [false, false, false]; trayUsed = [false, false, false]; heat = 0; baked = false; overheated = false; cuts = [false, false, false, false]; cursor = { x: -0.8, y: 0 }; misses = 0; strokes = 0; last = 0; makeGrid(); banner("Let's make a pizza!"); hud(); draw();
  }
  window.Pizza = {
    init: function (a, n) { api = a; stages = n || 8; cv = $("pizzaCanvas"); ctx = cv.getContext("2d"); makeGrid(); loadArt(); controls(); fit(); reset(); raf = requestAnimationFrame(frame); },
    onWord: function (index) { stage = index; stopGesture(); stopBake(); used = [false, false, false]; trayUsed = [false, false, false]; cursor = { x: -0.8, y: 0 }; earnPower(); if (api.instruct) api.instruct(STEP_LINES[stage]); },
    onHelp: earnPower,
    pause: pause,
    resume: function (playing) { paused = playing === false; last = 0; hud(); },
    reset: reset,
    finale: function () { stopGesture(); stopBake(); active = false; power = 0; won = true; banner("Pizza, made by you!"); hud(); draw(); }
  };
})();
