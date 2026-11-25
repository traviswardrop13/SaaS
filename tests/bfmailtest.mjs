// BFMAIL1 (25 Nov 2026): a speech therapist who opts in while the Black
// Friday deal is on gets ONE email about it from Rachel: the deal in
// lib/caseload's figures, the end, no trial, a button to the deal's plans,
// an unsubscribe link and the mailing address. Never twice, never to an
// unsubscribed address, never after the end, given back when the send fails.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; console.log((cond ? "PASS " : "FAIL ") + name + (cond || info === undefined ? "" : "  → " + JSON.stringify(info))); };
const cache = new Map();
function loadTs(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const req = (s) => s.startsWith("@/") ? loadTs(path.join(REPO, s.slice(2) + ".ts")) : s === "next/server" ? require(path.join(REPO, "node_modules/next/server")) : require(s);
  new Function("require", "module", "exports", js)(req, mod, mod.exports);
  return mod.exports;
}
process.env.RESEND_API_KEY = "re_test"; process.env.UNSUB_SECRET = "s3cret"; process.env.EMAIL_POSTAL = "PO Box 1, Star, ID 83669";
delete process.env.GHL_API_TOKEN; delete process.env.GHL_LOCATION_ID;
process.env.SONA_BF_FORCE = "1";
const B = loadTs(path.join(REPO, "lib/bfmail.ts"));
const C = loadTs(path.join(REPO, "lib/caseload.ts"));

function store(unsub = []) {
  const kv = new Map(), u = new Set(unsub);
  return { kv, cmd: async ([c, ...a]) => {
    if (c === "SET") { if (a.includes("NX") && kv.has(a[0])) return null; kv.set(a[0], String(a[1])); return "OK"; }
    if (c === "SISMEMBER") return u.has(a[1]) ? 1 : 0;
    if (c === "DEL") return kv.delete(a[0]) ? 1 : 0;
    return null;
  } };
}
const sent = [];
const fakeFetch = (status = 200) => async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ id: "e1" }), { status }); };
const BEFORE = Date.UTC(2026, 10, 26, 18, 0, 0), AFTER = C.BF_ENDS_AT + 1000;

{
  const s = store(); sent.length = 0;
  const r = await B.sendBfEmail("  SLP@Clinic.org ", s.cmd, fakeFetch(), BEFORE);
  const m = sent[0] && sent[0].body;
  ok("an SLP's opt-in during the deal is sent the Black Friday email, once, through Resend", r === true && sent.length === 1 && /api\.resend\.com/.test(sent[0].url) && (m.to === "slp@clinic.org" || (Array.isArray(m.to) && m.to[0] === "slp@clinic.org")), m && m.to);
  ok("…its subject and words are the deal in lib/caseload's figures, the end and no trial",
    m && m.subject === "Sona Pro is half off until Sunday" && m.text.includes(C.BF_PRICE + " a month for your first " + C.BF_MONTHS + " months, then " + C.PRO_PRICE + " a month") &&
    m.text.includes("ends Sunday, November 29 at 11:59 PM Mountain") && m.text.includes("It has no free trial"), m && m.text);
  ok("…its button goes to the deal's plans on the website", m && m.html.includes(B.BF_PLANS_URL) && B.BF_PLANS_URL.startsWith("https://www.speaksona.com/blackfriday/plans"));
  ok("…from Rachel with her credential, the unsubscribe link and the mailing address",
    m && /Rachel, MS, CF-SLP/.test(m.text) && /\/api\/email\/unsub\?e=slp%40clinic\.org&k=/.test(m.text) && m.text.includes("PO Box 1, Star, ID 83669") && m.headers && /unsub/.test(m.headers["List-Unsubscribe"]));
  ok("…and nothing about a child", m && !/child's name|your child/i.test(m.text));
  sent.length = 0;
  const again = await B.sendBfEmail("slp@clinic.org", s.cmd, fakeFetch(), BEFORE + 60000);
  ok("a second opt-in from the same address sends nothing", again === false && sent.length === 0);
}
{
  const s = store(["gone@clinic.org"]); sent.length = 0;
  ok("an unsubscribed address is sent nothing", (await B.sendBfEmail("gone@clinic.org", s.cmd, fakeFetch(), BEFORE)) === false && sent.length === 0);
}
{
  const s = store(); sent.length = 0;
  ok("after Sunday 11:59 PM Mountain nothing is sent", (await B.sendBfEmail("late@clinic.org", s.cmd, fakeFetch(), AFTER)) === false && sent.length === 0);
}
{
  const s = store(); sent.length = 0;
  const r = await B.sendBfEmail("fail@clinic.org", s.cmd, fakeFetch(500), BEFORE);
  ok("a refused send gives the mark back, so the next opt-in tries again", r === false && !s.kv.has("bfmail:fail@clinic.org"));
}
{
  const route = readFileSync(path.join(REPO, "app/api/lead/route.ts"), "utf8");
  ok("/api/lead sends it for a speech therapist's lead only", /if \(lead\.role === "slp" && kvConfigured\(\)\) \{\s*try \{ await sendBfEmail\(email, kvCmd, fetch\); \}/.test(route));
}
console.log(fails ? fails + " FAILED" : "ALL PASS");
process.exit(fails ? 1 : 0);
