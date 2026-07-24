import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Records a no-card free-trial start, keyed by email, in KV — so a trial
 * survives a device switch and the day-6 conversion-nudge job can find trials
 * that are about to expire. Best-effort: with no KV configured it no-ops, and
 * the client still works off its localStorage copy.
 *
 * The `trials` set feeds the weekly parent email, so this endpoint is
 * rate-limited and the set is size-capped: an attacker must not be able to
 * enroll strangers en masse or flood the recipient list. (Full double
 * opt-in is the tracked follow-up.)
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

export async function POST(req: NextRequest) {
  const _rl = await rateLimit(req, { key: "trial", limit: 10, windowSec: 60 });
  if (_rl) return _rl;
  let body: { email?: string; start?: number; days?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  const start = Number(body.start) || Date.now();
  const days = Number(body.days) || 7;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    // No usable email yet (lazy start) — nothing to persist; client keeps its copy.
    return NextResponse.json({ ok: true, stored: false });
  }
  try {
    const rec = JSON.stringify({ email, start, days, at: Date.now() });
    // Only set on first start so we never push the expiry out on repeat calls.
    await kvCmd(["SET", "trial:" + email, rec, "NX"]);
    await kvCmd(["EXPIRE", "trial:" + email, 60 * 60 * 24 * 60]); // ~2 months
    // size-capped index for the nudge job + weekly email — a flooded set
    // must never displace real families or blow up the cron's read
    const size = Number(await kvCmd(["SCARD", "trials"])) || 0;
    if (size < 5000) await kvCmd(["SADD", "trials", email]);
  } catch {
    // best-effort
  }
  return NextResponse.json({ ok: true, stored: true });
}
