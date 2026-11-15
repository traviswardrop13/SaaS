import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { kvCmd, kvConfigured, signTicket } from "@/lib/slpAuth";
import { verifyLogin, markUsed } from "@/lib/familyLogin";
import { countSignup, CAPPED_LOGIN_ERROR } from "@/lib/signups";
import { cleanChildId, readInviteData } from "@/lib/roster";

/**
 * A family logs in with the username and password their clinician made for
 * them (lib/familyLogin says why a login exists, and what it never stores).
 *
 * What a right password earns is exactly what the clinician's link earns at
 * /api/slp/redeem, through the same gates in the same order: a per-IP limit,
 * the store or nothing (no KV is never a free pass), the credential, the
 * clinician's sign-up cap (lib/signups, the same counters as the link), and
 * only then the enrolment ticket, bound to this device's own child id. The
 * device does the rest as it does after a link: it asks whether this
 * caseload is covered, and asks the grown-up whether to share progress.
 *
 * Plus the invite token, while the invite the login was made for is still
 * waiting: that is what lets a "Yes, share progress" claim it, so the
 * clinician's first target becomes this child's first assignment. A login
 * whose invite was claimed already (by the family's first phone) carries no
 * token: this phone joins as a new device, never as the first phone's child,
 * because a roster row is written whole by its device and a fresh phone would
 * wipe the practice the clinician can see.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { key: "famlogin", limit: 20, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) {
    return NextResponse.json({ ok: false, error: "Signing in is unavailable right now — try again soon." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  // The device's own opaque child id, minted before the request, so the
  // ticket is bound to this child as redeem binds it.
  const childId = cleanChildId(body.childId);

  const v = await verifyLogin(body.username, body.password);
  if ("error" in v) {
    if (v.error === "locked") {
      return NextResponse.json(
        { ok: false, valid: false, error: "Too many tries. Wait an hour, or ask your speech therapist for a new password." },
        { status: 429 },
      );
    }
    return NextResponse.json({ ok: true, valid: false });
  }
  const rec = v.rec;

  // The clinician behind the login still holds this code. An account that is
  // gone takes its logins with it.
  const owner = await kvCmd(["GET", "slpcode:" + rec.code]);
  if (!owner || String(owner).trim().toLowerCase() !== rec.owner) {
    return NextResponse.json({ ok: true, valid: false });
  }
  let acct: { name?: string; clinic?: string } = {};
  try { acct = JSON.parse(String((await kvCmd(["GET", "slpacct:" + String(owner)])) || "{}")); } catch { acct = {}; }

  if (await countSignup(rec.code, rec.owner)) {
    return NextResponse.json({ ok: false, error: CAPPED_LOGIN_ERROR }, { status: 429 });
  }
  await markUsed(rec);

  let inv = "";
  if (rec.inv && !rec.cid && (await readInviteData(rec.code, rec.inv))) inv = rec.inv;

  return NextResponse.json({
    ok: true,
    valid: true,
    user: rec.user,
    code: rec.code.toUpperCase(),
    name: String(acct.clinic || acct.name || ""),
    ticket: signTicket(rec.code, 400, childId),
    inv,
  });
}
