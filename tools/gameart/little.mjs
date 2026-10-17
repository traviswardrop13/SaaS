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

// Surprise Boxes is now the hand-built unwrapping game in public/gifts.js.

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

export const LITTLE = [tankGame];
