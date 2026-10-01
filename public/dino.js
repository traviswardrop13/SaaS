/* Dino Dig: the third Say & Play game rebuilt to be played (Travis, 1 Oct
   2026: "go finish soccer and then go to the next game"; Codex had started a
   Dino Dig preview, which never left his Mac). The plan: say the word and get
   a brush; rub the sand with a finger to uncover a bone; the bone flies onto
   the dinosaur's skeleton; eight words, eight bones, then the dinosaur wakes
   up and roars.

   sayplay.js still owns every word turn, the mic and its quiet rules, the
   start card, pausing and the end card. This file is the dig: it draws the
   cliff and the skeleton, keeps the sand over each bone, and flies the bones
   home. It never touches the mic.

   THE WORD EARNS THE BRUSH; THE FINGER DIGS. Rubbing with no brush moves no
   sand, a brush arrives only when the engine has heard the word (onWord), and
   the bone always comes out: the brush is wide, a bone shows itself once most
   of it is uncovered, its spot glows after a few seconds, and if the child
   keeps rubbing somewhere else the sand over it gives way as they rub
   (Rachel's rule: end every round on a success). It never digs by itself.

   Its pictures are drawn here, plainly, until the art arrives.

   Nothing here is practice data: no attempt, rep, coin or sticker is written. */
(function () {
  "use strict";
  var api = null, cv = null, ctx = null, W = 0, H = 0, DPR = 1;
  var raf = 0, lastT = 0, clock = 0, running = false, frozen = false;

  // ── the skeleton: eight bones in the order they are found, each with its
  // place on the cliff (in a 440 x 230 board) and how it is drawn ──
  var BONES = [
    { id: "tail", at: [82, 152], rot: -0.18, size: 1.0 },
    { id: "leg", at: [176, 168], rot: 0, size: 1.0 },
    { id: "hip", at: [168, 124], rot: 0, size: 1.0 },
    { id: "back", at: [222, 112], rot: -0.06, size: 1.0 },
    { id: "ribs", at: [222, 132], rot: 0, size: 1.0 },
    { id: "arm", at: [262, 170], rot: 0, size: 1.0 },
    { id: "neck", at: [300, 74], rot: 0, size: 1.0 },
    { id: "skull", at: [340, 32], rot: 0, size: 1.0 },
  ];
  // each bone's width and height on the board, for fitting it in the pit
  var EXT = { tail: [126, 22], back: [130, 26], neck: [62, 112], skull: [70, 46], ribs: [90, 44], hip: [54, 32], leg: [34, 64], arm: [30, 56] };
  // the board and the dig pit, in canvas pixels, from resize()
  var board = { x: 0, y: 0, s: 1 }, pit = { x: 0, y: 0, w: 0, h: 0 };

  // ── the game ──
  // state: idle (no brush: a word turn) | ready (the brush is out, the bone
  // under the sand) | found (the bone pops out) | flying (to its place) |
  // placed (the cheer, then the next word)
  var state = "idle", count = 8, found = 0, rubs = 0, dig = null, fly = null, fx = [];
  var doneAt = 0, glowAt = 0, crumbleAt = 0, wakeAt = -1, lastRub = 0;

  // the sand over the current bone: a canvas the finger erases, and a coarse
  // grid of the same erasing, which is what decides how much of the bone shows
  var sand = null, sandCtx = null, GX = 28, GY = 14, grid = null;

  function resize() {
    if (!cv) return;
    var r = cv.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // the cliff and its skeleton across the top half, the dig pit below it
    board.s = W / 440; board.x = 0; board.y = H * 0.07;
    pit.w = W * 0.86; pit.h = H * 0.34; pit.x = (W - pit.w) / 2; pit.y = H * 0.6;
    if (sand) remakeSand(true);
  }

  // ── drawing ──
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  var BONE = "#FFF8EC", BONE_EDGE = "#B9A27E";

  // one bone, drawn round (0, 0) at scale k (1 = its size on the board)
  function bonePath(c, id, k) {
    c.beginPath();
    var i;
    if (id === "tail") { for (i = 0; i < 6; i++) { var tr = (11 - i * 1.4) * k; c.moveTo(-52 * k + i * 22 * k + tr, 0); c.arc(-52 * k + i * 22 * k, 0, tr, 0, Math.PI * 2); } return; }
    if (id === "back") { for (i = 0; i < 6; i++) { var bx = -55 * k + i * 22 * k; c.moveTo(bx + 10 * k, 0); c.ellipse(bx, 0, 10 * k, 8 * k, 0, 0, Math.PI * 2); c.moveTo(bx + 3 * k, -6 * k); c.rect(bx - 3 * k, -16 * k, 6 * k, 10 * k); } return; }
    if (id === "neck") { for (i = 0; i < 5; i++) { var a = i / 4, nx = -28 * k + a * 34 * k + Math.sin(a * 2.2) * 10 * k, ny = 48 * k - a * 92 * k; c.moveTo(nx + 9 * k, ny); c.ellipse(nx, ny, 9 * k, 7.5 * k, -0.9, 0, Math.PI * 2); } return; }
    if (id === "skull") {
      c.moveTo(-26 * k, 6 * k);
      c.bezierCurveTo(-28 * k, -18 * k, -4 * k, -26 * k, 14 * k, -18 * k);
      c.bezierCurveTo(30 * k, -12 * k, 40 * k, -2 * k, 40 * k, 6 * k);
      c.bezierCurveTo(40 * k, 14 * k, 24 * k, 18 * k, 4 * k, 17 * k);
      c.bezierCurveTo(-12 * k, 16 * k, -24 * k, 14 * k, -26 * k, 6 * k);
      return;
    }
    if (id === "ribs") { for (i = 0; i < 4; i++) { var rx = -36 * k + i * 24 * k; c.moveTo(rx - 4 * k, -18 * k); c.quadraticCurveTo(rx - 12 * k, 4 * k, rx - 2 * k, 24 * k); c.lineTo(rx + 5 * k, 22 * k); c.quadraticCurveTo(rx - 4 * k, 4 * k, rx + 4 * k, -18 * k); c.closePath(); } return; }
    if (id === "hip") { c.ellipse(0, 0, 26 * k, 15 * k, 0, 0, Math.PI * 2); return; }
    // leg and arm: a long bone with a knob at each end, and a little foot
    var len = id === "leg" ? 44 : 36, th = id === "leg" ? 7.5 : 6.5;
    c.moveTo(-th * k, -len / 2 * k); c.lineTo(th * k, -len / 2 * k); c.lineTo(th * k, len / 2 * k); c.lineTo(-th * k, len / 2 * k); c.closePath();
    [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sy) { var kx = sx * th * 0.9 * k, ky = sy * len / 2 * k; c.moveTo(kx + th * 0.95 * k, ky); c.arc(kx, ky, th * 0.95 * k, 0, Math.PI * 2); }); });
    c.moveTo(16 * k, (len / 2 + 7) * k); c.ellipse(5 * k, (len / 2 + 7) * k, 13 * k, 5 * k, 0, 0, Math.PI * 2);
  }
  function drawBone(c, id, x, y, k, rot, alpha, ghost) {
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.globalAlpha = alpha == null ? 1 : alpha;
    bonePath(c, id, k);
    if (ghost) { c.setLineDash([4, 5]); c.strokeStyle = "rgba(120,72,30,.45)"; c.lineWidth = 2; c.stroke(); c.setLineDash([]); }
    else {
      c.fillStyle = BONE; c.fill(); c.strokeStyle = BONE_EDGE; c.lineWidth = Math.max(1.5, 2.2 * k); c.stroke();
      if (id === "skull") {                                     // eye socket and smile
        c.fillStyle = "#6E5434"; c.beginPath(); c.ellipse(16 * k, -4 * k, 5 * k, 6 * k, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = "#8A6F4E"; c.lineWidth = Math.max(1.2, 1.8 * k); c.beginPath(); c.moveTo(6 * k, 10 * k); c.quadraticCurveTo(20 * k, 15 * k, 34 * k, 8 * k); c.stroke();
      }
    }
    c.restore();
  }
  function boardPt(b) { return { x: board.x + b.at[0] * board.s, y: board.y + b.at[1] * board.s }; }

  function drawScene() {
    // sky and sun
    var g = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    g.addColorStop(0, "#FFE2B8"); g.addColorStop(1, "#FFF3DF");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#FFD86A"; ctx.beginPath(); ctx.arc(W * 0.86, H * 0.08, Math.max(14, W * 0.055), 0, Math.PI * 2); ctx.fill();
    // the cliff, a little darker where the skeleton lies
    var top = board.y + 8 * board.s;
    ctx.fillStyle = "#E8A868";
    ctx.beginPath(); ctx.moveTo(0, top + 30 * board.s);
    [[60, 18], [110, 28], [170, 4], [240, 16], [300, -6], [360, 10], [440, 0]].forEach(function (p) { ctx.lineTo(p[0] * board.s, top + p[1] * board.s); });
    ctx.lineTo(W, H * 0.6); ctx.lineTo(0, H * 0.6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(160,96,44,.28)"; ctx.lineWidth = 3;
    [0.3, 0.42, 0.52].forEach(function (f) { ctx.beginPath(); ctx.moveTo(0, H * f); ctx.quadraticCurveTo(W / 2, H * f - 10, W, H * f + 4); ctx.stroke(); });
    ctx.fillStyle = "rgba(170,100,46,.22)"; rr(ctx, 30 * board.s, board.y + 10 * board.s, 380 * board.s, 205 * board.s, 40 * board.s); ctx.fill();
    // the ground in front of the pit
    ctx.fillStyle = "#F0C890"; ctx.fillRect(0, H * 0.58, W, H * 0.42);
  }

  // the dinosaur's body, drawn behind its bones as it wakes up
  function drawBody(a) {
    if (a <= 0) return;
    var p = function (x, y) { return [board.x + x * board.s, board.y + y * board.s]; };
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "#8BD07A"; ctx.strokeStyle = "#5FA04F"; ctx.lineWidth = 3;
    ctx.beginPath();
    var q = [p(30, 156), p(120, 130), p(170, 104), p(250, 98), p(290, 110), p(300, 60), p(318, 22), p(372, 14), p(386, 38), p(346, 52), p(322, 112),
      p(290, 150), p(282, 196), p(246, 196), p(244, 160), p(200, 160), p(192, 196), p(156, 196), p(150, 156), p(120, 152)];
    ctx.moveTo(q[0][0], q[0][1]); q.forEach(function (pt) { ctx.lineTo(pt[0], pt[1]); }); ctx.closePath(); ctx.fill(); ctx.stroke();
    // a friendly face
    var eye = p(356, 26); ctx.fillStyle = "#2D3642"; ctx.beginPath(); ctx.arc(eye[0], eye[1], 3.6 * board.s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#FFB7B2"; var ck = p(366, 38); ctx.beginPath(); ctx.arc(ck[0], ck[1], 4 * board.s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawSkeleton() {
    var wake = wakeAt >= 0 ? Math.min(1, (clock - wakeAt) / 0.8) : 0, bob = wakeAt >= 0 ? Math.sin((clock - wakeAt) * 6) * 3 * board.s : 0;
    ctx.save(); ctx.translate(0, -Math.abs(bob));
    drawBody(wake);
    for (var i = 0; i < BONES.length; i++) {
      var b = BONES[i], p = boardPt(b);
      if (i < found) drawBone(ctx, b.id, p.x, p.y, board.s * b.size, b.rot, wake > 0 ? 1 - wake * 0.35 : 1);
      else if (!(fly && i === found)) drawBone(ctx, b.id, p.x, p.y, board.s * b.size, b.rot, 0.9, true);
    }
    ctx.restore();
  }

  // ── the sand over the current bone ──
  function remakeSand(keep) {
    var old = keep && sand ? sand : null;
    sand = document.createElement("canvas"); sand.width = Math.max(1, Math.round(pit.w)); sand.height = Math.max(1, Math.round(pit.h));
    sandCtx = sand.getContext("2d");
    sandCtx.fillStyle = "#EBC48A"; sandCtx.fillRect(0, 0, sand.width, sand.height);
    for (var i = 0; i < 260; i++) {
      var sx = ((i * 97) % 1000) / 1000 * sand.width, sy = ((i * 61 + 13) % 1000) / 1000 * sand.height, s = 1 + (i % 4);
      sandCtx.fillStyle = i % 3 ? "#D9A866" : "#F6DCA8"; sandCtx.beginPath(); sandCtx.arc(sx, sy, s, 0, Math.PI * 2); sandCtx.fill();
    }
    if (!keep || !grid) grid = new Uint8Array(GX * GY);
    else if (old) {
      // a resize keeps what was already brushed away
      sandCtx.globalCompositeOperation = "destination-out";
      for (var gy = 0; gy < GY; gy++) for (var gx = 0; gx < GX; gx++) if (grid[gy * GX + gx]) sandCtx.fillRect(gx / GX * sand.width - 1, gy / GY * sand.height - 1, sand.width / GX + 2, sand.height / GY + 2);
      sandCtx.globalCompositeOperation = "source-over";
    }
  }
  // the part of the pit the bone covers, in grid cells
  function boneCells() {
    var cells = [], b = dig, bw = b.w / pit.w, bh = b.h / pit.h, cx = (b.x - pit.x) / pit.w, cy = (b.y - pit.y) / pit.h;
    for (var gy = 0; gy < GY; gy++) for (var gx = 0; gx < GX; gx++) {
      var u = (gx + 0.5) / GX, v = (gy + 0.5) / GY;
      if (Math.abs(u - cx) <= bw / 2 && Math.abs(v - cy) <= bh / 2) cells.push(gy * GX + gx);
    }
    return cells;
  }
  function revealed() {
    if (!dig) return 0;
    var cells = dig.cells, n = 0; for (var i = 0; i < cells.length; i++) if (grid[cells[i]]) n++;
    return cells.length ? n / cells.length : 0;
  }
  // the brush: erase a circle of sand where the finger goes
  function brush(x, y, r) {
    if (!sandCtx) return;
    var lx = x - pit.x, ly = y - pit.y;
    sandCtx.globalCompositeOperation = "destination-out";
    sandCtx.beginPath(); sandCtx.arc(lx, ly, r, 0, Math.PI * 2); sandCtx.fill();
    sandCtx.globalCompositeOperation = "source-over";
    var cw = pit.w / GX, ch = pit.h / GY;
    for (var gy = 0; gy < GY; gy++) for (var gx = 0; gx < GX; gx++) {
      var dx = (gx + 0.5) * cw - lx, dy = (gy + 0.5) * ch - ly;
      if (dx * dx + dy * dy <= r * r) grid[gy * GX + gx] = 1;
    }
  }

  function drawPit() {
    // the pit: a dark dig with the bone in it, and the sand on top
    ctx.save();
    ctx.fillStyle = "rgba(120,72,30,.25)"; rr(ctx, pit.x - 6, pit.y + 6, pit.w + 12, pit.h + 6, 26); ctx.fill();
    rr(ctx, pit.x, pit.y, pit.w, pit.h, 22); ctx.clip();
    ctx.fillStyle = "#B97A45"; ctx.fillRect(pit.x, pit.y, pit.w, pit.h);
    for (var i = 0; i < 40; i++) { ctx.fillStyle = "rgba(90,52,20,.18)"; ctx.beginPath(); ctx.arc(pit.x + ((i * 53) % 100) / 100 * pit.w, pit.y + ((i * 37 + 7) % 100) / 100 * pit.h, 2 + (i % 3), 0, Math.PI * 2); ctx.fill(); }
    if (dig && state !== "flying" && state !== "placed") {
      var pop = state === "found" ? Math.sin(Math.min(1, (clock - dig.foundAt) / 0.4) * Math.PI) * 10 : 0;
      drawBone(ctx, dig.id, dig.x, dig.y - pop, dig.k, 0);
    }
    if (sand) ctx.drawImage(sand, pit.x, pit.y, pit.w, pit.h);
    // after a while of rubbing somewhere else, the bone's spot glows
    if (dig && state === "ready" && clock >= glowAt) {
      var k = (clock * 1.6) % 1;
      ctx.strokeStyle = "rgba(255,210,28," + (0.9 * (1 - k)).toFixed(2) + ")"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(dig.x, dig.y, dig.w * (0.55 + k * 0.15), dig.h * (0.62 + k * 0.15), 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = "#A8693A"; ctx.lineWidth = 4; rr(ctx, pit.x, pit.y, pit.w, pit.h, 22); ctx.stroke();
  }

  // how to dig, shown until the child starts rubbing: a fingertip going side to side
  function drawHint() {
    if (state !== "ready" || rubs > 3) return;
    var k = (clock % 1.6) / 1.6, x = pit.x + pit.w * (0.3 + 0.4 * (0.5 - 0.5 * Math.cos(k * Math.PI * 2))), y = pit.y + pit.h * 0.5;
    ctx.globalAlpha = 0.85; ctx.fillStyle = "#fff"; ctx.strokeStyle = "#1D2B4F"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
  }

  function drawFx(dt) {
    for (var i = fx.length - 1; i >= 0; i--) {
      var f = fx[i]; f.t += dt;
      if (f.t > f.life) { fx.splice(i, 1); continue; }
      var k = f.t / f.life;
      if (f.kind === "grain") {
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 420 * dt;
        ctx.globalAlpha = Math.max(0, 1 - k); ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, f.s, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      } else if (f.kind === "spark") {
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt;
        ctx.globalAlpha = Math.max(0, 1 - k); ctx.fillStyle = f.c;
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.t * 6); var s = f.s * (1 - k * 0.5);
        ctx.beginPath(); for (var j = 0; j < 10; j++) { var rad = j % 2 ? s * 0.45 : s, an = -Math.PI / 2 + j * Math.PI / 5; ctx.lineTo(Math.cos(an) * rad, Math.sin(an) * rad); } ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.globalAlpha = 1;
      } else if (f.kind === "word") {
        var pop = k < 0.15 ? 0.4 + (k / 0.15) * 0.8 : k < 0.25 ? 1.2 - (k - 0.15) * 2 : 1;
        ctx.globalAlpha = k > 0.75 ? Math.max(0, (1 - k) / 0.25) : 1;
        ctx.save(); ctx.translate(f.x, f.y - k * 16); ctx.scale(pop, pop); ctx.rotate(-0.06);
        ctx.font = "800 " + Math.round(Math.max(24, W * (f.big ? 0.12 : 0.08))) + "px 'Baloo 2', Nunito, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineJoin = "round"; ctx.lineWidth = 8; ctx.strokeStyle = "#fff"; ctx.strokeText(f.text, 0, 0); ctx.fillStyle = f.c; ctx.fillText(f.text, 0, 0); ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
  }
  function burst(x, y, n) {
    var cols = ["#FFD21C", "#FF6B6B", "#34BFCF", "#8A6FF2", "#7CC95C"];
    for (var i = 0; i < (n || 16); i++) { var a = (i / (n || 16)) * Math.PI * 2 + clock, sp = 90 + ((i * 37) % 160); fx.push({ kind: "spark", x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, s: 5 + (i % 6), c: cols[i % cols.length], t: 0, life: 0.9 + (i % 4) * 0.1 }); }
  }
  function grains(x, y) {
    for (var i = 0; i < 3; i++) fx.push({ kind: "grain", x: x, y: y, vx: (((i * 71 + rubs * 13) % 100) - 50) * 2.4, vy: -60 - ((i * 29 + rubs) % 60), s: 1.5 + (i % 2), c: i % 2 ? "#D9A866" : "#EBC48A", t: 0, life: 0.6 });
  }
  // the dig's cheers are the action teal (/action.css --act): orange means
  // only the practice sound's letters (design brief, 28 Sep 2026)
  var SHOUT = "#1FA6B8";
  function shout(text, big, where) { var p = where || { x: W / 2, y: H * 0.5 }; fx.push({ kind: "word", text: text, x: p.x, y: p.y, c: SHOUT, t: 0, life: big ? 2.4 : 1.3, big: big }); }

  function frame(now) {
    raf = 0; if (!running) return;
    var dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
    if (!frozen) { clock += dt; step(dt); }
    render(frozen ? 0 : dt);
    raf = requestAnimationFrame(frame);
  }
  function render(dt) {
    ctx.clearRect(0, 0, W, H);
    drawScene(); drawSkeleton(); drawPit();
    if (fly) { var k = Math.min(1, fly.t / fly.dur), e = 1 - Math.pow(1 - k, 3), p = boardPt(BONES[fly.i]);
      drawBone(ctx, BONES[fly.i].id, fly.x + (p.x - fly.x) * e, fly.y + (p.y - fly.y) * e - Math.sin(k * Math.PI) * H * 0.12, fly.k + (board.s - fly.k) * e, BONES[fly.i].rot * e); }
    drawHint(); drawFx(dt);
  }

  // ── the dig ──
  function step(dt) {
    if (doneAt && clock >= doneAt) { doneAt = 0; state = "idle"; remakeSand(false); publish(); if (api) api.done(); }
    if (state === "ready") {
      if (revealed() >= 0.6) uncover();
      publish();
    } else if (state === "found") {
      if (clock - dig.foundAt > 0.55) { state = "flying"; fly = { i: found, x: dig.x, y: dig.y, k: dig.k, t: 0, dur: 0.75 }; sound("whoosh"); publish(); }
    } else if (state === "flying") {
      fly.t += dt;
      if (fly.t >= fly.dur) placed();
    }
  }
  function sound(name) { if (api && api.sfx) try { api.sfx(name); } catch (e) {} }
  function uncover() {
    state = "found"; dig.foundAt = clock;
    shout(found === BONES.length - 1 ? "The skull!" : ["A bone!", "Found one!", "Look!"][found % 3], false, { x: dig.x, y: pit.y - 12 });
    sound("pop");
    try { api.cheer("You found it!"); api.hint(""); if (api.face) api.face("cheer"); } catch (e) {}
    publish();
  }
  function placed() {
    var p = boardPt(BONES[fly.i]);
    fly = null; found++; dig = null; sand = null; sandCtx = null; state = "placed";
    burst(p.x, p.y, 14); sound("clack");
    try { var e = document.getElementById("digEcho"); if (e) { e.classList.remove("hop"); void e.offsetWidth; e.classList.add("hop");
      e.src = "/assets/crafted/echo-cheer.webp"; clearTimeout(placed.t); placed.t = setTimeout(function () { e.src = "/assets/crafted/echo-welcome.webp"; }, 900); } } catch (x) {}
    // the next word waits for the cheer, on the game's own clock, so a pause
    // in between holds it rather than skipping it
    doneAt = clock + 0.9;
    publish();
  }

  // ── the finger ──
  var touch = null;
  function pointFrom(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function inPit(p) { return p.x >= pit.x && p.x <= pit.x + pit.w && p.y >= pit.y && p.y <= pit.y + pit.h; }
  function rubAt(p) {
    if (state !== "ready" || frozen || !inPit(p)) return;
    var r = Math.max(13, pit.w * 0.072);
    if (touch && touch.last) {                           // fill in between quick moves
      var dx = p.x - touch.last.x, dy = p.y - touch.last.y, n = Math.min(12, Math.ceil(Math.sqrt(dx * dx + dy * dy) / (r * 0.5)));
      for (var i = 1; i <= n; i++) brush(touch.last.x + dx * i / n, touch.last.y + dy * i / n, r);
    } else brush(p.x, p.y, r);
    rubs++;
    if (rubs % 4 === 0) grains(p.x, p.y);
    if (clock - lastRub > 0.18) { lastRub = clock; sound("brush"); }
    // rubbing near the bone puts the help off; rubbing far away lets it come:
    // first the bone's spot glows, then the sand over it gives way as the
    // child rubs anywhere (only while they rub: it never digs on its own)
    if (dig && Math.abs(p.x - dig.x) < dig.w * 0.7 && Math.abs(p.y - dig.y) < dig.h * 0.8) { glowAt = Math.max(glowAt, clock + 2.5); crumbleAt = Math.max(crumbleAt, clock + 5); }
    else if (dig && clock >= crumbleAt) {
      var cx = dig.x + Math.cos(rubs * 1.7) * dig.w * 0.32, cy = dig.y + Math.sin(rubs * 2.3) * dig.h * 0.32;
      brush(cx, cy, r * 0.8); if (rubs % 3 === 0) grains(cx, cy);
    }
  }
  function down(e) {
    if (frozen || !running || state !== "ready") return;
    var p = pointFrom(e); if (!inPit(p)) return;
    touch = { last: null }; rubAt(p); touch.last = p;
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
  }
  function move(e) { if (!touch) return; var p = pointFrom(e); rubAt(p); touch.last = p; e.preventDefault(); }
  function up() { touch = null; }

  // ── what the engine calls ──
  function publish() {
    try { window.__dino = { state: state, found: found, count: count, rubs: rubs, frozen: frozen, revealed: +revealed().toFixed(3),
      pit: { x: +pit.x.toFixed(1), y: +pit.y.toFixed(1), w: +pit.w.toFixed(1), h: +pit.h.toFixed(1) },
      bone: dig ? { x: +dig.x.toFixed(1), y: +dig.y.toFixed(1), w: +dig.w.toFixed(1), h: +dig.h.toFixed(1) } : null,
      glow: !!(dig && state === "ready" && clock >= glowAt), awake: wakeAt >= 0 }; } catch (e) {}
  }
  var Dino = {
    init: function (engineApi, n) {
      api = engineApi; count = Math.min(n || 8, BONES.length);
      try { SHOUT = getComputedStyle(document.documentElement).getPropertyValue("--act").trim() || SHOUT; } catch (e) {}
      cv = document.getElementById("dig"); ctx = cv.getContext("2d");
      resize(); remakeSand(false); window.addEventListener("resize", resize);
      cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move);
      cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
      // no finger? Space or Enter digs the bone out — once a word has earned the brush
      document.addEventListener("keydown", function (e) {
        if ((e.key === " " || e.key === "Enter") && state === "ready" && !frozen && running && dig) {
          e.preventDefault();
          for (var i = 0; i < 9; i++) brush(dig.x + ((i % 3) - 1) * dig.w * 0.35, dig.y + (((i / 3) | 0) - 1) * dig.h * 0.35, Math.max(14, pit.w * 0.085));
        }
      });
      running = true; lastT = performance.now(); raf = requestAnimationFrame(frame);
      publish();
    },
    // the engine heard the word: the brush comes out, and a bone waits under the sand
    onWord: function () {
      if (found >= BONES.length) return;
      var b = BONES[found], ext = EXT[b.id];
      // big enough to see, small enough to fit: within 60% of the pit's width and 75% of its height
      var k = Math.max(board.s * 1.1, Math.min(board.s * 1.8, pit.w * 0.6 / ext[0], pit.h * 0.75 / ext[1]));
      var bw = ext[0] * k, bh = ext[1] * k;
      // where the bone lies: left, right or middle of the pit, in turn
      var side = [0.32, 0.68, 0.5][found % 3], x = Math.max(pit.x + bw / 2 + 10, Math.min(pit.x + pit.w - bw / 2 - 10, pit.x + pit.w * side));
      dig = { id: b.id, k: k, x: x, y: pit.y + pit.h * 0.52, w: bw, h: bh, foundAt: 0 };
      remakeSand(false); dig.cells = boneCells();
      state = "ready"; rubs = 0; glowAt = clock + 4; crumbleAt = clock + 8;
      sound("brush");
      try { api.hint("Rub the sand to dig!"); } catch (e) {}
      publish();
    },
    pause: function () { frozen = true; touch = null; publish(); },
    resume: function () { frozen = false; lastT = performance.now(); publish(); },
    reset: function () { found = 0; dig = null; fly = null; state = "idle"; fx = []; doneAt = 0; wakeAt = -1; rubs = 0; remakeSand(false); publish(); },
    finale: function () {
      wakeAt = clock + 0.1;
      var head = boardPt(BONES[BONES.length - 1]);
      burst(head.x, head.y, 20); burst(W * 0.25, H * 0.3, 14); burst(W * 0.75, H * 0.3, 14);
      shout("ROAR!", true, { x: W / 2, y: H * 0.5 });
      sound("roar");
      publish();
    },
    snapshot: function () { return window.__dino; },
  };
  window.Dino = Dino;
})();
