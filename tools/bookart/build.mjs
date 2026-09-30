// Writes every generated fuller book's pictures to public/assets/books/<slug>/:
// cover.svg (440 x 440) and p01.svg … p12.svg (440 x 400), as book.mjs lays
// them out. Paths are relative to the working directory, so run it from the
// repo root (tests/arttooltest.mjs runs it from a scratch folder instead).
//   node tools/bookart/build.mjs            all books
//   node tools/bookart/build.mjs kip-kite   one book
//
// It must never draw over hand-made art (the redesign brief, 28 Sep 2026:
// "make sure tools/bookart can't regenerate book pages over hand-made art").
// So it plans every file first and writes only if the whole plan is clean: a
// refusal touches nothing, not even the books before the one it refused. It
// refuses
//   - a book that is also in handmade.mjs (Rory, and each book whose redrawn
//     art has landed): one folder, one author;
//   - a slug it doesn't build, hand-made or misspelt, which used to print
//     "built 0 books" and exit 0 as if it had worked;
//   - a folder holding anything it did not write: a file that isn't
//     cover.svg or pNN.svg (p01.webp, cover.png: new art has landed, and old
//     pages written beside it would keep shipping wherever a path still says
//     .svg), or an .svg that doesn't open with the builder's own tag and
//     MARK (drawn by hand under the builder's name, or an old page redrawn in
//     an editor: see builtHere() in book.mjs).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { BOOKS1 } from "./books1.mjs";
import { BOOKS2 } from "./books2.mjs";
import { HANDMADE } from "./handmade.mjs";
import { bookFiles, builtHere } from "./book.mjs";

const refuse = (why) => { console.error("tools/bookart/build.mjs refused: " + why + "\nNothing was written."); process.exit(1); };
const HOWTO = "If it is the book's new art, add the slug to tools/bookart/handmade.mjs and delete the book from books1.mjs or books2.mjs in the same commit; if it is stray, remove it.";

const only = process.argv[2];
const BUILT = [...BOOKS1, ...BOOKS2];
const both = BUILT.map((b) => b.slug).filter((s) => HANDMADE.includes(s));
if (both.length) refuse(both.join(", ") + " is in handmade.mjs and in books1.mjs/books2.mjs. A hand-made book is never built: delete it from books1.mjs or books2.mjs.");
if (only && !BUILT.some((b) => b.slug === only)) refuse(HANDMADE.includes(only) ? only + " is drawn by hand (tools/bookart/handmade.mjs); nothing here writes it." : "no book called " + only + " in books1.mjs or books2.mjs.");

const plan = [];
for (const b of BUILT) {
  if (only && b.slug !== only) continue;
  const dir = "public/assets/books/" + b.slug;
  if (existsSync(dir)) for (const f of readdirSync(dir).sort()) {
    if (f.startsWith(".")) continue; // .DS_Store and the like: Finder's, not art
    if (!/^(cover|p\d\d)\.svg$/.test(f)) refuse(dir + "/" + f + " is not a page this builder writes. " + HOWTO);
    if (!builtHere(readFileSync(dir + "/" + f, "utf8"))) refuse(dir + "/" + f + " was not written by this builder, or was edited since (it doesn't open with the builder's <svg> tag and marker). " + HOWTO);
  }
  plan.push([dir, bookFiles(b)]);
}
for (const [dir, files] of plan) {
  mkdirSync(dir, { recursive: true });
  for (const [name, svg] of files) writeFileSync(dir + "/" + name, svg);
}
console.log("built", plan.length, "books");
