// SLPPRO1: Session games, the dashboard's AI that picks Sona's OWN games for
// a speech session (Travis, 17 Nov 2026: "the activity planner is not what I
// am after ... I want it built into their app ... Or just suggesting what
// game or activity to go and play inside of Sona speech", then "picks sona
// games but also give the slp the opp to suggest a new game or activity to be
// built inside the app"). It replaced Plan activities (SLPCLEAN1). Pinned:
//   1. lib/sonaCatalog.ts against public/sona.js: every playable game is in
//      the catalog with GAME_ACTS's own page, no parked game is, every
//      talking story is STORY_TALK's, and every picture is on disk.
//   2. lib/gamePicks.ts: the request is rebuilt field by field (sound, word
//      position by the homework composer's rule, age band, minutes, and
//      `loves`, the one free text, 120 characters, never cut); the reply is
//      read strictly (known keys only, 2 to 4 picks, the first 3 kept, every
//      field within its limit); the prompt lists no practice words.
//   3. The pick route, run for real against a fake store and a fake AI: the
//      planner's guards in the same order, exactly what reaches the model,
//      and a refusal, a cut-off or a malformed reply never reaching the page.
//   4. The play route (SESSPLAY1): signed in, this site, Sona Pro (or a
//      promised free dashboard), a catalog key for that sound: the page to
//      open and a 12-hour end. The feedback route takes a game idea.
//   5. The page, against a mock API: the form, the examples, three cards
//      with pictures, Play now writing the tab's record only after the
//      server's yes, the idea box, and never a caseload child's name.
// No network.
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const APP = ROOT.replace(/\/public$/, "");
let checks = 0, fails = 0;
const ok = (n, p, extra) => { checks++; if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (typeof extra === "string" ? extra : JSON.stringify(extra)))); };
const read = (rel) => (existsSync(path.join(APP, rel)) ? readFileSync(path.join(APP, rel), "utf8") : "");

// ── loading the TypeScript for real, with a fake AI and a fake store ──
const AI = { calls: [], reply: null, throws: false };
class FakeAnthropic {
  constructor(opts) { this.opts = opts; AI.client = opts; }
  get messages() {
    return { create: async (params) => { AI.calls.push(params); if (AI.throws) throw new Error("network"); return AI.reply; } };
  }
}
const cache = new Map();
function loadTs(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const req = (s) => s === "@anthropic-ai/sdk" ? { __esModule: true, default: FakeAnthropic }
    : s === "stripe" ? function () { return {}; }
    : s.startsWith("@/") ? loadTs(path.join(APP, s.slice(2) + ".ts"))
    : s === "next/server" ? require(path.join(APP, "node_modules/next/server"))
    : require(s);
  new Function("require", "module", "exports", js)(req, mod, mod.exports);
  return mod.exports;
}

// ═════════════ part 1: the catalog against sona.js ═════════════
const C = loadTs(path.join(APP, "lib/sonaCatalog.ts"));
{
  const sona = readFileSync(path.join(ROOT, "sona.js"), "utf8");
  const acts = sona.slice(sona.indexOf("const GAME_ACTS = {"), sona.indexOf("const GAME_KEYS ="));
  const lines = [...acts.matchAll(/^    ([a-z]+):\s+\{ name: "([^"]+)".*?go: "([^"]+)".*$/gm)].map((m) => ({ key: m[1], name: m[2], go: m[3], parked: /comingSoon: true/.test(m[0]), group: /group: "([a-z]+)"/.exec(m[0])[1] }));
  const playable = lines.filter((l) => !l.parked), parked = lines.filter((l) => l.parked);
  const cat = C.GAMES;
  ok("sona.js's catalog was read (" + lines.length + " games, " + parked.length + " parked)", lines.length >= 25 && parked.length >= 1, lines.length);
  ok("every game a child can open is in the session catalog", playable.every((l) => cat.some((c) => c.key === l.key)), playable.filter((l) => !cat.some((c) => c.key === l.key)).map((l) => l.key));
  ok("…and nothing else: no parked game, no key sona.js does not have", cat.every((c) => playable.some((l) => l.key === c.key)) && !cat.some((c) => parked.some((l) => l.key === c.key)), cat.filter((c) => !playable.some((l) => l.key === c.key)).map((c) => c.key));
  ok("…each with sona.js's own page, name and age group", cat.every((c) => { const l = lines.find((x) => x.key === c.key); return l && l.go === c.go && l.name === c.name && (l.group === "simple" ? c.ages === "3-4" : c.ages === "5-8"); }),
    cat.filter((c) => { const l = lines.find((x) => x.key === c.key); return !l || l.go !== c.go || l.name !== c.name; }).map((c) => c.key));
  const cards = /const CRAFTED_CARDS = (\{[^}]+\})/.exec(sona)[1];
  ok("…and the picture Home shows for it, on disk", cat.every((c) => { const m = new RegExp("\\b" + c.key + ': "([a-z]+)"').exec(cards); return m && c.pic === "/assets/crafted/home-" + m[1] + ".webp" && existsSync(path.join(ROOT, c.pic)); }),
    cat.filter((c) => !existsSync(path.join(ROOT, c.pic))).map((c) => c.pic));
  const talk = sona.slice(sona.indexOf("const STORY_TALK = ["), sona.indexOf("];", sona.indexOf("const STORY_TALK = [")));
  const stories = [...talk.matchAll(/\{ id: "([a-z]+)", sound: "([A-Z]+)", hero: "[a-z]+", name: "([^"]+)"/g)].map((m) => ({ id: m[1], sound: m[2], name: m[3] }));
  ok("every talking story is STORY_TALK's, with its sound and name, and nothing else", stories.length === 10 && JSON.stringify(stories.map((s) => s.id).sort()) === JSON.stringify(C.TALKING_STORIES.map((s) => s.id).sort()) &&
    C.TALKING_STORIES.every((t) => stories.some((s) => s.id === t.id && s.sound === t.sound && s.name === t.name)), { stories, mine: C.TALKING_STORIES });
  const forR = C.catalogFor("R"), forP = C.catalogFor("P");
  ok("R's list: every game, R's talking story (Robo's Rocket) and R's books", forR.length === cat.length + 2 && forR.some((c) => c.key === "robo" && c.kind === "story" && c.go === "/adventure.html?again=1&story=robo" && existsSync(path.join(ROOT, c.pic))) && forR.some((c) => c.key === "books" && c.go === "/library.html"), forR.map((c) => c.key));
  ok("P has no talking story: every game and its books", forP.length === cat.length + 1 && !forP.some((c) => c.kind === "story"), forP.map((c) => c.key));
  ok("an unknown sound has nothing; a key from another sound's list is refused", C.catalogFor("X").length === 0 && C.catalogItem("robo", "S") === null && C.catalogItem("sandy", "S").kind === "story" && C.catalogItem("hoops", "S").key === "hoops");
  ok("Sona's 19 sounds, in sona.js's own list", JSON.stringify(C.SOUNDS) === /const ALL_SOUNDS = (\[[^\]]+\])/.exec(sona)[1].replace(/ /g, "").replace(/"/g, '"'));
  ok("word positions follow the homework composer: vocalic R only for R, blends only for R, S and L",
    C.positionFits("R", "v") && !C.positionFits("S", "v") && C.positionFits("S", "b") && C.positionFits("L", "b") && !C.positionFits("K", "b") && C.positionFits("K", "mix") && !C.positionFits("K", "x"));
  ok("every line says what the child does in plain words, under 260 characters", C.GAMES.every((c) => c.does.length > 20 && c.does.length <= 260 && !/score|accuracy|diagnos/i.test(c.does)));
}

// ═════════════ part 2: the checks and the prompt ═════════════
const P = loadTs(path.join(APP, "lib/gamePicks.ts"));
const { readPickInput, readPicks, pickMessage, PICKS_PROMPT, LOVES_MAX } = P;
const GOOD = { sound: "R", pos: "i", age: "5-6", minutes: 30, loves: "  dinosaurs\u0000 and   trains " };
ok("a request is rebuilt field by field; `loves` is cleaned, never cut", JSON.stringify(readPickInput({ ...GOOD, name: "Mia", childId: "c1" })) === JSON.stringify({ sound: "R", pos: "i", age: "5-6", minutes: 30, loves: "dinosaurs and trains" }), readPickInput(GOOD));
ok("…minutes default to 30, and `loves` may be left out", JSON.stringify(readPickInput({ sound: "K", pos: "mix", age: "3-4" })) === JSON.stringify({ sound: "K", pos: "mix", age: "3-4", minutes: 30, loves: "" }));
for (const [label, bad, re] of [
  ["nothing", null, /Choose a sound/], ["an unknown sound", { ...GOOD, sound: "X" }, /Choose a sound/], ["vocalic R for S", { ...GOOD, sound: "S", pos: "v" }, /doesn't fit S/],
  ["blends for K", { ...GOOD, sound: "K", pos: "b" }, /doesn't fit K/], ["no age", { ...GOOD, age: "" }, /age/], ["25 minutes", { ...GOOD, minutes: 25 }, /20, 30 or 45/],
  ["`loves` that is not text", { ...GOOD, loves: 7 }, /few words/], ["`loves` over " + LOVES_MAX, { ...GOOD, loves: "x".repeat(LOVES_MAX + 1) }, /under 120/],
]) ok("refused: " + label, "error" in readPickInput(bad) && re.test(readPickInput(bad).error), readPickInput(bad));
const items = C.catalogFor("R");
const msg = pickMessage(readPickInput(GOOD), items);
ok("the message: the choices, the clinician's words, and the catalog's keys and lines", /^Target sound: R\nWhere it sits: the beginning of words\nAge: 5-6\nSession: 30 minutes\nWhat the child loves: dinosaurs and trains\n/.test(msg) &&
  /- hoops: Hoops, ages 5-8: /.test(msg) && /- robo: Robo's Rocket, any age: /.test(msg) && /- books: Books for R, any age: /.test(msg) && !/puppy/.test(msg), msg.slice(0, 300));
const pk = (key, n = 1) => ({ key, why: "It fits a child who loves dinosaurs " + n + ".", how: ["Take turns: you say a word, then the child.", "Make it easier: model the word first."] });
const three = JSON.stringify({ picks: [pk("dino"), pk("hoops"), pk("robo")] });
const read3 = readPicks(three, items);
ok("a well-formed reply: three picks, each with the catalog's name, kind and picture", Array.isArray(read3) && read3.length === 3 && read3[0].key === "dino" && read3[0].name === "Dino Dig" && read3[0].pic === "/assets/crafted/home-dino.webp" && read3[2].kind === "story" && read3[0].how.length === 2, read3);
ok("…only those fields reach the page", JSON.stringify(Object.keys(read3[0]).sort()) === JSON.stringify(["how", "key", "kind", "name", "pic", "why"]));
ok("a key not in the list it was shown is dropped (a parked game, another sound's story, a made-up one)", readPicks(JSON.stringify({ picks: [pk("puppy"), pk("sandy"), pk("hoops"), pk("dino")] }), items).map((p) => p.key).join() === "hoops,dino");
ok("a repeat is dropped; four good picks become the first three", readPicks(JSON.stringify({ picks: [pk("dino"), pk("dino"), pk("hoops")] }), items).length === 2 && readPicks(JSON.stringify({ picks: [pk("dino"), pk("hoops"), pk("robo"), pk("slice")] }), items).length === 3);
ok("an empty list is the model saying it could not pick", readPicks('{"picks":[]}', items) === "empty");
for (const [label, bad] of [
  ["not JSON", "Here are some games"], ["one usable pick", JSON.stringify({ picks: [pk("dino"), pk("nope")] })], ["five picks", JSON.stringify({ picks: ["dino", "hoops", "robo", "slice", "tiles"].map((k) => pk(k)) })],
  ["a why over 200", JSON.stringify({ picks: [{ ...pk("dino"), why: "w".repeat(201) }, pk("hoops")] })], ["one step", JSON.stringify({ picks: [{ ...pk("dino"), how: ["One."] }, pk("hoops")] })],
  ["four steps", JSON.stringify({ picks: [{ ...pk("dino"), how: ["a", "b", "c", "d"] }, pk("hoops")] })], ["a step over 180", JSON.stringify({ picks: [{ ...pk("dino"), how: ["s".repeat(181), "b"] }, pk("hoops")] })],
  ["a list, not an object", JSON.stringify([pk("dino"), pk("hoops")])],
]) ok("rejected reply: " + label, readPicks(bad, items) === null, readPicks(bad, items));
ok("the prompt picks 3 catalog items by age, interests and session length, with why and 2 or 3 steps for the session",
  /Pick the 3 catalog items that fit this child best: their age/.test(PICKS_PROMPT) && /what they love, and the session length/.test(PICKS_PROMPT) && /"how": 2 or 3 short steps for using it in the session/.test(PICKS_PROMPT));
ok("…only catalog keys, no practice words, no diagnosis, goals, evaluation or score, never a name",
  /Only use keys from the catalog\./.test(PICKS_PROMPT) && /Do not list practice words or stimulus items\./.test(PICKS_PROMPT) && /Do not diagnose, set goals, evaluate or score\./.test(PICKS_PROMPT) && /Never repeat any person's name; refer to "the child"\./.test(PICKS_PROMPT));
ok("…and asks for the exact JSON the route reads", /\{"picks":\[\{"key":"\.\.\.","why":"\.\.\.","how":\["\.\.\.","\.\.\."\]\}\]\}/.test(PICKS_PROMPT) && /\{"picks":\[\]\}/.test(PICKS_PROMPT));

// ═════════════ part 3 & 4: the routes, for real ═════════════
for (const k of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "SLP_AUTH_SECRET", "ANTHROPIC_API_KEY", "STRIPE_SECRET_KEY", "VERCEL_ENV", "SLACK_FEEDBACK_WEBHOOK_URL", "FEEDBACK_WEBHOOK_URL", "SLP_REVIEW_EMAIL", "SLP_REVIEW_CODE"]) delete process.env[k];
const KV_URL = "https://kv.games.test.invalid";
process.env.KV_REST_API_URL = KV_URL; process.env.KV_REST_API_TOKEN = "kv-test-token";
process.env.SLP_AUTH_SECRET = "games-test-secret";
const KV = new Map(), LOG = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url) === KV_URL) {
    const c = JSON.parse(init.body).map(String); LOG.push(c);
    if (c[0] === "GET") return Response.json({ result: KV.has(c[1]) ? KV.get(c[1]) : null });
    if (c[0] === "EVAL" && /^-- rl:incr\n/.test(c[1])) { const n = Number(KV.get(c[3]) || 0) + 1; KV.set(c[3], String(n)); return Response.json({ result: n }); }
    if (c[0] === "EVAL") { KV.set(c[3], (KV.get(c[3]) || "") + "\n" + c[4]); return Response.json({ result: 1 }); }
    return Response.json({ result: 1 });
  }
  if (/^http:\/\/127\.0\.0\.1:/.test(String(url))) return realFetch(url, init);
  return new Response("{}", { status: 404 });
};
const A = loadTs(path.join(APP, "lib/slpAuth.ts"));
const pickRoute = loadTs(path.join(APP, "app/api/slp/games/pick/route.ts"));
const playRoute = loadTs(path.join(APP, "app/api/slp/play/route.ts"));
const feedbackRoute = loadTs(path.join(APP, "app/api/slp/feedback/route.ts"));
const { NextRequest } = require(path.join(APP, "node_modules/next/server"));
const EMAIL = "rachel@brightsteps.org";
KV.set("slpacct:" + EMAIL, JSON.stringify({ email: EMAIL, name: "Rachel K", code: "rachel-k4", familyKey: "ABCD2345" }));   // no terms: the dashboard is open, as promised
KV.set("slpacct:pat@newclinic.org", JSON.stringify({ email: "pat@newclinic.org", name: "Pat", code: "pat-n1", familyKey: "ABCD2345", terms: "pro-2026-11-12" }));
KV.set("slpacct:fran@freedash.org", JSON.stringify({ email: "fran@freedash.org", name: "Fran", code: "fran-f1", familyKey: "ABCD2345", terms: "free-dashboard-2026-11-13", freeDashboard: true }));
let ipn = 0;
async function call(route, url, body, o = {}) {
  ipn++;
  const h = new Headers({ "content-type": "application/json", "x-real-ip": "10.9.1." + (o.ip || ipn), origin: o.origin || "https://sona.test.invalid" });
  if (o.as !== null) h.set("cookie", "slp_session=" + encodeURIComponent(A.signSession({ email: o.as || EMAIL, code: "", iat: Date.now(), exp: Date.now() + 600000 })));
  const res = await route.POST(new NextRequest("https://sona.test.invalid" + url, { method: "POST", headers: h, body: typeof body === "string" ? body : JSON.stringify(body) }));
  let json = null; try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}
const pick = (b, o) => call(pickRoute, "/api/slp/games/pick", b, o);
const play = (b, o) => call(playRoute, "/api/slp/play", b, o);
const reply = (text, stop = "end_turn") => ({ stop_reason: stop, content: [{ type: "thinking", thinking: "" }, { type: "text", text }] });
const REQ = { sound: "R", pos: "i", age: "5-6", minutes: 30, loves: "dinosaurs" };
{
  AI.reply = reply(three);
  let r = await pick(REQ, { as: null });
  ok("pick, signed out: 401, and the AI is never asked", r.status === 401 && AI.calls.length === 0, r);
  r = await pick(REQ, { origin: "https://elsewhere.example" });
  ok("…another site's page: 403", r.status === 403 && AI.calls.length === 0, r);
  r = await pick(REQ, { as: "pat@newclinic.org" });
  ok("…a dashboard without Sona Pro: 402", r.status === 402 && r.json.needPlan === true && AI.calls.length === 0, r);
  r = await pick(REQ, { as: "fran@freedash.org" });
  ok("…a free-dashboard signup of 13 to 17 Nov too (SLPPRO1: they need Sona Pro now)", r.status === 402 && r.json.needPlan === true && AI.calls.length === 0, r);
  r = await pick({ ...REQ, sound: "S", pos: "v" });
  ok("…a position that doesn't fit the sound: 400 in plain words", r.status === 400 && /doesn't fit S/.test(r.json.error) && AI.calls.length === 0, r);
  r = await pick("{not json");
  ok("…not JSON: 400", r.status === 400 && AI.calls.length === 0, r);
  r = await pick(REQ);
  ok("…no AI key: 503, and nothing is sent", r.status === 503 && /unavailable/.test(r.json.error) && AI.calls.length === 0, r);
  process.env.ANTHROPIC_API_KEY = "sk-test-not-real";
  r = await pick({ ...REQ, child: "Mia", childId: "c1", name: "Mia" });
  const c = AI.calls[0] || {};
  ok("a good request gets three picks, each named and pictured from the catalog", r.status === 200 && r.json.ok === true && r.json.picks.length === 3 && r.json.picks[0].name === "Dino Dig" && r.json.picks[2].kind === "story", r);
  ok("…from Opus 5.5 at low effort, 2000 tokens, no thinking field, the prompt as the system",
    c.model === "claude-opus-5-5" && c.max_tokens === 2000 && JSON.stringify(c.output_config) === '{"effort":"low"}' && !("thinking" in c) && c.system === PICKS_PROMPT, c);
  ok("…and what crosses is the choices, the few words on what they love and the catalog: nothing else the page sent, no account or roster",
    c.messages.length === 1 && c.messages[0].content === pickMessage(readPickInput(REQ), items) && JSON.stringify(Object.keys(c).sort()) === JSON.stringify(["max_tokens", "messages", "model", "output_config", "system"]) && !/Mia|rachel|c1/i.test(JSON.stringify(c.messages)), c.messages);
  ok("…by a client that never retries and gives up in 25 seconds", AI.client.maxRetries === 0 && AI.client.timeout === 25000);
  for (const [label, rep, status] of [
    ["a refusal", reply(three, "refusal"), 502], ["a cut-off reply", reply(three, "max_tokens"), 502], ["a malformed reply", reply("Here you go!"), 502],
    ["picks of unknown games only", reply(JSON.stringify({ picks: [pk("nope"), pk("puppy")] })), 502], ["an empty list", reply('{"picks":[]}'), 422],
  ]) {
    AI.reply = rep; r = await pick(REQ);
    ok(label + " never reaches the clinician: " + status + " in plain words", r.status === status && r.json.ok === false && !r.json.picks &&
      (status === 502 ? r.json.error === "Couldn't pick games just now. Try again." : /No good fit/.test(r.json.error)), r);
  }
  AI.throws = true; r = await pick(REQ); AI.throws = false;
  ok("a network error or timeout: 502", r.status === 502, r);
  AI.reply = reply(three);
  const before = AI.calls.length;
  for (let i = 0; i < 31; i++) r = await pick(REQ, { ip: 200 });
  ok("30 an hour from one address, then 429, with its own name", r.status === 429 && AI.calls.length === before + 30 && LOG.some((x) => x[0] === "EVAL" && /^rl:slp-games:/.test(x[3])), { status: r.status, calls: AI.calls.length - before });
  const src = read("app/api/slp/games/pick/route.ts").replace(/\/\/[^\n]*/g, "");
  const at = (t) => src.indexOf(t);
  ok("the pick route checks session, origin, rate limit, account and plan, then the request, all before the AI",
    ["liveSession(readSession(req))", "origin !== req.nextUrl.origin", "rateLimit(req", 'kvCmd(["GET", "slpacct:"', "dashboardGate(session.email)", "readPickInput("].every((t, i, a) => at(t) > 0 && (i === 0 || at(t) > at(a[i - 1])) && at(t) < at("messages.create")));
  ok("…checks the stop reason before reading the reply, and exports only its handler, runtime and time limit",
    at('stop_reason === "refusal"') > at("messages.create") && at('stop_reason === "refusal"') < at("readPicks(") && (src.match(/^export /gm) || []).length === 3 && /^export const maxDuration = 30;/m.test(src));
  ok("Plan activities is gone: its route and its library", !existsSync(path.join(APP, "app/api/slp/activities")) && !existsSync(path.join(APP, "lib/activityPlan.ts")) && !existsSync(path.join(APP, "lib/dayPlan.ts")));

  // the play route (SESSPLAY1)
  r = await play({ key: "hoops", sound: "R", pos: "i", age: "5-6" }, { as: null });
  ok("play, signed out: 401", r.status === 401, r);
  r = await play({ key: "hoops", sound: "R", pos: "i", age: "5-6" }, { origin: "https://elsewhere.example" });
  ok("…another site's page: 403", r.status === 403, r);
  r = await play({ key: "hoops", sound: "R", pos: "i", age: "5-6" }, { as: "pat@newclinic.org" });
  ok("…a dashboard without Sona Pro: 402, nothing to open", r.status === 402 && r.json.needPlan === true && !r.json.go, r);
  const t0 = Date.now();
  r = await play({ key: "hoops", sound: "R", pos: "i", age: "5-6", go: "https://evil.example" });
  ok("a catalog game: the page to open (the catalog's, never the caller's) and an end 12 hours on", r.status === 200 && r.json.ok === true && r.json.go === "/arcade-hoops.html" && r.json.key === "hoops" && Math.abs(r.json.exp - (t0 + 12 * 3600000)) < 5000, r);
  r = await play({ key: "slice", sound: "S", pos: "b", age: "7-8" });
  ok("…a round game opens on its practice page", r.status === 200 && r.json.go === "/charge.html?game=arcade-slice.html", r);
  r = await play({ key: "robo", sound: "R", pos: "v", age: "9+" });
  ok("…R's talking story, for R", r.status === 200 && r.json.go === "/adventure.html?again=1&story=robo", r);
  for (const [label, body] of [["another sound's story", { key: "robo", sound: "S", pos: "i", age: "5-6" }], ["a parked game", { key: "puppy", sound: "R", pos: "i", age: "3-4" }], ["a made-up key", { key: "../today", sound: "R", pos: "i", age: "3-4" }],
    ["a position that doesn't fit", { key: "hoops", sound: "K", pos: "v", age: "5-6" }], ["no age", { key: "hoops", sound: "R", pos: "i" }], ["an unknown sound", { key: "hoops", sound: "X", pos: "i", age: "5-6" }]]) {
    r = await play(body); ok("…refused: " + label, r.status === 400 && !r.json.go, r);
  }
  ok("the play route has its own rate limit", LOG.some((x) => x[0] === "EVAL" && /^rl:slp-play:/.test(x[3])));

  // App Review's one account stays open (SLPPRO1: the app sells nothing)
  process.env.SLP_REVIEW_EMAIL = "pat@newclinic.org"; process.env.SLP_REVIEW_CODE = "123456";
  r = await play({ key: "hoops", sound: "R", pos: "i", age: "5-6" }, { as: "pat@newclinic.org" });
  ok("App Review's account (SLP_REVIEW_EMAIL with its code set) is open without Sona Pro", r.status === 200 && r.json.ok === true, r);
  delete process.env.SLP_REVIEW_CODE;
  r = await play({ key: "hoops", sound: "R", pos: "i", age: "5-6" }, { as: "pat@newclinic.org" });
  ok("…and only while its code is set too", r.status === 402, r);
  delete process.env.SLP_REVIEW_EMAIL;

  // game ideas through the feedback route
  r = await call(feedbackRoute, "/api/slp/feedback", { kind: "idea", text: "A cooking game where each word adds an ingredient." });
  const stored = [...KV.entries()].find(([k]) => /^slp-feedback:/.test(k));
  ok("a game idea is taken, kept as an idea for the team", r.status === 200 && r.json.ok === true && !!stored && /"kind":"idea"/.test(stored[1]) && /"category":"idea"/.test(stored[1]), { r, stored });
  r = await call(feedbackRoute, "/api/slp/feedback", { kind: "idea", text: "x".repeat(501) });
  ok("…at most 500 characters", r.status === 400 && /500 characters/.test(r.json.error), r);
  r = await call(feedbackRoute, "/api/slp/feedback", { kind: "call", text: "Call me" });
  ok("…and still no call requests", r.status === 400 && /call requests/.test(r.json.error), r);
}
globalThis.fetch = realFetch;

// ═════════════ part 5: the page ═════════════
const PORT = 8423;
const slpSrc = read("tests/slptest.mjs");
const fixture = () => runInNewContext(slpSrc.slice(slpSrc.indexOf("const day ="), slpSrc.indexOf("// ── mock API:")) + "\nfixture();", { Date });
const ACCOUNT = { ok: true, email: "rachel@example.com", code: "rachel-k4", familyKey: "ABCD2345", name: "Rachel K", clinic: "Bright Steps", onboarded: true };
const PICKS = [
  { key: "dino", kind: "game", name: "Dino Dig", pic: "/assets/crafted/home-dino.webp", why: "Digging fits a child who loves dinosaurs.", how: ["Take turns with the brush.", "Make it easier: say the word first."] },
  { key: "hoops", kind: "game", name: "Hoops", pic: "/assets/crafted/home-hoops.webp", why: "Quick turns for an active child.", how: ["Each word earns a shot.", "Make it harder: say it in a sentence."] },
  { key: "robo", kind: "story", name: "Robo's Rocket", pic: "/assets/crafted/home-robo.webp", why: "A story in R, every page.", how: ["Read together.", "Point to each key word."] },
];
let posts = [], answer = null, playAnswer = null, noCode = false, slow = 0;
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", jpg: "image/jpeg" };
const server = createServer((req, res) => {
  const u = new URL(req.url, "http://x"); let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let b = {}; try { b = JSON.parse(body || "{}"); } catch {}
    const json = (v, s = 200) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(v)); };
    if (u.pathname.startsWith("/api/")) {
      if (req.method !== "GET") posts.push({ path: u.pathname, body: b, raw: body });
      if (u.pathname === "/api/slp/auth/me") return json(noCode ? { ...ACCOUNT, code: "", familyKey: "", onboarded: false } : ACCOUNT);
      if (u.pathname === "/api/slp") return json({ ok: true, configured: true, kids: fixture().kids, invites: [] });
      if (u.pathname === "/api/slp/games/pick") { const a = answer || { status: 200, body: { ok: true, picks: PICKS } }; return setTimeout(() => json(a.body, a.status), slow); }
      if (u.pathname === "/api/slp/play") { const a = playAnswer || { status: 200, body: { ok: true, exp: Date.now() + 12 * 3600000, go: "/fonts.css?game=" + b.key, key: b.key } }; return json(a.body, a.status); }
      return json({ ok: true });
    }
    const p = u.pathname === "/slp.html" ? ROOT + "/slp.html" : ROOT + u.pathname;
    if (!existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(p));
  });
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const browser = await chromium.launch(launchOpts());
async function open(hash, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 } }), page = await context.newPage(), errors = [];
  page.setDefaultTimeout(3000); page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:" + PORT + "/slp.html" + hash);
  await page.waitForFunction(() => /Rachel K|rachel/.test(document.getElementById("sidebarName").textContent) || document.getElementById("page-play").classList.contains("active"));
  await page.waitForTimeout(300);
  return { context, page, errors };
}
const sent = (p) => posts.filter((x) => x.path === p);
try {
  {
    posts = []; answer = null;
    const { context, page, errors } = await open("");
    const st = await page.evaluate(() => ({ active: document.getElementById("page-play").classList.contains("active"), h1: document.querySelector("#page-play h1").textContent,
      sounds: [...document.querySelectorAll("#playSound option")].map((o) => o.value), sound: document.getElementById("playSound").value,
      pos: [...document.querySelectorAll("#playPos option")].map((o) => o.value), ages: [...document.querySelectorAll("#playAge option")].map((o) => o.value), min: document.getElementById("playMin").value,
      max: document.getElementById("playLoves").maxLength, note: document.getElementById("playNote").textContent, btn: document.getElementById("playGo").textContent, crumb: document.getElementById("pageCrumb").textContent }));
    ok("the dashboard opens on Session games", st.active && st.h1 === "Session games" && st.crumb === "Session games" && st.btn === "Find Sona games", st);
    ok("…the form: Sona's 19 sounds, the positions R has, the four age bands, 20/30/45 minutes, and a 120-character box",
      st.sounds.length === 19 && st.sound === "R" && JSON.stringify(st.pos) === '["i","m","f","v","b","mix"]' && JSON.stringify(st.ages) === '["","3-4","5-6","7-8","9+"]' && st.min === "30" && st.max === 120, st);
    ok("…and, in plain sight under the box, the name warning and what goes to the AI", /^Don't type a child's name\. The sound, position, age, minutes and what you type here go to our AI provider \(Anthropic\) to pick the games\.$/.test(st.note.trim()) && await page.locator("#playNote").isVisible(), st.note);
    await page.selectOption("#playSound", "K");
    ok("choosing K takes vocalic R and blends off the positions", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("#playPos option")].map((o) => o.value))) === '["i","m","f","mix"]');
    await page.selectOption("#playSound", "R");
    await page.click("#playGo"); await page.waitForTimeout(100);
    ok("no age: nothing is sent, and the page says what to do", sent("/api/slp/games/pick").length === 0 && /Choose the child's age first/.test(await page.locator("#playErr").innerText()));
    await page.locator("#playExamples .plan-example").first().click();
    const ex = await page.evaluate(() => ({ s: document.getElementById("playSound").value, p: document.getElementById("playPos").value, a: document.getElementById("playAge").value, l: document.getElementById("playLoves").value }));
    ok("an example fills the form (an age band, a sound, interests: never a name), and sends nothing", ex.s === "K" && ex.p === "i" && ex.a === "3-4" && ex.l === "trucks" && sent("/api/slp/games/pick").length === 0, ex);
    await page.selectOption("#playSound", "R"); await page.selectOption("#playAge", "5-6"); await page.fill("#playLoves", "dinosaurs");
    slow = 600; await page.click("#playGo"); await page.waitForTimeout(150);
    const wait = await page.evaluate(() => ({ wait: !document.getElementById("playWait").hidden, text: document.getElementById("playWait").innerText, anim: getComputedStyle(document.querySelector("#playWait .plan-echo")).animationName }));
    ok("while the AI works, Echo bobs and says so", wait.wait && /Echo is picking games…/.test(wait.text) && wait.anim === "echoBob", wait);
    await page.waitForSelector("#playResult:not([hidden])"); slow = 0;
    ok("it posts ONE request carrying only the form's five fields", sent("/api/slp/games/pick").length === 1 && sent("/api/slp/games/pick")[0].raw === JSON.stringify({ sound: "R", pos: "i", age: "5-6", minutes: 30, loves: "dinosaurs" }), sent("/api/slp/games/pick"));
    const cards = await page.evaluate(() => [...document.querySelectorAll("#playPicks .act")].map((c) => ({ img: c.querySelector("img.pick-pic") && c.querySelector("img.pick-pic").getAttribute("src"), h: c.querySelector("h3").textContent, t: c.innerText, play: c.querySelector(".pick-play") && c.querySelector(".pick-play").textContent, top: getComputedStyle(c).borderTopColor })));
    ok("three cards, each Sona's own game with its picture, why it fits, how to use it in session and Play now",
      cards.length === 3 && cards[0].img === "/assets/crafted/home-dino.webp" && cards[0].h === "Dino Dig" && /Why it fits/.test(cards[0].t) && /How to use it in session/.test(cards[0].t) && /Take turns with the brush/.test(cards[0].t) && cards.every((c) => c.play === "Play now"), cards);
    ok("…numbered, in teal, yellow and coral", JSON.stringify(cards.map((c) => c.top)) === JSON.stringify(["rgb(14, 124, 134)", "rgb(255, 201, 60)", "rgb(242, 85, 90)"]), cards.map((c) => c.top));
    ok("…under a heading that says what they were picked for", (await page.locator("#playHeading").textContent()) === "R · beginning of words · ages 5–6");
    // Play now: the server's yes first, then the tab's record, then the game
    playAnswer = { status: 402, body: { ok: false, needPlan: true, error: "Your dashboard comes with Sona Pro." } };
    await page.locator("#playPicks .pick-play").nth(1).click(); await page.waitForTimeout(300);
    ok("a server's no (402) writes no record and opens nothing", (await page.evaluate(() => sessionStorage.getItem("sona.sessplay.v1"))) === null && page.url().includes("/slp.html") && /Sona Pro/.test(await page.locator("#playErr").innerText()));
    playAnswer = null;
    await page.evaluate(() => { sessionStorage.setItem("sona.sp:sona.profile.v1", "{\"old\":1}"); sessionStorage.setItem("sona.play.token", "arcade-stack.html"); });
    await Promise.all([page.waitForURL(/fonts\.css\?game=hoops/), page.locator("#playPicks .pick-play").nth(1).click()]);
    const rec = await page.evaluate(() => ({ rec: JSON.parse(sessionStorage.getItem("sona.sessplay.v1") || "null"), box: sessionStorage.getItem("sona.sp:sona.profile.v1"), token: sessionStorage.getItem("sona.play.token") }));
    const pp = sent("/api/slp/play");
    ok("Play now asks the server with the key, sound, position and age, never a name", pp.length === 2 && pp[1].raw === JSON.stringify({ key: "hoops", sound: "R", pos: "i", age: "5-6" }), pp);
    ok("…and only after its yes writes this tab's record (the server's end), clears an old box and token, and opens the server's page",
      rec.rec && rec.rec.sound === "R" && rec.rec.pos === "i" && rec.rec.age === "5-6" && rec.rec.game === "hoops" && rec.rec.exp > Date.now() && rec.box === null && rec.token === null, rec);
    ok("no page errors", errors.length === 0, errors.join(" | "));
    await context.close();
  }
  {
    posts = []; answer = null;
    const { context, page, errors } = await open("#play");
    // the caseload, as a starting point: a sound, a position and an age, never a name
    await page.selectOption("#playFrom", "c1");
    const seeded = await page.evaluate(() => ({ s: document.getElementById("playSound").value, p: document.getElementById("playPos").value, a: document.getElementById("playAge").value, l: document.getElementById("playLoves").value }));
    ok("Start from your caseload lists the children by name, on this page only", (await page.locator("#playFrom option").allTextContents()).includes("Mia"));
    ok("…and picking one chooses their sound, position and age band, never their name", seeded.s === "R" && seeded.p === "m" && seeded.a === "5-6" && seeded.l === "", seeded);
    await page.fill("#playLoves", "Mia loves trains");
    await page.click("#playGo"); await page.waitForTimeout(150);
    ok("a caseload child's name in what they love is never sent: the page says to take it out", sent("/api/slp/games/pick").length === 0 && /Take out “Mia” first/.test(await page.locator("#playErr").innerText()));
    await page.fill("#playLoves", "Miami trips and trains");
    await page.click("#playGo"); await page.waitForTimeout(300);
    ok("…but a name inside another word is not one", sent("/api/slp/games/pick").length === 1);
    answer = { status: 502, body: { ok: false, error: "Couldn't pick games just now. Try again." } };
    await page.click("#playAgain"); await page.waitForTimeout(300);
    ok("a failure says so, offers Try again, and keeps the last picks", /Couldn't pick games just now/.test(await page.locator("#playErr").innerText()) && await page.locator("#playRetry").isVisible() && (await page.locator("#playPicks .act").count()) === 3 && await page.locator("#playResult").isVisible());
    answer = null;
    // the idea box
    await page.click("#ideaGo"); await page.waitForTimeout(100);
    ok("an empty idea is not sent", sent("/api/slp/feedback").length === 0 && /Write your idea first/.test(await page.locator("#ideaMsg").textContent()));
    await page.fill("#ideaText", "A cooking game where each word adds an ingredient.");
    await page.click("#ideaGo"); await page.waitForTimeout(300);
    ok("Send idea goes to the Sona team as an idea, and says thank you", sent("/api/slp/feedback").length === 1 && sent("/api/slp/feedback")[0].raw === JSON.stringify({ kind: "idea", text: "A cooking game where each word adds an ingredient." }) &&
      (await page.locator("#ideaMsg").textContent()) === "Sent to the Sona team. Thank you!" && (await page.inputValue("#ideaText")) === "" && (await page.locator("#ideaText").getAttribute("maxlength")) === "500");
    ok("the page has no errors", errors.length === 0, errors.join(" | "));
    await context.close();
  }
  {
    posts = []; noCode = true;
    const { context, page, errors } = await open("#play", 390);
    ok("a new clinician with no family link yet can use Session games", await page.locator("#page-play").isVisible() && !(await page.locator("#page-onboarding").isVisible()));
    ok("…with no caseload to start from", await page.locator("#playFromRow").isHidden());
    await page.selectOption("#playAge", "7-8"); await page.click("#playGo");
    await page.waitForSelector("#playResult:not([hidden])");
    const fit = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, cards: [...document.querySelectorAll("#playPicks .act")].every((c) => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }) }));
    ok("390px phone: the cards stack and fit", fit.over <= 0 && fit.cards, fit);
    ok("…no page errors", errors.length === 0, errors.join(" | "));
    noCode = false; await context.close();
  }
  const src = read("public/slp.html");
  ok("the page posts to the picker in one place, with the five fields alone", (src.match(/fetch\("\/api\/slp\/games\/pick"/g) || []).length === 1 && /body:JSON\.stringify\(\{sound:c\.sound,pos:c\.pos,age:c\.age,minutes:c\.minutes,loves:c\.loves\}\)/.test(src));
  ok("…and writes the session record in one place, after /api/slp/play", (src.match(/setItem\("sona\.sessplay\.v1"/g) || []).length === 1 && src.indexOf('setItem("sona.sessplay.v1"') > src.indexOf('fetch("/api/slp/play"'));
  ok("the suite is registered in run-all", /"sessiongamestest\.mjs"/.test(read("tests/run-all.mjs")) && /"sessplaytest\.mjs"/.test(read("tests/run-all.mjs")));
} finally {
  await browser.close(); server.close();
}
console.log(checks + " checks; " + fails + " failures");
process.exit(fails ? 1 : 0);
