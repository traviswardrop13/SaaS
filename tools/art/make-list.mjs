// Builds art-list.csv: one row per practice word in sona.js WORDS, marking
// which already have a picture in public/coach/items/. Games AND book pages
// both read that folder (sona.js wordPic), so one file per word covers both.
//   node tools/art/make-list.mjs
import fs from "fs";
import path from "path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const src = fs.readFileSync(path.join(root, "public/sona.js"), "utf8");
const start = src.indexOf("const WORDS = {");
const block = src.slice(start, src.indexOf("\n  };", start));
const slug = (w) => w.toLowerCase().replace(/[^a-z0-9]+/g, "");
const rows = new Map();
let sound = "";
for (const line of block.split("\n")) {
  const s = line.match(/^\s{4}([A-Z]+): \[/); if (s) sound = s[1];
  for (const m of line.matchAll(/\{ w: "([^"]+)", e: "([^"]+)"[^}]*pos: "([a-z])"/g)) {
    const key = slug(m[1]);
    if (!rows.has(key)) rows.set(key, { word: m[1], key, emoji: m[2], sounds: new Set(), initial: false });
    const r = rows.get(key); r.sounds.add(sound); if (m[3] === "i") r.initial = true;
  }
}
const have = (k) => fs.existsSync(path.join(root, "public/coach/items", k + ".png"));
// Initial-position words first: the games lean on them most.
const list = [...rows.values()].sort((a, b) => (b.initial - a.initial) || a.key.localeCompare(b.key));
const csv = ["key,word,emoji,sounds,priority,status"].concat(list.map((r) =>
  [r.key, r.word, r.emoji, [...r.sounds].join(" "), r.initial ? "1-first" : "2-later", have(r.key) ? "done" : "todo"].join(",")));
fs.writeFileSync(path.join(root, "tools/art/art-list.csv"), csv.join("\n") + "\n");
const todo = list.filter((r) => !have(r.key)).length;
console.log(`${list.length} words, ${todo} still need a picture (${list.filter((r) => r.initial && !have(r.key)).length} are first-priority).`);
