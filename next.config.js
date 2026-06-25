/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't let the CDN cache the app's HTML/JS shell — so a new deploy is visible
  // immediately instead of serving a stale edge copy.
  async headers() {
    const noStore = [{ key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" }];
    const pages = ["home", "lesson", "call", "onboarding", "progress", "settings", "customize", "voices", "unit", "library", "trial", "practice", "avatar", "coach"];
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
