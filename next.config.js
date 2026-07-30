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
    const noStore = [{ key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" }];
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
      { source: "/mouthcue.js", headers: noStore },
      { source: "/sona.css", headers: noStore },
      { source: "/manifest.webmanifest", headers: noStore },
      { source: "/apple-touch-icon.png", headers: noStore },
      { source: "/icon-192.png", headers: noStore },
      { source: "/icon-512.png", headers: noStore },
      { source: "/", headers: noStore },
      { source: "/subscribe", headers: noStore },
      { source: "/subscribe/success", headers: noStore },
    ];
  },
  // Clean URLs for the SLP entry points so /for-slps (no .html) resolves to the
  // static page instead of 404ing. Rewrite keeps the pretty URL in the address bar.
  async rewrites() {
    return [
      { source: "/for-slps", destination: "/for-slps.html" },
      { source: "/slp-login", destination: "/slp-login.html" },
      { source: "/slp", destination: "/slp.html" },
    ];
  },
};

module.exports = nextConfig;
