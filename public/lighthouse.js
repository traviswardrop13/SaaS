/* Light the Way: Day 1 of the daily story (STORY1, 22 Oct 2026; the build
   spec's section 1.2). Captain Wally sneezed the lighthouse lamp out, fog
   rolled in, and seven little boats are lost on the dark sea: the child
   becomes the light.

   The word (said two times) lights the lamp; the finger moves the pool of
   light over the night sea and holds it on the lost boat. SayPlay owns the
   word, the microphone, Echo's voice, "Go!", the reps and every card; this
   file owns only the play: one canvas, the finger, and api.done() once a
   step. It never calls logAttempt, bumpReps, gameRep, addCoins, a sticker or
   storage: nothing here is practice data.

   What it keeps (the rules every played game keeps):
   - The word earns each step, the finger makes it. Before the word the lamp
     is dark and a drag lights nothing; after it, a boat is found only while a
     finger (or the keyboard) holds the light on it. Waiting finds nothing.
     The light sits above a fingertip, so a finger put ON the boat (what a
     child does) must find it too: under a finger the find zone runs from the
     middle of the light down to the fingertip.
   - The step counts BEAT seconds after the find, on a clock that runs only
     while the game is live, so the toot and the cheer are heard first.
   - Every round ends with all the boats home, with no more speaking: the
     help ladder climbs with seconds of a finger down on the sea, moving or
     held still (never waiting), a tap counting at least half a second, and
     with each decoy lit, and resets with each new word. No help ever finds a
     boat by itself.
   - Ages 3-4 play the same sea, easier: six words, a big pool, no drift, no
     decoys, no twist, a lantern that glows from the start; the light lands
     under the finger with no glide, and a find under way finishes a moment
     after the finger lifts, so a tap on the boat finds it.
   - Every painted picture has a drawn stand-in; under Reduce Motion nothing
     slides or spins (the boats hold still, a found boat fades to the dock,
     the teacup and the cloud cut in). */
(function () {
  "use strict";
  // ── Echo's directions, one a step, spoken through api.instruct (the
  // engine's voice, only in play). Ages 5-8, then ages 3-4. Rachel reads
  // every line (no sound named, nothing about how to talk).
  var STEP_LINES = [
    "Move the light over the fog. Find the tugboat!",
    "Find the rowboat with the three mice!",
    "The sailboat is drifting. Find it with the light!",
    "Find the banana boat! Something big is napping out there.",
    "Uh oh, the moon went behind a cloud. Look by the big rocks for the teacup boat!",
    "Find the bathtub boat. Rub-a-dub!",
    "Find the big ferry and bring everyone home!",
    "Now shine the light on the town. Light up every window!"
  ];
  var LITTLE_LINES = [
    "Touch the glowing tugboat with the light!",
    "Now the rowboat! Touch it with the light.",
    "Find the banana boat with the light!",
    "Find the bathtub boat. Rub-a-dub!",
    "Find the sailboat with the light!",
    "Touch every window with the light!"
  ];

  // ── ANCHORS: where everything hidden sits on the painted sea ──
  // Fitted to the painted art (design/adventure/art-notes.md, section 4):
  // lighthouse-sea, -town-lit and -rocks-front are one 800 x 1200 frame, and
  // every place is a fraction of it: x, s, r and rx of its WIDTH, y and ry of
  // its HEIGHT. A sprite is drawn centred on its place, s of the picture's
  // width wide. The picture is fitted to the sea's height (the space above
  // the lamp-room ledge), its bottom edge on the ledge; a phone may hide at
  // most `crop` of each side, so the town's last windows (x 0.93) always
  // show, and an iPad or a small phone shows dark sea beside it. The HUD and
  // the Lost boat card cover the picture's top 20-28% (the sky), so nothing
  // to find sits above the horizon.
  var ANCHORS = {
    pic: { w: 800, h: 1200 },
    crop: 0.06,
    horizon: 0.345,                                    // the sky above, the sea below
    start: { x: 0.50, y: 0.45 },                       // where the light first lands
    // low over the horizon, where the HUD never covers it on any phone: the
    // cloud that hides it at word 5 has to be seen (the painted sky has no moon)
    moon: { x: 0.47, y: 0.295, s: 0.09 },
    rocks: { x: 0.17, y: 0.45, rx: 0.21, ry: 0.09 },   // the stand-in's cove only: the painted one is rocks-front
    rocksBox: { x: 0, y: 0.35, w: 0.40, h: 0.20 },     // where rocks-front has anything (the rest of its frame is clear)
    fogBanks: [{ x: 0.22, y: 0.64, rx: 0.14, ry: 0.04 }, { x: 0.40, y: 0.68, rx: 0.14, ry: 0.04 }],  // over the ferry
    // each boat's width, and its lantern's glass from the boat's middle
    // (fractions of its drawn width), measured on each painted boat
    boats: {
      tug: { s: 0.16, lamp: [0.36, 0.094] },
      row: { s: 0.15, lamp: [-0.35, -0.194] },
      sail: { s: 0.16, lamp: [-0.424, 0.254] },
      banana: { s: 0.17, lamp: [0.383, -0.165] },
      teacup: { s: 0.12, lamp: [-0.353, -0.261] },
      bathtub: { s: 0.15, lamp: [-0.376, -0.191] },
      ferry: { s: 0.24, lamp: [0.052, -0.376] }
    },
    decoys: { barrel: { s: 0.08 }, whale: { s: 0.22 }, duckie: { s: 0.13 }, buoy: { s: 0.09 } },
    // ages 5-8: where each word's boat waits on the open water (the band
    // under the horizon, and the lower left), never on the town or the cove
    // (drift: how far and how slowly it rocks, in seconds a sway; peek: where
    // the teacup peeks out to, up behind the cove's spit)
    sea: [
      { boat: "tug", x: 0.30, y: 0.68 },
      { boat: "row", x: 0.58, y: 0.45 },
      { boat: "sail", x: 0.70, y: 0.45, drift: { x: 0.09, y: 0.012, s: 11 }, decoy: { key: "barrel", x: 0.20, y: 0.62 } },
      { boat: "banana", x: 0.38, y: 0.575, drift: { x: 0.06, y: 0.015, s: 9 }, decoy: { key: "whale", x: 0.72, y: 0.44 } },
      { boat: "teacup", x: 0.10, y: 0.455, peek: { x: 0.29, y: 0.40 }, twist: true },
      { boat: "bathtub", x: 0.60, y: 0.415, drift: { x: 0.06, y: 0.010, s: 10 }, decoy: { key: "duckie", x: 0.24, y: 0.79 } },
      { boat: "ferry", x: 0.30, y: 0.66, drift: { x: 0.08, y: 0.010, s: 14 }, decoy: { key: "buoy", x: 0.63, y: 0.47 }, banks: true },
      { town: true }
    ],
    // ages 3-4: a still sea, no decoys, no twist
    little: [
      { boat: "tug", x: 0.30, y: 0.68 },
      { boat: "row", x: 0.58, y: 0.45 },
      { boat: "banana", x: 0.40, y: 0.58 },
      { boat: "bathtub", x: 0.26, y: 0.80 },
      { boat: "sail", x: 0.70, y: 0.46 },
      { town: true }
    ],
    // the town's twelve round windows, three rows of four: the middle of each
    // painted window's glass and its size (the rows are not quite level)
    windows: [
      { x: 0.6439, y: 0.5658, r: 0.0137, row: 0 }, { x: 0.7283, y: 0.5656, r: 0.0137, row: 0 }, { x: 0.8231, y: 0.5659, r: 0.0137, row: 0 }, { x: 0.9180, y: 0.5654, r: 0.0137, row: 0 },
      { x: 0.5912, y: 0.6253, r: 0.0141, row: 1 }, { x: 0.6993, y: 0.6253, r: 0.0141, row: 1 }, { x: 0.8048, y: 0.6254, r: 0.0141, row: 1 }, { x: 0.9079, y: 0.6254, r: 0.0141, row: 1 },
      { x: 0.5604, y: 0.6971, r: 0.0161, row: 2 }, { x: 0.6698, y: 0.6971, r: 0.0161, row: 2 }, { x: 0.7778, y: 0.6971, r: 0.0161, row: 2 }, { x: 0.8915, y: 0.6971, r: 0.0161, row: 2 }
    ],
    // ages 3-4 light six big windows: each is two neighbours lit together
    littleWindows: [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11]],
    // where found boats tie up, at half size, in the water by the dock's left
    // end: the front row and the back row filled in turn from the dock out,
    // so the fourth and fifth boats home never sit on the rubber duck's water
    dock: [{ x: 0.56, y: 0.795 }, { x: 0.475, y: 0.785 }, { x: 0.50, y: 0.85 }, { x: 0.395, y: 0.79 }, { x: 0.42, y: 0.86 }, { x: 0.315, y: 0.80 }, { x: 0.33, y: 0.865 }],
    dockLights: { x: 0.586, y: 0.754, w: 0.303, h: 0.055 },  // the bulb string's box (left, top): town-lit is clipped to it
    // the twenty painted bulbs along the dock, measured from the lit picture
    bulbs: [[0.592, 0.763], [0.604, 0.772], [0.619, 0.780], [0.634, 0.776], [0.641, 0.790], [0.665, 0.782], [0.667, 0.797], [0.696, 0.802], [0.701, 0.786], [0.727, 0.805],
      [0.735, 0.788], [0.776, 0.803], [0.778, 0.786], [0.806, 0.798], [0.812, 0.782], [0.831, 0.791], [0.844, 0.776], [0.854, 0.781], [0.869, 0.772], [0.881, 0.763]],
    townCard: { x: 0.48, y: 0.525, w: 0.50 },               // the lit town, cut for the Lost boat card
    wally: { x: 0.74, y: 0.735, s: 0.09 },                  // waving on the dock
    // lighthouse-ledge.webp: its first opaque row (the stone's back edge) sits
    // on the sea's foot, the brass rail above it in front of the sea, and the
    // stone's front edge under Echo's, the lamp's and the buddy's feet
    ledge: { top: 0.24, front: 0.47 },
    // the lamp sprites (off and on share one frame): width over height, and
    // the middle of the glass, where the beam starts
    lamp: { aspect: 0.658, glass: [0.504, 0.527] }
  };
  var BOAT_NAMES = { tug: "tugboat", row: "rowboat", sail: "sailboat", banana: "banana boat", teacup: "teacup boat", bathtub: "bathtub boat", ferry: "big ferry" };
  var DECOY_LINES = {
    barrel: "That's a barrel! Keep looking.",
    whale: "That's a sleepy whale! Keep looking.",
    duckie: "That's a giant rubber duck! Keep looking.",
    buoy: "That's a buoy with a seagull! Keep looking."
  };
  // the help ladder, by seconds of the finger searching with nothing found
  // (the times every played game uses), and how long a find holds
  var BIG_SECS = [4, 8, 12], LITTLE_SECS = [2, 4, 6];
  var BEAT = 1.15, POWER = 10, CHUG = 1.0, LO = 0.5;
  // a tap is trying too: a touch shorter than TAP counts TAP seconds toward
  // the help (a toddler's taps last about a tenth of a second); ages 3-4: a
  // find under way keeps going for LINGER after the finger lifts
  var TAP = 0.5, LINGER = 0.35;
  var CLOSE = "So close! Hold the light on it";
  // fog: a few soft lilac banks, fixed so every child sees the same sea
  // (x, y, size), over the painted sea's open water down to its foot
  var FOG = [[0.12, 0.40, 0.22], [0.42, 0.37, 0.26], [0.74, 0.39, 0.24], [0.24, 0.52, 0.24], [0.60, 0.47, 0.28], [0.90, 0.50, 0.20], [0.14, 0.67, 0.24], [0.44, 0.63, 0.24], [0.80, 0.69, 0.22], [0.30, 0.80, 0.24]];
  var FOG_TWIST = [[0.30, 0.44, 0.24], [0.62, 0.55, 0.24], [0.20, 0.60, 0.20], [0.86, 0.44, 0.20], [0.18, 0.76, 0.20]];
  // the dark sea beside the picture (an iPad, the smallest phone): the
  // painting's own edge colours, top to bottom
  var EDGE = [[0, "#0b1443"], [0.10, "#0f1b5a"], [0.25, "#32378c"], [0.335, "#353c93"], [0.35, "#1d286b"], [0.50, "#16204c"], [0.67, "#0c1a52"], [0.85, "#162260"], [1, "#142360"]];
  var ART_FILES = {
    sea: "sea", townLit: "town-lit", rocks: "rocks-front", ledge: "ledge", lampOff: "lamp-off", lampOn: "lamp-on", moon: "moon", cloud: "cloud",
    tug: "boat-tug", row: "boat-row", sail: "boat-sail", banana: "boat-banana", teacup: "boat-teacup", bathtub: "boat-bathtub", ferry: "boat-ferry",
    whale: "whale", whaleWink: "whale-wink", barrel: "barrel", buoy: "buoy", duckie: "duckie", wally: "wally"
  };

  var $ = function (id) { return document.getElementById(id); };
  var still = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var api = null, cv = null, ctx = null, fogCv = null, veilCv = null, W = 390, H = 844, dpr = 1, raf = 0, last = 0;
  var pic = { x: 0, y: 0, w: 390, h: 585 }, ledgeTop = 600, ctlTop = 760, rowBottom = 140, standH = 80, lampBox = { x: 195, y: 680, w: 60, h: 80 };
  var art = {}, artState = {}, buddyPics = null, echoCheer = null;
  var little = false, total = 8, stage = 0, active = false, paused = false, away = false, lampOn = false, coneT = 0, finale = false, finT = 0;
  var plan = null, pool = null, finger = null, keyHold = false, kbAt = -9, kbPos = null, linger = 0, lingerGap = 0;
  var idle = 0, rung = 0, decoysLit = 0, hold = 0, power = 0, beat = 0, dones = 0;
  var driftT = 0, peekT = 0, fogT = 0, pulse = 0, twist = false, cloudT = 0, decoy = null;
  var docked = [], chug = null, lit = [], dockOn = false, dingAt = -9;
  var banner = "", seen = [], hudT = 0, lostFor = "";

  function nowS() { return performance.now() / 1000; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function steps() { return little ? ANCHORS.little : ANCHORS.sea; }
  function isTown() { return !!(plan && plan.town); }
  function stepLine() { return little ? LITTLE_LINES[stage] : STEP_LINES[stage]; }
  function playing() { return active && !paused && !away && !finale && !document.hidden; }

  // ── where things are on screen ──
  function sx(x) { return pic.x + x * pic.w; }
  function sy(y) { return pic.y + y * pic.h; }
  function sea() { return Math.min(W, pic.w); }              // the board's width: the sea a child can see
  function baseR() { return (little ? 0.23 : 0.13) * sea(); }  // ages 3-4: a pool 46% of the board wide
  function radius() {
    var r = baseR();
    if (isTown()) r *= 1.15;                                  // the lamp shines its brightest for the town
    if (power > 0) r *= 2;                                    // Bright beam
    if (little && rung >= 2) r = Math.max(r, baseR() * 2);   // ages 3-4, 4 s: the pool doubles
    if (!little && rung >= 3) r = Math.max(r, 0.25 * sea()); // ages 5-8, 12 s: about half the sea
    if (finale) r = Math.max(r, 0.3 * sea());
    return r;
  }
  // the middle of the pool that finds a boat (ages 3-4: anywhere in it)
  function inner() { return little ? 1 : 0.6; }
  function holdNeed() { return little ? 0.25 : rung >= 3 ? 0.1 : 0.5; }
  // the light sits above a fingertip so the finger never covers what it shows
  function gap(type) { return type === "touch" || type === "pen" ? Math.min(56, 0.8 * radius()) : 0; }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  // where a finger's light goes: above the fingertip, on the picture's sea
  function aim(f) { return { x: clamp(f.x, Math.max(0, pic.x), Math.min(W, pic.x + pic.w)), y: clamp(f.y - gap(f.type), Math.max(0, pic.y), ledgeTop) }; }
  // the gap under the light right now: the finger's, or the one that just
  // lifted while its find is still under way (ages 3-4)
  function fingerGap() { return finger ? gap(finger.type) : linger > 0 ? lingerGap : 0; }
  // The find zone: the middle of the light (`inner` of it), and under a
  // finger the strip from there down to the fingertip. The light is drawn
  // above the finger so the finger never covers what it shows, but a child
  // told "Find the tugboat!" puts the finger ON the tugboat: with the zone
  // the middle alone, that boat sat 0.8 of the radius below the middle,
  // inside the light and never found. (The gap is at most 0.8 of the radius,
  // so a boat under the fingertip is always inside the light.)
  function inZone(x, y, g) {
    var dx = x - pool.x, dy = y - pool.y;
    if (g > 0 && dy > 0) dy = Math.max(0, dy - g);
    return Math.sqrt(dx * dx + dy * dy) <= radius() * inner();
  }

  // the lost boat right now: picture place, screen place, findable or not
  function boatNow() {
    if (!plan || !plan.boat) return null;
    var x = plan.x, y = plan.y, seen2 = true;
    if (plan.drift) { var a = 2 * Math.PI * driftT / plan.drift.s; x += plan.drift.x * Math.sin(a); y += plan.drift.y * Math.sin(2 * a); }
    if (plan.peek) {
      // the teacup hides behind the cove rocks and peeks out every few
      // seconds: hidden 2.4 s, out 0.4 s, peeking 1.8 s, back 0.4 s
      var c = peekT % 5, k = c < 2.4 ? 0 : c < 2.8 ? (c - 2.4) / 0.4 : c < 4.6 ? 1 : c < 5 ? 1 - (c - 4.6) / 0.4 : 0;
      if (still) k = k >= 0.5 ? 1 : 0;   // Reduce Motion: it is there or it is not
      x = plan.x + (plan.peek.x - plan.x) * k; y = plan.y + (plan.peek.y - plan.y) * k; seen2 = k >= 0.6;
    }
    return { key: plan.boat, x: x, y: y, sx: sx(x), sy: sy(y), visible: seen2 };
  }
  function decoyNow() { return decoy ? { key: decoy.key, sx: sx(decoy.x), sy: sy(decoy.y) } : null; }
  function townTargets() { return little ? ANCHORS.littleWindows : ANCHORS.windows.map(function (w, i) { return [i]; }); }

  // ── the painted art, each with a drawn stand-in ──
  function loadArt() {
    Object.keys(ART_FILES).forEach(function (k) {
      var i = new Image(); artState[k] = "loading";
      i.onload = function () { artState[k] = "ready"; lostFor = ""; draw(); };
      i.onerror = function () { artState[k] = "failed"; };
      i.src = "/assets/crafted/game/lighthouse-" + ART_FILES[k] + ".webp"; art[k] = i;
    });
    // held, so the first cheer does not wait on the network
    echoCheer = new Image(); echoCheer.src = "/assets/crafted/echo-cheer.webp";
  }
  function image(k) { var i = art[k]; return artState[k] === "ready" && i && i.naturalWidth ? i : null; }
  function artReady() { return Object.keys(ART_FILES).every(function (k) { return artState[k] === "ready"; }); }
  // a transparent sprite, centred, w wide (its own height from its shape)
  function sprite(c, k, x, y, w, alpha) {
    var i = image(k); if (!i) return false;
    var h = w * i.naturalHeight / i.naturalWidth;
    c.save(); if (alpha != null) c.globalAlpha *= alpha; c.drawImage(i, x - w / 2, y - h / 2, w, h); c.restore(); return true;
  }

  function fit() {
    if (!cv) return;
    var r = cv.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    // the fog and the veil are soft all over, so they are drawn at half the
    // screen's resolution and stretched: a quarter of the work every frame
    [fogCv, veilCv].forEach(function (c) { c.width = Math.max(1, Math.round(W * dpr * LO)); c.height = Math.max(1, Math.round(H * dpr * LO)); });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { ctlTop = $("lhControls").getBoundingClientRect().top - r.top; } catch (e) { ctlTop = H - 80; }
    try { rowBottom = $("lhRow").getBoundingClientRect().bottom - r.top; } catch (e) { rowBottom = 140; }
    // Echo, the lamp and the buddy stand on the ledge, above the two buttons
    standH = clamp(H * 0.1, 56, 96);
    ledgeTop = ctlTop - standH - 12;
    // the sea picture: fitted to the sea's height, hiding at most `crop` a side
    var s = Math.min(ledgeTop / ANCHORS.pic.h, W / (ANCHORS.pic.w * (1 - 2 * ANCHORS.crop)));
    pic = { w: ANCHORS.pic.w * s, h: ANCHORS.pic.h * s }; pic.x = (W - pic.w) / 2; pic.y = ledgeTop - pic.h;
    var lh = standH * 1.18; lampBox = { w: lh * ANCHORS.lamp.aspect, h: lh, x: W / 2, y: ctlTop - 6 - lh / 2 };
    placeStanders();
    if (pool) { pool.x = clamp(pool.x, 0, W); pool.y = clamp(pool.y, 0, ledgeTop); }
    finger = null; keyHold = false;
    hud(); draw();
  }
  function placeStanders() {
    var h = standH, bottom = ctlTop - 4;
    [["lhEcho", 0.16], ["lhBuddy", 0.84]].forEach(function (p) {
      var el = $(p[0]); if (!el) return;
      el.style.height = h + "px"; el.style.width = h + "px"; el.style.left = (W * p[1] - h / 2) + "px"; el.style.top = (bottom - h) + "px";
    });
  }

  // ── the hint banner: kind words only ──
  function setBanner(t) { if (!t || t === banner) return; banner = t; if (seen.indexOf(t) < 0) seen.push(t); try { $("lhBanner").textContent = t; } catch (e) {} }
  function searchBanner() {
    if (isTown()) return little && rung >= 3 ? "Touch the sea anywhere!" : !little && rung >= 2 ? "Sweep along a row!" : "Light up every window!";
    if (little) return rung >= 3 ? "Touch the sea anywhere!" : rung >= 2 ? "Look, a bigger light!" : rung >= 1 ? "Follow the arrow" : "Find the glowing boat!";
    return rung >= 2 ? "Follow the arrow" : "Look for the little twinkle";
  }

  // ── the help ladder ──
  function climb() {
    var secs = little ? LITTLE_SECS : BIG_SECS, r = 0;
    for (var i = 0; i < 3; i++) if (idle >= secs[i]) r = i + 1;
    if (!little && !isTown()) r = Math.max(r, Math.min(3, decoysLit));
    if (r <= rung) return;
    rung = r;
    // ages 5-8, the first rung: the lantern blinks brighter, the boat toots
    // and stops drifting (a hiding teacup comes out and stays out)
    if (!little && !isTown() && rung >= 1 && plan.peek) peekT = 3.2;
    if (!little && !isTown() && rung === 1) sfx("toot");
    setBanner(searchBanner());
  }
  function sfx(n) { try { if (api && playing()) api.sfx(n); } catch (e) {} }

  // ── finding ──
  // the light finds only while a finger is down on the sea, or Space is held
  // (the arrow keys only move it): a pool parked on a boat finds nothing
  function touching() { return !!finger || keyHold; }
  // what climbs the help ladder: a finger down on the sea, moving or held
  // still (a child holding the light where they think the boat is, is
  // trying), Space held, or the arrow keys just pressed. Waiting never does.
  function searching() { return touching() || nowS() - kbAt < 0.4; }
  function seek(dt) {
    var b = boatNow(), R = radius(), on = touching() || linger > 0, g = fingerGap();
    if (b && b.visible && on && inZone(b.sx, b.sy, g)) {
      hold += dt;
      if (hold >= holdNeed()) { found(b); return; }
    } else {
      linger = 0;
      // the boat in the light but not yet in its middle: say so, and take
      // the line back once the light has left it
      var near = !!(b && b.visible) && dist(pool, { x: b.sx, y: b.sy }) <= R;
      if (on && (near || hold >= holdNeed() * 0.4)) setBanner(CLOSE);
      else if (banner === CLOSE && !near) setBanner(searchBanner());
      hold = 0;
    }
    if (!decoy) return;
    var d = decoyNow(), dd = dist(pool, { x: d.sx, y: d.sy });
    if (decoy.on) { if (dd > R) decoy.on = false; return; }
    if (on && inZone(d.sx, d.sy, g)) {
      decoy.hold += dt;
      if (decoy.hold >= holdNeed()) {
        // a decoy is one try on the ladder, and nothing else
        decoy.on = true; decoy.hold = 0; decoy.react = 1.6; decoysLit++;
        climb(); setBanner(DECOY_LINES[decoy.key]); sfx(decoy.key === "whale" ? "spout" : "plip");
      }
    } else decoy.hold = 0;
  }
  function found(b) {
    hold = 0; linger = 0; active = true; beat = BEAT;
    chug = { key: b.key, from: { x: b.x, y: b.y }, slot: docked.length, t: 0 };
    setBanner("Toot toot! Found it!"); sfx("toot"); cheer();
  }
  // a touch anywhere: ages 3-4 from the third rung (a touch is still needed)
  function touchAnywhere() {
    if (!little || rung < 3 || !playing() || beat > 0) return;
    if (isTown()) { var n = nearestDark(); if (n >= 0) lightTarget(n); return; }
    var b = boatNow(); if (b && b.visible) found(b);
  }
  function nearestDark() {
    var best = -1, bd = 1e9; townTargets().forEach(function (t, i) {
      if (lit[i]) return; var w = ANCHORS.windows[t[0]], d = dist(pool || { x: W / 2, y: ledgeTop / 2 }, { x: sx(w.x), y: sy(w.y) });
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function lightTarget(i) {
    if (lit[i]) return; lit[i] = true; idle = 0;
    if (nowS() - dingAt > 0.12) { dingAt = nowS(); sfx("ding"); }
    if (lit.filter(Boolean).length >= townTargets().length) townDone();
  }
  function lightWindows() {
    if (!touching()) return;
    // ages 5-8 from 4 s: each window catches the light from twice as far away
    var R = radius(), reach = !little && rung >= 1 ? 2 : 1;
    townTargets().forEach(function (t, i) {
      if (lit[i]) return;
      for (var k = 0; k < t.length; k++) {
        var w = ANCHORS.windows[t[k]];
        if (dist(pool, { x: sx(w.x), y: sy(w.y) }) <= (R * 0.85 + w.r * pic.w) * reach) {
          lightTarget(i);
          // ages 5-8 from 8 s: one sweep across a row lights the whole row
          if (!little && rung >= 2) townTargets().forEach(function (u, j) { if (ANCHORS.windows[u[0]].row === w.row) lightTarget(j); });
          return;
        }
      }
    });
  }
  function townDone() { if (beat > 0) return; dockOn = true; beat = BEAT; setBanner("The whole town is lit!"); sfx("toot"); cheer(); }
  // Echo and the buddy cheer on the ledge (the buddy's own cheer picture,
  // never Echo's), and hop unless Reduce Motion is on
  function cheer() {
    try { if (api) api.face("cheer"); } catch (e) {}
    try {
      var e = $("lhEcho"); if (e) { e.src = "/assets/crafted/echo-cheer.webp"; clearTimeout(cheer.e); cheer.e = setTimeout(function () { e.src = "/assets/crafted/echo-welcome.webp"; }, 900); }
      var b = $("lhBuddy"); if (b && buddyPics) { b.src = buddyPics.cheer; clearTimeout(cheer.b); cheer.b = setTimeout(function () { if (buddyPics) b.src = buddyPics.rest; }, 900); }
      if (!still) [e, b].forEach(function (el) { if (el) { el.classList.remove("hop"); void el.offsetWidth; el.classList.add("hop"); } });
    } catch (x) {}
  }
  function stepDone() {
    if (chug) { docked.push({ key: chug.key, slot: chug.slot }); chug = null; }
    active = false; lampOn = false; dones++; decoy = null;
    // the Lost boat card shows the next boat while its word is asked
    if (dones < steps().length) { stage = dones; plan = steps()[stage]; }
    hud();
    if (api) api.done();
  }

  // ── the clock: only while the game is live ──
  function tick(dt) {
    pulse += dt; if (!still) fogT += dt;
    if (cloudT < 1 && twist) cloudT = still ? 1 : Math.min(1, cloudT + dt / 1.2);
    // the finale's beam sweeps the sky low over the horizon, under the HUD
    if (finale) { finT += dt; if (!still && pool) { var a = finT / 2.6 * Math.PI; pool.x = sx(0.5 - 0.36 * Math.cos(a)); pool.y = sy(0.27 + 0.045 * Math.sin(a)); } return; }
    if (!active || paused || away) return;
    if (lampOn && coneT < 1) coneT = still ? 1 : Math.min(1, coneT + dt / 0.35);
    if (beat > 0) {
      if (chug) chug.t = Math.min(1, chug.t + dt / CHUG);
      beat -= dt; if (beat <= 0) { beat = 0; stepDone(); }
      return;
    }
    if (power > 0) { power = Math.max(0, power - dt); if (!power) setBanner(searchBanner()); }
    if (decoy && decoy.react > 0) decoy.react = Math.max(0, decoy.react - dt);
    // ages 5-8 from the first rung: the boat stops drifting. Under Reduce
    // Motion nothing slides: the boats hold still on their places (the
    // teacup still peeks out, as a cut)
    if (little || rung === 0) { if (!still) driftT += dt; peekT += dt; }
    // the light glides after the finger like a real beam
    var goal = finger ? aim(finger) : (nowS() - kbAt < 5 && kbPos) ? kbPos : null;
    if (goal && pool) {
      goal.x = clamp(goal.x, Math.max(0, pic.x), Math.min(W, pic.x + pic.w)); goal.y = clamp(goal.y, Math.max(0, pic.y), ledgeTop);
      var k = 1 - Math.exp(-dt * 16); pool.x += (goal.x - pool.x) * k; pool.y += (goal.y - pool.y) * k;
    }
    // only the finger (or the keys) searching climbs the ladder: waiting never does
    if (searching()) { idle += dt; if (finger) finger.held += dt; climb(); }
    if (isTown()) lightWindows(); else seek(dt);
    if (linger > 0) linger = Math.max(0, linger - dt);
  }
  function frame(ts) {
    var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
    if (cv && (Math.abs(cv.clientWidth - W) > 0.5 || Math.abs(cv.clientHeight - H) > 0.5)) fit();
    tick(dt); draw();
    hudT += dt; if (hudT >= 0.07) { hudT = 0; hud(); }
    raf = requestAnimationFrame(frame);
  }

  // ── drawing ──
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawSea();
    var b = (!finale && plan && plan.boat && !chug && (active || paused)) ? boatNow() : null;
    if (decoy && !finale) drawDecoy();
    if (b) drawBoat(ctx, b.key, b.sx, b.sy, ANCHORS.boats[b.key].s * pic.w, 1);
    drawRocks();
    // the veil, then the lilac fog over it (thinner inside the pool)
    drawVeil();
    drawFog();
    drawMoon();
    drawTown();
    drawDocked();
    if (b && active && !paused) drawHints(b);
    if (isTown() && active && !paused && beat === 0 && little && rung >= 1) townHint();
    drawCone();
    drawLedge();
  }
  // The sea never moves, so it is painted once for this screen into a layer
  // the size of the screen and copied each frame: shrinking the whole
  // 800 x 1200 picture every frame cost about half as much again as
  // everything else drawn.
  var seaLayer = null, seaKey = "";
  function drawSea() {
    var key = [W, H, dpr, ledgeTop, pic.x, pic.w, artState.sea].join("|");
    if (!seaLayer) seaLayer = document.createElement("canvas");
    if (key !== seaKey) {
      seaKey = key; seaLayer.width = Math.max(1, Math.round(W * dpr)); seaLayer.height = Math.max(1, Math.round((ledgeTop + 2) * dpr));
      var c = seaLayer.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); paintSea(c);
    }
    ctx.drawImage(seaLayer, 0, 0, W, seaLayer.height / dpr);
  }
  function paintSea(c) {
    // the dark sea beside the picture (an iPad, the smallest phone), in the
    // painting's own colours at each height, so its edge does not show
    var g = c.createLinearGradient(0, pic.y, 0, pic.y + pic.h);
    EDGE.forEach(function (e) { g.addColorStop(e[0], e[1]); });
    c.fillStyle = g; c.fillRect(0, 0, W, ledgeTop + 2);
    if (image("sea")) {
      c.drawImage(art.sea, pic.x, pic.y, pic.w, pic.h);
      // where the picture is narrower than the screen, its edges fade into
      // the band beside it (thin slices, each a little fainter)
      if (pic.x > 0.5) {
        for (var k = 0; k < 7; k++) {
          c.globalAlpha = 1 - (k + 1) / 8;
          c.fillRect(pic.x + k * 2, 0, 2, ledgeTop + 2); c.fillRect(pic.x + pic.w - (k + 1) * 2, 0, 2, ledgeTop + 2);
        }
        c.globalAlpha = 1;
      }
      return;
    }
    // stand-in: sky, horizon, cove rocks, the harbor town and its dock
    var hz = sy(ANCHORS.horizon);
    c.fillStyle = "rgba(160,150,220,.18)"; c.fillRect(pic.x, hz - 1, pic.w, 2);
    c.fillStyle = "rgba(255,255,255,.06)";
    for (var i = 0; i < 9; i++) { var wy = sy(0.38 + i * 0.055); c.fillRect(sx(0.1 + (i % 3) * 0.25), wy, pic.w * 0.12, 2); }
    drawRockShape(c, "#2b2747");
    // three rows of cottages up the hill, where the painted ones stand, and the dock under them
    c.fillStyle = "#3b3157";
    [[0.60, 0.53, 0.37, 0.075], [0.55, 0.595, 0.40, 0.075], [0.52, 0.66, 0.43, 0.085]].forEach(function (h) { roundRect(c, sx(h[0]), sy(h[1]), h[2] * pic.w, h[3] * pic.h, 8); c.fill(); });
    c.fillStyle = "#1f1a33";
    ANCHORS.windows.forEach(function (w) { c.beginPath(); c.arc(sx(w.x), sy(w.y), w.r * pic.w, 0, Math.PI * 2); c.fill(); });
    c.fillStyle = "#4a3426"; c.fillRect(sx(0.60), sy(0.77), pic.w * 0.29, pic.h * 0.03);
  }
  function drawRockShape(c, col) {
    var r = ANCHORS.rocks; c.fillStyle = col;
    c.beginPath(); c.ellipse(sx(r.x), sy(r.y), r.rx * pic.w, r.ry * pic.h, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx(r.x - 0.06), sy(r.y - 0.03), r.rx * 0.6 * pic.w, r.ry * 1.1 * pic.h, 0, 0, Math.PI * 2); c.fill();
  }
  // the front rocks over a hiding teacup: only the box they fill is drawn
  function drawRocks() {
    var i = image("rocks"), b = ANCHORS.rocksBox;
    if (!i) { drawRockShape(ctx, "#262241"); return; }
    var nw = i.naturalWidth, nh = i.naturalHeight;
    ctx.drawImage(i, b.x * nw, b.y * nh, b.w * nw, b.h * nh, sx(b.x), sy(b.y), b.w * pic.w, b.h * pic.h);
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath(); }
  // a boat: its painted sprite, else a little drawn hull of its own colour
  function drawBoat(c, key, x, y, w, alpha) {
    if (sprite(c, key, x, y, w, alpha)) return;
    var col = { tug: "#d4553f", row: "#9a6a3e", sail: "#f3efe4", banana: "#f2cc45", teacup: "#9fd3e8", bathtub: "#f7f4ef", ferry: "#4f86c6" }[key] || "#ccc";
    c.save(); c.globalAlpha *= alpha == null ? 1 : alpha; c.translate(x, y);
    if (key === "teacup" || key === "bathtub") { c.fillStyle = col; c.beginPath(); c.ellipse(0, w * 0.05, w * 0.46, w * 0.24, 0, 0, Math.PI); c.fill(); c.fillRect(-w * 0.46, -w * 0.1, w * 0.92, w * 0.16); }
    else if (key === "banana") { c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, w * 0.5, w * 0.2, 0, 0, Math.PI); c.fill(); c.beginPath(); c.ellipse(0, -w * 0.02, w * 0.5, w * 0.08, 0, 0, Math.PI * 2); c.fill(); }
    else {
      c.fillStyle = key === "sail" ? "#5d7fa6" : col; c.beginPath(); c.moveTo(-w * 0.5, -w * 0.05); c.lineTo(w * 0.5, -w * 0.05); c.lineTo(w * 0.34, w * 0.18); c.lineTo(-w * 0.34, w * 0.18); c.closePath(); c.fill();
      if (key === "sail") { c.fillStyle = col; c.beginPath(); c.moveTo(0, -w * 0.62); c.lineTo(w * 0.3, -w * 0.08); c.lineTo(0, -w * 0.08); c.closePath(); c.fill(); }
      else { c.fillStyle = key === "ferry" ? "#f2efe6" : "#f6e7c8"; c.fillRect(-w * 0.22, -w * (key === "ferry" ? 0.32 : 0.26), w * 0.44, w * (key === "ferry" ? 0.27 : 0.21)); }
    }
    c.restore();
  }
  function lanternAt(key, x, y) { var a = ANCHORS.boats[key], w = a.s * pic.w; return { x: x + a.lamp[0] * w, y: y + a.lamp[1] * w }; }
  function drawDecoy() {
    var d = decoyNow(), a = ANCHORS.decoys[d.key], w = a.s * pic.w, dozing = !little && rung >= 2;
    var alpha = dozing ? 0.55 : 1, k = d.key === "whale" && decoy.react > 0 ? "whaleWink" : d.key;
    // lit, it reacts: the whale opens one eye and blows a little spout; the
    // others bob (a change of pose, no bob, under Reduce Motion)
    if (decoy.react > 0 && !still && d.key !== "whale") d.sy -= Math.abs(Math.sin(decoy.react * 9)) * w * 0.12;
    // (the painted wink already blows its spout: the drops are the stand-in's)
    if (decoy.react > 0 && d.key === "whale" && !image("whaleWink")) {
      var up = still ? 1 : Math.min(1, (1.6 - decoy.react) / 0.4);
      ctx.save(); ctx.fillStyle = "rgba(220,236,255,.85)";
      for (var j = 0; j < 7; j++) { var ang = -Math.PI / 2 + (j - 3) * 0.28, rr = w * 0.32 * up; ctx.beginPath(); ctx.arc(d.sx - w * 0.12 + Math.cos(ang) * rr * 0.6, d.sy - w * 0.22 + Math.sin(ang) * rr, Math.max(1.5, w * 0.025), 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (!sprite(ctx, k, d.sx, d.sy, w, alpha)) {
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(d.sx, d.sy);
      if (d.key === "whale") { ctx.fillStyle = "#5c78a8"; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.5, w * 0.22, 0, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(w * 0.45, -w * 0.05); ctx.lineTo(w * 0.62, -w * 0.2); ctx.lineTo(w * 0.62, w * 0.05); ctx.fill(); }
      else if (d.key === "barrel") { ctx.fillStyle = "#8a5a32"; roundRect(ctx, -w * 0.35, -w * 0.5, w * 0.7, w * 0.8, w * 0.15); ctx.fill(); }
      else if (d.key === "buoy") { ctx.fillStyle = "#d9534a"; ctx.beginPath(); ctx.moveTo(0, -w * 0.6); ctx.lineTo(w * 0.35, w * 0.2); ctx.lineTo(-w * 0.35, w * 0.2); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#f5f2ea"; ctx.beginPath(); ctx.arc(0, -w * 0.68, w * 0.12, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillStyle = "#f4cf3e"; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.45, w * 0.26, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(w * 0.25, -w * 0.28, w * 0.18, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }
  function drawFog() {
    var f = fogCv.getContext("2d"), dense = little ? 0.1 : 0.2 * (twist ? 1.5 : 1);
    f.setTransform(dpr * LO, 0, 0, dpr * LO, 0, 0); f.clearRect(0, 0, W, H);
    // Bright beam clears the fog for its ten seconds; the finale too
    if (power > 0 || finale) return;
    var list = twist && !little ? FOG.concat(FOG_TWIST) : FOG;
    list.forEach(function (b, i) {
      // each bank drifts slowly and wraps round, starting where it is listed
      var x = ((b[0] + 0.2 + fogT * 0.01 * (i % 2 ? 1 : -1)) % 1.4 + 1.4) % 1.4 - 0.2, r = b[2] * pic.w;
      blob(f, sx(x), sy(b[1]), r, r * 0.42, "rgba(200,186,236," + dense + ")");
    });
    if (plan && plan.banks) ANCHORS.fogBanks.forEach(function (b) { blob(f, sx(b.x), sy(b.y), b.rx * pic.w, b.ry * pic.h * 1.6, "rgba(206,192,240,0.62)"); });
    // the fog thins inside the pool of light
    if (pool && lampOn) {
      var R = radius(), g = f.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, R);
      g.addColorStop(0, "rgba(0,0,0,.75)"); g.addColorStop(0.7, "rgba(0,0,0,.6)"); g.addColorStop(1, "rgba(0,0,0,0)");
      f.globalCompositeOperation = "destination-out"; f.fillStyle = g; f.beginPath(); f.arc(pool.x, pool.y, R, 0, Math.PI * 2); f.fill(); f.globalCompositeOperation = "source-over";
    }
    ctx.drawImage(fogCv, 0, 0, W, H);
  }
  function blob(c, x, y, rx, ry, col) {
    c.save(); c.translate(x, y); c.scale(1, ry / rx);
    var g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, col); g.addColorStop(1, "rgba(200,186,236,0)");
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill(); c.restore();
  }
  function veilAlpha() {
    var a = little ? 0.8 : 0.88;
    if (twist && !little) a += 0.04;
    // the lamp shines its brightest for the town: its cottages show dimly
    if (isTown()) a -= 0.12;
    if (finale) a = a + (0.3 - a) * Math.min(1, finT / 1.2);
    return a;
  }
  // everything under a soft dark veil, except the pool of light
  function drawVeil() {
    var v = veilCv.getContext("2d");
    v.setTransform(dpr * LO, 0, 0, dpr * LO, 0, 0); v.clearRect(0, 0, W, H);
    v.fillStyle = "rgba(9,11,40," + veilAlpha().toFixed(3) + ")"; v.fillRect(0, 0, W, ledgeTop + 4);
    if (pool && lampOn) {
      var R = radius() * Math.max(0.05, coneT), g = v.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, R * 1.08);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.68, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
      v.globalCompositeOperation = "destination-out"; v.fillStyle = g; v.beginPath(); v.arc(pool.x, pool.y, R * 1.08, 0, Math.PI * 2); v.fill(); v.globalCompositeOperation = "source-over";
    }
    ctx.drawImage(veilCv, 0, 0, W, H);
  }
  function drawMoon() {
    var m = ANCHORS.moon, x = sx(m.x), y = sy(m.y), w = m.s * pic.w;
    if (!sprite(ctx, "moon", x, y, w)) { ctx.save(); ctx.shadowColor = "rgba(255,244,214,.7)"; ctx.shadowBlur = 18; ctx.fillStyle = "#fff4d8"; ctx.beginPath(); ctx.arc(x, y, w * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    if (!twist) return;
    // the twist: a cloud drifts over the moon (it cuts in under Reduce Motion);
    // the painted cloud is flat, so it is drawn wide enough to hide the moon
    var cx = x + (1 - cloudT) * pic.w * 0.6, cw = w * (image("cloud") ? 2.5 : 1.7);
    if (!sprite(ctx, "cloud", cx, y + w * 0.06, cw)) { ctx.fillStyle = "rgba(176,164,214,.96)"; [[-0.28, 0.06, 0.24], [0, -0.04, 0.3], [0.28, 0.06, 0.24]].forEach(function (p) { ctx.beginPath(); ctx.arc(cx + p[0] * cw, y + p[1] * cw, p[2] * cw, 0, Math.PI * 2); ctx.fill(); }); }
  }
  function drawTown() {
    var lt = image("townLit");
    townTargets().forEach(function (t, i) {
      t.forEach(function (n) {
        var w = ANCHORS.windows[n], x = sx(w.x), y = sy(w.y), r = w.r * pic.w;
        if (!lit[i] && !finale) {
          // a dark window still shows a faint rim on the town step, so a child sees where to sweep
          if (isTown() && active) { ctx.strokeStyle = "rgba(255,226,140,.28)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, Math.PI * 2); ctx.stroke(); }
          return;
        }
        glow(x, y, r * 3.2, "rgba(255,214,110,.42)");
        if (lt) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(lt, pic.x, pic.y, pic.w, pic.h); ctx.restore(); }
        else { ctx.fillStyle = "#ffd86b"; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      });
    });
    if (dockOn || finale) {
      var d = ANCHORS.dockLights;
      if (lt) { ctx.save(); ctx.beginPath(); ctx.rect(sx(d.x), sy(d.y), d.w * pic.w, d.h * pic.h); ctx.clip(); ctx.drawImage(lt, pic.x, pic.y, pic.w, pic.h); ctx.restore(); }
      // a soft glow on each painted bulb (and a drawn bulb on the stand-in)
      ANCHORS.bulbs.forEach(function (p) { var bx = sx(p[0]), by = sy(p[1]); glow(bx, by, pic.w * 0.016, "rgba(255,220,120,.55)"); if (!lt) { ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.arc(bx, by, Math.max(1.5, pic.w * 0.005), 0, Math.PI * 2); ctx.fill(); } });
    }
    if (isTown() || finale) {
      var wl = ANCHORS.wally;
      if (!sprite(ctx, "wally", sx(wl.x), sy(wl.y), wl.s * pic.w, 0.95)) { ctx.fillStyle = "#8f8a9e"; ctx.beginPath(); ctx.arc(sx(wl.x), sy(wl.y), wl.s * pic.w * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#24305e"; ctx.fillRect(sx(wl.x) - wl.s * pic.w * 0.16, sy(wl.y) - wl.s * pic.w * 0.42, wl.s * pic.w * 0.32, wl.s * pic.w * 0.1); }
    }
  }
  function glow(x, y, r, col) { var g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(255,214,110,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  // found boats: home at the dock and lit, drawn above the veil
  function drawDocked() {
    var scale = 0.5;
    docked.forEach(function (d) { var s = ANCHORS.dock[d.slot % ANCHORS.dock.length], w = ANCHORS.boats[d.key].s * pic.w * scale; glow(sx(s.x), sy(s.y), w * 0.8, "rgba(255,214,110,.28)"); drawBoat(ctx, d.key, sx(s.x), sy(s.y) - w * 0.15, w, 1); });
    if (!chug) return;
    var to = ANCHORS.dock[chug.slot % ANCHORS.dock.length], a = ANCHORS.boats[chug.key], t = chug.t;
    if (still) {
      // Reduce Motion: it fades where it was found, then is at the dock
      var w0 = a.s * pic.w;
      if (t < 0.45) { var f = 1 - t / 0.45; glow(sx(chug.from.x), sy(chug.from.y), w0, "rgba(255,214,110," + (0.5 * f).toFixed(2) + ")"); drawBoat(ctx, chug.key, sx(chug.from.x), sy(chug.from.y), w0, f); }
      else drawBoat(ctx, chug.key, sx(to.x), sy(to.y) - w0 * scale * 0.15, w0 * scale, Math.min(1, (t - 0.45) / 0.3));
      return;
    }
    var e = t * t * (3 - 2 * t), x = chug.from.x + (to.x - chug.from.x) * e, y = chug.from.y + (to.y - chug.from.y) * e, w = a.s * pic.w * (1 - (1 - scale) * e);
    // the lit ripple trail it chugs along
    ctx.save(); ctx.strokeStyle = "rgba(255,226,140,.55)"; ctx.lineWidth = 3; ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.moveTo(sx(chug.from.x), sy(chug.from.y)); ctx.lineTo(sx(x), sy(y)); ctx.stroke(); ctx.restore();
    glow(sx(x), sy(y), w, "rgba(255,214,110,.45)");
    drawBoat(ctx, chug.key, sx(x), sy(y) - w * 0.15 * e, w, 1);
  }
  // the lantern (a little twinkle; bright and blinking from the first rung,
  // and for ages 3-4 from the start), the ripple ring, the arrow, the hold
  function drawHints(b) {
    if (b.visible) {
      var l = lanternAt(b.key, b.sx, b.sy), bright = little || rung >= 1;
      var tw = still ? 1 : 0.75 + 0.25 * Math.sin(pulse * (bright ? 7 : 3));
      glow(l.x, l.y, (bright ? 16 : 7) * tw, bright ? "rgba(255,226,120,.95)" : "rgba(255,226,120,.55)");
      ctx.fillStyle = "#fff3c4"; ctx.beginPath(); ctx.arc(l.x, l.y, bright ? 3.4 : 2, 0, Math.PI * 2); ctx.fill();
    }
    var guide = little ? rung >= 1 : rung >= 2, w = ANCHORS.boats[b.key].s * pic.w;
    if (guide && b.visible) {
      var rr = w * 0.75 * (still ? 1 : 1 + 0.12 * Math.sin(pulse * 4));
      ctx.save(); ctx.strokeStyle = "rgba(255,236,160,.85)"; ctx.lineWidth = 3; ctx.shadowColor = "#ffd34d"; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(b.sx, b.sy, rr, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      if (pool) arrow(pool, { x: b.sx, y: b.sy }, radius(), rr);
    }
    if (hold > 0) {
      ctx.save(); ctx.strokeStyle = "#fff2b8"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(b.sx, b.sy, w * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, hold / holdNeed())); ctx.stroke(); ctx.restore();
    }
  }
  // ages 3-4 on the town, from 2 s: a ring on the nearest dark window and an
  // arrow from the light to it
  function townHint() {
    var n = nearestDark(); if (n < 0 || !pool) return;
    var w = ANCHORS.windows[townTargets()[n][0]], x = sx(w.x), y = sy(w.y), rr = w.r * pic.w * 2.4 * (still ? 1 : 1 + 0.12 * Math.sin(pulse * 4));
    ctx.save(); ctx.strokeStyle = "rgba(255,236,160,.9)"; ctx.lineWidth = 3; ctx.shadowColor = "#ffd34d"; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    arrow(pool, { x: x, y: y }, radius(), rr);
  }
  function arrow(from, to, r0, r1) {
    var d = dist(from, to); if (d < r0 + r1 + 12) return;
    var ux = (to.x - from.x) / d, uy = (to.y - from.y) / d, a = { x: from.x + ux * r0 * 0.6, y: from.y + uy * r0 * 0.6 }, b = { x: to.x - ux * (r1 + 6), y: to.y - uy * (r1 + 6) };
    ctx.save(); ctx.strokeStyle = "#fff2b8"; ctx.fillStyle = "#fff2b8"; ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.setLineDash([2, 9]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    var ang = Math.atan2(uy, ux); ctx.translate(b.x, b.y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-12, -9); ctx.lineTo(-12, 9); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // the warm cone from the lamp to the pool, and the pool's rim
  // the middle of the lamp's glass on screen, where the beam starts
  function glass() { var g = ANCHORS.lamp.glass; return { x: lampBox.x + (g[0] - 0.5) * lampBox.w, y: lampBox.y + (g[1] - 0.5) * lampBox.h }; }
  function drawCone() {
    if (!pool || !lampOn) return;
    var R = radius(), top = glass(), k = coneT;
    var px = top.x + (pool.x - top.x) * k, py = top.y + (pool.y - top.y) * k, r = R * Math.max(0.05, k);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    var g = ctx.createLinearGradient(top.x, top.y, px, py); g.addColorStop(0, "rgba(255,226,140,.34)"); g.addColorStop(1, "rgba(255,226,140,.10)");
    var ang = Math.atan2(py - top.y, px - top.x) + Math.PI / 2;
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(top.x + Math.cos(ang) * lampBox.w * 0.16, top.y + Math.sin(ang) * lampBox.w * 0.16);
    ctx.lineTo(px + Math.cos(ang) * r * 0.92, py + Math.sin(ang) * r * 0.92);
    ctx.lineTo(px - Math.cos(ang) * r * 0.92, py - Math.sin(ang) * r * 0.92);
    ctx.lineTo(top.x - Math.cos(ang) * lampBox.w * 0.16, top.y - Math.sin(ang) * lampBox.w * 0.16); ctx.closePath(); ctx.fill();
    // warm light in the pool, brightest in its middle, and a soft rim
    var rim = ctx.createRadialGradient(px, py, 0, px, py, r * 1.05); rim.addColorStop(0, "rgba(255,226,150,.26)"); rim.addColorStop(0.6, "rgba(255,226,150,.14)"); rim.addColorStop(0.88, "rgba(255,230,150,.18)"); rim.addColorStop(1, "rgba(255,230,150,0)");
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(px, py, r * 1.05, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawLedge() {
    var h = H - ledgeTop, L = ANCHORS.ledge, feet = ctlTop - 4;
    var l = image("ledge");
    if (l) {
      // the stone's top runs from the sea's foot down to where Echo, the lamp
      // and the buddy stand, its front edge under their feet; it covers the
      // width, and its wooden face fills the rest of the screen
      var nw = l.naturalWidth, nh = l.naturalHeight;
      var s = Math.max(W / nw, h / ((1 - L.top) * nh), (feet - ledgeTop) / ((L.front - L.top) * nh)), w = nw * s;
      ctx.drawImage(l, (W - w) / 2, ledgeTop - L.top * nh * s, w, nh * s);
    } else {
      var g = ctx.createLinearGradient(0, ledgeTop, 0, H); g.addColorStop(0, "#5b4166"); g.addColorStop(1, "#3a2a45");
      ctx.fillStyle = g; ctx.fillRect(0, ledgeTop, W, h);
      ctx.fillStyle = "#c9a052"; ctx.fillRect(0, ledgeTop, W, 6); ctx.fillStyle = "#e4c27a"; ctx.fillRect(0, ledgeTop, W, 2);
      for (var x = 18; x < W; x += 46) { ctx.fillStyle = "#b38c45"; ctx.fillRect(x, ledgeTop + 6, 4, Math.min(30, h * 0.25)); }
    }
    var on = lampOn, key = on || finale ? "lampOn" : "lampOff", b = lampBox, gl = glass();
    if (on || finale) glow(gl.x, gl.y, b.h * 1.1, "rgba(255,222,130,.45)");
    if (!sprite(ctx, key, b.x, b.y, b.w)) {
      ctx.fillStyle = "#b8873c"; roundRect(ctx, b.x - b.w * 0.4, b.y + b.h * 0.18, b.w * 0.8, b.h * 0.3, 6); ctx.fill();
      ctx.fillStyle = on || finale ? "#ffe58a" : "#4a4f78"; ctx.beginPath(); ctx.arc(gl.x, gl.y, b.w * 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c99a48"; roundRect(ctx, b.x - b.w * 0.3, b.y - b.h * 0.48, b.w * 0.6, b.h * 0.12, 5); ctx.fill();
    }
  }
  // the Lost boat card: the boat to find, so a child who can't read knows
  function paintLost() {
    var key = plan ? (plan.town ? "town" : plan.boat) : "", artKey = key === "town" ? "townLit" : key;
    var want = key + "|" + (artState[artKey] || "");
    if (want === lostFor) return; lostFor = want;
    try {
      var c = $("lostPic"), x = c.getContext("2d"), cw = 132, ch = 88; c.width = cw; c.height = ch; x.clearRect(0, 0, cw, ch);
      x.fillStyle = "#2a2f66"; roundRect(x, 0, 0, cw, ch, 16); x.fill();
      if (key === "town") {
        // the painted town with every window lit: what the child is making
        var lt = image("townLit"), T = ANCHORS.townCard;
        if (lt) {
          var nw = lt.naturalWidth, tw = T.w * nw;
          x.save(); roundRect(x, 0, 0, cw, ch, 16); x.clip(); x.drawImage(lt, T.x * nw, T.y * lt.naturalHeight, tw, tw * ch / cw, 0, 0, cw, ch); x.restore();
        } else {
          x.fillStyle = "#4a3c6c"; roundRect(x, 30, 26, 72, 52, 8); x.fill(); x.fillStyle = "#ffd86b";
          [[50, 46], [82, 46], [66, 64]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 8, 0, Math.PI * 2); x.fill(); });
        }
        $("lostLabel").textContent = "Light the town"; $("lostCard").setAttribute("aria-label", "Light up the town");
      } else if (key) {
        glowOn(x, cw / 2, ch / 2, 40);
        // a painted boat fits the card by its own shape (the sailboat and the
        // ferry are taller than wide); the stand-in hull is drawn as before
        var bi = image(key), bw = key === "ferry" ? 110 : 96;
        if (bi) bw = Math.min(cw * 0.84, (ch - 10) * bi.naturalWidth / bi.naturalHeight);
        drawBoat(x, key, cw / 2, ch / 2 + (bi ? 0 : 6), bw, 1);
        $("lostLabel").textContent = "Lost boat"; $("lostCard").setAttribute("aria-label", "Lost boat: the " + BOAT_NAMES[key]);
      }
    } catch (e) {}
  }
  function glowOn(c, x, y, r) { var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(255,226,140,.6)"); g.addColorStop(1, "rgba(255,226,140,0)"); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }

  // ── the buttons ──
  function hud() {
    var p = playing() && beat === 0;
    try {
      $("lhHelp").disabled = !(p && power <= 0);
      $("lhHearStep").disabled = !p;
      $("lhPower").hidden = !(power > 0); $("lhPowerFill").style.width = (power / POWER * 100) + "%";
      var lb = $("lhLight"), at = pool || { x: sx(ANCHORS.start.x), y: sy(ANCHORS.start.y) };
      // never disabled: a disabled button drops the keyboard's focus between boats
      lb.setAttribute("aria-disabled", p ? "false" : "true"); lb.style.left = at.x + "px"; lb.style.top = at.y + "px";
    } catch (e) {}
    paintLost();
  }
  // What tests read: worked out when it is read (a getter on window), so it is
  // never a frame behind the game and costs nothing while nobody looks.
  function snapshot() {
    var b = plan && plan.boat ? boatNow() : null, d = decoyNow(), R = radius(), off = cv ? cv.getBoundingClientRect() : { left: 0, top: 0 };
    try {
      return {
        stage: stage, steps: total, little: little, active: active, paused: paused, lampOn: lampOn, finale: finale, still: still,
        pool: pool ? { sx: pool.x + off.left, sy: pool.y + off.top, r: R, x: (pool.x - pic.x) / pic.w, y: (pool.y - pic.y) / pic.h } : null,
        finger: finger ? { x: finger.x + off.left, y: finger.y + off.top, type: finger.type } : null, gap: finger ? gap(finger.type) : 0,
        target: b ? { key: b.key, kind: "boat", x: b.x, y: b.y, sx: b.sx + off.left, sy: b.sy + off.top, visible: b.visible, hold: hold, need: holdNeed(), inner: inner(),
          blink: little || rung >= 1, ring: little ? rung >= 1 : rung >= 2, arrow: little ? rung >= 1 : rung >= 2, drifting: !!plan.drift && !still && (little || rung === 0), zone: !!pool && inZone(b.sx, b.sy, fingerGap()) } : (isTown() ? { kind: "town", arrow: little && rung >= 1, ring: little && rung >= 1 } : null),
        decoy: d ? { key: d.key, sx: d.sx + off.left, sy: d.sy + off.top, on: decoy.on, dozing: !little && rung >= 2, react: decoy.react } : null,
        decoysLit: decoysLit, ladder: rung, idle: idle, beat: beat, dones: dones, power: power, twist: twist, fogClear: power > 0, linger: linger,
        reach: !little && rung >= 1 ? 2 : 1, rows: !little && rung >= 2,
        windows: ANCHORS.windows.map(function (w) { return { sx: sx(w.x) + off.left, sy: sy(w.y) + off.top, row: w.row }; }),
        targets: townTargets().map(function (t, i) { return { lit: !!lit[i], windows: t }; }), windowsLit: lit.filter(Boolean).length, dockOn: dockOn,
        docked: docked.map(function (x) { return x.key; }), chug: chug ? { key: chug.key, t: chug.t } : null,
        artReady: artReady(), art: JSON.parse(JSON.stringify(artState)), banner: banner, banners: seen.slice(),
        board: { left: Math.max(0, pic.x) + off.left, right: Math.min(W, pic.x + pic.w) + off.left, top: rowBottom + off.top, bottom: ledgeTop + off.top, picTop: pic.y + off.top, picH: pic.h, picW: pic.w, picX: pic.x + off.left },
        moon: { sx: sx(ANCHORS.moon.x) + off.left, sy: sy(ANCHORS.moon.y) + off.top, r: ANCHORS.moon.s * pic.w / 2 },
        anchors: JSON.parse(JSON.stringify(ANCHORS))
      };
    } catch (e) { return null; }
  }

  // ── the finger and the keyboard ──
  function pointAt(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function controls() {
    // the newest finger wins, and a touch anywhere on the sea starts it
    cv.addEventListener("pointerdown", function (e) {
      if (!playing() || !lampOn || beat > 0) return;
      var p = pointAt(e); finger = { id: e.pointerId, type: e.pointerType || "mouse", x: p.x, y: p.y, held: 0 };
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      kbPos = null; linger = 0;
      // ages 3-4: the light lands right where the finger does, with no glide,
      // so touching the boat puts it in the light at once (a toddler's tap is
      // over before a gliding light arrives)
      if (little && pool) { var a = aim(finger); pool.x = a.x; pool.y = a.y; }
      touchAnywhere();
    });
    cv.addEventListener("pointermove", function (e) {
      if (!finger || e.pointerId !== finger.id) return;
      var p = pointAt(e); finger.x = p.x; finger.y = p.y;
    });
    function up(e) {
      if (!finger || (e && e.pointerId !== finger.id)) return;
      var f = finger; finger = null;
      if (playing() && lampOn && beat === 0) {
        // a tap is trying too: it counts at least TAP seconds toward the help
        if (f.held < TAP) { idle += TAP - f.held; climb(); }
        // ages 3-4: a find under way keeps going a moment after the finger
        // lifts, so a tap on the boat finds it (the light stays where it is)
        if (little && hold > 0) { linger = LINGER; lingerGap = gap(f.type); return; }
        // ages 5-8 hold the light on it: say so when a find was under way
        if (hold > 0) setBanner(CLOSE);
      }
      hold = 0;
    }
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up); cv.addEventListener("lostpointercapture", up);
    // keyboard: the arrows move the light, Space (or Enter) held shines it
    var lb = $("lhLight");
    lb.addEventListener("keydown", function (e) {
      var k = e.key, step = 0.05 * sea(), d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
      if (d) {
        e.preventDefault(); if (!playing() || !lampOn || beat > 0) return;
        var at = kbPos || pool || { x: W / 2, y: ledgeTop / 2 };
        kbPos = { x: clamp(at.x + d[0] * step, Math.max(0, pic.x), Math.min(W, pic.x + pic.w)), y: clamp(at.y + d[1] * step, Math.max(0, pic.y), ledgeTop) };
        kbAt = nowS(); return;
      }
      if (k === " " || k === "Enter") { e.preventDefault(); if (!playing() || !lampOn || beat > 0) return; if (!keyHold && !e.repeat) { keyHold = true; touchAnywhere(); } }
      if (k === "Escape") keyHold = false;
    });
    lb.addEventListener("keyup", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); keyHold = false; hold = 0; } });
    lb.addEventListener("blur", function () { keyHold = false; });
    $("lhHelp").onclick = function () { if (playing() && beat === 0 && power <= 0) api.practice(); };
    $("lhHearStep").onclick = function () { if (playing() && beat === 0) api.instruct(stepLine()); };
    window.addEventListener("resize", fit);
    window.addEventListener("blur", function () { finger = null; keyHold = false; });
    document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    window.addEventListener("pagehide", function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; });
    window.addEventListener("pageshow", function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
  }

  // ── the engine's hooks ──
  function pause() { paused = true; finger = null; keyHold = false; hold = 0; linger = 0; last = 0; hud(); }
  function onWord(i) {
    stage = clamp(i, 0, steps().length - 1); plan = steps()[stage];
    active = true; paused = false; lampOn = true; coneT = 0; beat = 0; chug = null;
    idle = 0; rung = 0; decoysLit = 0; hold = 0; power = 0; driftT = 0; peekT = 0; linger = 0;
    finger = null; keyHold = false; kbPos = null; lit = isTown() ? [] : lit;
    decoy = plan.decoy && !little ? { key: plan.decoy.key, x: plan.decoy.x, y: plan.decoy.y, on: false, hold: 0, react: 0 } : null;
    if (plan.twist && !little) { twist = true; cloudT = still ? 1 : 0; }
    if (!pool) pool = { x: sx(ANCHORS.start.x), y: sy(ANCHORS.start.y) };
    setBanner(plan.twist && !little ? "Uh oh, a cloud! Look by the big rocks." : searchBanner());
    sfx("whoosh");
    try { api.instruct(stepLine()); } catch (e) {}
    hud();
  }
  // Bright beam, heard: the pool doubles and the fog clears for ten seconds,
  // on the same boat
  function onHelp() { active = true; paused = false; power = POWER; setBanner("Bright beam! The fog is clearing."); sfx("whoosh"); hud(); }
  function reset() {
    stage = 0; plan = steps()[0]; active = false; paused = false; lampOn = false; finale = false; finT = 0; coneT = 0;
    pool = null; finger = null; keyHold = false; kbPos = null; idle = 0; rung = 0; decoysLit = 0; hold = 0; linger = 0; power = 0; beat = 0; dones = 0;
    docked = []; chug = null; lit = []; dockOn = false; decoy = null; twist = false; cloudT = 0; seen = []; banner = "";
    setBanner("Say the word to light the lamp"); hud(); draw();
  }
  // the finale: every window and the dock lit, the boats toot and the beam
  // sweeps the sky (it holds still over the town under Reduce Motion)
  function onFinale() {
    finale = true; active = false; lampOn = true; coneT = 1; finT = 0; beat = 0; chug = null; dockOn = true;
    lit = townTargets().map(function () { return true; });
    if (!pool || still) pool = { x: sx(0.74), y: sy(0.63) };   // over the lit town
    setBanner("Every boat is home!");
    try { if (api) api.sfx("toot"); } catch (e) {}
    hud();
  }
  window.Lighthouse = {
    // the page says which age plays before the engine starts (ages 3-4: six words)
    setLittle: function (on) { little = !!on; },
    setBuddy: function (p) { buddyPics = (p && typeof p.rest === "string" && typeof p.cheer === "string") ? { rest: p.rest, cheer: p.cheer } : null; },
    init: function (a, n) {
      api = a; total = n || (little ? 6 : 8); cv = $("seaCanvas"); ctx = cv.getContext("2d");
      try { Object.defineProperty(window, "__lighthouse", { configurable: true, get: snapshot }); } catch (e) {}
      fogCv = document.createElement("canvas"); veilCv = document.createElement("canvas");
      loadArt(); controls(); reset(); fit(); raf = requestAnimationFrame(frame);
    },
    onWord: onWord, onHelp: onHelp, pause: pause,
    resume: function (playingNow) { paused = playingNow === false; last = 0; hud(); },
    reset: reset, finale: onFinale
  };
})();
