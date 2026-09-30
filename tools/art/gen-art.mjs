// Batch-generates word pictures from art-list.csv with OpenAI's image API,
// keys them to transparency and drops them in public/coach/items/<key>.png,
// where games and book pages pick them up with no code change.
//
//   OPENAI_API_KEY=sk-... node tools/art/gen-art.mjs            # all "todo" rows
//   ... node tools/art/gen-art.mjs --only 1-first --limit 10   # a small test run
//   ... node tools/art/gen-art.mjs --redo rabbit,rocket         # regenerate rejects
//
// Every call sends the same STYLE text plus style-ref*.png images from this
// folder, so 300 pictures come out looking like one set rather than 300 moods.
// Raw generations land in tools/art/out/ first; open out/review.html to check.
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../..");
const arg = (n) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : null; };
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error("Set OPENAI_API_KEY first (platform.openai.com → API keys)."); process.exit(1); }
const MODEL = process.env.ART_MODEL || "gpt-image-1";
const QUALITY = process.env.ART_QUALITY || "medium"; // low | medium | high — cost rises with it
const PARALLEL = Number(arg("parallel") || 4);

const STYLE = fs.readFileSync(path.join(here, "style.txt"), "utf8").trim();
const refs = fs.readdirSync(here).filter((f) => /^style-ref.*\.png$/i.test(f)).map((f) => path.join(here, f));

const rows = fs.readFileSync(path.join(here, "art-list.csv"), "utf8").trim().split("\n").slice(1)
  .map((l) => { const [key, word, emoji, sounds, priority, status] = l.split(","); return { key, word, priority, status }; });
const redo = arg("redo") ? arg("redo").split(",") : null;
let jobs = redo ? rows.filter((r) => redo.includes(r.key)) : rows.filter((r) => r.status === "todo");
if (arg("only")) jobs = jobs.filter((r) => r.priority === arg("only"));
if (arg("limit")) jobs = jobs.slice(0, Number(arg("limit")));

const out = path.join(here, "out"); fs.mkdirSync(out, { recursive: true });
const prompt = (w) => `${STYLE}\n\nThe object: a single ${w}. Just the ${w}, nothing else in the picture.`;

async function one(r) {
  let res;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (refs.length) {
      // With reference images: the "edits" endpoint copies their style.
      const fd = new FormData();
      fd.append("model", MODEL); fd.append("prompt", prompt(r.word)); fd.append("size", "1024x1024"); fd.append("quality", QUALITY);
      for (const f of refs) fd.append("image[]", new Blob([fs.readFileSync(f)], { type: "image/png" }), path.basename(f));
      res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: "Bearer " + KEY }, body: fd });
    } else {
      res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST", headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, prompt: prompt(r.word), size: "1024x1024", quality: QUALITY }),
      });
    }
    if (res.ok) break;
    const body = await res.text();
    if (res.status !== 429 && res.status < 500) throw new Error(res.status + " " + body.slice(0, 200));
    await new Promise((ok) => setTimeout(ok, 5000 * attempt)); // rate limited: back off and retry
  }
  if (!res.ok) throw new Error("gave up after 3 tries (" + res.status + ")");
  const b64 = (await res.json()).data[0].b64_json;
  const raw = path.join(out, r.key + ".png");
  fs.writeFileSync(raw, Buffer.from(b64, "base64"));
  // Green background → transparent, trimmed, 512px: the same keyer the manifest names.
  execFileSync("node", [path.join(root, "scripts/key-pose.js"), raw, path.join(root, "public/coach/items", r.key + ".png"), "512"]);
}

console.log(`${jobs.length} pictures, ${PARALLEL} at a time, model ${MODEL} (${QUALITY}), ${refs.length} style reference(s).`);
let done = 0; const failed = [];
const queue = [...jobs];
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  for (let r; (r = queue.shift());) {
    try { await one(r); done++; console.log(`✓ ${r.key}  (${done}/${jobs.length})`); }
    catch (e) { failed.push(r.key); console.log(`✗ ${r.key}: ${e.message}`); }
  }
}));

// Contact sheet: every finished picture on one page, name under each.
const all = rows.filter((r) => fs.existsSync(path.join(root, "public/coach/items", r.key + ".png")));
fs.writeFileSync(path.join(out, "review.html"), `<!doctype html><meta charset=utf-8><title>Sona art review</title>
<style>body{font:14px system-ui;background:#f4f1ea;margin:16px}div{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}
figure{margin:0;background:#fff;border-radius:12px;padding:8px;text-align:center}img{width:100%;aspect-ratio:1;object-fit:contain}</style>
<h1>${all.length} pictures</h1><p>Write down the names of any bad ones, then: <code>node tools/art/gen-art.mjs --redo name1,name2</code></p><div>
${all.map((r) => `<figure><img src="../../../public/coach/items/${r.key}.png"><figcaption>${r.key}</figcaption></figure>`).join("\n")}</div>`);
execFileSync("node", [path.join(here, "make-list.mjs")], { stdio: "inherit" });
console.log(`Done: ${done} made, ${failed.length} failed${failed.length ? " (" + failed.join(",") + ")" : ""}. Review: tools/art/out/review.html`);
