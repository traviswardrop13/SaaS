import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { kvCmd, readSession, signSession, sessionCookie, SESSION_MAX_AGE, makeFamilyKey } from "@/lib/slpAuth";
import { CASELOAD_TERMS } from "@/lib/caseload";

const SUFFIX = "abcdefghjkmnpqrstuvwxyz23456789";
function suffix(n: number): string { let o = ""; const b = crypto.getRandomValues(new Uint8Array(n)); for (let i = 0; i < n; i++) o += SUFFIX[b[i] % SUFFIX.length]; return o; }

export const runtime = "nodejs";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

// POST { name, clinic, code } → save the signed-in SLP's profile + claim their code.
export async function POST(req: NextRequest) {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  let body: { name?: string; clinic?: string; code?: string; rotateKey?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const acctKey = "slpacct:" + s.email;
  let acct: Record<string, unknown> = {};
  let raw: unknown = null;
  try {
    raw = await kvCmd(["GET", acctKey]);
    if (raw) acct = JSON.parse(String(raw));
  } catch {
    acct = {};
  }
  // This route rewrites the account WHOLE, so a read that failed must not
  // become a write: the clinician's code, family key and — since 24 Sep 2026
  // — whether they are grandfathered (no `terms` field) would all be
  // replaced by a blank. The store said nothing; neither do we.
  if (raw === undefined) {
    return NextResponse.json({ ok: false, error: "Couldn't reach your account just now — try again in a moment." }, { status: 503 });
  }
  // An account made HERE (signed in, but the record is gone) is made under
  // the caseload plan, like every account from this build on (lib/caseload).
  if (raw === null) acct.terms = CASELOAD_TERMS;
  acct.email = s.email;
  if (typeof body.name === "string") acct.name = body.name.slice(0, 80);
  if (typeof body.clinic === "string") acct.clinic = body.clinic.slice(0, 80);

  if (typeof body.code === "string" && body.code.trim()) {
    const c = slug(body.code);
    if (!c) return NextResponse.json({ ok: false, error: "Pick a valid code." }, { status: 400 });
    // Codes must be unique across SLPs (they key the family roster). Claim
    // atomically with SET NX so two SLPs can't win the same unclaimed code in a
    // race (the old GET-then-SET was last-write-wins). NX no-ops if it exists,
    // so re-confirm ownership afterward.
    await kvCmd(["SET", "slpcode:" + c, s.email, "NX"]);
    const owner = await kvCmd(["GET", "slpcode:" + c]);
    if (owner && String(owner) !== s.email) {
      return NextResponse.json({ ok: false, error: "That code is taken — try another." }, { status: 409 });
    }
    acct.code = c;
  }
  // AUTO-MINT: an authenticated SLP with no code yet gets one derived from
  // their email (readable on a handout: "rachel-k4"), claimed atomically. This
  // is the ONLY place a credential is created now — the caller is proven by the
  // session cookie, which is why the old unauthenticated /api/slp/register
  // (an open credential-minting oracle) was deleted.
  if (!acct.code) {
    const stem = slug(String(s.email).split("@")[0]) || "slp";
    for (let attempt = 0; attempt < 6 && !acct.code; attempt++) {
      const cand = (stem + "-" + suffix(2 + Math.floor(attempt / 2))).slice(0, 30);
      await kvCmd(["SET", "slpcode:" + cand, s.email, "NX"]);
      const own = await kvCmd(["GET", "slpcode:" + cand]);
      if (own && String(own) === s.email) acct.code = cand;
    }
  }
  // ROTATE: a fresh family key on request, minted by the one function that
  // mints them. What it does and does not do — a clinician should know both
  // before they tap it:
  //   - every link and handout carrying the OLD key stops redeeming at once —
  //     the caseload link and every per-child invite alike — which is the
  //     point (a link that got forwarded too far dies here);
  //   - families ALREADY enrolled keep syncing, because /api/pilot and
  //     /api/homework trust the enrolment ticket their device was handed at
  //     redeem time, not the key. Rotating never knocks a real child off the
  //     dashboard; it only closes the door to new redemptions on the old link.
  if (body.rotateKey === true && acct.code) acct.familyKey = makeFamilyKey();
  // every account with a code carries a family key — the "password" half of
  // the credential that unlocks Sona free for that SLP's families
  if (acct.code && !acct.familyKey) acct.familyKey = makeFamilyKey();
  if (!acct.createdAt) acct.createdAt = new Date().toISOString();
  await kvCmd(["SET", acctKey, JSON.stringify(acct)]);

  // Refresh the session so it carries the (possibly new) code.
  const session = signSession({
    email: s.email,
    code: (acct.code as string) || "",
    iat: Date.now(),
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  });
  // `email` too (24 Sep 2026), as GET and /api/slp/auth/me already say it:
  // the dashboard replaces its account with this answer after every save,
  // and the own-phone card names the inbox the link goes to — without it,
  // "your account email" was all a clinician could read.
  const res = NextResponse.json({
    ok: true,
    email: s.email,
    code: (acct.code as string) || "",
    familyKey: (acct.familyKey as string) || "",
    name: (acct.name as string) || "",
    clinic: (acct.clinic as string) || "",
  });
  res.headers.set("Set-Cookie", sessionCookie(session, SESSION_MAX_AGE));
  return res;
}

// GET → the signed-in SLP's credential (auto-minting on first read via the same
// path as POST would, but read-only friendly). Used by Settings + the dashboard.
export async function GET(req: NextRequest) {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const acctKey = "slpacct:" + s.email;
  let acct: Record<string, unknown> = {};
  try { const raw = await kvCmd(["GET", acctKey]); if (raw) acct = JSON.parse(String(raw)); } catch { acct = {}; }
  return NextResponse.json({
    ok: true,
    email: s.email,
    code: (acct.code as string) || "",
    familyKey: (acct.familyKey as string) || "",
    name: (acct.name as string) || "",
    clinic: (acct.clinic as string) || "",
  });
}
