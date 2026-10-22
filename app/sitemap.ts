import type { MetadataRoute } from "next";

// The public, indexable pages only — and speaksona.com is for parents
// (Travis, 22 Oct 2026). The root IS the family page (next.config.js rewrites
// / to /families, whose canonical is the root), so /families is not listed
// twice. App screens (today.html, the arcade, …) are the product, not answers
// to a search. The clinician pages (for-slps.html, slp.html, slp-login.html)
// and the private ones (join.html, leads.html, founders.html) are noindex and
// must never appear here.
const BASE = "https://speaksona.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/support`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
