/* Dino Dig: the third Say & Play game rebuilt to be played (Travis, 1 Oct
   2026: "go finish soccer and then go to the next game"; Codex had started a
   Dino Dig preview, which never left his Mac). The plan: say the word and get
   a brush; rub the sand with a finger to uncover a bone; the bone flies onto
   the dinosaur's skeleton; eight words, eight bones, then the dinosaur wakes
   up and roars.

   DIFFERENT DINOSAURS (Travis, 1 Oct 2026: "i want to build different types
   of dinosaurs to look for not just one"). There are four, dug in order, a
   new one each round: T. rex, Triceratops, Stegosaurus, Brontosaurus, then
   round again. Each has its own skeleton on the cliff, its own eight bones
   and places in the pit, and its own body and colour when it wakes. Which
   one is next, and which have been found, belongs to the child: the page
   keeps it (Dino.setup below; this file never touches storage). The start
   card shows the one to look for, the end card names it, and both show the
   collection: found ones filled in, the rest as dashed outlines. No count is
   shown: it is a collection to come back for, never a grade.

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

   Its pictures are painted (Travis, 4 Oct 2026: "add the ChatGPT art"),
   from tools/art/game-sprites.json: the dig site, the sand and earth, and
   each dinosaur (the whole animal, facing right). A dinosaur's picture is
   fitted to its skeleton's outline and drawn in place of the drawn body, on
   the cliff when it wakes and on the cards once it is found; its bones fade
   away as it wakes, because a painting and a drawn skeleton never line up
   bone for bone. The skeleton, its outline and the bones stay drawn: they are
   what the child places. Each falls back to the drawn one until it loads.

   Nothing here is practice data: no attempt, rep, coin or sticker is written. */
(function () {
  "use strict";
  var api = null, cv = null, ctx = null, W = 0, H = 0, DPR = 1;
  var raf = 0, lastT = 0, clock = 0, running = false, frozen = false;

  // ── the drawing kit: every bone and every body is made of these ──
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  // A closed shape through points [x, y], or [x, y, 1] for a sharp corner (a
  // horn's tip, a tooth, a foot). A round point is a handle: the line passes
  // through the middle of each pair, so a handful of points makes a soft
  // animal and nothing here needs a curve worked out by hand.
  function outline(c, pts, k, ox, oy) {
    var n = pts.length, i, p, q, a = pts[n - 1], b = pts[0];
    function X(v) { return ox + v[0] * k; } function Y(v) { return oy + v[1] * k; }
    if (a[2]) c.moveTo(X(a), Y(a)); else if (b[2]) c.moveTo(X(b), Y(b)); else c.moveTo((X(a) + X(b)) / 2, (Y(a) + Y(b)) / 2);
    for (i = 0; i < n; i++) {
      p = pts[i]; q = pts[(i + 1) % n];
      if (p[2]) c.lineTo(X(p), Y(p));
      else if (q[2]) c.quadraticCurveTo(X(p), Y(p), X(q), Y(q));
      else c.quadraticCurveTo(X(p), Y(p), (X(p) + X(q)) / 2, (Y(p) + Y(q)) / 2);
    }
    c.closePath();
  }
  // the path starts ON the ellipse (a start anywhere else draws a stray line to it)
  function oval(c, x, y, rx, ry, rot) { c.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
  // parts: ["e", x, y, rx, ry, rot] an oval, ["o", points] an outline
  function partsPath(c, parts, k, ox, oy) {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p[0] === "e") oval(c, ox + p[1] * k, oy + p[2] * k, p[3] * k, p[4] * k, p[5] || 0);
      else outline(c, p[1], k, ox, oy);
    }
  }
  // How much room a shape takes: the same drawing, sent to a pretend canvas
  // that only remembers the furthest points. (Curve handles count, so the box
  // is a touch generous, which is the safe way round for fitting a bone in the pit.)
  function measure(draw) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    function see(x, y) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    draw({ moveTo: see, lineTo: see, closePath: function () {},
      quadraticCurveTo: function (a, b, x, y) { see(a, b); see(x, y); },
      ellipse: function (x, y, rx, ry) { var r = Math.max(rx, ry); see(x - r, y - r); see(x + r, y + r); } });
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  }

  // ── bone builders ──
  // a row of vertebrae along points [x, y, r]; spine: the height of the little
  // fin on top of each one (0 for a tail or a neck)
  function chain(pts, spine) {
    var parts = [], n = pts.length;
    for (var i = 0; i < n; i++) {
      var p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1, r = p[2];
      dx /= len; dy /= len;
      if (spine) {
        var nx = dy, ny = -dx; if (ny > 0) { nx = -nx; ny = -ny; }          // the side that points up
        var b0 = r * 0.5, b1 = r * 0.5 + spine, w = Math.max(2.4, r * 0.32);
        parts.push(["o", [[p[0] + nx * b0 - dx * w, p[1] + ny * b0 - dy * w, 1], [p[0] + nx * b1 - dx * w, p[1] + ny * b1 - dy * w, 1],
          [p[0] + nx * b1 + dx * w, p[1] + ny * b1 + dy * w, 1], [p[0] + nx * b0 + dx * w, p[1] + ny * b0 + dy * w, 1]]]);
      }
      parts.push(["e", p[0], p[1], r, r * 0.8, Math.atan2(dy, dx)]);
    }
    return parts;
  }
  // one straight bone from a to b, with a knob at each end
  function seg(x1, y1, x2, y2, th) {
    var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len * th, ny = dx / len * th;
    return [["o", [[x1 + nx, y1 + ny, 1], [x2 + nx, y2 + ny, 1], [x2 - nx, y2 - ny, 1], [x1 - nx, y1 - ny, 1]]],
      ["e", x1, y1, th * 1.3, th * 1.3, 0], ["e", x2, y2, th * 1.3, th * 1.3, 0]];
  }
  // a standing leg: a long bone with a knob at each end, and a little foot
  function limb(len, th, foot) {
    var h = len / 2, parts = [["o", [[-th, -h, 1], [th, -h, 1], [th, h, 1], [-th, h, 1]]]];
    [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sy) { parts.push(["e", sx * th * 0.9, sy * h, th * 0.95, th * 0.95, 0]); }); });
    if (foot) parts.push(["e", foot * 0.38, h + 7, foot, 5, 0]);
    return parts;
  }
  function ribs(n, gap, top, bot) {
    var parts = [], m = top + (bot - top) * 0.52;
    for (var i = 0; i < n; i++) { var x = (i - (n - 1) / 2) * gap; parts.push(["o", [[x - 4, top, 1], [x - 12, m], [x - 2, bot, 1], [x + 5, bot - 2, 1], [x - 4, m], [x + 4, top, 1]]]); }
    return parts;
  }
  // a back plate (Stegosaurus): a leaf standing on its base, leaning a little
  function plate(x, base, w, h, lean) { return [[x - w / 2, base, 1], [x - w * 0.62 + lean / 2, base - h * 0.5], [x + lean, base - h, 1], [x + w * 0.62 + lean / 2, base - h * 0.5], [x + w / 2, base, 1]]; }
  function leaves(list) { return list.map(function (p) { return ["o", plate(p[0], p[1], p[2], p[3], p[4])]; }); }
  // a neck frill (Triceratops): a fan round (x, y) from angle a0 to a1 (in
  // degrees, 0 to the right, -90 straight up), its rim in n scallops, closed
  // through the base points
  function fan(x, y, r, a0, a1, n, base) {
    var pts = [], st = (a1 - a0) / n, rad = Math.PI / 180;
    for (var i = 0; i <= n; i++) {
      var a = (a0 + i * st) * rad; pts.push([x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92, 1]);
      if (i < n) { a = (a0 + (i + 0.5) * st) * rad; pts.push([x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1]); }
    }
    return pts.concat(base);
  }
  function spike(x1, y1, tx, ty, x2, y2) { return ["o", [[x1, y1, 1], [tx, ty, 1], [x2, y2, 1]]]; }

  // ── the four dinosaurs ──
  // Each lives in a 440 x 230 board, facing right, feet near y = 198.
  //   look: the animal as it wakes, back to front. Each piece is an outline
  //         and what it is painted with: far (the legs on the far side), body,
  //         accent (plates, a frill), light, bone (horns, spikes) or white (teeth).
  //         hush: left out of the dashed outline, where a second horn or a
  //         second row of spikes only makes a scribble.
  //   bones: eight, in the order they are found; the last is always the
  //          skull. at: where it sits on the board. marks: eye sockets and
  //          the like, drawn on a found bone (never on its dashed outline).
  //          shout: what the dig calls out when a special one comes up.
  //   spots: where each bone lies in the pit (across, down; 0 to 1), so no
  //          two dinosaurs are dug in the same places.
  var SKULL_REX = [[-52, 8], [-50, -14], [-30, -25], [0, -25], [30, -17], [50, -7], [54, 8],
    [45, 16, 1], [41, 25, 1], [36, 17, 1], [31, 26, 1], [26, 18, 1], [21, 26, 1], [16, 19, 1], [11, 27, 1], [6, 20, 1], [1, 27, 1], [-4, 21, 1], [-24, 20], [-44, 18]];
  var JAW_REX = [[-40, -4], [-36, -14], [-22, -9, 1], [-16, -17, 1], [-10, -8, 1], [-4, -16, 1], [2, -7, 1], [8, -15, 1], [14, -6, 1], [20, -14, 1], [26, -5, 1], [36, -8], [41, 2], [22, 11], [-18, 9], [-38, 6]];
  var HORN_TRI = [[-36, -34, 1], [-12, -70], [28, -88, 1], [10, -54], [-12, -30, 1]];
  var SKULL_TRI = [[-44, -6], [-38, -28], [-24, -34, 1], [4, -66], [46, -80, 1], [28, -46], [2, -22, 1], [12, -16], [14, -16, 1], [30, -38, 1], [34, -6, 1], [42, 2], [52, 18, 1], [34, 22], [24, 38], [-10, 40], [-38, 30]];
  var SKULL_STEG = [[-24, -4], [-14, -14], [6, -12], [22, -6], [30, 4, 1], [16, 10], [-6, 12], [-22, 8]];
  var SKULL_LONG = [[-26, 6], [-23, -15], [-3, -23], [18, -18], [37, -7], [41, 6], [31, 15], [4, 17], [-18, 14]];

  var DINOS = [
    { id: "trex", name: "T. rex", a: "a", fill: "#8BD07A", edge: "#5FA04F", far: "#74BA63",
      look: [
        { as: "far", pts: [[266, 152], [278, 174], [268, 186], [296, 195, 1], [248, 197, 1], [246, 184], [238, 158]] },
        { as: "body", pts: [[62, 98, 1], [108, 86], [158, 78], [200, 74], [240, 74], [264, 62], [272, 38], [294, 16], [330, 13], [364, 22], [392, 36], [394, 58], [374, 67], [326, 70, 1],
          [366, 80], [382, 86], [370, 102], [322, 103], [298, 106], [294, 126], [282, 150], [254, 156], [256, 174], [244, 186], [272, 198, 1], [214, 199, 1], [212, 184], [192, 162], [172, 138], [130, 124], [94, 110]] },
        { as: "white", pts: [[338, 68, 1], [343, 75, 1], [348, 67, 1], [353, 75, 1], [358, 66, 1], [363, 74, 1], [368, 66, 1], [373, 73, 1], [378, 65, 1]] },
        { as: "white", pts: [[342, 76, 1], [347, 70, 1], [352, 78, 1], [357, 72, 1], [362, 80, 1], [367, 74, 1], [372, 82, 1]] },
        { as: "body", pts: [[284, 112], [302, 123], [316, 124, 1], [307, 129], [314, 137, 1], [300, 135], [282, 127]] },
      ],
      eye: [326, 36], cheek: [346, 54], nose: [382, 36],
      bones: [
        { id: "tail", at: [132, 100], parts: chain([[-50, -3, 4], [-33, -3, 5.5], [-15, -2, 7], [5, 0, 8.5], [26, 2, 10], [47, 4, 11.5]], 0) },
        { id: "leg", at: [228, 152], shout: "A big leg!", parts: seg(-16, -36, 12, -2, 8).concat(seg(12, -2, -4, 30, 6), seg(-4, 30, 28, 42, 4.5)) },
        { id: "hip", at: [206, 104], parts: [["e", 0, 0, 25, 15, 0]] },
        { id: "back", at: [246, 88], parts: chain([[-26, 6, 8.5], [-10, 3, 8.5], [6, -2, 8.5], [20, -9, 8], [31, -19, 7.5], [39, -31, 7]], 7) },
        { id: "ribs", at: [254, 124], parts: ribs(4, 14, -16, 22) },
        { id: "arm", at: [299, 125], shout: "A tiny arm!", parts: seg(-11, -8, 1, 2, 2.8).concat(seg(1, 2, 12, 0, 2.4), [spike(11, -3, 21, -5, 13, 1), spike(11, 0, 20, 7, 10, 3)]) },
        { id: "jaw", at: [336, 88], shout: "The jaw!", parts: [["o", JAW_REX]] },
        { id: "skull", at: [336, 44], parts: [["o", SKULL_REX]], marks: [["e", -12, -5, 9, 8], ["e", 14, -2, 8, 6], ["e", 40, -5, 3, 3]] },
      ],
      spots: [[0.3, 0.5], [0.72, 0.5], [0.5, 0.62], [0.28, 0.42], [0.66, 0.6], [0.4, 0.4], [0.62, 0.45], [0.42, 0.55]] },

    { id: "tri", name: "Triceratops", a: "a", fill: "#B8A2F2", edge: "#8671CC", far: "#A28BE3", accent: "#A28BE3", light: "#D8CBFA",
      look: [
        { as: "far", pts: [[276, 160], [310, 160], [312, 195, 1], [280, 195, 1]] },
        { as: "far", pts: [[162, 160], [196, 160], [200, 195, 1], [166, 195, 1]] },
        { as: "accent", pts: fan(300, 86, 62, -205, -38, 6, [[344, 104], [264, 116]]) },
        { as: "light", pts: [[272, 100], [258, 78], [268, 50], [296, 40], [322, 46], [338, 66], [334, 96]] },
        { as: "bone", hush: 1, pts: [[318, 96, 1], [344, 60], [384, 44, 1], [368, 78], [344, 104, 1]] },
        { as: "body", pts: [[36, 152, 1], [80, 130], [116, 106], [166, 88], [220, 88], [256, 98], [300, 96], [330, 100], [362, 116], [390, 130], [410, 152, 1], [390, 156], [380, 172], [344, 176],
          [308, 166], [290, 166], [290, 199, 1], [252, 199, 1], [248, 168], [214, 172], [184, 168], [182, 199, 1], [142, 199, 1], [134, 166], [106, 154], [72, 156]] },
        { as: "bone", pts: [[330, 98, 1], [360, 66], [404, 52, 1], [384, 90], [356, 112, 1]] },
        { as: "bone", pts: [[368, 118, 1], [386, 96, 1], [390, 130, 1]] },
      ],
      eye: [346, 126], cheek: [366, 152],
      bones: [
        { id: "tail", at: [76, 140], parts: chain([[-34, 10, 3.5], [-20, 4, 5], [-6, -2, 6.5], [10, -8, 8], [26, -14, 9.5]], 0) },
        { id: "leg", at: [162, 168], parts: limb(44, 7.5, 13) },
        { id: "hip", at: [156, 124], parts: [["e", 0, 0, 25, 15, 0]] },
        { id: "back", at: [212, 112], parts: chain([[-46, 1, 9], [-28, -1, 9], [-9, -2, 9], [9, -2, 9], [28, -1, 9], [46, 2, 9]], 7) },
        { id: "ribs", at: [214, 138], parts: ribs(4, 21, -18, 22) },
        { id: "arm", at: [270, 172], parts: limb(40, 7, 13) },
        { id: "frill", at: [300, 86], shout: "The frill!", parts: [["o", fan(0, 0, 56, -205, -38, 6, [[40, 16], [-34, 26]])]],
          marks: [["l", [-8, 10], [-22, -8], [-38, -24]], ["l", [0, 8], [-2, -18], [-6, -44]], ["l", [8, 8], [18, -12], [28, -32]]] },
        { id: "skull", at: [356, 134], shout: "The horns!", parts: [["o", HORN_TRI], ["o", SKULL_TRI]], marks: [["e", -10, -8, 5.5, 6.5]] },
      ],
      spots: [[0.7, 0.5], [0.3, 0.5], [0.52, 0.4], [0.5, 0.62], [0.26, 0.45], [0.74, 0.55], [0.36, 0.55], [0.6, 0.5]] },

    { id: "steg", name: "Stegosaurus", a: "a", fill: "#79C9DD", edge: "#4A9BB3", far: "#62B6CC", accent: "#FF8F86", accentEdge: "#D9655E",
      look: [
        { as: "far", pts: [[292, 158], [322, 158], [326, 195, 1], [296, 195, 1]] },
        { as: "far", pts: [[170, 152], [208, 152], [212, 195, 1], [176, 195, 1]] },
        { as: "accent", pts: plate(330, 126, 18, 22, 6) }, { as: "accent", pts: plate(298, 108, 24, 34, 4) }, { as: "accent", pts: plate(262, 92, 30, 46, 2) },
        { as: "accent", pts: plate(222, 82, 34, 54, 0) }, { as: "accent", pts: plate(182, 86, 32, 48, -2) }, { as: "accent", pts: plate(144, 100, 26, 36, -4) },
        { as: "accent", pts: plate(110, 110, 20, 26, -5) }, { as: "accent", pts: plate(82, 116, 14, 18, -5) },
        { as: "bone", pts: [[38, 116, 1], [20, 80, 1], [58, 112, 1]] }, { as: "bone", pts: [[62, 112, 1], [52, 76, 1], [82, 108, 1]] },
        { as: "body", pts: [[28, 118, 1], [70, 110], [112, 100], [160, 82], [214, 72], [268, 82], [312, 104], [346, 126], [376, 136], [400, 144], [409, 155, 1], [392, 161], [364, 161],
          [334, 152], [312, 160], [310, 199, 1], [276, 199, 1], [272, 164], [236, 170], [196, 164], [194, 199, 1], [152, 199, 1], [146, 156], [116, 134], [72, 130]] },
        { as: "bone", hush: 1, pts: [[40, 122, 1], [20, 150, 1], [58, 126, 1]] }, { as: "bone", hush: 1, pts: [[64, 126, 1], [54, 156, 1], [82, 128, 1]] },
      ],
      eye: [386, 147], cheek: [376, 155],
      bones: [
        { id: "tail", at: [80, 118], shout: "A spiky tail!", parts: chain([[-42, 1, 3.5], [-26, 0, 5], [-10, -2, 6.5], [8, -5, 8], [26, -9, 9.5], [44, -15, 11]], 0)
          .concat([spike(-50, -3, -62, -34, -36, -5), spike(-32, -5, -38, -38, -18, -8), spike(-46, 5, -62, 30, -32, 7), spike(-28, 6, -34, 34, -14, 5)]) },
        { id: "leg", at: [174, 166], parts: limb(48, 8, 13) },
        { id: "hip", at: [172, 112], parts: [["e", 0, 0, 26, 15, 0]] },
        { id: "back", at: [234, 100], parts: chain([[-34, -3, 8.5], [-12, -7, 9], [10, -7, 9], [32, -2, 8.5], [52, 7, 8], [70, 18, 7]], 4) },
        { id: "ribs", at: [236, 134], parts: ribs(4, 22, -18, 22) },
        { id: "arm", at: [292, 174], parts: limb(36, 7, 12) },
        { id: "plates", at: [222, 60], shout: "The plates!", parts: leaves([[-78, 40, 22, 30, -4], [-40, 26, 28, 42, -2], [0, 20, 32, 50, 0], [40, 26, 28, 42, 2], [78, 44, 22, 30, 4]]) },
        { id: "skull", at: [380, 150], parts: [["o", SKULL_STEG], ["e", -34, -12, 6.5, 5.5, 0.6], ["e", -47, -21, 7, 6, 0.6]], marks: [["e", 6, -3, 3.5, 3.5]] },
      ],
      spots: [[0.5, 0.45], [0.26, 0.5], [0.72, 0.6], [0.4, 0.6], [0.66, 0.42], [0.3, 0.45], [0.5, 0.55], [0.7, 0.5]] },

    { id: "bronto", name: "Brontosaurus", a: "a", fill: "#F3A2C3", edge: "#C8709A", far: "#E58DB2",
      look: [
        { as: "far", pts: [[276, 154], [312, 154], [314, 195, 1], [282, 195, 1]] },
        { as: "far", pts: [[178, 154], [216, 154], [220, 195, 1], [184, 195, 1]] },
        { as: "body", pts: [[24, 160, 1], [84, 140], [136, 116], [190, 96], [244, 94], [280, 100], [298, 70], [312, 34], [330, 12], [356, 5], [384, 13], [395, 28], [380, 42], [352, 44],
          [340, 62], [332, 104], [320, 140], [300, 156], [298, 199, 1], [258, 199, 1], [254, 162], [224, 166], [204, 162], [202, 199, 1], [160, 199, 1], [154, 158], [122, 152], [70, 160]] },
      ],
      eye: [370, 21], cheek: [380, 33],
      bones: [
        { id: "tail", at: [86, 146], parts: chain([[-52, 9, 4], [-32, 5, 5.5], [-12, 0, 7], [10, -6, 8.5], [32, -13, 10], [52, -21, 11]], 0) },
        { id: "leg", at: [182, 168], parts: limb(44, 7.5, 13) },
        { id: "hip", at: [174, 124], parts: [["e", 0, 0, 26, 15, 0]] },
        { id: "back", at: [230, 114], parts: chain([[-52, 1, 10], [-31, -1, 10], [-10, -3, 10], [11, -3, 10], [32, -1, 10], [52, 3, 9.5]], 8) },
        { id: "ribs", at: [230, 138], parts: ribs(4, 24, -18, 24) },
        { id: "arm", at: [278, 170], parts: limb(38, 7, 13) },
        { id: "neck", at: [314, 72], shout: "The long neck!", parts: chain([[-18, 38, 9], [-10, 20, 8.5], [-2, 2, 8], [6, -16, 7.5], [14, -33, 7]], 0) },
        { id: "skull", at: [357, 25], size: 0.86, parts: [["o", SKULL_LONG]], marks: [["e", 16, -4, 5, 6], ["l", [6, 10], [20, 15], [34, 8]]] },
      ],
      spots: [[0.6, 0.42], [0.3, 0.55], [0.7, 0.5], [0.5, 0.6], [0.36, 0.4], [0.64, 0.6], [0.5, 0.45], [0.3, 0.5]] },
  ];
  // room for each bone and each animal, worked out once from its own drawing
  DINOS.forEach(function (d) {
    d.bones.forEach(function (b) { b.box = measure(function (c) { partsPath(c, b.parts, 1, 0, 0); }); });
    d.box = measure(function (c) { d.look.forEach(function (l) { outline(c, l.pts, 1, 0, 0); }); });
  });
  function byId(id) { for (var i = 0; i < DINOS.length; i++) if (DINOS[i].id === id) return i; return -1; }

  // painted pictures, when they arrive (see the top of this file). No address
  // until then, so no page asks for a file that isn't there.
  var ART = { trex: "/assets/crafted/game/dino-trex.webp", tri: "/assets/crafted/game/dino-tri.webp", steg: "/assets/crafted/game/dino-steg.webp", bronto: "/assets/crafted/game/dino-bronto.webp" }, art = {};
  var SITE = new Image(), SAND = new Image(), SOIL = new Image();
  SITE.src = "/assets/crafted/game/dino-site.webp"; SOIL.src = "/assets/crafted/game/dino-soil.webp";
  SAND.onload = function () { if (sand && grid) remakeSand(true); };
  SAND.src = "/assets/crafted/game/dino-sand.webp";
  // a dinosaur's painted picture, fitted to its drawn outline (d.box, in board
  // units) so it stands where its skeleton is, its feet on the same line
  function drawArt(c, d, k, ox, oy) {
    var img = art[d.id], b = d.box, sc = Math.min(b.w / img.naturalWidth, b.h / img.naturalHeight) * k, w = img.naturalWidth * sc, h = img.naturalHeight * sc;
    c.drawImage(img, ox + b.x * k - w / 2, oy + (b.y + b.h / 2) * k - h, w, h);   // b.x, b.y: the outline's centre
  }
  DINOS.forEach(function (d) {
    if (!ART[d.id]) return;
    var img = new Image(); img.onload = function () { art[d.id] = img; paintCards(); }; img.src = ART[d.id];
  });

  // ── which dinosaur: the child's, kept by the page (Dino.setup) ──
  // kept.last: the one found most recently (the next one follows it);
  // kept.got: every one found so far. Named, not numbered, so a fifth
  // dinosaur added one day joins the round without moving anyone's place.
  var store = null, kept = { last: "", got: [] }, cur = DINOS[0];
  function recall() {
    var v = null; try { v = store && store.read ? store.read() : null; } catch (e) {}
    kept = { last: "", got: [] };
    if (v && typeof v === "object") {
      if (byId(v.last) >= 0) kept.last = v.last;
      if (v.got && v.got.length) for (var i = 0; i < v.got.length; i++) if (byId(v.got[i]) >= 0 && kept.got.indexOf(v.got[i]) < 0) kept.got.push(v.got[i]);
    }
    upNext();
  }
  // the one to look for is the one after the last one found
  function upNext() { cur = DINOS[(byId(kept.last) + 1) % DINOS.length]; }
  function remember() {
    if (kept.got.indexOf(cur.id) < 0) kept.got.push(cur.id);
    kept.last = cur.id;
    try { if (store && store.write) store.write({ last: kept.last, got: kept.got.slice() }); } catch (e) {}
    try { if (store && store.found) store.found({ id: cur.id, name: cur.name, a: cur.a }); } catch (e) {}
  }

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
  // HORN: the horns and spikes of a woken dinosaur, a shade warmer than a dug
  // bone, so they still show on a cream card
  var BONE = "#FFF8EC", BONE_EDGE = "#B9A27E", SOCKET = "#6E5434", HORN = "#F6E7CB";

  // one bone, drawn with its own middle at (x, y), at scale k (1 = its size on the board)
  // sockets: how strongly a found bone's eye sockets show (1 unless given).
  // They fade right out as the dinosaur wakes: under its own eye, the T. rex's
  // two sockets and nostril read as three more eyes.
  function drawBone(c, b, x, y, k, rot, alpha, ghost, sockets) {
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.globalAlpha = alpha == null ? 1 : alpha;
    c.beginPath(); partsPath(c, b.parts, k, 0, 0);
    if (ghost) { c.setLineDash([4, 5]); c.strokeStyle = "rgba(120,72,30,.45)"; c.lineWidth = 2; c.stroke(); c.setLineDash([]); }
    else {
      c.fillStyle = BONE; c.fill(); c.strokeStyle = BONE_EDGE; c.lineWidth = Math.max(1.5, 2.2 * k); c.lineJoin = "round"; c.stroke();
      (b.marks || []).forEach(function (m) {
        if (m[0] === "e") { if (sockets === 0) return; c.save(); if (sockets != null) c.globalAlpha *= sockets; c.fillStyle = SOCKET; c.beginPath(); c.ellipse(m[1] * k, m[2] * k, m[3] * k, m[4] * k, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
        else { c.strokeStyle = "#8A6F4E"; c.lineWidth = Math.max(1.2, 1.8 * k); c.beginPath(); c.moveTo(m[1][0] * k, m[1][1] * k); c.quadraticCurveTo(m[2][0] * k, m[2][1] * k, m[3][0] * k, m[3][1] * k); c.stroke(); }
      });
    }
    c.restore();
  }
  function boardPt(b) { return { x: board.x + b.at[0] * board.s, y: board.y + b.at[1] * board.s }; }

  function drawScene() {
    if (SITE.complete && SITE.naturalWidth) {
      var sc = Math.max(W / SITE.naturalWidth, H / SITE.naturalHeight), sw = SITE.naturalWidth * sc, sh = SITE.naturalHeight * sc;
      ctx.drawImage(SITE, (W - sw) / 2, 0, sw, sh); return;
    }
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
    ctx.fillStyle = "rgba(170,100,46,.22)"; rr(ctx, 14 * board.s, board.y - 4 * board.s, 412 * board.s, 219 * board.s, 40 * board.s); ctx.fill();
    // the ground in front of the pit
    ctx.fillStyle = "#F0C890"; ctx.fillRect(0, H * 0.58, W, H * 0.42);
  }

  // The whole animal, back to front, with its top-left corner of the board at
  // (ox, oy) and k pixels to a board unit. how: "awake" (its colours, an eye
  // and a cheek) or "todo" (a dashed outline: one still to find).
  function drawLook(c, d, k, ox, oy, how, lw) {
    var todo = how === "todo";
    if (!todo && art[d.id]) { drawArt(c, d, k, ox, oy); return; }
    c.lineJoin = "round"; c.lineWidth = lw;
    if (todo) {
      // One still to find is ONE dashed line round the whole animal. Every
      // piece is stroked, and then every piece is filled over those strokes,
      // so a line that would cross another piece (the frill behind the head, a
      // plate behind its neighbour, the arm on the chest) is covered and only
      // the outside edge is left. Drawn piece by piece, the Triceratops was a
      // bump and a scribble. Each fill is also a touch fatter than its piece
      // (fat: a solid edge in the fill's own colour), because two pieces that
      // nearly meet leave a sliver between them, and a sliver showed the lines
      // on both sides of it as stray hairs (where the Triceratops's horn sits
      // on its head); the dashed line is wider by the same amount, so what is
      // left outside is still lw thick. Only a touch: any fatter and a horn's
      // tip or a plate's point goes round. Long dashes and short gaps, because
      // a horn or a plate is only a few dashes long and with even ones its shape
      // falls apart; a solid colour, so two lines that meet don't make a dark blot.
      var whole = d.look.filter(function (l) { return !l.hush && l.as !== "white" && l.as !== "light"; }), fat = lw * 0.4;
      c.setLineDash([lw * 2.8, lw * 1.5]); c.strokeStyle = "#A07C58"; c.lineWidth = (lw + fat) * 2;
      whole.forEach(function (l) { c.beginPath(); outline(c, l.pts, k, ox, oy); c.stroke(); });
      c.setLineDash([]); c.fillStyle = "#FFF4DF"; c.strokeStyle = "#FFF4DF"; c.lineWidth = fat * 2;
      whole.forEach(function (l) { c.beginPath(); outline(c, l.pts, k, ox, oy); c.fill(); c.stroke(); });
      return;
    }
    d.look.forEach(function (l) {
      c.beginPath(); outline(c, l.pts, k, ox, oy);
      if (l.as === "white") { c.fillStyle = "#FFFFFF"; c.strokeStyle = "rgba(0,0,0,0)"; }
      else if (l.as === "bone") { c.fillStyle = HORN; c.strokeStyle = BONE_EDGE; }
      else if (l.as === "accent") { c.fillStyle = d.accent; c.strokeStyle = d.accentEdge || d.edge; }
      else if (l.as === "light") { c.fillStyle = d.light; c.strokeStyle = "rgba(0,0,0,0)"; }
      else { c.fillStyle = l.as === "far" ? d.far : d.fill; c.strokeStyle = d.edge; }
      c.fill(); if (l.as !== "light") c.stroke();
    });
    drawFace(c, d, k, ox, oy);
  }
  // a friendly face. On the cliff it goes on last, over the bones, so the
  // woken dinosaur looks at the child with its own eye, not its skull's.
  function drawFace(c, d, k, ox, oy) {
    c.fillStyle = "#2D3642"; c.beginPath(); c.arc(ox + d.eye[0] * k, oy + d.eye[1] * k, 3.6 * k, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(ox + (d.eye[0] + 1.2) * k, oy + (d.eye[1] - 1.3) * k, 1.2 * k, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#FFB7B2"; c.beginPath(); c.arc(ox + d.cheek[0] * k, oy + d.cheek[1] * k, 4 * k, 0, Math.PI * 2); c.fill();
    if (d.nose) { c.fillStyle = d.edge; c.beginPath(); c.arc(ox + d.nose[0] * k, oy + d.nose[1] * k, 1.8 * k, 0, Math.PI * 2); c.fill(); }
  }

  function drawSkeleton() {
    var wake = wakeAt >= 0 ? Math.min(1, (clock - wakeAt) / 0.8) : 0, bob = wakeAt >= 0 ? Math.sin((clock - wakeAt) * 6) * 3 * board.s : 0;
    ctx.save(); ctx.translate(0, -Math.abs(bob));
    // the dinosaur's body, drawn behind its bones as it wakes up
    if (wake > 0) { ctx.save(); ctx.globalAlpha = wake; drawLook(ctx, cur, board.s, board.x, board.y, "awake", 3); ctx.restore(); }
    for (var i = 0; i < cur.bones.length; i++) {
      var b = cur.bones[i], p = boardPt(b), k = board.s * (b.size || 1);
      if (i < found) drawBone(ctx, b, p.x, p.y, k, b.rot, wake > 0 ? 1 - wake * (art[cur.id] ? 1 : 0.62) : 1, false, 1 - wake);
      else if (!(fly && i === found)) drawBone(ctx, b, p.x, p.y, k, b.rot, 0.9, true);
    }
    if (wake > 0 && !art[cur.id]) { ctx.save(); ctx.globalAlpha = wake; drawFace(ctx, cur, board.s, board.x, board.y); ctx.restore(); }
    ctx.restore();
    // which one is being dug up, in the corner of the cliff
    ctx.font = "800 " + Math.round(Math.max(13, 17 * board.s)) + "px 'Baloo 2', Nunito, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(110,64,26,.8)"; ctx.fillText(cur.name, 14 * board.s, Math.max(6, H * 0.02));
  }

  // ── the sand over the current bone ──
  function remakeSand(keep) {
    var old = keep && sand ? sand : null;
    sand = document.createElement("canvas"); sand.width = Math.max(1, Math.round(pit.w)); sand.height = Math.max(1, Math.round(pit.h));
    sandCtx = sand.getContext("2d");
    sandCtx.fillStyle = "#EBC48A"; sandCtx.fillRect(0, 0, sand.width, sand.height);
    if (SAND.complete && SAND.naturalWidth) { sandCtx.fillStyle = sandCtx.createPattern(SAND, "repeat"); sandCtx.fillRect(0, 0, sand.width, sand.height); }
    else for (var i = 0; i < 260; i++) {
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
    if (SOIL.complete && SOIL.naturalWidth) { ctx.fillStyle = ctx.createPattern(SOIL, "repeat"); ctx.fillRect(pit.x, pit.y, pit.w, pit.h); }
    for (var i = 0; i < 40; i++) { ctx.fillStyle = "rgba(90,52,20,.18)"; ctx.beginPath(); ctx.arc(pit.x + ((i * 53) % 100) / 100 * pit.w, pit.y + ((i * 37 + 7) % 100) / 100 * pit.h, 2 + (i % 3), 0, Math.PI * 2); ctx.fill(); }
    if (dig && state !== "flying" && state !== "placed") {
      var pop = state === "found" ? Math.sin(Math.min(1, (clock - dig.foundAt) / 0.4) * Math.PI) * 10 : 0;
      drawBone(ctx, dig.bone, dig.ox, dig.oy - pop, dig.k, 0);
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
        // a long call ("Find the Stegosaurus!") is drawn smaller rather than off the edge
        var wide = ctx.measureText(f.text).width, room = W * (f.room || 0.86); if (wide > room) ctx.scale(room / wide, room / wide);
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
  function shout(text, big, where, room) { var p = where || { x: W / 2, y: H * 0.5 }; fx.push({ kind: "word", text: text, x: p.x, y: p.y, c: SHOUT, t: 0, life: big ? 2.4 : 1.3, big: big, room: room }); }

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
    if (fly) { var b = cur.bones[fly.i], k = Math.min(1, fly.t / fly.dur), e = 1 - Math.pow(1 - k, 3), p = boardPt(b);
      drawBone(ctx, b, fly.x + (p.x - fly.x) * e, fly.y + (p.y - fly.y) * e - Math.sin(k * Math.PI) * H * 0.12, fly.k + (board.s * (b.size || 1) - fly.k) * e, (b.rot || 0) * e); }
    drawHint(); drawFx(dt);
  }

  // ── the dig ──
  function step(dt) {
    if (doneAt && clock >= doneAt) { doneAt = 0; state = "idle"; remakeSand(false); publish(); if (api) api.done(); }
    if (state === "ready") {
      if (revealed() >= 0.6) uncover();
      publish();
    } else if (state === "found") {
      if (clock - dig.foundAt > 0.55) { state = "flying"; fly = { i: found, x: dig.ox, y: dig.oy, k: dig.k, t: 0, dur: 0.75 }; sound("whoosh"); publish(); }
    } else if (state === "flying") {
      fly.t += dt;
      if (fly.t >= fly.dur) placed();
    }
  }
  function sound(name) { if (api && api.sfx) try { api.sfx(name); } catch (e) {} }
  function uncover() {
    state = "found"; dig.foundAt = clock;
    // a bone's own call-out first: the Triceratops's skull is "The horns!"
    shout(dig.bone.shout || (found === cur.bones.length - 1 ? "The skull!" : ["A bone!", "Found one!", "Look!"][found % 3]), false, { x: W * 0.43, y: pit.y - 12 }, 0.72);   // left of Echo, who stands at the right of the cliff
    sound("pop");
    try { api.cheer("You found it!"); api.hint(""); if (api.face) api.face("cheer"); } catch (e) {}
    publish();
  }
  function placed() {
    var p = boardPt(cur.bones[fly.i]);
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

  // ── the cards: which one to look for, and the ones found so far ──
  // One small picture of a dinosaur on a card's own canvas: filled in once it
  // has been found, a dashed outline while it is still to find.
  function picture(canvas, d, how) {
    if (!canvas || !canvas.getContext) return;
    var c = canvas.getContext("2d"), w = canvas.width, h = canvas.height, pad = Math.max(3, w * 0.05);
    var k = Math.min((w - pad * 2) / d.box.w, (h - pad * 2) / d.box.h);
    c.clearRect(0, 0, w, h);
    drawLook(c, d, k, w / 2 - d.box.x * k, h / 2 - d.box.y * k, how, Math.max(3.2, w / 70));
  }
  function names(list) { return list.map(function (d) { return d.name; }).join(", "); }
  function row(el) {
    if (!el) return;
    el.innerHTML = "";
    DINOS.forEach(function (d) {
      var got = kept.got.indexOf(d.id) >= 0, c = document.createElement("canvas");
      c.width = 132; c.height = 84; c.setAttribute("data-dino", d.id); c.setAttribute("data-found", got ? "1" : "0");
      el.appendChild(c); picture(c, d, got ? "awake" : "todo");
    });
    // no "2 of 4": the row is a collection, and a count would read as a grade
    var have = DINOS.filter(function (d) { return kept.got.indexOf(d.id) >= 0; }), left = DINOS.filter(function (d) { return kept.got.indexOf(d.id) < 0; });
    el.setAttribute("aria-label", (have.length ? "Found so far: " + names(have) + "." : "No dinosaurs found yet.") + (left.length ? " Still to find: " + names(left) + "." : " Every dinosaur found."));
    el.hidden = false;
  }
  function paintCards() {
    try {
      var pic = document.getElementById("dinoPic"), name = document.getElementById("dinoName");
      if (pic) { picture(pic, cur, "todo"); pic.setAttribute("aria-label", "The outline of " + cur.a + " " + cur.name); }
      if (name) { name.textContent = "Today: " + cur.name; }
      var today = document.getElementById("dinoToday"); if (today) today.hidden = false;
      row(document.getElementById("dinoRow")); row(document.getElementById("dinoRowEnd"));
      if (cv) cv.setAttribute("aria-label", "A sandy dig site under a cliff with the outline of " + cur.a + " " + cur.name + " skeleton. Say the word to get a brush, then rub the sand to uncover a bone.");
    } catch (e) {}
  }

  // ── what the engine calls ──
  function publish() {
    try { window.__dino = { state: state, found: found, count: count, rubs: rubs, frozen: frozen, revealed: +revealed().toFixed(3),
      dino: cur.id, name: cur.name, fill: cur.fill, got: kept.got.slice(), bones: cur.bones.map(function (b) { return b.id; }),
      dinos: DINOS.map(function (d) { return { id: d.id, name: d.name, fill: d.fill }; }),
      pit: { x: +pit.x.toFixed(1), y: +pit.y.toFixed(1), w: +pit.w.toFixed(1), h: +pit.h.toFixed(1) },
      bone: dig ? { id: dig.bone.id, x: +dig.x.toFixed(1), y: +dig.y.toFixed(1), w: +dig.w.toFixed(1), h: +dig.h.toFixed(1) } : null,
      glow: !!(dig && state === "ready" && clock >= glowAt), awake: wakeAt >= 0 }; } catch (e) {}
  }
  var Dino = {
    // The page hands over the child's own keeping: read() gives back what
    // write() was last given, and found() hears which dinosaur just woke up.
    setup: function (hooks) { store = hooks || null; recall(); },
    init: function (engineApi, n) {
      api = engineApi; recall(); count = Math.min(n || 8, cur.bones.length);
      try { SHOUT = getComputedStyle(document.documentElement).getPropertyValue("--act").trim() || SHOUT; } catch (e) {}
      cv = document.getElementById("dig"); ctx = cv.getContext("2d");
      resize(); remakeSand(false); window.addEventListener("resize", resize);
      cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move);
      cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
      // no finger? Space or Enter digs the bone out — once a word has earned the brush
      document.addEventListener("keydown", function (e) {
        if ((e.key === " " || e.key === "Enter") && state === "ready" && !frozen && running && dig) {
          e.preventDefault();
          for (var i = 0; i < 9; i++) brush(dig.x + ((i % 3) - 1) * dig.w * 0.35, dig.y + (((i / 3) | 0) - 1) * dig.h * 0.35, Math.max(14, pit.w * 0.085, dig.w * 0.2, dig.h * 0.2));
        }
      });
      paintCards();
      running = true; lastT = performance.now(); raf = requestAnimationFrame(frame);
      publish();
    },
    // the engine heard the word: the brush comes out, and a bone waits under the sand
    onWord: function () {
      if (found >= cur.bones.length) return;
      var b = cur.bones[found], box = b.box;
      // big enough to see, small enough to fit: within 60% of the pit's width and 75% of its height
      var k = Math.max(board.s * 1.1, Math.min(board.s * 1.8, pit.w * 0.6 / box.w, pit.h * 0.75 / box.h));
      var bw = box.w * k, bh = box.h * k, spot = cur.spots[found % cur.spots.length];
      // where the bone lies: this dinosaur's own spot for it, kept inside the pit
      var x = Math.max(pit.x + bw / 2 + 10, Math.min(pit.x + pit.w - bw / 2 - 10, pit.x + pit.w * spot[0]));
      var y = Math.max(pit.y + bh / 2 + 8, Math.min(pit.y + pit.h - bh / 2 - 8, pit.y + pit.h * spot[1]));
      // (x, y) is the middle of the bone; (ox, oy) is where its own drawing starts from
      dig = { bone: b, k: k, x: x, y: y, ox: x - box.x * k, oy: y - box.y * k, w: bw, h: bh, foundAt: 0 };
      remakeSand(false); dig.cells = boneCells();
      state = "ready"; rubs = 0; glowAt = clock + 4; crumbleAt = clock + 8;
      sound("brush");
      try { api.hint("Rub the sand to dig!"); } catch (e) {}
      publish();
    },
    pause: function () { frozen = true; touch = null; publish(); },
    resume: function () { frozen = false; lastT = performance.now(); publish(); },
    // Play again: the next dinosaur in the child's round. From what this page
    // remembers (remember() has just filled it in), not read back from the
    // phone: on a phone that would not save, reading back would find nothing
    // and hand the child the same T. rex every round.
    reset: function () {
      upNext(); paintCards();
      found = 0; dig = null; fly = null; state = "idle"; fx = []; doneAt = 0; wakeAt = -1; rubs = 0; remakeSand(false);
      shout("Find the " + cur.name + "!", false, { x: W / 2, y: pit.y + pit.h / 2 }, 0.8);
      publish();
    },
    finale: function () {
      wakeAt = clock + 0.1;
      var head = boardPt(cur.bones[cur.bones.length - 1]);
      burst(head.x, head.y, 20); burst(W * 0.25, H * 0.3, 14); burst(W * 0.75, H * 0.3, 14);
      shout("ROAR!", true, { x: W * 0.45, y: H * 0.535 });
      sound("roar");
      // it is found: kept for the child, named on the end card, filled in on the row
      remember(); paintCards();
      publish();
    },
    snapshot: function () { return window.__dino; },
  };
  window.Dino = Dino;
})();
