// The ten Say & Play games for ages 5-8: eight words a game and a goal to
// reach (the finish line, the treasure, the last planet). No timer, no score
// to lose, and nothing to aim at: every word the child says moves them on.
import { C, E, R, P, L, G, at, W, sky, sun, cloud, hills, star, heart, sparkle, note, face } from "../bookart/kit.mjs";
import { meadowBg, starsList } from "../bookart/scene.mjs";
import * as cast from "../bookart/cast.mjs";
import * as A from "./art.mjs";

const sparkles = (list, c = "#ffd21c") => list.map(([x, y, s]) => sparkle(x, y, s || 1, c)).join("");
const range = (n) => Array.from({ length: n }, (_, i) => i);

// ── 1. Race Car: every word zooms the car toward the finish; the snail cheers ──
const raceGame = {
  key: "racecar", title: "Race Car", group: "arcade", top: "#e6f6ff", bottom: "#dfe6ee",
  sub: "Say it to zoom ahead", playDescription: "Every word zooms your race car closer to the finish line.",
  how: "Say each word to zoom to the finish line.", blurb: "Every word zooms the race car ahead; the snail in the next lane is very, very slow.",
  alt: "A race track with a red race car at the start and a snail in the next lane.",
  bg: sky("#bfe8fb") + cloud(80, 50, 0.8) + cloud(330, 36, 0.6) + hills(150, 186, 400, "#b5e08f", "#9bd46a")
    + R(0, 150, W, 70, 0, "#8a6fc4") + range(24).map((i) => C(12 + i * 18.5, 168 + (i % 2) * 8, 6, ["#ff5c5c", "#ffd21c", "#4db3f2", "#ff8fb0", "#58cc02"][i % 5])).join("")
    + range(24).map((i) => C(20 + i * 18.5, 192 + (i % 2) * 6, 6, ["#ffd21c", "#4db3f2", "#ff9d3d", "#9b7fd8", "#ff5c5c"][i % 5])).join("")
    + R(0, 212, W, 10, 0, "#6b50a0") + R(0, 222, W, 50, 0, "#7cc152")
    + R(0, 268, W, 118, 0, "#6f7c8e") + R(0, 268, W, 6, 0, "#ffffff") + R(0, 380, W, 6, 0, "#ffffff") + R(0, 386, W, 14, 0, "#7cc152")
    + L("M0 330 H440", "#ffffff", 4, { "stroke-dasharray": "22 16" })
    + A.checkerLine(34, 274, 380, 14) + A.checkerLine(392, 274, 380, 14) + G(at(424, 266, 1, true), A.flagPole()),
  parts: [
    { id: "snail", x: 74, y: 374, svg: G("scale(0.9)", A.snail({ helmet: "#ffd21c" })) },
    { id: "zoom", x: 0, y: 0, hid: true, svg: L("M40 272 H0 M52 288 H10 M36 304 H4", "#ffffff", 5) },
    { id: "car", x: 84, y: 324, svg: G("scale(1.15)", A.raceCar("#ff5c5c", "#d94444", A.helmet("#4db3f2"))) },
    { id: "cup", x: 220, y: 150, hid: true, svg: G("scale(1.2)", A.trophy()) },
  ],
  steps: range(8).map((i) => [
    { a: "move", id: "car", x: 29 * (i + 1), y: 0 }, { a: "move", id: "zoom", x: 29 * (i + 1) + 16, y: 0 },
    { a: "show", id: "zoom", fx: "fade" }, { a: "hide", id: "zoom", at: 650 },
    { a: "move", id: "snail", x: 5 * (i + 1), y: 0 },
  ]),
  finale: [
    { a: "move", id: "car", x: 270, y: 0 }, { a: "fx", id: "car", fx: "bounce", at: 800 },
    { a: "show", id: "cup", fx: "drop", at: 500 }, { a: "fx", id: "snail", fx: "hop", at: 900 },
  ],
  done: { title: "You won the race!", sub: "Eight words zoomed you to the finish." },
  card: { crop: [96, 100, 300] },
};

// ── 2. Treasure Map: every word sails to the next stop; the X hides the chest ──
const ROUTE = [[64, 346], [134, 304], [92, 236], [166, 188], [250, 226], [322, 290], [392, 232], [338, 160], [372, 92]];
const mapGame = {
  key: "treasure", title: "Treasure Map", group: "arcade", top: "#fff3d6", bottom: "#f3dfb0",
  sub: "Say it to sail to the treasure", playDescription: "Every word sails your boat to the next stop on the map.",
  how: "Say each word to sail to the treasure.", blurb: "Every word sails the boat one stop along the dotted line; at the X, a treasure chest.",
  alt: "A treasure map with islands, a dotted path and a big red X.",
  bg: R(0, 0, W, 400, 0, "#f3dfb0") + R(10, 10, 420, 380, 18, "#9fd8f0") + R(10, 10, 420, 380, 18, "none", { stroke: "#d9b877", "stroke-width": 8 })
    + L("M40 120 q8 -6 16 0 q8 6 16 0 M250 60 q8 -6 16 0 q8 6 16 0 M200 380 q8 -6 16 0 q8 6 16 0 M40 270 q8 -6 16 0 q8 6 16 0", "#ffffff", 2.5, { opacity: 0.8 })
    + G("translate(56 58)", A.compass()) + G("translate(378 364) scale(0.8)", A.whale())
    + G("translate(214 108)", A.island(40, 18)) + A.palm(214, 106, 0.8) + G("translate(60 186)", A.island(30, 14))
    + G("translate(250 316)", A.island(34, 15)) + A.palm(252, 314, 0.6) + G("translate(118 372)", A.island(28, 11))
    + G("translate(372 100)", A.island(58, 28)) + A.palm(404, 86, 0.8)
    + L(ROUTE.map(([x, y], i) => (i ? "L" : "M") + x + " " + y).join(" "), "#8a5a2c", 3.4, { "stroke-dasharray": "3 9" })
    + ROUTE.slice(1, 8).map(([x, y]) => C(x, y, 8, "#f3dfb0") + C(x, y, 8, "none", { stroke: "#8a5a2c", "stroke-width": 2.5 })).join(""),
  parts: [
    { id: "x", x: 372, y: 94, svg: A.xMark() },
    ...ROUTE.slice(1, 8).map(([x, y], i) => ({ id: "c" + (i + 1), x, y, hid: true, svg: C(0, 0, 9, "#ffd21c") + C(0, 0, 9, "none", { stroke: "#f0a800", "stroke-width": 2.5 }) + star(0, 0, 0.55, "#fff6c8") })),
    { id: "chest", x: 374, y: 114, hid: true, svg: G("scale(1.25)", A.chest(true)) },
    { id: "boat", x: ROUTE[0][0], y: ROUTE[0][1] + 6, svg: A.sailboat() },
    { id: "glow", x: 0, y: 0, hid: true, svg: sparkles([[320, 50, 1.3], [420, 70, 1.1], [300, 130, 1]], "#fff6c8") },
  ],
  steps: range(8).map((i) => [
    // the last sail stops beside the X's island, so the chest has room
    { a: "move", id: "boat", x: (i === 7 ? 300 : ROUTE[i + 1][0]) - ROUTE[0][0], y: (i === 7 ? 136 : ROUTE[i + 1][1]) - ROUTE[0][1] },
    ...(i < 7 ? [{ a: "show", id: "c" + (i + 1), fx: "pop", at: 500 }] : [{ a: "fx", id: "x", fx: "wiggle", at: 500 }]),
  ]),
  finale: [
    { a: "hide", id: "x" }, { a: "show", id: "chest", fx: "pop", at: 250 }, { a: "fx", id: "chest", fx: "bounce", at: 900 },
    { a: "show", id: "glow", fx: "twinkle", at: 600 }, { a: "fx", id: "boat", fx: "bounce", at: 400 },
  ],
  done: { title: "You found the treasure!", sub: "Eight words sailed you all the way to the X." },
};

// ── 3. Soccer Goal: every word kicks a goal past Bo the goalie ──
const KICK = [140, 340];
const NET = [[306, 252], [394, 264], [316, 286], [398, 228], [302, 218], [384, 290], [328, 196], [372, 198]];
const soccerGame = {
  key: "soccer", title: "Soccer Goal", group: "arcade", top: "#e6f6ff", bottom: "#cfeec0",
  sub: "Say it to kick a goal", playDescription: "Every word kicks the ball into the net.",
  how: "Say each word to kick a goal.", blurb: "Every word kicks a ball past Bo the goalie, who always dives the wrong way.",
  alt: "A soccer field with a goal, Bo the bear in goal and a player with a ball.",
  bg: sky("#bfe8fb") + cloud(70, 40, 0.7) + cloud(250, 30, 0.5)
    + R(0, 58, W, 88, 0, "#4f6b8a") + range(3).map((r) => range(22).map((i) => C(12 + i * 20 + (r % 2) * 10, 76 + r * 24, 7, ["#ff5c5c", "#ffd21c", "#ffffff", "#4db3f2", "#ff9d3d"][(i + r) % 5])).join("")).join("")
    + R(0, 146, W, 254, 0, "#6fbf4a") + range(6).map((i) => R(i * 80, 146, 40, 254, 0, "#7cc95c")).join("")
    + L("M0 330 Q220 300 440 330", "#ffffff", 3, { opacity: 0.7 }) + E(KICK[0], KICK[1] + 12, 24, 5, "#4f9a3a", { opacity: 0.35 })
    + R(116, 12, 208, 34, 17, "#2d3642") + range(8).map((i) => G(`translate(${136 + i * 24} 29)`, A.scoreDot(false))).join(""),
  parts: [
    { id: "goal", x: 350, y: 304, svg: A.goal() },
    { id: "goalie", x: 350, y: 300, o: "50% 100%", svg: G("scale(0.85)", cast.bear({ pose: "shrug", face: "o" })) },
    ...NET.map((n, i) => ({ id: "b" + (i + 1), x: KICK[0], y: KICK[1], hid: true, svg: A.soccerBall(15) })),
    { id: "kicker", x: 92, y: 366, svg: G("scale(1.1)", cast.kid({ pose: "run", face: "grin", top: "#ff5c5c", bottom: "#ffffff", shoes: "#2d3642" })) },
    { id: "kb", x: KICK[0], y: KICK[1], svg: A.soccerBall(15) },
    ...range(8).map((i) => ({ id: "sc" + (i + 1), x: 136 + i * 24, y: 29, hid: true, svg: A.scoreDot(true) })),
    { id: "cup", x: 220, y: 250, hid: true, svg: A.trophy() },
  ],
  steps: NET.map(([x, y], i) => [
    { a: "hide", id: "kb" }, { a: "show", id: "b" + (i + 1), fx: "fade" }, { a: "move", id: "b" + (i + 1), x: x - KICK[0], y: y - KICK[1] },
    { a: "fx", id: "kicker", fx: "bounce" },
    { a: "move", id: "goalie", x: i % 2 ? 36 : -36, y: 0, r: i % 2 ? 28 : -28 }, { a: "fx", id: "goal", fx: "shake", at: 500 },
    { a: "show", id: "sc" + (i + 1), fx: "pop", at: 600 },
    { a: "move", id: "goalie", x: 0, y: 0, r: 0, at: 1000 }, ...(i < 7 ? [{ a: "show", id: "kb", fx: "pop", at: 1100 }] : []),
  ]),
  finale: [
    { a: "fx", id: "kicker", fx: "hop" }, { a: "fx", id: "goalie", fx: "wiggle", at: 300 },
    ...range(8).map((i) => ({ a: "fx", id: "sc" + (i + 1), fx: "twinkle", at: i * 90 })), { a: "show", id: "cup", fx: "drop", at: 400 },
  ],
  done: { title: "Goal! Eight goals!", sub: "Your words kicked every ball in." },
};

// ── 4. Hoops: every word shoots a basket, swish ──
const HAND = [134, 282], RIM = [326, 150];
const PILE = [[300, 384], [332, 388], [362, 384], [314, 368], [346, 370], [300, 356], [330, 352], [360, 356]];
const hoopsGame = {
  key: "hoops", title: "Hoops", group: "arcade", top: "#fff3e0", bottom: "#f0d2a8",
  sub: "Say it to shoot a basket", playDescription: "Every word shoots the ball through the hoop.",
  how: "Say each word to shoot a basket.", blurb: "Every word shoots the ball through the hoop, and the balls pile up under it.",
  alt: "A gym with a basketball hoop and a player holding a ball.",
  bg: R(0, 0, W, 300, 0, "#ffe9c9") + R(0, 110, W, 16, 0, "#ff9d3d") + R(0, 126, W, 6, 0, "#4db3f2")
    + R(0, 300, W, 100, 0, "#e8b370") + range(12).map((i) => L(`M${i * 40} 300 V400`, "#d9a05a", 2)).join("") + L("M0 340 Q220 320 440 340", "#ffffff", 3, { opacity: 0.8 })
    + R(24, 20, 200, 40, 20, "#2d3642") + range(8).map((i) => G(`translate(${48 + i * 22} 40)`, A.scoreDot(false))).join("")
    + G(at(368, 176, 1), A.backboard()),
  parts: [
    ...PILE.map((p, i) => ({ id: "b" + (i + 1), x: HAND[0], y: HAND[1], hid: true, svg: A.basketball(15) })),
    { id: "net", x: RIM[0], y: RIM[1], o: "50% 0%", svg: A.hoopNet() },
    { id: "rim", x: RIM[0], y: RIM[1], svg: A.hoopRim() },
    { id: "player", x: 96, y: 372, svg: G("scale(1.2)", cast.kid({ pose: "cheer", face: "grin", skin: "c", hair: "#2d2420", style: "curly", top: "#4db3f2", bottom: "#ffffff", shoes: "#ff5c5c" })) },
    { id: "hb", x: HAND[0], y: HAND[1], svg: A.basketball(15) },
    ...range(8).map((i) => ({ id: "sc" + (i + 1), x: 48 + i * 22, y: 40, hid: true, svg: A.scoreDot(true) })),
    { id: "cup", x: 206, y: 250, hid: true, svg: A.trophy() },
  ],
  steps: PILE.map(([x, y], i) => [
    { a: "hide", id: "hb" }, { a: "show", id: "b" + (i + 1), fx: "fade" },
    { a: "move", id: "b" + (i + 1), x: RIM[0] - HAND[0], y: RIM[1] - 70 - HAND[1] },
    { a: "move", id: "b" + (i + 1), x: RIM[0] - HAND[0], y: RIM[1] + 26 - HAND[1], at: 480 }, { a: "fx", id: "net", fx: "shake", at: 560 },
    { a: "show", id: "sc" + (i + 1), fx: "pop", at: 620 }, { a: "move", id: "b" + (i + 1), x: x - HAND[0], y: y - 16 - HAND[1], at: 900 },
    ...(i < 7 ? [{ a: "show", id: "hb", fx: "pop", at: 1150 }] : []),
  ]),
  finale: [
    { a: "fx", id: "player", fx: "hop" }, ...range(8).map((i) => ({ a: "fx", id: "sc" + (i + 1), fx: "twinkle", at: i * 90 })),
    { a: "show", id: "cup", fx: "drop", at: 400 },
  ],
  done: { title: "Swish! Eight baskets!", sub: "Your words sank every shot." },
};

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

// ── 7. Dino Dig: every word brushes the sand off a bone; then the dinosaur wakes up ──
const DIG = [[67, 337, 38], [122, 318, 40], [166, 350, 36], [199, 274, 50], [254, 350, 36], [256, 286, 42], [287, 210, 40], [318, 150, 44]];
const dinoGame = {
  key: "dino", title: "Dino Dig", group: "arcade", top: "#fff3e0", bottom: "#f3d9a8",
  sub: "Say it to dig up a dinosaur", playDescription: "Every word brushes the sand off a dinosaur bone.",
  how: "Say each word to dig up a dinosaur.", blurb: "Every word brushes the sand off another bone, and at the end the dinosaur wakes up.",
  alt: "A sandy cliff with a dinosaur skeleton hidden in the sand.",
  bg: sky("#ffe2b8") + sun(380, 56, 24) + cloud(90, 50, 0.6)
    + P("M0 130 L60 120 L90 96 L150 100 L180 124 L260 118 L300 92 L360 96 L400 122 L440 116 V400 H0 Z", "#e8a868")
    + P("M0 170 Q220 150 440 168 V400 H0 Z", "#f0c890") + L("M0 220 Q220 204 440 220 M0 270 Q220 256 440 272 M0 330 Q220 318 440 334", "#e6b87a", 4)
    + C(60, 200, 4, "#d9a060") + C(400, 250, 5, "#d9a060") + C(380, 360, 4, "#d9a060") + C(30, 300, 3, "#d9a060")
    + R(0, 382, W, 18, 0, "#d9a868")
    // the dig: a darker patch of cliff, so the pale bones show against it
    + P("M24 392 Q14 300 74 276 Q140 250 196 222 Q236 160 276 104 Q324 70 368 110 Q396 150 352 214 Q320 260 346 312 Q372 360 356 392 Z", "#c68b4a", { opacity: 0.55 }),
  parts: [
    { id: "bones", x: 210, y: 376, svg: G("scale(1.1)", A.bones()) },
    { id: "dino", x: 210, y: 376, hid: true, svg: G("scale(1.1)", A.dino()) },
    ...DIG.map(([x, y, r], i) => ({ id: "sand" + (i + 1), x, y, svg: A.sandClump(r) })),
    ...DIG.map(([x, y, r], i) => ({ id: "dust" + (i + 1), x, y, hid: true, svg: A.dustPuff() })),
    { id: "brush", x: 390, y: 330, svg: A.dustBrush() },
    { id: "roar", x: 366, y: 142, hid: true, svg: A.roar() },
  ],
  steps: DIG.map(([x, y], i) => [
    { a: "move", id: "brush", x: x - 390 + 14, y: y - 330 + 10 }, { a: "fx", id: "brush", fx: "shake", at: 300 },
    { a: "hide", id: "sand" + (i + 1), at: 450 }, { a: "show", id: "dust" + (i + 1), fx: "puff", at: 450 }, { a: "hide", id: "dust" + (i + 1), at: 1300 },
  ]),
  finale: [
    { a: "move", id: "brush", x: 0, y: 0 }, { a: "hide", id: "bones", at: 200 }, { a: "show", id: "dino", fx: "pop", at: 300 },
    { a: "fx", id: "dino", fx: "wiggle", at: 1000 }, { a: "show", id: "roar", fx: "fade", at: 1000 },
  ],
  done: { title: "The dinosaur woke up!", sub: "Eight words dug up a whole dinosaur." },
  card: { finale: true },
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

export const BIG = [raceGame, mapGame, soccerGame, hoopsGame, robotGame, castleGame, dinoGame, spaceGame, pizzaGame, monsterGame];
