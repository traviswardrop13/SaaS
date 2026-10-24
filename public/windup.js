/* Wind-Up Toys: Day 2 of the daily story (STORY1, 22 Oct 2026, "Grandpa
   Bear's Sleepy Toys"). The toys had a secret party all night and ran out of
   wind. Each word said three times finds the next toy's key (it pops out with a
   ding and the dial lights up); the finger winds it by drawing circles on the
   big brass dial, and lets go at the gold star on the spring meter. Too
   little and the toy yawns and sits back down; too much and it spins dizzy.
   Just right and it does its trick and marches down the ramp into the
   parade line. The last step cranks the giant music box: the tune plays, the
   doors swing open and the parade marches out. SayPlay owns the word, the
   mic, Echo's voice, the reps and the start and end cards; this file owns
   only the play, and never touches storage, the mic or a rep.

   THE WINDING is the total angle the finger sweeps round the dial's centre
   (atan2, unwrapped as it goes), anywhere from 15% of the dial's radius out
   to 1.4 times it, either way round. Only new ground counts: a finger that
   goes back the way it came wins nothing until it has gone most of a turn
   the other way (REVERSE), so a scribble back and forth winds next to
   nothing. Nothing is ever unwound: a slip off the dial only lets go of the
   finger's place on it. Every quarter turn clicks. The needle is the turns
   so far over the turns that toy needs (`need`, the middle of the star).

   LETTING GO (ages 5-8). Lifting the finger is the try, read by where the
   needle is:
     under 30% of the way to the star: nothing (a hand moving, never a try);
     from 30% up to the star: too little, a yawn, the needle stays (a miss);
     in the star: just right, the trick and the march, then the step;
     past the star: too much, a dizzy spin, the needle drops just under the
       star (a miss).
   Winding past the top of the meter just clicks; nothing ever breaks.

   EVERY TOY WAKES (CLAUDE.md, "Every ball ends in a basket"), and no help
   ever winds or lets go by itself: the finger makes every move. Two ladders
   climb side by side, and both start again with each new word.
   - Misses (a too-little or too-much let-go): after 1 the star is 1.6 times
     wider and each circle moves the needle 25% less; after 2 the needle
     glows gold in the star and the key catches there (more winding won't
     move it past); from the 3rd, letting go anywhere past 30% wakes the toy,
     the needle springing to the star as the finger lifts.
   - Trouble drawing circles: seconds of a finger moving on the board that
     have not finished a quarter turn (`effort`; waiting is never effort).
     It counts a finger anywhere on the board, not only on the dial, because
     a child who can't find the dial is the child this ladder is for. After
     4 s the arrows brighten and a dot traces the circle; after 8 s rubbing
     back and forth on the dial winds too; after 12 s any drag anywhere on
     the screen winds. The music box keeps the same ladder, and from 12 s
     every drag cranks double.
   Ages 3-4 (setLittle(true)): one big toy at a time and no star. Circling or
   rubbing on the dial both wind, the meter only fills, and when it is full
   (about two circles) it dings and the toy wakes at once, so it cannot be
   over-wound. Their ladder is 2, 4 and 6 s: the arrows and the dot, then any
   drag on the dial winds twice as fast, then one drag fills the meter.

   THE OIL CAN (the help pill, api.practice()): the same word said again, and
   Echo oils the key with a little squirt. For 10 s every circle counts double
   and the star is wide. Silence, a pause or "Back to the game" gives the same
   toy straight back with nothing taken (the engine's endHelp).

   The step counts BEAT (1.15 s) after the toy wakes, on this file's own
   clock, which runs only while the page is live, so the cheer is heard whole
   and a pause holds it. Under Reduce Motion nothing slides or spins: each
   trick, yawn and spin is a change of pose, the shelf and the march are cuts.

   Every painted picture has a drawn stand-in (the toys, the shop, the dial,
   the key, the meter, Grandpa Bear, the cuckoo clock, the music box), so the
   game plays the same if a picture never arrives. Where each painted picture
   sits is the TOYS, LAYOUT, ART and GAUGE tables just below, fitted to the
   art notes (design/adventure/art-notes.md, section 5). Two things are drawn
   on the paintings because neither has them: the buddy's little wall shelf,
   and the cuckoo clock's doors, shut until the twist. */
(function () {
  "use strict";
  // ── what Echo says (api.instruct): one line a step, by age ──
  var STEP_LINES = [
    "Draw circles around the key to wind it. Let go at the star!",
    "Wind up the frog. Let go when the needle reaches the star!",
    "Wind up the spinning top. Round and round, then let go at the star!",
    "Wind up the crocodile. Clack, clack!",
    "Cuckoo! Now the big toys on the top shelf. Their keys need more turns.",
    "Wind up the jack-in-the-box. Let go at the star, and pop!",
    "Wind up the hippo. She wants to dance!",
    "Turn the big crank on the music box to start the parade!"
  ];
  var LITTLE_LINES = [
    "Draw circles on the key until it rings!",
    "Wind up the frog until it rings!",
    "Wind up the elephant. Round and round!",
    "Wind up the hippo. She wants to dance!",
    "Wind up the spinning top!",
    "Turn the big crank to start the parade!"
  ];
  // Every line the banner can show: short, kind, one line on a 320 px phone
  // where it can be (fit() still makes room for the tallest). Never "missed",
  // "wrong", "fail", "score", "points" or "correct".
  var SAY = {
    start: "Say the word to find the key!",
    click: "Click, click, click!",
    little: "A little more winding!",
    dizzy: "Whoa, dizzy! Let go a bit sooner",
    glow: "Watch for the gold glow",
    right: "Just right!",
    anyGo: "Let go when you like!",
    dot: "Follow the dot around",
    rub: "Rub the dial to wind it",
    drag: "Drag anywhere to wind!",
    rubLittle: "Rub the key fast!",
    dragLittle: "One big drag!",
    oil: "Oil can! Say the word",
    oiled: "Oiled! Round and round",
    ring: "Ding! Wake up!",
    music: "Hear the music box!",
    parade: "The parade is on!"
  };
  // what each toy is, what it does when it wakes, and its drawn stand-in's
  // colours. One painted picture each, awake and standing, with no key: sleep,
  // the trick and the march are all done by moving that one picture.
  // aspect: the painting's width over its height (the stand-in is drawn to it).
  // cap: where the nightcap's brim sits on its head [x, y] (fractions of the
  // picture) and how wide it is (a fraction of the toy's height). key: where
  // the key goes into its back [x, y] and which way the handle points (1
  // right, -1 left, 0 up). scale: the jack-in-the-box's picture is mostly the
  // room its puppy pops up into, so it is drawn taller to keep the box a toy's
  // size. Read off each painting (design/adventure/art-notes.md).
  var TOYS = {
    bunny: { label: "Wind up the bunny", trick: "drum", sprite: "bunny", aspect: 0.684, cap: [0.42, 0.21, 0.3], key: [0.2, 0.56, -1], colors: ["#3f6fc2", "#fff1dc", "#d0503f"] },
    frog: { label: "Wind up the frog", trick: "boing", sprite: "frog", aspect: 1.127, cap: [0.52, 0.14, 0.36], key: [0.95, 0.56, 1], colors: ["#5aa55a", "#fff6dc", "#d0503f"] },
    top: { label: "Wind up the spinning top", trick: "spin", sprite: "top", aspect: 0.742, cap: [0.5, 0.09, 0.28], key: [0.96, 0.4, 1], colors: ["#f2c443", "#d0503f", "#3f6fc2"] },
    croc: { label: "Wind up the crocodile", trick: "clack", sprite: "croc", aspect: 1.316, cap: [0.36, 0.13, 0.36], key: [0.72, 0.24, 0], colors: ["#4e9a62", "#fff6dc", "#f2c443"] },
    elephant: { label: "Wind up the elephant", trick: "toot", sprite: "elephant", aspect: 1.02, cap: [0.47, 0.12, 0.32], key: [0.7, 0.74, 1], colors: ["#8fa2bf", "#c9a24a", "#d0503f"] },
    jack: { label: "Wind up the jack-in-the-box", trick: "pop", sprite: "jack-closed", open: "jack-open", aspect: 0.731, scale: 1.3, cap: [0.51, 0.57, 0.3], key: [0.85, 0.8, 1], colors: ["#d0503f", "#f2c443", "#a8743f"] },
    hippo: { label: "Wind up the hippo", trick: "twirl", sprite: "hippo", aspect: 0.651, cap: [0.45, 0.08, 0.24], key: [0.63, 0.5, 1], colors: ["#b494d0", "#f6b8cf", "#fff6dc"] },
    musicbox: { label: "Turn the music box crank", trick: "tune", sprite: "musicbox", aspect: 0.802, colors: ["#8a5a34", "#c9a24a", "#f6e4bd"] }
  };
  // The round, by age. need: turns to the middle of the star. star: how wide
  // the star is, in turns. at: which part of the shop the toy stands in.
  var BIG = [
    { toy: "bunny", need: 2.5, star: 0.6, at: "bench" },
    { toy: "frog", need: 2.5, star: 0.6, at: "bench" },
    { toy: "top", need: 2.5, star: 0.6, at: "bench" },
    { toy: "croc", need: 2.5, star: 0.6, at: "bench" },
    { toy: "elephant", need: 3.5, star: 0.5, at: "shelf" },
    { toy: "jack", need: 3.5, star: 0.5, at: "shelf" },
    { toy: "hippo", need: 3.5, star: 0.5, at: "shelf" },
    { toy: "musicbox", need: 4, star: 0, at: "bench", crank: true }
  ];
  var LITTLE = [
    { toy: "bunny", need: 2, star: 0, at: "bench", fill: true },
    { toy: "frog", need: 2, star: 0, at: "bench", fill: true },
    { toy: "elephant", need: 2, star: 0, at: "bench", fill: true },
    { toy: "hippo", need: 2, star: 0, at: "bench", fill: true },
    { toy: "top", need: 2, star: 0, at: "bench", fill: true },
    { toy: "musicbox", need: 2, star: 0, at: "bench", crank: true }
  ];
  var TWIST = 4;   // ages 5-8: the fifth word pops the cuckoo and goes up to the top shelf
  // What stands where, as fractions of the board (the scene between the
  // banner and the meter): the toy being wound, Echo on his spool, and the
  // buddy on its little shelf, which stay put when the view goes up to the
  // top shelf.
  var LAYOUT = {
    bench: 0.94,      // the bench's front edge, where the toy stands
    toyX: 0.5, toyH: 0.58, toyHLittle: 0.66, toyW: 0.42,
    echoX: 0.1, echoH: 0.34, spoolH: 0.1,
    buddyX: 0.13, plank: 0.27, buddyH: 0.25   // the buddy sits on its own little wall shelf, over the window
  };
  // The two paintings (design/adventure/art-notes.md, section 5), and what
  // stands in them, as fractions of the picture: x of its width, y of its
  // height. Each is laid so its bench (or shelf) edge lands on LAYOUT.bench,
  // covering the width; when it is shorter than the screen, its plain planks
  // (`band`) are stretched down to its own floor at the very bottom. The
  // stand-in shop is drawn on the same frame, so nothing moves if a painting
  // never arrives.
  var ART = {
    shop: {
      w: 800, h: 1200, bench: 0.6, back: 0.5, band: [0.7, 0.84],
      window: { x: 0.25, y: 0.32, r: 0.2 },                     // the round window (for the stand-in)
      door: { x0: 0.835, x1: 0.975, y0: 0.31, y1: 0.545 },      // the open doorway to the square
      grandpa: { x: 0.24, y: 0.515, h: 0.15 },                  // asleep in his chair on the bench, in front of the window
      cuckoo: { x: 0.68, y: 0.24, h: 0.2 },                     // on the plain wall (x 0.48-0.78, y 0.24-0.46)
      // the parade line: two staggered rows on the back of the bench, from the door leftwards
      line: { x: 0.92, dx: -0.09, back: 0.53, front: 0.565, step: -0.045, h: 0.06 }
    },
    shelf: { w: 800, h: 1200, bench: 0.7, back: 0.66, band: [0.76, 0.89], upper: 0.345, cuckoo: { x: 0.82, y: 0.4, h: 0.18 } }
  };
  // The painted meter is a half circle: the needle pivots at the arc's
  // centre (px, py of the picture), the rainbow between rIn and rOut (of its width).
  var GAUGE = { aspect: 393 / 720, px: 0.51, py: 0.85, rOut: 0.467, rIn: 0.303 };
  // the cuckoo clock's little doors (fractions of its picture), shut until the twist
  var HATCH = { x0: 0.3, x1: 0.7, y0: 0.12, y1: 0.31 };
  var SPRITES = ["shop", "shelf", "bunny", "frog", "top", "croc", "elephant", "hippo", "jack-closed", "jack-open", "nightcap", "dial", "key", "gauge", "musicbox", "crank", "grandpa", "cuckoo", "oilcan"];
  var STAR_AT = 0.7;   // where the middle of the star sits on the meter (ages 5-8)
  var POWER = 10, BEAT = 1.15, REVERSE = Math.PI * 1.5, MAX_STEP = 1.2;
  var RUB = [4, 8, 12], RUB_LITTLE = [2, 4, 6];
  var REACT = { yawn: 1.3, dizzy: 1.3, wake: 0.65, march: 0.55, oil: 0.9 };

  var api = null, cv = null, ctx = null, W = 390, H = 844, raf = 0, last = 0, clock = 0;
  var art = {}, dimmed = {}, eye = {}, settled = 0;
  var little = false, steps = 8, stage = 0, cur = BIG[0];
  var active = false, paused = false, away = false, won = false, keyOut = false, keyAt = -9;
  var turns = 0, sweepTurns = 0, quarters = 0, clicks = 0, dialAngle = 0, keyAngle = 0;
  var owner = null, ownerMoved = -9, surface = null, held = false, keyHeld = false, prev = null, prevA = null, sweep = 0, origin = 0, credit = 0, downAt = null;
  var misses = 0, effort = 0, lastWork = -9, lastGain = -9, shownCircle = 0, tries = 0, lastTry = "none";
  var power = 0, react = null, doneAt = 0, dones = 0, sparks = [], pending = [];
  var scene = "bench", pan = null, cuckoo = false, cuckooAt = -9, doorsAt = -9, marchOut = -9;
  // line: the toys awake in the parade line; woke: the one on its way there;
  // left: the bench's toy has gone down the ramp (the next one waits there)
  var line = [], marching = null, woke = null, left = false, echoCheer = -9, buddy = null, buddyT = 0, banners = [];
  var top = 120, bottom = 700, board = { y: 120, h: 300 }, dial = { x: 195, y: 600, r: 110 }, meter = null, bg = {};
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function live() { return !paused && !away && !document.hidden; }
  function canPlay() { return active && !won && live(); }
  function reacting() { return !!react && react.kind !== "oil"; }
  function calm() { try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function round() { return little ? LITTLE : BIG; }
  function stepLine() { return little ? LITTLE_LINES[stage] : STEP_LINES[stage]; }
  function label() { return TOYS[cur.toy].label; }
  function banner(t) { var b = $("windupBanner"); if (b && b.textContent !== t) { b.textContent = t; if (banners.indexOf(t) < 0) banners.push(t); } }

  // ── the two ladders ──
  function circleLevel() { var t = little ? RUB_LITTLE : RUB; return effort >= t[2] ? 3 : effort >= t[1] ? 2 : effort >= t[0] ? 1 : 0; }
  function missLevel() { return Math.min(3, misses); }
  function hasStar() { return !little && !cur.crank && cur.star > 0; }
  function starHalf() {
    var h = cur.star / 2;
    if (misses >= 1) h *= 1.6;
    if (power > 0) h = Math.max(h, cur.star / 2 * 1.8);
    return h;
  }
  function starLow() { return cur.need - starHalf(); }
  function starHigh() { return cur.need + starHalf(); }
  function topTurns() { return hasStar() ? cur.need / STAR_AT : cur.need; }
  // after two misses the key catches in the star: more winding can't pass it
  function catchOn() { return hasStar() && misses >= 2; }
  function gain() {
    var g = 1;
    if (hasStar() && misses >= 1) g *= 0.75;
    if (power > 0) g *= 2;
    if (little && circleLevel() >= 2) g *= 2;
    if (cur.crank && circleLevel() >= 3) g *= 2;
    return g;
  }
  function needle() { return clamp(turns / topTurns(), 0, 1); }
  function tryAt() { return 0.3 * (hasStar() ? starLow() : cur.need); }

  // ── art ──
  function loadArt() {
    SPRITES.forEach(function (name) {
      var i = new Image();
      i.onload = function () { settled++; dimmed[name] = null; };
      i.onerror = function () { settled++; i.failed = true; };
      i.src = "/assets/crafted/game/windup-" + name + ".webp"; art[name] = i;
    });
    // Echo on his spool: his own clay poses (they live outside the game's
    // folder, so a test that blocks the game's art still sees him)
    ["welcome", "cheer"].forEach(function (p) { var i = new Image(); i.src = "/assets/crafted/echo-" + p + ".webp"; eye[p] = i; });
  }
  function image(name) { var i = art[name] || eye[name]; return i && i.complete && i.naturalWidth ? i : null; }
  // a sleeping toy is dimmed: one darker copy of its picture, made once
  function dimOf(name) {
    var i = image(name); if (!i) return null;
    if (dimmed[name]) return dimmed[name];
    try {
      var c = document.createElement("canvas"), x = c.getContext("2d"); c.width = i.naturalWidth; c.height = i.naturalHeight;
      x.drawImage(i, 0, 0); x.globalCompositeOperation = "source-atop"; x.fillStyle = "rgba(48,34,70,.34)"; x.fillRect(0, 0, c.width, c.height);
      dimmed[name] = c; return c;
    } catch (e) { return i; }
  }

  // ── the layout: the board under the banner, the meter, the dial ──
  function bannerRoom(top0) {
    var b = $("windupBanner"), keep = b.textContent, low = 0, all = Object.keys(SAY).map(function (k) { return SAY[k]; }).concat(Object.keys(TOYS).map(function (k) { return TOYS[k].label; }));
    b.setAttribute("aria-live", "off");
    for (var i = 0; i < all.length; i++) { b.textContent = all[i]; low = Math.max(low, b.getBoundingClientRect().bottom); }
    b.textContent = keep; b.setAttribute("aria-live", "polite");
    return low - top0;
  }
  function fit() {
    if (!cv) return;
    var r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    top = bannerRoom(r.top) + 10;
    bottom = $("windupControls").getBoundingClientRect().top - r.top - 12;
    var avail = Math.max(160, bottom - top), R = Math.max(40, Math.min(W * 0.31, avail * 0.2));
    dial = { x: W / 2, y: bottom - R, r: R };
    // the spring meter: the rainbow half circle just above the dial, its
    // needle's pivot clear of the dial's top (its feet stand beside the dial's
    // shoulders, never on it)
    var gw = Math.min(W * 0.66, R * 1.95), gh = gw * GAUGE.aspect, cy = dial.y - R - Math.max(8, gw * 0.05);
    meter = { cx: W / 2, cy: cy, gw: gw, gh: gh, gx: W / 2 - GAUGE.px * gw, gy: cy - GAUGE.py * gh, rOut: GAUGE.rOut * gw, rIn: GAUGE.rIn * gw };
    meter.band = meter.rOut - meter.rIn; meter.rMid = (meter.rOut + meter.rIn) / 2; meter.star = Math.max(7, meter.band * 0.36);
    // (its top: the arch, or the star that sits outside it over the star zone)
    meter.top = Math.min(meter.gy, cy + Math.sin(meterAngle(STAR_AT)) * (meter.rOut + meter.star + 2) - meter.star) - 3; meter.bottom = meter.gy + gh;
    board = { y: top, h: Math.max(80, meter.top - 6 - top) };
    bg = { shop: place("shop"), shelf: place("shelf") };
    detach(); hud(); draw();
  }
  function sy(f) { return board.y + board.h * f; }
  // where a painting lies on the screen: its bench edge on LAYOUT.bench, the
  // width covered (the same with or without the painting, so the stand-in
  // shop is drawn on the same frame)
  function place(kind) {
    var a = ART[kind], benchY = sy(LAYOUT.bench), sc = Math.max(W / a.w, benchY / (a.bench * a.h)), w = a.w * sc, h = a.h * sc;
    return { x: (W - w) / 2, y: benchY - a.bench * h, w: w, h: h, a: a };
  }
  function px(p, f) { return p.x + p.w * f; }
  function py(p, f) { return p.y + p.h * f; }
  function toyBox(name) {
    var t = TOYS[name || cur.toy], a = t.aspect, h = Math.min(board.h * (little ? LAYOUT.toyHLittle : LAYOUT.toyH) * (t.scale || 1), W * LAYOUT.toyW / a);
    return { x: W * LAYOUT.toyX, y: sy(LAYOUT.bench), w: h * a, h: h };
  }
  // the buddy's sitting picture stands on its own little shelf; the box's foot
  // sits a hair below the shelf, where the picture's transparent margin is
  function buddyBox() {
    var h = Math.min(board.h * LAYOUT.buddyH, W * 0.2, board.h * LAYOUT.plank - 4), b = $("windupBuddy"), badge = b && b.classList.contains("badge"), s = badge ? h * 0.78 : h;
    return { x: W * LAYOUT.buddyX - s / 2, y: sy(LAYOUT.plank) - s + (badge ? 0 : s * 0.05), w: s, h: s };
  }
  function meterAngle(f) { return Math.PI * (1 + clamp(f, 0, 1)); }
  function meterPoint(f, r) { var a = meterAngle(f); return { x: meter.cx + Math.cos(a) * r, y: meter.cy + Math.sin(a) * r }; }

  // ── drawing helpers ──
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function ell(x, y, rx, ry, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); ctx.fill(); }
  // a picture by its height, standing on (x, base); false if it isn't loaded
  function stand(name, x, base, h, img) {
    var i = img || image(name); if (!i) return false;
    var w = h * (i.width || i.naturalWidth) / (i.height || i.naturalHeight);
    ctx.drawImage(i, x - w / 2, base - h, w, h); return true;
  }
  function pulse() { return calm() ? 0.65 : 0.5 + 0.5 * Math.sin(clock * 5); }

  // the shop (stand-in), drawn on the painting's own frame: the honey plank
  // wall, the round window and the doorway (or the upper shelf), the bench
  function shopDrawn(k, p) {
    var a = p.a, g = ctx.createLinearGradient(0, 0, 0, H), back = py(p, a.back), edge = py(p, a.bench), lip = Math.max(6, p.h * 0.03), s;
    g.addColorStop(0, "#f2d9a6"); g.addColorStop(1, "#e3bb80"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(160,110,60,.18)"; for (s = p.x; s < W; s += p.w * 0.1) ctx.fillRect(s, 0, 2, back);
    if (k === "shop") {
      var w = a.window, wx = px(p, w.x), wy = py(p, w.y), r = p.w * w.r, d = a.door, dx0 = px(p, d.x0), dx1 = px(p, d.x1), dy0 = py(p, d.y0), dy1 = py(p, d.y1);
      ell(wx, wy, r + 6, r + 6, "#c98d4f"); ell(wx, wy, r, r, "#bfe3f2"); ctx.fillStyle = "#c98d4f"; ctx.fillRect(wx - 3, wy - r, 6, r * 2); ctx.fillRect(wx - r, wy - 3, r * 2, 6);
      ctx.fillStyle = "#c98d4f"; ctx.fillRect(dx0 - 6, dy0 - 6, dx1 - dx0 + 12, dy1 - dy0 + 6);
      ctx.fillStyle = "#bfe3f2"; ctx.fillRect(dx0, dy0, dx1 - dx0, (dy1 - dy0) * 0.55); ctx.fillStyle = "#e8d6a6"; ctx.fillRect(dx0, dy0 + (dy1 - dy0) * 0.55, dx1 - dx0, (dy1 - dy0) * 0.45);
    } else {
      var u = py(p, a.upper); ctx.fillStyle = "#c98d4f"; ctx.fillRect(0, u, W, lip * 1.4); ctx.fillStyle = "#8a5a34"; ctx.fillRect(0, u + lip * 1.4, W, 3);
    }
    // the bench (or the shelf): its top going back to the wall, its front edge, its front down to the floor
    ctx.fillStyle = "#e0b070"; ctx.fillRect(0, back, W, edge - back);
    ctx.fillStyle = "#b5813f"; ctx.fillRect(0, edge, W, lip);
    ctx.fillStyle = "#c98d4f"; ctx.fillRect(0, edge + lip, W, H - edge - lip);
    ctx.fillStyle = "rgba(110,69,38,.22)"; for (s = p.x; s < W; s += p.w * 0.1) ctx.fillRect(s, edge + lip, 2, H - edge - lip);
  }
  function background(k) {
    var p = bg[k], i = image(k);
    if (!i) shopDrawn(k, p);
    else if (p.y + p.h >= H) ctx.drawImage(i, p.x, p.y, p.w, p.h);
    else {
      // shorter than the screen: the picture down to its plain planks, those
      // planks stretched on down, then its own floor along the very bottom
      var a = p.a, nw = i.naturalWidth, nh = i.naturalHeight, b0 = a.band[0], b1 = a.band[1], foot = (1 - b1) * p.h, cut = p.y + b0 * p.h;
      ctx.drawImage(i, 0, 0, nw, b0 * nh, p.x, p.y, p.w, b0 * p.h);
      ctx.drawImage(i, 0, b0 * nh, nw, (b1 - b0) * nh, p.x, cut - 0.5, p.w, H - foot - cut + 1);
      ctx.drawImage(i, 0, b1 * nh, nw, (1 - b1) * nh, p.x, H - foot, p.w, foot);
    }
    // the parade: sunshine pours in through the doorway from the square
    if (k === "shop" && doorsOpen() > 0) { var d = p.a.door; ctx.fillStyle = "rgba(255,247,214," + (0.55 * doorsOpen()) + ")"; ctx.fillRect(px(p, d.x0), py(p, d.y0), px(p, d.x1) - px(p, d.x0), py(p, d.y1) - py(p, d.y0)); }
  }
  function doorsOpen() { if (doorsAt < 0) return 0; return calm() ? 1 : clamp((clock - doorsAt) / 0.6, 0, 1); }
  // The cuckoo clock on the wall, kept under the banner and smaller than half
  // the scene. The painting has the bird out: until the twist its two little
  // doors are drawn shut over it, and at the twist they swing open (under
  // Reduce Motion they are simply gone).
  function cuckooBox(k) {
    var p = bg[k], c = p.a.cuckoo, h = Math.min(p.h * c.h, board.h * 0.5), w = h * 280 / 397;
    return { x: px(p, c.x) - w / 2, y: Math.max(py(p, c.y), board.y + 4), w: w, h: h };
  }
  function cuckooClock(k) {
    var b = cuckooBox(k), h = b.h, x = b.x + b.w / 2, y = b.y, i = image("cuckoo");
    if (i) {
      var w = h * i.naturalWidth / i.naturalHeight, l = x - w / 2, shut = cuckoo ? (calm() ? 0 : 1 - clamp((clock - cuckooAt) / 0.35, 0, 1)) : 1;
      ctx.drawImage(i, l, y, w, h);
      if (shut > 0) {
        var hx = l + w * HATCH.x0, hw = w * (HATCH.x1 - HATCH.x0), hy = y + h * HATCH.y0, hh = h * (HATCH.y1 - HATCH.y0), leaf = hw / 2 * shut, lw = Math.max(1.2, w * 0.012);
        ctx.fillStyle = "#8a5530"; ctx.strokeStyle = "#5b3a20"; ctx.lineWidth = lw;
        rr(hx, hy, leaf, hh, Math.min(leaf, hh) * 0.25); ctx.fill(); ctx.stroke();
        rr(hx + hw - leaf, hy, leaf, hh, Math.min(leaf, hh) * 0.25); ctx.fill(); ctx.stroke();
        if (shut === 1) { ell(hx + hw * 0.42, hy + hh * 0.55, lw * 1.4, lw * 1.4, "#e2b84a"); ell(hx + hw * 0.58, hy + hh * 0.55, lw * 1.4, lw * 1.4, "#e2b84a"); }
      }
      return;
    }
    ctx.fillStyle = "#8a5a34"; ctx.beginPath(); ctx.moveTo(x - h * 0.34, y + h * 0.36); ctx.lineTo(x, y); ctx.lineTo(x + h * 0.34, y + h * 0.36); ctx.closePath(); ctx.fill();
    rr(x - h * 0.28, y + h * 0.3, h * 0.56, h * 0.62, 6); ctx.fill();
    ell(x, y + h * 0.62, h * 0.17, h * 0.17, "#f6e4bd");
    ctx.strokeStyle = "#5b3a20"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + h * 0.62); ctx.lineTo(x, y + h * 0.5); ctx.moveTo(x, y + h * 0.62); ctx.lineTo(x + h * 0.08, y + h * 0.64); ctx.stroke();
    ctx.fillStyle = "#5b3a20"; ctx.fillRect(x - h * 0.08, y + h * 0.33, h * 0.16, h * 0.14);
    if (cuckoo) {
      // the clay bird out on its spring
      var out = calm() ? 1 : clamp((clock - cuckooAt) / 0.25, 0, 1), bx = x, by = y + h * 0.4 - h * 0.22 * out;
      ctx.strokeStyle = "#c9a24a"; ctx.beginPath(); ctx.moveTo(x, y + h * 0.42); ctx.lineTo(bx, by); ctx.stroke();
      ell(bx, by, h * 0.13, h * 0.1, "#78bcc4"); ell(bx + h * 0.1, by - h * 0.02, h * 0.05, h * 0.03, "#f2c443"); ell(bx - h * 0.04, by - h * 0.03, 2, 2, "#3b2a1a");
    }
  }
  // Grandpa Bear, asleep in his rocking chair on the back of the bench, in
  // front of the round window
  // (sized by the painting, but never bigger than the toys on a short phone's small scene)
  function grandpaBox() {
    var p = bg.shop, g = p.a.grandpa, h = Math.min(p.h * g.h, board.h * 0.42), w = h * 360 / 461;
    return { x: px(p, g.x) - w / 2, y: py(p, g.y) - h, w: w, h: h };
  }
  function grandpa() {
    var b = grandpaBox(), h = b.h, x = b.x + b.w / 2, base = b.y + h;
    if (!stand("grandpa", x, base, h)) {
      // the rocking chair, a big brown bear in a mustard cardigan and a red nightcap
      ctx.strokeStyle = "#6e4526"; ctx.lineWidth = Math.max(2, h * 0.04); ctx.beginPath(); ctx.arc(x, base - h * 0.62, h * 0.7, Math.PI * 0.32, Math.PI * 0.68); ctx.stroke();
      rr(x - h * 0.38, base - h * 0.95, h * 0.1, h * 0.8, 4); ctx.fillStyle = "#8a5a34"; ctx.fill();
      ell(x, base - h * 0.4, h * 0.34, h * 0.36, "#d9a64a");
      ell(x, base - h * 0.78, h * 0.22, h * 0.2, "#8a5a34");
      ell(x - h * 0.15, base - h * 0.94, h * 0.07, h * 0.07, "#8a5a34"); ell(x + h * 0.15, base - h * 0.94, h * 0.07, h * 0.07, "#8a5a34");
      ell(x, base - h * 0.72, h * 0.09, h * 0.07, "#e6c6a0");
      ctx.fillStyle = "#c9473f"; ctx.beginPath(); ctx.moveTo(x - h * 0.2, base - h * 0.9); ctx.lineTo(x + h * 0.22, base - h * 0.9); ctx.lineTo(x + h * 0.34, base - h * 1.12); ctx.closePath(); ctx.fill();
      ell(x + h * 0.35, base - h * 1.12, h * 0.05, h * 0.05, "#fff6e9");
    }
    if (!won) sleepBubbles(x + h * 0.24, base - h * 0.9, h * 0.075, 1.3);
  }
  // round sleep bubbles drifting up (no letters); still under Reduce Motion
  function sleepBubbles(x, y, r, speed) {
    ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.fillStyle = "rgba(220,238,250,.55)"; ctx.lineWidth = 1.5;
    for (var n = 0; n < 3; n++) {
      var t = calm() ? n / 3 : ((clock * 0.45 * speed + n / 3) % 1), bx = x + n * r * 0.9 + Math.sin(t * 6 + n) * r * 0.3 * (calm() ? 0 : 1), by = y - t * r * 5, br = r * (0.55 + n * 0.25);
      ctx.globalAlpha = calm() ? 0.9 : 1 - t; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  // Echo on his spool of thread at the front of the bench: wooden ends, red
  // thread wound between
  function echoOnSpool() {
    var h = board.h * LAYOUT.echoH, sh = board.h * LAYOUT.spoolH, x = W * LAYOUT.echoX, base = sy(LAYOUT.bench), fw = h * 0.66, tw = h * 0.5, lip = Math.max(3, sh * 0.2), k;
    ell(x, base - 1, fw * 0.56, lip * 0.7, "rgba(70,45,25,.25)");
    var tg = ctx.createLinearGradient(x - tw / 2, 0, x + tw / 2, 0); tg.addColorStop(0, "#a8352f"); tg.addColorStop(0.42, "#e0625a"); tg.addColorStop(1, "#9c2f2a");
    ctx.fillStyle = tg; ctx.fillRect(x - tw / 2, base - sh + lip, tw, sh - lip * 2);
    ctx.strokeStyle = "rgba(255,225,215,.35)"; ctx.lineWidth = 1;
    for (k = 1; k < 5; k++) { var ty = base - sh + lip + (sh - lip * 2) * k / 5; ctx.beginPath(); ctx.moveTo(x - tw / 2, ty); ctx.lineTo(x + tw / 2, ty); ctx.stroke(); }
    ctx.fillStyle = "#e0b070"; ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 1.2;
    rr(x - fw / 2, base - sh, fw, lip, lip / 2); ctx.fill(); ctx.stroke(); rr(x - fw / 2, base - lip, fw, lip, lip / 2); ctx.fill(); ctx.stroke();
    var pose = clock < echoCheer ? "cheer" : "welcome";
    if (!stand(pose, x, base - sh + h * 0.04, h) && !stand("welcome", x, base - sh + h * 0.04, h)) {
      // a little teal bird, if even Echo's own picture won't load
      ell(x, base - sh - h * 0.38, h * 0.3, h * 0.36, "#4fb3b8"); ell(x, base - sh - h * 0.3, h * 0.18, h * 0.2, "#e9f6f2");
      ell(x - h * 0.1, base - sh - h * 0.55, h * 0.05, h * 0.05, "#2a2a2a"); ell(x + h * 0.1, base - sh - h * 0.55, h * 0.05, h * 0.05, "#2a2a2a");
      ctx.fillStyle = "#f2c443"; ctx.beginPath(); ctx.moveTo(x - h * 0.06, base - sh - h * 0.47); ctx.lineTo(x + h * 0.06, base - sh - h * 0.47); ctx.lineTo(x, base - sh - h * 0.38); ctx.closePath(); ctx.fill();
    }
  }
  // The buddy's little wall shelf, drawn: neither painting has a ledge that
  // stays under the banner on every phone. Only while a buddy sits on it.
  function plank() {
    var el = $("windupBuddy"); if (!el || el.hidden || !el.getAttribute("src")) return;
    var b = buddyBox(), y = sy(LAYOUT.plank), w = Math.max(b.w * 1.3, 40), x = b.x + b.w / 2 - w / 2, t = Math.max(5, b.h * 0.09);
    ctx.fillStyle = "rgba(70,45,25,.22)"; ctx.fillRect(x + 3, y + t, w - 6, 3);
    ctx.fillStyle = "#a8743f"; [0.2, 0.8].forEach(function (f) { ctx.beginPath(); ctx.moveTo(x + w * f - t * 0.5, y + t); ctx.lineTo(x + w * f + t * 0.5, y + t); ctx.lineTo(x + w * f, y + t * 2.8); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = "#d9a868"; ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 1.2; rr(x, y, w, t, 2); ctx.fill(); ctx.stroke();
  }

  // ── the toys ──
  // a toy's drawn stand-in, standing on (0,0), h tall, in its own colours
  function toyDrawn(name, h, open) {
    var t = TOYS[name], c = t.colors, w = h * t.aspect;
    ctx.save();
    if (name === "bunny") {
      ell(-w * 0.18, -h * 0.9, w * 0.08, h * 0.2, c[1]); ell(w * 0.12, -h * 0.92, w * 0.08, h * 0.2, c[1]);
      rr(-w * 0.32, -h * 0.55, w * 0.64, h * 0.55, w * 0.18); ctx.fillStyle = c[0]; ctx.fill();
      ell(0, -h * 0.66, w * 0.27, h * 0.17, c[1]); ell(-w * 0.09, -h * 0.68, 2.2, 2.2, "#3b2a1a"); ell(w * 0.09, -h * 0.68, 2.2, 2.2, "#3b2a1a");
      ell(0, -h * 0.2, w * 0.3, h * 0.15, c[2]); ell(0, -h * 0.24, w * 0.3, h * 0.08, "#fff1dc");
    } else if (name === "frog") {
      ell(0, -h * 0.4, w * 0.48, h * 0.38, c[0]); ell(-w * 0.24, -h * 0.76, w * 0.15, h * 0.15, c[0]); ell(w * 0.24, -h * 0.76, w * 0.15, h * 0.15, c[0]);
      ell(-w * 0.24, -h * 0.77, w * 0.09, h * 0.09, c[1]); ell(w * 0.24, -h * 0.77, w * 0.09, h * 0.09, c[1]); ell(-w * 0.24, -h * 0.77, 2.4, 2.4, "#3b2a1a"); ell(w * 0.24, -h * 0.77, 2.4, 2.4, "#3b2a1a");
      ctx.strokeStyle = c[2]; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, -h * 0.5, w * 0.2, 0.2, Math.PI - 0.2); ctx.stroke();
    } else if (name === "top") {
      ctx.fillStyle = c[0]; ctx.beginPath(); ctx.moveTo(-w * 0.48, -h * 0.62); ctx.lineTo(w * 0.48, -h * 0.62); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c[1]; ctx.beginPath(); ctx.moveTo(-w * 0.36, -h * 0.48); ctx.lineTo(w * 0.36, -h * 0.48); ctx.lineTo(w * 0.24, -h * 0.32); ctx.lineTo(-w * 0.24, -h * 0.32); ctx.closePath(); ctx.fill();
      ell(0, -h * 0.62, w * 0.48, h * 0.1, c[2]); ctx.fillStyle = "#8a5a34"; ctx.fillRect(-w * 0.06, -h * 0.92, w * 0.12, h * 0.3);
    } else if (name === "croc") {
      rr(-w * 0.46, -h * 0.5, w * 0.92, h * 0.4, h * 0.16); ctx.fillStyle = c[0]; ctx.fill();
      rr(w * 0.1, -h * 0.62, w * 0.4, h * 0.26, h * 0.1); ctx.fill();
      ctx.fillStyle = c[1]; for (var z = 0; z < 4; z++) { ctx.beginPath(); ctx.moveTo(w * (0.18 + z * 0.08), -h * 0.36); ctx.lineTo(w * (0.22 + z * 0.08), -h * 0.28); ctx.lineTo(w * (0.26 + z * 0.08), -h * 0.36); ctx.fill(); }
      ell(w * 0.2, -h * 0.66, w * 0.05, h * 0.07, c[1]); ell(w * 0.2, -h * 0.66, 2, 2, "#3b2a1a");
      ell(-w * 0.3, -h * 0.08, w * 0.08, h * 0.08, c[0]); ell(w * 0.2, -h * 0.08, w * 0.08, h * 0.08, c[0]);
    } else if (name === "elephant") {
      ell(-w * 0.05, -h * 0.4, w * 0.4, h * 0.34, c[0]); ell(w * 0.22, -h * 0.68, w * 0.2, h * 0.2, c[0]); ell(w * 0.08, -h * 0.66, w * 0.14, h * 0.2, "#a9b8cf");
      ctx.strokeStyle = c[0]; ctx.lineWidth = w * 0.09; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(w * 0.36, -h * 0.62); ctx.quadraticCurveTo(w * 0.52, -h * 0.4, w * 0.44, -h * 0.26); ctx.stroke();
      ell(w * 0.46, -h * 0.24, w * 0.07, h * 0.05, c[1]); ell(w * 0.27, -h * 0.72, 2.2, 2.2, "#3b2a1a");
      ctx.fillStyle = c[0]; ctx.fillRect(-w * 0.32, -h * 0.12, w * 0.14, h * 0.12); ctx.fillRect(w * 0.06, -h * 0.12, w * 0.14, h * 0.12);
    } else if (name === "jack") {
      rr(-w * 0.42, -h * 0.5, w * 0.84, h * 0.5, 5); ctx.fillStyle = c[0]; ctx.fill(); ctx.fillStyle = c[1]; ctx.fillRect(-w * 0.42, -h * 0.3, w * 0.84, h * 0.07);
      if (open) {
        ctx.strokeStyle = "#c9a24a"; ctx.lineWidth = 3; ctx.beginPath(); for (var s = 0; s < 6; s++) { ctx.lineTo(s % 2 ? w * 0.12 : -w * 0.12, -h * (0.5 + s * 0.06)); } ctx.stroke();
        ell(0, -h * 0.9, w * 0.26, h * 0.17, c[2]); ell(-w * 0.24, -h * 0.94, w * 0.08, h * 0.12, "#7a5230"); ell(w * 0.24, -h * 0.94, w * 0.08, h * 0.12, "#7a5230");
        ell(-w * 0.08, -h * 0.93, 2.2, 2.2, "#3b2a1a"); ell(w * 0.08, -h * 0.93, 2.2, 2.2, "#3b2a1a"); ell(0, -h * 0.86, w * 0.05, h * 0.03, "#3b2a1a");
        ctx.fillStyle = c[1]; ctx.save(); ctx.translate(-w * 0.42, -h * 0.5); ctx.rotate(-0.9); ctx.fillRect(0, -h * 0.06, w * 0.84, h * 0.06); ctx.restore();
      } else { ctx.fillStyle = c[1]; ctx.fillRect(-w * 0.46, -h * 0.56, w * 0.92, h * 0.08); }
    } else if (name === "hippo") {
      ell(0, -h * 0.42, w * 0.42, h * 0.32, c[0]); ell(w * 0.22, -h * 0.72, w * 0.22, h * 0.18, c[0]);
      ell(w * 0.2, -h * 0.66, w * 0.14, h * 0.08, "#c9a7e2"); ell(w * 0.14, -h * 0.8, 2.2, 2.2, "#3b2a1a"); ell(w * 0.28, -h * 0.8, 2.2, 2.2, "#3b2a1a");
      ctx.fillStyle = c[1]; ctx.beginPath(); for (var p = 0; p <= 8; p++) { ctx.lineTo(-w * 0.5 + w * p / 8, p % 2 ? -h * 0.22 : -h * 0.1); } ctx.lineTo(w * 0.5, -h * 0.34); ctx.lineTo(-w * 0.5, -h * 0.34); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c[0]; ctx.fillRect(-w * 0.22, -h * 0.1, w * 0.12, h * 0.1); ctx.fillRect(w * 0.1, -h * 0.1, w * 0.12, h * 0.1);
    } else {
      // the giant music box: a walnut box with brass trim; its crank is the dial's
      rr(-w * 0.48, -h * 0.62, w * 0.96, h * 0.62, 6); ctx.fillStyle = c[0]; ctx.fill();
      ctx.fillStyle = c[1]; ctx.fillRect(-w * 0.48, -h * 0.66, w * 0.96, h * 0.08); ctx.fillRect(-w * 0.48, -h * 0.08, w * 0.96, h * 0.05);
      ell(0, -h * 0.34, w * 0.14, h * 0.12, c[2]); ell(0, -h * 0.34, w * 0.06, h * 0.05, c[1]);
      ctx.strokeStyle = c[1]; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w * 0.48, -h * 0.32); ctx.lineTo(w * 0.6, -h * 0.32); ctx.stroke(); ell(w * 0.62, -h * 0.32, 5, 5, c[2]);
    }
    ctx.restore();
  }
  // The stand-in is drawn once into its own little canvas (and dimmed there
  // for a sleeping toy), then drawn like a painted picture: the same size,
  // the same place, the same moves. STAND_H: its height in that canvas.
  var STAND_H = 240, standIns = {};
  function standIn(name, open, sleepy) {
    var key = name + (open ? "+" : "") + (sleepy ? "z" : "");
    if (standIns[key]) return standIns[key];
    var c = document.createElement("canvas"), x = c.getContext("2d"), keep = ctx, a = TOYS[name].aspect;
    c.width = Math.ceil(STAND_H * a * 1.6); c.height = Math.ceil(STAND_H * 1.2);
    ctx = x; ctx.translate(c.width / 2, c.height); toyDrawn(name, STAND_H, open); ctx = keep;
    if (sleepy) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-atop"; x.fillStyle = "rgba(48,34,70,.32)"; x.fillRect(0, 0, c.width, c.height); }
    return (standIns[key] = c);
  }
  // One toy standing on (x, base), and on it the key in its back and the
  // nightcap, so both lean, hop and spin with it. o: tilt (radians), sleepy,
  // spin, dy (a hop), open (the jack-in-the-box), alpha, key (how far its key
  // is out: 0 is tucked in), cap
  function drawToy(name, x, base, h, o) {
    o = o || {};
    var t = TOYS[name], sp = (name === "jack" && o.open) ? t.open : t.sprite, i = image(sp), w = i ? h * i.naturalWidth / i.naturalHeight : h * t.aspect;
    ctx.save(); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; ctx.translate(x, base - (o.dy || 0)); ctx.rotate(o.tilt || 0);
    if (o.spin) { ctx.translate(0, -h / 2); ctx.rotate(o.spin); ctx.translate(0, h / 2); }
    if (i) ctx.drawImage(o.sleepy ? dimOf(sp) : i, -w / 2, -h, w, h);
    else { var c = standIn(name, name === "jack" && o.open, o.sleepy), k = h / STAND_H; ctx.drawImage(c, -c.width / 2 * k, -c.height * k, c.width * k, c.height * k); }
    if (o.key > 0 && t.key) toyKey(-w / 2 + t.key[0] * w, -h + t.key[1] * h, t.key[2], h * 0.2, keyAngle, o.key);
    if (o.cap && t.cap) capOn(-w / 2 + t.cap[0] * w, -h + t.cap[1] * h, h * t.cap[2]);
    ctx.restore();
  }
  // the striped nightcap on a sleeping toy's head: its brim's middle on (0,0)
  // after the move to (x, y), cw wide, the tip flopping to the right
  function capOn(x, y, cw) {
    var i = image("nightcap"), ch = cw * 165 / 240;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.12);
    if (i) ctx.drawImage(i, -cw * 0.36, -ch * 0.8, cw, ch);
    else {
      ctx.fillStyle = "#c9473f"; ctx.beginPath(); ctx.moveTo(-cw * 0.34, -ch * 0.15); ctx.quadraticCurveTo(-cw * 0.05, -ch * 0.95, cw * 0.5, -ch * 0.55); ctx.lineTo(cw * 0.34, -ch * 0.15); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff6e9"; ctx.fillRect(-cw * 0.38, -ch * 0.22, cw * 0.76, ch * 0.24); ell(cw * 0.52, -ch * 0.55, cw * 0.08, cw * 0.08, "#fff6e9");
    }
    ctx.restore();
  }
  // The key in a toy's back: the butterfly handle sticking out of (jx, jy),
  // len long, pointing right (dir 1), left (-1) or up (0). It turns as it
  // winds, and grows from nothing as it pops out.
  function toyKey(jx, jy, dir, len, a, out) {
    var i = image("key"), kw = len * 256 / 163, sq = Math.max(0.15, Math.abs(Math.cos(a)));
    ctx.save(); ctx.translate(jx, jy); ctx.rotate(dir * Math.PI / 2); ctx.scale(sq * out, out);
    if (i) ctx.drawImage(i, -kw / 2, -len, kw, len);
    else {
      ctx.fillStyle = "#b8862c"; ctx.fillRect(-len * 0.08, -len * 0.42, len * 0.16, len * 0.42);
      ell(-kw * 0.26, -len * 0.68, kw * 0.22, len * 0.3, "#d9b24f"); ell(kw * 0.26, -len * 0.68, kw * 0.22, len * 0.3, "#d9b24f"); ell(0, -len * 0.62, len * 0.13, len * 0.13, "#b8862c");
    }
    ctx.restore();
  }
  // where the toy is, how it leans and what it is doing right now
  function toyPose() {
    // (the nightcap stays on through a yawn or a dizzy spin: only waking takes it off)
    var b = toyBox(), o = { sleepy: !won && !(react && react.kind === "wake"), tilt: -0.22, dy: 0, spin: 0, open: false, x: b.x, base: b.y, h: b.h, alpha: 1, key: keyPop(), cap: !won };
    if (cur.crank) { o.sleepy = false; o.tilt = 0; o.cap = false; o.key = 0; }
    if (!react) return o;
    var t = clock - react.at, d = react.dur, k = clamp(t / d, 0, 1), still = calm();
    if (react.kind === "yawn") {
      // two sleepy steps, a yawn, and back down (a pose change under Reduce Motion)
      o.sleepy = false; o.tilt = still ? -0.08 : -0.22 + 0.22 * Math.sin(Math.PI * Math.min(1, k * 1.4));
      if (!still) { o.x += Math.sin(Math.PI * Math.min(1, k * 1.6)) * b.w * 0.12; o.dy = Math.abs(Math.sin(k * Math.PI * 4)) * b.h * 0.04 * (k < 0.6 ? 1 : 0); }
      if (k > 0.8) o.sleepy = true;
    } else if (react.kind === "dizzy") {
      o.sleepy = false; o.tilt = still ? 0.12 : 0; o.spin = still ? 0 : k * Math.PI * 4 * (1 - k * 0.3);
      if (k > 0.85) o.sleepy = true;
    } else if (react.kind === "wake") {
      o.sleepy = false; o.cap = false; o.tilt = 0; o.open = cur.toy === "jack";
      var tr = TOYS[cur.toy].trick;
      if (!still) {
        if (tr === "boing") o.spin = k * Math.PI * 2, o.dy = Math.sin(k * Math.PI) * b.h * 0.5;
        else if (tr === "spin" || tr === "twirl") o.spin = k * Math.PI * 4;
        else o.dy = Math.abs(Math.sin(k * Math.PI * 3)) * b.h * 0.12;
      } else if (tr === "boing") o.dy = b.h * 0.2;
    }
    return o;
  }
  function trickMarks(x, base, h) {
    // a trick, drawn: sparkles round the toy (and swirly eyes for a dizzy one)
    if (!react) return;
    var k = clamp((clock - react.at) / react.dur, 0, 1);
    if (react.kind === "dizzy" && k < 0.9) {
      ctx.save(); ctx.strokeStyle = "#7a5aa8"; ctx.lineWidth = 2;
      for (var n = 0; n < 3; n++) { var a = n * 2.1 + (calm() ? 0 : clock * 6); ctx.beginPath(); ctx.arc(x + Math.cos(a) * h * 0.3, base - h * 1.05 + Math.sin(a) * h * 0.06, h * 0.05, 0, Math.PI * 1.5); ctx.stroke(); }
      ctx.restore();
    } else if (react.kind === "yawn" && k > 0.25 && k < 0.85) {
      ell(x + h * 0.32, base - h * 0.95, h * 0.11, h * 0.08, "rgba(255,255,255,.85)"); ell(x + h * 0.32, base - h * 0.95, h * 0.05, h * 0.04, "#7a4a3a");
    }
  }
  function currentToy(kind) {
    if (left) {
      // the woken toy has marched off: the next one waits here, asleep, its
      // key tucked in (only if it stands in this part of the shop)
      var nx = round()[stage + 1];
      if (!nx || nx.at !== kind || nx.crank) return;
      var nb = toyBox(nx.toy);
      drawToy(nx.toy, nb.x, nb.y, nb.h, { sleepy: true, tilt: -0.22, cap: true });
      bubblesOver(nx.toy, nb.x, nb.y, nb.h);
      return;
    }
    var p = toyPose();
    drawToy(cur.toy, p.x, p.base, p.h, p);
    if (cur.crank && doorsAt >= 0) musicNotes(p.x, p.base - p.h * 0.7, p.h);
    if (p.sleepy && !cur.crank) bubblesOver(cur.toy, p.x, p.base, p.h);
    trickMarks(p.x, p.base, p.h);
  }
  // sleep bubbles drifting up from beside a toy's nightcap
  function bubblesOver(name, x, base, h) {
    var t = TOYS[name], w = h * t.aspect, c = t.cap || [0.5, 0, 0.3];
    sleepBubbles(x - w / 2 + c[0] * w + h * c[2] * 0.55, base - h + c[1] * h - h * 0.1, h * 0.055, 1);
  }
  // music notes rising from the open music box (drawn, never letters); still under Reduce Motion
  function musicNotes(x, y, h) {
    ctx.save(); ctx.fillStyle = "#6e4526"; ctx.strokeStyle = "#6e4526"; ctx.lineWidth = 2;
    for (var n = 0; n < 4; n++) {
      var t = calm() ? n / 4 : ((clock - doorsAt) * 0.6 + n / 4) % 1, nx = x - h * 0.3 + n * h * 0.22 + (calm() ? 0 : Math.sin(t * 6 + n) * h * 0.05), ny = y - t * h * 0.7, r = Math.max(3, h * 0.045);
      ctx.globalAlpha = calm() ? 0.9 : 1 - t;
      ctx.beginPath(); ctx.ellipse(nx, ny, r * 1.25, r, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(nx + r * 1.1, ny); ctx.lineTo(nx + r * 1.1, ny - r * 4); ctx.lineTo(nx + r * 2.4, ny - r * 3.2); ctx.stroke();
    }
    ctx.restore();
  }
  function keyPop() { if (!keyOut) return 0; if (calm()) return 1; var k = clamp((clock - keyAt) / 0.3, 0, 1); return k < 1 ? 0.3 + 0.9 * Math.sin(k * Math.PI * 0.75) : 1; }
  // A place in the parade line: two staggered rows on the back of the bench,
  // from the doorway leftwards, sized by the painting (the front row is
  // nearer, so a little bigger).
  function slot(n) {
    var p = bg.shop, l = p.a.line, row = n % 2, col = Math.floor(n / 2);
    return { x: px(p, l.x + l.dx * col + (row ? l.step : 0)), base: py(p, row ? l.front : l.back), h: p.h * l.h * (row ? 1.08 : 1), row: row };
  }
  function paradeLine() {
    var gone = marchOut >= 0 ? (calm() ? 1 : clamp((clock - marchOut) / 2.4, 0, 1)) : 0;
    // the back row first, so the front row stands in front of it
    var order = []; for (var i = 0; i < line.length; i++) if (!(i % 2)) order.push(i); for (i = 0; i < line.length; i++) if (i % 2) order.push(i);
    for (var o = 0; o < order.length; o++) {
      var n = order[o], s = slot(n), x = s.x, a = 1;
      if (gone > 0) { if (calm()) a = 1 - gone; else x += (gone * 1.4 - n * 0.06) > 0 ? (gone * 1.4 - n * 0.06) * W * 0.5 : 0; }
      if (x > W + 30 || a <= 0) continue;
      drawToy(line[n], x, s.base, s.h * (TOYS[line[n]].scale || 1), { alpha: a, open: line[n] === "jack", dy: gone > 0 && !calm() ? Math.abs(Math.sin(clock * 9 + n)) * s.h * 0.08 : 0 });
    }
  }
  // the woken toy marching along the bench to its place in the line (a shelf
  // toy marches off to the right to join it); a cut under Reduce Motion
  function marchingToy() {
    if (!marching) return;
    var k = clamp((clock - marching.at) / REACT.march, 0, 1), e = k * k * (3 - 2 * k), b = toyBox(marching.toy), s = slot(marching.slot), x, base, h;
    if (marching.up) { x = b.x + (W * 1.1 - b.x) * e; base = b.y; h = b.h; }
    else { x = b.x + (s.x - b.x) * e; base = b.y + (s.base - b.y) * e; h = b.h + (s.h * (TOYS[marching.toy].scale || 1) - b.h) * e; }
    drawToy(marching.toy, x, base, h, { open: marching.toy === "jack", dy: Math.abs(Math.sin(k * Math.PI * 4)) * h * 0.1 });
  }
  // the bunting that drops across the shop for the finale
  function flags() {
    if (!won) return;
    var k = calm() ? 1 : clamp((clock - won) / 0.7, 0, 1), y = board.y + 6 + board.h * 0.04 * k, cols = ["#c9473f", "#f2c443", "#3f6fc2", "#5aa55a", "#b494d0"];
    ctx.save(); ctx.globalAlpha = calm() ? 1 : k; ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(W / 2, y + 26, W, y); ctx.stroke();
    for (var n = 0; n < 9; n++) { var t = (n + 0.5) / 9, fx = W * t, fy = y + 26 * 2 * t * (1 - t) * 1.0; ctx.fillStyle = cols[n % cols.length]; ctx.beginPath(); ctx.moveTo(fx - 12, fy); ctx.lineTo(fx + 12, fy); ctx.lineTo(fx, fy + 22); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }

  // ── the meter: a rainbow arc, the gold star, the brass needle ──
  function star(x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); for (var k = 0; k < 10; k++) { var rad = k % 2 ? r * 0.45 : r, a = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } ctx.closePath(); ctx.fill(); }
  // the meter's drawn stand-in: a brass-rimmed rainbow half circle, red outside
  function gaugeDrawn() {
    var m = meter, cols = ["#e8726a", "#f0a35a", "#f2c443", "#7cc07a", "#5aa7d6", "#9a84cf"], s = m.band / cols.length, foot = m.gy + m.gh - m.cy;
    ctx.lineCap = "butt"; ctx.strokeStyle = "#b8862c"; ctx.lineWidth = m.band + 8; ctx.beginPath(); ctx.arc(m.cx, m.cy, m.rMid, Math.PI, Math.PI * 2); ctx.stroke();
    for (var n = 0; n < cols.length; n++) { ctx.strokeStyle = cols[n]; ctx.lineWidth = s + 0.6; ctx.beginPath(); ctx.arc(m.cx, m.cy, m.rOut - s * (n + 0.5), Math.PI, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = "#b8862c"; ctx.fillRect(m.cx - m.rOut - 4, m.cy, m.band + 8, foot); ctx.fillRect(m.cx + m.rIn - 4, m.cy, m.band + 8, foot);
  }
  function meterArt() {
    if (!meter) return;
    var m = meter, gi = image("gauge");
    ctx.save();
    if (gi) ctx.drawImage(gi, m.gx, m.gy, m.gw, m.gh); else gaugeDrawn();
    ctx.lineCap = "butt";
    if (!hasStar()) {
      // a little one's meter (and the music box's) only fills: the part still
      // to wind is shaded, and a star waits at the full end
      var f = needle();
      if (f < 1) { ctx.strokeStyle = "rgba(74,48,26,.58)"; ctx.lineWidth = m.band + 2; ctx.beginPath(); ctx.arc(m.cx, m.cy, m.rMid, meterAngle(f), Math.PI * 2 + 0.02); ctx.stroke(); }
      var e = meterPoint(0.93, m.rOut + m.star + 2); star(e.x, e.y, m.star, active && f > 0.8 ? "#ffcf4a" : "#e2b84a");
      ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 1.5; ctx.stroke();
    } else {
      // the gold star zone over the rainbow (ages 5-8), glowing while the key
      // catches there or the oil can is on, and its star outside the rim
      var lo = meterAngle(starLow() / topTurns()), hi = meterAngle(Math.min(1, starHigh() / topTurns())), glow = catchOn() && turns >= starLow();
      if (glow || power > 0) { ctx.shadowColor = "#ffe27a"; ctx.shadowBlur = 14 + 8 * pulse(); }
      ctx.fillStyle = glow ? "rgba(255,226,122,.88)" : "rgba(255,210,74,.66)";
      ctx.beginPath(); ctx.arc(m.cx, m.cy, m.rOut + 2, lo, hi); ctx.arc(m.cx, m.cy, m.rIn - 2, hi, lo, true); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = "#a8742a"; ctx.lineWidth = 2.5; ctx.stroke();
      var c = meterPoint(cur.need / topTurns(), m.rOut + m.star + 2); star(c.x, c.y, m.star, "#ffcf4a");
      ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // the brass needle, pivoting at the arc's centre
    var a = meterAngle(needle()), dx = Math.cos(a), dy = Math.sin(a), len = m.rOut - 3, wd = Math.max(3, m.band * 0.17), gold = catchOn() && turns >= starLow();
    ctx.fillStyle = gold ? "#ffcf4a" : "#6e4526"; if (gold) { ctx.shadowColor = "#ffe27a"; ctx.shadowBlur = 14; }
    ctx.beginPath(); ctx.moveTo(m.cx + dx * len, m.cy + dy * len); ctx.lineTo(m.cx - dy * wd, m.cy + dx * wd); ctx.lineTo(m.cx - dx * wd * 1.8, m.cy - dy * wd * 1.8); ctx.lineTo(m.cx + dy * wd, m.cy - dx * wd); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = "#3b2a1a"; ctx.lineWidth = 1.2; ctx.stroke();
    ell(m.cx, m.cy, wd * 1.7, wd * 1.7, "#b8862c"); ell(m.cx, m.cy, wd * 0.9, wd * 0.9, "#f2d27a");
    ctx.restore();
  }

  // ── the dial: the brass disc, its arrows, the key's handle (or the crank) ──
  function arrowArc(r, a0, a1, color, width) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(dial.x, dial.y, r, a0, a1); ctx.stroke();
    var hx = dial.x + Math.cos(a1) * r, hy = dial.y + Math.sin(a1) * r, tx = -Math.sin(a1), ty = Math.cos(a1), nx = Math.cos(a1), ny = Math.sin(a1), s = width * 2.2;
    ctx.beginPath(); ctx.moveTo(hx + tx * s * 1.3, hy + ty * s * 1.3); ctx.lineTo(hx - nx * s, hy - ny * s); ctx.lineTo(hx + nx * s, hy + ny * s); ctx.closePath(); ctx.fill();
  }
  function dialArt() {
    var R = dial.r, on = keyOut && !won, lv = active ? circleLevel() : 0;
    ctx.save(); ctx.translate(dial.x, dial.y); ctx.rotate(dialAngle);
    var di = image("dial");
    if (di) ctx.drawImage(di, -R, -R, R * 2, R * 2);
    else {
      var g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R); g.addColorStop(0, "#f7dd8a"); g.addColorStop(0.7, "#d3a54a"); g.addColorStop(1, "#9c7228");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8a6420"; ctx.lineWidth = Math.max(2, R * 0.03); for (var k = 0; k < 36; k++) { var a = k * Math.PI / 18; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke(); }
      ctx.strokeStyle = "rgba(255,244,200,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2); ctx.stroke();
    }
    if (!di) { ell(0, 0, R * 0.15, R * 0.15, "#8a6420"); ell(0, 0, R * 0.08, R * 0.08, "#f2d27a"); }
    // the key's butterfly handle out on the rim (huge for a little one), or
    // the music box's crank arm from the middle, its red knob near the rim
    if (on || cur.crank) {
      if (cur.crank) {
        var ci = image("crank"), cw = R * 1.04, chh = cw * 126 / 400;
        if (ci) { ctx.save(); ctx.rotate(-Math.PI / 2); ctx.drawImage(ci, -0.08 * cw, -0.66 * chh, cw, chh); ctx.restore(); }
        else { ctx.strokeStyle = "#6e4526"; ctx.lineWidth = R * 0.12; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -R * 0.82); ctx.stroke(); ell(0, -R * 0.86, R * 0.14, R * 0.14, "#c9473f"); }
      } else {
        var out = keyPop(), ki = image("key"), kw = R * (little ? 0.84 : 0.64), kh = kw * 163 / 256, j = R * (little ? 0.4 : 0.5);
        ctx.save(); ctx.translate(0, -j); ctx.scale(out, out);
        if (ki) ctx.drawImage(ki, -kw / 2, -kh, kw, kh);
        else { ctx.fillStyle = "#b8862c"; ctx.fillRect(-kh * 0.08, -kh * 0.42, kh * 0.16, kh * 0.42); ell(-kw * 0.26, -kh * 0.68, kw * 0.22, kh * 0.3, "#e3bd59"); ell(kw * 0.26, -kh * 0.68, kw * 0.22, kh * 0.3, "#e3bd59"); ell(0, -kh * 0.62, kh * 0.13, kh * 0.13, "#b8862c"); }
        ctx.restore();
      }
    }
    ctx.restore();
    if (!on && !(won && cur.crank)) { ctx.fillStyle = "rgba(60,38,20,.38)"; ctx.beginPath(); ctx.arc(dial.x, dial.y, R + 1, 0, Math.PI * 2); ctx.fill(); }
    // curved arrows round the dial (brighter, with a dot to follow, from the first rung)
    if (on) {
      ctx.save();
      var bright = lv >= 1, col = bright ? "#2f8f94" : "rgba(47,143,148,.75)", w = Math.max(4, R * (bright ? 0.07 : 0.05)), rr0 = R * 1.14;
      if (bright) { ctx.shadowColor = "rgba(255,250,225,.95)"; ctx.shadowBlur = 10; }
      for (var n = 0; n < 3; n++) { var s0 = -Math.PI / 2 + n * Math.PI * 2 / 3 + 0.25; arrowArc(rr0, s0, s0 + 1.35, col, w); }
      ctx.restore();
      if (bright) {
        var t = calm() ? Math.floor(clock * 2) / 4 : clock * 0.55, da = -Math.PI / 2 + t * Math.PI * 2, dr = R * 0.84;
        ell(dial.x + Math.cos(da) * dr, dial.y + Math.sin(da) * dr, R * 0.09, R * 0.09, "#fff6e9");
        ell(dial.x + Math.cos(da) * dr, dial.y + Math.sin(da) * dr, R * 0.06, R * 0.06, "#2f8f94");
      }
    }
    // the oil can's squirt on the key
    if (react && react.kind === "oil") {
      var k2 = clamp((clock - react.at) / react.dur, 0, 1), ox = dial.x + R * 0.62, oy = dial.y - R * 1.02;
      if (!stand("oilcan", ox + R * 0.2, oy + R * 0.18, R * 0.42)) { ctx.fillStyle = "#c9473f"; rr(ox, oy - R * 0.2, R * 0.3, R * 0.24, 5); ctx.fill(); ctx.strokeStyle = "#c9a24a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ox, oy - R * 0.1); ctx.lineTo(ox - R * 0.2, oy - R * 0.02); ctx.stroke(); }
      for (var q = 0; q < 3; q++) { var dk = calm() ? 0.5 : (k2 * 2 + q * 0.3) % 1; ell(ox - R * 0.22 - dk * R * 0.1, oy + dk * R * 0.18, 3, 4, "rgba(201,162,74," + (1 - dk) + ")"); }
    }
  }
  function sparkArt() {
    sparks.forEach(function (s) {
      var t = s.age / s.life; if (t >= 1) return;
      ctx.save(); ctx.globalAlpha = 1 - t; ctx.translate(s.x, s.y); star(0, 0, s.r, s.c); ctx.restore();
    });
  }
  function burst(x, y) {
    var cols = ["#ffe27a", "#78bcc4", "#f6b8cf", "#fff6e9"];
    for (var n = 0; n < 14; n++) { var a = n / 14 * Math.PI * 2, v = calm() ? 0 : 90; sparks.push({ x: x + Math.cos(a) * (calm() ? 40 : 0), y: y + Math.sin(a) * (calm() ? 40 : 0), vx: Math.cos(a) * v, vy: Math.sin(a) * v - (calm() ? 0 : 40), r: 5 + (n % 3) * 2, c: cols[n % 4], age: 0, life: 0.9 }); }
  }
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    var pk = panK(), from = pan ? pan.from : scene, to = scene;
    // the move up to the top shelf (or back down): the view slides as one, a cut under Reduce Motion
    if (pan && pk < 1) {
      var dir = to === "shelf" ? 1 : -1;
      ctx.save(); ctx.translate(0, dir * pk * H); sceneArt(from, true); ctx.restore();
      ctx.save(); ctx.translate(0, -dir * (1 - pk) * H); sceneArt(to, false); ctx.restore();
    } else sceneArt(scene, false);
    plank(); flags();
    meterArt(); dialArt(); sparkArt();
  }
  function panK() { if (!pan) return 1; return calm() ? 1 : clamp((clock - pan.at) / 0.6, 0, 1); }
  // one view of the shop: "bench" (the workbench, the shop painting) or "shelf" (up close on the top shelf)
  function sceneArt(kind, leaving) {
    var k = kind === "shelf" ? "shelf" : "shop";
    background(k); cuckooClock(k);
    if (k === "shop") { grandpa(); paradeLine(); }
    echoOnSpool();
    if (!leaving) { currentToy(kind); marchingToy(); }
  }

  // ── the finger ──
  function point(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function rel(p) { var dx = p.x - dial.x, dy = p.y - dial.y; return { d: Math.sqrt(dx * dx + dy * dy), a: Math.atan2(dy, dx) }; }
  function inRing(p) { var q = rel(p); return q.d >= dial.r * 0.15 && q.d <= dial.r * 1.4; }
  function onDial(p) { return rel(p).d <= dial.r * 1.4; }
  function wrap(d) { while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
  // One finger owns the dial. A finger circling it keeps it, but a touch
  // that has not moved for 0.3 s gives way to a new one (22 Oct 2026: a
  // resting thumb or a grown-up's pointing finger, down first anywhere on
  // the shop, used to own the dial for as long as it stayed down, and the
  // child's circles did nothing). Giving way is no try: that touch never
  // let go. A finger also takes over from the arrow keys.
  function down(e) {
    if (!canPlay() || reacting() || (e.button !== undefined && e.button !== 0)) return;
    if (owner !== null) {
      if (e.pointerId === owner || clock - ownerMoved < 0.3) return;
      detach();
    }
    e.preventDefault();
    keyHeld = false;
    owner = e.pointerId; surface = e.currentTarget; held = true; ownerMoved = -9;
    var p = point(e); prev = p; downAt = p; prevA = inRing(p) ? rel(p).a : null; sweep = 0; origin = 0; credit = 0;
    try { surface.setPointerCapture(owner); } catch (err) {}
    hud();
  }
  function move(e) {
    if (e.pointerId !== owner || !canPlay() || reacting()) return;
    e.preventDefault();
    var p = point(e), dx = p.x - prev.x, dy = p.y - prev.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.5) return;
    lastWork = clock; ownerMoved = clock;
    windBy(prev, p, d);
    prev = p; hud(); draw();
  }
  function release(e) {
    if (e.pointerId !== owner) return;
    e.preventDefault();
    var lifted = e.type === "pointerup" && canPlay() && !reacting();
    detach();
    if (lifted) letGo();
    hud(); draw();
  }
  function detach() { var id = owner, s = surface; owner = null; surface = null; held = false; prev = null; prevA = null; downAt = null; if (id !== null && s) { try { if (s.hasPointerCapture(id)) s.releasePointerCapture(id); } catch (e) {} } }
  // How far one bit of finger travel winds, in turns (see the top of the file).
  function windBy(a, b, d) {
    var lv = circleLevel(), turn = 0, rubbed = 0;
    // a little one's last rung: one real drag (the finger away from where it
    // landed, so a wiggle in place is not one) fills the meter
    if (little && lv >= 3 && downAt && Math.sqrt(Math.pow(b.x - downAt.x, 2) + Math.pow(b.y - downAt.y, 2)) > 30) { add(Math.max(0, cur.need - turns) + 0.001, true); return; }
    // circling: new ground round the dial's centre
    if (inRing(b)) {
      var ab = rel(b).a;
      if (prevA !== null && inRing(a)) {
        var da = wrap(ab - prevA);
        if (Math.abs(da) <= MAX_STEP) {
          sweep += da; dialAngle += da;
          var far = Math.abs(sweep - origin);
          if (far > credit) { turn = (far - credit) / (Math.PI * 2); credit = far; }
          else if (credit - far > REVERSE) { origin = sweep; credit = 0; }   // a real turn the other way: count from here
        }
      }
      prevA = ab;
    } else prevA = null;   // off the dial: its place on it is let go, nothing is lost
    // the finger's path, where the help (or a little one's dial) lets it wind:
    // any drag anywhere from the last rung, rubbing on the dial from the one
    // before (ages 3-4 always). A dial's round is one turn of path.
    if (lv >= 3 || ((little || lv >= 2) && onDial(a) && onDial(b))) rubbed = d / (Math.PI * 2 * dial.r);
    if (rubbed > turn && !inRing(b)) dialAngle += rubbed * Math.PI * 2;
    add(Math.max(turn, rubbed) * gain(), false);
  }
  // wind by an amount (in turns): the needle moves, every quarter clicks
  function add(amount, whole) {
    if (!(amount > 0)) return;
    var before = turns;
    sweepTurns += amount; keyAngle += amount * Math.PI * 2;
    turns = Math.min(topTurns(), turns + amount);
    if (catchOn()) turns = Math.min(turns, Math.max(before, cur.need));
    var q = Math.floor(sweepTurns * 4 + 1e-9);
    if (q > quarters) { quarters = q; lastGain = clock; clicks++; api.sfx("click"); if (clicks === 1 && !cur.crank) banner(SAY.click); }
    if (whole) lastGain = clock;
    if ((little || cur.crank) && turns >= cur.need - 1e-9) { turns = cur.need; if (cur.crank) crankDone(); else wake(); }
  }
  // the finger lifts: the try (ages 5-8 only; a little one's toy wakes when full)
  function letGo() {
    if (!active || !hasStar()) return;
    if (turns < tryAt()) { if (turns <= 0) banner(hint()); return; }   // a hand moving, never a try
    tries++;
    if (misses >= 3 || (turns >= starLow() - 1e-9 && turns <= starHigh() + 1e-9)) { lastTry = "right"; turns = Math.min(Math.max(turns, starLow()), starHigh()); if (misses >= 3) turns = cur.need; wake(); return; }
    if (turns < starLow()) { lastTry = "little"; misses++; startReact("yawn"); api.sfx("yawn"); banner(SAY.little); }
    else { lastTry = "dizzy"; misses++; turns = Math.max(tryAt(), starLow() - 0.05); startReact("dizzy"); api.sfx("whirr"); banner(SAY.dizzy); }
  }
  function startReact(kind) { react = { kind: kind, at: clock, dur: REACT[kind] }; }
  function cheerBuddy() {
    var b = $("windupBuddy");
    if (!b) return;
    if (!calm()) { b.classList.remove("hop"); void b.offsetWidth; b.classList.add("hop"); }
    if (buddy) { b.src = buddy.cheer; clearTimeout(buddyT); buddyT = setTimeout(function () { if (buddy) b.src = buddy.rest; }, 900); }
  }
  // just right: the toy's own trick, then down the ramp into the line; the
  // step counts BEAT later, on this file's clock
  function wake() {
    if (doneAt) return;
    active = false; detach(); keyHeld = false;
    startReact("wake"); echoCheer = clock + 0.9;
    try { api.face("cheer"); } catch (e) {}
    cheerBuddy();
    var b = toyBox(); burst(b.x, b.y - b.h * 0.6);
    banner(little ? SAY.ring : SAY.right);
    if (little) { api.sfx("ding"); later(0.25, function () { api.sfx(TOYS[cur.toy].trick); }); }
    else api.sfx(TOYS[cur.toy].trick);
    woke = cur.toy; keyOut = false;
    var up = cur.at === "shelf";
    later(REACT.wake, function () { react = null; left = true; if (calm()) endMarch(); else marching = { toy: woke, at: clock, slot: line.length, up: up }; });
    later(REACT.wake + REACT.march, endMarch);
    doneAt = clock + BEAT;
    hud();
  }
  // the music box: the tune plays, the doors swing open, the parade sets off
  function crankDone() {
    if (doneAt) return;
    active = false; detach(); keyHeld = false;
    echoCheer = clock + 1.2; try { api.face("cheer"); } catch (e) {}
    cheerBuddy(); api.sfx("tune");
    var b = toyBox(); burst(b.x, b.y - b.h * 0.7);
    banner(SAY.music);
    doorsAt = clock; marchOut = clock + 0.4;
    doneAt = clock + BEAT;
    hud();
  }
  function endMarch() { if (woke) line.push(woke); woke = null; marching = null; }
  function later(t, fn) { pending.push({ at: clock + t, fn: fn }); }
  // Echo's directions and the help pill
  function hearStep() { if (canPlay() && !held && !reacting()) api.instruct(stepLine()); }
  function askHelp() { if (!canPlay() || held || keyHeld || reacting() || power > 0) return; if (api.practice()) banner(SAY.oil); }
  // ── the keyboard: the arrow keys wind (an eighth of a turn a press), Space lets go ──
  function dialKey(e) {
    if (!canPlay() || owner !== null || reacting()) return;
    var k = e.key;
    if (k === "ArrowRight" || k === "ArrowLeft" || k === "ArrowUp" || k === "ArrowDown") {
      e.preventDefault(); keyHeld = true; lastWork = clock;
      var dir = (k === "ArrowRight" || k === "ArrowDown") ? 1 : -1; dialAngle += dir * Math.PI / 4;
      add(0.125 * gain(), false); hud(); draw(); return;
    }
    if (k === " " || k === "Enter") { e.preventDefault(); if (e.repeat) return; if (keyHeld) { keyHeld = false; letGo(); } hud(); draw(); return; }
    if (k === "Escape") { e.preventDefault(); keyHeld = false; hud(); }
  }
  function controls() {
    cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move);
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (n) { cv.addEventListener(n, release); });
    $("windupDial").addEventListener("keydown", dialKey);
    $("windupDial").addEventListener("keyup", function (e) { if (e.key === " " || e.key === "Enter") e.preventDefault(); });
    $("windupHelp").onclick = askHelp; $("windupHearStep").onclick = hearStep;
    window.addEventListener("resize", fit);
    // losing focus drops a key hold too (it locked out the Oil can until a
    // Space on the dial), as Light the Way and Puzzle Bridge do; never a try
    window.addEventListener("blur", function () { detach(); keyHeld = false; hud(); });
    $("windupDial").addEventListener("blur", function () { if (keyHeld) { keyHeld = false; hud(); } });
    document.addEventListener("visibilitychange", function () { if (document.hidden) { detach(); keyHeld = false; hud(); } });
    window.addEventListener("pagehide", function () { away = true; detach(); cancelAnimationFrame(raf); raf = 0; });
    window.addEventListener("pageshow", function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
  }

  // ── the clock ──
  function tick(dt) {
    if (live()) {
      clock += dt;
      for (var s = sparks.length - 1; s >= 0; s--) { var k = sparks[s]; k.age += dt; k.x += k.vx * dt; k.y += k.vy * dt; k.vy += 120 * dt; if (k.age >= k.life) sparks.splice(s, 1); }
      for (var n = 0; n < pending.length; n++) { if (clock >= pending[n].at) { var job = pending.splice(n, 1)[0]; n--; job.fn(); } }
      if (react && react.kind !== "wake" && clock - react.at >= react.dur) { var was = react.kind; react = null; afterReact(was); }
      if (pan && panK() >= 1) pan = null;
    }
    beat();
    if (!canPlay()) return;
    power = Math.max(0, power - dt);
    // effort: seconds of a finger moving that have not finished a quarter turn (never waiting)
    if ((held || keyHeld) && !reacting() && clock - lastWork < 0.3 && clock - lastGain > 0.4) effort += dt;
    var lv = circleLevel();
    if (lv > shownCircle) { shownCircle = lv; banner(lv === 1 ? SAY.dot : lv === 2 ? (little ? SAY.rubLittle : SAY.rub) : (little ? SAY.dragLittle : SAY.drag)); }
    hud();
  }
  // after a yawn or a spin, the banner says what helps now
  function afterReact(kind) {
    if (kind === "oil") return;
    if (misses >= 2) banner(hint());
  }
  // what the banner says when nothing is happening: the help that is on now,
  // else what this toy wants
  function hint() {
    var lv = circleLevel();
    if (hasStar() && misses >= 3) return SAY.anyGo;
    if (hasStar() && misses >= 2) return SAY.glow;
    if (lv >= 3) return little ? SAY.dragLittle : SAY.drag;
    if (lv >= 2) return little ? SAY.rubLittle : SAY.rub;
    if (lv >= 1) return SAY.dot;
    return label();
  }
  function beat() { if (doneAt && live() && clock >= doneAt) { doneAt = 0; dones++; hud(); if (api) api.done(); } }
  function frame(now) { var dt = last ? Math.min(0.045, (now - last) / 1000) : 0; last = now; tick(dt); draw(); raf = requestAnimationFrame(frame); }

  // ── what the page shows beside the canvas, and what the tests read ──
  function placeBuddy() {
    var b = $("windupBuddy"); if (!b) return;
    var bb = buddyBox(); b.style.left = bb.x + "px"; b.style.top = bb.y + "px"; b.style.width = bb.w + "px"; b.style.height = bb.h + "px";
  }
  function hud() {
    if (!cv) return;
    var ok = canPlay() && !held && !reacting();
    $("windupHelp").disabled = !ok || power > 0 || keyHeld;
    $("windupHearStep").disabled = !ok;
    $("windupPower").hidden = power <= 0; $("windupPowerFill").style.width = (power / POWER * 100) + "%";
    var d = $("windupDial"), s = Math.max(64, dial.r * 2);
    // aria-disabled, not disabled, so a keyboard keeps its place on the dial between toys
    d.style.left = dial.x + "px"; d.style.top = dial.y + "px"; d.style.width = s + "px"; d.style.height = s + "px"; d.setAttribute("aria-disabled", canPlay() ? "false" : "true");
    placeBuddy();
    snapshot();
  }
  function snapshot() {
    var b = toyBox(), bb = buddyBox(), st = hasStar() ? { low: starLow(), high: starHigh(), lowF: starLow() / topTurns(), highF: Math.min(1, starHigh() / topTurns()), half: starHalf() } : null, p = toyPose();
    window.__windup = {
      stage: stage, steps: steps, toy: cur.toy, mode: cur.crank ? "crank" : little ? "fill" : "wind", scene: scene, pan: pan ? panK() : 1, little: little,
      active: active, paused: paused, won: !!won, held: held, keyHeld: keyHeld, keyOut: keyOut,
      turns: turns, need: cur.need, top: topTurns(), needle: needle(), star: st, tryAt: tryAt(), catchOn: catchOn(), gain: gain(),
      quarters: quarters, clicks: clicks, tries: tries, lastTry: lastTry, react: react ? react.kind : null, spin: p.spin || 0, tilt: p.tilt || 0,
      ladder: { misses: misses, effort: effort, circle: circleLevel(), miss: missLevel(), little: little },
      power: power, beat: doneAt > 0, dones: dones, line: line.slice(), cuckoo: cuckoo, doors: doorsOpen(),
      artReady: settled >= SPRITES.length, art: { loaded: SPRITES.filter(function (n) { return !!image(n); }), failed: SPRITES.filter(function (n) { return art[n] && art[n].failed; }) },
      banner: $("windupBanner").textContent, banners: banners.slice(),
      dial: { x: dial.x, y: dial.y, r: dial.r }, meter: meter ? { cx: meter.cx, cy: meter.cy, top: meter.top, bottom: meter.bottom, w: meter.gw, rOut: meter.rOut, rIn: meter.rIn } : null,
      toyBox: { x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h }, buddyBox: bb, board: { y: board.y, h: board.h }, width: W, height: H,
      // where the painted shop puts things (the fit checks): the bench's back and front edge, the parade line's seven places
      shop: { back: py(bg.shop, ART.shop.back), edge: sy(LAYOUT.bench), cuckoo: cuckooBox(scene === "shelf" ? "shelf" : "shop"), grandpa: grandpaBox(), plank: sy(LAYOUT.plank),
        line: [0, 1, 2, 3, 4, 5, 6].map(function (n) { var s = slot(n); return { x: s.x, base: s.base, h: s.h }; }) }
    };
  }

  // ── what the engine calls ──
  function twist() {
    // the cuckoo clock pops open, and the view goes up to the top shelf
    cuckoo = true; cuckooAt = clock; api.sfx("cuckoo");
  }
  function goTo(where) { if (where === scene) return; pan = { from: scene, at: clock }; scene = where; if (calm()) pan = null; }
  function reset() {
    detach(); keyHeld = false; pending = []; react = null; marching = null; woke = null; left = false; sparks = [];
    active = false; paused = false; won = false; keyOut = false; stage = 0; cur = round()[0];
    turns = 0; sweepTurns = 0; quarters = 0; clicks = 0; tries = 0; lastTry = "none"; misses = 0; effort = 0; shownCircle = 0;
    power = 0; doneAt = 0; dones = 0; line = []; scene = "bench"; pan = null; cuckoo = false; doorsAt = -9; marchOut = -9;
    banner(SAY.start); hud(); draw();
  }
  window.Windup = {
    init: function (a, n) {
      api = a; steps = n || (little ? 6 : 8); cv = $("windupCanvas"); ctx = cv.getContext("2d");
      loadArt(); controls(); fit(); reset(); raf = requestAnimationFrame(frame);
    },
    onWord: function (index) {
      detach(); keyHeld = false; pending = []; react = null; endMarch(); left = false;
      stage = clamp(index, 0, round().length - 1); cur = round()[stage];
      turns = 0; sweepTurns = 0; quarters = 0; clicks = 0; misses = 0; effort = 0; shownCircle = 0; lastTry = "none"; lastWork = -9; lastGain = clock;
      power = 0; doneAt = 0; paused = false; last = 0;
      if (!little && stage === TWIST) twist();
      goTo(cur.at);
      // the key pops out with a ding, and the dial lights up
      keyOut = true; keyAt = clock; later(0.3, function () { api.sfx("ding"); });
      active = true; banner(label());
      api.instruct(stepLine());
      hud(); draw();
    },
    // the oil can: the same toy, with a little squirt and ten seconds of easy winding
    onHelp: function () { power = POWER; paused = false; last = 0; active = true; react = { kind: "oil", at: clock, dur: REACT.oil }; api.sfx("squirt"); banner(SAY.oiled); hud(); },
    pause: function () { paused = true; last = 0; detach(); keyHeld = false; hud(); },
    // back from a pause or an unanswered help ask: the same toy, wound as it was
    resume: function (playing) { paused = playing === false; last = 0; if (!paused && active && !reacting()) banner(hint()); hud(); },
    reset: reset,
    finale: function () { detach(); active = false; power = 0; won = clock || 0.001; doneAt = 0; banner(SAY.parade); hud(); draw(); },
    setLittle: function (on) { little = !!on; cur = round()[0]; if (cv) { fit(); } },
    // the buddy's own sitting and cheering pictures, from the page (paths only)
    setBuddy: function (p) { buddy = (p && typeof p.rest === "string" && typeof p.cheer === "string") ? { rest: p.rest, cheer: p.cheer } : null; },
    // every line a child can read or hear from this file, for the tests
    SAY: SAY, LINES: { big: STEP_LINES, little: LITTLE_LINES, toys: Object.keys(TOYS).map(function (k) { return TOYS[k].label; }) }
  };
})();
