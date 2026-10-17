/* Grow a Flower: the child moves and holds a real watering can. Only its
   falling drops reaching the soil grow anything. SayPlay owns all speech,
   mic, targets and repetitions. Published coordinates use gardenCanvas;
   target.r and catchRadius are relative to its width. */
(function () {
  "use strict";
  var api, cv, ctx, W = 390, H = 844, raf = 0, last = 0, time = 0;
  var active = false, paused = false, away = false, stage = 0, stages = 5, grown = 0, won = false;
  var waterProgress = 0, reservoir = 0, power = 0, pouring = false, keyboardPour = false;
  var can = { x: 0.23, y: 0.4 }, home = { x: 0.23, y: 0.4 }, target = { x: 0.5, y: 0.67, r: 0.075 };
  var canW = 140, canH = 110, bedY = 560, playTop = 110, baseRadius = 28, plantH = 210;
  var drag = null, dragSurface = null, offset = { x: 0, y: 0 }, drops = [], splashes = [], emission = 0;
  var landed = 0, missed = 0, refills = 0, art = {}, POWER = 10, TARGETS = [0.5, 0.42, 0.58, 0.45, 0.55];
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function canPlay() { return active && !paused && !away && !won && !document.hidden; }
  function capacity() { return power > 0 ? 1.8 : 1; }
  function radius() { return baseRadius * (power > 0 ? 2 : 1); }
  function image(name) { var i = art[name]; return i && i.complete && i.naturalWidth ? i : null; }
  function loadArt() {
    [["bg", "flower-bg.webp"], ["sprout", "flower-sprout.webp"], ["bloom", "flower-bloom.webp"], ["can", "flower-can-dry-v1.webp"]].forEach(function (p) {
      var i = new Image(); i.onload = function () { draw(); }; i.src = "/assets/crafted/game/" + p[1]; art[p[0]] = i;
    });
  }
  function fit() {
    if (!cv) return;
    var r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    playTop = Math.max(100, $("gardenBanner").getBoundingClientRect().bottom - r.top + 10);
    var bottom = $("gardenWater").getBoundingClientRect().top - r.top - 22;
    // Budget the garden inside the visible gap: short screens must not put
    // the soil behind the water card. The phone portrait guard remains.
    var span = Math.max(45, bottom - playTop);
    bedY = Math.min(H * 0.67, playTop + span - 25);
    canW = Math.min(164, W * 0.36, (bedY - playTop) * 0.72); canH = canW * 0.8;
    plantH = Math.min(250, W * 0.58, bedY - playTop - 30); baseRadius = clamp(W * 0.075, 24, 42);
    home = { x: 0.23, y: (playTop + (bedY - playTop) * 0.4) / H };
    target = { x: TARGETS[stage], y: bedY / H, r: baseRadius / W };
    stopPour();
    if (!active && !grown) { can.x = home.x; can.y = home.y; } else setCan(can);
    hud(); draw();
  }
  function background() {
    var i = image("bg");
    if (i) {
      var scale = Math.max(W / i.naturalWidth, H / i.naturalHeight), w = i.naturalWidth * scale, h = i.naturalHeight * scale;
      // Keep the painted bed under the real catch patch, including landscape.
      var top = clamp(bedY - h * 0.67, H - h, 0); ctx.drawImage(i, (W - w) / 2, top, w, h);
    } else {
      var wash = ctx.createLinearGradient(0, 0, 0, H); wash.addColorStop(0, "#c7e9ed"); wash.addColorStop(0.58, "#f2f3d0"); wash.addColorStop(1, "#b4d795"); ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#906442"; ctx.beginPath(); ctx.ellipse(W * 0.5, bedY, W * 0.38, W * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  function soil() {
    var r = radius(), x = target.x * W, y = target.y * H;
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = "rgba(61,150,154,.18)"; ctx.strokeStyle = active ? "#fcffdc" : "rgba(255,250,230,.6)"; ctx.lineWidth = active ? 4 : 2;
    if (active) { ctx.shadowBlur = 14; ctx.shadowColor = "#278d99"; }
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = "#258995"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, r + 4, r * 0.42 + 4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  function plant() {
    var x = W * 0.5, y = bedY + 7, amount = Math.min(5, grown + waterProgress * 0.15), bloom = image("bloom"), sprout = image("sprout");
    ctx.save(); ctx.translate(x, y); ctx.scale(1 + Math.sin(time * 1.8) * (won ? 0.015 : 0.003), 1);
    if (grown === 0) {
      ctx.fillStyle = "#b78150"; ctx.beginPath(); ctx.ellipse(0, -3, 22, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e8c482"; ctx.strokeStyle = "#82552e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -11, 10, 6, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (grown === 1 && sprout) {
      var sw = Math.min(W * 0.36, 142), sh = sw * sprout.naturalHeight / sprout.naturalWidth;
      ctx.drawImage(sprout, -sw / 2, -sh + 6, sw, sh);
    } else if (grown >= 4 && bloom) {
      var bh = plantH * (grown === 4 ? 0.86 : 1), bw = bh * bloom.naturalWidth / bloom.naturalHeight;
      ctx.drawImage(bloom, -bw / 2, -bh + 8, bw, bh);
    } else {
      var stemH = plantH * (grown === 1 ? 0.27 : grown === 2 ? 0.48 : 0.63), stemW = 6;
      if (bloom && grown > 1) {
        // Reuse the painted leafy stem, without revealing its flower early.
        var sy = bloom.naturalHeight * 0.46, cropH = bloom.naturalHeight - sy, pw = stemH * bloom.naturalWidth / cropH;
        ctx.drawImage(bloom, 0, sy, bloom.naturalWidth, cropH, -pw / 2, -stemH + 7, pw, stemH);
      } else {
        ctx.strokeStyle = "#568a3a"; ctx.lineWidth = stemW; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-3, -stemH / 2, 0, -stemH); ctx.stroke();
        ctx.fillStyle = "#74ab41";
        [-1, 1].forEach(function (side) { ctx.save(); ctx.translate(0, -stemH * (side < 0 ? 0.45 : 0.75)); ctx.rotate(side * 0.45); ctx.beginPath(); ctx.ellipse(side * 12, 0, 15, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
      }
      if (grown === 3) {
        ctx.fillStyle = "#e694ad"; ctx.strokeStyle = "#d57c99"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -stemH, 15, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#83ab50"; ctx.beginPath(); ctx.moveTo(-15, -stemH + 8); ctx.quadraticCurveTo(0, -stemH + 24, 15, -stemH + 8); ctx.lineTo(0, -stemH + 13); ctx.closePath(); ctx.fill();
      }
      if (grown >= 4) {
        for (var petal = 0; petal < 8; petal++) { ctx.save(); ctx.translate(0, -stemH); ctx.rotate(petal * Math.PI / 4); ctx.fillStyle = petal % 2 ? "#f0a4bc" : "#e994b1"; ctx.beginPath(); ctx.ellipse(0, -23, 13, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        ctx.fillStyle = "#ead275"; ctx.beginPath(); ctx.arc(0, -stemH, 20, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
  function angle() { return pouring ? -0.1 : 0; }
  function spout() {
    var x = -canW * 0.235, y = canH * 0.115, a = angle();
    return { x: can.x + (x * Math.cos(a) - y * Math.sin(a)) / W, y: can.y + (x * Math.sin(a) + y * Math.cos(a)) / H };
  }
  function drawCan() {
    var i = image("can"); ctx.save(); ctx.translate(can.x * W, can.y * H); ctx.rotate(angle());
    if (i) ctx.drawImage(i, -canW / 2, -canH / 2, canW, canH);
    else {
      ctx.scale(canW / 140, canH / 112); ctx.lineWidth = 9; ctx.strokeStyle = "#2b9eae"; ctx.beginPath(); ctx.arc(19, -24, 28, Math.PI, 0, false); ctx.stroke();
      var body = ctx.createLinearGradient(-30, -20, 45, 40); body.addColorStop(0, "#b4e4e7"); body.addColorStop(0.4, "#66c4d4"); body.addColorStop(1, "#258995"); ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(-25, -22); ctx.quadraticCurveTo(35, -34, 48, -17); ctx.lineTo(55, 32); ctx.quadraticCurveTo(12, 52, -27, 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#68c4d0"; ctx.beginPath(); ctx.moveTo(-24, -1); ctx.lineTo(-57, 3); ctx.lineTo(-51, 17); ctx.lineTo(-19, 21); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#e6d899"; ctx.beginPath(); ctx.ellipse(-37, 13, 13, 8, -0.45, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f8edbd"; ctx.beginPath(); ctx.arc(15, 5, 10, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // A visible handle cue keeps the one gesture discoverable without text.
    if (canPlay() && !pouring && !landed) { ctx.save(); ctx.strokeStyle = "rgba(255,253,223,.9)"; ctx.lineWidth = 3; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.ellipse(can.x * W + canW * 0.17, can.y * H - canH * 0.25, canW * 0.22, canH * 0.24, -0.2, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  }
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H); background(); soil(); plant();
    drops.forEach(function (d) {
      ctx.save(); ctx.translate(d.x * W, d.y * H); ctx.fillStyle = "#76cbd9"; ctx.strokeStyle = "rgba(255,255,255,.88)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.quadraticCurveTo(5, 0, 3, 4); ctx.quadraticCurveTo(0, 7, -3, 4); ctx.quadraticCurveTo(-5, 0, 0, -5); ctx.fill(); ctx.stroke(); ctx.restore();
    });
    splashes.forEach(function (s) { ctx.globalAlpha = Math.max(0, 1 - s.age / 0.4); ctx.strokeStyle = "#a2e1e8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s.x * W, s.y * H, 3 + s.age * 30, 2 + s.age * 12, 0, 0, Math.PI * 2); ctx.stroke(); }); ctx.globalAlpha = 1;
    if (!won) drawCan();
  }
  function publish() {
    window.__flower = { active: active, paused: paused, stage: stage, stages: stages, waterProgress: waterProgress, reservoir: reservoir, capacity: capacity(), power: power,
      catchRadius: radius() / W, can: { x: can.x, y: can.y, width: canW / W, height: canH / H }, spout: spout(), target: { x: target.x, y: target.y, r: radius() / W },
      pouring: pouring, dragging: drag !== null, pointerId: drag, grown: grown, won: won, drops: drops.length, landed: landed, missed: missed, refills: refills, width: W, height: H,
      coordinates: "normalized-to-canvas; target radius and catchRadius use canvas width" };
  }
  function hud() {
    var allowed = canPlay(), b = $("gardenCan"); b.hidden = !active || won; b.disabled = !allowed;
    b.style.left = (can.x * W) + "px"; b.style.top = (can.y * H) + "px"; b.style.width = Math.max(74, canW) + "px"; b.style.height = Math.max(74, canH) + "px";
    b.setAttribute("aria-pressed", pouring ? "true" : "false");
    $("gardenRefill").disabled = !allowed || pouring || reservoir >= capacity() - 0.01;
    $("gardenHelp").disabled = !allowed || pouring;
    $("gardenReservoirFill").style.width = clamp(reservoir / capacity(), 0, 1) * 100 + "%";
    $("gardenRefill").setAttribute("aria-label", "Refill watering can. Water remaining " + Math.round(reservoir / Math.max(capacity(), reservoir) * 100) + " percent");
    $("gardenWaterFill").style.width = waterProgress * 100 + "%"; $("gardenWater").setAttribute("aria-valuenow", Math.round(waterProgress * 100));
    $("gardenPower").hidden = !(active && power > 0 && !won); $("gardenHelp").classList.toggle("powered", power > 0);
    $("gardenStage").textContent = ["Water the seed", "Grow the leaves", "Help a bud appear", "Open the flower", "One last drink"][Math.min(stage, 4)];
    publish();
  }
  function banner(text) { $("gardenBanner").textContent = text; }
  function setCan(p) {
    can.x = clamp(p.x, canW / W * 0.5 + 0.015, 0.985 - canW / W * 0.5);
    can.y = clamp(p.y, (playTop + canH * 0.5) / H, (bedY - canH * 0.25) / H);
  }
  function releaseCapture() {
    var s = dragSurface, id = drag; drag = null; dragSurface = null;
    try { if (s && id !== null && s.hasPointerCapture(id)) s.releasePointerCapture(id); } catch (e) {}
  }
  function stopPour() { pouring = false; keyboardPour = false; emission = 0; releaseCapture(); }
  function point(event) { var r = cv.getBoundingClientRect(); return { x: (event.clientX - r.left) / W, y: (event.clientY - r.top) / H }; }
  function nearCan(p) { return Math.abs((p.x - can.x) * W) <= Math.max(44, canW * 0.58) && Math.abs((p.y - can.y) * H) <= Math.max(44, canH * 0.58); }
  function beginPour() { if (!canPlay() || reservoir <= 0) return; pouring = true; emission = 0.055; banner("Hold the can over the glowing soil"); hud(); }
  function down(event) {
    if (!canPlay() || drag !== null || keyboardPour || (event.button != null && event.button !== 0)) return;
    var p = point(event); if (!nearCan(p)) return;
    event.preventDefault(); drag = event.pointerId; dragSurface = event.currentTarget; offset = { x: p.x - can.x, y: p.y - can.y };
    try { dragSurface.setPointerCapture(drag); } catch (e) {}
    beginPour();
  }
  function move(event) {
    if (event.pointerId !== drag || !canPlay()) return;
    var p = point(event); setCan({ x: p.x - offset.x, y: p.y - offset.y }); hud(); draw();
  }
  function up(event) { if (event.pointerId !== drag) return; stopPour(); if (canPlay()) banner(reservoir <= 0 ? "Refill your can, then keep watering" : "Pick up the can to water again"); hud(); draw(); }
  function keyboard(event) {
    if (!canPlay() || drag !== null) return;
    var p = { x: can.x, y: can.y }, step = event.shiftKey ? 0.015 : 0.045;
    if (event.key === "ArrowLeft") p.x -= step;
    else if (event.key === "ArrowRight") p.x += step;
    else if (event.key === "ArrowUp") p.y -= step;
    else if (event.key === "ArrowDown") p.y += step;
    else if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (!event.repeat) { keyboardPour = true; beginPour(); } return; }
    else return;
    event.preventDefault(); setCan(p); hud(); draw();
  }
  function keyup(event) { if ((event.key === " " || event.key === "Enter") && keyboardPour) { event.preventDefault(); stopPour(); hud(); } }
  function refill() { if (!canPlay() || pouring) return; reservoir = Math.max(reservoir, capacity()); refills++; api.sfx("tap"); banner("A full can. Hold it over the soil!"); hud(); }
  function controls() {
    [cv, $("gardenCan")].forEach(function (s) {
      s.addEventListener("pointerdown", down); s.addEventListener("pointermove", move); s.addEventListener("pointerup", up);
      s.addEventListener("pointercancel", up); s.addEventListener("lostpointercapture", up);
    });
    $("gardenCan").addEventListener("keydown", keyboard); $("gardenCan").addEventListener("keyup", keyup);
    $("gardenCan").addEventListener("blur", function () { if (keyboardPour) { stopPour(); hud(); } });
    $("gardenRefill").onclick = refill; $("gardenHelp").onclick = function () { if (canPlay() && !pouring) api.practice(); };
    window.addEventListener("resize", fit); document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
    window.addEventListener("pagehide", function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; });
    window.addEventListener("pageshow", function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
  }
  function complete() {
    if (!canPlay()) return;
    waterProgress = 1; grown = Math.max(grown, stage + 1); active = false; power = 0; stopPour(); drops = [];
    banner(grown === 5 ? "You grew a beautiful flower!" : "Look! Your flower is growing"); api.sfx("correct"); hud(); draw(); api.done();
  }
  function tick(dt) {
    if (!canPlay()) return;
    time += dt; power = Math.max(0, power - dt);
    if (pouring && reservoir > 0) {
      emission += dt;
      while (emission >= 0.055 && reservoir > 0) {
        emission -= 0.055; var p = spout(), spread = power > 0 ? 0.05 : 0.02;
        drops.push({ x: p.x, y: p.y, vx: -0.018 + (Math.random() - 0.5) * spread, vy: 0.12, value: 0.03 }); reservoir = Math.max(0, reservoir - 0.035);
      }
      if (reservoir <= 0) { pouring = false; keyboardPour = false; banner("Refill your can to keep watering"); }
    }
    for (var n = drops.length - 1; n >= 0; n--) {
      var d = drops[n], previous = d.y; d.vy += dt * 0.9; d.x += d.vx * dt; d.y += d.vy * dt;
      if (previous < target.y && d.y >= target.y) {
        if (Math.abs((d.x - target.x) * W) <= radius()) { waterProgress = Math.min(1, waterProgress + d.value); landed++; splashes.push({ x: d.x, y: target.y, age: 0 }); }
        else missed++;
        drops.splice(n, 1);
        if (waterProgress >= 1) { complete(); return; }
      } else if (d.y > 1.05 || d.x < -0.1 || d.x > 1.1) { missed++; drops.splice(n, 1); }
    }
    splashes.forEach(function (s) { s.age += dt; }); splashes = splashes.filter(function (s) { return s.age < 0.4; }); hud();
  }
  function frame(now) { var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; tick(dt); draw(); raf = requestAnimationFrame(frame); }
  function earnPower() { power = POWER; paused = false; active = true; last = 0; banner("A gentle shower! Hold the can over the glow"); hud(); }
  function pause() { paused = true; last = 0; stopPour(); hud(); }
  function reset() {
    stopPour(); active = false; paused = false; stage = 0; grown = 0; won = false; waterProgress = 0; reservoir = 0; power = 0; time = 0; last = 0; landed = 0; missed = 0; refills = 0; drops = []; splashes = [];
    target.x = TARGETS[0]; target.y = bedY / H; can.x = home.x; can.y = home.y; banner("Let's grow a flower!"); hud(); draw();
  }
  window.Flower = {
    init: function (a, n) { api = a; stages = n || 5; cv = $("gardenCanvas"); ctx = cv.getContext("2d"); loadArt(); controls(); fit(); reset(); raf = requestAnimationFrame(frame); },
    onWord: function (index) { stage = index; target.x = TARGETS[index]; waterProgress = 0; reservoir = 1.8; drops = []; splashes = []; stopPour(); can.x = home.x; can.y = home.y; earnPower(); },
    onHelp: earnPower,
    pause: pause,
    resume: function (playing) { paused = playing === false; last = 0; hud(); },
    reset: reset,
    finale: function () { stopPour(); active = false; power = 0; won = true; banner("A flower you grew yourself!"); hud(); draw(); }
  };
})();
