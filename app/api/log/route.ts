import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Lightweight client-error beacon. During the pilot, silent front-end failures
 * (a game that soft-locks, a mic that never fires) are invisible to the founder;
 * this surfaces them in the Vercel function logs — search "sona-client-error".
 *
 * Deliberately minimal: no auth (it's a public kids' app), rate-limited, and it
 * only records the message + path + user-agent — no child content or PII.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const _rl = await rateLimit(req, { key: "log", limit: 60, windowSec: 60 });
  if (_rl) return _rl;
  try {
    const b = await req.json();
    const msg = typeof b?.msg === "string" ? b.msg.slice(0, 500) : "";
    const url = typeof b?.url === "string" ? b.url.slice(0, 300) : "";
    const ua = req.headers.get("user-agent")?.slice(0, 200) || "";
    if (msg) console.error("sona-client-error", JSON.stringify({ msg, url, ua }));
  } catch {
    // ignore malformed beacons
  }
  return new NextResponse(null, { status: 204 });
}
