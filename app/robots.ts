import type { MetadataRoute } from "next";

// Search engines AND AI assistants are welcome on the public pages (Travis,
// 22 Oct 2026: a parent asking ChatGPT or Google how to do speech practice
// at home should hear about Sona). Their crawlers are named rather than left
// to the wildcard, so a crawler that only obeys its own name is told too.
// Pages that must stay out of search (the clinician pages, join.html, /try,
// the founder pages) carry `noindex` and are NOT blocked here on purpose: a
// crawler that is disallowed never fetches the page, so it never sees the
// noindex, and can still list the bare address from a link.
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Google-Extended", "Applebot-Extended"];
const OFF = ["/api/", "/admin/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: OFF }, ...AI_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow: OFF }))],
    sitemap: "https://www.speaksona.com/sitemap.xml",
  };
}
