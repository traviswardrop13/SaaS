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
// THE ROOT IS FOR PARENTS (Travis, 26 Sep 2026: "change it to target parents
// and caregivers only. not slps"). The clinician page it replaced keeps its
// own address, /for-slps, and its own card.
{
  const parents = readFileSync(APP + "/public/parents.html", "utf8");
  const slps = readFileSync(APP + "/public/for-slps.html", "utf8");

  // A REWRITE, NOT A REDIRECT. Cold paid traffic pays for the extra hop, and
  // two URLs serving one page splits whatever ranking the page earns.
  ok("/ serves the parent page",
    /source:\s*"\/"\s*,\s*destination:\s*"\/parents\.html"/.test(code),
    "the ad points at the root; the root has to be the page the ad promised");
  ok("…as a rewrite, so the URL stays speaksona.com", !/redirects\(\)[\s\S]*parents\.html/.test(code));
  ok("…and the page says which URL it is", /rel="canonical" href="https:\/\/speaksona\.com\/"/.test(parents));
  ok("the clinician page stays at /for-slps, and says that is its address",
    /source:\s*"\/for-slps"\s*,\s*destination:\s*"\/for-slps\.html"/.test(code) &&
    /rel="canonical" href="https:\/\/speaksona\.com\/for-slps"/.test(slps) && /og:url" content="https:\/\/speaksona\.com\/for-slps"/.test(slps) &&
    !/rel="canonical" href="https:\/\/speaksona\.com\/"/.test(slps));
  ok("…and a deploy shows on /for-slps at once, like the root", /source: "\/for-slps", headers: noStore/.test(code));

  // A LINK WITH NO CARD IS A GREY BOX. Both pages are static and inherit
  // nothing from app/layout.tsx, so each carries its own.
  for (const [name, page, img] of [["the parent page", parents, "og-parents.png"], ["the clinician page", slps, "og-slp.png"]]) {
    for (const tag of ["og:title", "og:description", "og:image", "og:url", "twitter:card"]) {
      ok(`${name}: a shared link carries ${tag}`, new RegExp('(property|name)="' + tag + '"').test(page));
    }
    ok(`${name}: the card's image is an absolute URL, because a scraper resolves it against nothing`,
      new RegExp('og:image" content="https://speaksona\\.com/' + img.replace(".", "\\.") + '"').test(page));
    // A CARD POINTING AT A 404 IS WORSE THAN NO CARD.
    const og = APP + "/public/" + img;
    ok(`${name}: …and that image is actually in the repo`, existsSync(og));
    if (existsSync(og)) {
      const b = readFileSync(og);
      const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
      ok(`${name}: …at the dimensions the tags promise`, w === 1200 && h === 630, w + "x" + h);
      ok(`${name}: …declared, so the scraper does not have to fetch it to lay the card out`,
        /og:image:width" content="1200"/.test(page) && /og:image:height" content="630"/.test(page));
    }
    ok(`${name} declares an icon, so the tab is not blank`, /rel="icon"/.test(page) && /rel="apple-touch-icon"/.test(page));
    ok(`${name} never claims a certification Rachel does not hold`,
      !/\bCCC\b|board-certified|ASHA-certified|\bcertified\b|fully licensed/i.test(page));
  }

  // ONE PROMISE, EVERYWHERE IT IS READ: the parent ads' own headline, on the
  // page, the tab and the card, so the page says what the ad said.
  ok("the parent page's headline, tab title and shared card all say 'Speech practice kids ask for'",
    /<h1>Speech practice kids ask for\.<\/h1>/.test(parents) &&
    /<title>Speech practice kids ask for — Sona<\/title>/.test(parents) &&
    /og:title" content="Speech practice kids ask for\."/.test(parents) &&
    /twitter:title" content="Speech practice kids ask for\."/.test(parents));
  ok("…and it names Rachel's credential in the settled words", /a licensed pediatric speech-language pathologist/.test(parents));
  // 29 Sep 2026: Travis asked for "MS, CF-SLP" wherever Rachel is presented as an SLP — her byline on the parent page carries it.
  ok("…and her byline carries her credentials: Rachel Wardrop, MS, CF-SLP", /Rachel Wardrop, MS, CF-SLP &middot; Co-founder/.test(parents));

  // A PARENT PAGE HAS NO SIGN IN. A speech therapist finds their own page,
  // and its Sign in, from the footer.
  const pHeader = (parents.match(/<header[\s\S]*?<\/header>/) || [""])[0].replace(/<!--[\s\S]*?-->/g, "");
  const pShown = parents.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  ok("the parent page's header: the logo and one Start free, no Sign in",
    (pHeader.match(/<a\b/g) || []).length === 1 && /<button class="btn sm" id="topGo" type="button">Start free<\/button>/.test(pHeader) && !/Sign in|slp-login/.test(pHeader));
  ok("…and its footer points a speech therapist at /for-slps", /<footer[\s\S]*href="\/for-slps"[\s\S]*<\/footer>/.test(parents));
  const pForm = (parents.match(/<form class="signup" id="signup"[\s\S]*?<\/form>/) || [""])[0];
  ok("the parent page's one form: an email, one button, no 'I'm a…' and no name",
    /id="fEmail" type="email"/.test(pForm) && (pForm.match(/<button\b/g) || []).length === 1 && (pForm.match(/<input\b/g) || []).length === 1 &&
    !/<select/.test(pForm) && !/name/i.test(pForm.replace(/aria-label|class="|autocomplete="email"/g, "")) &&
    (parents.match(/<form\b/g) || []).length === 1);
  ok("…it posts as a parent, and asks for nothing about a child",
    /JSON\.stringify\(Object\.assign\(\{ email: email, role: "parent", source: src, welcome: !APP_READY \}, attrib\)\)/.test(parents));
  ok("…and both other Start free buttons bring the visitor back to it",
    /\$\("topGo"\)\.onclick = toForm;/.test(parents) && /\$\("finalGo"\)\.onclick = toForm;/.test(parents) &&
    (pShown.match(/>Start free</g) || []).length === 3);
  ok("…with nothing under the form's button: no list line, no 'Next' hint, no 'No card' note",
    !/class="consent"|id="mNext"|class="hnote"/.test(pShown));
  ok("the parent page ends at the App Store, or at the web app on Android",
    /var APP_STORE = "https:\/\/apps\.apple\.com\/us\/app\/sona-speech\/id6785755867";/.test(parents) &&
    /var NEXT_URL = android \? "\/onboarding\.html" : APP_STORE;/.test(parents));

  // NO PRICE ON THE PARENT PAGE. The App Store sets the iPhone price and the
  // family price moves with the charter count; the page reads the switch from
  // /api/charter for its cost answer and never prints a figure.
  ok("the parent page never quotes a dollar figure", !/\$\s?\d/.test(pShown) && !/\$\s?\d/.test((parents.match(/<script>\s*\(function \(\) \{[\s\S]*<\/script>/) || [""])[0].replace(/\$\(/g, "")));
  ok("…and its cost answer reads the switch", /fetch\("\/api\/charter"\)/.test(parents) && /typeof j\.free !== "boolean"/.test(parents));

  // THE PICTURES SHOW THE APP AS IT IS. The ads' screens asked for STAR MODE
  // power-ups, removed on 24 Sep; those are painted out of the pictures, and
  // no word of them may come back in the copy.
  ok("the parent page never mentions the removed power-ups", !/golden keys|frenzy|star mode|power-?up/i.test(pShown));
  const srcs = [...new Set([...parents.matchAll(/(?:src|href)="(\/[^"#?]+\.(?:webp|png|jpg|svg|woff2|css))"/g)].map((m) => m[1]))];
  const missing = srcs.filter((u) => !existsSync(APP + "/public" + u));
  ok("every picture, font and stylesheet the parent page asks for is in the repo", srcs.length > 25 && missing.length === 0, missing.join(", "));

  // THE COUNTS ARE THE CATALOG'S. The game count is every game Home opens,
  // never one it shows as Coming soon (the Say & Play games are parked until
  // each is rebuilt, Travis, 26 Sep 2026), the books are the bookshelf's
  // (below), and "19 speech sounds" is ALL_SOUNDS. Bring a game back and
  // this fails until the page says so.
  const sona = readFileSync(APP + "/public/sona.js", "utf8");
  const acts = sona.slice(sona.indexOf("const GAME_ACTS = {"), sona.indexOf("\n  };", sona.indexOf("const GAME_ACTS = {")));
  const all = [...acts.matchAll(/^\s{4}(\w+):\s*\{ name: "([^"]+)"([^\n]*)/gm)];
  const games = all.filter((m) => !/comingSoon: true/.test(m[3])), parkedGames = all.filter((m) => /comingSoon: true/.test(m[3]));
  // A drawn book is a folder with a cover.svg. /assets/books/painted/ holds the
  // six-page books' painted pictures (29 Sep 2026), and is not a book.
  const books = (readFileSync(APP + "/public/library.html", "utf8").match(/\/assets\/books\/[a-z-]+\/cover\.svg/g) || []).filter((v, i, a) => a.indexOf(v) === i);
  const sounds = JSON.parse((sona.match(/const ALL_SOUNDS = (\[[^\]]*\]);/) || [, "[]"])[1]);
  ok("the parent page's game count is the catalog's", games.length >= 6 && new RegExp('<span class="n">' + games.length + "</span> games\\.").test(parents), games.length);
  ok("…and its game strip shows every one of them", (parents.match(/<li class="tile g">/g) || []).length === games.length &&
    games.every((g) => parents.includes("<span>" + g[2].replace(/'/g, "&rsquo;") + "</span>")), games.map((g) => g[2]).filter((n) => !parents.includes("<span>" + n + "</span>")).join(", "));
  const gameTiles = (parents.match(/<li class="tile g">[\s\S]*?<\/li>/g) || []).join("");
  ok("…and not one game it shows as Coming soon", parkedGames.length > 0 && parkedGames.every((g) => !gameTiles.includes("<span>" + g[2].replace(/'/g, "&rsquo;") + "</span>") && !gameTiles.includes("/assets/games/" + g[1] + ".svg")),
    parkedGames.filter((g) => gameTiles.includes("<span>" + g[2] + "</span>")).map((g) => g[2]).join(", "));
  // THE BOOKS OPEN A FEW A WEEK (27 Sep 2026). The strip holds every
  // twelve-page book, each tile carrying the day the bookshelf opens it, and
  // the page counts only the open ones and tags the rest "Coming", worked out
  // on the phone from those days (landingtest plays it), so it is never
  // ahead of the shelf.
  const lib = readFileSync(APP + "/public/library.html", "utf8");
  const shelfDays = [...lib.matchAll(/\{ sound: "\w+", emoji: "[^"]*", (?:opens: "([\d-]+)", )?title: "[^"]+"[^\n]*\n\s*cover: "\/assets\/books\/([a-z-]+)\/cover\.svg"/g)].map((m) => ({ slug: m[2], opens: m[1] || "" }));
  const tileDay = (slug) => (parents.match(new RegExp('<li class="tile b"(?: data-opens="([\\d-]+)")?><img src="/assets/books/' + slug + '/cover\\.svg"')) || [null, null]);
  ok("its book strip is the bookshelf's, one book for every sound, each tile with the day the shelf opens it",
    books.length === sounds.length && shelfDays.length === books.length && (parents.match(/<li class="tile b"/g) || []).length === books.length &&
    shelfDays.every((b) => tileDay(b.slug)[0] && (tileDay(b.slug)[1] || "") === b.opens),
    shelfDays.filter((b) => !tileDay(b.slug)[0] || (tileDay(b.slug)[1] || "") !== b.opens).map((b) => b.slug).join(", "));
  ok("…and its book count is only the open ones, worked out from those days",
    /<span class="n" id="bookCount">\d+<\/span> picture books\./.test(parents) && /\$\("bookCount"\)/.test(parents) && !/a picture book for every sound/.test(parents));
  ok("…and the sounds answer names all " + sounds.length, new RegExp(sounds.length + " speech sounds: P, B, M, N, T, D, K, G, F, V, S, Z, SH, CH, J, L, R, and both TH sounds").test(pShown));

  // THE CLINICIAN PAGE, AT /for-slps, is the page it was.
  ok("the clinician page's headline, tab title and shared card all say 'Speech practice kids actually want to do'",
    /<h1>Speech practice kids actually want to do\.<\/h1>/.test(slps) &&
    // "— Sona", not "— Sona for SLPs" (25 Sep 2026): the page speaks to
    // parents and SLPs alike.
    /<title>Speech practice kids actually want to do — Sona<\/title>/.test(slps) &&
    /og:title" content="Speech practice kids actually want to do\."/.test(slps) &&
    /twitter:title" content="Speech practice kids actually want to do\."/.test(slps) &&
    !/actually practiced at home|Never plan speech homework/.test(slps));
  ok("…and the lede keeps Rachel's point: nothing to plan", /Nothing to plan, and you see who practiced\./.test(slps));

  // JUST SIGN IN (Travis, 26 Sep 2026: "get rid of for parents").
  const header = (slps.match(/<header>[\s\S]*?<\/header>/) || [""])[0];
  ok("the clinician page's header carries only Sign in: no For parents, How it works or Privacy",
    (header.match(/<a\b/g) || []).length === 2 && /<a class="signin" href="\/slp-login\.html">Sign in<\/a>/.test(header) &&
    !/For parents|forParents|How it works|>Privacy</.test(header) && !/forParents/.test(slps));
  ok("the form ends at the App Store, or at the web app on Android",
    /var APP_STORE = "https:\/\/apps\.apple\.com\/us\/app\/sona-speech\/id6785755867";/.test(slps) &&
    /var NEXT_URL = android \? "\/onboarding\.html" : APP_STORE;/.test(slps));

  // AS SIMPLE AS IT GETS (Travis, 25 Sep 2026): on the page itself, an email
  // and "I'm a…", one button. No name box of any kind, no pop-up, and one
  // form, so there is no second door to get out of step with it.
  const form = (slps.match(/<form class="signup" id="signup"[\s\S]*?<\/form>/) || [""])[0];
  ok("one form: an email, 'I'm a…', one button, and no name",
    /id="fEmail" type="email"/.test(form) && /<select id="fRole"/.test(form) && (form.match(/<button\b/g) || []).length === 1 &&
    (form.match(/<input\b/g) || []).length === 1 && !/name/i.test(form.replace(/aria-label|class="|autocomplete="email"/g, "")) &&
    (slps.match(/<form\b/g) || []).length === 1 && !/id="startModal"/.test(slps));
  ok("…and the answers are Parent or caregiver, Speech therapist (SLP or SLPA), Other",
    /<option value="parent">Parent or caregiver<\/option>/.test(form) &&
    /<option value="slp">Speech therapist \(SLP or SLPA\)<\/option>/.test(form) && /<option value="other">Other<\/option>/.test(form));
  ok("the closing Start free brings the visitor back to that form",
    /\$\("finalGo"\)\.onclick = function \(\) \{ toForm\(""\); \};/.test(slps) &&
    (slps.replace(/<!--[\s\S]*?-->/g, "").match(/>Start free</g) || []).length === 2);
  // IS THE APP READY? One switch, three copies, like FREE_MODE (25 Sep 2026):
  // lib/launch.ts's and each page's, and the same launch note in all three.
  {
    const launch = readFileSync(APP + "/lib/launch.ts", "utf8");
    const libReady = (launch.match(/export const APP_READY = (true|false);/) || [])[1];
    const libNote = (launch.match(/export const LAUNCH_NOTE = "([^"]+)";/) || [])[1];
    for (const [name, page] of [["the parent page", parents], ["the clinician page", slps]]) {
      const pageReady = (page.match(/var APP_READY = (true|false);/) || [])[1];
      const pageNote = (page.match(/var LAUNCH_NOTE = "([^"]+)";/) || [])[1];
      ok(name + " and lib/launch.ts agree on whether the app is ready", !!pageReady && pageReady === libReady, pageReady + " vs " + libReady);
      ok("…and say the same launch note", !!pageNote && pageNote === libNote, pageNote + " | " + libNote);
    }
  }
  // BACK TO ECHO AND THE CASELOAD CARD (Travis, 25 Sep 2026), after one
  // afternoon with his App Store image there instead.
  const heroR = (slps.match(/<div class="hero-r"[\s\S]*?<\/section>/) || [""])[0];
  ok("the clinician page's hero shows Echo and the caseload card, made-up first names only",
    /<img class="mascot" src="\/echo\.png"/.test(heroR) && /Your caseload this week/.test(heroR) &&
    /Maya/.test(heroR) && !/hero-practice-play/.test(slps) && (slps.match(/Your caseload this week/g) || []).length === 1);
  // NOTHING UNDER THE BUTTON (Travis, 25 Sep 2026: "get rid of this text").
  ok("…and nothing under the form's button: no list line, no 'Next' hint, no 'No card' note",
    !/class="consent"|id="mNext"|class="hnote"/.test(slps.replace(/<!--[\s\S]*?-->/g, "")));
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
    // "Free for SLPs", not "Free for you" (25 Sep 2026): "you" is anyone now.
    /<b>Free for SLPs<\/b>/.test(shown) && /<b>Free for every family<\/b>/.test(shown) && /Daily practice and free games/.test(shown));
  ok("…answers 'What does it cost?'",
    /What does it cost\?/.test(shown) && /Premium is optional, in two steps\. Sona Premium for you is \$59\.99 a year \(under \$5 a month\): every game on your own phone or tablet\. Add your caseload for \$59\.99 a year more \(under \$5 a month\), and every family who joins through your link gets every game/.test(shown));
  ok("…with the plan's real terms: no trial, yearly, cancel anytime, families keep it to the end of the paid year",
    /there is no trial, each renews yearly, and you can cancel anytime/.test(shown) && /your families keep Premium to the end of the year you paid for/.test(shown));
  ok("…and that the clinician never earns on their own caseload", /You never earn anything on your own caseload\./.test(shown));
  ok("…and tells a clinician who signed up under the old promise that it stands",
    /Signed up before 24 September 2026\? You and your caseload already have it, free/.test(shown));
  // The family price moves with the charter count, and only /api/charter may
  // print it. A static page that typed it would be right until spot fifty.
  // 29 Sep 2026: the clinician's two prices are also $59.99, so the check is
  // on what a figure is attached to, not the digits: no $99.99 anywhere, and
  // no figure in the sentence about families buying for themselves.
  ok("…and never quotes a family price", !/\$99\.99/.test(shown) && /Families you don't cover can buy Premium themselves\./.test(shown) && !/can buy Premium themselves[^.]*\$/.test(shown));
  // This page is static and cannot import lib/caseload.ts, so the one copy of
  // the caseload price it has to carry is pinned to the library's.
  const lib = readFileSync(APP + "/lib/caseload.ts", "utf8");
  const price = (lib.match(/\bCASELOAD_PRICE = "([^"]+)"/) || [])[1];
  const perMonth = (lib.match(/\bCASELOAD_PER_MONTH = "([^"]+)"/) || [])[1];
  const selfPrice = (lib.match(/\bSELF_PRICE = "([^"]+)"/) || [])[1];
  const selfPerMonth = (lib.match(/\bSELF_PER_MONTH = "([^"]+)"/) || [])[1];
  // (a price has cents; "under $5 a month" is the reading, checked next)
  const figures = shown.match(/\$\d+\.\d\d/g) || [];
  ok("every dollar figure on the landing page is one of lib/caseload.ts's clinician prices",
    !!price && !!selfPrice && figures.length > 0 && figures.every((f) => f === price || f === selfPrice), price + " / " + selfPrice + " vs " + figures.join(","));
  ok("…and its per-month readings are the library's, never a rounded $4.99", !!perMonth && !!selfPerMonth &&
    shown.includes("(" + perMonth + ")") && shown.includes("(" + selfPerMonth + ")") && !/\$4\.99|\$6\.6\d/.test(shown));
  // REWRITTEN 24 Sep 2026. This pinned "we use it once … and keep it
  // nowhere", and Resend only for "sign-in emails". The parent's address and
  // the link do reach Resend, which keeps delivery logs; privacy.html said so
  // and this page contradicted it, in the answer written for an IT reviewer.
  ok("the storage answer names Stripe, and says who a parent's email is handed to and that Sona keeps no copy",
    /If you buy Premium, Stripe takes the payment/.test(shown) &&
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
  for (const rel of ["public/parents.html", "public/for-slps.html", "public/slp.html", "public/privacy.html", "app/terms/page.tsx", "app/families/page.tsx"]) {
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

// ── Rachel's credentials, everywhere she is presented as an SLP (29 Sep 2026) ──
// Travis: "make sure that it says everywhere that you're talking about her
// being a SLP … that she's a CF. So like MS, CF-SLP." She holds an Idaho CF
// licence and a master's and is in her fellowship year, so "Rachel, MS,
// CF-SLP" is exactly true. Wherever her name is followed by a description of
// her as a clinician ("Rachel — licensed…", "Rachel, a licensed…", "Rachel
// Wardrop, MS ·", "Rachel (pediatric SLP)"), it must be that post-nominal.
// And no page or app surface may claim more: no CCC, no "certified".
// Since the follow-up the same day, the anonymous line is gone too: copy that
// presents Sona's own SLP without her name ("Built with a licensed SLP", "our
// SLP", "reviewed by a pediatric SLP") names her instead, and a page that
// pairs Rachel with "SLP" or "speech-language pathologist" in one sentence
// carries "MS, CF-SLP" somewhere on it. A child's OWN therapist ("your SLP",
// "your child's speech-language pathologist") is someone else, and is not
// matched.
{
  const files = ["public/manifest.webmanifest"];
  for (const f of readdirSync(APP + "/public")) if (f.endsWith(".html")) files.push("public/" + f);
  const walk = (d) => { for (const e of readdirSync(APP + "/" + d, { withFileTypes: true })) {
    if (e.isDirectory()) walk(d + "/" + e.name); else if (/\.tsx?$/.test(e.name)) files.push(d + "/" + e.name); } };
  walk("app"); walk("lib");
  const visible = (f) => readFileSync(APP + "/" + f, "utf8")
    .replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const bare = [], claims = [], anon = [], unpaired = [];
  for (const f of files) {
    const t = visible(f);
    for (const m of t.match(/Rachel(?: Wardrop)?(?!, MS, CF-SLP)[^<.\n]{0,6}(?:[Ll]icensed|[Pp]ediatric|speech-language|SLP|MS\b)/g) || []) bare.push(f + ": " + m);
    for (const m of t.match(/\bCCC\b|board.certified|ASHA.certified|\bcertified\b|fully licen[sc]ed/gi) || []) claims.push(f + ": " + m);
    for (const m of t.match(/\b(?:built|made|designed|shaped|reviewed|created|developed)\s+(?:with|by)\s+(?:a|an|our)\s+(?:licensed\s+)?(?:pediatric\s+)?(?:SLP|speech-language pathologist)\b|\bour SLP\b/gi) || []) anon.push(f + ": " + m);
    if (/Rachel[^<>.]{0,160}?(?:speech-language pathologist|\bSLP\b)|(?:speech-language pathologist|\bSLP\b)[^<>.]{0,160}?Rachel/.test(t) && !/MS, CF-SLP/.test(t)) unpaired.push(f);
  }
  ok("every place Rachel is named as a clinician says 'Rachel, MS, CF-SLP'", bare.length === 0, bare.join(" | "));
  ok("…and no page or app surface claims a certification she does not hold", claims.length === 0, claims.join(" | "));
  ok("…and no line presents Sona's own SLP without naming her ('Built with a licensed SLP', 'our SLP')", anon.length === 0, anon.join(" | "));
  ok("…and every page that calls Rachel an SLP carries 'MS, CF-SLP'", unpaired.length === 0, unpaired.join(", "));
  const carry = ["parents", "subscribe", "trial", "progress", "talk", "slp"]
    .filter((n) => !/Rachel(?: Wardrop)?, MS, CF-SLP/.test(visible("public/" + n + ".html")));
  ok("…and the pages that introduce her all carry it", carry.length === 0, carry.join(", "));
}

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
