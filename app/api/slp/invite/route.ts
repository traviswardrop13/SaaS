import { NextRequest, NextResponse } from "next/server";
import { readSession, kvConfigured, sendParentInviteEmail } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { readAccount, normalizeInvite, createInvite, deleteInvite, cleanToken } from "@/lib/roster";
import { covered, bumpDaily, PARENT_EMAILS_PER_DAY } from "@/lib/caseload";

/**
 * Set a child up BEFORE the family has tapped anything.
 *
 * A clinician finishing a session knows who they just saw and what to
 * practice this fortnight. Until now nothing could reach the dashboard until
 * the family had enrolled AND practiced. An invite holds the first target
 * behind a random token that rides the family's join link; when the family
 * says yes to sharing, their device claims the token (/api/slp/claim) and
 * the target becomes the child's first assignment.
 *
 * AN INVITE HOLDS A LABEL, NOT A NAME. Initials or a nickname, captioned so
 * in the UI. The family enters the child's name themselves when they join,
 * on their own device, and that is the only copy the roster carries; the
 * label is discarded the moment the invite is claimed, and the invite
 * deletes itself after 30 days if nobody taps it. A clinician's browser is
 * not where a child's name should sit waiting.
 *
 * The clinic code comes from the SIGNED-IN account, never a query param — a
 * clinic slug is printed on every family link, and an invite carries a
 * child's name. The link is built here from the same three parts every
 * share link already carries (join.html reads ?slp and ?k; the code is
 * uppercased as the other links do) plus the token.
 *
 * THE PARENT'S EMAIL (24 Sep 2026), optional. A clinician may type it and
 * Sona sends that family ONE email with the join link. The address is used
 * for that send and for nothing else: it is not part of the invite, the
 * index row or the meta (their shapes are exactly what they were), it is not
 * logged, and it never reaches /api/lead or Kit — the only way a parent joins
 * the list is by typing their own email under the consent line on
 * join.html. The daily limit counts sends per CLINICIAN, keyed on the
 * clinician, so even the meter holds nothing about the parent.
 */
export const runtime = "nodejs";

// The same shape /api/slp/auth/request accepts, and no longer than an
// address can be (RFC 5321).
function parentEmailOf(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return "";
  const e = String(v).trim();
  if (!e) return "";
  if (e.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return null;
  return e;
}

async function gate(req: NextRequest): Promise<{ code: string; familyKey: string; email: string; name: string } | NextResponse> {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(req, { key: "slpinvite", limit: 60, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) {
    return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  }
  const { code, familyKey, name, clinic } = await readAccount(s.email);
  // No key, no link: a link without the key is an honor system, and the
  // account route mints a key alongside every code, so this only fires for
  // a profile that was never finished.
  if (!code || !familyKey) return NextResponse.json({ ok: false, error: "finish your profile first" }, { status: 400 });
  return { code, familyKey, email: s.email, name: name || clinic };
}

async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// POST { label, age, sounds, pos, repsPerDay, note, parentEmail? } → { ok, invite, link, emailed, emailError? }
export async function POST(req: NextRequest) {
  const g = await gate(req);
  if (g instanceof NextResponse) return g;
  const body = await readBody(req);
  if (!body) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });

  // Checked BEFORE the invite exists, so a typo is fixed in the composer
  // rather than leaving an invite made and an email that never went.
  const parentEmail = parentEmailOf(body.parentEmail);
  if (parentEmail === null) {
    return NextResponse.json({ ok: false, error: "that email doesn't look right — check it, or leave it blank" }, { status: 400 });
  }

  // Everything is clamped the way homework is clamped, except the label,
  // which is required — it is all the pending list can show.
  const fields = normalizeInvite(body);
  if ("error" in fields) return NextResponse.json({ ok: false, error: fields.error }, { status: 400 });

  const invite = await createInvite(g.code, fields);
  if (!invite) {
    return NextResponse.json({ ok: false, error: "too many pending invites — delete some first" }, { status: 429 });
  }
  const link =
    new URL(req.url).origin +
    "/join.html?slp=" + encodeURIComponent(g.code.toUpperCase()) +
    "&k=" + encodeURIComponent(g.familyKey) +
    "&inv=" + encodeURIComponent(invite.token);

  // The invite exists and the link works whatever happens below: an email
  // that fails is reported, never turned into a failed invite.
  let emailed = false;
  let emailError = "";
  if (parentEmail) {
    const n = await bumpDaily("slpinvmail", g.email);
    if (n === null) {
      emailError = "Couldn't send the email just now. Copy the link and send it yourself.";
    } else if (n > PARENT_EMAILS_PER_DAY) {
      emailError = "That's " + PARENT_EMAILS_PER_DAY + " emails today, the daily limit. Copy the link and send it yourself.";
    } else {
      // The Premium line goes in only when the caseload is covered right
      // now; if that cannot be confirmed, the email promises less, not more.
      let isCovered = false;
      try { isCovered = await covered(g.email); } catch { isCovered = false; }
      const sent = await sendParentInviteEmail(parentEmail, link, g.name, isCovered);
      emailed = sent.sent;
      if (!sent.sent) emailError = sent.error || "The email didn't go through.";
    }
  }
  return NextResponse.json(emailError ? { ok: true, invite, link, emailed, emailError } : { ok: true, invite, link, emailed });
}

// DELETE { token } → { ok, removed: token }
export async function DELETE(req: NextRequest) {
  const g = await gate(req);
  if (g instanceof NextResponse) return g;
  const body = await readBody(req);
  if (!body) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });

  const token = cleanToken(body.token);
  if (!token) return NextResponse.json({ ok: false, error: "which invite?" }, { status: 400 });
  const gone = await deleteInvite(g.code, token);
  if (!gone) return NextResponse.json({ ok: false, error: "no such invite" }, { status: 404 });
  return NextResponse.json({ ok: true, removed: token });
}
