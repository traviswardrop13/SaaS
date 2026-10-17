// Seven of the ten Say & Play games for ages 5-8: eight words a game and a goal
// to reach (the finish line, the treasure, the last planet). No timer, no score
// to lose, and nothing to aim at: every word the child says moves them on. The
// other three, Hoops, Soccer Goal and Dino Dig, are played rather than built,
// so they are written by hand (public/arcade-<key>.html with hoops.js,
// soccer.js and dino.js) and have no scene here.
import { C, E, R, P, L, G, at, W, sky, sun, cloud, hills, star, heart, sparkle, note, face } from "../bookart/kit.mjs";
import { meadowBg, starsList } from "../bookart/scene.mjs";
import * as cast from "../bookart/cast.mjs";
import * as A from "./art.mjs";

const sparkles = (list, c = "#ffd21c") => list.map(([x, y, s]) => sparkle(x, y, s || 1, c)).join("");
const range = (n) => Array.from({ length: n }, (_, i) => i);

// Race Car is now hand-built in public/racecar.js; never regenerate its page.

// Treasure Map is now the hand-built route puzzle in public/treasure.js.

// ── 5. Robot Builder: every word adds a part; then the robot dances ──
const ROBOT = ["legs", "body", "armL", "armR", "head", "eyes", "antenna", "heart"];
const robotGame = {
  key: "robot", title: "Robot Builder", group: "arcade", top: "#eef3f8", bottom: "#dde6ee",
  sub: "Say it to build a robot", playDescription: "Every word adds a new part to your robot.",
  how: "Say each word to build a robot.", blurb: "Every word adds a robot part: legs, body, arms, head, eyes, antenna and a heart; then it dances.",
  alt: "A workshop with a build platform, tools and gears.",
  bg: R(0, 0, W, 320, 0, "#e3ecf5") + range(9).map((r) => range(12).map((c) => C(20 + c * 36, 20 + r * 34, 2.2, "#c9d6e3")).join("")).join("")
    + G("translate(56 70)", A.gear(22, "#b9c7d6")) + G("translate(92 108)", A.gear(14, "#cfdae6")) + G("translate(388 84)", A.gear(26, "#b9c7d6"))
    + R(330, 160, 90, 10, 4, "#b07a45") + R(344, 126, 14, 34, 3, "#ff5c5c") + R(366, 136, 30, 24, 4, "#4db3f2") + R(402, 140, 12, 20, 3, "#ffd21c")
    + R(20, 180, 80, 10, 4, "#b07a45") + C(40, 170, 10, "#58cc02") + R(58, 156, 30, 24, 4, "#9b7fd8")
    + R(0, 320, W, 80, 0, "#b9c7d6") + L("M0 350 H440", "#a9b8c9", 3)
    + E(220, 380, 118, 18, "#8a97a8") + E(220, 376, 110, 14, "#cfdae6"),
  parts: [
    { id: "armL", x: 164, y: 270, hid: true, svg: A.robotArm(-1) },
    { id: "armR", x: 276, y: 270, hid: true, svg: A.robotArm(1) },
    { id: "legs", x: 220, y: 376, hid: true, svg: A.robotLegs() },
    { id: "body", x: 220, y: 322, hid: true, svg: A.robotBody() },
    { id: "heart", x: 220, y: 276, hid: true, svg: A.robotHeart() },
    { id: "antenna", x: 220, y: 144, hid: true, o: "50% 100%", svg: A.antenna() },
    { id: "head", x: 220, y: 230, hid: true, svg: A.robotHead() },
    { id: "eyes", x: 220, y: 230, hid: true, svg: A.robotEyes() },
    { id: "notes", x: 0, y: 0, hid: true, svg: note(90, 230, 1.5, "#9b7fd8") + note(356, 216, 1.3, "#ff5c8a") + note(380, 290, 1.1, "#4db3f2") + note(66, 300, 1.2, "#ffb100") },
  ],
  steps: [
    [{ a: "show", id: "legs", fx: "drop" }],
    [{ a: "show", id: "body", fx: "drop" }],
    [{ a: "show", id: "armL", fx: "slideL" }],
    [{ a: "show", id: "armR", fx: "slideR" }],
    [{ a: "show", id: "head", fx: "drop" }],
    [{ a: "show", id: "eyes", fx: "blink" }],
    [{ a: "show", id: "antenna", fx: "grow" }],
    [{ a: "show", id: "heart", fx: "pop" }],
  ],
  finale: [...ROBOT.map((id) => ({ a: "fx", id, fx: "hop" })), { a: "show", id: "notes", fx: "pop", at: 200 }, { a: "fx", id: "notes", fx: "float", at: 800 }],
  done: { title: "Your robot is alive!", sub: "Eight words built a dancing robot." },
};

// ── 6. Castle Builder: walls, keep, towers, gate, windows, flags; fireworks ──
const castleGame = {
  key: "castle", title: "Castle Builder", group: "arcade", top: "#e6f6ff", bottom: "#d4efc4",
  sub: "Say it to build a castle", playDescription: "Every word builds another part of your castle.",
  how: "Say each word to build a castle.", blurb: "Every word builds the castle: walls, a keep, two towers, a gate, windows and flags; then fireworks.",
  alt: "A green hill with a place to build a castle.",
  bg: meadowBg({ sun: [152, 54, 24], clouds: [[306, 40, 0.7]], far: 260, near: 318, front: 350 })
    + P("M200 400 Q210 370 220 350 L240 350 Q236 372 250 400 Z", "#e8d4a8"),
  parts: [
    { id: "keep", x: 220, y: 334, hid: true, svg: A.keep(120, 160) },
    { id: "wallL", x: 128, y: 336, hid: true, svg: A.wallBlock(112, 88) },
    { id: "wallR", x: 312, y: 336, hid: true, svg: A.wallBlock(112, 88) },
    { id: "towerL", x: 58, y: 340, hid: true, svg: A.castleTower(66, 190, "#7a5fb0") },
    { id: "towerR", x: 382, y: 340, hid: true, svg: A.castleTower(66, 190, "#7a5fb0") },
    { id: "gate", x: 220, y: 336, hid: true, svg: A.castleGate() },
    { id: "windows", x: 0, y: 0, hid: true, svg: [[196, 268], [244, 268], [220, 220], [58, 250], [382, 250], [58, 196], [382, 196]].map(([x, y]) => G(`translate(${x} ${y})`, A.castleWin())).join("") },
    { id: "flags", x: 0, y: 0, hid: true, svg: G("translate(58 82)", A.pennant("#ff5c5c")) + G("translate(382 82)", A.pennant("#ffd21c")) + G("translate(220 166)", A.pennant("#58cc02")) },
    { id: "fw1", x: 136, y: 150, hid: true, svg: A.firework("#ffd21c", "#ff5c8a") },
    { id: "fw2", x: 306, y: 148, hid: true, svg: A.firework("#4db3f2", "#ffffff") },
    { id: "fw3", x: 224, y: 58, hid: true, svg: G("scale(0.8)", A.firework("#58cc02", "#ffd21c")) },
  ],
  steps: [
    [{ a: "show", id: "wallL", fx: "rise" }], [{ a: "show", id: "wallR", fx: "rise" }], [{ a: "show", id: "keep", fx: "rise" }],
    [{ a: "show", id: "towerL", fx: "rise" }], [{ a: "show", id: "towerR", fx: "rise" }], [{ a: "show", id: "gate", fx: "pop" }],
    [{ a: "show", id: "windows", fx: "fade" }], [{ a: "show", id: "flags", fx: "pop" }],
  ],
  finale: [
    { a: "show", id: "fw1", fx: "pop" }, { a: "show", id: "fw2", fx: "pop", at: 500 }, { a: "show", id: "fw3", fx: "pop", at: 1000 },
    { a: "fx", id: "fw1", fx: "twinkle", at: 700 }, { a: "fx", id: "fw2", fx: "twinkle", at: 1200 }, { a: "fx", id: "flags", fx: "wiggle", at: 300 },
  ],
  done: { title: "What a castle!", sub: "Eight words built it, tower to tower." },
};

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

// ── 9. Pizza Chef: dough, sauce, cheese and five toppings; then it bakes ──
const PZ = [200, 300];
const pizzaGame = {
  key: "pizza", title: "Pizza Chef", group: "arcade", top: "#fff6e9", bottom: "#ffe1c4",
  sub: "Say it to make a pizza", playDescription: "Every word adds something to your pizza.",
  how: "Say each word to make a pizza.", blurb: "Every word adds to the pizza: dough, sauce, cheese and five toppings; then it bakes.",
  alt: "A kitchen with a pizza board on the counter and a pizza oven.",
  bg: R(0, 0, W, 250, 0, "#fff0dc") + range(11).map((c) => range(3).map((r) => R(c * 40 + (r % 2) * 20 - 20, 140 + r * 36, 36, 32, 4, (c + r) % 2 ? "#ffe0bd" : "#ffffff")).join("")).join("")
    + G(at(80, 250, 0.9), A.ovenBack()) + R(0, 40, W, 10, 4, "#c98f4f") + C(250, 26, 12, "#ff5c5c") + C(290, 30, 10, "#58cc02") + C(320, 26, 12, "#ffd21c") + C(360, 30, 10, "#ff9d3d"),
  parts: [
    { id: "chef", x: 382, y: 266, svg: G("scale(1.15)", cast.bear({ pose: "wave", face: "grin" }) + G("translate(0 -92) scale(1.3)", A.chefHat())) },
    { id: "counter", x: 0, y: 0, svg: R(0, 246, W, 154, 0, "#c98f4f") + R(0, 246, W, 16, 0, "#dba566") + L("M0 300 H440 M0 350 H440", "#b88048", 2) },
    { id: "board", x: PZ[0], y: PZ[1], svg: A.pizzaBoard() },
    { id: "dough", x: PZ[0], y: PZ[1], hid: true, svg: A.dough() },
    { id: "sauce", x: PZ[0], y: PZ[1], hid: true, svg: A.sauce() },
    { id: "cheese", x: PZ[0], y: PZ[1], hid: true, svg: A.cheese() },
    { id: "pep", x: PZ[0], y: PZ[1], hid: true, svg: A.spread([[-70, -14], [-26, -34], [24, -30], [70, -10], [-44, 20], [6, 4], [52, 26], [90, 14], [-90, 6]], A.pepperoni) },
    { id: "mush", x: PZ[0], y: PZ[1], hid: true, svg: A.spread([[-50, -2], [36, -8], [-8, 32], [80, -30], [-90, -24]], A.mushroom) },
    { id: "pepper", x: PZ[0], y: PZ[1], hid: true, svg: A.spread([[-10, -18], [60, 4], [-66, 30], [20, 34], [-100, 0]], A.pepper) },
    { id: "olive", x: PZ[0], y: PZ[1], hid: true, svg: A.spread([[-36, -40], [8, -46], [100, -8], [-80, 30], [34, 14], [-20, 14]], A.olive) },
    { id: "basil", x: PZ[0], y: PZ[1], hid: true, svg: A.spread([[-20, -10], [46, -22], [70, 30], [-60, -30], [-6, 40]], A.basil) },
    { id: "baked", x: PZ[0], y: PZ[1], hid: true, svg: E(0, 0, 138, 66, "#ff9d3d", { opacity: 0.16 }) + L("M-120 -8 L120 8 M-40 -60 L40 60 M40 -60 L-40 60", "#e0a050", 2.5, { opacity: 0.6 }) },
    { id: "steam", x: PZ[0], y: PZ[1] - 70, hid: true, svg: L("M-40 0 q-8 -14 0 -26 q8 -12 0 -26 M0 -6 q-8 -14 0 -26 q8 -12 0 -26 M40 0 q-8 -14 0 -26 q8 -12 0 -26", "#c9b29a", 5, { opacity: 0.8 }) },
  ],
  steps: [
    [{ a: "show", id: "dough", fx: "pop" }], [{ a: "show", id: "sauce", fx: "fade" }], [{ a: "show", id: "cheese", fx: "fade" }],
    [{ a: "show", id: "pep", fx: "drop" }], [{ a: "show", id: "mush", fx: "drop" }], [{ a: "show", id: "pepper", fx: "drop" }],
    [{ a: "show", id: "olive", fx: "drop" }], [{ a: "show", id: "basil", fx: "drop" }],
  ].map((s) => s.concat([{ a: "fx", id: "chef", fx: "bounce", at: 200 }])),
  finale: [
    { a: "show", id: "baked", fx: "fade" }, { a: "show", id: "steam", fx: "rise", at: 400 }, { a: "fx", id: "steam", fx: "float", at: 1000 },
    { a: "fx", id: "chef", fx: "hop", at: 300 },
  ],
  done: { title: "Pizza's ready!", sub: "Eight words made the best pizza." },
};

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

export const BIG = [ robotGame, castleGame, spaceGame, pizzaGame, monsterGame];
