/* Day 5: a persistent harbour, real hull collisions and an articulated tow.
   SayPlay owns every speech target, microphone, saying and counted rep. */
(function () {
  "use strict";
  var api, cv, ctx, layer, root, bannerEl, helpEl, actionButton, actionIcon, actionText, iconKind = "", boatButton, statusEl, caption, buttons = {}, listeners = [], images = {};
  var W = 390, H = 750, map = { left: 8, top: 140, width: 374, height: 470 }, boatL = 33, boatW = 14, raftL = 32, raftW = 32;
  var raf = 0, last = 0, clock = 0, active = false, paused = false, away = false, destroyed = false, initialized = false, won = false, reduceMotion = false;
  var count = 5, younger = true, stage = -1, subtask = 0, waypointIndex = 0, goals = [], completed = [], power = 0, doneAt = 0;
  var boat = {}, raft = {}, cargo = [], delivered = {}, transfer = null, wakes = [], wakeClock = 0;
  var keyboardKeys = {}, arrowPointers = {}, drag = null, input = { x: 0, y: 0 }, lastManualAt = -100, manualTravel = 0, legTravel = 0;
  var stepMisses = 0, collisions = 0, raftCollisions = 0, dockRetries = 0, lastMissAt = -100, lastCollisionAt = -100, dockings = 0, loads = 0, unloads = 0, attaches = 0, checkpoints = 0, said = {};
  var baseCurrent = { x: 0, y: 0 }, current = { x: 0, y: 0 }, scene = null, cachedAction = { label: "Dock", enabled: false }, solids = [];
  var POWER = 12, TAU = Math.PI * 2;
  var STATIONS = {
    depot: { name: "Otter's jetty", resident: "otter", dock: { x: 0.40, y: 0.77, heading: Math.PI }, shore: { x: 0.29, y: 0.74 }, home: { x: 0.19, y: 0.70 } },
    mouse: { name: "Mouse's blue house", resident: "mouse", dock: { x: 0.30, y: 0.23, heading: -2.0 }, shore: { x: 0.25, y: 0.15 }, home: { x: 0.17, y: 0.10 } },
    heron: { name: "Heron's house", resident: "heron", dock: { x: 0.70, y: 0.24, heading: -0.6 }, shore: { x: 0.79, y: 0.17 }, home: { x: 0.87, y: 0.12 } },
    turtle: { name: "Turtle's reading island", resident: "turtle", dock: { x: 0.65, y: 0.43, heading: 0 }, shore: { x: 0.77, y: 0.42 }, home: { x: 0.86, y: 0.43 } },
    transfer: { name: "floating transfer jetty", resident: "otter", dock: { x: 0.49, y: 0.18, heading: -2.2 }, shore: { x: 0.445, y: 0.10 }, home: { x: 0.445, y: 0.10 } },
    beaver: { name: "Beaver's wide landing", resident: "beaver", dock: { x: 0.53, y: 0.83, heading: 0 }, shore: { x: 0.68, y: 0.85 }, home: { x: 0.83, y: 0.84 } }
  };
  // These coasts follow the painted islands. Reeds are separate, visible,
  // solid obstacles; the outside channel leaves room for the wide raft.
  var COASTS = [
    [[0,0],[0.16,0],[0.21,0.035],[0.25,0.075],[0.31,0.09],[0.34,0.12],[0.31,0.16],[0.26,0.18],[0.22,0.17],[0.16,0.185],[0.10,0.17],[0.035,0.17],[0,0.15]],
    [[1,0.018],[0.90,0.018],[0.84,0.035],[0.78,0.06],[0.73,0.08],[0.69,0.105],[0.73,0.13],[0.76,0.145],[0.79,0.17],[0.84,0.20],[0.93,0.205],[1,0.19]],
    [[1,0.315],[0.93,0.32],[0.90,0.33],[0.82,0.34],[0.76,0.36],[0.70,0.39],[0.68,0.415],[0.73,0.445],[0.79,0.46],[0.83,0.49],[0.91,0.49],[1,0.465]],
    [[0,0.62],[0.10,0.62],[0.17,0.635],[0.24,0.655],[0.31,0.68],[0.36,0.72],[0.34,0.755],[0.28,0.79],[0.19,0.815],[0.07,0.82],[0,0.80]],
    [[1,0.735],[0.91,0.735],[0.84,0.75],[0.77,0.77],[0.71,0.78],[0.67,0.82],[0.61,0.84],[0.57,0.87],[0.61,0.90],[0.71,0.935],[0.80,0.97],[0.90,0.985],[1,0.98]]
  ];
  function $(id) { return document.getElementById(id); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function distance(a, b) { var x = a.x - b.x, y = a.y - b.y; return Math.sqrt(x * x + y * y); }
  function angle(n) { while (n > Math.PI) n -= TAU; while (n < -Math.PI) n += TAU; return n; }
  function world(x, y) { return { x: map.left + x * map.width, y: map.top + y * map.height }; }
  function normal(p) { return { x: p.x / W, y: p.y / H }; }
  function mapNormal(p) { return { x: (p.x - map.left) / map.width, y: (p.y - map.top) / map.height }; }
  function speed(p) { return Math.sqrt(p.vx * p.vx + p.vy * p.vy); }
  function canPlay() { return active && !paused && !away && !won && !destroyed && !document.hidden; }
  function task() { return stage >= 0 && goals[stage] ? goals[stage][subtask] : null; }
  function assist() { return younger ? (stepMisses >= 2 ? 2 : stepMisses >= 1 ? 1 : 0) : (stepMisses >= 3 ? 2 : stepMisses >= 2 ? 1 : 0); }
  function currentScale() { return (power > 0 ? 0.18 : 1) * (assist() >= 2 ? 0 : assist() >= 1 ? 0.38 : stepMisses > 0 ? 0.70 : 1); }
  function dockRadius() { return Math.max(22, Math.min(34, map.width * (younger ? 0.09 : 0.073))) * (assist() >= 2 ? 1.75 : assist() >= 1 ? 1.4 : 1); }
  function dockAngle() { return younger || assist() >= 2 ? Math.PI : assist() >= 1 ? 1.65 : 1.1; }
  function dockSpeed() { return assist() >= 1 ? 20 : younger ? 16 : 13; }
  function maxSpeed() { return clamp(Math.min(map.width, map.height) * 0.125, 27, 40) * (raft.attached ? 0.80 : 1); }
  function tell(key, text) { if (said[key] || !api || !api.instruct) return; said[key] = true; try { api.instruct(text); } catch (e) {} }
  function sound(name) { if (api && api.sfx) { try { api.sfx(name); } catch (e) {} } }
  function banner(text) { if (bannerEl) bannerEl.textContent = text; if (statusEl) statusEl.textContent = text; }
  function on(el, name, fn, opts) { el.addEventListener(name, fn, opts || false); listeners.push([el, name, fn, opts || false]); }
  function makeGoals() {
    var channel = [{ x: 0.44, y: 0.61 }, { x: 0.435, y: 0.43 }, { x: 0.44, y: 0.26 }];
    var tow = [{ x: 0.63, y: 0.29 }, { x: 0.63, y: 0.60 }];
    goals = younger ? [
      [{ type: "load", station: "depot", items: ["mouse"] }],
      [{ type: "deliver", station: "mouse", item: "mouse" }],
      [{ type: "load", station: "depot", items: ["heron", "turtle"] }, { type: "deliver", station: "heron", item: "heron" }, { type: "deliver", station: "turtle", item: "turtle" }],
      [{ type: "attach", station: "transfer" }],
      [{ type: "towRoute", waypoints: tow }, { type: "deliverRaft", station: "beaver" }]
    ] : [
      [{ type: "load", station: "depot", items: ["mouse", "heron"] }],
      [{ type: "deliver", station: "mouse", item: "mouse" }],
      [{ type: "route", cargo: "heron", waypoints: channel }],
      [{ type: "deliver", station: "heron", item: "heron" }],
      [{ type: "load", station: "transfer", items: ["turtle"] }],
      [{ type: "deliver", station: "turtle", item: "turtle" }],
      [{ type: "attach", station: "transfer" }, { type: "towRoute", waypoints: tow }],
      [{ type: "deliverRaft", station: "beaver" }]
    ];
  }
  function taskText(t) {
    if (!t) return "Every parcel has a home.";
    if (t.type === "load") return t.station === "depot" ? "Dock at Otter's jetty and load the pictured parcels." : "Dock at the floating jetty and load Turtle's book tin.";
    if (t.type === "deliver") return "Dock beside " + (t.item === "mouse" ? "Mouse's blue house" : t.item === "heron" ? "Heron's house" : "Turtle's reading island") + ", then unload the matching parcel.";
    if (t.type === "route") return "Follow the three buoys through the narrow reed channel.";
    if (t.type === "attach") return "Dock at the floating jetty and attach the door raft.";
    if (t.type === "towRoute") return "Follow the outside buoys. Leave room for the raft to turn.";
    return "Bring the boat and raft beside Beaver's landing, then unload the door.";
  }
  function instructTask() {
    var t = task(); banner(taskText(t));
    var text = t && t.type === "route" ? "Follow three buoys through the reeds. Stop beside the last buoy, then check the channel." :
      t && t.type === "towRoute" ? "Take the wide channel. The raft follows. Pass the buoys, stop, then steady the tow." :
      t && t.type === "attach" ? "Stop by the floating jetty. Tap the rope loop, then the linked ropes to attach." :
      t && t.type === "deliverRaft" ? "Approach Beaver from the left. Follow the arrow. Stop, dock with the rope loop, then unload." :
      t && t.type === "load" ? (stage === 0 ? "Hold arrows or drag. Stop by the dock. Tap the rope loop, then the parcel." : "Stop by the jetty. Tap the rope loop to dock, then each parcel to load.") :
      "Follow the parcel picture. Follow the dock arrow. Stop, tap the rope loop, then unload.";
    tell("task-" + subtask, text);
  }
  function stationPoint(key) { var d = STATIONS[key].dock; return world(d.x, d.y); }
  function canDock(key) {
    if (!key || !STATIONS[key] || !canPlay() || transfer || raft.unloaded) return false;
    var d = STATIONS[key].dock;
    return distance(boat, stationPoint(key)) <= dockRadius() && speed(boat) <= dockSpeed() && Math.abs(angle(boat.heading - d.heading)) <= dockAngle();
  }
  function raftLandingReady() {
    if (!raft.attached || !canPlay()) return false;
    var p = world(0.45, 0.84), rx = Math.max(32, map.width * (younger ? 0.17 : 0.145)) * (assist() ? 1.25 : 1), ry = Math.max(24, map.height * 0.095) * (assist() ? 1.2 : 1);
    var dx = (raft.x - p.x) / rx, dy = (raft.y - p.y) / ry;
    return dx * dx + dy * dy <= 1 && speed(raft) <= 16 && Math.abs(angle(raft.heading)) <= (assist() ? 1.65 : younger ? 1.5 : 1.20) && !raft.colliding;
  }
  function waypointRadius() { return Math.max(15, Math.min(26, map.width * (younger ? 0.085 : 0.065))) * (assist() ? 1.25 : 1); }
  function routeReady(t) {
    if (!t || !t.waypoints || waypointIndex < t.waypoints.length || speed(boat) > dockSpeed()) return false;
    var end = t.waypoints[t.waypoints.length - 1], p = world(end.x, end.y);
    return distance(boat, p) < waypointRadius() * 1.8 && (t.type !== "towRoute" || raft.attached && distance(raft, p) < raft.lineRest + raftL + waypointRadius() && !raft.colliding && speed(raft) < 21);
  }
  function nextLoad(t) { for (var i = 0; i < t.items.length; i++) if (cargo.indexOf(t.items[i]) < 0) return t.items[i]; return null; }
  function actionInfo() {
    var t = task(); if (!t || !canPlay()) return { label: "Dock", enabled: false };
    if (transfer) return { label: "Moving parcel", enabled: false };
    if (t.type === "route" || t.type === "towRoute") return { label: t.type === "route" ? "Check channel" : "Steady tow", enabled: routeReady(t) };
    if (boat.moored !== t.station) return { label: "Dock", enabled: distance(boat, stationPoint(t.station)) <= dockRadius() * 1.35 };
    if (t.type === "load") return { label: "Load parcel", enabled: !!nextLoad(t) };
    if (t.type === "deliver") return { label: "Unload parcel", enabled: cargo.indexOf(t.item) >= 0 && !delivered[t.item] };
    if (t.type === "attach") return { label: "Attach raft", enabled: !raft.attached && distance(boat, raft) <= Math.max(68, map.width * 0.24) };
    return { label: "Unload door", enabled: raftLandingReady() };
  }
  function finishTask() {
    if (!canPlay()) return;
    if (subtask < goals[stage].length - 1) { subtask++; waypointIndex = 0; boat.moored = null; instructTask(); hud(); return; }
    active = false; clearInput(); boat.vx = 0; boat.vy = 0; power = 0; completed.push(stage); doneAt = clock + 0.95;
    banner(task() && task().type === "deliverRaft" ? "Every parcel is home!" : "A careful captain! Your delivery is ready."); sound("correct");
    if (api && api.cheer) { try { api.cheer(task() && task().type === "deliverRaft" ? "Every parcel is home!" : "You did it!"); } catch (e) {} } hud();
  }
  function startTransfer(kind, item, station) {
    var from = kind === "load" ? stationPoint(station) : item === "door" ? { x: raft.x, y: raft.y } : { x: boat.x, y: boat.y };
    var to = kind === "load" ? { x: boat.x, y: boat.y } : world(STATIONS[station].shore.x, STATIONS[station].shore.y);
    transfer = { kind: kind, item: item, station: station, from: from, to: to, progress: 0 }; sound("tap"); hud();
  }
  function finishTransfer() {
    var tr = transfer; transfer = null; if (!tr) return;
    if (tr.kind === "load") {
      if (cargo.indexOf(tr.item) < 0) cargo.push(tr.item); loads++;
      var t = task(); if (t && t.type === "load" && !nextLoad(t)) finishTask(); else banner("One parcel aboard. Lift the next pictured parcel.");
    } else {
      if (tr.item === "door") { delivered.door = true; raft.unloaded = true; raft.attached = false; }
      else { cargo = cargo.filter(function (key) { return key !== tr.item; }); delivered[tr.item] = true; }
      unloads++; sound("correct"); finishTask();
    }
    hud();
  }
  function act() {
    if (!canPlay() || transfer || !actionInfo().enabled) return; var t = task();
    if (t.type === "route" || t.type === "towRoute") { if (routeReady(t)) finishTask(); return; }
    if (boat.moored !== t.station) {
      if (!canDock(t.station)) {
        dockRetries++; retry();
        if (speed(boat) > dockSpeed()) { banner("Tap the square Stop button, then try the rope loop."); tell("dock-stop", "Tap the square stop button. Then tap the rope-loop picture to dock."); }
        else if (Math.abs(angle(boat.heading - STATIONS[t.station].dock.heading)) > dockAngle()) { banner("Point the boat along the pale arrow, then try the rope loop."); tell("dock-turn", "Turn the boat's point along the pale arrow. Then tap the rope-loop picture to dock."); }
        else { banner("Steer a little closer to the rope loop, then try again."); tell("dock-close", "Steer a little closer to the rope-loop picture. Then try again."); }
        hud(); return;
      }
      boat.moored = t.station; boat.vx = 0; boat.vy = 0; dockings++; clearInput(); sound("tap"); banner(t.type === "attach" ? "Alongside the raft. Attach its towline." : t.type === "deliverRaft" ? "Hold both boat and raft beside the landing." : "Safely docked. Lift the pictured parcel."); hud(); return;
    }
    if (t.type === "load") { var item = nextLoad(t); if (item) startTransfer("load", item, t.station); }
    else if (t.type === "deliver") { if (cargo.indexOf(t.item) >= 0 && !delivered[t.item]) startTransfer("unload", t.item, t.station); }
    else if (t.type === "attach") {
      raft.attached = true; attaches++; var stern = sternPoint(), hook = raftHook(); raft.lineRest = clamp(distance(stern, hook), 30, 46); sound("tap"); banner("Towline attached. Leave room for the wide raft."); finishTask();
    } else if (raftLandingReady()) startTransfer("unload", "door", "beaver");
    hud();
  }
  function direction() {
    var x = (keyboardKeys.ArrowRight ? 1 : 0) - (keyboardKeys.ArrowLeft ? 1 : 0), y = (keyboardKeys.ArrowDown ? 1 : 0) - (keyboardKeys.ArrowUp ? 1 : 0);
    Object.keys(arrowPointers).forEach(function (id) { x += arrowPointers[id].x; y += arrowPointers[id].y; });
    if (drag) { var dx = drag.target.x - boat.x, dy = drag.target.y - boat.y, len = Math.sqrt(dx * dx + dy * dy); if (len > 3) { x += dx / Math.max(35, len); y += dy / Math.max(35, len); } }
    var length = Math.sqrt(x * x + y * y); if (length > 1) { x /= length; y /= length; }
    input.x = x; input.y = y; return input;
  }
  function release(d) { if (!d) return; try { if (d.surface && d.surface.hasPointerCapture(d.id)) d.surface.releasePointerCapture(d.id); } catch (e) {} }
  function clearInput() { var d = drag; drag = null; keyboardKeys = {}; var pointers = arrowPointers; arrowPointers = {}; release(d); Object.keys(pointers).forEach(function (id) { release(pointers[id]); }); input = { x: 0, y: 0 }; }
  function stopBoat() { if (!canPlay()) return; clearInput(); boat.vx = 0; boat.vy = 0; banner("Boat stopped. Line up with the glowing dock."); hud(); }
  function eventPoint(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
  function downBoat(e) {
    if (!canPlay() || transfer || drag || (e.button != null && e.button !== 0)) return; var p = eventPoint(e); if (distance(p, boat) > Math.max(30, boatL)) return;
    e.preventDefault(); drag = { id: e.pointerId, surface: e.currentTarget, target: p }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} hud();
  }
  function moveBoat(e) { if (!drag || drag.id !== e.pointerId || !canPlay()) return; e.preventDefault(); var p = eventPoint(e); drag.target = { x: clamp(p.x, map.left + 4, map.left + map.width - 4), y: clamp(p.y, map.top + 4, map.top + map.height - 4) }; }
  function upBoat(e) { if (!drag || drag.id !== e.pointerId) return; var d = drag; drag = null; release(d); hud(); }
  function arrowDown(e, vector) {
    if (!canPlay() || transfer || (e.button != null && e.button !== 0)) return; e.preventDefault(); arrowPointers[e.pointerId] = { x: vector.x, y: vector.y, id: e.pointerId, surface: e.currentTarget };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} hud();
  }
  function arrowUp(e) { var p = arrowPointers[e.pointerId]; if (!p) return; delete arrowPointers[e.pointerId]; release(p); hud(); }
  function keyDown(e) {
    if (e.defaultPrevented || !canPlay() || transfer || e.altKey || e.metaKey || e.ctrlKey) return;
    // Space activates a focused native control. Only the boat and the open
    // board use it as the brake shortcut; swallowing it strands switch users.
    if (e.key === " " && e.target && e.target.tagName === "BUTTON" && e.target !== boatButton) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.key) >= 0) { e.preventDefault(); keyboardKeys[e.key] = true; }
    else if (e.key === " ") { e.preventDefault(); stopBoat(); }
    else if (e.key === "Escape") { clearInput(); hud(); }
  }
  function keyUp(e) { if (keyboardKeys[e.key]) { e.preventDefault(); delete keyboardKeys[e.key]; } }
  function makeButton(id, text, label, className) { var b = document.createElement("button"); b.id = id; b.type = "button"; b.className = className; b.textContent = text; b.setAttribute("aria-label", label); root.appendChild(b); return b; }
  function controls() {
    root = document.createElement("div"); root.className = "postboat-controls"; layer.appendChild(root);
    var vectors = { Up: { x: 0, y: -1 }, Left: { x: -1, y: 0 }, Down: { x: 0, y: 1 }, Right: { x: 1, y: 0 } }, glyphs = { Up: "\u2191", Left: "\u2190", Down: "\u2193", Right: "\u2192" };
    Object.keys(vectors).forEach(function (key) {
      var b = makeButton("postboat" + key, glyphs[key], "Steer " + key.toLowerCase() + ". Hold to paddle.", "postboat-direction postboat-" + key.toLowerCase()); buttons[key] = b;
      on(b, "pointerdown", function (e) { arrowDown(e, vectors[key]); }); on(b, "pointerup", arrowUp); on(b, "pointercancel", arrowUp); on(b, "lostpointercapture", arrowUp);
      on(b, "keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && canPlay() && !transfer) { e.preventDefault(); keyboardKeys["Arrow" + key] = true; } });
      on(b, "keyup", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); delete keyboardKeys["Arrow" + key]; } });
    });
    buttons.Stop = makeButton("postboatStop", "\u25a0", "Stop the postboat", "postboat-direction postboat-stop"); on(buttons.Stop, "click", stopBoat);
    actionButton = makeButton("postboatAction", "Dock", "Dock at the pictured landing", "postboat-action"); on(actionButton, "click", act);
    actionButton.textContent = ""; actionIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg"); actionIcon.setAttribute("viewBox", "0 0 24 24"); actionIcon.setAttribute("aria-hidden", "true"); actionIcon.setAttribute("focusable", "false"); actionIcon.setAttribute("class", "postboat-action-icon"); actionButton.appendChild(actionIcon); actionText = document.createElement("span"); actionButton.appendChild(actionText); iconKind = "";
    boatButton = makeButton("postboatBoat", "", "Postboat. Drag toward the open water to paddle. Arrow keys steer; Space stops.", "postboat-boat");
    [cv, boatButton].forEach(function (el) { on(el, "pointerdown", downBoat); on(el, "pointermove", moveBoat); on(el, "pointerup", upBoat); on(el, "pointercancel", upBoat); on(el, "lostpointercapture", upBoat); });
    caption = document.createElement("div"); caption.className = "postboat-caption"; root.appendChild(caption);
    statusEl = document.createElement("div"); statusEl.className = "postboat-sr"; statusEl.setAttribute("role", "status"); statusEl.setAttribute("aria-live", "polite"); root.appendChild(statusEl);
    if (helpEl) on(helpEl, "click", function () { if (canPlay() && !drag && api && api.practice) api.practice(); });
    on(window, "keydown", keyDown); on(window, "keyup", keyUp); on(window, "resize", fit); on(window, "blur", function () { clearInput(); hud(); });
    on(document, "visibilitychange", function () { if (document.hidden) pause(); });
    on(window, "pagehide", function () { away = true; pause(); if (raf) cancelAnimationFrame(raf); raf = 0; });
    on(window, "pageshow", function () { away = false; last = 0; if (!raf && !destroyed) raf = requestAnimationFrame(frame); hud(); });
  }
  function makeSolids() {
    solids = COASTS.map(function (vertices, i) { return { id: "shore-" + i, kind: "shore", points: vertices.map(function (p) { return world(p[0], p[1]); }) }; });
    [[0.34,0.42,younger ? 0.050 : 0.065,0.145],[0.51,0.45,younger ? 0.035 : 0.045,0.14],[0.35,0.69,0.055,0.045]].forEach(function (r, i) { var p = world(r[0], r[1]); solids.push({ id: "reeds-" + i, kind: "reeds", x: p.x, y: p.y, rx: r[2] * map.width, ry: r[3] * map.height }); });
    [[0.07,0.22,0.055,0.035],[0.04,0.385,0.06,0.035],[0.06,0.57,0.07,0.035],[0.95,0.72,0.075,0.045],[0.975,0.54,0.045,0.03]].forEach(function (r, i) { var p = world(r[0], r[1]); solids.push({ id: "rock-" + i, kind: "rock", x: p.x, y: p.y, rx: r[2] * map.width, ry: r[3] * map.height }); });
  }
  function fit() {
    if (!cv || !ctx) return; clearInput(); var old = map, bp = boat.x == null ? null : mapNormal(boat), rp = raft.x == null ? null : mapNormal(raft);
    var r = cv.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); var dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var top = 100; if (bannerEl) { var br = bannerEl.getBoundingClientRect(); if (br.bottom > r.top && br.top < r.bottom) top = Math.max(14, br.top - r.top + (W > H && H < 500 ? 54 : 78) + 8); }
    map = { left: 8, top: top, width: W - 16, height: Math.max(110, H - top - 126) };
    boatL = clamp(map.width * 0.105, 28, 42); boatW = boatL * 0.427; raftL = boatL * 0.96; raftW = boatL * (younger ? 0.89 : 1.03);
    root.style.height = H + "px";
    if (bp) { var p = world(bp.x, bp.y); boat.x = p.x; boat.y = p.y; boat.vx = 0; boat.vy = 0; }
    if (rp) { var q = world(rp.x, rp.y); raft.x = q.x; raft.y = q.y; raft.vx = 0; raft.vy = 0; if (raft.lineRest) raft.lineRest *= map.width / Math.max(1, old.width); }
    if (transfer) { transfer.from = transfer.kind === "load" ? stationPoint(transfer.station) : transfer.item === "door" ? { x: raft.x, y: raft.y } : { x: boat.x, y: boat.y }; transfer.to = transfer.kind === "load" ? { x: boat.x, y: boat.y } : world(STATIONS[transfer.station].shore.x, STATIONS[transfer.station].shore.y); }
    makeSolids(); wakes = []; last = 0; hud(); draw();
  }
  function inPolygon(p, points) { var inside = false; for (var i = 0, j = points.length - 1; i < points.length; j = i++) { var a = points[i], b = points[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside; } return inside; }
  function closestSegment(p, a, b) { var dx = b.x - a.x, dy = b.y - a.y, u = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(0.001, dx * dx + dy * dy), 0, 1); return { x: a.x + u * dx, y: a.y + u * dy }; }
  function collisionPoint(p, radius) {
    if (p.x - radius < map.left) return { x: 1, y: 0, id: "bank-left" }; if (p.x + radius > map.left + map.width) return { x: -1, y: 0, id: "bank-right" };
    if (p.y - radius < map.top) return { x: 0, y: 1, id: "bank-top" }; if (p.y + radius > map.top + map.height) return { x: 0, y: -1, id: "bank-bottom" };
    for (var n = 0; n < solids.length; n++) {
      var s = solids[n], nx, ny, len;
      if (!s.points) {
        var dx = p.x - s.x, dy = p.y - s.y, rx = s.rx + radius, ry = s.ry + radius;
        if (dx * dx / (rx * rx) + dy * dy / (ry * ry) < 1) { nx = dx / (rx * rx); ny = dy / (ry * ry); len = Math.sqrt(nx * nx + ny * ny) || 1; return { x: nx / len, y: ny / len, id: s.id }; }
      } else {
        var inside = inPolygon(p, s.points), nearest = null, best = Infinity;
        for (var i = 0; i < s.points.length; i++) { var q = closestSegment(p, s.points[i], s.points[(i + 1) % s.points.length]), d = distance(p, q); if (d < best) { best = d; nearest = q; } }
        if (inside || best < radius) { nx = inside ? nearest.x - p.x : p.x - nearest.x; ny = inside ? nearest.y - p.y : p.y - nearest.y; len = Math.sqrt(nx * nx + ny * ny) || 1; return { x: nx / len, y: ny / len, id: s.id }; }
      }
    }
    return null;
  }
  function hullPoints(body, towing) {
    var points = [], l = towing ? raftL : boatL, w = towing ? raftW : boatW, c = Math.cos(body.heading), s = Math.sin(body.heading);
    var local = towing ? [[-0.40,-0.40],[-0.40,0.40],[0.40,-0.40],[0.40,0.40],[0,0],[-0.40,0],[0.40,0],[0,-0.40],[0,0.40]] : [[-0.31,0],[0,0],[0.31,0]];
    local.forEach(function (p) { points.push({ x: body.x + c * p[0] * l - s * p[1] * w, y: body.y + s * p[0] * l + c * p[1] * w }); }); return points;
  }
  function retry() {
    if (clock - lastMissAt < 0.7) return; lastMissAt = clock; var old = assist(); stepMisses++;
    if (assist() > old) { banner("Gentler water. Take your time and follow the open channel."); tell("gentle-" + assist(), "The current is gentler now. Follow the open water to the glowing dock."); }
  }
  function miss(towing) { collisions++; if (towing) raftCollisions++; lastCollisionAt = clock; if (clock - lastManualAt <= 0.45) retry(); }
  function collide(body, previous, towing) {
    var points = hullPoints(body, towing), hit = null, radius = towing ? 3.5 : Math.max(4, boatW * 0.40);
    for (var i = 0; i < points.length; i++) { hit = collisionPoint(points[i], radius); if (hit) break; }
    body.colliding = !!hit; if (!hit) return;
    body.x = previous.x + hit.x * 0.5; body.y = previous.y + hit.y * 0.5; if (towing) { body.heading = previous.heading; body.omega *= -0.25; }
    var dot = body.vx * hit.x + body.vy * hit.y; if (dot < 0) { body.vx -= 1.3 * dot * hit.x; body.vy -= 1.3 * dot * hit.y; } body.vx *= 0.55; body.vy *= 0.55; body.lastHit = hit.id; miss(towing);
  }
  function sternPoint() { return { x: boat.x - Math.cos(boat.heading) * boatL * 0.43, y: boat.y - Math.sin(boat.heading) * boatL * 0.43 }; }
  function raftHook() { return { x: raft.x + Math.cos(raft.heading) * raftL * 0.43, y: raft.y + Math.sin(raft.heading) * raftL * 0.43 }; }
  function waterCurrent() {
    var p = mapNormal(boat); baseCurrent = { x: (younger ? 2.5 : 4.6) + Math.sin(p.y * 8 + clock * 0.38) * (younger ? 0.7 : 1.5), y: Math.cos(p.x * 7 + clock * 0.26) * (younger ? 1.2 : 2.2) };
    var scale = currentScale(); current = { x: baseCurrent.x * scale, y: baseCurrent.y * scale };
  }
  function steer(dt) {
    var dir = direction(), amount = Math.sqrt(dir.x * dir.x + dir.y * dir.y), old = { x: boat.x, y: boat.y, heading: boat.heading };
    if (amount > 0.07 && !transfer) {
      lastManualAt = clock; if (boat.moored) boat.moored = null;
      var desiredAngle = Math.atan2(dir.y, dir.x), delta = angle(desiredAngle - boat.heading); boat.heading = angle(boat.heading + clamp(delta, -dt * (younger ? 4.2 : 3.1), dt * (younger ? 4.2 : 3.1)));
    }
    if (boat.moored || transfer) { boat.vx = 0; boat.vy = 0; boat.colliding = false; }
    else {
      var targetX = dir.x * maxSpeed() + current.x, targetY = dir.y * maxSpeed() + current.y, response = younger ? 6.0 : power > 0 || assist() ? 5.2 : 3.8, blend = Math.min(1, dt * response);
      boat.vx += (targetX - boat.vx) * blend; boat.vy += (targetY - boat.vy) * blend; boat.x += boat.vx * dt; boat.y += boat.vy * dt; collide(boat, old, false);
      var moved = distance(old, boat); if (amount > 0.07) { manualTravel += moved; legTravel += moved; }
      wakeClock += moved; if (!reduceMotion && wakeClock > 6) { wakeClock = 0; var stern = sternPoint(); wakes.push({ x: stern.x, y: stern.y, age: 0, heading: boat.heading }); }
    }
    if (raft.attached && !raft.unloaded) tow(dt);
  }
  function tow(dt) {
    var old = { x: raft.x, y: raft.y, heading: raft.heading }, stern = sternPoint(), hook = raftHook(), dx = stern.x - hook.x, dy = stern.y - hook.y, len = Math.sqrt(dx * dx + dy * dy) || 1, stretch = Math.max(0, len - raft.lineRest);
    var damping = power > 0 || assist() >= 1 ? 7.8 : younger ? 6.3 : 3.8, desired = Math.atan2(stern.y - raft.y, stern.x - raft.x), error = angle(desired - raft.heading);
    raft.damping = damping; raft.stretch = stretch;
    raft.omega += (error * 4.4 - raft.omega * damping) * dt; raft.heading = angle(raft.heading + clamp(raft.omega, -1.8, 1.8) * dt);
    raft.vx += (dx / len * stretch * 6.8 + current.x * 0.35 - raft.vx * 1.7) * dt; raft.vy += (dy / len * stretch * 6.8 + current.y * 0.35 - raft.vy * 1.7) * dt;
    var rs = speed(raft), limit = maxSpeed() * 1.8; if (rs > limit) { raft.vx *= limit / rs; raft.vy *= limit / rs; }
    raft.x += raft.vx * dt; raft.y += raft.vy * dt; collide(raft, old, true);
    // Rope tension resists the boat rather than allowing a detached-looking
    // raft to be dragged through reeds. Steering remains the child's action.
    if (stretch > 18 && !boat.moored) { boat.vx -= dx / len * Math.min(18, stretch * 0.24) * dt; boat.vy -= dy / len * Math.min(18, stretch * 0.24) * dt; }
  }
  function checkWaypoints() {
    var t = task(); if (!t || !t.waypoints || clock - lastManualAt > 0.35 || transfer) return;
    if (t.cargo && cargo.indexOf(t.cargo) < 0 || t.type === "towRoute" && !raft.attached) return;
    var next = t.waypoints[waypointIndex]; if (!next) return; var p = world(next.x, next.y);
    if (distance(boat, p) <= waypointRadius() && !boat.colliding && (t.type !== "towRoute" || !raft.colliding && distance(raft, p) <= raft.lineRest + raftL + waypointRadius())) {
      waypointIndex++; checkpoints++; sound("tap"); if (waypointIndex === t.waypoints.length) banner(t.type === "towRoute" ? "The raft is clear. Stop and steady the tow." : "Through the reeds! Stop and check the channel.");
    }
  }
  function sceneNow() { var nearest = null, best = Infinity; Object.keys(STATIONS).forEach(function (key) { var d = distance(boat, stationPoint(key)); if (d < best) { best = d; nearest = key; } }); return best < dockRadius() * 2.4 ? nearest : null; }
  function tick(dt) {
    if (paused || away || destroyed || document.hidden) return; clock += dt; wakes.forEach(function (w) { w.age += dt; }); wakes = wakes.filter(function (w) { return w.age < 1.2; });
    if (doneAt) { if (clock >= doneAt) { doneAt = 0; hud(); if (api && api.done) api.done(); } else publish(); return; }
    if (!canPlay()) { publish(); return; } power = Math.max(0, power - dt); waterCurrent(); steer(dt); checkWaypoints(); scene = sceneNow();
    if (transfer) { transfer.progress = Math.min(1, transfer.progress + dt / 0.42); if (transfer.progress >= 1) finishTransfer(); }
    hud();
  }
  function rect(el) { if (!el) return null; var r = el.getBoundingClientRect(), c = cv.getBoundingClientRect(); return { x: (r.left + r.width / 2 - c.left) / W, y: (r.top + r.height / 2 - c.top) / H, width: r.width / W, height: r.height / H }; }
  function hud() {
    if (!root) return; var allowed = canPlay(), t = task(); cachedAction = actionInfo();
    Object.keys(buttons).forEach(function (key) { buttons[key].disabled = !allowed || !!transfer; });
    paintAction(cachedAction.label); actionButton.disabled = !cachedAction.enabled; actionButton.setAttribute("aria-label", cachedAction.label + (t && t.station ? " at " + STATIONS[t.station].name : ""));
    boatButton.hidden = !active; boatButton.disabled = !allowed || !!transfer; boatButton.style.left = boat.x + "px"; boatButton.style.top = boat.y + "px"; boatButton.setAttribute("aria-pressed", drag ? "true" : "false");
    caption.textContent = power > 0 && active ? "Calm water · steer, stop, dock" : raft.attached ? "Leave room for the raft" : "Hold an arrow or drag the boat";
    if (helpEl) { helpEl.disabled = !allowed || !!drag; var span = helpEl.querySelector("span"); if (span) span.textContent = "Calm water"; else helpEl.textContent = "Calm water"; helpEl.classList.toggle("powered", power > 0 && active); }
    root.classList.toggle("is-powered", power > 0 && active); publish();
  }
  function paintAction(label) {
    actionText.textContent = label; var kind = label === "Dock" ? "dock" : label === "Attach raft" ? "attach" : label === "Check channel" ? "buoy" : label === "Steady tow" ? "tow" : label.indexOf("Unload") === 0 ? "unload" : "load";
    if (kind === iconKind) return; iconKind = kind;
    var paths = {
      dock: '<path d="M4 16h16M7 16v-5m10 5v-5M6 9c0-4 12-4 12 0s-12 5-12 0Z"/>',
      load: '<path d="M3 11h7v10H3Zm11 0h7v10h-7ZM7 4h10m-5-2v11m-3-3 3 3 3-3"/>',
      unload: '<path d="M3 12h7v9H3Zm11 0h7v9h-7ZM12 13V2m-3 3 3-3 3 3"/>',
      attach: '<path d="m9 15-3 3a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 2 3-3a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0M8 16l8-8"/>',
      buoy: '<path d="M4 20h16M12 19V3l7 4-7 4M4 15l3 3 5-6"/>',
      tow: '<path d="m1 14 3-4 3 4-1 5H2Zm16-4h6v9h-6ZM7 16h10M20 10V6"/>'
    };
    actionIcon.innerHTML = paths[kind]; actionIcon.setAttribute("fill", "none"); actionIcon.setAttribute("stroke", "currentColor"); actionIcon.setAttribute("stroke-width", "1.7"); actionIcon.setAttribute("stroke-linecap", "round"); actionIcon.setAttribute("stroke-linejoin", "round");
  }
  function publishedTask(t) { if (!t) return null; var out = { type: t.type, station: t.station || null, item: t.item || null, items: t.items ? t.items.slice() : [], cargo: t.cargo || null, index: waypointIndex };
    out.waypoints = t.waypoints ? t.waypoints.map(function (p, i) { var q = normal(world(p.x, p.y)); q.r = waypointRadius() / W; q.passed = i < waypointIndex; return q; }) : [];
    out.approach = t.type === "deliverRaft" ? [normal(world(0.28,0.86)), normal(world(0.46,0.83))] : []; return out; }
  function publish() {
    if (!cv) return; var t = task(), stations = {}, bp = normal(boat), rp = normal(raft), controlsState = {}, line = raft.attached ? { start: normal(sternPoint()), end: normal(raftHook()) } : null;
    Object.keys(STATIONS).forEach(function (key) { var s = STATIONS[key], p = normal(stationPoint(key)); p.r = dockRadius() / W; p.heading = s.dock.heading; stations[key] = { name: s.name, dock: p, canDock: canDock(key), delivered: !!delivered[key], moored: boat.moored === key }; });
    Object.keys(buttons).forEach(function (key) { controlsState[key.toLowerCase()] = rect(buttons[key]); }); controlsState.action = rect(actionButton); controlsState.boat = rect(boatButton); controlsState.help = rect(helpEl);
    var ready = raftLandingReady(), landing = normal(world(0.45, 0.84)); landing.rx = Math.max(32, map.width * (younger ? 0.17 : 0.145)) / W; landing.ry = Math.max(24, map.height * 0.095) / H;
    window.__dailyPostboat = {
      active: active, paused: paused, away: away, won: won, stage: stage, stages: count, subtask: subtask, objective: publishedTask(t), completedGoals: completed.slice(),
      power: power, powerDuration: POWER, currentScale: currentScale(), current: { x: current.x, y: current.y }, baseCurrent: { x: baseCurrent.x, y: baseCurrent.y }, stepMisses: stepMisses, assistance: assist(),
      boat: { x: bp.x, y: bp.y, heading: boat.heading, speed: speed(boat), vx: boat.vx, vy: boat.vy, moored: boat.moored, colliding: !!boat.colliding, lastHit: boat.lastHit || null, length: boatL / W, width: boatW / W },
      raft: { x: rp.x, y: rp.y, heading: raft.heading, speed: speed(raft), vx: raft.vx, vy: raft.vy, omega: raft.omega, damping: power > 0 || assist() >= 1 ? 7.8 : younger ? 6.3 : 3.8, stretch: raft.stretch || 0, attached: !!raft.attached, unloaded: !!raft.unloaded, colliding: !!raft.colliding, lastHit: raft.lastHit || null, length: raftL / W, width: raftW / W, lineRest: raft.lineRest / W, line: line, landingReady: ready, landing: landing },
      cargo: cargo.slice(), delivered: { mouse: !!delivered.mouse, heron: !!delivered.heron, turtle: !!delivered.turtle, door: !!delivered.door }, stations: stations, targetDock: t && t.station ? stations[t.station].dock : null,
      controls: controlsState, action: { label: cachedAction.label, enabled: cachedAction.enabled }, scene: scene,
      collisions: collisions, raftCollisions: raftCollisions, dockRetries: dockRetries, dockings: dockings, loads: loads, unloads: unloads, attaches: attaches, checkpoints: checkpoints, manualTravel: manualTravel, legTravel: legTravel,
      input: { x: input.x, y: input.y, dragging: !!drag, pointerId: drag ? drag.id : null }, transfer: transfer ? { kind: transfer.kind, item: transfer.item, station: transfer.station, progress: transfer.progress } : null,
      celebrating: doneAt > 0, doneIn: doneAt ? Math.max(0, doneAt - clock) : 0, width: W, height: H, maxSpeed: maxSpeed(), dockSpeed: dockSpeed(), dockAngle: dockAngle(), reduceMotion: reduceMotion,
      map: { x: map.left / W, y: map.top / H, width: map.width / W, height: map.height / H },
      solids: solids.map(function (s) { return s.points ? { id: s.id, kind: s.kind, points: s.points.map(normal) } : { id: s.id, kind: s.kind, x: s.x / W, y: s.y / H, rx: s.rx / W, ry: s.ry / H }; }),
      coordinates: "Positions normalized to dailyCanvas; lengths and radii use canvas width unless ry; speed/current in CSS pixels per second; heading 0 points right; read-only snapshot"
    };
  }
  function ellipse(x, y, rx, ry, fill, stroke, line) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line || 1; ctx.stroke(); } }
  function roundRect(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function image(key) { var i = images[key]; return i && i.complete && i.naturalWidth ? i : null; }
  function drawBackground() {
    ctx.fillStyle = "#dce3c5"; ctx.fillRect(0, 0, W, H); var bg = image("map");
    if (bg) ctx.drawImage(bg, map.left, map.top, map.width, map.height);
    else { var water = ctx.createLinearGradient(0, map.top, W, map.top + map.height); water.addColorStop(0, "#7cb9ba"); water.addColorStop(1, "#5ca3ae"); ctx.fillStyle = water; ctx.fillRect(map.left, map.top, map.width, map.height); COASTS.forEach(function (coast) { ctx.fillStyle = "#bdc38d"; ctx.beginPath(); coast.forEach(function (p, i) { var q = world(p[0], p[1]); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.closePath(); ctx.fill(); }); }
    ctx.strokeStyle = "rgba(241,241,202,.7)"; ctx.lineWidth = 2; ctx.strokeRect(map.left, map.top, map.width, map.height);
    ctx.fillStyle = "rgba(251,245,218,.96)"; roundRect(6, H - 119, W - 12, 113, 17); ctx.fill(); ctx.strokeStyle = "rgba(133,137,97,.3)"; ctx.lineWidth = 1; ctx.stroke();
  }
  function drawReeds() {
    solids.filter(function (s) { return s.kind === "reeds"; }).forEach(function (s, index) {
      ellipse(s.x, s.y + 3, s.rx * 1.05, s.ry * 0.9, "rgba(57,106,77,.22)");
      ctx.save(); ctx.beginPath(); ctx.ellipse(s.x, s.y, s.rx, s.ry, 0, 0, TAU); ctx.clip();
      var rows = Math.max(3, Math.ceil(s.ry / 10)), cols = Math.max(3, Math.ceil(s.rx / 6));
      for (var y = -rows; y <= rows; y++) for (var x = -cols; x <= cols; x++) { var px = s.x + x * 8 + (y % 2 ? 3 : 0), py = s.y + y * 10, bend = reduceMotion ? 0 : Math.sin(clock * 1.3 + x + y) * (power > 0 ? 0.5 : 1.6); ctx.strokeStyle = (x + y) % 3 ? "#7c9e59" : "#afbf75"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(px, py + 7); ctx.quadraticCurveTo(px - 3, py, px + bend, py - 9); ctx.stroke(); ctx.strokeStyle = "#697f43"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px + bend, py - 8); ctx.lineTo(px + bend, py - 13); ctx.stroke(); }
      ctx.restore();
    });
  }
  function drawCurrents() {
    [[0.42,0.87],[0.56,0.73],[0.63,0.38],[0.44,0.33],[0.30,0.33]].forEach(function (p, i) {
      var q = world(p[0], p[1]), offset = reduceMotion ? 0 : Math.sin(clock * 0.8 + i) * (power > 0 ? 1 : 3); ctx.save(); ctx.translate(q.x + offset, q.y); ctx.rotate(0.1 + i * 0.05); ctx.strokeStyle = power > 0 ? "rgba(224,247,232,.48)" : "rgba(222,244,232,.74)"; ctx.lineWidth = power > 0 ? 1 : 1.6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.quadraticCurveTo(0, -4, 10, 0); ctx.moveTo(5, -4); ctx.lineTo(10, 0); ctx.lineTo(5, 3); ctx.stroke(); ctx.restore();
    });
  }
  function parcelIcon(key, x, y, size, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha == null ? 1 : alpha;
    var color = key === "mouse" ? "#a8cbd3" : key === "heron" ? "#e4d09c" : key === "turtle" ? "#aabf9d" : "#c8a77d";
    ctx.fillStyle = color; roundRect(-size / 2, -size * 0.38, size, size * 0.76, size * 0.13); ctx.fill(); ctx.strokeStyle = "#7d7860"; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = "rgba(250,243,210,.9)"; ctx.lineWidth = Math.max(1, size * 0.10); ctx.beginPath(); ctx.moveTo(0, -size * 0.36); ctx.lineTo(0, size * 0.36); ctx.stroke();
    if (key === "turtle") { ctx.fillStyle = "#eef0cc"; ctx.fillRect(-size * 0.26, -size * 0.19, size * 0.52, size * 0.36); ctx.strokeStyle = "#6e8b61"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -size * 0.18); ctx.lineTo(0, size * 0.17); ctx.stroke(); }
    else if (key === "mouse") { ctx.strokeStyle = "#648b9a"; ctx.lineWidth = Math.max(1, size * 0.10); [-0.22, 0.22].forEach(function (side) { ctx.beginPath(); ctx.moveTo(size * side, -size * 0.23); ctx.lineTo(size * side * 0.6, size * 0.23); ctx.stroke(); }); }
    else if (key === "heron") { ctx.fillStyle = "#aaaf79"; ctx.beginPath(); ctx.moveTo(-size * 0.18, -size * 0.22); ctx.lineTo(size * 0.18, -size * 0.22); ctx.lineTo(size * 0.31, size * 0.25); ctx.lineTo(-size * 0.31, size * 0.25); ctx.fill(); }
    ctx.restore();
  }
  function resident(key, p, size, near) {
    ctx.save(); ctx.translate(p.x, p.y - (near && !reduceMotion ? Math.sin(clock * 3) * 1.4 : 0));
    if (key === "heron") {
      ctx.strokeStyle = "#a98f64"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, 5); ctx.lineTo(-4, 12); ctx.moveTo(3, 5); ctx.lineTo(3, 12); ctx.stroke(); ellipse(0, 1, 7, 9, delivered.heron ? "#c6bd82" : "#ebe9d2", "#c3c6aa", 1); ctx.strokeStyle = "#efeedc"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(2, -3); ctx.quadraticCurveTo(9, -12, 3, -17); ctx.stroke(); ellipse(2, -18, 5, 4, "#f0edd6"); ctx.fillStyle = "#c2a46d"; ctx.beginPath(); ctx.moveTo(5, -19); ctx.lineTo(17, -17); ctx.lineTo(5, -15); ctx.fill(); ellipse(3, -19, 1, 1, "#4f574a");
    } else if (key === "turtle") {
      ellipse(0, 3, 10, 7, "#829967", "#6b8057", 1); ellipse(9, 1, 5, 4, "#b5c18b"); ellipse(-6, 8, 4, 2, "#a1b37a"); ellipse(6, 8, 4, 2, "#a1b37a"); ellipse(10, 0, 1, 1, "#4b5d42"); if (delivered.turtle) { ctx.fillStyle = "#eee4bd"; ctx.fillRect(-8, -5, 14, 6); ctx.strokeStyle = "#829369"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-1, -5); ctx.lineTo(-1, 1); ctx.stroke(); }
    } else {
      var mouse = key === "mouse", color = mouse ? "#b8b4a2" : key === "beaver" ? "#927852" : "#a18a64"; if (key === "beaver") ellipse(-9, 8, 10, 4, "#85704f", "#6f6247", 1);
      ellipse(0, 4, mouse ? 7 : 9, mouse ? 9 : 10, color, "#8b8269", 1); ellipse(-5, -9, mouse ? 5 : 3, mouse ? 5 : 3, color); ellipse(5, -9, mouse ? 5 : 3, mouse ? 5 : 3, color); ellipse(0, -4, mouse ? 8 : 9, 7, color, "#8b8269", 1); ellipse(-3, -5, 1.1, 1.2, "#485547"); ellipse(3, -5, 1.1, 1.2, "#485547"); ellipse(0, -1, 2, 1.5, "#6f7560");
      if (key === "otter") { ctx.fillStyle = "#8baeb0"; roundRect(-8, -12, 16, 5, 2); ctx.fill(); }
      if (mouse && delivered.mouse) { ctx.strokeStyle = "#9abec9"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(-12, 12); ctx.moveTo(8, 4); ctx.lineTo(12, 12); ctx.stroke(); }
      if (near) { ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(6, 3); ctx.lineTo(13, -2); ctx.stroke(); }
    }
    ctx.restore();
  }
  function drawPiers() {
    var t = task(); Object.keys(STATIONS).forEach(function (key) {
      var s = STATIONS[key], a = world(s.shore.x, s.shore.y), b = stationPoint(key), len = distance(a, b), heading = Math.atan2(b.y - a.y, b.x - a.x), width = key === "beaver" ? 26 : 15;
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(heading); ctx.fillStyle = "#c4a473"; roundRect(0, -width / 2, len, width, 3); ctx.fill(); var wood = image("wood"); if (wood) { ctx.save(); ctx.globalAlpha = 0.35; ctx.globalCompositeOperation = "multiply"; ctx.drawImage(wood, 0, -width / 2, len, width); ctx.restore(); }
      ctx.strokeStyle = "#8c7653"; ctx.lineWidth = 1; for (var i = 4; i < len; i += 7) { ctx.beginPath(); ctx.moveTo(i, -width / 2); ctx.lineTo(i, width / 2); ctx.stroke(); } ctx.restore();
      ellipse(b.x, b.y, key === "beaver" ? 11 : 7, key === "beaver" ? 5 : 4, "#dec698", "#8d7f5e", 1);
      var home = world(s.home.x, s.home.y); resident(s.resident, home, 16, scene === key);
      if (t && t.station === key) {
        ctx.save(); ctx.strokeStyle = canDock(key) || boat.moored === key ? "#fff7cb" : "rgba(236,248,220,.86)"; ctx.lineWidth = canDock(key) ? 3 : 2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.ellipse(b.x, b.y, dockRadius(), dockRadius() * 0.72, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        var item = t.item || (t.items ? nextLoad(t) : "door"); if (item) parcelIcon(item, b.x, b.y - dockRadius() - 12, 17); ctx.restore();
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(s.dock.heading); ctx.strokeStyle = "rgba(54,106,92,.65)"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-dockRadius() * 0.62, 0); ctx.lineTo(dockRadius() * 0.32, 0); ctx.moveTo(dockRadius() * 0.08, -5); ctx.lineTo(dockRadius() * 0.32, 0); ctx.lineTo(dockRadius() * 0.08, 5); ctx.stroke(); ctx.strokeStyle = "#faf1cc"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      }
      if (key === "depot" && stage <= (younger ? 2 : 0)) { parcelIcon("mouse", a.x + 4, a.y - 11, 11, delivered.mouse ? 0.3 : 1); parcelIcon("heron", a.x - 8, a.y - 13, 10, cargo.indexOf("heron") >= 0 ? 0.3 : 1); }
      if (key === "transfer" && !delivered.turtle && cargo.indexOf("turtle") < 0 && !younger) parcelIcon("turtle", a.x + 4, a.y + 2, 12);
    });
    if (t && t.type === "deliverRaft") { var landing = world(0.45, 0.84); ctx.strokeStyle = raftLandingReady() ? "#fff5c8" : "rgba(245,241,207,.8)"; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.ellipse(landing.x, landing.y, Math.max(32, map.width * (younger ? 0.17 : 0.145)), Math.max(24, map.height * 0.095), 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      var start = world(0.28,0.86), end = world(0.46,0.83); ctx.strokeStyle = "rgba(246,243,208,.68)"; ctx.lineWidth = 2; ctx.setLineDash([4,6]); ctx.beginPath(); ctx.moveTo(start.x,start.y); ctx.lineTo(end.x,end.y); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(end.x-6,end.y-4); ctx.lineTo(end.x,end.y); ctx.lineTo(end.x-6,end.y+4); ctx.stroke(); }
  }
  function drawBuoys() {
    var t = task(); if (!t || !t.waypoints) return;
    t.waypoints.forEach(function (wp, i) {
      var p = world(wp.x, wp.y), passed = i < waypointIndex; ctx.save(); ctx.strokeStyle = passed ? "rgba(235,241,210,.35)" : "rgba(239,247,218,.72)"; ctx.lineWidth = i === waypointIndex ? 2.4 : 1.2; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(p.x, p.y, waypointRadius(), 0, TAU); ctx.stroke(); ctx.setLineDash([]); ellipse(p.x, p.y, 7, 4.5, passed ? "#a9beb0" : "#e8dcab", "#889e84", 1); ctx.strokeStyle = "#7c9276"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 15); ctx.stroke(); ctx.fillStyle = passed ? "#b9ceba" : "#dce9c7"; ctx.beginPath(); ctx.moveTo(p.x + 1, p.y - 15); ctx.lineTo(p.x + 11, p.y - 11); ctx.lineTo(p.x + 1, p.y - 7); ctx.fill(); ctx.fillStyle = "#657b5a"; ctx.font = "700 9px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.fillText(String(i + 1), p.x + 5, p.y - 10); ctx.restore();
    });
  }
  function drawRaft() {
    if (raft.unloaded) return; ctx.save(); ctx.translate(raft.x, raft.y); ctx.rotate(raft.heading); ellipse(0, 4, raftL * 0.63, raftW * 0.57, "rgba(54,96,86,.20)");
    ctx.fillStyle = "#bd9c67"; roundRect(-raftL / 2, -raftW / 2, raftL, raftW, 4); ctx.fill(); var wood = image("wood"); if (wood) { ctx.save(); ctx.globalAlpha = 0.4; ctx.globalCompositeOperation = "multiply"; ctx.drawImage(wood, -raftL / 2, -raftW / 2, raftL, raftW); ctx.restore(); }
    ctx.strokeStyle = "#806a45"; ctx.lineWidth = 1; ctx.stroke(); for (var i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-raftL / 2 + 2, i * raftW / 5); ctx.lineTo(raftL / 2 - 2, i * raftW / 5); ctx.stroke(); }
    ctx.strokeStyle = "#ddd0a1"; ctx.lineWidth = 2; [-0.33,0.33].forEach(function (side) { ctx.beginPath(); ctx.moveTo(side * raftL, -raftW * 0.54); ctx.lineTo(side * raftL, raftW * 0.54); ctx.stroke(); });
    ctx.fillStyle = "#b59b69"; roundRect(-raftL * 0.31, -raftW * 0.39, raftL * 0.62, raftW * 0.78, 3); ctx.fill(); ctx.strokeStyle = "#7f714b"; ctx.lineWidth = 1.4; ctx.stroke(); ctx.strokeStyle = "#d7c394"; ctx.lineWidth = 1; ctx.strokeRect(-raftL * 0.21, -raftW * 0.28, raftL * 0.42, raftW * 0.56); ellipse(raftL * 0.21, 1, 1.7, 1.7, "#77684b"); ctx.restore();
    if (raft.attached) { var stern = sternPoint(), hook = raftHook(), len = distance(stern, hook), slack = Math.max(0, raft.lineRest - len) * 0.45; ctx.strokeStyle = "#dfc99d"; ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(stern.x, stern.y); ctx.quadraticCurveTo((stern.x + hook.x) / 2, (stern.y + hook.y) / 2 + slack, hook.x, hook.y); ctx.stroke(); }
  }
  function drawBoat() {
    ctx.save(); ctx.translate(boat.x, boat.y); ctx.rotate(boat.heading + Math.PI / 2); ellipse(0, 2, boatW * 0.60, boatL * 0.56, "rgba(43,102,99,.18)");
    var sprite = image("boat"); if (sprite) { var ih = boatL * 1.16, iw = ih * sprite.naturalWidth / sprite.naturalHeight; ctx.drawImage(sprite, -iw / 2, -ih * 0.46, iw, ih); }
    else { ctx.fillStyle = "#b1c6b4"; ctx.strokeStyle = "#668c83"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -boatL / 2); ctx.quadraticCurveTo(boatW * 0.72, -boatL * 0.15, boatW / 2, boatL * 0.40); ctx.quadraticCurveTo(0, boatL * 0.58, -boatW / 2, boatL * 0.4); ctx.quadraticCurveTo(-boatW * 0.72, -boatL * 0.15, 0, -boatL / 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#d5bd88"; roundRect(-boatW * 0.30, -boatL * 0.13, boatW * 0.60, boatL * 0.50, 3); ctx.fill(); }
    cargo.forEach(function (key, i) { parcelIcon(key, (i % 2 ? 1 : -1) * boatW * 0.21, -boatL * 0.13 + Math.floor(i / 2) * 6, Math.max(6, boatW * 0.43)); });
    if (active && !drag && legTravel < 10) { ctx.strokeStyle = "rgba(255,248,211,.85)"; ctx.lineWidth = 1.7; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.ellipse(0, 0, Math.max(15, boatW), boatL * 0.65, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
    if (boat.moored) { var p = stationPoint(boat.moored); ctx.strokeStyle = "#e3cfa0"; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(boat.x, boat.y); ctx.quadraticCurveTo((boat.x + p.x) / 2, Math.max(boat.y, p.y) + 8, p.x, p.y); ctx.stroke(); }
  }
  function drawTransfer() {
    if (!transfer) return; var tr = transfer, t = tr.progress, x = tr.from.x + (tr.to.x - tr.from.x) * t, y = tr.from.y + (tr.to.y - tr.from.y) * t - Math.sin(t * Math.PI) * 16; parcelIcon(tr.item, x, y, tr.item === "door" ? 23 : 15);
  }
  function draw() {
    if (!ctx || destroyed) return; ctx.clearRect(0, 0, W, H); drawBackground(); drawCurrents(); drawReeds(); drawPiers(); drawBuoys();
    wakes.forEach(function (w) { ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.heading); ctx.globalAlpha = Math.max(0, 1 - w.age / 1.2) * 0.55; ctx.strokeStyle = "#d7eee1"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, 0, 3 + w.age * 7, 2 + w.age * 9, 0, -1.3, 1.3); ctx.stroke(); ctx.restore(); });
    drawRaft(); drawBoat(); drawTransfer();
    if (power > 0 && active) { ctx.fillStyle = "rgba(233,245,214,.92)"; roundRect(W - 100, map.top + 4, 88, 22, 10); ctx.fill(); ctx.fillStyle = "#5a7a62"; ctx.font = "700 11px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.fillText("Calm water", W - 56, map.top + 19); }
  }
  function frame(now) { if (destroyed) return; var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; tick(dt); draw(); raf = requestAnimationFrame(frame); }
  function onWord(index) {
    if (destroyed || index < 0 || index >= count) return;
    if (stage === index && active) { paused = false; power = POWER; hud(); return; }
    clearInput(); stage = index; subtask = 0; waypointIndex = 0; active = true; paused = false; won = false; power = POWER; doneAt = 0; last = 0; legTravel = 0; stepMisses = 0; lastMissAt = -100; said = {}; boat.moored = null; instructTask(); hud(); draw();
  }
  function pause() { paused = true; last = 0; clearInput(); hud(); draw(); }
  function reset() {
    clearInput(); var p = world(0.42, 0.90), r = world(0.43, 0.16); boat = { x: p.x, y: p.y, vx: 0, vy: 0, heading: -Math.PI / 2, moored: null, colliding: false }; raft = { x: r.x, y: r.y, vx: 0, vy: 0, heading: 0, omega: 0, attached: false, unloaded: false, colliding: false, lineRest: 34 };
    cargo = []; delivered = {}; completed = []; transfer = null; wakes = []; stage = -1; subtask = 0; waypointIndex = 0; active = false; paused = false; won = false; power = 0; doneAt = 0; clock = 0; last = 0; wakeClock = 0; lastManualAt = -100; manualTravel = 0; legTravel = 0;
    stepMisses = 0; collisions = 0; raftCollisions = 0; dockRetries = 0; dockings = 0; loads = 0; unloads = 0; attaches = 0; checkpoints = 0; lastMissAt = -100; lastCollisionAt = -100; said = {}; scene = null; baseCurrent = { x: 0, y: 0 }; current = { x: 0, y: 0 };
    banner("The island neighbours are waiting for their post."); hud(); draw();
  }
  function finale() { clearInput(); active = false; paused = false; power = 0; doneAt = 0; boat.vx = 0; boat.vy = 0; won = completed.length >= count && delivered.mouse && delivered.heron && delivered.turtle && delivered.door; banner(won ? "Every parcel reached its own home!" : "The little postboat is ready for another journey."); hud(); draw(); }
  function destroy() {
    if (!initialized) return; destroyed = true; clearInput(); if (raf) cancelAnimationFrame(raf); raf = 0; listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); }); listeners = [];
    if (root && root.parentNode) root.parentNode.removeChild(root); if (cv) cv.classList.remove("daily-postboat-canvas"); if (helpEl) { helpEl.classList.remove("postboat-help", "powered"); helpEl.disabled = false; } if (bannerEl) bannerEl.classList.remove("postboat-banner"); initialized = false; active = false; stage = -1; publish();
  }
  window.DailyAdventureGames = window.DailyAdventureGames || {};
  window.DailyAdventureGames.postboat = {
    init: function (a, n) {
      if (initialized) destroy(); api = a; count = n === 8 ? 8 : 5; younger = count === 5; destroyed = false; initialized = true; away = false; boat = {}; raft = {}; buttons = {};
      cv = $("dailyCanvas"); layer = $("dailyControls"); bannerEl = $("dailyBanner"); helpEl = $("dailyHelp"); if (!cv || !layer) throw new Error("Postboat needs dailyCanvas and dailyControls"); ctx = cv.getContext("2d");
      cv.classList.add("daily-postboat-canvas"); if (bannerEl) bannerEl.classList.add("postboat-banner"); if (helpEl) helpEl.classList.add("postboat-help"); reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      [["map","/assets/crafted/daily/day05-postboat-harbour-v1.webp"],["boat","/assets/crafted/daily/day05-postboat-v1.webp"],["wood","/assets/crafted/painted-wood-ivory.webp"]].forEach(function (p) { var img = new Image(); img.onload = function () { draw(); }; img.src = p[1]; images[p[0]] = img; });
      makeGoals(); controls(); fit(); reset(); raf = requestAnimationFrame(frame);
    },
    onWord: onWord,
    onHelp: function () { if (destroyed || !active || doneAt) return; paused = false; power = POWER; last = 0; banner("Calm water! Steer gently and leave room for your tow."); hud(); draw(); },
    pause: pause,
    resume: function (playing) { paused = playing === false; last = 0; hud(); draw(); },
    reset: reset,
    finale: finale,
    finish: finale,
    destroy: destroy
  };
})();
