import { NextRequest, NextResponse } from "next/server";
import { kvCmd, hashToken, signSession, sessionCookie, SESSION_MAX_AGE, readFreeDashboardSignup, replaceSlpAccount } from "@/lib/slpAuth";
import { FREE_DASHBOARD_TERMS, PRO_TERMS, proTerms } from "@/lib/caseload";
import { safeAttrib, tellCrm } from "@/lib/slpLead";

export const runtime = "nodejs";

// GET ?token=... → consume the single-use token, create/load the account, set the
// session cookie, and bounce to the dashboard (which handles onboarding if new).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const key = token ? "slptok:" + hashToken(token) : "";
  // GETDEL is atomic: a magic link can't be verified twice concurrently (the
  // old GET-then-DEL could mint two sessions from one single-use token).
  const stored = key ? await kvCmd(["GETDEL", key]) : null;
  const signup = typeof stored === "string" ? readFreeDashboardSignup(stored) : null;
  const email = signup?.email ?? stored;
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
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
    const newAccount = {
      email, name: "", clinic: "", code: "", createdAt: new Date().toISOString(),
      terms: signup ? FREE_DASHBOARD_TERMS : PRO_TERMS,
      ...(signup ? { clinicianRole: signup.clinicianRole, workSetting: signup.workSetting, source: signup.source } : {}),
    };
    const snapshot = JSON.stringify(newAccount);
    const created = await kvCmd(["SET", acctKey, snapshot, "NX"]);
    if (created === "OK") {
      acct = newAccount;
      if (signup && await tellCrm(url.origin, email, signup.source, "", safeAttrib(signup.attrib))) {
        // The dashboard may already have been opened using another valid
        // link. Stamp CRM only if the account is still the same snapshot.
        await replaceSlpAccount(acctKey, snapshot, { ...newAccount, crmAt: new Date().toISOString() });
      }
    } else if (created === null) {
      // Another valid link created the account. Load its terms and code.
      const winner = await kvCmd(["GET", acctKey]);
      try { if (typeof winner === "string") acct = JSON.parse(winner); } catch { acct = null; }
    }
  }
  // A returning Pro-era clinician can opt into the free dashboard by opening
  // this link. Their account terms and paid coverage stay intact.
  if (signup && acct && proTerms(acct) && acct.freeDashboard !== true) {
    let unlocked = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (typeof raw !== "string") raw = await kvCmd(["GET", acctKey]);
      if (typeof raw !== "string") break;
      try { acct = JSON.parse(raw); } catch { acct = null; }
      if (!acct) break;
      if (!proTerms(acct) || acct.freeDashboard === true) { unlocked = true; break; }
      const updated = { ...acct, freeDashboard: true };
      const wrote = await replaceSlpAccount(acctKey, raw, updated);
      if (wrote === "OK") { acct = updated; unlocked = true; break; }
      if (wrote === undefined) break;
      raw = null;
    }
    if (!unlocked) return NextResponse.redirect(url.origin + "/slp-login.html?err=store");
  }
  if (signup && !acct) {
    return NextResponse.redirect(url.origin + "/slp-login.html?err=store");
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
