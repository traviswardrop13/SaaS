/**
 * Is this request from another website? True only when the browser SAYS so:
 * an Origin that is not ours, or a Sec-Fetch-Site that is not "same-origin".
 * A request with neither header is let through (a phone's background beacon
 * may carry none; a script can forge both anyway, so the rate limit, not this,
 * is what holds a script back). app/api/tts/route.ts keeps its own copy:
 * it is loaded in a sandbox that allows only two imports.
 */
export function foreignOrigin(req: Request): boolean {
  let self = "";
  try { self = new URL(req.url).origin; } catch { /* no URL: judged by the headers alone */ }
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  return Boolean((origin && origin !== self) || (site && site !== "same-origin"));
}
