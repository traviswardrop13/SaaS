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
// The buddy helpers, the four play engines and the Trophy Road's sheet carry
// methods pages call (a buddy to draw, a level to play): a stale edge copy
// beside a fresh page is the case the header exists to prevent.
for (const f of ["crafted-buddies.js", "hoops.js", "soccer.js", "dino.js", "bubbles.js", "crafted-road.css"])
  ok("/" + f + " is covered too", new RegExp('source: "/' + f.replace(/\./g, "\\.") + '", headers: noStore').test(code),
    "a page calls its new methods; an old cached copy would be missing them");
// every page in public/ exists to be covered — the glob above is what covers them
const pages = readdirSync(APP + "/public").filter((f) => f.endsWith(".html"));
ok("there are pages for the glob to cover", pages.length > 20, String(pages.length));

// ── the daily story (STORY1, 22 Oct 2026): what its pages call, and what they show ──
// The player calls SayIt.line and reads window.SonaAdventures; each story game
// hands the engine its play script by name. A stale edge copy of any of them
// beside a fresh page is the case the header exists to prevent; a stale voice
// manifest would send a re-worded line to the live voice for good.
{
  for (const f of ["lighthouse.js", "windup.js", "bridge.js", "lighthouse.css", "windup.css", "bridge.css", "adventures.js", "crafted-adventure.css", "arcade-sayit.js", "assets/adventure/voice/manifest.js"])
    ok("/" + f + " revalidates on every load (the daily story)", new RegExp('source: "/' + f.replace(/[./]/g, "\\$&") + '", headers: noStore').test(code),
      "a story page calls into it by name; an old cached copy would be missing what it calls");
  ok("/daily-adventures/* (Days 4-14's games, their words and the shell) revalidates on every load", /source: "\/daily-adventures\/:path\*", headers: noStore/.test(code),
    "story-game.html puts a day's game in by name; an old cached copy beside a fresh page never starts");

  // Every picture the story shows is on disk: a scene names its picture,
  // /assets/adventure/<story>/<art>.webp; Home and the player's start card
  // show /assets/crafted/home-<hero>.webp; the Arcade door home-arcade.webp.
  // A missing picture is the story's wash with the caption on it, never a
  // blank page, but it is a missing page of the story all the same.
  const vm = await import("node:vm");
  const box = { window: {} };
  vm.runInNewContext(readFileSync(APP + "/public/adventures.js", "utf8"), box);
  const A = box.window.SonaAdventures || {};
  const sonaSrc = readFileSync(APP + "/public/sona.js", "utf8");
  const daysSrc = (sonaSrc.match(/const STORY_DAYS = \[([\s\S]*?)\n  \];/) || ["", ""])[1];
  const days = [...daysSrc.matchAll(/\{ id: "([a-z]+)", game: "([a-z]+)",(?: controller: "([a-z]+)",)? page: "([^"]+)", hero: "([a-z]+)"/g)].map((m) => ({ id: m[1], game: m[2], controller: m[3] || null, page: m[4], hero: m[5] }));
  ok("sona.js's STORY_DAYS lists the stories, and adventures.js holds the scenes of exactly those", days.length >= 1 && days.map((d) => d.id).sort().join() === Object.keys(A).sort().join(),
    "STORY_DAYS: " + days.map((d) => d.id).join() + " / adventures.js: " + Object.keys(A).join());
  const lost = [];
  for (const [id, story] of Object.entries(A)) for (const sc of [...(story.intro || []), ...(story.ending || [])]) {
    const f = "public/assets/adventure/" + id + "/" + sc.art + ".webp";
    if (!/^[a-z0-9-]+$/.test(String(sc.art)) || !existsSync(APP + "/" + f)) lost.push(f);
  }
  const scenes = Object.values(A).reduce((n, s) => n + (s.intro || []).length + (s.ending || []).length, 0);
  ok("every picture adventures.js names is on disk (" + scenes + " scenes)", scenes > 0 && lost.length === 0, lost.join(", "));
  const homes = days.map((d) => "public/assets/crafted/home-" + d.hero + ".webp").concat(["public/assets/crafted/home-arcade.webp"]).filter((f) => !existsSync(APP + "/" + f));
  ok("…and so is each story's Home picture, and the Arcade door's", homes.length === 0, homes.join(", "));
  // Days 1-3: a page of their own; Days 4-14: the one shared page and their game's two files
  const noPage = days.filter((d) => d.controller
    ? d.page !== "/story-game.html?story=" + d.id || !existsSync(APP + "/public/story-game.html") || !existsSync(APP + "/public/daily-adventures/" + d.controller + ".js") || !existsSync(APP + "/public/daily-adventures/" + d.controller + ".css")
    : d.page !== "/arcade-" + d.game + ".html" || !existsSync(APP + "/public" + d.page)).map((d) => d.page);
  ok("…and each story's game page", days.length > 0 && noPage.length === 0, noPage.join(", "));

  // THE RECORDED VOICE (P8). /assets/adventure/voice/manifest.js may be
  // missing: then every line is the live voice. When it is there, every file
  // it lists is on disk, is named by the hash the player computes (FNV-1a,
  // 32-bit, of TTS_CACHE_VERSION + "|" + the line), and carries a line the
  // story still says; and no recording sits in the folder unlisted.
  const lines = new Set();
  for (const story of Object.values(A)) for (const sc of [...(story.intro || []), ...(story.ending || [])]) {
    if (typeof sc.line === "string") lines.add(sc.line); else if (sc.line) { lines.add(sc.line.big); if (sc.line.little) lines.add(sc.line.little); }
  }
  const ver = (sonaSrc.match(/const TTS_CACHE_VERSION = "([^"]+)"/) || [])[1];
  const fnv = (t) => { let h = 0x811c9dc5; for (const b of Buffer.from(ver + "|" + t, "utf8")) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
  const player = readFileSync(APP + "/public/adventure.html", "utf8");
  ok("the player names a recorded line by that hash (TTS_CACHE_VERSION, FNV-1a)", !!ver && /h = 0x811c9dc5;/.test(player) && /\(\(S && S\.TTS_CACHE_VERSION\) \|\| "v9"\) \+ "\|" \+ text/.test(player) && /"\/assets\/adventure\/voice\/" \+ h \+ "\.mp3"/.test(player),
    "the player's voiceHash() moved: re-read this check");
  const VDIR = APP + "/public/assets/adventure/voice";
  if (!existsSync(VDIR + "/manifest.js")) {
    const strays = existsSync(VDIR) ? readdirSync(VDIR).filter((f) => f.endsWith(".mp3")) : [];
    ok("no recorded voice yet: every story line is the live voice, and no recording sits there unlisted", strays.length === 0, strays.join(", "));
  } else {
    const vbox = { window: {} };
    vm.runInNewContext(readFileSync(VDIR + "/manifest.js", "utf8"), vbox);
    const files = (vbox.window.SonaAdventureVoice || {}).files || {};
    const keys = Object.keys(files);
    const bad = keys.filter((h) => !/^[0-9a-f]{8}$/.test(h) || fnv(files[h]) !== h || !existsSync(VDIR + "/" + h + ".mp3"));
    ok("every recorded line in the manifest is on disk, under the hash of its own words", keys.length > 0 && bad.length === 0, bad.join(", "));
    const stale = keys.filter((h) => !lines.has(files[h]));
    ok("…and every one is a line the story still says (a re-worded line falls back to the live voice)", stale.length === 0, stale.map((h) => files[h]).join(" | "));
    const strays = readdirSync(VDIR).filter((f) => f.endsWith(".mp3") && !(f.slice(0, -4) in files));
    ok("…and no recording sits in the folder unlisted", strays.length === 0, strays.join(", "));
    const unrecorded = [...lines].filter((t) => !files[fnv(t)]);
    console.log("     (" + (lines.size - unrecorded.length) + " of " + lines.size + " story lines recorded" + (unrecorded.length ? "; the rest play in the live voice" : "") + ")");
  }
}


// ── the root, and what a shared link looks like ──
// The free clinician dashboard is introduced at the root. The family page has its own address.
{
  const parents = readFileSync(APP + "/public/parents.html", "utf8");
  const slps = readFileSync(APP + "/public/for-slps.html", "utf8");

  const rewrites = code.slice(code.indexOf("async rewrites()"), code.indexOf("async redirects()"));
  const redirects = code.slice(code.indexOf("async redirects()"));
  ok("the root serves the clinician page and /for-parents serves the family page",
    /source:\s*"\/"\s*,\s*destination:\s*"\/for-slps\.html"/.test(rewrites) &&
    /source:\s*"\/for-parents"\s*,\s*destination:\s*"\/parents\.html"/.test(rewrites));
  ok("the old clinician URL redirects permanently to the root",
    /source:\s*"\/for-slps"\s*,\s*destination:\s*"\/"\s*,\s*permanent:\s*true/.test(redirects));
  ok("each landing page declares its canonical and shared URL",
    /rel="canonical" href="https:\/\/www\.speaksona\.com\/for-parents"/.test(parents) &&
    /og:url" content="https:\/\/www\.speaksona\.com\/for-parents"/.test(parents) &&
    /rel="canonical" href="https:\/\/www\.speaksona\.com\/"/.test(slps) &&
    /og:url" content="https:\/\/www\.speaksona\.com\/"/.test(slps));
  ok("both landing routes revalidate", /source: "\/", headers: noStore/.test(code) && /source: "\/for-parents", headers: noStore/.test(code));

  // A LINK WITH NO CARD IS A GREY BOX. Both pages are static and inherit
  // nothing from app/layout.tsx, so each carries its own.
  for (const [name, page, img] of [["the parent page", parents, "og-parents.png"], ["the clinician page", slps, "og-slp.png"]]) {
    for (const tag of ["og:title", "og:description", "og:image", "og:url", "twitter:card"]) {
      ok(`${name}: a shared link carries ${tag}`, new RegExp('(property|name)="' + tag + '"').test(page));
    }
    ok(`${name}: the card's image is an absolute URL, because a scraper resolves it against nothing`,
      // (?v=N: a new picture under the same name, so a scraper's cache of the old one is not reused)
      new RegExp('og:image" content="https://speaksona\\.com/' + img.replace(".", "\\.") + '(\\?v=\\d+)?"').test(page));
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
  ok("the parent page's headline, tab title and shared card all say 'Speech practice kids love'",
    /<h1>Speech practice kids love\.<\/h1>/.test(parents) &&
    /<title>Speech practice kids love — Sona<\/title>/.test(parents) &&
    /og:title" content="Speech practice kids love\."/.test(parents) &&
    /twitter:title" content="Speech practice kids love\."/.test(parents));
  // 1 Oct 2026 (Travis): "Built with Rachel, MS, CF-SLP, a pediatric
  // speech-language pathologist in her clinical fellowship".
  ok("…and it names Rachel's credential in the settled words", /Built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship/.test(parents));
  // 29 Sep 2026: Travis asked for "MS, CF-SLP" wherever Rachel is presented as an SLP — her byline on the parent page carries it.
  ok("…and her byline carries her credentials: Rachel Wardrop, MS, CF-SLP", /Rachel Wardrop, MS, CF-SLP &middot; Co-founder/.test(parents));

  // A PARENT PAGE HAS NO SIGN IN. From 22 Oct 2026 it had no way to the
  // clinician side at all (Travis: "speaksona.com is only for parents"); from
  // 12 Nov 2026 (Travis: "sell to slps", findable) it has exactly one, a
  // small "For speech therapists" in the footer, and nothing above it.
  const pHeader = (parents.match(/<header[\s\S]*?<\/header>/) || [""])[0].replace(/<!--[\s\S]*?-->/g, "");
  const pShown = parents.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  ok("the parent page's header: the logo and one Start free, no Sign in",
    (pHeader.match(/<a\b/g) || []).length === 1 && /<button class="btn sm" id="topGo" type="button">Start free<\/button>/.test(pHeader) && !/Sign in|slp-login/.test(pHeader));
  const pAbove = pShown.slice(0, pShown.indexOf("<footer"));
  const pFooter = (pShown.match(/<footer[\s\S]*?<\/footer>/) || [""])[0];
  ok("…and its one link to the clinician side is the footer's 'For speech therapists' — nothing above the footer, no sign-in",
    !/href="\/(for-slps|slp-login|slp\b|slps\b)/.test(pAbove) && (pFooter.match(/href="\/"/g) || []).length === 1 &&
    /<a href="\/">For speech therapists<\/a>/.test(pFooter) && !/href="\/(slp-login|slp\b|slps\b)/.test(pShown));
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
  // A drawn book is a folder with a cover.svg, or cover.webp once redrawn. /assets/books/painted/ holds the
  // six-page books' painted pictures (29 Sep 2026), and is not a book.
  // a limited-time book (season: …) is never on the website's strip
  const seasonal = [...readFileSync(APP + "/public/library.html", "utf8").matchAll(/season: \{[^}]*\}, title: "[^"]+"[^\n]*\n\s*cover: "(\/assets\/books\/[a-z-]+\/cover\.(?:svg|webp))"/g)].map((m) => m[1]);
  const books = (readFileSync(APP + "/public/library.html", "utf8").match(/\/assets\/books\/[a-z-]+\/cover\.(?:svg|webp)/g) || []).filter((v, i, a) => a.indexOf(v) === i && !seasonal.includes(v));
  const sounds = JSON.parse((sona.match(/const ALL_SOUNDS = (\[[^\]]*\]);/) || [, "[]"])[1]);
  ok("the parent page's game count is the catalog's", games.length >= 6 && new RegExp('<span class="n">' + games.length + "</span> games\\.").test(parents), games.length);
  ok("…and its game strip shows every one of them", (parents.match(/<li class="tile g">/g) || []).length === games.length &&
    games.every((g) => parents.includes("<span>" + g[2].replace(/'/g, "&rsquo;") + "</span>")), games.map((g) => g[2]).filter((n) => !parents.includes("<span>" + n + "</span>")).join(", "));
  const gameTiles = (parents.match(/<li class="tile g">[\s\S]*?<\/li>/g) || []).join("");
  ok("…and not one game it shows as Coming soon", parkedGames.every((g) => !gameTiles.includes("<span>" + g[2].replace(/'/g, "&rsquo;") + "</span>") && !gameTiles.includes("/assets/games/" + g[1] + ".svg")),
    parkedGames.filter((g) => gameTiles.includes("<span>" + g[2] + "</span>")).map((g) => g[2]).join(", "));
  // THE BOOKS OPEN ON A DATE (27 Sep 2026; every queued one on Fri 9 Oct,
  // 1 Oct 2026). The strip holds every twelve-page book, each tile carrying
  // the day the bookshelf opens it, and the page counts only the open ones
  // and tags the rest "Coming", worked out on the phone from those days
  // (landingtest plays it), so it is never ahead of the shelf.
  const lib = readFileSync(APP + "/public/library.html", "utf8");
  const shelfDays = [...lib.matchAll(/\{ sound: "\w+", emoji: "[^"]*", (?:opens: "([\d-]+)", )?title: "[^"]+"[^\n]*\n\s*cover: "\/assets\/books\/([a-z-]+)\/cover\.(?:svg|webp)"/g)].map((m) => ({ slug: m[2], opens: m[1] || "" }));
  const tileDay = (slug) => (parents.match(new RegExp('<li class="tile b"(?: data-opens="([\\d-]+)")?><img src="/assets/books/' + slug + '/cover\\.(?:svg|webp)"')) || [null, null]);
  ok("its book strip is the bookshelf's, a book for every sound, each tile with the day the shelf opens it",
    books.length >= sounds.length && shelfDays.length === books.length && (parents.match(/<li class="tile b"/g) || []).length === books.length &&
    shelfDays.every((b) => tileDay(b.slug)[0] && (tileDay(b.slug)[1] || "") === b.opens),
    shelfDays.filter((b) => !tileDay(b.slug)[0] || (tileDay(b.slug)[1] || "") !== b.opens).map((b) => b.slug).join(", "));
  ok("…and its book count is only the open ones, worked out from those days",
    /<span class="n" id="bookCount">\d+<\/span> picture books\./.test(parents) && /\$\("bookCount"\)/.test(parents) && !/a picture book for every sound/.test(parents));
  ok("…and the sounds answer names all " + sounds.length, new RegExp(sounds.length + " speech sounds: P, B, M, N, T, D, K, G, F, V, S, Z, SH, CH, J, L, R, and both TH sounds").test(pShown));

  const slpHeadline = (slps.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/) || ["", ""])[1]
    .replace(/<[^>]+>/g, "").replace(/&rsquo;/g, "’").replace(/\s+/g, " ").trim();
  ok("the clinician page's headline, tab title and shared card carry the new message",
    slpHeadline === "Send home practice they’ll play." &&
    /<title>[^<]*Send home practice they’ll play[^<]*<\/title>/i.test(slps) &&
    /og:title" content="Send home practice they’ll play\."/.test(slps) &&
    /twitter:title" content="Send home practice they’ll play\."/.test(slps));
  const slpLede = (slps.match(/<p class="lede">([\s\S]*?)<\/p>/) || ["", ""])[1];
  // Travis, 14 Nov 2026: a benefit "that is not like the community"; the
  // session-planning line waits until the planner is built.
  ok("the clinician lede presents AI homework, family links and seeing who practiced",
    /draft homework with AI/i.test(slpLede) && /share the app with clients/i.test(slpLede) && /see who practiced at home/i.test(slpLede) &&
    !/community/i.test(slpLede));
  const header = (slps.match(/<header>[\s\S]*?<\/header>/) || [""])[0].replace(/<!--[\s\S]*?-->/g, "");
  ok("the clinician header has the logo, How it works and Sign in",
    (header.match(/<a\b/g) || []).length === 3 && /<a class="signin" href="\/slp-login\.html">Sign in<\/a>/.test(header) &&
    /<a\b[^>]*href="#how">How it works<\/a>/.test(header));
  ok("a parent who lands here is pointed to /for-parents",
    (slps.match(/<a\b[^>]*href="\/for-parents"/g) || []).length === 1);
  ok("clinician signup asks the auth endpoint to send the free dashboard link",
    /fetch\("\/api\/slp\/auth\/request"/.test(slps) && /flow:\s*"free-dashboard"/.test(slps) &&
    !/#premium|apps\.apple\.com|APP_STORE|APP_READY/.test(slps));
  const form = (slps.match(/<form class="signup" id="signup"[\s\S]*?<\/form>/) || [""])[0];
  ok("one clinician form asks only for a work email (14 Nov 2026: no role, no setting)",
    /id="fEmail" type="email"[^>]*\brequired\b/.test(form) && (form.match(/<button\b/g) || []).length === 1 &&
    (form.match(/<input\b/g) || []).length === 1 && !/<select\b/.test(form) && !/<textarea\b/.test(form) &&
    /placeholder="you@yourclinic\.org"/.test(form) &&
    !/<option value="(?:parent|other)"/.test(form) &&
    (slps.match(/<form\b/g) || []).length === 1 && !/id="startModal"/.test(slps));
  ok("both clinician calls to action say Get the free dashboard and the closing one returns to the form",
    /\$\("finalGo"\)\.onclick = function \(\) \{ toForm\(\); \};/.test(slps) &&
    (slps.replace(/<!--[\s\S]*?-->/g, "").match(/>Get the free dashboard</g) || []).length === 2);
  ok("the signup button tells clinicians that access is emailed",
    /aria-describedby="fNext"/.test(form) && /id="fNext">[^<]*email you a sign-in link/i.test(form));
  const heroR = (slps.match(/<div class="hero-r"[\s\S]*?<\/section>/) || [""])[0];
  ok("the clinician hero shows Echo and a Fruit Slice game screen without sample caseload data",
    /<img class="mascot" src="\/assets\/site\/echo\.webp"/.test(heroR) && /<img src="\/assets\/site\/slice\.webp"/.test(heroR) &&
    !/Your caseload this week|>\s*\d+%\s*</.test(heroR));
  const ogSrc = readFileSync(APP + "/tools/og/og-slp.html", "utf8").replace(/<!--[\s\S]*?-->/g, "");
  ok("the share picture offers the free dashboard without misstating Rachel's credentials",
    /free dashboard/i.test(ogSrc) && !/\bCCC\b|certified|licensed pediatric SLP/i.test(ogSrc) &&
    (!/Rachel/.test(ogSrc) || /Rachel, MS, CF-SLP/.test(ogSrc)));
  ok("the share picture carries no dollar price or trial pitch", !/\$\s*\d|\bfree trial\b|\b\d+ days free\b/i.test(ogSrc));
}

// ── found by search and by AI assistants, as a page for parents (22 Oct 2026) ──
// Travis: a parent asking ChatGPT or Google how to do speech practice at home
// should hear about Sona, and "speaksona.com is only for parents. I don't
// want to target therapists at all". Each pin is one way that could quietly
// stop being true.
{
  const strip = (t) => t.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  const parents = readFileSync(APP + "/public/parents.html", "utf8");
  const slps = readFileSync(APP + "/public/for-slps.html", "utf8");
  const NOINDEX = /<meta name="robots" content="noindex"/;
  // FINDABLE AGAIN (Travis, 12 Nov 2026: "Yes, findable").
  ok("the clinician page is NOT noindex: search may find it", !NOINDEX.test(slps));
  ok("…and so are the Speech Check, /try and the old /families page",
    NOINDEX.test(readFileSync(APP + "/public/check.html", "utf8")) && NOINDEX.test(readFileSync(APP + "/public/try.html", "utf8")) &&
    /robots: \{ index: false \}/.test(readFileSync(APP + "/app/families/page.tsx", "utf8")));
  ok("the parent page is not", !NOINDEX.test(parents));
  // No page a parent reads, and no email a parent gets, links to the
  // clinician side. The clinician pages themselves are not a parent's, and
  // neither is Settings' clinician card: it shows only for a profile set up
  // as a clinician (role "slp", through /onboarding.html?slp=1, which nothing
  // links to) and never in the iPhone app.
  // parents.html is checked above: exactly one footer link, nothing else.
  const CLIN = new Set(["for-slps.html", "slp.html", "slp-login.html", "settings.html", "parents.html"]);
  const TO_CLIN = /href=["'](https?:\/\/(www\.)?speaksona\.com)?\/(for-slps|slp-login|slps\b|slp\.html|slp["'?#])/;
  const fam = pages.filter((f) => !CLIN.has(f) && TO_CLIN.test(strip(readFileSync(APP + "/public/" + f, "utf8"))))
    .concat(["app/families/page.tsx", "app/terms/page.tsx", "app/support/page.tsx", "app/privacy/page.tsx", "app/layout.tsx", "lib/nurture.ts", "lib/report.ts", "lib/revenuecat.ts"]
      .filter((f) => existsSync(APP + "/" + f) && TO_CLIN.test(strip(readFileSync(APP + "/" + f, "utf8")))));
  ok("no family page or family email links to the clinician side", fam.length === 0, fam.join(", "));

  // robots: every crawler welcome, the AI assistants' by name, and no
  // noindex page blocked (a blocked crawler never reads the noindex).
  const robots = strip(readFileSync(APP + "/app/robots.ts", "utf8"));
  ok("robots.txt names the AI assistants' crawlers", ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"].every((b) => robots.includes('"' + b + '"')));
  ok("…blocks only the API and the admin pages", /const OFF = \["\/api\/", "\/admin\/"\];/.test(robots) && !/slp|join|try|families|check|founders|leads/.test(robots));
  ok("…and points at the sitemap, on the address that answers", /sitemap: "https:\/\/www\.speaksona\.com\/sitemap\.xml"/.test(robots) &&
    /const BASE = "https:\/\/www\.speaksona\.com";/.test(readFileSync(APP + "/app/sitemap.ts", "utf8")));
  // The sitemap lists both canonical landing pages and skips private pages.
  const urls = (readFileSync(APP + "/app/sitemap.ts", "utf8").match(/url: `\$\{BASE\}[^`]*`/g) || []).map((u) => u.slice(13, -1));
  ok("the sitemap starts at the root", urls[0] === "/", urls.join(" "));
  ok("…lists /for-parents second and excludes private, noindex and app pages",
    urls.length > 1 && urls[1] === "/for-parents" && urls.every((u) => ["/", "/for-parents", "/privacy.html", "/terms"].includes(u)), urls.join(" "));

  // llms.txt: what an AI assistant reads about Sona. Everything the route can
  // send is its string literals, so the whole file is scanned, comments out.
  const llms = strip(readFileSync(APP + "/app/llms.txt/route.ts", "utf8"));
  ok("llms.txt names Rachel in the settled words", llms.includes("Built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship."));
  ok("…speaks to parents only: no clinician, caseload or dashboard",
    !/caseload|dashboard|clinician|for-slps|SLPA?\b(?<!CF-SLP)/.test(llms.replace(/CF-SLP/g, "")));
  ok("…never quotes a dollar figure or a count of games or books", !/\$\s?\d/.test(llms.replace(/\$\{cost\}/g, "")) && !/\d+ (games|picture books|books)/.test(llms));
  // The parent page's three cost answers, in order (free / app only / web
  // sales), are llms.txt's three, chosen by the same switches in the same
  // order. A reworded answer on either side fails, never passes empty.
  const COST = /"(Right now, all of Sona is free[^"]*|Sona is free to download\. Sona Premium[^"]*)"/g;
  const pCost = [...parents.matchAll(COST)].map((m) => m[1]), lCost = [...llms.matchAll(COST)].map((m) => m[1]);
  ok("…and its cost line is the parent page's, chosen by the same switches",
    /import \{ FREE_MODE, WEB_SALES \} from "@\/lib\/pricing"/.test(llms) &&
    /FREE_MODE\s*\?\s*"Right now/.test(llms) && /: !WEB_SALES\s*\?\s*"Sona is free to download\. Sona Premium opens every game and every book\. You buy/.test(llms) &&
    pCost.length === 3 && JSON.stringify(pCost) === JSON.stringify(lCost), pCost.length + " vs " + lCost.length);
  // Its sounds line is the parent page's, which is pinned to ALL_SOUNDS above.
  const a2 = ((parents.match(/<p class="a" id="a2"[^>]*>([^<]*)<\/p>/) || [])[1] || "").replace(/&ldquo;|&rdquo;/g, '"');
  ok("…and its sounds line is the parent page's, word for word", a2.length > 40 && llms.includes(a2), a2);

  // The labels in the page's head: they parse, they are the app, and they
  // carry no price.
  const ld = (parents.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  let items = [];
  try { items = JSON.parse(ld); } catch (e) {}
  const app = items.find((x) => x["@type"] === "MobileApplication") || {};
  ok("the parent page carries schema.org labels that parse", items.length === 3 && !!items.find((x) => x["@type"] === "Organization"));
  ok("…the app's with the App Store address and Rachel's settled line",
    app.installUrl === "https://apps.apple.com/us/app/sona-speech/id6785755867" &&
    (app.description || "").includes("Built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship."));
  ok("…and no price, offer or rating", !/"(offers|price|aggregateRating)"/.test(ld || ""));
}

// ── The free clinician landing page and its privacy promises ──
{
  const slps = readFileSync(APP + "/public/for-slps.html", "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const shown = slps.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  const flat = shown.replace(/<[^>]+>/g, " ").replace(/&rsquo;/g, "'").replace(/\s+/g, " ");
  ok("the clinician landing page and its metadata advertise free access with no prices or trial pitch",
    /free dashboard/i.test(shown) && !/\$\s*\d|\bfree trial\b|\b\d+ days free\b|id="pricing"|href="#pricing"/i.test(shown));
  ok("the clinician offer includes homework, a client link and a community",
    ["Create AI homework", "Share the app with clients", "Join the community"].every(label => flat.includes(label)));
  ok("the page preserves the family's free practice without promising universal game access",
    /daily practice and free games/i.test(flat) && !/unlimited families|free forever|gets every game/i.test(flat));
  ok("the storage answer explains how a parent's email is handed to Resend and not kept by Sona",
    /we hand it to Resend to deliver that one email[^.]*, and Sona keeps no copy: not stored, not logged, not added to any list\./.test(flat) &&
    !/keep it nowhere/.test(flat));
  ok("the storage answer names Resend for emails and the list",
    /emails and the email list via Resend/.test(flat) && !/sign-in emails via Resend/.test(flat));
  ok("the page still explains how a clinician or family can remove a child's data",
    /stop sharing[^.]*or you remove the child from your caseload/.test(flat));
  ok("the clinician page links the Terms", /href="\/terms"/.test(shown));
}

// ── the Terms the clinician plan is sold under (24 Sep 2026) ──
// Each pin is a sentence a reviewer found untrue against the code: the cap
// counts sign-ups (per code and per clinician), not families; a pilot place
// no longer brings Premium, only a Founding Families one; and nothing holds
// a clinician's own Premium to one device.
{
  const decomment = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  const terms = decomment(readFileSync(APP + "/app/terms/page.tsx", "utf8")).replace(/\{" "\}/g, " ").replace(/\s+/g, " ");
  // 12 Nov 2026: no cap on a covered link, so the Terms say "no limit" and
  // the old "up to 300 sign-ups a year" is gone with the number.
  ok("Terms: Sona Pro at the library's price, with no limit on families while it is on",
    /<strong>\{PRO_NAME\}<\/strong> on speaksona\.com for <strong>\{PRO_PRICE\} per month<\/strong>/.test(terms) && /There is no limit on how many families join through your link while it is active\./.test(terms) &&
    !/COVERED_REDEEM_CAP|sign-ups a year|we raise it on request/.test(terms), terms.match(/A speech-language pathologist[^.]*\.[^.]*\./)?.[0]);
  ok("Terms: the free trial's terms — the first time, a card, no charge that day, charged when it ends unless cancelled, never if cancelled during it, once per clinician",
    /The first time you start \{PRO_NAME\}, the first \{PRO_TRIAL_DAYS\} days are free\. You enter a card at checkout and are not charged that day\. Unless you cancel before the trial ends, your card is charged \{PRO_PRICE\} when it ends and then each month until you cancel\. If you cancel during the trial, you are never charged\. One free trial per clinician\./.test(terms));
  ok("Terms: Pro renews monthly and cancellation retains paid access through the paid month or trial",
    /\{PRO_NAME\} renews automatically each month until you cancel it/.test(terms) &&
    /paid dashboard access and your families' Premium stay on until the end of the month you paid for \(or of the free trial\)/.test(terms.replace(/&apos;/g, "'")));
  ok("Terms: free dashboard access and removing a child survive cancellation",
    /through the free dashboard signup can use the dashboard without a subscription\./.test(terms) &&
    /Free dashboard access and removing a child from your dashboard keep working\./.test(terms));
  ok("Terms: every older promise is kept — the free dashboard before 12 Nov, free forever before 24 Sep, own Premium 24–29 Sep, the yearly plans still renewing",
    /Clinicians who signed up before 12 November 2026/.test(terms) && /Clinicians who signed up before 24 September 2026/.test(terms) &&
    /Clinicians who signed up from 24 to 29 September 2026/.test(terms) && /Yearly plans sold until 12 November 2026\./.test(terms) && /were replaced by \{PRO_NAME\} and can't be bought now\. If you hold one, it keeps renewing at the price you subscribed at/.test(terms.replace(/&apos;/g, "'")));
  ok("Terms: only Founding Families places are free regardless — never 'pilot places'",
    /Founding Families places are free and unaffected by these prices\./.test(terms) && !/[Pp]ilot and founding places|pilot place/.test(terms));
  ok("Terms: the clinician's own Premium is 'your own phone or tablet', each link once — never 'one phone'",
    /Premium on your own phone or tablet/.test(terms) && /each link works once/i.test(terms) && !/one phone/i.test(terms));
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
  // TRIAL FIRST (3 Oct 2026): speaksona.com sends parents to the iPhone app,
  // where a new family starts with the trial and has no free version, so its
  // cost answer promises none (and still never "two games")
  const home = decomment(readFileSync(APP + "/public/parents.html", "utf8")).replace(/\s+/g, " ");
  ok("public/parents.html promises no free version: a new family in the app starts with the trial", !/daily practice (and|\+) free games|free games|free version/i.test(home),
    (home.match(/.{0,60}(daily practice (and|\+) free games|free games|free version).{0,40}/i) || [])[0]);
  ok("public/parents.html never undersells it as 'two games'", !/\btwo (free )?games\b/i.test(home));
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
  // Founding Families places are CLOSED (Travis, 14 Nov 2026; server.md B4).
  // POST /api/founding answers 410 and reads, stores and forwards nothing (it
  // took a child's name and a parent's cell, kept them for good and sent them
  // to a CRM webhook). GET stays, so a code minted before closing still
  // verifies and every founding family keeps Premium (sona.js is untouched).
  const ffRoute = readFileSync(APP + "/app/api/founding/route.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  const ffPost = (ffRoute.match(/export async function POST\([^)]*\) \{[\s\S]*?\n\}/) || [""])[0];
  ok("Founding Families: POST /api/founding answers 410 and reads, stores and forwards nothing",
    /status: 410/.test(ffPost) && !/req\.json|req\.text|kvCmd|SET|LPUSH|fetch\(|LEAD_WEBHOOK_URL|child|cell/.test(ffPost) && !/LEAD_WEBHOOK_URL|ff:apps|"SET"/.test(ffRoute), ffPost);
  ok("…and GET still answers whether an earlier code exists (founding families keep their links)",
    /export async function GET\(/.test(ffRoute) && /\["GET", "ff:app:" \+ id\]/.test(ffRoute));
  const ffPage = readFileSync(APP + "/public/founding.html", "utf8");
  ok("…and founding.html is a short closed note: no box, no form, nothing posted, a way to /for-parents",
    /Founding Families places are closed\./.test(ffPage) && !/<input|<select|<textarea|<form|fetch\(|<script/i.test(ffPage) && /href="\/for-parents"/.test(ffPage));
  // Old open routes nothing called (server.md B5, B7; 14 Nov 2026): a free
  // AI or avatar proxy, a family's whole backup kept 48 hours, the old Friday
  // email's list, and the parked story page's AI writer, which was sent the
  // child's name. None may come back, and no page may call one.
  const GONE = ["chat", "coach", "heygen", "pair", "story", "trial", "cron/weekly"];
  ok("the deleted routes stay deleted: " + GONE.join(", "), GONE.every((r) => !existsSync(APP + "/app/api/" + r)), GONE.filter((r) => existsSync(APP + "/app/api/" + r)).join(", "));
  const callers = readdirSync(APP + "/public").filter((f) => /\.(html|js)$/.test(f))
    .filter((f) => /["'`]\/api\/(chat|coach|heygen|pair|story|trial|cron\/weekly)\b/.test(readFileSync(APP + "/public/" + f, "utf8")));
  ok("…and no page or script calls one", callers.length === 0, callers.join(", "));
  const crons = (JSON.parse(readFileSync(APP + "/vercel.json", "utf8")).crons || []).map((c) => c.path);
  ok("…and the only daily job is /api/cron/nurture (the Friday email is off)", JSON.stringify(crons) === JSON.stringify(["/api/cron/nurture"]), crons.join(", "));
  ok("…and story.html asks no server for a story (it was sent the child's name)", !/fetch\(\s*["']\/api\/story/.test(readFileSync(APP + "/public/story.html", "utf8")));
  ok("…and sona.js mirrors no trial to a server", !/mirrorTrial|fetch\("\/api\/trial"/.test(sona));
  ok("…and sona.js still honours a founding family: foundingPilot(), the verified ?ff= check, and NO_IMPORT",
    /function foundingPilot\(\)/.test(sona) && /fetch\("\/api\/founding\?id="/.test(sona) && /const NO_IMPORT = \[[^\]]*"sona\.founding\.v1"/.test(sona));
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
  // ONE named exception (Travis, 9 Oct 2026, of the ads' bridge page /try:
  // "take out MS, CF-SLP, just leave in a pediatric speech language pathologist
  // in her clinical fellowship"). Only that exact line on that page; the
  // fellowship is still said, so it stays true.
  const BRIDGE = "Built with Rachel, a pediatric speech-language pathologist in her clinical fellowship.";
  for (const f of files) {
    let t = visible(f);
    if (f === "public/try.html") t = t.split(BRIDGE).join(" ");
    for (const m of t.match(/Rachel(?: Wardrop)?(?!, MS, CF-SLP)[^<.\n]{0,6}(?:[Ll]icensed|[Pp]ediatric|speech-language|SLP|MS\b)/g) || []) bare.push(f + ": " + m);
    for (const m of t.match(/\bCCC\b|board.certified|ASHA.certified|\bcertified\b|fully licen[sc]ed/gi) || []) claims.push(f + ": " + m);
    for (const m of t.match(/\b(?:built|made|designed|shaped|reviewed|created|developed)\s+(?:with|by)\s+(?:a|an|our)\s+(?:licensed\s+)?(?:pediatric\s+)?(?:SLP|speech-language pathologist)\b|\bour SLP\b/gi) || []) anon.push(f + ": " + m);
    if (/Rachel[^<>.]{0,160}?(?:speech-language pathologist|\bSLP\b)|(?:speech-language pathologist|\bSLP\b)[^<>.]{0,160}?Rachel/.test(t) && !/MS, CF-SLP/.test(t)) unpaired.push(f);
  }
  ok("every place Rachel is named as a clinician says 'Rachel, MS, CF-SLP'", bare.length === 0, bare.join(" | "));
  ok("…and no page or app surface claims a certification she does not hold", claims.length === 0, claims.join(" | "));
  ok("…and no line presents Sona's own SLP without naming her ('Built with a licensed SLP', 'our SLP')", anon.length === 0, anon.join(" | "));
  ok("…and every page that calls Rachel an SLP carries 'MS, CF-SLP'", unpaired.length === 0, unpaired.join(", "));
  // Progress left this list on 5 Nov 2026: it no longer names Rachel at all
  // (Travis: "take out built with Rachel on the progress sheet").
  const carry = ["parents", "subscribe", "trial", "talk", "slp"]
    .filter((n) => !/Rachel(?: Wardrop)?, MS, CF-SLP/.test(visible("public/" + n + ".html")));
  ok("…and the pages that introduce her all carry it", carry.length === 0, carry.join(", "));
  // The line changed on 1 Oct 2026 (Travis): she is described as "a pediatric
  // speech-language pathologist in her clinical fellowship" everywhere, so the
  // earlier "licensed pediatric speech-language pathologist" line is gone
  // from every surface (a child's own SLP, "a licensed speech-language
  // pathologist", is someone else and is not matched).
  const oldLine = files.filter((f) => /licensed pediatric speech-language pathologist/i.test(visible(f)));
  ok("…and every surface uses the new line: no 'licensed pediatric speech-language pathologist' left", oldLine.length === 0, oldLine.join(", "));
}

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
