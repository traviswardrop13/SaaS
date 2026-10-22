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


// ── the root is the family page (Travis, 22 Oct 2026) ──
// "speaksona.com is only for parents. I don't want to target therapists at
// all." This reverses 22 Sep 2026, when / served the clinician page for the
// SLP ad. Every pin here is one way the root could quietly go back to
// speaking to clinicians, or a search engine could be told it still does.
{
  const fam = readFileSync(APP + "/app/families/page.tsx", "utf8");
  const famShown = fam.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  const slps = readFileSync(APP + "/public/for-slps.html", "utf8");

  // A REWRITE, NOT A REDIRECT: the address bar stays speaksona.com, and two
  // URLs serving one page would split whatever ranking it earns.
  ok("/ serves the family page", /source:\s*"\/"\s*,\s*destination:\s*"\/families"/.test(code),
    "speaksona.com is for parents; the root has to be their page");
  ok("…never the clinician page", !/source:\s*"\/"\s*,\s*destination:\s*"\/for-slps/.test(code));
  // Only the redirects() body: the headers() and rewrites() lists both carry
  // a source "/" of their own, and either quote style is a redirect.
  const redirBody = (code.match(/redirects\s*\(\)\s*\{([\s\S]*?)\n  \},?/) || [])[1] || "";
  ok("…as a rewrite, so the URL stays speaksona.com", !/source:\s*["'`]\/["'`]/.test(redirBody));
  ok("…and the family page says the root is its URL", /alternates: \{ canonical: "https:\/\/speaksona\.com\/" \}/.test(fam));
  // The iOS shell loads this same root. Before 22 Sep this page was the root
  // and its inline guard was what sent the shell into the app; it has to
  // still be there and still be the first thing in <main>. nativefamilytest
  // runs the guard itself.
  ok("…and sends the native shell straight into the app, before anything renders",
    /<main[^>]*>\s*\{\/\*[^*]*\*\/\}\s*<script\s+dangerouslySetInnerHTML=\{\{\s*__html:\s*`if\(typeof window!=="undefined"&&window\.Capacitor\)/.test(fam));

  // Nothing a parent reads, and nothing a crawler is handed, points at the
  // clinician side.
  const CLIN = /for-slps|slp-login|slp\.html|\/slp(?![\w-])/;
  ok("the family page never links to the clinician pages", !CLIN.test(famShown),
    (famShown.match(/.{0,60}(for-slps|slp-login|slp\.html|\/slp(?![\w-])).{0,20}/) || [])[0]);
  // …nor does any other page a parent or a crawler reaches. Only the
  // clinician page itself: settings.html links to the dashboard from the
  // clinician-profile card on purpose (the door that stayed), so the sweep is
  // for the marketing page, the one thing "not targeting therapists" removed.
  const CLIN_PAGES = new Set(["for-slps.html", "slp.html", "slp-login.html"]);
  const linkers = pages.filter((f) => !CLIN_PAGES.has(f) && /href="\/for-slps/.test(readFileSync(APP + "/public/" + f, "utf8")))
    .concat(["app/terms/page.tsx", "app/support/page.tsx", "app/privacy/page.tsx", "app/layout.tsx"]
      .filter((f) => /href="\/for-slps/.test(readFileSync(APP + "/" + f, "utf8"))));
  ok("…and no other family page links to the clinician page", linkers.length === 0, linkers.join(", "));
  ok("…and never claims a certification Rachel does not hold", !/\bCCC\b|board-certified|ASHA-certified|\bcertified\b/i.test(famShown));
  ok("the clinician page is noindex now", /<meta name="robots" content="noindex" \/>/.test(slps));
  ok("…and no longer tells search engines it is the root",
    !/rel="canonical" href="https:\/\/speaksona\.com\/"/.test(slps) && !/og:url" content="https:\/\/speaksona\.com\/"/.test(slps));
  const sitemap = readFileSync(APP + "/app/sitemap.ts", "utf8");
  const urls = sitemap.match(/url: `[^`]*`/g) || [];
  ok("the sitemap lists the root", urls.some((u) => u === "url: `${BASE}/`"));
  ok("…and no clinician, private or duplicate page",
    urls.length > 0 && !urls.some((u) => /slp|join|leads|founders|families/.test(u)), urls.join(", "));
  // A crawler that is disallowed never fetches the page, so it never sees
  // the noindex — and Google can list a blocked URL anyway, from links.
  const robots = readFileSync(APP + "/app/robots.ts", "utf8").replace(/^\s*\/\/.*$/gm, "");
  ok("robots does not block the noindex pages, so crawlers can read the noindex", !/slp|join|leads|founders/.test(robots));
  ok("…and names the AI assistants' crawlers, so a parent asking one can hear about Sona",
    /"GPTBot"/.test(robots) && /"OAI-SearchBot"/.test(robots) && /"ClaudeBot"/.test(robots) && /"PerplexityBot"/.test(robots));
  const llms = readFileSync(APP + "/app/llms.txt/route.ts", "utf8");
  // Everything the route can send: the body AND the cost lines it splices in
  // — every string literal, with the comments stripped.
  const llmsBody = llms.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok("llms.txt speaks to parents only — no clinician dashboard, caseload or SLP link",
    /const body = `/.test(llmsBody) && !/dashboard|caseload|for-slps|Caseload Premium|For speech therapists/i.test(llmsBody));
  ok("…its price line reads the switch rather than being typed in", /FREE_MODE\s*\?/.test(llms) && !/\$\d/.test(llmsBody));
  ok("…and never claims a certification Rachel does not hold", !/\bCCC\b|board-certified|ASHA-certified|\bcertified\b/i.test(llmsBody));

  // THE CARD A LINK TO speaksona.com SHOWS when a parent pastes it into a
  // group chat. The old root's card came from for-slps.html and said "for
  // SLPs"; a link with no card is a grey box.
  for (const tag of ["openGraph", "twitter", "summary_large_image"]) {
    ok(`the family page declares ${tag}`, fam.includes(tag));
  }
  ok("…with an absolute image URL, because a scraper resolves it against nothing",
    /images: \[\{ url: "https:\/\/speaksona\.com\/og-families\.png", width: 1200, height: 630/.test(fam));
  const ogf = APP + "/public/og-families.png";
  ok("…and that image is actually in the repo", existsSync(ogf));
  if (existsSync(ogf)) {
    const b = readFileSync(ogf);
    ok("…at the dimensions the tags promise", b.readUInt32BE(16) === 1200 && b.readUInt32BE(20) === 630, b.readUInt32BE(16) + "x" + b.readUInt32BE(20));
  }
}

// ── what a shared link to the clinician page looks like ──
// Clinicians who already use Sona still share /for-slps with each other,
// even though nothing on the family side links to it any more.
{
  const slps = readFileSync(APP + "/public/for-slps.html", "utf8");
  // A link with no card is a grey box. This page is static and inherits
  // nothing from app/layout.tsx, which is exactly how it lost them once.
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

  // ONE PROMISE, EVERYWHERE IT IS READ (24 Sep 2026): the headline, the tab
  // title and the shared-link card must say the same thing, or a link pasted
  // into a Facebook group sells a page that isn't there.
  ok("the headline, the tab title and the shared card all say 'Speech practice kids actually want to do'",
    /<h1>Speech practice kids actually want to do\.<\/h1>/.test(slps) &&
    /<title>Speech practice kids actually want to do — Sona for SLPs<\/title>/.test(slps) &&
    /og:title" content="Speech practice kids actually want to do\."/.test(slps) &&
    /twitter:title" content="Speech practice kids actually want to do\."/.test(slps) &&
    !/actually practiced at home|Never plan speech homework/.test(slps));
  ok("…and the lede keeps Rachel's point: nothing to plan", /Nothing to plan, and you see who practiced\./.test(slps));

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
  // TWO LINKS, NOTHING ELSE (Travis, 24 Sep 2026): the header is For parents
  // and Sign in. How it works and Privacy are on the page below the fold.
  ok("…and the header carries only For parents and Sign in", (header.match(/<a\b/g) || []).length === 3 && !/How it works|>Privacy</.test(header));
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
