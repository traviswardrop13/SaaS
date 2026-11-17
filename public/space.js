/* Space Trip: eight actual piloted landings, each on a different planet.
   Each word the child says two times starts the next flight, and nothing
   else: it brings the next planet and the rocket, never an easier flight
   (CLAUDE.md, "The audit's rebuilds"). Gravity, inertia and held engines
   move the rocket; only a soft pad contact can finish a leg. SayPlay owns
   speech, audio, microphone and every repetition; this file never touches
   them.

   A NEW TRIP EVERY ROUND (newTrip): the eight planets (WORLDS: the ground's
   colour, the sky's glow, how hard it pulls) come in a new order, and each
   pad sits somewhere new. The rocks keep their place in the flight from the
   start to the pad (ROCKS), so each stage is still the challenge it was
   designed to be. The top bar's dots are the trip's planets, in their
   colours, filling in as each is landed on; the finale puts all eight in
   the sky.

   EVERY FLIGHT ENDS ON ITS PAD (CLAUDE.md, "Every ball ends in a basket").
   A miss is a real touchdown that did not land (too fast, beside the pad) or
   a bump into a rock, never time spent waiting: the rocket sits still at the
   start until a finger flies it. Each miss makes this flight easier
   (legRetries, reset by the next word):
   - miss 0: the game as designed. The help pill's easy flight (its own word,
     on top) lasts ten seconds of flying: it never drains while the rocket
     waits.
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
  var PAD_W = [0.32, 0.3, 0.3, 0.28, 0.29, 0.28, 0.27, 0.26];
  // each stage's own pull (a planet makes it a little lighter or heavier).
  // The first two are gentler than they were: the word no longer eases them
  var GRAVITY = [0.1, 0.11, 0.115, 0.13, 0.125, 0.14, 0.13, 0.145];
  // Rocks as [where along the way from the start to the pad (0 the start, 1
  // the pad), how far down the sky, size]. Stored along the way, not as a
  // place on the screen, so a pad that moves keeps each stage's rock between
  // the rocket and its pad (or under the start) as designed. A rock past
  // the pad that would leave the screen goes the same distance back toward
  // the start instead.
  var ROCKS = [[], [], [[0.49, 0.54, 0.045]], [[0.03, 0.62, 0.05]], [[0.29, 0.54, 0.045]], [[0.4, 0.57, 0.04]], [[0.16, 0.64, 0.04]], [[0.03, 0.5, 0.04], [1.8, 0.58, 0.04]]];
  // The eight planets. `tint` paints the moon ground's colour (its light and
  // shade stay the painting's), `glow` is the sky's colour near the ground,
  // `floor` the ground under the painting, `dot` the top bar's little
  // planet and the finale's, `g` how hard it pulls (the first two flights
  // never pull harder than their stage). Never orange: orange means only
  // the practice sound's letters.
  var WORLDS = [
    { id: "moon", name: "the Moon", tint: "", glow: "246,236,214", floor: ["#d7c3a5", "#a99a85"], dot: "#e4d8c2", g: 1 },
    { id: "mint", name: "the Mint Planet", tint: "#6fd3bd", glow: "111,211,189", floor: ["#a9dfcf", "#6fae9d"], dot: "#7fd9c4", g: 0.9 },
    { id: "candy", name: "the Candy Planet", tint: "#f39cc4", glow: "243,156,196", floor: ["#efbdd3", "#c0879f"], dot: "#f5a8cb", g: 0.85 },
    { id: "ice", name: "the Ice Planet", tint: "#9fd3f2", glow: "170,218,245", floor: ["#cfe7f3", "#93b4c6"], dot: "#a9daf5", g: 1.1 },
    { id: "purple", name: "the Purple Planet", tint: "#b49be6", glow: "180,155,230", floor: ["#c8b7e3", "#9483b4"], dot: "#bba4ea", g: 1 },
    { id: "sandy", name: "the Sandy Planet", tint: "#ecc65e", glow: "236,205,110", floor: ["#ead39a", "#b9a067"], dot: "#f0cd6a", g: 1.15 },
    { id: "blue", name: "the Blue Planet", tint: "#6f9ff0", glow: "120,165,240", floor: ["#b0c4e8", "#7389b3"], dot: "#7ea9f2", g: 0.95 },
    { id: "rainbow", name: "the Rainbow Planet", tint: "rainbow", glow: "255,205,232", floor: ["#e6cfe6", "#b496b4"], dot: "rainbow", g: 1.05 }
  ];
  var RAINBOW = ["#f5a8cb", "#f0cd6a", "#7fd9c4", "#7ea9f2", "#bba4ea"];
  // this round's trip: the planets in order, and where each pad sits
  var trip = { worlds: WORLDS.slice(), pads: [0.5, 0.72, 0.28, 0.58, 0.22, 0.78, 0.4, 0.6] }, lastFirst = "", wonAt = -9;
  var POWER = 10, THRUST = 0.34, STEER = 0.36;
  // Every line the banner can show (kind words only: never "missed",
  // "wrong" or a score). fit() makes room for the tallest, so a line that
  // wraps on a narrow phone never covers the flying space. `word` is the
  // first thing a flight says: the rocket waits up top and the glow is
  // below. It said Hold Engine to go, but holding Engine flies the rocket UP,
  // away from the pad; an arrow starts the flight just as well, toward it.
  // A landing names the planet (landedOn); the eighth says the trip is done.
  var SAY = {
    ready: "Ready for a little space trip?",
    word: "A new planet! Steer to the glow",
    help: "Easy flight! Aim for the glow",
    fly: "Aim for the glow. Land gently",
    pad1: "So close! Aim for the glow",
    hard1: "So close! Tap Engine to slow down",
    rock1: "Go around the rock. Try again!",
    again2: "Nearly! Land by the arrow",
    again3: "Tap Engine, then let go",
    all: "Eight planets! What a trip!",
    won: "A space trip, flown by you!"
  };
  function landedOn(w) { return "You landed on " + w.name + "!"; }
  var BANNERS = Object.keys(SAY).map(function (k) { return SAY[k]; }).concat(WORLDS.map(landedOn));
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function live() { return !paused && !away && !document.hidden; }
  function canPlay() { return active && live() && !won; }
  // ── the ladder: 0 as designed, 1 easier, 2 glow + arrow + cushion, 3 pull ──
  function ladder() { var m = legRetries; return little ? (m >= 2 ? 3 : m >= 1 ? 2 : 0) : Math.min(3, m); }
  function world(n) { return trip.worlds[n == null ? stage : n] || WORLDS[0]; }
  // the stage's own pull on this planet, before any help
  function pull() { var g = world().g; return GRAVITY[stage] * (stage < 2 ? Math.min(1, g) : g); }
  function gravity() {
    var f = power > 0 ? 0.55 : 1, lv = ladder();
    if (lv >= 3) f = Math.min(f, 0.42); else if (lv >= 2) f = Math.min(f, 0.45); else if (lv >= 1) f = Math.min(f, 0.5);
    return pull() * f;
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
  function rainbow(c, x0, x1) { var g = c.createLinearGradient(x0, 0, x1, 0); RAINBOW.forEach(function (col, i) { g.addColorStop(i / (RAINBOW.length - 1), col); }); return g; }
  // The moon ground painted in a planet's colour, made once a planet: the
  // "color" blend keeps the painting's light and shade and takes the
  // planet's hue, and the painting's own shape is kept.
  var groundCache = {};
  function groundFor(w) {
    var g = image("ground"); if (!g || !w.tint) return g;
    if (groundCache[w.id]) return groundCache[w.id];
    try {
      var c = document.createElement("canvas"); c.width = g.naturalWidth; c.height = g.naturalHeight; var x = c.getContext("2d");
      x.drawImage(g, 0, 0); x.globalCompositeOperation = "color"; x.fillStyle = w.tint === "rainbow" ? rainbow(x, 0, c.width) : w.tint; x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = "destination-in"; x.drawImage(g, 0, 0);
      groundCache[w.id] = c; return c;
    } catch (e) { return g; }
  }
  function shuffle(list) { for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = list[i]; list[i] = list[j]; list[j] = t; } return list; }
  // A new trip: the planets in a new order (never starting on the planet the
  // last trip started on), and every pad somewhere new: the first near the
  // middle, then anywhere a rocket can reach, never right where the last
  // one was. The rocket always starts on the other side of its pad.
  function newTrip() {
    var worlds = shuffle(WORLDS.slice());
    if (worlds[0].id === lastFirst) worlds.push(worlds.shift());
    lastFirst = worlds[0].id;
    var pads = [0.4 + Math.random() * 0.2];
    for (var n = 1; n < stages; n++) { var x, tries = 0; do { x = 0.22 + Math.random() * 0.56; tries++; } while (Math.abs(x - pads[n - 1]) < 0.2 && tries < 40); pads.push(x); }
    trip = { worlds: worlds, pads: pads };
    paintTrip();
  }
  // the top bar's dots are the trip's planets, each in its colour once landed
  // (the engine redraws the dots; their colours ride on --space-w1…8)
  function dotPaint(w) { var hi = "radial-gradient(circle at 32% 30%,rgba(255,255,255,.75) 0 22%,rgba(255,255,255,0) 28%)"; return hi + "," + (w.dot === "rainbow" ? "linear-gradient(135deg," + RAINBOW.join(",") + ")" : w.dot); }
  function paintTrip() { var app = $("app"); if (!app) return; trip.worlds.forEach(function (w, i) { app.style.setProperty("--space-w" + (i + 1), dotPaint(w)); }); }
  function level() {
    pad = { x: trip.pads[stage] == null ? 0.5 : trip.pads[stage], y: groundY / H, w: PAD_W[stage] };
    spawn = { x: pad.x > 0.5 ? 0.23 : 0.77, y: (playTop + shipH / 2 + 16) / H };
    var rockScale = Math.min(W, (groundY - playTop) * 1.2);
    obstacles = ROCKS[stage].map(function (r) {
      var x = spawn.x + (pad.x - spawn.x) * r[0];
      if (x < 0.1 || x > 0.9) x = pad.x - (x - pad.x);
      return [x, r[1], r[2]];
    }).map(function (r) {
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
    // the pads sit on the ground: keep the ground above the Easy flight pill,
    // or a pad at the side hides under it
    ["spaceHelp"].forEach(function (id) { var r = $(id).getBoundingClientRect(); if (r.height > 0) groundY = Math.min(groundY, r.top - rect.top - 14); });
    var room = Math.max(65, groundY - playTop); shipH = Math.min(90, W * 0.22, room * 0.28); shipW = shipH * 367 / 512;
    stopInputs(); level();
    if (!piloted) { ship.x = spawn.x; ship.y = spawn.y; } else { ship.x = clamp(ship.x, shipW / W, 1 - shipW / W); ship.y = clamp(ship.y, (playTop + shipH / 2) / H, pad.y - shipH / H / 2); }
    panelH = $("turnPanel").offsetHeight; hud(); draw(); liftPanel();
  }
  // While the child talks, the word panel sits in the empty sky instead of
  // over the landing pad (it covered the pad on every phone): just above the
  // pad, and above the rocket too when the rocket is low (standing on the
  // pad it just landed on, between flights), never over the banner. On a
  // phone too short for the panel between a rocket waiting up top and the
  // pad (a help ask on a 4-inch phone) the pad wins. It runs whenever the
  // rocket stops for a turn (hud) and whenever the panel changes size (a
  // help ask's is taller). Only the panel moves: the ground and the flight
  // stay exactly as they were.
  var panelH = 0, lifted = -1;
  function liftPanel() {
    var app = $("app"); if (!app || !cv) return;
    // 30 px: clear of the pad's beacon lights (24 px above the ground)
    var bottom = groundY - 30, top = ship.y * H - shipH / 2, low = ship.y * H + shipH / 2;
    if (low > bottom - panelH && top < bottom && (top + low) / 2 > bottom - panelH / 2) bottom = top - 8;
    bottom = Math.max(bottom, playTop - 16 + panelH);
    var lift = Math.max(0, Math.round(H - bottom));
    if (lift !== lifted) { lifted = lift; app.style.setProperty("--space-lift", lift + "px"); }
  }
  function background() {
    var i = image("bg");
    if (i) { var scale = Math.max(W / i.naturalWidth, H / i.naturalHeight), w = i.naturalWidth * scale, h = i.naturalHeight * scale; ctx.drawImage(i, (W - w) / 2, (H - h) / 2, w, h); }
    else { var wash = ctx.createLinearGradient(0, 0, 0, H); wash.addColorStop(0, "#232749"); wash.addColorStop(0.65, "#494375"); wash.addColorStop(1, "#77738b"); ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H); }
    var w = world(), glow = ctx.createLinearGradient(0, groundY - H * 0.42, 0, groundY);
    // the planet's own air: its colour rising from the ground into the sky
    glow.addColorStop(0, "rgba(" + w.glow + ",0)"); glow.addColorStop(1, "rgba(" + w.glow + "," + (w.tint ? 0.42 : 0.18) + ")"); ctx.fillStyle = glow; ctx.fillRect(0, groundY - H * 0.42, W, H * 0.42);
    var floor = ctx.createLinearGradient(0, groundY, 0, H); floor.addColorStop(0, w.floor[0]); floor.addColorStop(1, w.floor[1]); ctx.fillStyle = floor; ctx.fillRect(0, groundY, W, H - groundY);
    var ground = groundFor(w);
    if (ground) { var gh = W * ground.height / ground.width; ctx.drawImage(ground, 0, groundY - gh * 0.4175, W, gh); }
    else { ctx.fillStyle = w.tint === "rainbow" ? rainbow(ctx, 0, W) : w.tint || "#e1ceb1"; ctx.beginPath(); ctx.moveTo(0, groundY + 8); ctx.quadraticCurveTo(W * 0.2, groundY - 10, W * 0.45, groundY + 3); ctx.quadraticCurveTo(W * 0.7, groundY - 6, W, groundY + 9); ctx.lineTo(W, groundY + 40); ctx.lineTo(0, groundY + 40); ctx.closePath(); ctx.fill(); }
  }
  function guiding() { return active && !won && ladder() >= 2; }
  function drawPad() {
    var x = pad.x * W, y = pad.y * H, w = pad.w * W, lv = active && !won ? ladder() : 0, easy = power > 0 || lv >= 1, pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(time * 4);
    ctx.save(); ctx.translate(x, y);
    // from the 3rd miss: a soft column of light, the pull that brings it in
    if (lv >= 3) { var beam = ctx.createLinearGradient(0, -(y - playTop), 0, 0); beam.addColorStop(0, "rgba(157,223,210,0)"); beam.addColorStop(1, "rgba(157,223,210,.30)"); ctx.fillStyle = beam; ctx.fillRect(-w / 2, -(y - playTop), w, y - playTop); }
    // the glow the pad sits in: always there, so the pad is easy to find
    ctx.fillStyle = lv >= 2 ? "rgba(157,223,210," + (0.36 + pulse * 0.2) + ")" : easy ? "rgba(157,223,210,.3)" : "rgba(222,246,236,.26)";
    ctx.beginPath(); ctx.ellipse(0, 2, w / 2 + (lv >= 2 ? W * 0.07 : W * 0.045), lv >= 2 ? 21 : 17, 0, 0, Math.PI * 2); ctx.fill();
    if (lv < 2) { ctx.strokeStyle = "rgba(245,252,220,.6)"; ctx.lineWidth = 2; ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.moveTo(0, -72); ctx.lineTo(0, -28); ctx.stroke(); ctx.setLineDash([]); }
    // a thick platform: its legs into the ground, a cream deck, a teal stripe
    ctx.fillStyle = "#9d8f7a"; ctx.beginPath(); ctx.moveTo(-w / 2 - 4, -1); ctx.lineTo(w / 2 + 4, -1); ctx.lineTo(w / 2 - 8, 14); ctx.lineTo(-w / 2 + 8, 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f4f1e4"; roundRect(-w / 2 - 4, -6, w + 8, 9, 4); ctx.fill();
    ctx.fillStyle = "#4d9da4"; roundRect(-w / 2 + 6, -5, w - 12, 4, 2); ctx.fill();
    // a beacon on each end: off until the rocket is slow enough to land on
    // it, then a bright teal glow (gentle(), the old "Nice and gentle" pill)
    var lit = gentle() || landed > stage;
    [-1, 1].forEach(function (side) {
      var bx = side * (w / 2 + 1);
      ctx.strokeStyle = "#887b67"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx, -5); ctx.lineTo(bx, -14); ctx.stroke();
      ctx.fillStyle = lit ? "#c8fff1" : "#d8cfbd"; ctx.shadowColor = lit ? "#4fe3c6" : "rgba(0,0,0,0)"; ctx.shadowBlur = lit ? 16 : 0;
      ctx.beginPath(); ctx.arc(bx, -19, lit ? 5.5 : 4.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = lit ? "#2fa88f" : "#a0937f"; ctx.lineWidth = 1.5; ctx.stroke();
    });
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  // the rocket is slow enough to land (from the 3rd miss any touchdown near
  // the pad lands): what the pad's beacons say
  function gentle() { return active && !won && piloted && (ladder() >= 3 || (Math.abs(ship.vy) <= safeVy() && Math.abs(ship.vx) <= safeVx())); }
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
  // a little planet, drawn: its colour, a light side, two craters
  function planet(w, x, y, r) {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = w.dot === "rainbow" ? rainbow(ctx, x - r, x + r) : w.dot; ctx.shadowColor = "rgba(" + w.glow + ",.9)"; ctx.shadowBlur = r * 0.7; ctx.fill(); ctx.shadowBlur = 0;
    ctx.clip();
    var shade = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05); shade.addColorStop(0, "rgba(255,255,255,.55)"); shade.addColorStop(0.55, "rgba(255,255,255,0)"); shade.addColorStop(1, "rgba(40,30,70,.28)");
    ctx.fillStyle = shade; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = "rgba(40,30,70,.16)"; ctx.beginPath(); ctx.arc(x + r * 0.3, y + r * 0.25, r * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x - r * 0.25, y + r * 0.45, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // The finale: the eight planets of the trip, in the order they were
  // visited, come out across the sky one after another (all at once under
  // Reduce Motion), each with a star's twinkle as it arrives.
  var FINALE_GAP = 0.18;
  function finaleSky() {
    var age = clock - wonAt, n = trip.worlds.length, r = Math.min(26, W * 0.062), span = Math.min(W - r * 4, 520), top = playTop + r + 14, star = image("star"), shown = 0;
    for (var i = 0; i < n; i++) {
      var k = calm ? 1 : clamp((age - i * FINALE_GAP) / 0.3, 0, 1); if (k <= 0) continue; shown++;
      var x = W / 2 - span / 2 + span * i / (n - 1), y = top + (1 - Math.sin(Math.PI * i / (n - 1))) * r * 2.2, s = 0.55 + 0.45 * k;
      ctx.save(); ctx.globalAlpha = k; planet(trip.worlds[i], x, y, r * s); ctx.restore();
      if (star && k < 1) { var sz = r * 1.3 * (1 - k); ctx.save(); ctx.globalAlpha = 1 - k; ctx.drawImage(star, x + r * 0.5 - sz / 2, y - r * 0.8 - sz / 2, sz, sz); ctx.restore(); }
    }
    return shown;
  }
  var skyShown = 0;
  function draw() {
    if (!ctx) return; ctx.clearRect(0, 0, W, H); background(); drawPad(); drawRocks(); drawGuide(); drawShip(); drawCheer();
    skyShown = won ? finaleSky() : 0;
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
      world: world().id, worldName: world().name, basePull: pull(), gentle: gentle(), beacons: gentle() || landed > stage, skyPlanets: skyShown,
      trip: trip.worlds.map(function (w) { return w.id; }), pads: trip.pads.slice(),
      owners: { left: leftOwner, right: rightOwner, thrust: thrustOwner }, coordinates: "normalized-to-canvas; vx/ax use canvas widths per second; vy/gravity/thrust use canvas heights per second; radii use width; power ticks during active play" };
  }
  function hud() {
    input(); var allowed = canPlay(); ["spaceLeft", "spaceThrust", "spaceRight"].forEach(function (id) { $(id).disabled = !allowed; });
    $("spaceLeft").setAttribute("aria-pressed", steering < -0.05 ? "true" : "false"); $("spaceRight").setAttribute("aria-pressed", steering > 0.05 ? "true" : "false"); $("spaceThrust").setAttribute("aria-pressed", thrust ? "true" : "false");
    $("spaceHelp").disabled = !allowed || thrust || Math.abs(steering) > 0.01;
    $("spacePower").hidden = !(active && power > 0 && !won); $("spacePowerFill").style.width = power / POWER * 100 + "%";
    // the panel shows only while the flight is stopped: place it then, not every frame of a flight
    if (!allowed) liftPanel();
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
    banner(landed === stages ? SAY.all : landedOn(world()));
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
    time += dt; input();
    // the help's easy flight counts down only while the rocket flies: a
    // child who asked for it and then waits keeps all of it
    if (!piloted) { hud(); return; }
    power = Math.max(0, power - dt);
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
    tick(dt); draw(); if (won) publish(); raf = requestAnimationFrame(frame);
  }
  // the word's flight: the rocket and nothing else
  function go(line) { power = 0; paused = false; active = true; last = 0; banner(line); hud(); }
  function earnPower(line) { power = POWER; paused = false; active = true; last = 0; banner(line); hud(); }
  function pause() { paused = true; last = 0; stopInputs(); hud(); }
  function reset() { stopInputs(); active = false; paused = false; stage = 0; landed = 0; won = false; power = 0; piloted = false; cushion = false; retries = 0; legRetries = 0; nudged = 0; time = 0; last = 0; doneAt = 0; cheerAt = -9; wonAt = -9; newTrip(); level(); ship = { x: spawn.x, y: spawn.y, vx: 0, vy: 0 }; banner(SAY.ready); hud(); draw(); }
  window.Space = {
    init: function (a, n) {
      api = a; stages = n || 8; cv = $("spaceCanvas"); ctx = cv.getContext("2d");
      try { calm = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}
      loadArt(); controls(); fit(); reset(); raf = requestAnimationFrame(frame);
      try { if (window.ResizeObserver) new ResizeObserver(function () { panelH = $("turnPanel").offsetHeight; liftPanel(); }).observe($("turnPanel")); } catch (e) {}
      // the banner's font can arrive after the first fit: measure again then
      try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!piloted) fit(); }); } catch (e) {}
    },
    // the word brings the next flight on the next planet, and nothing else:
    // the rocket waits at the start for a finger
    onWord: function (index) { stage = index; stopInputs(); level(); ship = { x: spawn.x, y: spawn.y, vx: 0, vy: 0 }; piloted = false; cushion = false; legRetries = 0; doneAt = 0; go(SAY.word); },
    // the optional help word: easy flight for the same flight, right where it is
    onHelp: function () { earnPower(ladder() >= 2 ? $("spaceBanner").textContent : SAY.help); },
    pause: pause,
    resume: function (playing) { paused = playing === false; last = 0; hud(); },
    reset: reset,
    finale: function () { stopInputs(); active = false; power = 0; doneAt = 0; cushion = false; won = true; wonAt = clock; banner(SAY.won); hud(); draw(); },
    // ages 2 to 4 get the gentler ladder (the page asks Sona.playStyle)
    setLittle: function (on) { little = !!on; if (cv) hud(); }
  };
})();
