import { NextRequest, NextResponse } from "next/server";

/**
 * First-party telemetry relay for KID pages (COPPA posture).
 *
 * Kid-facing pages ship ZERO third-party scripts (progtest enforces it), so
 * practice events arrive here as a same-origin beacon and the SERVER forwards
 * them to PostHog. Hard whitelist on event names and properties; identity is
 * the anonymous family id (random device-minted, never a name/email); no body
 * is stored, nothing else is read. Always answers ok — telemetry must never
 * break practice.
 */
export const runtime = "nodejs";

const PH_KEY = "phc_xRPqirD2PznnvZrpeuLDwo7LtYegHsF2xWsDNLEEXdkw"; // publishable client token
const PH_HOST = "https://us.i.posthog.com";
// The daily dashboard's whole vocabulary. Adding here is a deliberate act —
// anything not listed is silently dropped, which is the COPPA posture: the
// relay can only ever say LESS than the page asked it to.
const EVENTS = new Set([
  "practice started", "practice completed",
  "day goal done",        // the outcome proxy: a family finished all 5 rounds
  "slp code redeemed",    // which SLPs actually send families
]);
const PROPS = new Set(["sound", "game", "duration_seconds", "attempts_count", "code"]);

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text(); // sendBeacon posts text/plain
    if (!raw || raw.length > 2000) return NextResponse.json({ ok: true });
    const b = JSON.parse(raw) as { e?: string; p?: Record<string, unknown>; fid?: string };
    const event = String(b.e || "");
    const fid = String(b.fid || "");
    if (!EVENTS.has(event) || !/^[A-Za-z0-9_-]{8,40}$/.test(fid)) return NextResponse.json({ ok: true });
    const props: Record<string, unknown> = { native: true, source: "kid-page-relay" };
    for (const k of Object.keys(b.p || {})) {
      if (!PROPS.has(k)) continue;
      const v = (b.p as Record<string, unknown>)[k];
      if (typeof v === "number" && isFinite(v)) props[k] = Math.max(0, Math.min(100000, Math.round(v)));
      else if (typeof v === "string") props[k] = v.slice(0, 40);
    }
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 4000);
    await fetch(`${PH_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: PH_KEY, event, distinct_id: fid, properties: props }),
      signal: ctrl.signal,
    }).catch(() => {});
    clearTimeout(to);
  } catch {
    // swallow everything — this endpoint can never matter more than practice
  }
  return NextResponse.json({ ok: true });
}
