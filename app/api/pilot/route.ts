import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { verifyTicket } from "@/lib/slpAuth";

/**
 * Pilot outcome capture — receives a child's CONSENTED practice progress and
 * upserts it into that clinician's roster (slp:<code> in Vercel KV / Upstash),
 * which is the only destination.
 *
 * AUTHENTICATED. This used to accept any POST that named a code, so anyone who
 * had seen a share link — the code is also derived from the clinician's email
 * stem — could invent children, outcomes and streaks and watch them appear on
 * a real therapist's dashboard as clinical fact. A write now requires an
 * enrolment ticket, which /api/slp/redeem mints only after the family key, the
 * per-code cap and the per-IP limit have all passed.
 *
 * Three layers, because a roster is clinical data a clinician will act on:
 *   - ticket: proves the device passed code+key
 *   - per-IP rate limit: bounds a leaked credential
 *   - per-code roster cap: bounds it again, so one leaked link can't invent a
 *     thousand children even with a valid ticket
 */
export const runtime = "nodejs";

// Tiny KV over REST (Vercel KV / Upstash) — no SDK. undefined if not configured.
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

const ROSTER_CAP = 200; // a real caseload is well under this; a forger is not

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { key: "pilot", limit: 60, windowSec: 3600 });
  if (rl) return rl;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.slice(0, 48) : "";
  const ticket = typeof body.ticket === "string" ? body.ticket : (req.headers.get("x-sona-ticket") || "");
  if (!code || !verifyTicket(ticket, code)) {
    return NextResponse.json({ ok: false, error: "enrolment not verified" }, { status: 401 });
  }

  // The grown-up consented to share this child's practice with THEIR CLINICIAN.
  // That is the entire scope. This used to also POST the whole body — name,
  // age, targets, outcomes, streak — to PILOT_WEBHOOK_URL, falling back to
  // LEAD_WEBHOOK_URL, which is the marketing collector. Consent to one
  // recipient is not consent to another, and the fallback quietly made the
  // second recipient a CRM. The roster write below is the only destination.
  const captured = false;

  // Upsert into the SLP roster (keyed slp:<code> → { childId: record }).
  try {
    const b = body as Record<string, any>;
    const childId = typeof b.childId === "string" ? b.childId.slice(0, 48) : "";
    if (code && childId) {
      // Cap the roster. An UPDATE to a child already on it is always allowed —
      // the cap must never freeze a real family's progress — but a NEW child
      // beyond the cap is refused.
      const known = await kvCmd(["HEXISTS", "slp:" + code, childId]);
      if (known !== 1) {
        const size = await kvCmd(["HLEN", "slp:" + code]);
        if (typeof size === "number" && size >= ROSTER_CAP) {
          return NextResponse.json({ ok: false, error: "roster is full" }, { status: 429 });
        }
      }
      const rec = JSON.stringify({
        childId,
        child: b.child || "",
        age: b.age || "",
        focus: b.focus || "",
        goal: b.goal || "",
        outcomes: b.outcomes || {},
        sessions: b.sessions || 0,
        streak: b.streak || 0,
        at: b.at || new Date().toISOString(),
      }).slice(0, 16000);
      await kvCmd(["HSET", "slp:" + code, childId, rec]);
      await kvCmd(["EXPIRE", "slp:" + code, 60 * 60 * 24 * 150]); // ~5 months
    }
  } catch {
    // roster is best-effort
  }

  return NextResponse.json({ ok: true, captured });
}
