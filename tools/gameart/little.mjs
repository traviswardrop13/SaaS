// The ten Say & Play games for ages 3-4: five words a game, one big thing
// happening, nothing to read and nothing to aim at. See page.mjs for the shape
// of a game and sayplay.js for what each action does.
import { C, E, R, P, L, G, at, W, sky, sun, cloud, hills, ground, star, heart, sparkle, house, tree, fence, flower, face, zzz, note } from "../bookart/kit.mjs";
import { meadowBg, SKY, starsList, bubblesUp, kelp } from "../bookart/scene.mjs";
import { bunting } from "../bookart/props.mjs";
import * as cast from "../bookart/cast.mjs";
import * as A from "./art.mjs";

const put = (fn, x, y, s = 1, o = {}) => G(at(x, y, s, !!o.flip), fn(o));
const sparkles = (list, c = "#ffd21c") => list.map(([x, y, s]) => sparkle(x, y, s || 1, c)).join("");

// ── 1. Balloon Party: every word blows the balloon bigger; then it lifts Bo up ──
const balloon = {
  key: "balloon", title: "Balloon Party", group: "simple", top: "#e6f6ff", bottom: "#d4efc4",
  sub: "Say it to blow up the balloon", playDescription: "Every word you say blows the balloon bigger.",
  how: "Say each word to blow up the big balloon.", blurb: "Every word blows Bo's balloon bigger, and at the end it lifts him up.",
  alt: "Bo the bear holds a balloon at a party in the park.",
  bg: meadowBg({ sun: [380, 60, 24], clouds: [[70, 70, 0.9], [300, 120, 0.6]] })
    + bunting(-10, 18, 450, 30, 16)
    + put(() => A.smallBalloon("#ffd21c"), 40, 356, 0.9) + put(() => A.smallBalloon("#58cc02"), 62, 360, 0.8)
    + put(() => A.smallBalloon("#9b7fd8"), 404, 356, 0.9) + put(() => A.smallBalloon("#4db3f2"), 382, 362, 0.75),
  parts: [
    { id: "string", x: 0, y: 0, svg: L("M246 292 Q240 262 250 226", "#9aa7b8", 2.2) },
    { id: "bear", x: 214, y: 366, o: "50% 100%", svg: G("scale(1.25)", cast.bear({ pose: "wave", face: "grin" })) },
    { id: "puffs", x: 250, y: 220, hid: true, svg: A.airPuffs() },
    { id: "balloon", x: 250, y: 228, s: 0.32, o: "50% 100%", svg: A.bigBalloon() },
    { id: "b1", x: 110, y: 420, hid: true, svg: A.smallBalloon("#ff8fb0", 1.3) },
    { id: "b2", x: 360, y: 430, hid: true, svg: A.smallBalloon("#4db3f2", 1.2) },
    { id: "b3", x: 170, y: 440, hid: true, svg: A.smallBalloon("#ffd21c", 1.1) },
    { id: "joy", x: 0, y: 0, hid: true, svg: sparkles([[110, 140, 1.3], [350, 90, 1.1], [390, 200, 1.4], [70, 230, 1]]) },
  ],
  steps: [0.48, 0.63, 0.77, 0.9, 1].map((s) => [
    { a: "scale", id: "balloon", s }, { a: "fx", id: "balloon", fx: "wiggle", at: 150 },
    { a: "show", id: "puffs", fx: "fade" }, { a: "hide", id: "puffs", at: 700 }, { a: "fx", id: "bear", fx: "bounce" },
  ]),
  finale: [
    { a: "move", id: "balloon", x: 0, y: -60, s: 0.9 }, { a: "move", id: "string", x: 0, y: -60 }, { a: "move", id: "bear", x: 0, y: -60 },
    { a: "fx", id: "balloon", fx: "float", at: 900 }, { a: "fx", id: "string", fx: "float", at: 900 }, { a: "fx", id: "bear", fx: "float", at: 900 },
    { a: "show", id: "b1", fx: "flyaway", at: 200 }, { a: "show", id: "b2", fx: "flyaway", at: 500 }, { a: "show", id: "b3", fx: "flyaway", at: 800 },
    { a: "show", id: "joy", fx: "fade", at: 300 },
  ],
  done: { title: "Up, up and away!", sub: "Your words blew up a giant balloon." },
};

// ── 2. Grow a Flower: water the seed with every word; it sprouts, buds and blooms ──
const flowerGame = {
  key: "flower", title: "Grow a Flower", group: "simple", top: "#fff6e0", bottom: "#d4efc4",
  sub: "Say it to water the seed", playDescription: "Water the seed with your words and watch it grow.",
  how: "Say each word to water the seed.", blurb: "Every word waters the seed: a sprout, leaves, a bud, a bloom, and a bee comes to visit.",
  alt: "A garden with a seed in the ground and a watering can.",
  bg: meadowBg({ sun: [370, 64, 26], clouds: [[80, 64, 0.9], [240, 40, 0.6]] })
    + fence(300, 0, 440, "#fff4e0"),
  parts: [
    { id: "soil", x: 220, y: 352, svg: A.soilMound() },
    { id: "sprout", x: 220, y: 336, hid: true, o: "50% 100%", svg: A.sprout() },
    { id: "stem", x: 220, y: 338, hid: true, o: "50% 100%", svg: A.stem() },
    { id: "bud", x: 220, y: 212, hid: true, o: "50% 100%", svg: A.bud() },
    { id: "bloom", x: 220, y: 176, hid: true, svg: A.bloom() },
    { id: "can", x: 92, y: 120, svg: A.wateringCan() },
    { id: "drops", x: 0, y: 0, hid: true, svg: A.drop(170, 132) + A.drop(182, 160, 0.9) + A.drop(172, 190) + A.drop(192, 216, 0.8) + A.drop(184, 246, 0.9) + A.drop(202, 272, 0.8) + A.drop(196, 300, 0.9) },
    { id: "bee", x: 330, y: 150, hid: true, svg: G("scale(1.3)", cast.bee({ face: "grin" })) },
    { id: "f2", x: 110, y: 366, hid: true, o: "50% 100%", svg: flower(0, 0, 1.6, "#9b7fd8") },
    { id: "f3", x: 340, y: 370, hid: true, o: "50% 100%", svg: flower(0, 0, 1.5, "#ffd21c", "#ff9d3d") },
    { id: "glow", x: 0, y: 0, hid: true, svg: sparkles([[150, 120, 1.4], [300, 96, 1.2], [290, 230, 1], [140, 250, 1.1]]) },
  ],
  steps: [
    [{ a: "fx", id: "can", fx: "wiggle" }, { a: "show", id: "drops", fx: "fade" }, { a: "hide", id: "drops", at: 900 }, { a: "show", id: "sprout", fx: "grow", at: 500 }],
    [{ a: "fx", id: "can", fx: "wiggle" }, { a: "show", id: "drops", fx: "fade" }, { a: "hide", id: "drops", at: 900 }, { a: "hide", id: "sprout", at: 400 }, { a: "show", id: "stem", fx: "grow", at: 500 }],
    [{ a: "fx", id: "can", fx: "wiggle" }, { a: "show", id: "drops", fx: "fade" }, { a: "hide", id: "drops", at: 900 }, { a: "show", id: "bud", fx: "pop", at: 500 }],
    [{ a: "fx", id: "can", fx: "wiggle" }, { a: "show", id: "drops", fx: "fade" }, { a: "hide", id: "drops", at: 900 }, { a: "hide", id: "bud", at: 450 }, { a: "show", id: "bloom", fx: "pop", at: 500 }],
    [{ a: "show", id: "bee", fx: "slideR" }, { a: "show", id: "f2", fx: "grow", at: 300 }, { a: "show", id: "f3", fx: "grow", at: 500 }, { a: "fx", id: "bloom", fx: "wiggle", at: 700 }],
  ],
  finale: [
    { a: "fx", id: "bloom", fx: "sway" }, { a: "fx", id: "stem", fx: "sway" }, { a: "fx", id: "bee", fx: "float" },
    { a: "fx", id: "f2", fx: "sway", at: 200 }, { a: "fx", id: "f3", fx: "sway", at: 400 }, { a: "show", id: "glow", fx: "fade", at: 200 },
    { a: "move", id: "can", x: -200, y: 0 },
  ],
  done: { title: "Your flower grew!", sub: "Five words made it bloom." },
};

// ── 3. Rocket Blast: every word lights the countdown, 5 4 3 2 1, blast off ──
const rocketGame = {
  key: "rocket", title: "Rocket Blast", group: "simple", top: "#e9e4ff", bottom: "#ffe1c4",
  sub: "Say it to count down", playDescription: "Every word lights the countdown. Then blast off!",
  how: "Say each word to count down to blast off.", blurb: "Every word lights one number of the countdown, 5 4 3 2 1, and Bo's rocket blasts off.",
  alt: "A rocket on a launch pad at sunset, with a countdown board.",
  bg: R(0, 0, W, 400, 0, "#4a4f8f") + R(0, 150, W, 120, 0, "#7a6fb0") + R(0, 230, W, 80, 0, "#c98fb0") + C(360, 250, 60, "#ffcf8a", { opacity: 0.35 })
    + starsList([[40, 40, 0.5], [120, 90, 0.4], [200, 30, 0.6], [300, 70, 0.45], [400, 30, 0.5], [260, 130, 0.35], [420, 120, 0.4]], "#fff1b8")
    + hills(290, 330, 400, "#6b6fa3", "#5a5f94") + ground(356, "#8a97a8") + G(at(378, 356, 1), A.launchTower()),
  parts: [
    { id: "smoke", x: 230, y: 360, hid: true, svg: A.smokeCloud(1.2) },
    { id: "flame", x: 240, y: 332, hid: true, o: "50% 0%", svg: G("scale(1.2)", A.flame()) },
    { id: "rocket", x: 240, y: 334, o: "50% 100%", svg: G("scale(1.2)", A.rocket({ pilot: A.pilotBear() })) },
    { id: "pad", x: 240, y: 356, svg: A.launchPad() },
    { id: "board", x: 66, y: 60, svg: R(-34, -26, 68, 238, 14, "#3d4a5c") + R(-28, -20, 56, 226, 10, "#2d3642") + [5, 4, 3, 2, 1].map((n, i) => G(`translate(0 ${10 + i * 44})`, A.countLight(n, false))).join("") },
    ...[5, 4, 3, 2, 1].map((n, i) => ({ id: "l" + n, x: 66, y: 70 + i * 44, hid: true, svg: A.countLight(n, true) })),
    { id: "twinkle", x: 0, y: 0, hid: true, svg: starsList([[60, 300, 1], [150, 60, 1.2], [330, 40, 1], [410, 200, 0.9]], "#fff1b8") },
  ],
  steps: [5, 4, 3, 2, 1].map((n, i) => [
    { a: "show", id: "l" + n, fx: "pop" }, { a: "fx", id: "rocket", fx: i === 4 ? "shake" : "wiggle", at: 200 },
  ]),
  finale: [
    { a: "show", id: "flame", fx: "pop" }, { a: "show", id: "smoke", fx: "pop", at: 100 },
    { a: "fx", id: "rocket", fx: "launch", at: 500 }, { a: "fx", id: "flame", fx: "launch", at: 500 },
    { a: "show", id: "twinkle", fx: "twinkle", at: 900 },
  ],
  done: { title: "Blast off!", sub: "Your words sent Bo's rocket to space." },
};


// ── 4. Build a Snowman: bottom, middle, head, face, then hat, scarf and arms ──
const snowmanGame = {
  key: "snowman", title: "Build a Snowman", group: "simple", top: "#eef7ff", bottom: "#dcecf8",
  sub: "Say it to build a snowman", playDescription: "Every word you say builds the snowman.",
  how: "Say each word to build a snowman.", blurb: "Every word adds to the snowman: three snowballs, a face, then a hat, a scarf and twig arms.",
  alt: "A snowy hill with pine trees, ready for a snowman.",
  bg: sky(SKY.chill) + C(372, 70, 30, "#ffffff", { opacity: 0.6 }) + cloud(90, 64, 0.9) + cloud(280, 44, 0.6)
    + hills(262, 312, 400, "#e3eef8", "#f0f6fc") + A.pine(52, 318, 0.9) + A.pine(106, 300, 0.6) + A.pine(396, 326, 1.1) + A.pine(348, 296, 0.6)
    + ground(356, "#ffffff") + E(220, 372, 90, 10, "#dbe8f5")
    + A.flakes([[40, 120], [130, 170, 2.5], [300, 150], [410, 190, 2.5], [180, 60, 2.5], [250, 110, 2]]),
  parts: [
    { id: "ball1", x: 220, y: 372, hid: true, svg: A.snowball(62) },
    { id: "ball2", x: 220, y: 262, hid: true, svg: A.snowball(46) },
    { id: "arms", x: 220, y: 216, hid: true, svg: A.stickArms(46) },
    { id: "buttons", x: 220, y: 218, hid: true, svg: A.coalButtons() },
    { id: "ball3", x: 220, y: 186, hid: true, svg: A.snowball(34) },
    { id: "face", x: 220, y: 152, hid: true, svg: A.snowFace() },
    { id: "scarf", x: 220, y: 180, hid: true, svg: A.scarf() },
    { id: "hat", x: 220, y: 126, hid: true, o: "50% 100%", svg: A.topHat() },
    { id: "kid", x: 78, y: 386, hid: true, svg: G("scale(1.05)", cast.kid({ pose: "cheer", face: "grin", top: "#ff5c5c", bottom: "#4f8fe0" })) },
    { id: "snow", x: 0, y: 0, hid: true, svg: A.flakes([[30, 40, 4], [90, 100, 3], [150, 30, 4], [200, 90, 3], [270, 50, 4], [330, 110, 3], [400, 60, 4], [60, 200, 3], [360, 220, 4], [420, 150, 3], [120, 260, 3]]) },
    { id: "glow", x: 0, y: 0, hid: true, svg: sparkles([[140, 110, 1.3], [300, 120, 1.2], [320, 250, 1]]) },
  ],
  steps: [
    [{ a: "show", id: "ball1", fx: "drop" }],
    [{ a: "show", id: "ball2", fx: "drop" }],
    [{ a: "show", id: "ball3", fx: "drop" }],
    [{ a: "show", id: "face", fx: "pop" }, { a: "show", id: "buttons", fx: "pop", at: 250 }],
    [{ a: "show", id: "hat", fx: "drop" }, { a: "show", id: "scarf", fx: "pop", at: 250 }, { a: "show", id: "arms", fx: "pop", at: 450 }],
  ],
  finale: [
    { a: "fx", id: "arms", fx: "wiggle" }, { a: "fx", id: "hat", fx: "bounce", at: 150 },
    { a: "show", id: "kid", fx: "slideL", at: 100 }, { a: "fx", id: "kid", fx: "hop", at: 1000 },
    { a: "show", id: "snow", fx: "fade", at: 200 }, { a: "fx", id: "snow", fx: "float", at: 900 }, { a: "show", id: "glow", fx: "fade", at: 400 },
  ],
  done: { title: "Hello, snowman!", sub: "Your words built a snowman." },
};

// ── 5. Choo-Choo Train: every word, a friend on the platform climbs aboard ──
// who rides: how big each looks in its window (s, with its head's height hy)
// and waiting on the platform (ps); the duck's head sits lower than the rest
const RIDERS = [
  { fn: (o) => cast.pig(o), s: 0.6, hy: 66, ps: 0.6 }, { fn: (o) => cast.cow(o), s: 0.6, hy: 66, ps: 0.6 },
  { fn: (o) => cast.duck(o), s: 0.85, hy: 54, ps: 0.8 }, { fn: (o) => cast.lamb(o), s: 0.6, hy: 66, ps: 0.6 },
  { fn: (o) => cast.dog(o), s: 0.6, hy: 66, ps: 0.6 },
];
const COACH_X = 160, TRAIN_Y = 300, WAIT_X = [48, 134, 220, 306, 392];
const trainGame = {
  key: "train", title: "Choo-Choo Train", group: "simple", top: "#e6f6ff", bottom: "#d4efc4",
  sub: "Say it to help a friend aboard", playDescription: "Every word helps a friend climb aboard the train.",
  how: "Say each word to help a friend onto the train.", blurb: "Every word helps one friend from the platform onto the train; then it chugs and toots.",
  alt: "A little train at a station, and five friends waiting on the platform.",
  bg: meadowBg({ sun: [60, 56, 24], clouds: [[190, 58, 0.9], [330, 92, 0.6]], front: 300 }) + A.tracks(TRAIN_Y + 2)
    + A.COACH_WIN.map((x) => R(COACH_X + x - 20, TRAIN_Y - 88, 40, 44, 3, "#dff4ff")).join(""),
  parts: [
    ...A.COACH_WIN.map((x, i) => ({ id: "in" + (i + 1), x: COACH_X + x, y: TRAIN_Y - 64 + RIDERS[i].hy * RIDERS[i].s, hid: true, svg: G(`scale(${RIDERS[i].s})`, RIDERS[i].fn({ face: "grin" })) })),
    { id: "coach", x: COACH_X, y: TRAIN_Y, svg: A.coach() },
    { id: "engine", x: 362, y: TRAIN_Y, svg: G("scale(1.15)", A.engine()) },
    { id: "puff", x: 393, y: 196, hid: true, svg: A.steamPuff() },
    { id: "platform", x: 0, y: 0, svg: R(0, 318, W, 82, 0, "#d9c4a4") + R(0, 318, W, 10, 0, "#ffd21c") + L("M0 350 H440 M0 380 H440", "#c9b08e", 3) },
    ...WAIT_X.map((x, i) => ({ id: "on" + (i + 1), x, y: 394, svg: G(`scale(${RIDERS[i].ps})`, RIDERS[i].fn({ pose: "wave", face: "smile" })) })),
    { id: "toot", x: 0, y: 0, hid: true, svg: note(318, 170, 1.4, "#ff5c5c") + note(290, 136, 1.2, "#4db3f2") + note(344, 120, 1.3, "#9b7fd8") },
  ],
  steps: WAIT_X.map((x, i) => [
    { a: "move", id: "on" + (i + 1), x: (COACH_X + A.COACH_WIN[i] - x) * 0.6, y: -70 }, { a: "hide", id: "on" + (i + 1), at: 250 },
    { a: "show", id: "in" + (i + 1), fx: "pop", at: 450 }, { a: "show", id: "puff", fx: "puff", at: 500 },
  ]),
  finale: [
    { a: "fx", id: "engine", fx: "chug" }, ...A.COACH_WIN.map((x, i) => ({ a: "fx", id: "in" + (i + 1), fx: "hop", at: 90 * i })),
    { a: "fx", id: "puff", fx: "puff" }, { a: "fx", id: "puff", fx: "puff", at: 800 }, { a: "fx", id: "puff", fx: "puff", at: 1600 },
    { a: "show", id: "toot", fx: "pop", at: 300 }, { a: "fx", id: "toot", fx: "float", at: 900 },
  ],
  done: { title: "All aboard!", sub: "Five friends are riding your train." },
};

// ── 6. Puppy Bath: every word scrubs a mud spot away; then a big shake ──
const MUD = [[234, 140, 1.3, 20], [174, 180, 1.2, -30], [271, 184, 1.2, 40], [198, 236, 1.2, 10], [246, 242, 1.15, -15]];
const puppyGame = {
  key: "puppy", title: "Puppy Bath", group: "simple", top: "#e8f6fb", bottom: "#fde8ef",
  sub: "Say it to wash the puppy", playDescription: "Every word washes a muddy spot away.",
  how: "Say each word to wash the muddy puppy.", blurb: "Every word scrubs one mud spot off Dan the puppy; then he shakes himself dry.",
  alt: "A muddy puppy sits in a bubble bath.",
  bg: A.tiles(300) + R(0, 292, W, 8, 0, "#a9d8ee") + R(0, 300, W, 100, 0, "#f7e2c4") + L("M0 336 H440 M0 372 H440", "#ecd0aa", 3)
    + R(300, 60, 90, 70, 10, "#ffffff") + R(308, 68, 74, 54, 6, "#bfe8fb") + L("M345 68 V122", "#ffffff", 4)
    + E(220, 386, 150, 12, "#ff8fb0", { opacity: 0.5 }) + G(at(220, 362, 1), A.tubBack()),
  parts: [
    { id: "dog", x: 222, y: 300, svg: G("scale(1.9)", cast.dog({ pose: "cheer", face: "happy" })) },
    ...MUD.map(([x, y, s, a], i) => ({ id: "mud" + (i + 1), x, y, svg: A.mud(s, a) })),
    ...MUD.map(([x, y], i) => ({ id: "suds" + (i + 1), x, y: y + 2, hid: true, svg: A.suds(1) })),
    { id: "duck", x: 128, y: 262, hid: true, svg: A.rubberDuck() },
    { id: "drops", x: 222, y: 250, hid: true, svg: A.waterDrops() },
    { id: "sponge", x: 330, y: 244, svg: A.sponge() },
    { id: "glow", x: 0, y: 0, hid: true, svg: sparkles([[150, 170, 1.3], [300, 160, 1.2], [330, 230, 1]]) },
  ],
  fg: G(at(220, 362, 1), A.tubFront()) + G(at(118, 262, 1), A.suds(1)) + G(at(300, 258, 1), A.suds(0.9)) + G(at(350, 262, 1), A.suds(0.7)),
  steps: MUD.map(([x, y], i) => [
    { a: "move", id: "sponge", x: x - 330 + 6, y: y - 244 + 4 }, { a: "fx", id: "sponge", fx: "shake", at: 300 },
    { a: "hide", id: "mud" + (i + 1), at: 450 }, { a: "show", id: "suds" + (i + 1), fx: "pop", at: 550 },
  ]),
  finale: [
    { a: "move", id: "sponge", x: 0, y: 0 }, ...MUD.map((m, i) => ({ a: "hide", id: "suds" + (i + 1), at: 100 })),
    { a: "fx", id: "dog", fx: "shake", at: 300 }, { a: "show", id: "drops", fx: "pop", at: 400 }, { a: "hide", id: "drops", at: 1500 },
    { a: "show", id: "duck", fx: "rise", at: 700 }, { a: "fx", id: "duck", fx: "float", at: 1300 }, { a: "show", id: "glow", fx: "fade", at: 1300 },
  ],
  done: { title: "Squeaky clean!", sub: "Your words gave the puppy a bath." },
};

// ── 7. Bedtime Stars: every word lights a star; then the house says goodnight ──
const STARS = [[180, 162], [232, 92], [312, 58], [390, 104], [340, 172]];
const nightHouse = () => R(-50, -70, 100, 70, 4, "#c9b8e8") + P("M-60 -66 L0 -114 L60 -66 Z", "#7a5fb0") + R(-62, -70, 124, 10, 5, "#6b50a0")
  + P("M-10 0 V-30 Q-10 -40 0 -40 Q10 -40 10 -30 V0 Z", "#5b4a7a") + R(-40, -52, 22, 20, 3, "#2d3a6b") + R(18, -52, 22, 20, 3, "#2d3a6b");
const starsGame = {
  key: "stars", title: "Bedtime Stars", group: "simple", top: "#e9e4ff", bottom: "#d8d2f5",
  sub: "Say it to light a star", playDescription: "Every word lights a star in the night sky.",
  how: "Say each word to light up a star.", blurb: "Every word lights one star over the sleepy house; then the lights go out and everyone says goodnight.",
  alt: "A sleepy moon over a little house at night.",
  bg: sky(SKY.night) + starsList([[30, 40, 0.3], [120, 30, 0.25], [270, 140, 0.25], [420, 40, 0.3], [150, 220, 0.25], [410, 220, 0.25]], "#aab4e8")
    + STARS.map(([x, y]) => G(`translate(${x} ${y})`, A.dimStar())).join("")
    + hills(280, 320, 400, "#3f4f8a", "#34457a") + ground(362, "#2e3d6e") + tree(60, 360, 1, "#3f7a5a", "#4f8a6a")
    + G(at(330, 356, 1.1), nightHouse()),
  parts: [
    { id: "moon", x: 92, y: 96, svg: A.sleepyMoon() },
    ...STARS.map(([x, y], i) => ({ id: "s" + (i + 1), x, y, hid: true, svg: A.bigStar() })),
    { id: "lamp", x: 330, y: 356, svg: G("scale(1.1)", R(-40, -52, 22, 20, 3, "#ffe08a") + R(18, -52, 22, 20, 3, "#ffe08a") + C(-29, -42, 18, "#ffe08a", { opacity: 0.2 }) + C(29, -42, 18, "#ffe08a", { opacity: 0.2 })) },
    { id: "zzz", x: 0, y: 0, hid: true, svg: zzz(376, 250, 1.6) + zzz(398, 222, 1.1) },
    { id: "shoot", x: 200, y: 40, hid: true, svg: A.shootingStar() },
  ],
  steps: STARS.map((s, i) => [{ a: "show", id: "s" + (i + 1), fx: "pop" }, { a: "fx", id: "moon", fx: "wiggle", at: 300 }]),
  finale: [
    ...STARS.map((s, i) => ({ a: "fx", id: "s" + (i + 1), fx: "twinkle", at: i * 180 })),
    { a: "show", id: "shoot", fx: "slideL", at: 200 }, { a: "hide", id: "lamp", at: 1200 }, { a: "show", id: "zzz", fx: "fade", at: 1500 },
    { a: "fx", id: "moon", fx: "float", at: 400 },
  ],
  done: { title: "Goodnight, stars!", sub: "Your words lit up the whole sky." },
};

// ── 8. Birthday Cake: two layers, icing, sprinkles, candles; then the party ──
const CANDLES = [-44, -22, 0, 22, 44], CANDLE_C = ["#ff5c5c", "#4db3f2", "#ffd21c", "#58cc02", "#9b7fd8"];
const cakeGame = {
  key: "cake", title: "Birthday Cake", group: "simple", top: "#fff0f6", bottom: "#ffe1c4",
  sub: "Say it to make the cake", playDescription: "Every word adds to the birthday cake.",
  how: "Say each word to make a birthday cake.", blurb: "Every word builds the cake: two layers, icing, sprinkles and candles; then friends come to the party.",
  alt: "A party table with a cake plate, bunting and balloons.",
  bg: R(0, 0, W, 400, 0, "#ffe9f2") + L("M0 40 H440 M0 120 H440 M0 200 H440 M0 280 H440", "#ffdcea", 10)
    + bunting(-10, 30, 450, 40, 18) + put(() => A.smallBalloon("#ffd21c"), 40, 250, 1.3) + put(() => A.smallBalloon("#4db3f2"), 70, 262, 1.1)
    + put(() => A.smallBalloon("#ff5c5c"), 400, 250, 1.3) + put(() => A.smallBalloon("#58cc02"), 372, 264, 1.05)
    + R(0, 352, W, 48, 0, "#f7d9b5")
    + R(90, 322, 260, 16, 8, "#ffffff") + P("M96 336 H344 L352 400 H88 Z", "#ffffff")
    + [[120, 360], [170, 385], [220, 356], [270, 384], [320, 360]].map(([x, y]) => C(x, y, 7, "#8fd4f2")).join("")
    + G(at(220, 330, 1), A.plate()),
  parts: [
    { id: "layer1", x: 220, y: 326, hid: true, svg: A.cakeLayer(180, 70, "#f7c1d6", "#ec9dbd") },
    { id: "layer2", x: 220, y: 258, hid: true, svg: A.cakeLayer(130, 58, "#f7c1d6", "#ec9dbd") },
    { id: "icing", x: 220, y: 0, hid: true, svg: A.icing(184, 254) + A.icing(134, 198) },
    { id: "sprinkles", x: 220, y: 0, hid: true, svg: A.sprinkles(116, 191, 205, 16, 3) + A.sprinkles(166, 249, 262, 22, 7) },
    { id: "candles", x: 220, y: 194, hid: true, svg: CANDLES.map((x, i) => G(`translate(${x} 0)`, A.candle(CANDLE_C[i]))).join("") },
    { id: "flames", x: 220, y: 140, hid: true, svg: CANDLES.map((x) => G(`translate(${x} 0)`, A.candleFlame())).join("") },
    { id: "bear", x: 48, y: 396, hid: true, svg: G("scale(1.05)", cast.bear({ pose: "cheer", face: "grin" }) + G("translate(0 -92)", A.partyHat("#ff5c5c"))) },
    { id: "fox", x: 392, y: 396, hid: true, svg: G("scale(1.05)", cast.fox({ pose: "cheer", face: "grin" }) + G("translate(0 -90)", A.partyHat("#4db3f2"))) },
  ],
  steps: [
    [{ a: "show", id: "layer1", fx: "drop" }],
    [{ a: "show", id: "layer2", fx: "drop" }],
    [{ a: "show", id: "icing", fx: "fade" }],
    [{ a: "show", id: "sprinkles", fx: "pop" }],
    [{ a: "show", id: "candles", fx: "rise" }, { a: "show", id: "flames", fx: "pop", at: 500 }],
  ],
  finale: [
    { a: "fx", id: "flames", fx: "twinkle" }, { a: "show", id: "bear", fx: "slideL", at: 200 }, { a: "show", id: "fox", fx: "slideR", at: 400 },
    { a: "fx", id: "bear", fx: "hop", at: 1100 }, { a: "fx", id: "fox", fx: "hop", at: 1300 },
  ],
  done: { title: "Party time!", sub: "Your words made a birthday cake." },
};

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

export const LITTLE = [balloon, flowerGame, rocketGame, snowmanGame, trainGame, puppyGame, starsGame, cakeGame, giftsGame, tankGame];
