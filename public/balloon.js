/* Balloon Party: the word brings the next balloon; real button presses fill
   it, and a real drag-and-release puts it on the party garland. SayPlay owns
   every word, mic, voice and rep. No wind, timer or helper attaches a balloon.
   All published positions are normalized to partyCanvas; goal.r uses width.

   THE AUDIT'S REBUILD (BALLOON2, Travis, 12 Nov 2026: "build it all!").
   The word brings a balloon and nothing else: it used to switch on ten
   seconds of big pumps and a big ring too, so the pumping and the ring
   nearly did themselves. The help word (the "Big pumps" pill) still gives
   that power, and the ladder below still makes every balloon land. Each
   round is a party for one of the buddies, who sits by the picnic in a
   party hat and hops when a balloon lands; the five balloons come in a
   new mix of seven colours, and the rings fill in a new order. The last
   two rings sway gently side to side, and hold still from the first miss
   and while the help word's power lasts. Echo explains each step once a
   visit.

   EVERY BALLOON GETS TO THE PARTY (the Hoops rule, for ages 3-4, so the
   gentler ladder). A miss is a real try that did not land: a release (or
   Enter) outside the ring, or a tap on the full balloon with no pull.
   Idle time is never a miss. misses 0: the game as drawn. 1: the ring glows,
   grows and an arrow points to it, and a release within 2.5 rings is pulled
   in. 2 and on: almost anything works, a pull upward or a tap on the
   balloon floats it in. The finger still makes every move; nothing attaches
   by itself. The help word's power also doubles the ring. */
(function () {
  "use strict";
  var api, cv, ctx, W = 390, H = 844, raf = 0, last = 0, time = 0;
  var active = false, paused = false, away = false, stage = 0, stages = 5, delivered = 0, won = false;
  var inflation = 0, power = 0, pumps = 0, drops = 0, misses = 0, balloon = { x: 0.5, y: 0.64 };
  // clock: real play seconds (not paused, page shown), for the pull-in glide
  // and the celebration beat before api.done(), as hoops.js keeps it.
  var clock = 0, doneAt = 0, pull = null, told = {}, tinted = [];
  var goal = { x: 0.5, y: 0.3, r: 0.105 }, goals = [], home = { x: 0.5, y: 0.64 };
  var drag = null, dragSurface = null, dragOffset = { x: 0, y: 0 }, dragStart = null, moved = false;
  var bodyW = 74, playTop = 100, playBottom = 650, pumpTimer = 0, sparkles = [], art = {};
  var POWER = 10, WIND = 0.018, PULL_S = 0.32, BEAT_S = 1.15;
  // The party (newParty): whose party it is, the five balloons' colours
  // (indexes into PALETTE) and the order the rings fill (indexes into
  // goals); lastParty keeps a round from repeating the one before. spots:
  // where each ring's balloon was tied (a swaying ring keeps it where it
  // landed). cheerAt: when the buddy last hopped.
  var party = null, lastParty = null, spots = [], seat = null, cheerAt = -1, onParty = null;
  // The last two balloons' rings sway this far each way (a fraction of the
  // canvas width), SWAY_SPEED radians a second: there and back in about six
  // seconds, gentle for a three-year-old.
  var SWAY = 0.05, SWAY_SPEED = 1, SWAY_FROM = 3, swayX = 0, swayPhase = 0;
  // Seven plainly named colours, five a round: the painted balloons and, if
  // the art fails, the drawn ones (COLORS) are the same colours. No orange:
  // orange means only the practice sound's letters.
  var PALETTE = [
    { id: "red", color: "#ef6a78", tint: null },
    { id: "yellow", color: "#eac85d", tint: { h: 48, l: 0.58, s: 1 } },
    { id: "green", color: "#62bf6c", tint: { h: 130, l: 0.47, s: 0.8 } },
    { id: "blue", color: "#74b8e8", tint: { h: 212, l: 0.56, s: 1 } },
    { id: "purple", color: "#b690d7", tint: { h: 278, l: 0.62, s: 1 } },
    { id: "pink", color: "#f29cc3", tint: { h: 330, l: 0.74, s: 0.9 } },
    { id: "teal", color: "#3fbcb8", tint: { h: 177, l: 0.49, s: 0.8 } }
  ];
  var COLORS = PALETTE.map(function (c) { return c.color; });
  // How the red sprite becomes the other six (h: hue in degrees; l: the
  // lightness its mid red becomes; s: a saturation scale). A canvas
  // hue-rotate() keeps red's low luminance, so it painted the yellow balloon
  // olive-brown and the green one dark; this keeps each balloon's shading
  // and moves its body to a real yellow, green, blue, purple, pink or teal.
  var TINTS = PALETTE.map(function (c) { return c.tint; });
  var RED_L = 0.56, TINT_W = 256;
  // The eleven buddies with a sitting picture, and the drawn area of each
  // (x0, y0, x1, y1 in its 512 px picture; train.js measured them, and
  // cake.js keeps the same table), where the party hat sits on each (across
  // and down from the top of the drawn area, as fractions of its size, and
  // a tilt), and their names should Sona not have one.
  var BUDDY_BOX = { bunny: [137, 31, 387, 476], cat: [89, 31, 423, 478], lion: [58, 31, 455, 477], penguin: [97, 31, 425, 476], frog: [73, 31, 445, 475], bee: [50, 30, 462, 476], dino: [106, 31, 406, 480], dragon: [88, 30, 434, 479], octopus: [47, 30, 475, 477], panda: [74, 31, 437, 478], unicorn: [95, 30, 417, 480] };
  var HAT_AT = { bunny: [0, 0.27, 0], unicorn: [-0.17, 0.15, -0.3], bee: [0, 0.13, 0], dino: [0, 0.05, 0], dragon: [0, 0.07, 0], lion: [0, 0.06, 0], panda: [0, 0.04, 0], cat: [0, 0.04, 0], frog: [0, 0.04, 0] };
  var BUDDIES = Object.keys(BUDDY_BOX), BUDDY_NAME = { bunny: "Miso", cat: "Mochi", lion: "Sunny", penguin: "Pebble", frog: "Hops", bee: "Buzz", dino: "Rocky", dragon: "Ziggy", octopus: "Otto", panda: "Bao", unicorn: "Luna" };
  var motion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function canPlay() { return active && !paused && !away && !won && !document.hidden; }
  function full() { return inflation >= 1; }
  function gain() { return power > 0 ? 0.34 : 0.17; }
  function level() { return Math.min(2, misses); }
  // How far from the ring's centre a release still lands, in rings.
  function reach() { return Math.max([1, 2.5, 3][level()], power > 0 ? 2 : 1); }
  // The ring as drawn: bigger once the child needs it (never the full reach,
  // so the five rings of the garland stay apart).
  function ringScale() { return Math.max([1, 1.45, 1.7][level()], power > 0 ? 1.3 : 1); }
  function windNow() { return power > 0 || misses > 0 ? 0 : WIND; }
  // Echo explains each kind of step once a visit: told is cleared by
  // nothing, not a new balloon and not Play again ("Hear what to do" still
  // says the step's line on a tap).
  function say(key, text) { if (told[key]) return; told[key] = true; try { api.instruct(text); } catch (e) {} }
  function reduced() { return !!(motion && motion.matches); }
  // the ring balloon n goes to, and its colour (an index into PALETTE)
  function ringOf(n) { return party ? party.order[n] : n; }
  function colorOf(n) { return party ? party.colors[n] : n % PALETTE.length; }
  function pick(list, not) { var pool = list.filter(function (x) { return x !== not; }); return pool[Math.floor(Math.random() * pool.length)] || list[0]; }
  function shuffled(list) { var a = list.slice(); for (var n = a.length - 1; n > 0; n--) { var k = Math.floor(Math.random() * (n + 1)), t = a[n]; a[n] = a[k]; a[k] = t; } return a; }
  function buddyName(id) { try { var c = window.Sona && Sona.characterById && Sona.characterById(id); if (c && c.name) return c.name; } catch (e) {} return BUDDY_NAME[id] || id; }
  // A new party: another buddy, a new mix of five colours and a new order
  // for the rings, never the same as the round before.
  function newParty() {
    var was = lastParty || {}, colors, order, n = 0, all = PALETTE.map(function (c, i) { return i; });
    do { colors = shuffled(all).slice(0, 5); } while (was.colors && colors.join() === was.colors.join() && ++n < 50);
    n = 0; do { order = shuffled([0, 1, 2, 3, 4]); } while (was.order && order.join() === was.order.join() && ++n < 50);
    party = { buddy: pick(BUDDIES, was.buddy), colors: colors, order: order }; lastParty = party;
    need("buddy-" + party.buddy, "/assets/crafted/buddy-" + party.buddy + "-sit.webp");
    if (onParty) try { onParty({ buddy: party.buddy, name: buddyName(party.buddy) }); } catch (e) {}
  }
  // The ring this balloon goes to, where it is now: its spot on the garland
  // and, for the last two balloons, the sway; never so near an edge that the
  // ring, drawn at its size, leaves the screen.
  function placeGoal() {
    var b = goals[ringOf(stage)]; if (!b) return;
    var edge = b.r * ringScale() + 8 / W;
    goal.x = clamp(b.x + swayX, edge, 1 - edge); goal.y = b.y; goal.r = b.r;
  }
  // the sway moves only while the child can play this balloon, before any
  // miss and while no help power is on; otherwise the ring holds still
  function swaying() { return stage >= SWAY_FROM && canPlay() && misses === 0 && power <= 0 && !doneAt && !pull; }
  function need(name, src) { if (art[name]) return; var image = new Image(); image.onload = function () { draw(); }; image.src = src; art[name] = image; }
  function loadArt() {
    [["bg", "/assets/crafted/game/balloon-bg.webp"], ["balloon", "/assets/crafted/game/balloon-red.webp"], ["hat", "/assets/crafted/hat-party.webp"]].forEach(function (p) { need(p[0], p[1]); });
    if (party) need("buddy-" + party.buddy, "/assets/crafted/buddy-" + party.buddy + "-sit.webp");
  }
  function image(name) { var i = art[name]; return i && i.complete && i.naturalWidth ? i : null; }
  function hsl(r, g, b) {
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min, h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    }
    return [h * 60, s, l];
  }
  function channel(p, q, t) { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }
  // The painted balloon in colour n. Red is the sprite itself; each other
  // colour is made once, the first time it is drawn, on a small canvas (the
  // sprite is never drawn much wider than 160 device pixels). Only the red
  // body and knot move: the cream string and the white shine keep their own
  // colour, and lightness is mapped so the mid red lands on the new colour's
  // while white stays white and the darkest shade stays dark. null while the
  // sprite is loading, or when the phone will not let the page read it
  // back: the drawn balloon in its own colour then stands in, as without art.
  function sprite(color) {
    var i = image("balloon"); if (!i || !color) return i;
    if (tinted[color] !== undefined) return tinted[color];
    tinted[color] = null;
    try {
      var c = document.createElement("canvas"), k = Math.min(1, TINT_W / i.naturalWidth), x = c.getContext("2d");
      c.width = Math.round(i.naturalWidth * k); c.height = Math.round(i.naturalHeight * k);
      x.drawImage(i, 0, 0, c.width, c.height);
      var data = x.getImageData(0, 0, c.width, c.height), p = data.data, t = TINTS[color];
      for (var n = 0; n < p.length; n += 4) {
        if (!p[n + 3]) continue;
        var o = hsl(p[n] / 255, p[n + 1] / 255, p[n + 2] / 255), away = Math.abs((o[0] - 355 + 540) % 360 - 180);
        // how red this pixel is: the body and the knot all, the string none
        var w = away <= 22 ? 1 : Math.max(0, 1 - (away - 22) / 18);
        if (!w) continue;
        var l = o[2] <= RED_L ? o[2] / RED_L * t.l : t.l + (o[2] - RED_L) / (1 - RED_L) * (1 - t.l);
        var sat = Math.min(1, o[1] * t.s), q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, lo = 2 * l - q, hue = t.h / 360;
        var rgb = [channel(lo, q, hue + 1 / 3), channel(lo, q, hue), channel(lo, q, hue - 1 / 3)];
        for (var j = 0; j < 3; j++) p[n + j] = Math.round(p[n + j] + (rgb[j] * 255 - p[n + j]) * w);
      }
      x.putImageData(data, 0, 0); tinted[color] = c;
    } catch (e) {}
    return tinted[color];
  }
  function fit() {
    if (!cv) return;
    var r = cv.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    var dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    playTop = Math.max(75, $("partyBanner").getBoundingClientRect().bottom - r.top + 12);
    playBottom = Math.max(playTop + 140, $("partyControls").getBoundingClientRect().top - r.top - 12);
    var room = playBottom - playTop, ring = clamp(W * 0.105, 29, 43), base = playTop + Math.min(95, room * 0.24);
    var xs = [0.5, 0.32, 0.68, 0.14, 0.86], offsets = [0, 12, 12, 34, 34];
    // a turned phone moves each tied balloon with its ring
    spots.forEach(function (s, i) { if (s) s.y = (base + offsets[i]) / H; });
    goals = xs.map(function (x, i) { return { x: x, y: (base + offsets[i]) / H, r: ring / W }; });
    home = { x: 0.5, y: (playTop + room * 0.73) / H };
    bodyW = Math.min(78, W * 0.2, room * 0.42);
    // the party buddy sits on the grass by the picnic, just above the pump
    var pump = $("partyPump").getBoundingClientRect();
    seat = { foot: pump.top - r.top - 6, left: Math.max(8, pump.left - r.left) };
    if (!active && !delivered) { balloon.x = home.x; balloon.y = home.y; }
    cancelDrag(false); hud(); draw();
  }
  // The buddy's box, in canvas pixels: as tall as the room above the pump
  // allows, never more than 120 px or a quarter of the width.
  function buddyBox() {
    if (!party || !seat) return null;
    var b = BUDDY_BOX[party.buddy], bw = b[2] - b[0], bh = b[3] - b[1];
    var size = Math.max(48, Math.min(W * 0.26, 120, (seat.foot - playTop) * 0.55)), k = size / Math.max(bw, bh), dw = bw * k, dh = bh * k;
    return { x0: seat.left, y0: seat.foot - dh, x1: seat.left + dw, y1: seat.foot, w: dw, h: dh };
  }
  // how high the buddy is hopping: one hop as a balloon lands (and as the
  // party is finished); none under Reduce Motion
  function hop() {
    if (cheerAt < 0 || reduced()) return 0;
    var k = (clock - cheerAt) / 0.55; return k > 0 && k < 1 ? Math.sin(k * Math.PI) : 0;
  }
  function buddyArt() {
    var box = buddyBox(), i = party && image("buddy-" + party.buddy); if (!box || !i) return;
    var b = BUDDY_BOX[party.buddy], up = hop() * box.h * 0.18, cx = (box.x0 + box.x1) / 2;
    ctx.save();
    ctx.fillStyle = "rgba(60,70,30,.2)"; ctx.beginPath(); ctx.ellipse(cx, box.y1 - 2, box.w * (0.42 - hop() * 0.08), box.w * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, -up);
    ctx.drawImage(i, b[0], b[1], b[2] - b[0], b[3] - b[1], box.x0, box.y0, box.w, box.h);
    // the shop's painted party hat on top, else a drawn one
    var at = HAT_AT[party.buddy] || [0, 0, 0], hat = image("hat"), hw = Math.min(box.w * 0.42, box.h * 0.4), hx = cx + at[0] * box.w, hy = box.y0 + hw * 0.12 + at[1] * box.h;
    ctx.translate(hx, hy); ctx.rotate(at[2]);
    if (hat) ctx.drawImage(hat, -hw / 2, -hw, hw, hw);
    else { ctx.fillStyle = "#a693c7"; ctx.beginPath(); ctx.moveTo(-hw * 0.32, 0); ctx.lineTo(hw * 0.32, 0); ctx.lineTo(0, -hw * 0.9); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  function cover(i) {
    var scale = Math.max(W / i.naturalWidth, H / i.naturalHeight), w = i.naturalWidth * scale, h = i.naturalHeight * scale;
    ctx.drawImage(i, (W - w) / 2, (H - h) / 2, w, h);
  }
  function drawBalloon(p, amount, color, size, bob) {
    var x = p.x * W, y = p.y * H + bob, w = size * (0.32 + 0.68 * amount), i = sprite(color);
    ctx.save(); ctx.translate(x, y);
    // The colours are one red sprite, recoloured once each by sprite() (no
    // canvas filter, so every WebKit paints all five).
    if (i) {
      // The source is half envelope and half string. Scale by envelope width,
      // not the tall image box; keep the actual painted string visible.
      var h = w * (i.naturalHeight || i.height) / (i.naturalWidth || i.width);
      ctx.drawImage(i, -w / 2, -w * 0.61, w, h);
    } else {
      // Asset failure still leaves a visible, graspable balloon and a string.
      ctx.strokeStyle = "#f9edd5"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, w * 0.6); ctx.bezierCurveTo(-w * 0.2, w, w * 0.25, w * 1.25, 0, w * 1.8); ctx.stroke();
      var g = ctx.createRadialGradient(-w * 0.22, -w * 0.28, 2, 0, 0, w * 0.7); g.addColorStop(0, "#fff6e9"); g.addColorStop(0.38, COLORS[color]); g.addColorStop(1, COLORS[color]);
      ctx.fillStyle = g; ctx.strokeStyle = COLORS[color]; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.5, w * 0.61, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, w * 0.58); ctx.lineTo(-4, w * 0.68); ctx.lineTo(4, w * 0.68); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // where ring n is drawn: its tied balloon's spot, the live goal while it
  // is this balloon's ring, else its place on the garland
  function ringAt(n) { return spots[n] || ((active || pull) && n === ringOf(stage) ? goal : goals[n]); }
  function garland() {
    var order = [3, 1, 0, 2, 4];
    ctx.strokeStyle = "rgba(89,94,59,.75)"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath();
    order.forEach(function (n, i) { var p = goals[n] && ringAt(n); if (!p) return; if (i) ctx.lineTo(p.x * W, p.y * H); else ctx.moveTo(p.x * W, p.y * H); }); ctx.stroke();
    goals.forEach(function (g, i) {
      if (spots[i]) return;
      var lit = (active || pull) && i === ringOf(stage), p = ringAt(i), radius = g.r * W * (lit ? ringScale() : 1);
      ctx.save(); ctx.translate(p.x * W, p.y * H);
      ctx.fillStyle = lit ? "rgba(255,250,235,.48)" : "rgba(255,250,235,.20)";
      ctx.strokeStyle = lit ? "#fff9dc" : "rgba(255,250,235,.75)"; ctx.lineWidth = lit ? 5 : 2;
      if (lit) { ctx.shadowColor = "#1f98a6"; ctx.shadowBlur = misses ? 22 + 8 * Math.sin(clock * 5) : 15; if (misses) ctx.fillStyle = "rgba(255,250,235,.7)"; } else ctx.setLineDash([4, 7]);
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (lit) { ctx.shadowBlur = 0; ctx.strokeStyle = "#258995"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, radius + 5, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    });
    spots.forEach(function (s) { if (s) drawBalloon(s, 1, s.color, Math.min(68, W * 0.16), 0); });
  }
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H); var bg = image("bg");
    if (bg) cover(bg); else { var wash = ctx.createLinearGradient(0, 0, 0, H); wash.addColorStop(0, "#c9ecf1"); wash.addColorStop(0.6, "#eff2ce"); wash.addColorStop(1, "#c4d9a3"); ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H); }
    if (!goals.length) return;
    buddyArt();
    garland();
    if (!won && (delivered <= stage || pull)) {
      var wobble = drag === null && canPlay() ? Math.sin(time * 2.2) * 2 : 0;
      drawBalloon(balloon, inflation, colorOf(stage), bodyW, wobble);
      // A quiet, visual pump gauge; the actual rep count stays SayPlay's.
      if (!full() && active) {
        var cy = balloon.y * H + bodyW * 0.9;
        for (var dot = 0; dot < 6; dot++) { ctx.fillStyle = inflation >= (dot + 1) / 6 ? "#258995" : "rgba(255,250,235,.9)"; ctx.beginPath(); ctx.arc(balloon.x * W + (dot - 2.5) * 12, cy, 4, 0, Math.PI * 2); ctx.fill(); }
      }
      // The dashed path to the ring; after a miss it stays up while the
      // child pulls, gets bolder, and ends in an arrow at the ring.
      if (full() && canPlay() && (drag === null || misses)) {
        var gx = goal.x * W, gy = goal.y * H, bx = balloon.x * W, by = balloon.y * H - bodyW * 0.75, cy2 = Math.max(gy + bodyW, by - 10);
        ctx.save(); ctx.strokeStyle = misses ? "#fff9dc" : "rgba(255,250,235,.85)"; ctx.lineWidth = misses ? 4 : 2; ctx.setLineDash(misses ? [8, 8] : [4, 7]); ctx.lineCap = "round";
        if (misses) { ctx.shadowColor = "#1f98a6"; ctx.shadowBlur = 6; }
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx, cy2, gx, gy); ctx.stroke();
        if (misses && Math.abs(by - gy) + Math.abs(bx - gx) > 30) {
          var ax = gx - bx, ay = gy - cy2, al = Math.sqrt(ax * ax + ay * ay) || 1, tipY = gy + goal.r * W * ringScale() + 4, tipX = gx;
          ax /= al; ay /= al; if (ay > -0.3) { ay = -1; ax = 0; }
          ctx.setLineDash([]); ctx.fillStyle = "#258995"; ctx.beginPath();
          ctx.moveTo(tipX, tipY); ctx.lineTo(tipX - ax * 22 - ay * 12, tipY - ay * 22 + ax * 12); ctx.lineTo(tipX - ax * 22 + ay * 12, tipY - ay * 22 - ax * 12); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
    }
    sparkles.forEach(function (s) { var life = 1 - s.age / 0.7; if (life <= 0) return; ctx.globalAlpha = life; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(s.x + s.vx * s.age, s.y + s.vy * s.age + s.age * s.age * 35, 2.5 + life, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1;
  }
  function publish() {
    window.__balloon = { active: active, paused: paused, stage: stage, stages: stages, inflation: inflation, power: power, pumpGain: gain(), wind: windNow(), misses: misses, level: level(), reach: reach(), ringScale: ringScale(), pulling: !!pull, celebrating: doneAt > 0,
      balloon: { x: balloon.x, y: balloon.y }, goal: { x: goal.x, y: goal.y, r: goal.r }, goals: goals.map(function (g) { return { x: g.x, y: g.y }; }), dragging: drag !== null, pointerId: drag,
      delivered: delivered, won: won, pumps: pumps, drops: drops, full: full(), banner: $("partyBanner").textContent, width: W, height: H, coordinates: "normalized-to-canvas; goal radius uses canvas width",
      party: party ? { buddy: party.buddy, name: buddyName(party.buddy), colors: party.colors.map(function (c) { return PALETTE[c].id; }), order: party.order.slice() } : null,
      ring: ringOf(stage), color: PALETTE[colorOf(stage)].id, sway: swayX, swaying: swaying(), swayFrom: SWAY_FROM, swayMax: SWAY,
      spots: spots.map(function (s) { return s ? { x: s.x, y: s.y, color: PALETTE[s.color].id } : null; }),
      buddy: (function () { var b = buddyBox(); return b ? { x0: b.x0 / W, y0: b.y0 / H, x1: b.x1 / W, y1: b.y1 / H, hop: hop(), loaded: !!(party && image("buddy-" + party.buddy)), hat: !!image("hat") } : null; })(),
      told: Object.keys(told) };
  }
  function hud() {
    placeGoal();
    var allowed = canPlay(), b = $("partyBalloon"), grip = bodyW * 1.45;
    $("partyPump").disabled = !allowed || full(); $("partyPumpLabel").textContent = full() ? "Ready!" : "Pump";
    $("partyHelp").disabled = !allowed || drag !== null;
    $("partyPower").hidden = !(active && power > 0 && !won); $("partyPowerFill").style.width = (power / POWER * 100) + "%"; $("partyPower").firstElementChild.textContent = full() ? "Big ring" : "Big pumps";
    b.hidden = !full() || !active || won; b.disabled = !allowed;
    b.style.left = (balloon.x * W) + "px"; b.style.top = (balloon.y * H) + "px"; b.style.width = grip + "px"; b.style.height = (bodyW * 1.75) + "px";
    b.setAttribute("aria-label", "Full balloon. Pull it to the glowing ring, then let go. Keyboard: arrow keys, then Enter.");
    publish();
  }
  function banner(text) { $("partyBanner").textContent = text; }
  function pump() {
    if (!canPlay() || full() || drag !== null) return;
    inflation = Math.min(1, inflation + gain()); pumps++;
    $("partyPump").classList.remove("pumping"); void $("partyPump").offsetWidth; $("partyPump").classList.add("pumping");
    clearTimeout(pumpTimer); pumpTimer = setTimeout(function () { $("partyPump").classList.remove("pumping"); }, 250);
    api.sfx("tap"); banner(full() ? "Pull it into the glowing ring!" : power > 0 ? "Big pumps! Keep going!" : "Pump, pump, pump!");
    if (full()) say("full", "Now pull your balloon into the ring.");
    hud(); draw();
  }
  function point(event) { var r = cv.getBoundingClientRect(); return { x: (event.clientX - r.left) / W, y: (event.clientY - r.top) / H }; }
  function nearBalloon(p) {
    var dx = (p.x - balloon.x) * W, dy = (p.y - balloon.y) * H;
    return dx * dx / Math.pow(bodyW * 0.72, 2) + dy * dy / Math.pow(bodyW * 0.85, 2) <= 1 || Math.abs(dx) < bodyW * 0.32 && dy > 0 && dy < bodyW * 1.15;
  }
  function setPoint(p) { balloon.x = clamp(p.x, 0.08, 0.92); balloon.y = clamp(p.y, Math.max(0.09, (playTop - bodyW * 0.2) / H), Math.min(0.88, (playBottom + bodyW * 0.4) / H)); }
  function releaseCapture() {
    var surface = dragSurface, id = drag; drag = null; dragSurface = null; dragStart = null; moved = false;
    try { if (surface && id !== null && surface.hasPointerCapture(id)) surface.releasePointerCapture(id); } catch (e) {}
  }
  function cancelDrag(returnHome) {
    if (drag === null) return;
    releaseCapture();
    if (returnHome) { balloon.x = home.x; balloon.y = home.y; banner("Let's try the ring again!"); }
    hud();
  }
  // One try at the ring: a release after a pull (still=false), or a still
  // tap or Enter (still=true). It lands, gliding into the ring, or it is a
  // miss, which only ever makes the next try easier.
  function attempt(still) {
    if (!canPlay() || !full()) return;
    var dx = (balloon.x - goal.x) * W, dy = (balloon.y - goal.y) * H, r = goal.r * W, d = Math.sqrt(dx * dx + dy * dy);
    var lands = still ? level() >= 2 : (d <= r * reach() || level() >= 2 && (home.y - balloon.y) * H >= 24);
    if (!lands) {
      misses++; drops++;
      if (!still) { balloon.x = home.x; balloon.y = home.y; }
      banner(misses >= 2 ? "Nearly! Pull it up, then let go." : "So close! Pull it to the glowing ring.");
      try { api.cheer(misses >= 2 ? "Nearly!" : "So close!"); api.face("think"); } catch (e) {}
      say("miss", "Pull it up to the glowing ring, then let go.");
      hud(); draw(); return;
    }
    releaseCapture(); active = false; power = 0; pull = { x: balloon.x, y: balloon.y, t: 0 };
    banner("Up it goes!"); hud(); draw();
  }
  function attach() { attempt(false); }
  // The glide is over: the balloon is on the garland. A cheer now, and the
  // step counts about a second later (doneAt), so the chime and the sparkles
  // are not cut off by the next word.
  function deliver() {
    pull = null; balloon.x = goal.x; balloon.y = goal.y; misses = 0;
    // tied where its ring was: a swaying ring keeps its balloon where it landed
    spots[ringOf(stage)] = { x: goal.x, y: goal.y, color: colorOf(stage) };
    delivered = Math.max(delivered, stage + 1); cheerAt = clock;
    var mine = party ? party.colors.map(function (c) { return COLORS[c]; }) : COLORS;
    for (var n = 0; n < 12; n++) sparkles.push({ x: goal.x * W, y: goal.y * H, vx: Math.cos(n * Math.PI / 6) * 45, vy: Math.sin(n * Math.PI / 6) * 45 - 15, age: 0, color: mine[n % mine.length] });
    var who = party ? buddyName(party.buddy) : "";
    banner(delivered === stages ? (who ? who + "'s party is ready!" : "Our party is ready!") : (who ? "A balloon for " + who + "'s party!" : "A balloon for the party!"));
    try { api.cheer("Hooray!"); api.face("cheer"); } catch (e) {}
    api.sfx("correct"); doneAt = clock + BEAT_S; hud(); draw();
  }
  function down(event) {
    if (!canPlay() || !full() || drag !== null || (event.button != null && event.button !== 0)) return;
    var p = point(event); if (!nearBalloon(p)) return;
    event.preventDefault(); drag = event.pointerId; dragSurface = event.currentTarget; dragStart = p; moved = false; dragOffset = { x: p.x - balloon.x, y: p.y - balloon.y };
    try { dragSurface.setPointerCapture(drag); } catch (e) {}
    banner("Into the ring, then let go"); hud();
  }
  function move(event) {
    if (event.pointerId !== drag || !canPlay()) return;
    var p = point(event);
    if (dragStart && Math.abs((p.x - dragStart.x) * W) + Math.abs((p.y - dragStart.y) * H) > 6) moved = true;
    setPoint({ x: p.x - dragOffset.x, y: p.y - dragOffset.y }); hud(); draw();
  }
  function up(event) {
    if (event.pointerId !== drag) return;
    var didMove = moved; releaseCapture();
    if (!canPlay()) { hud(); return; }
    // a still tap is a try too: a miss until the ladder lets a tap float it in
    attempt(!didMove);
  }
  function cancel(event) { if (event.pointerId !== drag) return; cancelDrag(true); draw(); }
  function keyboard(event) {
    if (!canPlay() || !full() || drag !== null) return;
    var p = { x: balloon.x, y: balloon.y }, amount = event.shiftKey ? 0.015 : 0.05;
    if (event.key === "ArrowLeft") p.x -= amount;
    else if (event.key === "ArrowRight") p.x += amount;
    else if (event.key === "ArrowUp") p.y -= amount;
    else if (event.key === "ArrowDown") p.y += amount;
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); attempt(Math.abs(p.x - home.x) + Math.abs(p.y - home.y) < 0.01); return; }
    else return;
    event.preventDefault(); setPoint(p); banner("Move to the ring, then press Enter"); hud(); draw();
  }
  function controls() {
    [cv, $("partyBalloon")].forEach(function (surface) {
      surface.addEventListener("pointerdown", down); surface.addEventListener("pointermove", move); surface.addEventListener("pointerup", up);
      surface.addEventListener("pointercancel", cancel); surface.addEventListener("lostpointercapture", cancel);
    });
    $("partyBalloon").addEventListener("keydown", keyboard);
    $("partyPump").onclick = pump;
    $("partyHelp").onclick = function () { if (canPlay() && drag === null) api.practice(); };
    window.addEventListener("resize", fit);
    document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    window.addEventListener("pagehide", function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; });
    window.addEventListener("pageshow", function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
  }
  function tick(dt) {
    var live = !paused && !away && !document.hidden;
    if (live) {
      clock += dt;
      sparkles.forEach(function (s) { s.age += dt; }); sparkles = sparkles.filter(function (s) { return s.age < 0.7; });
      if (pull) {
        pull.t += dt; var k = Math.min(1, pull.t / PULL_S), e = 1 - (1 - k) * (1 - k);
        balloon.x = pull.x + (goal.x - pull.x) * e; balloon.y = pull.y + (goal.y - pull.y) * e;
        if (k >= 1) deliver();
      }
      // done() once, after the beat, and only while the game is really playing
      if (doneAt && clock >= doneAt) { doneAt = 0; hud(); if (api) api.done(); return; }
    }
    if (!canPlay()) { hud(); return; }
    time += dt; power = Math.max(0, power - dt);
    // the last two rings sway gently while the child can play them, and
    // hold still where they are from the first miss and while help is on
    if (swaying()) { swayPhase += dt * SWAY_SPEED; swayX = SWAY * Math.sin(swayPhase); }
    // Floating is gentle and bounded. Even a balloon that happens to drift
    // into its ring cannot attach: only a deliberate release or key does it.
    if (full() && drag === null && windNow() > 0) balloon.x = clamp(balloon.x + Math.sin(time * 1.2 + stage) * WIND * dt, 0.16, 0.84);
    hud();
  }
  function frame(now) { var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; tick(dt); draw(); raf = requestAnimationFrame(frame); }
  function earnPower() { power = POWER; paused = false; active = true; last = 0; banner(full() ? "Big ring! Pull it in." : "Big pumps! Let's fill your balloon"); hud(); }
  function pause() { paused = true; last = 0; cancelDrag(false); clearTimeout(pumpTimer); $("partyPump").classList.remove("pumping"); hud(); }
  // A new party, empty. told is kept: Echo does not explain again on Play
  // again (a new page load starts it fresh).
  function reset() {
    releaseCapture(); active = false; paused = false; inflation = 0; power = 0; pumps = 0; drops = 0; misses = 0; delivered = 0; stage = 0; won = false; sparkles = []; time = 0; last = 0;
    doneAt = 0; pull = null; spots = []; swayX = 0; swayPhase = 0; cheerAt = -1;
    newParty(); balloon.x = home.x; balloon.y = home.y; banner("Let's make a party for " + buddyName(party.buddy) + "!"); hud(); draw();
  }
  window.Balloon = {
    init: function (a, n) { api = a; stages = n || 5; cv = $("partyCanvas"); ctx = cv.getContext("2d"); loadArt(); controls(); fit(); reset(); raf = requestAnimationFrame(frame); },
    // The word brings the next balloon, empty, at the plain pump and the
    // plain ring: no power (only the help word gives that).
    onWord: function (index) {
      stage = index; inflation = 0; pumps = 0; misses = 0; doneAt = 0; pull = null; power = 0; swayX = 0; swayPhase = 0;
      releaseCapture(); balloon.x = home.x; balloon.y = home.y; paused = false; active = true; last = 0;
      banner(stage ? "Here's the next balloon. Pump it up!" : "Pump up a balloon for " + buddyName(party.buddy) + "!");
      hud(); say("pump", "Tap the pump to fill your balloon.");
    },
    onHelp: earnPower,
    pause: pause,
    resume: function (playing) { paused = playing === false; last = 0; hud(); },
    reset: reset,
    finale: function () { releaseCapture(); active = false; power = 0; won = true; doneAt = 0; pull = null; cheerAt = clock; banner("Five balloons. One happy party!"); hud(); draw(); },
    // the page names the party on its end card ("Happy party, Miso!")
    onParty: function (fn) { onParty = fn; if (party && fn) try { fn({ buddy: party.buddy, name: buddyName(party.buddy) }); } catch (e) {} }
  };
})();
