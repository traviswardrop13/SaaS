/* Day 4: water has to cross the troughs the child placed. SayPlay owns the
   microphone, targets and repetitions; this file owns finger play only. */
(function () {
  "use strict";
  var api, cv, ctx, layer, bannerEl, helpEl, root, controls = [], listeners = [];
  var W = 390, H = 600, dpr = 1, board = { top: 12, height: 450 }, toolbarY = 550, trayY = 495;
  var raf = 0, last = 0, clock = 0, initialized = false, destroyed = false;
  var active = false, paused = false, away = false, won = false, stage = -1, count = 5, younger = true;
  var goals = [], current = null, pieces = [], drops = [], ripples = [], fills = {}, finished = [], fixedRoutes = {};
  var power = 0, gateOpen = false, gateUsed = false, shareOpen = false, shareUsed = false;
  var selected = 0, drag = null, doneAt = 0, emission = 0, spillCounted = false, wheelAngle = 0;
  var misses = 0, allMisses = 0, delivered = 0, placedCount = 0, gateTurns = 0, shareTurns = 0, serial = 0;
  var said = {}, art, wood, reduceMotion = false, turnLeft, turnRight, gateButton, shareButton, gateLabel, shareLabel, selectedLabel, statusEl;
  var POWER_SECONDS = 12, DROP_VALUE = 0.055, TAU = Math.PI * 2;
  var TARGETS = {
    wheel: { x: 0.83, y: 0.25, r: 0.07, name: "waterwheel", kind: "wheel" },
    cistern: { x: 0.17, y: 0.22, r: 0.07, name: "lifted water tank", kind: "tank" },
    herbs: { x: 0.20, y: 0.64, r: 0.07, name: "herb bed", kind: "bed", color: "#b3c77b" },
    seedlings: { x: 0.40, y: 0.70, r: 0.065, name: "seedling bed", kind: "bed", color: "#e7c56c" },
    flowers: { x: 0.60, y: 0.65, r: 0.07, name: "flower bed", kind: "bed", color: "#d78fa0" },
    berries: { x: 0.79, y: 0.61, r: 0.065, name: "berry bed", kind: "bed", color: "#b998bf" },
    finalbed: { x: 0.29, y: 0.78, r: 0.085, name: "last flower bed", kind: "bed", color: "#e3b47a" },
    pond: { x: 0.83, y: 0.80, r: 0.105, name: "wildlife pond", kind: "pond" }
  };
  function $(id) { return document.getElementById(id); }
  function clamp(n, low, high) { return Math.max(low, Math.min(high, n)); }
  function distance(a, b) { var x = a.x - b.x, y = a.y - b.y; return Math.sqrt(x * x + y * y); }
  function normAngle(n) { while (n > Math.PI) n -= TAU; while (n < -Math.PI) n += TAU; return n; }
  function point(x, y) { return { x: x * W, y: board.top + y * board.height }; }
  function normal(p) { return { x: p.x / W, y: p.y / H }; }
  function canPlay() { return active && !paused && !away && !won && !document.hidden && !destroyed; }
  function assistance() { return younger ? (misses >= 2 ? 2 : misses >= 1 ? 1 : 0) : (misses >= 3 ? 2 : misses >= 2 ? 1 : 0); }
  function catchRadius() { return Math.max(12, Math.min(21, W * 0.045)) * (power > 0 ? 2.1 : 1) * (misses > 0 ? 1.18 : 1); }
  function angleTolerance() { return (younger ? 22 : 16) * Math.PI / 180 + (misses > 0 ? 9 * Math.PI / 180 : 0); }
  function say(key, text) { if (said[key] || !api || !api.instruct) return; said[key] = true; try { api.instruct(text); } catch (e) {} }
  function sfx(name) { if (api && api.sfx) { try { api.sfx(name); } catch (e) {} } }
  function banner(text) { if (bannerEl) bannerEl.textContent = text; if (statusEl) statusEl.textContent = text; }
  function on(el, name, fn, opts) { el.addEventListener(name, fn, opts || false); listeners.push([el, name, fn, opts || false]); }
  function makeButton(text, label, className) {
    var b = document.createElement("button"); b.type = "button"; b.className = className || "waterwheel-tool"; b.textContent = text; b.setAttribute("aria-label", label); root.appendChild(b); controls.push(b); return b;
  }
  function activeTargets() { return younger ? ["herbs", "flowers", "finalbed", "pond"] : ["herbs", "seedlings", "flowers", "berries", "finalbed", "pond"]; }
  function makeGoals() {
    var keys = younger ? ["wheel", "herbs", "flowers", "finalbed", "pond"] : ["wheel", "cistern", "herbs", "seedlings", "flowers", "berries", "finalbed", "pond"];
    goals = keys.map(function (key, i) { return { key: key, act: key === "wheel" ? 1 : (key === "finalbed" || key === "pond") ? 3 : 2, index: i }; });
  }
  function sourceFor(key) {
    if (key === "wheel") return { x: 0.13, y: 0.10 };
    if (key === "cistern") return { x: 0.80, y: 0.14 };
    return { x: 0.18, y: 0.24 };
  }
  function nodesFor(key) {
    var src = sourceFor(key), end = TARGETS[key], mid;
    if (key === "wheel") return younger ? [src, { x: 0.48, y: 0.17 }, end] : [src, { x: 0.36, y: 0.14 }, { x: 0.61, y: 0.20 }, end];
    if (key === "cistern") return [src, { x: 0.60, y: 0.16 }, { x: 0.38, y: 0.19 }, end];
    if (key === "finalbed") return younger ? [src, { x: 0.54, y: 0.47 }, end] : [src, { x: 0.36, y: 0.34 }, { x: 0.54, y: 0.47 }, end];
    mid = end.x < 0.45 ? 0.70 : 0.43;
    return younger ? [src, { x: mid, y: 0.43 }, end] : [src, { x: 0.45, y: 0.34 }, { x: mid, y: 0.48 }, end];
  }
  function spec(a, b) {
    var p = point(a.x, a.y), q = point(b.x, b.y);
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, angle: Math.atan2(q.y - p.y, q.x - p.x), length: distance(p, q) };
  }
  function makePiece(a, b, index, branch) {
    var p = { id: branch ? "pond-branch" : "trough-" + (index + 1), index: index, a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, placed: false, moved: false, tray: true, turns: 0, branch: !!branch, button: null };
    p.target = spec(p.a, p.b); p.x = W * ((index + 1) / ((younger ? 2 : 3) + 1)); p.y = trayY;
    p.angle = p.target.angle + ((!younger || stage > 1) ? (index % 2 ? -Math.PI / 4 : Math.PI / 4) : 0);
    p.length = p.target.length; return p;
  }
  function addPieceControl(p) {
    var b = makeButton("", "Wooden trough " + (p.index + 1) + ". Drag it to its matching outline. Press Enter to pick up, arrows to move, R to turn, Enter to put down, Escape to cancel.", "waterwheel-piece");
    p.button = b; b.setAttribute("data-trough", p.id); b.setAttribute("aria-pressed", "false");
    on(b, "pointerdown", function (e) { down(e, p); }); on(b, "pointermove", move); on(b, "pointerup", up); on(b, "pointercancel", cancelPointer); on(b, "lostpointercapture", cancelPointer);
    on(b, "keydown", function (e) { keyboard(e, p); });
    on(b, "click", function () { if (canPlay()) { selected = pieces.indexOf(p); hud(); } });
  }
  function removePieceControls() {
    pieces.forEach(function (p) { if (p.button && p.button.parentNode) p.button.parentNode.removeChild(p.button); });
  }
  function buildGoal(index) {
    cancelDrag(); stage = index; current = goals[index]; if (!current) return;
    var key = current.key, i, nodes;
    if (key === "pond" && pieces.length && pieces[0].finalRoute) {
      // The shared trunk and the successful bed branch stay exactly where
      // the child left them. Only a new pond branch needs to be added.
      var joint = { x: 0.54, y: 0.47 }, branch = makePiece(joint, TARGETS.pond, pieces.length, true);
      branch.x = W * 0.52; branch.y = trayY; pieces.push(branch); addPieceControl(branch); selected = pieces.length - 1;
    } else {
      removePieceControls(); pieces = []; nodes = nodesFor(key); selected = 0;
      for (i = 0; i < nodes.length - 1; i++) { var p = makePiece(nodes[i], nodes[i + 1], i, false); p.finalRoute = key === "finalbed"; pieces.push(p); addPieceControl(p); }
    }
    active = true; paused = false; won = false; gateOpen = false; gateUsed = false; shareOpen = false; shareUsed = false;
    misses = 0; power = POWER_SECONDS; emission = 0; spillCounted = false; doneAt = 0; drops = []; ripples = []; said = {}; last = 0;
    var text = key === "pond" ? "Add the pond trough. Open the water and share it." : key === "wheel" ? "Join the spring to the wheel, then open the water." : key === "cistern" ? "Catch the lifted water in the little tank." : key === "finalbed" ? "Build a route to the last bed. Keep the fork for the pond." : "Move the troughs to the outlines, then open the water.";
    banner(text);
    var spoken = key === "wheel" ? "Match the trough outlines. Curved arrows turn them. Tap the water drop to open the gate." : key === "pond" ? "Add the pond trough. Tap the water drop, then the split stream." : text;
    say("start", spoken); hud(); draw();
  }
  function endpoints(p) {
    return { start: { x: p.x - Math.cos(p.angle) * p.length / 2, y: p.y - Math.sin(p.angle) * p.length / 2 }, end: { x: p.x + Math.cos(p.angle) * p.length / 2, y: p.y + Math.sin(p.angle) * p.length / 2 } };
  }
  function routePieces(targetKey) {
    if (current && current.key === "pond") return targetKey === "pond" ? pieces.slice(0, pieces.length - 2).concat([pieces[pieces.length - 1]]) : pieces.slice(0, pieces.length - 1);
    return pieces;
  }
  function flowRoute(targetKey) {
    var key = current.key === "pond" ? "finalbed" : current.key, src = sourceFor(key), here = point(src.x, src.y), points = [here], valid = true;
    var route = routePieces(targetKey), radius = catchRadius();
    for (var i = 0; i < route.length; i++) {
      var p = route[i], ends = endpoints(p);
      if (!p.placed || distance(here, ends.start) > radius) { valid = false; break; }
      points.push(ends.start, ends.end); here = ends.end;
    }
    var t = TARGETS[targetKey], end = point(t.x, t.y);
    if (valid && distance(here, end) <= Math.max(radius, t.r * W * 0.6)) points.push(end);
    else valid = false;
    return { points: points, target: valid ? targetKey : null, connected: valid, failure: normal(here) };
  }
  function clearFlow() { drops = []; emission = 0; serial++; }
  function recordMiss() {
    var prev = assistance(); misses++; allMisses++;
    if (assistance() > prev) {
      if (assistance() === 2) { banner("Move each trough once more. The leaves will guide it into place."); say("forgive", "Move each trough once more. The leaves will guide it into place."); }
      else { banner("Match the glowing outlines. Turn the trough with the curved arrows."); say("guide", "Match the glowing outlines. Turn the trough with the curved arrows."); }
    } else banner("A little closer to the outline. Turn it to join the water.");
  }
  function positionAccepted(p, broad) {
    var close = distance(p, p.target) <= Math.max(40, W * 0.105) * (assistance() ? 1.3 : 1);
    return broad || (close && Math.abs(normAngle(p.angle - p.target.angle)) <= angleTolerance());
  }
  function commitPiece(p) {
    var broad = assistance() >= 2 && p.moved;
    if (!p.moved || !positionAccepted(p, broad)) { p.placed = false; p.tray = false; recordMiss(); return false; }
    var already = p.placed;
    // Speech widens the leaves at joins; it never moves a trough. The final
    // forgiveness needs a fresh, real drag and then guides that one piece.
    if (broad || distance(p, p.target) < 9) { p.x = p.target.x; p.y = p.target.y; }
    if (broad || Math.abs(normAngle(p.angle - p.target.angle)) < Math.PI / 40) p.angle = p.target.angle;
    p.placed = true; p.tray = false;
    if (!already) { placedCount++; sfx("tap"); }
    banner("Trough joined. Open the water when the route is ready."); return true;
  }
  function eventPoint(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
  function beginDrag(p, pointer, surface, at) {
    selected = pieces.indexOf(p); drag = { piece: p, id: pointer, surface: surface, start: at, offset: { x: at.x - p.x, y: at.y - p.y }, origin: { x: p.x, y: p.y, angle: p.angle, placed: p.placed, tray: p.tray, moved: p.moved }, distance: 0, keyboard: pointer === "keyboard" };
    p.placed = false; clearFlow(); hud();
  }
  function down(e, p) {
    if (!canPlay() || drag || (e.button != null && e.button !== 0)) return;
    e.preventDefault(); var at = eventPoint(e); beginDrag(p, e.pointerId, e.currentTarget, at);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} draw();
  }
  function move(e) {
    if (!drag || drag.keyboard || e.pointerId !== drag.id || !canPlay()) return;
    e.preventDefault(); var at = eventPoint(e), p = drag.piece; drag.distance = Math.max(drag.distance, distance(at, drag.start));
    p.x = clamp(at.x - drag.offset.x, 20, W - 20); p.y = clamp(at.y - drag.offset.y, board.top + 6, trayY + 18); clearFlow(); hud(); draw();
  }
  function releaseCapture(d) { try { if (d && !d.keyboard && d.surface.hasPointerCapture(d.id)) d.surface.releasePointerCapture(d.id); } catch (e) {} }
  function cancelDrag() {
    if (!drag) return; var d = drag, p = d.piece; drag = null; p.x = d.origin.x; p.y = d.origin.y; p.angle = d.origin.angle; p.placed = d.origin.placed; p.tray = d.origin.tray; p.moved = d.origin.moved; releaseCapture(d); clearFlow();
  }
  function cancelPointer(e) { if (drag && !drag.keyboard && e.pointerId === drag.id) { cancelDrag(); hud(); draw(); } }
  function putDown() {
    if (!drag) return; var d = drag, p = d.piece; drag = null; releaseCapture(d);
    if (d.distance < 7) { p.x = d.origin.x; p.y = d.origin.y; p.angle = d.origin.angle; p.placed = d.origin.placed; p.tray = d.origin.tray; p.moved = d.origin.moved; }
    else { p.moved = true; commitPiece(p); }
    clearFlow(); hud(); draw();
  }
  function up(e) { if (!drag || drag.keyboard || e.pointerId !== drag.id) return; e.preventDefault(); if (canPlay()) putDown(); else { cancelDrag(); hud(); } }
  function rotate(direction, p) {
    p = p || pieces[selected]; if (!canPlay() || !p || (drag && !drag.keyboard)) return;
    p.angle = normAngle(p.angle + direction * Math.PI / 8); p.turns++; p.tray = false; clearFlow();
    if (!drag && p.moved) {
      // Turning is a manual action too, but broad forgiveness still needs a
      // drag; a tap on a turn button cannot place a piece from the tray.
      var wasPlaced = p.placed; p.placed = positionAccepted(p, false); if (p.placed && !wasPlaced) placedCount++;
      if (p.placed && Math.abs(normAngle(p.angle - p.target.angle)) < Math.PI / 40) p.angle = p.target.angle;
    }
    banner("Turn the trough to match its outline."); sfx("tap"); hud(); draw();
  }
  function keyboard(e, p) {
    if (!canPlay()) return; var key = e.key;
    if (key === "Escape") { if (drag) { e.preventDefault(); cancelDrag(); hud(); draw(); } return; }
    if (key === "r" || key === "R") { e.preventDefault(); selected = pieces.indexOf(p); rotate(e.shiftKey ? -1 : 1, p); return; }
    if (key === "Enter" || key === " ") {
      e.preventDefault(); if (e.repeat) return;
      if (drag && drag.keyboard && drag.piece === p) putDown();
      else if (!drag) { beginDrag(p, "keyboard", p.button, { x: p.x, y: p.y }); banner("Use the arrows to move. R turns. Enter puts it down."); }
      return;
    }
    if (!drag || !drag.keyboard || drag.piece !== p) return;
    var step = e.shiftKey ? 2 : 10;
    if (key === "ArrowLeft") p.x -= step; else if (key === "ArrowRight") p.x += step; else if (key === "ArrowUp") p.y -= step; else if (key === "ArrowDown") p.y += step; else return;
    e.preventDefault(); p.x = clamp(p.x, 20, W - 20); p.y = clamp(p.y, board.top + 6, trayY + 18); drag.distance += step; clearFlow(); hud(); draw();
  }
  function toggleGate() {
    if (!canPlay() || drag) return; gateOpen = !gateOpen; gateTurns++;
    if (gateOpen) { gateUsed = true; spillCounted = false; emission = 0.12; banner("Follow the water. Close the gate to change your route."); }
    else { banner("Water stopped. Move or turn a trough to close the gaps."); }
    sfx("tap"); hud(); draw();
  }
  function toggleShare() {
    if (!canPlay() || drag || !current || current.key !== "pond") return;
    shareOpen = !shareOpen; shareUsed = shareUsed || shareOpen; shareTurns++; clearFlow(); sfx("tap");
    banner(shareOpen ? "Two streams! Keep the bed and pond connected." : "Turn the fork to share with the pond."); hud(); draw();
  }
  function help() { if (canPlay() && !drag && api && api.practice) api.practice(); }
  function layout() {
    if (!cv || !ctx) return; cancelDrag(); var oldW = W, oldBoard = { top: board.top, height: board.height }, oldTray = trayY;
    var r = cv.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var top = 12, bottom = H - 8;
    if (bannerEl) {
      var br = bannerEl.getBoundingClientRect();
      // Reserve the direction card's wrapped height once. A new sentence
      // must not push the route around under a child's dragging finger.
      if (br.bottom > r.top && br.top < r.bottom && br.top < r.top + H * 0.45) top = Math.max(top, Math.max(br.bottom - r.top, br.top - r.top + (W > H && H < 500 ? 45 : 78)) + 10);
    }
    if (helpEl) { var hr = helpEl.getBoundingClientRect(); if (hr.top > r.top + H * 0.6 && hr.top < r.bottom) bottom = Math.min(bottom, hr.top - r.top - 8); }
    toolbarY = bottom - 46; trayY = toolbarY - 39; board = { top: top, height: Math.max(90, trayY - top - 32) };
    root.style.height = H + "px";
    var bar = root.querySelector(".waterwheel-toolbar"); if (bar) bar.style.top = toolbarY + "px";
    selectedLabel.style.top = (toolbarY - 22) + "px";
    pieces.forEach(function (p) {
      var nx = p.x / oldW, ny = oldBoard.height ? (p.y - oldBoard.top) / oldBoard.height : 0.5;
      p.target = spec(p.a, p.b); p.length = p.target.length;
      if (p.tray) { p.x = W * nx; p.y = trayY; } else { p.x = clamp(W * nx, 20, W - 20); p.y = board.top + ny * board.height; }
      // Preserve the child's turn relative to the trough's new slope when
      // a phone turns. A resize is never another placement or a free repair.
      var oldA = { x: p.a.x * oldW, y: oldBoard.top + p.a.y * oldBoard.height }, oldB = { x: p.b.x * oldW, y: oldBoard.top + p.b.y * oldBoard.height };
      p.angle = p.target.angle + normAngle(p.angle - Math.atan2(oldB.y - oldA.y, oldB.x - oldA.x));
    });
    if (oldTray !== trayY) clearFlow(); hud(); draw(); publish();
  }
  function setupControls() {
    root = document.createElement("div"); root.className = "waterwheel-controls"; root.setAttribute("data-daily-game", "waterwheel"); layer.appendChild(root);
    var bar = document.createElement("div"); bar.className = "waterwheel-toolbar"; root.appendChild(bar);
    turnLeft = makeButton("\u21b6", "Turn selected trough left", "waterwheel-tool waterwheel-turn"); turnRight = makeButton("\u21b7", "Turn selected trough right", "waterwheel-tool waterwheel-turn");
    gateButton = makeButton("Open water", "Open the spring gate", "waterwheel-tool waterwheel-gate"); shareButton = makeButton("Share pond", "Open the fork gate to share water with the pond", "waterwheel-tool waterwheel-share");
    gateButton.innerHTML = '<svg class="waterwheel-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C10 7 5 11 5 16a7 7 0 0 0 14 0c0-5-5-9-7-14Z" fill="currentColor"/><path d="M8 16a4 4 0 0 0 4 4" fill="none" stroke="#fff6df" stroke-width="1.5" stroke-linecap="round"/></svg><span>Open water</span>';
    shareButton.innerHTML = '<svg class="waterwheel-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8M12 11l-7 9M12 11l7 9" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="12" cy="3" r="2.5" fill="currentColor"/><circle cx="5" cy="20" r="2.5" fill="currentColor"/><circle cx="19" cy="20" r="2.5" fill="currentColor"/></svg><span>Share pond</span>';
    gateLabel = gateButton.querySelector("span"); shareLabel = shareButton.querySelector("span");
    [turnLeft, turnRight, gateButton, shareButton].forEach(function (b) { bar.appendChild(b); });
    selectedLabel = document.createElement("div"); selectedLabel.className = "waterwheel-selected"; root.appendChild(selectedLabel);
    statusEl = document.createElement("div"); statusEl.className = "waterwheel-sr"; statusEl.setAttribute("role", "status"); statusEl.setAttribute("aria-live", "polite"); root.appendChild(statusEl);
    on(turnLeft, "click", function () { rotate(-1); }); on(turnRight, "click", function () { rotate(1); }); on(gateButton, "click", toggleGate); on(shareButton, "click", toggleShare);
    if (helpEl) on(helpEl, "click", help);
    on(window, "resize", layout); on(window, "blur", function () { if (drag) { cancelDrag(); hud(); draw(); } });
    on(window, "pagehide", function () { away = true; pause(); if (raf) cancelAnimationFrame(raf); raf = 0; });
    on(window, "pageshow", function () { away = false; last = 0; if (!raf && !destroyed) raf = requestAnimationFrame(frame); hud(); });
    on(document, "visibilitychange", function () { if (document.hidden) pause(); });
  }
  function rect(el) { if (!el) return null; var r = el.getBoundingClientRect(), c = cv.getBoundingClientRect(); return { x: (r.left + r.width / 2 - c.left) / W, y: (r.top + r.height / 2 - c.top) / H, width: r.width / W, height: r.height / H }; }
  function hud() {
    if (!root) return; var allowed = canPlay(), p = pieces[selected];
    pieces.forEach(function (piece, i) {
      var b = piece.button, visual = Math.max(44, Math.min(piece.length, 88)); if (!b) return;
      b.hidden = !active && !doneAt; b.disabled = !allowed; b.style.left = piece.x + "px"; b.style.top = piece.y + "px"; b.style.width = visual + "px"; b.style.height = "48px";
      b.style.transform = "translate(-50%,-50%) rotate(" + piece.angle + "rad)"; b.setAttribute("aria-pressed", drag && drag.piece === piece ? "true" : "false"); b.classList.toggle("selected", i === selected); b.classList.toggle("joined", piece.placed);
      b.setAttribute("aria-label", (piece.branch ? "Pond branch" : "Trough " + (i + 1)) + (piece.placed ? ", on the water route" : ", move to its matching outline") + ". Enter picks up, arrows move, R turns, Enter puts down, Escape cancels.");
    });
    turnLeft.disabled = !allowed || !p || !!(drag && !drag.keyboard); turnRight.disabled = turnLeft.disabled;
    gateButton.disabled = !allowed || !!drag; gateLabel.textContent = gateOpen ? "Close water" : "Open water"; gateButton.setAttribute("aria-pressed", gateOpen ? "true" : "false"); gateButton.setAttribute("aria-label", gateOpen ? "Close the water gate" : "Open the water gate");
    shareButton.hidden = !current || current.key !== "pond"; shareButton.disabled = !allowed || !!drag; shareLabel.textContent = shareOpen ? "Pond open" : "Share pond"; shareButton.setAttribute("aria-pressed", shareOpen ? "true" : "false"); shareButton.setAttribute("aria-label", shareOpen ? "Close the pond branch gate" : "Share water with the pond");
    selectedLabel.textContent = p && active ? (p.branch ? "Pond branch" : "Trough " + (selected + 1)) + (drag && drag.keyboard ? " · arrows move · R turns · Enter places" : " · drag to its outline · arrows turn") : "";
    root.classList.toggle("has-share", !!current && current.key === "pond"); root.classList.toggle("is-powered", power > 0); root.classList.toggle("is-active", active); root.classList.toggle("is-dragging", !!drag);
    if (helpEl) { helpEl.disabled = !allowed || !!drag; var helpText = helpEl.querySelector("span"); if (helpText) helpText.textContent = "Wider leaves"; else helpEl.textContent = "Wider leaves"; helpEl.classList.toggle("powered", power > 0); }
    publish();
  }
  function publish() {
    var targetStates = {}, routes = {}, sockets = [];
    Object.keys(TARGETS).forEach(function (key) { var t = TARGETS[key], p = point(t.x, t.y); targetStates[key] = { x: p.x / W, y: p.y / H, r: t.r, fill: fills[key] || 0, name: t.name, complete: (fills[key] || 0) >= 1 }; });
    if (current) { var keys = current.key === "pond" ? ["finalbed", "pond"] : [current.key]; keys.forEach(function (key) { routes[key] = flowRoute(key); }); }
    window.__dailyWaterwheel = {
      active: active, paused: paused, away: away, won: won, stage: stage, stages: count, goal: current ? current.key : null, act: current ? current.act : 1,
      power: power, powerDuration: POWER_SECONDS, catchRadius: catchRadius() / W, misses: misses, allMisses: allMisses, assistance: assistance(),
      gateOpen: gateOpen, gateUsed: gateUsed, shareOpen: shareOpen, shareUsed: shareUsed, selected: selected, dragging: !!drag, pointerId: drag ? drag.id : null,
      gateTurns: gateTurns, shareTurns: shareTurns, placements: placedCount, delivered: delivered, completedGoals: finished.slice(), targets: targetStates, permanentConnections: Object.keys(fixedRoutes),
      celebrating: doneAt > 0, doneIn: doneAt ? Math.max(0, doneAt - clock) : 0, wheelAngle: wheelAngle, width: W, height: H, reduceMotion: reduceMotion,
      source: current ? normal(point(sourceFor(current.key === "pond" ? "finalbed" : current.key).x, sourceFor(current.key === "pond" ? "finalbed" : current.key).y)) : null,
      pieces: pieces.map(function (p, i) {
        var ends = endpoints(p), state = { id: p.id, index: i, x: p.x / W, y: p.y / H, angle: p.angle, length: p.length / W, placed: p.placed, moved: p.moved, turns: p.turns, branch: p.branch, tray: p.tray, start: normal(ends.start), end: normal(ends.end), control: rect(p.button), target: { x: p.target.x / W, y: p.target.y / H, angle: p.target.angle, length: p.target.length / W, start: normal(point(p.a.x, p.a.y)), end: normal(point(p.b.x, p.b.y)) } };
        sockets.push(state.target); return state;
      }), sockets: sockets,
      routes: Object.keys(routes).reduce(function (out, key) { out[key] = { connected: routes[key].connected, failure: routes[key].failure, points: routes[key].points.map(normal) }; return out; }, {}),
      droplets: drops.map(function (d) { return { x: d.x / W, y: d.y / H, target: d.target, spilling: d.falling }; }),
      controls: { gate: rect(gateButton), share: shareButton && !shareButton.hidden ? rect(shareButton) : null, turnLeft: rect(turnLeft), turnRight: rect(turnRight), help: rect(helpEl) },
      board: { x: 0, y: board.top / H, width: 1, height: board.height / H }, coordinates: "normalized to dailyCanvas; lengths and catchRadius use canvas width; angles in radians; read-only snapshot"
    };
  }
  function ellipse(x, y, rx, ry, color, stroke, line) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); ctx.fillStyle = color; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line || 1; ctx.stroke(); } }
  function roundRect(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function background() {
    if (art && art.complete && art.naturalWidth) { var scale = Math.max(W / art.naturalWidth, H / art.naturalHeight); ctx.drawImage(art, (W - art.naturalWidth * scale) / 2, (H - art.naturalHeight * scale) / 2, art.naturalWidth * scale, art.naturalHeight * scale); }
    else { var wash = ctx.createLinearGradient(0, 0, 0, H); wash.addColorStop(0, "#d8e5cf"); wash.addColorStop(0.55, "#c7d8ad"); wash.addColorStop(1, "#a8bb8d"); ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H); }
    // A quiet local wash keeps the live water and wood legible over painted
    // scenery. The image supplies the world, never controls or hit targets.
    ctx.fillStyle = "rgba(245,239,211,.25)"; ctx.fillRect(0, board.top, W, board.height + 30);
    ctx.fillStyle = "rgba(252,246,223,.88)"; roundRect(8, trayY - 24, W - 16, toolbarY - trayY + 73, 17); ctx.fill();
    ctx.strokeStyle = "rgba(126,99,65,.22)"; ctx.lineWidth = 1; ctx.stroke();
    if (active && power > 0) { ctx.fillStyle = "rgba(235,248,206,.95)"; roundRect(W - 103, board.top + 1, 94, 23, 11); ctx.fill(); ctx.fillStyle = "#496d44"; ctx.textAlign = "center"; ctx.font = "600 11px system-ui, sans-serif"; ctx.fillText("Wide leaf joins", W - 56, board.top + 17); }
  }
  function leaf(x, y, size, angle, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = alpha == null ? 1 : alpha;
    var grad = ctx.createLinearGradient(-size, -size * 0.5, size, size * 0.5); grad.addColorStop(0, "#aec275"); grad.addColorStop(0.5, "#739b55"); grad.addColorStop(1, "#506f40"); ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(-size, 0); ctx.quadraticCurveTo(0, -size * 0.9, size, 0); ctx.quadraticCurveTo(0, size * 0.9, -size, 0); ctx.fill(); ctx.strokeStyle = "#bdcf92"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-size * 0.8, 0); ctx.lineTo(size * 0.8, 0); ctx.stroke(); ctx.restore();
  }
  function drawSpring() {
    var p = point(0.13, 0.10), size = clamp(W * 0.055, 15, 28);
    ellipse(p.x - 6, p.y + 4, size * 1.7, size * 0.65, "#b8b4a0", "#8e937e", 2); ellipse(p.x, p.y - 2, size, size * 0.66, "#788a79", "#aeb9a0", 2); ellipse(p.x, p.y - 1, size * 0.68, size * 0.38, "#5d9fa6");
    ctx.strokeStyle = "rgba(222,244,234,.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - size * 0.5, p.y - 2); ctx.quadraticCurveTo(p.x, p.y + 3, p.x + size * 0.5, p.y - 2); ctx.stroke();
  }
  function drawWheel() {
    var p = point(TARGETS.wheel.x, TARGETS.wheel.y), r = clamp(W * 0.10, 25, 47), wet = fills.wheel || 0;
    var lift = point(0.80, 0.14); ctx.strokeStyle = "#948465"; ctx.lineWidth = 9; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(p.x - r * 0.65, p.y + r * 0.1); ctx.quadraticCurveTo(p.x - r * 1.1, p.y - r, lift.x, lift.y); ctx.stroke();
    ctx.strokeStyle = wet > 0 ? "#95ccd0" : "#c2b28e"; ctx.lineWidth = 4; ctx.stroke();
    ctx.save(); ctx.translate(p.x, p.y); ctx.strokeStyle = "#756045"; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 1.15); ctx.lineTo(0, 0); ctx.lineTo(r * 0.65, r * 1.15); ctx.stroke();
    ctx.rotate(reduceMotion ? 0 : wheelAngle); ctx.shadowColor = "rgba(56,48,31,.16)"; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
    ellipse(0, 0, r, r, "#b08a5d", "#76593a", 3); ellipse(0, 0, r * 0.80, r * 0.80, "#e2c99b", "#8e714a", 2); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    if (wood && wood.complete && wood.naturalWidth) { ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, TAU); ctx.clip(); ctx.globalAlpha = 0.35; ctx.globalCompositeOperation = "multiply"; ctx.drawImage(wood, -r, -r, r * 2, r * 2); ctx.restore(); }
    for (var i = 0; i < 10; i++) { ctx.save(); ctx.rotate(i * TAU / 10); ctx.strokeStyle = "#816342"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.87); ctx.stroke(); ctx.fillStyle = "#a07b50"; roundRect(-r * 0.23, -r * 1.03, r * 0.46, r * 0.25, 2); ctx.fill(); ctx.strokeStyle = "#e4cc9c"; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); }
    ellipse(0, 0, r * 0.18, r * 0.18, "#8a7050", "#ddc9a1", 2); ctx.restore();
    if (wet > 0) { ctx.strokeStyle = "#8bcad0"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(p.x - r * 0.65, p.y - r * 0.8); ctx.quadraticCurveTo(p.x - r * 1.4, p.y - r * 1.4, p.x - r * 1.2, p.y - r * 1.7); ctx.stroke(); }
  }
  function drawTank() {
    var p = point(TARGETS.cistern.x, TARGETS.cistern.y), w = clamp(W * 0.13, 36, 58), h = Math.min(30, board.height * 0.12), f = fills.cistern || 0;
    ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = "#b9ab86"; roundRect(-w / 2, -h * 0.8, w, h, 6); ctx.fill(); ctx.strokeStyle = "#887b5d"; ctx.lineWidth = 2; ctx.stroke();
    if (f) { ctx.fillStyle = "#8fc5c4"; roundRect(-w / 2 + 4, -h * 0.8 + h * (1 - f) * 0.7 + 3, w - 8, Math.max(3, h * 0.65 * f), 3); ctx.fill(); }
    ctx.strokeStyle = "#7d7256"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w * 0.35, h * 0.2); ctx.lineTo(-w * 0.35, h * 0.5); ctx.moveTo(w * 0.35, h * 0.2); ctx.lineTo(w * 0.35, h * 0.5); ctx.stroke(); ctx.restore();
  }
  function drawBed(key) {
    var t = TARGETS[key], p = point(t.x, t.y), f = fills[key] || 0, isCurrent = current && current.key === key, width = clamp(W * (key === "finalbed" ? 0.19 : 0.145), 38, 75), height = Math.min(19, board.height * 0.10);
    ellipse(p.x, p.y + height * 0.5, width * 0.56, height * 0.55, "rgba(67,70,39,.14)");
    ctx.fillStyle = "#a17b54"; roundRect(p.x - width / 2, p.y - height * 0.3, width, height, 5); ctx.fill(); ctx.strokeStyle = "#7f6145"; ctx.lineWidth = 2; ctx.stroke();
    ellipse(p.x, p.y - height * 0.05, width * 0.44, height * 0.30, "#776449");
    for (var i = 0; i < 3; i++) {
      var x = p.x + (i - 1) * width * 0.25, stem = Math.min(35, board.height * 0.15) * (0.48 + f * 0.52), bend = (1 - f) * 11;
      ctx.strokeStyle = f > 0.4 ? "#5c8145" : "#8c9364"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x, p.y); ctx.quadraticCurveTo(x - bend, p.y - stem, x + bend * 0.5, p.y - stem + bend); ctx.stroke();
      leaf(x - 6, p.y - stem * 0.45, 8, 0.5, 0.9); leaf(x + 5, p.y - stem * 0.7, 8, -0.6, 0.9);
      if (f > 0.20) { var bx = x + bend * 0.5, by = p.y - stem + bend, petalR = 3 + f * 3; for (var k = 0; k < 5; k++) { var a = k * TAU / 5; ellipse(bx + Math.cos(a) * petalR, by + Math.sin(a) * petalR, petalR * 0.9, petalR * 0.9, t.color); } ellipse(bx, by, 3, 3, "#edda9c"); }
    }
    if (isCurrent) receiverRing(p, width * 0.58, f);
  }
  function drawPond() {
    var t = TARGETS.pond, p = point(t.x, t.y), r = clamp(W * 0.10, 25, 48), f = fills.pond || 0;
    ellipse(p.x, p.y + 3, r * 1.2, r * 0.65, "#a19d7c", "#8f9273", 2); ellipse(p.x, p.y, r, r * 0.51, f ? "#88bab6" : "#b3a581", "#c2c4a0", 2);
    if (f) { ellipse(p.x - r * 0.15, p.y - 1, r * Math.max(0.15, f * 0.76), r * 0.28 * Math.max(0.2, f), "#a7d4c6"); leaf(p.x + r * 0.42, p.y, r * 0.22, 0.2, 1); }
    for (var i = 0; i < 7; i++) { var a = i * TAU / 7; ellipse(p.x + Math.cos(a) * r * 1.07, p.y + Math.sin(a) * r * 0.58, 5, 3, i % 2 ? "#b3b49a" : "#cac5a9"); }
    if (f >= 1) {
      // A small drawn frog is a consequence of a filled pond, never a hit target.
      var fx = p.x + r * 0.4, fy = p.y - r * 0.25; ellipse(fx, fy, 9, 6, "#7d9a62"); ellipse(fx - 5, fy - 5, 4, 4, "#a4b97c"); ellipse(fx + 5, fy - 5, 4, 4, "#a4b97c"); ellipse(fx - 5, fy - 6, 1.3, 1.6, "#3e5036"); ellipse(fx + 5, fy - 6, 1.3, 1.6, "#3e5036");
      var dx = p.x - r * 0.31, dy = p.y + r * 0.10; ellipse(dx, dy, r * 0.28, r * 0.16, "#efe4b8", "#c9bc8b", 1); ellipse(dx + r * 0.2, dy - r * 0.13, r * 0.14, r * 0.14, "#f7eac3", "#c9bc8b", 1); ellipse(dx - r * 0.02, dy - 1, r * 0.13, r * 0.07, "#ddcea2");
      ctx.fillStyle = "#c49b58"; ctx.beginPath(); ctx.moveTo(dx + r * 0.31, dy - r * 0.17); ctx.lineTo(dx + r * 0.47, dy - r * 0.09); ctx.lineTo(dx + r * 0.31, dy - r * 0.04); ctx.fill(); ellipse(dx + r * 0.23, dy - r * 0.17, 1.2, 1.2, "#4f5445");
    }
    if (current && current.key === "pond") receiverRing(p, r * 1.25, f);
  }
  function receiverRing(p, r, f) {
    ctx.save(); ctx.strokeStyle = "rgba(255,251,220,.92)"; ctx.lineWidth = 3; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.ellipse(p.x, p.y + 3, r, Math.max(8, r * 0.4), 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = "#397f80"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y - 4, r + 3, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke(); ctx.restore();
  }
  function drawSocket(p, index) {
    var t = p.target; ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.angle); ctx.strokeStyle = assistance() ? "#fff8cd" : "rgba(251,248,225,.86)"; ctx.lineWidth = assistance() ? 4 : 2.5; ctx.setLineDash([6, 5]); roundRect(-t.length / 2 + 3, -9, t.length - 6, 18, 7); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    if (!p.placed) { ctx.font = "700 11px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ellipse(t.x, t.y, 11, 11, "rgba(250,246,216,.95)", "#6f9a88", 1.5); ctx.fillStyle = "#4b796d"; ctx.fillText(p.branch ? "Y" : String(index + 1), t.x, t.y + 0.5); }
    var end = point(p.a.x, p.a.y), radius = catchRadius();
    if (power > 0 || assistance()) { leaf(end.x - radius * 0.35, end.y, radius * 0.70, -0.45, 0.88); leaf(end.x + radius * 0.35, end.y, radius * 0.70, 0.45, 0.88); ellipse(end.x, end.y + 1, radius * 0.45, 4, "rgba(125,179,151,.65)"); }
  }
  function drawTrough(p, index) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); var len = p.length, wide = clamp(W * 0.045, 14, 19), picked = drag && drag.piece === p;
    ctx.shadowColor = "rgba(54,42,23,.24)"; ctx.shadowBlur = picked ? 12 : 4; ctx.shadowOffsetY = picked ? 8 : 3;
    var grad = ctx.createLinearGradient(0, -wide / 2, 0, wide / 2); grad.addColorStop(0, "#d2ac72"); grad.addColorStop(0.34, "#b38b57"); grad.addColorStop(0.60, "#7b603f"); grad.addColorStop(1, "#bc965f"); ctx.fillStyle = grad; roundRect(-len / 2 - 3, -wide / 2 - 3, len + 6, wide + 6, 6); ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = "#755a3b"; ctx.lineWidth = 1.5; ctx.stroke();
    if (wood && wood.complete && wood.naturalWidth) { ctx.save(); roundRect(-len / 2 - 2, -wide / 2 - 2, len + 4, wide + 4, 5); ctx.clip(); ctx.globalAlpha = 0.42; ctx.globalCompositeOperation = "multiply"; ctx.drawImage(wood, -len / 2 - 2, -wide / 2 - 2, len + 4, wide + 4); ctx.restore(); }
    ctx.strokeStyle = "rgba(247,218,164,.9)"; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-len / 2 + 2, -wide / 2); ctx.lineTo(len / 2 - 2, -wide / 2); ctx.moveTo(-len / 2 + 2, wide / 2); ctx.lineTo(len / 2 - 2, wide / 2); ctx.stroke();
    ctx.strokeStyle = "rgba(70,49,29,.24)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-len / 2 + 7, 2); ctx.bezierCurveTo(-len * 0.15, -3, len * 0.1, 4, len / 2 - 6, 0); ctx.stroke();
    [-1, 1].forEach(function (side) { ctx.fillStyle = "#8a7860"; roundRect(side * len * 0.32 - 3, -wide / 2 - 4, 6, wide + 8, 2); ctx.fill(); ctx.fillStyle = "#d3c4a3"; ellipse(side * len * 0.32, -wide / 2 - 1, 1, 1, "#d3c4a3"); });
    ellipse(0, 0, 9, 9, p.branch ? "#aec494" : "#ede0b7", "#8b7952", 1); ctx.save(); ctx.rotate(-p.angle); ctx.fillStyle = "#5d6d50"; ctx.font = "700 10px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.branch ? "Y" : String(index + 1), 0, 0.5); ctx.restore();
    if (active && selected === index) { ctx.strokeStyle = "rgba(250,254,227,.9)"; ctx.lineWidth = 2; ctx.setLineDash([3, 4]); roundRect(-Math.min(len, 80) / 2, -17, Math.min(len, 80), 34, 8); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
  }
  function drawGate() {
    if (!current) return; var source = sourceFor(current.key === "pond" ? "finalbed" : current.key), p = point(source.x, source.y);
    ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = "#9d825b"; roundRect(-7, -15, 14, 28, 3); ctx.fill(); ctx.strokeStyle = "#6e634c"; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = gateOpen ? "#5e8275" : "#986c49"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-12, gateOpen ? -16 : 0); ctx.lineTo(12, gateOpen ? -16 : 0); ctx.stroke(); ellipse(0, gateOpen ? -16 : 0, 4, 4, "#d3c599", "#6a7158", 1); ctx.restore();
    if (current.key === "pond") { var fork = point(0.54, 0.47); ellipse(fork.x, fork.y, 13, 10, "#c1aa76", "#806c48", 2); ctx.strokeStyle = "#5e7a5c"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(fork.x - 6, fork.y - 4); ctx.lineTo(fork.x + (shareOpen ? 8 : -9), fork.y + 8); ctx.stroke(); }
  }
  function drawFixedWaterways() {
    Object.keys(fixedRoutes).forEach(function (key) {
      var path = fixedRoutes[key].map(function (p) { return point(p.x, p.y); }); if (path.length < 2) return;
      ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.strokeStyle = "#9f895f"; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y); path.slice(1).forEach(function (p) { ctx.lineTo(p.x, p.y); }); ctx.stroke();
      ctx.strokeStyle = "#d1b67e"; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = "#8bbec1"; ctx.lineWidth = 2.6; ctx.stroke();
      var lengths = [], length = 0; for (var i = 1; i < path.length; i++) { var segment = distance(path[i - 1], path[i]); lengths.push(segment); length += segment; }
      for (var k = 0; k < 5; k++) {
        var at = ((reduceMotion ? 0 : clock * 70) + k * length / 5) % Math.max(1, length);
        for (var n = 0; n < lengths.length; n++) { if (at <= lengths[n]) { var t = at / Math.max(0.001, lengths[n]); ellipse(path[n].x + (path[n + 1].x - path[n].x) * t, path[n].y + (path[n + 1].y - path[n].y) * t, 2.5, 1.7, "#d2ebe0"); break; } at -= lengths[n]; }
      }
      ctx.restore();
    });
  }
  function drawButterflies() {
    if ((fills.flowers || 0) < 1) return;
    for (var i = 0; i < 2; i++) {
      var p = point(0.52 + i * 0.12, 0.49 - i * 0.05), flutter = reduceMotion ? 0.7 : 0.72 + Math.sin(clock * 5 + i) * 0.18;
      ctx.save(); ctx.translate(p.x + (reduceMotion ? 0 : Math.sin(clock * 0.8 + i) * 5), p.y); ctx.rotate(i ? -0.2 : 0.25); ctx.scale(flutter, 1);
      ellipse(-4, -2, 5, 7, i ? "#d8c697" : "#c7b4c1", "#a79d87", 0.7); ellipse(4, -2, 5, 7, i ? "#e6d6ae" : "#d8c5cb", "#a79d87", 0.7); ellipse(-3, 4, 3.5, 4.2, "#e6d2b1"); ellipse(3, 4, 3.5, 4.2, "#e6d2b1"); ellipse(0, 0, 1.3, 6, "#6b6e57"); ctx.restore();
    }
  }
  function draw() {
    if (!ctx || destroyed) return; ctx.clearRect(0, 0, W, H); background(); drawFixedWaterways(); drawSpring(); drawTank(); drawWheel();
    activeTargets().forEach(function (key) { if (key === "pond") drawPond(); else drawBed(key); });
    if (current && current.key === "wheel") receiverRing(point(TARGETS.wheel.x, TARGETS.wheel.y), clamp(W * 0.12, 30, 52), fills.wheel || 0);
    if (current && current.key === "cistern") receiverRing(point(TARGETS.cistern.x, TARGETS.cistern.y), W * 0.08, fills.cistern || 0);
    if (active) pieces.forEach(drawSocket); pieces.forEach(drawTrough); drawGate(); drawButterflies();
    drops.forEach(function (d) { ctx.fillStyle = d.falling ? "#91c2c2" : "#80c4cb"; ctx.strokeStyle = "rgba(239,253,246,.85)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(d.x, d.y, 3, 2.6, 0, 0, TAU); ctx.fill(); ctx.stroke(); });
    ripples.forEach(function (r) { ctx.globalAlpha = Math.max(0, 1 - r.age / 0.5); ctx.strokeStyle = "#d0eee0"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(r.x, r.y, 3 + r.age * 25, 2 + r.age * 8, 0, 0, TAU); ctx.stroke(); }); ctx.globalAlpha = 1;
  }
  function emitDrop() {
    var targetKey = current.key === "pond" ? (shareOpen && serial++ % 2 ? "pond" : "finalbed") : current.key, route = flowRoute(targetKey), first = route.points[0];
    drops.push({ points: route.points, segment: 0, offset: 0, x: first.x, y: first.y, target: route.target, falling: false, vy: 0, age: 0, serial: serial });
  }
  function reached(d) {
    if (d.target) {
      fills[d.target] = Math.min(1, (fills[d.target] || 0) + DROP_VALUE); delivered++; ripples.push({ x: d.x, y: d.y, age: 0 });
      if (d.target === "wheel") wheelAngle += 0.11;
      if (goalReady()) { completeGoal(); return true; }
      return true;
    }
    d.falling = true;
    if (!spillCounted) { spillCounted = true; recordMiss(); say("spill", "Follow the water to the gap. Move or turn that trough, then try the gate again."); }
    return false;
  }
  function goalReady() {
    if (!current || !gateUsed || !pieces.every(function (p) { return p.placed && p.moved; })) return false;
    if (current.key === "pond" && (!shareOpen || !shareUsed)) return false;
    return (fills[current.key] || 0) >= 1;
  }
  function completeGoal() {
    if (!canPlay() || doneAt) return;
    if (current.key === "wheel" || current.key === "cistern") fixedRoutes[current.key] = flowRoute(current.key).points.map(function (p) { return { x: p.x / W, y: (p.y - board.top) / board.height }; });
    active = false; gateOpen = false; drops = []; power = 0; cancelDrag(); finished.push(current.key);
    if (current.key === "wheel" && younger) { fills.cistern = 1; fixedRoutes.cistern = nodesFor("cistern").map(function (p) { return { x: p.x, y: p.y }; }); }
    var text = current.key === "wheel" ? "The wheel is turning!" : current.key === "cistern" ? "The lifted water is ready for the beds." : current.key === "pond" ? "Water for the flowers and a home for the pond friends!" : "A drink for the " + TARGETS[current.key].name + "!";
    banner(text); sfx("correct"); if (api && api.cheer) { try { api.cheer(current.key === "pond" ? "The garden is alive!" : "Water arrived!"); } catch (e) {} }
    doneAt = clock + 1.05; hud(); draw();
  }
  function tick(dt) {
    if (paused || away || destroyed || document.hidden) return; clock += dt;
    ripples.forEach(function (r) { r.age += dt; }); ripples = ripples.filter(function (r) { return r.age < 0.5; });
    if ((fills.wheel || 0) > 0 && !reduceMotion) wheelAngle += dt * ((active && gateOpen) || won ? 0.45 : 0.12);
    if (doneAt) { if (clock >= doneAt) { doneAt = 0; hud(); if (api && api.done) api.done(); } else publish(); return; }
    if (!canPlay()) { publish(); return; }
    power = Math.max(0, power - dt);
    if (gateOpen && !drag) { emission += dt; while (emission >= 0.11) { emission -= 0.11; emitDrop(); } }
    for (var i = drops.length - 1; i >= 0; i--) {
      var d = drops[i]; d.age += dt;
      if (d.falling) { d.vy += dt * 360; d.y += d.vy * dt; d.x += dt * 8; if (d.y > board.top + board.height + 22 || d.age > 5) drops.splice(i, 1); continue; }
      var budget = dt * (reduceMotion ? 250 : 190), remove = false;
      while (budget > 0 && !d.falling) {
        var next = d.points[d.segment + 1];
        if (!next) { remove = reached(d); break; }
        var from = d.points[d.segment], length = distance(from, next), remaining = length - d.offset;
        if (budget >= remaining) { budget -= remaining; d.segment++; d.offset = 0; d.x = next.x; d.y = next.y; }
        else { d.offset += budget; var ratio = d.offset / Math.max(0.001, length); d.x = from.x + (next.x - from.x) * ratio; d.y = from.y + (next.y - from.y) * ratio; budget = 0; }
      }
      if (doneAt) return; if (remove) drops.splice(i, 1);
    }
    hud();
  }
  function frame(now) { if (destroyed) return; var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; tick(dt); draw(); raf = requestAnimationFrame(frame); }
  function pause() { paused = true; last = 0; cancelDrag(); hud(); draw(); }
  function reset() {
    cancelDrag(); removePieceControls(); pieces = []; drops = []; ripples = []; fills = {}; finished = []; fixedRoutes = {}; active = false; paused = false; won = false; stage = -1; current = null;
    gateOpen = false; gateUsed = false; shareOpen = false; shareUsed = false; power = 0; doneAt = 0; clock = 0; last = 0; emission = 0; misses = 0; allMisses = 0; delivered = 0; placedCount = 0; gateTurns = 0; shareTurns = 0; wheelAngle = 0; said = {}; serial = 0;
    banner("The garden is waiting for water."); hud(); draw();
  }
  function finale() { cancelDrag(); active = false; paused = false; gateOpen = false; power = 0; doneAt = 0; won = finished.length >= count; banner(won ? "You brought the waterwheel garden back to life!" : "The garden is waiting for its next drink."); hud(); draw(); }
  function destroy() {
    if (!initialized) return; destroyed = true; cancelDrag(); if (raf) cancelAnimationFrame(raf); raf = 0;
    listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); }); listeners = [];
    if (root && root.parentNode) root.parentNode.removeChild(root); if (cv) cv.classList.remove("daily-waterwheel-canvas");
    if (bannerEl) bannerEl.classList.remove("waterwheel-banner"); if (helpEl) { helpEl.classList.remove("waterwheel-help", "powered"); helpEl.disabled = false; }
    initialized = false; active = false; drops = []; pieces = []; current = null; publish();
  }
  window.DailyAdventureGames = window.DailyAdventureGames || {};
  window.DailyAdventureGames.waterwheel = {
    init: function (a, n) {
      if (initialized) destroy(); api = a; count = n === 8 ? 8 : 5; younger = count === 5; destroyed = false; away = false; initialized = true; controls = [];
      cv = $("dailyCanvas"); layer = $("dailyControls"); bannerEl = $("dailyBanner"); helpEl = $("dailyHelp");
      if (!cv || !layer) throw new Error("Waterwheel needs dailyCanvas and dailyControls"); ctx = cv.getContext("2d");
      reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); cv.classList.add("daily-waterwheel-canvas"); if (bannerEl) bannerEl.classList.add("waterwheel-banner"); if (helpEl) helpEl.classList.add("waterwheel-help");
      art = new Image(); art.onload = function () { draw(); }; art.src = "/assets/crafted/daily/day04-waterwheel-garden-v1.webp";
      wood = new Image(); wood.onload = function () { draw(); }; wood.src = "/assets/crafted/painted-wood-ivory.webp";
      makeGoals(); setupControls(); layout(); reset(); raf = requestAnimationFrame(frame);
    },
    onWord: function (index) { if (destroyed || index < 0 || index >= count) return; if (current && stage === index && active) { paused = false; power = POWER_SECONDS; hud(); return; } buildGoal(index); },
    onHelp: function () { if (destroyed || !active || doneAt) return; paused = false; power = POWER_SECONDS; last = 0; banner("Wide leaves! Close the gaps and let the water flow."); hud(); draw(); },
    pause: pause,
    resume: function (playing) { paused = playing === false; last = 0; hud(); draw(); },
    reset: reset,
    finale: finale,
    finish: finale,
    destroy: destroy
  };
})();
