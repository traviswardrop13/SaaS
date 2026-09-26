// Home's card picture for every Say & Play game: the scene the child builds,
// drawn as it looks once every word is said, cropped square.
//   node tools/gameart/cards.mjs
// writes public/assets/games/<key>.svg and the sp-<key> groups in the sticker
// sheet (public/assets/sona-stickers.svg), which Home paints like every other
// game card (Sona.gameSticker). The prefix is sp- (Say & Play), not the
// scene stickers' st-: Flappy Glide already wears st-balloon. A card is an
// <image> of its file rather than the scene pasted into the sheet: twenty
// scenes would triple the sheet every page loads, and a card file is fetched
// only where a card is shown.
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { GAMES } from "./games.mjs";
import { check } from "./page.mjs";

const SHEET = "public/assets/sona-stickers.svg";
const OPEN = "<!-- Say & Play game cards: written by tools/gameart/cards.mjs -->", CLOSE = "<!-- /Say & Play game cards -->";

// the scene after every step (or the finale too), with moves baked in; a
// part's turn and size change are taken around its own (0, 0), which is where
// each part is drawn from
export function finalScene(g, withFinale = false) {
  const st = {};
  for (const p of g.parts) st[p.id] = { x: 0, y: 0, s: p.s ?? 1, r: p.r ?? 0, hid: !!p.hid, gone: false };
  const apply = (list) => list.slice().sort((a, b) => (a.at || 0) - (b.at || 0)).forEach((a) => {
    const p = st[a.id];
    if (a.a === "show") { p.hid = false; p.gone = a.fx === "puff"; }
    else if (a.a === "hide") p.gone = true;
    else if (a.a === "move") { p.x = a.x; p.y = a.y; if (a.s != null) p.s = a.s; if (a.r != null) p.r = a.r; }
    else if (a.a === "by") { p.x += a.x || 0; p.y += a.y || 0; }
    else if (a.a === "scale") p.s = a.s;
    else if (a.a === "turn") p.r = a.r;
  });
  g.steps.forEach(apply);
  if (withFinale) apply(g.finale);
  return g.bg + g.parts.map((p) => {
    const q = st[p.id];
    if (q.hid || q.gone) return "";
    return `<g transform="translate(${p.x + q.x} ${p.y + q.y}) rotate(${q.r}) scale(${q.s})">${p.svg}</g>`;
  }).join("") + (g.fg || "");
}

mkdirSync("public/assets/games", { recursive: true });
const groups = [];
for (const g of GAMES) {
  check(g);
  const [x, y, size] = (g.card && g.card.crop) || [20, 0, 400];
  writeFileSync(`public/assets/games/${g.key}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${size} ${size}" width="240" height="240">${finalScene(g, g.card && g.card.finale)}</svg>\n`);
  groups.push(`<g id="sp-${g.key}"><image href="/assets/games/${g.key}.svg" xlink:href="/assets/games/${g.key}.svg" width="120" height="120" preserveAspectRatio="xMidYMid slice"></image></g>`);
}
let sheet = readFileSync(SHEET, "utf8");
const block = OPEN + "\n" + groups.join("\n") + "\n" + CLOSE + "\n";
const a = sheet.indexOf(OPEN), b = sheet.indexOf(CLOSE);
sheet = a >= 0 ? sheet.slice(0, a) + block + sheet.slice(b + CLOSE.length + 1) : sheet.replace("</defs></svg>", block + "</defs></svg>");
writeFileSync(SHEET, sheet);
console.log("wrote", groups.length, "game cards");
