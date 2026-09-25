import { NextRequest, NextResponse } from "next/server";
import { kvCmd, hashToken, signSession, sessionCookie, SESSION_MAX_AGE } from "@/lib/slpAuth";
import { CASELOAD_TERMS } from "@/lib/caseload";

export const runtime = "nodejs";

// GET ?token=... → consume the single-use token, create/load the account, set the
// session cookie, and bounce to the dashboard (which handles onboarding if new).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const key = token ? "slptok:" + hashToken(token) : "";
  // GETDEL is atomic: a magic link can't be verified twice concurrently (the
  // old GET-then-DEL could mint two sessions from one single-use token).
  const email = key ? await kvCmd(["GETDEL", key]) : null;
  if (!email || typeof email !== "string") {
    return NextResponse.redirect(url.origin + "/slp-login.html?err=expired");
  }

  const acctKey = "slpacct:" + email;
  let acct: Record<string, unknown> | null = null;
  let raw: unknown = null;
  try {
    raw = await kvCmd(["GET", acctKey]);
    if (raw) acct = JSON.parse(String(raw));
  } catch {
    acct = null;
  }
  // A NEW account only when the store SAID there is none (null). When it did
  // not answer (undefined) nothing is written: an existing account rewritten
  // from scratch would lose its code, its family key and — the absent `terms`
  // field being the whole of it — its grandfathered caseload. They are
  // signed in regardless; the dashboard reads the account itself.
  if (!acct && raw === null) {
    // `terms`: made under the caseload plan (lib/caseload, 24 Sep 2026).
    acct = { email, name: "", clinic: "", code: "", createdAt: new Date().toISOString(), terms: CASELOAD_TERMS };
    await kvCmd(["SET", acctKey, JSON.stringify(acct)]);
  }
  if (!acct) acct = { code: "" };

  const session = signSession({
    email,
    code: (acct.code as string) || "",
    iat: Date.now(),
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  });
  const res = NextResponse.redirect(url.origin + "/slp.html");
  res.headers.set("Set-Cookie", sessionCookie(session, SESSION_MAX_AGE));
  return res;
}
