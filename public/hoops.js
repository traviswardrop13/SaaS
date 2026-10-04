/* Hoops: the first Say & Play game rebuilt as a real game (Travis, 26 Sep
   2026: "if its basketball, we want them shooting a hoop", then "yes build
   hoops" to this plan: the hoop slides slowly side to side; the child says
   the word and gets a basketball; they flick it up to shoot; a miss bounces
   off the rim and they flick again; eight words, eight baskets, a big finish).

   sayplay.js still owns every word turn, the mic and its quiet rules, the
   start card, pausing and the end card. This file is the court: it draws the
   gym, moves the hoop and flies the ball. It never touches the mic.

   THE WORD EARNS THE BALL; THE FINGER SHOOTS IT. A flick with no ball in
   hand does nothing, a ball arrives only when the engine has heard the word
   (onWord), and a miss never costs a word: the ball comes back and the child
   flicks again. Every ball ends in a basket, because the help grows with each
   miss until the next flick cannot miss — the last thing a child does is make
   the shot (Rachel's rule: end every round on a success).

   Nothing here is practice data: no attempt, rep, coin or sticker is written. */
(function () {
  "use strict";
  var api = null, cv = null, ctx = null, W = 0, H = 0, DPR = 1, F = 1, CX = 0, CY = 0;
  var raf = 0, lastT = 0, clock = 0, running = false, frozen = false;

  // ── the world, in metres. The camera stands behind the shooter, a little
  // above the ball, looking up at the hoop.
  var CAM = { x: 0, y: 1.6, z: -1.6, pitch: 10 * Math.PI / 180 };
  var COSP = Math.cos(CAM.pitch), SINP = Math.sin(CAM.pitch);
  var RIM_Y = 3.05, RIM_R = 0.3, TUBE = 0.024, BALL_R = 0.12, HOOP_Z = 2.7, BOARD_GAP = 0.15;
  var BOARD_Z = HOOP_Z + RIM_R + BOARD_GAP, BOARD_W = 1.8, BOARD_BOTTOM = RIM_Y - 0.15, BOARD_TOP = RIM_Y + 1.05;
  var WALL_Z = BOARD_Z + 1.3, GRAV = 9.8;
  var HAND = { x: 0, y: 1.0, z: 0.3 };
  var FLIGHT = 1.05;                        // seconds from hand to hoop on a good shot

  // ── the game ──
  // state: idle (no ball: a word turn) | drop (the ball arriving) | ready (in
  // hand) | flying | scored | back (a missed ball coming back to the hand)
  var state = "idle", ball = null, baskets = 0, count = 8, misses = 0, shots = 0, lastShot = "";
  var hoopX = 0, hoopPhase = 0, net = { stretch: 0, sway: 0, swayV: 0 }, fx = [];
  var hintAt = 0, doneAt = 0, cheerAt = -9, crowd = [], lastFlick = null, hoopClock = 0;

  function project(x, y, z) {
    var dx = x - CAM.x, dy = y - CAM.y, dz = z - CAM.z;
    var yy = dy * COSP - dz * SINP, zz = dy * SINP + dz * COSP;
    return { x: CX + F * dx / zz, y: CY - F * yy / zz, s: F / zz };
  }

  // The hoop keeps still for the first two baskets, then glides, a little
  // wider later on. After a miss it slows; after two it eases to a stop. It
  // holds still while the word is being said and while a basket is cheered.
  function hoopMoving() { return misses < 2 && (state === "drop" || state === "ready" || state === "flying" || state === "back"); }
  function hoopTarget(t) {
    if (misses >= 2) return hoopX;
    var amp = baskets < 2 ? 0 : baskets < 5 ? 0.6 : 0.9;
    var period = (baskets < 5 ? 5.6 : 4.3) * (misses === 1 ? 2 : 1);
    return amp * Math.sin(hoopPhase + (t / period) * Math.PI * 2);
  }

  // ── sizing ──
  function resize() {
    if (!cv) return;
    var r = cv.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // the hoop's top edge near the top, the ball in hand near the bottom
    F = Math.min(H, W * 1.25);
    CY = H * 0.05 + 0.293 * F + Math.max(0, H - F * 0.88 - H * 0.08) * 0.5;
    CX = W / 2;
    makeCrowd();
  }

  // ── drawing ──
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function poly(pts) { ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath(); }

  // One neutral painted timber swatch, tinted once per material. Rendering
  // only: all court coordinates, ball radius and collision geometry stay above.
  var WOOD = new Image(), woodFaces = {};
  WOOD.src = "/assets/crafted/painted-wood-ivory.webp";
  function timber(x, y, w, h, color, alpha) {
    if (!WOOD.complete || !WOOD.naturalWidth || w <= 0 || h <= 0) return;
    var face = woodFaces[color];
    if (!face) {
      face = document.createElement("canvas"); face.width = face.height = 256;
      var fc = face.getContext("2d");
      fc.drawImage(WOOD, 0, 0, 256, 256);
      fc.globalCompositeOperation = "multiply"; fc.fillStyle = color; fc.fillRect(0, 0, 256, 256);
      woodFaces[color] = face;
    }
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.drawImage(face, x, y, w, h); ctx.restore();
  }

  // a friendly crowd on the bleachers, in soft colours so the ball stays the
  // brightest thing on the court; they jump when a basket goes in
  var SKIN = ["#F2C9A5", "#D9A27A", "#A8714B", "#7A4E33", "#F7D7BD"], SHIRT = ["#FFB7B2", "#A8E1E8", "#FFE08A", "#C8B6FF", "#B9E8A4", "#FFD0A8"];
  function makeCrowd() {
    crowd = [];
    var rows = 3, per = Math.max(9, Math.round(W / 30));
    for (var r = 0; r < rows; r++) for (var i = 0; i < per; i++) {
      crowd.push({ r: r, u: (i + (r % 2 ? 0.5 : 0) + 0.2 * Math.sin(i * 7.3 + r)) / per, skin: SKIN[(i * 3 + r * 5) % SKIN.length], shirt: SHIRT[(i * 7 + r * 2) % SHIRT.length], ph: Math.random() * 6 });
    }
  }
  var GYM_ART = new Image(); GYM_ART.src = "/assets/crafted/game/hoops-gym.webp";
  function drawGym() {
    var floorY = project(0, 0, WALL_Z).y;
    var g;
    // the crafted gym wall (Travis, 1 Oct 2026: "new wall"): one painted picture
    // in place of the drawn wall, bleachers, crowd and bunting; the drawn wall
    // until it loads. The floor below stays drawn: it carries the court lines.
    if (GYM_ART.complete && GYM_ART.naturalWidth) {
      var sc = Math.max(W / GYM_ART.naturalWidth, floorY / GYM_ART.naturalHeight), gw = GYM_ART.naturalWidth * sc, gh = GYM_ART.naturalHeight * sc;
      ctx.drawImage(GYM_ART, (W - gw) / 2, floorY - gh, gw, gh);
    } else {
    g = ctx.createLinearGradient(0, 0, 0, floorY);
    g.addColorStop(0, "#FFF8E9"); g.addColorStop(1, "#EEDDC0");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, floorY + 1);
    timber(0, 0, W, floorY, "#f2e4cd", 0.18);
    // Broad pools of warm light across the upper gym, behind the moving hoop.
    var light = ctx.createRadialGradient(W * 0.5, -H * 0.1, 0, W * 0.5, 0, W * 0.85);
    light.addColorStop(0, "rgba(255,255,241,.75)"); light.addColorStop(1, "rgba(255,250,228,0)");
    ctx.fillStyle = light; ctx.fillRect(0, 0, W, floorY);
    // bleachers and the crowd
    var seatTop = project(0, 2.05, WALL_Z).y, seatBot = project(0, 1.3, WALL_Z).y, rowH = (seatBot - seatTop) / 3;
    for (var r = 0; r < 3; r++) {
      var sy = seatTop + r * rowH;
      ctx.fillStyle = r % 2 ? "#c69c68" : "#dcb581"; ctx.fillRect(0, sy, W, rowH);
      timber(0, sy, W, rowH, "#d5b183", 0.65);
      ctx.fillStyle = "rgba(105,66,30,.24)"; ctx.fillRect(0, sy + rowH - 3, W, 3);
    }
    var jump = Math.max(0, 1 - (clock - cheerAt) / 1.2), hr = Math.max(4, rowH * 0.3);
    crowd.forEach(function (c) {
      var x = c.u * W, base = seatTop + (c.r + 1) * rowH, hop = jump > 0 ? Math.abs(Math.sin((clock - cheerAt) * 9 + c.ph)) * rowH * 0.45 * jump : Math.sin(clock * 1.3 + c.ph) * 0.8;
      var y = base - hop;
      ctx.fillStyle = c.shirt; rr(x - hr * 1.15, y - hr * 1.5, hr * 2.3, hr * 1.9, hr * 0.7); ctx.fill();
      ctx.fillStyle = c.skin; ctx.beginPath(); ctx.arc(x, y - hr * 2.1, hr, 0, Math.PI * 2); ctx.fill();
      if (jump > 0.1) { ctx.strokeStyle = c.skin; ctx.lineWidth = Math.max(2, hr * 0.45); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x - hr, y - hr * 1.2); ctx.lineTo(x - hr * 1.6, y - hr * 2.8); ctx.moveTo(x + hr, y - hr * 1.2); ctx.lineTo(x + hr * 1.6, y - hr * 2.8); ctx.stroke(); ctx.lineCap = "butt"; }
    });
    // the painted band under the bleachers, and soft wall pads below it
    var band = project(0, 1.2, WALL_Z).y, band2 = project(0, 1.02, WALL_Z).y;
    ctx.fillStyle = "#d6a76c"; ctx.fillRect(0, band, W, band2 - band);
    ctx.fillStyle = "#509795"; ctx.fillRect(0, band2, W, Math.max(2, (band2 - band) * 0.4));
    var padTop = band2 + Math.max(2, (band2 - band) * 0.4) + 6, padH = floorY - padTop - 4, padW = W / 6;
    if (padH > 12) for (var pi = 0; pi < 7; pi++) {
      var padX = pi * padW - padW * 0.5 + 3;
      ctx.fillStyle = "#508e8a"; rr(padX, padTop + 3, padW - 6, padH, 7); ctx.fill();
      ctx.fillStyle = pi % 2 ? "#86bdb2" : "#96c8b7"; rr(padX, padTop, padW - 6, padH - 3, 7); ctx.fill();
      ctx.strokeStyle = "rgba(237,253,229,.45)"; ctx.lineWidth = 1; rr(padX + 3, padTop + 3, padW - 12, padH - 9, 4); ctx.stroke();
    }
    // bunting along the top
    var by = H * 0.03, cols = ["#ed8572", "#eabf5a", "#60aaa5", "#a98ac8", "#a9c575"], sag = H * 0.045;
    ctx.strokeStyle = "rgba(90,60,30,.35)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-10, by); ctx.quadraticCurveTo(W / 2, by + sag * 2, W + 10, by); ctx.stroke();
    for (var i = 0; i < 12; i++) {
      var t = (i + 0.5) / 12, x = -10 + (W + 20) * t, y = by + sag * 4 * t * (1 - t), s = Math.max(6, W * 0.026);
      ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.6); ctx.closePath(); ctx.fill();
    }
    }
    // the floor: wood running toward the hoop, a teal key, white lines
    var near = 1.0, wallP = project(0, 0, WALL_Z);
    // the painted floor (4 Oct 2026), stretched to the floor's strip; the
    // drawn planks and key until it loads
    if (FLOOR_ART.complete && FLOOR_ART.naturalWidth) { ctx.drawImage(FLOOR_ART, 0, wallP.y, W, H - wallP.y); return; }
    g = ctx.createLinearGradient(0, wallP.y, 0, H);
    g.addColorStop(0, "#c29459"); g.addColorStop(1, "#f0c78b");
    ctx.fillStyle = g; ctx.fillRect(0, wallP.y, W, H - wallP.y);
    timber(0, wallP.y, W, H - wallP.y, "#e8bd7e", 0.78);
    // Staggered plank ends recede into the same projected court.
    ctx.strokeStyle = "rgba(128,80,36,.18)"; ctx.lineWidth = 1;
    for (var plank = -6; plank < 6; plank += 0.45) for (var z = 1.1; z < WALL_Z; z += 0.9) {
      var endZ = z + (Math.round(plank / 0.45) % 2) * 0.4;
      if (endZ < 1 || endZ > WALL_Z) continue;
      var pa = project(plank, 0, endZ), pb = project(plank + 0.45, 0, endZ);
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(160,95,35,.2)"; ctx.lineWidth = 1;
    for (var px = -6; px <= 6; px += 0.45) { var a = project(px, 0, near), b = project(px, 0, WALL_Z); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    var key = [project(-0.95, 0, near), project(0.95, 0, near), project(0.95, 0, WALL_Z - 0.25), project(-0.95, 0, WALL_Z - 0.25)];
    poly(key); ctx.fillStyle = "#84bdb5"; ctx.fill();
    ctx.save(); poly(key); ctx.clip(); timber(0, wallP.y, W, H - wallP.y, "#8dc2b6", 0.75); ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 1;
    for (var kx = -0.9; kx <= 0.9; kx += 0.45) { var ka = project(kx, 0, near), kb = project(kx, 0, WALL_Z); ctx.beginPath(); ctx.moveTo(ka.x, ka.y); ctx.lineTo(kb.x, kb.y); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2; poly(key); ctx.stroke();
    ctx.strokeStyle = "rgba(120,70,25,.3)"; ctx.beginPath(); ctx.moveTo(0, wallP.y); ctx.lineTo(W, wallP.y); ctx.stroke();
  }

  function drawRig() {
    // the arm the backboard hangs from; the hoop glides along the ceiling
    var top = project(hoopX, BOARD_TOP, BOARD_Z), w = Math.max(6, 0.09 * top.s);
    ctx.fillStyle = "#71624c"; ctx.fillRect(top.x - w / 2, -2, w, top.y + 4);
    ctx.fillStyle = "#b5a084"; ctx.fillRect(top.x - w / 2 + 1, -2, Math.max(1, w * 0.3), top.y + 4);
  }
  // the painted backboard (frame, board and square), fitted to the board's
  // corners; the drawn one until it loads
  var FLOOR_ART = new Image(); FLOOR_ART.src = "/assets/crafted/game/hoops-floor.webp";
  var BOARD_ART = new Image(); BOARD_ART.src = "/assets/crafted/game/hoops-board.webp";
  function drawBoard() {
    var c = [project(hoopX - BOARD_W / 2, BOARD_TOP, BOARD_Z), project(hoopX + BOARD_W / 2, BOARD_TOP, BOARD_Z), project(hoopX + BOARD_W / 2, BOARD_BOTTOM, BOARD_Z), project(hoopX - BOARD_W / 2, BOARD_BOTTOM, BOARD_Z)];
    if (BOARD_ART.complete && BOARD_ART.naturalWidth) {
      ctx.save(); ctx.shadowColor = "rgba(90,60,30,.18)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
      ctx.drawImage(BOARD_ART, c[0].x, c[0].y, c[1].x - c[0].x, c[2].y - c[0].y); ctx.restore();
      var a1 = project(hoopX, RIM_Y, BOARD_Z), a2 = project(hoopX, RIM_Y, HOOP_Z + RIM_R);
      ctx.strokeStyle = "#D93F32"; ctx.lineWidth = Math.max(3, a1.s * 0.05); ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(a2.x, a2.y); ctx.stroke();
      return;
    }
    ctx.save(); ctx.shadowColor = "rgba(90,60,30,.18)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    poly(c); ctx.fillStyle = "#fff4db"; ctx.fill(); ctx.restore();
    ctx.save(); poly(c); ctx.clip();
    timber(c[0].x, c[0].y, c[1].x - c[0].x, c[2].y - c[0].y, "#fff3dc", 0.9);
    var glow = ctx.createLinearGradient(0, c[0].y, 0, c[2].y);
    glow.addColorStop(0, "rgba(255,255,255,.25)"); glow.addColorStop(1, "rgba(166,117,65,.08)");
    ctx.fillStyle = glow; ctx.fillRect(c[0].x, c[0].y, c[1].x - c[0].x, c[2].y - c[0].y);
    ctx.restore();
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(6, c[0].s * 0.09); ctx.strokeStyle = "#98613d"; poly(c); ctx.stroke();
    ctx.lineWidth = Math.max(4, c[0].s * 0.06); ctx.strokeStyle = "#d6a46b"; poly(c); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = "#f6d69e"; poly(c); ctx.stroke();
    // Tiny inset brass pins in the same backboard silhouette.
    c.forEach(function (corner, index) {
      var bx = corner.x + (index === 0 || index === 3 ? 6 : -6), by = corner.y + (index < 2 ? 6 : -6);
      ctx.fillStyle = "#a27648"; ctx.beginPath(); ctx.arc(bx, by, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f6dcaa"; ctx.beginPath(); ctx.arc(bx - 0.4, by - 0.5, 0.65, 0, Math.PI * 2); ctx.fill();
    });
    ctx.strokeStyle = "#cf7255";
    var s = [project(hoopX - 0.3, RIM_Y + 0.45, BOARD_Z), project(hoopX + 0.3, RIM_Y + 0.45, BOARD_Z), project(hoopX + 0.3, RIM_Y + 0.03, BOARD_Z), project(hoopX - 0.3, RIM_Y + 0.03, BOARD_Z)];
    ctx.lineWidth = Math.max(2.5, c[0].s * 0.04); poly(s); ctx.stroke(); ctx.lineJoin = "miter";
    var b1 = project(hoopX, RIM_Y, BOARD_Z), b2 = project(hoopX, RIM_Y, HOOP_Z + RIM_R);
    ctx.strokeStyle = "#D93F32"; ctx.lineWidth = Math.max(3, b1.s * 0.05); ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
  }

  // the rim and net, split into the half behind the ball and the half in front
  function ring(y, r, n, x0) { var out = []; for (var i = 0; i <= n; i++) { var a = (i / n) * Math.PI * 2; out.push({ a: a, p: project(x0 + Math.cos(a) * r, y, HOOP_Z + Math.sin(a) * r) }); } return out; }
  function drawNet(front) {
    var n = 14, drop = 0.42 + net.stretch * 0.24, top = ring(RIM_Y - 0.01, RIM_R * 0.97, n, hoopX);
    var mid = ring(RIM_Y - drop * 0.5, RIM_R * (0.8 - net.stretch * 0.08), n, hoopX + net.sway * 0.03);
    var bot = ring(RIM_Y - drop, RIM_R * (0.56 - net.stretch * 0.12), n, hoopX + net.sway * 0.06);
    ctx.save(); ctx.lineCap = "round";
    ctx.strokeStyle = front ? "#fff7dd" : "#c5bda0"; ctx.lineWidth = Math.max(1.4, top[0].p.s * 0.015);
    ctx.shadowColor = "rgba(75,55,30,.32)"; ctx.shadowOffsetY = 1; ctx.shadowBlur = 1;
    for (var i = 0; i < n; i++) {
      if ((Math.sin(top[i].a + Math.PI / n) < 0) !== front) continue;
      ctx.beginPath(); ctx.moveTo(top[i].p.x, top[i].p.y); ctx.lineTo(mid[i + 1].p.x, mid[i + 1].p.y); ctx.lineTo(bot[i].p.x, bot[i].p.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(top[i + 1].p.x, top[i + 1].p.y); ctx.lineTo(mid[i].p.x, mid[i].p.y); ctx.lineTo(bot[i + 1].p.x, bot[i + 1].p.y); ctx.stroke();
    }
    ctx.restore();
  }
  function drawRim(front) {
    var pts = ring(RIM_Y, RIM_R, 48, hoopX);
    ctx.strokeStyle = front ? "#d7663e" : "#964927"; ctx.lineWidth = Math.max(3, pts[0].p.s * TUBE * 2.3); ctx.lineCap = "round";
    ctx.beginPath();
    var on = false;
    for (var i = 0; i < pts.length; i++) {
      if ((Math.sin(pts[i].a) < 0) === front) { if (!on) { ctx.moveTo(pts[i].p.x, pts[i].p.y); on = true; } else ctx.lineTo(pts[i].p.x, pts[i].p.y); }
      else on = false;
    }
    ctx.stroke();
    if (front) { ctx.lineWidth = Math.max(1, pts[0].p.s * TUBE * 0.65); ctx.strokeStyle = "#ffbd79"; ctx.stroke(); }
    ctx.lineCap = "butt";
  }

  var BALL_ART = new Image(); BALL_ART.src = "/assets/crafted/game/ball.webp";
  function drawBall(b) {
    var p = project(b.x, b.y, b.z), r = BALL_R * p.s;
    if (r <= 0.5) return;
    var sh = project(b.x, 0.001, b.z);
    if (sh.y < H + r && b.z > 0.9) { ctx.fillStyle = "rgba(90,50,15," + Math.max(0, 0.26 - b.y * 0.05).toFixed(3) + ")"; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, r * 1.05, r * 0.3, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.translate(p.x, p.y);
    // the crafted ball (1 Oct 2026), turning with the spin; the drawn one until it loads
    if (BALL_ART.complete && BALL_ART.naturalWidth) { ctx.rotate(b.spin || 0); ctx.drawImage(BALL_ART, -r, -r, r * 2, r * 2); ctx.restore(); return; }
    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, "#ffbb63"); g.addColorStop(0.5, "#eb8935"); g.addColorStop(0.85, "#c25d25"); g.addColorStop(1, "#8e3e20");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
    ctx.rotate(b.spin || 0);
    // Pebbled leather follows the ball's rotation; no glossy plastic highlight.
    for (var dy = -0.9; dy <= 0.9; dy += 0.15) for (var dx = -0.9; dx <= 0.9; dx += 0.15) {
      var sx = dx + (Math.round(dy / 0.15) % 2) * 0.07;
      if (sx * sx + dy * dy > 0.92) continue;
      var pebble = Math.max(0.5, r * 0.023);
      ctx.fillStyle = "rgba(105,43,15,.24)"; ctx.beginPath(); ctx.arc(sx * r, dy * r, pebble, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,219,139,.24)"; ctx.beginPath(); ctx.arc(sx * r - pebble * 0.3, dy * r - pebble * 0.5, pebble * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "rgba(95,38,12,.8)"; ctx.lineWidth = Math.max(1, r * 0.075);
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
    ctx.beginPath(); ctx.arc(-r * 1.25, 0, r * 0.95, -0.9, 0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 1.25, 0, r * 0.95, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = "rgba(91,39,19,.4)"; ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.beginPath(); ctx.arc(p.x, p.y, r - 0.5, 0, Math.PI * 2); ctx.stroke();
  }

  function drawFx(dt) {
    for (var i = fx.length - 1; i >= 0; i--) {
      var f = fx[i]; f.t += dt;
      if (f.t > f.life) { fx.splice(i, 1); continue; }
      var k = f.t / f.life;
      if (f.kind === "spark") {
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt;
        ctx.globalAlpha = Math.max(0, 1 - k); ctx.fillStyle = f.c;
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.t * 6); var s = f.s * (1 - k * 0.5);
        ctx.beginPath(); for (var j = 0; j < 10; j++) { var rad = j % 2 ? s * 0.45 : s, an = -Math.PI / 2 + j * Math.PI / 5; ctx.lineTo(Math.cos(an) * rad, Math.sin(an) * rad); } ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.globalAlpha = 1;
      } else if (f.kind === "word") {
        var pop = k < 0.15 ? 0.4 + (k / 0.15) * 0.8 : k < 0.25 ? 1.2 - (k - 0.15) * 2 : 1;
        ctx.globalAlpha = k > 0.75 ? Math.max(0, (1 - k) / 0.25) : 1;
        ctx.save(); ctx.translate(f.x, f.y - k * 16); ctx.scale(pop, pop); ctx.rotate(-0.06);
        ctx.font = "800 " + Math.round(Math.max(26, W * (f.big ? 0.12 : 0.085))) + "px 'Baloo 2', Nunito, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineJoin = "round"; ctx.lineWidth = 8; ctx.strokeStyle = "#fff"; ctx.strokeText(f.text, 0, 0); ctx.fillStyle = f.c; ctx.fillText(f.text, 0, 0); ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
  }
  function burst(x, y, n) {
    var cols = ["#FFD21C", "#FF6B6B", "#34BFCF", "#8A6FF2", "#58CC02"];
    for (var i = 0; i < (n || 18); i++) { var a = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 170; fx.push({ kind: "spark", x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 130, s: 5 + Math.random() * 6, c: cols[i % cols.length], t: 0, life: 0.9 + Math.random() * 0.4 }); }
  }
  // The court's cheers are the action teal (/action.css --act, read once at
  // init): orange now means only the practice sound's letters (design brief,
  // 28 Sep 2026), and the ball is the one orange thing on the court.
  var SHOUT = "#1FA6B8";
  function shout(text, c, big, where) { var p = where || project(hoopX, RIM_Y - 1.0, HOOP_Z); fx.push({ kind: "word", text: text, x: p.x, y: p.y, c: c || SHOUT, t: 0, life: big ? 2.4 : 1.3, big: big }); }

  // How to shoot, shown on the first ball and again whenever the ball has sat
  // in the child's hand for a while: a fingertip sliding up from the ball.
  function drawHint() {
    if (state !== "ready") return;
    var since = clock - hintAt; if (shots > 0 && since < 4) return;
    var p = project(HAND.x, HAND.y, HAND.z), k = (since % 1.5) / 1.5, rise = Math.min(H * 0.3, 150);
    var y = p.y + 10 - k * rise, a = k < 0.15 ? k / 0.15 : k > 0.75 ? Math.max(0, (1 - k) / 0.25) : 1;
    ctx.globalAlpha = a * 0.55; ctx.strokeStyle = "#fff"; ctx.lineWidth = 10; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(p.x + 26, p.y + 10); ctx.lineTo(p.x + 26, y); ctx.stroke(); ctx.lineCap = "butt";
    ctx.globalAlpha = a; ctx.fillStyle = "#fff"; ctx.strokeStyle = "#1D2B4F"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x + 26, y, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // after two misses the hoop stops, glows, and an arrow points the way
  function drawGuide() {
    if (state !== "ready" || misses < 2) return;
    var k = (clock * 1.6) % 1, rim = ring(RIM_Y, RIM_R * (1.15 + k * 0.5), 40, hoopX);
    ctx.strokeStyle = "rgba(255,210,28," + (0.85 * (1 - k)).toFixed(2) + ")"; ctx.lineWidth = Math.max(3, rim[0].p.s * 0.06);
    ctx.beginPath(); rim.forEach(function (q, i) { if (i) ctx.lineTo(q.p.x, q.p.y); else ctx.moveTo(q.p.x, q.p.y); }); ctx.stroke();
    var a = project(HAND.x, HAND.y + 0.35, HAND.z), b = project(hoopX, RIM_Y - 0.55, HOOP_Z), t = 0.35 + 0.1 * Math.sin(clock * 5);
    var tipX = a.x + (b.x - a.x) * t, tipY = a.y + (b.y - a.y) * t, ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.setLineDash([2, 14]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(tipX, tipY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(tipX + Math.cos(ang) * 16, tipY + Math.sin(ang) * 16);
    ctx.lineTo(tipX + Math.cos(ang + 2.4) * 14, tipY + Math.sin(ang + 2.4) * 14); ctx.lineTo(tipX + Math.cos(ang - 2.4) * 14, tipY + Math.sin(ang - 2.4) * 14); ctx.closePath(); ctx.fill();
    ctx.lineCap = "butt";
  }

  function frame(now) {
    raf = 0; if (!running) return;
    var dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
    if (!frozen) { clock += dt; step(dt); }
    render(frozen ? 0 : dt);
    raf = requestAnimationFrame(frame);
  }
  function render(dt) {
    ctx.clearRect(0, 0, W, H);
    drawGym(); drawRig(); drawBoard();
    // the ball is behind the front of the rim only while it is inside or past it
    var inside = ball && ball.z > HOOP_Z - RIM_R * 0.6 && ball.y < RIM_Y + BALL_R;
    drawRim(false); drawNet(false);
    if (ball && inside) drawBall(ball);
    drawNet(true); drawRim(true);
    if (ball && !inside) drawBall(ball);
    drawGuide(); drawHint(); drawFx(dt);
  }

  // ── physics ──
  function idealVelocity(tx, from) {
    var o = from || HAND, dy = RIM_Y + 0.02 - o.y;
    return { x: (tx - o.x) / FLIGHT, y: (dy + 0.5 * GRAV * FLIGHT * FLIGHT) / FLIGHT, z: (HOOP_Z - o.z) / FLIGHT };
  }
  function step(dt) {
    if (hoopMoving()) hoopClock += dt;
    hoopX += (hoopTarget(hoopClock) - hoopX) * Math.min(1, dt * 6);
    net.stretch = Math.max(0, net.stretch - dt * 1.6);
    net.swayV += (-net.sway * 40 - net.swayV * 6) * dt; net.sway += net.swayV * dt;
    if (doneAt && clock >= doneAt) { doneAt = 0; if (api) api.done(); }
    if (!ball) return;
    if (state === "drop" || state === "back") {
      ball.k = Math.min(1, ball.k + dt / (state === "drop" ? 0.55 : 0.6));
      var e = 1 - Math.pow(1 - ball.k, 3);
      ball.x = ball.fx + (HAND.x - ball.fx) * e; ball.y = ball.fy + (HAND.y - ball.fy) * e + Math.sin(ball.k * Math.PI) * 0.25; ball.z = ball.fz + (HAND.z - ball.fz) * e;
      ball.spin += dt * 6;
      if (ball.k >= 1) { state = "ready"; ball.x = HAND.x; ball.y = HAND.y; ball.z = HAND.z; hintAt = clock; publish(); }
      return;
    }
    if (state === "ready") { if (!touch) { ball.x += (HAND.x - ball.x) * Math.min(1, dt * 12); ball.y += (HAND.y + Math.sin(clock * 3) * 0.012 - ball.y) * Math.min(1, dt * 12); } return; }
    if (state !== "flying" && state !== "scored") return;
    var n = 8, h = dt / n;
    for (var i = 0; i < n && ball; i++) sub(h);
    if (!ball) return;
    ball.spin += dt * ball.spinV; ball.age += dt;
    if (state === "flying") publish();
    if (state === "flying" && (ball.bounces >= 2 || ball.age > 3.2 || ball.z > WALL_Z || ball.z < -1 || Math.abs(ball.x) > 5)) missed();
    else if (state === "scored" && (ball.y < 0.5 || ball.age > 3.5)) { ball = null; state = "idle"; publish(); }
  }
  function sub(h) {
    var b = ball, py = b.y;
    b.vy -= GRAV * h;
    b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
    // a made ball: the net catches it, funnels it and lets it drop
    if (state === "scored" && b.y < RIM_Y && b.y > RIM_Y - 0.55) {
      b.vx += (hoopX - b.x) * 30 * h; b.vz += (HOOP_Z - b.z) * 30 * h; b.vx *= 1 - 3 * h; b.vz *= 1 - 3 * h; b.vy *= 1 - 2.4 * h;
      return;
    }
    // the backboard
    if (b.vz > 0 && b.z + BALL_R > BOARD_Z && b.z + BALL_R - b.vz * h <= BOARD_Z && Math.abs(b.x - hoopX) < BOARD_W / 2 && b.y > BOARD_BOTTOM - 0.1 && b.y < BOARD_TOP) {
      b.z = BOARD_Z - BALL_R; b.vz = -b.vz * 0.55; b.board = true; sound("clank");
    }
    // the rim: a thin ring the ball bounces off
    var qx = b.x - hoopX, qz = b.z - HOOP_Z, ql = Math.sqrt(qx * qx + qz * qz) || 1e-6;
    var cx = hoopX + qx / ql * RIM_R, cz = HOOP_Z + qz / ql * RIM_R;
    var nx = b.x - cx, ny = b.y - RIM_Y, nz = b.z - cz, d = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (d < BALL_R + TUBE && d > 0) {
      nx /= d; ny /= d; nz /= d;
      var vn = b.vx * nx + b.vy * ny + b.vz * nz;
      if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny; b.vz -= 1.5 * vn * nz; b.rim = true; if (vn < -0.8) sound("clank"); }
      var push = BALL_R + TUBE - d; b.x += nx * push; b.y += ny * push; b.z += nz * push;
    }
    // through the hoop: the centre crosses the rim's height going down, inside the ring
    if (state === "flying" && py >= RIM_Y && b.y < RIM_Y && b.vy < 0 && ql < RIM_R - BALL_R * 0.35) { scored(); return; }
    if (b.y < BALL_R) { b.y = BALL_R; if (b.vy < 0) { b.vy = -b.vy * 0.5; b.vx *= 0.8; b.vz *= 0.8; b.bounces++; if (b.bounces < 3) sound("bounce"); } }
  }
  function sound(name) { if (api && api.sfx) try { api.sfx(name); } catch (e) {} }

  function scored() {
    state = "scored"; baskets++; misses = 0; net.stretch = 1; net.swayV = ball.vx * 3;
    var p = project(hoopX, RIM_Y - 0.15, HOOP_Z);
    burst(p.x, p.y);
    lastShot = ball.board ? "bank" : ball.rim ? "rim" : "swish";
    shout(lastShot === "swish" ? "SWISH!" : lastShot === "bank" ? "Bank shot!" : "It's in!");
    sound("swish");
    cheerAt = clock;
    try { api.cheer(lastShot === "swish" ? "Swish!" : "Basket!"); api.hint(""); if (api.face) api.face("cheer"); } catch (e) {}
    // Echo on the court cheers for the length of his hop, then rests again
    try { var e = document.getElementById("courtEcho"); if (e) { e.classList.remove("hop"); void e.offsetWidth; e.classList.add("hop");
      e.src = "/assets/crafted/echo-cheer.webp"; clearTimeout(scored.t); scored.t = setTimeout(function () { e.src = "/assets/crafted/echo-welcome.webp"; }, 900); } } catch (x) {}
    // the next word waits for the celebration, on the game's own clock, so a
    // pause in between holds it rather than skipping it
    doneAt = clock + 1.15;
    publish();
  }
  function missed() {
    misses++; state = "back";
    try { api.cheer(misses >= 3 ? "Nearly!" : "So close!"); api.hint(misses >= 2 ? "Aim for the hoop!" : "Try again!"); if (api.face) api.face("think"); } catch (e) {}
    ball.fx = Math.max(-1.2, Math.min(1.2, ball.x)); ball.fy = -0.35; ball.fz = HAND.z; ball.k = 0;
    publish();
  }

  // ── the flick ──
  var touch = null;
  function pointFrom(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; }
  function down(e) {
    if (frozen || !running || state !== "ready") return;
    var p = pointFrom(e);
    if (p.y < H * 0.38) return;                     // shots start low, near the ball
    touch = { pts: [p] };
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
  }
  function move(e) {
    if (!touch) return; var q = pointFrom(e); touch.pts.push(q); if (touch.pts.length > 40) touch.pts.shift(); e.preventDefault();
    // the ball comes a little way with the finger (only up, and not far)
    var p0 = touch.pts[0], hand = project(HAND.x, HAND.y, HAND.z);
    var gx = Math.max(-0.35, Math.min(0.35, (q.x - p0.x) / hand.s)), gy = Math.max(0, Math.min(0.45, (p0.y - q.y) / hand.s));
    if (ball && state === "ready") { ball.x = HAND.x + gx * 0.6; ball.y = HAND.y + gy * 0.6; }
  }
  function up(e) {
    if (!touch) return;
    var pts = touch.pts; pts.push(pointFrom(e)); touch = null;
    if (state !== "ready" || frozen) return;
    var end = pts[pts.length - 1], from = pts[0];
    // the last tenth of a second of the swipe is the flick
    for (var i = pts.length - 1; i >= 0; i--) { if (end.t - pts[i].t > 110) break; from = pts[i]; }
    var dy = end.y - from.y, dt = Math.max(16, end.t - from.t);
    var up = pts[0].y - end.y, side = end.x - pts[0].x;
    if (up < Math.max(24, H * 0.05) || dy > -2) { hintAt = clock - 9; try { api.hint("Swipe up to shoot!"); } catch (x) {} return; }
    shoot(side / up, -dy / dt, up);
  }
  // A child's flick, read kindly: a flick up, about the right strength and
  // near the hoop, is shot as a good one. The help widens after each miss,
  // and from the third miss on any flick up goes in.
  // aim: sideways per unit up, over the whole swipe; speed: px/ms at the end;
  // up: how far up the swipe went. A quick flick and a long slow push both
  // read as a throw — small hands do either.
  function shoot(aim, speed, up) {
    var screenH = window.innerHeight || 800;
    var power = Math.max((speed / (screenH / 800)) / 1.4, up / (screenH * 0.3));
    var hx = hoopAt(FLIGHT), now = hoopX, aimedX = HAND.x + aim * 2.4;
    var tol = [0.55, 0.8, 1.4][Math.min(misses, 2)], lo = [0.45, 0.35, 0.25][Math.min(misses, 2)], hi = [2.0, 2.6, 3.2][Math.min(misses, 2)];
    // a child aims where they see the hoop; the ball is sent where it will be
    var off = Math.min(Math.abs(aimedX - hx), Math.abs(aimedX - now)), onLine = off < tol;
    var x = aimedX + (hx - now), pw = Math.max(0.35, Math.min(1.9, power)), good = misses >= 3 || (onLine && power >= lo && power <= hi);
    if (good) { x = hx + (misses >= 3 ? 0 : Math.max(-0.12, Math.min(0.12, (aimedX - now) * 0.18))); pw = 1; }
    else if (onLine && power >= lo * 0.7 && power < lo) { x = hx; pw = 0.9; }    // just short: the front of the rim
    else if (onLine && power > hi && power <= hi * 1.3) { x = hx; pw = 1.12; }   // just long: off the board
    var from = ball ? { x: ball.x, y: ball.y, z: HAND.z } : HAND, v = idealVelocity(x, from);
    ball = { x: from.x, y: from.y, z: from.z, vx: v.x, vy: v.y * Math.sqrt(pw), vz: v.z * pw, spin: ball ? ball.spin : 0, spinV: -8 - Math.random() * 4, bounces: 0, age: 0, rim: false, board: false, good: good };
    state = "flying"; shots++;
    lastFlick = { power: +power.toFixed(3), aimedX: +aimedX.toFixed(3), hx: +hx.toFixed(3), good: good, pw: pw };
    sound("whoosh");
    try { api.hint(""); api.cheer(""); } catch (e) {}
    publish();
  }
  function hoopAt(dt) { return hoopTarget(hoopClock + dt); }

  // ── what the engine calls ──
  function publish() {
    try { window.__hoops = { state: state, baskets: baskets, misses: misses, shots: shots, lastShot: lastShot, hoopX: +hoopX.toFixed(3), count: count, frozen: frozen, flick: lastFlick,
      ball: ball && state === "flying" ? { y: +ball.y.toFixed(3), z: +ball.z.toFixed(3) } : null }; } catch (e) {}
  }
  var Hoops = {
    init: function (engineApi, n) {
      api = engineApi; count = n || 8;
      try { SHOUT = getComputedStyle(document.documentElement).getPropertyValue("--act").trim() || SHOUT; } catch (e) {}
      cv = document.getElementById("court"); ctx = cv.getContext("2d");
      resize(); window.addEventListener("resize", resize);
      cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move);
      cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", function () { touch = null; });
      // no finger? Space or the up arrow shoots at the hoop — once a word has
      // earned the ball, like a swipe
      document.addEventListener("keydown", function (e) {
        if ((e.key === " " || e.key === "ArrowUp") && state === "ready" && !frozen && running) { e.preventDefault(); shoot((hoopX - HAND.x) / 2.4, 1.4 * ((window.innerHeight || 800) / 800), 0); }
      });
      hoopPhase = Math.random() * Math.PI * 2;
      running = true; lastT = performance.now(); raf = requestAnimationFrame(frame);
      publish();
    },
    // the engine heard the word: a ball drops into the child's hands
    onWord: function () {
      misses = 0;
      ball = { fx: HAND.x, fy: HAND.y + 2.3, fz: HAND.z + 0.7, x: HAND.x, y: HAND.y + 2.3, z: HAND.z + 0.7, k: 0, spin: 0 };
      state = "drop"; sound("drop");
      try { api.hint("Swipe up to shoot!"); } catch (e) {}
      publish();
    },
    pause: function () { frozen = true; touch = null; publish(); },
    resume: function () { frozen = false; lastT = performance.now(); publish(); },
    reset: function () { baskets = 0; misses = 0; shots = 0; ball = null; state = "idle"; fx = []; lastShot = ""; doneAt = 0; publish(); },
    finale: function () {
      cheerAt = clock + 0.2;
      var p = project(hoopX, RIM_Y, HOOP_Z);
      burst(p.x, p.y, 24); burst(W * 0.25, H * 0.45, 16); burst(W * 0.75, H * 0.45, 16);
      shout(count + " baskets!", null, true, { x: W / 2, y: H * 0.56 });
    },
    snapshot: function () { return window.__hoops; },
  };
  window.Hoops = Hoops;
})();
