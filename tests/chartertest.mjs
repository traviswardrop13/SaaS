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
const { charterSpots, _resetCharterMemo, CHARTER_CAP, CHARTER_CENTS, STANDARD_CENTS, CHARTER_LABEL } = await import(APP + "/lib/charter.ts");

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
  sub("month", "charter"),                  // the retired monthly plan
  sub("year", "standard"),                  // sold at full price, after the cap
  sub("year", "charter", "incomplete"),     // never finished paying
  sub("year", "charter", "incomplete_expired"),
] }]));
ok("a yearly subscription checkout stamped as a charter sale is a spot", s.taken === 3, JSON.stringify(s));
ok("…a trial still inside its free days is one, and a cancelled one still consumed its spot", s.taken === 3);
ok("…a subscription with NO tier stamp — from before the offer existed, or a test purchase — is NOT (Travis: 'dont count')", s.taken === 3);
ok("…the retired monthly plan is not", s.taken === 3 && s.source === "stripe");
ok("…one sold at the standard price, after the cap, is not", s.taken === 3);
ok("…and a checkout that never finished paying is not", s.taken === 3);
ok("the count says what is left, and that the door is open", s.left === CHARTER_CAP - 3 && s.open === true, JSON.stringify(s));

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

  const landing = strip(readFileSync(APP + "/app/page.tsx", "utf8"));
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

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
