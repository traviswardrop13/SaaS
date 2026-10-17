// Remaining generated scenes for ages3–4. Custom playable games keep their
// own controllers and are absent here so regeneration cannot replace them.
import { C, E, R, P, L, G, at, W, sky, sun, cloud, hills, ground, star, heart, sparkle, house, tree, fence, flower, face, zzz, note } from "../bookart/kit.mjs";
import { meadowBg, SKY, starsList, bubblesUp, kelp } from "../bookart/scene.mjs";
import { bunting } from "../bookart/props.mjs";
import * as cast from "../bookart/cast.mjs";
import * as A from "./art.mjs";

const put = (fn, x, y, s = 1, o = {}) => G(at(x, y, s, !!o.flip), fn(o));
const sparkles = (list, c = "#ffd21c") => list.map(([x, y, s]) => sparkle(x, y, s || 1, c)).join("");

// Balloon Party is now the hand-built pump-and-guide game in public/balloon.js.

// Grow a Flower is now the hand-built watering game in public/flower.js.

// Rocket Blast is now the hand-built pull-and-release game in public/rocket.js.

// Build a Snowman is now the hand-built rolling-and-stacking game in public/snowman.js.

// ── 9. Surprise Boxes: every word opens a present, and a friend pops out ──
// Two presents on the shelf and three on the floor, opened in a zigzag.
const GIFT_AT = [[84, 386, 118, 92], [132, 214, 98, 76], [220, 386, 118, 92], [308, 214, 98, 76], [356, 386, 118, 92]];
const BOXES = [["#ff8fb0", "#ffffff"], ["#4db3f2", "#ffd21c"], ["#58cc02", "#ffffff"], ["#9b7fd8", "#ffd21c"], ["#ff9d3d", "#ffffff"]];
// each friend's head sits `hy` above its feet; s is how big it pops out
const PALS = [
  { fn: () => cast.chick({ pose: "cheer", face: "grin" }), s: 1.7, hy: 24 },
  { fn: () => cast.rabbit({ pose: "cheer", face: "grin" }), s: 0.78, hy: 66 },
  { fn: () => cast.dog({ pose: "cheer", face: "grin" }), s: 0.85, hy: 66 },
  { fn: () => cast.toad({ face: "sing" }), s: 1.3, hy: 34 },
  { fn: () => cast.penguin({ pose: "cheer", face: "grin" }), s: 0.85, hy: 64 },
];
const giftsGame = {
  key: "gifts", title: "Surprise Boxes", group: "simple", top: "#fff6e9", bottom: "#ffe1c4",
  sub: "Say it to open a present", playDescription: "Every word opens a present. Who is inside?",
  how: "Say each word to open a present.", blurb: "Every word pops the lid off a present, and a friend jumps out.",
  alt: "Five wrapped presents, two on a shelf and three on the floor.",
  bg: R(0, 0, W, 300, 0, "#e3f2fb") + L("M0 50 H440 M0 130 H440", "#d4ebf8", 6) + R(0, 292, W, 8, 0, "#c9e2f2")
    + R(0, 300, W, 100, 0, "#e8b98a") + L("M0 340 H440 M0 376 H440", "#d9a877", 3)
    + R(170, 26, 100, 80, 10, "#ffffff") + R(178, 34, 84, 64, 7, "#bfe8fb") + L("M220 34 V98 M178 66 H262", "#ffffff", 5)
    + R(56, 214, 328, 14, 5, "#c98f4f") + R(70, 228, 10, 22, 3, "#a5703f") + R(360, 228, 10, 22, 3, "#a5703f")
    + E(220, 384, 214, 18, "#ff8fb0", { opacity: 0.45 }),
  parts: [
    ...GIFT_AT.map(([x, y, w, h], i) => ({ id: "pal" + (i + 1), x, y: y - h - 34 + PALS[i].hy * PALS[i].s, hid: true, svg: G(`scale(${PALS[i].s})`, PALS[i].fn()) })),
    ...GIFT_AT.map(([x, y, w, h], i) => ({ id: "lid" + (i + 1), x, y: y - h + 2, svg: A.boxLid(...BOXES[i], w) })),
    { id: "hearts", x: 0, y: 0, hid: true, svg: heart(110, 150, 1.5) + heart(220, 130, 1.8, "#ff8fb0") + heart(330, 150, 1.5) + heart(170, 70, 1.1, "#ffd21c") + heart(280, 64, 1.1, "#9b7fd8") },
  ],
  fg: GIFT_AT.map(([x, y, w, h], i) => G(`translate(${x} ${y})`, A.boxBody(...BOXES[i], w, h))).join(""),
  steps: GIFT_AT.map((g, i) => [
    { a: "move", id: "lid" + (i + 1), x: i < 2 ? -18 : 18, y: -90, r: i < 2 ? -30 : 30 }, { a: "hide", id: "lid" + (i + 1), at: 450 },
    { a: "show", id: "pal" + (i + 1), fx: "rise", at: 200 },
  ]),
  finale: [
    ...GIFT_AT.map((g, i) => ({ a: "fx", id: "pal" + (i + 1), fx: "hop", at: i * 120 })),
    { a: "show", id: "hearts", fx: "pop", at: 300 }, { a: "fx", id: "hearts", fx: "float", at: 900 },
  ],
  done: { title: "Surprise!", sub: "Five friends came out to play." },
};

// ── 10. Fish Tank: every word brings a new fish; then they all swim together ──
const tankGame = {
  key: "fishtank", title: "Fish Tank", group: "simple", top: "#e6f6ff", bottom: "#cdeefa",
  sub: "Say it to add a fish", playDescription: "Every word brings a new fish to the tank.",
  how: "Say each word to bring a fish to the tank.", blurb: "Every word brings a new friend into the tank; then they all swim together.",
  alt: "An empty fish tank with sand, seaweed and a little castle.",
  bg: R(0, 0, W, 400, 0, "#5bb5e3") + R(0, 0, W, 60, 0, "#8fd4f2") + L("M0 60 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0", "#ffffff", 3, { opacity: 0.7 })
    + P("M0 342 Q110 326 220 340 Q330 354 440 334 L440 400 L0 400 Z", "#f0d9a8") + C(90, 366, 3, "#e0c48a") + C(300, 378, 3, "#e0c48a") + C(190, 386, 2.5, "#e0c48a")
    + kelp(34, 356, 1.1) + kelp(408, 350, 1.3) + kelp(380, 360, 0.8, "#58b77a") + A.castle(262, 362, 0.9)
    + bubblesUp([[60, 140], [70, 110, 4], [380, 190], [390, 160, 4], [220, 80, 3]]),
  parts: [
    { id: "f1", x: 118, y: 128, hid: true, svg: G("scale(1.55)", cast.fish({ color: "#ff8a3d", fin: "#ffb100", face: "grin" })) },
    { id: "f2", x: 326, y: 150, hid: true, svg: G("scale(-1.4 1.4)", cast.fish({ color: "#4db3f2", fin: "#9b7fd8", face: "smile" })) },
    { id: "f3", x: 196, y: 236, hid: true, svg: G("scale(1.55)", A.puffer()) },
    { id: "f4", x: 76, y: 318, hid: true, svg: G("scale(1.25)", cast.seahorse()) },
    { id: "f5", x: 356, y: 272, hid: true, svg: G("scale(-1.3 1.3)", cast.fish({ color: "#ff8fb0", fin: "#ff5c8a", face: "o" })) },
    { id: "bubs", x: 0, y: 0, hid: true, svg: bubblesUp([[140, 90, 6], [150, 60, 4], [260, 120, 5], [270, 90, 3], [350, 60, 5]]) },
    { id: "starfish", x: 158, y: 356, hid: true, svg: G("scale(1.2)", A.starfishFriend()) },
  ],
  steps: [
    [{ a: "show", id: "f1", fx: "slideL" }],
    [{ a: "show", id: "f2", fx: "slideR" }],
    [{ a: "show", id: "f3", fx: "rise" }],
    [{ a: "show", id: "f4", fx: "slideL" }],
    [{ a: "show", id: "f5", fx: "slideR" }, { a: "show", id: "starfish", fx: "pop", at: 500 }],
  ],
  finale: [
    { a: "fx", id: "f1", fx: "swim" }, { a: "fx", id: "f2", fx: "swim", at: 300 }, { a: "fx", id: "f3", fx: "float", at: 150 },
    { a: "fx", id: "f4", fx: "float", at: 450 }, { a: "fx", id: "f5", fx: "swim", at: 600 }, { a: "fx", id: "starfish", fx: "wiggle", at: 200 },
    { a: "show", id: "bubs", fx: "rise", at: 100 }, { a: "fx", id: "bubs", fx: "float", at: 800 },
  ],
  done: { title: "What a happy fish tank!", sub: "Five fish came to swim." },
};

export const LITTLE = [ giftsGame, tankGame];
