import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { kvCmd, kvConfigured, makeFamilyKey } from "@/lib/slpAuth";

/**
 * In-app SLP signup: the app's onboarding (role = SLP) calls this at finish to
 * AUTO-CREATE the clinician's share credential — code + family key — so Rachel
 * can hand "code RACHEL-K4 / key ABCD2345" to a client the minute she finishes
 * setup, without ever visiting the web dashboard.
 *
 * Security posture (the caller is UNVERIFIED — no magic link yet):
 *  - If the email already owns an account WITH a code, we return
 *    { existing: true } and NEVER the credentials — otherwise anyone who knows
 *    an SLP's email could mint themselves that SLP's family key. The real
 *    owner sees their credential after magic-link sign-in (/api/slp/auth/me).
 *  - Codes are auto-generated (name + random suffix), never caller-chosen, so
 *    an unverified caller can't squat a valuable slug.
 *  - When the email's owner later signs in via magic link, they land on this
 *    same slpacct:<email> record — the onboarding-created account IS theirs.
 */
export const runtime = "nodejs";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
}
const SUFFIX = "abcdefghjkmnpqrstuvwxyz23456789";
function suffix(n: number): string {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  for (let i = 0; i < n; i++) out += SUFFIX[bytes[i] % SUFFIX.length];
  return out;
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { key: "slp-register", limit: 5, windowSec: 3600 });
  if (rl) return rl;

  if (!kvConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Accounts aren't enabled yet — try again soon." },
      { status: 503 },
    );
  }

  let body: { email?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  const name = String(body.name || "").trim().slice(0, 80);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }

  const acctKey = "slpacct:" + email;
  let acct: Record<string, unknown> = {};
  try {
    const raw = await kvCmd(["GET", acctKey]);
    if (raw) acct = JSON.parse(String(raw));
  } catch {
    acct = {};
  }

  // An account that already carries a credential belongs to whoever proves the
  // email via magic link — an unverified caller gets nothing back.
  if (acct.code && acct.familyKey) {
    return NextResponse.json({ ok: true, existing: true });
  }

  // Mint a code: readable stem + random suffix, claimed atomically. The stem
  // comes from the name so the handout reads human ("rachel-k4"), the suffix
  // keeps two Rachels from colliding.
  const stem = slug(name) || slug(email.split("@")[0]) || "slp";
  let code = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = (stem + "-" + suffix(2 + Math.floor(attempt / 2))).slice(0, 30);
    await kvCmd(["SET", "slpcode:" + candidate, email, "NX"]);
    const owner = await kvCmd(["GET", "slpcode:" + candidate]);
    if (owner && String(owner) === email) { code = candidate; break; }
  }
  if (!code) {
    return NextResponse.json({ ok: false, error: "Couldn't mint a code — try again." }, { status: 500 });
  }

  acct.email = email;
  if (name && !acct.name) acct.name = name;
  acct.code = code;
  acct.familyKey = makeFamilyKey();
  if (!acct.createdAt) acct.createdAt = new Date().toISOString();
  await kvCmd(["SET", acctKey, JSON.stringify(acct)]);

  return NextResponse.json({ ok: true, code, familyKey: acct.familyKey });
}
