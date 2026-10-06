// NURTURE1: the welcome series on Sona's own server (Travis, 6 Oct 2026):
// a new sign-up gets Rachel's welcome now and the 5-minute email the next
// day, once each, never after unsubscribing, always with an unsubscribe link
// and the mailing address — and nothing about a child.
import { readFileSync } from "node:fs";
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
const cache = new Map();
function loadTs(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const req = (s) => s.startsWith("@/") ? loadTs(path.join(REPO, s.slice(2) + ".ts")) : s === "next/server" ? require(path.join(REPO, "node_modules/next/server")) : require(s);
  new Function("require", "module", "exports", js)(req, mod, mod.exports);
  return mod.exports;
}
const N = loadTs(path.join(REPO, "lib/nurture.ts"));

// a tiny in-memory store with the commands the series uses
function store(unsub = []) {
  const kv = new Map(), z = new Map(), u = new Set(unsub);
  return {
    z, kv,
    cmd: async ([c, ...a]) => {
      if (c === "SET") { if (a.includes("NX") && kv.has(a[0])) return null; kv.set(a[0], a[1]); return "OK"; }
      if (c === "SISMEMBER") return u.has(a[1]) ? 1 : 0;
      if (c === "ZADD") { z.set(a[2], a[1]); return 1; }
      if (c === "ZREM") return z.delete(a[1]) ? 1 : 0;
      if (c === "ZRANGEBYSCORE") return [...z].filter(([, s]) => s <= a[2]).map(([e]) => e);
      throw new Error("unexpected " + c);
    },
  };
}
const sent = [];
const fakeFetch = async (_u, init) => { sent.push(JSON.parse(init.body)); return { ok: true, status: 200 }; };

process.env.RESEND_API_KEY = "re_test"; process.env.UNSUB_SECRET = "s3cret"; process.env.EMAIL_POSTAL = "851 NE 1st Ave, Unit 4103, Miami, FL 33132";
const T = Date.parse("2026-10-07T12:00:00Z");

const s = store(["gone@example.com"]);
ok("a new sign-up gets the welcome right away", await N.enroll(" Mom@Example.com ", s.cmd, fakeFetch, T) && sent.length === 1 && sent[0].to[0] === "mom@example.com");
const w = sent[0];
ok("…from Rachel, replies to Rachel", /rachel@speaksona\.com/.test(w.from) && w.reply_to === "rachel@speaksona.com", w.from);
ok("…with a working unsubscribe link (the token /api/email/unsub checks) in the body and the header",
  w.html.includes("/api/email/unsub?e=mom%40example.com&k=" + N.unsubToken("mom@example.com", "s3cret")) && /api\/email\/unsub/.test(w.headers["List-Unsubscribe"]) && w.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
ok("…and the mailing address, in html and text", w.html.includes("851 NE 1st Ave") && w.text.includes("851 NE 1st Ave"));
ok("…and links to the App Store", w.html.includes(N.APP_URL));
ok("a second sign-up with the same address sends nothing", !(await N.enroll("mom@example.com", s.cmd, fakeFetch, T + 1000)) && sent.length === 1);
ok("the 5-minute email is not due before a day has passed", (await N.runDue(s.cmd, fakeFetch, T + N.DAY_MS - 1000)).sent === 0 && sent.length === 1);
ok("…and goes out once the day has passed", (await N.runDue(s.cmd, fakeFetch, T + N.DAY_MS)).sent === 1 && sent[1].subject === N.CONTENT[1].subject);
ok("…exactly once", (await N.runDue(s.cmd, fakeFetch, T + 3 * N.DAY_MS)).sent === 0 && sent.length === 2);
ok("an unsubscribed address gets no welcome", !(await N.enroll("gone@example.com", s.cmd, fakeFetch, T)) && sent.length === 2);
ok("…and no 5-minute email either", (await N.runDue(s.cmd, fakeFetch, T + 2 * N.DAY_MS)).sent === 0 && sent.length === 2);
delete process.env.EMAIL_POSTAL;
ok("no mailing address configured → nothing sends at all", !(await N.enroll("new@example.com", store().cmd, fakeFetch, T)) && sent.length === 2);

// the words: Rachel's credential, the practice register, no price figure
const all = JSON.stringify(N.CONTENT) + readFileSync(path.join(REPO, "lib/nurture.ts"), "utf8").match(/render[\s\S]*?\n}\n/)[0];
ok("Rachel signs as MS, CF-SLP, never certified/CCC", /MS, CF-SLP/.test(all) && !/\bCCC\b|certified/i.test(all));
ok("practice, never therapy/treatment/diagnosis/score", !/therapy|treatment|diagnos|score/i.test(JSON.stringify(N.CONTENT)));
ok("no dollar figure", !/\$\d/.test(JSON.stringify(N.CONTENT)));

// the wiring
const lead = readFileSync(path.join(REPO, "app/api/lead/route.ts"), "utf8");
ok("/api/lead enrolls every new email once the app is out", /if \(APP_READY && kvConfigured\(\)\)[\s\S]{0,120}enroll\(email\)/.test(lead));
const cron = JSON.parse(readFileSync(path.join(REPO, "vercel.json"), "utf8")).crons;
ok("a daily cron sends what is due", cron.some((c) => c.path === "/api/cron/nurture" && /^\d+ \d+ \* \* \*$/.test(c.schedule)));

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
