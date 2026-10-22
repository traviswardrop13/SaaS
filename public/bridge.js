/* Puzzle Bridge: Day 3 of the daily story (STORY1, 22 Oct 2026; the build
   spec's section 1.4). Last night's storm shook the old stone bridge to
   Blossom Island, its stones fell into Rumble River, and Grandma Tortoise's
   100th birthday party is on the other side: the child builds it back.

   The word (said two times) calls one stone up out of the river; the finger
   turns it (a tap, or the round turn button) and slides it into its hole.
   SayPlay owns the word, the microphone, Echo's voice, "Go!", the reps and
   every card; this file owns only the play: one canvas, the finger, and
   api.done() once a step. It never calls logAttempt, bumpReps, gameRep,
   addCoins, a sticker or storage: nothing here is practice data.

   What it keeps (the rules every played game keeps):
   - The word earns each step, the finger makes it. Before the word the
     stones sleep on the river bed and a touch on the water only makes
     ripples; after it, a stone fits only when a finger (or the keyboard)
     drops it on its hole the right way up. Waiting fits nothing.
   - The step counts BEAT seconds after the click, on a clock that runs only
     while the game is live, so the thunk and the cheer are heard first.
   - Every round ends with the bridge whole, with no more speaking: the help
     ladder climbs with misses (the right hole, the wrong way up) and with
     seconds of the finger trying (never waiting), and resets with each new
     word. No help ever fits a stone by itself: the finger still drops it.
   - Ages 3-4 play a low, short bridge: six stones that come up the right
     way round, two holes open at a time, no turning, no rising river.
   - The bridge is drawn, not painted (its holes are outlines filled with one
     sandstone tile), so a stone always fits its own hole exactly. Every
     painted picture has a drawn stand-in; under Reduce Motion nothing slides
     or spins (the camera cuts, a turn is instant, a stone fades in and does
     not drift). */
(function () {
  "use strict";
  // ── Echo's directions, one a step, spoken through api.instruct (the
  // engine's voice, only in play). Ages 5-8, then ages 3-4. Rachel reads
  // every line (no sound named, nothing about how to talk).
  var STEP_LINES = [
    "Tap the stone to turn it. Then slide it into its hole!",
    "Turn the stone the right way, then slide it in. Click!",
    "This one looks like a boot! Turn it and fit it.",
    "Look at the hole. Turn the stone to match, then slide it in.",
    "The river is rising! Grab the stone from the water. Then turn it and fit it.",
    "Catch the floating stone. Turn it, and slide it in!",
    "Up high now! Turn the stone and fit it in the arch.",
    "The last stone is the heart. Put it at the very top!"
  ];
  var LITTLE_LINES = [
    "Slide the stone into the hole with the same shape!",
    "Which hole is the same shape? Slide it in!",
    "Find the hole that matches. Click!",
    "Look, ducks! Slide the stone into its hole.",
    "Find the same shape and slide it in!",
    "The heart goes on top. Slide it in!"
  ];

  // ── ANCHORS: where everything sits in the canyon ──
  // The world is bridge-canyon-wide.webp (1200 x 800, painted at 1536 x 1024:
  // the wide one, so the camera pans along the bridge), and every number
  // here is in the 1536 x 1024 painting's pixels (P7's art notes give the
  // painting in fractions: x times 1536, y times 1024). The painting leaves
  // the gap empty: the near bank's flat top meets its cliff face at
  // (398, 380), Blossom Island's top meets its rocky face at (1122, 550), and
  // the river runs between them. The bridge is drawn: its deck (the top, a
  // circle) springs from the bank's top and lands on the island's, its arch
  // openings (circles) stand in the river, and the whole of it is cut along
  // the two faces (`faces`), so it grows out of the rock on both sides. Each
  // hole sits at x, y; `float` is where a called stone waits beside its gap;
  // `drift` is the loop a stone swims in once the river has risen (its x,
  // and its height above the water line).
  var ANCHORS = {
    pic: { w: 1536, h: 1024 },
    hole: 84,        // every hole's square box; the shapes fill it
    lift: 1.15,      // a stone in the air is drawn this much bigger (nearer the child)
    tile: 190,       // how wide one sandstone tile is in the world
    bank: { face: 398, top: 380 },      // the near bank: its cliff face and flat top
    island: { face: 1122, top: 550 },   // Blossom Island: its rocky face and top
    faces: [[398, -80], [1122, -80], [1122, 790], [398, 790]],
    foot: 790,                          // the piers stand in the river down to here
    // ages 5-8: a humped deck and one round arch over the river; the stones
    // sit in the arch's ring (`ring` thick), the heart as its keystone
    bridge: { deck: { cx: 683.9, cy: 789.1, r: 499.1 }, arches: [{ cx: 775, cy: 770, r: 280 }], ring: 130 },
    water: { line: 780, risen: 578, bed: 905 },
    waterfall: { x: 790, top: 470, w: 60 },
    crowd: { x: 312, y: 378, s: 160 },  // the friends at the near bank's edge (feet at y)
    grandma: { x: 1182, y: 552, s: 72 }, // Grandma on the island, in front of her arbour
    // ages 5-8: L, T, boot, arrow low and middle on the left of the ring;
    // step, hook and half-moon on the right, rising; the heart keystone at
    // the very top. taps: how many quarter turns the stone comes up wrong by
    // (spec 1.4). From word 5 the river has risen and every stone swims up
    // in it, under the arch.
    big: [
      { shape: "L", x: 446, y: 666, taps: 1, float: { x: 570, y: 700 } },
      { shape: "T", x: 493, y: 572, taps: 1, float: { x: 615, y: 630 } },
      { shape: "boot", x: 587, y: 481, taps: 2, float: { x: 700, y: 572 } },
      { shape: "arrow", x: 681, y: 438, taps: 1, float: { x: 780, y: 552 } },
      { shape: "step", x: 1057, y: 572, taps: 2, drift: { x: 935, dy: -10 }, twist: true },
      { shape: "hook", x: 963, y: 481, taps: 3, drift: { x: 860, dy: -10 } },
      { shape: "halfmoon", x: 869, y: 438, taps: 2, drift: { x: 790, dy: -10 } },
      { shape: "heart", x: 775, y: 425, taps: 1, drift: { x: 700, dy: -10 }, top: true }
    ],
    // ages 3-4: a lower bridge with one wide arch; its six stones sit in two
    // rows over the arch, so each step's two open holes sit side by side (or
    // one over the other), and the heart is on the top row
    littleBridge: { deck: { cx: 619.5, cy: 1063.4, r: 718.4 }, arches: [{ cx: 740, cy: 919, r: 299 }] },
    littleWater: { line: 780, bed: 905 },
    little: [
      { shape: "circle", x: 646, y: 566, float: { x: 693, y: 690 } },
      { shape: "square", x: 740, y: 566, float: { x: 787, y: 690 } },
      { shape: "triangle", x: 834, y: 566, float: { x: 960, y: 520 } },
      { shape: "star", x: 834, y: 472, float: { x: 787, y: 362 } },
      { shape: "moon", x: 740, y: 472, float: { x: 693, y: 362 } },
      { shape: "heart", x: 646, y: 472, float: { x: 560, y: 380 }, top: true }
    ],
    // the whole bridge, for the finale's pull-back, with the friends at one
    // end and Grandma at the other
    whole: { x0: 300, x1: 1220, y0: 270, y1: 800 },
    wholeLittle: { x0: 300, x1: 1220, y0: 320, y1: 800 }
  };
  var DRIFT = { rx: 26, ry: 7, s: 7 };   // the slow loop a stone swims (seconds a lap)
  // ages 3-4, from step 4: the duck family, on the near river (drawNear). It
  // is sized by the board, not the world: w of the board's width (px bounds),
  // h of its own width, one paddle across and back every `lap` seconds.
  var DUCKS = { w: 0.3, min: 84, max: 170, h: 147 / 360, sink: 0.1, lap: 20 };
  // the stones: polygons in a unit box (-0.5..0.5, y down), rotated about
  // its middle. None of the eight (ages 5-8) looks the same after a quarter
  // turn, so "the right way up" is always one answer.
  var SHAPES = {
    L: [[-0.5, -0.5], [-0.17, -0.5], [-0.17, 0.17], [0.5, 0.17], [0.5, 0.5], [-0.5, 0.5]],
    T: [[-0.5, -0.5], [0.5, -0.5], [0.5, -0.12], [0.17, -0.12], [0.17, 0.5], [-0.17, 0.5], [-0.17, -0.12], [-0.5, -0.12]],
    boot: [[-0.44, -0.5], [-0.02, -0.5], [-0.02, 0.04], [0.32, 0.1], [0.5, 0.28], [0.5, 0.5], [-0.44, 0.5]],
    arrow: [[-0.5, -0.17], [0.04, -0.17], [0.04, -0.5], [0.5, 0], [0.04, 0.5], [0.04, 0.17], [-0.5, 0.17]],
    step: [[-0.5, 0.5], [-0.5, 0.17], [-0.17, 0.17], [-0.17, -0.17], [0.17, -0.17], [0.17, -0.5], [0.5, -0.5], [0.5, 0.5]],
    hook: [[0.17, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, 0.02], [-0.17, 0.02], [-0.17, 0.17], [0.17, 0.17]],
    halfmoon: arc(0, -0.25, 0.5, 0, 180, 24, [[-0.5, -0.25], [0.5, -0.25]]),
    heart: heart(),
    circle: arc(0, 0, 0.5, 0, 360, 32),
    square: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]],
    triangle: [[0, -0.5], [0.5, 0.42], [-0.5, 0.42]],
    star: star(),
    moon: moon()
  };
  // the help ladder, by seconds of the finger trying with nothing fitted (the
  // times every played game uses), and how a click lands
  var BIG_SECS = [4, 8, 12], LITTLE_SECS = [2, 4, 6];
  var BEAT = 1.15, POWER = 10, HOLE_FRAC = 0.31, BOARD_MAX = 620, TAP_PX = 12, TAP_S = 0.3, AWAY_S = 2, NEAR = 1.1;
  var ART_FILES = {
    canyon: "canyon-wide", stone: "stone", spiral: "spiral", moss: "moss", blossom: "blossom",
    grandma: "grandma", crowd: "crowd", ducks: "ducks"
  };

  var $ = function (id) { return document.getElementById(id); };
  var still = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var api = null, cv = null, ctx = null, W = 390, H = 844, dpr = 1, raf = 0, last = 0;
  var board = { top: 120, bottom: 640 }, ctlTop = 760, rowBottom = 120, standH = 80, bankTop = 650;
  var art = {}, artState = {}, buddyPics = null, pat = null, patFor = null, tints = {};
  var little = false, total = 8, stage = 0, active = false, paused = false, away = false, finale = false, finT = 0;
  var plan = null, stone = null, finger = null, kbAt = -9, tapAt = -9, kbHeld = false;
  var idle = 0, rung = 0, misses = 0, power = 0, beat = 0, dones = 0, driftT = 0, flow = 0, pulse = 0;
  var seated = [], blossoms = [], puffs = [], ripples = [], splashes = [], rippleCount = 0;
  var risen = false, riseK = 0, camera = null, pulledBack = false, banner = "", seen = [], hudT = 0;

  function nowS() { return performance.now() / 1000; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function steps() { return little ? ANCHORS.little : ANCHORS.big; }
  function stepLine() { return little ? LITTLE_LINES[stage] : STEP_LINES[stage]; }
  function playing() { return active && !paused && !away && !finale && !document.hidden; }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function HOLE() { return ANCHORS.hole; }

  // ── shape builders (run once, at load) ──
  function arc(cx, cy, r, a0, a1, n, ends) {
    var out = [], i; if (ends) out.push(ends[1]);
    for (i = 0; i <= n; i++) { var a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    if (a1 - a0 >= 360) out.pop();
    return normal(out);
  }
  function heart() {
    var out = [], i; for (i = 0; i < 40; i++) { var t = i / 40 * Math.PI * 2, s = Math.sin(t); out.push([16 * s * s * s, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); }
    return normal(out);
  }
  function star() {
    var out = [], i; for (i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.22 : 0.5; out.push([r * Math.cos(a), r * Math.sin(a)]); }
    return normal(out);
  }
  function moon() {
    // a crescent: the big circle less a smaller one set to its right
    var out = [], i, a0 = 56.3, b0 = 82.2;
    for (i = 0; i <= 20; i++) { var a = (a0 + (360 - 2 * a0) * i / 20) * Math.PI / 180; out.push([0.5 * Math.cos(a), 0.5 * Math.sin(a)]); }
    for (i = 0; i <= 16; i++) { var b = (-b0 - (360 - 2 * b0) * i / 16) * Math.PI / 180; out.push([0.22 + 0.42 * Math.cos(b), 0.42 * Math.sin(b)]); }
    return normal(out);
  }
  // centre a shape on its box and make its longer side exactly 1
  function normal(p) {
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, i;
    for (i = 0; i < p.length; i++) { x0 = Math.min(x0, p[i][0]); x1 = Math.max(x1, p[i][0]); y0 = Math.min(y0, p[i][1]); y1 = Math.max(y1, p[i][1]); }
    var k = 1 / Math.max(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    return p.map(function (q) { return [Math.round((q[0] - mx) * k * 1000) / 1000, Math.round((q[1] - my) * k * 1000) / 1000]; });
  }

  // ── the camera: the world in front of the child ──
  // A hole is drawn at least 31% of the board's width (the board is the
  // phone's width, or 620 px on a wide iPad), so the camera follows the gap
  // and glides to the next one between steps.
  function boardW() { return Math.min(W, BOARD_MAX); }
  function boardH() { return Math.max(1, board.bottom - board.top); }
  function zoom() { return HOLE_FRAC * boardW() / HOLE(); }
  function sx(x) { return (x - camera.x) * camera.s + W / 2; }
  function sy(y) { return (y - camera.y) * camera.s + (board.top + board.bottom) / 2; }
  function wx(px) { return (px - W / 2) / camera.s + camera.x; }
  function wy(py) { return (py - (board.top + board.bottom) / 2) / camera.s + camera.y; }
  function waterFor(i) { return little ? ANCHORS.littleWater.line : (i >= twistAt() ? ANCHORS.water.risen : ANCHORS.water.line); }
  function twistAt() { for (var i = 0; i < ANCHORS.big.length; i++) if (ANCHORS.big[i].twist) return i; return 99; }
  function waterLine() { return little ? ANCHORS.littleWater.line : ANCHORS.water.line + (ANCHORS.water.risen - ANCHORS.water.line) * riseK; }
  function homeOf(p, i, wl) {
    if (!p) return null;
    if (p.drift && !little) return { x: p.drift.x, y: (wl == null ? waterFor(i) : wl) + p.drift.dy };
    return { x: p.float.x, y: p.float.y };
  }
  function openHoles(i) {
    var list = steps(), out = [];
    if (list[i]) out.push(list[i]);
    if (little && list[i + 1]) out.push(list[i + 1]);
    return out;
  }
  function targetFor(i) {
    var list = steps(), p = list[i], s = zoom();
    if (!p) return wholeView();
    var h = HOLE() / 2, sh = HOLE() * ANCHORS.lift / 2, b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 };
    function add(x0, y0, x1, y1) { b.x0 = Math.min(b.x0, x0); b.x1 = Math.max(b.x1, x1); b.y0 = Math.min(b.y0, y0); b.y1 = Math.max(b.y1, y1); }
    openHoles(i).forEach(function (q) { add(q.x - h, q.y - h, q.x + h, q.y + h); });
    var home = homeOf(p, i), ex = p.drift && !little ? DRIFT.rx : 0, ey = p.drift && !little ? DRIFT.ry * 2 : 0;
    add(home.x - sh - ex, home.y - sh - ey, home.x + sh + ex, home.y + sh + ey);
    var m = 14; b.x0 -= m; b.x1 += m; b.y0 -= m; b.y1 += m;
    // the water below too, when there is room for it (a touch there makes ripples)
    var wl = waterFor(i) + 16, vis = boardH() / s;
    if (wl > b.y1 && wl - b.y0 <= vis - 4) b.y1 = wl;
    return inPicture({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, s: s }, b);
  }
  // the finale shows the whole bridge, but never more sky or river than the
  // painting has: on a tall phone the bridge fills the width and the
  // painting the height (it is 3:2, the bridge a little wider than tall)
  function wholeView() {
    var b = little ? ANCHORS.wholeLittle : ANCHORS.whole, P = ANCHORS.pic;
    var s = Math.min(W / (b.x1 - b.x0), boardH() / (b.y1 - b.y0));
    s = Math.max(s, Math.min(W / (b.x1 - b.x0) * 1.04, boardH() / P.h));
    return inPicture({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, s: s }, b);
  }
  // slide a view so it shows no edge of the painting it does not have to,
  // never past what it was asked to show (b, its bounds)
  function inPicture(v, b) {
    var P = ANCHORS.pic;
    v.y = slide(v.y, boardH() / 2 / v.s, b.y0, b.y1, P.h);
    v.x = slide(v.x, W / 2 / v.s, b.x0, b.x1, P.w);
    return v;
  }
  function slide(c, half, lo0, hi0, total) {
    var lo = Math.max(hi0 - half, half), hi = Math.min(lo0 + half, total - half);
    if (lo <= hi) return clamp(c, lo, hi);
    return hi0 - half <= lo0 + half ? clamp(c, hi0 - half, lo0 + half) : c;
  }
  // glide there (0.6 s; the finale's pull-back 1.2 s), or cut under Reduce Motion
  function aim(t, dur) {
    if (!camera || still || !dur) { camera = { x: t.x, y: t.y, s: t.s, from: null, to: t, k: 1, dur: 0 }; return; }
    camera = { x: camera.x, y: camera.y, s: camera.s, from: { x: camera.x, y: camera.y, s: camera.s }, to: t, k: 0, dur: dur };
  }
  function glide(dt) {
    if (!camera || !camera.from) return;
    camera.k = Math.min(1, camera.k + dt / camera.dur);
    var e = camera.k * camera.k * (3 - 2 * camera.k), f = camera.from, t = camera.to;
    camera.x = f.x + (t.x - f.x) * e; camera.y = f.y + (t.y - f.y) * e; camera.s = f.s * Math.pow(t.s / f.s, e);
    if (camera.k >= 1) camera.from = null;
  }

  // ── the painted art, each with a drawn stand-in ──
  function loadArt() {
    Object.keys(ART_FILES).forEach(function (k) {
      var i = new Image(); artState[k] = "loading";
      i.onload = function () { artState[k] = "ready"; pat = null; tints = {}; draw(); };
      i.onerror = function () { artState[k] = "failed"; };
      i.src = "/assets/crafted/game/bridge-" + ART_FILES[k] + ".webp"; art[k] = i;
    });
  }
  function image(k) { var i = art[k]; return artState[k] === "ready" && i && i.naturalWidth ? i : null; }
  function artReady() { return Object.keys(ART_FILES).every(function (k) { return artState[k] === "ready"; }); }
  function sprite(c, k, x, y, w, alpha, bottom) {
    var i = image(k); if (!i) return false;
    var h = w * i.naturalHeight / i.naturalWidth;
    c.save(); if (alpha != null) c.globalAlpha *= alpha; c.drawImage(i, x - w / 2, bottom ? y - h : y - h / 2, w, h); c.restore(); return true;
  }
  // the sandstone, as a pattern that moves and scales with the world
  // (anchored at x, y on screen, scaled by s, turned by q quarters: the
  // bridge and a fitted stone share the world's, a lifted stone has its own)
  function sandstone(x, y, s, q) {
    var i = image("stone"); if (!i) return null;
    if (!pat || patFor !== i) { try { pat = ctx.createPattern(i, "repeat"); patFor = i; } catch (e) { return null; } }
    try { var k = ANCHORS.tile / i.naturalWidth * s, a = q * Math.PI / 2, c = Math.cos(a) * k, n = Math.sin(a) * k; pat.setTransform(new DOMMatrix([c, n, -n, c, x, y])); } catch (e) {}
    return pat;
  }
  // the carved spiral in one colour (dim asleep, gold awake, green fitted)
  function spiralIn(col) {
    var i = image("spiral"); if (!i) return null;
    if (tints[col]) return tints[col];
    try {
      var c = document.createElement("canvas"); c.width = i.naturalWidth; c.height = i.naturalHeight;
      // multiplied in, so the carving's light and shade still show, then cut
      // back to the medallion's own shape
      var x = c.getContext("2d"); x.drawImage(i, 0, 0); x.globalCompositeOperation = "multiply"; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = "destination-in"; x.drawImage(i, 0, 0);
      return (tints[col] = c);
    } catch (e) { return null; }
  }

  function fit() {
    if (!cv) return;
    var r = cv.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { ctlTop = $("brControls").getBoundingClientRect().top - r.top; } catch (e) { ctlTop = H - 80; }
    try { rowBottom = $("brRow").getBoundingClientRect().bottom - r.top; } catch (e) { rowBottom = 120; }
    // Echo and the buddy stand on the near bank, above the two buttons
    standH = clamp(H * 0.1, 56, 96);
    bankTop = ctlTop - standH - 12;
    board = { top: rowBottom + 6, bottom: bankTop };
    placeStanders();
    letGo();
    aim(finale || pulledBack ? wholeView() : targetFor(stage), 0);
    hud(); draw();
  }
  function placeStanders() {
    var h = standH, bottom = ctlTop - 4;
    [["brEcho", 0.16], ["brBuddy", 0.84]].forEach(function (p) {
      var el = $(p[0]); if (!el) return;
      el.style.height = h + "px"; el.style.width = h + "px"; el.style.left = (W * p[1] - h / 2) + "px"; el.style.top = (bottom - h) + "px";
    });
  }

  // ── the hint banner: kind words only ──
  function setBanner(t) { if (!t || t === banner) return; banner = t; if (seen.indexOf(t) < 0) seen.push(t); try { $("brBanner").textContent = t; } catch (e) {} }
  function tryBanner() {
    if (little) return rung >= 3 ? "Slide it to the bridge!" : rung >= 1 ? "Follow the arrow" : "Find the same shape!";
    return rung >= 2 ? "Follow the arrow" : rung >= 1 ? "Look at the ghost" : "Up it comes!";
  }

  // ── the help ladder ──
  function climb() {
    var secs = little ? LITTLE_SECS : BIG_SECS, r = 0;
    for (var i = 0; i < 3; i++) if (idle >= secs[i]) r = i + 1;
    r = Math.max(r, little ? Math.min(2, misses) : Math.min(3, misses));
    if (r <= rung) return;
    rung = r;
    setBanner(tryBanner());
  }
  function sfx(n) { try { if (api && playing()) api.sfx(n); } catch (e) {} }

  // ── the stone ──
  function newStone() {
    var p = plan, h = homeOf(p, stage, waterLine()), q = little ? 0 : (4 - p.taps) % 4;
    return { shape: p.shape, q: q, qt: q, x: h.x, y: h.y, state: "rise", t: still ? 1 : 0, from: { x: h.x, y: bedLine() }, awayT: 0, wob: 0, lift: ANCHORS.lift, alpha: still ? 0 : 1 };
  }
  function bedLine() { return little ? ANCHORS.littleWater.bed : ANCHORS.water.bed; }
  function rot() { return stone ? ((stone.qt % 4) + 4) % 4 : 0; }
  function need() { return little ? 0 : (4 - rot()) % 4; }
  function drifting() { return !!(stone && plan && plan.drift && !little && !still && rung < 1 && power <= 0 && (stone.state === "float" || stone.state === "rise")); }
  function homeNow() {
    var h = homeOf(plan, stage, waterLine());
    if (plan && plan.drift && !little && !still) { var a = 2 * Math.PI * driftT / DRIFT.s; h.x += DRIFT.rx * Math.sin(a); h.y += -DRIFT.ry * Math.cos(a) + DRIFT.ry; }
    return h;
  }
  function holeAt(p) { return { x: p.x, y: p.y }; }
  function stoneSize() { return HOLE() * (stone ? stone.lift : ANCHORS.lift); }
  function grabbable() { return playing() && beat === 0 && stone && (stone.state === "float" || stone.state === "away" || stone.state === "rise" || stone.state === "back"); }
  // a turn: one quarter clockwise, with a whoosh and a knock (instant under
  // Reduce Motion: it never spins)
  function turn() {
    var kb = kbHeld && stone && stone.state === "held" && playing() && beat === 0;
    if (little || !(grabbable() || kb)) return false;
    stone.qt += 1; if (still) stone.q = stone.qt;
    tapAt = nowS(); sfx("turn");
    return true;
  }
  // a held stone stays on the board, where it can be seen and picked up again
  function holdAt(x, y) {
    var half = stoneSize() * camera.s / 2, px = clamp(sx(x), half * 0.5, W - half * 0.5), py = clamp(sy(y), board.top + half * 0.5, board.bottom - half * 0.5);
    stone.x = wx(px); stone.y = wy(py);
  }
  // let go: on its hole the right way up it clicks in; the wrong way up it
  // wobbles back (a miss); anywhere else it waits there and drifts back
  function drop() {
    if (!stone || stone.state !== "held") return;
    var c = { x: stone.x, y: stone.y }, p = plan, h = holeAt(p), d = dist(c, h), hw = HOLE();
    if (little) {
      var o = steps()[stage + 1], od = o ? dist(c, holeAt(o)) : 1e9;
      // from the second miss (or 4 s) a drop anywhere near the bridge slides it in
      if (rung >= 2 && nearBridge(c, d, od)) { seat(true); return; }
      if (d <= hw / 2) { seat(false); return; }
      if (od <= hw / 2) { bounce(o); return; }
      wait(c); return;
    }
    // from the third miss (or 12 s) a drop on or near its hole turns it into place
    if (rung >= 3 && d <= NEAR * hw) { seat(true); return; }
    if (d <= hw / 2) { if (rot() === 0) seat(false); else wobble(); return; }
    wait(c);
  }
  function nearBridge(c, d, od) {
    if (d <= 2.6 * HOLE() || od <= 1.2 * HOLE()) return true;
    return c.y < waterLine() - 20 && c.x >= ANCHORS.bank.face - HOLE() && c.x <= ANCHORS.island.face + HOLE() && c.y > deckY(c.x) - HOLE();
  }
  function seat(turnIn) {
    if (turnIn && !little) { stone.qt += need(); if (still) stone.q = stone.qt; }
    stone.state = "seat"; stone.t = still ? 1 : 0; stone.from = { x: stone.x, y: stone.y };
    beat = BEAT; idle = 0;
    var h = holeAt(plan), r = HOLE() * 0.55;
    puffs.push({ x: h.x, y: h.y + HOLE() * 0.4, t: 0 });
    for (var i = 0; i < 3; i++) blossoms.push({ x: h.x + (i - 1) * r * 0.8, y: h.y - HOLE() * 0.62 - (i === 1 ? 6 : 0), t: still ? 1 : 0, step: stage });
    setBanner("Click!"); sfx("thunk"); cheer();
    if (dones + 1 >= total) { pulledBack = true; aim(wholeView(), 1.2); }
  }
  function wobble() {
    misses++; tapAt = nowS();
    var h = holeAt(plan);
    stone.state = "wobble"; stone.t = 0; stone.wob = 0; stone.x = h.x; stone.y = h.y - HOLE() * 0.12;
    climb(); setBanner("Almost! Give it a turn"); sfx("bonk");
  }
  function bounce(o) {
    misses++; tapAt = nowS();
    stone.state = "wobble"; stone.t = 0; stone.wob = 0; stone.x = o.x; stone.y = o.y - HOLE() * 0.12;
    climb(); setBanner("That hole is a different shape!"); sfx("bonk");
  }
  function wait(c) { stone.state = "away"; stone.awayT = 0; stone.x = c.x; stone.y = c.y; }
  function goHome() {
    // back beside the gap: a glide, or a fade under Reduce Motion
    stone.state = "back"; stone.t = 0; stone.from = { x: stone.x, y: stone.y };
    if (still) { var h = homeNow(); stone.x = h.x; stone.y = h.y; stone.state = "float"; stone.alpha = 0; }
  }
  // Echo and the buddy cheer on the bank (the buddy's own cheer picture,
  // never Echo's), and hop unless Reduce Motion is on
  function cheer() {
    try { if (api) api.face("cheer"); } catch (e) {}
    try {
      var e = $("brEcho"); if (e) { e.src = "/assets/crafted/echo-cheer.webp"; clearTimeout(cheer.e); cheer.e = setTimeout(function () { e.src = "/assets/crafted/echo-welcome.webp"; }, 900); }
      var b = $("brBuddy"); if (b && buddyPics) { b.src = buddyPics.cheer; clearTimeout(cheer.b); cheer.b = setTimeout(function () { if (buddyPics) b.src = buddyPics.rest; }, 900); }
      if (!still) [e, b].forEach(function (el) { if (el) { el.classList.remove("hop"); void el.offsetWidth; el.classList.add("hop"); } });
    } catch (x) {}
  }
  function stepDone() {
    if (stone) seated.push({ step: stage, shape: stone.shape, x: plan.x, y: plan.y, at: nowS() });
    stone = null; active = false; dones++;
    // the camera glides to the next gap while its word is asked
    if (dones < steps().length) { stage = dones; plan = steps()[stage]; if (!pulledBack) aim(targetFor(stage), 0.6); }
    hud();
    if (api) api.done();
  }

  // ── the clock: only while the game is live ──
  // a finger trying: moving on or near the stone in the last 0.4 s, a tap, a
  // turn, or a key. Waiting never climbs the ladder.
  function trying() {
    var t = nowS();
    if (finger && t - finger.at < 0.4 && (finger.onStone || (stone && dist(finger.w, stone) <= 1.6 * stoneSize()))) return true;
    return t - kbAt < 0.4 || t - tapAt < 0.4;
  }
  function tick(dt) {
    pulse += dt; if (!still) flow += dt;
    if (riseK < 1 && risen) riseK = still ? 1 : Math.min(1, riseK + dt / 2);
    ripples = ripples.filter(function (r) { r.t += dt; return r.t < 1.2; });
    splashes = splashes.filter(function (r) { r.t += dt; return r.t < 0.7; });
    puffs = puffs.filter(function (r) { r.t += dt; return r.t < 0.8; });
    blossoms.forEach(function (b) { if (b.t < 1) b.t = Math.min(1, b.t + dt / 0.3); });
    if (finale) { finT += dt; return; }
    if (!active || paused || away) return;
    if (beat > 0) {
      if (stone && stone.state === "seat") { stone.t = Math.min(1, stone.t + dt / 0.22); var h = holeAt(plan), e = stone.t; stone.x = stone.from.x + (h.x - stone.from.x) * e; stone.y = stone.from.y + (h.y - stone.from.y) * e; stone.lift = ANCHORS.lift + (1 - ANCHORS.lift) * e; spin(dt); }
      beat -= dt; if (beat <= 0) { beat = 0; stepDone(); }
      return;
    }
    if (power > 0) { power = Math.max(0, power - dt); if (!power) setBanner(tryBanner()); }
    if (drifting()) driftT += dt;
    if (stone) { spin(dt); moveStone(dt); }
    // only the finger trying climbs the ladder: waiting never does
    if (trying()) { idle += dt; climb(); }
  }
  function spin(dt) { if (stone.q < stone.qt) stone.q = still ? stone.qt : Math.min(stone.qt, stone.q + dt / 0.2); }
  function moveStone(dt) {
    var s = stone, h;
    if (s.alpha < 1) s.alpha = Math.min(1, s.alpha + dt / 0.35);
    if (s.state === "rise") {
      s.t = Math.min(1, s.t + dt / 0.6); h = homeNow();
      var e = 1 - Math.pow(1 - s.t, 3); s.x = s.from.x + (h.x - s.from.x) * e; s.y = s.from.y + (h.y - s.from.y) * e;
      if (s.t >= 1) s.state = "float";
    } else if (s.state === "float") { h = homeNow(); s.x = h.x; s.y = h.y; }
    else if (s.state === "away") { s.awayT += dt; if (s.awayT >= AWAY_S) goHome(); }
    else if (s.state === "back") {
      s.t = Math.min(1, s.t + dt / 0.6); h = homeNow(); var k = s.t * s.t * (3 - 2 * s.t);
      s.x = s.from.x + (h.x - s.from.x) * k; s.y = s.from.y + (h.y - s.from.y) * k; if (s.t >= 1) s.state = "float";
    } else if (s.state === "wobble") {
      s.wob += dt; if (s.wob >= 0.6) goHome();
    } else if (s.state === "held" && little && rung >= 3 && finger && finger.carry) {
      // ages 3-4 from 6 s: any drag carries the stone to the right hole's edge
      // (under Reduce Motion it is simply there)
      var t = edgeOf(plan), k2 = still ? 1 : 1 - Math.exp(-dt * 9); s.x += (t.x - s.x) * k2; s.y += (t.y - s.y) * k2;
    }
  }
  function edgeOf(p) {
    var h = homeOf(p, stage), dx = h.x - p.x, dy = h.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1, r = HOLE() * 0.62;
    return { x: p.x + dx / d * r, y: p.y + dy / d * r };
  }
  function frame(ts) {
    var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
    if (cv && (Math.abs(cv.clientWidth - W) > 0.5 || Math.abs(cv.clientHeight - H) > 0.5)) fit();
    if (!paused && !away && !document.hidden) glide(dt);
    tick(dt); draw();
    hudT += dt; if (hudT >= 0.07) { hudT = 0; hud(); }
    raf = requestAnimationFrame(frame);
  }

  // ── drawing ──
  function draw() {
    if (!ctx || !camera) return;
    ctx.clearRect(0, 0, W, H);
    drawCanyon();
    drawBed();
    drawRiver(false);
    drawFolk();
    drawBridge();
    drawSeated();
    drawHints();
    drawBlossoms();
    drawEffects();
    if (little) drawNear();
    if (stone && stone.state !== "seat") drawActive();
    else if (stone) drawStone(ctx, stone.shape, sx(stone.x), sy(stone.y), HOLE() * stone.lift * camera.s, stone.q, "lit", 1);
    // the river's front, over a stone in the water, so it swims
    if (stone && plan && plan.drift && !little && stone.state !== "held" && stone.y + stoneSize() / 2 > waterLine()) drawRiver(true);
    drawBank();
  }
  function drawCanyon() {
    var x0 = sx(0), y0 = sy(0), x1 = sx(ANCHORS.pic.w), y1 = sy(ANCHORS.pic.h), c = image("canyon");
    if (c) {
      // the painting; past its edges (only the finale's pull-back on a tall
      // phone ever shows a sliver) the sky above and the river below
      var iw = c.naturalWidth, ih = c.naturalHeight, want = ANCHORS.pic.w / ANCHORS.pic.h, srcW = iw, srcH = ih, ox = 0, oy = 0;
      if (iw / ih > want) { srcW = ih * want; ox = (iw - srcW) / 2; } else if (iw / ih < want) { srcH = iw / want; oy = (ih - srcH) / 2; }
      ctx.drawImage(c, ox, oy, srcW, srcH, x0, y0, x1 - x0, y1 - y0);
      // past an edge, the painting mirrored in it (more riverbed below, more
      // sky above), never a smear of its last row
      [[y0 > 0, 0, 0, W, y0, 0, 2 * y0, 1, -1], [y1 < H, 0, y1, W, H - y1, 0, 2 * y1, 1, -1],
       [x0 > 0, 0, 0, x0, H, 2 * x0, 0, -1, 1], [x1 < W, x1, 0, W - x1, H, 2 * x1, 0, -1, 1]].forEach(function (m) {
        if (!m[0]) return;
        ctx.save(); ctx.beginPath(); ctx.rect(m[1] - 0.5, m[2] - 0.5, m[3] + 1, m[4] + 1); ctx.clip();
        ctx.translate(m[5], m[6]); ctx.scale(m[7], m[8]); ctx.drawImage(c, ox, oy, srcW, srcH, x0, y0, x1 - x0, y1 - y0); ctx.restore();
      });
      return;
    }
    // stand-in: a spring-morning sky, far peach cliffs, the waterfall, the
    // near bank and its cliff face, and Blossom Island (pink)
    var B = ANCHORS.bank, I = ANCHORS.island, g = ctx.createLinearGradient(0, sy(0), 0, sy(700));
    g.addColorStop(0, "#9fd8ef"); g.addColorStop(0.7, "#d6f0f2"); g.addColorStop(1, "#ffe6cf");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.28; ctx.lineWidth = 10 * camera.s;
    ["#ff9a8a", "#ffd27a", "#9ee0a8", "#8fc8f0"].forEach(function (col, i) { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(sx(768), sy(760), (620 - i * 10) * camera.s, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); });
    ctx.restore();
    ctx.fillStyle = "#f6dcc2";
    poly(ctx, [[0, 300], [300, 280], [520, 330], [700, 440], [900, 430], [1100, 320], [1300, 280], [1536, 300], [1536, 820], [0, 820]]); ctx.fill();
    var wf = ANCHORS.waterfall; ctx.fillStyle = "rgba(240,252,255,.85)"; ctx.fillRect(sx(wf.x - wf.w / 2), sy(wf.top), wf.w * camera.s, (ANCHORS.water.line - wf.top + 20) * camera.s);
    ctx.fillStyle = "#e4b48a";
    poly(ctx, [[0, B.top], [B.face, B.top], [B.face, 620], [440, 660], [520, 720], [520, 1024], [0, 1024]]); ctx.fill();
    ctx.fillStyle = "#9fcf7a"; ctx.fillRect(sx(0), sy(B.top - 10), B.face * camera.s, 12 * camera.s);
    ctx.fillStyle = "#f6b7c9";
    poly(ctx, [[I.face, I.top], [1536, I.top - 20], [1536, 1024], [1060, 1024], [1060, 730], [1085, 690], [I.face, 650]]); ctx.fill();
    ctx.fillStyle = "#f19ab5"; [[1290, 380, 62], [1380, 340, 74], [1470, 390, 60]].forEach(function (b) { ctx.beginPath(); ctx.arc(sx(b[0]), sy(b[1]), b[2] * camera.s, 0, Math.PI * 2); ctx.fill(); });
  }
  function poly(c, pts) { c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(sx(p[0]), sy(p[1])); else c.moveTo(sx(p[0]), sy(p[1])); }); c.closePath(); }
  // the river. Over the painting its own river is the river: a few white
  // curls drift on it (none while Calm river is on, none under Reduce
  // Motion), and once it has risen (ages 5-8, word 5) a clear band of drawn
  // water stands over the canyon's foot, its line climbing as it rises. With
  // no painting it is drawn whole: bands, curls and the water line.
  function drawRiver(front) {
    var wl = waterLine(), top = sy(wl), calm = power > 0, painted = !!image("canyon");
    if (top > H) return;
    if (front) {
      // the water over the part of a swimming stone that is under it (its own
      // shape, so the stone still reads), and the water line across it
      if (!stone) return;
      ctx.save(); shapePath(ctx, stone.shape, sx(stone.x), sy(stone.y), stoneSize() * camera.s, stone.q); ctx.clip();
      ctx.fillStyle = "rgba(64,186,196,.45)"; ctx.fillRect(0, top, W, H - top);
      ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillRect(0, top - 1, W, Math.max(2, 3 * camera.s)); ctx.restore();
      return;
    }
    var flood = painted ? (little ? 0 : riseK) : 1, x0 = painted ? ANCHORS.bank.face - 30 : -80, x1 = painted ? ANCHORS.island.face : 1620;
    if (flood > 0) {
      var g = ctx.createLinearGradient(0, top, 0, Math.max(top + 1, sy(painted ? ANCHORS.water.line + 60 : 1024)));
      if (painted) { g.addColorStop(0, "rgba(86,200,208," + (0.62 * flood).toFixed(2) + ")"); g.addColorStop(1, "rgba(86,200,208," + (0.22 * flood).toFixed(2) + ")"); }
      else { g.addColorStop(0, "rgba(72,200,206,.86)"); g.addColorStop(1, "rgba(28,118,140,.94)"); }
      ctx.fillStyle = g; ctx.fillRect(0, Math.max(0, top), W, H - Math.max(0, top));
      if (!painted) { ctx.fillStyle = "rgba(255,255,255,.12)"; for (var i = 1; i < 5; i++) ctx.fillRect(0, sy(wl + i * 46), W, Math.max(1, 6 * camera.s)); }
    }
    if (!calm) {
      ctx.strokeStyle = painted ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.8)"; ctx.lineWidth = Math.max(1.5, 3 * camera.s); ctx.lineCap = "round";
      for (var j = 0; j < 22; j++) {
        var x = x0 + ((j * 157 + flow * 38 * (j % 2 ? 1 : 0.7)) % (x1 - x0)), y = wl + 14 + (j % 4) * 34;
        ctx.beginPath(); ctx.arc(sx(x), sy(y), 9 * camera.s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      }
    } else if (painted) {
      // Calm river: the water goes glassy
      ctx.fillStyle = "rgba(225,250,255,.16)"; ctx.fillRect(0, Math.max(0, top), W, H - Math.max(0, top));
    }
    if (flood > 0) { ctx.fillStyle = calm ? "rgba(255,255,255,.75)" : "rgba(255,255,255,.55)"; ctx.fillRect(0, top - 1, W, Math.max(2, 3 * camera.s)); }
    ripples.forEach(function (r) {
      var k = r.t / 1.2, rad = (still ? 22 : 10 + 40 * k) * camera.s;
      ctx.strokeStyle = "rgba(255,255,255," + (0.8 * (1 - k)).toFixed(2) + ")"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx(r.x), sy(r.y), rad, rad * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
    });
  }
  // the stones still asleep on the river bed: their own shapes, mossy, dim
  function drawBed() {
    var list = steps(), bed = bedLine();
    for (var i = stage + (stone || dones > stage ? 1 : 0); i < list.length; i++) {
      // each sleeps under the place it will float up to
      var x = homeOf(list[i], i).x, w = HOLE() * 0.7 * camera.s, q = little ? 0 : (4 - list[i].taps) % 4;
      drawStone(ctx, list[i].shape, sx(x), sy(bed), w, q, "sleep", 0.85);
      if (!sprite(ctx, "moss", sx(x), sy(bed) - w * 0.42, w * 0.8)) { ctx.fillStyle = "rgba(106,160,82,.85)"; ctx.beginPath(); ctx.ellipse(sx(x), sy(bed) - w * 0.38, w * 0.34, w * 0.14, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  function drawFolk() {
    var c = ANCHORS.crowd, g = ANCHORS.grandma;
    if (!sprite(ctx, "crowd", sx(c.x), sy(c.y), c.s * camera.s, 1, true)) {
      [["#8f8a9e", -70, 46], ["#9a6a43", 10, 54], ["#f3efe8", 80, 34]].forEach(function (f) { ctx.fillStyle = f[0]; ctx.beginPath(); ctx.arc(sx(c.x + f[1]), sy(c.y - f[2]), f[2] * camera.s, 0, Math.PI * 2); ctx.fill(); });
    }
    if (!sprite(ctx, "grandma", sx(g.x), sy(g.y), g.s * camera.s, 1, true)) {
      ctx.fillStyle = "#7fae6a"; ctx.beginPath(); ctx.ellipse(sx(g.x), sy(g.y - 30), 48 * camera.s, 32 * camera.s, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#f19ab5"; ctx.beginPath(); ctx.arc(sx(g.x + 30), sy(g.y - 70), 14 * camera.s, 0, Math.PI * 2); ctx.fill();
    }
  }
  // the bridge: one body of sandstone from the deck (its top) down to the
  // arch openings and the piers that stand in the river, cut along the two
  // faces, every empty hole cut through it
  function shapeOf() { return little ? ANCHORS.littleBridge : ANCHORS.bridge; }
  function deckY(x) { var d = shapeOf().deck, dx = x - d.cx; return d.cy - Math.sqrt(Math.max(0, d.r * d.r - dx * dx)); }
  // the arch ring's outer edge (ages 5-8): where it would rise past the deck
  // (by the island, where the deck comes down), the top follows the ring
  function ringY(x) {
    var B = shapeOf(); if (!B.ring) return 1e9;
    var a = B.arches[0], R = a.r + B.ring, dx = x - a.cx;
    return Math.abs(dx) < R ? a.cy - Math.sqrt(R * R - dx * dx) : 1e9;
  }
  function topY(x) { return Math.min(deckY(x), ringY(x) - 6); }
  function underY(x) {
    var y = ANCHORS.foot;
    shapeOf().arches.forEach(function (a) { var dx = x - a.cx; if (Math.abs(dx) < a.r) y = Math.min(y, a.cy - Math.sqrt(a.r * a.r - dx * dx)); });
    return y;
  }
  function bodyPath(c) {
    var x0 = ANCHORS.bank.face - 40, x1 = ANCHORS.island.face + 40, n = 72, i, x;
    c.beginPath();
    for (i = 0; i <= n; i++) { x = x0 + (x1 - x0) * i / n; if (i) c.lineTo(sx(x), sy(topY(x))); else c.moveTo(sx(x), sy(topY(x))); }
    for (i = n * 3; i >= 0; i--) { x = x0 + (x1 - x0) * i / (n * 3); c.lineTo(sx(x), sy(underY(x))); }
    c.closePath();
  }
  // the deck's edge, bank to island (the rail, and where the finale's
  // blossoms burst)
  function deckPath(c, lift) {
    var x0 = ANCHORS.bank.face, x1 = ANCHORS.island.face, n = 48, i, x;
    c.beginPath();
    for (i = 0; i <= n; i++) { x = x0 + (x1 - x0) * i / n; if (i) c.lineTo(sx(x), sy(topY(x) - lift)); else c.moveTo(sx(x), sy(topY(x) - lift)); }
  }
  // ages 5-8: the angles of the joints between the ring's stones, one stone
  // to a hole, halfway between neighbouring holes and on out to each end
  function ringJoints() {
    var B = shapeOf(), a = B.arches[0], ang = ANCHORS.big.map(function (p) { return Math.atan2(p.x - a.cx, a.cy - p.y) * 180 / Math.PI; }).sort(function (u, v) { return u - v; }), out = [], i;
    for (i = 1; i < ang.length; i++) out.push((ang[i - 1] + ang[i]) / 2);
    var lo = ang[0] - (out[0] - ang[0]), hi = ang[ang.length - 1] + (ang[ang.length - 1] - out[out.length - 1]);
    for (; lo > -96; lo -= 13) out.push(lo);
    for (; hi < 96; hi += 13) out.push(hi);
    return out;
  }
  function isFilled(i) { return seated.some(function (s) { return s.step === i; }) || (stone && stone.state === "seat" && i === stage); }
  function isOpen(i) { if (isFilled(i)) return false; return little ? (i === stage || i === stage + 1) && !finale : true; }
  function shapePath(c, key, x, y, size, q, add) {
    var pts = SHAPES[key], a = q * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
    if (!add) c.beginPath();
    pts.forEach(function (p, i) { var px = p[0] * size, py = p[1] * size, X = x + px * ca - py * sa, Y = y + px * sa + py * ca; if (i) c.lineTo(X, Y); else c.moveTo(X, Y); });
    c.closePath();
  }
  function drawBridge() {
    var list = steps(), size = HOLE() * camera.s, B = shapeOf(), lw = Math.max(1.5, 3 * camera.s);
    ctx.save();
    // cut along the bank's cliff face and the island's rocky face
    poly(ctx, ANCHORS.faces); ctx.clip();
    // the empty holes are cut out of everything drawn next
    ctx.beginPath(); ctx.rect(-10, -10, W + 20, H + 20);
    list.forEach(function (p, i) { if (isOpen(i)) shapePath(ctx, p.shape, sx(p.x), sy(p.y), size, 0, true); });
    ctx.clip("evenodd");
    var f = sandstone(sx(0), sy(0), camera.s, 0);
    bodyPath(ctx); ctx.fillStyle = f || "#d69a63"; ctx.fill();
    if (f) warm(ctx, "seated");
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (B.ring) {
      // ages 5-8: the arch's ring of stones, its outer edge and its joints
      var a = B.arches[0], R = a.r + B.ring;
      ctx.strokeStyle = "rgba(110,70,40,.55)"; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(sx(a.cx), sy(a.cy), R * camera.s, Math.PI, Math.PI * 2); ctx.stroke();
      ringJoints().forEach(function (t) {
        var u = t * Math.PI / 180, si = Math.sin(u), co = Math.cos(u);
        ctx.beginPath(); ctx.moveTo(sx(a.cx + a.r * si), sy(a.cy - a.r * co)); ctx.lineTo(sx(a.cx + R * si), sy(a.cy - R * co)); ctx.stroke();
      });
      // and a soft shadow inside the arch's curve
      ctx.strokeStyle = "rgba(90,52,30,.25)"; ctx.lineWidth = Math.max(2, 10 * camera.s);
      ctx.beginPath(); ctx.arc(sx(a.cx), sy(a.cy), (a.r + 5) * camera.s, Math.PI, Math.PI * 2); ctx.stroke();
    }
    bodyPath(ctx); ctx.strokeStyle = "#8e5c37"; ctx.lineWidth = lw; ctx.stroke();
    // the rail along the deck: a capstone band, its sunny top edge
    deckPath(ctx, -5); ctx.strokeStyle = "rgba(122,78,46,.5)"; ctx.lineWidth = Math.max(2, 10 * camera.s); ctx.stroke();
    deckPath(ctx, 0); ctx.strokeStyle = "rgba(255,236,206,.7)"; ctx.lineWidth = Math.max(1.5, 3 * camera.s); ctx.stroke();
    ctx.restore();
    // each empty hole: a soft shadow and a rim; ages 3-4's holes not open
    // yet are dim and dashed (not a place to put a stone today)
    list.forEach(function (p, i) {
      if (isFilled(i)) return;
      var open = isOpen(i);
      shapePath(ctx, p.shape, sx(p.x), sy(p.y), size, 0);
      if (open) { ctx.fillStyle = "rgba(70,46,30,.24)"; ctx.fill(); ctx.strokeStyle = "#6e4528"; ctx.lineWidth = Math.max(2, 4 * camera.s); ctx.setLineDash([]); ctx.stroke(); }
      else { ctx.save(); ctx.setLineDash([5, 6]); ctx.strokeStyle = "rgba(110,70,44,.6)"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
    });
  }
  // The tile is pale peach: multiplied to the painting's warm sandstone, then
  // lit. The bridge (and a fitted stone, so it sinks into it) has the
  // morning's light, brighter at the top and darker at the waterline; a
  // lifted stone is lit from its top left, so it stands out in front; a
  // sleeping one is dim under the water. Fills the path already set.
  function warm(c, mood, x, y, size) {
    var g;
    c.save(); c.globalCompositeOperation = "multiply"; c.fillStyle = "rgb(242,206,156)"; c.fill(); c.restore();
    if (mood === "seated") { g = c.createLinearGradient(0, sy(300), 0, sy(ANCHORS.foot)); g.addColorStop(0, "rgba(255,236,200,.14)"); g.addColorStop(1, "rgba(120,72,40,.3)"); }
    else if (mood === "sleep") g = "rgba(40,60,70,.35)";
    else { g = c.createLinearGradient(x - size / 2, y - size / 2, x + size / 2, y + size / 2); g.addColorStop(0, "rgba(255,236,200,.2)"); g.addColorStop(1, "rgba(120,72,40,.36)"); }
    c.fillStyle = g; c.fill();
  }
  // a stone: the sandstone (flat grey without the tile), its outline and the
  // carved spiral on top, turned with it
  function drawStone(c, key, x, y, size, q, mood, alpha) {
    c.save(); if (alpha != null) c.globalAlpha *= alpha;
    shapePath(c, key, x, y, size, q);
    var f = c === ctx ? (mood === "seated" ? sandstone(sx(0), sy(0), camera.s, 0) : sandstone(x, y, size / HOLE(), q)) : null;
    c.fillStyle = f || "#9e978e"; c.fill();
    if (f) warm(c, mood, x, y, size);
    c.strokeStyle = mood === "seated" ? "#6b4a30" : "#5e5a55"; c.lineWidth = Math.max(1.5, size * 0.035); c.lineJoin = "round"; c.stroke();
    var col = mood === "sleep" ? "rgba(96,80,64,.55)" : mood === "seated" ? "#4fe0b0" : "#ffd36b";
    var glowing = mood !== "sleep";
    if (glowing) { c.shadowColor = col; c.shadowBlur = size * (mood === "seated" ? 0.18 : 0.12); }
    var sp = c === ctx ? spiralIn(col) : null, w = size * 0.46;
    c.translate(x, y); c.rotate(q * Math.PI / 2);
    if (sp) c.drawImage(sp, -w / 2, -w / 2, w, w);
    else {
      c.strokeStyle = col; c.lineWidth = Math.max(1.5, size * 0.04); c.lineCap = "round"; c.beginPath();
      for (var i = 0; i <= 36; i++) { var t = i / 36 * Math.PI * 4, r = w * 0.5 * i / 36; var px = r * Math.cos(t), py = r * Math.sin(t); if (i) c.lineTo(px, py); else c.moveTo(px, py); }
      c.stroke();
    }
    c.restore();
  }
  function drawSeated() {
    var size = HOLE() * camera.s, list = seated.slice().sort(function (a, b) { return a.x - b.x; }), x0 = list.length ? list[0].x : 0, x1 = list.length ? list[list.length - 1].x : 1;
    seated.forEach(function (s) {
      drawStone(ctx, s.shape, sx(s.x), sy(s.y), size, 0, "seated", 1);
      if (finale) {
        // the finale: the spirals light up in a wave from the bank to the island
        var at = (s.x - x0) / Math.max(1, x1 - x0) * 1.4, k = finT - at;
        if (k > 0 && k < 0.9) glow(sx(s.x), sy(s.y), size * 0.9 * (still ? 1 : 0.6 + 0.6 * k), "rgba(110,240,190," + (0.55 * (1 - k / 0.9)).toFixed(2) + ")");
      }
    });
  }
  function glow(x, y, r, col) { var g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(110,240,190,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  // the help: the ghost (the stone the right way up, faint, in its hole), the
  // hole's glow and the arrow (ages 5-8: which way to turn and how many taps
  // are left; ages 3-4: to the hole with the same shape)
  function drawHints() {
    if (!stone || !plan || finale || beat > 0) return;
    var h = plan, size = HOLE() * camera.s, x = sx(h.x), y = sy(h.y);
    if ((!little && rung >= 1) || power > 0) { ctx.save(); ctx.globalAlpha = 0.34; drawStone(ctx, stone.shape, x, y, size, 0, "lit", 1); ctx.restore(); }
    var glowOn = little ? rung >= 1 : rung >= 2;
    if (glowOn) {
      var k = still ? 1 : 0.75 + 0.25 * Math.sin(pulse * 5);
      ctx.save(); shapePath(ctx, h.shape, x, y, size * (1 + 0.1 * k), 0); ctx.strokeStyle = "rgba(255,236,150," + (0.95 * k).toFixed(2) + ")"; ctx.lineWidth = 5; ctx.shadowColor = "#ffd34d"; ctx.shadowBlur = 16; ctx.stroke(); ctx.restore();
    }
    if (stone.state === "held" || stone.state === "seat") return;
    var s = { x: sx(stone.x), y: sy(stone.y) }, ss = stoneSize() * camera.s;
    if (!little && rung >= 2) {
      var left = need();
      if (left > 0) turnArrow(s.x, s.y, ss * 0.66, left);
      else arrowTo(s, { x: x, y: y }, ss * 0.55, size * 0.6);
    }
    if (little && rung >= 1) arrowTo(s, { x: x, y: y }, ss * 0.55, size * 0.6, true);
  }
  function turnArrow(x, y, r, left) {
    ctx.save(); ctx.strokeStyle = "#fff2b8"; ctx.fillStyle = "#fff2b8"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.shadowColor = "rgba(90,60,20,.6)"; ctx.shadowBlur = 6;
    var a0 = -Math.PI * 0.75, a1 = a0 + Math.PI * 0.5 * Math.min(3, left) - 0.25;
    ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke();
    ctx.translate(x + r * Math.cos(a1), y + r * Math.sin(a1)); ctx.rotate(a1 + Math.PI / 2); ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -9); ctx.lineTo(-6, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
    // one dot a tap still needed, under the arrow's start
    for (var i = 0; i < left; i++) { ctx.fillStyle = "#fff2b8"; ctx.beginPath(); ctx.arc(x - r * 0.9 + i * 12, y - r * 1.02, 4.5, 0, Math.PI * 2); ctx.fill(); }
  }
  function arrowTo(from, to, r0, r1, bounce) {
    var d = dist(from, to); if (d < r0 + r1 + 10) return;
    var hop = bounce && !still ? Math.abs(Math.sin(pulse * 4)) * 8 : 0;
    var ux = (to.x - from.x) / d, uy = (to.y - from.y) / d, a = { x: from.x + ux * r0, y: from.y + uy * r0 }, b = { x: to.x - ux * (r1 + 4 + hop), y: to.y - uy * (r1 + 4 + hop) };
    ctx.save(); ctx.strokeStyle = "#fff2b8"; ctx.fillStyle = "#fff2b8"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.setLineDash([2, 9]); ctx.shadowColor = "rgba(90,60,20,.6)"; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(uy, ux)); ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-12, -10); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function drawBlossoms() {
    blossoms.forEach(function (b) {
      if (b.t <= 0) return;
      var k = still ? 1 : b.t, w = 34 * camera.s * (0.4 + 0.6 * k);
      if (!sprite(ctx, "blossom", sx(b.x), sy(b.y), w, still ? b.t : 1)) { ctx.save(); ctx.globalAlpha = still ? b.t : 1; ctx.fillStyle = "#f7a6c4"; ctx.beginPath(); ctx.arc(sx(b.x), sy(b.y), w * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff0a8"; ctx.beginPath(); ctx.arc(sx(b.x), sy(b.y), w * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    });
  }
  function drawEffects() {
    puffs.forEach(function (p) { var k = p.t / 0.8; for (var i = 0; i < 5; i++) { var a = Math.PI * (0.1 + 0.2 * i), r = (still ? 30 : 12 + 50 * k) * camera.s; ctx.fillStyle = "rgba(226,206,180," + (0.7 * (1 - k)).toFixed(2) + ")"; ctx.beginPath(); ctx.arc(sx(p.x) + Math.cos(a) * r * (i - 2) * 0.5, sy(p.y) - Math.sin(a) * r * 0.3, (10 + 8 * k) * camera.s, 0, Math.PI * 2); ctx.fill(); } });
    splashes.forEach(function (p) { var k = p.t / 0.7; ctx.fillStyle = "rgba(240,252,255," + (0.9 * (1 - k)).toFixed(2) + ")"; for (var i = 0; i < 7; i++) { var a = -Math.PI * (0.15 + 0.7 * i / 6), r = (still ? 30 : 10 + 50 * k) * camera.s; ctx.beginPath(); ctx.arc(sx(p.x) + Math.cos(a) * r, sy(p.y) + Math.sin(a) * r, 4 * camera.s + 1, 0, Math.PI * 2); ctx.fill(); } });
  }
  function drawActive() {
    var s = stone, size = stoneSize() * camera.s, x = sx(s.x), y = sy(s.y), q = s.q, alpha = s.alpha;
    if (s.state === "wobble" && !still) q += Math.sin(s.wob * 30) * 0.06 * (1 - s.wob / 0.6);
    if (s.state === "rise" && !still) alpha *= Math.min(1, 0.35 + s.t);
    ctx.save(); ctx.shadowColor = "rgba(40,30,20,.35)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 8;
    drawStone(ctx, s.shape, x, y, size, q, "lit", alpha);
    ctx.restore();
  }
  // Ages 3-4: the near river, between the bridge and the bank Echo and the
  // buddy stand on, fixed to the screen like the bank. It is where the duck
  // family paddles from step 4 ("Look, ducks!"): the bridge's own water is
  // below the frame from then on (a hole is kept at 31% of the board, so on
  // a 320 px phone the view ends above the arch), and ducks drawn there were
  // never seen until the finale. Here they sit on the board's bottom edge at
  // every size, under the open holes and the stone, which are above them.
  function ducksOn() { return little && (stage >= 3 || finale); }
  function duckSpot() {
    var w = clamp(boardW() * DUCKS.w, DUCKS.min, DUCKS.max), i = image("ducks"), h = w * (i ? i.naturalHeight / i.naturalWidth : DUCKS.h);
    var a = flow / DUCKS.lap * Math.PI * 2, k = still ? 0.15 : (Math.sin(a) + 1) / 2, x0 = 12 + w / 2, x1 = W - 12 - w / 2;
    // the picture faces left: mirrored while they paddle right
    return { x: x0 + (x1 - x0) * k, bottom: board.bottom - 1, w: w, h: h, right: !still && Math.cos(a) > 0, x0: x0 - w / 2, x1: x1 + w / 2 };
  }
  function drawNear() {
    var d = duckSpot(), sv = d.bottom - d.h * DUCKS.sink, foot = bankTop + standH * 0.55 + 16, calm = power > 0;
    var g = ctx.createLinearGradient(0, sv, 0, foot);
    // the painted river's own turquoise, so the two read as one river
    g.addColorStop(0, "rgba(112,198,194,.95)"); g.addColorStop(1, "rgba(66,166,174,.98)");
    ctx.fillStyle = g; ctx.fillRect(0, sv, W, foot - sv);
    if (!calm) {
      ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 2; ctx.lineCap = "round";
      for (var j = 0; j < 9; j++) {
        var cx = ((j * 97 + flow * 22 * (j % 2 ? 1 : 0.7)) % (W + 40)) - 20, cy = sv + 9 + (j % 3) * Math.max(6, (foot - sv - 24) / 3);
        ctx.beginPath(); ctx.arc(cx, cy, 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      }
    }
    if (ducksOn()) {
      var y = d.bottom;
      ctx.save(); ctx.translate(d.x, 0); if (d.right) ctx.scale(-1, 1);
      if (!sprite(ctx, "ducks", 0, y, d.w, 1, true)) {
        // stand-in: the mother and three ducklings, yellow ovals in a row
        // facing left, each with an orange beak and an eye
        [[-0.25, 0.42, 0.2, 0.3], [0.04, 0.3, 0.1, 0.2], [0.22, 0.3, 0.1, 0.2], [0.39, 0.3, 0.1, 0.18]].forEach(function (p) {
          var cx = p[0] * d.w, cy = y - p[1] * d.h * 1.2, rx = p[2] * d.w, ry = p[3] * d.h * 1.4;
          ctx.fillStyle = "#f6d34a"; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#f08a2c"; ctx.beginPath(); ctx.moveTo(cx - rx * 0.8, cy - ry * 0.35); ctx.lineTo(cx - rx * 1.25, cy - ry * 0.15); ctx.lineTo(cx - rx * 0.8, cy + ry * 0.05); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#3a2a1e"; ctx.beginPath(); ctx.arc(cx - rx * 0.45, cy - ry * 0.4, Math.max(1.2, ry * 0.12), 0, Math.PI * 2); ctx.fill();
        });
      }
      ctx.restore();
      // the water over their feet, so they float in it
      ctx.fillStyle = "rgba(112,198,194,.85)"; ctx.fillRect(d.x - d.w / 2, sv, d.w, y - sv + 1);
    }
    ctx.fillStyle = calm ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.6)"; ctx.fillRect(0, sv - 1, W, 2.5);
  }
  // the near bank in front, where Echo and the buddy stand
  function drawBank() {
    var top = bankTop + standH * 0.55, g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, "#e2b98d"); g.addColorStop(1, "#c08e62");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, top + 8); ctx.quadraticCurveTo(W / 2, top - 6, W, top + 8); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#93c871"; ctx.beginPath(); ctx.moveTo(0, top + 8); ctx.quadraticCurveTo(W / 2, top - 6, W, top + 8); ctx.lineTo(W, top + 14); ctx.quadraticCurveTo(W / 2, top, 0, top + 14); ctx.closePath(); ctx.fill();
  }

  // ── the buttons ──
  function hud() {
    var p = playing() && beat === 0;
    try {
      $("brHelp").disabled = !(p && power <= 0);
      $("brHearStep").disabled = !p;
      $("brPower").hidden = !(power > 0); $("brPowerFill").style.width = (power / POWER * 100) + "%";
      var hb = $("brStone"), at = stone ? { x: sx(stone.x), y: sy(stone.y) } : { x: W / 2, y: (board.top + board.bottom) / 2 };
      // never disabled: a disabled button drops the keyboard's focus between stones
      hb.setAttribute("aria-disabled", p && stone ? "false" : "true"); hb.style.left = at.x + "px"; hb.style.top = at.y + "px";
      var tb = $("brTurn"), show = p && !little && !!stone && stone.state !== "held" && stone.state !== "seat" && stone.state !== "wobble";
      tb.hidden = !show;
      if (show) { var t = turnSpot(); tb.style.left = t.x + "px"; tb.style.top = t.y + "px"; }
    } catch (e) {}
  }
  // the round turn button sits beside the stone: on its far side from the
  // hole, else below, above or on the near side, wherever it fits on the
  // board without covering a hole
  function turnSpot() {
    var home = stone.state === "float" || stone.state === "rise" ? homeOf(plan, stage, waterLine()) : stone;
    return spotBeside({ x: sx(home.x), y: sy(home.y) }, stoneSize() * camera.s / 2 + (plan.drift && !little && home !== stone ? DRIFT.rx * camera.s : 0), { x: sx(plan.x), y: sy(plan.y) }, HOLE() * camera.s / 2);
  }
  function spotBeside(c, half, h, hh) {
    var R = 31, pad = 8;
    var side = c.x >= h.x ? 1 : -1, list = [
      { x: c.x + side * (half + pad + R), y: c.y }, { x: c.x, y: c.y + half + pad + R }, { x: c.x, y: c.y - half - pad - R }, { x: c.x - side * (half + pad + R), y: c.y },
      { x: c.x + side * (half * 0.7 + R), y: c.y + half * 0.7 + R }
    ];
    for (var i = 0; i < list.length; i++) {
      var t = list[i], fits = t.x - R >= 6 && t.x + R <= W - 6 && t.y - R >= board.top && t.y + R <= board.bottom;
      var clear = Math.abs(t.x - h.x) >= hh + R + 4 || Math.abs(t.y - h.y) >= hh + R + 4;
      if (fits && clear) return t;
    }
    return list[1];
  }
  // What tests read: worked out when it is read (a getter on window), so it is
  // never a frame behind the game and costs nothing while nobody looks.
  function snapshot() {
    var off = cv ? cv.getBoundingClientRect() : { left: 0, top: 0 }, p = plan, size = HOLE() * (camera ? camera.s : 1);
    function scr(x, y) { return { sx: sx(x) + off.left, sy: sy(y) + off.top }; }
    try {
      var tb = $("brTurn"), tr = tb.getBoundingClientRect();
      return {
        stage: stage, steps: total, little: little, active: active, paused: paused, finale: finale, still: still,
        shape: stone ? stone.shape : (p ? p.shape : ""), rot: rot(), need: need(), taps: p && !little ? p.taps : 0,
        pos: stone ? (function () { var o = scr(stone.x, stone.y); o.x = stone.x; o.y = stone.y; o.w = stoneSize() * camera.s; o.state = stone.state; o.drifting = drifting(); o.alpha = stone.alpha; o.turning = stone.q < stone.qt; return o; })() : null,
        home: p && stone ? (function () { var h = homeNow(), o = scr(h.x, h.y); o.x = h.x; o.y = h.y; return o; })() : null,
        hole: p ? (function () { var o = scr(p.x, p.y); o.x = p.x; o.y = p.y; o.w = size; o.shape = p.shape; return o; })() : null,
        open: p ? openHoles(stage).map(function (q) { var o = scr(q.x, q.y); o.x = q.x; o.y = q.y; o.w = size; o.shape = q.shape; return o; }) : [],
        ladder: rung, misses: misses, idle: idle, beat: beat, dones: dones, power: power, calm: power > 0,
        ghost: !!stone && ((!little && rung >= 1) || power > 0), glow: !!stone && (little ? rung >= 1 : rung >= 2), arrow: !!stone && (little ? rung >= 1 : rung >= 2),
        tapsLeft: need(), snap: !little && rung >= 3, slide: little && rung >= 2, carry: little && rung >= 3,
        camera: camera ? { x: camera.x, y: camera.y, s: camera.s, moving: !!camera.from, k: camera.k, target: camera.to, pulledBack: pulledBack } : null,
        water: { line: waterLine(), risen: risen, k: riseK }, twist: risen, ripples: rippleCount, ducks: ducksOn(),
        duckBox: ducksOn() ? (function () { var d = duckSpot(); return { x: d.x - d.w / 2 + off.left, y: d.bottom - d.h + off.top, w: d.w, h: d.h }; })() : null,
        seated: seated.map(function (s) { return s.shape; }), finger: finger ? { type: finger.type, onStone: !!finger.onStone, moved: finger.moved } : null,
        turn: { shown: !tb.hidden, x: tr.left, y: tr.top, w: tr.width, h: tr.height },
        artReady: artReady(), art: JSON.parse(JSON.stringify(artState)), banner: banner, banners: seen.slice(),
        board: { left: off.left, right: off.left + W, top: board.top + off.top, bottom: board.bottom + off.top, w: boardW() },
        shapes: SHAPES, startTaps: ANCHORS.big.map(function (q) { return q.taps; }), order: steps().map(function (q) { return q.shape; }),
        anchors: { big: ANCHORS.big, little: ANCHORS.little, hole: HOLE(), lift: ANCHORS.lift, water: ANCHORS.water },
        waterSy: camera ? sy(waterLine()) + off.top : 0, views: views(off)
      };
    } catch (e) { return null; }
  }

  // every step's view, as the camera will frame it: its open holes, where its
  // stone waits (with the loop it swims in) and the turn button beside it
  function views(off) {
    var keep = camera, out = [];
    try {
      steps().forEach(function (p, i) {
        var t = targetFor(i); camera = { x: t.x, y: t.y, s: t.s };
        var h = HOLE() * t.s, home = homeOf(p, i), sw = HOLE() * ANCHORS.lift * t.s, ex = p.drift && !little ? DRIFT.rx * t.s : 0, ey = p.drift && !little ? DRIFT.ry * 2 * t.s : 0;
        var c = { x: sx(home.x), y: sy(home.y) }, spot = little ? null : spotBeside(c, sw / 2 + ex, { x: sx(p.x), y: sy(p.y) }, h / 2);
        // ages 3-4 from step 4: the whole path the ducks paddle along
        var dk = little && i >= 3 ? duckSpot() : null;
        out.push({ step: i, s: t.s, holes: openHoles(i).map(function (q) { return { x: sx(q.x) + off.left, y: sy(q.y) + off.top, w: h }; }),
          stone: { x: c.x + off.left, y: c.y + off.top, w: sw, ex: ex, ey: ey }, turn: spot ? { x: spot.x + off.left, y: spot.y + off.top, r: 31 } : null,
          ducks: dk ? { x0: dk.x0 + off.left, x1: dk.x1 + off.left, y: dk.bottom - dk.h + off.top, bottom: dk.bottom + off.top } : null });
      });
    } catch (e) {}
    camera = keep;
    return out;
  }

  // ── the finger and the keyboard ──
  function pointAt(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function onStoneAt(p) {
    if (!stone) return false;
    var w = { x: wx(p.x), y: wy(p.y) }, half = stoneSize() / 2 + 10 / camera.s;
    return Math.abs(w.x - stone.x) <= half && Math.abs(w.y - stone.y) <= half;
  }
  function ripple(p) {
    var w = { x: wx(p.x), y: wy(p.y) };
    if (w.y < waterLine() || p.y > board.bottom) return false;
    ripples.push({ x: w.x, y: w.y, t: 0 }); rippleCount++; return true;
  }
  function controls() {
    // a tap turns the stone (under 12 px, under 300 ms); anything else slides
    // it. The newest finger wins.
    cv.addEventListener("pointerdown", function (e) {
      var p = pointAt(e);
      if (away || paused) return;
      var grab = grabbable() && (onStoneAt(p) || (little && rung >= 3));
      if (!grab) {
        ripple(p);
        if (playing() && beat === 0) finger = { id: e.pointerId, type: e.pointerType || "mouse", x: p.x, y: p.y, at: nowS(), w: { x: wx(p.x), y: wy(p.y) }, onStone: false };
        return;
      }
      dropKb();
      finger = { id: e.pointerId, type: e.pointerType || "mouse", x: p.x, y: p.y, x0: p.x, y0: p.y, down: nowS(), at: nowS(), moved: 0, onStone: true, carry: !onStoneAt(p),
        dx: stone.x - wx(p.x), dy: stone.y - wy(p.y), w: { x: wx(p.x), y: wy(p.y) }, from: stone.state };
      stone.state = "held"; stone.alpha = 1;
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    });
    cv.addEventListener("pointermove", function (e) {
      if (!finger || e.pointerId !== finger.id) return;
      var p = pointAt(e); if (Math.abs(p.x - finger.x) + Math.abs(p.y - finger.y) > 0.5) finger.at = nowS();
      finger.x = p.x; finger.y = p.y; finger.w = { x: wx(p.x), y: wy(p.y) };
      if (!finger.onStone || !stone || stone.state !== "held") return;
      finger.moved = Math.max(finger.moved, Math.sqrt((p.x - finger.x0) * (p.x - finger.x0) + (p.y - finger.y0) * (p.y - finger.y0)));
      if (finger.moved >= TAP_PX) {
        finger.drag = true;
        if (finger.carry || (little && rung >= 3)) { finger.carry = true; return; }
        holdAt(wx(p.x) + finger.dx, wy(p.y) + finger.dy);
      }
    });
    function up(e) {
      if (!finger || (e && e.pointerId !== finger.id)) return;
      var f = finger; finger = null;
      if (!f.onStone || !stone || stone.state !== "held") return;
      if (!f.drag && nowS() - f.down < TAP_S) {
        // a tap: the stone stays where it was and turns
        stone.state = f.from === "away" ? "away" : "float";
        if (!turn()) tapAt = nowS();
        return;
      }
      tapAt = nowS(); drop();
    }
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up); cv.addEventListener("lostpointercapture", up);
    // the turn button: for a child whose taps keep becoming slides
    $("brTurn").addEventListener("click", function () { turn(); hud(); });
    // keyboard: the arrows slide the stone, Space turns it (ages 3-4: lets
    // go), Enter lets go
    var hb = $("brStone");
    hb.addEventListener("keydown", function (e) {
      var k = e.key, d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
      if (d) {
        e.preventDefault(); if (!grabbable() && !(kbHeld && stone && stone.state === "held")) return;
        if (!kbHeld) { kbHeld = true; finger = null; stone.state = "held"; stone.alpha = 1; }
        var step = HOLE() * 0.25;
        if (little && rung >= 3) { var t = edgeOf(plan); stone.x = t.x; stone.y = t.y; }
        else holdAt(stone.x + d[0] * step, stone.y + d[1] * step);
        kbAt = nowS(); return;
      }
      if (k === " " && !little) { e.preventDefault(); if (turn()) kbAt = nowS(); return; }
      if (k === "Enter" || k === " ") { e.preventDefault(); if (kbHeld) { kbHeld = false; kbAt = nowS(); drop(); } }
    });
    hb.addEventListener("blur", dropKb);
    $("brHelp").onclick = function () { if (playing() && beat === 0 && power <= 0) api.practice(); };
    $("brHearStep").onclick = function () { if (playing() && beat === 0) api.instruct(stepLine()); };
    window.addEventListener("resize", fit);
    window.addEventListener("blur", function () { letGo(); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    window.addEventListener("pagehide", function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; });
    window.addEventListener("pageshow", function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
  }
  // a stone held by the keyboard is let go where it is when the focus leaves
  function dropKb() { if (kbHeld) { kbHeld = false; if (stone && stone.state === "held") wait({ x: stone.x, y: stone.y }); } }
  // a finger taken away (the page hidden, the window left): the stone waits
  // where it was, then drifts back. Never a drop: nothing is fitted for it.
  function letGo() {
    if (finger && finger.onStone && stone && stone.state === "held") wait({ x: stone.x, y: stone.y });
    finger = null; dropKb();
  }

  // ── the engine's hooks ──
  function pause() { paused = true; letGo(); last = 0; hud(); }
  function onWord(i) {
    stage = clamp(i, 0, steps().length - 1); plan = steps()[stage];
    active = true; paused = false; beat = 0; idle = 0; rung = 0; misses = 0; power = 0; driftT = 0;
    finger = null; kbHeld = false;
    // the twist (ages 5-8, word 5): the river is rising, and the waterfall roars
    var twisting = !little && plan.twist && !risen;
    if (twisting) { risen = true; riseK = still ? 1 : 0; sfx("roar"); }
    stone = newStone();
    if (!camera || (!camera.from && (Math.abs(camera.x - targetFor(stage).x) > 1 || Math.abs(camera.y - targetFor(stage).y) > 1))) aim(targetFor(stage), camera ? 0.6 : 0);
    splashes.push({ x: stone.x, y: waterLine(), t: 0 });
    setBanner(twisting ? "The river is rising!" : tryBanner());
    sfx("rise");
    try { api.instruct(stepLine()); } catch (e) {}
    hud();
  }
  // Calm river, heard: for ten seconds the river goes glassy, the stone
  // floats still and the ghost shows, on the same stone
  function onHelp() { active = true; paused = false; power = POWER; setBanner("Calm river! The water is still."); sfx("calm"); hud(); }
  function reset() {
    stage = 0; plan = steps()[0]; active = false; paused = false; finale = false; finT = 0;
    stone = null; finger = null; kbHeld = false; idle = 0; rung = 0; misses = 0; power = 0; beat = 0; dones = 0; driftT = 0;
    seated = []; blossoms = []; puffs = []; ripples = []; splashes = []; risen = false; riseK = 0; pulledBack = false; seen = []; banner = "";
    if (cv) aim(targetFor(0), 0);
    setBanner(little ? "Say the word to call a stone" : "Say the word to call a stone up"); hud(); draw();
  }
  // the finale: the camera pulls back to the whole bridge, the spirals light
  // up in a wave from the bank to the island and blossoms burst along the rail
  function onFinale() {
    finale = true; active = false; finT = 0; beat = 0; stone = null; finger = null; kbHeld = false;
    if (!pulledBack) { pulledBack = true; aim(wholeView(), 1.2); }
    for (var i = 0; i <= 12; i++) { var x = ANCHORS.bank.face + 20 + (ANCHORS.island.face - ANCHORS.bank.face - 40) * i / 12; blossoms.push({ x: x, y: topY(x) - 10, t: still ? 1 : -i * 0.12, step: -1 }); }
    setBanner("The bridge is whole again!");
    try { if (api) api.sfx("sparkle"); } catch (e) {}
    hud();
  }
  window.Bridge = {
    // the page says which age plays before the engine starts (ages 3-4: six words)
    setLittle: function (on) { little = !!on; },
    setBuddy: function (p) { buddyPics = (p && typeof p.rest === "string" && typeof p.cheer === "string") ? { rest: p.rest, cheer: p.cheer } : null; },
    init: function (a, n) {
      api = a; total = n || (little ? 6 : 8); cv = $("bridgeCanvas"); ctx = cv.getContext("2d");
      try { Object.defineProperty(window, "__bridge", { configurable: true, get: snapshot }); } catch (e) {}
      loadArt(); controls(); reset(); fit(); raf = requestAnimationFrame(frame);
    },
    onWord: onWord, onHelp: onHelp, pause: pause,
    resume: function (playingNow) { paused = playingNow === false; last = 0; hud(); },
    reset: reset, finale: onFinale
  };
})();
