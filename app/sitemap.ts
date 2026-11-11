import type { MetadataRoute } from "next";

// The pages a parent should land on from a search, and nothing else.
// speaksona.com is for parents (Travis, 26 Sep and 22 Oct 2026): the root is
// parents.html (next.config.js rewrites / to it, canonical the root). The app
// screens are the product, not answers to a search, and the noindex pages
// (for-slps.html, slp.html, slp-login.html, join.html, try.html, /families,
// the founder pages) must never be listed. `shiptest` holds it to that.
// www: the bare domain answers a 308 to it (seen by RevenueCat's test, 19
// Oct 2026), and a sitemap should list the address that answers.
const BASE = "https://www.speaksona.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/privacy.html`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/terms`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
