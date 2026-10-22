import type { MetadataRoute } from "next";

// Search engines AND AI assistants are welcome on the public pages. A parent
// asking ChatGPT, Claude or Perplexity "how can my kid practice speech at
// home" only hears about Sona if their crawlers are allowed to read the site,
// so they are named here rather than left to a wildcard they may not honour.
// Private surfaces (the SLP dashboard, a family's join link, the leads list)
// are NOT blocked here on purpose: they carry `noindex`, and a crawler that is
// disallowed never fetches the page, so it never sees that noindex.
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Google-Extended", "Applebot-Extended"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/"] },
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow: ["/api/", "/admin/"] })),
    ],
    sitemap: "https://speaksona.com/sitemap.xml",
    host: "https://speaksona.com",
  };
}
