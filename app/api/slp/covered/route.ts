import { NextRequest, NextResponse } from "next/server";
import { kvCmd, kvConfigured, readTicket, signTicket, authSecretOk } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { covered, selfAccess, StoreUnavailable } from "@/lib/caseload";

/**
 * POST /api/slp/covered { code, ticket } → { ok, covered, ticket? }
 *
 * The family device's question, asked every six hours (Sona.caseRefresh):
 * does the clinician whose link I joined through still cover Premium for me?
 *
 * PROOF, NOT A CLAIM. The device shows the enrolment ticket /api/slp/redeem
 * handed it — the proof it passed that clinician's code and key — and the
 * answer is about that clinician: grandfathered, or paying for a live plan.
 * No ticket, no answer (401): knowing a code is not enough to learn whether
 * a clinician pays.
 *
 * ACCESS IS NOT SHARING. A family who said "No thanks" to sharing progress
 * is still covered: they redeemed the clinician's link, and that is what the
 * clinician paid for. So this needs no sharing consent and writes nothing —
 * above all, it never INCRs slpredeem: asking again is not joining again.
 *
 * THE CLINICIAN'S OWN PHONE. A ticket minted from the single-use link that
 * was emailed to the clinician's own address carries `self: 1`; that phone
 * is covered while the clinician is self-eligible (a work email, or the
 * founder's approval) even when their caseload is not.
 *
 * Only an AUTHORITATIVE answer is a 200. When the store cannot be read this
 * is a 503, and the device keeps whatever it had: a blip must never read as
 * "your Premium ended".
 *
 * AN EXPIRED TICKET STILL GETS THE TRUTH, AND A NEW TICKET (24 Sep 2026).
 * Tickets last 400 days and redeem is the only place that mints one, while
 * the device reads a 401 as "change nothing". So from day 400 a family's
 * coverage froze in whatever state it was last in: a cancelled clinician's
 * families kept Premium forever, and a clinician who started paying could
 * never reach families whose tickets had run out. Now a ticket whose
 * SIGNATURE and CODE are good is answered at any age (readTicket's
 * ignoreExpiry skips only the date), and every 200 for a ticket past half
 * its life carries `ticket`: the same code, child and own-phone flag, signed
 * afresh for another 400 days. The device stores it (Sona.caseRefresh), so a
 * phone that keeps checking never reaches the date at all. A forged ticket,
 * or one for another code, is still a 401.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
// The ticket's life, as redeem mints it, and the point past which an answer
// re-issues it. A ticket carries no issue date, so its age is read from what
// is left: fewer than RENEW_DAYS remaining is older than half its life.
const TICKET_DAYS = 400;
const RENEW_DAYS = 200;

function norm(s: string): string {
  return String(s || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
}

function unavailable(): NextResponse {
  return NextResponse.json({ ok: false, error: "Couldn't check right now." }, { status: 503, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { key: "slpcovered", limit: 120, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) return unavailable();
  // A deployment that cannot verify ANY ticket (production with no
  // SLP_AUTH_SECRET) has nothing to say about this one. Answering 401 would
  // tell every family device its proof is bad; 503 tells it to wait.
  if (!authSecretOk()) return unavailable();

  let body: { code?: unknown; ticket?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const code = norm(String(body.code || ""));
  const t = code ? readTicket(String(body.ticket || ""), code, { ignoreExpiry: true }) : null;
  if (!t) return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });

  const owner = await kvCmd(["GET", "slpcode:" + code]);
  if (owner === undefined) return unavailable();
  // A code nobody owns any more covers nobody — an authoritative no. No new
  // ticket either: there is no clinician left for it to prove anything to.
  if (!owner || typeof owner !== "string") return NextResponse.json({ ok: true, covered: false }, { headers: NO_STORE });

  try {
    let yes = await covered(owner);
    if (!yes && t.self === 1) yes = (await selfAccess(owner)).eligible;
    // Re-issued only here, after the answer — a 503 or a 401 hands out
    // nothing. Same code, same child binding, same own-phone flag: renewal
    // extends the proof the device already had and never widens it.
    const renew = Number(t.exp) - Date.now() < RENEW_DAYS * 86400000;
    const fresh = renew ? signTicket(t.code, TICKET_DAYS, t.cid || "", { self: t.self === 1 }) : null;
    return NextResponse.json(fresh ? { ok: true, covered: yes, ticket: fresh } : { ok: true, covered: yes }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof StoreUnavailable) return unavailable();
    throw e;
  }
}
