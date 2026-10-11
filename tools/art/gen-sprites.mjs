// Draws the in-game pieces listed in game-sprites.json (a ball, tiles, a star…)
// in the approved style, transparent where the game lays them over its scene.
//   NODE_USE_ENV_PROXY=1 node tools/art/gen-sprites.mjs [name,name] [--dry]
// --dry prints the pictures and the mask each entry would send, and sends nothing.
//
// An entry may also carry (11 Oct 2026, for the buddies and the scene edits):
//   refs: [path, …]  more reference pictures, from the repo root, sent after
//                    `ref` in this order. A prompt names them by position ("the
//                    first picture", "the second picture"), so an entry with
//                    `refs` and no `ref` sends its refs alone, never the shared
//                    style picture in front of them. One model sheet per buddy
//                    rides along with every pose of that buddy, the way
//                    gen-books.mjs attaches a character lineup to every page;
//   mask: path       a PNG the size of the FIRST picture, transparent where the
//                    model may repaint (tools/art/scene-edit.py prep writes one).
//                    The model still redraws the whole picture, so scene-edit.py
//                    apply keeps only the masked pixels of what comes back.
// An entry with neither is sent exactly as before.
import fs from "fs";
import path from "path";
const here = path.dirname(new URL(import.meta.url).pathname);
const spec = JSON.parse(fs.readFileSync(path.join(here, "game-sprites.json"), "utf8"));
const args = process.argv.slice(2), dry = args.includes("--dry"), names = args.filter((a) => a !== "--dry")[0];
const only = names ? names.split(",") : null;
const out = path.join(here, "out/game"); fs.mkdirSync(out, { recursive: true });
const STYLE = "Children's game art in the exact look of the attached reference: soft 3D clay, smooth clean finish (no grain, no noise, no paper texture), warm rich sunny colours, gentle even light, friendly and simple for 3 to 8 year olds. No text, letters or numbers anywhere.";
// An entry's own `ref` (a path from the repo root) wins: a scene redrawn from
// the one it replaces keeps that scene's palette and light, which the shared
// style picture cannot give it.
const refFor = (s) => s.ref ? path.join(here, "../..", s.ref) : path.join(here, "refs", /Echo/.test(s.prompt) ? "echo-clay.webp" : "approved-style.png");
const fromRoot = (p) => path.join(here, "../..", p);
// every picture an entry sends, in order: `ref` (or the shared style picture,
// unless the entry brings `refs` of its own), then each of `refs`
const picsFor = (s) => [...(s.ref || !s.refs ? [refFor(s)] : []), ...(s.refs || []).map(fromRoot)];
const typeOf = (f) => (f.endsWith(".webp") ? "image/webp" : /\.jpe?g$/.test(f) ? "image/jpeg" : "image/png");
const sent = [];
async function pace() { for (;;) { const now = Date.now(); while (sent.length && now - sent[0] > 61000) sent.shift(); if (sent.length < 5) { sent.push(now); return; } await new Promise((r) => setTimeout(r, 61000 - (now - sent[0]) + 250)); } }
async function draw(s) {
  for (let attempt = 1; ; attempt++) {
    await pace();
    const fd = new FormData();
    fd.append("model", "chatgpt-image-latest"); fd.append("size", s.size); fd.append("quality", "high");
    if (s.transparent) fd.append("background", "transparent");
    fd.append("stream", "true"); fd.append("partial_images", "2");
    fd.append("prompt", `${STYLE}${s.transparent ? " Transparent background, the object alone, no ground shadow." : ""}\n\n${s.prompt}`);
    for (const ref of picsFor(s)) fd.append("image[]", new Blob([fs.readFileSync(ref)], { type: typeOf(ref) }), path.basename(ref));
    if (s.mask) fd.append("mask", new Blob([fs.readFileSync(fromRoot(s.mask))], { type: "image/png" }), path.basename(s.mask));
    const r = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: "Bearer " + (process.env.OPENAI_API_KEY || "injected-by-proxy") }, body: fd });
    const t = await r.text();
    if (r.ok) { let last; for (const l of t.split("\n")) if (l.startsWith("data:")) { const e = JSON.parse(l.slice(5)); if (e.b64_json) last = e.b64_json; } if (last) return Buffer.from(last, "base64"); }
    if (attempt >= 6 || (r.status && r.status < 500 && r.status !== 429 && r.ok === false)) throw new Error(r.status + " " + t.slice(0, 200));
    await new Promise((ok) => setTimeout(ok, 15000));
  }
}
// An entry whose picture or mask is not on disk is named and skipped before
// anything is sent (a mask comes from scene-edit.py prep, into the git-ignored
// out/), and the others still draw, as one missing ref always allowed.
const rel = (f) => path.relative(path.join(here, "../.."), f);
const chosen = spec.filter((s) => !only || only.includes(s.name)).filter((s) => {
  const gone = [...picsFor(s), ...(s.mask ? [fromRoot(s.mask)] : [])].filter((f) => !fs.existsSync(f));
  if (gone.length) console.log("✗", s.name, "missing", gone.map(rel).join(", "));
  return !gone.length;
});
if (dry) { for (const s of chosen) console.log(s.name, s.size, "\n  image[]", picsFor(s).map(rel).join(", ") + (s.mask ? "\n  mask " + s.mask : "")); process.exit(0); }
await Promise.all(chosen.map(async (s) => {
  try { fs.writeFileSync(path.join(out, s.name + ".png"), await draw(s)); console.log("✓", s.name); } catch (e) { console.log("✗", s.name, e.message); }
}));
