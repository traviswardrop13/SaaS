import { NextRequest, NextResponse } from "next/server";
import { kvCmd, readSession, signSession, sessionCookie, SESSION_MAX_AGE, makeFamilyKey } from "@/lib/slpAuth";

export const runtime = "nodejs";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

// POST { name, clinic, code } → save the signed-in SLP's profile + claim their code.
export async function POST(req: NextRequest) {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  let body: { name?: string; clinic?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const acctKey = "slpacct:" + s.email;
  let acct: Record<string, unknown> = {};
  try {
    const raw = await kvCmd(["GET", acctKey]);
    if (raw) acct = JSON.parse(String(raw));
  } catch {
    acct = {};
  }
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
  const res = NextResponse.json({
    ok: true,
    code: (acct.code as string) || "",
    familyKey: (acct.familyKey as string) || "",
    name: (acct.name as string) || "",
    clinic: (acct.clinic as string) || "",
  });
  res.headers.set("Set-Cookie", sessionCookie(session, SESSION_MAX_AGE));
  return res;
}
