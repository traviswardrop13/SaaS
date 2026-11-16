// MAIL1: every email Sona sends goes through lib/mail (Travis, 16 Nov 2026:
// "I don't want resend doing the emails. I want it all connected with high
// level"). Played against a fake GoHighLevel and a fake Resend: with
// GHL_API_TOKEN and GHL_LOCATION_ID set, the address is upserted as a
// contact and the email sent as a GHL conversation message, with the right
// headers and API versions; a 429 is tried once more; without them the
// Resend send is exactly what it was; an unsubscribe puts the contact's
// email on Do Not Disturb; no token or body reaches a log; and no file
// outside lib/mail calls Resend's send directly.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0, passes = 0;
const ok = (name, cond, info) => {
  if (cond) { passes++; console.log("PASS " + name); }
  else { fails++; console.log("FAIL " + name + (info === undefined ? "" : "  → " + JSON.stringify(info))); }
};
const read = (f) => readFileSync(path.join(REPO, f), "utf8");

function load(file) {
  const out = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function("exports", "require", "module", out)(mod.exports, require, mod);
  return mod.exports;
}
const M = load("lib/mail.ts");

const TOKEN = "pit-test-token-0123456789";
const LOC = "loc_TEST123";
const noSleep = { slept: [], fn: async (ms) => { noSleep.slept.push(ms); } };

// a fake GHL and Resend in one fetch
function fake(opts = {}) {
  const F = { calls: [], q: { ...(opts.q || {}) } };
  F.fetch = async (url, init = {}) => {
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    F.calls.push({ url: u, method: init.method, headers: init.headers || {}, body, signal: Boolean(init.signal) });
    const key = (init.method || "GET") + " " + u.replace(/^https:\/\/[^/]+/, "");
    const queued = F.q[key];
    if (queued && queued.length) { const s = queued.shift(); return new Response(JSON.stringify({ message: "nope " + s }), { status: s }); }
    if (u === "https://services.leadconnectorhq.com/contacts/upsert") return Response.json({ new: true, contact: { id: "c_42", email: body.email }, traceId: "t" });
    if (u === "https://services.leadconnectorhq.com/conversations/messages") return Response.json({ conversationId: "cv_1", messageId: "m_1", emailMessageId: "em_1", status: "delivered" });
    if (u.startsWith("https://services.leadconnectorhq.com/contacts/")) return Response.json({ succeded: true });
    if (u === "https://api.resend.com/emails") return Response.json({ id: "re_1" });
    return new Response("unexpected", { status: 599 });
  };
  return F;
}
const MSG = { to: "mom@example.com", subject: "Your week", html: "<p>Hi</p>", text: "Hi", from: "Rachel from Sona <rachel@speaksona.com>", replyTo: "rachel@speaksona.com", idempotencyKey: "report-x", headers: { "List-Unsubscribe": "<https://speaksona.com/u>" } };

const logs = [];
const origErr = console.error, origLog = console.log;
console.error = (...a) => { logs.push(a.join(" ")); };

function env(ghl, resend) {
  if (ghl) { process.env.GHL_API_TOKEN = TOKEN; process.env.GHL_LOCATION_ID = LOC; } else { delete process.env.GHL_API_TOKEN; delete process.env.GHL_LOCATION_ID; }
  if (resend) process.env.RESEND_API_KEY = "re_test_key"; else delete process.env.RESEND_API_KEY;
  delete process.env.GHL_EMAIL_FROM;
}

// ── GHL: upsert, then send ──
{
  env(true, true);
  const F = fake();
  const r = await M.sendMail({ ...MSG, tags: ["sona-parent-invite"] }, { fetch: F.fetch, sleep: noSleep.fn });
  origLog("");
  ok("with GHL set, the contact is upserted first, then the email is sent; Resend is not called",
    F.calls.length === 2 && F.calls[0].url === "https://services.leadconnectorhq.com/contacts/upsert" && F.calls[1].url === "https://services.leadconnectorhq.com/conversations/messages", F.calls.map((c) => c.url));
  const [up, send] = F.calls;
  ok("the upsert carries the token, the contacts API version and only the location, address and tags",
    up.method === "POST" && up.headers.Authorization === "Bearer " + TOKEN && up.headers.Version === "2021-07-28" &&
    JSON.stringify(up.body) === JSON.stringify({ locationId: LOC, email: "mom@example.com", tags: ["sona-parent-invite"] }), up);
  ok("the send carries the token and the conversations API version", send.method === "POST" && send.headers.Authorization === "Bearer " + TOKEN && send.headers.Version === "2021-04-15", send.headers);
  ok("the send is an Email to that contact, with subject, html, the text part and the address",
    send.body.type === "Email" && send.body.contactId === "c_42" && send.body.subject === "Your week" && send.body.html === "<p>Hi</p>" && send.body.message === "Hi" && send.body.emailTo === "mom@example.com", send.body);
  ok("emailFrom is the bare address out of the from line", send.body.emailFrom === "rachel@speaksona.com", send.body.emailFrom);
  ok("nothing Resend-only rides along (no reply_to, headers or idempotency key)", !("reply_to" in send.body) && !("headers" in send.body) && !send.headers["Idempotency-Key"]);
  ok("every request has a fuse", F.calls.every((c) => c.signal));
  ok("the answer says sent, through GHL, with GHL's message id", r.ok === true && r.via === "ghl" && r.id === "m_1" && r.status === 200, r);

  process.env.GHL_EMAIL_FROM = "hello@speaksona.com";
  const F2 = fake();
  await M.sendMail(MSG, { fetch: F2.fetch, sleep: noSleep.fn });
  ok("GHL_EMAIL_FROM, when set, is the sender", F2.calls[1].body.emailFrom === "hello@speaksona.com");
  delete process.env.GHL_EMAIL_FROM;
}

// ── GHL: a 429 is tried once more, on each call ──
{
  env(true, false);
  noSleep.slept.length = 0;
  const F = fake({ q: { "POST /conversations/messages": [429] } });
  const r = await M.sendMail(MSG, { fetch: F.fetch, sleep: noSleep.fn });
  ok("a 429 on the send is tried once more, after a pause, and then sent", r.ok && F.calls.filter((c) => c.url.endsWith("/conversations/messages")).length === 2 && noSleep.slept.length === 1, [r, noSleep.slept]);

  const F2 = fake({ q: { "POST /conversations/messages": [429, 429] } });
  const r2 = await M.sendMail(MSG, { fetch: F2.fetch, sleep: noSleep.fn });
  ok("two 429s: only once more, then the 429 is the answer (the caller's pacing decides)", !r2.ok && r2.status === 429 && F2.calls.filter((c) => c.url.endsWith("/conversations/messages")).length === 2, r2);

  const F3 = fake({ q: { "POST /contacts/upsert": [429] } });
  const r3 = await M.sendMail(MSG, { fetch: F3.fetch, sleep: noSleep.fn });
  ok("a 429 on the upsert is tried once more too", r3.ok && F3.calls.filter((c) => c.url.endsWith("/contacts/upsert")).length === 2, F3.calls.map((c) => c.url));

  const F4 = fake({ q: { "POST /contacts/upsert": [401] } });
  const r4 = await M.sendMail(MSG, { fetch: F4.fetch, sleep: noSleep.fn });
  ok("a refused upsert sends nothing and says so", !r4.ok && r4.status === 401 && F4.calls.length === 1 && r4.via === "ghl", r4);

  const F5 = fake({ q: { "POST /conversations/messages": [400] } });
  const r5 = await M.sendMail(MSG, { fetch: F5.fetch, sleep: noSleep.fn });
  ok("a refused send is not tried again and carries GHL's words in detail", !r5.ok && r5.status === 400 && /^GoHighLevel .*nope 400/.test(r5.detail) && F5.calls.length === 2, r5);

  const r6 = await M.sendMail(MSG, { fetch: async () => { throw new Error("boom " + TOKEN); }, sleep: noSleep.fn });
  ok("a network error never throws: status 0", r6.ok === false && r6.status === 0 && r6.detail === "network", r6);
}

// ── no GHL: Resend exactly as before ──
{
  env(false, true);
  const F = fake();
  const r = await M.sendMail(MSG, { fetch: F.fetch, sleep: noSleep.fn });
  const c = F.calls[0];
  ok("without GHL, one call to Resend and none to GHL", F.calls.length === 1 && c.url === "https://api.resend.com/emails", F.calls.map((x) => x.url));
  ok("Resend gets its key, the idempotency key and the old body: from, to, reply_to, subject, html, text, headers",
    c.headers.Authorization === "Bearer re_test_key" && c.headers["Idempotency-Key"] === "report-x" &&
    JSON.stringify(Object.keys(c.body)) === JSON.stringify(["from", "to", "reply_to", "subject", "html", "text", "headers"]) &&
    JSON.stringify(c.body.to) === '["mom@example.com"]' && c.body.reply_to === "rachel@speaksona.com" && c.body.from === MSG.from, c);
  ok("the answer says sent, through Resend", r.ok && r.via === "resend" && r.id === "re_1", r);

  noSleep.slept.length = 0;
  const F2 = fake({ q: { "POST /emails": [429] } });
  const r2 = await M.sendMail(MSG, { fetch: F2.fetch, sleep: noSleep.fn });
  ok("Resend: a 429 is NOT tried again unless the caller asks (the report and RevenueCat pace themselves)", !r2.ok && r2.status === 429 && F2.calls.length === 1, r2);
  const F3 = fake({ q: { "POST /emails": [429] } });
  const r3 = await M.sendMail(MSG, { fetch: F3.fetch, sleep: noSleep.fn, retry429Ms: 1100 });
  ok("Resend: with retry429Ms (the welcome series), once more after that pause", r3.ok && F3.calls.length === 2 && noSleep.slept[0] === 1100, [r3, noSleep.slept]);

  const F4 = fake();
  await M.sendMail({ to: "a@b.co", subject: "s", html: "h", text: "t" }, { fetch: F4.fetch });
  ok("Resend: no from given uses RESEND_FROM's default, and no reply_to or headers are made up",
    F4.calls[0].body.from === "Sona <login@speaksona.com>" && !("reply_to" in F4.calls[0].body) && !("headers" in F4.calls[0].body) && !F4.calls[0].headers["Idempotency-Key"], F4.calls[0]);

  env(false, false);
  const r5 = await M.sendMail(MSG, { fetch: fake().fetch });
  ok("nothing set: nothing sent, not configured", !r5.ok && r5.via === "none" && !M.mailConfigured(), r5);
  env(true, false);
  ok("GHL alone counts as configured", M.mailConfigured() && M.ghlConfigured());
  process.env.GHL_API_TOKEN = TOKEN; delete process.env.GHL_LOCATION_ID;
  ok("a token with no location is not GHL", !M.ghlConfigured());
}

// ── the unsubscribe: email DND ──
{
  env(true, false);
  const F = fake();
  const done = await M.ghlEmailDnd("mom@example.com", { fetch: F.fetch, sleep: noSleep.fn });
  const put = F.calls[1];
  ok("an unsubscribe finds the contact, then sets its email Do Not Disturb (and nothing else)",
    done === true && F.calls[0].url.endsWith("/contacts/upsert") && put.method === "PUT" && put.url === "https://services.leadconnectorhq.com/contacts/c_42" &&
    put.headers.Version === "2021-07-28" && JSON.stringify(Object.keys(put.body)) === '["dndSettings"]' &&
    put.body.dndSettings.Email.status === "active" && Object.keys(put.body.dndSettings).join() === "Email", put);
  env(false, true);
  const F2 = fake();
  ok("without GHL, nothing is called", (await M.ghlEmailDnd("mom@example.com", { fetch: F2.fetch })) === false && F2.calls.length === 0);
  env(true, false);
  const F3 = fake({ q: { "PUT /contacts/c_42": [500] } });
  ok("GHL refusing the DND answers false, never throws", (await M.ghlEmailDnd("mom@example.com", { fetch: F3.fetch, sleep: noSleep.fn })) === false);
}

// ── nothing secret in a log ──
ok("no log holds the token, an address, a subject or a body",
  logs.length > 0 && logs.every((l) => !l.includes(TOKEN) && !l.includes("mom@example.com") && !l.includes("Your week") && !l.includes("<p>Hi</p>")), logs);
console.error = origErr;

// ── the code: one door ──
{
  const files = [];
  const walk = (d) => { for (const n of readdirSync(path.join(REPO, d))) { const p = path.join(d, n); if (statSync(path.join(REPO, p)).isDirectory()) walk(p); else if (/\.ts$/.test(n)) files.push(p); } };
  walk("lib"); walk("app");
  const direct = files.filter((f) => f !== path.join("lib", "mail.ts") && /api\.resend\.com\/emails/.test(read(f)));
  ok("no file but lib/mail.ts calls Resend's send", direct.length === 0, direct);
  const users = ["lib/nurture.ts", "lib/report.ts", "lib/revenuecat.ts", "lib/slpAuth.ts", "lib/launch.ts", "app/api/family/feedback/route.ts"];
  ok("every sender goes through sendMail", users.every((f) => /sendMail\(/.test(read(f))), users.filter((f) => !/sendMail\(/.test(read(f))));
  ok("the board's confirmation goes through the same door", /resendSend\(/.test(read("lib/board.ts")));
  ok("the unsubscribe tells GoHighLevel", /ghlEmailDnd\(v\.email\)/.test(read("app/api/email/unsub/route.ts")));
  const priv = read("public/privacy.html");
  ok("the privacy page says GoHighLevel delivers Sona's emails and holds the report's numbers",
    /<strong>Email delivery<\/strong> — GoHighLevel/.test(priv) && /weekly progress report&rsquo;s numbers[^.]*pass through GoHighLevel/.test(priv) && /never a child&rsquo;s name/.test(priv));
}

origLog(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
