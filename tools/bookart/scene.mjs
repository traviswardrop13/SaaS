// Scene helpers shared by the page layouts in books1.mjs and books2.mjs.
import { C, E, Et, R, P, L, G, at, rot, W, sky, sun, moon, stars, cloud, hills, ground, tuft, dots, star, note, heart } from "./kit.mjs";

// place a drawing (a cast member or a prop) at x, y, scale s
export const put = (fn, x, y, s = 1, o = {}) => G(at(x, y, s, !!o.flip), fn(o));
export const place = (svg, x, y, s = 1, flip = false) => G(at(x, y, s, flip), svg);

export function bubble(x, y, r, inner = "", tail = [-1, 1]) {
  const [tx, ty] = tail;
  return C(x + tx * r * 0.9, y + ty * r * 1.05, r * 0.14, "#ffffff") + C(x + tx * r * 1.25, y + ty * r * 1.45, r * 0.09, "#ffffff")
    + C(x, y, r, "#ffffff") + inner;
}
export function speech(x, y, w, h, inner = "", tx = -1) {
  return R(x - w / 2, y - h / 2, w, h, h / 2, "#ffffff") + P(`M${x + tx * w * 0.2} ${y + h / 2 - 2} l${tx * 14} 16 l${-tx * 2} -18 Z`, "#ffffff") + inner;
}
export const sound = (x, y, s = 1, c = "#ffffff") => G(at(x, y, s), L("M0 -14 q8 14 0 28 M10 -22 q14 22 0 44", c, 3.4));
export const wind = (x, y, s = 1) => G(at(x, y, s), L("M0 0 q30 -12 60 0 q14 6 10 16 q-6 8 -14 0 M-10 24 q40 -10 80 4", "#ffffff", 3.4, { opacity: 0.9 }));
export const hop = (x0, y0, x1, y1, h = 60) => L(`M${x0} ${y0} Q${(x0 + x1) / 2} ${Math.min(y0, y1) - h} ${x1} ${y1}`, "#ffffff", 3, { "stroke-dasharray": "2 9" });
export const shiver = (x, y, s = 1) => G(at(x, y, s), L("M-30 -10 l-6 4 l6 4 l-6 4 M30 -10 l6 4 l-6 4 l6 4", "#8fb8e0", 2.4));
export const burst = (x, y, s = 1, c = "#ffd21c") =>
  G(at(x, y, s), P("M0 -30 L7 -12 L26 -18 L14 -2 L30 10 L10 12 L12 32 L0 18 L-12 32 L-10 12 L-30 10 L-14 -2 L-26 -18 L-7 -12 Z", c));
export const notes = (list) => list.map(([x, y, s, c]) => note(x, y, s || 1, c)).join("");
export const hearts = (list) => list.map(([x, y, s]) => heart(x, y, s || 0.8)).join("");
export const starsList = (list, c = "#ffd21c") => list.map(([x, y, s]) => star(x, y, s || 0.8, c)).join("");
export const confetti = (list) => list.map(([x, y, c, a]) => R(x, y, 7, 7, 2, c, { transform: rot(a || 20, x + 3.5, y + 3.5) })).join("");
export const CONF = [[40, 60, "#ff5c5c", 20], [96, 110, "#4db3f2", -15], [150, 50, "#ffd21c", 30], [210, 92, "#58cc02", 35], [262, 40, "#9b7fd8", -20],
  [312, 104, "#ff8fb0", -25], [372, 58, "#ff9d3d", 15], [410, 118, "#4db3f2", 40], [30, 150, "#ffd21c", 10], [240, 150, "#ff5c5c", -30]];

// skies for time of day
export const SKY = { day: "#bfe8fb", dusk: "#ffc6a3", night: "#2d3a6b", grey: "#cfdbe7", chill: "#d7ecf7", cave: "#4aa9dc" };
export function nightSky(h = 400, moonAt = [360, 70]) {
  return sky(SKY.night, h) + (moonAt ? moon(moonAt[0], moonAt[1], 24) : "") + stars([[40, 50], [110, 90, 0.4], [170, 40], [240, 100, 0.35], [300, 50, 0.45], [60, 150, 0.35], [410, 150, 0.4]]);
}
export function sunset(h = 400) {
  return sky("#ffc6a3", h) + R(0, 150, W, 120, 0, "#ffb38a") + C(300, 250, 44, "#ffe08a", { opacity: 0.5 }) + C(300, 250, 30, "#ffcf5c");
}
export function meadowBg(o = {}) {
  const h = o.h || 400;
  return (o.night ? nightSky(h) : o.sunset ? sunset(h) : sky(o.sky || SKY.day, h) + (o.sun === false ? "" : sun(...(o.sun || [372, 66, 26]))))
    + (o.night ? "" : (o.clouds || [[70, 62, 1], [250, 44, 0.75]]).map(([x, y, s]) => cloud(x, y, s)).join(""))
    + (o.extraSky || "")
    + hills(o.far ?? 250, o.near ?? 302, h, o.farC || (o.night ? "#3f6b5a" : o.sunset ? "#c8c98a" : "#b5e08f"), o.nearC || (o.night ? "#335a4a" : o.sunset ? "#a8c270" : "#8fd06a"))
    + (o.mid || "")
    + ground(o.front ?? 362, o.frontC || (o.night ? "#2e5242" : o.sunset ? "#8fb35e" : "#7cc152"), h)
    + (o.night ? "" : tuft(36, (o.front ?? 362) + 10) + tuft(396, (o.front ?? 362) + 6) + dots([[120, (o.near ?? 302) + 22], [330, (o.near ?? 302) + 36, "#ffd21c"]]));
}
// a shoreline: sky, water across the middle, grass or sand in front
export function shoreBg(o = {}) {
  const h = o.h || 400, wy = o.waterY ?? 230, gy = o.groundY ?? 318;
  return (o.sunset ? sky("#ffc6a3", h) + R(0, wy - 80, W, 80, 0, "#ffb38a") + C(300, wy - 6, 46, "#ffe08a", { opacity: 0.5 }) + C(300, wy - 6, 32, "#ffcf5c") : sky(SKY.day, h) + sun(...(o.sun || [370, 64, 24])))
    + (o.clouds || [[80, 60, 0.9], [260, 44, 0.7]]).map(([x, y, s]) => cloud(x, y, s)).join("")
    + (o.farHill === false ? "" : P(`M0 ${wy} Q 110 ${wy - 34} 220 ${wy - 6} Q 330 ${wy - 30} 440 ${wy - 4} L440 ${wy + 4} L0 ${wy + 4} Z`, "#b5e08f"))
    + R(0, wy, W, gy - wy + 20, 0, "#5fbfe9") + E(90, wy + 30, 50, 5, "#8fd4f2") + E(330, wy + 50, 44, 5, "#8fd4f2")
    + L(`M40 ${wy + 20} q8 -7 16 0 q8 7 16 0 M250 ${wy + 36} q8 -7 16 0 q8 7 16 0`, "#ffffff", 3)
    + (o.sand ? P(`M0 ${gy} Q 220 ${gy - 16} 440 ${gy + 4} L440 ${h} L0 ${h} Z`, "#f5dca8") : P(`M0 ${gy} Q 220 ${gy - 16} 440 ${gy + 4} L440 ${h} L0 ${h} Z`, "#7cc152"));
}
export function jungleBg(o = {}) {
  const h = o.h || 400;
  const leaf = (x, y, s, a, c) => G(`translate(${x} ${y}) rotate(${a}) scale(${s})`, P("M0 0 Q-24 -30 0 -80 Q24 -30 0 0 Z", c) + L("M0 -4 V-74", "#3a8f2a", 2));
  return sky(o.sunset ? "#ffc6a3" : "#c9ecc0", h) + (o.sunset ? C(330, 150, 34, "#ffcf5c") : "")
    + R(20, 0, 26, 300, 6, "#8a6a3a") + R(372, 0, 30, 300, 6, "#8a6a3a")
    + C(40, 0, 70, "#3fa34d") + C(390, -10, 80, "#3fa34d") + C(220, -40, 90, "#4cb35a")
    + leaf(0, 260, 1.4, 40, "#3fa34d") + leaf(440, 250, 1.5, -40, "#3fa34d") + leaf(60, 290, 1, 70, "#58b85a") + leaf(390, 300, 1, -70, "#58b85a")
    + L("M120 0 Q126 60 116 110 M300 0 Q292 50 304 90", "#3fae14", 4)
    + ground(318, "#8fd06a", h) + ground(360, "#7cc152", h)
    + leaf(20, 400, 1.2, 20, "#2f8f3d") + leaf(430, 400, 1.2, -20, "#2f8f3d") + (o.flowers === false ? "" : C(90, 330, 5, "#ff5c8a") + C(350, 340, 5, "#ffd21c"));
}
export function zooBg(o = {}) {
  const h = o.h || 400;
  return sky(o.sky || SKY.day, h) + (o.sun === false ? "" : sun(360, 60, 24)) + cloud(80, 60, 0.9)
    + hills(250, 300, h) + ground(356, "#7cc152", h)
    + P("M0 330 Q 220 316 440 332 L440 356 L0 356 Z", "#e8d3b0");
}
export function roomBg(o = {}) {
  const h = o.h || 400, fy = o.floorY ?? 300;
  return R(0, 0, W, fy, 0, o.wall || "#ffe9c9") + R(0, fy - 8, W, 8, 0, "#e8c99a") + R(0, fy, W, h - fy, 0, o.floor || "#e3b98a")
    + L(`M0 ${fy + 34} H440 M0 ${fy + 70} H440`, "#d4a77a", 3) + (o.stripes ? L("M60 0 V292 M160 0 V292 M280 0 V292 M380 0 V292", "#ffdfb4", 10) : "");
}
export function windowPane(x, y, w, h, scene = "day") {
  const inside = scene === "night" ? "#2d3a6b" : scene === "storm" ? "#8d9bb0" : scene === "clear" ? "#bfe8fb" : "#bfe8fb";
  return R(x - 6, y - 6, w + 12, h + 12, 8, "#ffffff") + R(x, y, w, h, 5, inside)
    + (scene === "night" ? C(x + w * 0.72, y + h * 0.3, 9, "#fff1b8") + star(x + w * 0.25, y + h * 0.3, 0.4, "#fff1b8") : "")
    + (scene === "storm" ? L(`M${x + 10} ${y + 10} l-4 12 M${x + 30} ${y + 24} l-4 12 M${x + w - 20} ${y + 14} l-4 12 M${x + w / 2} ${y + h - 30} l-4 12`, "#dff4ff", 2.5) : "")
    + (scene === "clear" ? C(x + w * 0.7, y + h * 0.3, 11, "#ffd21c") : "")
    + L(`M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}`, "#ffffff", 5) + R(x - 10, y + h + 4, w + 20, 8, 3, "#e8c99a");
}
export function seaBg(o = {}) {
  const h = o.h || 400;
  return R(0, 0, W, h, 0, "#4aa9dc") + R(0, 0, W, 100, 0, "#6cc0ea") + R(0, 100, W, 90, 0, "#5bb5e3")
    + L("M0 30 q40 -14 80 0 t80 0 t80 0 t80 0 t80 0 t80 0", "#9ad8f2", 3, { opacity: 0.6 })
    + P(`M0 ${h - 70} Q 110 ${h - 90} 220 ${h - 72} Q 330 ${h - 54} 440 ${h - 76} L440 ${h} L0 ${h} Z`, "#f0d9a8")
    + C(80, h - 40, 3, "#e6c68c") + C(260, h - 30, 3, "#e6c68c") + C(380, h - 46, 3, "#e6c68c");
}
export function kelp(x, y, s = 1, c = "#3fae6a") {
  return G(at(x, y, s), L("M0 0 q-10 -20 0 -40 q10 -20 0 -40 q-8 -14 0 -28", c, 7) + L("M14 0 q-8 -16 0 -32 q8 -14 2 -26", c, 6));
}
export const bubblesUp = (list) => list.map(([x, y, r]) => C(x, y, r || 5, "none", { stroke: "#dff4ff", "stroke-width": 2 })).join("");
export function villageBg(o = {}) {
  const h = o.h || 400;
  const hs = (x, y, s, b, r) => G(at(x, y, s), R(-40, -56, 80, 56, 3, b) + P("M-50 -52 L0 -92 L50 -52 Z", r) + R(-10, -30, 20, 30, 4, "#b07a45") + R(16, -44, 16, 14, 3, "#cdeffd") + R(-32, -44, 16, 14, 3, "#cdeffd"));
  return sky(o.sky || SKY.day, h) + sun(372, 62, 24) + cloud(90, 60, 0.9) + cloud(250, 40, 0.7)
    + hills(236, 280, h)
    + hs(60, 292, 0.9, "#ffe0b0", "#e8524a") + hs(170, 286, 0.8, "#dff0ff", "#4f8fe0") + hs(280, 290, 0.9, "#ffe7f0", "#ff8fb0") + hs(390, 288, 0.8, "#fff3c4", "#ff9d3d")
    + ground(310, "#8fd06a", h) + P(`M0 330 Q 220 318 440 334 L440 372 Q 220 356 0 370 Z`, "#d9dde4") + L("M20 350 H60 M120 347 H160 M220 346 H260 M320 348 H360", "#ffffff", 3)
    + ground(380, "#7cc152", h);
}
export const qmark = (x, y, s = 1, c = "#e0601a") => G(at(x, y, s), L("M-8 -12 Q-8 -22 0 -22 Q8 -22 8 -14 Q8 -8 1 -5 L1 2", c, 4.5) + C(1, 11, 3, c));
export const exclaim = (x, y, s = 1, c = "#e0601a") => G(at(x, y, s), L("M0 -20 V2", c, 5) + C(0, 12, 3.2, c));
export const waterFront = (y, h = 400, x0 = 0, x1 = 440) => R(x0, y, x1 - x0, h - y, 0, "#5fbfe9") + L(`M${x0 + 20} ${y + 2} q10 -6 20 0 q10 6 20 0 M${x1 - 80} ${y + 2} q10 -6 20 0 q10 6 20 0`, "#ffffff", 3);
export const ripple = (x, y, w = 40) => E(x, y, w, w * 0.18, "none", { stroke: "#dff4ff", "stroke-width": 2.5 });
export const fire = (x, y, s = 1) => G(at(x, y, s), L("M-16 0 L16 -6 M-16 -6 L16 0", "#8f5f33", 5) + P("M-12 -6 Q-14 -26 0 -40 Q14 -26 12 -6 Z", "#ff9d3d") + P("M-6 -6 Q-6 -20 0 -28 Q6 -20 6 -6 Z", "#ffd21c"));
export const fireflies = (list) => list.map(([x, y]) => C(x, y, 5, "#fff1b8", { opacity: 0.35 }) + C(x, y, 2.2, "#fff1b8")).join("");
export const steam = (x, y, s = 1) => G(at(x, y, s), L("M-8 0 q-6 -10 0 -18 q6 -8 0 -16 M8 0 q-6 -10 0 -18 q6 -8 0 -16", "#ffffff", 3, { opacity: 0.85 }));
export const umbrella = (x, y, s = 1) => G(at(x, y, s), R(-2, -110, 4, 110, 2, "#b3b9c4") + P("M-60 -100 Q0 -150 60 -100 Z", "#ff5c5c") + P("M-20 -100 Q0 -150 20 -100 Z", "#ffffff") + P("M-60 -100 Q-40 -110 -20 -100 Q0 -110 20 -100 Q40 -110 60 -100 Z", "#e84a4a"));
