import { NextRequest, NextResponse } from "next/server";
import { kvCmd, readSession } from "@/lib/slpAuth";

export const runtime = "nodejs";

// GET → who is the signed-in SLP (from the session cookie), with their account.
export async function GET(req: NextRequest) {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false });
  let acct: Record<string, unknown> | null = null;
  try {
    const raw = await kvCmd(["GET", "slpacct:" + s.email]);
    if (raw) acct = JSON.parse(String(raw));
  } catch {
    acct = null;
  }
  const code = (acct && (acct.code as string)) || "";
  return NextResponse.json({
    ok: true,
    email: s.email,
    code,
    familyKey: (acct && (acct.familyKey as string)) || "",
    name: (acct && (acct.name as string)) || "",
    clinic: (acct && (acct.clinic as string)) || "",
    onboarded: !!code,
  });
}
