// Writes every generated Say & Play game page: public/arcade-<key>.html.
//   node tools/gameart/build.mjs            all seventeen
//   node tools/gameart/build.mjs balloon    one game
// The page is generated; the game lives here (little.mjs for ages 3-4,
// big.mjs for ages 5-8), its engine in public/sayplay.js. Hoops, Soccer Goal
// and Dino Dig, the other three, are written by hand (public/arcade-<key>.html
// with hoops.js, soccer.js and dino.js), as are the older arcade pages (slice,
// run, stack, …). Paths are relative to the working
// directory: run it from the repo root (tests/arttooltest.mjs runs it from a
// scratch folder instead).
//
// It overwrites only its own pages: one that exists without page.mjs's MARK
// was written by hand, and a game that reuses its key (Hoops, Soccer Goal and
// Dino Dig were scenes here until each was rebuilt to be played) would clobber it. So it checks every page
// first and writes only if all of them are clean; a refusal touches nothing.
import { existsSync, readFileSync, writeFileSync } from "fs";
import { GAMES } from "./games.mjs";
import { MARK, page } from "./page.mjs";

const refuse = (why) => { console.error("tools/gameart/build.mjs refused: " + why + "\nNothing was written."); process.exit(1); };

const only = process.argv[2];
if (only && !GAMES.some((g) => g.key === only)) refuse("no game called " + only + " in little.mjs or big.mjs.");
const plan = [];
for (const g of GAMES) {
  if (only && g.key !== only) continue;
  const file = "public/arcade-" + g.key + ".html";
  if (existsSync(file) && !readFileSync(file, "utf8").includes(MARK)) refuse(file + " was written by hand (it lacks \"" + MARK + "\"). Give the game another key, or delete it from little.mjs or big.mjs.");
  plan.push([file, page(g)]);
}
for (const [file, html] of plan) writeFileSync(file, html);
console.log("built", plan.length, "games");
