// The fuller books' cast. Each character is drawn with its feet at (0, 0),
// about 125 units tall, facing the reader, and takes
//   { pose, face, look, air, run, flip, ...extras }
// pose: stand | wave | cheer | point | reach | hold | carry | shrug | pull | hug
// face: see kit.face(). `air` drops the ground shadow (jumping, flying).
import { el, C, E, Et, R, P, L, G, at, rot, arms, POSES, upArm, face, shadow, glint, INK } from "./kit.mjs";

// a four-limbed animal standing up, Rory's build: body, belly, two arms, two
// feet, and a head(o) that returns the head drawn at (0, -66)
function biped(o) {
  const pose = o.pose || "stand";
  const [la, ra] = POSES[pose] || POSES.stand;
  const a = arms(pose, o.limb, o.hand, o.armOpts);
  const body = (o.bodyBack || "")
    + (o.feetFn ? o.feetFn(o) : feet(o))
    + E(0, o.bodyCy ?? -26, o.bodyRx ?? 21, o.bodyRy ?? 24, o.body)
    + (o.belly ? E(0, (o.bodyCy ?? -26) + 5, (o.bodyRx ?? 21) * 0.57, (o.bodyRy ?? 24) * 0.6, o.belly) : "")
    + (o.bodyFront || "");
  const inner = (o.tail || "")
    + (upArm(la[0]) ? a.left : "") + (upArm(ra[0]) ? a.right : "")
    + body
    + (upArm(la[0]) ? "" : a.left) + (upArm(ra[0]) ? "" : a.right)
    + o.head(o)
    + (o.front || "");
  return (o.air || o.noShadow ? "" : shadow(o.shadowRx || 28, o.shadowC)) + (o.run ? G(rot(10, 0, -30), inner) : inner);
}
function feet(o) {
  const c = o.foot || o.limb, rx = o.footRx || 11;
  if (o.run) return Et(-20, -9, rx, 5.5, -35, c) + Et(16, -3, rx, 5.5, 10, c);
  if (o.air) return Et(-11, -4, rx, 5.5, 20, c) + Et(11, -4, rx, 5.5, -20, c);
  return E(-11, -4, rx, 5.5, c) + E(11, -4, rx, 5.5, c);
}
const F = (o, d) => face(o.face || "smile", { look: o.look, ...d });

// ── rabbits (Rory's family) ──
export function rabbit(o = {}) {
  const fur = o.fur || "#f7f3ee", inner = o.inner || "#ffb9c8";
  return biped({ body: fur, belly: o.belly || "#fffdf9", limb: o.limb || "#ece4d8", hand: fur, foot: o.foot || "#e9e1d5", ...o,
    head: (q) => Et(-12, -98, 8.5, 25, -12, fur) + Et(12, -98, 8.5, 25, 12, fur)
      + Et(-12, -96, 4, 17, -12, inner) + Et(12, -96, 4, 17, 12, inner)
      + C(0, -66, 25, fur) + (q.scarf ? R(-19, -47, 38, 9, 4.5, "#ff5c5c") + P("M7 -41 L16 -24 L7 -25 L3 -40 Z", "#e84a4a") : "")
      + F(q, { y: -68, my: 11 }) + P("M-3.2 -62 L3.2 -62 L0 -58.5 Z", "#ff8fa3") });
}

// ── bears (Bo; the bear in This Bear, That Bee) ──
export function bear(o = {}) {
  const fur = o.fur || "#b5875a", light = o.light || "#e0b98a";
  return biped({ body: fur, belly: light, limb: o.limb || "#a57a4f", hand: fur, foot: o.foot || "#8f6a42", bodyRx: 24, bodyRy: 26, ...o,
    tail: C(18, -14, 7, fur),
    head: (q) => C(-18, -86, 9, fur) + C(18, -86, 9, fur) + C(-18, -86, 4.5, light) + C(18, -86, 4.5, light)
      + C(0, -66, 26, fur) + E(0, -56, 12, 9, light) + F(q, { y: -71, sp: 9.5, my: 20, cy: 10, cs: 16 })
      + E(0, -61, 4.4, 3.2, INK) + glint(-10, -82, 2.6)
      + (q.hat ? R(-20, -98, 40, 9, 4, "#4db3f2") + R(-13, -110, 26, 14, 6, "#ffffff") + R(-13, -101, 26, 3, 1, "#4db3f2") : "") });
}

// ── pig (Pat) ──
export function pig(o = {}) {
  const fur = o.fur || "#ffb3c1", dark = "#f598ab";
  return biped({ body: fur, belly: "#ffd0da", limb: dark, hand: fur, foot: "#e58aa0", bodyRx: 24, bodyRy: 25, ...o,
    tail: L("M20 -18 q10 -2 9 6 q-2 6 6 4", dark, 3),
    head: (q) => P("M-25 -80 L-12 -95 L-7 -78 Z", dark) + P("M25 -80 L12 -95 L7 -78 Z", dark)
      + C(0, -66, 25, fur) + F(q, { y: -72, sp: 10, my: 22, cy: 12, cs: 17 })
      + E(0, -58, 10.5, 7.5, dark) + C(-3.8, -58, 2, "#c96b82") + C(3.8, -58, 2, "#c96b82") + glint(-10, -82, 2.6) });
}

// ── mouse (Mia) ──
export function mouse(o = {}) {
  const fur = o.fur || "#c9c3cf";
  return biped({ body: fur, belly: "#efeaf2", limb: "#b9b2c0", hand: "#f5c6d0", foot: "#f5c6d0", bodyRx: 19, bodyRy: 22, footRx: 9, ...o,
    tail: L("M16 -12 q24 -4 22 -24 q-2 -10 8 -12", "#f0a6b8", 3),
    bodyFront: o.apron ? P("M-13 -40 H13 V-12 Q0 -6 -13 -12 Z", "#ffffff") + R(-5, -30, 10, 8, 2, "#ff8fb0") + L("M-13 -40 L-8 -48 M13 -40 L8 -48", "#ffffff", 2.5) : "",
    head: (q) => C(-20, -86, 13, fur) + C(20, -86, 13, fur) + C(-20, -86, 8, "#ffb9c8") + C(20, -86, 8, "#ffb9c8")
      + C(0, -64, 23, fur) + F(q, { y: -67, sp: 8.5, my: 12, cy: 9 })
      + C(0, -58.5, 3.4, "#ff8fa3") + L("M-6 -57 H-20 M-6 -54 L-19 -51 M6 -57 H20 M6 -54 L19 -51", "#8a8494", 1.2)
      + (q.chef ? E(0, -88, 18, 6, "#ffffff") + C(-9, -96, 9, "#ffffff") + C(3, -99, 10, "#ffffff") + C(12, -94, 8, "#ffffff") : "") });
}

// ── mole (Max) ──
export function mole(o = {}) {
  const fur = "#6b5a55";
  return biped({ body: fur, belly: "#8a7670", limb: "#5e4e49", hand: "#f5a3b5", foot: "#f5a3b5", hr: 7, ...o,
    armOpts: { hr: 7 },
    head: (q) => C(0, -64, 24, fur) + E(0, -57, 13, 9, "#8a7670")
      + F(q, { y: -69, sp: 9, er: 2.6, my: 17, cs: 16, eye: "#2b2224" })
      + C(-9, -69, 6.5, "#dff4ff", { opacity: 0.55, stroke: "#3d3a4a", "stroke-width": 2 }) + C(9, -69, 6.5, "#dff4ff", { opacity: 0.55, stroke: "#3d3a4a", "stroke-width": 2 })
      + L("M-2.5 -69 H2.5", "#3d3a4a", 2) + E(0, -60, 6, 4.5, "#ff8fa3") });
}

// ── moose (Molly) ──
export function moose(o = {}) {
  const fur = "#a86f45";
  const antler = (s) => G(`scale(${s} 1)`, P("M10 -86 Q18 -104 34 -102 Q30 -96 38 -92 Q30 -88 36 -82 Q24 -84 14 -78 Z", "#e7cfa6"));
  return biped({ body: fur, belly: "#c4916a", limb: "#94603b", hand: "#6b4a2e", foot: "#6b4a2e", bodyRx: 24, bodyRy: 27, ...o,
    head: (q) => antler(1) + antler(-1) + Et(-22, -72, 9, 4.5, -25, fur) + Et(22, -72, 9, 4.5, 25, fur)
      + E(0, -68, 21, 24, fur) + E(0, -52, 14, 11, "#c4916a")
      + F(q, { y: -74, sp: 9, my: 26, cy: 10, cs: 15 })
      + C(-4, -54, 1.8, "#6b4a2e") + C(4, -54, 1.8, "#6b4a2e")
      + (q.flower ? C(30, -98, 4, "#ff8fb0") + C(36, -95, 4, "#ff8fb0") + C(33, -101, 4, "#ff8fb0") + C(33, -98, 2.5, "#ffd21c") : "") });
}

// ── newts (Nora orange, Ned green) ──
export function newt(o = {}) {
  const c = o.color || "#ff9a4d", dark = o.dark || "#e97a2c";
  return biped({ body: c, belly: "#ffd98a", limb: dark, hand: c, foot: dark, bodyRx: 19, bodyRy: 22, footRx: 10, ...o,
    tail: P("M12 -10 Q40 -6 46 -26 Q48 -36 41 -33 Q36 -20 14 -22 Z", c),
    bodyFront: C(-9, -34, 2.6, dark) + C(8, -18, 2.2, dark),
    head: (q) => C(-11, -78, 8, c) + C(11, -78, 8, c) + E(0, -62, 27, 19, c)
      + F(q, { y: -79, sp: 11, er: 4, my: 20, cy: 18, cs: 17 })
      + C(-14, -62, 2.2, dark) + C(15, -66, 1.8, dark)
      + (q.flower ? C(19, -84, 4, "#ff8fb0") + C(25, -81, 4, "#ff8fb0") + C(22, -87, 4, "#ff8fb0") + C(22, -84, 2.5, "#ffffff") : "") });
}

// ── tiger (Toby) ──
export function tiger(o = {}) {
  const fur = "#ff8a3d", st = "#d96a1e";
  return biped({ body: fur, belly: "#fff6ec", limb: "#f57f33", hand: fur, foot: "#f57f33", ...o,
    tail: L("M18 -16 q18 -4 20 -24", fur, 7) + L("M30 -22 l6 -2", st, 3),
    bodyFront: L("M-19 -34 l6 2 M19 -34 l-6 2 M-20 -22 l6 1 M20 -22 l-6 1", st, 3),
    head: (q) => C(-18, -86, 9, fur) + C(18, -86, 9, fur) + C(-18, -86, 4.5, "#fff6ec") + C(18, -86, 4.5, "#fff6ec")
      + C(0, -66, 25, fur) + L("M0 -90 V-82 M-8 -89 l2 6 M8 -89 l-2 6 M-25 -68 h6 M25 -68 h-6 M-24 -60 h6 M24 -60 h-6", st, 3)
      + E(0, -55, 12, 9, "#fff6ec") + F(q, { y: -70, sp: 9, my: 19, cy: 9, cs: 16 })
      + P("M-3.5 -60 H3.5 L0 -56 Z", "#ff5c7a") + glint(-10, -82, 2.6) });
}

// ── dog (Dan) ──
export function dog(o = {}) {
  const fur = "#d9a066", ear = "#a86f45";
  return biped({ body: fur, belly: "#f5e0c4", limb: "#c98f58", hand: fur, foot: "#c98f58", ...o,
    tail: L("M18 -18 q14 -8 12 -24", fur, 7),
    head: (q) => C(0, -66, 25, fur) + Et(-25, -66, 9, 17, 18, ear) + Et(25, -66, 9, 17, -18, ear)
      + E(0, -56, 12, 9, "#f5e0c4") + F(q, { y: -71, sp: 9, my: 19, cy: 10, cs: 16 })
      + E(0, -61, 5, 3.6, INK) + R(-17, -47, 34, 6, 3, "#ff5c5c") + C(0, -40, 3.4, "#ffd21c") + glint(-10, -82, 2.6) });
}

// ── kangaroo (Kip) ──
export function kangaroo(o = {}) {
  const fur = "#e0a368", light = "#f0c896";
  return biped({ body: fur, belly: light, limb: "#d4955a", hand: fur, foot: "#c98652", footRx: 15, bodyRx: 22, bodyRy: 27, bodyCy: -28, ...o,
    tail: P("M-10 -10 Q-44 0 -60 -4 Q-64 -9 -55 -11 Q-36 -12 -14 -24 Z", fur),
    bodyFront: L("M-10 -18 Q0 -10 10 -18", "#c98652", 2.5),
    head: (q) => Et(-11, -97, 6.5, 17, -12, fur) + Et(11, -97, 6.5, 17, 12, fur) + Et(-11, -96, 3, 11, -12, "#ffb9c8") + Et(11, -96, 3, 11, 12, "#ffb9c8")
      + E(0, -68, 22, 24, fur) + E(0, -57, 12, 10, light) + F(q, { y: -73, sp: 8.5, my: 20, cy: 10, cs: 15 })
      + E(0, -62, 4.5, 3.2, INK) + glint(-10, -84, 2.6) });
}

// ── cow (Cody) ──
export function cow(o = {}) {
  const fur = "#f7f3ee", spot = "#3d3a4a";
  return biped({ body: fur, belly: "#ffffff", limb: "#e9e1d5", hand: "#6b5a55", foot: "#6b5a55", bodyRx: 24, bodyRy: 26, ...o,
    tail: L("M20 -18 q12 0 12 -18", "#e9e1d5", 4) + C(32, -38, 4, spot),
    bodyFront: E(-12, -34, 7, 5, spot) + E(13, -18, 6, 4.5, spot),
    head: (q) => P("M-14 -86 Q-22 -96 -16 -102", "none", { stroke: "#f0e0c0", "stroke-width": 5, "stroke-linecap": "round" })
      + P("M14 -86 Q22 -96 16 -102", "none", { stroke: "#f0e0c0", "stroke-width": 5, "stroke-linecap": "round" })
      + Et(-26, -72, 10, 5.5, -20, fur) + Et(26, -72, 10, 5.5, 20, fur)
      + E(0, -68, 23, 23, fur) + E(-10, -80, 7, 5, spot) + E(0, -53, 15, 10, "#ffb9c8")
      + C(-5, -53, 2.2, "#e58aa0") + C(5, -53, 2.2, "#e58aa0") + F(q, { y: -71, sp: 9.5, my: 26, cy: 7, cs: 17 }) });
}

// ── goat (Gus) ──
export function goat(o = {}) {
  const fur = "#ece7de";
  return biped({ body: fur, belly: "#fbf7f0", limb: "#ddd6ca", hand: "#8a7a6a", foot: "#8a7a6a", ...o,
    head: (q) => P("M-12 -86 Q-26 -96 -26 -110 Q-18 -100 -6 -92 Z", "#d9b78f") + P("M12 -86 Q26 -96 26 -110 Q18 -100 6 -92 Z", "#d9b78f")
      + Et(-27, -68, 11, 5, -12, fur) + Et(27, -68, 11, 5, 12, fur)
      + E(0, -67, 21, 24, fur) + E(0, -54, 11, 8.5, "#fbf7f0") + P("M-5 -46 Q0 -32 5 -46 Z", "#d9cfbf")
      + F(q, { y: -72, sp: 8.5, my: 22, cy: 9, cs: 14 }) + E(-3, -56, 1.3, 2, INK) + E(3, -56, 1.3, 2, INK) });
}

// ── fox (Fay) ──
export function fox(o = {}) {
  const fur = "#ff8a3d";
  return biped({ body: fur, belly: "#ffffff", limb: "#f07a2e", hand: "#5b4a44", foot: "#5b4a44", ...o,
    tail: P("M16 -14 Q44 -8 46 -34 Q44 -46 36 -40 Q34 -22 18 -26 Z", fur) + P("M44 -32 Q44 -46 36 -40 Q38 -34 44 -32 Z", "#ffffff"),
    head: (q) => P("M-24 -76 L-19 -100 L-5 -86 Z", fur) + P("M24 -76 L19 -100 L5 -86 Z", fur)
      + P("M-19 -80 L-17 -93 L-10 -86 Z", "#5b4a44") + P("M19 -80 L17 -93 L10 -86 Z", "#5b4a44")
      + C(0, -66, 24, fur) + P("M-24 -64 Q-14 -44 0 -50 Q14 -44 24 -64 Q12 -56 0 -60 Q-12 -56 -24 -64 Z", "#ffffff")
      + F(q, { y: -70, sp: 9, my: 16, cy: 11, cs: 15 }) + E(0, -57, 3.6, 2.8, INK) + glint(-10, -82, 2.6) });
}

// ── zebra (Zoe). coat: "none" | "open" | "stuck" | "closed" ──
export function zebra(o = {}) {
  const fur = "#f7f3ee", st = "#2d2d3a";
  const coat = o.coat || "none";
  const coatFront = coat === "none" ? "" :
    P("M-22 -46 Q-26 -20 -20 -4 H20 Q26 -20 22 -46 Q0 -52 -22 -46 Z", "#9b7fd8")
    + (coat === "open" ? P("M-5 -48 L-2 -4 H2 L5 -48 Z", fur) + L("M-3 -46 V-6", "#e3dcf5", 1.5)
      : coat === "stuck" ? P("M-4 -48 L-1 -26 H1 L4 -48 Z", fur) + L("M0 -26 V-6", "#7d63b5", 2) + R(-3, -29, 6, 7, 2, "#ffd21c")
      : L("M0 -48 V-6", "#7d63b5", 2) + R(-3, -50, 6, 7, 2, "#ffd21c"))
    + C(-12, -30, 2, "#ffd21c") + C(12, -30, 2, "#ffd21c");
  return biped({ body: fur, belly: coat === "none" ? "#ffffff" : null, limb: "#e9e1d5", hand: "#3d3a4a", foot: "#3d3a4a", ...o,
    tail: L("M18 -16 q10 -4 10 -18", fur, 4) + E(28, -36, 3.5, 6, st),
    bodyFront: (coat === "none" ? L("M-20 -34 q6 4 10 0 M20 -34 q-6 4 -10 0 M-21 -22 q6 3 9 0 M21 -22 q-6 3 -9 0", st, 3.4) : "") + coatFront,
    head: (q) => P("M-10 -90 L-6 -100 L-2 -90 L2 -101 L6 -90 L10 -99 L12 -88 Z", st)
      + P("M-20 -80 L-18 -98 L-8 -86 Z", fur) + P("M20 -80 L18 -98 L8 -86 Z", fur)
      + E(0, -67, 21, 24, fur) + L("M-20 -72 q5 3 9 0 M20 -72 q-5 3 -9 0 M-6 -88 q6 4 12 0", st, 3)
      + E(0, -52, 14, 11, "#6b6b7a") + C(-5, -52, 2, "#3d3a4a") + C(5, -52, 2, "#3d3a4a")
      + F(q, { y: -72, sp: 9, my: 26, cy: 8, cs: 16, mouthInk: "#ffffff" })
      + (q.bow ? P("M6 -92 l-12 -6 v12 Z", "#ff5c8a") + P("M6 -92 l12 -6 v12 Z", "#ff5c8a") + C(6, -92, 3, "#e84a78") : "") });
}

// ── chipmunk (Chip) ──
export function chipmunk(o = {}) {
  const fur = "#c98b5e", light = "#f5dcb8", st = "#6b4a2e";
  return biped({ body: fur, belly: light, limb: "#b97d52", hand: fur, foot: "#b97d52", bodyRx: 20, bodyRy: 23, ...o,
    tail: P("M14 -10 Q46 -10 44 -44 Q42 -64 26 -58 Q36 -40 16 -26 Z", "#b0764a") + P("M20 -18 Q38 -20 36 -44 Q34 -54 28 -52 Q34 -36 20 -26 Z", "#d9a57a"),
    head: (q) => C(-16, -86, 7, fur) + C(16, -86, 7, fur) + C(-16, -86, 3.5, light) + C(16, -86, 3.5, light)
      + C(0, -66, 24, fur) + L("M0 -90 V-76", st, 4) + L("M-6 -88 V-78 M6 -88 V-78", light, 2.5)
      + C(-15, -56, 11, light) + C(15, -56, 11, light)
      + F(q, { y: -70, sp: 9, my: 15, cy: 12, cs: 15 }) + E(0, -59, 3.4, 2.6, INK) });
}

// ── jaguar (Jax) ──
export function jaguar(o = {}) {
  const fur = "#ffc04d", sp = "#8a5a2e";
  const spot = (x, y, r = 3.4) => C(x, y, r, "none", { stroke: sp, "stroke-width": 2.2 });
  return biped({ body: fur, belly: "#fff3d6", limb: "#f5b23f", hand: fur, foot: "#f5b23f", ...o,
    tail: L("M18 -14 q22 -2 22 -28 q0 -8 6 -8", fur, 7) + C(38, -30, 2, sp) + C(40, -40, 2, sp),
    bodyFront: spot(-14, -36) + spot(14, -20) + spot(-15, -16, 2.6),
    head: (q) => C(-18, -86, 9, fur) + C(18, -86, 9, fur) + C(-18, -86, 4.5, sp) + C(18, -86, 4.5, sp)
      + C(0, -66, 25, fur) + spot(-13, -82, 2.8) + spot(12, -84, 2.8) + spot(-20, -66, 2.4) + spot(20, -64, 2.4)
      + E(0, -55, 12, 9, "#fff3d6") + F(q, { y: -70, sp: 9, my: 19, cy: 9, cs: 16 })
      + P("M-3.5 -60 H3.5 L0 -56 Z", "#8a5a2e") + glint(-10, -82, 2.6) });
}

// ── giraffe (Jill): the neck lifts her head to -118 ──
export function giraffe(o = {}) {
  const fur = "#ffd98a", pt = "#d99a4e";
  return biped({ body: fur, belly: "#fff0c8", limb: "#f5cc78", hand: "#8a5a2e", foot: "#8a5a2e", ...o,
    armOpts: { sy: -38 },
    bodyFront: E(-12, -34, 6, 5, pt) + E(12, -22, 5, 4, pt),
    head: (q) => R(-9, -110, 18, 70, 8, fur) + E(-2, -90, 4.5, 4, pt) + E(3, -70, 4, 3.5, pt) + E(-3, -54, 3.5, 3, pt)
      + L("M-7 -128 V-142 M7 -128 V-142", "#c98b5e", 4) + C(-7, -144, 4, "#8a5a2e") + C(7, -144, 4, "#8a5a2e")
      + Et(-22, -124, 9, 4.5, -20, fur) + Et(22, -124, 9, 4.5, 20, fur)
      + E(0, -120, 20, 18, fur) + E(0, -108, 13, 9, "#ffe8b8")
      + F(q, { y: -124, sp: 8, my: 21, cy: 9, cs: 14 }) + C(-4, -108, 1.6, "#8a5a2e") + C(4, -108, 1.6, "#8a5a2e") });
}

// ── lamb (Leo) ──
export function lamb(o = {}) {
  const wool = "#fdfaf3", faceC = "#f6e7d8", dark = "#6b5a55";
  const puff = (list) => list.map(([x, y, r]) => C(x, y, r, wool)).join("");
  return biped({ body: wool, limb: "#f1ebdf", hand: dark, foot: dark, bodyRx: 23, bodyRy: 25, ...o,
    bodyBack: puff([[-18, -40, 10], [18, -40, 10], [-22, -24, 10], [22, -24, 10], [-14, -10, 10], [14, -10, 10], [0, -48, 10]]),
    head: (q) => Et(-24, -68, 10, 5, -20, "#f6d0d8") + Et(24, -68, 10, 5, 20, "#f6d0d8")
      + E(0, -63, 18, 20, faceC) + puff([[-12, -84, 9], [0, -88, 10], [12, -84, 9], [-6, -80, 7], [6, -80, 7]])
      + F(q, { y: -66, sp: 7.5, my: 12, cy: 9, cs: 12 }) + E(0, -58.5, 3, 2.2, "#c98b8b") });
}

// ── sloths (Theo; Thea wears a flower) ──
export function sloth(o = {}) {
  const fur = o.fur || "#c9a878", mask = "#f0dcc0", patch = "#8a6844";
  return biped({ body: fur, belly: "#d9bf98", limb: "#b8966a", hand: "#8a6844", foot: "#8a6844", bodyRx: 22, bodyRy: 25, ...o,
    head: (q) => C(0, -66, 25, fur) + E(0, -64, 20, 17, mask)
      + Et(-9, -67, 7, 4.5, -20, patch) + Et(9, -67, 7, 4.5, 20, patch)
      + F(q, { y: -67, sp: 9, er: 2.6, my: 12, cy: 8, cs: 14, eye: "#2b2a4a" }) + E(0, -60, 3.2, 2.4, INK)
      + (q.flower ? C(15, -88, 4.5, "#ff8fb0") + C(22, -85, 4.5, "#ff8fb0") + C(18, -92, 4.5, "#ff8fb0") + C(18, -88, 2.8, "#ffd21c") : "") });
}

// ── gopher: pops out of a hole; `hole` draws the hole in front ──
export function gopher(o = {}) {
  const fur = "#b98a5a";
  return (o.noHole ? "" : E(0, 0, 26, 8, "#6b4a2e"))
    + G("", E(0, -18, 17, 20, fur) + C(-11, -44, 5, fur) + C(11, -44, 5, fur) + C(0, -34, 16, fur)
      + E(0, -28, 9, 6.5, "#f0d6b0") + R(-3, -24, 6, 5, 1.5, "#ffffff")
      + face(o.face || "smile", { y: -37, sp: 6.5, er: 2.6, my: 7, cs: 10, cr: 3 }) + E(0, -30, 2.6, 2, INK))
    + (o.noHole ? "" : P("M-26 0 Q0 12 26 0 Q0 6 -26 0 Z", "#8a6a3a"));
}

// ── lizard (Lucy), side view, lying along a log ──
export function lizard(o = {}) {
  const c = "#3fb3a3", light = "#bfeee6";
  return (o.noShadow ? "" : E(0, 0, 40, 5, "#2f6b1a", { opacity: 0.14 }))
    + P("M-26 -12 Q-54 -12 -62 -2 Q-66 4 -58 2 Q-46 -4 -24 -4 Z", c)
    + E(-14, -2, 5, 4, "#2f9a8b") + E(12, -2, 5, 4, "#2f9a8b")
    + E(0, -12, 28, 11, c) + E(0, -8, 20, 5, light)
    + E(30, -18, 16, 12, c) + C(34, -26, 5.5, c)
    + (o.face === "sleep" || !o.face ? L("M31 -27 Q34 -24 37 -27", INK, 2) : C(34, -27, 3.2, INK) + C(35, -28.3, 1.1, "#ffffff"))
    + C(40, -18, 3.2, "#ffb9c8", { opacity: 0.8 }) + (o.face === "o" ? E(43, -13, 2, 2.6, "#c0475a") : L("M36 -12 Q42 -10 46 -14", INK, 1.6));
}

// ── birds, standing: penguin, duck, goose, gull, parrot, toucan, chick ──
function bird(o) {
  const pose = o.pose || "stand";
  const lUp = pose === "cheer" || pose === "carry";
  const rUp = lUp || pose === "wave" || pose === "point";
  const wing = (side, up) => up ? Et(side * (o.rx + 2), o.cy - 16, 7, o.wing, side * -140, o.wingC) : Et(side * (o.rx - 2), o.cy, 7, o.wing, side * -18, o.wingC);
  return (o.air ? "" : shadow(o.shadowRx || 24, o.shadowC))
    + (o.back || "")
    + (o.air ? "" : E(-9, -3, 8, 4, o.feet) + E(9, -3, 8, 4, o.feet))
    + (lUp ? wing(-1, true) : "") + (rUp ? wing(1, true) : "")
    + E(0, o.cy, o.rx, o.ry, o.body) + (o.belly ? E(0, o.cy + 6, o.rx * 0.62, o.ry * 0.7, o.belly) : "")
    + (lUp ? "" : wing(-1, false)) + (rUp ? "" : wing(1, false))
    + o.head(o);
}
// a bird's eyes and cheeks; the beak is its mouth
const BF = (q, d) => face(q.face || "smile", { look: q.look, noMouth: true, ...d });
export function penguin(o = {}) {
  return bird({ body: "#3d4a5c", belly: "#fffdf7", wingC: "#34404f", feet: "#ffb100", rx: 24, ry: 33, cy: -38, wing: 17, ...o,
    head: (q) => E(0, -64, 21, 19, "#3d4a5c") + E(0, -60, 15, 12, "#fffdf7")
      + BF(q, { y: -64, sp: 7, er: 3.2, cy: 7, cs: 11 })
      + P("M-5 -57 L5 -57 L0 -51 Z", "#ffb100")
      + (q.bow ? P("M10 -80 l-10 -6 v12 Z", "#ff5c8a") + P("M10 -80 l10 -6 v12 Z", "#ff5c8a") + C(10, -80, 3, "#e84a78") : "") });
}
export function duck(o = {}) {
  const c = o.color || "#ffd94d";
  return bird({ body: c, belly: null, wingC: o.wingC || "#f5c63a", feet: "#ff9d3d", rx: 22, ry: 20, cy: -24, wing: 12, shadowRx: 22, ...o,
    head: (q) => C(0, -54, 17, c) + BF(q, { y: -58, sp: 6.5, er: 3, cy: 8, cs: 10 })
      + E(0, -49, 9, 4.5, "#ff9d3d") + L("M-6 -49 H6", "#e8832a", 1.4)
      + (q.tuft ? L("M0 -70 q-4 -8 2 -10 M2 -70 q4 -8 8 -6", c, 3) : "")
      + (q.bow ? P("M10 -68 l-9 -5 v10 Z", "#ff5c8a") + P("M10 -68 l9 -5 v10 Z", "#ff5c8a") + C(10, -68, 2.6, "#e84a78") : "") });
}
export function goose(o = {}) {
  const c = o.color || "#ffe39a";
  return bird({ body: c, belly: null, wingC: "#f5d27a", feet: "#ff9d3d", rx: 24, ry: 21, cy: -24, wing: 13, ...o,
    head: (q) => R(-7, -80, 14, 42, 7, c) + C(0, -82, 15, c)
      + BF(q, { y: -85, sp: 6, er: 2.9, cy: 7, cs: 9 })
      + E(0, -76, 8, 4.5, "#ff9d3d") + L("M-5 -76 H5", "#e8832a", 1.2)
      + (q.bow ? P("M0 -44 l-11 -6 v12 Z", "#ff5c5c") + P("M0 -44 l11 -6 v12 Z", "#ff5c5c") + C(0, -44, 3, "#e84a4a") : "") });
}
export function gull(o = {}) {
  return bird({ body: "#f7f3ee", belly: "#ffffff", wingC: "#b8c4d4", feet: "#ffb100", rx: 20, ry: 22, cy: -26, wing: 14, ...o,
    back: o.gap ? "" : P("M-12 -10 L-26 -2 L-10 -4 Z", "#b8c4d4"),
    head: (q) => C(0, -56, 16, "#f7f3ee") + BF(q, { y: -59, sp: 6.5, er: 3, cy: 8, cs: 10 })
      + P("M-3 -52 L12 -50 L-3 -46 Z", "#ffcf3d") + C(8, -49.5, 1.4, "#ff5c5c")
      + (q.hat ? R(-15, -73, 30, 7, 3.5, "#4db3f2") + P("M-11 -73 Q0 -86 11 -73 Z", "#ffffff") + R(-11, -75, 22, 2.5, 1, "#4db3f2") : "") });
}
export function parrot(o = {}) {
  return bird({ body: "#58cc02", belly: null, wingC: "#3fae14", feet: "#8a8a8a", rx: 18, ry: 22, cy: -28, wing: 14, ...o,
    back: P("M-4 -10 L-10 18 L-2 10 L2 18 L6 -8 Z", "#4db3f2") + P("M2 -8 L6 16 L10 -6 Z", "#ffd21c"),
    head: (q) => C(0, -56, 16, "#58cc02") + E(0, -59, 11, 8, "#f7f3ee")
      + BF(q, { y: -60, sp: 5.5, er: 2.8, cy: 8, cs: 9 })
      + P("M-4 -54 Q6 -56 5 -46 Q2 -50 -4 -50 Z", "#ff8a3d") + P("M-6 -72 q2 -8 8 -8 q-2 4 0 6 Z", "#ff5c5c") });
}
export function toucan(o = {}) {
  return bird({ body: "#2d2d3a", belly: null, wingC: "#1f1f2a", feet: "#4db3f2", rx: 17, ry: 23, cy: -28, wing: 14, ...o,
    back: P("M-6 -8 L-2 14 L4 -6 Z", "#1f1f2a"),
    head: (q) => E(0, -32, 11, 13, "#ffe08a") + C(0, -56, 16, "#2d2d3a") + E(0, -48, 12, 8, "#ffe08a")
      + C(-5, -60, 6, "#4db3f2") + C(5, -60, 6, "#4db3f2") + BF(q, { y: -60, sp: 5, er: 2.7, cheeks: false })
      + P("M-4 -55 Q28 -66 40 -48 Q24 -38 -4 -46 Z", "#ff9d3d") + P("M30 -58 Q40 -54 40 -48 Q32 -44 26 -45 Z", "#ff5c5c") + P("M-4 -55 L8 -57 L8 -45 L-4 -46 Z", "#ffd21c") });
}
export function chick(o = {}) {
  const c = "#ffd94d";
  return (o.air ? "" : shadow(16, o.shadowC))
    + (o.air ? "" : L("M-5 0 v-6 M5 0 v-6", "#ff8a3d", 2.4))
    + E(0, -20, 17, 17, c) + Et(-16, -20, 5, 8, o.pose === "cheer" ? 140 : 20, "#f5c63a") + Et(16, -20, 5, 8, o.pose === "cheer" ? -140 : -20, "#f5c63a")
    + L("M-1 -37 q-3 -6 2 -8 M1 -37 q3 -7 7 -5", c, 2.5)
    + BF(o, { y: -24, sp: 6, er: 2.7, cy: 7, cs: 9 })
    + P("M-4 -19 H4 L0 -14 Z", "#ff8a3d");
}
export function turkey(o = {}) {
  const fan = ["#e0892b", "#ff5c5c", "#ffd21c", "#a86f45", "#e0892b", "#ff5c5c", "#ffd21c"];
  let back = "";
  fan.forEach((c, i) => { const a = -75 + i * 25; back += Et(Math.sin(a * Math.PI / 180) * 24, -30 - Math.cos(a * Math.PI / 180) * 24, 7, 16, a, c); });
  return shadow(22, o.shadowC) + back + L("M-5 0 v-8 M5 0 v-8", "#ff9d3d", 2.4)
    + E(0, -24, 18, 18, "#a86f45") + E(0, -20, 10, 11, "#c4916a")
    + C(0, -46, 10, "#d9a684") + BF(o, { y: -48, sp: 4.5, er: 2.3, cheeks: false })
    + P("M-3 -44 L3 -44 L0 -40 Z", "#ffcf3d") + E(3, -38, 2.4, 4.5, "#ff5c5c");
}

// ── flyers and swimmers ──
export function bee(o = {}) {
  const b = "#ffd21c", k = "#3d3a4a";
  return Et(-4, -14, 8, 12, -25, "#e8f6ff", { opacity: 0.95 }) + Et(8, -14, 8, 12, 25, "#e8f6ff", { opacity: 0.95 })
    + E(4, 2, 16, 12, b) + E(1, 2, 3.2, 11.5, k) + E(10, 2, 3, 10, k) + P("M19 2 L25 4 L19 6 Z", k)
    + C(-12, -2, 11, b) + L("M-16 -12 q-4 -8 -8 -8 M-10 -12 q0 -8 4 -10", k, 1.6) + C(-24, -20, 2, k) + C(-6, -22, 2, k)
    + face(o.face || "smile", { x: -12, y: -4, sp: 4, er: 2.3, my: 7, cy: 5, cs: 7, cr: 2.8, look: o.look })
    + (o.bow ? P("M-12 -14 l-7 -4 v8 Z", "#ff5c8a") + P("M-12 -14 l7 -4 v8 Z", "#ff5c8a") + C(-12, -14, 2, "#e84a78") : "");
}
export function ladybug(o = {}) {
  return E(0, 2, 16, 4, "#2f6b1a", { opacity: 0.14 }) + L("M-10 -2 l-5 4 M0 -2 v5 M10 -2 l5 4", "#3d3a4a", 2)
    + P("M-16 -4 A16 16 0 0 1 16 -4 Z", "#ff4d4d") + L("M0 -20 V-4", "#3d3a4a", 1.6)
    + C(-7, -11, 2.8, "#3d3a4a") + C(7, -11, 2.8, "#3d3a4a") + C(-9, -5, 2, "#3d3a4a") + C(9, -5, 2, "#3d3a4a")
    + C(-18, -8, 7, "#3d3a4a") + C(-20, -10, 1.8, "#ffffff") + C(-16, -10, 1.8, "#ffffff");
}
// fish swim to the right; flip them to face left
export function fish(o = {}) {
  const c = o.color || "#ff8a3d", fin = o.fin || "#ffb100";
  return P("M-26 0 L-44 -16 L-40 0 L-44 16 Z", fin) + P("M-6 -16 Q4 -30 14 -16 Z", fin) + P("M-4 16 Q4 26 10 16 Z", fin)
    + E(0, 0, 30, 19, c) + P("M-10 -18 Q-2 0 -10 18 Q-16 0 -10 -18 Z", "#ffffff") + P("M8 -18 Q14 0 8 18 Q4 0 8 -18 Z", "#ffffff", { opacity: 0.85 })
    + C(16, -5, 6.5, "#ffffff") + C(17 + (o.look ? o.look[0] : 0), -5, 3.2, INK) + C(18, -6.5, 1.1, "#ffffff")
    + C(20, 5, 3.5, "#ffb9c8", { opacity: 0.8 })
    + (o.face === "o" ? E(27, 4, 2.2, 2.8, MOUTH_()) : o.face === "grin" || o.face === "happy" ? P("M22 4 Q27 11 30 3 Z", MOUTH_()) : L("M23 5 Q27 9 30 4", INK, 1.6));
}
function MOUTH_() { return "#c0475a"; }
export function shark(o = {}) {
  const c = "#8fa8bd", belly = "#e8eff5";
  return P("M-58 -2 L-80 -24 L-74 -2 L-80 20 Z", c) + P("M-4 -26 Q6 -54 20 -26 Z", c)
    + P("M-62 0 Q-40 -30 10 -30 Q50 -28 64 0 Q50 26 10 28 Q-40 28 -62 0 Z", c)
    + P("M-40 8 Q0 26 56 6 Q40 22 8 24 Q-24 22 -40 8 Z", belly) + P("M4 12 Q16 30 26 18 Z", "#7d96ab")
    + C(34, -8, 6.5, "#ffffff") + C(35 + (o.look ? o.look[0] : 0), -8, 3.3, INK) + C(36, -9.5, 1.1, "#ffffff")
    + C(44, 4, 4.5, "#ffb9c8", { opacity: o.face === "shy" ? 1 : 0.8 })
    + (o.face === "shy" ? L("M42 12 Q50 16 56 10", INK, 1.7) + L("M29 -18 l6 -3", INK, 1.5)
      : o.face === "happy" || o.face === "grin" ? P("M40 10 Q50 20 58 8 Z", "#c0475a") + P("M44 11 L46 14 L48 11 M50 11 L52 14 L54 10", "#ffffff")
      : L("M42 12 Q50 17 57 9", INK, 1.7));
}
export function seahorse(o = {}) {
  const c = "#c49cff", light = "#e5d4ff";
  return P("M0 -70 Q16 -70 18 -54 Q20 -40 8 -30 Q18 -18 12 -4 Q6 8 -4 6 Q-12 4 -10 -4 Q-8 -10 -2 -8 Q4 -8 2 -2 Q8 -14 -4 -24 Q-14 -34 -10 -52 Q-8 -68 0 -70 Z", c)
    + P("M2 -40 Q10 -36 6 -26", "none", { stroke: light, "stroke-width": 5, "stroke-linecap": "round" })
    + P("M-10 -50 L-18 -46 L-10 -42 L-18 -38 L-10 -34 Z", "#ff8fb0")
    + P("M-6 -70 L-4 -80 L0 -71 L4 -80 L6 -69 Z", "#ff8fb0")
    + P("M12 -62 Q30 -62 32 -56 Q28 -52 14 -54 Z", c)
    + C(4, -60, 5.5, "#ffffff") + C(5, -60, 2.8, INK) + C(6, -61.3, 1, "#ffffff") + C(12, -54, 3.2, "#ffb9c8", { opacity: 0.8 })
    + L("M20 -54 Q24 -52 28 -54", INK, 1.4);
}
export function crab(o = {}) {
  const c = "#ff6b5c";
  const claw = (x, s) => G(`translate(${x} -30) scale(${s} 1)`, C(0, 0, 9, c) + P("M-2 -2 L8 -10 L6 2 Z", "#e8574a") + L("M0 8 L-8 20", c, 5));
  return shadow(22, o.shadowC) + L("M-18 -6 l-10 6 M-16 -2 l-8 8 M18 -6 l10 6 M16 -2 l8 8", c, 3.5)
    + (o.pose === "cheer" ? claw(-26, 1) + claw(26, -1) : G("translate(0 14)", claw(-26, 1) + claw(26, -1)))
    + E(0, -12, 22, 14, c) + L("M-7 -24 V-34 M7 -24 V-34", c, 3) + C(-7, -36, 5, "#ffffff") + C(7, -36, 5, "#ffffff")
    + C(-7, -36, 2.5, INK) + C(7, -36, 2.5, INK) + P("M-6 -8 Q0 -2 6 -8 Z", "#c0475a") + C(-12, -12, 3, "#ffb9c8", { opacity: 0.8 }) + C(12, -12, 3, "#ffb9c8", { opacity: 0.8 });
}
export function toad(o = {}) {
  const c = "#9bbf5a", belly = "#d6e8a6";
  return shadow(30, o.shadowC) + E(-22, -6, 12, 7, "#86ab48") + E(22, -6, 12, 7, "#86ab48")
    + E(0, -18, 30, 20, c) + E(0, -12, 18, 11, belly) + C(-12, -36, 9, c) + C(12, -36, 9, c)
    + C(-12, -37, 5, "#ffffff") + C(12, -37, 5, "#ffffff") + C(-12, -37, 2.8, INK) + C(12, -37, 2.8, INK)
    + C(-18, -24, 2, "#86ab48") + C(20, -22, 2.4, "#86ab48") + C(-6, -30, 1.8, "#86ab48")
    + (o.face === "sing" ? E(0, -20, 5, 5.5, "#c0475a") : L("M-12 -22 Q0 -14 12 -22", INK, 1.8))
    + C(-18, -18, 3.5, "#ffb9c8", { opacity: 0.7 }) + C(18, -18, 3.5, "#ffb9c8", { opacity: 0.7 });
}

// ── Val the van, three-quarter front ──
export function van(o = {}) {
  const c = o.color || "#ff8fb0", d = "#e0648a";
  return E(0, 0, 70, 7, "#2f6b1a", { opacity: 0.16 })
    + R(-64, -86, 128, 72, 20, c) + R(-64, -40, 128, 26, 8, d) + R(-58, -46, 116, 5, 2.5, "#ffffff", { opacity: 0.7 })
    + R(-48, -80, 96, 32, 12, "#dff4ff") + E(-18, -64, 9, 10, "#ffffff") + E(18, -64, 9, 10, "#ffffff")
    + C(-17 + (o.look ? o.look[0] : 0), -63, 4.5, INK) + C(19 + (o.look ? o.look[0] : 0), -63, 4.5, INK)
    + C(-15, -65, 1.5, "#ffffff") + C(21, -65, 1.5, "#ffffff")
    + C(-50, -30, 7, "#fff6c8") + C(50, -30, 7, "#fff6c8")
    + (o.face === "grin" || o.face === "happy" ? P("M-16 -30 Q0 -14 16 -30 Z", "#c0475a") : L("M-14 -28 Q0 -18 14 -28", "#ffffff", 3))
    + C(-42, -12, 13, "#3d3a4a") + C(42, -12, 13, "#3d3a4a") + C(-42, -12, 5, "#b3b9c4") + C(42, -12, 5, "#b3b9c4");
}

// ── people ──
const SKIN = { a: "#ffd9b8", b: "#e8b48a", c: "#c98b5e", d: "#8d5a3b" };
export function kid(o = {}) {
  const skin = SKIN[o.skin || "a"], hair = o.hair || "#6b4a2e", top = o.top || "#9b7fd8", bottom = o.bottom || "#4f8fe0";
  const pose = o.pose || "stand";
  const [la, ra] = POSES[pose] || POSES.stand;
  const a = arms(pose, top, skin, { sy: -44, hr: 5 });
  const hairBack = o.style === "pigtails" ? C(-24, -76, 9, hair) + C(24, -76, 9, hair) + C(-24, -76, 3, o.band || "#ff5c8a") + C(24, -76, 3, o.band || "#ff5c8a")
    : o.style === "long" ? P("M-22 -80 Q-26 -50 -18 -46 H18 Q26 -50 22 -80 Z", hair) : "";
  const hairTop = o.style === "curly" ? C(-12, -92, 9, hair) + C(0, -96, 10, hair) + C(12, -92, 9, hair) + C(-19, -84, 7, hair) + C(19, -84, 7, hair)
    : P("M-21 -80 Q-20 -100 0 -100 Q20 -100 21 -80 Q12 -90 0 -88 Q-10 -90 -21 -80 Z", hair);
  const dress = o.dress
    ? P("M-14 -50 H14 L24 -14 H-24 Z", top) + R(-10, -14, 6, 10, 3, skin) + R(4, -14, 6, 10, 3, skin)
    : R(-15, -50, 30, 26, 8, top) + R(-15, -28, 30, 14, 5, bottom) + R(-12, -16, 9, 12, 3, bottom) + R(3, -16, 9, 12, 3, bottom);
  return (o.air ? "" : shadow(24, o.shadowC))
    + (upArm(la[0]) ? a.left : "") + (upArm(ra[0]) ? a.right : "")
    + E(-8, -3, 8, 4, o.shoes || "#ff5c5c") + E(8, -3, 8, 4, o.shoes || "#ff5c5c")
    + dress + (upArm(la[0]) ? "" : a.left) + (upArm(ra[0]) ? "" : a.right)
    + hairBack + R(-4, -56, 8, 8, 3, skin) + C(0, -76, 21, skin) + hairTop
    + face(o.face || "smile", { y: -76, sp: 7.5, er: 2.9, my: 10, cy: 8, cs: 12, look: o.look })
    + (o.hat === "sun" ? E(0, -96, 30, 7, "#ffd98a") + P("M-16 -96 Q-14 -114 0 -114 Q14 -114 16 -96 Z", "#ffd98a") + R(-16, -100, 32, 4, 2, "#ff8fb0") : "");
}
export function grownup(o = {}) {
  const skin = SKIN[o.skin || "b"], hair = o.hair || "#3d2b1f", top = o.top || "#ffffff", bottom = o.bottom || "#4f6b8a";
  const pose = o.pose || "stand";
  const [la, ra] = POSES[pose] || POSES.stand;
  const a = arms(pose, top, skin, { sy: -64, hr: 5.5 });
  return shadow(28, o.shadowC)
    + (upArm(la[0]) ? a.left : "") + (upArm(ra[0]) ? a.right : "")
    + E(-9, -3, 9, 4.5, "#5b4a44") + E(9, -3, 9, 4.5, "#5b4a44")
    + R(-15, -34, 13, 32, 5, bottom) + R(2, -34, 13, 32, 5, bottom)
    + R(-18, -72, 36, 42, 10, top)
    + (o.coat ? R(-18, -72, 36, 50, 10, "#ffffff") + L("M0 -70 V-24", "#e3e8ee", 2) + L("M-8 -66 Q-10 -46 0 -44 Q10 -46 8 -66", "#4f8fe0", 2) + C(0, -44, 3, "#b3b9c4") : "")
    + (o.pocket ? R(4, -64, 10, 9, 2, o.pocket) : "")
    + (upArm(la[0]) ? "" : a.left) + (upArm(ra[0]) ? "" : a.right)
    + R(-4, -80, 8, 9, 3, skin) + C(0, -96, 20, skin)
    + (o.bun ? C(0, -118, 8, hair) : "")
    + P("M-20 -98 Q-18 -118 0 -118 Q18 -118 20 -98 Q10 -108 0 -106 Q-10 -108 -20 -98 Z", hair)
    + face(o.face || "smile", { y: -96, sp: 7.5, er: 2.9, my: 10, cy: 8, cs: 12, look: o.look })
    + (o.cap ? P("M-20 -104 Q-18 -122 0 -122 Q18 -122 20 -104 Z", o.cap) + R(0, -108, 28, 5, 2.5, o.cap) : "");
}
