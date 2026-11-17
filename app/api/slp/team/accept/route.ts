import { NextRequest, NextResponse } from "next/server";
import { kvConfigured, authSecretOk, signFreeDashboardSignup } from "@/lib/slpAuth";
import { finishSignIn } from "@/lib/slpSignIn";
import { StoreUnavailable } from "@/lib/caseload";
import { acceptInvite } from "@/lib/team";

export const runtime = "nodejs";

/**
 * GET /api/slp/team/accept?token=… — the link in a Sona Clinic invite email
 * (17 Nov 2026; lib/team).
 *
 * Tapping it is the clinician's yes, and the proof the inbox is theirs, as
 * the sign-in link is: so it joins them to the clinic AND signs them in, in
 * one step, through the sign-in link's own path (lib/slpSignIn finishSignIn:
 * a new account is made with Sona Pro's terms like every new account, and
 * its dashboard opens because the clinic's plan covers it; an existing one
 * is never rewritten). Joining is written first, so a sign-in that fails
 * still leaves them on the team, to sign in the ordinary way.
 *
 * Used once, fourteen days; a link that is spent, expired, or withdrawn (the
 * owner removed the seat) goes to the sign-in page saying so.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!kvConfigured() || !authSecretOk()) return NextResponse.redirect(url.origin + "/slp-login.html?err=store");
  let got: { member: string; owner: string } | null = null;
  try {
    got = await acceptInvite(token);
  } catch (e) {
    if (e instanceof StoreUnavailable) return NextResponse.redirect(url.origin + "/slp-login.html?err=store");
    throw e;
  }
  if (!got) return NextResponse.redirect(url.origin + "/slp-login.html?err=expired");
  const done = await finishSignIn(url.origin, signFreeDashboardSignup({ email: got.member, source: "team-invite", attrib: {} }));
  if (!done.ok) return NextResponse.redirect(url.origin + "/slp-login.html?err=" + done.err);
  const res = NextResponse.redirect(url.origin + "/slp.html?joined=team#premium");
  res.headers.set("Set-Cookie", done.cookie);
  return res;
}
