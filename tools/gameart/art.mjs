// Props for the Say & Play games, in the books' sticker style (tools/bookart/):
// flat fills, no outlines, a white glint, pink cheeks. Grounded things are
// drawn with their base at (0, 0); floating things around their middle.
import { C, E, Et, R, P, L, G, at, rot, face, glint, star, INK, CHEEK } from "../bookart/kit.mjs";

// ── party ──
export const bigBalloon = (c = "#ff5c5c", d = "#e84a4a") =>
  P("M0 -2 Q-6 -8 -4 -12 H4 Q6 -8 0 -2 Z", d)
  + E(0, -92, 70, 82, c) + Et(-30, -120, 14, 26, 28, "#ffffff", { opacity: 0.45 }) + C(-14, -150, 6, "#ffffff", { opacity: 0.5 })
  + P("M-5 -10 Q0 -14 5 -10 Z", d);
export const smallBalloon = (c = "#4db3f2", s = 1) => G(`scale(${s})`,
  L("M0 0 q-5 -24 0 -46", "#9aa7b8", 1.6) + E(0, -66, 17, 21, c) + Et(-7, -73, 4, 7, 25, "#ffffff", { opacity: 0.5 }) + P("M-3 -45 H3 L0 -41 Z", c));
export const partyHat = (c = "#9b7fd8", dot = "#ffd21c") => P("M-13 0 L0 -32 L13 0 Z", c) + C(0, -33, 4, dot) + C(-4, -10, 2, dot) + C(4, -18, 2, dot) + C(-1, -4, 1.8, "#ffffff");
export const airPuffs = () => L("M-40 -30 q-12 -4 -20 -2 M-44 -12 q-12 0 -18 4 M40 -30 q12 -4 20 -2 M44 -12 q12 0 18 4", "#ffffff", 4);

// ── garden ──
export const wateringCan = () => G(rot(28),
  R(-26, -34, 52, 36, 10, "#4db3f2") + R(-26, -34, 52, 8, 4, "#8fd4f2")
  + L("M-22 -30 Q-44 -26 -40 -4", "#3a9ad8", 5) + P("M22 -18 L54 -40 L58 -34 L28 -8 Z", "#3a9ad8")
  + E(58, -40, 7, 4, "#3a9ad8", { transform: rot(-35, 58, -40) }) + glint(-14, -24, 3));
export const drop = (x, y, s = 1) => G(at(x, y, s), P("M0 -9 Q7 0 5 5 Q0 10 -5 5 Q-7 0 0 -9 Z", "#6ac3f2") + C(-2, 2, 1.6, "#ffffff", { opacity: 0.8 }));
export const soilMound = () => E(0, 0, 70, 12, "#8f5f33") + P("M-60 0 Q-30 -22 0 -22 Q30 -22 60 0 Z", "#a5703f") + C(-20, -8, 2.4, "#6b4a2e") + C(18, -12, 2, "#6b4a2e") + C(4, -4, 2, "#6b4a2e");
export const sprout = () => L("M0 0 Q-2 -18 0 -34", "#4caf32", 5) + Et(-9, -34, 10, 5, -30, "#58cc02") + Et(9, -36, 10, 5, 30, "#6fd81a");
export const stem = () => L("M0 0 Q-8 -60 0 -130", "#4caf32", 7)
  + P("M-2 -50 Q-40 -64 -52 -40 Q-26 -30 -2 -50 Z", "#58cc02") + L("M-4 -49 Q-26 -48 -44 -42", "#3fae14", 2)
  + P("M0 -86 Q38 -102 50 -78 Q24 -68 0 -86 Z", "#6fd81a") + L("M2 -85 Q24 -86 42 -80", "#3fae14", 2);
export const bud = () => P("M-14 0 Q-18 -26 0 -38 Q18 -26 14 0 Z", "#ff8fb0") + P("M-14 0 Q-10 -18 0 -22 Q10 -18 14 0 Q0 8 -14 0 Z", "#58cc02") + P("M-4 -30 Q0 -34 4 -30", "none", { stroke: "#ffc4d6", "stroke-width": 2 });
export function bloom(petal = "#ff6fa0", petal2 = "#ff8fb0", mid = "#ffd21c") {
  let s = "";
  for (let i = 0; i < 8; i++) { const a = i * 45; s += Et(Math.sin(a * Math.PI / 180) * 34, -Math.cos(a * Math.PI / 180) * 34, 18, 26, a, i % 2 ? petal2 : petal); }
  return s + C(0, 0, 30, mid) + C(0, 0, 30, "none", { stroke: "#f0a800", "stroke-width": 3 })
    + face("happy", { y: -4, sp: 9, my: 10, cy: 8, cs: 16, cr: 4.4 });
}

// ── rockets and space ──
export function rocket(o = {}) {
  const body = o.body || "#f7f7fb", trim = o.trim || "#ff5c5c", win = o.win || "#8fd4f2";
  return P("M-30 -40 L-58 -2 L-58 8 L-26 -6 Z", trim) + P("M30 -40 L58 -2 L58 8 L26 -6 Z", trim)
    + R(-18, -12, 36, 12, 4, "#b3b9c4")
    + P("M-32 -8 Q-38 -120 0 -190 Q38 -120 32 -8 Z", body)
    + P("M0 -190 Q-22 -160 -27 -140 H27 Q22 -160 0 -190 Z", trim)
    + R(-4, -40, 8, 34, 4, trim)
    + C(0, -96, 22, "#b3b9c4") + C(0, -96, 17, win) + (o.pilot || "")
    + P("M-26 -118 Q-24 -132 -18 -140", "none", { stroke: "#ffffff", "stroke-width": 4, "stroke-linecap": "round", opacity: 0.8 });
}
// Bo the bear's face in the rocket's window
export const pilotBear = () => C(-10, -110, 5, "#b5875a") + C(10, -110, 5, "#b5875a") + C(0, -96, 14, "#b5875a") + E(0, -90, 7, 5, "#e0b98a")
  + face("grin", { y: -99, sp: 5.5, er: 2.2, my: 11, cy: 5, cs: 9, cr: 2.6 }) + E(0, -93, 2.6, 1.9, INK)
  + P("M-17 -96 A17 17 0 0 1 17 -96", "none", { stroke: "#ffffff", "stroke-width": 2, opacity: 0.6 });
export const flame = () => P("M-24 0 Q-30 36 0 78 Q30 36 24 0 Z", "#ff8a3d") + P("M-14 0 Q-16 26 0 54 Q16 26 14 0 Z", "#ffd21c") + P("M-6 0 Q-6 14 0 28 Q6 14 6 0 Z", "#ffffff", { opacity: 0.85 });
export const smokeCloud = (s = 1) => G(`scale(${s})`, C(-40, -14, 22, "#eef0f4") + C(-12, -22, 28, "#f7f8fa") + C(22, -16, 24, "#eef0f4") + C(46, -8, 16, "#e3e7ee") + E(0, 0, 70, 14, "#e3e7ee"));
export const launchPad = () => R(-80, -10, 160, 14, 5, "#8a97a8") + R(-60, 4, 16, 30, 3, "#6f7c8e") + R(44, 4, 16, 30, 3, "#6f7c8e") + R(-80, -10, 160, 5, 2.5, "#b3b9c4");
export function launchTower() {
  let s = R(-10, -230, 20, 230, 3, "#ff9d3d");
  for (let y = -220; y < 0; y += 26) s += L(`M-10 ${y} L10 ${y + 26} M10 ${y} L-10 ${y + 26}`, "#e0892b", 2.4);
  return s + R(-14, -238, 28, 10, 3, "#e0892b") + R(10, -150, 46, 6, 3, "#e0892b");
}
export function countLight(n, on) {
  return C(0, 0, 19, on ? "#fff3b0" : "#3d4a5c", { opacity: on ? 0.55 : 1 }) + C(0, 0, 15, on ? "#ffd21c" : "#52606f")
    + `<text x="0" y="6.5" text-anchor="middle" font-family="'Baloo 2',Nunito,sans-serif" font-weight="800" font-size="19" fill="${on ? "#8a5a00" : "#8a97a8"}">${n}</text>`;
}
export const planet = (r, c, ring, band) => (ring ? E(0, 0, r * 1.8, r * 0.42, "none", { stroke: ring, "stroke-width": r * 0.16 }) : "")
  + C(0, 0, r, c) + (band ? E(0, r * 0.2, r * 0.95, r * 0.22, band, { opacity: 0.7 }) : "") + C(-r * 0.35, -r * 0.35, r * 0.22, "#ffffff", { opacity: 0.35 })
  + (ring ? P(`M${-r * 1.8} 0 A${r * 1.8} ${r * 0.42} 0 0 0 ${r * 1.8} 0`, "none", { stroke: ring, "stroke-width": r * 0.16 }) : "");

// ── winter ──
export const snowball = (r) => C(0, -r, r, "#dce9f5") + C(-r * 0.1, -r * 1.07, r * 0.92, "#ffffff") + C(-r * 0.4, -r * 1.4, r * 0.14, "#eef5fb") + C(r * 0.35, -r * 1.25, r * 0.1, "#e3eef8");
export const pine = (x, y, s = 1, c = "#3f9a5a") => G(at(x, y, s), R(-5, -14, 10, 16, 3, "#8f5f33")
  + P("M-34 -12 L0 -58 L34 -12 Z", c) + P("M-28 -40 L0 -84 L28 -40 Z", c) + P("M-20 -66 L0 -104 L20 -66 Z", c)
  + P("M-34 -12 Q0 -22 34 -12 L30 -16 Q0 -26 -30 -16 Z", "#ffffff") + P("M-20 -66 L0 -104 L20 -66 Q0 -74 -20 -66 Z", "#ffffff", { opacity: 0.9 }));
export const snowFace = () => C(-11, -10, 4, INK) + C(11, -10, 4, INK) + C(-9.5, -11.5, 1.2, "#ffffff") + C(12.5, -11.5, 1.2, "#ffffff")
  + P("M-2 -4 L26 2 L-2 4 Z", "#ff8a3d") + C(-12, 8, 2.2, INK) + C(-5, 11, 2.2, INK) + C(3, 12, 2.2, INK) + C(10, 10, 2.2, INK)
  + C(-20, 0, 4.5, CHEEK, { opacity: 0.8 }) + C(20, 0, 4.5, CHEEK, { opacity: 0.8 });
export const topHat = () => R(-30, -8, 60, 9, 4, "#3d3a4a") + R(-20, -46, 40, 40, 5, "#3d3a4a") + R(-20, -18, 40, 8, 2, "#ff5c5c") + C(12, -14, 3, "#ffd21c");
export const scarf = () => P("M-36 -8 Q0 10 36 -8 L36 4 Q0 22 -36 4 Z", "#ff5c5c") + P("M14 4 L22 40 L34 38 L28 2 Z", "#e84a4a")
  + L("M-24 0 V10 M-8 5 V16 M8 5 V16 M24 0 V10", "#ffd21c", 3) + L("M20 32 l4 8 M27 32 l3 8", "#ffd21c", 2);
// twig arms for a snowball of radius r, drawn around its middle
export const stickArms = (r = 46) => L(`M${-r + 6} -4 L${-r - 46} -36 M${-r - 32} -27 L${-r - 42} -48 M${-r - 32} -27 L${-r - 56} -26`, "#8f5f33", 5)
  + L(`M${r - 6} -4 L${r + 46} -40 M${r + 32} -30 L${r + 36} -52 M${r + 32} -30 L${r + 56} -28`, "#8f5f33", 5);
export const coalButtons = () => C(0, -26, 4.5, INK) + C(0, -8, 4.5, INK) + C(0, 10, 4.5, INK);
export function flakes(list) { return list.map(([x, y, r]) => C(x, y, r || 3, "#ffffff", { opacity: 0.95 })).join(""); }

// ── trains ──
export function engine() {
  return C(-34, -12, 13, "#3d3a4a") + C(-34, -12, 5, "#b3b9c4") + C(4, -12, 13, "#3d3a4a") + C(4, -12, 5, "#b3b9c4") + C(34, -10, 10, "#3d3a4a") + C(34, -10, 4, "#b3b9c4")
    + R(-52, -64, 44, 48, 6, "#ff5c5c") + R(-56, -72, 52, 10, 4, "#e84a4a") + R(-46, -58, 32, 22, 5, "#dff4ff")
    + R(-10, -46, 58, 32, 12, "#4db3f2") + R(20, -74, 14, 30, 4, "#3d3a4a") + R(16, -80, 22, 9, 4, "#3d3a4a")
    + C(48, -30, 7, "#ffd21c") + C(48, -30, 3.4, "#fff6c8") + P("M44 -14 L62 -4 L44 -4 Z", "#9aa7b8") + R(-58, -20, 116, 6, 3, "#3d3a4a")
    + C(-6, -36, 3, "#ffffff", { opacity: 0.7 });
}
export function car(color, rider) {
  return (rider || "") + C(-16, -9, 10, "#3d3a4a") + C(-16, -9, 3.8, "#b3b9c4") + C(16, -9, 10, "#3d3a4a") + C(16, -9, 3.8, "#b3b9c4")
    + R(-29, -44, 58, 32, 7, color) + R(-29, -44, 58, 7, 3.5, "#ffffff", { opacity: 0.35 }) + R(-34, -18, 68, 5, 2.5, "#3d3a4a") + L("M-34 -16 H-40", "#3d3a4a", 3);
}
// a passenger coach with five windows; what rides in it is drawn behind it
export const COACH_WIN = [-98, -49, 0, 49, 98];
export function coach(c = "#4db3f2", d = "#3a9ad8") {
  const holes = COACH_WIN.map((x) => `M${x - 20} -88 h40 v44 h-40 Z`).join(" ");
  return C(-96, -12, 13, "#3d3a4a") + C(-96, -12, 5, "#b3b9c4") + C(-58, -12, 13, "#3d3a4a") + C(-58, -12, 5, "#b3b9c4")
    + C(58, -12, 13, "#3d3a4a") + C(58, -12, 5, "#b3b9c4") + C(96, -12, 13, "#3d3a4a") + C(96, -12, 5, "#b3b9c4")
    + P(`M-130 -100 H130 V-22 H-130 Z ${holes}`, c, { "fill-rule": "evenodd" }) + R(-130, -36, 260, 14, 4, d)
    + R(-138, -110, 276, 14, 7, "#ff5c5c") + R(-136, -22, 272, 6, 3, "#3d3a4a") + L("M-136 -19 H-146", "#3d3a4a", 4)
    + COACH_WIN.map((x) => R(x - 20, -88, 40, 44, 3, "none", { stroke: d, "stroke-width": 4 })).join("");
}
export function tracks(y) {
  let s = "";
  for (let x = 6; x < 440; x += 24) s += R(x, y - 3, 12, 10, 2, "#a5703f");
  return s + R(0, y - 5, 440, 4, 2, "#8a97a8") + R(0, y + 3, 440, 4, 2, "#8a97a8");
}
export const steamPuff = () => C(0, 0, 12, "#ffffff", { opacity: 0.95 }) + C(14, -8, 10, "#ffffff", { opacity: 0.9 }) + C(-10, -10, 9, "#ffffff", { opacity: 0.9 });

// ── bath time ──
export function tiles(y1, c = "#cfeaf7", line = "#ffffff") {
  let s = R(0, 0, 440, y1, 0, c);
  for (let x = 44; x < 440; x += 44) s += L(`M${x} 0 V${y1}`, line, 2);
  for (let y = 44; y < y1; y += 44) s += L(`M0 ${y} H440`, line, 2);
  return s;
}
export const tubBack = () => E(0, -96, 150, 16, "#e3eef6") + E(0, -96, 138, 11, "#bfe3f7");
export const tubFront = () => P("M-150 -96 H150 Q146 -20 110 -8 H-110 Q-146 -20 -150 -96 Z", "#ffffff")
  + R(-156, -104, 312, 14, 7, "#f3f7fb") + P("M-120 -8 L-128 12 H-112 L-104 -8 Z", "#ffd21c") + P("M120 -8 L128 12 H112 L104 -8 Z", "#ffd21c")
  + P("M-130 -84 Q-126 -40 -100 -26", "none", { stroke: "#e3eef6", "stroke-width": 6, "stroke-linecap": "round" });
export const suds = (s = 1) => G(`scale(${s})`, C(-12, 0, 10, "#ffffff") + C(4, -6, 12, "#ffffff") + C(18, 2, 9, "#ffffff")
  + C(-12, 0, 10, "none", { stroke: "#cde8f8", "stroke-width": 1.5 }) + C(4, -6, 12, "none", { stroke: "#cde8f8", "stroke-width": 1.5 }) + C(1, -10, 2.4, "#ffffff"));
export const mud = (s = 1, a = 0) => G(`scale(${s}) rotate(${a})`, P("M-12 -6 Q-8 -14 2 -12 Q12 -14 13 -4 Q16 6 6 9 Q-2 14 -9 8 Q-16 4 -12 -6 Z", "#8a5a2c") + C(10, 11, 3, "#8a5a2c") + C(-6, -6, 2.4, "#a8733f"));
export const sponge = () => R(-18, -12, 36, 24, 8, "#ffd94d") + C(-8, -4, 2.4, "#f0b800") + C(6, 2, 2.2, "#f0b800") + C(9, -6, 1.8, "#f0b800");
export const rubberDuck = () => E(0, -10, 18, 11, "#ffd21c") + C(10, -24, 10, "#ffd21c") + P("M18 -24 L28 -21 L18 -18 Z", "#ff8a3d") + C(12, -27, 2, INK) + Et(-4, -12, 9, 5, -15, "#f5c200");
export const waterDrops = () => [[-80, -60], [-100, -20], [84, -64], [104, -24], [-60, -100], [66, -104]].map(([x, y]) => G(`translate(${x} ${y})`, P("M0 -8 Q6 0 4 4 Q0 8 -4 4 Q-6 0 0 -8 Z", "#6ac3f2"))).join("");

// ── night ──
export function sleepyMoon() {
  return C(0, 0, 62, "#fff6c8", { opacity: 0.07 }) + C(0, 0, 52, "#fff6c8", { opacity: 0.08 }) + C(0, 0, 42, "#fff1b8") + C(-12, -14, 6, "#ffe98a") + C(16, 12, 8, "#ffe98a") + C(10, -22, 4, "#ffe98a")
    + face("sleep", { y: -2, sp: 13, my: 12, cy: 9, cs: 20, cr: 5 });
}
export const bigStar = (c = "#ffd21c") => C(0, 0, 28, "#ffe98a", { opacity: 0.1 }) + C(0, 0, 21, "#ffe98a", { opacity: 0.14 }) + P("M0 -20 L5.5 -6 L20 -5 L9 5 L12.5 19 L0 11 L-12.5 19 L-9 5 L-20 -5 L-5.5 -6 Z", c)
  + face("happy", { y: 0, sp: 4.5, er: 1.8, my: 5, cy: 4, cs: 7, cr: 2 });
export const dimStar = () => P("M0 -14 L3.8 -4 L14 -3.5 L6.3 3.5 L8.8 13 L0 7.7 L-8.8 13 L-6.3 3.5 L-14 -3.5 L-3.8 -4 Z", "none", { stroke: "#8a97c4", "stroke-width": 2, "stroke-dasharray": "3 3" });
export const shootingStar = () => L("M-90 20 L-10 0", "#fff1b8", 4, { opacity: 0.6 }) + L("M-60 16 L-10 3", "#ffffff", 2) + star(0, 0, 1.2, "#fff1b8");

// ── cake ──
export const plate = () => E(0, 0, 110, 14, "#e3e8ee") + E(0, -3, 100, 10, "#ffffff");
export const cakeLayer = (w, h, c, d) => R(-w / 2, -h, w, h, 12, c) + R(-w / 2, -14, w, 14, 7, d) + L(`M${-w / 2 + 14} ${-h + 18} H${-w / 2 + 34}`, "#ffffff", 4, { opacity: 0.4 });
export function icing(w, y) {
  let d = `M${-w / 2} ${y} H${w / 2} V${y + 10}`;
  const n = 7, step = w / n;
  for (let i = n; i > 0; i--) { const x = -w / 2 + i * step; d += ` Q${x - step / 4} ${y + (i % 2 ? 30 : 20)} ${x - step / 2} ${y + 10} Q${x - step * 0.75} ${y + 4} ${x - step} ${y + 10}`; }
  return P(d + " Z", "#fff6fb") + R(-w / 2 - 4, y - 6, w + 8, 12, 6, "#fff6fb");
}
export function sprinkles(w, y0, y1, n = 26, seed = 5) {
  const cs = ["#ff5c5c", "#4db3f2", "#ffd21c", "#58cc02", "#9b7fd8", "#ff9d3d"];
  let s = "", k = seed; const rnd = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
  for (let i = 0; i < n; i++) { const x = -w / 2 + 10 + rnd() * (w - 20), y = y0 + rnd() * (y1 - y0); s += R(x, y, 9, 3.4, 1.7, cs[i % cs.length], { transform: rot(rnd() * 180, x + 4.5, y + 1.7) }); }
  return s;
}
export const candle = (c) => R(-5, -40, 10, 40, 3, c) + L("M-5 -30 L5 -34 M-5 -18 L5 -22", "#ffffff", 2.4, { opacity: 0.7 }) + L("M0 -40 V-46", INK, 1.6);
export const candleFlame = () => P("M0 -8 Q7 2 0 10 Q-7 2 0 -8 Z", "#ff9d3d") + P("M0 -3 Q3 3 0 7 Q-3 3 0 -3 Z", "#ffd21c");

// ── gifts ──
export const boxBody = (c, rib, w = 68, h = 52) => R(-w / 2, -h, w, h, 6, c) + R(-w * 0.09, -h, w * 0.18, h, 2, rib) + R(-w / 2, -h, w, 9, 3, "#000000", { opacity: 0.1 })
  + R(-w / 2 + 8, -h + 16, 6, h - 26, 3, "#ffffff", { opacity: 0.3 });
export const boxLid = (c, rib, w = 68) => R(-w / 2 - 5, -16, w + 10, 18, 5, c) + R(-w * 0.09, -16, w * 0.18, 18, 2, rib)
  + P(`M0 -16 C${-w * 0.3} ${-w * 0.55} ${-w * 0.48} ${-w * 0.22} ${-w * 0.18} -16 Z`, rib) + P(`M0 -16 C${w * 0.3} ${-w * 0.55} ${w * 0.48} ${-w * 0.22} ${w * 0.18} -16 Z`, rib) + C(0, -16, w * 0.07, rib);

// ── fish tank ──
export function castle(x, y, s = 1) {
  return G(at(x, y, s), R(-30, -60, 60, 60, 3, "#c9b8a6") + R(-40, -86, 22, 86, 3, "#d9c8b6") + R(18, -86, 22, 86, 3, "#d9c8b6")
    + P("M-40 -86 h6 v-8 h5 v8 h5 v-8 h6 v8 Z", "#d9c8b6") + P("M18 -86 h6 v-8 h5 v8 h5 v-8 h6 v8 Z", "#d9c8b6")
    + P("M-10 0 V-24 Q0 -34 10 -24 V0 Z", "#6b5a4a") + R(-34, -70, 10, 12, 5, "#6b5a4a") + R(24, -70, 10, 12, 5, "#6b5a4a"));
}
export const puffer = (c = "#ffd94d") => {
  let sp = ""; for (let i = 0; i < 12; i++) { const a = i * 30 * Math.PI / 180; sp += L(`M${Math.cos(a) * 20} ${Math.sin(a) * 20} L${Math.cos(a) * 27} ${Math.sin(a) * 27}`, "#e6b800", 2.4); }
  return sp + P("M-22 0 L-34 -10 L-32 0 L-34 10 Z", "#f5c200") + C(0, 0, 22, c) + E(0, 8, 15, 10, "#fff6c8")
    + C(8, -6, 5.5, "#ffffff") + C(9, -6, 2.8, INK) + C(10, -7.2, 1, "#ffffff") + E(18, 3, 2.6, 3.2, "#c0475a") + C(4, 4, 3, CHEEK, { opacity: 0.8 });
};
export const starfishFriend = (c = "#ff9d3d") => P("M0 -22 L6 -7 L22 -6 L10 4 L14 20 L0 11 L-14 20 L-10 4 L-22 -6 L-6 -7 Z", c)
  + face("smile", { y: -1, sp: 4, er: 1.8, my: 5, cy: 4, cs: 6, cr: 2 });

export { star, glint, face, INK };

// ── racing ──
export function raceCar(c = "#ff5c5c", d = "#d94444", driver = "") {
  return C(-34, -15, 15, "#3d3a4a") + C(-34, -15, 6, "#b3b9c4") + C(36, -15, 15, "#3d3a4a") + C(36, -15, 6, "#b3b9c4")
    + (driver || "")
    + P("M-62 -22 Q-64 -44 -44 -46 L-10 -46 Q4 -64 26 -52 L50 -40 Q66 -36 64 -22 Z", c)
    + R(-66, -62, 10, 30, 3, d) + R(-72, -66, 24, 8, 3, d)
    + P("M-6 -46 Q6 -60 24 -52 L10 -44 Z", "#dff4ff") + R(-50, -36, 90, 5, 2.5, "#ffffff", { opacity: 0.8 })
    + C(4, -30, 9, "#ffffff") + `<text x="4" y="-25.5" text-anchor="middle" font-family="'Baloo 2',Nunito,sans-serif" font-weight="800" font-size="13" fill="${d}">1</text>`
    + P("M54 -32 L66 -30 L64 -24 L52 -24 Z", "#ffd21c");
}
// a racer's round helmet, seen from the side, riding in the car
export const helmet = (c = "#4db3f2") => C(-22, -62, 15, c) + P("M-22 -66 H-8 Q-6 -58 -12 -56 H-22 Z", "#2d3642") + C(-28, -68, 3, "#ffffff", { opacity: 0.7 });
export function snail(o = {}) {
  const shell = o.shell || "#ff9d3d";
  return E(0, -2, 34, 5, "#2f6b1a", { opacity: 0.14 })
    + P("M-30 0 Q-34 -12 -18 -14 L26 -14 Q38 -14 40 -2 Q40 0 36 0 Z", "#b9d98a")
    + L("M30 -14 L34 -34 M38 -12 L46 -30", "#9bbf5a", 3) + C(34, -36, 4.5, "#ffffff") + C(46, -32, 4.5, "#ffffff") + C(35, -36, 2.2, INK) + C(47, -32, 2.2, INK)
    + L("M36 -6 Q40 -2 44 -6", INK, 1.5)
    + C(-4, -30, 22, shell) + P("M-4 -30 m-14 0 a14 14 0 1 1 28 0 a9 9 0 1 1 -18 0 a4 4 0 1 1 8 0", "none", { stroke: "#e0782a", "stroke-width": 3.5, "stroke-linecap": "round" })
    + (o.helmet ? P("M24 -40 Q40 -60 56 -40 Z", o.helmet) : "");
}
export function checkerFlag(w = 60, h = 40, n = 6) {
  const m = Math.round(n * h / w), cw = w / n, ch = h / m;
  let s = R(0, 0, w, h, 2, "#ffffff");
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) if ((i + j) % 2) s += R(i * cw, j * ch, cw, ch, 0, "#2d3642");
  return s;
}
export const flagPole = () => R(-3, -150, 6, 150, 3, "#b3b9c4") + C(0, -152, 5, "#ffd21c") + G("translate(3 -146)", checkerFlag(62, 40, 6));
export function checkerLine(x, y0, y1, w = 14) {
  let s = ""; for (let y = y0, k = 0; y < y1; y += w / 2, k++) s += R(x + (k % 2) * (w / 2), y, w / 2, w / 2, 0, "#2d3642") + R(x + ((k + 1) % 2) * (w / 2), y, w / 2, w / 2, 0, "#ffffff");
  return s;
}
export const trophy = () => P("M-26 -80 H26 Q26 -40 0 -34 Q-26 -40 -26 -80 Z", "#ffd21c") + L("M-26 -74 Q-44 -72 -38 -56 Q-34 -48 -22 -48 M26 -74 Q44 -72 38 -56 Q34 -48 22 -48", "#f0b800", 5)
  + R(-5, -36, 10, 16, 3, "#f0b800") + R(-20, -20, 40, 8, 3, "#f0b800") + R(-24, -12, 48, 12, 4, "#b07a45") + C(-10, -66, 5, "#fff6c8", { opacity: 0.7 })
  + star(0, -58, 0.9, "#fff6c8");

// ── treasure ──
export function palm(x, y, s = 1) {
  return G(at(x, y, s), P("M-3 0 Q-8 -30 2 -56 L7 -55 Q0 -30 4 0 Z", "#a5703f")
    + P("M4 -56 Q-20 -70 -34 -56 Q-18 -62 4 -56 Z", "#4caf32") + P("M4 -56 Q28 -72 40 -54 Q22 -62 4 -56 Z", "#58cc02")
    + P("M4 -56 Q-10 -80 -24 -80 Q-8 -72 4 -56 Z", "#58cc02") + P("M4 -56 Q16 -84 32 -80 Q14 -70 4 -56 Z", "#4caf32") + C(2, -54, 3.5, "#8a5a2c") + C(8, -52, 3.5, "#8a5a2c"));
}
export const island = (rx = 46, ry = 20) => E(0, 0, rx + 8, ry + 5, "#8fd4f2") + E(0, 0, rx, ry, "#f5dca8") + E(-rx * 0.2, -ry * 0.25, rx * 0.55, ry * 0.45, "#9bd46a");
export const sailboat = (c = "#ff5c5c") => P("M-26 -6 H26 Q20 8 0 8 Q-20 8 -26 -6 Z", "#a5703f") + R(-1.5, -48, 3, 44, 1.5, "#8a5a2c")
  + P("M2 -46 L24 -12 H2 Z", "#ffffff") + P("M-2 -40 L-20 -12 H-2 Z", "#f7f3ee") + P("M2 -48 L14 -44 L2 -40 Z", c);
export const xMark = () => L("M-14 -14 L14 14 M14 -14 L-14 14", "#e8394a", 7);
export function chest(open = false) {
  const body = R(-36, -34, 72, 34, 5, "#a5703f") + R(-36, -34, 72, 8, 3, "#8a5a2c") + R(-36, -16, 72, 5, 2, "#8a5a2c") + R(-5, -26, 10, 12, 2, "#ffd21c");
  if (!open) return body + P("M-36 -34 Q-36 -58 0 -58 Q36 -58 36 -34 Z", "#b88048") + R(-36, -38, 72, 6, 3, "#8a5a2c");
  return P("M-36 -40 Q-40 -70 -4 -76 Q30 -80 36 -52 Z", "#b88048") + C(-16, -40, 9, "#ffd21c") + C(0, -44, 10, "#ffcf3d") + C(16, -40, 9, "#ffd21c")
    + C(-6, -36, 8, "#ffe36a") + C(10, -36, 8, "#ffd21c") + C(24, -38, 6, "#ff5c8a") + C(-26, -36, 6, "#4db3f2")
    + body + star(-10, -54, 0.6, "#ffffff") + star(14, -50, 0.5, "#ffffff");
}
export const compass = () => C(0, 0, 26, "#f7e3b8") + C(0, 0, 26, "none", { stroke: "#b88a4a", "stroke-width": 3 })
  + P("M0 -22 L5 0 L0 22 L-5 0 Z", "#e8394a") + P("M-22 0 L0 -5 L22 0 L0 5 Z", "#b88a4a") + C(0, 0, 3, "#6b4a2e")
  + `<text x="0" y="-27" text-anchor="middle" font-family="'Baloo 2',Nunito,sans-serif" font-weight="800" font-size="12" fill="#8a5a2c">N</text>`;
export const whale = () => P("M-40 0 Q-40 -30 0 -30 Q34 -30 40 -6 L56 -18 L52 2 L60 14 L38 6 Q30 14 0 14 Q-40 14 -40 0 Z", "#6a9fd8")
  + P("M-36 4 Q0 18 36 4 Q20 12 0 12 Q-24 12 -36 4 Z", "#dff4ff") + C(-22, -10, 3, INK) + L("M-14 -30 Q-18 -44 -10 -48 M-14 -30 Q-8 -44 -2 -44", "#8fd4f2", 3);

// ── balls and goals ──
export function soccerBall(r = 16) {
  return C(0, 0, r, "#ffffff") + P(`M0 ${-r * 0.35} L${r * 0.33} ${-r * 0.1} L${r * 0.2} ${r * 0.28} L${-r * 0.2} ${r * 0.28} L${-r * 0.33} ${-r * 0.1} Z`, "#2d3642")
    + P(`M0 ${-r} L${r * 0.18} ${-r * 0.72} L${-r * 0.18} ${-r * 0.72} Z`, "#2d3642") + P(`M${r * 0.95} ${-r * 0.3} L${r * 0.7} ${r * 0.05} L${r * 0.66} ${-r * 0.45} Z`, "#2d3642")
    + P(`M${-r * 0.95} ${-r * 0.3} L${-r * 0.7} ${r * 0.05} L${-r * 0.66} ${-r * 0.45} Z`, "#2d3642")
    + L(`M0 ${-r * 0.35} V${-r * 0.72} M${r * 0.33} ${-r * 0.1} L${r * 0.7} ${-r * 0.2} M${-r * 0.33} ${-r * 0.1} L${-r * 0.7} ${-r * 0.2} M${r * 0.2} ${r * 0.28} L${r * 0.4} ${r * 0.7} M${-r * 0.2} ${r * 0.28} L${-r * 0.4} ${r * 0.7}`, "#2d3642", 1.4)
    + C(-r * 0.45, -r * 0.5, r * 0.15, "#ffffff", { opacity: 0.8 });
}
export function goal() {
  let net = "";
  for (let x = -70; x <= 70; x += 14) net += L(`M${x} -120 L${x * 0.8 + 6} 0`, "#ffffff", 1.4, { opacity: 0.8 });
  for (let y = -110; y < 0; y += 14) net += L(`M-70 ${y} H70`, "#ffffff", 1.4, { opacity: 0.8 });
  return R(-70, -120, 140, 120, 0, "#ffffff", { opacity: 0.18 }) + net
    + R(-76, -126, 152, 8, 4, "#ffffff") + R(-76, -126, 8, 126, 4, "#ffffff") + R(68, -126, 8, 126, 4, "#ffffff");
}
export function basketball(r = 16) {
  return C(0, 0, r, "#ff8a3d") + L(`M${-r} 0 H${r} M0 ${-r} V${r} M${-r * 0.7} ${-r * 0.7} Q0 0 ${-r * 0.7} ${r * 0.7} M${r * 0.7} ${-r * 0.7} Q0 0 ${r * 0.7} ${r * 0.7}`, "#b8541a", 1.8)
    + C(-r * 0.45, -r * 0.45, r * 0.16, "#ffffff", { opacity: 0.6 });
}
export const backboard = () => R(-6, -10, 12, 230, 4, "#9aa7b8") + R(-54, -110, 108, 76, 8, "#ffffff") + R(-54, -110, 108, 76, 8, "none", { stroke: "#ff5c5c", "stroke-width": 5 })
  + R(-20, -84, 40, 30, 3, "none", { stroke: "#ff5c5c", "stroke-width": 4 });
export const hoopRim = () => E(0, 0, 32, 7, "none", { stroke: "#ff5c5c", "stroke-width": 5 });
export function hoopNet() {
  let s = "";
  for (let i = 0; i <= 6; i++) { const x = -30 + i * 10; s += L(`M${x} 2 L${x * 0.6} 40`, "#ffffff", 2); }
  return s + L("M-27 14 H27 M-22 27 H22 M-18 40 H18", "#ffffff", 2);
}
export const scoreDot = (on) => C(0, 0, 10, on ? "#ffd21c" : "#d9dee6") + (on ? star(0, 0, 0.75, "#ffffff") : "");

// ── robots ──
export const robotLegs = () => R(-34, -60, 20, 50, 8, "#9aa7b8") + R(14, -60, 20, 50, 8, "#9aa7b8")
  + L("M-34 -40 H-14 M14 -40 H34", "#7d8aa0", 3) + R(-42, -14, 34, 14, 7, "#ff5c5c") + R(8, -14, 34, 14, 7, "#ff5c5c");
export const robotBody = () => R(-56, -96, 112, 96, 18, "#4db3f2") + R(-56, -96, 112, 16, 10, "#6ac3f2") + R(-40, -76, 80, 56, 10, "#3a9ad8")
  + C(-40, -86, 3.5, "#dff4ff") + C(40, -86, 3.5, "#dff4ff") + C(-40, -10, 3.5, "#dff4ff") + C(40, -10, 3.5, "#dff4ff");
export const robotArm = (side) => G(`scale(${side} 1)`, R(0, -12, 34, 20, 10, "#9aa7b8") + L("M10 -12 V8 M22 -12 V8", "#7d8aa0", 2.5)
  + R(30, -18, 26, 30, 10, "#ffd21c") + P("M52 -10 L64 -18 M52 4 L64 12", "none", { stroke: "#ffd21c", "stroke-width": 7, "stroke-linecap": "round" }));
export const robotHead = () => R(-10, -12, 20, 14, 4, "#7d8aa0") + R(-48, -86, 96, 76, 20, "#b9c7d6") + R(-48, -86, 96, 14, 10, "#cfdae6")
  + R(-36, -70, 72, 40, 14, "#2d3642") + R(-56, -60, 10, 26, 5, "#ff5c5c") + R(46, -60, 10, 26, 5, "#ff5c5c")
  + L("M-14 -20 Q0 -12 14 -20", "#7d8aa0", 3);
export const robotEyes = () => C(-18, -52, 11, "#58cc02", { opacity: 0.35 }) + C(18, -52, 11, "#58cc02", { opacity: 0.35 })
  + C(-18, -52, 7, "#9cf05a") + C(18, -52, 7, "#9cf05a") + C(-15, -55, 2.4, "#ffffff") + C(21, -55, 2.4, "#ffffff")
  + P("M-12 -40 Q0 -32 12 -40", "none", { stroke: "#9cf05a", "stroke-width": 3, "stroke-linecap": "round" });
export const antenna = () => R(-3, -40, 6, 40, 3, "#7d8aa0") + C(0, -44, 9, "#ff5c5c") + C(-3, -47, 2.6, "#ffffff", { opacity: 0.8 });
export const robotHeart = () => R(-20, -18, 40, 36, 8, "#2d3642") + heartPath(0, 0, 1.1, "#ff5c8a");
function heartPath(x, y, s, c) { return G(at(x, y, s), P("M0 8 C -12 0 -10 -12 0 -6 C 10 -12 12 0 0 8 Z", c)); }
export function gear(r, c = "#e3e8ee", teeth = 8) {
  let d = "";
  for (let i = 0; i < teeth; i++) { const a = (i / teeth) * Math.PI * 2; d += R(-r * 0.18, -r - r * 0.25, r * 0.36, r * 0.4, 2, c, { transform: `rotate(${(a * 180) / Math.PI})` }); }
  return d + C(0, 0, r, c) + C(0, 0, r * 0.38, "#ffffff", { opacity: 0.6 });
}

// ── castles ──
const crenel = (x, y, w, n, c) => { let s = ""; const cw = w / (n * 2 - 1); for (let i = 0; i < n; i++) s += R(x + i * cw * 2, y - 12, cw, 14, 2, c); return s; };
export const wallBlock = (w = 110, h = 90, c = "#d9c8b6", d = "#c4b09c") => R(-w / 2, -h, w, h, 3, c) + crenel(-w / 2, -h, w, 5, c)
  + L(`M${-w / 2} ${-h * 0.66} H${w / 2} M${-w / 2} ${-h * 0.33} H${w / 2} M${-w / 4} ${-h} V${-h * 0.66} M${w / 4} ${-h * 0.66} V${-h * 0.33} M${-w / 4} ${-h * 0.33} V0`, d, 2.5);
export const castleTower = (w = 64, h = 190, roof = "#7a5fb0", c = "#e3d4c3") => R(-w / 2, -h, w, h, 3, c) + P(`M${-w / 2 - 8} ${-h} L0 ${-h - 70} L${w / 2 + 8} ${-h} Z`, roof)
  + L(`M${-w / 2} ${-h * 0.7} H${w / 2} M${-w / 2} ${-h * 0.4} H${w / 2}`, "#cdbba7", 2.5);
export const keep = (w = 120, h = 160, c = "#e3d4c3") => R(-w / 2, -h, w, h, 3, c) + crenel(-w / 2, -h, w, 6, c) + L(`M${-w / 2} ${-h * 0.5} H${w / 2}`, "#cdbba7", 2.5);
export const castleGate = () => P("M-30 0 V-54 Q-30 -84 0 -84 Q30 -84 30 -54 V0 Z", "#8a5a2c") + L("M-18 0 V-70 M-6 0 V-82 M6 0 V-82 M18 0 V-70 M-30 -30 H30 M-30 -56 H30", "#6b4a2e", 3);
export const castleWin = () => P("M-9 0 V-16 Q-9 -26 0 -26 Q9 -26 9 -16 V0 Z", "#ffe08a") + L("M0 -26 V0", "#f0b800", 1.5);
export const pennant = (c = "#ff5c5c") => R(-2, -46, 4, 46, 2, "#8a5a2c") + P("M2 -46 L34 -38 L2 -28 Z", c);
export function firework(c1 = "#ffd21c", c2 = "#ff5c8a") {
  let s = "";
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; s += L(`M${Math.cos(a) * 10} ${Math.sin(a) * 10} L${Math.cos(a) * 32} ${Math.sin(a) * 32}`, i % 2 ? c1 : c2, 4); }
  return s + C(0, 0, 6, "#ffffff");
}

// ── dinosaurs ──
// the same long-neck dinosaur twice: alive, and as the bones in the sand
export function dino(o = {}) {
  const c = o.color || "#6fcf6a", d = o.dark || "#58b754", belly = o.belly || "#c9f0a8";
  return P("M-60 -60 Q-110 -58 -150 -30 Q-110 -44 -62 -40 Z", c)
    + R(-44, -52, 22, 52, 10, d) + R(24, -52, 22, 52, 10, d)
    + E(0, -70, 76, 46, c) + E(4, -52, 52, 22, belly)
    + R(-58, -52, 22, 52, 10, c) + R(38, -52, 22, 52, 10, c)
    + P("M40 -96 Q64 -150 70 -200 L96 -196 Q92 -144 70 -86 Z", c)
    + E(92, -206, 30, 20, c) + E(110, -198, 16, 10, c)
    + face(o.face || "grin", { x: 94, y: -212, sp: 9, er: 3.4, my: 12, cy: 8, cs: 14, cr: 4 })
    + C(-20, -90, 7, d) + C(8, -100, 6, d) + C(30, -86, 5, d) + C(-40, -76, 5, d) + C(78, -150, 4, d) + C(72, -124, 4, d);
}
export function bones() {
  const b = "#f7f0e0", k = "#e6dcc6";
  let s = L("M-60 -52 Q-110 -48 -150 -30", b, 6);
  for (let i = 0; i < 6; i++) { const t = i / 5, x = -70 - t * 76, y = -50 + t * 18; s += C(x, y, 5 - t * 2, b); }
  for (let i = -3; i <= 3; i++) s += L(`M${i * 16} -110 Q${i * 18} -70 ${i * 16} -40`, b, 6);
  s += L("M-50 -100 Q0 -118 50 -100", b, 7) + L("M-60 -40 Q0 -30 60 -40", k, 5);
  s += L("M-47 -40 V-4 M35 -40 V-4 M-33 -44 V-4 M49 -44 V-4", b, 7) + E(-47, -2, 11, 5, b) + E(49, -2, 11, 5, b) + E(-33, -2, 9, 4, k) + E(35, -2, 9, 4, k);
  for (let i = 0; i < 7; i++) { const t = i / 6, x = 50 + t * 26 + Math.sin(t * 2) * 6, y = -100 - t * 96; s += C(x, y, 6, b); }
  s += E(92, -206, 30, 20, b) + E(110, -198, 16, 10, b) + C(90, -212, 7, "#c9bda2") + L("M100 -196 H120", "#c9bda2", 2.5);
  return s;
}
export const sandMound = (w = 64) => P(`M${-w / 2} 0 Q${-w / 2 + 8} ${-w * 0.5} 0 ${-w * 0.52} Q${w / 2 - 8} ${-w * 0.5} ${w / 2} 0 Z`, "#e8c483")
  + P(`M${-w / 3} ${-w * 0.2} Q${-w / 6} ${-w * 0.4} ${w / 8} ${-w * 0.42}`, "none", { stroke: "#f5dca8", "stroke-width": 5, "stroke-linecap": "round" }) + C(w / 5, -w * 0.18, 2.4, "#d4ab6a");
export const dustBrush = () => G(rot(-35), R(-4, -60, 8, 44, 4, "#b07a45") + R(-12, -18, 24, 10, 3, "#ffd21c") + P("M-12 -8 H12 L10 8 H-10 Z", "#8a5a2c") + L("M-8 -6 L-9 8 M-3 -6 V8 M3 -6 V8 M8 -6 L9 8", "#6b4a2e", 1.6));
export const dustPuff = () => C(-12, -6, 9, "#f5dca8", { opacity: 0.9 }) + C(4, -12, 11, "#f7e5bf", { opacity: 0.9 }) + C(16, -4, 8, "#f5dca8", { opacity: 0.9 });
export const roar = () => L("M0 -20 q14 -10 22 0 M4 -2 q16 -8 26 4 M0 16 q14 -6 22 6", "#ffffff", 4);

// ── pizza ──
export const pizzaBoard = () => E(0, 8, 162, 80, "#c98f4f") + E(0, 0, 162, 80, "#dba566") + R(150, -10, 70, 20, 10, "#c98f4f");
export const dough = () => E(0, 0, 138, 66, "#f2cf8f") + E(0, 0, 126, 58, "#f7dca8");
export const sauce = () => E(0, 0, 122, 56, "#e8523a") + E(-30, -12, 40, 14, "#f06a4f", { opacity: 0.6 });
export const cheese = () => P("M-118 -6 Q-110 -40 -60 -50 Q0 -62 60 -50 Q112 -40 118 -4 Q110 30 60 44 Q0 56 -60 46 Q-110 32 -118 -6 Z", "#ffd76a")
  + E(-40, -20, 18, 8, "#ffe8a0") + E(30, 10, 22, 8, "#ffe8a0") + E(70, -24, 12, 6, "#ffe8a0") + E(-70, 20, 14, 6, "#ffe8a0");
export const spread = (list, fn) => list.map(([x, y]) => G(`translate(${x} ${y})`, fn())).join("");
export const pepperoni = () => E(0, 0, 13, 9, "#c93a2e") + C(-4, -2, 1.8, "#a82a20") + C(4, 2, 1.6, "#a82a20");
export const mushroom = () => P("M-11 0 Q-11 -12 0 -12 Q11 -12 11 0 Z", "#f0e6d6") + R(-4, -1, 8, 8, 3, "#e3d4c3");
export const pepper = () => P("M-10 -2 Q0 -12 10 -2 Q6 4 0 2 Q-6 4 -10 -2 Z", "none", { stroke: "#4caf32", "stroke-width": 4 });
export const olive = () => E(0, 0, 7, 5.5, "#3d3a4a") + E(0, 0, 3, 2.2, "#f7dca8");
export const basil = () => P("M-10 0 Q0 -12 10 0 Q0 8 -10 0 Z", "#3fae14") + L("M-8 0 H8", "#2f8a10", 1.2);
export const chefHat = () => R(-18, -8, 36, 10, 4, "#ffffff") + C(-12, -18, 11, "#ffffff") + C(0, -24, 13, "#ffffff") + C(12, -18, 11, "#ffffff");
export const ovenBack = () => R(-70, -150, 140, 150, 20, "#c9743a") + P("M-70 -150 Q0 -210 70 -150 Z", "#c9743a") + P("M-44 -40 V-80 Q0 -120 44 -80 V-40 Z", "#3d2b2b")
  + P("M-34 -44 Q0 -70 34 -44 Z", "#ff9d3d") + R(-80, -40, 160, 12, 4, "#a8602e");

// ── monsters ──
export const monsterBody = (c = "#4fd1c5", d = "#3cb8ad") => P("M-80 -10 Q-96 -120 -40 -170 Q0 -196 40 -170 Q96 -120 80 -10 Q60 6 0 4 Q-60 6 -80 -10 Z", c)
  + P("M-50 -30 Q0 -10 50 -30 Q40 -90 0 -96 Q-40 -90 -50 -30 Z", "#8fe8de", { opacity: 0.5 }) + E(-54, -140, 8, 16, "#ffffff", { opacity: 0.35 }) + E(0, 2, 70, 8, d, { opacity: 0.4 });
export const smallEyes = () => C(-18, -120, 5, INK) + C(18, -120, 5, INK);
export const smallMouth = () => L("M-10 -96 Q0 -90 10 -96", INK, 3);
export const bigEyes = () => [[-36, -124, 17], [36, -124, 17], [0, -150, 14]].map(([x, y, r]) => C(x, y, r, "#ffffff") + C(x + 2, y + 2, r * 0.5, INK) + C(x + 4, y - 1, r * 0.18, "#ffffff")).join("");
export const horns = () => P("M-50 -156 Q-70 -200 -44 -214 Q-50 -186 -32 -166 Z", "#ffd21c") + P("M50 -156 Q70 -200 44 -214 Q50 -186 32 -166 Z", "#ffd21c");
export const monsterSpots = () => C(-54, -70, 10, "#9b7fd8") + C(54, -60, 12, "#9b7fd8") + C(-30, -40, 7, "#9b7fd8") + C(40, -100, 7, "#9b7fd8") + C(-60, -110, 6, "#9b7fd8") + C(20, -30, 6, "#9b7fd8");
export const toothyGrin = () => P("M-34 -92 Q0 -52 34 -92 Z", "#c0475a") + P("M-24 -88 L-18 -78 L-12 -88 Z M12 -88 L18 -78 L24 -88 Z", "#ffffff") + E(0, -74, 10, 5, "#ff8fa3");
export const monsterArms = () => P("M-80 -80 Q-120 -100 -128 -140 Q-116 -144 -108 -124 Q-96 -104 -74 -96 Z", "#4fd1c5") + C(-124, -144, 10, "#4fd1c5")
  + P("M80 -80 Q120 -100 128 -140 Q116 -144 108 -124 Q96 -104 74 -96 Z", "#4fd1c5") + C(124, -144, 10, "#4fd1c5");
export const sneakers = () => P("M-66 0 Q-68 -18 -44 -18 Q-26 -18 -22 0 Z", "#ff5c5c") + R(-68, -4, 48, 8, 4, "#ffffff") + L("M-50 -14 L-44 -8 M-42 -16 L-36 -10", "#ffffff", 2)
  + P("M66 0 Q68 -18 44 -18 Q26 -18 22 0 Z", "#ff5c5c") + R(20, -4, 48, 8, 4, "#ffffff") + L("M50 -14 L44 -8 M42 -16 L36 -10", "#ffffff", 2);
export const bowTie = () => P("M0 0 L-22 -12 L-22 12 Z", "#ff5c8a") + P("M0 0 L22 -12 L22 12 Z", "#ff5c8a") + C(0, 0, 6, "#e84a78") + C(-14, -2, 2.2, "#ffffff") + C(14, 2, 2.2, "#ffffff");
export const crown = () => P("M-34 0 L-34 -30 L-18 -14 L0 -38 L18 -14 L34 -30 L34 0 Z", "#ffd21c") + R(-34, -6, 68, 8, 3, "#f0b800") + C(0, -38, 5, "#ff5c8a") + C(-34, -30, 4, "#4db3f2") + C(34, -30, 4, "#4db3f2");
export const sandClump = (r = 40) => P(`M${-r} 0 Q${-r} ${-r * 0.8} ${-r * 0.4} ${-r * 0.9} Q0 ${-r * 1.15} ${r * 0.5} ${-r * 0.85} Q${r} ${-r * 0.6} ${r} 0 Q${r} ${r * 0.8} ${r * 0.3} ${r * 0.9} Q${-r * 0.5} ${r * 1.05} ${-r} 0 Z`, "#e8c483")
  + E(-r * 0.25, -r * 0.4, r * 0.35, r * 0.16, "#f5dca8") + C(r * 0.4, r * 0.3, r * 0.08, "#c9a063") + C(-r * 0.4, r * 0.4, r * 0.07, "#c9a063");
