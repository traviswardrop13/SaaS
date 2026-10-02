// CHARTER1: $59.99 for the first 50 families, then $99.99 — and the claim is
// TRUE BY CONSTRUCTION, not decoration. This repo already banned one
// struck-through price ($119.88) for anchoring against a number nobody could
// pay. A charter price is honest only if spot 51 really is charged the
// standard price, so what is pinned here is the COUNT the checkout reads and
// the rule that produces it — not the copy that repeats it.
//
// lib/charter.ts is TypeScript. Node 22 strips types natively behind a flag,
// so this suite re-launches itself with it rather than asking run-all.mjs to
// know which suites need which flags.
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import path from "path";

const self = fileURLToPath(import.meta.url);
if (!process.execArgv.includes("--experimental-strip-types")) {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", self], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

const APP = path.resolve(path.dirname(self), "..");
const { charterSpots, _resetCharterMemo, CHARTER_CAP, CHARTER_CENTS, STANDARD_CENTS, CHARTER_LABEL, MONTHLY_CENTS, MONTHLY_PRICE } = await import(APP + "/lib/charter.ts");

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

const sub = (interval, tier, status) => ({ status: status || "active", items: { data: [{ price: { recurring: { interval } } }] }, metadata: tier ? { tier } : {} });
const client = (pages) => { let i = 0; return { subscriptions: { search: async () => { const p = pages[Math.min(i++, pages.length - 1)]; return { data: p.data, has_more: !!p.next, next_page: p.next }; } } }; };

// ── the counting rule: a spot is what checkout SOLD as a charter spot ──
// Travis, 19 Sep 2026, on the two yearly subscriptions that predate the
// offer (his own test purchases): "dont count". Checkout stamps
// metadata.tier on every subscription it creates, so anything without the
// stamp was never sold as one of the fifty.
_resetCharterMemo();
let s = await charterSpots(client([{ data: [
  sub("year", "charter"), sub("year", "charter", "trialing"), sub("year", "charter", "canceled"),
  sub("year"),                              // no tier: sold before the offer existed, or a test purchase
  sub("month", "charter"),                  // the monthly plan, even wrongly stamped
  sub("year", "standard"),                  // sold at full price, after the cap
  sub("year", "charter", "incomplete"),     // never finished paying
  sub("year", "charter", "incomplete_expired"),
] }]));
ok("a yearly subscription checkout stamped as a charter sale is a spot", s.taken === 3, JSON.stringify(s));
ok("…a trial still inside its free days is one, and a cancelled one still consumed its spot", s.taken === 3);
ok("…a subscription with NO tier stamp — from before the offer existed, or a test purchase — is NOT (Travis: 'dont count')", s.taken === 3);
ok("…a monthly subscription is not, whatever it is stamped with (monthly is on sale again since 1 Oct 2026)", s.taken === 3 && s.source === "stripe");
ok("…one sold at the standard price, after the cap, is not", s.taken === 3);
ok("…and a checkout that never finished paying is not", s.taken === 3);
ok("the count says what is left, and that the door is open", s.left === CHARTER_CAP - 3 && s.open === true, JSON.stringify(s));

// ── a clinician's caseload plan is not a family's charter spot (24 Sep 2026) ──
// "Sona Premium for your caseload" is a YEARLY subscription, live, and
// stamped plan + slp by /api/slp/plan — never `tier`. Were it ever counted,
// every clinician who bought it would quietly take one of the fifty $59.99
// family spots, and "for the first 50 families" would stop being true. Even
// if a search returned one, the count must pass it by.
{
  const caseload = (status, extra) => ({ ...sub("year", null, status), metadata: { plan: "slp-caseload", slp: "sam@clinic.org", ...(extra || {}) } });
  _resetCharterMemo();
  const c = await charterSpots(client([{ data: [caseload("active"), caseload("past_due"), caseload("trialing"), sub("year", "charter")] }]));
  ok("a caseload subscription (plan slp-caseload, no tier) is never a charter spot, in any status",
    c.taken === 1 && c.source === "stripe", JSON.stringify(c));
}

// ── the cap ──
_resetCharterMemo();
s = await charterSpots(client([{ data: Array.from({ length: CHARTER_CAP }, () => sub("year", "charter")) }]));
ok("fifty yearly subscriptions close the door", s.taken === CHARTER_CAP && s.left === 0 && s.open === false, JSON.stringify(s));

// ── pagination stops at the cap, and never runs away ──
_resetCharterMemo();
const big = { data: Array.from({ length: 100 }, () => sub("year", "charter")), next: "p2" };
s = await charterSpots(client([big, big, big, big]));
ok("a hundred on page one is already past the cap — closed, no further pages needed", s.open === false && s.taken >= CHARTER_CAP, JSON.stringify(s));

// ── a failed lookup never costs a family $40 ──
_resetCharterMemo();
const origErr = console.error; console.error = () => {};
s = await charterSpots({ subscriptions: { search: async () => { throw new Error("stripe down"); } } });
console.error = origErr;
ok("when Stripe cannot be reached the offer stays OPEN", s.open === true, JSON.stringify(s));
ok("…and the result says it is a fallback, so no surface prints a number it cannot stand behind", s.source === "fallback");

// ── the memo: one Stripe call a minute, not one per page view ──
_resetCharterMemo();
let calls = 0;
const counting = { subscriptions: { search: async () => { calls++; return { data: [sub("year")], has_more: false }; } } };
await charterSpots(counting); await charterSpots(counting); await charterSpots(counting);
ok("three reads inside a minute are one Stripe call", calls === 1, "calls=" + calls);
_resetCharterMemo(); await charterSpots(counting);
ok("…and the test seam forgets it", calls === 2, "calls=" + calls);

// ── the constants that every surface reads ──
ok("the charter price is the price Sona sells today", CHARTER_CENTS === 5999);
ok("the standard price is higher — or the word 'charter' means nothing", STANDARD_CENTS > CHARTER_CENTS, STANDARD_CENTS);
ok("the user-facing word is NOT 'founding' — that already means the free SLP-referred cohort",
  !/found/i.test(CHARTER_LABEL), CHARTER_LABEL);

// ── the source-level contracts on the files that carry the claim ──
{
  // CODE, not commentary: the library's own comments quote the banned figures
  // in order to ban them (the same describing-vs-disavowing trap the README
  // and the subscription route pins hit). Strip comments, then ask.
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const lib = strip(readFileSync(APP + "/lib/charter.ts", "utf8"));
  ok("$99.99 is never written as '$8.33 a month' (that would imply $99.96 a year)",
    !/8\.33/.test(lib) && /under \$8\.50 a month/.test(lib));
  ok("the banned anchor never comes back", !/119\.88|59\.89/.test(lib));
  ok("the count asks Stripe only for what checkout stamped as a charter sale — nothing from before the offer existed",
    /metadata\['tier'\]:'charter'/.test(lib) && /tier !== "charter"/.test(lib),
    "the two pre-offer yearly subscriptions are test purchases and must not fill spots");
  const route = readFileSync(APP + "/app/api/charter/route.ts", "utf8");
  ok("the spots endpoint refuses to invent a price while Sona is free", /FREE_MODE/.test(route) && /open: false/.test(route));
  ok("…and is cacheable briefly at the edge, because it is public and memoised upstream", /s-maxage=60/.test(route));
}

// ── every surface that speaks the price reads the same count ──
{
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const co = strip(readFileSync(APP + "/app/api/checkout/route.ts", "utf8"));
  ok("checkout decides the tier from the live count, at the moment of purchase",
    /charterSpots\(stripe\)/.test(co) && /spots\.open \? "charter" : "standard"/.test(co),
    "this is the line that makes 'first 50 families' true rather than decorative");
  ok("…charges the standard price once the spots are gone",
    /tier === "charter" \? CHARTER_CENTS : STANDARD_CENTS/.test(co));
  ok("…tags the subscription so the count can find charter sales — and nothing else",
    /metadata: \{ tier \}/.test(co));
  ok("…tells the success page which price was locked", /&tier=\$\{tier\}/.test(co));
  ok("…and a fixed Stripe Price from the environment is only ever the charter price",
    /priceId && tier === "charter"/.test(co),
    "an env price created at $59.99 must not be reused for a $99.99 sale");

  const landing = strip(readFileSync(APP + "/app/families/page.tsx", "utf8"));
  ok("the landing page renders from the same count, server-side, per request",
    /export default async function Landing/.test(landing) && /await charterSpots\(\)/.test(landing) && /<PricingPaid spots=\{spots\} \/>/.test(landing));
  ok("…names the standard price in words beside the charter price, never a bare strike-through",
    /Regular price <s>\{STANDARD_PRICE\}\/yr<\/s>/.test(landing));
  ok("…and prints a spots-left number only when Stripe answered it",
    /spots\.source === "stripe"/.test(landing),
    "a guessed scarcity number is the one thing this page must never show");

  const terms = strip(readFileSync(APP + "/app/terms/page.tsx", "utf8"));
  ok("the Terms state the standard price, the charter price, who gets it and that it is kept",
    /\$99\.99 per year/.test(terms) && /charter price of[\s\S]{0,40}\$59\.99 per year/.test(terms) && /first 50 families/.test(terms) && /keep that price/.test(terms));
  ok("…and say renewal is at the price you subscribed at", /at the price you subscribed/.test(terms));

  const sub = strip(readFileSync(APP + "/public/subscribe.html", "utf8"));
  ok("the in-app plan screen waits for the count before it lets anyone pay",
    /lf\.disabled = true/.test(sub) && /Checking today/.test(sub) && /fetch\("\/api\/charter"\)/.test(sub),
    "a parent must never tap $59.99 and meet $99.99 on the Stripe page");
  ok("…re-prices every figure on the card when the spots are gone",
    /yearValue = 99\.99/.test(sub) && /webTitle/.test(sub) && /webRenew/.test(sub) && /__yearPrice/.test(sub));
  ok("…and leaves the native card alone — App Store Connect owns that figure",
    !/iapPrice[\s\S]{0,200}charter/i.test(sub));
  const trial = strip(readFileSync(APP + "/public/trial.html", "utf8"));
  ok("the trial page reads the same endpoint", /fetch\("\/api\/charter"\)/.test(trial) && /tCharter/.test(trial));
  const web = strip(readFileSync(APP + "/app/subscribe/page.tsx", "utf8"));
  ok("the web /subscribe page disables its button until the count answers", /disabled=\{busy \|\| spots === null\}/.test(web));
  const succ = strip(readFileSync(APP + "/app/subscribe/success/page.tsx", "utf8"));
  ok("the success page says which price was locked, and takes the amount from Stripe, not a constant",
    /q\.get\("tier"\) === "charter"/.test(succ) && /Charter price, locked in/.test(succ) && /j\.amountCents/.test(succ));
}

// ── THE MONTHLY PLAN: one figure, and it never touches the charter (1 Oct 2026) ──
// Travis: "add to the paywall a $10 a month option ... that does not have a
// free trial. That's a pay today, but the $59.99 has a three-day trial." What
// checkout really charges is played in caseloadtest; this pins that every
// surface that PRINTS the monthly price prints the one checkout charges, that
// only the plan screen can ask for it, and that the two comparison figures
// banned on 18 Sep did not ride back in with it.
{
  const strip = (t) => t.replace(/<!--[\s\S]*?-->/g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const src = (f) => strip(readFileSync(APP + f, "utf8"));
  ok("the monthly price is $9.99, and its two spellings agree", MONTHLY_CENTS === 999 && MONTHLY_PRICE === "$" + (MONTHLY_CENTS / 100).toFixed(2), MONTHLY_PRICE + " / " + MONTHLY_CENTS);
  const esc = MONTHLY_PRICE.replace(/[$.]/g, "\\$&");

  const co = src("/app/api/checkout/route.ts");
  ok("checkout charges the monthly plan from that one constant", /cents: MONTHLY_CENTS/.test(co) && !/\b999\b/.test(co));
  ok("…sells it only for the exact word \"monthly\"", /return v === "monthly" \? "monthly" : "annual";/.test(co));
  ok("…and a plain GET link is always the yearly plan, whatever its ?plan= says",
    /JSON\.stringify\(\{ plan: "annual" \}\)/.test(co) && !/searchParams\.get\("plan"\)/.test(co),
    "an old ?plan=monthly ad link must never open a pay-today checkout");
  ok("…the yearly branch still decides the tier, and the monthly branch returns before it",
    co.indexOf('if (planKey === "monthly")') > 0 && co.indexOf('if (planKey === "monthly")') < co.indexOf("charterSpots(stripe)"));
  ok("/api/charter hands the plan screen the monthly price, from the same constant", /monthly: MONTHLY_PRICE/.test(src("/app/api/charter/route.ts")));

  const sub = src("/public/subscribe.html");
  const typed = [...sub.matchAll(/id="(monthPrice|monthMathPrice)">([^<]*)</g)].map((m) => m[2]);
  ok("the plan screen's typed monthly figure is the one checkout charges", typed.length === 2 && typed.every((t) => t === MONTHLY_PRICE), JSON.stringify(typed));
  ok("…and the answer from /api/charter can only replace it with a well-formed price", /typeof j\.monthly === "string" && \/\^\\\$\\d\{1,3\}\\\.\\d\\d\$\/\.test\(j\.monthly\)/.test(sub));
  ok("the Apple card's monthly row carries no typed price at all", /<span id="iapPriceMo"><\/span>/.test(sub));
  ok("the charter line is written into the YEARLY box only", /id="planLife"[\s\S]*?id="charterLine"[\s\S]*?<\/div>\s*<!--|id="planLife"[\s\S]*?id="charterLine"/.test(readFileSync(APP + "/public/subscribe.html", "utf8")) &&
    !/id="planMonth"[^>]*>[\s\S]{0,400}charter/i.test(sub));

  for (const f of ["/public/trial.html", "/app/subscribe/page.tsx"]) {
    const t = src(f);
    // "Under $8.50 a month" is the YEARLY plan's per-month reading, not a monthly price
    const figs = [...t.matchAll(/(?<![Uu]nder )(\$\d+\.\d\d) a month/g)].map((m) => m[1]);
    ok(f + " names the monthly plan at the price checkout charges, and no other", figs.length >= 1 && figs.every((x) => x === MONTHLY_PRICE), JSON.stringify(figs));
  }
  ok("the families page prints the monthly price from the constant, never a typed figure",
    /\{MONTHLY_PRICE\} a month, charged today/.test(src("/app/families/page.tsx")) && !new RegExp(esc).test(src("/app/families/page.tsx")));

  const terms = src("/app/terms/page.tsx");
  ok("the Terms sell the monthly plan: its price, charged at purchase, no free trial, renewing each month",
    // read inside the monthly paragraph itself: the Terms say "no free trial"
    // about the free version and the clinician plans too, and any of those
    // would have passed a loose search
    new RegExp("Sona Premium, monthly[\\s\\S]{0,160}" + esc + " per month[\\s\\S]{0,120}no free trial[\\s\\S]{0,120}charged when you buy\\s+it").test(terms) && /the monthly plan each month/.test(terms), terms.slice(terms.indexOf("Sona Premium, monthly"), terms.indexOf("Sona Premium, monthly") + 260));
  ok("…and no longer say it is not sold", !/no\s+longer sold|plan was retired/i.test(terms));
  // This block prints while Sona is free too, under a sentence saying nothing
  // is being sold: "is sold two ways" would be false there.
  ok("…and describe two plans rather than claim a sale", /There are two Sona Premium plans/.test(terms) && !/is sold two ways/.test(terms));
  // "Under $5 a month" beside a real $9.99-a-month plan, with nothing saying
  // it is the yearly plan's reading, is a cheaper monthly plan that isn't sold.
  ok("the families page's footnote says its per-month figure is billed once a year",
    /Premium \$\{perMonthNow\}, billed once a year/.test(src("/app/families/page.tsx")));
  ok("…and keep the charter price for the yearly plan only", /charter price is for the\s+yearly plan only/.test(terms));

  // BOTH pricing states, comments stripped. freetest's ban on these figures
  // runs only while Sona is free; this one always runs.
  const surfaces = ["/public/subscribe.html", "/public/trial.html", "/public/premium.html", "/app/subscribe/page.tsx", "/app/subscribe/success/page.tsx", "/app/families/page.tsx", "/app/terms/page.tsx", "/app/api/checkout/route.ts"];
  const anchored = surfaces.filter((f) => /119\.88|59\.89/.test(src(f)));
  ok("no purchase surface brought back $119.88 or \"save $59.89\" with the monthly plan", anchored.length === 0, anchored.join(", ") + " — the saving is only true while the charter price lasts");
  // "Under $5 a month" is the yearly plan's per-month reading. Beside a real
  // $9.99-a-month plan it must always say it is billed once a year, or it
  // reads as a cheaper monthly plan. (What a parent actually sees on the plan
  // screen is read in progtest; these are the places the words are built.)
  ok("the plan screen's per-month reading always says it is billed once a year",
    /Under \$5 a month, billed once a year\./.test(sub) && /Under \$8\.50 a month, billed once a year\./.test(sub) && /yearPer \+ "<\/b>, billed once a year\./.test(sub));
  ok("…and so does the web /subscribe page, which now names the monthly plan beside it",
    /\{perMonth\}, billed once a year/.test(src("/app/subscribe/page.tsx")));
  ok("…and the trial page", /Under \$5 a month, billed once a year\./.test(src("/public/trial.html")) && /Under \$8\.50 a month, billed once a year\./.test(src("/public/trial.html")));
}

// ── WHEN THE WEBSITE DOES NOT SELL, NO SURFACE QUOTES ITS PRICE (1 Oct 2026) ──
// Travis: "i dont want them paying on the website". WEB_SALES in
// lib/pricing.ts (mirrored in sona.js; freetest pins the pair equal) decides
// whether a family can pay on the website at all. Everything above this line
// pins the SELLING state, which stays in every file whole. This pins the other
// arm of the Next.js half: the charter offer is a web offer, so with the web
// rail shut nobody new can take a spot, and a page that still said "$59.99
// for the first 50 families" would be the banned anchor again, a price nobody
// can pay. What the routes actually answer in each state is PLAYED in
// caseloadtest; this reads the copy, because the pages render one arm and
// keep the other, and only the source shows both.
// It does not hold the switch's value: every check here is true either way.
{
  const strip = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const src = (f) => strip(readFileSync(APP + f, "utf8"));
  // anything that is the WEBSITE's offer: a figure, a price constant, the
  // charter, the free days, Stripe
  const WEB_OFFER = /\$\s?\d|PRICE\b|PER_MONTH|priceNow|perMonthNow|CHARTER_|spots\b|Stripe|charter|3 days free|3 free days|free trial|on the web/;
  const between = (t, a, b) => { const i = t.indexOf(a), j = t.indexOf(b, i + 1); return i >= 0 && j > i ? t.slice(i, j) : ""; };
  const store = (/var APP_STORE = "([^"]+)"/.exec(readFileSync(APP + "/public/parents.html", "utf8")) || [])[1] || "";

  const route = src("/app/api/charter/route.ts");
  ok("/api/charter says whether the website sells, in every answer",
    (route.match(/webSales: /g) || []).length === 3 && /free: true, webSales: WEB_SALES/.test(route), String((route.match(/webSales: /g) || []).length));
  ok("…and with the website not selling it answers before the count is asked for, with no price field",
    route.indexOf("if (!WEB_SALES)") > route.indexOf("if (FREE_MODE)") && route.indexOf("if (!WEB_SALES)") < route.indexOf("await charterSpots()") &&
    /\{ ok: true, free: false, webSales: false, cap: CHARTER_CAP, taken: 0, left: 0, open: false, source: "off" \}/.test(route),
    "a page that reads price or standard from this answer would be quoting a checkout that refuses");

  const landing = src("/app/families/page.tsx");
  ok("the families page has a third state: priced, but not sold on the website",
    /const APP_ONLY = !FREE_MODE && !WEB_SALES;/.test(landing) && /import \{ WEB_SALES \} from "@\/lib\/pricing"/.test(landing));
  ok("…in which it does not ask Stripe for a charter count it will not print",
    /const spots: Spots = \(FREE_MODE \|\| APP_ONLY\)\s*\?\s*\{[^{}]*source: "fallback"[^{}]*\}\s*:\s*await charterSpots\(\);/.test(landing), "the count is the website's offer");
  const card = between(landing, "function PremiumInApp()", "function PricingFree()");
  ok("…its Premium card names no price, no charter, no free days and no Stripe, and says where Premium is bought",
    !!card && !WEB_OFFER.test(card) && /Premium is bought in the Sona app on iPhone and iPad, at the price the App Store shows\./.test(card) && /<AppStoreBadge \/>/.test(card),
    (WEB_OFFER.exec(card) || ["(card not found)"])[0]);
  ok("…and that card stands in the priced one's place, which stays in the file", /\{APP_ONLY \? <PremiumInApp \/> : \(\s*<div style=\{priceCard\}>\s*<div style=\{priceBadge\}>\{open \?/.test(landing));
  // the lines the switches decide: the hero subline, the final price line, its
  // footnote, and the two FAQ answers. Each has an app-only twin.
  const twins = [...landing.matchAll(/APP_ONLY\s*\?\s*(\(\s*<>[\s\S]*?<\/>\s*\)|"[^"]*")/g)].map((m) => m[1]);
  ok("…every other priced line has an app-only twin with no web offer in it, naming the iPhone and iPad app",
    twins.length === 5 && twins.every((t) => !WEB_OFFER.test(t) && /iPhone and iPad/.test(t)),
    twins.length + " twins; " + twins.filter((t) => WEB_OFFER.test(t) || !/iPhone and iPad/.test(t)).join(" | "));
  ok("…and the page sends a parent to the one App Store address the website uses", !!store && landing.includes('"' + store + '"'), store);

  const web = src("/app/subscribe/page.tsx");
  const page = web.slice(web.indexOf("export default function SubscribePage"));
  ok("/subscribe chooses the app-only notice before the picker can mount",
    page.indexOf("if (!FREE_MODE && !WEB_SALES) return <AppOnlyNotice />;") > 0 && page.indexOf("if (!FREE_MODE && !WEB_SALES) return <AppOnlyNotice />;") < page.indexOf("<SubscribeInner />"),
    "the picker's charter fetch and its checkout button must not exist while the website does not sell");
  const notice = between(web, "function AppOnlyNotice()", "export default function SubscribePage");
  ok("…the notice names no price, no charter, no free days and no Stripe, and asks the server nothing",
    !!notice && !WEB_OFFER.test(notice) && !/fetch\(/.test(notice), (WEB_OFFER.exec(notice) || ["(notice not found)"])[0]);
  ok("…it says where Premium is bought, and that it opens THERE (an Apple purchase does not open the website)",
    /Sona Premium is in the iPhone and iPad app/.test(notice) && /You buy it there, through\s+the App Store, and it opens there\./.test(notice) &&
    /Daily practice and the free games stay free here\./.test(notice) && /Get Sona on the App Store/.test(notice) && !!store && web.includes('"' + store + '"') && /href=\{APP_STORE_URL\}/.test(notice));
  ok("…and it is not a dead end for someone already paying: their plan keeps working, how to restore it, how to cancel it",
    /Already paid on speaksona\.com\? Your plan keeps working\./.test(notice) && /href="\/trial\.html"/.test(notice) && /mailto:/.test(notice) && /we will cancel it for you/.test(notice) && /href="\/today\.html"/.test(notice));
  ok("…inside the iPhone app it goes to the plan screen (the Apple card), never to an App Store button",
    /Capacitor[\s\S]{0,120}location\.replace\("\/subscribe\.html"\)/.test(notice) && /if \(!inBrowser\) return null;/.test(notice) &&
    /Capacitor[\s\S]{0,120}location\.replace\("\/subscribe\.html"\)/.test(between(web, "function PaidPicker()", "function AppOnlyNotice()")));

  const terms = src("/app/terms/page.tsx").replace(/\{" "\}/g, " ").replace(/\s+/g, " ");
  const off = between(terms, "{!WEB_SALES && (", "<PlanTerms />");
  ok("the Terms, with the website not selling, lead with who sells new subscriptions, and quote no Apple price",
    /New family subscriptions to Sona Premium are sold in the Sona app on iPhone and iPad, by Apple, at the price and free-trial length shown in the App Store\./.test(off) &&
    /We are not selling new family subscriptions on speaksona\.com\./.test(off) && !/\$\s?\d/.test(off), off.slice(0, 200));
  // "family", every time: a clinician's plans ARE new Sona Premium
  // subscriptions sold on speaksona.com, two sections down the same page
  ok("…and say FAMILY subscriptions, pointing a clinician at the plans still sold here",
    !/New Sona Premium subscriptions are sold/.test(terms) && !/We are not selling new subscriptions on/.test(terms) && /A clinician(?:&apos;|')s plans are still sold here: see Premium for clinicians below\./.test(off));
  // the charter paragraph is an offer only while the website sells
  const charterOff = between(terms, ") : ( <> <strong>Charter price.</strong>", "</>");
  ok("…and with the website not selling, the charter paragraph is what a charter plan costs, not an offer",
    /\{WEB_SALES \? \( <> <strong>Charter price\.<\/strong> The first 50 families/.test(terms) &&
    /A yearly subscription bought on speaksona\.com at the charter price is/.test(charterOff) && /keeps that price/.test(charterOff) &&
    !/first 50|at checkout|new subscriptions/.test(charterOff), charterOff.slice(0, 240));
  ok("…then say a subscription already bought on speaksona.com keeps working and renewing, and that the plan terms govern those",
    /A subscription already bought on speaksona\.com keeps working\./.test(off) && /keeps renewing at the price it was bought at until you cancel it/.test(off) && /The terms that follow govern those subscriptions\./.test(off));
  ok("…and drop the confirmation-page sentence, which describes a checkout that refuses",
    /\{!FREE_MODE && WEB_SALES && \( <> After checkout, your confirmation page shows/.test(terms));
  ok("…while the way to cancel a plan bought on speaksona.com stays in every state",
    /For a family's subscription bought on speaksona\.com, email us and we will cancel it for you\./.test(terms.replace(/&apos;/g, "'")));
}

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
