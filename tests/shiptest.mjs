// SHIP1: what reaches the phone. public/ has no build step and the iOS shell
// remote-loads the live site, so the Cache-Control header IS the update
// mechanism — and it was also the reason every hop of a session re-downloaded
// sona.js (82 KB gzipped): no-store throws the copy away. no-cache keeps it
// and asks "still current?", which Vercel answers with a 304 and a few bytes.
// Both are fresh on deploy; only one is fast between deploys.
import { readFileSync, readdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

const cfg = readFileSync(APP + "/next.config.js", "utf8");
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const code = strip(cfg);
ok("the app shell revalidates instead of re-downloading",
  /"no-cache, max-age=0, must-revalidate"/.test(code) && !/"no-store/.test(code),
  "no-store re-fetches 82 KB on every page of a child's session");
ok("…and still forces a check on every load, so a deploy is visible on the next one",
  /must-revalidate/.test(code) && /max-age=0/.test(code));
ok("the page list is read from disk, not hand-written", /readdirSync\(join\(__dirname, "public"\)\)/.test(code),
  "a hand-written list went stale the last time and left the home screen cacheable");
ok("sona.js itself is covered", /source: "\/sona\.js"/.test(code));
// every page in public/ exists to be covered — the glob above is what covers them
const pages = readdirSync(APP + "/public").filter((f) => f.endsWith(".html"));
ok("there are pages for the glob to cover", pages.length > 20, String(pages.length));


// ── the root, and what a shared link looks like ──
{
  const slps = readFileSync(APP + "/public/for-slps.html", "utf8");

  // A REWRITE, NOT A REDIRECT. Cold paid traffic pays for the extra hop, and
  // two URLs serving one page splits whatever ranking the page earns.
  ok("/ serves the SLP page",
    /source:\s*"\/"\s*,\s*destination:\s*"\/for-slps\.html"/.test(code),
    "the ad points at the root; the root has to be the page the ad promised");
  ok("…as a rewrite, so the URL stays speaksona.com", !/redirects\(\)[\s\S]*for-slps\.html/.test(code));
  ok("…and the page says which URL it is", /rel="canonical" href="https:\/\/speaksona\.com\/"/.test(slps));

  // THE GROWTH PLAN IS SLPS TELLING SLPS, so the link gets pasted into a
  // Facebook group and a district Slack. A link with no card is a grey box.
  // The old root got its title and icons from app/layout.tsx; this page is
  // static and inherits nothing, which is exactly how it lost them.
  for (const tag of ["og:title", "og:description", "og:image", "og:url", "twitter:card"]) {
    ok(`a shared link carries ${tag}`, new RegExp('(property|name)="' + tag + '"').test(slps));
  }
  ok("the card's image is an absolute URL, because a scraper resolves it against nothing",
    /og:image" content="https:\/\/speaksona\.com\/og-slp\.png"/.test(slps));

  // A CARD POINTING AT A 404 IS WORSE THAN NO CARD: the preview renders empty
  // and the link looks broken. So the file exists, and it is the size claimed.
  const og = APP + "/public/og-slp.png";
  ok("…and that image is actually in the repo", existsSync(og));
  if (existsSync(og)) {
    const b = readFileSync(og);
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    ok("…at the dimensions the tags promise", w === 1200 && h === 630, w + "x" + h);
    ok("…declared, so the scraper does not have to fetch it to lay the card out",
      /og:image:width" content="1200"/.test(slps) && /og:image:height" content="630"/.test(slps));
  }

  ok("the landing page declares an icon, so the tab is not blank",
    /rel="icon"/.test(slps) && /rel="apple-touch-icon"/.test(slps));
  ok("…and never claims a certification Rachel does not hold",
    !/\bCCC\b|board-certified|ASHA-certified|\bcertified\b/i.test(slps));

  // PARENTS COME FROM THE SAME ADS (Travis, 24 Sep 2026). The form on this
  // page is for clinicians, so a parent needs a door out that does not ask
  // for an email: the App Store on an iPhone or iPad, the family page (which
  // also runs in any browser) everywhere else. It has to show on a phone,
  // where the ads land, so it must not carry the class that hides nav links
  // under 620px.
  const header = (slps.match(/<header>[\s\S]*?<\/header>/) || [""])[0];
  ok("the header has a For parents link, top right, before Sign in",
    /<a class="parents" id="forParents" href="\/families">For parents<\/a>\s*<a class="signin"/.test(header));
  ok("…that is never hidden on a phone", !/class="[^"]*\bnl\b[^"]*" id="forParents"/.test(header));
  ok("…and goes straight to the App Store on an iPhone or iPad",
    /getElementById\("forParents"\)\.href = "https:\/\/apps\.apple\.com\/us\/app\/sona-speech\/id6785755867"/.test(slps) &&
    /iPhone\|iPad\|iPod/.test(slps) && /maxTouchPoints > 1/.test(slps));
}

// ── what the landing page promises: a free version and Premium (24 Sep 2026) ──
// Until this build the page said "Free forever, unlimited families — for you
// and every kid on your caseload". Every game is Premium now (Travis, 24 Sep
// 2026), so that line would be a promise the app breaks the first time a
// family taps a game. These pins hold the replacement to the truth: what is
// free, what costs money, and exactly what that money buys.
{
  const slps = readFileSync(APP + "/public/for-slps.html", "utf8");
  const shown = slps.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
  ok("the landing page no longer promises 'unlimited families' or anything 'forever'",
    !/unlimited|forever/i.test(shown), (shown.match(/[^.>]*(unlimited|forever)[^.<]*/i) || [""])[0]);
  // Keep the free-game promise independent of the number of available titles.
  ok("…says what is free: the dashboard for you, the free version for every family",
    /<b>Free for you<\/b>/.test(shown) && /<b>Free for every family<\/b>/.test(shown) && /Daily practice and free games/.test(shown));
  ok("…answers 'What does it cost?'",
    /What does it cost\?/.test(shown) && /Caseload Premium is optional: \$79\.99 a year \(under \$7 a month\) gives every family who joins through your link every game/.test(shown));
  ok("…with the plan's real terms: no trial, yearly, cancel anytime, families keep it to the end of the paid year",
    /there is no trial, it renews yearly, and you can cancel anytime/.test(shown) && /your families keep Premium to the end of the year you paid for/.test(shown));
  ok("…and that the clinician never earns on their own caseload", /You never earn anything on your own caseload\./.test(shown));
  ok("…and tells a clinician who signed up under the old promise that it stands",
    /Signed up before Caseload Premium existed\? Your caseload already has it, free/.test(shown));
  // The family price moves with the charter count, and only /api/charter may
  // print it. A static page that typed it would be right until spot fifty.
  ok("…and never quotes a family price", !/\$59\.99|\$99\.99/.test(shown));
  // This page is static and cannot import lib/caseload.ts, so the one copy of
  // the caseload price it has to carry is pinned to the library's.
  const lib = readFileSync(APP + "/lib/caseload.ts", "utf8");
  const price = (lib.match(/CASELOAD_PRICE = "([^"]+)"/) || [])[1];
  const perMonth = (lib.match(/CASELOAD_PER_MONTH = "([^"]+)"/) || [])[1];
  // (a price has cents; "under $7 a month" is the reading, checked next)
  const figures = shown.match(/\$\d+\.\d\d/g) || [];
  ok("every dollar figure on the landing page is lib/caseload.ts's caseload price",
    !!price && figures.length > 0 && figures.every((f) => f === price), price + " vs " + figures.join(","));
  ok("…and its per-month reading is the library's, never a rounded $6.67", !!perMonth && shown.includes("(" + perMonth + ")") && !/\$6\.6\d/.test(shown));
  // REWRITTEN 24 Sep 2026. This pinned "we use it once … and keep it
  // nowhere", and Resend only for "sign-in emails". The parent's address and
  // the link do reach Resend, which keeps delivery logs; privacy.html said so
  // and this page contradicted it, in the answer written for an IT reviewer.
  ok("the storage answer names Stripe, and says who a parent's email is handed to and that Sona keeps no copy",
    /If you buy Caseload Premium, Stripe takes the payment/.test(shown) &&
    /we hand it to Resend to deliver that one email[^.]*, and Sona keeps no copy: not stored, not logged, not added to any list\./.test(shown) &&
    !/keep it nowhere/.test(shown));
  ok("…and names Resend for every email it sends, not only sign-in", /emails via Resend/.test(shown) && !/sign-in emails via Resend/.test(shown));
  ok("the landing page links the Terms that now carry the plan", /href="\/terms"/.test(shown));
  const login = readFileSync(APP + "/public/slp-login.html", "utf8").replace(/<!--[\s\S]*?-->/g, "");
  ok("the sign-in page promises nothing 'forever'", !/forever/i.test(login) && /Your dashboard is free\./.test(login));
}

// ── the Terms the clinician plan is sold under (24 Sep 2026) ──
// Each pin is a sentence a reviewer found untrue against the code: the cap
// counts sign-ups (per code and per clinician), not families; a pilot place
// no longer brings Premium, only a Founding Families one; and nothing holds
// a clinician's own Premium to one device.
{
  const decomment = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  const terms = decomment(readFileSync(APP + "/app/terms/page.tsx", "utf8")).replace(/\{" "\}/g, " ").replace(/\s+/g, " ");
  ok("Terms: the plan covers every family on the caseload; the number is sign-ups a year on a link, and it can be raised",
    /the plan covers every family on your caseload/.test(terms) &&
    /A single link allows up to \{COVERED_REDEEM_CAP\} sign-ups a year, counted across every code you have used, and we raise it on request\./.test(terms) &&
    !/families on one link|ask us if your caseload is bigger/.test(terms), terms.match(/While it is active[^.]*\.[^.]*\.[^.]*\./)?.[0]);
  ok("Terms: only Founding Families places are free regardless — never 'pilot places'",
    /Founding Families places are free and unaffected by these prices\./.test(terms) && !/[Pp]ilot and founding places|pilot place/.test(terms));
  ok("Terms: the clinician's own Premium is 'your own phone or tablet', each link once — never 'one phone'",
    /Premium on your own phone or tablet/.test(terms) && /Each link works once\./.test(terms) && !/one phone/i.test(terms));
  // The redeem route's words at the cap are the ones the Terms point at.
  const redeem = readFileSync(APP + "/app/api/slp/redeem/route.ts", "latin1");
  ok("…and the redeem error at the cap sends the family to their clinician, and her to Sona",
    /ask your speech therapist to contact Sona/.test(redeem) && !/ask your SLP for a fresh link/.test(redeem));
}

// ── ONE PHRASE FOR THE FREE VERSION (24 Sep 2026) ──
// "Daily practice and free games", on every clinician and legal surface.
// Coming-soon titles are not playable yet. Keep the promise count-free so
// parked content cannot inflate it. freemiumtest holds the family surfaces.
{
  const decomment = (t) => t.replace(/<!--[\s\S]*?-->/g, " ").replace(/\{?\/\*[\s\S]*?\*\/\}?/g, " ").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  for (const rel of ["public/for-slps.html", "public/slp.html", "public/privacy.html", "app/terms/page.tsx", "app/families/page.tsx"]) {
    const src = decomment(readFileSync(APP + "/" + rel, "utf8")).replace(/\s+/g, " ");
    ok(rel + " names the free version as 'daily practice and free games'", /daily practice (and|\+) free games/i.test(src));
    ok(rel + " never undersells it as 'two games'", !/\btwo (free )?games\b/i.test(src), (src.match(/.{0,60}\btwo (free )?games\b.{0,40}/i) || [])[0]);
  }
}

// ── the rulebook agrees with the code it describes (24 Sep 2026) ──
// CLAUDE.md is what the next agent obeys. It listed "pilots and founders" as
// free regardless of the switch, while premium() counts only FOUNDING pilots
// — and "Yes, share progress" makes every consenting family a pilot, so an
// agent "fixing" premium() to match the doc would hand every uncovered
// clinician's families Premium. And STRIPE_SETUP.md names the env var that
// lib/caseload.ts reads for the caseload billing page; a doc naming a
// different one is an instruction that silently does nothing.
{
  const md = readFileSync(APP + "/CLAUDE.md", "utf8").replace(/\s+/g, " ");
  const sona = readFileSync(APP + "/public/sona.js", "utf8");
  const prem = (sona.match(/function premium\(\) \{[\s\S]*?\n  \}/) || [""])[0];
  ok("CLAUDE.md: free regardless of the switch means FOUNDING pilots (ff- codes), never pilots in general",
    /founding pilots \(`ff-` codes\) and founders/.test(md) && !/; pilots and founders;/.test(md));
  ok("…and premium() agrees: founding pilots, never isPilot()", /foundingPilot\(\)/.test(prem) && !/isPilot\(\)/.test(prem), prem);
  const setup = readFileSync(APP + "/STRIPE_SETUP.md", "utf8");
  const cl = readFileSync(APP + "/lib/caseload.ts", "utf8");
  ok("STRIPE_SETUP.md names the caseload portal env var lib/caseload.ts reads, and says the configuration cancels at period end",
    /STRIPE_PORTAL_CONFIG_CASELOAD/.test(setup) && /process\.env\.STRIPE_PORTAL_CONFIG_CASELOAD/.test(cl) &&
    /created|creates/.test(setup) && /mode: "at_period_end"/.test(cl));
}

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
