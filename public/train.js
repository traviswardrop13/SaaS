/* Choo-Choo Train: hold to drive, release to coast to a stop, then move a
   waiting friend through the coach door. SayPlay owns all speech and audio.

   THE WORD EARNS THE TRIP; THE FINGER DRIVES AND BOARDS. Saying the word
   (two times) starts each trip. The finger then holds Forward, lets go by
   the friend, and drags the friend into the door. The optional "Easy stops"
   word adds ten seconds of slower driving and wider stops on top.

   EVERY TRIP ENDS WITH A FRIEND ABOARD, with no speech needed (the Hoops
   rule). Each trip counts its misses: driving out past the friend, stopping
   just short of them, or dropping the friend away from the door. A tap that
   never moved the friend, or waiting, is not a miss. Ages 5-8:
     0  the game as designed;
     1  the train tops out slower, the stopping place and the door are 1.5x,
        and letting go near the friend coasts right up to them;
     2  the stop and the door glow and pulse, an arrow points the way (and the
        button to hold), both are about 2.25x, and the coast-in reaches further;
     3  holding either button drives to the friend and stops there; a drop
        anywhere over the coach (or most of the way up to it) boards.
   Ages 2-4 (setLittle): the glow and the arrow from the first miss, level 3
   from the second. Driving or dragging for a long time without boarding steps
   up too (big: 8/14/20 s, little: 6/12 s of a finger actually on a control).
   Nothing ever finishes a trip by itself: the finger still lets go and drops. */
(function () {
  "use strict";
  var STEP_LINES = [
    "Hold Forward. Let go by the friend. Then drag them into the door.",
    "Drive to the next friend, and let go.",
    "Next stop! Let go by the friend.",
    "Drive, stop, and help the next friend in.",
    "One more friend! Stop, then drag them in."
  ];
  var api, cv, ctx, W = 390, H = 844, raf = 0, last = 0, active = false, paused = false, away = false, won = false, stage = 0, stages = 5, boarded = 0, power = 0;
  var position = 0.25, velocity = 0, camera = 0, acceleration = 0.45, brake = 0.8, top = 120, bottom = 670, railY = 510, platformY = 596, trainW = 366, trainH = 146, trainLeft = 10, trainTop = 380;
  var door = { x: 0.5, y: 0.55, w: 0.15, h: 0.1 }, friendHome = { x: 1.25, y: 0.5 }, passenger = { x: 1.25, y: 0.5 }, friendW = 54, friendH = 72;
  var forwardOwner = null, backOwner = null, passengerOwner = null, forwardSurface = null, backSurface = null, passengerSurface = null, held = false, keyboardPassenger = false, dragAssist = null, grab = { x: 0, y: 0 }, misses = 0, art = {};
  var keys = { forward: false, back: false }, STOPS = [1, 2.05, 3.10, 4.15, 5.20], FRIENDS = ["bunny", "cat", "lion", "penguin", "frog"], POWER = 10;
  var BOUNDS = [[137,31,387,476],[89,31,423,478],[58,31,455,477],[97,31,425,476],[73,31,445,475]];
  var TRAIN_DOOR = { x: 0.52065, y: 0.49875, w: 0.1145, h: 0.3569 }, WINDOW = { x: 0.097, y: 0.345, w: 0.296, h: 0.215 }, WHEELS = [[0.121,0.782,0.046],[0.533,0.782,0.046],[0.746,0.782,0.046],[0.877,0.782,0.046]];
  // the help ladder (see the top of this file)
  var SPEED = [0.58, 0.36, 0.29, 0.29], BERTH = [0.08, 0.12, 0.18, 0.20], SAFE = [0.025, 0.04, 0.06, 0.08], DOOR_K = [1, 1.5, 2.25, 2.5], COAST = [0, 0.35, 0.6, 99];
  var little = false, stageMisses = 0, tryTime = 0, attemptOpen = false, wasInside = false, wasMoving = false, powerArmed = false, saidMiss = {};
  // the celebration beat runs on the game's own clock, so a pause holds it
  var clock = 0, doneAt = 0, cheerAt = -9, lastMiss = "";
  var $ = function (id) { return document.getElementById(id); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function canPlay() { return active && !paused && !away && !won && !document.hidden; }
  function ladder() {
    var m = stageMisses, t = tryTime, byMiss = little ? (m >= 2 ? 3 : m >= 1 ? 2 : 0) : Math.min(3, m);
    var byTime = little ? (t >= 12 ? 3 : t >= 6 ? 2 : 0) : (t >= 20 ? 3 : t >= 14 ? 2 : t >= 8 ? 1 : 0);
    return Math.max(byMiss, byTime);
  }
  function waiting() { return active && !won && boarded === stage; }
  function maxSpeed() { var s = SPEED[ladder()]; return power > 0 ? Math.min(s, 0.36) : s; }
  function berth() { return dragAssist ? dragAssist.berth : Math.max(BERTH[ladder()], power > 0 ? 0.14 : 0); }
  function safeSpeed() { return dragAssist ? dragAssist.safeSpeed : Math.max(SAFE[ladder()], power > 0 ? 0.045 : 0); }
  function doorRadius() { if (dragAssist) return dragAssist.radius; var base = Math.max(22, W * 0.065) / W * DOOR_K[ladder()]; return power > 0 ? Math.max(base, Math.max(32, W * 0.095) / W) : base; }
  function driving() { return forwardOwner !== null || backOwner !== null || keys.forward || keys.back; }
  function canBoard() { return canPlay() && boarded === stage && Math.abs(position - STOPS[stage]) <= berth() && Math.abs(velocity) <= safeSpeed() && !driving(); }
  function guide() { return waiting() && ladder() >= 2; }
  // which way the friend is, for the arrow and the glowing button
  function towards() { var d = STOPS[stage] - position; return Math.abs(d) <= berth() ? 0 : d > 0 ? 1 : -1; }
  function banner(text) { if ($("trainBanner").textContent !== text) $("trainBanner").textContent = text; }
  function image(name) { var i = art[name]; return i && i.complete && i.naturalWidth ? i : null; }
  function loadArt() {
    [["bg", "/assets/crafted/game/train-countryside-v1.webp"], ["train", "/assets/crafted/game/train-engine-coach-v1.webp"]].concat(FRIENDS.map(function (name) { return [name, "/assets/crafted/buddy-" + name + "-sit.webp"]; })).forEach(function (p) { var i = new Image(); i.onload = function () { if (p[0] === "train") fit(); else draw(); }; i.src = p[1]; art[p[0]] = i; });
  }
  function updateGeometry() {
    camera = position - 0.5;
    trainLeft = W * 0.5 - trainW * TRAIN_DOOR.x; trainTop = railY - trainH * 0.90;
    door = { x: 0.5, y: (trainTop + trainH * TRAIN_DOOR.y) / H, w: Math.max(44, trainW * TRAIN_DOOR.w) / W, h: Math.max(52, trainH * TRAIN_DOOR.h) / H };
    var box = BOUNDS[stage]; friendW = friendH * (box[2] - box[0]) / (box[3] - box[1]);
    platformY = railY + friendH + 14;
    friendHome = { x: STOPS[stage] - camera, y: (platformY - friendH / 2) / H };
    if (!held) { passenger.x = friendHome.x; passenger.y = friendHome.y; }
  }
  function fit() {
    if (!cv) return; stopInputs(); cancelPassenger(); var rect = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.max(1, rect.width); H = Math.max(1, rect.height); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    top = $("trainBanner").getBoundingClientRect().bottom - rect.top + 18; bottom = $("trainHelp").getBoundingClientRect().top - rect.top - 12;
    var room = Math.max(100, bottom - top), i = image("train"), aspect = i ? i.naturalWidth / i.naturalHeight : 2.5;
    trainW = W * 0.94; trainH = trainW / aspect; if (trainH > room * 0.54) { trainH = room * 0.54; trainW = trainH * aspect; }
    friendH = Math.min(84, W * 0.22, room * 0.30);
    // The waiting friend stands on the foreground platform, never on the
    // coach roof. Reserve their whole accessible hitbox on short boards.
    railY = Math.min(top + room * 0.60, bottom + 3 - Math.max(64, friendH + 10) / 2 - friendH / 2 - 14);
    updateGeometry(); hud(); draw();
  }
  function passengerVisible() {
    if (boarded > stage || won) return false;
    var w = Math.max(64, friendW + 12), h = Math.max(64, friendH + 10), x = passenger.x * W, y = passenger.y * H;
    return x - w / 2 >= 4 && x + w / 2 <= W - 4 && y - h / 2 >= top - 12 && y + h / 2 <= bottom + 3;
  }
  function snapshot() {
    window.__train = { active: active, paused: paused, stage: stage, stages: stages, boarded: boarded, won: won, position: position, velocity: velocity, camera: camera,
      station: { position: STOPS[stage], x: STOPS[stage] - camera, y: friendHome.y }, platformY: platformY / H, railY: railY / H, berth: berth(), safeSpeed: safeSpeed(), maxSpeed: maxSpeed(), acceleration: acceleration, brake: brake, canBoard: canBoard(), power: power, powerArmed: powerArmed,
      passenger: { x: passenger.x, y: passenger.y, w: Math.max(64, friendW + 12) / W, h: Math.max(64, friendH + 10) / H, visible: passengerVisible(), dragging: held, friend: FRIENDS[stage] },
      door: { x: door.x, y: door.y, w: door.w, h: door.h, r: doorRadius(), baseR: Math.max(22, W * 0.065) / W }, held: held, owners: { forward: forwardOwner, back: backOwner, passenger: passengerOwner }, keys: { forward: keys.forward, back: keys.back }, keyboardPassenger: keyboardPassenger,
      dragAssist: dragAssist ? { berth: dragAssist.berth, safeSpeed: dragAssist.safeSpeed, radius: dragAssist.radius } : null, misses: misses, width: W, height: H,
      ladder: ladder(), stageMisses: stageMisses, tryTime: tryTime, little: little, guide: guide(), snap: waiting() && ladder() >= 3, coast: COAST[ladder()], towards: towards(), lastMiss: lastMiss, celebrating: doneAt > 0, clock: clock,
      banner: $("trainBanner").textContent, status: $("trainStatusText").textContent,
      train: { x: trainLeft / W, y: trainTop / H, w: trainW / W, h: trainH / H, wheelAngle: position / 0.035 }, coordinates: "screen positions normalized to canvas; world position, velocity, acceleration, berth and door radius use canvas width" };
  }
  function statusText() {
    if (held) return "Into the door!";
    if (canBoard()) return "All aboard!";
    if (!waiting()) return "Find our friend";
    var d = STOPS[stage] - position, b = berth();
    // held by the friend (level 3 drives there by itself): only letting go is left
    if (driving() && Math.abs(d) <= b && Math.abs(velocity) <= 0.01) return "Let go now!";
    if (Math.abs(velocity) > 0.01) {
      if (d * velocity < 0 && Math.abs(d) > b) return "Let go, then Back";
      // a release right now would stop by the friend: say so
      return velocity * velocity / (2 * brake) >= Math.abs(d) - b || Math.abs(d) <= b ? "Let go now!" : "Keep going";
    }
    return d < -b ? "Hold Back" : d > b ? "Hold Forward" : "Find our friend";
  }
  function hud() {
    if (!cv) return; var allowed = canPlay(), p = $("trainPassenger"), visible = passengerVisible(), g = guide() && !held && !canBoard(), dir = towards(); p.hidden = !visible; p.disabled = !allowed || !held && !canBoard(); p.style.left = passenger.x * W + "px"; p.style.top = passenger.y * H + "px"; p.style.width = Math.max(64, friendW + 12) + "px"; p.style.height = Math.max(64, friendH + 10) + "px"; p.setAttribute("aria-pressed", held ? "true" : "false");
    $("trainForward").disabled = !allowed || held; $("trainBack").disabled = !allowed || held; $("trainHelp").disabled = !allowed || held; $("trainHearStep").disabled = !allowed || held;
    $("trainForward").setAttribute("aria-pressed", forwardOwner !== null || keys.forward ? "true" : "false"); $("trainBack").setAttribute("aria-pressed", backOwner !== null || keys.back ? "true" : "false");
    // at level 2 and up the button to hold glows (either works at level 3)
    $("trainForward").classList.toggle("guide", g && dir > 0); $("trainBack").classList.toggle("guide", g && dir < 0);
    p.classList.toggle("guide", guide() && canBoard() && !held);
    $("trainPower").hidden = power <= 0; $("trainPowerFill").style.width = power / POWER * 100 + "%";
    $("trainStatusText").textContent = statusText();
    $("trainLamp").className = canBoard() || held ? "ready" : ""; snapshot();
  }
  function background() {
    var i = image("bg");
    if (i) {
      // Tiles by index, every other one mirrored, so each painted edge meets
      // itself: the sky, hills and grass run on with no seam.
      var scale = Math.max(W / i.naturalWidth, H / i.naturalHeight), w = i.naturalWidth * scale, h = i.naturalHeight * scale, scroll = camera * W * 0.16, n0 = Math.floor(scroll / w), y = (H - h) / 2;
      for (var n = n0; n <= n0 + 1 + Math.ceil(W / w); n++) { var x = n * w - scroll; if (x > W || x + w < 0) continue; if (n % 2) { ctx.save(); ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.drawImage(i, 0, y, w, h); ctx.restore(); } else ctx.drawImage(i, x, y, w, h); }
    }
    else { var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#b9dce7"); g.addColorStop(0.55, "#e4ead1"); g.addColorStop(1, "#b0c895"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    // Close sleepers pass faster than distant scenery. Their world positions
    // also make reversing and the distance to the next platform visible.
    ctx.fillStyle = "rgba(183,166,129,.55)"; ctx.fillRect(0, railY - 2, W, Math.max(20, W * 0.10));
    for (var s = Math.floor(camera / 0.13) - 1; s < Math.ceil((camera + 1) / 0.13) + 1; s++) { var sx = (s * 0.13 - camera) * W; ctx.save(); ctx.translate(sx, railY + W * 0.035); ctx.rotate(-0.13); ctx.fillStyle = "#9d8063"; ctx.fillRect(-5, -3, 10, W * 0.08); ctx.fillStyle = "#bfaa85"; ctx.fillRect(-5, -3, 10, 3); ctx.restore(); }
    [railY + 3, railY + W * 0.075].forEach(function (ry) { ctx.strokeStyle = "#6b7a7f"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(W, ry); ctx.stroke(); ctx.strokeStyle = "#e4e5d9"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, ry - 1); ctx.lineTo(W, ry - 1); ctx.stroke(); });
  }
  function pulse() { return 0.5 + 0.5 * Math.sin(clock * 5); }
  function platforms() {
    STOPS.forEach(function (stop, n) { var x = (stop - camera) * W, y = platformY; if (x < -W * 0.65 || x > W * 1.65) return; var w = W * 0.48;
      ctx.save(); ctx.translate(x, y); ctx.fillStyle = "#b39a76"; ctx.fillRect(-w * 0.50, 0, w, 10); ctx.fillStyle = "#e1cda4"; ctx.fillRect(-w * 0.52, -5, w * 1.04, 9); ctx.strokeStyle = "rgba(125,105,79,.26)"; ctx.lineWidth = 1; for (var line = -2; line < 3; line++) { ctx.beginPath(); ctx.moveTo(line * w / 5, -3); ctx.lineTo(line * w / 5, 4); ctx.stroke(); }
      ctx.fillStyle = "#ae906e"; ctx.fillRect(w * 0.31, -48, 6, 43); ctx.fillStyle = "#fff6df"; ctx.strokeStyle = "#c4ac85"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w * 0.33, -49, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#6b6650"; ctx.font = "800 19px 'Baloo 2',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(n + 1), w * 0.33, -48); ctx.restore();
      if (n === stage && boarded === stage) {
        ctx.save(); ctx.lineCap = "round";
        // level 2 and up: the stopping place glows and pulses
        if (guide()) { ctx.strokeStyle = "rgba(255,214,106," + (0.45 + 0.4 * pulse()) + ")"; ctx.lineWidth = 16; ctx.shadowColor = "#ffe08a"; ctx.shadowBlur = 16; ctx.beginPath(); ctx.moveTo(x - berth() * W, railY - 6); ctx.lineTo(x + berth() * W, railY - 6); ctx.stroke(); ctx.shadowBlur = 0; }
        ctx.strokeStyle = canBoard() ? "#3e9c9d" : "rgba(245,241,189,.9)"; ctx.lineWidth = 4; ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.moveTo(x - berth() * W, railY - 6); ctx.lineTo(x + berth() * W, railY - 6); ctx.stroke(); ctx.restore();
      }
    });
  }
  function arrow(x0, y0, x1, y1, width) {
    var a = Math.atan2(y1 - y0, x1 - x0), len = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)); if (len < 24) return;
    ctx.save(); ctx.translate(x0, y0); ctx.rotate(a); ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(73,55,30,.35)"; ctx.lineWidth = width + 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len - width, 0); ctx.stroke();
    ctx.strokeStyle = "#ffd66a"; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len - width, 0); ctx.stroke();
    ctx.fillStyle = "#ffd66a"; ctx.strokeStyle = "rgba(73,55,30,.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(len - width * 2.4, -width * 1.6); ctx.lineTo(len - width * 2.4, width * 1.6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  function guides() {
    if (!guide()) return; var k = pulse();
    if (canBoard() || held) { // from the friend up into the door
      var fx = (held ? passenger.x : friendHome.x) * W, fy = (held ? passenger.y : friendHome.y) * H - friendH * 0.55;
      arrow(fx, fy, door.x * W, door.y * H + doorRadius() * W * 0.7, 9);
    } else { // along the rails to the friend
      var dir = towards(); if (!dir) return; var sx = (STOPS[stage] - camera) * W, y = railY - trainH * 1.02, from = W * 0.5 + dir * Math.min(W * 0.18, trainW * 0.2), to = clamp(sx, 26, W - 26) - dir * 6;
      if ((to - from) * dir < 30) { from = W * 0.5 - dir * 40; to = W * 0.5 + dir * 40; }
      arrow(from + dir * k * 8, y, to + dir * k * 8, y, 10);
    }
  }
  function drawFriend(index, x, y, height, faceOnly) {
    var i = image(FRIENDS[index]), box = BOUNDS[index]; if (i) {
      var sx = faceOnly ? 40 : box[0], sy = faceOnly ? 20 : box[1], sw = faceOnly ? 432 : box[2] - box[0], sh = faceOnly ? 285 : box[3] - box[1], w = height * sw / sh;
      ctx.drawImage(i, sx, sy, sw, sh, x - w / 2, y - height / 2, w, height);
    } else { ctx.save(); ctx.translate(x, y); ctx.fillStyle = ["#dfd4c7", "#c99778", "#d6b878", "#809ca4", "#9ebd88"][index]; ctx.beginPath(); ctx.ellipse(0, height * 0.12, height * 0.27, height * 0.32, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(0, -height * 0.12, height * 0.27, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#3e4145"; [-1, 1].forEach(function (side) { ctx.beginPath(); ctx.arc(side * height * 0.1, -height * 0.15, Math.max(2, height * 0.025), 0, Math.PI * 2); ctx.fill(); }); ctx.restore(); }
  }
  function drawRiders(wx, wy, ww, wh) {
    // the newest rider hops for a moment when they climb aboard
    var hop = Math.max(0, 1 - (clock - cheerAt) / 1.1);
    ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip(); ctx.fillStyle = "#b1d5d4"; ctx.fillRect(wx, wy, ww, wh);
    for (var n = 0; n < boarded; n++) drawFriend(n, wx + ww * (n + 0.5) / 5, wy + wh * 0.54 - (n === boarded - 1 ? Math.abs(Math.sin((clock - cheerAt) * 9)) * wh * 0.18 * hop : 0), Math.min(wh * 0.92, ww / 5 * 0.85), true); ctx.restore();
  }
  function drawTrain() {
    var i = image("train"), wx = trainLeft + WINDOW.x * trainW, wy = trainTop + WINDOW.y * trainH, ww = WINDOW.w * trainW, wh = WINDOW.h * trainH;
    drawRiders(wx, wy, ww, wh);
    if (i) ctx.drawImage(i, trainLeft, trainTop, trainW, trainH);
    else { ctx.fillStyle = "#388c95"; ctx.fillRect(trainLeft, trainTop + trainH * 0.23, trainW * 0.64, trainH * 0.56); ctx.fillStyle = "#f5e7c9"; ctx.fillRect(trainLeft, trainTop + trainH * 0.17, trainW * 0.64, trainH * 0.10); drawRiders(wx, wy, ww, wh); ctx.fillStyle = "#a95260"; ctx.fillRect(trainLeft + trainW * 0.65, trainTop + trainH * 0.32, trainW * 0.32, trainH * 0.45); ctx.fillStyle = "#e6c383"; ctx.fillRect(trainLeft + trainW * 0.73, trainTop + trainH * 0.18, trainW * 0.11, trainH * 0.18); ctx.fillStyle = "#233f48"; ctx.fillRect(door.x * W - door.w * W / 2, door.y * H - door.h * H / 2, door.w * W, door.h * H); }
    WHEELS.forEach(function (p) { var x = trainLeft + p[0] * trainW, y = trainTop + p[1] * trainH, r = p[2] * trainW; ctx.save(); ctx.translate(x, y); ctx.rotate(position * W / Math.max(1, r)); if (!i) { ctx.fillStyle = "#39505c"; ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, Math.PI * 2); ctx.fill(); } ctx.strokeStyle = "rgba(225,210,164,.7)"; ctx.lineWidth = Math.max(1.5, r * 0.10); for (var spoke = 0; spoke < 4; spoke++) { var a = spoke * Math.PI / 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16); ctx.lineTo(Math.cos(a) * r * 0.54, Math.sin(a) * r * 0.54); ctx.stroke(); } ctx.fillStyle = "#cfb477"; ctx.beginPath(); ctx.arc(0, 0, Math.max(2, r * 0.15), 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
    if (canBoard() || held) { var g = guide(), k = g ? pulse() : 0; ctx.save(); ctx.translate(door.x * W, door.y * H); ctx.fillStyle = "rgba(255,245,198," + (g ? 0.2 + 0.15 * k : 0.13) + ")"; ctx.strokeStyle = g ? "#ffd66a" : "#fff4be"; ctx.shadowColor = "#fff0b3"; ctx.shadowBlur = g ? 18 + 10 * k : 13; ctx.lineWidth = g ? 5 : 3; ctx.beginPath(); ctx.arc(0, 0, doorRadius() * W, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); }
  }
  function drawPassenger() {
    if (!passengerVisible()) return; var x = passenger.x * W, y = passenger.y * H;
    if (!held) { ctx.fillStyle = "rgba(73,102,79,.17)"; ctx.beginPath(); ctx.ellipse(x, y + friendH * 0.46, friendW * 0.43, 5, 0, 0, Math.PI * 2); ctx.fill(); }
    drawFriend(stage, x, y, friendH, false);
    if (canBoard() && !held) { ctx.save(); ctx.strokeStyle = "#fff8d4"; ctx.lineWidth = 3; ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.ellipse(x, y, Math.max(28, friendW * 0.59), friendH * 0.56, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  }
  function draw() { if (!ctx) return; ctx.clearRect(0, 0, W, H); background(); platforms(); drawTrain(); drawPassenger(); guides(); }
  function pointerPoint(event) { var rect = cv.getBoundingClientRect(); return { x: (event.clientX - rect.left) / W, y: (event.clientY - rect.top) / H }; }
  // a press on Forward or Back starts a new stopping try (and the help clock)
  function pressed() { if (waiting()) attemptOpen = true; powerArmed = true; }
  function driveDown(event, forward) {
    if (!canPlay() || held || event.button !== undefined && event.button !== 0 || (forward ? forwardOwner : backOwner) !== null) return; event.preventDefault(); if (forward) { forwardOwner = event.pointerId; forwardSurface = event.currentTarget; } else { backOwner = event.pointerId; backSurface = event.currentTarget; } try { event.currentTarget.setPointerCapture(event.pointerId); } catch (e) {} pressed(); hud();
  }
  function driveUp(event, forward) {
    if (event.pointerId !== (forward ? forwardOwner : backOwner)) return; event.preventDefault(); var s = forward ? forwardSurface : backSurface; if (forward) { forwardOwner = null; forwardSurface = null; } else { backOwner = null; backSurface = null; } if (s) try { if (s.hasPointerCapture(event.pointerId)) s.releasePointerCapture(event.pointerId); } catch (e) {} hud();
  }
  function stopInputs() { var f = forwardOwner, b = backOwner, fs = forwardSurface, bs = backSurface; forwardOwner = null; backOwner = null; forwardSurface = null; backSurface = null; keys.forward = false; keys.back = false; [[f,fs],[b,bs]].forEach(function (pair) { if (pair[0] !== null && pair[1]) try { if (pair[1].hasPointerCapture(pair[0])) pair[1].releasePointerCapture(pair[0]); } catch (e) {} }); }
  function pickUp() { if (!canBoard() || held || !passengerVisible()) return false; dragAssist = { berth: berth(), radius: doorRadius(), safeSpeed: safeSpeed(), snap: ladder() >= 3 }; held = true; powerArmed = true; stopInputs(); banner("Help our friend through the glowing door"); return true; }
  function passengerDown(event) { if (event.button !== undefined && event.button !== 0 || passengerOwner !== null || !pickUp()) return; event.preventDefault(); var p = pointerPoint(event); grab.x = p.x - passenger.x; grab.y = p.y - passenger.y; passengerOwner = event.pointerId; passengerSurface = event.currentTarget; keyboardPassenger = false; try { passengerSurface.setPointerCapture(passengerOwner); } catch (e) {} hud(); draw(); }
  function movePassenger(p) { if (!held || !canPlay()) return; var hw = Math.max(64, friendW + 12) / 2, hh = Math.max(64, friendH + 10) / 2; passenger.x = clamp(p.x, (hw + 4) / W, 1 - (hw + 4) / W); passenger.y = clamp(p.y, (top + hh - 12) / H, (bottom - hh) / H); hud(); draw(); }
  function passengerMove(event) { if (event.pointerId !== passengerOwner || !held) return; event.preventDefault(); var p = pointerPoint(event); movePassenger({ x: p.x - grab.x, y: p.y - grab.y }); }
  function detachPassenger() { var id = passengerOwner, s = passengerSurface; passengerOwner = null; passengerSurface = null; held = false; keyboardPassenger = false; if (id !== null && s) try { if (s.hasPointerCapture(id)) s.releasePointerCapture(id); } catch (e) {} }
  function cancelPassenger() { detachPassenger(); dragAssist = null; passenger.x = friendHome.x; passenger.y = friendHome.y; }
  // A real failed try makes this trip easier, and Echo says (once per kind
  // per trip) what the finger does next. Never "missed" or "wrong".
  var MISS_WORDS = { past: ["So close! Hold Back.", "So close! Back a little"], short: ["Nearly! Hold Forward.", "Nearly! A little more"], door: ["So close! Drag them into the door.", "So close! Try the door again"] };
  function miss(kind) {
    var before = ladder(); misses++; stageMisses++; attemptOpen = false; lastMiss = kind;
    banner(ladder() >= 2 ? (kind === "door" ? "Follow the arrow into the door" : "Follow the arrow, then let go") : MISS_WORDS[kind][1]);
    if (!saidMiss[kind] || ladder() >= 2 && before < 2) { saidMiss[kind] = true; try { api.instruct(MISS_WORDS[kind][0]); } catch (e) {} }
    try { if (api.face) api.face("think"); } catch (e) {}
  }
  function dropPassenger() {
    if (!held || !canPlay()) return; var dx = passenger.x - door.x, dy = (passenger.y - door.y) * H / W, r = doorRadius(), snapIn = dragAssist && dragAssist.snap, movedPx = Math.sqrt(Math.pow((passenger.x - friendHome.x) * W, 2) + Math.pow((passenger.y - friendHome.y) * H, 2));
    var near = dx * dx + dy * dy <= r * r;
    // level 3: a drop over the coach, or most of the way up to it, boards
    var overCoach = snapIn && (passenger.x * W >= trainLeft - 16 && passenger.x * W <= trainLeft + trainW + 16 && passenger.y * H <= trainTop + trainH + 16 || passenger.y < friendHome.y - (friendHome.y - door.y) * 0.4);
    var valid = canBoard() && (near || overCoach); detachPassenger(); dragAssist = null;
    if (valid) { boarded = stage + 1; active = false; velocity = 0; stopInputs(); passenger.x = door.x; passenger.y = door.y; banner(boarded === stages ? "Five friends, all aboard!" : "All aboard! Time for our next stop"); api.sfx("correct"); try { api.cheer("All aboard!"); if (api.face) api.face("cheer"); } catch (e) {} cheerAt = clock; doneAt = clock + 1.15; hud(); draw(); }
    else { passenger.x = friendHome.x; passenger.y = friendHome.y; if (movedPx > 12) miss("door"); else banner("Drag our friend into the door"); hud(); draw(); }
  }
  function passengerUp(event, canceled) { if (event.pointerId !== passengerOwner) return; event.preventDefault(); if (canceled || !canPlay()) cancelPassenger(); else dropPassenger(); hud(); draw(); }
  function passengerKey(event) {
    if (!canPlay() || passengerOwner !== null) return; var key = event.key;
    if (key === " " || key === "Enter") { event.preventDefault(); event.stopPropagation(); if (event.repeat) return; if (held) dropPassenger(); else if (pickUp()) keyboardPassenger = true; hud(); draw(); return; }
    if (key === "Escape" && held) { event.preventDefault(); cancelPassenger(); hud(); draw(); return; }
    if (!held || !keyboardPassenger) return; var dx = 0, dy = 0, step = event.shiftKey ? 0.018 : 0.065; if (key === "ArrowLeft") dx = -step; else if (key === "ArrowRight") dx = step; else if (key === "ArrowUp") dy = -step * W / H; else if (key === "ArrowDown") dy = step * W / H; else return; event.preventDefault(); event.stopPropagation(); movePassenger({ x: passenger.x + dx, y: passenger.y + dy });
  }
  function controls() {
    [["trainForward",true],["trainBack",false]].forEach(function (p) { var b = $(p[0]); b.addEventListener("pointerdown", function (e) { driveDown(e,p[1]); }); ["pointerup","pointercancel","lostpointercapture"].forEach(function (name) { b.addEventListener(name, function (e) { driveUp(e,p[1]); }); }); });
    var p = $("trainPassenger"); p.addEventListener("pointerdown",passengerDown); p.addEventListener("pointermove",passengerMove); p.addEventListener("pointerup",function (e) { passengerUp(e,false); }); p.addEventListener("pointercancel",function (e) { passengerUp(e,true); }); p.addEventListener("lostpointercapture",function (e) { passengerUp(e,true); }); p.addEventListener("keydown",passengerKey);
    window.addEventListener("keydown",function (event) { if (!canPlay() || held) return; var key = event.key, name = key === "ArrowRight" || (key === " " || key === "Enter") && event.target === $("trainForward") ? "forward" : key === "ArrowLeft" || (key === " " || key === "Enter") && event.target === $("trainBack") ? "back" : null; if (!name) return; event.preventDefault(); if (!event.repeat && !keys[name]) pressed(); keys[name] = true; hud(); });
    // Space and Enter belong to the driving buttons only: everywhere else
    // (Let's play, Hear step, the pause and end cards) they press the button.
    window.addEventListener("keyup",function (event) { var key = event.key, mine = event.target === $("trainForward") || event.target === $("trainBack"); if (key === "ArrowRight") keys.forward = false; else if (key === "ArrowLeft") keys.back = false; else if ((key === " " || key === "Enter") && (mine || keys.forward || keys.back)) { keys.forward = false; keys.back = false; } else return; event.preventDefault(); hud(); });
    $("trainHelp").onclick = function () { if (canPlay() && !held) api.practice(); }; $("trainHearStep").onclick = function () { if (canPlay() && !held) api.instruct(STEP_LINES[stage]); };
    window.addEventListener("resize",fit); window.addEventListener("blur",function () { stopInputs(); cancelPassenger(); hud(); }); document.addEventListener("visibilitychange",function () { if (document.hidden) pause(); }); window.addEventListener("pagehide",function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; }); window.addEventListener("pageshow",function () { away = false; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } hud(); });
  }
  function tick(dt) {
    if (!canPlay()) return; if (powerArmed) power = Math.max(0,power-dt);
    var command = (forwardOwner !== null || keys.forward ? 1 : 0) - (backOwner !== null || keys.back ? 1 : 0), wait = boarded === stage, L = ladder(), d = STOPS[stage] - position;
    if (wait && (command !== 0 || held)) tryTime += dt;
    // level 3: either button drives to the friend, and the train stops there
    if (wait && !held && L >= 3 && command !== 0) command = Math.abs(d) < 0.003 ? 0 : d > 0 ? 1 : -1;
    var desired = held ? 0 : command * maxSpeed(), rate = !command || velocity * command < 0 ? brake : acceleration, old = velocity;
    // Buffers a little past the friend, both ways: the train never runs off
    // to the end of the line, so coming back is never a long trip.
    if (wait) { var hi = STOPS[stage] + 0.55, lo = Math.max(0, STOPS[stage] - 0.9); if (desired > 0) desired = Math.min(desired, maxSpeed() * clamp((hi - position) / 0.3, 0, 1)); if (desired < 0) desired = Math.max(desired, -maxSpeed() * clamp((position - lo) / 0.3, 0, 1)); }
    // Coast-in (level 1 and up): heading at the friend with the button let go
    // (or any button at level 3), the brake lands the train right by them.
    var need = velocity * velocity / (2 * Math.max(0.002, Math.abs(d))), guided = wait && !held && velocity * d > 0 && Math.abs(d) < COAST[L] && (command === 0 ? need >= brake * 0.25 : L >= 3 && need >= brake * 0.8);
    if (guided) { var sign = velocity > 0 ? 1 : -1; velocity = sign * Math.max(0, Math.abs(velocity) - Math.min(need, brake * 3) * dt); }
    else velocity += clamp(desired - velocity,-rate * dt,rate * dt);
    if (Math.abs(velocity) < 0.00001) velocity = 0; position += (old + velocity) * dt / 2;
    if (guided && ((STOPS[stage] - position) * d <= 0 || Math.abs(STOPS[stage] - position) < 0.003 && Math.abs(velocity) < 0.03)) { position = STOPS[stage]; velocity = 0; }
    if (position < 0) { position = 0; velocity = 0; } else if (position > STOPS[4] + 0.8) { position = STOPS[4] + 0.8; velocity = 0; }
    if (wait) { if (position > STOPS[stage] + 0.55) { position = STOPS[stage] + 0.55; velocity = Math.min(0, velocity); } if (position < Math.max(0, STOPS[stage] - 0.9)) { position = Math.max(0, STOPS[stage] - 0.9); velocity = Math.max(0, velocity); } }
    updateGeometry();
    if (wait) trackMisses(command);
    hud();
  }
  // A stopping try ends one of three ways: driving out past the friend (a
  // miss), coming to rest just short of them (a miss), or resting by them.
  function trackMisses(command) {
    var d = STOPS[stage] - position, inside = Math.abs(d) <= berth(), moving = Math.abs(velocity) > 0.004;
    if (attemptOpen && wasInside && !inside && moving && velocity * d < 0) miss(d < 0 ? "past" : "short");
    else if (attemptOpen && wasMoving && !moving && command === 0) { if (inside) attemptOpen = false; else if (Math.abs(d) < 0.35) miss(d < 0 ? "past" : "short"); }
    wasInside = Math.abs(STOPS[stage] - position) <= berth(); wasMoving = moving;
  }
  function frame(now) {
    var dt = last ? Math.min(0.045,(now-last)/1000) : 0; last = now;
    if (!paused && !away && !document.hidden) {
      clock += dt;
      // the word for the next trip waits for the celebration
      if (doneAt && clock >= doneAt) { doneAt = 0; if (api) api.done(); }
    }
    // tick() publishes only while driving: keep the test snapshot current
    // through the celebration and the word turns too
    tick(dt); if (!canPlay()) snapshot(); draw(); raf = requestAnimationFrame(frame);
  }
  function earnPower() { active = true; paused = false; power = POWER; powerArmed = false; last = 0; hud(); }
  function pause() { paused = true; last = 0; stopInputs(); cancelPassenger(); hud(); }
  function newTrip() { stageMisses = 0; tryTime = 0; attemptOpen = false; wasInside = false; wasMoving = false; saidMiss = {}; lastMiss = ""; doneAt = 0; }
  function reset() { stopInputs(); cancelPassenger(); newTrip(); active = false; paused = false; won = false; stage = 0; boarded = 0; power = 0; powerArmed = false; position = 0.25; velocity = 0; misses = 0; last = 0; updateGeometry(); banner("Ready for five friendly stops?"); hud(); draw(); }
  window.Train = {
    init:function (a,n) { api = a; stages = n || 5; cv = $("trainCanvas"); ctx = cv.getContext("2d"); loadArt(); controls(); fit(); reset(); raf = requestAnimationFrame(frame); },
    onWord:function (index) { stopInputs(); cancelPassenger(); stage = index; newTrip(); updateGeometry(); earnPower(); banner("Hold Forward. Let go by our friend"); hud(); api.instruct(STEP_LINES[stage]); }, onHelp:earnPower, pause:pause, resume:function (playing) { paused = playing === false; last = 0; hud(); }, reset:reset,
    finale:function () { stopInputs(); cancelPassenger(); doneAt = 0; active = false; power = 0; won = true; velocity = 0; banner("Five friends, all aboard!"); hud(); draw(); },
    // ages 2 to 4 get the gentler ladder (the page asks Sona.playStyle)
    setLittle:function (on) { little = !!on; if (cv) hud(); }
  };
})();
