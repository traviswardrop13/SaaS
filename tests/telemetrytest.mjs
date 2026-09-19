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
    ["a child practises", "practice completed"],
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

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
