import { NextRequest, NextResponse } from "next/server";
import { kvConfigured, authSecretOk } from "@/lib/slpAuth";
import { checkSignInCode, cleanSignInCode, finishSignIn } from "@/lib/slpSignIn";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * POST { email, code } → the six-digit code from the sign-in email, typed on
 * the sign-in screen (SLPAPP1, 16 Nov 2026). It proves the inbox as the link
 * does and signs THIS screen in: inside the clinicians' iPhone app, where the
 * emailed link (which opens in Safari) never could. The answer carries the
 * session cookie; the account rules are the link's own (lib/slpSignIn).
 *
 * Its own page, so another site cannot post here; 30 tries an hour from one
 * address (an IPv6 /64 as one), five a code (lib/slpSignIn).
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) {
    return NextResponse.json({ ok: false, error: "Sign in from the Sona sign-in page." }, { status: 403 });
  }
  const limited = await rateLimit(req, { key: "slpauthcode", limit: 30, windowSec: 3600, v6prefix: true });
  if (limited) return limited;
  let body: { email?: unknown; code?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  const code = cleanSignInCode(body.code);
  if (!code) return NextResponse.json({ ok: false, error: "Type the 6-digit code from the email." }, { status: 400 });
  if (!kvConfigured() || !authSecretOk()) {
    return NextResponse.json({ ok: false, error: "Sign-in isn't switched on here yet." }, { status: 503 });
  }
  const check = await checkSignInCode(email, code);
  if (!check.ok) {
    const error = check.why === "wrong" ? "That code doesn't match. Check the email and try again."
      : check.why === "tries" ? "Too many tries. Ask for a new code."
      : check.why === "gone" ? "That code has expired or was already used. Ask for a new code."
      : "We couldn't check your code just now. Try again in a moment.";
    return NextResponse.json({ ok: false, error, why: check.why }, { status: check.why === "store" ? 503 : 400 });
  }
  const done = await finishSignIn(url.origin, check.stored);
  if (!done.ok) {
    return NextResponse.json({ ok: false, error: "We couldn't open your dashboard. Ask for a new code." }, { status: done.err === "store" ? 503 : 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", done.cookie);
  return res;
}
