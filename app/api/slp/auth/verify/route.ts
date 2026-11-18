import { NextRequest, NextResponse } from "next/server";
import { kvCmd, hashToken } from "@/lib/slpAuth";
import { finishSignIn, signInCodeKey } from "@/lib/slpSignIn";

export const runtime = "nodejs";

// GET ?token=... → consume the single-use token, create/load the account, set the
// session cookie, and bounce to the dashboard (which handles onboarding if new).
// The account and the session are lib/slpSignIn's finishSignIn, which the
// emailed code (/api/slp/auth/code, 16 Nov 2026) shares.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const key = token ? "slptok:" + hashToken(token) : "";
  // GETDEL is atomic: a magic link can't be verified twice concurrently (the
  // old GET-then-DEL could mint two sessions from one single-use token).
  const stored = key ? await kvCmd(["GETDEL", key]) : null;
  const done = await finishSignIn(url.origin, stored);
  if (!done.ok) return NextResponse.redirect(url.origin + "/slp-login.html?err=" + done.err);
  // The code sent with this link is spent with it: one email, one sign-in.
  await kvCmd(["DEL", signInCodeKey(done.email)]);
  // A brand-new account goes straight on to Sona Pro's free trial (TRIALGO1,
  // 17 Nov 2026, Travis: email link, then the card page, then the dashboard).
  // The link always opens in a browser, never in the clinicians' app; the
  // dashboard still checks the plan first and opens checkout only while the
  // dashboard is locked and the trial is there to take.
  const res = NextResponse.redirect(url.origin + (done.fresh ? "/slp.html?start=trial" : "/slp.html"));
  res.headers.set("Set-Cookie", done.cookie);
  return res;
}
