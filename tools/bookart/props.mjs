// Things the fuller books' characters hold, use and stand near. Each is drawn
// with its base at (0, 0); place it with G(at(x, y, s), prop()).
import { C, E, Et, R, P, L, G, at, rot, glint, INK } from "./kit.mjs";

export const pail = (c = "#ff8fb0") => L("M-17 -30 Q0 -52 17 -30", "#9aa7b8", 3) + P("M-18 -30 H18 L14 0 H-14 Z", c)
  + R(-20, -33, 40, 6, 3, "#e0648a") + glint(-9, -20, 2.5);
export const pebble = (c = "#b9b2a8", s = 1) => G(`scale(${s})`, E(0, -6, 11, 7, c) + E(-3, -9, 3.5, 2, "#ffffff", { opacity: 0.5 }));
export const paintPot = (c = "#ff5c8a") => R(-10, -18, 20, 18, 4, "#f0f0f5") + R(-10, -18, 20, 7, 3, c) + P("M-4 -11 q2 6 4 0", c);
export const brush = (c = "#ff5c8a") => G(rot(20), R(-2.5, -40, 5, 30, 2.5, "#b07a45") + R(-4, -12, 8, 8, 2, "#b3b9c4") + P("M-4 -4 Q0 8 4 -4 Z", c));
export const pole = () => R(-5, -110, 10, 110, 3, "#b07a45") + R(-9, -114, 18, 8, 3, "#8f5f33");
export const pie = () => E(0, -4, 26, 6, "#e3e8ee") + P("M-22 -6 Q-20 -24 0 -24 Q20 -24 22 -6 Z", "#e8a85a")
  + L("M-12 -20 L-4 -8 M0 -23 L8 -8 M10 -20 L16 -9", "#c98441", 2.5) + C(-6, -16, 2.5, "#c0475a") + C(6, -14, 2.5, "#c0475a");
export function bunting(x0, y0, x1, y1, sag = 20) {
  const cols = ["#ff5c5c", "#ffd21c", "#4db3f2", "#58cc02", "#ff8fb0", "#9b7fd8"];
  let s = L(`M${x0} ${y0} Q${(x0 + x1) / 2} ${(y0 + y1) / 2 + sag * 2} ${x1} ${y1}`, "#b07a45", 2);
  const n = 7;
  for (let i = 1; i < n; i++) {
    const t = i / n, x = (1 - t) * (1 - t) * x0 + 2 * t * (1 - t) * (x0 + x1) / 2 + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * ((y0 + y1) / 2 + sag * 2) + t * t * y1;
    s += P(`M${x - 9} ${y} L${x + 9} ${y} L${x} ${y + 18} Z`, cols[i % cols.length]);
  }
  return s;
}
export const balloon = (c = "#ff5c5c") => L("M0 0 q-4 -20 0 -40", "#9aa7b8", 1.5) + E(0, -58, 14, 17, c) + P("M-3 -41 L3 -41 L0 -37 Z", c) + glint(-5, -64, 3);
export const boat = (c = "#e8524a") => P("M-70 -30 H70 Q60 0 40 0 H-40 Q-60 0 -70 -30 Z", c)
  + R(-72, -34, 144, 8, 4, "#ffffff") + L("M-40 -14 H40", "#c9403a", 3);
export const oar = () => G(rot(-35), R(-2.5, -60, 5, 64, 2.5, "#b07a45") + E(0, 12, 7, 14, "#b07a45"));
export const basket = (inside = "") => inside + L("M-24 -26 Q0 -58 24 -26", "#b07a45", 4)
  + P("M-26 -28 H26 L20 0 H-20 Z", "#d9a05a") + L("M-24 -18 H24 M-22 -9 H22", "#b07a45", 2) + L("M-12 -28 L-10 0 M0 -28 V0 M12 -28 L10 0", "#c98f4f", 2);
export const berries = () => C(-10, -30, 5, "#8a3ad9") + C(-3, -33, 5, "#e8394a") + C(4, -30, 5, "#8a3ad9") + C(10, -33, 5, "#e8394a");
export const bun = () => E(0, -8, 16, 9, "#e8a85a") + E(-3, -12, 6, 2.5, "#ffffff", { opacity: 0.35 });
export const banana = () => P("M-20 -8 Q0 6 22 -12 Q20 -6 10 0 Q-6 8 -22 -4 Z", "#ffd21c") + C(22, -12, 2, "#8a5a2c");
export const ball = (r = 18) => C(0, -r, r, "#ffffff") + P(`M0 ${-2 * r} A${r} ${r} 0 0 1 ${r} ${-r} L0 ${-r} Z`, "#ff5c5c")
  + P(`M${r} ${-r} A${r} ${r} 0 0 1 0 0 L0 ${-r} Z`, "#4db3f2") + P(`M0 0 A${r} ${r} 0 0 1 ${-r} ${-r} L0 ${-r} Z`, "#ffd21c") + C(0, -r, 3, "#ffffff");
export const blanket = () => P("M-60 0 L-50 -24 H50 L60 0 Z", "#ff6b6b") + L("M-40 -24 L-46 0 M-20 -24 L-22 0 M0 -24 V0 M20 -24 L22 0 M40 -24 L46 0 M-55 -12 H55", "#ffffff", 3, { opacity: 0.7 });
export const table = (w = 120) => R(-w / 2, -54, w, 10, 4, "#c98f4f") + R(-w / 2 + 8, -44, 8, 44, 3, "#b07a45") + R(w / 2 - 16, -44, 8, 44, 3, "#b07a45");
export const bowl = (c = "#4db3f2") => P("M-24 -22 Q-22 0 0 0 Q22 0 24 -22 Z", c) + R(-26, -25, 52, 5, 2.5, "#8fd4f2");
export const batter = () => E(0, -22, 22, 5, "#f5dca8") + L("M-8 -24 q6 -4 12 0", "#e6c68c", 2);
export const spoon = () => G(rot(25), R(-2, -46, 4, 36, 2, "#b3b9c4") + E(0, -8, 5, 7, "#b3b9c4"));
export const milk = () => R(-10, -40, 20, 40, 5, "#ffffff") + R(-7, -46, 14, 8, 2, "#4db3f2") + R(-10, -26, 20, 12, 2, "#4db3f2");
export const muffin = (top = "#e8a85a") => P("M-12 -12 H12 L9 0 H-9 Z", "#ff8fb0") + L("M-6 -12 L-5 0 M0 -12 V0 M6 -12 L5 0", "#f06d97", 1.5)
  + P("M-14 -12 Q-14 -26 0 -26 Q14 -26 14 -12 Z", top) + C(-5, -19, 2, "#6a3ad9") + C(4, -21, 2, "#6a3ad9");
export const melon = () => P("M-18 0 A18 18 0 0 1 18 0 Z", "#58cc02") + P("M-15 0 A15 15 0 0 1 15 0 Z", "#ff6b6b") + C(-6, -6, 1.3, INK) + C(0, -9, 1.3, INK) + C(6, -6, 1.3, INK);
export const syrup = () => R(-9, -34, 18, 34, 6, "#c97a2a") + R(-4, -42, 8, 9, 2, "#8a5a2c") + R(-7, -24, 14, 10, 2, "#fff6e0");
export const oven = () => R(-50, -90, 100, 90, 8, "#f0f0f5") + R(-40, -62, 80, 44, 6, "#3d4a5c") + R(-34, -56, 68, 32, 4, "#ff9d3d", { opacity: 0.55 })
  + R(-40, -80, 80, 8, 4, "#b3b9c4") + C(-30, -84, 3.5, "#e8524a") + C(-18, -84, 3.5, "#e8524a") + C(30, -84, 3.5, "#9aa7b8");
export const tray = (n = 3) => { let s = R(-40, -4, 80, 6, 3, "#b3b9c4"); for (let i = 0; i < n; i++) s += G(`translate(${-24 + i * 24} -4) scale(.85)`, muffin(i % 2 ? "#c98441" : "#e8a85a")); return s; };
export const nest = () => E(0, -8, 34, 12, "#a5703f") + E(0, -14, 26, 7, "#6b4a2e") + L("M-30 -12 q14 6 30 -2 q14 -6 30 2 M-26 -4 q16 4 30 -2 q14 -4 24 2", "#c98f4f", 2.5);
export const door = (c = "#b07a45") => P("M-22 0 V-62 Q-22 -80 0 -80 Q22 -80 22 -62 V0 Z", c) + C(12, -36, 3, "#ffd21c")
  + R(-14, -64, 28, 20, 4, "#9a6b3a") + R(-14, -38, 28, 26, 4, "#9a6b3a");
export const net = () => R(-2.5, -76, 5, 76, 2.5, "#b07a45") + P("M-18 -92 Q-14 -58 0 -54 Q14 -58 18 -92 Z", "#e8f4fb", { opacity: 0.9 })
  + L("M-14 -86 L10 -60 M-4 -92 L14 -70 M14 -86 L-10 -60 M4 -92 L-14 -70", "#b8c8d8", 1.5) + E(0, -92, 19, 7, "none", { stroke: "#ff5c5c", "stroke-width": 4 });
export const log = (w = 100) => R(-w / 2, -26, w, 26, 13, "#a5703f") + E(w / 2 - 6, -13, 9, 13, "#c98f4f") + C(w / 2 - 6, -13, 5, "#a5703f", { opacity: 0.6 })
  + L(`M${-w / 2 + 14} -18 H${w / 2 - 30} M${-w / 2 + 24} -9 H${w / 2 - 40}`, "#8f5f33", 2);
export const noodles = () => P("M-26 -24 Q-24 0 0 0 Q24 0 26 -24 Z", "#ff8f8f") + E(0, -24, 26, 6, "#ffe9b0")
  + L("M-14 -26 q4 -8 8 0 q4 -8 8 0 q4 -8 8 0", "#f5d27a", 2.5) + L("M8 -30 L30 -58 M14 -28 L36 -54", "#b07a45", 3);
export const tuba = (s = 1) => G(`scale(${s})`, C(0, -30, 20, "none", { stroke: "#ffcf3d", "stroke-width": 8 }) + P("M8 -50 Q30 -64 34 -86 L50 -90 Q40 -58 16 -44 Z", "#ffcf3d")
  + E(42, -88, 12, 5, "#f0b82a", { transform: rot(-20, 42, -88) }) + R(-24, -38, 8, 18, 3, "#e0a82a") + glint(-8, -44, 3));
export const teapot = () => E(0, -16, 20, 16, "#ff8fb0") + E(0, -30, 8, 3, "#f06d97") + C(0, -34, 3, "#f06d97")
  + L("M18 -20 Q30 -24 32 -32", "#ff8fb0", 5) + L("M-18 -22 Q-30 -18 -20 -8", "#ff8fb0", 4) + glint(-8, -22, 3);
export const cup = (c = "#ffffff") => P("M-9 -14 H9 L7 0 H-7 Z", c) + L("M9 -11 q6 0 5 5 q-1 3 -6 3", c, 2.5) + E(0, -14, 9, 2.4, "#c98441");
export const hole = (w = 60) => E(0, -4, w / 2 + 10, 9, "#b07a45") + E(0, -4, w / 2, 7, "#6b4a2e");
export const dirt = () => P("M-24 0 Q-14 -22 0 -24 Q16 -22 26 0 Z", "#b07a45") + C(-8, -14, 2, "#8f5f33") + C(8, -8, 2, "#8f5f33");
export const shovel = () => G(rot(-20), R(-2, -60, 4, 44, 2, "#b07a45") + P("M-9 -18 H9 L6 0 Q0 6 -6 0 Z", "#9aa7b8"));
export const puff = (s = 1) => G(`scale(${s})`, C(0, -8, 9, "#e6d3b3") + C(10, -12, 7, "#e6d3b3") + C(-10, -10, 6, "#e6d3b3"));
export const splash = () => L("M-30 -10 q-10 -14 -4 -24 M-14 -18 q-2 -16 6 -22 M14 -18 q2 -16 -6 -22 M30 -10 q10 -14 4 -24", "#ffffff", 4)
  + C(-38, -34, 3, "#dff4ff") + C(38, -34, 3, "#dff4ff") + C(0, -46, 3, "#dff4ff");
export const kite = (c1 = "#ff5c5c", c2 = "#ffd21c") => P("M0 -70 L26 -36 L0 0 L-26 -36 Z", c1) + P("M0 -70 L26 -36 L0 -36 Z", c2) + P("M0 0 L-26 -36 L0 -36 Z", c2)
  + L("M0 -70 V0 M-26 -36 H26", "#ffffff", 2, { opacity: 0.8 })
  + L("M0 0 q10 16 -4 30 q-12 14 4 30", "#9aa7b8", 1.8) + P("M-4 22 l-8 -5 v10 Z M-4 22 l8 -5 v10 Z", "#4db3f2") + P("M-2 48 l-8 -5 v10 Z M-2 48 l8 -5 v10 Z", "#58cc02");
export const kiteString = (x0, y0, x1, y1) => L(`M${x0} ${y0} Q${(x0 + x1) / 2 + 20} ${(y0 + y1) / 2 + 30} ${x1} ${y1}`, "#ffffff", 1.6);
export const cornStalk = (s = 1) => G(`scale(${s})`, L("M0 0 V-90", "#6fbf4a", 5) + Et(-12, -46, 16, 5, -35, "#7cc95c") + Et(12, -64, 16, 5, 35, "#7cc95c")
  + Et(8, -30, 6, 14, 15, "#ffd21c") + Et(10, -28, 5, 12, 15, "#8fd06a") + Et(-8, -76, 6, 14, -15, "#ffd21c"));
export const carrot = () => P("M-8 -34 Q0 -38 8 -34 L2 0 Q0 3 -2 0 Z", "#ff8a3d") + L("M-4 -24 H2 M-3 -14 H2", "#e5672a", 1.6)
  + Et(-5, -40, 3, 8, -25, "#58cc02") + Et(5, -40, 3, 8, 25, "#58cc02") + E(0, -42, 3, 8, "#6fd644");
export const gift = (c = "#9b7fd8", rib = "#ffd21c", open = false) => R(-22, -36, 44, 36, 5, c) + R(-4, -36, 8, 36, 2, rib)
  + (open ? E(0, -36, 20, 5, "#7d63b5") : R(-25, -44, 50, 10, 4, c) + R(-4, -44, 8, 10, 2, rib) + Et(-9, -50, 9, 5, -25, rib) + Et(9, -50, 9, 5, 25, rib) + C(0, -48, 3.5, "#f0b82a"));
export const guitar = () => G(rot(-30), E(0, -18, 16, 18, "#e8a85a") + E(0, -44, 12, 13, "#e8a85a") + C(0, -30, 5, "#8f5f33")
  + R(-3, -96, 6, 60, 2, "#8f5f33") + R(-5, -104, 10, 12, 3, "#6b4a2e") + L("M-1.5 -96 V-10 M1.5 -96 V-10", "#fff6e0", 0.8));
export const gate = () => R(-40, -60, 8, 60, 2, "#fff4e0") + R(32, -60, 8, 60, 2, "#fff4e0") + R(-32, -50, 64, 7, 3, "#fff4e0") + R(-32, -24, 64, 7, 3, "#fff4e0")
  + L("M-32 -50 L32 -17", "#fff4e0", 6) + C(-36, -64, 5, "#fff4e0") + C(36, -64, 5, "#fff4e0");
export const feather = (c = "#ffffff") => G(rot(-25), P("M0 -70 Q18 -50 10 -14 Q6 -4 0 0 Q-6 -4 -10 -14 Q-18 -50 0 -70 Z", c)
  + L("M0 -66 Q2 -30 0 6", "#c3cdd8", 2) + L("M0 -50 l8 -6 M0 -36 l9 -6 M0 -50 l-8 -6 M0 -36 l-9 -6 M0 -22 l8 -5", "#e3e8ee", 1.5));
export const vase = () => P("M-10 -46 Q-18 -30 -14 -10 Q-12 0 0 0 Q12 0 14 -10 Q18 -30 10 -46 Z", "#4db3f2") + R(-11, -50, 22, 6, 3, "#2a8fd4") + L("M-12 -24 H12", "#ffffff", 2.5, { opacity: 0.6 });
export const violet = () => L("M0 0 V-30", "#4caf32", 3) + C(-5, -34, 5, "#9b7fd8") + C(5, -34, 5, "#9b7fd8") + C(0, -40, 5, "#9b7fd8") + C(0, -29, 5, "#9b7fd8") + C(0, -34, 3, "#ffd21c");
export const crate = () => R(-30, -26, 60, 26, 3, "#d9a05a") + L("M-30 -13 H30", "#b07a45", 3)
  + E(-16, -30, 8, 6, "#ff5c5c") + P("M-2 -38 Q2 -26 6 -38 Z", "#ff8a3d") + Et(4, -40, 2.5, 5, 20, "#58cc02") + C(16, -32, 7, "#58cc02") + C(14, -34, 2.5, "#8fd06a");
export const violin = () => G(rot(-35), E(0, -12, 11, 12, "#c97a2a") + E(0, -30, 9, 9, "#c97a2a") + R(-2, -66, 4, 32, 2, "#6b4a2e") + L("M-1 -64 V-4 M1 -64 V-4", "#fff6e0", 0.7))
  + L("M-24 -46 L26 -22", "#b07a45", 2);
export const bucket = () => P("M-16 -26 H16 L12 0 H-12 Z", "#9aa7b8") + R(-18, -29, 36, 5, 2.5, "#b3b9c4") + E(0, -30, 14, 4, "#dff4ff")
  + C(-6, -36, 5, "#ffffff", { opacity: 0.9 }) + C(4, -40, 6, "#ffffff", { opacity: 0.9 }) + C(10, -34, 4, "#ffffff", { opacity: 0.9 });
export const sign = (c = "#4db3f2", icon = "") => R(-3, -60, 6, 60, 2, "#b07a45") + R(-24, -86, 48, 30, 6, c) + icon;
export const pawIcon = () => C(0, -68, 6, "#ffffff") + C(-7, -77, 3, "#ffffff") + C(0, -80, 3, "#ffffff") + C(7, -77, 3, "#ffffff");
export const sandwich = () => P("M-24 0 L0 -26 L24 0 Z", "#f5dca8") + P("M-26 -2 L0 -30 L26 -2 L22 -2 L0 -24 L-22 -2 Z", "#58cc02") + P("M-22 -2 L0 -24 L22 -2 Z", "#ffe9b0") + L("M-18 -8 L18 -8", "#ff8f8f", 3);
export const bench = () => R(-50, -32, 100, 8, 3, "#c98f4f") + R(-50, -52, 100, 8, 3, "#c98f4f") + R(-44, -24, 6, 24, 2, "#8f5f33") + R(38, -24, 6, 24, 2, "#8f5f33");
export const seashell = (c = "#ffb9c8") => P("M-14 0 Q-16 -16 0 -20 Q16 -16 14 0 Z", c) + L("M0 -18 V0 M-7 -15 L-4 0 M7 -15 L4 0", "#e59ab8", 1.5) + E(0, 0, 5, 2.5, "#e59ab8");
export const sandHill = (w = 90) => P(`M${-w / 2} 0 Q${-w / 4} -44 0 -46 Q${w / 4} -44 ${w / 2} 0 Z`, "#f0cf8a") + L(`M${-w / 4} -20 q8 -4 14 0 M4 -32 q6 -3 10 0`, "#e0b86a", 2);
export const zucchini = () => G(rot(-20), E(0, -10, 30, 9, "#4f9a3a") + E(-4, -13, 20, 3, "#7cc95c", { opacity: 0.6 }) + R(28, -13, 7, 6, 2, "#8a6a3a"));
export const zap = (c = "#ffd21c") => P("M0 -40 L-12 -12 H-2 L-8 12 L12 -18 H2 L8 -40 Z", c);
export const zooGate = () => R(-80, -120, 14, 120, 4, "#b07a45") + R(66, -120, 14, 120, 4, "#b07a45")
  + P("M-86 -120 Q0 -170 86 -120 V-104 Q0 -150 -86 -104 Z", "#58cc02") + C(0, -142, 12, "#ffd21c") + C(-40, -130, 7, "#ff8a3d") + C(40, -130, 7, "#4db3f2");
export const bars = (x0, x1, y = 300, h = 90) => { let s = R(x0, y - h, x1 - x0, 8, 3, "#9aa7b8"); for (let x = x0 + 6; x < x1; x += 22) s += R(x, y - h, 6, h, 3, "#b3b9c4"); return s; };
export const ship = () => P("M-90 0 L-70 -40 H80 L96 -12 Q60 6 0 4 Q-60 6 -90 0 Z", "#8a6a4e") + R(-60, -60, 40, 20, 4, "#a5845f") + L("M20 -40 V-120", "#6b5040", 6)
  + P("M22 -116 L64 -80 L22 -70 Z", "#e3e8ee", { opacity: 0.8 }) + C(-40, -24, 7, "#3d5a6b") + C(0, -24, 7, "#3d5a6b") + C(40, -24, 7, "#3d5a6b") + E(0, 4, 100, 8, "#3a86b6", { opacity: 0.4 });
export const stageRock = () => P("M-110 0 Q-100 -40 0 -44 Q100 -40 110 0 Z", "#8a9bb0") + E(0, -40, 90, 8, "#a3b3c6");
export const starfish = (c = "#ffb100") => P("M0 -16 L4 -5 L16 -5 L7 2 L10 14 L0 7 L-10 14 L-7 2 L-16 -5 L-4 -5 Z", c);
export const chestnut = () => P("M-9 0 Q-12 -14 0 -16 Q12 -14 9 0 Q0 4 -9 0 Z", "#8a4a2a") + E(0, -12, 7, 3.5, "#d9a57a") + glint(-3, -8, 1.6);
export const leafFall = (c = "#ff9d3d", a = 0) => G(rot(a), P("M0 -12 Q10 -4 0 12 Q-10 -4 0 -12 Z", c) + L("M0 -10 V10", "#e0892b", 1.2));
export const roof = (y = 280) => P(`M-10 ${y} L120 ${y - 70} H330 L460 ${y} Z`, "#c9403a") + R(-10, y - 4, 460, 10, 5, "#a8342e");
export const chimney = () => R(-26, -90, 52, 90, 4, "#d9745a") + R(-32, -98, 64, 14, 4, "#c26048") + E(0, -98, 20, 5, "#3d2b2b")
  + L("M-26 -60 H26 M-26 -30 H26 M-10 -90 V-60 M8 -60 V-30 M-10 -30 V0", "#c26048", 2);
export const armchair = (c = "#ff8f8f") => R(-44, -60, 88, 50, 14, c) + R(-50, -40, 22, 34, 10, "#f07878") + R(28, -40, 22, 34, 10, "#f07878")
  + R(-30, -30, 60, 16, 8, "#ffb0b0") + R(-44, -10, 8, 10, 2, "#b07a45") + R(36, -10, 8, 10, 2, "#b07a45");
export const jar = (open = false) => (open ? "" : R(-15, -48, 30, 9, 3, "#ff5c5c") + L("M-12 -44 H12", "#ffffff", 1.5))
  + P("M-16 -40 H16 Q18 -20 14 0 H-14 Q-18 -20 -16 -40 Z", "#dff4ff", { opacity: 0.9 }) + P("M-15 -28 H15 Q16 -12 13 0 H-13 Q-16 -12 -15 -28 Z", "#e8394a")
  + R(-9, -26, 18, 10, 2, "#fff6e0") + glint(-9, -36, 2.5);
export const juice = (c = "#ff9d3d") => P("M-10 -30 H10 L8 0 H-8 Z", "#dff4ff", { opacity: 0.9 }) + P("M-9 -22 H9 L8 0 H-8 Z", c) + L("M3 -30 L10 -44", "#ff5c8a", 2.5);
export const vine = (x, y0, y1) => L(`M${x} ${y0} Q${x + 14} ${(y0 + y1) / 2} ${x} ${y1}`, "#3fae14", 4)
  + Et(x + 8, (y0 + y1) / 2 - 20, 9, 5, 30, "#58cc02") + Et(x - 4, (y0 + y1) / 2 + 22, 9, 5, -30, "#58cc02");
export const bigLeaf = (c = "#58cc02") => P("M0 0 Q-34 -30 0 -70 Q34 -30 0 0 Z", c) + L("M0 -4 V-66 M0 -24 l-10 -10 M0 -40 l10 -10 M0 -52 l-8 -8", "#3fae14", 2);
export const leafBoat = () => P("M-50 -14 Q0 10 50 -14 Q30 4 0 4 Q-30 4 -50 -14 Z", "#58cc02") + L("M-40 -10 Q0 6 40 -10", "#3fae14", 2);
export const drink = () => P("M-11 -34 H11 L8 0 H-8 Z", "#dff4ff", { opacity: 0.9 }) + P("M-10 -24 H10 L8 0 H-8 Z", "#8fd4f2") + L("M3 -34 L10 -50", "#ff5c8a", 2.5);
export const stormCloud = (x, y, s = 1) => G(at(x, y, s), E(0, 10, 46, 16, "#7d8aa0") + C(-16, 0, 17, "#7d8aa0") + C(12, -6, 21, "#7d8aa0") + C(32, 6, 13, "#7d8aa0"));
export const bolt = (x, y, s = 1) => G(at(x, y, s), P("M0 0 L-10 22 H0 L-6 44 L14 14 H4 L10 0 Z", "#ffd21c"));
export const quilt = () => P("M-70 0 Q-74 -40 -60 -60 H60 Q74 -40 70 0 Z", "#9b7fd8") + L("M-64 -40 H64 M-66 -20 H66 M-30 -60 L-34 0 M10 -60 L12 0 M44 -60 L50 0", "#b8a0ec", 3);
export const seedBag = () => P("M-12 -30 Q-16 -10 -12 0 H12 Q16 -10 12 -30 Z", "#d9a05a") + L("M-10 -30 Q0 -36 10 -30", "#b07a45", 3)
  + C(-18, -6, 2, "#8a6a3a") + C(-24, -2, 2, "#8a6a3a") + C(18, -4, 2, "#8a6a3a");
export const sunflower = (s = 1) => G(`scale(${s})`, L("M0 0 V-60", "#4caf32", 4) + Et(-8, -30, 9, 4, -30, "#58cc02")
  + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => Et(Math.sin(a * Math.PI / 180) * 12, -70 - Math.cos(a * Math.PI / 180) * 12, 5, 9, a, "#ffd21c")).join("") + C(0, -70, 8, "#8a5a2c"));
