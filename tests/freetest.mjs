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
// Sona is PAID again as of 15 Sep 2026. This suite was deliberately written to
// work in both directions, so it does not assert a direction — it asserts the
// two switches never disagree, and then checks whichever state is live. The
// one thing that is NOT direction-neutral is the promise below: a free window
// permanently removes its own cohort from paying, so every era keeps a sweep.
ok("the switches are in a known state", appFree === srvFree,
  "a half-flipped switch charges on one surface while giving the app away on another");

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

  // THE PARENT LANDING PAGE IS /families NOW. speaksona.com is the clinician
  // page (22 Sep 2026: SLPs are the channel); the page moved rather than being
  // rewritten precisely so these pins keep holding — it still carries BOTH
  // pricing states and still reads the one switch.
  //
  // THESE USED TO SCAN FOR THE ABSENCE OF A PRICE, and that was right while
  // app/page.tsx was hand-rewritten for each era. It is not right any more.
  // The switch has flipped eleven times, so the marketing surfaces now render
  // BOTH states from FREE_MODE and the paid copy lives permanently in the file
  // — an absence scan can never pass again, and deleting the paid arm to make
  // it pass is exactly the archaeology CLAUDE.md forbids.
  //
  // So the pin is REACHABILITY, the same shape /subscribe already used: while
  // free, nothing priced may render and no CTA may point at an endpoint that
  // refuses. What follows must hold in EITHER direction.
  {
    const src = decomment(readFileSync(APP + "/app/families/page.tsx", "utf8"));
    ok("the landing page reads the one switch",
      /import \{ FREE_MODE \} from "@\/lib\/pricing"/.test(src),
      "a second copy of the pricing rule is how the paid and free halves contradicted each other three times");
    // REWRITTEN 24 Sep 2026. This demanded CTA_HREF = FREE_MODE ? onboarding
    // : /api/checkout. It only runs while free, so it sat silent through the
    // paid build that changed the page — and would have failed on the next
    // flip back, tempting someone to restore the checkout arm the page
    // dropped on purpose. Every family now starts free (practice is never
    // behind the paywall) and Premium is bought inside the app, after the
    // product has proved itself — so the CTA opens the app in BOTH states.
    ok("every CTA opens the app, in both states — Premium is bought inside it",
      /const CTA_HREF = "\/onboarding\.html";/.test(src),
      "a CTA that 303s to Stripe asks a parent to pay before their child has said a word");
    ok("…and no CTA hard-codes the checkout endpoint around it",
      !/href="\/api\/checkout"/.test(src),
      "a literal href bypasses the switch and survives the next flip");
    ok("the pricing section itself is selected by the switch",
      /FREE_MODE \? <PricingFree \/> : <PricingPaid spots=\{spots\} \/>/.test(src),
      "both arms stay in the file; only one renders");
    // This pin used to demand SAVING = "$59.89" — the figure the repo later
    // banned (12 × $9.99 against a plan nobody can buy). It only runs while
    // free, so it sat unexercised through the paid weeks and rotted. The paid
    // arm now reads every figure from lib/charter.ts, the one library.
    ok("the paid arm reads its figures from the one library, ready for the next flip",
      /YEARLY = CHARTER_PRICE/.test(src) && /import \{[^}]*CHARTER_PRICE[^}]*\} from "@\/lib\/charter"/.test(src),
      "if the landing page grows its own price literal, flip twelve ships wrong prices");
    ok("…and the banned anchor never comes back while nobody is looking",
      !/59\.89|119\.88/.test(src),
      "$59.89 and $119.88 were only ever 12 × $9.99 — an invented was-price");
    // the one figure that is wrong wherever it appears
    ok("…and never quotes $4.99 a month",
      !/\$4\.99 a month/.test(src),
      "59.99/12 = 4.9991 — the rounded figure implies $59.88 a year");
  }

  // /subscribe is the same shape: its plan picker is the Stripe rail CLAUDE.md
  // says to keep wired, so the pin is UNREACHABLE, not absent.
  {
    const src = decomment(readFileSync(APP + "/app/subscribe/page.tsx", "utf8"));
    const guard = src.indexOf("if (FREE_MODE)");
    const price = src.search(PRICEY);
    ok("app/subscribe/page.tsx returns the free notice before any price can render",
      guard >= 0 && (price < 0 || guard < price),
      guard < 0 ? "no FREE_MODE guard at all" : "a price at index " + price + " precedes the guard at " + guard);
    // The switch is decided in a wrapper that renders one of two components,
    // so while free the picker's hooks (and its charter fetch) never run at all.
    ok("…and that early return is a real return, not a flag",
      /function SubscribeInner\(\) \{\s*if \(FREE_MODE\) return <FreeNotice \/>;\s*return <PaidPicker \/>;/.test(src),
      "the picker below it must never mount while free");
  }

  // Terms must state the live reality, whichever it is, and keep the paid
  // terms available for anyone still holding a subscription from a paid era.
  {
    const src = decomment(readFileSync(APP + "/app/terms/page.tsx", "utf8"));
    ok("the Terms read the switch too",
      /import \{ FREE_MODE \} from "@\/lib\/pricing"/.test(src),
      "legal copy describing the wrong pricing era is the worst place for this to drift");
  }
}

// ── 4. the promises that outlive any switch ──
// FOUR free windows, FOUR sweeps. Each one is a promise to the families who
// arrived while that window was open, and each survives every later flip. The
// era-3 sweep is the one CLAUDE.md said had to be written BEFORE pricing could
// return — it ships in the same commit that brought the paywall back.
//
// 24 Sep 2026: era four (20 Sep → this build) joins them. It ships in the SAME
// build that turns FREE_MODE off — never earlier, because a sweep that shipped
// during the window would have stamped the very families it protects before
// they onboarded. So its presence is pinned to the switch: whenever the family
// paywall is live, the era-four sweep must exist and run.
ok("all four grandfather sweeps still exist",
  /function _grandfatherFreeEra\(/.test(sona) && /function _grandfatherFreeEra2\(/.test(sona) &&
  /function _grandfatherFreeEra3\(/.test(sona) && /function _grandfatherFreeEra4\(/.test(sona),
  "a missing sweep is a broken promise to a real cohort — never 'clean these up'");
ok("…and every one of them is actually called at load",
  /_grandfatherFreeEra\(\); \} catch/.test(sona) && /_grandfatherFreeEra2\(\); \} catch/.test(sona) &&
  /_grandfatherFreeEra3\(\); \} catch/.test(sona) && /_grandfatherFreeEra4\(\); \} catch/.test(sona),
  "a sweep that is defined but never invoked keeps no promise at all");
ok("…in era order, so no sweep ever runs ahead of the one before it",
  sona.indexOf("_grandfatherFreeEra3(); } catch") < sona.indexOf("_grandfatherFreeEra4(); } catch") &&
  sona.indexOf("_grandfatherFreeEra2(); } catch") < sona.indexOf("_grandfatherFreeEra3(); } catch"));
{
  const era4 = (sona.match(/function _grandfatherFreeEra4\(\) \{[\s\S]*?\n  \}/) || [""])[0];
  ok("the era-four sweep never reads an earlier era's stamp",
    !!era4 && !/GF2KEY|GF3KEY|getItem\(GFKEY\)|freeera2|freeera3/.test(era4),
    "a device that first loaded during era three or four carries every earlier stamp and belongs to none of them");
  ok("…is one-shot, stamped on the way in",
    /if \(localStorage\.getItem\(GF4KEY\)\) return;[^\n]*\n\s*localStorage\.setItem\(GF4KEY, "done"\);/.test(era4),
    "a sweep that can re-run adopts every family who onboards after it");
  ok("…and counts a clinician's credential as membership, not just onboarding",
    /sona\.slpunlock/.test(era4) && /sona\.slpok/.test(era4),
    "before this build a redemption WAS free-forever access — a family mid-setup was promised it too");
}
ok("the free-mode bounce is still wired on trial.html",
  /Sona\.isFree\(\)\) location\.replace\("\/today\.html"\)/.test(readFileSync(ROOT + "/trial.html", "utf8")));
ok("gated() still short-circuits on the switch before anything else",
  /function gated\(\w*\) \{\s*if \(isFree\(\)\) return false;/.test(sona),
  "if any check runs ahead of the switch, the switch is not the switch");
// …and PRACTICE comes straight after it (24 Sep 2026). "Paid" no longer means
// "walled": the free version is daily practice, so nothing that could close
// the door — a finished demonstration, a dead trial, a lapsed plan — may be
// consulted before the gate has said practice is open.
{
  const g = (sona.match(/function gated\(\w*\) \{[\s\S]*?\n  \}/) || [""])[0];
  const practice = g.indexOf("PRACTICE_ASKS.indexOf(what) !== -1) return false;");
  ok("practice is answered before any entitlement, demo or trial check",
    practice > 0 && practice < g.indexOf("premium()") && practice < g.indexOf("demoDone()") && practice < g.indexOf("getTrial()"),
    g.slice(0, 300));
  ok("…and every practice door is on the list",
    /const PRACTICE_ASKS = \["practice", "daily", "session", "demo"\];/.test(sona));
}

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
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 10 * 86400000, days: 3 })); localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
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

// ── 6. THE FREE VERSION, in a browser, whichever way the switch points ──
// Since 24 Sep 2026 the paid state is not a wall: a family with no entitlement
// at all keeps daily practice and the free games for their style of play, and
// Premium adds the rest. Everything below runs through the ?paid=1 seam, so it
// holds in either state — it pins what "priced" MEANS, not whether Sona is
// priced today. The device is brand new: its first load is this build, so
// every free-era sweep stamps it before it onboards and grants it nothing.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.goto("http://localhost:8211/today.html"); await pg.waitForTimeout(300);
  const seedNew = () => pg.evaluate(() => {
    sessionStorage.setItem("sona.paidui", "1");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Ivy", childAge: "7", focusSounds: ["R"], onboarded: true, voiceOn: false, volume: 0 }));
    // the demonstration is long over and an old local trial is long dead —
    // the family the free version exists for
    localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
    localStorage.setItem("sona.trial.v1", JSON.stringify({ start: Date.now() - 30 * 86400000, days: 3 }));
    localStorage.setItem("sona.micok", "1");
  });
  await seedNew();
  const st = await pg.evaluate(() => {
    const keys = Object.keys(Sona.GAME_ACTS);
    return {
      stamp4: localStorage.getItem("sona.freeera4.v1"),
      premium: Sona.premium(),
      practice: ["practice", "daily", "session", "demo"].map((w) => Sona.gated(w)),
      free: keys.filter((k) => Sona.GAME_ACTS[k].tier === "free" && !Sona.GAME_ACTS[k].comingSoon).map((k) => [k, Sona.gameAccess(k).allowed]),
      paid: keys.filter((k) => Sona.GAME_ACTS[k].tier === "premium" && !Sona.GAME_ACTS[k].comingSoon).map((k) => [k, Sona.gameAccess(k).allowed, Sona.gated(k)]),
      parked: keys.filter(k => Sona.GAME_ACTS[k].comingSoon).map(k => ({key:k,access:Sona.gameAccess(k)})),
      story: Sona.gated("story"),
      unnamed: Sona.gated(),
      deck: Sona.adventureGames().map((k) => [k, Sona.gameAccess(k).allowed]),
      mystery: (Sona.addCoins(500), Sona.canBuyMystery()),
      ask: Sona.planEligible(),
    };
  });
  ok("a brand-new device is stamped by the era-four sweep and granted nothing",
    st.stamp4 === "done" && st.premium === false, JSON.stringify(st));
  ok("…and is never gated from practice, by any door",
    st.practice.every((g) => g === false), JSON.stringify(st.practice));
  ok("…plays every released free-tier game",
    st.free.length >= 2 && st.free.every(([, a]) => a === true), JSON.stringify(st.free));
  ok("…but Coming soon games remain unavailable to this family", st.parked.length===2&&st.parked.every(g=>!g.access.allowed&&g.access.reason==="coming-soon"),JSON.stringify(st.parked));
  ok("…but no Premium game, asked by the catalog or the gate",
    st.paid.length > 0 && st.paid.every(([, a, g]) => a === false && g === true), JSON.stringify(st.paid));
  ok("…and Premium content that is not a game stays Premium",
    st.story === true && st.unnamed === true, JSON.stringify({ story: st.story, unnamed: st.unnamed }));
  ok("the daily adventure deals only games the family can open",
    st.deck.length === 5 && st.deck.every(([, a]) => a === true), JSON.stringify(st.deck));
  ok("the mystery door is Premium: coins alone do not open it", st.mystery === false, JSON.stringify(st));
  ok("…and the one-time offer is still an offer this family may see", st.ask === true, JSON.stringify(st));

  // Home stays a quiet catalog. Released Premium cards name their boundary;
  // Coming soon cards cannot start or advertise an upgrade.
  await pg.goto("http://localhost:8211/today.html"); await pg.waitForTimeout(800);
  const home = await pg.evaluate(() => ({
    heading:document.querySelector("h1").textContent,
    automatic:!!document.getElementById("goBtn"),
    run:sessionStorage.getItem("sona.run.v1"),
    kid:document.getElementById("libraryApp").innerText,
    locked:[...document.querySelectorAll('#activityGroups .game-card[data-locked="true"]')].filter(t=>!t.disabled).map(t=>({key:t.dataset.game,tag:t.querySelector(".game-access").textContent,aria:t.getAttribute("aria-label")})),
    open:[...document.querySelectorAll('#activityGroups .game-card[data-locked="false"]')].map(t=>t.dataset.game),
  }));
  ok("Home waits for a chosen game without starting a daily run or replay", /pick a game/i.test(home.heading)&&!home.automatic&&!home.run,JSON.stringify(home));
  ok("a locked released tile says Premium and asks for a grown-up",home.locked.length===3&&home.locked.every(t=>t.tag==="Premium"&&/Ask a grown-up/.test(t.aria)),JSON.stringify(home.locked));
  ok("…and nothing a child can read on Home names a price",!/\$\s?\d/.test(home.kid),(home.kid.match(/\$\s?\d[^\s]*/) || [])[0]);
  await pg.locator('#activityGroups .game-card[data-game="slice"]').click();
  await pg.waitForURL(/charge\.html/);
  ok("choosing a released free game opens normal practice without a replay flag",home.open.includes("slice")&&new URL(pg.url()).searchParams.get("game")==="arcade-slice.html"&&!new URL(pg.url()).searchParams.has("demo"),pg.url());

  // the daily run itself opens — the practice door does not bounce
  await pg.goto("http://localhost:8211/charge.html?daily=1"); await pg.waitForTimeout(900);
  ok("the daily run opens for a family with no plan", /charge\.html\?daily=1/.test(pg.url()), pg.url());

  // the plan screen: ONE plan card, and what stays free right under it
  await pg.evaluate(() => sessionStorage.setItem("sona.gate.v1", String(Date.now())));
  await pg.goto("http://localhost:8211/subscribe.html"); await pg.waitForTimeout(900);
  const plan = await pg.evaluate(() => ({
    pick: document.getElementById("pickCard").style.display,
    plans: document.querySelectorAll("#pickCard .plan").length,
    free: (document.getElementById("freeTierCard") || {}).style ? document.getElementById("freeTierCard").style.display : "missing",
    freeText: (document.getElementById("freeTierCard") || {}).innerText || "",
    line: document.getElementById("planLine").innerText,
  }));
  ok("the plan screen offers exactly one plan to a family on the free version",
    plan.pick === "block" && plan.plans === 1, JSON.stringify(plan));
  // The free-version promise must not count games that are still parked.
  ok("…and says what they keep if they don't buy it, in the one phrase",
    plan.free === "block" && /daily practice and free games/i.test(plan.freeText) && !/\btwo games\b/i.test(plan.freeText), JSON.stringify(plan));
  ok("no pageerrors across the free-version surfaces", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
