// Writes every Say & Play game page: public/arcade-<key>.html.
//   node tools/gameart/build.mjs            all twenty
//   node tools/gameart/build.mjs balloon    one game
// The page is generated; the game lives here (little.mjs for ages 3-4,
// big.mjs for ages 5-8), its engine in public/sayplay.js.
import { writeFileSync } from "fs";
import { GAMES } from "./games.mjs";
import { page } from "./page.mjs";

const only = process.argv[2];
let n = 0;
for (const g of GAMES) {
  if (only && g.key !== only) continue;
  writeFileSync("public/arcade-" + g.key + ".html", page(g));
  n++;
}
console.log("built", n, "games");
