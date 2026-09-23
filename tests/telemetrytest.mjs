// TELE1: the funnel is measurable, and it still carries nothing about a child.
//
// Sona sends events through TWO paths and both are allow-listed, which is the
// COPPA posture — an unlisted key is dropped silently. That silence is also
// the failure mode this suite exists for: an event fired from the app but
// missing from /api/track's EVENTS set vanishes with no error anywhere, and
// looks exactly like "nobody did that thing". The funnel would read as broken
// product rather than broken instrumentation.
//
//   sona.js track()  ->  POST /api/track  ->  PostHog   (kid pages; no pixel)
//   SonaAnalytics    ->  posthog.capture  ->  PostHog   (parent pages, native too)
import { readFileSync, readdirSync } from "fs";
import { ROOT } from "./_env.mjs";

const APP = ROOT + "/..";
const sona = readFileSync(ROOT + "/sona.js", "utf8");
const relay = readFileSync(APP + "/app/api/track/route.ts", "utf8");
const analytics = readFileSync(ROOT + "/analytics.js", "utf8");

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

// ── 1. every event the app fires through the relay is allow-listed there ──
{
  // EVERY file that can reach the relay, not the two that did when this was
  // written. The scan used to read sona.js and charge.html only, and its
  // pattern excluded dotted calls to avoid catching SonaAnalytics.track (the
  // direct-to-PostHog path, allow-listed separately below). But `Sona.track`
  // is dotted AND is the relay — so a relay event fired from any other page
  // was invisible to this check twice over, which is precisely the silence
  // the suite exists to break.
  const relayed = new Set();
  const files = ["sona.js", ...readdirSync(ROOT).filter((f) => f.endsWith(".html"))];
  for (const f of files) {
    const src = readFileSync(ROOT + "/" + f, "utf8");
    for (const m of src.matchAll(/(?:^|[^.\w])(?:track|tele)\(\s*"([^"]+)"/g)) relayed.add(m[1]);
    for (const m of src.matchAll(/\bSona\.track\(\s*"([^"]+)"/g)) relayed.add(m[1]);
  }
  ok("the scan looks at every page that can reach the relay, not a fixed pair",
    files.length > 10, files.length + " files");
  const allowed = (relay.match(/const EVENTS = new Set\(\[([\s\S]*?)\]\)/) || ["", ""])[1];
  for (const ev of [...relayed].sort()) {
    ok(`relay accepts "${ev}"`, allowed.includes(`"${ev}"`),
      "fired by the app but not in EVENTS — /api/track drops it silently, so it looks like nobody did it");
  }
  // the host is a constant and the path a template, so match the pair
  ok("…and the relay actually forwards them to PostHog",
    /PH_HOST = "https:\/\/[a-z]+\.i\.posthog\.com"/.test(relay) && /\$\{PH_HOST\}\/capture\//.test(relay),
    "an allow-listed event that reaches no sink is the same as no event");
}

// ── 2. the conversion funnel has every step ──
// Without all four, a number is unreadable: practice with no ask, an ask with
// no trial, or a trial with no purchase each leave a hole you cannot tell from
// a product failure.
{
  const everywhere = ["sona.js", "charge.html", "subscribe.html", "today.html"]
    .map((f) => readFileSync(ROOT + "/" + f, "utf8")).join("\n") +
    readFileSync(APP + "/app/subscribe/success/page.tsx", "utf8");
  for (const [step, ev] of [
    ["a child practices", "practice completed"],
    ["the ask is shown", "plan moment shown"],
    ["the trial clock starts", "trial started"],
    ["money is committed", "purchase completed"],
  ]) {
    ok(`the funnel can see: ${step}`, everywhere.includes(`"${ev}"`), `no "${ev}" event is fired anywhere`);
  }
}

// ── 3. the two trial-ish moments must never share a name ──
// The Apple and Stripe success handlers both used to fire "trial started",
// which is also what the in-app 3-day clock is called. One name, two funnel
// steps, and every number built on either becomes meaningless.
{
  const paid = readFileSync(ROOT + "/subscribe.html", "utf8") +
               readFileSync(APP + "/app/subscribe/success/page.tsx", "utf8");
  ok("a completed purchase is not reported as a trial start",
    !/track\((?:[^)]*\?)?\s*"trial started"/.test(paid),
    "the purchase handlers must say 'purchase completed' — sona.js owns 'trial started'");
  ok("…and the trial clock reports itself from where it actually starts",
    /function startTrial[\s\S]{0,700}track\("trial started"/.test(sona),
    "reporting it from onboarding missed every trial started in the iOS shell, where sonaTrack is a no-op");
  ok("…exactly once, guarded by the same check that creates the trial",
    /if \(!t \|\| !t\.start\) \{[\s\S]{0,900}track\("trial started"/.test(sona));
}

// ── 4. nothing about a child rides along ──
// This is the rule the whole allow-list exists to keep. Both lists are checked
// because a key added to one is invisible in the other.
{
  const props = (relay.match(/const PROPS = new Set\(\[([\s\S]*?)\]\)/) || ["", ""])[1];
  const allowed = (analytics.match(/var ALLOWED = \{([\s\S]*?)\};/) || ["", ""])[1];
  for (const [list, name] of [[props, "the relay's PROPS"], [allowed, "analytics.js ALLOWED"]]) {
    ok(`${name} carries no child identity`,
      !/child|name|age|email|word|transcript|clip|audio/i.test(list), list.trim().slice(0, 120));
  }
  ok("the relay still drops unlisted keys rather than passing them through",
    /if \(!PROPS\.has\(k\)\) continue;/.test(relay),
    "an allow-list that warns instead of dropping is a deny-list with extra steps");
  ok("identity is the anonymous family id, never a name",
    /ph\.identify\(window\.Sona\.fid\(\)\)/.test(analytics) && /never a name or email/.test(analytics));
}


// ── 4. the ad pixel: on the page that buys the traffic, nowhere near a child ──
{
  const slps = readFileSync(ROOT + "/for-slps.html", "utf8");

  // THE REGRESSION THIS EXISTS FOR. The root used to be the Next page, which
  // loads pixel.js from app/layout.tsx. Rewriting / to this static page took
  // the pixel off the landing page silently — no error, no missing file, just
  // a live campaign with no PageView and no conversion, optimising on who taps
  // an ad instead of on who turns out to be a clinician. Money, spent wrong,
  // with nothing anywhere saying so.
  ok("the page the ad points at loads the pixel",
    /<script src="\/pixel\.js"><\/script>/.test(slps),
    "a campaign with no PageView and no Lead optimises on clicks, not on sign-ups");

  // Since 23 Sep 2026 the page optimises for app downloads: its one action is
  // the App Store, and the download itself happens where this page cannot see
  // it — so the tap that sends someone there is the conversion it can count.
  ok("the page's one action goes to the App Store",
    /id="getApp" href="https:\/\/apps\.apple\.com\/app\/id6785755867"/.test(slps) &&
    /id="finalGo" href="https:\/\/apps\.apple\.com\/app\/id6785755867"/.test(slps));
  ok("Lead fires on that tap, before the page leaves",
    /function go\(e\)[\s\S]{0,160}sonaTrack\("Lead"\)[\s\S]{0,120}setTimeout\(function \(\) \{ location\.href = href; \}/.test(slps) &&
    /buttons\.forEach\(function \(b\) \{ b\.addEventListener\("click", go\); \}\)/.test(slps),
    "a campaign with no conversion event optimises on clicks on the ad, not taps toward the app");
  ok("…and Android, which has no App Store listing, is sent to the web app instead of a dead end",
    /\/Android\/i\.test\(navigator\.userAgent\)[\s\S]{0,120}\/onboarding\.html/.test(slps));

  // WHERE THE PIXEL MAY LOAD, as an allow-list. A deny-list would mean every
  // new page is tracked until someone remembers to exclude it, and the pages
  // that come next are a child's. These four are the grown-up marketing
  // funnel; every other page — the practice screens, the clinician's caseload,
  // the family's redemption link — carries or is one keystroke from a child's
  // identity and gets no ad tracking at all.
  const MARKETING = new Set(["check.html", "subscribe.html", "onboarding.html", "for-slps.html"]);
  const pages = readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  const strays = pages.filter((f) => !MARKETING.has(f) && /pixel\.js/.test(readFileSync(ROOT + "/" + f, "utf8")));
  ok("no page outside the grown-up marketing funnel loads the ad pixel", strays.length === 0, strays.join(", "));
  for (const f of ["slp.html", "join.html", "today.html", "charge.html", "pilot.html"]) {
    ok(`…named explicitly, because it is the one that would hurt: ${f}`,
      !/pixel\.js/.test(readFileSync(ROOT + "/" + f, "utf8")));
  }

  // The pixel gets the FACT, never the person. Meta learns that a sign-up
  // happened; who signed up stays on our side, where they knowingly gave it.
  const calls = [];
  for (const f of pages) {
    const src = readFileSync(ROOT + "/" + f, "utf8");
    for (const m of src.matchAll(/sonaTrack\(([^)]*)\)/g)) if (m[1].trim()) calls.push(f + ": " + m[1]);
  }
  ok("some page actually fires a conversion", calls.length > 0);
  ok("no pixel event carries a name, a child, an age or an email",
    !calls.some((c) => /\b(name|child|kid|age|email|word|transcript)\b/i.test(c)),
    calls.filter((c) => /\b(name|child|kid|age|email|word|transcript)\b/i.test(c)).join(" | "));
}

// ── 5. which ad produced which clinician ──
{
  const req = readFileSync(APP + "/app/api/slp/auth/request/route.ts", "utf8");
  // The landing page stopped collecting sign-ups on 23 Sep 2026 (its one
  // action is the App Store), so the utm/fbclid capture it did for the CRM
  // went with the form. The route still takes attribution from any caller,
  // and what it forwards is still an allow-list:

  // ALLOW-LIST, the lesson /api/lead's safeLead already paid for: these
  // arrive from a query string a stranger controls, and a deny-list is how
  // `name: child` once reached a marketing payload.
  ok("what reaches the CRM is an allow-list, not everything that was posted",
    /const ATTRIB_KEYS = \[/.test(req) && /function safeAttrib/.test(req) &&
    /for \(const k of ATTRIB_KEYS\)/.test(req));
  ok("…and the allow-list holds no field that could name a person",
    !/\b(child|kid|age|transcript|word)\b/.test(req.slice(req.indexOf("const ATTRIB_KEYS"), req.indexOf("function safeAttrib"))));
}

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
