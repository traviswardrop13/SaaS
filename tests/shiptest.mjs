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
  // THE ROOT IS THE FREE-GIFT OPT-IN (Travis, 17 Nov 2026): the ad lands on
  // packet.html, which hands the clinician to the landing page's plans.
  const optin = readFileSync(APP + "/public/packet.html", "utf8");
  ok("/ serves the free-gift opt-in",
    /source:\s*"\/"\s*,\s*destination:\s*"\/packet\.html"/.test(code),
    "the ad points at the root; the root has to be the page the ad promised");
  ok("…as a rewrite, so the URL stays speaksona.com", !/redirects\(\)[\s\S]*packet\.html/.test(code));
  ok("…which says it is the root, while the landing page keeps its own URL",
    /rel="canonical" href="https:\/\/speaksona\.com\/"/.test(optin) && /rel="canonical" href="https:\/\/speaksona\.com\/for-slps"/.test(slps) &&
    /source:\s*"\/for-slps"\s*,\s*destination:\s*"\/for-slps\.html"/.test(code));
  ok("…and the opt-in hands the clinician to the plans", /\/for-slps\?packet=1/.test(optin) && /#pricing/.test(optin) && /id="pricing"/.test(slps));
  ok("the opt-in's shared card is its own image, at the size it claims", /og:image" content="https:\/\/speaksona\.com\/og-packet\.png"/.test(optin) &&
    existsSync(APP + "/public/og-packet.png") && readFileSync(APP + "/public/og-packet.png").readUInt32BE(16) === 1200 && readFileSync(APP + "/public/og-packet.png").readUInt32BE(20) === 630);

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

// ── what the landing page promises: the two plans (17 Nov 2026) ──
// The dashboard is part of the Solo and Clinic plans now, so the page that
// said "Free for you" says what the trial is, what is still free for every
// family, and exactly what each plan buys. Every figure is lib/caseload.ts's.
{
  const slps = readFileSync(APP + "/public/for-slps.html", "utf8");
  const shown = slps.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
  const lib = readFileSync(APP + "/lib/caseload.ts", "utf8");
  const k = (name) => (lib.match(new RegExp(name + ' = "([^"]+)"')) || [])[1];
  const n = (name) => Number((lib.match(new RegExp(name + " = (\\d+)")) || [])[1]);
  const SOLO = k("SOLO_PRICE"), CLINIC = k("CLINIC_PRICE"), SEATS = n("CLINIC_SEATS"), TRIAL = n("PLAN_TRIAL_DAYS");
  ok("the landing page no longer promises 'unlimited families' or anything 'forever'",
    !/unlimited|forever/i.test(shown), (shown.match(/[^.>]*(unlimited|forever)[^.<]*/i) || [""])[0]);
  ok("…never calls the dashboard free to a new clinician: the trial is how they try it",
    !/<b>Free for you<\/b>|Your dashboard is free|Get Sona free|One email, no card/.test(shown) && /<b>14 days free<\/b>/.test(shown));
  ok("…and says what stays free for every family", /<b>Free for every family<\/b>/.test(shown) && /Daily practice and free games/.test(shown));
  ok("the hero is the same one-form hero, starting the trial", /<form class="signup" id="signup"/.test(shown) && /id="fGo" type="submit">Start free trial</.test(shown) &&
    !/class="planpick"|id="signbox"/.test(shown));
  ok("two plan cards, at lib/caseload.ts's prices, each starting the trial",
    !!SOLO && !!CLINIC && shown.includes("<b>" + SOLO + "</b>a month") && shown.includes("<b>" + CLINIC + "</b>a month") &&
    (shown.match(/Start 14-day free trial/g) || []).length === 2 && TRIAL === 14 && /Both start with 14 days free\./.test(shown));
  ok("…and each card's button carries its own price for the note it writes",
    slps.includes('data-plan="solo" data-price="' + SOLO + '"') && slps.includes('data-plan="clinic" data-price="' + CLINIC + '"'));
  ok("Clinic says how many clinicians, and that the owner sees totals, never a child",
    shown.includes("— up to " + SEATS + ".") && /Never a child's name or practice\./.test(shown));
  // Prices with cents are Solo's; Clinic is "$99", never "$99.00" — and the
  // family standard price ($99.99) must never be typed on this page.
  const figures = shown.match(/\$\d+(\.\d\d)?(?!\d)/g) || [];
  ok("every dollar figure on the landing page is a lib/caseload.ts plan price",
    figures.length > 0 && figures.every((f) => f === SOLO || f === CLINIC), figures.join(","));
  ok("…and never quotes a family price: only /api/charter may print it, and only while families pay", !/\$59\.99|\$99\.99|\$9\.99/.test(shown) &&
    /fetch\("\/api\/charter"\)/.test(slps) && /j\.free\) fig = ""/.test(slps));
  ok("…answers 'What does it cost?' with both plans, the trial, monthly renewal and cancel-anytime",
    /What does it cost\?/.test(shown) && shown.includes("Solo is " + SOLO + " a month for one clinician") &&
    shown.includes("Clinic is " + CLINIC + " a month for up to " + SEATS + " clinicians") &&
    /charged on day 15 unless you cancel first, then monthly until you cancel/.test(shown));
  ok("…and that the clinician never earns on their own caseload", /You never earn anything on your own caseload/.test(shown));
  ok("…and tells clinicians who signed up under an older promise that it stands",
    /Signed up before these plans\? Your dashboard stays free, and if you were promised free for every family on your caseload, that promise stands\./.test(shown));
  ok("the storage answer names Stripe, and says who a parent's email is handed to and that Sona keeps no copy",
    /If you start a plan, Stripe takes the payment/.test(shown) &&
    /we hand it to Resend to deliver that one email[^.]*, and Sona keeps no copy: not stored, not logged, not added to any list\./.test(shown) &&
    !/keep it nowhere/.test(shown));
  ok("…and names Resend for every email it sends, not only sign-in", /emails via Resend/.test(shown) && !/sign-in emails via Resend/.test(shown));
  ok("the landing page links the Terms that now carry the plans", /href="\/terms"/.test(shown));
  const login = readFileSync(APP + "/public/slp-login.html", "utf8").replace(/<!--[\s\S]*?-->/g, "");
  ok("the sign-in page promises nothing 'forever', and no longer a free dashboard",
    !/forever/i.test(login) && !/Your dashboard is free/.test(login) && /Your first 14 days are free\./.test(login));
}

// ── the free gift: the opt-in and the packet it hands over (17 Nov 2026) ──
// WHAT A CHILD IS ASKED TO SAY IS RACHEL'S CALL. The packet adds no new
// clinical content: every word on it is a word already in the app's own word
// bank, at the same position. A word typed into the packet by hand fails here.
{
  const optin = readFileSync(APP + "/public/packet.html", "utf8");
  const shownO = optin.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
  ok("the opt-in asks for the clinician's own first name and email, and says the email joins the list",
    /id="fName"/.test(optin) && /id="fEmail"/.test(optin) && /We&rsquo;ll also send occasional tips from Rachel\. Unsubscribe anytime\./.test(optin));
  ok("…posts to /api/lead as a clinician, never anything about a child",
    /fetch\("\/api\/lead"/.test(optin) && /role: "slp"/.test(optin) && !/\b(child|kid|age)\s*:/.test(optin.slice(optin.indexOf("function go()"))));
  ok("…fires Lead only after the server took the email", (() => { const h = optin.slice(optin.indexOf("function go()")); const g = h.indexOf("if (!j || !j.ok)"), l = h.indexOf('sonaTrack("Lead")'); return g > 0 && l > g; })());
  ok("…offers a way past it without an email", /href="\/for-slps">No thanks — show me Sona →/.test(optin));
  ok("…and never claims a certification Rachel does not hold", !/\bCCC\b|board-certified|ASHA-certified|\bcertified\b/i.test(shownO));
  ok("the gift is not the dashboard: the opt-in never offers a free dashboard", !/dashboard/i.test(shownO));

  const pk = readFileSync(APP + "/public/home-practice-packet.html", "utf8");
  ok("the packet is not indexed (it is what the email buys)", /<meta name="robots" content="noindex" \/>/.test(pk));
  const src = readFileSync(APP + "/public/sona.js", "utf8");
  const a = src.indexOf("const WORDS = {"); let i = src.indexOf("{", a), d = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}") { d--; if (!d) break; } }
  const WORDS = new Function("return (" + src.slice(i, j + 1) + ")")();
  const bad = [];
  let pages = 0, words = 0;
  for (const m of pk.matchAll(/<section class="page sound" data-sound="([A-Z]+)">([\s\S]*?)<\/section>/g)) {
    pages++;
    const bank = WORDS[m[1]] || [];
    for (const c of m[2].matchAll(/<div class="col" data-pos="([a-z]+)">([\s\S]*?)<\/div>/g)) {
      for (const w of c[2].matchAll(/data-w="([^"]+)"/g)) {
        words++;
        if (!bank.some((x) => x.w === w[1] && x.pos === c[1])) bad.push(m[1] + "/" + c[1] + "/" + w[1]);
      }
    }
  }
  ok("every word in the packet is in the app's word bank, at the same sound and position", pages === 19 && words > 200 && bad.length === 0, pages + " pages, " + words + " words, off-bank: " + bad.join(","));
  ok("…single words only: no carrier phrase glued onto any of them", ![...pk.matchAll(/data-w="([^"]+)"/g)].some((w) => /\s/.test(w[1])));
  const guide = (pk.match(/<section class="page guide">([\s\S]*?)<\/section>/) || [])[1] || "";
  ok("the parent guide follows the app's rules: one word on its own, silence is not a try, end on a success, the clinician picks the sound",
    /Just the word on its own/.test(guide) && /staying quiet doesn't count/.test(guide) && /always finish on a word your child gets right/.test(guide) &&
    /Use the words your speech therapist circled/.test(guide));
  ok("…and carries the not-an-evaluation hedge with Rachel's byline, never a certification",
    /It is not an evaluation\. From Rachel, Sona&#39;s co-founder and a licensed pediatric speech-language pathologist\.|It is not an evaluation\. From Rachel, Sona's co-founder and a licensed pediatric speech-language pathologist\./.test(guide) &&
    !/\bCCC\b|certified/i.test(pk));
  ok("…and no score, grade or diagnosis anywhere in it", !/\b(score|grade|diagnos\w*|accuracy)\b/i.test(pk.replace(/<!--[\s\S]*?-->/g, "")));
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
