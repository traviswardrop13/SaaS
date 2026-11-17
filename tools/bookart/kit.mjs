// The picture-book art kit: shapes, faces, arms, backgrounds and props for the
// fuller books' scenes (library.html). Everything is flat SVG in Sona's sticker
// style (soft fills, no outlines, a white glint, pink cheeks, a ground shadow),
// matching Rory and the Rainbow, which was drawn by hand on a Claude Design
// canvas. build.mjs turns each page into a static file under
// public/assets/books/, so none of this ships to the app: the reader only ever
// loads finished SVGs.
//
// Coordinates: a page is 440 x 400 (a cover 440 x 440). A character is drawn
// with its feet at (0, 0) and placed with at(x, y, scale).

const r1 = (n) => Math.round(n * 10) / 10;

export function el(tag, a, inner = "") {
  let s = "<" + tag;
  for (const k in a) {
    const v = a[k];
    if (v === undefined || v === null || v === false) continue;
    s += " " + k + '="' + (typeof v === "number" ? r1(v) : v) + '"';
  }
  return s + ">" + inner + "</" + tag + ">";
}
export const C = (cx, cy, r, fill, x = {}) => el("circle", { cx, cy, r, fill, ...x });
export const E = (cx, cy, rx, ry, fill, x = {}) => el("ellipse", { cx, cy, rx, ry, fill, ...x });
export const R = (x, y, w, h, rx, fill, xx = {}) => el("rect", { x, y, width: w, height: h, rx, fill, ...xx });
export const P = (d, fill, x = {}) => el("path", { d, fill, ...x });
export const L = (d, stroke, w, x = {}) =>
  el("path", { d, stroke, "stroke-width": w, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round", ...x });
export const G = (t, inner, x = {}) => el("g", { transform: t, ...x }, inner);
export const rot = (a, cx = 0, cy = 0) => `rotate(${r1(a)} ${r1(cx)} ${r1(cy)})`;
export const at = (x, y, s = 1, flip = false) => `translate(${r1(x)} ${r1(y)}) scale(${r1(flip ? -s : s)} ${r1(s)})`;
// ellipse turned `a` degrees (clockwise)
export const Et = (cx, cy, rx, ry, a, fill, x = {}) => E(cx, cy, rx, ry, fill, { transform: rot(a, cx, cy), ...x });

export const INK = "#4a2c14";
export const MOUTH = "#c0475a";
export const CHEEK = "#ffb9c8";
export const W = 440;

// ── arms ──
// An arm from the shoulder (sx, sy), `a` degrees from straight down, positive
// toward +x: 0 hangs, 90 points right, 180 points up.
export function arm(sx, sy, a, len, color, hand, hr = 5.6, rx = 6) {
  const rad = (a * Math.PI) / 180, dx = Math.sin(rad), dy = Math.cos(rad);
  const cx = sx + (dx * len) / 2, cy = sy + (dy * len) / 2;
  return Et(cx, cy, rx, len / 2, -a, color) + (hand ? C(sx + dx * len, sy + dy * len, hr, hand) : "");
}
// [left arm, right arm] angles and length for each pose
export const POSES = {
  stand: [[-17, 24], [17, 24]],
  wave: [[-17, 24], [150, 24]],
  cheer: [[-145, 24], [145, 24]],
  point: [[-17, 24], [125, 26]],
  reach: [[-17, 24], [90, 26]],
  hold: [[20, 16], [-20, 16]],
  carry: [[-160, 22], [160, 22]],
  run: [[-55, 24], [115, 24]],
  shrug: [[-115, 20], [115, 20]],
  pull: [[100, 26], [100, 26]],
  hug: [[60, 20], [-60, 20]],
};
export function arms(pose, color, hand, o = {}) {
  const [l, r] = POSES[pose] || POSES.stand;
  const sx = o.sx || 15, sy = o.sy || -40, hr = o.hr || 5.6, rx = o.rx || 6;
  return { left: arm(-sx, sy, l[0], l[1], color, hand, hr, rx), right: arm(sx, sy, r[0], r[1], color, hand, hr, rx) };
}
// arms that go up sit behind the head; arms at the sides sit in front of the body
export const upArm = (a) => Math.abs(a) > 100;

// ── faces ──
// kind: smile | grin | happy | o | sad | sleep | shy | effort | worried | wow
// o: x, y (eye line), sp (half eye spacing), er (eye radius), my (mouth drop
// from the eye line), look ([dx, dy] pupil shift), cheeks, cy/cs (cheek drop
// and spread), eye (eye colour), white (eyes on a dark mask: white eyes)
export function face(kind, o = {}) {
  const x = o.x || 0, y = o.y || 0, sp = o.sp ?? 8.5, er = o.er ?? 3.5, my = o.my ?? 11;
  const ink = o.eye || INK, [lx, ly] = o.look || [0, 0];
  let s = "";
  if (o.cheeks !== false) {
    const cy = y + (o.cy ?? 9), cs = o.cs ?? sp + 6;
    s += C(x - cs, cy, o.cr || 4.6, CHEEK, { opacity: 0.8 }) + C(x + cs, cy, o.cr || 4.6, CHEEK, { opacity: 0.8 });
  }
  const eyes = (r) => {
    if (o.white) {
      return C(x - sp, y, r + 0.6, "#ffffff") + C(x + sp, y, r + 0.6, "#ffffff")
        + C(x - sp + lx, y + ly, r * 0.52, "#2d3642") + C(x + sp + lx, y + ly, r * 0.52, "#2d3642");
    }
    return C(x - sp + lx, y + ly, r, ink) + C(x + sp + lx, y + ly, r, ink)
      + C(x - sp + lx + r * 0.34, y + ly - r * 0.4, r * 0.34, "#ffffff") + C(x + sp + lx + r * 0.34, y + ly - r * 0.4, r * 0.34, "#ffffff");
  };
  const closed = (up) => {
    const c = o.white ? "#ffffff" : ink;
    const d = (ex) => up ? `M${ex - 3.6} ${y + 1} Q${ex} ${y - 4.5} ${ex + 3.6} ${y + 1}` : `M${ex - 3.6} ${y} Q${ex} ${y + 3} ${ex + 3.6} ${y}`;
    return L(d(x - sp), c, 2.5) + L(d(x + sp), c, 2.5);
  };
  const my0 = y + my;
  if (o.noMouth) {
    // birds and side views draw their own beak or mouth
    return s + (kind === "happy" || kind === "sleep" || kind === "shy" ? closed(kind === "happy") : kind === "effort" ? "" : eyes(kind === "o" || kind === "wow" ? er * 1.15 : er));
  }
  const openSmile = (w) => P(`M${x - w} ${my0 - 1} Q${x} ${my0 + w * 1.4} ${x + w} ${my0 - 1} Z`, MOUTH);
  const smile = (w) => L(`M${x - w} ${my0} Q${x} ${my0 + w * 0.7} ${x + w} ${my0}`, o.mouthInk || INK, 1.7);
  switch (kind) {
    case "grin": s += eyes(er) + openSmile(5.5); break;
    case "happy": s += closed(true) + openSmile(5.5); break;
    case "o": s += eyes(er * 1.12) + E(x, my0 + 1.5, 2.8, 3.4, MOUTH); break;
    case "wow": s += eyes(er * 1.15) + E(x, my0 + 2, 3.6, 4.6, MOUTH); break;
    case "sad": s += eyes(er) + L(`M${x - 4.5} ${my0 + 2.5} Q${x} ${my0 - 1.5} ${x + 4.5} ${my0 + 2.5}`, o.mouthInk || INK, 1.7); break;
    case "worried":
      s += eyes(er) + L(`M${x - 5} ${my0 + 1} q1.7 -2 3.3 0 q1.7 2 3.3 0 q1.7 -2 3.3 0`, o.mouthInk || INK, 1.6)
        + L(`M${x - sp - 4} ${y - er - 4} L${x - sp + 3} ${y - er - 6}`, o.white ? "#ffffff" : ink, 1.6)
        + L(`M${x + sp + 4} ${y - er - 4} L${x + sp - 3} ${y - er - 6}`, o.white ? "#ffffff" : ink, 1.6);
      break;
    case "sleep": s += closed(false) + smile(3); break;
    case "shy": s += (o.white ? eyes(er * 0.9) : closed(false)) + smile(3.5); break;
    case "effort": {
      const c = o.white ? "#ffffff" : ink;
      s += L(`M${x - sp - 3.5} ${y - 3} L${x - sp + 3} ${y} L${x - sp - 3.5} ${y + 3}`, c, 2.4)
        + L(`M${x + sp + 3.5} ${y - 3} L${x + sp - 3} ${y} L${x + sp + 3.5} ${y + 3}`, c, 2.4)
        + P(`M${x - 5} ${my0 - 1} Q${x} ${my0 + 5} ${x + 5} ${my0 - 1} Z`, MOUTH);
      break;
    }
    default: s += eyes(er) + smile(4.5);
  }
  return s;
}

// ── small shared bits ──
export const shadow = (rx = 28, c = "#2f6b1a", op = 0.16) => E(0, 0, rx, rx * 0.19, c, { opacity: op });
export const glint = (x, y, r = 3) => C(x, y, r, "#ffffff", { opacity: 0.75 });
export function star(x, y, s = 1, fill = "#ffd21c") {
  return G(at(x, y, s), P("M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z", fill));
}
export function heart(x, y, s = 1, fill = "#ff5c7a") {
  return G(at(x, y, s), P("M0 8 C -12 0 -10 -12 0 -6 C 10 -12 12 0 0 8 Z", fill));
}
export function note(x, y, s = 1, fill = "#8a6fc4") {
  return G(at(x, y, s), E(-3, 6, 5, 4, fill, { transform: rot(-20, -3, 6) }) + R(0.5, -12, 2.6, 19, 1.3, fill) + P("M3 -12 q8 3 7 11 q-2 -6 -7 -6 Z", fill));
}
export function zzz(x, y, s = 1) {
  return G(at(x, y, s), L("M0 0 h7 l-7 8 h7 M10 -12 h5 l-5 6 h5", "#8a97a8", 2));
}
export function sparkle(x, y, s = 1, fill = "#ffffff") { return star(x, y, s * 0.7, fill); }
export function motion(x, y, s = 1, c = "#ffffff") {
  return G(at(x, y, s), L("M0 -18 H22 M-6 0 H18 M2 18 H22", c, 4));
}

// ── skies and grounds ──
export function sky(c = "#bfe8fb", h = 400) { return R(0, 0, W, h, 0, c); }
export function sun(x, y, r = 28) {
  return C(x, y, r * 1.55, "#fff3b0", { opacity: 0.6 }) + C(x, y, r, "#ffd21c") + C(x - r * 0.32, y - r * 0.32, r * 0.23, "#ffffff", { opacity: 0.7 });
}
export function moon(x, y, r = 24) {
  return C(x, y, r * 1.5, "#fff6c8", { opacity: 0.25 }) + C(x, y, r, "#fff1b8") + C(x + r * 0.45, y - r * 0.25, r * 0.85, "#2d3a6b");
}
export function stars(list) { return list.map(([x, y, s]) => star(x, y, s || 0.5, "#fff1b8")).join(""); }
export function cloud(x, y, s = 1, fill = "#ffffff") {
  return G(at(x, y, s), E(0, 10, 42, 14, fill) + C(-14, 2, 15, fill) + C(10, -4, 19, fill) + C(28, 6, 12, fill));
}
export function rainCloud(x, y, s = 1) { return cloud(x, y, s, "#a9b8c9"); }
export function rain(x0, y0, x1, y1, n = 22, c = "#6aa9d8", seed = 3) {
  let d = "", k = seed;
  const rnd = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
  for (let i = 0; i < n; i++) d += `M${r1(x0 + rnd() * (x1 - x0))} ${r1(y0 + rnd() * (y1 - y0))} l-5 14 `;
  return L(d, c, 3);
}
export function rainbow(cx, cy, r, w = 14, bands = ["#ff5c5c", "#ff9d3d", "#ffd21c", "#6fcf4a", "#4db3f2", "#9b7fd8"]) {
  return bands.map((c, i) => {
    const rr = r - i * (w - 0.5);
    return L(`M${cx - rr} ${cy} A${rr} ${rr} 0 0 1 ${cx + rr} ${cy}`, c, w, { "stroke-linecap": "butt" });
  }).join("");
}
export function hills(y1, y2, h = 400, far = "#b5e08f", near = "#8fd06a") {
  return P(`M0 ${y1} Q 90 ${y1 - 30} 180 ${y1 - 4} Q 280 ${y1 + 22} 360 ${y1 - 10} Q 410 ${y1 - 22} 440 ${y1 - 8} L440 ${h} L0 ${h} Z`, far)
    + P(`M0 ${y2} Q 220 ${y2 - 20} 440 ${y2 + 4} L440 ${h} L0 ${h} Z`, near);
}
export function ground(y, fill = "#7cc152", h = 400) { return P(`M0 ${y} Q 220 ${y - 14} 440 ${y + 2} L440 ${h} L0 ${h} Z`, fill); }
export function tuft(x, y, c = "#5fae3c") { return L(`M${x} ${y} l3 -10 l3 10 l3 -8 l3 8`, c, 2.5); }
export function dots(list) { return list.map(([x, y, c]) => C(x, y, 3, c || "#ffffff")).join(""); }
export function meadow(o = {}) {
  const h = o.h || 400;
  return sky(o.sky || "#bfe8fb", h)
    + (o.sun ? sun(...o.sun) : "")
    + (o.clouds || [[70, 62, 1], [300, 44, 0.8]]).map(([x, y, s]) => cloud(x, y, s)).join("")
    + (o.rainbow ? rainbow(...o.rainbow) : "")
    + hills(o.far ?? 262, o.near ?? 312, h)
    + ground(o.front ?? 368, "#7cc152", h)
    + tuft(36, (o.front ?? 368) + 10) + tuft(392, (o.front ?? 368) + 6) + tuft(214, (o.near ?? 312) + 30)
    + dots([[120, (o.near ?? 312) + 20], [330, (o.near ?? 312) + 34, "#ffd21c"], [270, (o.front ?? 368) + 14]]);
}
export function water(y, h = 400, fill = "#5fbfe9") {
  return R(0, y, W, h - y, 0, fill)
    + E(80, y + 34, 44, 5, "#8fd4f2") + E(330, y + 22, 38, 4, "#8fd4f2") + E(230, y + 70, 56, 5, "#8fd4f2");
}
export function waves(list, c = "#ffffff") { return L(list.map(([x, y]) => `M${x} ${y} q8 -7 16 0 q8 7 16 0`).join(" "), c, 3); }
export function pond(cx, cy, rx, ry) {
  return E(cx, cy, rx, ry, "#5fbfe9") + E(cx - rx * 0.3, cy - ry * 0.2, rx * 0.35, ry * 0.18, "#8fd4f2")
    + E(cx + rx * 0.35, cy + ry * 0.25, rx * 0.25, ry * 0.14, "#8fd4f2");
}
export function sand(y, h = 400) {
  return P(`M0 ${y} Q 220 ${y - 12} 440 ${y + 4} L440 ${h} L0 ${h} Z`, "#f5dca8") + dots([[60, y + 30, "#e6c68c"], [180, y + 50, "#e6c68c"], [390, y + 36, "#e6c68c"]]);
}
export function beach(o = {}) {
  const h = o.h || 400, sy = o.seaY ?? 236, by = o.sandY ?? 300;
  return sky(o.sky || "#bfe8fb", h) + (o.sun ? sun(...o.sun) : "")
    + (o.clouds || [[80, 64, 1], [320, 50, 0.8]]).map(([x, y, s]) => cloud(x, y, s)).join("")
    + R(0, sy, W, by - sy + 20, 0, "#4db3f2") + E(120, sy + 20, 60, 5, "#8fd4f2") + E(340, sy + 36, 50, 5, "#8fd4f2")
    + waves([[40, sy + 12], [250, sy + 28], [380, sy + 10]])
    + P(`M0 ${by} Q 110 ${by - 10} 220 ${by} T 440 ${by} L440 ${by + 14} L0 ${by + 14} Z`, "#ffffff", { opacity: 0.8 })
    + sand(by + 6, h);
}
export function undersea(o = {}) {
  const h = o.h || 400;
  return R(0, 0, W, h, 0, "#4aa9dc") + R(0, 0, W, 90, 0, "#6cc0ea") + R(0, 90, W, 90, 0, "#5bb5e3")
    + P(`M0 ${h - 70} Q 110 ${h - 88} 220 ${h - 72} Q 330 ${h - 56} 440 ${h - 76} L440 ${h} L0 ${h} Z`, "#f0d9a8")
    + weed(30, h - 64, 1) + weed(410, h - 70, 1.2) + weed(372, h - 62, 0.8)
    + bubbles([[60, 120], [70, 100], [380, 160], [390, 132], [210, 60]]);
}
export function weed(x, y, s = 1, c = "#3fae6a") {
  return G(at(x, y, s), L("M0 0 q-10 -20 0 -40 q10 -20 0 -40 q-8 -14 0 -28", c, 7) + L("M14 0 q-8 -16 0 -32 q8 -14 2 -26", c, 6));
}
export function bubbles(list) { return list.map(([x, y, r]) => C(x, y, r || 5, "none", { stroke: "#dff4ff", "stroke-width": 2 })).join(""); }
export function coral(x, y, s = 1, c = "#ff8f8f") {
  return G(at(x, y, s), L("M0 0 V-26 M0 -14 l-12 -12 M0 -18 l10 -14 M-12 -26 v-8 M10 -32 v-8", c, 7));
}

// ── indoors ──
export function room(o = {}) {
  const h = o.h || 400, fy = o.floorY ?? 300;
  return R(0, 0, W, fy, 0, o.wall || "#ffe9c9") + R(0, fy - 8, W, 8, 0, o.trim || "#e8c99a")
    + R(0, fy, W, h - fy, 0, o.floor || "#e3b98a")
    + L(`M0 ${fy + 34} H440 M0 ${fy + 70} H440`, "#d4a77a", 3)
    + (o.window ? win(...o.window) : "");
}
export function win(x, y, w, h, night = false) {
  return R(x - 6, y - 6, w + 12, h + 12, 8, "#ffffff") + R(x, y, w, h, 5, night ? "#2d3a6b" : "#bfe8fb")
    + L(`M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}`, "#ffffff", 5)
    + R(x - 10, y + h + 4, w + 20, 8, 3, "#e8c99a");
}

// ── buildings ──
export function house(x, y, s = 1, body = "#ffe0b0", roof = "#e8524a", door = "#b07a45") {
  return G(at(x, y, s),
    R(-40, -56, 80, 56, 3, body) + P("M-50 -52 L0 -92 L50 -52 Z", roof) + R(-52, -56, 104, 9, 4.5, roof, { opacity: 0.9 })
    + P("M-10 0 V-28 Q-10 -38 0 -38 Q10 -38 10 -28 V0 Z", door) + R(16, -40, 18, 16, 3, "#cdeffd") + R(-34, -40, 18, 16, 3, "#cdeffd"));
}
export function tree(x, y, s = 1, leaf = "#62b84a", hi = "#7cc95c") {
  return G(at(x, y, s), R(-6, -40, 12, 42, 4, "#a5703f") + C(0, -64, 28, leaf) + C(-22, -48, 18, leaf) + C(22, -48, 18, leaf) + C(-8, -74, 9, hi));
}
export function bush(x, y, s = 1, c = "#6fbf4a") { return G(at(x, y, s), E(0, -10, 28, 15, c) + C(18, -16, 13, c) + C(-12, -18, 12, c) + C(-6, -18, 5, "#8fd06a")); }
export function fence(y, x0 = 0, x1 = 440, c = "#fff4e0") {
  let s = R(x0, y - 30, x1 - x0, 6, 3, c) + R(x0, y - 14, x1 - x0, 6, 3, c);
  for (let x = x0 + 8; x < x1; x += 34) s += P(`M${x} ${y} V${y - 40} l8 -8 l8 8 V${y} Z`, c);
  return s;
}
export function flower(x, y, s = 1, petal = "#ff8fb0", mid = "#ffd21c") {
  return G(at(x, y, s), L("M0 0 V-22", "#4caf32", 3) + E(6, -8, 6, 3, "#58cc02", { transform: rot(-30, 6, -8) })
    + C(-5, -26, 5, petal) + C(5, -26, 5, petal) + C(0, -31, 5, petal) + C(0, -21, 5, petal) + C(0, -26, 3.6, mid));
}
export function rose(x, y, s = 1, pink = false) {
  const a = pink ? ["#f06d97", "#ff8fb0", "#e0588a"] : ["#e84663", "#ff5470", "#d63a5a"];
  return G(at(x, y, s), L("M0 8 L0 34", "#4caf32", 3.5) + Et(7, 18, 7, 3.6, 28, "#58cc02")
    + C(-7, 2, 7, a[0]) + C(7, 2, 7, a[0]) + C(0, -2, 11, a[1]) + L("M-4 -1 A5 5 0 1 1 1 4", a[2], 2.2));
}
export function rock(x, y, s = 1, c = "#b9b2a8") {
  return G(at(x, y, s), P("M-30 0 Q-28 -26 0 -28 Q30 -28 32 0 Z", c) + P("M-18 -14 Q-4 -24 12 -20", "none", { stroke: "#d6d0c8", "stroke-width": 5, "stroke-linecap": "round" }));
}
