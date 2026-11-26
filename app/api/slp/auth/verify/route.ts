import { NextRequest, NextResponse } from "next/server";
import { kvCmd, hashToken } from "@/lib/slpAuth";
import { finishSignIn, signInCodeKey } from "@/lib/slpSignIn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/slp/auth/verify?token=… — the link in the sign-in email.
 *
 * GET SPENDS NOTHING (SCANSAFE1, 25 Nov 2026; the audit's open item, beside
 * B13). A school's or district's link scanner (Safe Links, Mimecast,
 * Proofpoint) opens every link in an email before the clinician sees it. When
 * GET signed in, the scanner spent the single-use link, and the clinician's
 * own tap then said "That link expired". So GET shows one page with a Sign in
 * button that POSTs back here, as the Clinic invite (app/api/slp/team/accept)
 * and the weekly report's confirm link do. Nothing is spent until the button.
 * A scanner that only GETs signs nobody in; one that also follows a form is
 * the rare case, and the six-digit code in the same email still works.
 *
 * POST → consume the single-use token, create/load the account, set the
 * session cookie, and go on to the dashboard (which handles onboarding if
 * new). The account and the session are lib/slpSignIn's finishSignIn, which
 * the emailed code (/api/slp/auth/code, 16 Nov 2026) shares.
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(token: string): NextResponse {
  const action = "/api/slp/auth/verify?token=" + encodeURIComponent(token);
  return new NextResponse(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Sign in to Sona</title>` +
    `<body style="margin:0;background:#f4f8fc;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">` +
    `<main style="background:#fff;border-radius:20px;padding:32px 26px;max-width:420px;margin:20px;text-align:center;box-shadow:0 6px 24px rgba(22,56,79,.08);">` +
    `<img src="/assets/brand/echo-logo.webp" width="64" height="64" alt="" style="display:block;margin:0 auto 12px;">` +
    `<h1 style="margin:0;font-size:21px;font-weight:800;color:#16384f;">Sign in to Sona</h1>` +
    `<p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#46627a;">Tap the button to open your dashboard.</p>` +
    `<form method="post" action="${esc(action)}" style="margin:20px 0 0;"><button type="submit" style="border:none;border-radius:14px;background:#0e9c99;color:#fff;font-weight:800;font-size:16px;padding:14px 30px;cursor:pointer;">Sign in</button></form>` +
    `</main></body></html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex",
        // The token is in this page's address: never sent on to another site.
        // "same-origin", not "no-referrer", which makes a browser send the
        // button's POST with Origin "null".
        "referrer-policy": "same-origin",
      },
    },
  );
}

const toLogin = (url: URL, err: string, status = 303) => NextResponse.redirect(url.origin + "/slp-login.html?err=" + err, status);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return toLogin(url, "expired", 302);
  // A link already spent or expired says so at once, without a button that
  // could only fail. A store that does not answer still shows the button:
  // the POST will find out, and nothing is lost by asking.
  // (GET, not EXISTS: it only reads, and kvCmd answers undefined when the
  // store did not answer, null only when it said there is no such link.)
  let live: unknown = undefined;
  try { live = await kvCmd(["GET", "slptok:" + hashToken(token)]); } catch { live = undefined; }
  if (live === null) return toLogin(url, "expired", 302);
  return page(token);
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  // Sona's own page only: a form on another site that somehow held the token
  // cannot press Sign in for anyone (it would sign the clinician in to their
  // own account in that browser, but there is no reason to allow it).
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) return toLogin(url, "expired");
  const token = url.searchParams.get("token") || "";
  const key = token ? "slptok:" + hashToken(token) : "";
  // GETDEL is atomic: a magic link can't be verified twice concurrently (the
  // old GET-then-DEL could mint two sessions from one single-use token).
  const stored = key ? await kvCmd(["GETDEL", key]) : null;
  const done = await finishSignIn(url.origin, stored);
  if (!done.ok) return toLogin(url, done.err);
  // The code sent with this link is spent with it: one email, one sign-in.
  await kvCmd(["DEL", signInCodeKey(done.email)]);
  // A brand-new account goes straight on to Sona Pro's free trial (TRIALGO1,
  // 17 Nov 2026, Travis: email link, then the card page, then the dashboard).
  // The link always opens in a browser, never in the clinicians' app; the
  // dashboard still checks the plan first and opens checkout only while the
  // dashboard is locked and the trial is there to take.
  const res = NextResponse.redirect(url.origin + (done.fresh ? "/slp.html?start=trial" : "/slp.html"), 303);
  res.headers.set("Set-Cookie", done.cookie);
  return res;
}
