/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't let the CDN cache the app's HTML/JS shell — so a new deploy is visible
  // immediately instead of serving a stale edge copy.
  async headers() {
    const noStore = [{ key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" }];
    const pages = ["home", "call", "onboarding", "progress", "settings", "avatar", "coach"];
    return [
      ...pages.map((p) => ({ source: `/${p}.html`, headers: noStore })),
      { source: "/sona.js", headers: noStore },
      { source: "/sona.css", headers: noStore },
      { source: "/", headers: noStore },
      { source: "/subscribe", headers: noStore },
    ];
  },
};

module.exports = nextConfig;
