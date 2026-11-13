import type { MetadataRoute } from "next";

// The pages someone should land on from a search, and nothing else.
// The homepage is for clinicians. The family landing has its own URL. The app
// screens are the product, not answers to a search, and the noindex pages
// (slp.html, slp-login.html, join.html, try.html, /families, the founder
// pages) must never be listed. `shiptest` holds it to that.
// www: the bare domain answers a 308 to it (seen by RevenueCat's test, 19
// Oct 2026), and a sitemap should list the address that answers.
const BASE = "https://www.speaksona.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/for-parents`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/privacy.html`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/terms`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
