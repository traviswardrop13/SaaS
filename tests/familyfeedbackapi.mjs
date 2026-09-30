// FAMILYFEEDBACK1: the parents' "Talk to us" route (app/api/family/feedback)
// and the founder's reader for it (app/api/founders/feedback). Families never
// sign in, so this route is guarded differently from the SLP one — same
// origin, a body cap, a rate limit, a honeypot — and its reply address is for
// replying only: it never reaches a lead, pilot or CRM destination, and
// nothing about a child is ever kept beside it. Every network call is mocked.
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
const { POST } = loadTs(path.join(ROOT, "app/api/family/feedback/route.ts"));
const { GET: FOUNDER_GET } = loadTs(path.join(ROOT, "app/api/founders/feedback/route.ts"));
const originalFetch = globalThis.fetch;
const ENV_KEYS = ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "SLACK_FEEDBACK_WEBHOOK_URL", "FEEDBACK_WEBHOOK_URL", "LEAD_WEBHOOK_URL", "PILOT_WEBHOOK_URL", "KIT_API_KEY", "FOUNDER_KEY"];
const originalEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
let checks = 0, fails = 0, ip = 0;
function ok(label, condition, detail) { checks++; if (!condition) fails++; console.log((condition ? "PASS " : "FAIL ") + label + (condition || detail === undefined ? "" : " → " + JSON.stringify(detail))); }
const KV = "https://kv.test.invalid", SLACK = "https://slack.test.invalid", FEEDBACK = "https://feedback.test.invalid";
const LEAD = "https://lead.test.invalid", PILOT = "https://pilot.test.invalid";
const SITE = "https://sona.test.invalid";
const GOOD = { kind: "feedback", chips: ["More games"], text: "", recommend: "", email: "", prefer: "", availability: "", timezone: "America/Boise", app: "web", website: "" };

async function submit(body, opts = {}) {
  for (const k of ENV_KEYS) delete process.env[k];
  if (opts.kv !== false) { process.env.KV_REST_API_URL = KV; process.env.KV_REST_API_TOKEN = "fake-kv-token"; }
  if (opts.slack) process.env.SLACK_FEEDBACK_WEBHOOK_URL = SLACK;
  if (opts.webhook) process.env.FEEDBACK_WEBHOOK_URL = FEEDBACK;
  // Set on every run: a lead or pilot destination that exists must still
  // never receive a parent's message.
  process.env.LEAD_WEBHOOK_URL = LEAD;
  process.env.PILOT_WEBHOOK_URL = PILOT;
  process.env.KIT_API_KEY = "kit-key-never-used";
  const calls = [], records = [];
  globalThis.fetch = async (url, init = {}) => {
    let payload = null; try { payload = JSON.parse(init.body || "null"); } catch { payload = init.body; }
    calls.push({ url: String(url), payload, raw: String(init.body || "") });
    if (String(url) === KV) {
      const op = payload[0];
      if (op === "INCR") return Response.json({ result: opts.rateLimited ? 11 : 1 });
      if (op === "EVAL") {
        if (opts.storeThrows) throw new Error("KV unavailable");
        records.push(JSON.parse(payload[4]));
        return opts.storeHttpFailure ? Response.json({ error: "offline" }, { status: 503 }) : Response.json({ result: opts.storeFails ? null : 1 });
      }
      return Response.json({ result: 1 });
    }
    if (opts.webhookThrows) throw new Error("inbox offline");
    if (String(url) === SLACK) return new Response("slack", { status: opts.slackFails ? 503 : 200 });
    if (String(url) === FEEDBACK) return new Response("feedback", { status: opts.webhookFails ? 500 : 202 });
    return new Response("unapproved destination", { status: 200 });
  };
  const headers = new Headers({ "content-type": "application/json", "x-real-ip": "family-feedback-test-" + (++ip) });
  const origin = opts.origin === undefined ? SITE : opts.origin;
  if (origin) headers.set("origin", origin);
  if (opts.contentLength) headers.set("content-length", String(opts.contentLength));
  const request = new Request(SITE + "/api/family/feedback", { method: "POST", headers, body: opts.raw ? body : JSON.stringify(body) });
  try {
    const response = await POST(request);
    return { status: response.status, json: await response.json(), calls, records };
  } catch (error) {
    return { status: 599, json: { thrown: error.message }, calls, records };
  }
}
const outbound = (r) => r.calls.filter((c) => c.url !== KV);
const onlyApproved = (r) => r.calls.every((c) => [KV, SLACK, FEEDBACK].includes(c.url));

try {
  // ── who may post ──
  let r = await submit(GOOD, { origin: "https://evil.test" });
  ok("a cross-site post is refused before anything is read or sent", r.status === 403 && r.calls.length === 0 && r.records.length === 0, r.status);
  r = await submit(GOOD, { origin: "" });
  ok("a post with no Origin (a script) is refused too", r.status === 403 && r.calls.length === 0 && /Sona app/.test(r.json.error), r.json);
  r = await submit(JSON.stringify({ ...GOOD, text: "x".repeat(20001) }), { raw: true });
  ok("an oversized body is refused with 413 and nothing kept", r.status === 413 && r.records.length === 0 && r.calls.length === 0, r.status);
  r = await submit(GOOD, { contentLength: 20001 });
  ok("…including when content-length already says so", r.status === 413 && r.calls.length === 0, r.status);
  r = await submit(JSON.stringify({ ...GOOD, text: "é".repeat(10500) }), { raw: true });
  ok("…and the cap counts bytes, not characters", r.status === 413 && r.records.length === 0, r.status);
  for (const value of ["{oops", "null", "[]", "\"text\""]) {
    r = await submit(value, { raw: true });
    ok("a body that is not a JSON object is refused: " + value, r.status === 400 && r.records.length === 0);
  }
  r = await submit({ ...GOOD, website: "https://spam.example" }, { slack: true, webhook: true });
  ok("the honeypot answers ok and stores nothing, counts nothing, sends nothing", r.status === 200 && r.json.ok === true && r.calls.length === 0 && r.records.length === 0, r.calls);
  r = await submit({ ...GOOD, website: 1 }, { slack: true });
  ok("…whatever a bot puts in it", r.status === 200 && r.calls.length === 0);
  r = await submit(GOOD, { rateLimited: true, slack: true });
  ok("the eleventh message in an hour from one address is refused, and nothing kept or sent", r.status === 429 && r.records.length === 0 && r.calls.every((c) => c.url === KV), r.status);
  ok("…counted in its own bucket", r.calls.some((c) => c.payload?.[0] === "INCR" && /^rl:familyfeedback:/.test(c.payload[1])));

  // ── what may be said ──
  for (const [label, body] of [
    ["no kind", { ...GOOD, kind: undefined }],
    ["an unknown kind", { ...GOOD, kind: "booked" }],
    ["text over 2000", { ...GOOD, text: "a".repeat(2001) }],
    ["text that is not a string", { ...GOOD, text: { bad: true } }],
    ["availability over 240", { ...GOOD, kind: "call", email: "a@b.co", availability: "a".repeat(241) }],
    ["timezone over 80", { ...GOOD, timezone: "a".repeat(81) }],
    ["an email over 254", { ...GOOD, email: "a".repeat(250) + "@b.co" }],
    ["a malformed email", { ...GOOD, email: "not-an-email" }],
    ["an email with markup in it", { ...GOOD, email: "<x>@evil.test" }],
    ["a made-up recommend answer", { ...GOOD, recommend: "Absolutely!!" }],
    ["a made-up call preference", { ...GOOD, kind: "call", email: "a@b.co", prefer: "fax" }],
    ["an unknown app", { ...GOOD, app: "android" }],
    ["chips that are not a list", { ...GOOD, chips: "More games" }],
    ["more than six chips", { ...GOOD, chips: ["More games", "More games", "More games", "More games", "More games", "More games", "More games"] }],
  ]) {
    r = await submit(body);
    ok("refused: " + label, r.status === 400 && r.records.length === 0 && outbound(r).length === 0, r);
  }
  r = await submit({ ...GOOD, kind: "call", chips: [], email: "" });
  ok("a call request needs an email, and says why", r.status === 400 && r.json.error === "Please add an email so we can reply." && r.records.length === 0, r.json);
  r = await submit({ ...GOOD, chips: [], text: "   " });
  ok("feedback needs a chip or some text", r.status === 400 && r.records.length === 0, r.json);
  r = await submit({ ...GOOD, chips: ["Rate my child", "<!channel>"], text: "" });
  ok("…and a chip nobody offered does not count as one", r.status === 400 && r.records.length === 0, r.json);

  // ── what is kept ──
  r = await submit({
    kind: "feedback", chips: ["More games", "Made up", "Easier to assign", "More games"], text: "  More dinosaur words please.  ",
    recommend: "Definitely", email: "  parent@example.test ", prefer: "", availability: "", timezone: "America/Boise", app: "ios", website: "",
    childName: "Mia", slpCode: "ABC123", childId: "k1", code: "ff-secret", replyEmail: "spoof@example.test", at: "1999-01-01", source: "lead",
  });
  let rec = r.records[0];
  ok("feedback is accepted once the store confirms it", r.status === 200 && r.json.ok && r.json.stored === true && r.json.delivered === false, r.json);
  ok("unknown and repeated chips are dropped; known ones from either set survive", JSON.stringify(rec?.chips) === JSON.stringify(["More games", "Easier to assign"]), rec?.chips);
  ok("the record is exactly the allowlisted fields",
    JSON.stringify(Object.keys(rec || {}).sort()) === JSON.stringify(["app", "at", "availability", "chips", "from", "kind", "prefer", "recommend", "replyEmail", "text", "timezone"]), Object.keys(rec || {}));
  ok("text and email are trimmed; the reply address is the one typed, never a spoofed field",
    rec?.text === "More dinosaur words please." && rec.replyEmail === "parent@example.test" && rec.recommend === "Definitely" && rec.app === "ios" && rec.at !== "1999-01-01");
  // The privacy policy says a time zone comes only with a call request.
  ok("plain feedback keeps no time zone, even when one is sent", rec?.timezone === "", rec?.timezone);
  ok("…and is filed as a family's unless it says otherwise", rec?.from === "family", rec?.from);
  const everything = JSON.stringify(r.calls.map((c) => c.raw));
  ok("a child's name, a clinician code, a child id or a pilot code never reach the store or any request",
    !/Mia|ABC123|ff-secret|"k1"|childName|slpCode|childId/.test(everything), everything.slice(0, 300));
  ok("storage is one atomic step: append, cap at 1000, expire in a year",
    r.calls.some((c) => c.payload?.[0] === "EVAL" && /RPUSH/.test(c.payload[1]) && /LTRIM', KEYS\[1\], -1000, -1/.test(c.payload[1]) && /EXPIRE/.test(c.payload[1]) && c.payload[3] === "family-feedback" && c.payload[5] === 31536000));
  ok("the lead and pilot webhooks, and Kit, never hear of it", r.calls.every((c) => c.url === KV), r.calls.map((c) => c.url));

  r = await submit({ kind: "call", chips: [], text: "", recommend: "", email: "dad@example.test", prefer: "phone", availability: "weekday evenings", timezone: "America/New_York", app: "web", website: "" });
  rec = r.records[0];
  ok("a call can be requested without a message", r.status === 200 && rec?.kind === "call" && rec.text === "", r.json);
  ok("…keeping how and when to talk, and where to reply", rec?.prefer === "phone" && rec.availability === "weekday evenings" && rec.timezone === "America/New_York" && rec.replyEmail === "dad@example.test", rec);
  r = await submit({ ...GOOD, chips: [], text: "Just text is fine", email: "" });
  ok("feedback needs no email", r.status === 200 && r.records[0]?.replyEmail === "" && JSON.stringify(r.records[0].chips) === "[]");
  r = await submit({ kind: "feedback", text: "Only the essentials" });
  ok("optional fields may be left out entirely", r.status === 200 && r.records[0]?.app === "web" && r.records[0].prefer === "" && r.records[0].recommend === "", r.json);

  // ── honest delivery ──
  for (const opts of [{ kv: false }, { storeFails: true }, { storeHttpFailure: true }, { storeThrows: true }]) {
    r = await submit({ ...GOOD, text: "Please keep my draft if this fails." }, opts);
    ok("nothing stored and nothing delivered is never a success: " + JSON.stringify(opts), r.status === 503 && r.json.ok === false && /couldn't receive/.test(r.json.error) && onlyApproved(r), r);
  }
  // No generic webhook for family messages: the privacy policy names Upstash
  // and Slack, and a third destination for a parent's reply email would be
  // one it doesn't name.
  r = await submit({ ...GOOD, kind: "call", email: "mom@example.test", prefer: "video", availability: "Friday", timezone: "UTC" }, { kv: false, webhook: true });
  ok("FEEDBACK_WEBHOOK_URL is never called for a family message, so with no store it is a 503",
    r.status === 503 && !r.json.ok && !r.calls.some((c) => c.url === FEEDBACK), r.calls.map((c) => c.url));

  r = await submit({ ...GOOD, text: "<!channel> *bold* <https://evil.test|click>" }, { kv: false, slack: true, webhook: true });
  const slack = r.calls.find((c) => c.url === SLACK)?.payload;
  ok("Slack's acceptance is delivery, with no second copy to the fallback", r.status === 200 && r.json.delivered && outbound(r).length === 1, r.calls.map((c) => c.url));
  ok("Slack is headed Parent feedback", slack?.text === "Parent feedback" && slack.blocks[0].text.text === "Parent feedback");
  ok("Slack shows what a stranger typed as plain text, literally",
    slack?.blocks.some((b) => b.text?.type === "plain_text" && b.text.text === "<!channel> *bold* <https://evil.test|click>"));
  const types = []; JSON.stringify(slack, (k, v) => { if (k === "type" && typeof v === "string") types.push(v); return v; });
  ok("…and never as mrkdwn anywhere in the message", !types.includes("mrkdwn") && !/mrkdwn/.test(JSON.stringify(slack)), types);
  ok("…and the notification line Slack does parse is a fixed phrase", !/channel/.test(slack?.text || ""));
  r = await submit({ ...GOOD, kind: "call", email: "gran@example.test", prefer: "email" }, { kv: false, slack: true });
  const callSlack = r.calls.find((c) => c.url === SLACK)?.payload;
  ok("a call request is headed Parent call request and says how they'd like to talk",
    callSlack?.blocks[0].text.text === "Parent call request" && /Prefers: Just email/.test(JSON.stringify(callSlack)) && /gran@example\.test/.test(JSON.stringify(callSlack)));
  r = await submit(GOOD, { slack: true, slackFails: true, webhook: true });
  ok("when Slack fails, nothing else is tried; the stored copy is the receipt",
    r.status === 200 && r.json.stored && !r.json.delivered && onlyApproved(r) && !r.calls.some((c) => c.url === FEEDBACK), r.calls.map((c) => c.url));
  r = await submit({ ...GOOD, from: "slp" }, { kv: false, slack: true });
  const slpSlack = r.calls.find((c) => c.url === SLACK)?.payload;
  ok("a clinician's note from the family app is headed Clinician feedback", slpSlack?.blocks[0].text.text === "Clinician feedback", slpSlack?.blocks?.[0]);
  r = await submit({ ...GOOD, from: "admin" });
  ok("an unknown sender is refused", r.status === 400 && r.records.length === 0, r.json);
  r = await submit({ ...GOOD, email: "a\ud800b@example.test" });
  ok("an email with a broken character is refused, so the reader's mailto can't choke on it", r.status === 400 && r.records.length === 0, r.json);
  r = await submit(GOOD, { slack: true, slackFails: true, webhook: true, webhookFails: true });
  ok("a confirmed store still counts as received when every notification fails", r.status === 200 && r.json.stored && !r.json.delivered);
  r = await submit(GOOD, { kv: false, slack: true, slackFails: true });
  ok("Slack failing with no store and no fallback is a 503", r.status === 503);
  r = await submit({ ...GOOD, text: "\\".repeat(2000) });
  ok("a maximum-length message that JSON-escapes to double is kept whole", r.status === 200 && r.records[0]?.text.length === 2000);

  // ── the founder's reader ──
  async function founder(opts = {}) {
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.KV_REST_API_URL = KV; process.env.KV_REST_API_TOKEN = "fake-kv-token";
    process.env.FOUNDER_KEY = "founder-key-for-tests-only";
    const calls = [];
    const fam = [
      JSON.stringify({ kind: "feedback", chips: ["More games"], text: "older", replyEmail: "", at: "2026-09-28T10:00:00.000Z" }),
      "not json",
      JSON.stringify({ kind: "call", chips: [], text: "<b>hi</b>", replyEmail: "p@example.test", prefer: "phone", at: "2026-09-29T10:00:00.000Z" }),
    ];
    const slpLists = {
      "slp-feedback:morgan-ab": [JSON.stringify({ kind: "feedback", text: "dash", slpName: "Morgan", slpCode: "morgan-ab", replyEmail: "m@clinic.test", at: "2026-09-29T11:00:00.000Z" })],
      "slp-feedback:x@clinic.test": [JSON.stringify({ kind: "call", text: "call me", slpName: "", replyEmail: "x@clinic.test", at: "2026-09-27T09:00:00.000Z" })],
    };
    let scans = 0;
    globalThis.fetch = async (url, init = {}) => {
      const cmd = JSON.parse(init.body); calls.push(cmd);
      if (cmd[0] === "LRANGE" && cmd[1] === "family-feedback") return Response.json({ result: fam });
      if (cmd[0] === "SCAN") {
        scans++;
        if (opts.endless) return Response.json({ result: [String(scans), ["slp-feedback:k" + scans]] });
        return Response.json({ result: scans === 1 ? ["7", ["slp-feedback:morgan-ab"]] : ["0", ["slp-feedback:x@clinic.test"]] });
      }
      if (cmd[0] === "LRANGE") return Response.json({ result: slpLists[cmd[1]] || [] });
      return Response.json({ result: null });
    };
    const headers = new Headers();
    if (opts.key) headers.set("x-founder-key", opts.key);
    const res = await FOUNDER_GET(new Request(SITE + "/api/founders/feedback", { headers }));
    return { status: res.status, json: await res.json(), calls, cache: res.headers.get("cache-control") };
  }
  let f = await founder();
  ok("the founder's reader needs the key", f.status === 401 && f.calls.length === 0, f.status);
  f = await founder({ key: "wrong-key-wrong-key-xx" });
  ok("…the right key", f.status === 401 && f.calls.length === 0, f.status);
  f = await founder({ key: "founder-key-for-tests-only" });
  ok("with the key it returns both lists, uncached", f.status === 200 && f.json.ok && Array.isArray(f.json.family) && Array.isArray(f.json.slp) && /no-store/.test(f.cache || ""), f.json);
  ok("parents' messages come newest first, skipping a corrupt row", f.json.family.length === 2 && f.json.family[0].text === "<b>hi</b>" && f.json.family[0].prefer === "phone" && f.json.family[1].text === "older", f.json.family);
  ok("…reading at most the latest 300", f.calls.some((c) => c[0] === "LRANGE" && c[1] === "family-feedback" && c[2] === -300 && c[3] === -1));
  ok("clinicians' messages from every inbox, merged newest first", f.json.slp.length === 2 && f.json.slp[0].slpName === "Morgan" && f.json.slp[1].kind === "call", f.json.slp);
  ok("…the latest 100 of each inbox", f.calls.filter((c) => c[0] === "LRANGE" && c[1] !== "family-feedback").every((c) => c[2] === -100 && c[3] === -1));
  f = await founder({ key: "founder-key-for-tests-only", endless: true });
  ok("the inbox walk is bounded: at most 200 SCAN rounds of 1000", f.status === 200 && f.calls.filter((c) => c[0] === "SCAN").length <= 200 && f.calls.filter((c) => c[0] === "SCAN").every((c) => c[5] === 1000), f.calls.filter((c) => c[0] === "SCAN").length);
  ok("the reader only reads", f.calls.every((c) => ["LRANGE", "SCAN"].includes(c[0])), [...new Set(f.calls.map((c) => c[0]))]);
} finally {
  globalThis.fetch = originalFetch;
  for (const k of ENV_KEYS) { if (originalEnv[k] === undefined) delete process.env[k]; else process.env[k] = originalEnv[k]; }
}
console.log(`${checks - fails}/${checks} passed`);
process.exitCode = fails ? 1 : 0;
