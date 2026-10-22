const { readdirSync } = require("fs");
const { join } = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't let the CDN cache the app's HTML/JS shell — so a new deploy is visible
  // immediately instead of serving a stale edge copy. The iOS app is a shell
  // pointed at speaksona.com (capacitor server.url) with no service worker, so
  // this header IS the update mechanism: get it wrong and the App Store build
  // keeps rendering an old page against a new sona.js.
  //
  // READ FROM DISK, not from a hand-written list. This was a list of 14 page
  // names, and it went stale the moment the home screen moved off home.html —
  // today.html, charge.html, story.html and every arcade page were missing,
  // which is the worst case: a cached old page calling functions the fresh
  // sona.js no longer exports.
  async headers() {
    // no-cache, NOT no-store. Both force the browser (and the CDN) to ask the
    // origin before using a copy, so a deploy is still visible on the very
    // next load — that is the update mechanism the comment above describes,
    // and it is intact. The difference is what happens when nothing changed:
    // no-store threw the copy away and re-downloaded it, so every hop of a
    // session — home → story → practice → game → practice, five times — paid
    // for sona.js again (82 KB gzipped) on a child's phone, often on cellular.
    // no-cache keeps the copy and asks "still current?"; Vercel answers 304
    // and a few bytes. Fresh on deploy, fast between deploys.
    const noStore = [{ key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" }];
    let pages = [];
    try {
      pages = readdirSync(join(__dirname, "public"))
        .filter((f) => f.endsWith(".html"))
        .map((f) => f.replace(/\.html$/, ""));
    } catch (e) {
      // never let a read failure silently drop the header on every page
      throw new Error("next.config: could not read public/ to build the no-store list: " + e.message);
    }
    return [
      ...pages.map((p) => ({ source: `/${p}.html`, headers: noStore })),
      { source: "/sona.js", headers: noStore },
      { source: "/simple-play.js", headers: noStore },
      { source: "/simple-play.css", headers: noStore },
      { source: "/sayplay.js", headers: noStore },
      { source: "/sayplay.css", headers: noStore },
      { source: "/saycheck.js", headers: noStore },
      { source: "/action.css", headers: noStore },
      { source: "/mouthcue.js", headers: noStore },
      { source: "/sona.css", headers: noStore },
      // Pages call these by name (11 Oct 2026): the buddy helpers draw a
      // child's buddy in the games, the four play engines take a level from
      // the page (Hoops, Soccer and Dino a buddy too; Bubble Pop keeps Echo
      // alone), and the Trophy Road's sheet styles its page. A
      // cached old copy next to a fresh page is a missing method; every page
      // checks before it calls, so it still plays, just without the new part.
      { source: "/crafted-buddies.js", headers: noStore },
      { source: "/hoops.js", headers: noStore },
      { source: "/soccer.js", headers: noStore },
      { source: "/dino.js", headers: noStore },
      { source: "/bubbles.js", headers: noStore },
      { source: "/crafted-road.css", headers: noStore },
      // The daily story (STORY1, 22 Oct 2026): the three games' play scripts
      // and sheets, the story's scenes and its player's sheet, the say-it
      // helper whose SayIt.line the player calls by name, and the recorded
      // voice's manifest (a line whose words change gets a new file name, so
      // a stale manifest would send a fresh line to the live voice for good).
      { source: "/lighthouse.js", headers: noStore },
      { source: "/windup.js", headers: noStore },
      { source: "/bridge.js", headers: noStore },
      { source: "/lighthouse.css", headers: noStore },
      { source: "/windup.css", headers: noStore },
      { source: "/bridge.css", headers: noStore },
      { source: "/adventures.js", headers: noStore },
      { source: "/crafted-adventure.css", headers: noStore },
      { source: "/arcade-sayit.js", headers: noStore },
      { source: "/assets/adventure/voice/manifest.js", headers: noStore },
      { source: "/manifest.webmanifest", headers: noStore },
      { source: "/apple-touch-icon.png", headers: noStore },
      { source: "/icon-192.png", headers: noStore },
      { source: "/icon-512.png", headers: noStore },
      { source: "/", headers: noStore },
      { source: "/for-slps", headers: noStore },
      { source: "/try", headers: noStore },
      { source: "/slps", headers: noStore },
      { source: "/subscribe", headers: noStore },
      { source: "/subscribe/success", headers: noStore },
    ];
  },
  // Clean URLs for the SLP entry points so /for-slps (no .html) resolves to the
  // static page instead of 404ing. Rewrite keeps the pretty URL in the address bar.
  async rewrites() {
    return [
      // THE ROOT IS THE PARENT PAGE (Travis, 26 Sep 2026: "change it to
      // target parents and caregivers only. not slps"). speaksona.com is where
      // the parent ads land, so it serves that page itself rather than
      // redirecting — a redirect costs a hop on cold paid traffic and splits
      // the SEO. The clinician page it replaced (the root from 22 to 26 Sep)
      // stays at /for-slps, with its own canonical.
      { source: "/", destination: "/parents.html" },
      { source: "/for-slps", destination: "/for-slps.html" },
      // The ad's bridge page (Travis, 9 Oct 2026): a headline, a button, the App Store.
      { source: "/try", destination: "/try.html" },
      { source: "/slp-login", destination: "/slp-login.html" },
      { source: "/slps", destination: "/slp.html" },
    ];
  },
  async redirects() {
    return [
      { source: "/slp", destination: "/slps", permanent: true },
      { source: "/slp.html", destination: "/slps", permanent: true },
    ];
  },
};

module.exports = nextConfig;
