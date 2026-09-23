import { NextRequest, NextResponse } from "next/server";
import { readTicket, kvCmd, kvConfigured } from "@/lib/slpAuth";
import { normalizeHomework, readHomework, writeHomework, isoDay, type Homework, type HomeworkRecord } from "@/lib/homework";
import { rateLimit } from "@/lib/rateLimit";
import {
  cleanChildId, cleanToken, readInviteData, claimInvite, claimHolder, finishClaim, writeMeta, unmarkGone, readAccount,
} from "@/lib/roster";

/**
 * The family's device claims the invite its clinician set up.
 *
 * Called from join.html after the grown-up taps "Yes, share progress" —
 * never before, and never on No, because the invite is the clinician's plan
 * for this child and a family that declined sharing has not agreed to be on
 * the roster at all.
 *
 * NO SESSION, because it is a phone calling, not a clinician. What stands in
 * for one is two proofs the device cannot forge:
 *   - the enrolment ticket, minted by /api/slp/redeem only after the family
 *     key, the per-code cap and the per-IP limit all passed, and BOUND to
 *     the child it was minted for. A ticket without that binding is refused
 *     outright here: this flow never produces one (join.html mints the child
 *     id before it redeems), so an unbound ticket on this route is a replay
 *     of something older, not a family.
 *   - the invite token, twelve random characters that travel only in the
 *     link the clinician themselves handed out, and single-use: the first
 *     device to claim it wins, and a second is told it was used.
 *
 * NOTHING ABOUT THE CHILD IS READ FROM THE REQUEST, and nothing about the
 * child is written FROM THE INVITE either. The invite's label is discarded
 * here; the roster row will carry the name the parent types on their own
 * device (/api/pilot), and slpmeta records only when this child was invited
 * and joined. What the claim does carry over is the clinician's first
 * target, which becomes the child's first homework so their device picks it
 * up on its next sync.
 *
 * Fails CLOSED without KV: an invite that cannot be checked is not claimed.
 */
export const runtime = "nodejs";

const FIRST_ASSIGNMENT_DAYS = 14;   // today through today+13: two weeks, the usual gap between sessions

function plusDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return isoDay(new Date(Date.UTC(y, m - 1, d + n)));
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { key: "slpclaim", limit: 30, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) {
    return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }

  const code = String(body.code || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  const childId = cleanChildId(body.childId);
  const inv = cleanToken(body.inv);
  const ticket = String(body.ticket || "");
  if (!code || !childId || !inv) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });

  // No ticket, no claim. A device that never passed the clinician's code+key
  // check has no standing to attach itself to a child on their caseload.
  const t = readTicket(ticket, code);
  if (!t) return NextResponse.json({ ok: false, error: "not enrolled" }, { status: 401 });
  // WHICH child — and only a ticket that says. The binding is what stops one
  // family on a caseload claiming an invite under another child's id, and
  // this flow always mints a bound ticket, so an unbound one is refused
  // rather than bound on first use.
  if (!t.cid || t.cid !== childId) {
    return NextResponse.json({ ok: false, error: "not your child" }, { status: 403 });
  }

  const data = await readInviteData(code, inv);
  if (!data) {
    // The data key is gone: the 30 days ran out, the clinician deleted it, or
    // it was claimed and its label discarded. Only the last of those can be
    // THIS device tapping its own link again, and that is not an error.
    if ((await claimHolder(code, inv)) === childId) {
      const rec = await readHomework(code, childId);
      return NextResponse.json({ ok: true, claimed: true, again: true, sounds: rec.hw?.sounds || [], pos: rec.hw?.pos || "" });
    }
    return NextResponse.json({ ok: true, claimed: false, reason: "expired" });
  }

  // Single use. SET NX: exactly one device wins the token; the device that
  // won may pass again ("mine") to finish a claim that failed part-way.
  const race = await claimInvite(code, inv, childId);
  if (race === "used") return NextResponse.json({ ok: true, claimed: false, reason: "used" });

  // A claim is the clinician inviting this family (back): it lifts any
  // "gone" mark first, so the enrolment write the device fires alongside
  // this request is not swallowed for a child the clinician just asked for.
  await unmarkGone(code, childId);

  const now = new Date().toISOString();

  // The invite's target becomes the child's first assignment, on a fresh
  // ledger, so the device picks it up on its next sync and tomorrow's words
  // are the clinician's — the same rule /api/slp/homework applies when a
  // clinician assigns by hand. An invite with no sounds sets no homework.
  let hw: Homework | null = null;
  if (data.sounds.length) {
    // The byline the parent sees: the clinician's account name, resolved
    // from the code the way /api/slp/redeem does (slpcode:<code> names the
    // account). Never from the request.
    let by = "";
    const owner = await kvCmd(["GET", "slpcode:" + code]);
    if (owner && typeof owner === "string") by = (await readAccount(owner)).name;
    const today = isoDay();
    hw = normalizeHomework(
      {
        title: "",
        note: data.note,
        sounds: data.sounds,
        pos: data.pos,
        repsPerDay: data.repsPerDay,
        start: today,
        due: plusDays(today, FIRST_ASSIGNMENT_DAYS - 1),
      },
      { by, childAge: parseInt(data.age, 10) || 0 },
    );
    const rec: HomeworkRecord = { hw, progress: { id: hw.id, days: {}, updatedAt: now } };
    await writeHomework(code, childId, rec);
  }

  // Only WHEN: joined now, invited then. No label, no age — the enrol beacon
  // the device fires beside this request carries what the parent typed, and
  // the roster row is the one place that lives.
  await writeMeta(code, childId, { joinedAt: now, invitedAt: data.createdAt });

  // Closed LAST, so a failure part-way leaves the data key for the same
  // device to retry against, rather than a claimed row with nothing behind it.
  await finishClaim(code, inv, childId);

  return NextResponse.json({ ok: true, claimed: true, sounds: data.sounds, pos: data.pos });
}
