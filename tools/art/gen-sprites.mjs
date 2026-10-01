// Draws the in-game pieces listed in game-sprites.json (a ball, tiles, a star…)
// in the approved style, transparent where the game lays them over its scene.
//   NODE_USE_ENV_PROXY=1 node tools/art/gen-sprites.mjs [name,name]
import fs from "fs";
import path from "path";
const here = path.dirname(new URL(import.meta.url).pathname);
const spec = JSON.parse(fs.readFileSync(path.join(here, "game-sprites.json"), "utf8"));
const only = process.argv[2] ? process.argv[2].split(",") : null;
const out = path.join(here, "out/game"); fs.mkdirSync(out, { recursive: true });
const STYLE = "Children's game art in the exact look of the attached reference: soft 3D clay, smooth clean finish (no grain, no noise, no paper texture), warm rich sunny colours, gentle even light, friendly and simple for 3 to 8 year olds. No text, letters or numbers anywhere.";
const refFor = (s) => path.join(here, "refs", /Echo/.test(s.prompt) ? "echo-clay.webp" : "approved-style.png");
const sent = [];
async function pace() { for (;;) { const now = Date.now(); while (sent.length && now - sent[0] > 61000) sent.shift(); if (sent.length < 5) { sent.push(now); return; } await new Promise((r) => setTimeout(r, 61000 - (now - sent[0]) + 250)); } }
async function draw(s) {
  for (let attempt = 1; ; attempt++) {
    await pace();
    const fd = new FormData(), ref = refFor(s);
    fd.append("model", "chatgpt-image-latest"); fd.append("size", s.size); fd.append("quality", "high");
    if (s.transparent) fd.append("background", "transparent");
    fd.append("stream", "true"); fd.append("partial_images", "2");
    fd.append("prompt", `${STYLE}${s.transparent ? " Transparent background, the object alone, no ground shadow." : ""}\n\n${s.prompt}`);
    fd.append("image[]", new Blob([fs.readFileSync(ref)], { type: ref.endsWith(".webp") ? "image/webp" : "image/png" }), path.basename(ref));
    const r = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: "Bearer " + (process.env.OPENAI_API_KEY || "injected-by-proxy") }, body: fd });
    const t = await r.text();
    if (r.ok) { let last; for (const l of t.split("\n")) if (l.startsWith("data:")) { const e = JSON.parse(l.slice(5)); if (e.b64_json) last = e.b64_json; } if (last) return Buffer.from(last, "base64"); }
    if (attempt >= 6 || (r.status && r.status < 500 && r.status !== 429 && r.ok === false)) throw new Error(r.status + " " + t.slice(0, 200));
    await new Promise((ok) => setTimeout(ok, 15000));
  }
}
await Promise.all(spec.filter((s) => !only || only.includes(s.name)).map(async (s) => {
  try { fs.writeFileSync(path.join(out, s.name + ".png"), await draw(s)); console.log("✓", s.name); } catch (e) { console.log("✗", s.name, e.message); }
}));
