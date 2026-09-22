import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { readTicket, rosterKey, ticketOwnsChild } from "@/lib/slpAuth";
import { isGone, fitRosterRecord } from "@/lib/roster";

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
const CONSENT_VER = "join-2026-09"; // the consent wording on join.html when this row was written

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
  const t = code ? readTicket(ticket, code) : null;
  if (!t) {
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

    // WHICH child this ticket may write for. Verifying the ticket only proves
    // the device passed SOME family's code+key for this clinic — it says
    // nothing about whose row this is. Without the check below, a family
    // holding a valid ticket could post under another child's id and replace
    // that child's name, age, outcomes, sessions and streak on a real
    // clinician's dashboard, as clinical fact.
    //
    // Tickets minted since the binding carry `cid` and are checked directly.
    // Older unbound ones bind to the first child they claim (see
    // ticketOwnsChild) so existing families keep syncing without a break,
    // while a stolen ticket stays confined to one row.
    if (childId) {
      const owns = t.cid ? t.cid === childId : await ticketOwnsChild(ticket, childId);
      if (!owns) {
        return NextResponse.json({ ok: false, error: "not your child" }, { status: 403 });
      }
    }

    const key = rosterKey(code);           // canonical — never build this by hand
    if (code && childId) {
      // A child taken off the caseload — by the clinician, or by the family's
      // own "stop sharing" — stays off. The device still holds a valid ticket
      // and syncs after every practice, so without this the deleted row would
      // be back within the hour. Answered with a plain ok and NO write: the
      // device ignores failures either way, and a 2xx keeps its logs quiet.
      // The mark is lifted only by a fresh invite being claimed.
      if (await isGone(code, childId)) {
        return NextResponse.json({ ok: true, captured });
      }
      // Cap the roster. An UPDATE to a child already on it is always allowed —
      // the cap must never freeze a real family's progress — but a NEW child
      // beyond the cap is refused.
      const known = await kvCmd(["HEXISTS", key, childId]);
      if (known !== 1) {
        const size = await kvCmd(["HLEN", key]);
        if (typeof size === "number" && size >= ROSTER_CAP) {
          return NextResponse.json({ ok: false, error: "roster is full" }, { status: 429 });
        }
      }
      // consentAt is what the device recorded when the grown-up tapped Yes;
      // consentVer names the wording they saw (join.html, Sep 2026), so a
      // later change to that copy can tell who agreed to what.
      const rec = fitRosterRecord({
        childId,
        child: b.child || "",
        age: b.age || "",
        focus: b.focus || "",
        goal: b.goal || "",
        outcomes: b.outcomes || {},
        sessions: b.sessions || 0,
        streak: b.streak || 0,
        consentAt: typeof b.consentAt === "string" ? b.consentAt.slice(0, 40) : "",
        consentVer: CONSENT_VER,
        at: b.at || new Date().toISOString(),
      });
      await kvCmd(["HSET", key, childId, rec]);
      await kvCmd(["EXPIRE", key, 60 * 60 * 24 * 150]); // ~5 months
    }
  } catch {
    // roster is best-effort
  }

  return NextResponse.json({ ok: true, captured });
}
