import { NextRequest, NextResponse } from "next/server";
import { kvCmd, signSession, sessionCookie, SESSION_MAX_AGE } from "@/lib/slpAuth";
import { CURRENT_TERMS } from "@/lib/caseload";
import { acceptInvite } from "@/lib/clinic";

export const runtime = "nodejs";

/**
 * GET /api/slp/clinic/accept?token=… — the link in a clinic invite email.
 *
 * Tapping it is the proof the inbox is theirs, exactly like the sign-in
 * link, so it signs the clinician in and makes their seat live in one step.
 * An account that does not exist yet is created with the current terms;
 * one that does is never rewritten (its `terms` is a promise).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  let got: { member: string; owner: string } | null = null;
  try { got = await acceptInvite(token); } catch { got = null; }
  if (!got) return NextResponse.redirect(url.origin + "/slp-login.html?err=expired");

  const acctKey = "slpacct:" + got.member;
  let acct: Record<string, unknown> | null = null;
  const raw = await kvCmd(["GET", acctKey]);
  if (raw) { try { acct = JSON.parse(String(raw)); } catch { acct = null; } }
  if (raw === null) {
    acct = { email: got.member, name: "", clinic: "", code: "", createdAt: new Date().toISOString(), source: "clinic-invite", terms: CURRENT_TERMS };
    await kvCmd(["SET", acctKey, JSON.stringify(acct)]);
  }
  const session = signSession({ email: got.member, code: String((acct && acct.code) || ""), iat: Date.now(), exp: Date.now() + SESSION_MAX_AGE * 1000 });
  const res = NextResponse.redirect(url.origin + "/slp.html?joined=clinic");
  res.headers.set("Set-Cookie", sessionCookie(session, SESSION_MAX_AGE));
  return res;
}
