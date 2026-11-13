import { leadSig } from "@/lib/slpAuth";

/**
 * Which ad produced this clinician. An ALLOW-LIST, copied in spirit from
 * /api/lead's safeLead: the object arrives from a page a stranger can put any
 * query string on, so a field that is not named here does not travel. A
 * deny-list is how `name: child` once sailed into a marketing payload.
 */
const ATTRIB_KEYS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "fbclid", "referrer", "landing",
] as const;

export function safeAttrib(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const k of ATTRIB_KEYS) {
    const v = src[k];
    if (typeof v === "string" && v) out[k] = v.slice(0, k === "referrer" ? 200 : 120);
  }
  return out;
}

/**
 * Tell the founder's email list that a clinician signed up. /api/lead is
 * the one place any opt-in goes (it adds them to Resend's contacts; Kit and
 * GoHighLevel, the lists before it, are gone), so this reuses it rather than
 * growing a second rail.
 *
 * AWAITED, WITH A SHORT FUSE — NOT FIRE-AND-FORGET. This used to be
 * `void fetch(...)` so a CRM hiccup could never cost a clinician their
 * sign-in. But on Vercel a function can be frozen the moment its response
 * is sent, and a fetch nobody awaits may never leave: the clinician signs up,
 * the dashboard works, and GoHighLevel never hears about them. Nothing
 * errors, so nothing says so. The fuse keeps the first promise — after
 * CRM_TIMEOUT_MS the sign-in goes ahead regardless — and awaiting keeps the
 * second. It runs alongside the rest of sign-up, so it costs nothing on the
 * usual path.
 *
 * The clinician's OWN first name — the one they typed about themselves.
 * Never a child's, which is the rule everywhere and has no exception in a
 * marketing payload of all places.
 */
// Long enough for the contact list's calls (lib/contacts fuses each at
// 2.5s), which usually finish in well under a second: one call for a new
// address, a few more the very first time (the segments) or for one Resend
// already has.
const CRM_TIMEOUT_MS = 8000;
export async function tellCrm(
  origin: string, email: string, source: string, name: string, attrib: Record<string, string>,
): Promise<boolean> {
  const ctl = new AbortController();
  const fuse = setTimeout(() => ctl.abort(), CRM_TIMEOUT_MS);
  try {
    const r = await fetch(origin + "/api/lead", {
      method: "POST",
      // signed, so /api/lead's per-address flood limit never catches it
      headers: { "Content-Type": "application/json", "x-sona-lead-sig": leadSig(email) },
      body: JSON.stringify({ email, name, source, role: "slp", summary: "New SLP signup", ...attrib }),
      signal: ctl.signal,
    });
    const j = (await r.json().catch(() => null)) as { captured?: boolean } | null;
    if (!r.ok || !j || !j.captured) console.error("[slp signup] CRM did not capture the lead:", r.status, j);
    return !!(r.ok && j && j.captured);
  } catch (e) {
    console.error("[slp signup] CRM call failed:", e instanceof Error ? e.message : String(e));
    return false; /* never blocks sign-in */
  } finally {
    clearTimeout(fuse);
  }
}
