// Page layouts for the fuller books, part two: V S Z SH CH J L TH THV.
import * as K from "./kit.mjs";
import * as A from "./cast.mjs";
import * as O from "./props.mjs";
import * as S from "./scene.mjs";

const { G, C, E, R, P, L, at, rot } = K;
const { put, place } = S;
const C440 = { h: 440, far: 292, near: 342, front: 398 };

// ── V: Val the Van ──
const val = (x, y, s, o = {}) => put(A.van, x, y, s, o);
const vicky = (x, y, s, o = {}) => put((q) => A.kid({ style: "pigtails", hair: "#8a5a2e", top: "#9b7fd8", dress: true, skin: "a", ...q }), x, y, s, o);
const vince = (x, y, s, o = {}) => put((q) => A.kid({ style: "curly", hair: "#2d2323", top: "#58cc02", bottom: "#4f6b8a", skin: "d", shoes: "#4db3f2", ...q }), x, y, s, o);
const vet = (x, y, s, o = {}) => put((q) => A.grownup({ coat: true, bun: true, skin: "c", hair: "#3d2b1f", ...q }), x, y, s, o);
const valley = (h = 400) => K.sky("#bfe8fb", h) + K.sun(370, 60, 24) + K.cloud(80, 60, 0.9) + K.cloud(250, 44, 0.7)
  + P(`M0 150 Q 90 170 170 250 L0 ${h} Z`, "#8fd06a") + P(`M440 140 Q 340 170 270 250 L440 ${h} Z`, "#8fd06a")
  + P(`M0 250 Q 220 200 440 250 L440 ${h} L0 ${h} Z`, "#b5e08f") + P(`M190 ${h} Q 230 300 214 230 L226 230 Q 258 300 270 ${h} Z`, "#d9dde4")
  + K.flower(80, 330, 1) + K.flower(360, 340, 1, "#ffd21c") + K.flower(120, 370, 0.9, "#9b7fd8");
const shine = (x, y) => S.starsList([[x - 70, y - 90, 0.8], [x + 60, y - 100, 0.7], [x + 80, y - 30, 0.6]], "#ffffff");
export const V_BOOK = {
  slug: "val-the-van",
  cover: () => S.villageBg({ h: 440 }) + K.ground(400, "#7cc152", 440) + val(220, 404, 1.6, { face: "grin" }) + shine(220, 404) + K.flower(60, 420, 1) + K.flower(390, 424, 1, "#9b7fd8"),
  pages: [
    () => valley() + val(230, 318, 0.8, { face: "grin" }),
    () => S.villageBg() + val(220, 372, 1.05, { face: "grin" }) + K.motion(90, 330, 1, "#ffffff"),
    () => S.villageBg() + val(210, 380, 1.3, { face: "grin" }) + S.sound(310, 300, 1.1) + G("translate(110 300) scale(-1 1)", S.sound(0, 0, 1.1)),
    () => S.villageBg() + val(130, 378, 0.9, { face: "grin" }) + vicky(300, 378, 1.3, { pose: "hold", face: "grin" }) + place(O.vase(), 300, 360, 1),
    () => K.sky("#fff0d9") + S.windowPane(150, 60, 140, 120, "day") + R(0, 250, 440, 150, 0, "#e3b98a") + R(60, 240, 320, 14, 5, "#c98f4f")
      + vicky(120, 400, 1.6, { pose: "reach", face: "happy" }) + place(O.vase(), 280, 240, 1.6) + place(O.violet(), 284, 170, 1.6),
    () => S.villageBg() + place(O.sign("#4db3f2", O.pawIcon()), 360, 372, 1.2) + val(190, 378, 1.0, { face: "grin" }) + place(O.crate(), 190, 292, 1.2),
    () => S.villageBg() + place(O.sign("#4db3f2", O.pawIcon()), 400, 372, 1) + vet(150, 380, 1.1, { pose: "reach", face: "grin" }) + place(O.carrot(), 196, 320, 1)
      + put((q) => A.rabbit({ fur: "#e0c29a", limb: "#d4b288", foot: "#d4b288", belly: "#f5e6d0", ...q }), 250, 380, 0.8, { face: "happy", flip: true })
      + put(A.dog, 320, 382, 0.8, { face: "grin", flip: true }) + put(A.duck, 380, 384, 0.7, { face: "happy", flip: true }),
    () => S.villageBg() + place(O.bench(), 300, 380, 1.1) + vince(300, 352, 1.1, { pose: "hold", face: "wow" }) + place(O.violin(), 300, 330, 1.1) + val(100, 380, 0.85, { face: "grin" }),
    () => S.villageBg() + vince(210, 380, 1.4, { pose: "hold", face: "happy" }) + place(O.violin(), 222, 334, 1.4)
      + S.notes([[290, 220, 1, "#8a6fc4"], [330, 190, 0.9, "#ff5c5c"], [130, 230, 0.9, "#4db3f2"]]),
    () => S.villageBg() + vince(220, 350, 1.0, { pose: "hold", face: "happy" }) + place(O.violin(), 228, 318, 1)
      + vicky(90, 386, 0.95, { pose: "cheer", face: "happy" }) + vet(360, 390, 0.8, { face: "grin" })
      + put(A.dog, 150, 396, 0.7, { face: "happy" }) + put(A.duck, 290, 396, 0.6, { face: "happy" }) + S.notes([[250, 200, 0.9, "#8a6fc4"], [180, 190, 0.8, "#ff5c5c"]]),
    () => S.villageBg() + val(200, 380, 1.2, { face: "happy" }) + S.bubblesUp([[150, 240, 9], [240, 220, 12], [300, 250, 8], [120, 290, 7]])
      + place(O.bucket(), 330, 386, 1.1) + vicky(390, 386, 0.95, { pose: "reach", face: "grin", flip: true }) + shine(200, 380),
    () => S.villageBg() + O.bunting(0, 30, 440, 30, 12) + val(220, 384, 1.15, { face: "grin" }) + shine(220, 384)
      + vicky(70, 390, 0.9, { pose: "wave", face: "happy" }) + vince(372, 390, 0.9, { pose: "wave", face: "happy", flip: true }) + S.hearts([[220, 190], [170, 210, 0.6], [270, 210, 0.6]]),
  ],
};

// ── S: Sid the Seagull ──
const sid = (x, y, s, o = {}) => put((q) => A.gull({ hat: true, ...q }), x, y, s, o);
const sadie = (x, y, s, o = {}) => put((q) => A.kid({ style: "pigtails", hair: "#3d2b1f", top: "#ffd21c", dress: true, skin: "c", hat: "sun", band: "#4db3f2", ...q }), x, y, s, o);
const beach = (o = {}) => K.beach({ sun: [360, 64, 26], clouds: [[80, 64, 1], [226, 44, 0.7]], ...o });
const bigWave = (x, y, s) => G(at(x, y, s), P("M-130 0 Q-110 -70 -20 -82 Q42 -86 62 -40 Q32 -62 2 -46 Q-24 -32 -8 0 Z", "#4db3f2")
  + L("M-20 -82 Q42 -86 62 -40 Q44 -54 22 -54", "#ffffff", 6) + C(60, -44, 5, "#ffffff") + C(68, -54, 4, "#ffffff") + C(48, -30, 3.5, "#ffffff"));
export const S_BOOK = {
  slug: "sid-the-seagull",
  cover: () => K.beach({ h: 440, sun: [360, 64, 26], clouds: [[80, 64, 1], [226, 44, 0.7]], seaY: 250, sandY: 316 }) + place(O.bench(), 250, 410, 1.2) + place(O.sandwich(), 250, 360, 1.1)
    + sid(130, 414, 1.4, { pose: "wave", face: "grin" }),
  pages: [
    () => beach() + R(96, 292, 12, 70, 3, "#b07a45") + sid(102, 294, 1.2, { face: "grin" }) + place(O.seashell(), 300, 372, 1.2),
    () => beach({ sun: [220, 110, 44], clouds: [[70, 60, 1], [350, 70, 0.7]] }) + sid(110, 370, 0.9, { face: "happy" }) + place(O.pail("#4db3f2"), 330, 376, 0.9) + L("M300 360 l-10 -8 M360 360 l10 -8", "#fff6c8", 3),
    () => beach() + place(O.bench(), 290, 380, 1.2) + place(O.sandwich(), 290, 324, 1.1) + sid(120, 376, 1.15, { face: "o", look: [3, -1] }),
    () => beach() + place(O.bench(), 290, 380, 1.2) + sadie(290, 350, 1.15, { pose: "hold", face: "smile" }) + place(O.sandwich(), 290, 328, 0.8)
      + sid(116, 376, 1.15, { pose: "wave", face: "grin" }),
    () => beach() + place(O.bench(), 290, 380, 1.2) + sadie(290, 350, 1.15, { pose: "reach", face: "grin", flip: true }) + place(O.sandwich(), 248, 318, 0.6)
      + sid(170, 376, 1.15, { face: "happy" }),
    () => beach() + place(O.bench(), 300, 380, 1.2) + sadie(300, 350, 1.1, { pose: "cheer", face: "happy" }) + sid(140, 376, 1.2, { pose: "cheer", face: "happy" })
      + S.notes([[150, 220, 1, "#8a6fc4"], [190, 190, 0.9, "#ff5c5c"]]),
    () => beach() + sadie(160, 382, 1.1, { face: "happy" }) + sid(280, 382, 1.1, { face: "happy" }) + place(O.pail("#ff8fb0"), 380, 390, 0.9),
    () => beach() + place(O.sandHill(140), 220, 384, 1.1) + sadie(90, 384, 1.05, { pose: "hold", face: "grin" }) + place(O.shovel(), 110, 370, 0.9)
      + sid(350, 384, 1.05, { pose: "cheer", face: "happy", flip: true }),
    () => beach() + place(O.sandHill(160), 220, 386, 1.2) + place(O.seashell(), 220, 330, 1.1) + sid(262, 332, 0.8, { face: "grin", flip: true })
      + sadie(90, 386, 1.0, { pose: "cheer", face: "happy" }) + K.sparkle(220, 300, 1, "#ffd21c"),
    () => beach() + place(O.sandHill(140), 250, 376, 1.1) + bigWave(130, 356, 1.2) + place(O.seashell(), 250, 326, 1) + sid(370, 384, 1.05, { face: "wow", flip: true }) + sadie(326, 390, 0.9, { face: "wow", flip: true }),
    () => beach() + E(220, 372, 90, 12, "#e6c68c") + place(O.seashell(), 220, 372, 1.1) + sid(150, 378, 1.15, { face: "sad" }) + sadie(310, 380, 1.1, { pose: "hug", face: "smile", flip: true }),
    () => beach() + place(O.sandHill(80), 230, 386, 0.9) + sadie(130, 384, 1.15, { pose: "cheer", face: "happy" }) + place(O.pail("#ff8fb0"), 300, 388, 0.9)
      + sid(360, 384, 1.1, { pose: "cheer", face: "happy", flip: true }) + S.hearts([[240, 230]]),
  ],
};

// ── Z: Zoe and the Zipper ──
const zoe = (x, y, s, o = {}) => put((q) => A.zebra({ bow: true, ...q }), x, y, s, o);
const zack = (x, y, s, o = {}) => put((q) => A.grownup({ top: "#c9b27a", bottom: "#4f7a3a", cap: "#3f7d4a", skin: "b", hair: "#8a5a2e", pocket: "#b39a62", ...q }), x, y, s, o);
const zoo = (o = {}) => S.zooBg(o) + place(O.zooGate(), 330, 330, 0.8) + K.tree(60, 330, 1.1);
const chilly = (o = {}) => S.zooBg({ sky: "#d7ecf7", sun: false, ...o }) + place(O.zooGate(), 330, 330, 0.8) + K.tree(60, 330, 1.1, "#8fbf7a")
  + S.starsList([[80, 80, 0.4], [200, 60, 0.35], [300, 100, 0.4], [400, 70, 0.35]], "#ffffff");
export const Z_BOOK = {
  slug: "zoe-and-the-zipper",
  cover: () => S.zooBg({ h: 440 }) + place(O.zooGate(), 320, 360, 0.9) + zoe(200, 412, 1.55, { coat: "closed", pose: "cheer", face: "happy" }) + place(O.zap(), 290, 300, 1.1),
  pages: [
    () => zoo() + zoe(190, 372, 1.35, { pose: "cheer", face: "happy" }),
    () => chilly() + zoe(200, 372, 1.35, { coat: "open", face: "worried" }) + S.shiver(200, 250, 1.4),
    () => chilly() + zoe(200, 372, 1.35, { coat: "open", pose: "hold", face: "effort" }) + L("M236 300 l12 -6 M236 312 l14 0", "#ffffff", 3),
    () => chilly() + zoe(200, 372, 1.35, { coat: "stuck", face: "sad" }) + S.exclaim(278, 220, 1.2),
    () => chilly() + zoe(130, 372, 1.2, { coat: "stuck", pose: "wave", face: "worried" }) + zack(330, 376, 1.1, { pose: "wave", face: "grin" }) + S.sound(196, 250, 0.8),
    () => chilly() + zoe(170, 372, 1.25, { coat: "stuck", face: "o" }) + zack(290, 376, 1.1, { pose: "reach", face: "grin", flip: true }) + L("M196 300 l-10 -8 M198 318 l-12 -2", "#ffffff", 3),
    () => chilly() + zoe(200, 372, 1.35, { coat: "closed", pose: "cheer", face: "happy" }) + place(O.zap(), 286, 280, 1.2) + place(O.zap("#ffffff"), 120, 250, 0.8)
      + S.starsList([[160, 190, 0.6], [260, 180, 0.6]], "#ffd21c"),
    () => zoo() + zoe(170, 372, 1.25, { coat: "closed", pose: "hug", face: "happy" }) + zack(270, 376, 1.1, { pose: "hug", face: "happy", flip: true }) + S.hearts([[220, 190], [250, 170, 0.6]]),
    () => zoo() + K.motion(90, 320, 1.1, "#ffffff") + zoe(220, 372, 1.25, { coat: "closed", run: true, face: "happy" }),
    () => zoo() + L("M40 360 Q220 300 400 360", "#ffffff", 3, { "stroke-dasharray": "2 10" }) + put(A.giraffe, 110, 330, 0.7, { face: "happy" })
      + put(A.kangaroo, 400, 336, 0.7, { face: "grin", flip: true }) + zoe(250, 380, 1.0, { coat: "closed", run: true, face: "happy" }) + K.motion(150, 350, 0.8, "#ffffff"),
    () => zoo() + zoe(140, 372, 1.25, { coat: "closed", face: "grin" }) + zack(300, 376, 1.1, { pose: "reach", face: "grin", flip: true }) + place(O.zucchini(), 252, 300, 1.1),
    () => zoo() + zoe(220, 372, 1.45, { coat: "closed", pose: "hug", face: "happy" }) + S.hearts([[140, 200], [300, 190], [330, 250, 0.6]]),
  ],
};

// ── SH: Shay the Shy Shark ──
const shay = (x, y, s, o = {}) => put(A.shark, x, y, s, o);
const shimmer = (x, y, s, o = {}) => put(A.seahorse, x, y, s, o);
const crab = (x, y, s, o = {}) => put(A.crab, x, y, s, o);
const shell = (x, y, s = 1) => place(O.seashell("#ffe0f0"), x, y, s) + K.sparkle(x - 12 * s, y - 22 * s, 0.7 * s) + K.sparkle(x + 14 * s, y - 16 * s, 0.5 * s);
const stage = (x = 300) => place(O.stageRock(), x, 350, 1) + place(O.starfish(), x - 50, 318) + place(O.starfish("#ff8fb0"), x + 50, 318, 0.8);
export const SH_BOOK = {
  slug: "shay-the-shy-shark",
  cover: () => S.seaBg({ h: 440 }) + S.kelp(40, 412, 1.2) + S.kelp(404, 410, 1.1) + shay(210, 220, 1.7, { face: "happy" }) + shell(330, 300, 1.3)
    + S.starsList([[100, 120], [340, 140, 0.7], [220, 90, 0.6]], "#fff1b8"),
  pages: [
    () => S.seaBg() + S.kelp(410, 370, 1.1) + shay(250, 240, 1.4, { face: "shy" }) + place(K.rock(0, 0, 1), 190, 340, 3.2),
    () => S.seaBg() + place(O.ship(), 230, 300, 1.4) + E(250, 270, 150, 50, "#1f4f73", { opacity: 0.35 }) + shay(260, 250, 1.1, { face: "shy" }),
    () => S.seaBg() + stage() + crab(250, 370, 1.0, { pose: "cheer" }) + crab(330, 376, 1.1, { pose: "cheer" }) + crab(400, 370, 0.9, { pose: "cheer" })
      + shay(90, 200, 0.9, { face: "shy" }) + S.sound(290, 270, 0.8),
    () => S.seaBg() + S.kelp(40, 370) + shay(230, 220, 1.5, { face: "shy" }) + L("M60 180 q-10 20 0 40 M44 170 q-14 30 0 60 M380 190 q10 20 0 40 M396 180 q14 30 0 60", "#dff4ff", 3),
    () => S.seaBg() + S.kelp(400, 372) + shimmer(300, 290, 1.5) + S.bubblesUp([[270, 150], [280, 128, 4]]) + shay(110, 250, 0.9, { face: "shy", look: [2, 0] }),
    () => S.seaBg() + stage(380) + shimmer(260, 290, 1.4) + shay(120, 240, 1.0, { face: "o" }),
    () => S.seaBg() + S.kelp(40, 372) + shay(180, 230, 1.4, { face: "shy" }) + S.qmark(320, 150, 1.4) + shimmer(360, 330, 1.0),
    () => S.seaBg() + shimmer(290, 300, 1.4) + shell(250, 250, 1.6) + shay(110, 230, 1.0, { face: "o", look: [2, 1] }),
    () => S.seaBg() + shimmer(220, 300, 1.5) + shell(300, 240, 1.4) + L("M270 200 l-10 -10 M330 200 l10 -10 M272 262 l-12 6 M332 262 l12 6", "#ffffff", 3),
    () => S.seaBg() + shay(200, 230, 1.4, { face: "happy" }) + shell(300, 272, 1.2) + L("M320 220 q14 14 0 28 M336 212 q22 22 0 44", "#ffffff", 3.4) + S.notes([[360, 170, 0.9, "#ffffff"]]),
    () => S.seaBg() + stage() + shay(300, 250, 1.1, { face: "happy" }) + shell(360, 296, 0.9) + crab(80, 372, 1.0, { pose: "cheer" }) + crab(150, 378, 0.9, { pose: "cheer" })
      + S.starsList([[240, 140], [320, 110, 0.7], [390, 150, 0.6]], "#fff1b8"),
    () => S.seaBg() + C(220, 220, 110, "#fff6c8", { opacity: 0.35 }) + shay(220, 230, 1.5, { face: "happy" })
      + S.starsList([[100, 130], [340, 120], [120, 300, 0.7], [330, 310, 0.7], [220, 90, 0.6]], "#fff1b8") + shimmer(380, 360, 0.8) + crab(60, 380, 0.8, { pose: "cheer" }),
  ],
};

// ── CH: Chip the Chipmunk ──
const chip = (x, y, s, o = {}) => put(A.chipmunk, x, y, s, o);
const chick = (x, y, s, o = {}) => put(A.chick, x, y, s, o);
const autumn = (o = {}) => S.meadowBg({ sky: "#ffe2c4", sun: [370, 70, 24], farC: "#e8c874", nearC: "#d9b35a", frontC: "#c9a24a", ...o })
  + K.tree(70, 330, 1.4, "#ff9d3d", "#ffc07a") + S.place(O.leafFall("#ff9d3d", 30), 160, 120) + S.place(O.leafFall("#e0892b", -20), 300, 180) + S.place(O.leafFall("#ff5c5c", 60), 380, 110);
const roofTop = (h = 400) => K.sky("#ffe2c4", h) + K.cloud(80, 60, 0.9) + K.sun(380, 64, 24) + S.place(O.leafFall("#ff9d3d", 30), 60, 150) + S.place(O.leafFall("#e0892b", -20), 380, 170)
  + P(`M0 ${h} L0 300 L440 250 L440 ${h} Z`, "#c9403a") + L("M0 330 L440 280 M0 364 L440 314", "#a8342e", 3);
const den = (h = 400) => S.roomBg({ wall: "#ffe7cf", h }) + S.windowPane(70, 60, 100, 90, "day") + R(300, 150, 110, 150, 8, "#d9745a") + R(316, 190, 78, 110, 6, "#3d2b2b") + S.fire(355, 296, 1.1);
export const CH_BOOK = {
  slug: "chip-the-chipmunk",
  cover: () => roofTop(440) + place(O.chimney(), 300, 320, 1.4) + chick(300, 190, 1.3, { pose: "cheer", face: "happy", air: true }) + chip(160, 360, 1.3, { pose: "wave", face: "grin" }),
  pages: [
    () => autumn() + chip(230, 372, 1.5, { face: "grin" }),
    () => autumn() + chip(220, 372, 1.35, { pose: "hold", face: "happy" }) + place(O.chestnut(), 220, 346, 1.4)
      + place(O.chestnut(), 320, 380, 1.2) + place(O.chestnut(), 344, 384, 1.1) + place(O.chestnut(), 332, 368, 1),
    () => autumn({ sun: false }) + S.wind(260, 150, 1) + S.wind(60, 220, 0.8) + chip(220, 372, 1.35, { pose: "hug", face: "worried" }) + S.shiver(220, 250, 1.3),
    () => roofTop() + place(O.chimney(), 300, 290, 1.3) + chip(190, 330, 1.15, { face: "o", look: [3, -2] }),
    () => roofTop() + place(O.chimney(), 280, 296, 1.3) + chick(280, 180, 1.4, { face: "grin", air: true }) + chip(150, 336, 1.1, { face: "wow" }),
    () => roofTop() + place(O.chimney(), 220, 320, 1.4) + chick(220, 186, 1.9, { face: "grin", air: true }) + S.sound(270, 150, 0.9) + S.sound(170, 150, 0.9),
    () => roofTop() + S.wind(40, 120, 0.9) + place(O.chimney(), 280, 296, 1.3) + chick(280, 180, 1.4, { face: "worried", air: true }) + S.shiver(280, 150, 0.9)
      + chip(140, 336, 1.1, { face: "sad" }),
    () => roofTop() + place(O.chimney(), 330, 280, 1.2) + chick(250, 300, 1.2, { face: "happy" }) + chip(140, 336, 1.15, { pose: "reach", face: "grin" }) + place(O.chestnut(), 186, 300, 1.1),
    () => roofTop() + place(O.chimney(), 360, 270, 1.1) + chip(160, 334, 1.1, { pose: "hold", face: "happy" }) + chick(260, 310, 1.1, { face: "happy" })
      + place(O.chestnut(), 160, 312, 1) + C(210, 230, 5, "#ffffff") + C(226, 222, 5, "#ffffff") + C(242, 230, 5, "#ffffff"),
    () => den() + place(O.armchair(), 190, 330, 1.5) + chip(90, 350, 1.0, { pose: "point", face: "grin" }) + chick(300, 346, 1.0, { face: "happy", pose: "cheer" }),
    () => den() + place(O.armchair(), 190, 330, 1.5) + chip(160, 300, 0.95, { face: "sleep" }) + chick(226, 292, 1.0, { face: "sleep" })
      + place(O.quilt(), 190, 334, 0.9) + K.zzz(250, 190, 1),
    () => den() + place(O.armchair(), 190, 330, 1.5) + chip(160, 290, 0.95, { pose: "cheer", face: "happy" }) + chick(232, 286, 0.95, { pose: "cheer", face: "happy" })
      + S.hearts([[200, 150], [150, 170, 0.6], [250, 170, 0.6]]),
  ],
};

// ── J: Jax and the Jam Jar ──
const jax = (x, y, s, o = {}) => put(A.jaguar, x, y, s, o);
const jill = (x, y, s, o = {}) => put(A.giraffe, x, y, s, o);
const jarAt = (x, y, s = 1, open = false) => place(O.jar(open), x, y, s);
export const J_BOOK = {
  slug: "jax-and-the-jam-jar",
  cover: () => S.jungleBg({ h: 440 }) + jill(320, 404, 1.2, { face: "grin" }) + jax(170, 404, 1.45, { pose: "hold", face: "grin" }) + jarAt(170, 376, 1.3),
  pages: [
    () => S.jungleBg() + jax(220, 372, 1.45, { face: "grin" }),
    () => S.jungleBg() + place(O.log(120), 220, 372, 1.1) + S.hop(90, 360, 330, 330, 90) + jax(220, 250, 1.1, { pose: "cheer", air: true, face: "happy" }),
    () => S.jungleBg() + E(300, 362, 44, 10, "#a5703f") + R(260, 330, 80, 32, 8, "#a5703f") + jarAt(300, 332, 1.4)
      + S.starsList([[250, 250, 0.7], [350, 240, 0.7]]) + jax(130, 372, 1.25, { face: "wow", look: [3, 0] }),
    () => S.jungleBg() + jarAt(320, 372, 1.2) + jax(180, 290, 1.2, { pose: "cheer", air: true, face: "happy" }) + S.starsList([[100, 150], [260, 130, 0.7], [140, 100, 0.6]]),
    () => S.jungleBg() + jax(220, 372, 1.45, { pose: "hold", face: "effort" }) + jarAt(220, 356, 1.2) + L("M180 290 l-12 -8 M262 290 l12 -8 M176 310 l-14 0 M266 310 l14 0", "#ffffff", 3),
    () => S.jungleBg() + jax(130, 372, 1.2, { pose: "hold", face: "smile" }) + jarAt(130, 358, 1) + jill(320, 376, 1.25, { face: "grin" }),
    () => S.jungleBg() + jax(150, 372, 1.2, { pose: "hold", face: "o" }) + jarAt(150, 358, 1) + jill(290, 376, 1.25, { pose: "reach", face: "grin", flip: true })
      + L("M134 290 q16 -14 32 0 M126 300 l6 -10 l6 8", "#ffffff", 3),
    () => S.jungleBg() + jarAt(220, 372, 1.5, true) + R(186, 250, 36, 12, 4, "#ff5c5c", { transform: rot(-30, 204, 256) }) + S.burst(220, 290, 1, "#ffffff")
      + jax(90, 372, 1.0, { face: "wow" }) + jill(360, 376, 1.0, { face: "wow" }),
    () => S.jungleBg() + place(O.blanket(), 280, 386, 1.4) + jarAt(280, 372, 0.9, true) + jax(130, 372, 1.2, { pose: "wave", face: "grin" }) + jill(360, 360, 0.9, { face: "happy", flip: true }),
    () => S.jungleBg() + place(O.blanket(), 220, 390, 1.8) + jarAt(220, 380, 0.8, true) + jax(120, 378, 1.1, { pose: "hold", face: "happy" }) + place(O.juice(), 120, 356, 1)
      + jill(320, 382, 1.05, { pose: "hold", face: "happy" }) + place(O.juice("#ff5c8a"), 320, 344, 1),
    () => S.jungleBg() + jill(300, 378, 1.2, { face: "grin" }) + jax(140, 378, 1.25, { face: "happy" }) + L("M190 250 q10 -8 20 0 M194 236 q10 -8 20 0", "#ffffff", 3)
      + S.speech(250, 150, 60, 40, S.starsList([[250, 150, 0.5]], "#ffd21c")),
    () => S.jungleBg({ sunset: true }) + jax(150, 378, 1.25, { pose: "cheer", face: "happy" }) + jill(300, 380, 1.15, { pose: "cheer", face: "happy" })
      + put(A.parrot, 380, 200, 0.7, { pose: "cheer", air: true, face: "happy" }) + S.hearts([[230, 200]]),
  ],
};

// ── L: Leo's Lucky Leaf ──
const leo = (x, y, s, o = {}) => put(A.lamb, x, y, s, o);
const lucy = (x, y, s, o = {}) => put(A.lizard, x, y, s, o);
const lake = (o = {}) => S.meadowBg({ mid: K.pond(270, 300, 190, 32), ...o });
const leaf = (x, y, s = 1, a = 0) => G(`translate(${x} ${y}) rotate(${a}) scale(${s})`, O.bigLeaf());
export const L_BOOK = {
  slug: "leo-lucky-leaf",
  cover: () => S.meadowBg({ ...C440, mid: K.pond(290, 336, 180, 30) }) + place(O.log(130), 330, 410, 1) + lucy(330, 384, 1.1, { face: "smile" })
    + leo(150, 404, 1.45, { pose: "hold", face: "happy" }) + leaf(150, 386, 0.8) + K.sparkle(120, 300, 1, "#ffd21c") + K.sparkle(190, 290, 0.8, "#ffd21c"),
  pages: [
    () => S.meadowBg({}) + S.hop(80, 360, 360, 360, 120) + leo(220, 280, 1.3, { pose: "cheer", air: true, face: "happy" }),
    () => lake() + S.hop(60, 370, 300, 370, 90) + leo(170, 300, 1.15, { pose: "cheer", air: true, face: "happy" }),
    () => lake() + L("M320 60 q-40 40 -60 90 q-20 50 -40 60", "#ffffff", 2.5, { "stroke-dasharray": "3 8" }) + leo(200, 372, 1.35, { face: "o", look: [0, -3] })
      + leaf(206, 248, 0.8, 10),
    () => lake() + leo(200, 372, 1.4, { pose: "hold", face: "happy" }) + leaf(200, 352, 0.9) + K.sparkle(160, 250, 1, "#ffd21c") + K.sparkle(250, 240, 0.8, "#ffd21c"),
    () => lake() + place(O.log(130), 340, 380, 1.1) + lucy(344, 354, 0.9, { face: "sleep" }) + leo(150, 372, 1.2, { pose: "hold", face: "grin" }) + leaf(150, 354, 0.75),
    () => lake({ front: 330 }) + place(O.log(260), 220, 392, 1.3) + lucy(220, 356, 2.2, { face: "sleep" }) + K.zzz(310, 250, 1),
    () => lake() + place(O.log(150), 300, 380, 1.1) + lucy(300, 354, 1.1, { face: "smile" }) + leo(130, 372, 1.2, { pose: "reach", face: "grin" }) + leaf(176, 316, 0.7, 70),
    () => lake() + place(O.log(150), 300, 380, 1.1) + lucy(300, 354, 1.1, { face: "o" }) + L("M348 339 q6 4 10 -2", "#ff8fa3", 2.5)
      + S.bubble(390, 250, 38, place(O.bun(), 390, 262, 1.3), [-1, 1]) + leo(130, 372, 1.2, { face: "grin" }),
    () => lake() + place(O.log(150), 330, 380, 1.1) + lucy(330, 354, 1.0, { face: "smile" }) + leo(150, 372, 1.25, { pose: "point", face: "grin" }) + leaf(120, 340, 0.6, -20),
    () => lake() + place(O.leafBoat(), 290, 312, 1.1) + leo(110, 372, 1.1, { face: "happy" }) + lucy(210, 380, 1.1, { face: "smile" }),
    () => S.meadowBg({ mid: K.pond(220, 330, 220, 60) }) + place(O.leafBoat(), 220, 330, 1.8) + put(A.ladybug, 220, 316, 1.6, { face: "happy" }) + S.ripple(150, 346, 30) + S.ripple(300, 344, 30),
    () => lake() + place(O.leafBoat(), 330, 300, 0.8) + put(A.ladybug, 330, 292, 0.8) + leo(130, 372, 1.2, { pose: "wave", face: "happy" }) + lucy(250, 380, 1.1, { face: "smile" })
      + K.sparkle(330, 260, 0.8, "#ffd21c"),
  ],
};

// ── TH: Theo's Thunder Day (no "the" in the words, and none in the pictures' story either) ──
const theo = (x, y, s, o = {}) => put(A.sloth, x, y, s, o);
const thea = (x, y, s, o = {}) => put((q) => A.sloth({ flower: true, fur: "#d4b28a", ...q }), x, y, s, o);
const cozy = (win = "storm", h = 400) => S.roomBg({ wall: "#e8e4ff", h }) + S.windowPane(150, 50, 140, 110, win) + R(40, 70, 70, 8, 3, "#c9c3e8");
const storm = () => S.meadowBg({ sky: "#aab6c8", sun: false, clouds: [] }) + O.stormCloud(110, 70, 1.3) + O.stormCloud(320, 60, 1.5)
  + K.rain(20, 120, 420, 300, 22, "#dff4ff", 5);
export const TH_BOOK = {
  slug: "theo-thunder-day",
  cover: () => cozy("storm", 440) + O.bolt(230, 70, 0.8) + theo(170, 350, 1.1, { face: "happy" }) + thea(270, 350, 1.1, { face: "happy" })
    + place(O.quilt(), 220, 440, 1.7),
  pages: [
    () => S.meadowBg({}) + K.tree(360, 360, 1.6) + theo(180, 372, 1.35, { face: "happy" }) + S.bubble(300, 110, 50, K.sun(300, 110, 24) + "", [-1, 1]),
    () => S.meadowBg({}) + theo(210, 372, 1.4, { pose: "hold", face: "happy" }) + place(O.drink(), 210, 352, 1.3),
    () => S.meadowBg({ sky: "#c9d4e2", sun: false, clouds: [] }) + O.stormCloud(120, 70, 1.2) + O.stormCloud(330, 60, 1.3)
      + S.burst(90, 170, 1.1, "#ffffff") + S.burst(360, 170, 0.9, "#ffffff") + theo(220, 372, 1.35, { face: "wow" }),
    () => storm() + O.bolt(220, 110, 1.2) + theo(220, 372, 1.35, { pose: "carry", face: "shy" }),
    () => storm() + theo(220, 372, 1.35, { pose: "hug", face: "worried" }) + S.shiver(220, 250, 1.3),
    () => storm() + theo(120, 372, 1.2, { pose: "hug", face: "worried" }) + thea(320, 372, 1.25, { pose: "wave", face: "grin" }),
    () => S.meadowBg({ sky: "#bcc7d6", sun: false, clouds: [] }) + O.stormCloud(330, 60, 1.2) + theo(120, 372, 1.15, { face: "o" }) + thea(320, 372, 1.2, { pose: "point", face: "grin", flip: true })
      + S.bubble(220, 120, 44, S.qmark(220, 130, 1.1, "#8a6fc4"), [-1, 1]),
    () => cozy() + theo(220, 372, 1.35, { face: "happy" }) + S.bubble(320, 130, 58, place(O.quilt(), 320, 160, 0.6), [-1, 1]),
    () => cozy() + theo(170, 330, 1.0, { face: "happy" }) + thea(270, 330, 1.0, { face: "smile" }) + place(O.quilt(), 220, 404, 1.6),
    () => cozy() + theo(170, 330, 1.0, { face: "happy" }) + thea(270, 330, 1.0, { face: "sleep" }) + place(O.quilt(), 220, 404, 1.6)
      + S.notes([[300, 190, 0.9, "#8a6fc4"], [330, 160, 0.8, "#ff5c5c"]]) + L("M126 300 l-8 -6 M126 312 l-10 0", "#8a6fc4", 2.5),
    () => cozy("clear") + K.rainbow(220, 150, 40, 6) + theo(170, 330, 1.0, { face: "happy", look: [0, -3] }) + thea(270, 330, 1.0, { face: "happy", look: [0, -3] })
      + place(O.quilt(), 220, 404, 1.6),
    () => S.meadowBg({}) + K.rainbow(220, 250, 150, 12) + theo(150, 372, 1.3, { pose: "wave", face: "grin" }) + thea(300, 372, 1.2, { pose: "cheer", face: "happy" }) + S.hearts([[220, 180]]),
  ],
};

// ── THV: This Bear, That Bee ──
const bear = (x, y, s, o = {}) => put(A.bear, x, y, s, o);
const bee = (x, y, s, o = {}) => put(A.bee, x, y, s, o);
const duck = (x, y, s, o = {}) => put(A.duck, x, y, s, { air: true, ...o });
const pondHill = (o = {}) => S.meadowBg({ mid: K.pond(250, 318, 170, 30), ...o });
export const THV_BOOK = {
  slug: "this-bear-that-bee",
  cover: () => S.meadowBg({ ...C440, mid: K.pond(300, 350, 130, 24) }) + duck(270, 352, 0.6, { face: "happy" }) + duck(320, 356, 0.6, { face: "happy" })
    + bear(150, 404, 1.5, { pose: "wave", face: "grin" }) + bee(310, 190, 1.9, { face: "grin" }),
  pages: [
    () => S.meadowBg({}) + bear(140, 372, 1.5, { face: "grin" }) + bee(330, 210, 1.5, { face: "grin" }) + S.hop(360, 290, 300, 240, 30),
    () => S.meadowBg({}) + L("M280 150 q40 -60 80 0 q40 60 -20 70", "#ffffff", 2.5, { "stroke-dasharray": "2 9" }) + bear(160, 372, 1.35, { pose: "cheer", face: "happy" })
      + bee(300, 200, 1.4, { face: "happy" }) + S.hearts([[230, 150]]),
    () => S.meadowBg({ far: 220, mid: K.pond(360, 290, 60, 10) }) + bear(150, 372, 1.35, { pose: "point", face: "grin" }) + bee(250, 200, 1.2, { face: "smile" }),
    () => S.meadowBg({ far: 200, near: 300, mid: K.pond(250, 330, 150, 28) }) + P("M40 300 Q140 150 260 300 Z", "#9ad06a") + bear(360, 376, 0.8, { face: "smile" }) + bee(400, 300, 0.7),
    () => pondHill() + duck(210, 318, 0.7, { face: "smile" }) + duck(260, 322, 0.7, { face: "smile" }) + duck(310, 318, 0.7, { face: "smile" })
      + bear(90, 376, 1.1, { face: "o" }) + bee(150, 250, 1.0, { face: "o" }),
    () => pondHill() + duck(220, 318, 0.7) + duck(270, 322, 0.7) + duck(320, 318, 0.7) + bear(80, 376, 1.05, { face: "smile" })
      + bee(150, 240, 1.2, { face: "grin" }) + L("M176 240 l30 20", "#ffffff", 3),
    () => pondHill() + [0, 1, 2, 3].map((i) => duck(150 + i * 50, 318 + (i % 2) * 4, 0.6 + (i === 0 ? 0.15 : 0), { face: "happy", color: i === 0 ? "#f7f3ee" : "#ffd94d" })).join("")
      + S.ripple(200, 322, 90),
    () => S.meadowBg({}) + place(O.sunflower(1.6), 350, 376) + bear(180, 372, 1.35, { pose: "hold", face: "grin" }) + place(O.seedBag(), 180, 352, 1.1) + bee(290, 200, 1.3, { face: "grin" }),
    () => pondHill() + bear(90, 376, 1.1, { pose: "reach", face: "happy" }) + L("M130 330 q60 -60 110 -10", "#8a6a3a", 2, { "stroke-dasharray": "1 10" })
      + duck(250, 318, 0.7, { face: "grin" }) + duck(300, 322, 0.7, { face: "grin" }) + bee(170, 230, 1.0, { face: "happy" }),
    () => pondHill() + duck(200, 318, 0.8, { face: "happy" }) + duck(260, 322, 0.8, { face: "happy" }) + duck(320, 318, 0.8, { face: "happy" })
      + S.sound(214, 270, 0.6) + S.sound(274, 274, 0.6) + S.sound(334, 270, 0.6) + K.dots([[210, 312, "#8a6a3a"], [270, 316, "#8a6a3a"]]),
    () => S.meadowBg({ sunset: true, mid: K.pond(250, 318, 170, 30) }) + bear(120, 372, 1.0, { face: "smile" }) + bee(190, 260, 0.9),
    () => S.meadowBg({ sunset: true }) + K.stars([[60, 50, 0.4], [150, 30, 0.35], [390, 40, 0.4]]) + bear(170, 372, 1.35, { pose: "hug", face: "happy" })
      + bee(280, 220, 1.3, { face: "happy" }) + S.hearts([[230, 150], [200, 120, 0.6]]),
  ],
};

export const BOOKS2 = [V_BOOK, S_BOOK, Z_BOOK, SH_BOOK, CH_BOOK, J_BOOK, L_BOOK, TH_BOOK, THV_BOOK];
