import { NextRequest, NextResponse } from "next/server";
import { readSession, kvCmd, kvConfigured, rosterKey } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { readAccount, cleanChildId, cleanToken, metaKey, readInviteData } from "@/lib/roster";
import { dashboardGate } from "@/lib/proGate";
import { makeLogin, deleteLogin, readLoginIndex, LOGIN_TTL, type LoginRef } from "@/lib/familyLogin";

/**
 * A clinician makes a login for a family (lib/familyLogin): a username and a
 * password the family types into the Sona app to connect, instead of a link
 * that opens in Safari. Made for a child the clinician has ADDED (an invite):
 * that is where a new family starts, and the invite's first target reaches
 * the child when the family says yes to sharing. Once the family joins, the
 * login belongs to that child, and the clinician can give it a new password
 * (a forgotten one) or delete it, from the child's page.
 *
 * The password is in the response ONCE and nowhere else: the store keeps
 * only its hash, so the dashboard can never show it again. "New password"
 * makes another.
 *
 * The clinic code comes from the SIGNED-IN account, never the request (the
 * rule every clinician route keeps). Making a login is Sona Pro's, as making
 * an invite is (lib/proGate); deleting one works whatever the clinician pays.
 */
export const runtime = "nodejs";

async function gate(req: NextRequest, write = true): Promise<{ code: string; email: string } | NextResponse> {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(req, { key: "slplogin", limit: 60, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  if (write) {
    const locked = await dashboardGate(s.email);
    if (locked) return locked;
  }
  const { code } = await readAccount(s.email);
  if (!code) return NextResponse.json({ ok: false, error: "finish your profile first" }, { status: 400 });
  return { code, email: s.email };
}

async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function refOf(body: Record<string, unknown>): LoginRef | null {
  const inv = cleanToken(body.inv);
  const cid = cleanChildId(body.childId);
  if (inv && !cid) return { inv };
  if (cid && !inv) return { cid };
  return null;
}

// POST { inv } (a new login, or a new password) | { childId } (a new password)
//   → { ok, user, password, reset }
export async function POST(req: NextRequest) {
  const g = await gate(req);
  if (g instanceof NextResponse) return g;
  const body = await readBody(req);
  const ref = body && refOf(body);
  if (!ref) return NextResponse.json({ ok: false, error: "which child?" }, { status: 400 });

  let ttl = LOGIN_TTL;
  if (ref.inv) {
    // Still waiting for the family: an unused login lives no longer than the
    // invite it was made for, so nothing outlasts what the dashboard lists.
    const data = await readInviteData(g.code, ref.inv);
    if (!data) return NextResponse.json({ ok: false, error: "That invite has expired or the family already joined." }, { status: 404 });
    ttl = Math.floor((Date.parse(data.expiresAt) - Date.now()) / 1000);
  } else {
    // A joined child: only the login the family joined with, given a new
    // password. A fresh login for a child who joined by link would bring a
    // second phone in as a second child (see /api/family/login).
    const index = await readLoginIndex(g.code);
    if (!index["cid:" + ref.cid]) {
      return NextResponse.json({ ok: false, error: "This child has no login. Logins are made when you add a child." }, { status: 400 });
    }
    const [r, m] = await Promise.all([
      kvCmd(["HEXISTS", rosterKey(g.code), String(ref.cid)]),
      kvCmd(["HEXISTS", metaKey(g.code), String(ref.cid)]),
    ]);
    if (r !== 1 && m !== 1) return NextResponse.json({ ok: false, error: "not on your caseload" }, { status: 404 });
  }
  const made = await makeLogin(g.code, g.email, ref, { ttl });
  if (!made) return NextResponse.json({ ok: false, error: "Couldn't make a login just now — try again." }, { status: 503 });
  return NextResponse.json({ ok: true, user: made.user, password: made.password, reset: made.reset });
}

// DELETE { inv } | { childId } → { ok, removed }
export async function DELETE(req: NextRequest) {
  const g = await gate(req, false);
  if (g instanceof NextResponse) return g;
  const body = await readBody(req);
  const ref = body && refOf(body);
  if (!ref) return NextResponse.json({ ok: false, error: "which child?" }, { status: 400 });
  const gone = await deleteLogin(g.code, ref);
  if (!gone) return NextResponse.json({ ok: false, error: "no login to delete" }, { status: 404 });
  return NextResponse.json({ ok: true, removed: true });
}
