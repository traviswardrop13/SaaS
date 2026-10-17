/* Robot Builder: a real rotate-the-wires puzzle, one circuit per robot part.
   Say & Play owns every word, microphone, rep, permission and voice. This
   board only owns finger play. Speech reveals the blueprint; it never turns
   a connector, tests a circuit, or assembles a part for the child. */
(function () {
  "use strict";
  var api = null, tiles = [], buttons = [], stage = 0, assembled = 0;
  var active = false, paused = false, boardReady = false, connected = false, solved = false, won = false;
  var startRow = 1, endRow = 1, blueprint = 0, POWER = 10, rotations = 0, tests = 0, hintIndex = -1;
  var raf = 0, lastTime = 0, away = false, boardPath = [], total = 8;
  var $ = function (id) { return document.getElementById(id); };
  var DIRS = [1, 2, 4, 8], OPPOSITE = [4, 8, 1, 2], DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  var NAMES = ["north", "east", "south", "west"];
  // Eight hand-made routes. The first is a short, straight introduction;
  // the last visits all nine tiles. Adjacent indices are always neighbours.
  var PATHS = [
    [3, 4, 5],
    [0, 3, 4, 5],
    [6, 3, 4, 1, 2],
    [0, 1, 4, 7, 8],
    [3, 0, 1, 4, 5],
    [6, 7, 4, 1, 2, 5, 8],
    [0, 3, 6, 7, 4, 5, 2],
    [6, 3, 0, 1, 4, 7, 8, 5, 2]
  ];
  var PARTS = [
    { id: "leg-left", name: "left leg" }, { id: "leg-right", name: "right leg" },
    { id: "torso", name: "body" }, { id: "arm-left", name: "left arm" },
    { id: "arm-right", name: "right arm" }, { id: "head", name: "head" },
    { id: "antenna", name: "antenna" }, { id: "heart", name: "heart" }
  ];
  var partEls = [], keptImages = [];
  function rotateMask(mask, turns) {
    turns = ((turns % 4) + 4) % 4;
    while (turns--) mask = ((mask << 1) & 15) | ((mask >> 3) & 1);
    return mask;
  }
  function maskAt(i) { return rotateMask(tiles[i].mask, tiles[i].rotation); }
  function direction(from, to) {
    if (to === from - 3) return 1;
    if (to === from + 1) return 2;
    if (to === from + 3) return 4;
    return 8;
  }
  function targetRotation(base, target) {
    for (var r = 0; r < 4; r++) if (rotateMask(base, r) === target) return r;
    return 0;
  }
  function wirePath(mask) {
    var d = "";
    if (mask & 1) d += "M50 50V0";
    if (mask & 2) d += "M50 50H100";
    if (mask & 4) d += "M50 50V100";
    if (mask & 8) d += "M50 50H0";
    return d;
  }
  function makePuzzle(index) {
    stage = index; boardPath = PATHS[index % PATHS.length].slice();
    startRow = Math.floor(boardPath[0] / 3); endRow = Math.floor(boardPath[boardPath.length - 1] / 3);
    tiles = []; rotations = 0; tests = 0; solved = false; hintIndex = -1; connected = false;
    for (var i = 0; i < 9; i++) {
      var at = boardPath.indexOf(i), target;
      if (at >= 0) target = (at === 0 ? 8 : direction(i, boardPath[at - 1])) | (at === boardPath.length - 1 ? 2 : direction(i, boardPath[at + 1]));
      else target = rotateMask((i + index) % 2 ? 3 : 5, (i + index) % 4);
      var base = target === 5 || target === 10 ? 5 : 3;
      var correct = targetRotation(base, target);
      tiles.push({ mask: base, rotation: (correct + 1 + (i + index) % 3) % 4, correctRotation: correct, inPath: at >= 0, powered: false });
    }
    // Removing the source's west-facing connector makes initial disconnection
    // certain, even if a different lucky route exists through the spare tiles.
    var first = boardPath[0];
    while (maskAt(first) & 8) tiles[first].rotation = (tiles[first].rotation + 1) % 4;
    $("robotSource").style.top = ((startRow + 0.5) * 100 / 3) + "%";
    $("robotSocket").style.top = ((endRow + 0.5) * 100 / 3) + "%";
    $("robotPartName").textContent = "Power the " + PARTS[stage].name;
    updateNetwork(); paint();
  }
  // Only reciprocal, edge-adjacent wires carry power. A tile merely pointing
  // at the socket or a disconnected loop cannot complete a circuit.
  function updateNetwork() {
    for (var i = 0; i < tiles.length; i++) tiles[i].powered = false;
    var first = startRow * 3, target = endRow * 3 + 2, queue = [];
    if (tiles.length && (maskAt(first) & 8)) { tiles[first].powered = true; queue.push(first); }
    for (var q = 0; q < queue.length; q++) {
      var at = queue[q], row = Math.floor(at / 3), col = at % 3, mask = maskAt(at);
      for (var d = 0; d < 4; d++) {
        var r = row + DY[d], c = col + DX[d], next = r * 3 + c;
        if (!(mask & DIRS[d]) || r < 0 || r > 2 || c < 0 || c > 2) continue;
        if ((maskAt(next) & OPPOSITE[d]) && !tiles[next].powered) { tiles[next].powered = true; queue.push(next); }
      }
    }
    connected = !!(tiles.length && tiles[target].powered && (maskAt(target) & 2));
  }
  function labelFor(i) {
    var list = [], mask = maskAt(i);
    for (var d = 0; d < 4; d++) if (mask & DIRS[d]) list.push(NAMES[d]);
    return "Wire " + (i + 1) + ", row " + (Math.floor(i / 3) + 1) + ", column " + (i % 3 + 1) + ". Connects " + list.join(" and ") + ". " + (tiles[i].powered ? "Power is here. " : "") + "Tap to turn clockwise.";
  }
  function paintTile(i) {
    var tile = tiles[i], b = buttons[i]; if (!b || !tile) return;
    b.className = "robot-tile" + (tile.powered ? " powered" : "") + (blueprint > 0 && tile.inPath ? " blueprint" : "") + (i === hintIndex ? " look-here" : "");
    b.disabled = !active || paused || !boardReady || solved || won || away || document.hidden;
    b.setAttribute("aria-label", labelFor(i));
    b.setAttribute("data-rotation", String(tile.rotation));
    b.querySelector(".wire-turn").setAttribute("transform", "rotate(" + (tile.rotation * 90) + " 50 50)");
    b.querySelector(".wire-back").setAttribute("d", wirePath(tile.mask));
    b.querySelector(".wire-line").setAttribute("d", wirePath(tile.mask));
    b.querySelector(".wire-ghost").setAttribute("d", tile.inPath ? wirePath(rotateMask(tile.mask, tile.correctRotation)) : "");
  }
  function publish() {
    window.__robot = { active: active, paused: paused, stage: stage, stages: total, blueprint: blueprint, boardReady: boardReady,
      connected: connected, solved: solved, assembled: assembled, won: won, startRow: startRow, endRow: endRow,
      rotations: rotations, tests: tests, hintIndex: hintIndex,
      tiles: tiles.map(function (tile) { return { mask: tile.mask, rotation: tile.rotation, correctRotation: tile.correctRotation, inPath: tile.inPath, powered: tile.powered }; }) };
  }
  function paintBridges() {
    var layer = $("robotBridges"); if (!layer || !buttons.length) return;
    var box = $("robotPuzzle").getBoundingClientRect(), board = $("robotBoard").getBoundingClientRect();
    var rects = buttons.map(function (b) { var r = b.getBoundingClientRect(); return { x: r.left - box.left, y: r.top - box.top, right: r.right - box.left, bottom: r.bottom - box.top, w: r.width, h: r.height }; });
    var width = Math.max(4, (rects[0].w - 4) * 0.11), paths = [];
    function bridge(a, b, pale) {
      var r = rects[a], s = rects[b], d;
      if (Math.floor(a / 3) === Math.floor(b / 3)) { if (r.x > s.x) { var temp = r; r = s; s = temp; } d = "M" + (r.right - 2) + " " + (r.y + r.h / 2) + "H" + (s.x + 2); }
      else { if (r.y > s.y) { var swap = r; r = s; s = swap; } d = "M" + (r.x + r.w / 2) + " " + (r.bottom - 2) + "V" + (s.y + 2); }
      paths.push('<path class="' + (pale ? "bridge-ghost" : tiles[a].powered && tiles[b].powered ? "bridge-live" : "bridge-wire") + '" stroke-width="' + (pale ? width * 3 : width) + '" d="' + d + '"/>');
    }
    // Tile borders and their touch gaps must not make a genuinely connected
    // circuit look broken. These bridges have no hit area and carry no rules.
    if (blueprint > 0) for (var p = 1; p < boardPath.length; p++) bridge(boardPath[p - 1], boardPath[p], true);
    for (var i = 0; i < tiles.length; i++) {
      if (i % 3 < 2 && (maskAt(i) & 2) && (maskAt(i + 1) & 8)) bridge(i, i + 1, false);
      if (i < 6 && (maskAt(i) & 4) && (maskAt(i + 3) & 1)) bridge(i, i + 3, false);
    }
    var first = rects[startRow * 3], end = rects[endRow * 3 + 2];
    var left = Math.max(0, board.left - box.left - 30), right = Math.max(0, box.right - board.right - 30);
    $("robotSource").style.left = left + "px"; $("robotSource").style.top = (first.y + first.h / 2) + "px";
    $("robotSocket").style.right = right + "px"; $("robotSocket").style.top = (end.y + end.h / 2) + "px";
    paths.push('<path class="' + (tiles[startRow * 3].powered ? "bridge-live" : "bridge-wire") + '" stroke-width="' + width + '" d="M' + (left + 24) + ' ' + (first.y + first.h / 2) + 'H' + (first.x + 2) + '"/>');
    paths.push('<path class="' + (connected ? "bridge-live" : "bridge-wire") + '" stroke-width="' + width + '" d="M' + (end.right - 2) + ' ' + (end.y + end.h / 2) + 'H' + (box.width - right - 24) + '"/>');
    layer.setAttribute("viewBox", "0 0 " + box.width + " " + box.height); layer.innerHTML = paths.join("");
  }
  function paint() {
    var locked = !active || paused || !boardReady || solved || won || away || document.hidden;
    for (var i = 0; i < tiles.length; i++) paintTile(i);
    $("robotTest").disabled = locked; $("robotHelp").disabled = locked;
    $("robotSocket").classList.toggle("live", connected);
    $("robotPuzzle").classList.toggle("locked", locked);
    $("robotPower").hidden = !(blueprint > 0 && active && !won);
    $("robotPowerFill").style.width = (blueprint / POWER * 100) + "%";
    $("robotGuide").textContent = won ? "A new friend, built by you!" : connected ? "The socket is glowing. Test the power!" : blueprint > 0 ? "The pale lines show the way" : "Tap a wire to turn it";
    $("robotStand").setAttribute("aria-label", assembled === 8 ? "Your complete toy robot" : "Your robot with " + assembled + " parts assembled");
    $("robotStand").classList.toggle("complete", assembled === 8);
    $("robotPartName").textContent = won ? "Your new robot friend" : solved ? "" : "Power the " + PARTS[stage].name;
    paintBridges();
    publish();
  }
  function setBanner(text) { $("robotBanner").textContent = text; }
  function turnTile(index) {
    if (!active || paused || !boardReady || solved || won || away || document.hidden) return;
    tiles[index].rotation = (tiles[index].rotation + 1) % 4;
    rotations++; hintIndex = -1; updateNetwork();
    setBanner(connected ? "It's connected! Test the power" : "Join the wires, battery to socket");
    paint();
  }
  function findOpenWire() {
    var first = startRow * 3;
    if (!(maskAt(first) & 8)) return first;
    // A gentle nudge follows the powered prefix, never rotates it. This still
    // helps a child after the timed blueprint has disappeared.
    for (var i = 0; i < boardPath.length; i++) {
      var at = boardPath[i], tile = tiles[at];
      if (maskAt(at) !== rotateMask(tile.mask, tile.correctRotation)) return at;
    }
    return first;
  }
  function testPower() {
    if (!active || paused || !boardReady || solved || won || away || document.hidden) return;
    tests++; updateNetwork();
    if (!connected) {
      hintIndex = findOpenWire();
      setBanner("A little gap. Try this wire!"); paint(); return;
    }
    solved = true; active = false; blueprint = 0; hintIndex = -1;
    assembled = Math.max(assembled, stage + 1);
    var part = partEls[stage];
    if (part) { part.classList.add("assembled"); part.classList.add("just-built"); }
    setBanner("The " + PARTS[stage].name + " is ready!");
    // Say & Play delays this chime if its microphone/audio route is still
    // settling. The board never creates a sound or its own microphone.
    api.sfx("correct"); paint(); api.done();
  }
  function earnBlueprint() {
    if (!boardReady || solved || won) return;
    blueprint = POWER; paused = false; active = true; lastTime = 0;
    setBanner("Blueprint! Turn the wires to match"); paint();
  }
  function help() {
    if (!active || paused || !boardReady || solved || won || away || document.hidden) return;
    api.practice();
  }
  function fallbackPart(id) {
    var fill = 'fill="#80d2d7" stroke="#397e85" stroke-width="5"', ivory = 'fill="#fff6e9" stroke="#c9b99c" stroke-width="4"';
    if (id === "head") return '<rect x="12" y="15" width="96" height="72" rx="27" ' + ivory + '/><rect x="24" y="29" width="72" height="43" rx="18" fill="#28576a"/><circle cx="44" cy="48" r="6" fill="#bbf2f0"/><circle cx="77" cy="48" r="6" fill="#bbf2f0"/><path d="M50 61q10 8 20 0" fill="none" stroke="#bbf2f0" stroke-width="3" stroke-linecap="round"/>';
    if (id === "torso") return '<rect x="18" y="9" width="84" height="85" rx="25" ' + ivory + '/><rect x="30" y="22" width="60" height="47" rx="16" ' + fill + '/><circle cx="44" cy="80" r="5" fill="#c4a45f"/><circle cx="76" cy="80" r="5" fill="#c4a45f"/>';
    if (id === "heart") return '<path d="M60 84 22 48C2 22 39 2 60 30 82 2 117 22 98 48Z" fill="#d98b9f" stroke="#b56680" stroke-width="5"/><path d="m37 46 14-5 8 15 10-24 12 14" fill="none" stroke="#fff6e9" stroke-width="4" stroke-linecap="round"/>';
    if (id === "antenna") return '<path d="M60 90V43" fill="none" stroke="#b4aa8b" stroke-width="14"/><circle cx="60" cy="26" r="19" fill="#e5cc7e" stroke="#b5a15e" stroke-width="5"/><ellipse cx="60" cy="90" rx="37" ry="8" fill="#69c7cf"/>';
    if (id.indexOf("leg") === 0) return '<rect x="35" y="9" width="50" height="64" rx="19" ' + fill + '/><rect x="22" y="63" width="75" height="29" rx="13" ' + ivory + '/><path d="M43 32H77M43 49H77" stroke="#9fe5e6" stroke-width="5"/>';
    return '<circle cx="60" cy="23" r="19" ' + ivory + '/><rect x="36" y="31" width="48" height="49" rx="19" ' + fill + '/><circle cx="60" cy="82" r="16" ' + ivory + '/>';
  }
  function buildRobot() {
    var stand = $("robotStand");
    PARTS.forEach(function (part, index) {
      var el = document.createElement("div"); el.className = "robot-piece piece-" + part.id;
      el.setAttribute("data-part", part.id); el.setAttribute("aria-hidden", "true");
      var fallback = document.createElement("span"); fallback.className = "robot-fallback";
      fallback.innerHTML = '<svg viewBox="0 0 120 100" aria-hidden="true">' + fallbackPart(part.id) + "</svg>";
      el.appendChild(fallback);
      var img = new Image(); img.alt = ""; img.draggable = false;
      img.onload = function () { if (img.naturalWidth) el.classList.add("art-ready"); };
      img.onerror = function () { el.classList.remove("art-ready"); img.hidden = true; };
      img.src = "/assets/crafted/game/robot-" + part.id + "-v1.webp";
      keptImages.push(img); el.appendChild(img); stand.appendChild(el); partEls[index] = el;
    });
  }
  function buildBoard() {
    var board = $("robotBoard");
    for (var i = 0; i < 9; i++) {
      var b = document.createElement("button"); b.type = "button"; b.className = "robot-tile";
      b.setAttribute("data-tile", String(i)); b.disabled = true;
      b.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="wire-screw" cx="10" cy="10" r="3"/><circle class="wire-screw" cx="90" cy="90" r="3"/><path class="wire-ghost"/><g class="wire-turn"><path class="wire-back"/><path class="wire-line"/><circle class="wire-hub" cx="50" cy="50" r="8"/></g></svg>';
      (function (index, button) {
        button.onclick = function () { turnTile(index); };
        button.onkeydown = function (event) {
          var next = index;
          if (event.key === "ArrowRight" && index % 3 < 2) next++;
          else if (event.key === "ArrowLeft" && index % 3 > 0) next--;
          else if (event.key === "ArrowDown" && index < 6) next += 3;
          else if (event.key === "ArrowUp" && index > 2) next -= 3;
          else return;
          event.preventDefault(); buttons[next].focus();
        };
      })(i, b);
      buttons.push(b); board.appendChild(b);
    }
  }
  function frame(now) {
    var dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0; lastTime = now;
    if (active && !paused && !away && !document.hidden && blueprint > 0) {
      blueprint = Math.max(0, blueprint - dt);
      $("robotPowerFill").style.width = (blueprint / POWER * 100) + "%";
      if (!blueprint) { setBanner("Your turn. Keep joining the wires!"); paint(); }
      else publish();
    }
    raf = requestAnimationFrame(frame);
  }
  function reset() {
    active = false; paused = false; boardReady = false; won = false; assembled = 0; blueprint = 0; lastTime = 0;
    $("robotStand").classList.remove("dancing");
    for (var i = 0; i < partEls.length; i++) { partEls[i].classList.remove("assembled"); partEls[i].classList.remove("just-built"); }
    makePuzzle(0); setBanner("A little robot, ready to come alive"); paint();
  }
  function pause() { paused = true; lastTime = 0; paint(); }
  function resume(playing) { paused = playing === false; lastTime = 0; paint(); }
  window.Robot = {
    init: function (a, n) {
      api = a; total = n || 8; buildRobot(); buildBoard(); reset();
      $("robotTest").onclick = testPower; $("robotHelp").onclick = help;
      window.addEventListener("resize", paint);
      document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
      window.addEventListener("pagehide", function () { away = true; pause(); cancelAnimationFrame(raf); raf = 0; });
      window.addEventListener("pageshow", function () { away = false; if (!raf) { lastTime = 0; raf = requestAnimationFrame(frame); } paint(); });
      raf = requestAnimationFrame(frame);
    },
    onWord: function (index) { makePuzzle(index); boardReady = true; earnBlueprint(); },
    onHelp: earnBlueprint,
    pause: pause,
    resume: resume,
    reset: reset,
    finale: function () { active = false; blueprint = 0; won = true; $("robotStand").classList.add("dancing"); setBanner("You brought your robot to life!"); paint(); }
  };
})();
