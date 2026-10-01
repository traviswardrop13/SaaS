// Builds the book-art review page: tools/art/review/out/index.html plus
// small .webp copies of every page under out/img/. Flags people leave on
// the page live in the artifact's db (collection "flags"), not here.
//   node tools/art/review/build.mjs
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
const here = path.dirname(new URL(import.meta.url).pathname), art = path.resolve(here, "..");
const out = path.join(here, "out"); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out + "/img", { recursive: true });
const books = JSON.parse(fs.readFileSync(art + "/books.json", "utf8"));
const prompts = Object.fromEntries(JSON.parse(fs.readFileSync(art + "/book-prompts.json", "utf8")).map((p) => [p.slug, p]));
const checks = fs.existsSync(art + "/out/checks.json") ? JSON.parse(fs.readFileSync(art + "/out/checks.json", "utf8")) : {};
const PARTS = ["cover", ...Array.from({ length: 12 }, (_, i) => "p" + String(i + 1).padStart(2, "0"))];
const py = [];
for (const b of books) for (const p of PARTS) py.push([path.join(art, "out/books", b.slug, "cut", p + ".webp"), path.join(out, "img", b.slug + "-" + p + ".webp")]);
const r = spawnSync("python3", ["-c", `
import json,sys
from PIL import Image
for a,b in json.loads(sys.argv[1]):
    im=Image.open(a).convert("RGB"); im.thumbnail((360,360)); im.save(b,"WEBP",quality=70,method=6)`, JSON.stringify(py)]);
if (r.status) { console.error(String(r.stderr)); process.exit(1); }
const data = books.map((b) => ({
  slug: b.slug, title: b.title, sound: b.sound, opens: b.opens,
  notes: (prompts[b.slug] || {}).notes || "",
  check: checks[b.slug] || null,
  pages: b.pages.map((p) => ({ n: p.n, text: p.text, key: p.key })),
}));
// The pictures ride inside the page as data: URLs, so it publishes as one file.
const IMG = {};
for (const [, b] of py) IMG[path.basename(b, ".webp")] = "data:image/webp;base64," + fs.readFileSync(b).toString("base64");
const tpl = fs.readFileSync(path.join(here, "template.html"), "utf8");
fs.writeFileSync(path.join(out, "index.html"), tpl.replace("/*DATA*/[]", JSON.stringify(data)).replace("/*IMG*/{}", JSON.stringify(IMG)));
console.log(`review page: ${data.length} books, ${py.length} pictures -> ${out}`);
