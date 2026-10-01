// Paints the fuller books in the approved Sona style with OpenAI's image API.
// Per book: a square cover, then pages 1-6 and 7-12 as two 3x2 sheets, each
// drawn with the cover (and the first sheet) attached so every character
// looks the same on every page. Raw images land in tools/art/out/books/<slug>/;
// cut-books.py turns them into pages.
//
//   NODE_USE_ENV_PROXY=1 node tools/art/gen-books.mjs              # every book not yet drawn
//   ... gen-books.mjs --only rory-rainbow,sid-the-seagull           # just these
//   ... gen-books.mjs --redo sid-the-seagull:B                      # redraw one part (cover, A or B)
//
// NODE_USE_ENV_PROXY=1: in a Claude cloud session Node's fetch ignores
// HTTPS_PROXY otherwise, and the key is added by that proxy. Locally, set
// OPENAI_API_KEY instead. Streaming keeps the connection busy past the
// proxy's 30-second idle cut-off; a high-quality picture takes about a minute.
import fs from "fs";
import path from "path";

const here = path.dirname(new URL(import.meta.url).pathname);
const arg = (n) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : null; };
const KEY = process.env.OPENAI_API_KEY || "injected-by-proxy";
const MODEL = process.env.ART_MODEL || "chatgpt-image-latest";
const PARALLEL = Number(arg("parallel") || 5);

// The look Travis approved on 1 Oct 2026 (Rory, smooth with warm color).
const STYLE = `Children's picture-book illustration in the exact look of the attached approved-style sheet: soft 3D clay characters with a smooth, clean finish (no grain, no noise, no fuzzy felt, no paper texture), big friendly glossy eyes and small pink cheeks; warm, rich, sunny colors — bright blue sky, fresh greens, clear water — with gentle even daylight (no harsh golden glare, no sparkles); simple, readable painted scenery with one clear focal point. Cheerful and calm for 3 to 6 year olds. Match the STYLE of the approved sheet only: never copy its rabbit, its places or its story. Absolutely no text, letters, numbers or signs anywhere in the picture.`;

const prompts = JSON.parse(fs.readFileSync(path.join(here, "book-prompts.json"), "utf8"));
const outDir = (slug) => path.join(here, "out/books", slug);
const file = (slug, part) => path.join(outDir(slug), part + ".png");

async function draw(prompt, refs, size) {
  for (let attempt = 1; ; attempt++) {
    try {
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
      if (!retry || attempt >= 4) throw e;
      await new Promise((ok) => setTimeout(ok, 15000 * attempt));
    }
  }
}

const sheet = (p, from) => `${STYLE}

Characters and setting for this book — keep them exactly like this, and exactly like the attached cover, in every panel:
${p.bible}

A sheet of SIX separate picture-book panels in a 3-column by 2-row grid of square-ish landscape panels with thin plain white gutters between them, read left to right, top row first. Keep this exact order — panel 1 top-left, panel 6 bottom-right:
${p.panels.slice(from, from + 6).map((t, i) => `${i + 1}. ${t}`).join("\n")}`;

async function book(p, parts) {
  fs.mkdirSync(outDir(p.slug), { recursive: true });
  const style = path.join(here, "refs/approved-style.png");
  const t = Date.now();
  if (parts.includes("cover")) fs.writeFileSync(file(p.slug, "cover"), await draw(`${STYLE}\n\nCharacters and setting:\n${p.bible}\n\nA square book-cover picture: ${p.cover}`, [style], "1024x1024"));
  if (parts.includes("A")) fs.writeFileSync(file(p.slug, "A"), await draw(sheet(p, 0), [style, file(p.slug, "cover")], "1536x1024"));
  if (parts.includes("B")) fs.writeFileSync(file(p.slug, "B"), await draw(sheet(p, 6), [style, file(p.slug, "cover"), file(p.slug, "A")], "1536x1024"));
  console.log(`✓ ${p.slug} [${parts.join(",")}] in ${Math.round((Date.now() - t) / 1000)}s`);
}

// What to draw: --redo slug:part,... or --only slugs, else every part missing.
let jobs;
if (arg("redo")) {
  const want = {}; for (const r of arg("redo").split(",")) { const [s, part] = r.split(":"); (want[s] = want[s] || []).push(...(part ? [part] : ["cover", "A", "B"])); }
  // a new cover or first sheet means the later parts must follow it
  const chain = (parts) => parts.includes("cover") ? ["cover", "A", "B"] : parts.includes("A") ? ["A", "B"] : ["B"];
  jobs = Object.entries(want).map(([s, parts]) => [prompts.find((p) => p.slug === s), chain(parts)]);
} else {
  const only = arg("only") ? arg("only").split(",") : null;
  jobs = prompts.filter((p) => !only || only.includes(p.slug))
    .map((p) => [p, ["cover", "A", "B"].filter((part, i, all) => !fs.existsSync(file(p.slug, part)) || all.slice(0, i).some((x) => !fs.existsSync(file(p.slug, x))))])
    .filter(([, parts]) => parts.length);
}
if (jobs.some(([p]) => !p)) { console.error("unknown slug in --redo/--only"); process.exit(1); }
console.log(`${jobs.length} books, ${PARALLEL} at a time, ${MODEL}`);
const queue = [...jobs], failed = [];
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  for (let j; (j = queue.shift());) {
    try { await book(j[0], j[1]); } catch (e) { failed.push(j[0].slug); console.log(`✗ ${j[0].slug}: ${e.message}`); }
  }
}));
console.log(failed.length ? `Failed: ${failed.join(",")} — run again to retry just those.` : "All drawn. Next: python3 tools/art/cut-books.py");
