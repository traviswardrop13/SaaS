/* Bubble Pop, rebuilt to be played (Travis, 1 Oct 2026, choosing between two
   plans: "yeah B", after "more like the feed echo vibe ... we want to have
   more bubbles to pop"). The plan he picked: Echo holds a bubble wand; say the
   word and Echo blows a cloud of bubbles; pop them all; the gold bubble has
   the word's picture inside, and popping it drops the picture into the
   basket; five words fill the basket, then Echo floats up inside one giant
   bubble, and popping it ends the round.

   The old Bubble Pop was one bubble at a time and five taps a round, and a
   child never had to say anything (its mic was an optional cheer that an
   iPhone never opened). It ran on simple-play.js, which Peekaboo still uses.

   sayplay.js owns every word turn, the mic and its quiet rules, the start
   card, pausing and the end card, as it does for Hoops, Soccer Goal and Dino
   Dig. This file is the bubbles: it draws them, pops them and flies the
   picture to the basket. It never touches the mic.

   THE WORD BLOWS THE BUBBLES; THE FINGER POPS THEM. No bubble before the
   word, so a tap on the empty sky pops nothing, and the step counts only when
   every bubble is popped and the picture is in the basket. Every round ends
   (Rachel's rule: end on a success): bubbles bob in place and never float
   away, a touch near a bubble pops it, after a while the ones left glow and
   take a wider touch, and later still a touch anywhere pops the nearest one.
   A bubble never pops by itself.

   Its wand, basket and sky are drawn here, plainly, until the art arrives
   (the bubble itself is the painted one). The word pictures are the painted
   ones Feed Echo uses; they are HTML, laid over the canvas.

   Nothing here is practice data: no attempt, rep, coin or sticker is written. */
(function () {
  "use strict";
  var api = null, cv = null, ctx = null, W = 0, H = 0, DPR = 1, s = 1;
  var raf = 0, lastT = 0, clock = 0, running = false, frozen = false;
  // everything below is in board units (440 x 520); s turns them into pixels
  var BW = 440, BH = 520;
  var ZONE = { x0: 0, y0: 10, x1: 440, y1: 372 };          // where bubbles live
  var RING = { x: 150, y: 388, r: 15 }, GRIP = { x: 108, y: 440 };  // the wand: its ring, and Echo's wing
  var PER_WORD = [6, 7, 7, 8, 8];                          // bubbles a word blows, the gold one included

  // state: idle (no bubbles: a word turn) | ready (bubbles out) | placed (all
  // popped, the picture in the basket: the cheer, then the next word) | giant
  // (the last word's finish: Echo in one big bubble) | burst (it popped)
  var state = "idle", count = 5, words = 0, total = 0, left = [], fx = [], prize = null, giant = null;
  var doneAt = 0, helpAt = 0, anyAt = 0, readyAt = 0, calm = false, pose = "wave";
  var HELP_S = 7, ANY_S = 14;

  // the painted bubble, and Echo for the giant one. Held, not thrown away: a
  // picture nobody holds is collected and loads late.
  var BUB = new Image(), INSIDE = new Image();
  BUB.src = "/assets/crafted/game/bubble.webp"; INSIDE.src = "/assets/crafted/echo-cheer.webp";
  // Drop-ins for painted art when it arrives: a wand and a basket picture.
  var WAND_PIC = "", wandImg = null;

  function el(id) { return document.getElementById(id); }
  function resize() {
    if (!cv) return;
    var r = cv.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    s = W / BW;
    if (prize && !prize.landed) placePrize();
  }

  // ── drawing ──
  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#BFE6F7"); g.addColorStop(0.62, "#E6F6F4"); g.addColorStop(1, "#F4F1D6");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // two soft clouds and a low hill, so the sky is somewhere
    ctx.fillStyle = "rgba(255,255,255,.75)";
    [[92, 70, 1], [330, 118, 0.8]].forEach(function (c) {
      var x = c[0] * s, y = c[1] * s, k = c[2] * s;
      ctx.beginPath(); ctx.arc(x, y, 26 * k, 0, Math.PI * 2); ctx.arc(x + 30 * k, y - 10 * k, 32 * k, 0, Math.PI * 2); ctx.arc(x + 66 * k, y, 24 * k, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = "#DDEBC2";
    ctx.beginPath(); ctx.moveTo(0, 404 * s); ctx.quadraticCurveTo(150 * s, 372 * s, 300 * s, 398 * s); ctx.quadraticCurveTo(380 * s, 410 * s, W, 392 * s); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  }
  // the wand: a stick from Echo's wing to a ring with a soap film in it
  function drawWand() {
    if (pose !== "wave" || state === "giant" || state === "burst") return;
    if (wandImg && wandImg.complete && wandImg.naturalWidth) { ctx.drawImage(wandImg, (RING.x - 40) * s, (RING.y - 24) * s, 96 * s, 96 * s); return; }
    ctx.lineCap = "round";
    ctx.strokeStyle = "#B98450"; ctx.lineWidth = 6 * s;
    ctx.beginPath(); ctx.moveTo(GRIP.x * s, GRIP.y * s); ctx.lineTo((RING.x - 9) * s, (RING.y + 12) * s); ctx.stroke();
    ctx.fillStyle = "rgba(190,236,250,.55)"; ctx.beginPath(); ctx.arc(RING.x * s, RING.y * s, RING.r * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#1FA6B8"; ctx.lineWidth = 4.5 * s; ctx.beginPath(); ctx.arc(RING.x * s, RING.y * s, RING.r * s, 0, Math.PI * 2); ctx.stroke();
  }
  function bubbleAt(x, y, r, gold, alpha) {
    var px = x * s, py = y * s, pr = r * s;
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    if (gold) {                                           // gold: a warm glow inside and a gold rim
      var gg = ctx.createRadialGradient(px, py, pr * 0.1, px, py, pr);
      gg.addColorStop(0, "rgba(255,236,150,.55)"); gg.addColorStop(1, "rgba(255,193,7,.38)");
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    }
    if (BUB.complete && BUB.naturalWidth) {
      // the painted circle sits at (193,189) of its 384 x 410 frame, 380 across
      var k = (pr * 2) / 380;
      ctx.drawImage(BUB, px - 193 * k, py - 189 * k, 384 * k, 410 * k);
    } else {
      ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(120,190,225,.9)"; ctx.lineWidth = Math.max(1.5, 2.5 * s); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.beginPath(); ctx.ellipse(px - pr * 0.36, py - pr * 0.4, pr * 0.2, pr * 0.12, -0.7, 0, Math.PI * 2); ctx.fill();
    }
    if (gold) { ctx.strokeStyle = "#F0A800"; ctx.lineWidth = Math.max(2, 3.5 * s); ctx.beginPath(); ctx.arc(px, py, pr * 0.97, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  // where a bubble is now: it grows out of the wand's ring to its own spot,
  // then bobs there. It never leaves, so it can always be popped.
  function where(b) {
    var age = clock - b.born, k = Math.max(0, Math.min(1, age / b.rise)), e = 1 - Math.pow(1 - k, 3);
    var amp = calm ? 0.3 : 1;
    var bx = b.hx + Math.sin(clock * b.w1 + b.ph) * b.ax * amp * e, by = b.hy + Math.cos(clock * b.w2 + b.ph * 1.7) * b.ay * amp * e;
    return { x: RING.x + (bx - RING.x) * e, y: RING.y + (by - RING.y) * e, r: b.r * (0.25 + 0.75 * e), k: k };
  }
  function drawBubbles() {
    var help = state === "ready" && clock >= helpAt;
    for (var i = 0; i < left.length; i++) {
      var b = left[i]; if (clock < b.born) continue;
      var p = where(b);
      if (help) {                                          // the ones left glow
        var g = (clock * 1.5 + i * 0.3) % 1;
        ctx.strokeStyle = "rgba(255,210,28," + (0.85 * (1 - g)).toFixed(2) + ")"; ctx.lineWidth = 5 * s;
        ctx.beginPath(); ctx.arc(p.x * s, p.y * s, p.r * (1.08 + g * 0.3) * s, 0, Math.PI * 2); ctx.stroke();
      }
      bubbleAt(p.x, p.y, p.r, b.gold);
    }
  }
  function drawGiant() {
    if (!giant) return;
    var k = Math.min(1, (clock - giant.born) / 1.4), e = 1 - Math.pow(1 - k, 3);
    giant.x = BW / 2 + Math.sin(clock * 0.9) * 8 * (calm ? 0.3 : 1) * e;
    giant.y = (BH + giant.r) + ((BH * 0.36) - (BH + giant.r)) * e + Math.cos(clock * 1.1) * 6 * (calm ? 0.3 : 1) * e;
    giant.up = k >= 0.75;
    if (state === "burst") return;
    var px = giant.x * s, py = giant.y * s, pr = giant.r * s;
    if (clock - giant.born > 5) {                          // "pop me": a slow gold ring
      var g = (clock * 1.2) % 1;
      ctx.strokeStyle = "rgba(255,210,28," + (0.85 * (1 - g)).toFixed(2) + ")"; ctx.lineWidth = 6 * s;
      ctx.beginPath(); ctx.arc(px, py, pr * (1.04 + g * 0.16), 0, Math.PI * 2); ctx.stroke();
    }
    if (INSIDE.complete && INSIDE.naturalWidth) ctx.drawImage(INSIDE, px - pr * 0.62, py - pr * 0.6, pr * 1.24, pr * 1.24);
    bubbleAt(giant.x, giant.y, giant.r, false);
  }
  // how to play, shown until the first pop: a fingertip tapping a bubble
  function drawHint() {
    if (state !== "ready" || total > 0 || !left.length || clock < readyAt + 1.2) return;
    var b = null; for (var i = 0; i < left.length; i++) if (!left[i].gold) { b = left[i]; break; }
    b = b || left[0];
    var p = where(b), k = (clock % 1.2) / 1.2, press = k < 0.5 ? k * 2 : 2 - k * 2;
    ctx.globalAlpha = 0.9; ctx.fillStyle = "#fff"; ctx.strokeStyle = "#1D2B4F"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc((p.x + p.r * 0.5) * s, (p.y + p.r * (0.9 - press * 0.45)) * s, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
  }
  function drawFx(dt) {
    for (var i = fx.length - 1; i >= 0; i--) {
      var f = fx[i]; f.t += dt;
      if (f.t > f.life) { fx.splice(i, 1); continue; }
      var k = f.t / f.life;
      if (f.kind === "ring") {
        ctx.globalAlpha = Math.max(0, 1 - k); ctx.strokeStyle = f.c; ctx.lineWidth = Math.max(1.5, 3 * s * (1 - k));
        ctx.beginPath(); ctx.arc(f.x * s, f.y * s, f.r * (1 + k * 0.55) * s, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (f.kind === "drop") {
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt;
        ctx.globalAlpha = Math.max(0, 1 - k); ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x * s, f.y * s, f.s * s * (1 - k * 0.4), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      } else if (f.kind === "spark") {
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 260 * dt;
        ctx.globalAlpha = Math.max(0, 1 - k); ctx.fillStyle = f.c;
        ctx.save(); ctx.translate(f.x * s, f.y * s); ctx.rotate(f.t * 6); var z = f.s * s * (1 - k * 0.5);
        ctx.beginPath(); for (var j = 0; j < 10; j++) { var rad = j % 2 ? z * 0.45 : z, an = -Math.PI / 2 + j * Math.PI / 5; ctx.lineTo(Math.cos(an) * rad, Math.sin(an) * rad); } ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.globalAlpha = 1;
      } else if (f.kind === "word") {
        var pop = k < 0.15 ? 0.4 + (k / 0.15) * 0.8 : k < 0.25 ? 1.2 - (k - 0.15) * 2 : 1;
        ctx.globalAlpha = k > 0.75 ? Math.max(0, (1 - k) / 0.25) : 1;
        ctx.save(); ctx.translate(f.x * s, (f.y - k * 16) * s); ctx.scale(pop, pop); ctx.rotate(-0.06);
        ctx.font = "800 " + Math.round(Math.max(24, W * 0.12)) + "px 'Baloo 2', Nunito, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineJoin = "round"; ctx.lineWidth = 8; ctx.strokeStyle = "#fff"; ctx.strokeText(f.text, 0, 0); ctx.fillStyle = f.c; ctx.fillText(f.text, 0, 0); ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
  }
  // a pop: the bubble's rim flying apart, in soap colours (never the orange
  // that means the practice sound's letters)
  var SOAP = ["#7FD3F0", "#FFFFFF", "#C9B8FF", "#FFD21C", "#FF9EC4"];
  function popFx(x, y, r, gold) {
    fx.push({ kind: "ring", x: x, y: y, r: r, c: gold ? "#F0A800" : "#8FD6F2", t: 0, life: 0.32 });
    for (var i = 0; i < 9; i++) { var a = (i / 9) * Math.PI * 2 + total, sp = 70 + ((i * 37 + total * 13) % 90); fx.push({ kind: "drop", x: x + Math.cos(a) * r * 0.8, y: y + Math.sin(a) * r * 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, s: 3 + (i % 3), c: gold ? "#FFD21C" : SOAP[i % SOAP.length], t: 0, life: 0.5 + (i % 3) * 0.08 }); }
  }
  function sparks(x, y, n) {
    for (var i = 0; i < (n || 16); i++) { var a = (i / (n || 16)) * Math.PI * 2 + clock, sp = 90 + ((i * 37) % 160); fx.push({ kind: "spark", x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, s: 6 + (i % 6), c: SOAP[i % SOAP.length], t: 0, life: 0.9 + (i % 4) * 0.1 }); }
  }
  // the game's cheers are the action teal (/action.css --act)
  var SHOUT = "#1FA6B8";
  function shout(text, x, y) { fx.push({ kind: "word", text: text, x: x, y: y, c: SHOUT, t: 0, life: 2.2 }); }

  function frame(now) {
    raf = 0; if (!running) return;
    var dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
    if (!frozen) { clock += dt; step(dt); if (state === "ready" || state === "giant") publish(); }
    render(frozen ? 0 : dt);
    raf = requestAnimationFrame(frame);
  }
  function render(dt) {
    ctx.clearRect(0, 0, W, H);
    drawSky(); drawWand(); drawBubbles(); drawGiant(); drawHint(); drawFx(dt);
    if (prize && !prize.landed) placePrize();
  }

  // ── Echo beside the wand (an <img> over the canvas) ──
  function echo(p, hop) {
    pose = p;
    try {
      var e = el("bubEcho"); if (!e) return;
      e.style.visibility = p === "none" ? "hidden" : "visible";
      if (p !== "none") { var src = "/assets/crafted/echo-" + p + ".webp"; if (e.getAttribute("src") !== src) e.src = src; }
      if (hop) { e.classList.remove("hop"); void e.offsetWidth; e.classList.add("hop"); }
    } catch (x) {}
  }

  // ── the word's picture: inside the gold bubble, then in the basket ──
  function picHTML(size) {
    var w = (window.__sayplay && window.__sayplay.word) || "", h = null;
    try { h = window.SonaCraftedWords && window.SonaCraftedWords.picture(w, size); } catch (e) {}
    if (h) return h;
    try { return el("pic").innerHTML; } catch (e2) { return ""; }   // what the engine drew for this word
  }
  function wells() { var b = el("basket"); return b ? b.querySelectorAll(".well") : []; }
  // the prize rides on the gold bubble until it is popped, then flies to the
  // next well. An HTML element: the painted word pictures are sprite crops.
  function placePrize() {
    var p = el("prize"); if (!p || !prize) return;
    var x, y, k;
    if (prize.fly) {
      var t = Math.min(1, prize.fly.t / prize.fly.dur), e = 1 - Math.pow(1 - t, 3);
      x = prize.fly.x + (prize.fly.tx - prize.fly.x) * e; y = prize.fly.y + (prize.fly.ty - prize.fly.y) * e - Math.sin(t * Math.PI) * 60;
      k = prize.fly.k + (prize.fly.tk - prize.fly.k) * e;
    } else {
      var w = where(prize.b); x = w.x; y = w.y; k = (w.r * 1.18) / 64;
    }
    prize.x = x; prize.y = y; prize.k = k;
    p.style.transform = "translate(" + (x * s - 32).toFixed(1) + "px," + (y * s - 32).toFixed(1) + "px) scale(" + (k * s).toFixed(3) + ")";
  }
  function wellSpot(i) {
    var ws = wells(), w = ws[Math.min(i, ws.length - 1)];
    if (!w) return { x: BW * 0.6, y: BH * 0.9, k: 0.6 };
    var a = w.getBoundingClientRect(), c = cv.getBoundingClientRect();
    return { x: (a.left + a.width / 2 - c.left) / s, y: (a.top + a.height / 2 - c.top) / s, k: (a.width * 0.86) / 64 / s };
  }
  function landPrize() {
    var ws = wells(), w = ws[Math.min(words, ws.length - 1)], p = el("prize");
    try {
      if (w) { w.innerHTML = picHTML(Math.max(20, Math.round(w.getBoundingClientRect().width * 0.86))); w.classList.add("full"); }
      if (p) { p.hidden = true; p.innerHTML = ""; }
    } catch (e) {}
    prize.landed = true; prize.fly = null;
    sound("drop");
    var t = wellSpot(words); sparks(t.x, t.y - 6, 8);
  }

  // ── the bubbles ──
  function blow(n) {
    left = [];
    // the gold one near the middle, the others wherever there is room
    var spots = [], tries = 0, i;
    function fits(x, y, r) { for (var j = 0; j < spots.length; j++) { var dx = spots[j].x - x, dy = spots[j].y - y, d = spots[j].r + r + 6; if (dx * dx + dy * dy < d * d) return false; } return true; }
    // big enough for a three-year-old's finger: about 60 to 70 px across on a
    // phone, and the gold one bigger
    var goldR = 50, gx = 190 + ((words * 53) % 90), gy = 170 + ((words * 37) % 60);
    spots.push({ x: gx, y: gy, r: goldR, gold: true });
    for (i = 1; i < n && tries < 600; tries++) {
      var r = 37 + ((i * 7 + tries * 3 + words * 5) % 7), pad = r + 16;
      var x = ZONE.x0 + pad + ((tries * 97 + i * 131 + words * 61) % 1000) / 1000 * (ZONE.x1 - ZONE.x0 - pad * 2);
      var y = ZONE.y0 + pad + ((tries * 61 + i * 173 + words * 29) % 1000) / 1000 * (ZONE.y1 - ZONE.y0 - pad * 2);
      if (tries > 400 || fits(x, y, r)) { spots.push({ x: x, y: y, r: r, gold: false }); i++; }
    }
    // plain ones first out of the wand, the gold one last and on top
    spots.reverse();
    for (i = 0; i < spots.length; i++) {
      var q = spots[i];
      left.push({ hx: q.x, hy: q.y, r: q.r, gold: q.gold, born: clock + 0.25 + i * 0.11, rise: 0.75, w1: 0.7 + (i % 4) * 0.17, w2: 0.9 + (i % 3) * 0.21, ph: i * 1.9, ax: 9 + (i % 3) * 4, ay: 7 + (i % 4) * 3 });
    }
  }
  function sound(name) { if (api && api.sfx) try { api.sfx(name); } catch (e) {} }
  function popBubble(i) {
    var b = left[i], p = where(b);
    left.splice(i, 1); total++;
    popFx(p.x, p.y, p.r, b.gold);
    // a pop puts the help off again. But once the late help is on, it stays on
    // for this word: the child who needs it most was waiting the whole fourteen
    // seconds again for every bubble. A beat, not zero: a dragged finger
    // touches on every move, and would empty the sky in one stroke.
    if (clock >= anyAt) anyAt = clock + 1.5; else { helpAt = clock + HELP_S; anyAt = clock + ANY_S; }
    if (b.gold) {
      // the picture falls out and flies to the basket
      sound("gold"); sparks(p.x, p.y, 10);
      var t = wellSpot(words);
      prize.fly = { t: 0, dur: 0.75, x: p.x, y: p.y, k: (p.r * 1.18) / 64, tx: t.x, ty: t.y, tk: t.k };
    } else sound("pop");
    publish();
  }
  // the bubble under a touch, the top one first; near enough counts, and
  // nearer still once the help is on
  function hit(pt) {
    var reach = clock >= helpAt ? 1.6 : 1.22, best = -1, bestD = 1e9;
    for (var i = left.length - 1; i >= 0; i--) {
      var b = left[i]; if (clock < b.born) continue;
      var p = where(b); if (p.k < 0.55) continue;
      var dx = pt.x - p.x, dy = pt.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d <= p.r * reach + 6 && d < bestD) { best = i; bestD = d; }
    }
    if (best < 0 && clock >= anyAt) {                      // late help: a touch anywhere pops the nearest
      for (var j = 0; j < left.length; j++) { var q = where(left[j]), ex = pt.x - q.x, ey = pt.y - q.y, dd = ex * ex + ey * ey; if (clock >= left[j].born && dd < bestD) { best = j; bestD = dd; } }
    }
    return best;
  }
  function step(dt) {
    if (doneAt && clock >= doneAt) {
      doneAt = 0;
      if (state === "placed") { state = "idle"; words++; prize = null; echo("wave"); publish(); if (api) api.done(); }
      else if (state === "burst") { state = "idle"; words++; prize = null; giant = null; publish(); if (api) api.done(); }
      return;
    }
    if (prize && prize.fly) { prize.fly.t += dt; if (prize.fly.t >= prize.fly.dur) landPrize(); }
    if (state === "ready" && !left.length && prize && prize.landed) {
      // every bubble popped and the picture is in the basket
      try { api.hint(""); } catch (e) {}
      if (words >= count - 1) {
        // the last word: Echo floats up inside one giant bubble
        state = "giant"; giant = { born: clock, r: 104, x: BW / 2, y: BH + 104, up: false };
        echo("none"); sound("blow");
        try { api.hint("Pop the big bubble!"); } catch (e2) {}
      } else {
        state = "placed"; echo("cheer", true);
        // the next word waits for the cheer, on the game's own clock, so a
        // pause in between holds it rather than skipping it
        doneAt = clock + 0.9;
      }
      publish();
    }
  }
  function popGiant() {
    if (state !== "giant" || !giant || !giant.up) return;
    state = "burst"; total++;
    popFx(giant.x, giant.y, giant.r, true); sparks(giant.x, giant.y, 22); sparks(giant.x - 90, giant.y + 40, 12); sparks(giant.x + 90, giant.y + 40, 12);
    sound("big");
    echo("cheer", true);
    try { api.hint(""); } catch (e) {}
    doneAt = clock + 0.7;
    publish();
  }

  // ── the finger ──
  var touching = false;
  function pointFrom(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }; }
  function touch(pt) {
    if (frozen || !running) return;
    if (state === "giant") { var dx = pt.x - giant.x, dy = pt.y - giant.y; if (dx * dx + dy * dy <= giant.r * giant.r * 1.3 || clock - giant.born > 6) popGiant(); return; }
    if (state !== "ready") return;                         // no word, no bubbles: nothing to pop
    var i = hit(pt); if (i >= 0) popBubble(i);
  }
  function down(e) {
    if (frozen || !running || (state !== "ready" && state !== "giant")) return;
    touching = true; touch(pointFrom(e));
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
  }
  // a finger dragged across the sky pops what it crosses
  function move(e) { if (!touching || state !== "ready") return; touch(pointFrom(e)); e.preventDefault(); }
  function up() { touching = false; }

  // ── what the engine calls ──
  function publish() {
    try {
      window.__bubbles = { state: state, words: words, count: count, popped: total, left: left.length, frozen: frozen,
        basket: (function () { var n = 0, ws = wells(); for (var i = 0; i < ws.length; i++) if (ws[i].classList.contains("full")) n++; return n; })(),
        bubbles: left.map(function (b) { var p = where(b); return { x: +(p.x * s).toFixed(1), y: +(p.y * s).toFixed(1), r: +(p.r * s).toFixed(1), gold: b.gold, out: clock >= b.born && p.k >= 0.55 }; }),
        giant: giant ? { x: +(giant.x * s).toFixed(1), y: +(giant.y * s).toFixed(1), r: +(giant.r * s).toFixed(1), up: !!giant.up } : null,
        help: state === "ready" && clock >= helpAt, any: state === "ready" && clock >= anyAt, pose: pose };
    } catch (e) {}
  }
  var Bubbles = {
    init: function (engineApi, n) {
      api = engineApi; count = Math.min(n || 5, PER_WORD.length);
      try { SHOUT = getComputedStyle(document.documentElement).getPropertyValue("--act").trim() || SHOUT; } catch (e) {}
      try { calm = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e2) {}
      if (WAND_PIC) { wandImg = new Image(); wandImg.src = WAND_PIC; }
      cv = el("sky"); ctx = cv.getContext("2d");
      resize(); window.addEventListener("resize", resize);
      cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move);
      cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
      // no finger? Space or Enter pops a bubble — once a word has blown them
      document.addEventListener("keydown", function (e) {
        if ((e.key !== " " && e.key !== "Enter") || frozen || !running) return;
        if (e.target && e.target.id === "close") return;   // Back stays Back
        if (state === "giant") { e.preventDefault(); popGiant(); return; }
        if (state !== "ready") return;
        for (var i = 0; i < left.length; i++) { if (clock >= left[i].born && where(left[i]).k >= 0.55) { e.preventDefault(); popBubble(i); return; } }
      });
      echo("wave");
      running = true; lastT = performance.now(); raf = requestAnimationFrame(frame);
      publish();
    },
    // the engine heard the word: Echo blows the bubbles
    onWord: function () {
      if (words >= count) return;
      blow(PER_WORD[Math.min(words, PER_WORD.length - 1)]);
      var gold = null; for (var i = 0; i < left.length; i++) if (left[i].gold) gold = left[i];
      prize = { b: gold, fly: null, landed: false, x: RING.x, y: RING.y, k: 0.2 };
      try { var p = el("prize"); p.innerHTML = picHTML(64); p.hidden = false; placePrize(); } catch (e) {}
      state = "ready"; readyAt = clock; helpAt = clock + HELP_S + 1; anyAt = clock + ANY_S + 1;
      echo("wave"); sound("blow");
      try { api.hint("Pop the bubbles!"); } catch (e2) {}
      publish();
    },
    pause: function () { frozen = true; touching = false; publish(); },
    // the engine's pause wipes the line beside Echo: put the game's own back
    resume: function () {
      frozen = false; lastT = performance.now();
      try { if (state === "ready" && left.length) api.hint("Pop the bubbles!"); else if (state === "giant") api.hint("Pop the big bubble!"); } catch (e) {}
      publish();
    },
    reset: function () {
      words = 0; total = 0; left = []; fx = []; prize = null; giant = null; state = "idle"; doneAt = 0;
      try { var ws = wells(); for (var i = 0; i < ws.length; i++) { ws[i].innerHTML = ""; ws[i].classList.remove("full"); } var p = el("prize"); if (p) { p.hidden = true; p.innerHTML = ""; } } catch (e) {}
      echo("wave"); publish();
    },
    finale: function () {
      sparks(BW * 0.25, BH * 0.3, 14); sparks(BW * 0.75, BH * 0.3, 14);
      shout("Hooray!", BW / 2, BH * 0.36);
      if (typeof Bubbles.onFinale === "function") try { Bubbles.onFinale(); } catch (e) {}
      publish();
    },
    snapshot: function () { publish(); return window.__bubbles; },
  };
  window.Bubbles = Bubbles;
})();
