// Puts a redrawn book into the app: its cut pages replace the builder's .svg
// files, every page that pointed at them points at the .webp, and the book
// moves from tools/bookart (books1/books2) to HANDMADE — the rule in
// tools/bookart/handmade.mjs, all in one commit.
//   node tools/art/wire-books.mjs rory-rainbow,sid-the-seagull
import fs from "fs";
import path from "path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const slugs = (process.argv[2] || "").split(",").filter(Boolean);
if (!slugs.length) { console.error("usage: wire-books.mjs slug1,slug2"); process.exit(1); }
const read = (f) => fs.readFileSync(path.join(root, f), "utf8"), write = (f, s) => fs.writeFileSync(path.join(root, f), s);
const PAGES = ["cover", ...Array.from({ length: 12 }, (_, i) => "p" + String(i + 1).padStart(2, "0"))];

for (const slug of slugs) {
  const cut = path.join(root, "tools/art/out/books", slug, "cut"), dir = path.join(root, "public/assets/books", slug);
  const missing = PAGES.filter((p) => !fs.existsSync(path.join(cut, p + ".webp")));
  if (missing.length) { console.error(`${slug}: not cut yet (${missing.join(",")})`); process.exit(1); }
  for (const f of fs.readdirSync(dir)) if (f.endsWith(".svg")) fs.unlinkSync(path.join(dir, f));
  for (const p of PAGES) fs.copyFileSync(path.join(cut, p + ".webp"), path.join(dir, p + ".webp"));
  // every family page that names this book's pictures
  for (const f of ["public/library.html", "public/parents.html"]) {
    const s = read(f), t = s.replace(new RegExp("(/assets/books/" + slug + "/(?:cover|p\\d\\d))\\.svg", "g"), "$1.webp");
    if (t !== s) write(f, t);
  }
  // out of the builder, into HANDMADE
  for (const f of ["tools/bookart/books1.mjs", "tools/bookart/books2.mjs"]) {
    const s = read(f), m = s.match(new RegExp("export const (\\w+) = \\{\\s*slug: \"" + slug + "\""));
    if (!m) continue;
    const t = s.replace(/(export const BOOKS[12] = \[)([^\]]*)\]/, (all, head, list) => head + list.split(",").map((x) => x.trim()).filter((x) => x !== m[1]).join(", ") + "]");
    write(f, t);
  }
  const h = read("tools/bookart/handmade.mjs");
  if (!h.includes(`"${slug}"`)) write("tools/bookart/handmade.mjs", h.replace(/export const HANDMADE = \[([^\]]*)\]/, (all, list) => `export const HANDMADE = [${list}, "${slug}"]`));
  console.log("wired", slug);
}
const left = (read("public/library.html").match(/\/assets\/books\/[a-z-]+\/(?:cover|p\d\d)\.svg/g) || []).length;
console.log(`${left} old .svg book pictures still on the shelf`);
