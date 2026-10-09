/* Rise Up's board (Travis, 9 Oct 2026: "lets build the game rise up").
   A balloon floats up; toy blocks fall toward it; the child drags a round
   shield to push them out of the way. This file is the board only: the
   balloon, the shield, the blocks, their pushes, the finale's clouds and
   star, and how all of it is drawn. The page (arcade-rise.html) owns the
   round: its stretches, hearts, the say-it card, Echo's sound power, the
   sounds and the HUD. So this file never touches storage, the microphone,
   a sound or the network, and never clears the canvas (the page clears it
   exactly once a frame, and the speech suite counts frames by that call).
   It tells the page what happened through the callbacks given to setup():
   a block counted, a chain of pushes, a block on the balloon (the page
   answers whether a heart was lost), a cloud pushed away at the top.

   Movement is in pixels per drawn frame, as the other round games move
   (iOS WebKit draws at 60 a second); timers (fading, age) are in ms.
   Every picture is decoration over shapes the board already knows: a
   picture that has not loaded, or never will, is drawn as a plain shape. */
(function (global) {
  "use strict";
  var R = global.Rise = {};
  // the seams the page and the tests use; never reassigned
  var pieces = R.pieces = [];
  var puffs = R.puffs = [];
  var shield = R.shield = { x: 0, y: 0, r: 30, tx: 0, ty: 0 };
  var balloon = R.balloon = { x: 0, y: 0, r: 27, hitR: 22 };
  R.U = 0; R.HUDB = 0; R.BAND = 0; R.s = 32;
  R.sky = 0;          // 0 garden, 1 clouds, 2 stars: what drifts behind the pieces
  R.hint = false;     // the page shows the fingertip hint until the first drag
  R.calm = false;     // Reduce Motion: smaller wobbles, no blinking, a still hint
  R.puffGlow = false; // the top: the clouds left glow after a while
  R.showStar = false; // the top: the big star the balloon floats up to

  var W = 0, H = 0, Yb = 0, ctx = null, cb = {}, placed = false;
  var sparks = [], bits = [], ART = null, cubeTurn = 0;
  var shVX = 0, shVY = 0;
  var wobAt = -1e9, ringAt = -1e9;
  var chain = { t: -1e9, n: 0, fired: false };
  var floatF = -1;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function now0() { return (global.performance && performance.now) ? performance.now() : Date.now(); }
  function pic(src) { var im = new Image(); try { im.decoding = "async"; } catch (e) {} im.src = src; return im; }
  function ready(im) { return !!im && im.complete && im.naturalWidth > 0; }
  var G = "/assets/crafted/game/";

  // ── the four blocks ──
  // side: how big it is drawn; push: the circle the shield and other blocks
  // meet; hurt: the smaller circle that counts on the balloon (a bumpy
  // block's bumps never count, only its core). The bar is a capsule.
  var KIND = {
    cube:   { mul: 1.0 },
    little: { mul: 1.3 },
    bumpy:  { mul: 1.0 },
    bar:    { mul: 1.0 }
  };
  function side(p) { return p.kind === "little" ? Math.max(20, 0.6 * p.s) : p.s; }
  function pushR(p) { return p.kind === "bumpy" ? 0.5 * p.s : 0.55 * side(p); }
  function hurtR(p) { return p.kind === "bumpy" ? 0.30 * p.s : 0.42 * side(p); }
  function spinCap(p) { return p.kind === "bar" ? 0.12 : 0.2; }
  // the bar's middle line, half-length h, at its angle
  function seg(p, h) { var c = Math.cos(p.a), s = Math.sin(p.a); return [p.x - c * h, p.y - s * h, p.x + c * h, p.y + s * h]; }
  function nearest(sg, x, y) {
    var dx = sg[2] - sg[0], dy = sg[3] - sg[1], L = dx * dx + dy * dy, t = L ? ((x - sg[0]) * dx + (y - sg[1]) * dy) / L : 0;
    t = clamp(t, 0, 1); return [sg[0] + dx * t, sg[1] + dy * t];
  }
  // what one block offers to another block: circles (three along a bar)
  function circlesOf(p) {
    if (p.kind !== "bar") return [[p.x, p.y, pushR(p)]];
    var c = Math.cos(p.a), s = Math.sin(p.a), o = 0.9 * p.s, r = 0.25 * p.s;
    return [[p.x, p.y, r], [p.x - c * o, p.y - s * o, r], [p.x + c * o, p.y + s * o, r]];
  }

  function mk(kind, x, y, visible) {
    var p = { kind: kind, x: x, y: y, vx: 0, vy: 0, a: 0, va: 0, s: R.s, loose: false, counted: false, hit: false, gone: false,
      touchAt: -1e9, alpha: visible ? 1 : 0, age: 0, fin: visible ? 300 : 0, fout: 0, ftot: 1, cf: 0, v: 0 };
    if (kind === "cube") p.v = (cubeTurn++) % 2;
    return p;
  }
  // One block, alone, fully there and harmful at once (the tests' seam).
  R.add = function (kind, x, y) { var p = mk(KIND[kind] ? kind : "cube", x, y, true); pieces.push(p); return p; };
  R.clear = function () { pieces.length = 0; sparks.length = 0; };
  R.fadeAll = function (ms) { for (var i = 0; i < pieces.length; i++) fadeOut(pieces[i], ms || 600); };
  function fadeOut(p, ms) { if (p.gone) return; p.gone = true; p.fout = p.ftot = ms; }

  // ── the patterns: [kind, x as a fraction of the width, dy (in blocks,
  // upward from the group's lowest), jitter (0 either way; -1 or 1 only away
  // from the middle)] ──
  function pattern(id, amp, side0) {
    var c = 0.5, g = amp + 0.16, sd = amp + 0.28, d = side0 < 0 ? -1 : 1;
    switch (id) {
      case "gate": return [["cube", c - g, 0, -1], ["cube", c + g, 0, 1]];
      case "side": return [["cube", c + d * sd, 0, d]];
      case "one": return [["cube", c, 0, 0]];
      case "bar": return [["bar", c, 0, 0]];
      case "tower3": return [["cube", c, 0, 0], ["cube", c, 1.05, 0], ["cube", c, 2.1, 0]];
      case "rain": return [["little", c - 0.10, 0, 0], ["little", c + 0.08, 1.2, 0], ["little", c, 2.4, 0], ["little", c - 0.04, 3.6, 0]];
      case "bumpy": return [["bumpy", c, 0, 0]];
      case "bars2": return [["bar", c - 0.12, 0, 0], ["bar", c + 0.12, 2.0, 0]];
      case "cluster6": return [["little", c - 0.08, 0, 0], ["little", c, 0, 0], ["little", c + 0.08, 0, 0], ["little", c - 0.08, 0.7, 0], ["little", c, 0.7, 0], ["little", c + 0.08, 0.7, 0]];
      case "cubebumpy": return [["cube", c, 0, 0], ["bumpy", c, 1.6, 0]];
      case "wall4": return [["cube", c - 0.30, 0, 0], ["cube", c - 0.10, 0, 0], ["cube", c + 0.10, 0, 0], ["cube", c + 0.30, 0, 0]];
      case "bumpyV": return [["bumpy", c - 0.2, 0, 0], ["bumpy", c, 1.3, 0], ["bumpy", c + 0.2, 0, 0]];
      case "wall5": return [["cube", 0.1, 0, 0], ["cube", 0.3, 0, 0], ["cube", 0.5, 0, 0], ["cube", 0.7, 0, 0], ["cube", 0.9, 0, 0]];
      case "barlittles": return [["bar", c, 0, 0], ["little", c - 0.25, 1, 0], ["little", c + 0.25, 1, 0]];
      case "tower4": return [["cube", c, 0, 0], ["cube", c, 1.05, 0], ["cube", c, 2.1, 0], ["cube", c, 3.15, 0]];
    }
    return [["cube", c, 0, 0]];
  }
  // A group falls in step from just above the HUD; it fades in (alpha
  // only), so it never pops into sight.
  R.spawn = function (id, amp) {
    var list = pattern(id, amp || 0, Math.random() < 0.5 ? -1 : 1), y0 = R.HUDB - R.s, i;
    for (i = 0; i < list.length; i++) {
      var e = list[i], j = Math.random() * 0.02, fx;
      fx = e[3] ? e[1] + e[3] * j : e[1] + (Math.random() < 0.5 ? -j : j);
      var p = mk(e[0], 0, 0, false), half = p.kind === "bar" ? 1.4 * p.s : side(p) / 2 + 2;
      p.x = clamp(fx * W, half, W - half); p.y = y0 - e[2] * R.s;
      pieces.push(p);
    }
    return list.length;
  };
  R.live = function () { var n = 0; for (var i = 0; i < pieces.length; i++) if (!pieces[i].gone) n++; return n; };

  // ── sizes: recomputed on every fit ──
  R.resize = function (w, h, hudb) {
    W = w; H = h; R.HUDB = hudb;
    var U = R.U = Math.min(W, 0.66 * (H - hudb));
    R.BAND = hudb + 102;
    Yb = hudb + 0.66 * (H - hudb);
    balloon.r = clamp(0.085 * U, 22, 46); balloon.hitR = 0.8 * balloon.r;
    if (floatF < 0) balloon.y = Yb; else R.balloonUp(floatF);
    if (!placed || !balloon.x) balloon.x = W / 2;
    shield.r = clamp(0.11 * U, 28, 56);
    R.s = clamp(0.13 * U, 32, 66);
    var b = R.shieldBox();
    if (!placed) R.placeShield();
    else { shield.tx = clamp(shield.tx, b.x0, b.x1); shield.ty = clamp(shield.ty, b.y0, b.y1); shield.x = clamp(shield.x, b.x0, b.x1); shield.y = clamp(shield.y, b.y0, b.y1); }
    for (var i = 0; i < puffs.length; i++) puffs[i].r = 0.11 * U;
    initBits();
  };
  // Anywhere across, always above the balloon: its centre stays at or above
  // the balloon's top less a shield and a little air, so it can never cover
  // the balloon or cost a heart.
  R.shieldBox = function () {
    var y0 = R.BAND, y1 = Yb - balloon.hitR - shield.r - 4;
    if (y1 < y0) y1 = y0;
    return { x0: shield.r, x1: Math.max(shield.r, W - shield.r), y0: y0, y1: y1 };
  };
  // Placed once per round; the game never moves it after that.
  R.placeShield = function () { var b = R.shieldBox(); shield.x = shield.tx = W / 2; shield.y = shield.ty = (b.y0 + b.y1) / 2; placed = true; };
  R.setup = function (o) {
    ctx = o.ctx; cb = o;
    if (!ART) ART = { balloon: pic(G + "rise-balloon.webp"), shield: pic(G + "rise-shield.webp"), cubeY: pic(G + "rise-cube-yellow.webp"),
      cubeP: pic(G + "rise-cube-purple.webp"), bar: pic(G + "rise-bar.webp"), bumpy: pic(G + "rise-bumpy.webp"),
      cloud: pic(G + "cloud.webp"), star: pic(G + "star.webp") };
  };

  // ── a frame ──
  // dt: ms of play (0 while hidden); pace: 0.55 while the sound power is on;
  // fall: the falling speed in px a frame at pace 1; mode: the page's phase;
  // live: the board moves (false while the say-it card is up).
  R.frame = function (dt, pace, fall, mode, now, live) {
    if (!W || !ctx) return;
    var i;
    if (live) {
      for (i = 0; i < pieces.length; i++) step(pieces[i], dt, pace, fall);
      moveShield(now);
      collide(now);
      hurt(now);
      cull(fall);
      puffStep(dt, pace);
      bitStep(fall, pace);
    }
    sparkStep(live);
    paint(now, mode);
  };
  function step(p, dt, pace, fall) {
    var km = KIND[p.kind].mul, damp = 1 - 0.06 * pace;
    p.x += p.vx * pace; p.y += (fall * km + p.vy) * pace; p.a += p.va * pace;
    p.vx *= damp; p.vy *= damp; p.va *= damp;
    p.age += dt * pace;
    if (p.fin < 300) p.fin = Math.min(300, p.fin + dt);
    // a block left alone for twelve seconds of play fades away, harmlessly
    if (!p.gone && p.age >= 12000) fadeOut(p, 500);
    if (p.gone) p.fout = Math.max(0, p.fout - dt);
    p.alpha = (p.gone ? p.fout / p.ftot : 1) * Math.min(1, p.fin / 300);
    p.fall = fall * km;
  }
  function cap(p) {
    var m = 0.05 * R.U, v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (v > m) { p.vx *= m / v; p.vy *= m / v; }
    var c = spinCap(p); p.va = clamp(p.va, -c, c);
  }

  // The shield reaches the finger's target in the same frame, in steps of
  // at most half its radius, so it never lags and never passes through a
  // block. A push moves the block out at once (never slowed: it shoves as
  // hard while the power is on) and sets it moving away, a little sideways
  // so pushed blocks leave by the sides.
  function moveShield(now) {
    var b = R.shieldBox(), x0 = shield.x, y0 = shield.y, i;
    shield.tx = clamp(shield.tx, b.x0, b.x1); shield.ty = clamp(shield.ty, b.y0, b.y1);
    var dx = shield.tx - x0, dy = shield.ty - y0, d = Math.sqrt(dx * dx + dy * dy);
    var n = Math.min(8, Math.max(1, Math.ceil(d / (0.5 * shield.r))));
    shVX = dx; shVY = dy;
    for (i = 0; i < pieces.length; i++) pieces[i].touch = false;
    for (var k = 1; k <= n; k++) { shield.x = x0 + dx * k / n; shield.y = y0 + dy * k / n; pushAll(now); }
    for (i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      p.cf = p.touch ? p.cf + 1 : 0;
      // a block resting on a still shield slides off it
      if (p.cf >= 2 && Math.abs(p.vx) < 0.3) { var o = p.x - shield.x; p.vx = Math.abs(o) < 2 ? (Math.random() < 0.5 ? -0.3 : 0.3) : (o < 0 ? -0.3 : 0.3); }
    }
  }
  function pushAll(now) {
    var U = R.U, i;
    for (i = 0; i < pieces.length; i++) {
      var p = pieces[i]; if (p.gone) continue;
      var cx, cy, reach;
      if (p.kind === "bar") { var q = nearest(seg(p, 1.1 * p.s), shield.x, shield.y); cx = q[0]; cy = q[1]; reach = shield.r + 4 + 0.3 * p.s; }
      else { cx = p.x; cy = p.y; reach = shield.r + 4 + pushR(p); }
      var ox = cx - shield.x, oy = cy - shield.y, d = Math.sqrt(ox * ox + oy * oy);
      if (d >= reach) continue;
      var nx = d > 0.001 ? ox / d : 0, ny = d > 0.001 ? oy / d : -1, ov = reach - d;
      p.x += nx * ov; p.y += ny * ov;
      var vn = p.vx * nx + p.vy * ny, want = Math.max(0, shVX * nx + shVY * ny) * 1.15 + 0.004 * U;
      if (vn < want) { p.vx += nx * (want - vn); p.vy += ny * (want - vn); }
      p.vx += (p.x >= balloon.x ? 1 : -1) * 0.002 * U;
      // spin: off the bar's middle it turns; a cube rolls with a sideways shove
      if (p.kind === "bar") { var rx = cx - p.x, ry = cy - p.y; p.va += (rx * ny - ry * nx) / (1.2 * p.s) * 0.04; }
      else p.va += (shVY * nx - shVX * ny) * 0.004;
      cap(p);
      p.touchAt = now; p.touch = true;
      if (!p.loose) { p.loose = true; loosened(p, now, true); }
    }
    for (i = 0; i < puffs.length; i++) {
      // a cloud still drifting in from above can't be knocked off on its way down
      var f = puffs[i]; if (f.gone || f.t < 1000) continue;
      var fx = f.x - shield.x, fy = f.y - shield.y, fd = Math.sqrt(fx * fx + fy * fy);
      if (fd < shield.r + f.r) popPuff(f, fd > 0.001 ? fx / fd : 0, fd > 0.001 ? fy / fd : -1, false);
    }
  }
  // A block counts the first time the shield, or a block the shield set
  // moving, touches it: never one that has already touched the balloon.
  // Three or more set moving within 0.8 s of one shield touch is a chain.
  function loosened(p, now, byShield) {
    if (byShield) { if (now - chain.t > 800) { chain.t = now; chain.n = 0; chain.fired = false; } chain.n++; }
    else if (now - chain.t <= 800) chain.n++;
    if (chain.n >= 3 && !chain.fired && now - chain.t <= 800) { chain.fired = true; burst(p.x, p.y, 14, ["#fff6c2", "#ffd84d", "#ffffff"]); if (cb.onChain) cb.onChain(p); }
    if (p.hit || p.counted) return;
    p.counted = true;
    if (cb.onCount) cb.onCount(p);
  }

  // Groups fall in step and never meet each other; a block only bumps
  // another once one of the two is loose. Equal shoves, a soft bounce.
  function collide(now) {
    for (var i = 0; i < pieces.length; i++) {
      var a = pieces[i]; if (a.gone) continue;
      for (var j = i + 1; j < pieces.length; j++) {
        var b = pieces[j]; if (b.gone || !(a.loose || b.loose)) continue;
        var A = circlesOf(a), B = circlesOf(b), met = false;
        for (var m = 0; m < A.length; m++) for (var k = 0; k < B.length; k++) {
          var dx = B[k][0] - A[m][0], dy = B[k][1] - A[m][1], d = Math.sqrt(dx * dx + dy * dy), rr = A[m][2] + B[k][2];
          if (d >= rr) continue;
          var nx = d > 0.001 ? dx / d : 1, ny = d > 0.001 ? dy / d : 0, ov = (rr - d) / 2;
          a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
          var rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv < 0) { var imp = -(1 + 0.4) * rv / 2; a.vx -= nx * imp; a.vy -= ny * imp; b.vx += nx * imp; b.vy += ny * imp; }
          met = true;
        }
        if (!met) continue;
        cap(a); cap(b);
        // a block the shield just set moving carries the shield's grace:
        // it never costs a heart in the 0.6 s after that push
        var t = Math.max(a.touchAt, b.touchAt); a.touchAt = b.touchAt = t;
        if (!a.loose) { a.loose = true; loosened(a, now, false); }
        if (!b.loose) { b.loose = true; loosened(b, now, false); }
      }
    }
  }

  // A block on the balloon: it always bounces away and never touches it
  // twice. Pushed by the shield in the last 0.6 s, that is all. Otherwise
  // the page decides (a heart, or protected), and the balloon wobbles and
  // the blocks near it are eased away, or a cream ring says it was safe.
  function hurt(now) {
    var bx = balloon.x, by = Yb, U = R.U, i;
    for (i = 0; i < pieces.length; i++) {
      var p = pieces[i]; if (p.hit || p.gone) continue;
      var cx, cy, reach;
      if (p.kind === "bar") { var q = nearest(seg(p, 1.2 * p.s), bx, by); cx = q[0]; cy = q[1]; reach = 0.2 * p.s + balloon.hitR; }
      else { cx = p.x; cy = p.y; reach = hurtR(p) + balloon.hitR; }
      var ox = cx - bx, oy = cy - by, d = Math.sqrt(ox * ox + oy * oy);
      if (d >= reach) continue;
      var nx = d > 0.001 ? ox / d : 0, ny = d > 0.001 ? oy / d : -1;
      p.hit = true;
      p.x += nx * (reach - d); p.y += ny * (reach - d);
      var vn = p.vx * nx + p.vy * ny, out = 0.012 * U;
      if (vn < out) { p.vx += nx * (out - vn); p.vy += ny * (out - vn); }
      cap(p);
      if (now - p.touchAt < 600) continue;
      var lost = cb.onHit ? !!cb.onHit(p, now) : false;
      if (lost) {
        wobAt = now;
        for (var j = 0; j < pieces.length; j++) {
          var o = pieces[j]; if (o === p || o.gone) continue;
          var ex = o.x - bx, ey = o.y - by, ed = Math.sqrt(ex * ex + ey * ey);
          if (ed < 2.5 * balloon.r) { var ux = ed > 0.001 ? ex / ed : 0, uy = ed > 0.001 ? ey / ed : -1; o.vx += ux * 0.008 * U; o.vy += uy * 0.008 * U; o.touchAt = now; cap(o); }
        }
      } else ringAt = now;
    }
  }
  function cull(fall) {
    for (var i = pieces.length - 1; i >= 0; i--) {
      var p = pieces[i], m = 1.5 * p.s, up = (p.fall || fall) + p.vy < 0;
      if (p.x < -m || p.x > W + m || p.y > H + m || (p.loose && up && p.y < -m) || (p.gone && p.fout <= 0)) pieces.splice(i, 1);
    }
  }

  // ── the top: five clouds to push away, then the big star ──
  R.startPuffs = function () {
    puffs.length = 0;
    var b = R.shieldBox(), X = [0.22, 0.5, 0.78, 0.36, 0.64], Y = [0.25, 0, 0.25, 0.8, 0.8];
    for (var i = 0; i < 5; i++) {
      var ty = b.y0 + Y[i] * (b.y1 - b.y0);
      puffs.push({ x: X[i] * W, y: -0.2 * R.U - i * 14, r: 0.11 * R.U, gone: false, y0: -0.2 * R.U - i * 14, ty: ty, t: 0, vx: 0, vy: 0, fade: 0, k: i });
    }
  };
  function popPuff(f, nx, ny, drift) {
    if (f.gone) return false;
    var sp = drift ? 0.012 * R.U : 0.03 * R.U;
    f.gone = true; f.fade = 500; f.vx = nx * sp; f.vy = ny * sp;
    burst(f.x, f.y, drift ? 6 : 12, ["#ffffff", "#fff6c2", "#cfe9ff"]);
    if (cb.onPuff) cb.onPuff(f, !!drift);
    return true;
  }
  // The nearest cloud left to (x, y) is sent away from it: a tap after a
  // while at the top, or (drift) the clouds leaving by themselves.
  R.popNearest = function (x, y, drift) {
    var best = null, bd = 1e12;
    for (var i = 0; i < puffs.length; i++) { var f = puffs[i]; if (f.gone) continue; var d = (f.x - x) * (f.x - x) + (f.y - y) * (f.y - y); if (d < bd) { bd = d; best = f; } }
    if (!best) return false;
    var dx = best.x - x, dy = best.y - y, d = Math.sqrt(dx * dx + dy * dy);
    if (drift || d < 1) { dx = best.x < W / 2 ? -0.6 : 0.6; dy = -0.8; d = 1; }
    return popPuff(best, dx / d, dy / d, drift);
  };
  R.puffsLeft = function () { var n = 0; for (var i = 0; i < puffs.length; i++) if (!puffs[i].gone) n++; return n; };
  function puffStep(dt, pace) {
    for (var i = puffs.length - 1; i >= 0; i--) {
      var f = puffs[i];
      if (!f.gone) { f.t += dt; var k = Math.min(1, f.t / 1000), e = 1 - Math.pow(1 - k, 3); f.y = f.y0 + (f.ty - f.y0) * e; }
      else { f.x += f.vx; f.y += f.vy; f.fade = Math.max(0, f.fade - dt); }
    }
  }
  function starXY() { return [W / 2, R.HUDB + 0.5 * (R.BAND - R.HUDB), 0.12 * R.U]; }
  // f from 0 to 1: the balloon floats from its place up to the star
  R.balloonUp = function (f) {
    floatF = clamp(f, 0, 1);
    var s = starXY(), top = s[1] + s[2] * 0.9 + balloon.r, e = floatF < 0.5 ? 2 * floatF * floatF : 1 - Math.pow(-2 * floatF + 2, 2) / 2;
    balloon.y = Yb + (top - Yb) * e;
  };
  R.arrive = function () { var s = starXY(); burst(s[0], s[1], 26, ["#ffd21c", "#ffffff", "#ff8fa3", "#8fd3ff"]); };
  R.wobble = function () { wobAt = now0(); };
  R.safeRing = function () { ringAt = now0(); };

  // ── what drifts behind: clouds by day, twinkling stars at night ──
  function initBits() {
    bits.length = 0; if (!W) return;
    for (var i = 0; i < 4; i++) bits.push({ x: ((i * 0.37 + 0.12) % 1) * W, y: R.HUDB + (i / 4) * (H - R.HUDB), w: R.U * (0.24 + (i % 3) * 0.06), k: i });
    for (i = 0; i < 22; i++) bits.push({ x: ((i * 0.618 + 0.05) % 1) * W, y: ((i * 0.37 + 0.11) % 1) * H, w: 1.5 + (i % 3), k: i, dot: true });
  }
  function bitStep(fall, pace) {
    for (var i = 0; i < bits.length; i++) {
      var b = bits[i];
      b.y += (b.dot ? 0.2 : 0.4) * fall * pace;
      if (b.y > H + 60) { b.y = b.dot ? -4 : R.HUDB - 60 - Math.random() * 80; b.x = Math.random() * W; }
    }
  }
  function sparkStep(live) {
    for (var i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i];
      if (live) { s.x += s.vx; s.y += s.vy; s.vy += 0.05; s.life -= 0.025; }
      if (s.life <= 0) sparks.splice(i, 1);
    }
  }
  function burst(x, y, n, cols) {
    for (var k = 0; k < n; k++) { var a = Math.random() * 6.283, v = 1.5 + Math.random() * 2.5; sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 1, c: cols[k % cols.length] }); }
  }

  // ── drawing ──
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function cloud0(x, y, w) { ctx.beginPath(); ctx.ellipse(x, y, w * 0.5, w * 0.16, 0, 0, 7); ctx.ellipse(x - w * 0.22, y - w * 0.08, w * 0.2, w * 0.14, 0, 0, 7); ctx.ellipse(x + w * 0.12, y - w * 0.12, w * 0.24, w * 0.17, 0, 0, 7); ctx.fill(); }
  function cloud(x, y, w) {
    if (ready(ART.cloud)) { var h = w * ART.cloud.naturalHeight / ART.cloud.naturalWidth; ctx.drawImage(ART.cloud, x - w / 2, y - h / 2, w, h); return; }
    ctx.fillStyle = "#ffffff"; cloud0(x, y + w * 0.06, w);
  }
  function star0(x, y, r) { ctx.beginPath(); for (var k = 0; k < 10; k++) { var q = k % 2 ? r * 0.45 : r, a = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } ctx.closePath(); ctx.fill(); }

  function paint(now, mode) {
    var i;
    // 1. what drifts behind
    if (R.sky < 2) { ctx.globalAlpha = 0.55; for (i = 0; i < bits.length; i++) if (!bits[i].dot) cloud(bits[i].x, bits[i].y, bits[i].w); ctx.globalAlpha = 1; }
    else {
      ctx.fillStyle = "#fff6c8";
      for (i = 0; i < bits.length; i++) { var b = bits[i]; if (!b.dot) continue; ctx.globalAlpha = R.calm ? 0.6 : 0.35 + 0.35 * (1 + Math.sin(now / 600 + b.k * 1.7)) / 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.w, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // 2. soft shadows, 3. the blocks
    for (i = 0; i < pieces.length; i++) drawPiece(pieces[i], true);
    for (i = 0; i < pieces.length; i++) drawPiece(pieces[i], false);
    // 4. the shield
    drawShield(now);
    // 5. the balloon, last of the playing pieces so it is never hidden
    drawBalloon(now);
    // 7. sparks, the clouds at the top, the star
    if (R.showStar) drawStar(now);
    for (i = 0; i < puffs.length; i++) drawPuff(puffs[i], now);
    for (i = 0; i < sparks.length; i++) { var s = sparks[i]; ctx.globalAlpha = Math.max(0, Math.min(1, s.life)); ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // 8. the fingertip hint
    if (R.hint) drawHint(now);
  }
  function drawPiece(p, shadow) {
    if (p.alpha <= 0) return;
    var w = side(p), h = w, im = null, col = "#ffd84d", top = "#fff0a0";
    if (p.kind === "cube") { im = p.v ? ART.cubeP : ART.cubeY; if (p.v) { col = "#a98be8"; top = "#cdbcf6"; } }
    else if (p.kind === "little") { im = ART.cubeP; col = "#a98be8"; top = "#cdbcf6"; }
    else if (p.kind === "bar") { w = 2.8 * p.s; h = 0.5 * p.s; im = ART.bar; col = "#c98a4b"; top = "#e3b37c"; }
    else if (p.kind === "bumpy") { im = ART.bumpy; col = "#9bd94a"; top = "#c6ee8f"; }
    ctx.save();
    ctx.translate(p.x + (shadow ? 3 : 0), p.y + (shadow ? 6 : 0)); ctx.rotate(p.a);
    ctx.globalAlpha = p.alpha * (shadow ? 0.16 : 1);
    if (shadow) {
      ctx.fillStyle = "#1e3550";
      if (p.kind === "bumpy") { ctx.beginPath(); ctx.arc(0, 0, w * 0.48, 0, 7); ctx.fill(); }
      else { rr(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.24); ctx.fill(); }
    } else if (ready(im)) ctx.drawImage(im, -w / 2, -h / 2, w, h);
    else if (p.kind === "bumpy") {
      ctx.fillStyle = col;
      for (var k = 0; k < 10; k++) { var a = k / 10 * 6.283; ctx.beginPath(); ctx.arc(Math.cos(a) * w * 0.37, Math.sin(a) * w * 0.37, w * 0.12, 0, 7); ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, 0, w * 0.38, 0, 7); ctx.fill();
      ctx.fillStyle = top; ctx.beginPath(); ctx.arc(-w * 0.12, -w * 0.13, w * 0.11, 0, 7); ctx.fill();
    } else {
      var r = Math.min(w, h) * 0.24;
      ctx.fillStyle = col; rr(-w / 2, -h / 2, w, h, r); ctx.fill();
      ctx.fillStyle = top; rr(-w / 2 + 3, -h / 2 + 3, w - 6, Math.max(4, h * 0.26), r * 0.7); ctx.fill();
    }
    ctx.restore();
  }
  function drawShield(now) {
    var x = shield.x, y = shield.y, r = shield.r;
    ctx.save();
    ctx.globalAlpha = 0.18; ctx.fillStyle = "#1e3550"; ctx.beginPath(); ctx.arc(x + 3, y + 6, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    if (ready(ART.shield)) ctx.drawImage(ART.shield, x - r, y - r, 2 * r, 2 * r);
    else {
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.fillStyle = "#0799a8"; ctx.beginPath(); ctx.arc(x, y, r - 3, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff6e0"; ctx.beginPath(); ctx.arc(x, y, r - 7, 0, 7); ctx.fill();
      ctx.fillStyle = "#ffd21c"; star0(x, y, r * 0.28);
    }
    // until the first drag: a teal ring that says "this is yours to move"
    if (R.hint) {
      var k = R.calm ? 0.5 : (1 + Math.sin(now / 260)) / 2;
      ctx.strokeStyle = "#0799a8"; ctx.lineWidth = 3; ctx.globalAlpha = 0.45 + 0.4 * k;
      ctx.beginPath(); ctx.arc(x, y, r + 6 + 5 * k, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function drawBalloon(now) {
    var r = balloon.r, x = balloon.x, y = balloon.y + Math.sin(now / 600) * (R.calm ? 1 : 3);
    var k = (now - wobAt) / 700, rot = 0, sq = 0, blink = now - wobAt < 900;
    if (k >= 0 && k < 1) { var w = (1 - k) * Math.sin(k * Math.PI * 4); rot = (R.calm ? 0.08 : 0.25) * w; sq = 0.06 * w; }
    ctx.save();
    // a bump: under Reduce Motion a steady white halo instead of a blink
    if (blink && R.calm) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 5; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(x, y, r * 1.4, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1 + sq, 1 - sq);
    if (blink && !R.calm && (((now - wobAt) / 120) | 0) % 2) ctx.globalAlpha = 0.45;
    if (ready(ART.balloon)) {
      var h = 2 * r * ART.balloon.naturalHeight / ART.balloon.naturalWidth;
      ctx.drawImage(ART.balloon, -r, -r, 2 * r, h);
    } else {
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, r * 1.1);
      ctx.bezierCurveTo(-r * 0.25, r * 1.5, r * 0.25, r * 1.9, 0, r * 2.5); ctx.stroke();
      ctx.fillStyle = "#e85a4f"; ctx.beginPath(); ctx.moveTo(-r * 0.16, r * 1.16); ctx.lineTo(r * 0.16, r * 1.16); ctx.lineTo(0, r * 0.98); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ff6f61"; ctx.beginPath(); ctx.ellipse(0, r * 0.06, r, r * 1.08, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.38, r * 0.2, r * 0.3, -0.5, 0, 7); ctx.fill();
    }
    ctx.restore();
    // protected: a cream ring says the balloon was safe
    var rk = (now - ringAt) / 400;
    if (rk >= 0 && rk < 1) { ctx.save(); ctx.strokeStyle = "#fff6e0"; ctx.lineWidth = 5; ctx.globalAlpha = 1 - rk; ctx.beginPath(); ctx.arc(x, y, r * (1.3 + 0.2 * rk), 0, 7); ctx.stroke(); ctx.restore(); }
  }
  function drawStar(now) {
    var s = starXY(), g = R.calm ? 1 : 1 + 0.05 * Math.sin(now / 300);
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = "#fff6c2"; ctx.beginPath(); ctx.arc(s[0], s[1], s[2] * 1.6 * g, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    if (ready(ART.star)) ctx.drawImage(ART.star, s[0] - s[2] * g, s[1] - s[2] * g, 2 * s[2] * g, 2 * s[2] * g);
    else { ctx.fillStyle = "#ffd21c"; star0(s[0], s[1], s[2] * g); }
    ctx.restore();
  }
  function drawPuff(f, now) {
    var a = f.gone ? f.fade / 500 : 1; if (a <= 0) return;
    var w = 0.30 * R.U;
    ctx.save(); ctx.globalAlpha = a;
    if (R.puffGlow && !f.gone) { var k = R.calm ? 0.5 : (1 + Math.sin(now / 250 + f.k)) / 2; ctx.globalAlpha = 0.3 + 0.3 * k; ctx.fillStyle = "#fff6c2"; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.5, 0, 7); ctx.fill(); ctx.globalAlpha = a; }
    cloud(f.x, f.y, w);
    ctx.restore();
  }
  // a fingertip sliding side to side near the bottom: drag, don't tap
  function drawHint(now) {
    var y = Math.min(H - 95, Yb + balloon.r * 2.7 + 20), x = W / 2 + (R.calm ? 0 : 0.18 * W * Math.sin(now / 1800 * 6.283));
    ctx.save();
    ctx.globalAlpha = 0.9; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(x - 30, y - 8); ctx.lineTo(x - 38, y); ctx.lineTo(x - 30, y + 8); ctx.moveTo(x + 30, y - 8); ctx.lineTo(x + 38, y); ctx.lineTo(x + 30, y + 8); ctx.stroke();
    ctx.globalAlpha = 0.25; ctx.fillStyle = "#1e3550"; ctx.beginPath(); ctx.arc(x + 2, y + 4, 14, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.95; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.fill();
    ctx.strokeStyle = "#0799a8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.stroke();
    ctx.restore();
  }
})(window);
