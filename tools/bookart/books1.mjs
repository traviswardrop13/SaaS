// Page layouts for the fuller books, part one: P B M N T D K G F.
// Each book is { slug, cover, pages: [12] }; each page returns the inside of a
// 440 x 400 SVG (the cover, 440 x 440).
import * as K from "./kit.mjs";
import * as A from "./cast.mjs";
import * as O from "./props.mjs";
import * as S from "./scene.mjs";

const { G, C, E, R, P, L, at, rot } = K;
const { put, place } = S;
const C440 = { h: 440, far: 292, near: 342, front: 398 };

// ── P: Penny's Pebble Party ──
const penny = (x, y, s, o = {}) => put((q) => A.penguin({ bow: true, ...q }), x, y, s, o);
const pat = (x, y, s, o = {}) => put(A.pig, x, y, s, o);
const polly = (x, y, s, o = {}) => put(A.parrot, x, y, s, o);
const peb = (x, y, c, s = 1) => place(O.pebble(c), x, y, s);
const PEBS = ["#ff8fb0", "#ffc49a", "#b9b2a8", "#9fd6f5", "#c9c3cf", "#ffd98a"];
export const P_BOOK = {
  slug: "penny-pebble-party",
  cover: () => S.meadowBg({ ...C440, mid: K.pond(330, 356, 90, 18) }) + O.bunting(10, 30, 430, 30, 12)
    + penny(200, 392, 1.55, { pose: "hold", face: "grin" }) + peb(200, 348, "#ff8fb0", 1.1)
    + place(O.pail(), 306, 398, 1.3) + peb(290, 350, "#ffc49a", 0.8) + peb(318, 346, "#9fd6f5", 0.8)
    + peb(110, 414, "#ffd98a") + peb(380, 420, "#c9c3cf"),
  pages: [
    () => S.meadowBg({}) + penny(170, 354, 1.3, { pose: "wave", face: "grin" }) + place(O.pail(), 262, 358, 1.25) + K.flower(360, 380, 1) + K.flower(60, 384, 0.9, "#ffd21c"),
    () => S.meadowBg({ mid: K.pond(330, 334, 110, 24) }) + K.motion(52, 300, 0.9) + penny(140, 352, 1.15, { face: "smile", look: [2, 0] }) + place(O.pail(), 210, 354, 0.95),
    () => S.meadowBg({ mid: K.pond(310, 328, 150, 26) }) + penny(160, 358, 1.25, { face: "o", look: [2, 2] })
      + peb(252, 370, "#c9c3cf", 1.4) + peb(300, 378, "#b9b2a8", 1.2) + K.sparkle(252, 344, 1, "#ffd21c") + K.sparkle(306, 352, 0.8, "#ffd21c"),
    () => S.meadowBg({}) + penny(150, 356, 1.2, { pose: "hold", face: "happy" })
      + peb(236, 322, "#c9c3cf", 0.9) + peb(252, 318, "#b9b2a8", 0.8) + place(O.pail(), 244, 360, 1.35),
    () => S.meadowBg({}) + penny(120, 356, 1.1, { face: "smile", look: [3, 0] }) + place(O.pail(), 192, 360, 0.95)
      + pat(300, 356, 1.25, { pose: "point", face: "grin", flip: true })
      + place(O.paintPot("#ff5c8a"), 372, 376) + place(O.paintPot("#ff9d3d"), 404, 380) + place(O.brush("#ff5c8a"), 388, 350, 0.9),
    () => S.meadowBg({}) + place(O.blanket(), 220, 382, 1.5) + [0, 1, 2, 3].map((i) => peb(180 + i * 26, 368 - (i % 2) * 6, PEBS[i], 0.9)).join("")
      + penny(100, 356, 1.1, { pose: "hold", face: "happy" }) + place(O.brush("#ff8fb0"), 112, 322)
      + pat(338, 356, 1.15, { pose: "hold", face: "grin", flip: true }) + place(O.brush("#ffc49a"), 330, 320)
      + place(O.paintPot("#ff8fb0"), 206, 394, 0.9) + place(O.paintPot("#ffc49a"), 238, 396, 0.9),
    () => S.meadowBg({ front: 340 }) + [0, 1, 2, 3].map((i) => peb(80 + i * 94, 344 + (i % 2) * 10, i % 2 ? "#ffc49a" : "#ff8fb0", 3.2)).join("")
      + C(90, 324, 4, "#ffffff") + C(180, 334, 4, "#ffffff") + C(262, 322, 4, "#ffffff") + C(354, 334, 4, "#ffffff")
      + S.starsList([[60, 250], [150, 280, 0.6], [240, 240], [330, 272, 0.6], [400, 240]])
      + penny(52, 420, 0.95, { pose: "cheer", face: "happy" }) + pat(392, 420, 0.95, { pose: "cheer", face: "happy", flip: true }),
    () => S.meadowBg({}) + place(O.pole(), 300, 378, 1.2) + polly(300, 240, 0.95, { pose: "cheer", face: "grin" })
      + penny(106, 358, 1.05, { face: "o", look: [2, -2] }) + pat(192, 360, 1.1, { face: "o", look: [2, -2] }),
    () => S.meadowBg({}) + O.bunting(0, 20, 440, 24, 10) + place(O.pole(), 332, 378, 1.2) + polly(332, 240, 0.95, { face: "o", look: [-2, 2] })
      + penny(170, 358, 1.25, { pose: "wave", face: "grin" }) + S.sound(232, 250, 0.9, "#ffffff"),
    () => S.meadowBg({}) + place(O.table(110), 220, 380) + place(O.pie(), 220, 326, 1.3)
      + polly(300, 322, 0.9, { pose: "wave", face: "grin" })
      + penny(96, 364, 1.05, { pose: "cheer", face: "happy" }) + pat(372, 366, 1.0, { face: "grin", flip: true }) + S.steam(220, 290, 0.8),
    () => S.meadowBg({ mid: K.pond(220, 318, 180, 24) }) + penny(110, 346, 0.9, { pose: "cheer", face: "happy" })
      + pat(220, 346, 0.95, { face: "happy" }) + polly(330, 344, 0.9, { pose: "cheer", face: "happy" })
      + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => peb(66 + i * 44, 386, PEBS[i % PEBS.length], 1.2)).join(""),
    () => S.meadowBg({}) + O.bunting(0, 24, 440, 28, 12) + place(O.balloon("#ff5c5c"), 34, 230) + place(O.balloon("#4db3f2"), 408, 236)
      + place(O.table(120), 220, 386) + place(O.pie(), 200, 332, 1.1) + peb(250, 330, "#ff8fb0") + peb(272, 328, "#ffc49a")
      + penny(100, 368, 1.0, { pose: "cheer", face: "happy" }) + pat(342, 368, 1.0, { pose: "cheer", face: "happy", flip: true })
      + polly(220, 230, 0.85, { pose: "cheer", face: "happy", air: true }) + S.confetti(S.CONF),
  ],
};

// ── B: Bo's Beach Day ──
const bo = (x, y, s, o = {}) => put((q) => A.bear({ hat: true, ...q }), x, y, s, o);
const bella = (x, y, s, o = {}) => put((q) => A.bee({ bow: true, ...q }), x, y, s, o);
const ben = (x, y, s, o = {}) => put((q) => A.rabbit({ fur: "#e0c29a", limb: "#d4b288", foot: "#d4b288", belly: "#f5e6d0", ...q }), x, y, s, o);
const basketFull = (x, y, s) => place(O.basket(O.berries() + G("translate(12 -24) scale(.7)", O.banana())), x, y, s);
const sea = (o = {}) => K.sky(o.sunset ? "#ffc6a3" : "#bfe8fb", o.h || 400) + (o.sunset ? C(330, 196, 34, "#ffcf5c") : K.sun(370, 62, 24))
  + K.cloud(80, 60, 0.9) + K.cloud(250, 40, 0.7) + R(0, 196, 440, (o.h || 400) - 196, 0, o.sunset ? "#f0a88a" : "#4db3f2")
  + E(120, 236, 60, 5, "#8fd4f2") + E(330, 270, 50, 5, "#8fd4f2") + K.waves([[40, 226], [250, 250], [360, 300], [80, 330]]);
const sandR = P("M300 250 Q360 234 440 240 L440 300 Q380 286 300 250 Z", "#f5dca8");
export const B_BOOK = {
  slug: "bo-beach-day",
  cover: () => S.shoreBg({ h: 440, waterY: 236, groundY: 372, sand: true }) + bo(220, 330, 1.05, { pose: "wave", face: "grin" })
    + basketFull(262, 318, 0.7) + place(O.boat(), 226, 342, 1.25) + bella(344, 170, 1.8, { face: "grin" }) + S.hop(250, 190, 330, 160, 40),
  pages: [
    () => S.shoreBg({ waterY: 220, groundY: 318 }) + place(O.boat(), 306, 300, 1.1) + bo(120, 358, 1.2, { pose: "wave", face: "grin" }),
    () => S.shoreBg({ waterY: 220, groundY: 318 }) + basketFull(306, 282, 0.85) + place(O.boat(), 306, 300, 1.1) + bo(136, 358, 1.2, { pose: "point", face: "smile" }),
    () => S.shoreBg({ waterY: 200, groundY: 250, sand: true }) + place(O.blanket(), 220, 396, 2.8)
      + basketFull(220, 344, 2.1) + place(O.bun(), 110, 370, 1.5) + place(O.bun(), 140, 384, 1.3) + place(O.banana(), 330, 372, 1.6)
      + G("translate(356 340) scale(1.4)", O.berries()) + S.starsList([[80, 290, 0.7], [380, 300, 0.7], [220, 170, 0.8]]),
    () => sea() + sandR + bo(200, 322, 1.0, { pose: "stand", face: "grin" }) + place(O.boat(), 210, 334, 1.25)
      + place(O.oar(), 136, 330, 1.1) + K.waves([[60, 356], [300, 364]]),
    () => sea() + sandR + bo(140, 322, 0.95, { face: "o", look: [3, -2] }) + place(O.boat(), 150, 334, 1.15)
      + bella(320, 170, 1.9, { face: "grin" }) + S.hop(390, 250, 300, 190, 20) + S.sound(362, 150, 0.9),
    () => S.shoreBg({ waterY: 200, groundY: 300, sand: true }) + bo(150, 440, 1.8, { face: "grin", look: [3, -1] })
      + bella(318, 196, 2.3, { face: "grin" }) + S.speech(330, 96, 70, 50, S.qmark(330, 102, 1)),
    () => S.shoreBg({ waterY: 190, groundY: 262, sand: true }) + S.umbrella(90, 330, 1.1) + place(O.blanket(), 230, 378, 1.7)
      + bo(200, 364, 1.1, { face: "happy" }) + bella(300, 280, 1.5, { face: "smile" }) + place(O.pail("#4db3f2"), 380, 384, 0.9),
    () => S.shoreBg({ waterY: 190, groundY: 262, sand: true }) + place(O.boat(), 340, 330, 0.9)
      + S.hop(390, 300, 240, 330, 70) + place(O.ball(), 220, 322, 1.2) + L("M200 330 q-10 6 -18 2 M240 330 q10 6 18 2", "#ffffff", 3)
      + bo(96, 368, 1.0, { face: "o", look: [3, -1] }) + bella(150, 210, 1.2, { face: "o" }),
    () => S.shoreBg({ waterY: 190, groundY: 262, sand: true }) + place(O.ball(), 214, 378, 1.1)
      + bo(96, 368, 1.0, { face: "smile", look: [2, 0] }) + ben(330, 368, 1.1, { pose: "reach", face: "grin", flip: true }),
    () => S.shoreBg({ waterY: 190, groundY: 262, sand: true }) + S.hop(130, 230, 330, 230, 70) + place(O.ball(), 228, 200, 1.2)
      + bo(118, 368, 1.05, { pose: "cheer", face: "happy" }) + ben(338, 368, 1.05, { pose: "cheer", face: "grin", flip: true }),
    () => S.shoreBg({ waterY: 190, groundY: 262, sand: true }) + place(O.blanket(), 220, 388, 2)
      + basketFull(220, 362, 1.0) + place(O.bun(), 152, 380) + place(O.banana(), 292, 382)
      + bo(78, 376, 1.0, { pose: "hold", face: "happy" }) + ben(366, 376, 1.0, { pose: "hold", face: "grin", flip: true })
      + bella(226, 246, 1.4, { face: "happy" }),
    () => S.shoreBg({ waterY: 200, groundY: 280, sand: true, sunset: true }) + bo(140, 364, 1.1, { pose: "wave", face: "grin" })
      + ben(304, 366, 1.05, { pose: "wave", face: "happy", flip: true }) + bella(222, 240, 1.4, { face: "happy" }) + S.hearts([[222, 180], [90, 200, 0.6], [360, 210, 0.6]]),
  ],
};

// ── M: Mia Makes Muffins ──
const mia = (x, y, s, o = {}) => put((q) => A.mouse({ apron: true, chef: true, ...q }), x, y, s, o);
const maxm = (x, y, s, o = {}) => put(A.mole, x, y, s, o);
const molly = (x, y, s, o = {}) => put((q) => A.moose({ flower: true, ...q }), x, y, s, o);
const kitchen = (win = "day", h = 400) => S.roomBg({ wall: "#fff0d9", h, floorY: h - 100 }) + S.windowPane(300, 50, 104, 86, win)
  + R(0, h - 172, 440, 74, 4, "#ffd9a8") + R(0, h - 178, 440, 10, 4, "#e8c99a") + K.L(`M110 ${h - 164} V${h - 104} M220 ${h - 164} V${h - 104} M330 ${h - 164} V${h - 104}`, "#f0c890", 3)
  + C(96, h - 134, 3, "#c98f4f") + C(124, h - 134, 3, "#c98f4f") + C(316, h - 134, 3, "#c98f4f") + C(344, h - 134, 3, "#c98f4f")
  + place(O.milk(), 400, h - 178, 0.6) + R(372, h - 196, 16, 18, 4, "#ff8fb0")
  + R(30, 70, 80, 8, 3, "#e8c99a") + place(O.cup("#ff8fb0"), 50, 70, 0.9) + place(O.cup("#4db3f2"), 84, 70, 0.9);
const splat = (list) => list.map(([x, y, r]) => C(x, y, r || 4, "#f5dca8")).join("");
const nightOut = (h = 400) => S.nightSky(h)
  + K.hills(262, 312, h, "#3f6b5a", "#335a4a") + K.ground(368, "#2e5242", h);
export const M_BOOK = {
  slug: "mia-makes-muffins",
  cover: () => kitchen("night", 440) + mia(220, 404, 1.6, { pose: "hold", face: "grin" }) + place(O.tray(3), 220, 372, 1.25) + S.steam(220, 318, 0.8),
  pages: [
    () => kitchen() + mia(220, 346, 1.2, { pose: "cheer", face: "happy" }) + place(O.table(150), 220, 392, 1.1)
      + S.bubble(110, 150, 44, place(O.muffin(), 110, 176, 2.2), [1, 1]),
    () => kitchen() + mia(150, 356, 1.2, { pose: "hold", face: "grin" }) + place(O.table(130), 316, 384)
      + place(O.milk(), 290, 330, 1.1) + place(O.bowl(), 346, 330, 0.9),
    () => kitchen() + mia(220, 350, 1.15, { pose: "hold", face: "effort" }) + place(O.table(170), 220, 398, 1.1)
      + place(O.bowl(), 220, 338, 1.4) + place(O.batter(), 220, 340, 1.3) + place(O.spoon(), 230, 320, 1)
      + splat([[120, 330], [150, 300, 3], [300, 310], [330, 336, 5], [210, 250, 3], [236, 262, 2.5], [70, 380, 6], [380, 386, 5]]),
    () => kitchen() + R(20, 150, 100, 150, 8, "#b07a45") + R(30, 160, 80, 140, 6, "#6b4a2e")
      + maxm(70, 300, 1.0, { pose: "wave", face: "grin" }) + mia(300, 356, 1.2, { face: "o", look: [-3, 0] })
      + S.speech(170, 150, 80, 56, place(O.milk(), 160, 170, 0.7) + S.qmark(186, 160, 0.6)),
    () => kitchen() + maxm(118, 350, 1.1, { pose: "reach", face: "grin" }) + place(O.melon(), 166, 316, 1.1)
      + mia(322, 350, 1.1, { pose: "reach", face: "grin", flip: true }) + place(O.syrup(), 280, 318, 1.0)
      + place(O.table(170), 220, 398, 1.1) + place(O.bowl(), 220, 338, 1.3) + place(O.batter(), 220, 340, 1.2),
    () => kitchen() + place(O.oven(), 336, 330, 1.3) + mia(150, 356, 1.2, { pose: "hold", face: "grin" }) + place(O.tray(3), 150, 332, 1.0),
    () => S.nightSky(400, null) + C(120, 214, 46, "#fff6c8", { opacity: 0.25 }) + C(120, 214, 32, "#fff1b8")
      + K.hills(262, 312, 400, "#3f6b5a", "#335a4a") + K.ground(368, "#2e5242")
      + K.house(330, 330, 0.9, "#ffe0b0", "#e8524a") + R(335, 286, 16, 14, 3, "#ffd96b") + R(299, 286, 16, 14, 3, "#ffd96b")
      + K.stars([[60, 60], [200, 50, 0.4], [260, 110, 0.45], [400, 60]]),
    () => kitchen() + mia(106, 356, 1.1, { pose: "cheer", face: "happy" }) + maxm(340, 356, 1.05, { pose: "cheer", face: "happy", flip: true })
      + place(O.table(130), 222, 392) + place(O.tray(3), 222, 332, 1.2) + S.steam(200, 290, 0.7) + S.steam(244, 290, 0.7),
    () => kitchen() + maxm(130, 356, 1.15, { pose: "hold", face: "happy" }) + place(O.muffin(), 130, 332, 1.2)
      + mia(300, 356, 1.15, { pose: "hold", face: "happy", flip: true }) + place(O.muffin("#c98441"), 300, 334, 1.2)
      + K.dots([[150, 370, "#e8a85a"], [284, 372, "#e8a85a"], [200, 380, "#e8a85a"]]),
    () => kitchen("night") + maxm(140, 356, 1.15, { pose: "point", face: "grin" }) + place(O.table(90), 250, 392, 0.9) + place(O.muffin(), 250, 344, 1.1)
      + mia(350, 356, 1.1, { face: "grin", flip: true }),
    () => nightOut() + molly(290, 362, 1.25, { pose: "hold", face: "happy" }) + place(O.muffin(), 290, 330, 1.2)
      + maxm(130, 364, 1.0, { pose: "wave", face: "grin" }) + S.hearts([[290, 200], [250, 220, 0.5]]) + S.fireflies([[60, 250], [380, 230], [200, 290]]),
    () => nightOut() + molly(220, 344, 1.0, { face: "happy" }) + place(O.table(170), 220, 398, 1.1) + place(O.tray(3), 200, 338, 1.1) + place(O.milk(), 270, 338, 0.8)
      + mia(92, 372, 0.95, { pose: "cheer", face: "happy" }) + maxm(350, 372, 0.95, { face: "happy", flip: true }) + S.fireflies([[50, 250], [390, 240], [160, 220]]),
  ],
};

// ── N: Ned Needs a Net ──
const nora = (x, y, s, o = {}) => put((q) => A.newt({ flower: true, ...q }), x, y, s, o);
const ned = (x, y, s, o = {}) => put((q) => A.newt({ color: "#7cc95c", dark: "#5fae3c", ...q }), x, y, s, o);
const inNest = (x, y, s, o) => nora(x, y - 20 * s, s * 0.95, o) + place(O.nest(), x, y, s * 2.2);
const branch = (x, y, w) => L(`M${x} ${y} Q${x + w / 2} ${y - 10} ${x + w} ${y - 4}`, "#a5703f", 10);
export const N_BOOK = {
  slug: "ned-needs-a-net",
  cover: () => S.meadowBg({ ...C440, sky: "#ffd9b8", sun: [380, 80, 26] }) + place(O.nest(), 100, 414, 2.2)
    + nora(196, 404, 1.1, { pose: "wave", face: "grin" })
    + ned(290, 402, 1.35, { pose: "carry", face: "happy" }) + place(O.net(), 290, 280, 1.1),
  pages: [
    () => S.meadowBg({ mid: K.pond(350, 330, 80, 18) }) + place(O.nest(), 236, 378, 2.2) + nora(130, 362, 1.2, { pose: "wave", face: "grin" })
      + K.flower(300, 386, 1, "#ffd21c") + K.flower(56, 388, 0.9),
    () => S.meadowBg({}) + inNest(220, 382, 1.0, { face: "sleep" }) + K.zzz(262, 270, 1.3) + K.zzz(290, 240, 0.9),
    () => S.meadowBg({}) + inNest(160, 382, 1.0, { face: "wow" }) + R(318, 296, 44, 70, 6, "#a5703f") + E(340, 296, 22, 7, "#c98f4f")
      + ned(392, 368, 1.0, { pose: "point", face: "smile", flip: true }) + S.burst(316, 280, 0.6, "#ffffff") + S.sound(300, 300, 0.7, "#ffffff"),
    () => S.meadowBg({}) + inNest(120, 382, 0.95, { face: "o", look: [3, 0] })
      + ned(300, 362, 1.2, { pose: "shrug", face: "sad" }) + S.speech(320, 130, 92, 60, place(O.net(), 306, 172, 0.45) + S.qmark(340, 150, 0.6)),
    () => S.meadowBg({}) + place(O.nest(), 110, 380, 1.8) + K.bush(360, 372, 1.3) + K.bush(40, 360, 0.9)
      + nora(250, 364, 1.1, { face: "smile", look: [0, 3] }) + K.tuft(220, 388) + K.tuft(290, 390),
    () => S.meadowBg({}) + ned(270, 350, 1.1, { face: "o", look: [-2, 2] }) + place(O.log(150), 230, 380, 1.3) + K.bush(60, 368, 1),
    () => S.meadowBg({}) + place(O.log(150), 180, 380, 1.2) + ned(320, 366, 1.15, { pose: "shrug", face: "sad" }),
    () => S.meadowBg({}) + K.tree(310, 384, 2.2) + G("translate(318 266) rotate(20)", O.net())
      + nora(110, 362, 1.15, { pose: "point", face: "grin" }) + ned(186, 364, 1.0, { face: "o", look: [2, -3] }),
    () => S.meadowBg({}) + K.tree(250, 394, 2.4) + branch(250, 238, 150)
      + G("translate(372 224) rotate(35)", O.net()) + nora(330, 236, 0.8, { face: "grin", look: [3, -1] })
      + ned(120, 366, 1.05, { pose: "cheer", face: "o" }),
    () => S.meadowBg({}) + K.tree(290, 394, 2.4) + branch(290, 238, 130) + nora(350, 236, 0.8, { pose: "cheer", face: "happy" })
      + G("translate(170 238) rotate(-10)", O.net()) + L("M140 150 v24 M170 140 v24 M200 150 v24", "#ffffff", 3)
      + ned(170, 368, 1.1, { pose: "carry", face: "happy" }),
    () => S.nightSky() + K.hills(262, 312, 400, "#3f6b5a", "#335a4a") + K.ground(368, "#2e5242")
      + S.fire(300, 380, 1.2) + nora(160, 364, 1.15, { pose: "hold", face: "grin" }) + place(O.noodles(), 160, 340, 0.9) + S.steam(150, 290, 0.8),
    () => S.nightSky() + K.hills(262, 312, 400, "#3f6b5a", "#335a4a") + K.ground(368, "#2e5242") + S.fire(220, 386, 1)
      + nora(116, 366, 1.0, { pose: "hold", face: "happy" }) + place(O.noodles(), 116, 344, 0.75)
      + ned(324, 366, 1.0, { pose: "hold", face: "happy", flip: true }) + place(O.noodles(), 324, 344, 0.75)
      + S.fireflies([[60, 230], [380, 250], [220, 200], [150, 270]]),
  ],
};

// ── T: Toby's Tiny Tuba ──
const toby = (x, y, s, o = {}) => put(A.tiger, x, y, s, o);
const tia = (x, y, s, o = {}) => put(A.toucan, x, y, s, o);
const turkey = (x, y, s, o = {}) => put(A.turkey, x, y, s, o);
const toad = (x, y, s, o = {}) => put(A.toad, x, y, s, o);
const tobyTuba = (x, y, s, o = {}) => toby(x, y, s, { pose: "hold", ...o }) + place(O.tuba(0.8), x + 4 * s, y - 2 * s, s);
const NOTES = S.notes([[270, 210, 1.1, "#8a6fc4"], [312, 176, 0.9, "#ff5c5c"], [350, 214, 1, "#4db3f2"]]);
export const T_BOOK = {
  slug: "toby-tiny-tuba",
  cover: () => S.villageBg({ h: 440 }) + K.ground(400, "#7cc152", 440) + tobyTuba(190, 410, 1.45, { face: "grin" }) + NOTES + tia(350, 190, 1.4, { pose: "cheer", air: true, face: "grin" }),
  pages: [
    () => S.villageBg() + tobyTuba(190, 386, 1.3, { face: "grin" }) + K.sparkle(262, 296, 1, "#ffd21c"),
    () => S.villageBg() + toby(210, 386, 1.3, { face: "happy" }) + S.sound(252, 376, 0.6, "#ffffff") + S.sound(166, 376, 0.6, "#ffffff")
      + S.notes([[120, 230, 0.9, "#8a6fc4"], [300, 220, 0.9, "#ff5c5c"]]),
    () => S.villageBg() + tobyTuba(170, 386, 1.3, { face: "happy" }) + NOTES + S.sound(260, 250, 0.8),
    () => S.villageBg() + tobyTuba(150, 386, 1.2, { face: "o", look: [3, -2] }) + tia(330, 176, 1.4, { pose: "cheer", air: true, face: "grin" }) + S.hop(430, 120, 350, 160, 20),
    () => S.villageBg() + place(O.pole(), 330, 380, 0.9) + tia(330, 280, 0.9, { face: "happy" }) + S.sound(356, 300, 0.5)
      + tobyTuba(150, 386, 1.2, { face: "happy" }) + S.notes([[230, 220, 0.9, "#8a6fc4"], [270, 196, 0.8, "#ff5c5c"]]),
    () => S.villageBg() + R(80, 356, 280, 26, 6, "#c98f4f") + R(80, 352, 280, 8, 4, "#e8a85a") + O.bunting(80, 200, 360, 200, 10)
      + tobyTuba(180, 356, 1.1, { face: "happy" }) + tia(300, 354, 0.95, { pose: "wave", face: "grin" }) + NOTES,
    () => S.villageBg() + [60, 130, 200, 270, 340].map((x) => turkey(x + 10, 334, 0.8, { face: "smile" })).join("")
      + [95, 165, 235, 305, 375].map((x) => turkey(x, 388, 0.95, { face: "grin" })).join("") + S.notes([[40, 200, 0.9, "#8a6fc4"], [80, 170, 0.8, "#ff5c5c"]]),
    () => S.villageBg() + tobyTuba(80, 386, 0.95, { face: "happy" })
      + [[190, 360], [260, 374], [330, 358], [400, 372]].map(([x, y], i) => turkey(x, y, 0.95, { face: "happy" }) + S.sound(x + 16, y + 2, 0.4)).join("")
      + S.notes([[160, 230, 0.8, "#8a6fc4"], [240, 210, 0.9, "#ff5c5c"], [320, 240, 0.8, "#4db3f2"]]),
    () => S.villageBg() + toby(150, 420, 1.6, { pose: "hold", face: "o", look: [3, -2] }) + place(O.tuba(0.8), 160, 418, 1.6) + toad(262, 286, 0.8, { face: "smile" }),
    () => S.villageBg() + K.rock(220, 340, 1.4) + toad(220, 306, 1.3, { face: "sing" }) + S.notes([[270, 220, 1, "#8a6fc4"], [306, 190, 0.9, "#ff5c5c"]])
      + [60, 140, 300, 380].map((x) => turkey(x, 392, 0.85, { face: "smile" })).join(""),
    () => S.villageBg() + G("translate(220 386) rotate(16) scale(1.2)", A.tiger({ face: "happy" }))
      + turkey(70, 392, 0.85, { face: "happy" }) + turkey(380, 392, 0.85, { face: "happy" }) + tia(340, 190, 1.2, { pose: "cheer", air: true, face: "happy" })
      + S.starsList([[80, 200], [150, 160, 0.6], [300, 140, 0.6]]) + S.sound(90, 360, 0.5) + S.sound(398, 360, 0.5),
    () => S.villageBg() + place(O.table(140), 220, 392, 1.1) + place(O.teapot(), 220, 332) + place(O.cup(), 170, 332) + place(O.cup("#ffd98a"), 270, 332)
      + toby(86, 386, 1.1, { pose: "cheer", face: "happy" }) + tia(366, 372, 1.05, { pose: "wave", face: "grin" }) + toad(300, 330, 0.5, { face: "smile" }),
  ],
};

// ── D: Dot Digs a Pool ──
const dot = (x, y, s, o = {}) => put((q) => A.duck({ bow: true, ...q }), x, y, s, o);
const dan = (x, y, s, o = {}) => put(A.dog, x, y, s, o);
const clods = (list) => list.map(([x, y, r]) => C(x, y, r || 4, "#b07a45")).join("");
const pool = (fill = 1) => E(220, 356, 176, 40, "#a5703f") + E(220, 356, 162, 32, "#6b4a2e")
  + (fill > 0 ? E(220, 356 + (1 - fill) * 12, 162 * (0.7 + fill * 0.3), 32 * (0.6 + fill * 0.4), "#5fbfe9") + E(180, 350, 40, 5, "#8fd4f2", { opacity: fill }) : "");
export const D_BOOK = {
  slug: "dot-digs-a-pool",
  cover: () => S.meadowBg({ ...C440 }) + E(220, 396, 180, 40, "#a5703f") + E(220, 396, 166, 32, "#5fbfe9") + place(O.splash(), 220, 392, 1.4)
    + dot(170, 300, 1.2, { pose: "cheer", air: true, face: "happy" }) + dan(310, 404, 1.1, { pose: "cheer", face: "grin", flip: true }),
  pages: [
    () => S.meadowBg({}) + dot(160, 362, 1.35, { face: "grin" }) + S.bubble(320, 130, 62, E(320, 150, 42, 12, "#5fbfe9") + place(O.splash(), 320, 150, 0.6) + G("translate(320 118) rotate(180) scale(.35)", A.duck({ air: true })), [-1, 1]),
    () => S.meadowBg({}) + place(O.hole(60), 270, 380) + place(O.dirt(), 344, 380, 1.1) + place(O.shovel(), 236, 372, 1.1)
      + dot(160, 364, 1.2, { pose: "cheer", face: "happy" }) + clods([[300, 300], [320, 280, 3], [280, 290, 3]]),
    () => S.meadowBg({}) + place(O.hole(70), 220, 384) + dot(120, 364, 1.1, { pose: "wave", face: "grin" })
      + dan(340, 366, 1.15, { run: true, face: "grin", flip: true }) + K.motion(410, 320, 0.8),
    () => S.meadowBg({}) + place(O.hole(110), 220, 384, 1.1) + place(O.dirt(), 90, 386, 1.2) + place(O.dirt(), 356, 386, 1.2)
      + dot(120, 362, 1.0, { face: "effort" }) + dan(320, 364, 1.1, { pose: "cheer", face: "happy", flip: true })
      + place(O.puff(), 200, 330, 1.5) + place(O.puff(), 250, 320, 1.2) + clods([[180, 300], [260, 290, 3], [230, 270, 3]]),
    () => S.meadowBg({}) + pool(0) + place(O.dirt(), 40, 350, 1.4) + place(O.dirt(), 400, 350, 1.4)
      + dot(110, 330, 0.95, { face: "o", look: [2, 2] }) + dan(330, 332, 1.0, { face: "o", look: [-2, 2], flip: true }),
    () => S.meadowBg({ sky: "#cfdbe7", sun: false, clouds: [] }) + K.rainCloud(90, 70, 1.2) + K.rainCloud(300, 50, 1.4) + K.rain(20, 110, 420, 300, 26)
      + pool(0) + dot(120, 330, 1.05, { pose: "cheer", face: "happy" }) + dan(330, 332, 1.05, { face: "o", flip: true }),
    () => S.meadowBg({ sky: "#d6e2ec", sun: false, clouds: [] }) + K.rainCloud(120, 60, 1.1) + K.rainCloud(320, 70, 1) + K.rain(40, 100, 400, 280, 14, "#6aa9d8", 7)
      + pool(0.6) + S.ripple(180, 356, 18) + S.ripple(270, 350, 12),
    () => S.meadowBg({}) + pool(1) + dot(150, 326, 1.1, { pose: "cheer", face: "happy" }) + dan(330, 330, 1.0, { face: "grin", flip: true })
      + S.starsList([[220, 300, 0.6], [300, 290, 0.5]], "#ffffff"),
    () => S.meadowBg({ front: 300 }) + dot(220, 344, 1.5, { face: "happy" }) + R(0, 330, 440, 70, 0, "#5fbfe9") + E(220, 331, 70, 8, "#8fd4f2")
      + S.ripple(190, 338, 24) + S.ripple(250, 340, 24),
    () => S.meadowBg({}) + pool(1) + dot(130, 328, 1.1, { pose: "point", face: "grin" }) + dan(320, 330, 1.1, { face: "grin", flip: true }),
    () => S.meadowBg({}) + pool(1) + place(O.splash(), 220, 364, 1.6) + dot(170, 260, 1.0, { pose: "cheer", air: true, face: "happy" })
      + dan(280, 250, 1.0, { pose: "cheer", air: true, face: "happy" }),
    () => S.meadowBg({}) + E(220, 356, 190, 42, "#a5703f") + E(220, 356, 176, 34, "#5fbfe9")
      + dot(160, 364, 0.95, { face: "happy", air: true }) + dan(290, 372, 0.95, { face: "happy", air: true })
      + P("M44 360 Q220 400 396 360 L396 372 Q220 400 44 372 Z", "#5fbfe9") + S.ripple(160, 366, 26) + S.ripple(290, 372, 26),
  ],
};

// ── K: Kip's Kite ──
const kip = (x, y, s, o = {}) => put(A.kangaroo, x, y, s, o);
const cody = (x, y, s, o = {}) => put(A.cow, x, y, s, o);
const corn = (y, xs, s = 1) => xs.map((x) => place(O.cornStalk(s), x, y)).join("");
export const K_BOOK = {
  slug: "kip-kite",
  cover: () => S.meadowBg({ ...C440, sun: [70, 70, 26], clouds: [[190, 50, 0.8]] }) + place(O.kite(), 320, 150, 1.1) + O.kiteString(320, 150, 170, 316)
    + kip(160, 404, 1.4, { pose: "cheer", face: "happy" }) + cody(330, 408, 1.0, { face: "grin", flip: true }),
  pages: [
    () => S.meadowBg({}) + kip(160, 364, 1.25, { pose: "wave", face: "grin" }) + place(O.kite(), 286, 306, 1.1),
    () => K.sky("#bfe8fb") + K.cloud(80, 80, 1) + K.cloud(340, 300, 0.9) + place(O.kite(), 220, 200, 2.2) + K.sparkle(120, 160, 1.2, "#ffd21c") + K.sparkle(320, 110, 1, "#ffd21c"),
    () => K.sky("#bfe8fb") + K.sun(380, 60, 24) + K.cloud(90, 70, 0.9) + P("M0 400 L0 330 Q220 190 440 250 L440 400 Z", "#8fd06a") + P("M0 400 L0 360 Q220 270 440 300 L440 400 Z", "#7cc152")
      + S.hop(120, 330, 250, 250, 50) + kip(250, 250, 1.1, { pose: "hold", air: true, face: "happy" }) + place(O.kite(), 284, 244, 0.5),
    () => S.meadowBg({ sun: [70, 64, 24], clouds: [[190, 50, 0.8], [330, 190, 0.6]] }) + S.wind(40, 120, 1) + S.wind(200, 70, 0.8) + place(O.kite(), 310, 160, 1.1) + O.kiteString(310, 160, 170, 324)
      + kip(150, 364, 1.2, { pose: "reach", face: "o" }),
    () => K.sky("#bfe8fb") + K.cloud(80, 90, 1) + K.cloud(280, 200, 0.9) + K.cloud(360, 60, 0.6) + place(O.kite(), 330, 100, 0.9)
      + O.kiteString(330, 100, 136, 332) + K.hills(330, 360) + kip(130, 392, 0.8, { pose: "cheer", face: "happy" }),
    () => S.meadowBg({ sun: [70, 64, 24], clouds: [[190, 50, 0.8], [330, 190, 0.6]] }) + place(O.kite(), 350, 110, 0.8) + O.kiteString(350, 110, 150, 326) + kip(130, 364, 1.05, { pose: "reach", face: "grin" })
      + cody(310, 368, 1.1, { face: "grin", flip: true }),
    () => S.meadowBg({ sun: [70, 64, 24], clouds: [[190, 50, 0.8], [330, 190, 0.6]] }) + place(O.kite(), 360, 100, 0.7) + O.kiteString(360, 100, 160, 330) + kip(130, 364, 1.1, { pose: "reach", face: "grin" })
      + cody(300, 366, 1.15, { pose: "point", face: "grin", flip: true }),
    () => S.meadowBg({ sun: [70, 64, 24], clouds: [[190, 50, 0.8], [330, 190, 0.6]] }) + S.wind(30, 110, 1) + S.wind(180, 170, 0.9) + place(O.kite(), 370, 90, 0.8) + O.kiteString(370, 90, 250, 320)
      + cody(220, 366, 1.2, { pose: "reach", face: "o" }) + kip(80, 364, 0.95, { face: "o", look: [3, -1] }),
    () => K.sky("#bfe8fb") + K.cloud(60, 60, 0.9) + K.cloud(380, 160, 0.8) + place(O.kite(), 310, 80, 0.8) + O.kiteString(310, 80, 200, 150)
      + cody(200, 250, 1.0, { pose: "carry", air: true, face: "wow" }) + K.hills(340, 370) + kip(96, 396, 0.9, { pose: "cheer", face: "wow" }),
    () => K.sky("#bfe8fb") + K.cloud(80, 70, 0.9) + place(O.kite(), 350, 70, 0.7) + O.kiteString(350, 70, 262, 118)
      + cody(262, 216, 0.95, { pose: "carry", air: true, face: "grin" }) + K.ground(340, "#8fd06a") + corn(400, [230, 270, 310, 350, 390, 430], 0.9)
      + kip(90, 384, 1.0, { pose: "cheer", face: "grin" }) + S.sound(136, 270, 0.8),
    () => K.sky("#bfe8fb") + K.sun(370, 60, 24) + K.ground(300, "#8fd06a") + corn(330, [20, 70, 120, 170, 270, 320, 370, 420], 1)
      + cody(220, 380, 1.1, { face: "happy" }) + corn(404, [40, 100, 160, 280, 340, 400], 1.1) + place(O.kite(), 350, 260, 0.6)
      + S.starsList([[190, 210, 0.5], [250, 200, 0.5], [220, 190, 0.4]]),
    () => S.meadowBg({}) + kip(140, 364, 1.15, { pose: "reach", face: "grin" }) + place(O.carrot(), 176, 324, 1.2)
      + cody(300, 366, 1.15, { face: "happy", flip: true }) + S.hearts([[230, 220]]) + G("translate(400 380) rotate(40) scale(.6)", O.kite()),
  ],
};

// ── G: Goldie's Guitar ──
const goldie = (x, y, s, o = {}) => put((q) => A.goose({ bow: true, ...q }), x, y, s, o);
const gus = (x, y, s, o = {}) => put(A.goat, x, y, s, o);
const garden = (o = {}) => S.meadowBg({ ...o }) + K.fence(o.fenceY ?? 332) + K.flower(40, 348, 0.9) + K.flower(80, 350, 0.8, "#ffd21c")
  + K.flower(380, 350, 0.9, "#9b7fd8") + K.flower(410, 346, 0.8);
const gtr = (x, y, s) => place(O.guitar(), x, y, s);
const scribble = (x, y) => L(`M${x} ${y} l8 -10 l6 12 l8 -14 l6 10 l8 -12`, "#9aa7b8", 3);
export const G_BOOK = {
  slug: "goldie-guitar",
  cover: () => garden({ ...C440, fenceY: 362 }) + goldie(170, 404, 1.45, { pose: "hold", face: "happy" }) + gtr(186, 386, 1.1)
    + gus(330, 404, 1.1, { face: "grin", flip: true }) + S.notes([[260, 230, 1, "#8a6fc4"], [300, 196, 0.9, "#ff5c5c"]]),
  pages: [
    () => S.meadowBg({}) + goldie(160, 364, 1.3, { face: "wow" }) + place(O.gift(), 286, 372, 1.5),
    () => S.meadowBg({}) + place(O.gift("#9b7fd8", "#ffd21c", true), 286, 372, 1.5) + gtr(300, 330, 1.2)
      + S.starsList([[250, 220], [350, 240, 0.7], [300, 190, 0.6]]) + goldie(140, 364, 1.2, { pose: "cheer", face: "happy" }),
    () => garden() + goldie(220, 372, 1.2, { face: "grin" }) + gtr(262, 350, 0.9) + K.flower(150, 390, 1) + K.flower(300, 392, 1, "#ffd21c"),
    () => garden() + goldie(210, 372, 1.3, { pose: "hold", face: "happy" }) + gtr(220, 358, 1.05) + S.notes([[290, 220, 1, "#8a6fc4"], [330, 190, 0.9, "#ff5c5c"]]),
    () => garden() + gus(310, 356, 1.1, { face: "grin" }) + place(O.gate(), 310, 356, 1.4) + goldie(120, 370, 1.1, { face: "smile", look: [3, 0] }) + gtr(146, 352, 0.8),
    () => garden() + gus(310, 370, 1.2, { pose: "point", face: "grin", flip: true }) + goldie(140, 370, 1.2, { pose: "hold", face: "smile" }) + gtr(150, 356, 0.95),
    () => garden() + gus(230, 372, 1.3, { pose: "hold", face: "grin" }) + gtr(240, 360, 1.05) + goldie(90, 370, 1.0, { face: "smile", look: [3, 0] }),
    () => garden() + gus(230, 372, 1.3, { pose: "hold", face: "effort" }) + gtr(240, 360, 1.05) + scribble(270, 220) + scribble(300, 250) + scribble(250, 190)
      + goldie(90, 370, 1.0, { pose: "carry", face: "worried" }),
    () => garden() + gus(250, 372, 1.25, { pose: "hold", face: "o" }) + gtr(260, 360, 1.0) + goldie(110, 370, 1.1, { pose: "point", face: "grin" }),
    () => garden() + gus(230, 372, 1.3, { pose: "hold", face: "happy" }) + gtr(240, 360, 1.05)
      + S.notes([[300, 230, 1, "#8a6fc4"], [340, 196, 0.9, "#ff5c5c"], [180, 210, 0.9, "#4db3f2"]]) + goldie(90, 370, 1.0, { pose: "cheer", face: "happy" }),
    () => garden({ fenceY: 300 }) + goldie(190, 330, 0.8, { face: "happy" }) + gus(250, 330, 0.8, { pose: "hold", face: "happy" }) + gtr(256, 322, 0.62)
      + [[70, 386], [150, 398], [300, 398], [380, 388]].map(([x, y]) => put(A.gopher, x, y, 1.2, { face: "grin" })).join("") + S.notes([[220, 200, 0.9, "#8a6fc4"]]),
    () => garden() + O.bunting(0, 30, 440, 30, 12) + goldie(140, 366, 1.1, { pose: "cheer", face: "grin" }) + gus(296, 366, 1.1, { pose: "hold", face: "happy" }) + gtr(304, 354, 0.9)
      + put(A.gopher, 50, 398, 1.1, { face: "happy" }) + put(A.gopher, 396, 398, 1.1, { face: "happy" })
      + S.notes([[220, 200, 1, "#8a6fc4"], [250, 170, 0.9, "#ff5c5c"]]) + S.starsList([[90, 220, 0.6], [370, 210, 0.6]]),
  ],
};

// ── F: Finn Finds a Feather ──
const finn = (x, y, s, o = {}) => put(A.fish, x, y, s, o);
const fay = (x, y, s, o = {}) => put(A.fox, x, y, s, o);
const fea = (x, y, s = 1, a = 0) => G(`translate(${x} ${y}) rotate(${a}) scale(${s})`, O.feather());
export const F_BOOK = {
  slug: "finn-finds-a-feather",
  cover: () => S.seaBg({ h: 440 }) + S.kelp(40, 400, 1.2) + S.kelp(400, 404, 1) + place(K.rock(0, 0, 1), 320, 394, 2)
    + finn(190, 220, 2.2, { face: "grin" }) + fea(300, 230, 1.3, 20) + S.bubblesUp([[250, 150], [262, 128, 4], [120, 120, 6]]),
  pages: [
    () => S.seaBg() + S.kelp(40, 370) + S.kelp(410, 372, 1.2) + place(K.rock(0, 0, 1), 310, 360, 3) + finn(150, 210, 1.6, { face: "grin" })
      + S.bubblesUp([[200, 170], [212, 150, 4], [220, 128, 3]]),
    () => S.seaBg() + S.kelp(390, 370, 1.1) + K.motion(90, 200, 1.2, "#dff4ff") + finn(250, 200, 1.7, { face: "happy" }) + S.bubblesUp([[140, 220], [120, 180, 4]]),
    () => S.seaBg() + S.kelp(40, 370) + L("M300 20 q-20 40 0 70 q20 30 -10 60", "#dff4ff", 2.5, { "stroke-dasharray": "3 8" }) + fea(290, 190, 1.3, 30)
      + finn(140, 250, 1.5, { face: "o", look: [2, 0] }),
    () => S.seaBg() + S.kelp(410, 370, 1.1) + finn(160, 230, 1.6, { face: "smile" }) + fea(270, 260, 1.1, 20) + S.speech(250, 110, 70, 52, S.qmark(250, 116, 1)),
    () => S.seaBg() + S.kelp(60, 372, 1.2) + S.kelp(150, 376) + S.kelp(360, 372, 1.1) + K.motion(90, 190, 1, "#dff4ff")
      + finn(240, 200, 1.5, { face: "grin" }) + fea(300, 212, 0.8, 70) + S.bubblesUp([[150, 160], [130, 140, 4], [120, 110, 3]]),
    () => S.shoreBg({ waterY: 220, groundY: 300 })
      + P("M230 300 Q300 250 440 262 L440 400 L260 400 Q220 340 230 300 Z", "#7cc152") + finn(120, 290, 1.2, { face: "grin" }) + S.ripple(120, 310, 40)
      + fea(180, 272, 0.7, 60) + fay(340, 368, 1.2, { face: "grin", flip: true }),
    () => S.shoreBg({ waterY: 220, groundY: 300 }) + P("M230 300 Q300 250 440 262 L440 400 L260 400 Q220 340 230 300 Z", "#7cc152")
      + finn(120, 290, 1.2, { face: "o", look: [2, 0] }) + S.ripple(120, 310, 40) + fea(180, 272, 0.7, 60) + fay(340, 368, 1.2, { pose: "shrug", face: "smile", flip: true }),
    () => S.shoreBg({ waterY: 200, groundY: 430 }) + put((q) => A.duck({ color: "#f7f3ee", wingC: "#e6ded2", ...q }), 220, 290, 1.1, { air: true, face: "smile" })
      + [300, 340, 380].map((x, i) => put(A.duck, x, 300 + (i % 2) * 6, 0.6, { air: true, face: "grin" })).join("")
      + S.ripple(220, 292, 34) + S.ripple(340, 302, 50) + finn(90, 330, 1.1, { face: "smile", look: [2, -2] }) + fea(140, 318, 0.6, 60),
    () => S.shoreBg({ waterY: 200, groundY: 430 }) + put((q) => A.duck({ color: "#f7f3ee", wingC: "#e6ded2", ...q }), 220, 290, 1.1, { air: true, face: "sad" })
      + [300, 340, 380].map((x, i) => put(A.duck, x, 300 + (i % 2) * 6, 0.6, { air: true, face: "sad" })).join("")
      + S.ripple(220, 292, 34) + S.ripple(340, 302, 50) + finn(90, 330, 1.1, { face: "sad" }) + fea(140, 318, 0.6, 60),
    () => K.sky("#bfe8fb") + K.cloud(70, 70, 0.9) + K.cloud(330, 50, 0.8) + R(0, 280, 440, 120, 0, "#5fbfe9") + K.waves([[60, 300], [300, 320]])
      + put(A.gull, 250, 190, 1.4, { pose: "cheer", air: true, gap: true, face: "o" }) + finn(120, 330, 1.2, { face: "o", look: [2, -3] }) + fea(170, 316, 0.6, 60),
    () => K.sky("#bfe8fb") + K.sun(370, 60, 24) + R(0, 260, 440, 140, 0, "#5fbfe9") + K.waves([[40, 290], [320, 330]]) + place(K.rock(0, 0, 1), 280, 300, 2.2)
      + put(A.gull, 280, 276, 1.2, { face: "happy" }) + finn(120, 330, 1.2, { face: "grin" }) + S.hearts([[200, 220], [240, 190, 0.6]]),
    () => S.seaBg() + S.kelp(40, 372) + S.kelp(400, 370, 1.2) + L("M120 140 q60 -60 120 0 q60 60 120 0", "#dff4ff", 2.5, { "stroke-dasharray": "3 8" })
      + finn(220, 220, 1.6, { face: "happy" }) + S.starsList([[100, 260, 0.6], [340, 250, 0.6], [220, 120, 0.5]], "#fff1b8") + S.bubblesUp([[160, 170], [300, 160, 4]]),
  ],
};

export const BOOKS1 = [P_BOOK, B_BOOK, M_BOOK, N_BOOK, T_BOOK, D_BOOK, K_BOOK, G_BOOK, F_BOOK];
