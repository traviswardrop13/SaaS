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

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
