// SLPFEEDBACK1: feedback must be attributable, delivered honestly, and kept
// out of generic lead/CRM destinations. Every network call is mocked locally.
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
  const source = file.endsWith("/slp/feedback/route.ts") && process.env.SLP_FEEDBACK_ROUTE_SOURCE
    ? process.env.SLP_FEEDBACK_ROUTE_SOURCE : file;
  const js = ts.transpileModule(readFileSync(source, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = (spec) => spec.startsWith("@/") ? loadTs(path.join(ROOT, spec.slice(2) + ".ts")) : require(spec);
  new Function("require", "module", "exports", js)(localRequire, mod, mod.exports);
  return mod.exports;
}
const { signSession } = loadTs(path.join(ROOT, "lib/slpAuth.ts"));
const { POST } = loadTs(path.join(ROOT, "app/api/slp/feedback/route.ts"));
const originalFetch = globalThis.fetch;
const ENV_KEYS = ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "SLP_AUTH_SECRET", "SLACK_FEEDBACK_WEBHOOK_URL", "FEEDBACK_WEBHOOK_URL", "LEAD_WEBHOOK_URL", "PILOT_WEBHOOK_URL"];
const originalEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
let checks = 0, fails = 0, requestId = 0;
function ok(label, condition) { checks++; if (!condition) fails++; console.log((condition ? "PASS " : "FAIL ") + label); }
const KV = "https://kv.test.invalid", SLACK = "https://slack.test.invalid", FEEDBACK = "https://feedback.test.invalid";

async function submit(body, opts = {}) {
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.SLP_AUTH_SECRET = "feedback-test-secret-never-used-outside-tests";
  if (opts.kv !== false) { process.env.KV_REST_API_URL = KV; process.env.KV_REST_API_TOKEN = "fake-kv-token"; }
  if (opts.slack) process.env.SLACK_FEEDBACK_WEBHOOK_URL = SLACK;
  if (opts.webhook) process.env.FEEDBACK_WEBHOOK_URL = FEEDBACK;
  process.env.LEAD_WEBHOOK_URL = "https://lead.test.invalid";
  process.env.PILOT_WEBHOOK_URL = "https://pilot.test.invalid";
  const calls = [], records = [];
  globalThis.fetch = async (url, init = {}) => {
    const payload = JSON.parse(init.body || "null"); calls.push({ url: String(url), payload });
    if (String(url) === KV) {
      const op = payload[0];
      if (op === "INCR") return Response.json({ result: opts.rateLimited ? 31 : 1 });
      if (op === "GET") return Response.json({ result: opts.accountMissing ? null : JSON.stringify({ name: "Morgan SLP", code: "morgan-ab" }) });
      if (op === "EVAL" || op === "RPUSH") {
        if (opts.storeThrows) throw new Error("KV unavailable");
        const rec = JSON.parse(payload[op === "EVAL" ? 4 : 2]); records.push(rec);
        return opts.storeHttpFailure ? Response.json({ error: "offline" }, { status: 503 }) : Response.json({ result: opts.storeFails ? null : 1 });
      }
      return Response.json({ result: 1 });
    }
    if (opts.webhookThrows) throw new Error("inbox offline");
    if (String(url) === SLACK) return new Response("slack", { status: opts.slackFails ? 503 : 200 });
    if (String(url) === FEEDBACK) return new Response("feedback", { status: opts.webhookFails ? 500 : 202 });
    return new Response("unapproved generic destination", { status: 200 });
  };
  const headers = new Headers({ "content-type": "application/json", "x-real-ip": "feedback-test-" + (++requestId) });
  if (!opts.signedOut) headers.set("cookie", "slp_session=" + (opts.badCookie ? "%ZZ" : signSession({ email: "morgan@example.test", exp: Date.now() + 100000 })));
  const request = new Request("https://sona.test.invalid/api/slp/feedback", { method: "POST", headers, body: opts.raw ? body : JSON.stringify(body) });
  try {
    const response = await POST(request);
    return { status: response.status, json: await response.json(), calls, records };
  } catch (error) {
    return { status: 599, json: { thrown: error.message }, calls, records };
  }
}

try {
  let result = await submit({ text: "Would love a simpler navigation." }, { signedOut: true });
  ok("signed-out callers are rejected without outbound requests", result.status === 401 && result.calls.length === 0);
  result = await submit({ text: "hello" }, { badCookie: true });
  ok("a malformed cookie receives a sign-in error", result.status === 401 && result.calls.length === 0);
  result = await submit({ text: "hello" }, { rateLimited: true });
  ok("repeated submissions are rate limited without storing or forwarding", result.status === 429 && result.records.length === 0 && result.calls.every(c => c.url === KV));
  for (const value of ["{oops", "null", "[]"]) {
    result = await submit(value, { raw: true });
    ok("invalid JSON shape is rejected: " + value, result.status === 400 && result.records.length === 0);
  }
  result = await submit({ text: "   " });
  ok("feedback requires nonempty text", result.status === 400 && result.records.length === 0);
  result = await submit({ kind: "booked", text: "hello" });
  ok("unsupported request kinds are rejected", result.status === 400 && result.records.length === 0);
  for (const [field, value] of [["text", "a".repeat(2001)], ["availability", "a".repeat(241)], ["timezone", "a".repeat(81)], ["text", { bad: true }]]) {
    result = await submit({ text: "hello", [field]: value });
    ok("invalid " + field + " is rejected without saving", result.status === 400 && result.records.length === 0);
  }
  result = await submit({ text: "  The new dashboard is helpful.  ", slpName: "Spoof", slpCode: "stranger", email: "spoof@example.test", replyEmail: "spoof@example.test", category: "dashboard" });
  ok("legacy text-only feedback is accepted after confirmed storage", result.status === 200 && result.json.ok && result.json.stored && !result.json.delivered);
  let record = result.records[0];
  ok("reply identity comes from the session and account", record?.replyEmail === "morgan@example.test" && record.slpName === "Morgan SLP" && record.slpCode === "morgan-ab");
  ok("dashboard category and trimmed text survive persistence", record?.category === "dashboard" && record.text === "The new dashboard is helpful." && record.kind === "feedback");
  ok("message storage preserves bounded retention atomically", result.calls.some(c => c.payload?.[0] === "EVAL" && /LTRIM/.test(c.payload[1]) && /EXPIRE/.test(c.payload[1]) && c.payload[5] === 31536000));
  ok("generic pilot and lead destinations never receive feedback", result.calls.every(c => c.url === KV));
  result = await submit({ kind: "call", category: "question", availability: "Tuesday afternoon", timezone: "America/Boise" });
  record = result.records[0];
  ok("a call can be requested without typing a message", result.status === 200 && record?.kind === "call" && !!record.text);
  ok("call preferences and reply address are retained", record?.availability === "Tuesday afternoon" && record.timezone === "America/Boise" && record.replyEmail === "morgan@example.test");
  result = await submit({ text: "Profile setup question", category: "unknown" }, { accountMissing: true });
  ok("an unfinished profile can still get a reply", result.status === 200 && result.records[0]?.replyEmail === "morgan@example.test" && result.records[0].slpCode === "");
  ok("unsupported categories become general feedback", result.records[0]?.category === "general");
  for (const opts of [{ kv: false }, { storeFails: true }, { storeHttpFailure: true }, { storeThrows: true }]) {
    result = await submit({ text: "Please keep my draft if this fails." }, opts);
    ok("missing or failed destinations never report success: " + JSON.stringify(opts), result.status === 503 && result.json.ok === false && result.calls.every(c => c.url === KV));
  }
  result = await submit({ kind: "call", text: "Let's connect", category: "app", availability: "Friday", timezone: "UTC" }, { kv: false, webhook: true });
  record = result.calls.find(c => c.url === FEEDBACK)?.payload;
  ok("dedicated webhook acceptance confirms receipt when KV is absent", result.status === 200 && result.json.delivered && !result.json.stored);
  ok("the dedicated webhook receives reply and call details", record?.kind === "call" && record.replyEmail === "morgan@example.test" && record.availability === "Friday" && record.timezone === "UTC");
  result = await submit({ text: "hello" }, { kv: false, webhook: true, webhookFails: true });
  ok("a non-2xx webhook response is a failure", result.status === 503 && !result.json.ok);
  result = await submit({ text: "hello" }, { kv: false, webhook: true, webhookThrows: true });
  ok("a thrown webhook request is a failure", result.status === 503 && !result.json.ok);
  result = await submit({ text: "<!channel> please show this literally", category: "affiliate" }, { kv: false, slack: true, webhook: true });
  ok("Slack acceptance confirms delivery without duplicate forwarding", result.status === 200 && result.json.slackSent && result.json.delivered && result.calls.filter(c => c.url !== KV).length === 1);
  const slack = result.calls.find(c => c.url === SLACK)?.payload;
  ok("Slack displays user text as plain text rather than markup", slack?.blocks.some(b => b.text?.type === "plain_text" && b.text.text === "<!channel> please show this literally"));
  result = await submit({ text: "fallback" }, { kv: false, slack: true, slackFails: true, webhook: true });
  ok("Slack failures fall back only to the dedicated feedback hook", result.status === 200 && !result.json.slackSent && result.json.delivered && result.calls.every(c => [KV, SLACK, FEEDBACK].includes(c.url)));
  result = await submit({ text: "saved locally in the inbox" }, { slack: true, slackFails: true, webhook: true, webhookFails: true });
  ok("confirmed KV storage remains a successful receipt when notifications fail", result.status === 200 && result.json.stored && !result.json.delivered);
  result = await submit({ text: "\\".repeat(2000) });
  ok("maximum-length escaped text remains valid complete JSON", result.status === 200 && result.records[0]?.text.length === 2000);
} finally {
  globalThis.fetch = originalFetch;
  for (const k of ENV_KEYS) { if (originalEnv[k] === undefined) delete process.env[k]; else process.env[k] = originalEnv[k]; }
}
console.log(`${checks - fails}/${checks} passed`);
process.exitCode = fails ? 1 : 0;
