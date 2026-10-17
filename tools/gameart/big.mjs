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

// Space Trip is now a hand-built piloting game in public/space.js.

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

export const BIG = [ monsterGame];
