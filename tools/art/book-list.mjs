// Reads the fuller (twelve-page) books out of public/library.html STORIES and
// writes tools/art/books.json: slug, title, sound, opens date, cover alt, and
// each page's line, key word and alt. The picture prompts are built from it.
//   node tools/art/book-list.mjs
import fs from "fs";
import vm from "vm";
const root = new URL("../..", import.meta.url).pathname;
const html = fs.readFileSync(root + "public/library.html", "utf8");
const start = html.indexOf("var STORIES = [");
let i = html.indexOf("[", start), depth = 0, end = i;
for (; end < html.length; end++) { const c = html[end]; if (c === "[") depth++; else if (c === "]" && --depth === 0) break; }
const STORIES = vm.runInNewContext("(" + html.slice(i, end + 1) + ")", {});
const books = STORIES.filter((s) => /\/assets\/books\/[a-z-]+\/cover\.svg$/.test(s.cover || "")).map((s) => ({
  slug: s.cover.split("/")[3], title: s.title, sound: s.sound, opens: s.opens || null,
  coverAlt: s.coverAlt || "", pages: s.pages.map((p, k) => ({ n: k + 1, text: p.t, key: (s.keys || [])[k] || "", alt: p.alt || "" })),
}));
// Out now first, then by the day each one opens.
books.sort((a, b) => (a.opens || "") .localeCompare(b.opens || ""));
fs.writeFileSync(root + "tools/art/books.json", JSON.stringify(books, null, 1) + "\n");
console.log(books.map((b) => `${b.opens || "out now"}  ${b.slug}  (${b.pages.length} pages)`).join("\n"));
