// Writes every fuller book's pictures to public/assets/books/<slug>/:
// cover.svg (440 x 440) and p01.svg … p12.svg (440 x 400).
//   node tools/bookart/build.mjs            all books
//   node tools/bookart/build.mjs kip-kite   one book
// Rory and the Rainbow is not built here: its pages were drawn by hand on the
// Claude Design canvas and live in public/assets/books/rory-rainbow/ as is.
import { mkdirSync, writeFileSync } from "fs";
import { BOOKS1 } from "./books1.mjs";
import { BOOKS2 } from "./books2.mjs";

const only = process.argv[2];
const wrap = (inner, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 ${h}" width="440" height="${h}">${inner}</svg>\n`;
let n = 0;
for (const b of [...BOOKS1, ...BOOKS2]) {
  if (only && b.slug !== only) continue;
  if (b.pages.length !== 12) throw new Error(b.slug + " has " + b.pages.length + " pages");
  const dir = "public/assets/books/" + b.slug;
  mkdirSync(dir, { recursive: true });
  writeFileSync(dir + "/cover.svg", wrap(b.cover(), 440));
  b.pages.forEach((fn, i) => writeFileSync(dir + "/p" + String(i + 1).padStart(2, "0") + ".svg", wrap(fn(), 400)));
  n++;
}
console.log("built", n, "books");
