// SLPCLEAN1: Plan activities, the dashboard's AI planner for in-session
// activities (Travis, 17 Nov 2026: "I have a kid who is 5, who's interested
// in XYZ, and then it auto creates activities for that kid"). It replaced the
// day planner (PLANDAY1) and the AI homework draft. Travis chose free typing
// and accepted that what is typed goes to Anthropic. Pinned here:
//   1. lib/activityPlan.ts: the request is { text } alone, 3 to 600 characters
//      after control characters go, never cut; the reply is read strictly
//      (2 to 4 activities, the first 3 kept, every field present and within
//      its limit), and the prompt asks for play-based activities, lists no
//      practice words, and never repeats a name.
//   2. The route, run for real against a fake store and a fake AI: the guards
//      in the old planner's order, exactly what reaches the model (the typed
//      text and the prompt, Opus 5.5 at low effort, no `thinking` field), and
//      a refusal, a cut-off or a malformed reply never reaching the clinician.
//   3. The page, against a mock API: it posts only { text }, shows the
//      warning, draws three cards, copies them, seeds the box from the
//      caseload with an age and a target but never a name, and refuses to
//      send a caseload child's name it finds in the text.
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

// ═════════════ part 1: the checks and the prompt ═════════════
const P = loadTs(path.join(APP, "lib/activityPlan.ts"));
const { readText, readActivities, ACTIVITY_PROMPT, TEXT_MAX } = P;
ok("a description is read as typed", JSON.stringify(readText({ text: "  A 5-year-old who loves trains, R at the start of words.  " })) === JSON.stringify({ text: "A 5-year-old who loves trains, R at the start of words." }));
ok("…only its text: anything else the page sends is never read", JSON.stringify(readText({ text: "Age 6, loves cats.", name: "Mia", childId: "c1" })) === JSON.stringify({ text: "Age 6, loves cats." }));
ok("…control characters go, a line break stays", readText({ text: "Age 6.\u0000\u0007\tLoves\r\ncats. " }).text === "Age 6.   Loves\ncats.", JSON.stringify(readText({ text: "Age 6.\u0000\u0007\tLoves\r\ncats. " })));
for (const [label, bad] of [["nothing", null], ["a list", ["Age 6"]], ["no text", {}], ["text that is not a string", { text: 6 }], ["fewer than 3 characters", { text: " a " }], ["only control characters", { text: "\u0001\u0002\u0003\u0004" }]])
  ok("refused: " + label, "error" in readText(bad) && /Describe the child and the session/.test(readText(bad).error));
const long = readText({ text: "x".repeat(TEXT_MAX + 1) });
ok("over " + TEXT_MAX + " characters is refused in words, never cut", TEXT_MAX === 600 && "error" in long && /under 600/.test(long.error) && readText({ text: "x".repeat(600) }).text.length === 600);

const act = (n) => ({ name: "Dino dig " + n, need: "Toy dinosaurs, sand, picture cards", steps: ["Bury the cards.", "Each find is a turn to practice."], easier: "Model it first.", harder: "Use a carrier phrase." });
const three = JSON.stringify({ activities: [act(1), act(2), act(3)] });
ok("a well-formed reply is read, three activities", JSON.stringify(readActivities(three)) === JSON.stringify([act(1), act(2), act(3)]));
ok("…a fenced one too", readActivities("```json\n" + three + "\n```").length === 3);
ok("two are accepted, four become the first three", readActivities(JSON.stringify({ activities: [act(1), act(2)] })).length === 2 && JSON.stringify(readActivities(JSON.stringify({ activities: [act(1), act(2), act(3), act(4)] }))) === JSON.stringify([act(1), act(2), act(3)]));
ok("only the five fields reach the page, rebuilt one by one", JSON.stringify(readActivities(JSON.stringify({ activities: [{ ...act(1), script: "<img>", child: "Mia" }, act(2), act(3)] }))[0]) === JSON.stringify(act(1)));
ok("an empty list is the model saying the text was not a session to plan", readActivities(JSON.stringify({ activities: [] })) === "empty");
for (const [label, bad] of [
  ["not JSON", "Here are some ideas"],
  ["one activity", JSON.stringify({ activities: [act(1)] })],
  ["five activities", JSON.stringify({ activities: [1, 2, 3, 4, 5].map(act) })],
  ["a missing field", JSON.stringify({ activities: [{ ...act(1), harder: undefined }, act(2), act(3)] })],
  ["an empty name", JSON.stringify({ activities: [{ ...act(1), name: "  " }, act(2), act(3)] })],
  ["a name over 60", JSON.stringify({ activities: [{ ...act(1), name: "n".repeat(61) }, act(2), act(3)] })],
  ["materials over 160", JSON.stringify({ activities: [{ ...act(1), need: "n".repeat(161) }, act(2), act(3)] })],
  ["one step", JSON.stringify({ activities: [{ ...act(1), steps: ["Only one."] }, act(2), act(3)] })],
  ["five steps", JSON.stringify({ activities: [{ ...act(1), steps: ["a", "b", "c", "d", "e"] }, act(2), act(3)] })],
  ["a step over 200", JSON.stringify({ activities: [{ ...act(1), steps: ["s".repeat(201), "b"] }, act(2), act(3)] })],
  ["a step that is not text", JSON.stringify({ activities: [{ ...act(1), steps: ["a", 2] }, act(2), act(3)] })],
  ["easier over 160", JSON.stringify({ activities: [{ ...act(1), easier: "e".repeat(161) }, act(2), act(3)] })],
  ["a list, not an object", JSON.stringify([act(1), act(2), act(3)])],
]) ok("rejected reply: " + label, readActivities(bad) === null);
ok("the prompt asks for in-session, play-based activities built around the child's interests, for the age and the time",
  /IN a speech session/.test(ACTIVITY_PROMPT) && /3 play-based activities built around the child's interests/.test(ACTIVITY_PROMPT) && /ordinary clinic materials/.test(ACTIVITY_PROMPT) && /Fit the activities to the child's age and to the session length/.test(ACTIVITY_PROMPT));
ok("…says where target practice fits, one way easier and one harder", /how target practice fits into the play/.test(ACTIVITY_PROMPT) && /one way to make it easier and one way to make it harder/.test(ACTIVITY_PROMPT));
ok("…lists no practice words, and does not diagnose, set goals, evaluate or score", /Do not list practice words or stimulus items: the clinician chooses those\./.test(ACTIVITY_PROMPT) && /Do not diagnose, set goals, evaluate, or score\./.test(ACTIVITY_PROMPT));
ok("…never repeats a name, and returns an empty list for text that is not a session", /Never repeat any person's name that appears in the text; refer to "the child"\./.test(ACTIVITY_PROMPT) && /\{"activities":\[\]\}/.test(ACTIVITY_PROMPT));
ok("…and asks for the exact JSON the page reads, with its limits", /"steps":\["\.\.\.","\.\.\."\]/.test(ACTIVITY_PROMPT) && /at most 60 characters/.test(ACTIVITY_PROMPT) && /2 to 4 short steps/.test(ACTIVITY_PROMPT));

// ═════════════ part 2: the route, for real ═════════════
for (const k of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "SLP_AUTH_SECRET", "ANTHROPIC_API_KEY", "STRIPE_SECRET_KEY", "VERCEL_ENV"]) delete process.env[k];
const KV_URL = "https://kv.activities.test.invalid";
process.env.KV_REST_API_URL = KV_URL; process.env.KV_REST_API_TOKEN = "kv-test-token";
process.env.SLP_AUTH_SECRET = "activities-test-secret";
const KV = new Map(), LOG = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url) === KV_URL) {
    const c = JSON.parse(init.body).map(String); LOG.push(c);
    if (c[0] === "GET") return Response.json({ result: KV.has(c[1]) ? KV.get(c[1]) : null });
    if (c[0] === "EVAL" && /^-- rl:incr\n/.test(c[1])) { const n = Number(KV.get(c[3]) || 0) + 1; KV.set(c[3], String(n)); return Response.json({ result: n }); }
    return Response.json({ result: 1 });
  }
  if (/^http:\/\/127\.0\.0\.1:/.test(String(url))) return realFetch(url, init);
  return new Response("{}", { status: 404 });
};
const A = loadTs(path.join(APP, "lib/slpAuth.ts"));
const route = loadTs(path.join(APP, "app/api/slp/activities/route.ts"));
const { NextRequest } = require(path.join(APP, "node_modules/next/server"));
const EMAIL = "rachel@brightsteps.org";
KV.set("slpacct:" + EMAIL, JSON.stringify({ email: EMAIL, name: "Rachel K", code: "rachel-k4", familyKey: "ABCD2345" }));   // no terms: the dashboard is open
KV.set("slpacct:pat@newclinic.org", JSON.stringify({ email: "pat@newclinic.org", name: "Pat", code: "pat-n1", familyKey: "ABCD2345", terms: "pro-2026-11-12" }));
let ipn = 0;
async function post(body, o = {}) {
  ipn++;
  const h = new Headers({ "content-type": "application/json", "x-real-ip": "10.9.0." + (o.ip || ipn), origin: o.origin || "https://sona.test.invalid" });
  if (o.as !== null) h.set("cookie", "slp_session=" + encodeURIComponent(A.signSession({ email: o.as || EMAIL, code: "", iat: Date.now(), exp: Date.now() + 600000 })));
  const res = await route.POST(new NextRequest("https://sona.test.invalid/api/slp/activities", { method: "POST", headers: h, body: typeof body === "string" ? body : JSON.stringify(body) }));
  let json = null; try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}
const reply = (text, stop = "end_turn") => ({ stop_reason: stop, content: [{ type: "thinking", thinking: "" }, { type: "text", text }] });
const TEXT = "A 5-year-old who loves dinosaurs, working on R at the start of words. 30-minute session.";
{
  AI.reply = reply(three);
  let r = await post({ text: TEXT }, { as: null });
  ok("signed out: 401, and the AI is never asked", r.status === 401 && AI.calls.length === 0, r);
  r = await post({ text: TEXT }, { origin: "https://elsewhere.example" });
  ok("another site's page: 403", r.status === 403 && AI.calls.length === 0, r);
  r = await post({ text: TEXT }, { as: "pat@newclinic.org" });
  ok("a closed dashboard (Sona Pro's, not on): 402, as the old planner", r.status === 402 && r.json.needPlan === true && AI.calls.length === 0, r);
  r = await post({ text: "hi" });
  ok("too short: 400 in plain words", r.status === 400 && /Describe the child and the session/.test(r.json.error) && AI.calls.length === 0, r);
  r = await post({ text: "x".repeat(601) });
  ok("too long: 400, never cut", r.status === 400 && /under 600/.test(r.json.error) && AI.calls.length === 0, r);
  r = await post("{not json");
  ok("not JSON: 400", r.status === 400 && AI.calls.length === 0, r);
  r = await post({ text: TEXT });
  ok("no AI key: 503, and nothing is sent", r.status === 503 && /unavailable/.test(r.json.error) && AI.calls.length === 0, r);
  process.env.ANTHROPIC_API_KEY = "sk-test-not-real";
  r = await post({ text: "  " + TEXT + "\u0000 ", child: "Mia", childId: "c1", age: 6 });
  const call = AI.calls[0] || {};
  ok("a good request gets the three activities", r.status === 200 && r.json.ok === true && JSON.stringify(r.json.activities) === JSON.stringify([act(1), act(2), act(3)]), r);
  ok("…from Opus 5.5 at low effort, 3000 tokens, no thinking field, the prompt as the system",
    call.model === "claude-opus-5-5" && call.max_tokens === 3000 && JSON.stringify(call.output_config) === '{"effort":"low"}' && !("thinking" in call) && call.system === ACTIVITY_PROMPT, call);
  ok("…and the ONLY thing that crosses is the typed text: nothing else the page sent, no account or roster",
    JSON.stringify(call.messages) === JSON.stringify([{ role: "user", content: TEXT }]) && JSON.stringify(Object.keys(call).sort()) === JSON.stringify(["max_tokens", "messages", "model", "output_config", "system"]) && !/Mia|rachel|c1/i.test(JSON.stringify(call.messages)), call);
  ok("…by a client that never retries and gives up in 25 seconds", AI.client.maxRetries === 0 && AI.client.timeout === 25000 && AI.client.apiKey === "sk-test-not-real");
  for (const [label, rep, status] of [
    ["a refusal", reply(three, "refusal"), 502], ["a cut-off reply", reply(three, "max_tokens"), 502], ["a malformed reply", reply("Here you go!"), 502],
    ["a reply with no text", { stop_reason: "end_turn", content: [] }, 502], ["an empty list", reply('{"activities":[]}'), 422],
  ]) {
    AI.reply = rep; r = await post({ text: TEXT });
    ok(label + " never reaches the clinician: " + status + " in plain words", r.status === status && r.json.ok === false && !r.json.activities &&
      (status === 502 ? r.json.error === "Couldn't make activities. Try again or reword it." : /Describe a child and the session/.test(r.json.error)), r);
  }
  AI.throws = true; r = await post({ text: TEXT }); AI.throws = false;
  ok("a network error or timeout: 502", r.status === 502 && r.json.error === "Couldn't make activities. Try again or reword it.", r);
  AI.reply = reply(three);
  const before = AI.calls.length;
  for (let i = 0; i < 31; i++) r = await post({ text: TEXT }, { ip: 200 });
  ok("30 an hour from one address, then 429", r.status === 429 && AI.calls.length === before + 30, { status: r.status, calls: AI.calls.length - before });
  ok("the rate limit has its own name", LOG.some((c) => c[0] === "EVAL" && /^rl:slp-activities:/.test(c[3])));
  const src = read("app/api/slp/activities/route.ts").replace(/\/\/[^\n]*/g, "");
  const at = (t) => src.indexOf(t);
  ok("the route checks session, origin, rate limit, account and plan, then the text, all before the AI",
    ["liveSession(readSession(req))", "origin !== req.nextUrl.origin", "rateLimit(req", 'kvCmd(["GET", "slpacct:"', "dashboardGate(session.email)", "readText("].every((t, i, a) => at(t) > 0 && (i === 0 || at(t) > at(a[i - 1])) && at(t) < at("messages.create")));
  ok("…checks the stop reason before reading the reply", at('stop_reason === "refusal"') > at("messages.create") && at('stop_reason === "max_tokens"') > 0 && at('stop_reason === "refusal"') < at("readActivities("));
  ok("…and exports only its handler, runtime and time limit", (src.match(/^export /gm) || []).length === 3 && /^export const maxDuration = 30;/m.test(src) && /^export const runtime = "nodejs";/m.test(src));
  ok("the old planner, its library and the homework draft are gone", !existsSync(path.join(APP, "app/api/slp/sessions")) && !existsSync(path.join(APP, "lib/dayPlan.ts")) && !existsSync(path.join(APP, "app/api/slp/homework/draft")));
}
globalThis.fetch = realFetch;

// ═════════════ part 3: the page ═════════════
const PORT = 8423;
const slpSrc = read("tests/slptest.mjs");
const fixture = () => runInNewContext(slpSrc.slice(slpSrc.indexOf("const day ="), slpSrc.indexOf("// ── mock API:")) + "\nfixture();", { Date });
const ACCOUNT = { ok: true, email: "rachel@example.com", code: "rachel-k4", familyKey: "ABCD2345", name: "Rachel K", clinic: "Bright Steps", onboarded: true };
let posts = [], answer = null, noCode = false;
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
      if (u.pathname === "/api/slp/activities") { const a = answer || { status: 200, body: { ok: true, activities: [act(1), act(2), act(3)] } }; return json(a.body, a.status); }
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
  await page.addInitScript(() => { window.__copied = []; window.__confirms = []; Object.defineProperty(navigator, "clipboard", { value: { writeText: (s) => (window.__copied.push(s), Promise.resolve()) } }); window.confirm = (m) => (window.__confirms.push(m), true); });
  await page.goto("http://127.0.0.1:" + PORT + "/slp.html" + hash);
  await page.waitForFunction(() => /Rachel K|rachel/.test(document.getElementById("sidebarName").textContent) || document.getElementById("page-plan").classList.contains("active"));
  await page.waitForTimeout(300);
  return { context, page, errors };
}
const asked = () => posts.filter((p) => p.path === "/api/slp/activities");
try {
  {
    posts = []; answer = null;
    const { context, page, errors } = await open("");
    const st = await page.evaluate(() => ({ active: document.getElementById("page-plan").classList.contains("active"), h1: document.querySelector("#page-plan h1").textContent,
      lead: document.querySelector("#page-plan .page-header p").textContent, label: document.querySelector('label[for="planText"]').textContent, ph: document.getElementById("planText").placeholder,
      max: document.getElementById("planText").maxLength, note: document.getElementById("planNote").textContent, btn: document.getElementById("planGo").textContent, count: document.getElementById("planCount").textContent }));
    ok("the dashboard opens on Plan activities, in Travis's words", st.active && st.h1 === "Plan activities" && st.lead === "Describe the child and the session. Sona drafts activities you can run today." && st.btn === "Make activities", st);
    ok("…one box, About the child and session, 600 characters at most, with a counter", st.label === "About the child and session" && st.ph === "A 5-year-old who loves dinosaurs, working on R at the start of words. 30-minute session." && st.max === 600 && st.count === "0/600", st);
    ok("…and, in plain sight under it, the name warning and where the text goes", st.note === "Don't type a child's name. What you type is sent to our AI provider (Anthropic) to write the ideas." && await page.locator("#planNote").isVisible(), st.note);
    await page.click("#planGo"); await page.waitForTimeout(100);
    ok("an empty box sends nothing and says what to do", asked().length === 0 && /Describe the child and the session first/.test(await page.locator("#planErr").innerText()));
    await page.fill("#planText", TEXT);
    ok("the counter follows the typing", (await page.locator("#planCount").textContent()) === TEXT.length + "/600");
    await page.click("#planGo");
    await page.waitForSelector("#planResult:not([hidden])");
    ok("it posts ONE request carrying only { text }", asked().length === 1 && asked()[0].raw === JSON.stringify({ text: TEXT }), asked());
    const cards = await page.locator("#planActs .act").count();
    const first = await page.locator("#planActs .act").first().innerText();
    ok("three activity cards: name, You'll need, How it goes as numbered steps, Make it easier and Make it harder",
      cards === 3 && /Dino dig 1/.test(first) && /You'll need/.test(first) && /Toy dinosaurs, sand, picture cards/.test(first) && /How it goes/.test(first) &&
      (await page.locator("#planActs .act").first().locator("ol li").count()) === 2 && /Make it easier: Model it first\./.test(first) && /Make it harder: Use a carrier phrase\./.test(first), first);
    await page.click("#planCopy"); await page.waitForTimeout(100);
    const copied = await page.evaluate(() => window.__copied.slice(-1)[0] || "");
    ok("Copy all copies every activity as plain text", /^Activities\nFor: A 5-year-old who loves dinosaurs/.test(copied) && /1\. Dino dig 1\nYou'll need: Toy dinosaurs, sand, picture cards\nHow it goes:\n  1\) Bury the cards\.\n  2\) Each find is a turn to practice\.\nMake it easier: Model it first\.\nMake it harder: Use a carrier phrase\./.test(copied) && /3\. Dino dig 3/.test(copied), copied);
    await page.click("#planAgain"); await page.waitForTimeout(300);
    ok("New ideas asks again with the same text", asked().length === 2 && asked()[1].raw === JSON.stringify({ text: TEXT }));
    answer = { status: 502, body: { ok: false, error: "Couldn't make activities. Try again or reword it." } };
    await page.click("#planGo"); await page.waitForTimeout(300);
    ok("a failure says so in plain words, offers Try again, and keeps the box and the last ideas", /Couldn't make activities\. Try again or reword it\./.test(await page.locator("#planErr").innerText()) && await page.locator("#planRetry").isVisible() &&
      (await page.inputValue("#planText")) === TEXT && (await page.locator("#planActs .act").count()) === 3 && !(await page.locator("#planGo").isDisabled()));
    answer = null; await page.click("#planRetry"); await page.waitForTimeout(300);
    ok("…and Try again asks once more and clears the error", asked().length === 4 && !(await page.locator("#planRetry").isVisible()) && !(await page.locator("#planErrText").textContent()));
    // the caseload, as a starting point: an age and a target, never a name
    await page.fill("#planText", "");
    await page.selectOption("#planFrom", "c1");
    const seeded = await page.inputValue("#planText");
    ok("Start from your caseload lists the children by name, on this page", (await page.locator("#planFrom option").allTextContents()).includes("Mia") && !(await page.locator("#planFrom option").allTextContents()).includes("New family"));
    ok("…and picking one writes their age and target, never their name", /^Age 6\. Working on R in the middle of words\.\s$/.test(seeded) && !/Mia/.test(seeded), seeded);
    await page.fill("#planText", seeded + "Loves trains.");
    await page.selectOption("#planFrom", "c2");
    ok("…and asks before replacing what the clinician typed", (await page.evaluate(() => window.__confirms.length)) === 1 && /^Age 4\. Working on K at the start of words\./.test(await page.inputValue("#planText")));
    const n = asked().length;
    await page.fill("#planText", "Mia is 6 and loves trains. Working on R.");
    await page.click("#planGo"); await page.waitForTimeout(150);
    ok("a caseload child's name in the text is never sent: the page says to take it out", asked().length === n && /Take out “Mia” first/.test(await page.locator("#planErr").innerText()), await page.locator("#planErr").innerText());
    await page.fill("#planText", "A 6-year-old who loves Miami trips and trains. Working on R.");
    await page.click("#planGo"); await page.waitForTimeout(300);
    ok("…but a name inside another word is not one", asked().length === n + 1);
    ok("the planner has no page errors", errors.length === 0, errors.join(" | "));
    await context.close();
  }
  {
    posts = []; noCode = true;
    const { context, page, errors } = await open("#plan", 390);
    ok("a new clinician with no family link yet can plan (the planner, not the one form)", await page.locator("#page-plan").isVisible() && !(await page.locator("#page-onboarding").isVisible()));
    ok("…with no caseload to start from", await page.locator("#planFromRow").isHidden());
    await page.fill("#planText", TEXT); await page.click("#planGo");
    await page.waitForSelector("#planResult:not([hidden])");
    const fit = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, cards: [...document.querySelectorAll("#planActs .act")].every((c) => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }) }));
    ok("390px phone: the cards stack and fit", fit.over <= 0 && fit.cards, fit);
    ok("…no page errors", errors.length === 0, errors.join(" | "));
    noCode = false; await context.close();
  }
  const page = read("public/slp.html");
  ok("the page posts to the planner in one place, with { text } alone", (page.match(/fetch\("\/api\/slp\/activities"/g) || []).length === 1 && /body:JSON\.stringify\(\{text:text\}\)/.test(page));
  ok("the suite is registered in run-all", /"activityplantest\.mjs"/.test(read("tests/run-all.mjs")));
} finally {
  await browser.close(); server.close();
}
console.log(checks + " checks; " + fails + " failures");
process.exit(fails ? 1 : 0);
