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
  // "next=pro" (the trial page's button) opens the Sona Pro page; any other
  // value is ignored, so the link can never send anyone off the dashboard.
  const res = NextResponse.redirect(url.origin + "/slp.html" + (url.searchParams.get("next") === "pro" ? "#premium" : ""));
  res.headers.set("Set-Cookie", done.cookie);
  return res;
}
