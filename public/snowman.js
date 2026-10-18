/* Build a Snowman: real rolling distance, three stack contacts, then five
   hand-placed decorations. SayPlay alone owns speech, voice and repetitions. */
(function () {
  "use strict";
  var STEP_LINES = [
    "Roll it back and forth. When it is big, lift it to the glowing circle.",
    "Roll another snowball, then lift it onto the middle circle.",
    "Roll the little snowball, then lift it onto the head circle.",
    "Drag the coal face and carrot onto the little snowball.",
    "Drag the hat, scarf, and twig arms onto your snowman."
  ];
  var api, cv, ctx, W = 390, H = 844, raf = 0, last = 0, art = {}, active = false, paused = false, away = false, won = false, stage = 0, stages = 5, completed = 0, power = 0;
  var stacked = [false, false, false], rotations = [0, 0, 0], stack = [], zone = { left: 0.06, right: 0.94, top: 0.7, bottom: 0.84 }, tray = [], targets = [];
  var ball = { x: 0.3, y: 0.8, progress: 0, distance: 0, angle: 0 }, placed = { coal: false, nose: false, hat: false, scarf: false, arms: false }, pieces = [];
  var top = 120, bottom = 750, maxR = 50, trail = [], held = null, owner = null, surface = null, grab = { x: 0, y: 0 }, keyboardHeld = false, misses = 0;
  // Every step ends without speech (the Hoops rule, gentler for ages 3-4).
  // stageMisses: real failed lifts or drops this step. After one the target
  // glows and an arrow points from the piece to it, with a window about twice
  // as wide; from the second, a release anywhere on the snowman's side works.
  // Rolling and long drags are continuous, so they step up by time spent
  // actively moving without success (tryTime, rollTry), as Dino Dig does.
  // No help ever finishes a move: the finger still lifts and lets go.
  var stageMisses = 0, tryTime = 0, rollTry = 0, clock = 0, lastMove = -9, doneAt = 0, powerLive = false, holdFrom = { x: 0, y: 0 };
  var POWER = 10, $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function canPlay() { return active && !paused && !away && !won && !document.hidden; }
  function mode() { return stage < 3 ? "roll" : stage === 3 ? "face" : "dress"; }
  function banner(text) { if ($("snowmanBanner").textContent !== text) $("snowmanBanner").textContent = text; }
  function image(name) { var i = art[name]; return i && i.complete && i.naturalWidth ? i : null; }
  function rollLevel() { return rollTry >= 8 ? 2 : rollTry >= 4 ? 1 : 0; }
  function level() { return Math.max(Math.min(2, stageMisses), tryTime >= 8 ? 2 : tryTime >= 4 ? 1 : 0); }
  function growthRate() { return (power > 0 ? 1.2 : 0.6) * [1, 1.5, 3][rollLevel()]; }
  function desiredR() { return stack[Math.min(2, stage)].r; }
  function ballR() { return desiredR() * (0.38 + 0.62 * ball.progress); }
  // A finger-sized window first (a preschooler's finger is about 40 px), the
  // word's power wider, and about twice as wide again once the ladder starts.
  function magnet() {
    var balls = stage < 3, r = balls ? desiredR() : stack[2].r, px;
    if (balls) px = power > 0 ? Math.max(40, r * 0.85) : Math.max(30, r * 0.6);
    else px = power > 0 ? Math.max(52, r * 1.2) : Math.max(40, r * 0.85);
    return (level() >= 1 ? Math.max(px * 2, balls ? 60 : 80) : px) / W;
  }
  function loadArt() {
    [["bg", "/assets/crafted/game/snowman-bg.webp"], ["ball", "/assets/crafted/game/snowman-ball-clean-v1.webp"], ["nose", "/assets/crafted/game/snowman-carrot-v1.webp"], ["scarf", "/assets/crafted/game/snowman-scarf-v1.webp"], ["arms", "/assets/crafted/game/snowman-twig-arms-v1.webp"], ["hat", "/assets/crafted/hat-tophat.webp"]].forEach(function (p) { var i = new Image(); i.onload = draw; i.src = p[1]; art[p[0]] = i; });
  }
  function pieceShape(id) {
    var head = stack[2], middle = stack[1], r = head.r;
    if (id === "coal") return { x: head.x, y: head.y, w: r * 1.55, h: r * 1.28 };
    if (id === "nose") return { x: head.x + r * 0.432, y: head.y + r * 0.07, w: r * 0.95, h: r * 0.95 * 101 / 256 };
    if (id === "hat") return { x: head.x, y: head.y - r * 1.68, w: r * 2.25, h: r * 2.25 };
    if (id === "scarf") { var scarfW = r * 2.62, scarfH = scarfW * 259 / 384; return { x: head.x - scarfW * 0.05, y: head.y + r * 0.82 + scarfH * 0.12, w: scarfW, h: scarfH }; }
    var armW = maxR * 4.7, armH = armW * 174 / 512;
    return { x: middle.x, y: middle.y - armH * 0.378, w: armW, h: armH };
  }
  function buildAccessories() {
    var ids = stage < 3 ? [] : stage === 3 ? ["coal", "nose"] : ["hat", "scarf", "arms"], previous = pieces;
    targets = ids.map(function (id) { var p = pieceShape(id); return { id: id, x: p.x / W, y: p.y / H, w: p.w / W, h: p.h / H }; });
    tray = ids.map(function (id, n) { return { id: id, x: zone.left + (zone.right - zone.left) * (n + 0.5) / ids.length, y: (zone.top + zone.bottom) / 2, w: 70 / W, h: 70 / H }; });
    pieces = ids.map(function (id, n) { var old = previous.filter(function (p) { return p.id === id; })[0]; return { id: id, x: old && held && held.index === n ? old.x : tray[n].x, y: old && held && held.index === n ? old.y : tray[n].y }; });
  }
  function fit() {
    if (!cv) return;
    var rect = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.max(1, rect.width); H = Math.max(1, rect.height); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    top = $("snowmanBanner").getBoundingClientRect().bottom - rect.top + 12; bottom = $("snowmanControls").getBoundingClientRect().top - rect.top - 12;
    var room = Math.max(90, bottom - top), landscape = W > H && H < 500, cx, base;
    cancelGesture();
    if (landscape) {
      maxR = Math.min(W * 0.075, room / 5.7); cx = W * 0.74; base = bottom - 4;
      zone = { left: 0.055, right: 0.48, top: (top + room * 0.52 - maxR - 8) / H, bottom: (top + room * 0.52 + maxR + 8) / H };
    } else {
      maxR = Math.min(W * 0.145, room * 0.122); var laneH = maxR * 2 + 18;
      zone = { left: 0.055, right: 0.945, top: (bottom - laneH) / H, bottom: bottom / H }; cx = W * 0.5; base = zone.top * H - 13;
    }
    // Painted edges are soft and slightly irregular when rotated. Nest each
    // real ball into the one below so its visible snow always makes contact.
    var r0 = maxR, r1 = maxR * 0.75, r2 = maxR * 0.54, y0 = base - r0, y1 = y0 - r0 - r1 + maxR * 0.30, y2 = y1 - r1 - r2 + maxR * 0.18;
    stack = [{ x: cx, y: y0, r: r0 }, { x: cx, y: y1, r: r1 }, { x: cx, y: y2, r: r2 }];
    if (!active && !completed) { ball.x = zone.left + (zone.right - zone.left) * 0.26; ball.y = (zone.top + zone.bottom) / 2; }
    else { ball.x = clamp(ball.x, ballR() / W + 0.02, 1 - ballR() / W - 0.02); ball.y = clamp(ball.y, (top + ballR()) / H, (bottom - ballR()) / H); }
    buildAccessories(); hud(); draw();
  }
  function snapshot() {
    var target = stack[Math.min(2, stage)];
    window.__snowman = { active: active, paused: paused, stage: stage, stages: stages, mode: mode(), completed: completed, won: won, power: power,
      ball: { x: ball.x, y: ball.y, r: ballR() / W, progress: ball.progress, ready: ball.progress >= 1, distance: ball.distance, angle: ball.angle },
      rollZone: { left: zone.left, right: zone.right, top: zone.top, bottom: zone.bottom }, target: { x: target.x / W, y: target.y / H, r: target.r / W },
      stack: stack.map(function (p, n) { return { x: p.x / W, y: p.y / H, r: p.r / W, placed: stacked[n] }; }), stacked: stacked.slice(),
      targets: targets.map(function (p) { return { id: p.id, x: p.x, y: p.y, r: magnet(), w: p.w, h: p.h, placed: placed[p.id] }; }),
      tray: tray.map(function (p) { return { id: p.id, x: p.x, y: p.y, w: p.w, h: p.h }; }), pieces: pieces.map(function (p) { return { id: p.id, x: p.x, y: p.y, placed: placed[p.id] }; }),
      placed: { coal: placed.coal, nose: placed.nose, hat: placed.hat, scarf: placed.scarf, arms: placed.arms }, growthRate: growthRate(), magnet: magnet(), held: held ? held.type === "ball" ? "ball" : pieces[held.index].id : null,
      pointerId: owner, keyboardHeld: keyboardHeld, misses: misses, stageMisses: stageMisses, level: level(), rollHelp: rollLevel(), tryTime: tryTime, rollTry: rollTry, celebrating: doneAt > 0, powerLive: powerLive, width: W, height: H, coordinates: "positions normalized to canvas; radii/distance/magnet use canvas width; growthRate is progress per width of real rolling distance" };
  }
  function hud() {
    if (!cv || !stack.length) return;
    var enabled = canPlay(), b = $("snowBall"); b.hidden = mode() !== "roll" || stacked[stage]; b.disabled = !enabled; b.style.left = ball.x * W + "px"; b.style.top = ball.y * H + "px"; b.style.width = Math.max(64, ballR() * 2.12) + "px"; b.style.height = Math.max(64, ballR() * 2.12) + "px"; b.setAttribute("aria-pressed", held && held.type === "ball" ? "true" : "false");
    for (var n = 0; n < 3; n++) { var button = $("snowPiece" + n), p = pieces[n], shown = mode() !== "roll" && p && !placed[p.id], dragging = held && held.type === "piece" && held.index === n, shape = p ? pieceShape(p.id) : { w: 0, h: 0 }; button.hidden = !shown; button.disabled = !enabled || !!held && !dragging; if (p) { button.style.left = p.x * W + "px"; button.style.top = p.y * H + "px"; button.style.width = Math.max(64, dragging ? shape.w : 74) + "px"; button.style.height = Math.max(64, dragging ? shape.h : 74) + "px"; button.setAttribute("aria-label", "Pick up the " + (p.id === "coal" ? "coal face" : p.id === "nose" ? "carrot nose" : p.id === "arms" ? "twig arms" : p.id) + ". Drag to its glowing shape, then let go. Keyboard: Space to pick up, arrow keys to move, Space to place."); button.setAttribute("aria-pressed", dragging ? "true" : "false"); } }
    $("snowmanHelp").disabled = !enabled || !!held; $("snowmanHearStep").disabled = !enabled || !!held; $("snowmanPower").hidden = power <= 0; $("snowmanPowerFill").style.width = power / POWER * 100 + "%"; snapshot();
  }
  function background() {
    var i = image("bg"); if (i) { var scale = Math.max(W / i.naturalWidth, H / i.naturalHeight), w = i.naturalWidth * scale, h = i.naturalHeight * scale; ctx.drawImage(i, (W - w) / 2, (H - h) / 2, w, h); }
    else { var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#b9ddea"); g.addColorStop(0.55, "#e9f2ef"); g.addColorStop(1, "#d4e6ea"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  }
  function snowLane() {
    var x = zone.left * W, y = zone.top * H, w = (zone.right - zone.left) * W, h = (zone.bottom - zone.top) * H;
    var laneHelp = mode() === "roll" && active && !stacked[stage] && ball.progress < 1 && rollLevel() >= 1;
    ctx.save(); ctx.fillStyle = "rgba(248,253,252,.74)"; ctx.strokeStyle = laneHelp ? "#e8b84a" : "rgba(136,180,192,.55)"; ctx.lineWidth = laneHelp ? 5 : 2; if (laneHelp) { ctx.shadowColor = "#fff2b0"; ctx.shadowBlur = 18; } ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2 + 4, h / 2 + 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(169,199,207,.5)"; ctx.lineWidth = 2; ctx.setLineDash([4, 9]); ctx.beginPath(); ctx.moveTo(x + 20, y + h * 0.18); ctx.lineTo(x + w - 20, y + h * 0.18); ctx.moveTo(x + 20, y + h * 0.82); ctx.lineTo(x + w - 20, y + h * 0.82); ctx.stroke(); ctx.setLineDash([]);
    if (mode() === "roll") { ctx.strokeStyle = laneHelp ? "#c98a1c" : "rgba(71,128,146,.4)"; ctx.lineWidth = laneHelp ? 5 : 3; ctx.lineCap = "round"; var cy = y + h / 2, ax = x + w / 2, length = Math.min(laneHelp ? 60 : 25, w * (laneHelp ? 0.25 : 0.1)); ctx.beginPath(); ctx.moveTo(ax - length, cy); ctx.lineTo(ax + length, cy); ctx.moveTo(ax - length + 7, cy - 6); ctx.lineTo(ax - length, cy); ctx.lineTo(ax - length + 7, cy + 6); ctx.moveTo(ax + length - 7, cy - 6); ctx.lineTo(ax + length, cy); ctx.lineTo(ax + length - 7, cy + 6); ctx.stroke(); }
    trail.forEach(function (p) { ctx.fillStyle = "rgba(164,193,202,.16)"; ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.r * W, 0, Math.PI * 2); ctx.fill(); }); ctx.restore();
  }
  function drawBall(x, y, r, angle, shadow) {
    if (shadow) { ctx.fillStyle = "rgba(93,132,151,.14)"; ctx.beginPath(); ctx.ellipse(x + 2, y + r * 0.86, r * 0.9, r * 0.18, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); var i = image("ball");
    if (i) { var sc = 2 * r / Math.max(i.naturalWidth, i.naturalHeight); ctx.drawImage(i, -i.naturalWidth * sc / 2, -i.naturalHeight * sc / 2, i.naturalWidth * sc, i.naturalHeight * sc); }
    else { var g = ctx.createRadialGradient(-r * 0.34, -r * 0.4, r * 0.05, 0, 0, r); g.addColorStop(0, "#ffffff"); g.addColorStop(0.65, "#f5fbfa"); g.addColorStop(1, "#bfd6e2"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
    // Asymmetric soft snow crystals make real rolling visible even if an
    // image is unavailable. They rotate with the ball, never on a timer.
    for (var n = 0; n < 7; n++) { var a = n * 2.4, rr = r * (n % 2 ? 0.48 : 0.7); ctx.fillStyle = n % 2 ? "rgba(143,178,196,.2)" : "rgba(255,255,255,.65)"; ctx.beginPath(); ctx.ellipse(Math.cos(a) * rr, Math.sin(a) * rr, Math.max(1.3, r * 0.035), Math.max(1, r * 0.021), a, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function coalFace(x, y, w, h) {
    var rr = w / 1.55; function coal(px, py, size) { var g = ctx.createRadialGradient(px - size * 0.3, py - size * 0.4, 0.5, px, py, size); g.addColorStop(0, "#6a6873"); g.addColorStop(0.4, "#3c3e49"); g.addColorStop(1, "#262d3b"); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, size, size * 0.94, -0.15, 0, Math.PI * 2); ctx.fill(); }
    coal(x - rr * 0.36, y - rr * 0.23, rr * 0.115); coal(x + rr * 0.36, y - rr * 0.23, rr * 0.115);
    for (var n = 0; n < 5; n++) { var a = Math.PI * 0.22 + n * Math.PI * 0.14; coal(x + Math.cos(a) * rr * 0.54, y + Math.sin(a) * rr * 0.48, rr * 0.075); }
  }
  function drawPiece(id, x, y, w, h, alpha) {
    ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    if (id === "coal") coalFace(x, y, w, h);
    else { var i = image(id); if (i) { var sc = Math.min(w / i.naturalWidth, h / i.naturalHeight), iw = i.naturalWidth * sc, ih = i.naturalHeight * sc; ctx.drawImage(i, x - iw / 2, y - ih / 2, iw, ih); }
      else if (id === "nose") { ctx.fillStyle = "#d79765"; ctx.beginPath(); ctx.moveTo(x - w * 0.45, y - h * 0.34); ctx.quadraticCurveTo(x - w * 0.15, y - h * 0.5, x + w * 0.5, y); ctx.lineTo(x - w * 0.45, y + h * 0.34); ctx.closePath(); ctx.fill(); }
      else if (id === "hat") { ctx.fillStyle = "#8d72a3"; ctx.fillRect(x - w * 0.31, y - h * 0.4, w * 0.62, h * 0.62); ctx.beginPath(); ctx.ellipse(x, y + h * 0.24, w * 0.48, h * 0.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#e1c783"; ctx.fillRect(x - w * 0.31, y + h * 0.05, w * 0.62, h * 0.11); }
      else if (id === "scarf") { ctx.strokeStyle = "#b76571"; ctx.lineWidth = h * 0.23; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x - w * 0.42, y - h * 0.25); ctx.quadraticCurveTo(x, y - h * 0.05, x + w * 0.43, y - h * 0.25); ctx.moveTo(x - w * 0.18, y - h * 0.14); ctx.lineTo(x - w * 0.3, y + h * 0.43); ctx.stroke(); }
      else { ctx.strokeStyle = "#826c5c"; ctx.lineWidth = Math.max(3, h * 0.065); ctx.lineCap = "round"; [-1, 1].forEach(function (side) { ctx.beginPath(); ctx.moveTo(x + side * w * 0.15, y + h * 0.25); ctx.lineTo(x + side * w * 0.44, y - h * 0.22); ctx.moveTo(x + side * w * 0.34, y - h * 0.06); ctx.lineTo(x + side * w * 0.34, y - h * 0.4); ctx.moveTo(x + side * w * 0.39, y - h * 0.13); ctx.lineTo(x + side * w * 0.49, y - h * 0.04); ctx.stroke(); }); }
    }
    ctx.restore();
  }
  function drawStack() {
    if (placed.arms) { var arms = pieceShape("arms"); drawPiece("arms", arms.x, arms.y, arms.w, arms.h); }
    stack.forEach(function (p, n) { if (stacked[n]) drawBall(p.x, p.y, p.r, rotations[n], n === 0); else { ctx.save(); ctx.fillStyle = "rgba(247,253,250,.25)"; var help = n === stage && level() >= 1; ctx.strokeStyle = help ? "#e8b84a" : n === stage ? "#5b9b9f" : "rgba(104,151,167,.38)"; ctx.lineWidth = help ? 6 : n === stage ? 3 : 2; ctx.setLineDash(help ? [] : [5, 7]); if (n === stage) { ctx.shadowColor = help ? "#ffe680" : "#fff9dd"; ctx.shadowBlur = help ? 26 : 13; } ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); } });
    ["coal", "nose", "scarf", "hat"].forEach(function (id) { if (placed[id]) { var p = pieceShape(id); drawPiece(id, p.x, p.y, p.w, p.h); } });
  }
  function drawAccessories() {
    if (mode() === "roll") return;
    var help = level() >= 1;
    targets.forEach(function (p) { if (placed[p.id]) return; var shape = pieceShape(p.id); ctx.save(); ctx.shadowColor = help ? "#ffe680" : "#fff6c2"; ctx.shadowBlur = help ? 28 : 14; drawPiece(p.id, shape.x, shape.y, shape.w, shape.h, 0.28); ctx.strokeStyle = help ? "#e8b84a" : "rgba(55,132,140,.6)"; ctx.lineWidth = help ? 4 : 2; ctx.setLineDash(help ? [] : [3, 6]); ctx.beginPath(); ctx.ellipse(shape.x, shape.y, Math.max(17, shape.w * 0.53), Math.max(17, shape.h * 0.5), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); });
    if (help && active) pieces.forEach(function (p, n) { if (placed[p.id] || held && !(held.type === "piece" && held.index === n)) return; var t = pieceShape(p.id); arrow(p.x * W, p.y * H - 40, t.x, t.y + Math.min(t.h * 0.5, 30)); });
    pieces.forEach(function (p, n) { if (placed[p.id]) return; var dragging = held && held.type === "piece" && held.index === n, shape = pieceShape(p.id), scale = dragging ? 1 : Math.min(1, 62 / Math.max(shape.w, shape.h)); if (!dragging) { ctx.fillStyle = "rgba(255,251,240,.92)"; ctx.strokeStyle = "#d6e3e1"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x * W, p.y * H, 38, 36, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } drawPiece(p.id, p.x * W, p.y * H, shape.w * scale, shape.h * scale); });
  }
  // The ladder's arrow: a bold gold line with a head, from the piece to where
  // it goes. Drawn only once a miss (or a long try) asked for it.
  function arrow(x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy); if (len < 30) return;
    var ux = dx / len, uy = dy / len, ex = x2 - ux * 8, ey = y2 - uy * 8, hx = ex - ux * 18, hy = ey - uy * 18;
    ctx.save(); ctx.strokeStyle = "#c98a1c"; ctx.fillStyle = "#c98a1c"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.shadowColor = "rgba(255,255,255,.9)"; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(hx - uy * 13, hy + ux * 13); ctx.lineTo(hx + uy * 13, hy - ux * 13); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function draw() {
    if (!ctx || !stack.length) return; ctx.clearRect(0, 0, W, H); background(); snowLane(); drawStack();
    if (mode() === "roll" && !stacked[stage]) { var r = ballR(); drawBall(ball.x * W, ball.y * H, r, ball.angle, true); if (active && ball.progress < 1) { var x = ball.x * W, y = ball.y * H + r + 12; for (var n = 0; n < 5; n++) { ctx.fillStyle = ball.progress >= (n + 1) / 5 ? "#408e96" : "rgba(255,255,248,.95)"; ctx.beginPath(); ctx.arc(x + (n - 2) * 9, y, 3, 0, Math.PI * 2); ctx.fill(); } } else if (active && level() >= 1) arrow(ball.x * W, ball.y * H - r, stack[stage].x, stack[stage].y + stack[stage].r); else if (active) { ctx.save(); ctx.strokeStyle = "rgba(57,131,140,.68)"; ctx.lineWidth = 2; ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.moveTo(ball.x * W, ball.y * H - r); ctx.lineTo(stack[stage].x, stack[stage].y + stack[stage].r); ctx.stroke(); ctx.restore(); } }
    drawAccessories();
  }
  function point(event) { var rect = cv.getBoundingClientRect(); return { x: (event.clientX - rect.left) / W, y: (event.clientY - rect.top) / H }; }
  function clippedDistance(a, b) {
    var dx = b.x - a.x, dy = (b.y - a.y) * H / W, low = 0, high = 1, p = [-dx, dx, -dy, dy], q = [a.x - zone.left, zone.right - a.x, (a.y - zone.top) * H / W, (zone.bottom - a.y) * H / W];
    for (var n = 0; n < 4; n++) { if (Math.abs(p[n]) < 0.000001) { if (q[n] < 0) return 0; } else { var t = q[n] / p[n]; if (p[n] < 0) low = Math.max(low, t); else high = Math.min(high, t); if (low > high) return 0; } }
    return Math.sqrt(dx * dx + dy * dy) * Math.max(0, high - low);
  }
  function moveHeld(p) {
    if (!held || !canPlay()) return;
    if (held.type === "ball") { var old = { x: ball.x, y: ball.y }, r = ballR(); ball.x = clamp(p.x, r / W + 0.015, 1 - r / W - 0.015); ball.y = clamp(p.y, (top + r) / H, (bottom - r) / H); var mdx = ball.x - old.x, mdy = (ball.y - old.y) * H / W, moved = Math.sqrt(mdx * mdx + mdy * mdy), d = rollLevel() >= 2 ? moved : clippedDistance(old, ball); if (moved * W > 0.5) lastMove = clock; if (d > 0) { ball.distance += d; ball.progress = Math.min(1, ball.progress + d * growthRate()); ball.angle += ((ball.x - old.x) || (ball.y - old.y) * H / W) / Math.max(0.01, r / W); trail.push({ x: ball.x, y: ball.y, r: r / W * 0.13 }); if (trail.length > 160) trail.shift(); } banner(ball.progress >= 1 ? "Big enough! Lift it to the glowing circle" : rollLevel() >= 1 ? "Roll it back and forth on the snow!" : "Roll, roll, roll through the snow!"); }
    else { var piece = pieces[held.index]; if (Math.abs(p.x - piece.x) * W + Math.abs(p.y - piece.y) * H > 0.5) lastMove = clock; piece.x = clamp(p.x, 0.05, 0.95); piece.y = clamp(p.y, (top + 10) / H, (bottom - 10) / H); }
    hud(); draw();
  }
  function down(event, kind, index) {
    if (!canPlay() || held || event.button !== undefined && event.button !== 0 || kind === "piece" && placed[pieces[index].id]) return;
    event.preventDefault(); var p = point(event), object = kind === "ball" ? ball : pieces[index]; held = { type: kind, index: index }; powerLive = true; holdFrom.x = object.x; holdFrom.y = object.y; owner = event.pointerId; surface = event.currentTarget; keyboardHeld = false; grab.x = p.x - object.x; grab.y = p.y - object.y; try { surface.setPointerCapture(owner); } catch (e) {} hud(); draw();
  }
  function move(event) { if (event.pointerId !== owner || !canPlay()) return; event.preventDefault(); var p = point(event); moveHeld({ x: p.x - grab.x, y: p.y - grab.y }); }
  function detach() { var old = held, id = owner, oldSurface = surface; held = null; owner = null; surface = null; keyboardHeld = false; if (id !== null && oldSurface) try { if (oldSurface.hasPointerCapture(id)) oldSurface.releasePointerCapture(id); } catch (e) {} return old; }
  function cancelGesture() { var old = detach(); if (old && old.type === "piece" && pieces[old.index] && tray[old.index]) { pieces[old.index].x = tray[old.index].x; pieces[old.index].y = tray[old.index].y; } }
  // A short celebration beat, then the step counts: the next word is asked
  // 250 ms after done(), and that ask stops chimes, so "correct" plays first.
  // doneAt runs on the game's own clock, which stops while paused or hidden.
  function finishStage() { completed = Math.max(completed, stage + 1); active = false; detach(); stageMisses = 0; tryTime = 0; rollTry = 0; api.sfx("correct"); try { if (api.face) api.face("cheer"); } catch (e) {} banner(stage === 4 ? "A snow friend, made by you!" : stage < 3 ? "Yay! It fits just right!" : "That looks just right!"); doneAt = clock + 1.15; hud(); draw(); }
  function drop() {
    if (!held || !canPlay()) return; var old = detach();
    var lane = zone.top * H;
    if (old.type === "ball") {
      var t = stack[stage], dx = ball.x - t.x / W, dy = (ball.y * H - t.y) / W, lifted = ball.y * H < lane + 6 || (holdFrom.y - ball.y) * H >= 25;
      if (ball.progress >= 1 && (dx * dx + dy * dy <= magnet() * magnet() || level() >= 2 && lifted)) { stacked[stage] = true; rotations[stage] = ball.angle; finishStage(); return; }
      misses++;
      if (ball.progress < 1) { if (lifted) rollTry += 1.5; banner(rollLevel() >= 1 ? "Roll it back and forth on the snow!" : "Roll it through the snow until it is big"); }
      else if (lifted) { stageMisses++; banner(level() >= 2 ? "Nearly! Lift it up to the snowman." : "So close! Follow the arrow."); }
      else banner("Lift your snowball into the glowing circle");
    }
    else {
      var p = pieces[old.index], t2 = targets[old.index], x = p.x - t2.x, y = (p.y - t2.y) * H / W, tx = (p.x - tray[old.index].x) * W, ty = (p.y - tray[old.index].y) * H, tried = tx * tx + ty * ty >= 24 * 24;
      if (x * x + y * y <= magnet() * magnet() || level() >= 2 && tried && p.y * H < lane) { placed[p.id] = true; api.sfx("tap"); if (pieces.every(function (piece) { return placed[piece.id]; })) { finishStage(); return; } banner("One more snowy finishing touch!"); }
      else { misses++; if (tried) stageMisses++; p.x = tray[old.index].x; p.y = tray[old.index].y; banner(!tried ? "Drag it to the glowing shape." : level() >= 2 ? "Nearly! Drop it on the snowman." : "So close! Follow the arrow."); }
    }
    hud(); draw();
  }
  function release(event, canceled) { if (event.pointerId !== owner) return; event.preventDefault(); if (canceled || !canPlay()) cancelGesture(); else drop(); hud(); draw(); }
  function keyboard(event, kind, index) {
    if (!canPlay() || owner !== null || kind === "piece" && placed[pieces[index].id]) return;
    var key = event.key; if (key === " " || key === "Enter") { event.preventDefault(); if (event.repeat) return; if (!held) { var o = kind === "ball" ? ball : pieces[index]; held = { type: kind, index: index }; keyboardHeld = true; powerLive = true; holdFrom.x = o.x; holdFrom.y = o.y; } else if (held.type === kind && held.index === index) drop(); hud(); draw(); return; }
    if (key === "Escape") { event.preventDefault(); cancelGesture(); hud(); draw(); return; }
    if (!held || !keyboardHeld || held.type !== kind || held.index !== index) return;
    var dx = 0, dy = 0, stepSize = event.shiftKey ? 0.018 : 0.07; if (key === "ArrowLeft") dx = -stepSize; else if (key === "ArrowRight") dx = stepSize; else if (key === "ArrowUp") dy = -stepSize * W / H; else if (key === "ArrowDown") dy = stepSize * W / H; else return; event.preventDefault(); var p = kind === "ball" ? ball : pieces[index]; moveHeld({ x: p.x + dx, y: p.y + dy });
  }
  function controls() {
    [["snowBall", "ball", 0], ["snowPiece0", "piece", 0], ["snowPiece1", "piece", 1], ["snowPiece2", "piece", 2]].forEach(function (item) { var b = $(item[0]); b.addEventListener("pointerdown", function (e) { down(e, item[1], item[2]); }); b.addEventListener("pointermove", move); b.addEventListener("pointerup", function (e) { release(e, false); }); b.addEventListener("pointercancel", function (e) { release(e, true); }); b.addEventListener("lostpointercapture", function (e) { release(e, true); }); b.addEventListener("keydown", function (e) { keyboard(e, item[1], item[2]); }); });
    $("snowmanHelp").onclick = function () { if (canPlay() && !held) api.practice(); }; $("snowmanHearStep").onclick = function () { if (canPlay() && !held) api.instruct(STEP_LINES[stage]); };
    window.addEventListener("resize", fit); window.addEventListener("blur", function () { cancelGesture(); hud(); draw(); }); document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    window.addEventListener("pagehide", function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; }); window.addEventListener("pageshow", function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
  }
  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
    if (!paused && !away && !document.hidden) clock += dt;
    // The word's 10 s start at the child's first touch, not while Echo reads.
    if (canPlay() && powerLive) power = Math.max(0, power - dt);
    if (canPlay() && held && clock - lastMove < 0.35) { if (held.type === "ball" && ball.progress < 1) rollTry += dt; else tryTime += dt; }
    if (doneAt && !paused && !away && !document.hidden && clock >= doneAt) { doneAt = 0; if (api) api.done(); }
    hud(); draw(); raf = requestAnimationFrame(frame);
  }
  function earnPower() { active = true; paused = false; power = POWER; powerLive = false; last = 0; banner(stage < 3 ? "Roll in the snow, then lift to the glow" : stage === 3 ? "Add a face and a carrot nose" : "A hat, a scarf, and twig arms!"); hud(); draw(); }
  function pause() { paused = true; last = 0; cancelGesture(); hud(); }
  function reset() { cancelGesture(); active = false; paused = false; won = false; stage = 0; completed = 0; power = 0; misses = 0; stageMisses = 0; tryTime = 0; rollTry = 0; doneAt = 0; powerLive = false; stacked = [false, false, false]; rotations = [0, 0, 0]; placed = { coal: false, nose: false, hat: false, scarf: false, arms: false }; ball = { x: zone.left + (zone.right - zone.left) * 0.26, y: (zone.top + zone.bottom) / 2, progress: 0, distance: 0, angle: 0 }; trail = []; buildAccessories(); banner("Let's make a snowy little friend!"); hud(); draw(); }
  window.Snowman = {
    init: function (a, n) { api = a; stages = n || 5; cv = $("snowmanCanvas"); ctx = cv.getContext("2d"); loadArt(); controls(); fit(); reset(); raf = requestAnimationFrame(frame); },
    onWord: function (index) { cancelGesture(); stage = index; stageMisses = 0; tryTime = 0; rollTry = 0; doneAt = 0; if (stage < 3) ball = { x: zone.left + (zone.right - zone.left) * 0.26, y: (zone.top + zone.bottom) / 2, progress: 0, distance: 0, angle: 0 }; buildAccessories(); earnPower(); api.instruct(STEP_LINES[stage]); },
    onHelp: earnPower, pause: pause, resume: function (playing) { paused = playing === false; last = 0; hud(); }, reset: reset,
    finale: function () { cancelGesture(); active = false; power = 0; doneAt = 0; won = true; banner("A snow friend, made by you!"); hud(); draw(); }
  };
})();
