// Remaining generated Say & Play scenes for ages5–8. Hand-built playable
// games live in public/arcade-<key>.html plus their own controllers; they
// are deliberately absent here so regeneration cannot overwrite them.
import { C, E, R, P, L, G, at, W, sky, sun, cloud, hills, star, heart, sparkle, note, face } from "../bookart/kit.mjs";
import { meadowBg, starsList } from "../bookart/scene.mjs";
import * as cast from "../bookart/cast.mjs";
import * as A from "./art.mjs";

const sparkles = (list, c = "#ffd21c") => list.map(([x, y, s]) => sparkle(x, y, s || 1, c)).join("");
const range = (n) => Array.from({ length: n }, (_, i) => i);

// Race Car is now hand-built in public/racecar.js; never regenerate its page.

// Treasure Map is now the hand-built route puzzle in public/treasure.js.

// Robot Builder is now the hand-built circuit puzzle in public/robot.js.

// Castle Builder is now a hand-built crane game in public/castle.js.

// ── 8. Space Trip: every word flies to the next planet and picks up its star ──
const PLANETS = [[104, 312, 22, "#ff8f8f"], [200, 346, 18, "#8fd4f2"], [298, 306, 24, "#ffd21c", "#ff9d3d"], [390, 336, 17, "#b9d98a"],
  [374, 216, 22, "#c49cff", null, "#ffd21c"], [262, 200, 20, "#ff9d3d"], [146, 188, 24, "#4db3f2", "#6ac3f2"], [340, 110, 30, "#58cc02", "#8fd4f2"]];
const EARTH = [44, 392];
const spaceGame = {
  key: "space", title: "Space Trip", group: "arcade", top: "#e9e4ff", bottom: "#d8d2f5",
  sub: "Say it to fly to a planet", playDescription: "Every word flies your rocket to the next planet.",
  how: "Say each word to fly to the next planet.", blurb: "Every word flies the rocket to the next planet, where it picks up a star.",
  alt: "Space, full of stars and planets, with a little rocket ready to fly.",
  bg: R(0, 0, W, 400, 0, "#252b57") + R(0, 0, W, 180, 0, "#2d3470")
    + starsList([[30, 60, 0.35], [80, 150, 0.3], [330, 70, 0.4], [420, 130, 0.3], [180, 40, 0.3], [400, 280, 0.3], [30, 250, 0.35], [320, 380, 0.3], [150, 280, 0.25], [230, 240, 0.25]], "#c9d0f0")
    + R(12, 8, 240, 32, 16, "#1c2147") + range(8).map((i) => G(`translate(${34 + i * 28} 24) scale(0.55)`, A.dimStar())).join("")
    + G(`translate(${EARTH[0]} ${EARTH[1]})`, C(0, 0, 60, "#4db3f2") + P("M-40 -30 Q-20 -50 0 -40 Q10 -20 -10 -10 Q-30 0 -40 -30 Z M10 -58 Q30 -50 34 -34 Q20 -30 10 -58 Z", "#58cc02"))
    + PLANETS.map(([x, y, r, c, band, ring]) => G(`translate(${x} ${y})`, A.planet(r, c, ring, band))).join(""),
  parts: [
    ...PLANETS.map(([x, y, r], i) => ({ id: "ps" + (i + 1), x, y: y - r - 14, svg: star(0, 0, 0.9, "#ffd21c") })),
    ...range(8).map((i) => ({ id: "got" + (i + 1), x: 34 + i * 28, y: 24, hid: true, svg: star(0, 0, 1.1, "#ffd21c") })),
    { id: "flag", x: 358, y: 84, hid: true, o: "50% 100%", svg: R(-2, -40, 4, 40, 2, "#e3e8ee") + P("M2 -40 L30 -32 L2 -24 Z", "#ff5c5c") },
    { id: "ship", x: EARTH[0] + 20, y: EARTH[1] - 60, svg: G("scale(0.34)", A.rocket({ pilot: A.pilotBear() })) },
  ],
  steps: PLANETS.map(([x, y, r], i) => [
    { a: "move", id: "ship", x: x - (EARTH[0] + 20) + (i === 7 ? -20 : 0), y: y - r + 4 - (EARTH[1] - 60), r: 0 }, { a: "hide", id: "ps" + (i + 1), at: 600 },
    { a: "show", id: "got" + (i + 1), fx: "pop", at: 650 },
  ]),
  finale: [
    { a: "fx", id: "ship", fx: "spin" }, { a: "show", id: "flag", fx: "grow", at: 700 },
    ...range(8).map((i) => ({ a: "fx", id: "got" + (i + 1), fx: "twinkle", at: 300 + i * 90 })),
  ],
  done: { title: "What a space trip!", sub: "Eight words flew you across the stars." },
};

// Pizza Chef is now a hand-built cooking game in public/pizza.js.

// ── 10. Monster Makeover: every word gives the monster a silly new part ──
const MON = [220, 368];
const MONSTER = ["body", "eyes0", "mouth0", "eyes", "horns", "spots", "grin", "arms", "shoes", "bow", "crown"];
const monsterGame = {
  key: "monster", title: "Monster Makeover", group: "arcade", top: "#f3e9ff", bottom: "#e4d4fb",
  sub: "Say it to dress up the monster", playDescription: "Every word gives the monster a silly new look.",
  how: "Say each word to give the monster a makeover.", blurb: "Every word gives Moe the monster something silly: three eyes, horns, spots, a grin, arms, shoes, a bow tie and a crown.",
  alt: "A plain, friendly monster standing in a purple room.",
  bg: R(0, 0, W, 330, 0, "#d9c4f5") + range(8).map((r) => range(9).map((c) => C(24 + c * 50 + (r % 2) * 25, 24 + r * 44, 5, "#cbb2ef")).join("")).join("")
    + R(0, 330, W, 70, 0, "#b48be0") + E(MON[0], 384, 150, 16, "#ff8fb0", { opacity: 0.55 }),
  parts: [
    { id: "arms", x: MON[0], y: MON[1], hid: true, svg: A.monsterArms() },
    { id: "body", x: MON[0], y: MON[1], svg: A.monsterBody() },
    { id: "horns", x: MON[0], y: MON[1], hid: true, o: "50% 100%", svg: A.horns() },
    { id: "spots", x: MON[0], y: MON[1], hid: true, svg: A.monsterSpots() },
    { id: "eyes0", x: MON[0], y: MON[1], svg: A.smallEyes() },
    { id: "mouth0", x: MON[0], y: MON[1], svg: A.smallMouth() },
    { id: "eyes", x: MON[0], y: MON[1], hid: true, svg: A.bigEyes() },
    { id: "grin", x: MON[0], y: MON[1], hid: true, svg: A.toothyGrin() },
    { id: "shoes", x: MON[0], y: MON[1] + 6, hid: true, svg: A.sneakers() },
    { id: "bow", x: MON[0], y: MON[1] - 46, hid: true, svg: A.bowTie() },
    { id: "crown", x: MON[0], y: MON[1] - 172, hid: true, svg: A.crown() },
    { id: "hearts", x: 0, y: 0, hid: true, svg: heart(70, 120, 1.6) + heart(372, 100, 1.4, "#ff8fb0") + heart(400, 220, 1.2, "#ffd21c") + heart(50, 240, 1.1, "#4db3f2") },
  ],
  steps: [
    [{ a: "hide", id: "eyes0" }, { a: "show", id: "eyes", fx: "pop" }],
    [{ a: "show", id: "horns", fx: "grow" }],
    [{ a: "show", id: "spots", fx: "pop" }],
    [{ a: "hide", id: "mouth0" }, { a: "show", id: "grin", fx: "pop" }],
    [{ a: "show", id: "arms", fx: "pop" }],
    [{ a: "show", id: "shoes", fx: "drop" }],
    [{ a: "show", id: "bow", fx: "pop" }],
    [{ a: "show", id: "crown", fx: "drop" }],
  ].map((s) => s.concat([{ a: "fx", id: "body", fx: "wiggle", at: 250 }])),
  finale: [...MONSTER.map((id) => ({ a: "fx", id, fx: "hop" })), { a: "show", id: "hearts", fx: "pop", at: 300 }, { a: "fx", id: "hearts", fx: "float", at: 900 }],
  done: { title: "What a silly monster!", sub: "Eight words gave Moe a whole new look." },
};

export const BIG = [ spaceGame, monsterGame];
