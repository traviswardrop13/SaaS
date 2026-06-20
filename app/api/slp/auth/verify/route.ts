import { NextRequest, NextResponse } from "next/server";
import { kvCmd, hashToken, signSession, sessionCookie, SESSION_MAX_AGE } from "@/lib/slpAuth";

export const runtime = "nodejs";

// GET ?token=... → consume the single-use token, create/load the account, set the
// session cookie, and bounce to the dashboard (which handles onboarding if new).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const key = token ? "slptok:" + hashToken(token) : "";
  const email = key ? await kvCmd(["GET", key]) : null;
  if (!email || typeof email !== "string") {
    return NextResponse.redirect(url.origin + "/slp-login.html?err=expired");
  }
  await kvCmd(["DEL", key]); // single use

  const acctKey = "slpacct:" + email;
  let acct: Record<string, unknown> | null = null;
  try {
    const raw = await kvCmd(["GET", acctKey]);
    if (raw) acct = JSON.parse(String(raw));
  } catch {
    acct = null;
  }
  if (!acct) {
    acct = { email, name: "", clinic: "", code: "", createdAt: new Date().toISOString() };
    await kvCmd(["SET", acctKey, JSON.stringify(acct)]);
  }

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
