// Paints the fuller books in the approved Sona style with OpenAI's image API.
// Per book: a square cover, then a character lineup (everyone who recurs,
// side by side), then each of the 12 pages as its own picture with the cover
// and lineup attached, so every character looks the same on every page.
// (Six pages on one sheet was tried first, 1 Oct 2026: 5-9 of 12 pages came
// back in the wrong place, doubled or missing their key word.) Raw images
// land in tools/art/out/books/<slug>/; cut-books.py makes the .webp pages.
//
//   NODE_USE_ENV_PROXY=1 node tools/art/gen-books.mjs              # everything not yet drawn
//   ... gen-books.mjs --only rory-rainbow,sid-the-seagull           # just these books
//   ... gen-books.mjs --redo sid-the-seagull:p03,sid-the-seagull:p04  # redraw parts (cover, cast, p01-p12)
//
// NODE_USE_ENV_PROXY=1: in a Claude cloud session Node's fetch ignores
// HTTPS_PROXY otherwise, and the key is added by that proxy. Locally, set
// OPENAI_API_KEY instead. Streaming keeps the connection busy past the
// proxy's 30-second idle cut-off; a high-quality picture takes about a minute.
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const arg = (n) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : null; };
const KEY = process.env.OPENAI_API_KEY || "injected-by-proxy";
const MODEL = process.env.ART_MODEL || "chatgpt-image-latest";
const PARALLEL = Number(arg("parallel") || 8); // requests in flight at once, across all books
// OpenAI caps attached images per minute per account (5 on a new account,
// 1 Oct 2026; it rises with spend). Every request is paced under that cap.
const IMAGES_PER_MIN = Number(arg("ipm") || process.env.ART_IPM || 5);

// The look Travis approved on 1 Oct 2026 (Rory, smooth with warm color).
const STYLE = `Children's picture-book illustration in the exact look of the attached approved-style sheet: soft 3D clay characters with a smooth, clean finish (no grain, no noise, no fuzzy felt, no paper texture), big friendly glossy eyes and small pink cheeks; warm, rich, sunny colors — bright blue sky, fresh greens, clear water — with gentle even daylight (no harsh golden glare, no sparkles); simple, readable painted scenery with one clear focal point. Cheerful and calm for 3 to 6 year olds. Match the STYLE of the approved sheet only: never copy its rabbit, its places or its story. Absolutely no text, letters, numbers or signs anywhere in the picture.`;

const prompts = JSON.parse(fs.readFileSync(path.join(here, "book-prompts.json"), "utf8"));
const outDir = (slug) => path.join(here, "out/books", slug);
const file = (slug, part) => path.join(outDir(slug), part + ".png");
const PAGES = Array.from({ length: 12 }, (_, i) => "p" + String(i + 1).padStart(2, "0"));
const STYLE_REF = path.join(here, "refs/approved-style.png");

// one shared gate: at most PARALLEL pictures being drawn at any moment
let active = 0; const waiting = [];
async function gate(fn) {
  if (active >= PARALLEL) await new Promise((go) => waiting.push(go));
  active++;
  try { return await fn(); } finally { active--; if (waiting.length) waiting.shift()(); }
}

const sent = []; // when each attached image went out, for the per-minute cap
async function pace(n) {
  for (;;) {
    const now = Date.now();
    while (sent.length && now - sent[0] > 61000) sent.shift();
    if (sent.length + n <= IMAGES_PER_MIN) { for (let i = 0; i < n; i++) sent.push(now); return; }
    await new Promise((ok) => setTimeout(ok, 61000 - (now - sent[0]) + 250));
  }
}

async function draw(prompt, refs, size) {
  for (let attempt = 1; ; attempt++) {
    try {
      await pace(refs.length);
      const fd = new FormData();
      fd.append("model", MODEL); fd.append("prompt", prompt); fd.append("size", size);
      fd.append("quality", "high"); fd.append("stream", "true"); fd.append("partial_images", "3");
      for (const f of refs) fd.append("image[]", new Blob([fs.readFileSync(f)], { type: f.endsWith(".webp") ? "image/webp" : "image/png" }), path.basename(f));
      const res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: "Bearer " + KEY }, body: fd });
      if (!res.ok) {
        const body = (await res.text()).slice(0, 300);
        if (res.status === 429 || res.status >= 500) throw Object.assign(new Error(res.status + " " + body), { retry: true });
        throw new Error(res.status + " " + body);
      }
      let last = null;
      for (const line of (await res.text()).split("\n")) if (line.startsWith("data:")) { const e = JSON.parse(line.slice(5)); if (e.b64_json) last = e.b64_json; if (e.error) throw new Error(JSON.stringify(e.error)); }
      if (!last) throw Object.assign(new Error("no image in the stream"), { retry: true });
      return Buffer.from(last, "base64");
    } catch (e) {
      const retry = e.retry || /fetch failed|terminated|ECONN|socket/i.test(String(e.message) + String(e.cause));
      if (!retry || attempt >= 30) throw e;
      // a rate limit says how long to wait; anything else backs off
      const wait = (String(e.message).match(/try again in ([\d.]+)s/) || [])[1];
      await new Promise((ok) => setTimeout(ok, wait ? Number(wait) * 1000 + 1000 : Math.min(60000, 15000 * attempt)));
    }
  }
}

const cast = (p) => `${STYLE}\n\nCharacters for this book:\n${p.bible}\n\nA character lineup: every character described above standing side by side, full body, facing forward and smiling, evenly spaced on a plain soft cream background with a soft floor shadow, each one exactly ONCE, drawn to the sizes described and matching the attached cover exactly. Nothing else in the picture.`;
const page = (p, n) => `${STYLE}\n\nCharacters and setting for this book — the attached reference shows this book's cover (left) and its character lineup (right); every character must look exactly like it:\n${p.bible}\n\nOne picture-book page, a single scene (not a grid, no panels, no border): ${p.panels[n]}\nOnly the characters named in this description appear, each exactly once.`;

// The cover and the lineup, side by side in one image: each page then
// attaches one picture instead of three, which matters under the cap.
async function sheetRef(p) {
  const out = file(p.slug, "ref");
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < Math.max(fs.statSync(file(p.slug, "cover")).mtimeMs, fs.statSync(file(p.slug, "cast")).mtimeMs)) {
    const r = spawnSync("python3", ["-c", `
from PIL import Image
c = Image.open(${JSON.stringify(file(p.slug, "cover"))}).convert("RGB").resize((768, 768))
k = Image.open(${JSON.stringify(file(p.slug, "cast"))}).convert("RGB"); k = k.resize((round(k.width * 768 / k.height), 768))
s = Image.new("RGB", (768 + k.width, 768), "white"); s.paste(c, (0, 0)); s.paste(k, (768, 0)); s.save(${JSON.stringify(out)})`]);
    if (r.status !== 0) throw new Error("could not build the reference sheet: " + r.stderr);
  }
  return out;
}

async function part(p, name, fn) {
  const t = Date.now();
  fs.writeFileSync(file(p.slug, name), await gate(fn));
  console.log(`✓ ${p.slug} ${name} ${Math.round((Date.now() - t) / 1000)}s`);
}
async function book(p, parts) {
  fs.mkdirSync(outDir(p.slug), { recursive: true });
  if (parts.includes("cover")) await part(p, "cover", () => draw(`${STYLE}\n\nCharacters and setting:\n${p.bible}\n\nA square book-cover picture: ${p.cover}`, [STYLE_REF], "1024x1024"));
  if (parts.includes("cast")) await part(p, "cast", () => draw(cast(p), [STYLE_REF, file(p.slug, "cover")], "1536x1024"));
  const refs = [await sheetRef(p)];
  const results = await Promise.allSettled(PAGES.map((name, n) => parts.includes(name) ? part(p, name, () => draw(page(p, n), refs, "1024x1024")) : null));
  const bad = PAGES.filter((_, n) => results[n].status === "rejected");
  if (bad.length) throw new Error(bad.join(",") + ": " + results.find((r) => r.status === "rejected").reason.message);
}

// What to draw: --redo slug:part,... or --only slugs, else every part missing.
// A new cover or lineup means every page after it follows.
let jobs;
if (arg("redo")) {
  const want = {};
  for (const r of arg("redo").split(",")) { const [s, x] = r.split(":"); (want[s] = want[s] || new Set()); (x ? [x] : ["cover", "cast", ...PAGES]).forEach((y) => want[s].add(y)); }
  jobs = Object.entries(want).map(([s, set]) => {
    if (set.has("cover")) ["cast", ...PAGES].forEach((y) => set.add(y));
    if (set.has("cast")) PAGES.forEach((y) => set.add(y));
    return [prompts.find((p) => p.slug === s), [...set]];
  });
} else {
  const only = arg("only") ? arg("only").split(",") : null;
  jobs = prompts.filter((p) => !only || only.includes(p.slug)).map((p) => {
    const missing = ["cover", "cast", ...PAGES].filter((x) => !fs.existsSync(file(p.slug, x)));
    if (missing.includes("cover")) return [p, ["cover", "cast", ...PAGES]];
    if (missing.includes("cast")) return [p, ["cast", ...PAGES]];
    return [p, missing];
  }).filter(([, parts]) => parts.length);
}
if (jobs.some(([p]) => !p)) { console.error("unknown slug in --redo/--only"); process.exit(1); }
console.log(`${jobs.length} books, ${jobs.reduce((n, [, x]) => n + x.length, 0)} pictures, ${PARALLEL} at a time, ${MODEL}`);
const failed = [];
await Promise.all(jobs.map(([p, parts]) => book(p, parts).catch((e) => { failed.push(p.slug); console.log(`✗ ${p.slug}: ${e.message}`); })));
console.log(failed.length ? `Failed: ${failed.join(",")} — run again to retry just the missing pictures.` : "All drawn. Next: python3 tools/art/cut-books.py");
