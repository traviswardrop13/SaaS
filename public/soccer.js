/* Soccer Goal: the second Say & Play game rebuilt to be played (Travis, 1 Oct
   2026: "go finish soccer", to the plan: a goalie slides side to side in front
   of the net; the child says the word and a ball rolls to them; they swipe to
   kick; past the goalie is a GOAL, a save sends the ball back to kick again
   with no new word; after a miss the goalie slows, after two he dozes off;
   eight words, eight goals, then a trophy).

   sayplay.js still owns every word turn, the mic and its quiet rules, the
   start card, pausing and the end card. This file is the pitch: it draws the
   stadium, moves the goalie and flies the ball. It never touches the mic.

   THE WORD EARNS THE BALL; THE FINGER KICKS IT. A swipe with no ball on the
   spot does nothing, a ball arrives only when the engine has heard the word
   (onWord), and a save or a wide kick never costs a word: the ball comes back
   and the child kicks again. Every ball ends in a goal, because the help grows
   with each miss until the next kick cannot miss — the last thing a child
   does is score (Rachel's rule: end every round on a success).

   Its pictures are drawn here, plainly, until the art arrives. When the
   goalie's painted picture lands (a friendly bear keeper standing ready,
   transparent, feet at the bottom), set KEEPER_PIC to its address below and
   it is drawn in place of the drawn bear; nothing else changes.

   Nothing here is practice data: no attempt, rep, coin or sticker is written. */
(function () {
  "use strict";
  var api = null, cv = null, ctx = null, W = 0, H = 0, DPR = 1, F = 1, CX = 0, CY = 0;
  var raf = 0, lastT = 0, clock = 0, running = false, frozen = false;

  // ── the world, in metres. The camera stands behind the ball, a little above
  // it, looking down the pitch at the goal.
  var CAM = { x: 0, y: 1.3, z: -2.0, pitch: -3 * Math.PI / 180 };
  var COSP = Math.cos(CAM.pitch), SINP = Math.sin(CAM.pitch);
  var BALL_R = 0.11, SPOT = { x: 0, y: 0.11, z: 0.5 };
  // a goal sized for a small child's eye: nearer and chunkier than a real one,
  // so the goalie is big enough to read at a glance
  var GOAL_Z = 6.3, GOAL_HALF = 2.2, GOAL_H = 2.0, NET_D = 1.2, POST = 0.07;
  var KEEPER_Z = GOAL_Z - 0.45, KEEPER_H = 1.45;
  var FLIGHT = 0.85;                      // seconds from the spot to the goal line

  // ── the game ──
  // state: idle (no ball: a word turn) | drop (the ball rolling to the spot) |
  // ready (on the spot) | flying | scored | saved | back (a missed ball
  // rolling back to the spot)
  var state = "idle", ball = null, goals = 0, count = 8, misses = 0, kicks = 0, lastKick = "";
  var keeperX = 0, keeperPhase = 0, keeperClock = 0, dive = null, net = { bulge: 0, x: 0, y: 1 }, fx = [];
  var hintAt = 0, doneAt = 0, cheerAt = -9, crowd = [], lastSwipe = null, napSide = 1;

  function project(x, y, z) {
    var dx = x - CAM.x, dy = y - CAM.y, dz = z - CAM.z;
    var yy = dy * COSP - dz * SINP, zz = dy * SINP + dz * COSP;
    return { x: CX + F * dx / zz, y: CY - F * yy / zz, s: F / zz };
  }

  // The goalie stands off to one side for the first two goals, so the open
  // side is plain to see; then he slides from post to post, a little wider and
  // quicker later on. After a save he slows; after two misses he dozes off by
  // one post (napSide) and the open side glows. He holds still while the word
  // is being said and while a goal is cheered.
  function keeperMoving() { return misses < 2 && (state === "drop" || state === "ready" || state === "flying" || state === "back"); }
  function keeperTarget(t) {
    if (misses >= 2) return napSide * (GOAL_HALF - 0.85);
    if (goals < 2) return (goals === 0 ? -1 : 1) * 1.05 + 0.12 * Math.sin(t * 1.4);
    var amp = goals < 5 ? 1.25 : 1.6;
    var period = (goals < 5 ? 5.2 : 4.0) * (misses === 1 ? 2 : 1);
    return amp * Math.sin(keeperPhase + (t / period) * Math.PI * 2);
  }
  function keeperAt(dt) { return keeperTarget(keeperClock + dt); }
  // how far either side of his middle the keeper's gloves reach
  function reach() { return [0.78, 0.6, 0.45][Math.min(misses, 2)]; }

  // ── sizing ──
  function resize() {
    if (!cv) return;
    var r = cv.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // the goal mouth about three-quarters of the width, the ball near the bottom
    F = Math.min(W * 1.45, H * 1.14);
    CX = W / 2;
    CY = H * 0.27;
    makeCrowd();
  }

  // ── drawing ──
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function poly(pts) { ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath(); }
  function line(a, b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }

  // a friendly crowd in the stand, in soft colours so the ball stays the
  // brightest thing on the pitch; they jump when a goal goes in
  var SKIN = ["#F2C9A5", "#D9A27A", "#A8714B", "#7A4E33", "#F7D7BD"], SHIRT = ["#FFB7B2", "#A8E1E8", "#FFE08A", "#C8B6FF", "#B9E8A4", "#FFD0A8"];
  function makeCrowd() {
    crowd = [];
    var rows = 3, per = Math.max(9, Math.round(W / 28));
    for (var r = 0; r < rows; r++) for (var i = 0; i < per; i++) {
      crowd.push({ r: r, u: (i + (r % 2 ? 0.5 : 0) + 0.2 * Math.sin(i * 7.3 + r)) / per, skin: SKIN[(i * 3 + r * 5) % SKIN.length], shirt: SHIRT[(i * 7 + r * 2) % SHIRT.length], ph: (i * 1.7 + r) % 6 });
    }
  }
  function drawStadium() {
    var horizon = project(0, 0, GOAL_Z + NET_D + 5).y;
    // sky
    var g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, "#BFE6FA"); g.addColorStop(1, "#E9F7FF");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, horizon + 1);
    // the stand and its crowd
    var standTop = horizon - Math.max(30, H * 0.13), rowH = (horizon - standTop) / 3;
    ctx.fillStyle = "#5B7C9C"; ctx.fillRect(0, standTop - 6, W, horizon - standTop + 6);
    for (var r = 0; r < 3; r++) { ctx.fillStyle = r % 2 ? "#6E8FAE" : "#62839F"; ctx.fillRect(0, standTop + r * rowH, W, rowH); }
    var jump = Math.max(0, 1 - (clock - cheerAt) / 1.2), hr = Math.max(3.5, rowH * 0.28);
    crowd.forEach(function (c) {
      var x = c.u * W, base = standTop + (c.r + 1) * rowH - 1;
      var hop = jump > 0 ? Math.abs(Math.sin((clock - cheerAt) * 9 + c.ph)) * rowH * 0.45 * jump : Math.sin(clock * 1.3 + c.ph) * 0.7;
      var y = base - hop;
      ctx.fillStyle = c.shirt; rr(x - hr * 1.1, y - hr * 1.4, hr * 2.2, hr * 1.6, hr * 0.6); ctx.fill();
      ctx.fillStyle = c.skin; ctx.beginPath(); ctx.arc(x, y - hr * 2.0, hr, 0, Math.PI * 2); ctx.fill();
      if (jump > 0.1) { ctx.strokeStyle = c.skin; ctx.lineWidth = Math.max(2, hr * 0.45); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x - hr, y - hr * 1.1); ctx.lineTo(x - hr * 1.6, y - hr * 2.7); ctx.moveTo(x + hr, y - hr * 1.1); ctx.lineTo(x + hr * 1.6, y - hr * 2.7); ctx.stroke(); ctx.lineCap = "butt"; }
    });
    // bunting along the top of the stand
    var cols = ["#ed8572", "#eabf5a", "#60aaa5", "#a98ac8", "#a9c575"], by = standTop - 8, sag = H * 0.025;
    ctx.strokeStyle = "rgba(60,60,80,.3)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-10, by); ctx.quadraticCurveTo(W / 2, by + sag * 2, W + 10, by); ctx.stroke();
    for (var i = 0; i < 12; i++) {
      var t = (i + 0.5) / 12, x = -10 + (W + 20) * t, y = by + sag * 4 * t * (1 - t), s = Math.max(5, W * 0.022);
      ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.5); ctx.closePath(); ctx.fill();
    }
    // the advertising boards in front of the stand
    ctx.fillStyle = "#F7F1E3"; ctx.fillRect(0, horizon - 5, W, 6);
    // the pitch: mown stripes running to the goal
    g = ctx.createLinearGradient(0, horizon, 0, H);
    g.addColorStop(0, "#6CB24D"); g.addColorStop(1, "#8ED06A");
    ctx.fillStyle = g; ctx.fillRect(0, horizon, W, H - horizon);
    for (var sx = -12; sx < 12; sx += 1.6) {
      var q = [project(sx, 0, -1), project(sx + 0.8, 0, -1), project(sx + 0.8, 0, GOAL_Z + NET_D + 5), project(sx, 0, GOAL_Z + NET_D + 5)];
      poly(q); ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.fill();
    }
    // the box and the spot
    ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2;
    var gl = [project(-7, 0, GOAL_Z), project(7, 0, GOAL_Z)]; line(gl[0], gl[1]);
    poly([project(-4.5, 0, GOAL_Z), project(-4.5, 0, GOAL_Z - 3.6), project(4.5, 0, GOAL_Z - 3.6), project(4.5, 0, GOAL_Z)]); ctx.stroke();
    poly([project(-3.2, 0, GOAL_Z), project(-3.2, 0, GOAL_Z - 1.3), project(3.2, 0, GOAL_Z - 1.3), project(3.2, 0, GOAL_Z)]); ctx.stroke();
    var spot = project(SPOT.x, 0, SPOT.z);
    ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.ellipse(spot.x, spot.y + 2, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
  }

  // the net behind the goal mouth, bulging where a goal hits it
  function bulgeAt(x, y) { var d2 = (x - net.x) * (x - net.x) + (y - net.y) * (y - net.y); return net.bulge * Math.exp(-d2 / 0.7); }
  function netPt(x, y) { return project(x, y, GOAL_Z + NET_D * (0.35 + 0.65 * y / GOAL_H) + bulgeAt(x, y) * 0.9); }
  function drawNet() {
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1;
    for (var x = -GOAL_HALF; x <= GOAL_HALF + 0.01; x += 0.25) { ctx.beginPath(); for (var y = 0; y <= GOAL_H + 0.01; y += 0.25) { var p = netPt(x, y); if (y) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); } ctx.stroke(); }
    for (var y2 = 0; y2 <= GOAL_H + 0.01; y2 += 0.25) { ctx.beginPath(); for (var x2 = -GOAL_HALF; x2 <= GOAL_HALF + 0.01; x2 += 0.25) { var q = netPt(x2, y2); if (x2 > -GOAL_HALF) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); } ctx.stroke(); }
    // the sides of the net, back to the frame
    [-GOAL_HALF, GOAL_HALF].forEach(function (sx) {
      for (var y3 = 0; y3 <= GOAL_H + 0.01; y3 += 0.5) line(project(sx, y3, GOAL_Z), netPt(sx, y3));
    });
  }
  function drawFrame() {
    var lb = project(-GOAL_HALF, 0, GOAL_Z), lt = project(-GOAL_HALF, GOAL_H, GOAL_Z), rb = project(GOAL_HALF, 0, GOAL_Z), rt = project(GOAL_HALF, GOAL_H, GOAL_Z);
    var w = Math.max(4, POST * 2 * lb.s);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(40,60,40,.25)"; ctx.lineWidth = w + 2; line({ x: lb.x + 2, y: lb.y }, { x: lt.x + 2, y: lt.y }); line({ x: rb.x + 2, y: rb.y }, { x: rt.x + 2, y: rt.y });
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = w; line(lb, lt); line(rb, rt); line(lt, rt);
    ctx.lineCap = "butt";
  }

  // The goalie: Bo, a friendly bear in a teal jersey and big gloves, drawn
  // until his picture arrives (see the top of this file). No address until
  // then, so no page asks for a file that isn't there.
  var KEEPER_PIC = "", KEEPER = new Image(), keeperPic = false;
  KEEPER.onload = function () { keeperPic = true; };
  if (KEEPER_PIC) KEEPER.src = KEEPER_PIC;
  function drawKeeper() {
    var lean = 0, lift = 0, kx = keeperX;
    if (dive) { var k = Math.max(0, Math.min(1, dive.t / 0.35)); lean = dive.dir * k * 0.95; lift = Math.sin(k * Math.PI) * 0.35; kx = dive.from + (dive.to - dive.from) * k; }
    var feet = project(kx, 0, KEEPER_Z), s = feet.s, h = KEEPER_H * s;
    // shadow on the grass
    ctx.fillStyle = "rgba(30,70,20,.25)"; ctx.beginPath(); ctx.ellipse(feet.x, feet.y, 0.45 * s, 0.09 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(feet.x, feet.y - lift * s); ctx.rotate(lean);
    if (keeperPic && KEEPER.naturalWidth) {
      var pw = h * KEEPER.naturalWidth / KEEPER.naturalHeight;
      ctx.drawImage(KEEPER, -pw / 2, -h, pw, h);
      ctx.restore(); return;
    }
    var u = h / 100;                                   // drawn on a 100-unit-tall figure
    ctx.lineCap = "round";
    // legs
    ctx.strokeStyle = "#2D3642"; ctx.lineWidth = 9 * u; ctx.beginPath(); ctx.moveTo(-9 * u, -26 * u); ctx.lineTo(-11 * u, -4 * u); ctx.moveTo(9 * u, -26 * u); ctx.lineTo(11 * u, -4 * u); ctx.stroke();
    ctx.fillStyle = "#2D3642"; ctx.beginPath(); ctx.ellipse(-13 * u, -3 * u, 8 * u, 4 * u, 0, 0, Math.PI * 2); ctx.ellipse(13 * u, -3 * u, 8 * u, 4 * u, 0, 0, Math.PI * 2); ctx.fill();
    // arms out wide, gloves up
    var armUp = dive ? 1 : 0.55 + 0.1 * Math.sin(clock * 3);
    ctx.strokeStyle = "#1FA6B8"; ctx.lineWidth = 9 * u;
    ctx.beginPath(); ctx.moveTo(-18 * u, -52 * u); ctx.lineTo(-36 * u, -52 * u - 22 * u * armUp); ctx.moveTo(18 * u, -52 * u); ctx.lineTo(36 * u, -52 * u - 22 * u * armUp); ctx.stroke();
    ctx.fillStyle = "#FFD21C"; ctx.beginPath(); ctx.arc(-38 * u, -54 * u - 22 * u * armUp, 8 * u, 0, Math.PI * 2); ctx.arc(38 * u, -54 * u - 22 * u * armUp, 8 * u, 0, Math.PI * 2); ctx.fill();
    // body: the jersey
    ctx.fillStyle = "#1FA6B8"; rr(-20 * u, -62 * u, 40 * u, 38 * u, 12 * u); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.font = "800 " + Math.round(16 * u) + "px 'Baloo 2', Nunito, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("1", 0, -43 * u);
    // head: a bear
    ctx.fillStyle = "#B5875A";
    ctx.beginPath(); ctx.arc(-14 * u, -92 * u, 7 * u, 0, Math.PI * 2); ctx.arc(14 * u, -92 * u, 7 * u, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -78 * u, 18 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#E0B98A"; ctx.beginPath(); ctx.ellipse(0, -72 * u, 9 * u, 7 * u, 0, 0, Math.PI * 2); ctx.fill();
    var napping = misses >= 2 && !dive;
    ctx.strokeStyle = "#4A2C14"; ctx.fillStyle = "#4A2C14"; ctx.lineWidth = 2.2 * u;
    if (napping) { ctx.beginPath(); ctx.moveTo(-9 * u, -82 * u); ctx.quadraticCurveTo(-6 * u, -79 * u, -3 * u, -82 * u); ctx.moveTo(3 * u, -82 * u); ctx.quadraticCurveTo(6 * u, -79 * u, 9 * u, -82 * u); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(-6.5 * u, -82 * u, 2.8 * u, 0, Math.PI * 2); ctx.arc(6.5 * u, -82 * u, 2.8 * u, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(0, -75 * u, 3.5 * u, 2.5 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = "butt"; ctx.restore();
    if (napping) {                                         // Zzz
      var zp = project(kx + 0.35, KEEPER_H + 0.25, KEEPER_Z), zk = (clock * 0.7) % 1;
      ctx.globalAlpha = 1 - zk; ctx.fillStyle = "#4F6B8A"; ctx.font = "800 " + Math.round(Math.max(12, zp.s * 0.28)) + "px 'Baloo 2', Nunito, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Z", zp.x + zk * 12, zp.y - zk * 18); ctx.font = "800 " + Math.round(Math.max(9, zp.s * 0.2)) + "px 'Baloo 2', Nunito, sans-serif"; ctx.fillText("z", zp.x + 10 + zk * 10, zp.y - 14 - zk * 14);
      ctx.globalAlpha = 1;
    }
  }

  function drawBall(b) {
    var p = project(b.x, b.y, b.z), r = BALL_R * p.s;
    if (r <= 0.5) return;
    var sh = project(b.x, 0.001, b.z);
    ctx.fillStyle = "rgba(30,70,20," + Math.max(0, 0.3 - b.y * 0.08).toFixed(3) + ")"; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, r * 1.05, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(p.x, p.y);
    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, "#FFFFFF"); g.addColorStop(0.7, "#F1F1EC"); g.addColorStop(1, "#C9CCC2");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
    ctx.rotate(b.spin || 0);
    // the classic patches: one in the middle, five round it
    ctx.fillStyle = "#2D3642";
    function pent(cx, cy, s, a) { ctx.beginPath(); for (var i = 0; i < 5; i++) { var an = a + i * Math.PI * 2 / 5; ctx.lineTo(cx + Math.cos(an) * s, cy + Math.sin(an) * s); } ctx.closePath(); ctx.fill(); }
    pent(0, 0, r * 0.32, -Math.PI / 2);
    for (var i = 0; i < 5; i++) { var an = -Math.PI / 2 + i * Math.PI * 2 / 5; pent(Math.cos(an) * r * 0.86, Math.sin(an) * r * 0.86, r * 0.26, an + Math.PI); }
    ctx.restore();
    ctx.strokeStyle = "rgba(45,54,66,.35)"; ctx.lineWidth = Math.max(1, r * 0.05);
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
        ctx.font = "800 " + Math.round(Math.max(26, W * (f.big ? 0.12 : 0.09))) + "px 'Baloo 2', Nunito, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineJoin = "round"; ctx.lineWidth = 8; ctx.strokeStyle = "#fff"; ctx.strokeText(f.text, 0, 0); ctx.fillStyle = f.c; ctx.fillText(f.text, 0, 0); ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
  }
  function burst(x, y, n) {
    var cols = ["#FFD21C", "#FF6B6B", "#34BFCF", "#8A6FF2", "#7CC95C"];
    for (var i = 0; i < (n || 18); i++) { var a = (i / (n || 18)) * Math.PI * 2 + clock, sp = 90 + ((i * 37) % 170); fx.push({ kind: "spark", x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 130, s: 5 + (i % 6), c: cols[i % cols.length], t: 0, life: 0.9 + (i % 4) * 0.1 }); }
  }
  // The pitch's cheers are the action teal (/action.css --act, read once at
  // init): orange means only the practice sound's letters (design brief, 28
  // Sep 2026).
  var SHOUT = "#1FA6B8";
  // over the crossbar, but never so high the word is cut off by the top edge
  function shout(text, c, big, where) {
    var p = where || project(0, GOAL_H + 0.45, GOAL_Z), px = Math.max(26, W * (big ? 0.12 : 0.09));
    fx.push({ kind: "word", text: text, x: p.x, y: Math.max(p.y, px * 0.6 + 22), c: c || SHOUT, t: 0, life: big ? 2.4 : 1.3, big: big });
  }

  // How to kick, shown on the first ball and again whenever the ball has sat
  // on the spot for a while: a fingertip sliding up from the ball.
  function drawHint() {
    if (state !== "ready") return;
    var since = clock - hintAt; if (kicks > 0 && since < 4) return;
    var p = project(SPOT.x, SPOT.y, SPOT.z), k = (since % 1.5) / 1.5, rise = Math.min(H * 0.3, 150);
    var y = p.y + 8 - k * rise, a = k < 0.15 ? k / 0.15 : k > 0.75 ? Math.max(0, (1 - k) / 0.25) : 1;
    ctx.globalAlpha = a * 0.55; ctx.strokeStyle = "#fff"; ctx.lineWidth = 10; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(p.x + 30, p.y + 8); ctx.lineTo(p.x + 30, y); ctx.stroke(); ctx.lineCap = "butt";
    ctx.globalAlpha = a; ctx.fillStyle = "#fff"; ctx.strokeStyle = "#1D2B4F"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x + 30, y, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // after two misses the goalie dozes by one post, the other side glows and
  // an arrow points the way
  function openSide() { return -napSide * (GOAL_HALF - 0.9); }
  function drawGuide() {
    if (state !== "ready" || misses < 2) return;
    var tx = openSide(), k = (clock * 1.6) % 1;
    var a = project(tx - 0.8, 0.05, GOAL_Z), b = project(tx + 0.8, 0.05, GOAL_Z), c = project(tx + 0.8, GOAL_H * 0.75, GOAL_Z), d = project(tx - 0.8, GOAL_H * 0.75, GOAL_Z);
    poly([a, b, c, d]); ctx.fillStyle = "rgba(255,210,28," + (0.18 + 0.2 * (1 - k)).toFixed(2) + ")"; ctx.fill();
    var from = project(SPOT.x, SPOT.y + 0.3, SPOT.z), to = project(tx, 0.6, GOAL_Z), t = 0.35 + 0.1 * Math.sin(clock * 5);
    var tipX = from.x + (to.x - from.x) * t, tipY = from.y + (to.y - from.y) * t, ang = Math.atan2(to.y - from.y, to.x - from.x);
    ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.setLineDash([2, 14]);
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(tipX, tipY); ctx.stroke(); ctx.setLineDash([]);
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
    drawStadium();
    drawNet();
    // a ball in the net is behind the frame and the goalie
    var deep = ball && ball.z > GOAL_Z - 0.05;
    if (ball && deep) drawBall(ball);
    drawFrame();
    // the goalie stands in front of a ball that is behind him
    var behind = ball && ball.z > KEEPER_Z;
    if (ball && behind && !deep) drawBall(ball);
    drawKeeper();
    drawGuide();
    if (ball && !behind) drawBall(ball);
    drawHint(); drawFx(dt);
  }

  // ── the ball ──
  function step(dt) {
    if (keeperMoving()) keeperClock += dt;
    if (!dive) keeperX += (keeperTarget(keeperClock) - keeperX) * Math.min(1, dt * 5);
    else { dive.t += dt; if (dive.t > 1.4) { keeperX = dive.to; dive = null; } }
    net.bulge = Math.max(0, net.bulge - dt * 1.2);
    if (doneAt && clock >= doneAt) { doneAt = 0; if (api) api.done(); }
    if (!ball) return;
    if (state === "drop" || state === "back") {
      ball.k = Math.min(1, ball.k + dt / (state === "drop" ? 0.7 : 0.8));
      var e = 1 - Math.pow(1 - ball.k, 3);
      ball.x = ball.fx + (SPOT.x - ball.fx) * e; ball.z = ball.fz + (SPOT.z - ball.fz) * e; ball.y = SPOT.y + Math.abs(Math.sin(ball.k * Math.PI * 2)) * 0.12 * (1 - ball.k);
      ball.spin += dt * 9 * (ball.fx > SPOT.x ? -1 : 1);
      if (ball.k >= 1) { state = "ready"; ball.x = SPOT.x; ball.y = SPOT.y; ball.z = SPOT.z; hintAt = clock; publish(); }
      return;
    }
    if (state === "ready") { if (!touch) { ball.x += (SPOT.x - ball.x) * Math.min(1, dt * 12); ball.z += (SPOT.z - ball.z) * Math.min(1, dt * 12); } return; }
    if (state === "flying") {
      ball.t += dt;
      var k = Math.min(1, ball.t / ball.dur);
      ball.x = ball.sx + (ball.tx - ball.sx) * k;
      ball.z = ball.sz + (ball.tz - ball.sz) * k;
      ball.y = BALL_R + ball.loft * 4 * k * (1 - k) + (ball.ty - BALL_R) * k;
      ball.spin += dt * 14;
      publish();
      if (k >= 1) arrive();
      return;
    }
    if (state === "scored") {
      ball.t += dt;
      // the ball sinks into the net and drops to the grass behind the line
      ball.vy -= 9.8 * dt; ball.y = Math.max(BALL_R, ball.y + ball.vy * dt); ball.z = Math.min(GOAL_Z + NET_D * 0.6, ball.z + 1.2 * dt);
      if (ball.t > 1.6) { ball = null; state = "idle"; publish(); }
      return;
    }
    if (state === "saved") {
      ball.t += dt;
      ball.x += ball.vx * dt; ball.z += ball.vz * dt; ball.vy -= 9.8 * dt; ball.y += ball.vy * dt;
      if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = -ball.vy * 0.45; ball.vx *= 0.8; ball.vz *= 0.8; if (Math.abs(ball.vy) > 0.6) sound("bounce"); }
      ball.spin += dt * 6;
      if (ball.t > 1.0) comeBack();
    }
  }
  function sound(name) { if (api && api.sfx) try { api.sfx(name); } catch (e) {} }

  // the ball reaches the goal line: in, saved or wide, as decided at the kick
  function arrive() {
    var b = ball;
    if (b.result === "goal") { scored(); return; }
    if (b.result === "save") {
      state = "saved"; b.t = 0; b.vx = (b.x - keeperX) * 2; b.vz = -3.2; b.vy = 2.6;
      sound("save");
      shout(misses >= 1 ? "Saved again!" : "Saved!", "#4F6B8A");
      misses++; afterMiss();
      return;
    }
    // wide or over: it sails past the frame and comes back
    state = "saved"; b.t = 0; b.vx = b.tx * 0.6; b.vz = 2.5; b.vy = 1.2;
    sound("whoosh");
    shout(b.result === "high" ? "Too high!" : "Just wide!", "#4F6B8A");
    misses++; afterMiss();
  }
  function afterMiss() {
    if (misses === 2) napSide = keeperX >= 0 ? 1 : -1;
    try { api.cheer(misses >= 3 ? "Nearly!" : "So close!"); api.hint(misses >= 2 ? "Kick to the open side!" : "Try again!"); if (api.face) api.face("think"); } catch (e) {}
    publish();
  }
  function comeBack() {
    state = "back";
    ball.fx = Math.max(-2.2, Math.min(2.2, ball.x)); ball.fz = Math.max(SPOT.z + 1.5, Math.min(GOAL_Z - 1, ball.z)); ball.k = 0;
    publish();
  }
  function scored() {
    state = "scored"; goals++; misses = 0; ball.t = 0; ball.vy = 0.5;
    net.bulge = 1; net.x = ball.x; net.y = Math.max(0.3, Math.min(GOAL_H - 0.2, ball.y));
    var p = project(ball.x, ball.y, GOAL_Z);
    burst(p.x, p.y);
    lastKick = Math.abs(ball.x) > GOAL_HALF - 0.7 ? "corner" : "goal";
    shout(lastKick === "corner" ? "Top corner!" : "GOAL!");
    sound("net");
    cheerAt = clock;
    try { api.cheer("Goal!"); api.hint(""); if (api.face) api.face("cheer"); } catch (e) {}
    // Echo by the pitch cheers for the length of his hop, then rests again
    try { var e = document.getElementById("pitchEcho"); if (e) { e.classList.remove("hop"); void e.offsetWidth; e.classList.add("hop");
      e.src = "/assets/crafted/echo-cheer.webp"; clearTimeout(scored.t); scored.t = setTimeout(function () { e.src = "/assets/crafted/echo-welcome.webp"; }, 900); } } catch (x) {}
    // the next word waits for the celebration, on the game's own clock, so a
    // pause in between holds it rather than skipping it
    doneAt = clock + 1.3;
    publish();
  }

  // ── the swipe ──
  var touch = null;
  function pointFrom(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; }
  function down(e) {
    if (frozen || !running || state !== "ready") return;
    var p = pointFrom(e);
    if (p.y < H * 0.45) return;                     // kicks start low, near the ball
    touch = { pts: [p] };
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
  }
  function move(e) {
    if (!touch) return; var q = pointFrom(e); touch.pts.push(q); if (touch.pts.length > 40) touch.pts.shift(); e.preventDefault();
    // the ball leans a little way with the finger (only forward, and not far)
    var p0 = touch.pts[0], spot = project(SPOT.x, SPOT.y, SPOT.z);
    var gx = Math.max(-0.25, Math.min(0.25, (q.x - p0.x) / spot.s)), gz = Math.max(0, Math.min(0.3, (p0.y - q.y) / spot.s));
    if (ball && state === "ready") { ball.x = SPOT.x + gx * 0.5; ball.z = SPOT.z + gz * 0.5; }
  }
  function up(e) {
    if (!touch) return;
    var pts = touch.pts; pts.push(pointFrom(e)); touch = null;
    if (state !== "ready" || frozen) return;
    var end = pts[pts.length - 1], from = pts[0];
    for (var i = pts.length - 1; i >= 0; i--) { if (end.t - pts[i].t > 110) break; from = pts[i]; }
    var dy = end.y - from.y, dt = Math.max(16, end.t - from.t);
    var up = pts[0].y - end.y, side = end.x - pts[0].x;
    if (up < Math.max(24, H * 0.05) || dy > -2) { hintAt = clock - 9; try { api.hint("Swipe up to kick!"); } catch (x) {} return; }
    kick(side / up, -dy / dt, up);
  }
  // Where the swipe points, carried on to the goal line: a child kicks where
  // they swipe. aim: sideways per unit up, over the whole swipe; aimScale():
  // metres along the goal line for each unit of it, from the ball's spot.
  function aimScale() { var b = project(SPOT.x, SPOT.y, SPOT.z), l = project(0, 0.5, GOAL_Z); return (b.y - l.y) / l.s; }
  function aimAtGoal(aim) { return SPOT.x + aim * aimScale(); }
  // A child's kick, read kindly. Aimed into the goal, past where the goalie
  // will be, about the right strength: a goal. Help grows with each miss:
  // the goalie reaches less, a near-post kick is pulled in, and from the
  // third miss any swipe up scores while the goalie dives the wrong way.
  function kick(aim, speed, up) {
    var screenH = window.innerHeight || 800;
    var power = Math.max((speed / (screenH / 800)) / 1.4, up / (screenH * 0.3));
    var tx = aimAtGoal(aim), gk = keeperAt(FLIGHT), lo = [0.35, 0.28, 0.2][Math.min(misses, 2)], hi = [3.4, 4.2, 6][Math.min(misses, 2)];
    var pull = [0.35, 0.6, 1.2][Math.min(misses, 2)];
    var result = "goal", ty = 0.45 + Math.max(0, Math.min(1, (power - 0.6) / 1.4)) * 1.1;
    if (misses >= 3) {
      // any swipe up: aimed at the open side, the goalie dives the other way
      tx = Math.abs(tx - gk) < 1 || Math.abs(tx) > GOAL_HALF - 0.3 ? (gk >= 0 ? -1.4 : 1.4) : tx; ty = 0.6;
    } else {
      if (Math.abs(tx) > GOAL_HALF - 0.25) {
        if (Math.abs(tx) < GOAL_HALF - 0.25 + pull) tx = (tx > 0 ? 1 : -1) * (GOAL_HALF - 0.45);   // a near miss, pulled inside the post
        else result = "wide";
      }
      if (result === "goal" && power > hi) { result = "high"; ty = GOAL_H + 0.6; }
      if (result === "goal" && power < lo) { ty = 0.25; }                                        // a soft one still rolls in
      if (result === "goal" && Math.abs(tx - gk) < reach()) result = "save";
    }
    if (result === "high") ty = GOAL_H + 0.6;
    var tz = result === "goal" ? GOAL_Z + 0.25 : result === "save" ? KEEPER_Z : GOAL_Z;
    ball = { x: SPOT.x, y: SPOT.y, z: SPOT.z, sx: ball ? ball.x : SPOT.x, sz: SPOT.z, tx: tx, ty: Math.min(ty, GOAL_H + 0.8), tz: tz, loft: 0.25 + Math.min(0.5, power * 0.15),
      t: 0, dur: FLIGHT * (result === "goal" ? 1 : KEEPER_Z / GOAL_Z), spin: ball ? ball.spin : 0, result: result };
    // the goalie goes for it: toward the ball on a save, the wrong way when beaten
    var dir = result === "save" ? (tx >= gk ? 1 : -1) : (tx >= gk ? -1 : 1);
    if (result === "save") dive = { from: keeperX, to: Math.max(-GOAL_HALF + 0.6, Math.min(GOAL_HALF - 0.6, tx)), dir: dir, t: -FLIGHT * 0.45 };
    // (the wrong way: no further than a step past his post side, so he stays
    // on the pitch; a dozing goalie wakes with a start and does the same)
    else if (result === "goal") dive = { from: keeperX, to: Math.max(-GOAL_HALF + 1.0, Math.min(GOAL_HALF - 1.0, gk + dir * 0.9)), dir: dir, t: -FLIGHT * 0.5 };
    state = "flying"; kicks++;
    lastSwipe = { power: +power.toFixed(3), tx: +tx.toFixed(3), keeper: +gk.toFixed(3), result: result };
    sound("kick");
    try { api.hint(""); api.cheer(""); } catch (e) {}
    publish();
  }

  // ── what the engine calls ──
  function publish() {
    try { window.__soccer = { state: state, goals: goals, misses: misses, kicks: kicks, lastKick: lastKick, keeperX: +keeperX.toFixed(3), count: count, frozen: frozen, swipe: lastSwipe, napping: misses >= 2,
      aimScale: cv ? +aimScale().toFixed(3) : 0, openSide: misses >= 2 ? +openSide().toFixed(3) : null,
      ball: ball && state === "flying" ? { x: +ball.x.toFixed(3), z: +ball.z.toFixed(3) } : null }; } catch (e) {}
  }
  var Soccer = {
    init: function (engineApi, n) {
      api = engineApi; count = n || 8;
      try { SHOUT = getComputedStyle(document.documentElement).getPropertyValue("--act").trim() || SHOUT; } catch (e) {}
      cv = document.getElementById("pitch"); ctx = cv.getContext("2d");
      resize(); window.addEventListener("resize", resize);
      cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move);
      cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", function () { touch = null; });
      // no finger? Space or the up arrow kicks to the side the goalie isn't
      // on — once a word has earned the ball, like a swipe
      document.addEventListener("keydown", function (e) {
        if ((e.key === " " || e.key === "ArrowUp") && state === "ready" && !frozen && running) {
          e.preventDefault();
          kick((keeperAt(FLIGHT) >= 0 ? -1.5 : 1.5) / aimScale(), 1.4 * ((window.innerHeight || 800) / 800), 0);
        }
      });
      keeperPhase = Math.PI / 2;
      running = true; lastT = performance.now(); raf = requestAnimationFrame(frame);
      publish();
    },
    // the engine heard the word: a ball rolls in to the spot
    onWord: function () {
      misses = 0; dive = null;
      var side = goals % 2 ? 1 : -1;
      ball = { fx: SPOT.x + side * 2.6, fz: SPOT.z + 1.2, x: SPOT.x + side * 2.6, y: SPOT.y, z: SPOT.z + 1.2, k: 0, spin: 0 };
      state = "drop"; sound("roll");
      try { api.hint("Swipe up to kick!"); } catch (e) {}
      publish();
    },
    pause: function () { frozen = true; touch = null; publish(); },
    resume: function () { frozen = false; lastT = performance.now(); publish(); },
    reset: function () { goals = 0; misses = 0; kicks = 0; ball = null; dive = null; state = "idle"; fx = []; lastKick = ""; doneAt = 0; publish(); },
    finale: function () {
      cheerAt = clock + 0.2;
      var p = project(0, GOAL_H * 0.6, GOAL_Z);
      burst(p.x, p.y, 24); burst(W * 0.25, H * 0.45, 16); burst(W * 0.75, H * 0.45, 16);
      shout(count + " goals!", null, true, { x: W / 2, y: H * 0.56 });
    },
    snapshot: function () { return window.__soccer; },
  };
  window.Soccer = Soccer;
})();
