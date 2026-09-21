import { NextRequest, NextResponse } from "next/server";
import { readSession, kvConfigured } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { readAccount, normalizeInvite, createInvite, deleteInvite, cleanToken } from "@/lib/roster";

/**
 * Set a child up BEFORE the family has tapped anything.
 *
 * A clinician finishing a session knows who they just saw and what to
 * practise this fortnight. Until now nothing could reach the dashboard until
 * the family had enrolled AND practised. An invite holds the first target
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
 */
export const runtime = "nodejs";

async function gate(req: NextRequest): Promise<{ code: string; familyKey: string } | NextResponse> {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(req, { key: "slpinvite", limit: 60, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) {
    return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  }
  const { code, familyKey } = await readAccount(s.email);
  // No key, no link: a link without the key is an honor system, and the
  // account route mints a key alongside every code, so this only fires for
  // a profile that was never finished.
  if (!code || !familyKey) return NextResponse.json({ ok: false, error: "finish your profile first" }, { status: 400 });
  return { code, familyKey };
}

async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// POST { label, age, sounds, pos, repsPerDay, note } → { ok, invite, link }
export async function POST(req: NextRequest) {
  const g = await gate(req);
  if (g instanceof NextResponse) return g;
  const body = await readBody(req);
  if (!body) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });

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
  return NextResponse.json({ ok: true, invite, link });
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
