// Paints the daily stories' pictures (STORY1, 22 Oct 2026) in the approved
// Sona style with OpenAI's image API: a copy of gen-books.mjs, with three
// changes. Each story has its own light line (Day 1 is a night story, so
// "a soft, cozy blue-violet evening lit warmly by lamps" replaces the books'
// daylight; a scene's own `light` wins). Every page attaches Echo, the
// approved style sheet and the cast lineups (a later day attaches the earlier
// days' lineups too, so Pelly, Wally and Grandpa Bear stay on-model). And each
// page leaves an empty spot where the child's own buddy is laid over the
// picture later: a buddy is never painted in.
// Per story: each new character alone (c-<key>, 1024x1024, transparent),
// then the lineup made from them (cast: Echo and that day's characters side by
// side on cream, each at its height from the prompts; composed with
// ImageMagick, never drawn: a whole lineup in one picture merged Pelly into the
// walrus), then s01-s08 and e01-e04 (1024x1536), then Home's card (home,
// 1536x1024); and once, the Arcade button's picture (arcade). Raw images land
// in tools/art/out/adventure/<id>/; cut-adventure.py makes the .webp files.
//
//   NODE_USE_ENV_PROXY=1 node tools/art/gen-adventure.mjs                     # everything not yet drawn
//   ... gen-adventure.mjs --only lighthouse                                     # one story
//   ... gen-adventure.mjs --redo lighthouse:s03,windup:e04                      # redraw parts (c-<key>, s01-e04, home, arcade:arcade)
//   ... gen-adventure.mjs --quality high                                        # medium by default
//   ... gen-adventure.mjs --dry                                                 # print the prompts, send nothing
//   A redrawn part is told why out/adventure/checks.json rejected it last time
//   ({ "lighthouse/s03": "the reason" }).
//
// NODE_USE_ENV_PROXY=1: in a Claude cloud session Node's fetch ignores
// HTTPS_PROXY otherwise, and the key is added by that proxy. Locally, set
// OPENAI_API_KEY instead. Streaming keeps the connection busy past the
// proxy's 30-second idle cut-off. Needs ImageMagick (convert) for the
// reference sheets; no PIL.
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const arg = (n) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : null; };
const KEY = process.env.OPENAI_API_KEY || "injected-by-proxy";
const MODEL = process.env.ART_MODEL || "chatgpt-image-latest";
const QUALITY = arg("quality") || "medium";
const DRY = process.argv.includes("--dry"); // print each prompt and its pictures, send nothing
const PARALLEL = Number(arg("parallel") || 6);
// OpenAI caps attached images per minute per account; every request is paced
// under that cap (see gen-books.mjs).
const IMAGES_PER_MIN = Number(arg("ipm") || process.env.ART_IPM || 5);

const P = JSON.parse(fs.readFileSync(path.join(here, "adventure-prompts.json"), "utf8"));
const OUT = path.join(here, "out/adventure");
const file = (id, part) => path.join(OUT, id, part + ".png");
const SCENES = ["s01", "s02", "s03", "s04", "s05", "s06", "s07", "s08", "e01", "e02", "e03", "e04"];
const STYLE_REF = path.join(here, "refs/approved-style.png");
const ECHO_REF = path.join(here, "refs/echo-clay.webp");

const STYLE = (light) => `Children's picture-book illustration in the exact look of the attached approved-style sheet: soft 3D clay characters with a smooth, clean finish (no grain, no noise, no fuzzy felt, no paper texture), big friendly glossy eyes and small pink cheeks; ${light}; simple, readable painted scenery with one clear focal point. Cheerful and calm for 3 to 8 year olds. Match the STYLE of the approved sheet only: never copy its rabbit, its places or its story. Absolutely no text, letters, numbers or signs anywhere in the picture.`;
const lightOf = (story, sc) => P.light[(sc && sc.light) || story.light] || P.light.day;

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

async function draw(prompt, refs, size, transparent) {
  for (let attempt = 1; ; attempt++) {
    try {
      await pace(refs.length);
      const fd = new FormData();
      fd.append("model", MODEL); fd.append("prompt", prompt); fd.append("size", size);
      fd.append("quality", QUALITY); fd.append("stream", "true"); fd.append("partial_images", "2");
      if (transparent) fd.append("background", "transparent");
      for (const f of refs) fd.append("image[]", new Blob([fs.readFileSync(f)], { type: f.endsWith(".webp") ? "image/webp" : "image/png" }), path.basename(f));
      const res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: "Bearer " + KEY }, body: fd });
      if (process.env.ART_DEBUG) console.log(res.status, [...res.headers].filter(([k]) => /ratelimit/.test(k)).map((x) => x.join("=")).join(" "));
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
      const wait = (String(e.message).match(/try again in ([\d.]+)s/) || [])[1];
      await new Promise((ok) => setTimeout(ok, wait ? Number(wait) * 1000 + 1000 : Math.min(60000, 15000 * attempt)));
    }
  }
}

// The lineups a story's pages attach: its own, then the earlier days' (Pelly
// and Wally are drawn once, on Day 1's; Grandpa Bear and the toys on Day 2's).
const story = (id) => P.stories.find((s) => s.id === id);
const order = P.stories.map((s) => s.id);
const lineups = (id) => [id, ...order.slice(0, order.indexOf(id))];
// A story's lineup: Echo, then each of its characters, trimmed to what is
// drawn, scaled to its height (Echo = 1, 300 px) and stood bottom-aligned on
// cream. ImageMagick, so no PIL is needed.
const UNIT = 300;
function compose(id) {
  const s = story(id), out = file(id, "cast");
  const parts = [[ECHO_REF, 1], ...s.chars.map((c) => [file(id, "c-" + c.key), c.h])];
  const args = ["-background", "none"];
  for (const [f, h] of parts) args.push("(", f, "-alpha", "set", "-fuzz", "6%", "-fill", "none", "-draw", "color 0,0 floodfill", "-trim", "+repage", "-resize", "x" + Math.round(h * UNIT), ")");
  args.push("-gravity", "South", "+smush", "36", "-bordercolor", "none", "-border", "40x40", "(", "+clone", "-alpha", "off", "-fill", "#f7f0e3", "-colorize", "100", ")", "+swap", "-composite", "-flatten", out);
  const r = spawnSync("convert", args);
  if (r.status !== 0) throw new Error("could not compose the lineup: " + r.stderr);
}
// The lineups a page attaches, side by side in one image: each page then
// attaches one picture instead of three, which matters under the cap.
function castSheet(id) {
  const parts = lineups(id).map((x) => file(x, "cast"));
  if (parts.length === 1) return parts[0];
  const out = path.join(OUT, id, "cast-sheet.png");
  if (!fs.existsSync(out) || parts.some((f) => fs.statSync(f).mtimeMs > fs.statSync(out).mtimeMs)) {
    const r = spawnSync("convert", [...parts, "-resize", "x768", "-background", "#f7f0e3", "-gravity", "South", "+append", out]);
    if (r.status !== 0) throw new Error("could not build the cast sheet: " + r.stderr);
  }
  return out;
}

const CHECKS = (() => { try { return JSON.parse(fs.readFileSync(path.join(OUT, "checks.json"), "utf8")); } catch (e) { return {}; } })();
const why = (id, part) => CHECKS[id + "/" + part] ? `\n\nA previous drawing of this picture was rejected because: ${CHECKS[id + "/" + part]} Fix that.` : "";

// Who is in a scene: the bible names each character as "NAME:"; a page that
// does not mention one must not show it (the attached lineups show everyone).
const WHO = { PELLY: [/Pelly/, "Pelly the pelican"], WALLY: [/Wally/, "Captain Wally"], MICE: [/\bmice\b/i, "the three mice"], "GRANDPA BEAR": [/Grandpa Bear/, "Grandpa Bear"], TOYS: [/wind-up toy|\btoys\b|bunny|elephant|hippo|jack-in-the-box/i, "the wind-up toys"], GRANDMA: [/Grandma/, "Grandma Tortoise"] };
const absent = (s, text) => [...s.bible.matchAll(/\b([A-Z][A-Z' ]+):/g)].map((m) => m[1].trim()).filter((n) => WHO[n] && !WHO[n][0].test(text)).map((n) => WHO[n][1]);
const placesIn = (text) => Object.values(P.places).filter((d) => text.includes(d.split(":")[0])).join("\n");
// what each attached picture is for; `also` adds an earlier page of this
// world ("story/part") or a sheet of the games' pieces ("sheet:<name>")
const alsoNote = (a) => /^sheet:/.test(a) ? (P.sheets[a.slice(6)] || {}).note : /^file:/.test(a) ? (P.files[a.slice(5)] || "a reference picture") : "an earlier page of this story world: keep the place it shows looking exactly the same";
const refNote = (n, also) => `The attached pictures, in order: (1) Echo, the hero: draw Echo exactly like this, the same shape, colors, feathers and face. (2) The approved style sheet: match its look only. (3) The character lineup${n > 1 ? "s, side by side" : ""}: every character must look exactly as it does there, at the same sizes next to Echo.` + (also || []).map((a, i) => ` (${i + 4}) ${alsoNote(a)}.`).join("");
// A sheet: the games' own pieces side by side on cream, so a story page shows
// the very boats and crews the game shows.
function sheet(name) {
  const out = path.join(OUT, "sheet-" + name + ".png"), parts = P.sheets[name].files.map((f) => path.join(here, "../..", f));
  const r = spawnSync("convert", ["-background", "#f7f0e3", ...parts, "-resize", "x420", "-gravity", "South", "+append", out]);
  if (r.status !== 0) throw new Error("could not build the sheet " + name + ": " + r.stderr);
  return out;
}
const alsoFile = (a) => /^sheet:/.test(a) ? sheet(a.slice(6)) : /^file:/.test(a) ? path.join(here, "../..", a.slice(5)) : file(...a.split("/"));

// A scene with `nocast` has no characters at all (a place that pieces are
// laid on later): it is sent with no lineup, no character bible and no Echo,
// which otherwise filled it with the cast however firmly it was told not to.
function placePrompt(s, part) {
  const sc = s.scenes[part];
  return `${STYLE(lightOf(s, sc))}\n\nThe first attached picture is the approved style sheet: match its look only.` + (sc.also || []).map((a, i) => ` The ${["second", "third"][i]} attached picture is ${alsoNote(a)}.`).join("") +
    `\n\nOne picture-book page, a single tall scene (not a grid, no panels, no border, the picture running to every edge): ${sc.picture}\nThere are NO characters in this picture: no animals, no people, no birds, no toys, no boats. Only the place.\n` +
    `Composition: a tall portrait page. Keep the bottom eighth of the picture calm: plain water or ground with nothing important in it, because a caption card covers it.` + why(s.id, part);
}

function scenePrompt(s, part) {
  const sc = s.scenes[part], echoOut = /Echo is not in this picture/.test(sc.picture);
  const away = absent(s, sc.picture);
  const spot = !sc.buddy ? "" : /^PEEK:/.test(sc.buddy)
    ? `\nEMPTY SPOT, ON PURPOSE: leave ${sc.buddy.replace(/^PEEK:\s*/, "")}. Keep it completely clear: one more little character, the size of Echo, will peek over it there later. Do not draw that character.`
    : `\nEMPTY SPOT, ON PURPOSE: leave ${sc.buddy}. It must stay completely empty and uncluttered (no character, animal, toy, object, plant or shadow on it), with room for one more little character the size of Echo to stand there later. Do not draw that character.`;
  return `${STYLE(lightOf(s, sc))}\n\n${refNote(lineups(s.id).length, sc.also)}\n\nCharacters for this story (only the ones named in the scene appear):\n${P.echo}\n${s.bible}` +
    (placesIn(sc.picture) ? `\n${placesIn(sc.picture)}` : "") +
    `\n\nOne picture-book page, a single tall scene (not a grid, no panels, no border, the picture running to every edge): ${sc.picture}${spot}\n` +
    `Only the characters named in this description appear, each exactly once, with a normal number of arms, legs, wings and flippers.` +
    (away.length || echoOut ? ` These characters are NOT in this scene and must not appear anywhere in it: ${[...(echoOut ? ["Echo"] : []), ...away].join(", ")}.` : "") +
    ` No objects the description does not mention, no letters on the letter, no writing on any sign or map.\n` +
    `Composition: a tall portrait page. Keep every character and everything important inside the middle 70% of the width (the left and right edges may be cut off on a phone), and keep the bottom eighth of the picture calm: plain ground, floor or water with nothing important in it, because a caption card covers it.` + why(s.id, part);
}
const charPrompt = (s, c) => `${STYLE(P.light.day)}\n\nThe attached picture is the approved style sheet: match its look only.\n\nA model sheet of ONE character, alone on a fully transparent background, the whole character in the picture with a little room around it, no ground, no shadow, nothing else: ${c.prompt} A normal number of arms, legs, wings or flippers.` + why(s.id, "c-" + c.key);
const homePrompt = (s) => { const away = absent(s, s.home); return `${STYLE(lightOf(s, null))}\n\n${refNote(lineups(s.id).length)}\n\nCharacters:\n${P.echo}\n${s.bible}\n\nOne wide picture (not a grid, no panels, no border, the picture running to every edge): ${s.home} Only Echo and the characters named here appear, each exactly once.` + (away.length ? ` These characters are NOT in this picture: ${away.join(", ")}.` : "") + ` No text.` + why(s.id, "home"); };
const arcadePrompt = () => `${STYLE(P.light.day)}\n\nThe first attached picture is Echo: draw Echo exactly like it. The second is the approved style sheet: match its look only.\n\n${P.echo}\n\nOne wide picture (not a grid, no panels, no border, the picture running to every edge): ${P.arcade}` + why("arcade", "arcade");

// Every part is a promise, so a page that attaches another story's page
// (`also`) waits for it when both are drawn in the same run.
const drawn = {};
function want(id, part) {
  const k = id + "/" + part;
  return drawn[k] || (fs.existsSync(file(id, part)) ? Promise.resolve() : Promise.reject(new Error(k + " is not drawn yet")));
}
function job(id, part, fn) {
  const k = id + "/" + part;
  drawn[k] = (async () => {
    fs.mkdirSync(path.join(OUT, id), { recursive: true });
    const [prompt, refs, size, transparent] = await fn();
    if (DRY) return console.log(`--- ${k} ${size}\nrefs: ${refs.map((f) => path.relative(here, f)).join(", ")}\n${prompt}\n`);
    const t = Date.now();
    fs.writeFileSync(file(id, part), await gate(() => draw(prompt, refs, size, transparent)));
    fs.writeFileSync(file(id, part).replace(/\.png$/, ".prompt.txt"), prompt + "\n\nrefs: " + refs.map((f) => path.relative(here, f)).join(", ") + "\n");
    console.log(`✓ ${k} ${Math.round((Date.now() - t) / 1000)}s`);
  })();
  drawn[k].catch(() => {});
  return drawn[k];
}

// What to draw: --redo id:part,... or --only ids, else every part missing.
// A redrawn character means its lineup is composed again; a story's pages
// are not redrawn by themselves (name them).
const CHARS = (id) => story(id).chars.map((c) => "c-" + c.key);
const ALL = (id) => [...CHARS(id), ...SCENES, "home"];
let plan = {};
if (arg("redo")) {
  for (const r of arg("redo").split(",")) { const [i, x] = r.split(":"); (plan[i] = plan[i] || new Set()); (x ? [x] : i === "arcade" ? ["arcade"] : ALL(i)).forEach((y) => plan[i].add(y)); }
} else {
  const only = arg("only") ? arg("only").split(",") : null;
  for (const id of [...order, "arcade"]) {
    if (only && !only.includes(id)) continue;
    const parts = id === "arcade" ? ["arcade"] : ALL(id);
    const missing = parts.filter((x) => !fs.existsSync(file(id, x)));
    if (missing.length) plan[id] = new Set(missing);
  }
}
for (const id of Object.keys(plan)) if (id !== "arcade" && !story(id)) { console.error("unknown story " + id); process.exit(1); }
const count = Object.values(plan).reduce((n, s) => n + s.size, 0);
console.log(`${count} pictures, ${PARALLEL} at a time, ${MODEL} (${QUALITY}), ${IMAGES_PER_MIN} images a minute`);
const failed = [];
const jobs = [];
const fail = (k) => (e) => { failed.push(k); console.log(`✗ ${k}: ${e.message}`); };
for (const id of order) {
  if (!plan[id]) continue; // a story not drawn now: its pages and lineup are read from disk
  const s = story(id), set = plan[id];
  // the characters, then the lineup composed from them (again whenever one was redrawn)
  const chars = s.chars.map((c) => set.has("c-" + c.key) ? job(id, "c-" + c.key, async () => [charPrompt(s, c), [STYLE_REF], "1024x1024", true]) : want(id, "c-" + c.key));
  chars.forEach((p, n) => jobs.push(p.catch(fail(id + "/c-" + s.chars[n].key))));
  const k = id + "/cast";
  drawn[k] = Promise.all(chars).then(() => { if (DRY) return; if (CHARS(id).some((x) => set.has(x)) || !fs.existsSync(file(id, "cast"))) { compose(id); console.log("✓ " + k + " composed"); } });
  drawn[k].catch(() => {});
  // a story's pages attach its own lineup and the earlier days'
  const casts = () => Promise.all(lineups(id).map((x) => want(x, "cast")));
  for (const part of [...SCENES, "home"]) {
    if (!set.has(part)) continue;
    jobs.push(job(id, part, async () => {
      await casts();
      if (part === "home") return [homePrompt(s), [ECHO_REF, STYLE_REF, castSheet(id)], "1536x1024"];
      const also = (s.scenes[part].also || []);
      if (s.scenes[part].nocast) return [placePrompt(s, part), [STYLE_REF, ...also.map(alsoFile)], "1024x1536"];
      await Promise.all(also.filter((a) => !/^(sheet|file):/.test(a)).map((a) => want(...a.split("/"))));
      return [scenePrompt(s, part), [ECHO_REF, STYLE_REF, castSheet(id), ...also.map(alsoFile)], "1024x1536"];
    }).catch(fail(id + "/" + part)));
  }
}
if (plan.arcade) jobs.push(job("arcade", "arcade", async () => [arcadePrompt(), [ECHO_REF, STYLE_REF], "1536x1024"]).catch(fail("arcade")));
await Promise.all(jobs);
console.log(failed.length ? `Failed: ${failed.join(",")}: run again to retry just the missing pictures.` : "All drawn. Next: python3 tools/art/cut-adventure.py");
