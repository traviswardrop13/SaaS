// ARTTOOL1: the art generators never write over hand-made art.
//
// The family's redesign brief (28 Sep 2026): "Make sure tools/bookart can't
// regenerate book pages over hand-made art." The books and the Say & Play
// games are drawn by code (tools/bookart, tools/gameart), and their redrawn
// art will land one book and one game at a time, in the same folders and
// sometimes under the same names. Rory and the Rainbow was safe only because
// its slug was missing from a list, and Hoops only because its scene had been
// deleted: nothing in the code stopped the next run from drawing over either.
// What this holds:
//   - every fuller book is built or hand-made (tools/bookart/handmade.mjs),
//     never both and never neither, and a book's art in any format but the
//     builder's own .svg belongs to a hand-made book;
//   - what is on disk is exactly what the builders write, byte for byte, and
//     every file they write says so (MARK), while no hand-made file does;
//   - run from a scratch folder, each builder refuses a folder or page holding
//     anything it did not write (new .webp art, an unmarked page, a page an
//     editor re-saved), plans every file before writing any, and so leaves
//     everything as it found it; cards.mjs likewise for new Home card art.
// Node only: no browser. The builders write relative to their working
// directory, so the refusals are run in a temp folder, never in public/.
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { BOOKS1 } from "../tools/bookart/books1.mjs";
import { BOOKS2 } from "../tools/bookart/books2.mjs";
import { HANDMADE } from "../tools/bookart/handmade.mjs";
import { MARK as BOOK_MARK, bookFiles, builtHere } from "../tools/bookart/book.mjs";
import { GAMES, PLAYED } from "../tools/gameart/games.mjs";
import { MARK as PAGE_MARK, page as pageFor } from "../tools/gameart/page.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = REPO + "/public";
const BOOK_TOOL = REPO + "/tools/bookart/build.mjs", GAME_TOOL = REPO + "/tools/gameart/build.mjs", CARD_TOOL = REPO + "/tools/gameart/cards.mjs";

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };
const art = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith(".")).sort() : []); // .DS_Store is Finder's, not art
const walk = (dir, pre = "") => readdirSync(dir).flatMap((f) => (statSync(dir + "/" + f).isDirectory() ? walk(dir + "/" + f, pre + f + "/") : [pre + f])).sort();
const temps = [];
const scratch = () => { const d = mkdtempSync(path.join(tmpdir(), "arttool-")); temps.push(d); return d; };
const run = (tool, cwd, ...args) => spawnSync(process.execPath, [tool, ...args], { cwd, encoding: "utf8", timeout: 60000 });
const put = (file, body) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, body); };

// ── BOOKS ──
const BUILT = [...BOOKS1, ...BOOKS2];
const built = new Set(BUILT.map((b) => b.slug)), hand = new Set(HANDMADE);
const lib = readFileSync(PUB + "/library.html", "utf8");
const paths = [...new Set([...lib.matchAll(/\/assets\/books\/([a-z0-9-]+)\/([^"'\s)]+)/g)].map((m) => m[0]))];
const shelf = [...new Set(paths.map((p) => p.split("/")[3]))];

ok("every fuller book on the shelf is built by tools/bookart or listed in handmade.mjs, never both and never neither",
  shelf.length >= 19 && shelf.every((s) => built.has(s) !== hand.has(s)),
  shelf.filter((s) => built.has(s) === hand.has(s)).map((s) => s + (built.has(s) ? " (both)" : " (neither)")).join(", "));
ok("…and nothing is built or declared hand-made that the shelf doesn't carry", [...built, ...hand].every((s) => shelf.includes(s)),
  [...built, ...hand].filter((s) => !shelf.includes(s)).join(", "));
ok("Rory and the Rainbow is hand-made, so the builder never writes it", hand.has("rory-rainbow") && !built.has("rory-rainbow"));
// Every page that shows a book's art, not only the shelf: parents.html tiles
// the covers too, and when a book's new art lands its old .svg files go (a
// hand-made folder may not hold the builder's pictures, below), so a page
// still pointing at one would show a broken picture.
{
  const pages = readdirSync(PUB).filter((f) => /\.(html|js)$/.test(f));
  const refs = [...new Set(pages.flatMap((f) => [...readFileSync(PUB + "/" + f, "utf8").matchAll(/\/assets\/books\/[a-z0-9-]+\/[^"'\s)]+/g)].map((m) => f + " " + m[0])))];
  const target = (r) => r.split(" ")[1];
  ok("a book's art in anything but the builder's .svg belongs to a hand-made book, on every page that shows it (new art wired to a book still being built would ship beside the old)",
    refs.length > paths.length && refs.every((r) => target(r).endsWith(".svg") || hand.has(target(r).split("/")[3])),
    refs.filter((r) => !target(r).endsWith(".svg") && !hand.has(target(r).split("/")[3])).join(", "));
  ok("…and every book picture any page points at is on disk", refs.every((r) => existsSync(PUB + target(r))), refs.filter((r) => !existsSync(PUB + target(r))).slice(0, 6).join(", "));
}
{
  const drift = [];
  for (const b of BUILT) {
    const want = bookFiles(b), dir = PUB + "/assets/books/" + b.slug;
    if (art(dir).join() !== want.map(([n]) => n).join()) { drift.push(b.slug + ": holds " + art(dir).join(" ")); continue; }
    for (const [n, svg] of want) if (readFileSync(dir + "/" + n, "utf8") !== svg) drift.push(b.slug + "/" + n);
  }
  ok("every built book's folder is exactly what tools/bookart/build.mjs writes, byte for byte (edit the layout there, then rebuild)", drift.length === 0, drift.slice(0, 6).join(" | "));
  ok("…and every file it writes opens with its marker, right after the <svg> tag, where build.mjs looks for it",
    BUILT.every((b) => bookFiles(b).every(([, svg]) => svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"') && builtHere(svg))));
  ok("…and a copy of its page re-saved by an editor (an <?xml> header, the tag reflowed) no longer counts as its own, though the marker is still inside",
    (() => { const svg = bookFiles(BUILT[0])[1][1]; const resaved = '<?xml version="1.0" encoding="UTF-8"?>\n' + svg, reflowed = svg.replace(BOOK_MARK, "\n  " + BOOK_MARK);
      return resaved.includes(BOOK_MARK) && reflowed.includes(BOOK_MARK) && !builtHere(resaved) && !builtHere(reflowed) && !builtHere(""); })());
  const marked = HANDMADE.flatMap((s) => art(PUB + "/assets/books/" + s).filter((f) => readFileSync(PUB + "/assets/books/" + s + "/" + f).includes(BOOK_MARK)).map((f) => s + "/" + f));
  ok("no hand-made book's file says the builder wrote it", HANDMADE.every((s) => art(PUB + "/assets/books/" + s).length > 0) && marked.length === 0, marked.join(", ") || "a hand-made folder is empty");
}

// the builder, run where it can do no harm
{
  const d = scratch();
  const r = run(BOOK_TOOL, d);
  const out = d + "/public/assets/books";
  const same = r.status === 0 && BUILT.every((b) => bookFiles(b).every(([n, svg]) => existsSync(out + "/" + b.slug + "/" + n) && readFileSync(out + "/" + b.slug + "/" + n, "utf8") === svg));
  ok("run on an empty folder, the book builder writes every built book and nothing else", same && readdirSync(out).sort().join() === [...built].sort().join(), r.stderr || r.stdout);
  put(out + "/kip-kite/.DS_Store", "finder");
  const again = run(BOOK_TOOL, d);
  ok("…and runs again over its own pictures (and Finder's .DS_Store) without a word", again.status === 0 && /built 18 books/.test(again.stdout), again.stderr);
}
function refusal(label, seeds, args, expect) {
  const d = scratch();
  for (const [f, body] of Object.entries(seeds)) put(d + "/" + f, body);
  const before = walk(d);
  const r = run(BOOK_TOOL, d, ...args);
  const untouched = Object.entries(seeds).every(([f, body]) => readFileSync(d + "/" + f, "utf8") === body);
  ok(label, r.status !== 0 && walk(d).join() === before.join() && untouched && expect.test(r.stderr),
    JSON.stringify({ status: r.status, wrote: walk(d).filter((f) => !before.includes(f)).slice(0, 3), untouched, stderr: r.stderr.slice(0, 240) }));
}
const stale = '<svg xmlns="http://www.w3.org/2000/svg">' + BOOK_MARK + "an older build</svg>\n";
refusal("the book builder refuses a folder where new art has landed (bo-beach-day/p01.webp): it names the file, says how to fix it, and writes nothing, not even the book before it",
  { "public/assets/books/penny-pebble-party/cover.svg": stale, "public/assets/books/bo-beach-day/p01.webp": "RIFF\0\0\0\0WEBPVP8 hand-made" }, [],
  /bo-beach-day\/p01\.webp[\s\S]*handmade\.mjs[\s\S]*Nothing was written/);
refusal("…and a page drawn by hand under the builder's own name (a p01.svg without its marker)",
  { "public/assets/books/penny-pebble-party/cover.svg": stale, "public/assets/books/bo-beach-day/p01.svg": '<svg xmlns="http://www.w3.org/2000/svg"><circle r="9"/></svg>\n' }, [],
  /bo-beach-day\/p01\.svg[\s\S]*marker[\s\S]*Nothing was written/);
refusal("…and an old page redrawn in an editor that kept the marker comment but wrote its own header",
  { "public/assets/books/penny-pebble-party/cover.svg": stale, "public/assets/books/bo-beach-day/p02.svg": '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Created with Inkscape -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 400">\n  ' + BOOK_MARK + '\n  <circle r="9"/>\n</svg>\n' }, [],
  /bo-beach-day\/p02\.svg[\s\S]*marker[\s\S]*Nothing was written/);
refusal("…and a cover.png beside its pages", { "public/assets/books/kip-kite/cover.png": "\x89PNG hand-made" }, [], /kip-kite\/cover\.png/);
refusal("asked for a hand-made book by name, it refuses instead of printing \"built 0 books\"", {}, ["rory-rainbow"], /rory-rainbow is drawn by hand/);
refusal("…and a book it doesn't know", {}, ["no-such-book"], /no book called no-such-book/);
{
  const d = scratch();
  const r = run(BOOK_TOOL, d, "kip-kite");
  ok("asked for one built book, it writes that book only", r.status === 0 && readdirSync(d + "/public/assets/books").join() === "kip-kite" && /built 1 books/.test(r.stdout), r.stderr);
}

// ── GAMES ──
const KEYS = new Set(GAMES.map((g) => g.key));
{
  const pages = readdirSync(PUB).filter((f) => /^arcade-[a-z]+\.html$/.test(f));
  const bad = pages.filter((f) => {
    const key = f.slice(7, -5), html = readFileSync(PUB + "/" + f, "utf8");
    return KEYS.has(key) ? html !== pageFor(GAMES.find((g) => g.key === key)) : html.includes(PAGE_MARK);
  });
  ok("every arcade page is exactly the game builder's output for one of its games, or is written by hand and doesn't claim otherwise", pages.length >= GAMES.length && bad.length === 0, bad.join(", "));
  ok("…every generated game has its page", GAMES.every((g) => pages.includes("arcade-" + g.key + ".html")));
  ok("Hoops is written by hand, and the builder has no game by its name", !KEYS.has("hoops") && existsSync(PUB + "/arcade-hoops.html") && !readFileSync(PUB + "/arcade-hoops.html", "utf8").includes(PAGE_MARK));
}
ok("every generated game's start card says \"Let's play\" on a teal pill, beside the play triangle for a child who can't read yet",
  GAMES.every((g) => { const h = pageFor(g); return /<link href="\/action\.css" rel="stylesheet">/.test(h) && /<button id="startBtn" class="act-pill"><svg [^>]*aria-hidden="true">[\s\S]*?<\/svg><span>Let's play<\/span><\/button>/.test(h) && !/id="startBtn"[^>]*aria-label/.test(h); }));

// Home's cards: cards.mjs is a fixed point of what ships, and a hand-drawn card is never written over
{
  const sheet = readFileSync(PUB + "/assets/sona-stickers.svg", "utf8");
  const d = scratch();
  put(d + "/public/assets/sona-stickers.svg", sheet);
  const r = run(CARD_TOOL, d);
  const cards = r.status === 0 ? readdirSync(d + "/public/assets/games").sort() : [];
  const drift = cards.filter((f) => !existsSync(PUB + "/assets/games/" + f) || readFileSync(PUB + "/assets/games/" + f, "utf8") !== readFileSync(d + "/public/assets/games/" + f, "utf8"));
  ok("the Home cards and their sticker groups are exactly what tools/gameart/cards.mjs writes (edit a card there, then rerun it)",
    r.status === 0 && readFileSync(d + "/public/assets/sona-stickers.svg", "utf8") === sheet && drift.length === 0, r.stderr || drift.join(", ") || "the sticker sheet's generated block differs");
  const handCards = PLAYED.every(([k, file]) => !cards.includes(k + ".svg") && existsSync(PUB + file)
    && (sheet.match(new RegExp('<g id="sp-' + k + '"', "g")) || []).length === 1 && sheet.includes('<g id="sp-' + k + '"><image href="' + file + '"'));
  ok("a hand-drawn Home card (games.mjs PLAYED) gets one sticker, pointing at its own picture, and no generated card", PLAYED.length > 0 && handCards);
  // new card art for a game it still draws: it stops before writing a card or the sheet
  const e = scratch(), seeded = { "public/assets/sona-stickers.svg": sheet, "public/assets/games/balloon.webp": "RIFF\0\0\0\0WEBPVP8 hand-made", "public/assets/games/rocket.svg": "<svg>an older card</svg>\n" };
  for (const [f, body] of Object.entries(seeded)) put(e + "/" + f, body);
  const before = walk(e), r2 = run(CARD_TOOL, e);
  ok("cards.mjs refuses when a game it still draws has a new card picture (balloon.webp) beside its scene, and writes nothing: no card, no sticker sheet",
    r2.status !== 0 && walk(e).join() === before.join() && Object.entries(seeded).every(([f, body]) => readFileSync(e + "/" + f, "utf8") === body)
    && /balloon\.webp[\s\S]*PLAYED[\s\S]*Nothing was written/.test(r2.stderr), JSON.stringify({ status: r2.status, stderr: r2.stderr.slice(0, 240) }));
}

// the game builder, run where it can do no harm
{
  const d = scratch();
  mkdirSync(d + "/public");
  const r = run(GAME_TOOL, d);
  ok("run on an empty folder, the game builder writes every generated game's page and nothing else",
    r.status === 0 && readdirSync(d + "/public").sort().join() === GAMES.map((g) => "arcade-" + g.key + ".html").sort().join()
    && GAMES.every((g) => readFileSync(d + "/public/arcade-" + g.key + ".html", "utf8") === pageFor(g)), r.stderr);
  const again = run(GAME_TOOL, d);
  ok("…and runs again over its own pages", again.status === 0 && /built 19 games/.test(again.stdout), again.stderr);
}
function gameRefusal(label, seeds, args, expect) {
  const d = scratch();
  mkdirSync(d + "/public");
  for (const [f, body] of Object.entries(seeds)) put(d + "/" + f, body);
  const before = walk(d);
  const r = run(GAME_TOOL, d, ...args);
  const untouched = Object.entries(seeds).every(([f, body]) => readFileSync(d + "/" + f, "utf8") === body);
  ok(label, r.status !== 0 && walk(d).join() === before.join() && untouched && expect.test(r.stderr),
    JSON.stringify({ status: r.status, wrote: walk(d).filter((f) => !before.includes(f)).slice(0, 3), untouched, stderr: r.stderr.slice(0, 240) }));
}
const handPage = "<!DOCTYPE html>\n<!-- Written by hand, not by the generator -->\n<canvas id=\"court\"></canvas>\n";
gameRefusal("the game builder refuses to overwrite a page written by hand (arcade-balloon.html without its marker), and writes nothing",
  { "public/arcade-balloon.html": handPage }, [], /arcade-balloon\.html was written by hand[\s\S]*Nothing was written/);
gameRefusal("…checking every page before writing any, so a hand page last in the list still stops the first",
  { "public/arcade-balloon.html": "<!-- " + PAGE_MARK + " -->an older build\n", "public/arcade-monster.html": handPage }, [], /arcade-monster\.html was written by hand/);
gameRefusal("…and a game it doesn't build, such as Hoops", {}, ["hoops"], /no game called hoops/);

for (const d of temps) rmSync(d, { recursive: true, force: true });
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
