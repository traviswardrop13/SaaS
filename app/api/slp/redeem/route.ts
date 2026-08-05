import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { kvCmd, kvConfigured, safeEqualStr } from "@/lib/slpAuth";

/**
 * Family redemption: a family enters the credential their SLP handed them —
 * code ("username") + family key ("password") — and Sona is free for them,
 * forever. This endpoint is the ONLY thing standing between "typed a code" and
 * "skips the paywall", so it fails CLOSED and it is hostile to guessing:
 *
 *  - per-IP rate limit (20/hour) via the shared limiter
 *  - per-CODE failure counter: 25 wrong keys in an hour freezes redemptions
 *    for that code (a distributed guesser can't farm one SLP's key), reset by
 *    any success being irrelevant — the window just expires
 *  - constant-time key comparison
 *  - no KV configured → 503, never a free pass (the old ?slp= honor system
 *    granted free access to any string; that door is closed)
 */
export const runtime = "nodejs";

function norm(s: string): string {
  return String(s || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { key: "slp-redeem", limit: 20, windowSec: 3600 });
  if (rl) return rl;

  if (!kvConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Code check is unavailable right now — try again soon." },
      { status: 503 },
    );
  }

  let body: { code?: string; key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const code = norm(body.code || "");
  const key = String(body.key || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  if (!code || !key) {
    return NextResponse.json({ ok: true, valid: false });
  }

  // brute-force freeze per code
  const failKey = "slpredeemfail:" + code;
  const fails = await kvCmd(["GET", failKey]);
  if (typeof fails === "string" && parseInt(fails, 10) > 25) {
    return NextResponse.json({ ok: false, error: "Too many tries — ask your SLP to re-send the link." }, { status: 429 });
  }

  const owner = await kvCmd(["GET", "slpcode:" + code]);
  let valid = false;
  let name = "";
  if (owner && typeof owner === "string") {
    try {
      const raw = await kvCmd(["GET", "slpacct:" + owner]);
      if (raw) {
        const acct = JSON.parse(String(raw)) as { familyKey?: string; name?: string; clinic?: string };
        const want = String(acct.familyKey || "").toUpperCase();
        if (want && safeEqualStr(key, want)) {
          valid = true;
          name = String(acct.clinic || acct.name || "");
        }
      }
    } catch {
      valid = false;
    }
  }

  if (!valid) {
    const n = await kvCmd(["INCR", failKey]);
    if (n === 1) await kvCmd(["EXPIRE", failKey, 3600]);
  }
  return NextResponse.json({ ok: true, valid, name: valid ? name : undefined });
}
