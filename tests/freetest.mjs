// FREE1: Sona is free, and nothing anywhere can take money for it.
//
// Going free is one boolean in sona.js — for the APP. The Next.js half (the
// landing page, /subscribe, /api/checkout) runs in a different world and
// cannot read that boolean, so it is mirrored in lib/pricing.ts. Two copies
// of one rule is exactly the drift CLAUDE.md warns about, and the drift that
// matters here charges a parent $59.99 for a free app. This suite is the pin
// that makes the second copy safe:
//
//   1. the two switches agree, always;
//   2. while free, /api/checkout refuses on the SERVER — buttons are not the
//      only way in (a bookmark, a stale tab, an old ad link all reach it);
//   3. no surface a parent can see advertises a price.
//
// It is written to work in BOTH directions, so the day pricing returns this
// suite tells the truth about that too instead of needing to be rewritten.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const APP = ROOT + "/..";
const sona = readFileSync(ROOT + "/sona.js", "utf8");
const pricing = readFileSync(APP + "/lib/pricing.ts", "utf8");

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

// ── 1. one rule, two files, never apart ──
const appFree = /const FREE_MODE = true;/.test(sona);
const srvFree = /export const FREE_MODE = true;/.test(pricing);
ok("the app switch and the server switch agree",
  appFree === srvFree,
  `sona.js FREE_MODE=${appFree}, lib/pricing.ts FREE_MODE=${srvFree} — one of these is charging or gating against the other`);
ok("Sona is free right now", appFree && srvFree,
  "flip BOTH switches together, and read the pricing section of CLAUDE.md before you do");

// ── 2. the money door is bolted on the server, not just hidden ──
{
  const co = readFileSync(APP + "/app/api/checkout/route.ts", "utf8");
  const post = co.slice(co.indexOf("export async function POST"), co.indexOf("export async function GET"));
  const get = co.slice(co.indexOf("export async function GET"));
  ok("checkout imports the one server switch", /import \{ FREE_MODE \} from "@\/lib\/pricing"/.test(co));
  ok("POST /api/checkout refuses before it builds a session",
    /if \(FREE_MODE\)/.test(post) && post.indexOf("if (FREE_MODE)") < post.indexOf("stripe.checkout"),
    "the guard must come before any Stripe call, or it is decoration");
  ok("GET /api/checkout refuses too",
    /if \(FREE_MODE\)/.test(get) && get.indexOf("if (FREE_MODE)") < get.indexOf("POST(proxied)"),
    "the plain-link CTA path is the one cold ad traffic actually uses");
  if (appFree) {
    ok("…and neither can reach Stripe while free",
      /return NextResponse\.json\([\s\S]{0,160}status: 410/.test(post) && /NextResponse\.redirect/.test(get));
  }
}

// ── 3. nothing a parent sees names a price ──
// Source scan on the marketing surfaces, which have no FREE_MODE of their own
// to read at runtime — if a figure is in this file, a parent sees it.
if (appFree) {
  const PRICEY = /\$\s?\d+\.\d\d|3 days free|3-day free trial|free trial/i;
  const decomment = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, " ")             // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");         // line comments, keeping https://

  // The landing page has no switch to read at runtime: whatever is in the
  // file is what a parent sees, so nothing priced may be in it at all.
  {
    const src = decomment(readFileSync(APP + "/app/page.tsx", "utf8"));
    const hit = (src.match(PRICEY) || [])[0];
    ok("app/page.tsx advertises no price while Sona is free", !hit, "found: " + hit);
  }

  // /subscribe is different, and deliberately so. Its plan picker is the
  // Stripe rail CLAUDE.md says to keep wired — deleting it is how the next
  // pricing decision turns into archaeology. So the pin is not "no price in
  // the file", it is UNREACHABLE: the FREE_MODE return must come first.
  {
    const src = decomment(readFileSync(APP + "/app/subscribe/page.tsx", "utf8"));
    const guard = src.indexOf("if (FREE_MODE)");
    const price = src.search(PRICEY);
    ok("app/subscribe/page.tsx returns the free notice before any price can render",
      guard >= 0 && (price < 0 || guard < price),
      guard < 0 ? "no FREE_MODE guard at all" : "a price at index " + price + " precedes the guard at " + guard);
    ok("…and that early return is a real return, not a flag",
      /if \(FREE_MODE\) \{[\s\S]{0,900}?return \(/.test(src),
      "the picker below it must never mount while free");
  }
  const page = readFileSync(APP + "/app/page.tsx", "utf8");
  ok("landing CTAs open the app instead of a checkout that would refuse them",
    /const START = "\/onboarding\.html";/.test(page) && !/href="\/api\/checkout/.test(page),
    "a CTA pointing at /api/checkout now 303s straight back to this page — a button that does nothing");
}

// ── 4. the promises that outlive any switch ──
ok("both grandfather sweeps still exist",
  /function _grandfatherFreeEra\(/.test(sona) && /function _grandfatherFreeEra2\(/.test(sona),
  "these are promises to families from the first two free eras; they cost nothing now");
ok("the free-mode bounce is still wired on trial.html",
  /Sona\.isFree\(\)\) location\.replace\("\/today\.html"\)/.test(readFileSync(ROOT + "/trial.html", "utf8")));
ok("gated() still short-circuits on the switch before anything else",
  /function gated\(\) \{\s*if \(isFree\(\)\) return false;/.test(sona),
  "if any check runs ahead of the switch, the switch is not the switch");

// ── 5. what a parent actually gets, in a browser ──
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", woff2: "font/woff2", png: "image/png" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8211, r));
const browser = await chromium.launch(launchOpts());

if (appFree) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.goto("http://localhost:8211/today.html");
  await pg.evaluate(() => {
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true }));
    // a device that met the paywall before the flip still carries a dead trial
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 10 * 86400000, days: 3 }));
    sessionStorage.setItem("sona.gate.v1", String(Date.now()));
  });

  const gated = await pg.evaluate(() => Sona.gated());
  ok("a family whose trial expired under the old pricing is not gated", gated === false,
    "the trial key outlives the flip — this is the family the switch exists for");

  await pg.goto("http://localhost:8211/subscribe.html");
  await pg.waitForTimeout(700);
  const sub = await pg.evaluate(() => ({
    iap: (document.getElementById("iapCard") || {}).style?.display,
    pick: (document.getElementById("pickCard") || {}).style?.display,
    line: (document.getElementById("planLine") || {}).textContent || "",
    body: document.body.innerText,
  }));
  ok("neither purchase card renders", sub.iap === "none" && sub.pick === "none", JSON.stringify(sub));
  ok("…and the page says so plainly", /free/i.test(sub.line), sub.line);
  ok("no price survives on the parent's purchase page", !/\$\s?\d+\.\d\d/.test(sub.body),
    (sub.body.match(/\$\s?\d+\.\d\d/) || [])[0]);

  await pg.goto("http://localhost:8211/trial.html");
  await pg.waitForTimeout(700);
  ok("the paywall page bounces a family straight back into the app",
    /today\.html/.test(pg.url()), pg.url());
  ok("no pageerrors across the free-mode surfaces", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
