import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Founding Families: closed to new places since 14 Nov 2026 (POST answers
 * 410). GET still answers whether a code minted before then exists, so the
 * verified ?ff= enrolment in sona.js keeps working for those families.
 */
export const runtime = "nodejs";

async function kvCmd(cmd: (string | number)[]): Promise<unknown> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) return undefined;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    if (!r.ok) return undefined;
    const j = (await r.json()) as { result?: unknown };
    return j.result;
  } catch {
    return undefined;
  }
}

/**
 * GET ?id=<code> → { ok, valid } — does this founding code actually exist?
 * The client validates before granting free pilot access, so a random
 * ?ff=<anything> can no longer unlock the app. Fail-closed on the client: if
 * this can't confirm valid:true (network error, KV down), no unlock happens.
 * If KV isn't configured, valid:false (there are no real codes to honor).
 */
export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, { key: "founding-check", limit: 30, windowSec: 60 });
  if (rl) return rl;
  const id = (new URL(req.url).searchParams.get("id") || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 24).toLowerCase();
  if (!id) return NextResponse.json({ ok: true, valid: false });
  const rec = await kvCmd(["GET", "ff:app:" + id]);
  return NextResponse.json({ ok: true, valid: !!rec });
}

/**
 * POST: Founding Families places are closed (Travis, 14 Nov 2026). The old
 * form took a child's first name and a parent's cell, kept them for good and
 * forwarded them to a CRM webhook, and gave any sign-up a free Premium link.
 * Now nothing is read, stored or forwarded: the body is never parsed. GET
 * above stays, so a founding code minted before closing still verifies, and
 * every device already marked keeps Premium (sona.js foundingPilot()).
 */
export async function POST() {
  return NextResponse.json(
    { ok: false, closed: true, error: "Founding Families places are closed." },
    { status: 410 },
  );
}
