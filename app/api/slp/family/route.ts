import { NextRequest, NextResponse } from "next/server";
import { readSession, liveSession, kvConfigured, kvCmd, makeFamilyKey, replaceSlpAccount, sendFamilyLoginEmail } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { foreignOrigin } from "@/lib/origin";
import { readAccount, normalizeInvite, createInvite, deleteInvite } from "@/lib/roster";
import { covered, bumpDaily, PARENT_EMAILS_PER_DAY } from "@/lib/caseload";
import { dashboardGate } from "@/lib/proGate";
import { makeLogin } from "@/lib/familyLogin";
import { familyInvite, parentEmailOf } from "@/lib/addFamily";

/**
 * ADD A FAMILY (SLPCLEAN1, 17 Nov 2026; Travis: "top right, instead of copy
 * app link, I want ... a way that they can automatically create a custom
 * login username password for a parent with their email after they've
 * created a free trial that they can automatically and super easily share").
 *
 * One step, from the dashboard's "Add a family" panel, built from the two
 * that already existed: an invite (as /api/slp/invite makes it: initials,
 * never a name; it deletes itself in 30 days if nobody uses it) and a login
 * for that invite (as /api/slp/login makes it: the password returned once,
 * only its hash kept). Then ONE email to the parent with the app, the login
 * and the web link (lib/slpAuth sendFamilyLoginEmail).
 *
 * Every wall the two routes had: a live session, this site's own page, both
 * routes' rate limits, a store or nothing, the dashboard's plan (lib/proGate),
 * a finished profile, the pending-invite cap, and the 30-a-day parent email
 * cap shared with the invite's email. The sign-up cap is counted where it
 * always was, when the family logs in (lib/signups).
 *
 * THE PARENT'S ADDRESS is used for that one send: it is not part of the
 * invite or the login, and it is never logged. GoHighLevel, which sends it,
 * keeps it as a contact (lib/mail); the panel no longer says so (Travis, 20 Nov 2026). THE PASSWORD travels in the email too:
 * Travis's accepted trade-off (see sendFamilyLoginEmail). The clinic code
 * comes from the signed-in account, never the request.
 */
export const runtime = "nodejs";

function error(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

// POST { parentEmail, label?, age?, sounds? }
//   → { ok, invite, link, user, password, emailed, emailError? }
export async function POST(req: NextRequest) {
  const s = await liveSession(readSession(req));
  if (!s) return error("sign in required", 401);
  if (foreignOrigin(req)) return error("Open this from your dashboard.", 403);
  const rl = await rateLimit(req, { key: "slpinvite", limit: 60, windowSec: 3600 });
  if (rl) return rl;
  const rl2 = await rateLimit(req, { key: "slplogin", limit: 60, windowSec: 3600 });
  if (rl2) return rl2;
  if (!kvConfigured()) return error("no data store connected", 503);
  const locked = await dashboardGate(s.email);
  if (locked) return locked;
  const { code, familyKey: storedKey, name, clinic } = await readAccount(s.email);
  if (!code) return error("Finish your profile first: pick your code, then add families.", 400);
  // AN OLDER ACCOUNT WITH A CODE BUT NO FAMILY KEY (20 Nov 2026: Travis's own
  // met "Finish your profile first" with a code already set). Every account
  // with a code carries one, as /api/slp/account mints it; mint it here too,
  // written only if the account is unchanged since it was read.
  let familyKey = storedKey;
  if (!familyKey) {
    const acctKey = "slpacct:" + s.email;
    let raw: unknown = null;
    try { raw = await kvCmd(["GET", acctKey]); } catch { raw = null; }
    if (typeof raw !== "string") return error("Couldn't reach your account just now. Try again in a moment.", 503);
    let acct: Record<string, unknown>;
    try { acct = JSON.parse(raw) as Record<string, unknown>; } catch { return error("Couldn't read your account. Try again in a moment.", 503); }
    if (typeof acct.familyKey === "string" && acct.familyKey) familyKey = acct.familyKey;
    else {
      acct.familyKey = makeFamilyKey();
      if ((await replaceSlpAccount(acctKey, raw, acct)) !== "OK") return error("Your account changed while saving. Try again.", 409);
      familyKey = acct.familyKey as string;
    }
  }

  let body: Record<string, unknown> | null = null;
  try { body = (await req.json()) as Record<string, unknown>; } catch { body = null; }
  if (!body || typeof body !== "object" || Array.isArray(body)) return error("bad request", 400);

  // Checked before anything exists, so a typo is fixed in the panel.
  const parentEmail = parentEmailOf(body.parentEmail);
  if (parentEmail === "") return error("Add the parent's email.", 400);
  if (parentEmail === null) return error("That email doesn't look right. Check it and try again.", 400);

  const fields = normalizeInvite(familyInvite(body));
  if ("error" in fields) return error(fields.error, 400);
  const invite = await createInvite(code, fields);
  if (!invite) return error("Too many families are waiting to join. Cancel some in Caseload first.", 429);

  // An unused login lives no longer than its invite, as /api/slp/login sets it.
  const ttl = Math.floor((Date.parse(invite.expiresAt) - Date.now()) / 1000);
  const made = await makeLogin(code, s.email, { inv: invite.token }, { ttl });
  if (!made) {
    // Nothing half-made: no invite without its login.
    await deleteInvite(code, invite.token);
    return error("Couldn't make a login just now. Try again.", 503);
  }
  const link =
    new URL(req.url).origin +
    "/join.html?slp=" + encodeURIComponent(code.toUpperCase()) +
    "&k=" + encodeURIComponent(familyKey) +
    "&inv=" + encodeURIComponent(invite.token);

  // The login exists and works whatever happens below: an email that fails
  // is reported, and the panel offers the message to copy or text instead.
  let emailed = false;
  let emailError = "";
  const n = await bumpDaily("slpinvmail", s.email);
  if (n === null) {
    emailError = "Couldn't send the email just now.";
  } else if (n > PARENT_EMAILS_PER_DAY) {
    emailError = "That's " + PARENT_EMAILS_PER_DAY + " emails today, the daily limit.";
  } else {
    // The Premium line only when the caseload is covered right now; if that
    // cannot be confirmed, the email promises less, not more.
    let isCovered = false;
    try { isCovered = await covered(s.email); } catch { isCovered = false; }
    const sent = await sendFamilyLoginEmail(parentEmail, { user: made.user, password: made.password, link }, name || clinic, isCovered);
    emailed = sent.sent;
    if (!sent.sent) emailError = sent.error || "The email didn't go through.";
  }
  const out: Record<string, unknown> = { ok: true, invite, link, user: made.user, password: made.password, emailed };
  if (emailError) out.emailError = emailError;
  return NextResponse.json(out);
}
