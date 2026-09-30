// FEEDBACK1: /api/feedback — the quick notes parents tap inside the app (the
// Home pulse, the Settings chips, a game's win-screen card). Same standard as
// SLPFEEDBACK1: same-origin, rate-limited, a whitelisted record with no
// childId, one atomic list, Slack or the dedicated hook only, and a 2xx only
// when something kept the note. The founder read takes its key from a header
// and /leads.html shows it. Every network call is mocked locally.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();
function loadTs(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = (spec) => spec.startsWith("@/") ? loadTs(path.join(ROOT, spec.slice(2) + ".ts")) : require(spec);
  new Function("require", "module", "exports", js)(localRequire, mod, mod.exports);
  return mod.exports;
}
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
// A "must not appear" check reads CODE, not the comment that explains the ban.
const noComments = (src) => src
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:"'])\/\/[^\n]*/g, "$1");

const { POST, GET } = loadTs(path.join(ROOT, "app/api/feedback/route.ts"));
const originalFetch = globalThis.fetch;
const ENV_KEYS = ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "FOUNDER_KEY",
  "SLACK_FEEDBACK_WEBHOOK_URL", "FEEDBACK_WEBHOOK_URL", "LEAD_WEBHOOK_URL", "PILOT_WEBHOOK_URL"];
const originalEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
let checks = 0, fails = 0, requestId = 0;
function ok(label, condition, detail) { checks++; if (!condition) fails++; console.log((condition ? "PASS " : "FAIL ") + label + (!condition && detail ? "  — " + detail : "")); }
const SITE = "https://sona.test.invalid";
const KV = "https://kv.test.invalid", SLACK = "https://slack.test.invalid", FEEDBACK = "https://feedback.test.invalid";
const FOUNDER_KEY = "founder-key-for-feedback-tests";
const RECORD_KEYS = ["text", "src", "q", "game", "sound", "level", "code", "at"].sort().join();
// Every outbound request in the suite, so one check can say no note ever
// reached a pilot or lead hook, whatever the case.
const everyCall = [];

function setEnv(opts) {
  for (const k of ENV_KEYS) delete process.env[k];
  if (opts.kv !== false) { process.env.KV_REST_API_URL = KV; process.env.KV_REST_API_TOKEN = "fake-kv-token"; }
  if (opts.slack) process.env.SLACK_FEEDBACK_WEBHOOK_URL = SLACK;
  if (opts.webhook) process.env.FEEDBACK_WEBHOOK_URL = FEEDBACK;
  if (opts.founderKey !== false) process.env.FOUNDER_KEY = opts.founderKey || FOUNDER_KEY;
  // Always set: the old route fell back to these, and none may be reached.
  process.env.LEAD_WEBHOOK_URL = "https://lead.test.invalid";
  process.env.PILOT_WEBHOOK_URL = "https://pilot.test.invalid";
}

function mockFetch(opts, calls, records) {
  globalThis.fetch = async (url, init = {}) => {
    const payload = JSON.parse(init.body || "null"); const call = { url: String(url), payload };
    calls.push(call); everyCall.push(call);
    if (String(url) === KV) {
      const op = payload[0];
      if (op === "INCR") return Response.json({ result: opts.rateLimited ? 31 : 1 });
      if (op === "EVAL") {
        if (opts.storeThrows) throw new Error("KV unavailable");
        records.push(JSON.parse(payload[4]));
        return opts.storeHttpFailure ? Response.json({ error: "offline" }, { status: 503 }) : Response.json({ result: opts.storeFails ? null : 1 });
      }
      if (op === "SCAN") return Response.json({ result: ["0", Object.keys(opts.lists || {}).filter(k => k.startsWith("feedback:"))] });
      if (op === "LRANGE") return Response.json({ result: (opts.lists || {})[payload[1]] || [] });
      return Response.json({ result: 1 });
    }
    if (opts.webhookThrows) throw new Error("inbox offline");
    if (String(url) === SLACK) return new Response("slack", { status: opts.slackFails ? 503 : 200 });
    if (String(url) === FEEDBACK) return new Response("feedback", { status: opts.webhookFails ? 500 : 202 });
    return new Response("unapproved generic destination", { status: 200 });
  };
}

async function submit(body, opts = {}) {
  setEnv(opts);
  const calls = [], records = [];
  mockFetch(opts, calls, records);
  const headers = new Headers({ "content-type": "application/json", "x-real-ip": "feedback-test-" + (++requestId) });
  if (opts.origin !== null) headers.set("origin", opts.origin || SITE);
  if (opts.contentLength) headers.set("content-length", String(opts.contentLength));
  const request = new Request(SITE + "/api/feedback", { method: "POST", headers, body: opts.raw ? body : JSON.stringify(body) });
  try {
    const response = await POST(request);
    return { status: response.status, json: await response.json(), calls, records };
  } catch (error) {
    return { status: 599, json: { thrown: error.message }, calls, records };
  }
}

async function founderRead(opts = {}) {
  setEnv(opts);
  const calls = [];
  mockFetch(opts, calls, []);
  const headers = new Headers();
  if (opts.header) headers.set("x-founder-key", opts.header);
  const request = new Request(SITE + "/api/feedback" + (opts.query || ""), { headers });
  // The route reads nothing but headers and the URL; a plain Request stands in for NextRequest.
  request.nextUrl = new URL(request.url);
  try {
    const response = await GET(request);
    return { status: response.status, json: await response.json(), cache: response.headers.get("cache-control"), calls };
  } catch (error) {
    return { status: 599, json: { thrown: error.message }, calls };
  }
}

// The three shapes that already ship, as their callers build them.
const PULSE = { q: "pulse.chips", text: "More games + Progress reports · the frog is a hit", src: "pulse", code: "RACHEL1" };
const GAME = { game: "Fruit Slice", sound: "r", text: "Too fast for my 5 year old", code: "ff-abc123", childId: "k9x2mq7a", level: 2, at: "1999-01-01T00:00:00.000Z" };
const SETTINGS = { q: "settings.chips", text: "Easier to assign · recommend: Definitely", src: "settings-slp", code: "morgan-ab" };

try {
  // ── who may post ──
  let result = await submit(PULSE, { origin: null });
  ok("a post with no Origin (a script, not a browser) is refused before any request", result.status === 403 && result.calls.length === 0);
  result = await submit(PULSE, { origin: "https://evil.test.invalid" });
  ok("a post from another site is refused before any request", result.status === 403 && result.calls.length === 0);
  result = await submit(PULSE, { contentLength: 20001 });
  ok("a declared body over 20 KB is refused before any request", result.status === 413 && result.calls.length === 0);
  result = await submit(JSON.stringify({ ...PULSE, pad: "x".repeat(20001) }), { raw: true });
  ok("an undeclared body over 20 KB is refused without storing", result.status === 413 && result.records.length === 0);
  result = await submit(PULSE, { rateLimited: true });
  ok("past 30 an hour a caller is rate limited without storing or forwarding",
    result.status === 429 && result.records.length === 0 && result.calls.every(c => c.url === KV && c.payload[0] !== "EVAL"));
  ok("…in its own bucket", result.calls.some(c => c.payload[0] === "INCR" && /^rl:feedback:/.test(c.payload[1])));

  // ── what is accepted ──
  for (const value of ["{oops", "null", "[]", '"just text"']) {
    result = await submit(value, { raw: true });
    ok("invalid JSON shape is rejected: " + value, result.status === 400 && result.records.length === 0);
  }
  for (const text of [undefined, "   ", { bad: true }, 42]) {
    result = await submit({ ...PULSE, text });
    ok("a note needs text: " + JSON.stringify(text), result.status === 400 && result.records.length === 0);
  }

  result = await submit(PULSE);
  let record = result.records[0];
  ok("the Home pulse's shape is accepted and confirmed by the store", result.status === 200 && result.json.ok && result.json.stored && !result.json.delivered);
  ok("…kept as the pulse answer it is", record?.src === "pulse" && record.q === "pulse.chips" && record.code === "RACHEL1" && record.text === PULSE.text);
  ok("…in the one list the founder reads, appended, capped and expired in one step, for a year",
    result.calls.some(c => c.payload?.[0] === "EVAL" && /LPUSH/.test(c.payload[1]) && /LTRIM', KEYS\[1\], 0, 1999/.test(c.payload[1]) && /EXPIRE/.test(c.payload[1])
      && c.payload[2] === 1 && c.payload[3] === "fb:beta" && c.payload[5] === 31536000));

  result = await submit(GAME);
  record = result.records[0];
  ok("the game card's shape is accepted", result.status === 200 && result.json.ok && record?.game === "Fruit Slice" && record.sound === "R" && record.level === 2 && record.code === "ff-abc123");
  ok("…and reaches the same list as the pulse (only pulse answers did before)",
    result.calls.some(c => c.payload?.[0] === "EVAL" && c.payload[3] === "fb:beta"));
  ok("…with no childId: the record holds only the allowlisted fields", record && Object.keys(record).sort().join() === RECORD_KEYS && !("childId" in record), record && Object.keys(record).join());
  ok("…stamped with the server's clock, not the phone's", record && record.at !== GAME.at && Math.abs(Date.parse(record.at) - Date.now()) < 60000);
  ok("…and nothing is ever written under a key built from the code the phone sent",
    result.calls.every(c => !(c.url === KV && c.payload.some(p => typeof p === "string" && /^feedback:/.test(p)))));

  result = await submit(SETTINGS);
  ok("the Settings chips' shape is accepted, clinician and all", result.status === 200 && result.records[0]?.src === "settings-slp" && result.records[0].code === "morgan-ab");

  result = await submit({ text: "hello", src: "somewhere-new", code: "../../etc", q: "<b>q</b>", sound: "rrrr!", level: { deep: 1 }, childName: "Leo", email: "mom@example.test", slpCode: "x" });
  record = result.records[0];
  ok("odd optional fields are dropped, not allowed to cost the parent the note", result.status === 200 && record?.text === "hello");
  ok("…a code that isn't code-shaped is not kept", record?.code === "");
  ok("…nor a question id, a sound or a level that isn't one", record?.q === "" && record.sound === "" && record.level === "");
  ok("…an unknown source is filed as 'other', not as a game", record?.src === "other");
  ok("…and a name or email in the body goes nowhere", record && !JSON.stringify(record).includes("Leo") && !JSON.stringify(record).includes("mom@example.test"));
  result = await submit({ text: "ok", level: "12" });
  ok("a level sent as digits is kept as a number", result.records[0]?.level === 12);
  result = await submit({ text: "a".repeat(1500) });
  ok("a long note is shortened to 1000 characters, not refused", result.status === 200 && result.records[0]?.text.length === 1000);
  result = await submit({ text: "\\".repeat(1000) });
  ok("a maximum-length escaped note is stored as valid, complete JSON", result.status === 200 && result.records[0]?.text.length === 1000);

  // ── honest receipt ──
  for (const opts of [{ kv: false }, { storeFails: true }, { storeHttpFailure: true }, { storeThrows: true }]) {
    result = await submit(PULSE, opts);
    ok("nothing kept and nothing notified is a 503, never ok: " + JSON.stringify(opts), result.status === 503 && result.json.ok === false);
  }
  result = await submit(GAME, { kv: false, webhook: true });
  let hooked = result.calls.find(c => c.url === FEEDBACK)?.payload;
  ok("the dedicated hook's acceptance confirms receipt when KV is absent", result.status === 200 && result.json.delivered && !result.json.stored);
  ok("…with the payload it has always had, less the childId", hooked?.kind === "game-feedback" && hooked.game === "Fruit Slice" && !("childId" in hooked));
  result = await submit(PULSE, { kv: false, webhook: true, webhookFails: true });
  ok("a hook that answers 500 is not a capture (the old route said captured:true)", result.status === 503 && !result.json.ok);
  result = await submit(PULSE, { kv: false, webhook: true, webhookThrows: true });
  ok("a hook that throws is not a capture", result.status === 503 && !result.json.ok);

  // ── Slack ──
  result = await submit({ ...GAME, text: "<!channel> <https://evil.test|click> *bold*" }, { kv: false, slack: true, webhook: true });
  const slack = result.calls.find(c => c.url === SLACK)?.payload;
  ok("Slack's acceptance confirms delivery without a second forward", result.status === 200 && result.json.slackSent && result.json.delivered && result.calls.filter(c => c.url !== KV).length === 1);
  ok("…showing what they typed as plain text, never markup", slack?.blocks.some(b => b.text?.type === "plain_text" && b.text.text === "<!channel> <https://evil.test|click> *bold*")
    && !JSON.stringify(slack).includes("mrkdwn"));
  ok("…under a fixed notification line, not their words", slack?.text === "In-app feedback" && !slack.text.includes("channel"));
  ok("…saying where it came from", slack?.blocks.some(b => b.text?.type === "plain_text" && /From: Fruit Slice, win screen\nSound: R\nLevel: 2/.test(b.text.text)));
  ok("…and never the code or a childId", !JSON.stringify(slack).includes("ff-abc123") && !JSON.stringify(slack).includes("k9x2mq7a"));
  result = await submit(PULSE, { kv: false, slack: true });
  ok("a pulse answer is announced as one", result.calls.find(c => c.url === SLACK)?.payload.text === "Beta pulse answer");
  result = await submit(PULSE, { kv: false, slack: true, slackFails: true, webhook: true });
  ok("when Slack fails, the fallback is the dedicated hook and nothing else", result.status === 200 && !result.json.slackSent && result.json.delivered
    && result.calls.every(c => [KV, SLACK, FEEDBACK].includes(c.url)));
  result = await submit(PULSE, { slack: true, slackFails: true, webhook: true, webhookFails: true });
  ok("a note the store kept is received even when every notification fails", result.status === 200 && result.json.stored && !result.json.delivered);

  ok("across every case, no note ever reached the pilot or lead hooks",
    everyCall.length > 0 && everyCall.every(c => [KV, SLACK, FEEDBACK].includes(c.url)), [...new Set(everyCall.map(c => c.url))].join(" "));

  // ── the founder read ──
  const stored = (o) => JSON.stringify(o);
  const lists = {
    "fb:beta": [
      stored({ text: "new game note", src: "", game: "Sound Sprint", sound: "S", level: 3, code: "RACHEL1", at: "2026-09-29T20:00:00.000Z" }),
      stored({ text: "old pulse", q: "pulse.chips", src: "pulse", code: "pilot", childId: "old-child-id", at: "2026-09-20T10:00:00.000Z" }),
      "not json",
    ],
    "feedback:pilot": [
      stored({ text: "old pulse", q: "pulse.chips", src: "pulse", code: "pilot", childId: "old-child-id", at: "2026-09-20T10:00:00.000Z" }),
      stored({ text: "stranded settings note", src: "settings", code: "pilot", childId: "old-child-id", level: { x: 1 }, at: "2026-09-25T09:00:00.000Z" }),
    ],
  };
  result = await founderRead({ lists });
  ok("the founder read needs a key", result.status === 401 && result.calls.length === 0);
  result = await founderRead({ lists, query: "?key=" + FOUNDER_KEY });
  ok("…and a key in the URL is not accepted (it lands in logs and history)", result.status === 401 && result.calls.length === 0);
  result = await founderRead({ lists, header: FOUNDER_KEY + "x" });
  ok("…nor a wrong one", result.status === 401 && result.calls.length === 0);
  result = await founderRead({ lists, header: "short", founderKey: "short" });
  ok("…and a FOUNDER_KEY under 12 characters opens nothing", result.status === 503);
  result = await founderRead({ lists, header: FOUNDER_KEY });
  const items = result.json.items || [];
  ok("with the key in a header it answers, uncached", result.status === 200 && result.json.ok && /no-store/.test(result.cache || ""));
  ok("…every note newest first, and a stranded Settings note from a per-code list shows too",
    JSON.stringify(items.map(i => i.text)) === JSON.stringify(["new game note", "stranded settings note", "old pulse"]), JSON.stringify(items.map(i => i.text)));
  ok("…a pulse answer that sits in both old lists shows once", items.filter(i => i.text === "old pulse").length === 1);
  ok("…and no childId leaves the store, even from notes kept before this build",
    !JSON.stringify(result.json).includes("old-child-id") && items.every(i => Object.keys(i).sort().join() === RECORD_KEYS));
  ok("…a malformed old level reads as blank, not as an object", items.find(i => i.text === "stranded settings note")?.level === "");
} finally {
  globalThis.fetch = originalFetch;
  for (const k of ENV_KEYS) { if (originalEnv[k] === undefined) delete process.env[k]; else process.env[k] = originalEnv[k]; }
}

// ── source contracts ──
{
  const route = noComments(read("app/api/feedback/route.ts"));
  ok("the route names no pilot or lead hook", !/PILOT_WEBHOOK_URL|LEAD_WEBHOOK_URL/.test(route));
  ok("…never reads a founder key from the query string", !/searchParams/.test(route) && /founderGate\(req\)/.test(route));
  ok("…and never touches a childId", !/childId/.test(route));
  const sona = read("public/sona.js");
  const card = sona.slice(sona.indexOf("function gameFeedbackCard"), sona.indexOf("return card;", sona.indexOf("function gameFeedbackCard")));
  ok("the game card no longer sends a childId", card.length > 100 && /sendFeedback\(\{ game: game/.test(card) && !/childId/.test(noComments(card)));
  ok("sendFeedback still posts to /api/feedback", /fetch\("\/api\/feedback", \{ method: "POST"/.test(sona));
  ok("the Home pulse still posts the shape this suite accepts",
    /fetch\("\/api\/feedback"[\s\S]{0,200}q:"pulse\.chips",text:[\s\S]{0,80}src:"pulse",code:code/.test(read("public/today.html")));
  // "Talk to us" replaces the Settings chips; while they post here, same shape.
  const settings = read("public/settings.html");
  ok("the Settings chips, while they post here, post the shape this suite accepts", !/\/api\/feedback"/.test(settings) ||
    /fetch\("\/api\/feedback"[\s\S]{0,200}q: "settings\.chips", text: text, src: isSlp \? "settings-slp" : "settings", code: code/.test(settings));
  const leads = noComments(read("public/leads.html"));
  ok("/leads.html reads the answers with the founder key in a header",
    /fetch\("\/api\/feedback", \{ headers: \{ "x-founder-key": key \}/.test(leads) && !/api\/feedback\?/.test(leads));
}

// ── /leads.html in a browser: the In-app answers table ──
{
  let browser = null;
  try {
    const { chromium, launchOpts } = await import("./_env.mjs");
    browser = await chromium.launch(launchOpts());
    const page = await browser.newPage();
    const keys = [];
    let alerted = false;
    page.on("dialog", async (d) => { alerted = true; await d.dismiss(); });
    await page.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      const json = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
      if (u.pathname === "/leads.html") return route.fulfill({ status: 200, contentType: "text/html", body: read("public/leads.html") });
      if (u.pathname === "/api/founders/leads") return json({ ok: true, leads: [], clinicians: [] });
      if (u.pathname === "/api/feedback") {
        keys.push({ header: route.request().headers()["x-founder-key"], query: u.search });
        return json({ ok: true, items: [
          { text: "<img src=x onerror=alert(1)>", src: "", q: "", game: "Fruit Slice", sound: "R", level: "2", code: "RACHEL1", at: "2026-09-29T20:00:00.000Z" },
          { text: "More games", src: "pulse", q: "pulse.chips", game: "", sound: "", level: "", code: "", at: "2026-09-28T20:00:00.000Z" },
          { text: "Easier to assign", src: "settings-slp", q: "settings.chips", game: "", sound: "", level: "", code: "morgan-ab", at: "2026-09-27T20:00:00.000Z" },
        ] });
      }
      return route.fulfill({ status: 404, body: "" });
    });
    await page.goto("http://leads.test.invalid/leads.html");
    await page.fill("#key", FOUNDER_KEY);
    await page.click("#go");
    await page.waitForSelector("#tAnswers td", { timeout: 5000 });
    const rows = await page.$$eval("#tAnswers tr", (trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent)));
    ok("the answers are asked for with the key in a header, not the URL", keys.length === 1 && keys[0].header === FOUNDER_KEY && keys[0].query === "", JSON.stringify(keys));
    ok("the table reads When, Where, Sound, Code, What they said", JSON.stringify(rows[0]) === JSON.stringify(["When", "Where", "Sound", "Code", "What they said"]), JSON.stringify(rows[0]));
    ok("…says where each note came from", rows[1]?.[1] === "Fruit Slice win screen, level 2" && rows[2]?.[1] === "Home pulse" && rows[3]?.[1] === "Settings (clinician)", JSON.stringify(rows.map(r => r[1])));
    ok("…and shows what someone typed as text, never as markup",
      rows[1]?.[4] === "<img src=x onerror=alert(1)>" && !alerted && (await page.$$("#tAnswers img")).length === 0);
  } catch (e) {
    ok("the founder page runs in a browser", false, e && e.message);
  } finally {
    if (browser) await browser.close();
  }
}

console.log(`${checks - fails}/${checks} passed`);
process.exitCode = fails ? 1 : 0;
