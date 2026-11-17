import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { kvConfigured } from "@/lib/slpAuth";
import { verifyLogin, ownPasswordProblem, setOwnPassword } from "@/lib/familyLogin";

/**
 * A family changes the password their clinician made (Settings › Your login).
 * The current password is the proof, checked like a login (the same lock
 * after ten wrong tries an hour). Once changed, the clinician no longer knows
 * it, and their dashboard says the family chose their own. Nothing else
 * about the login changes.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { key: "fampass", limit: 20, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) {
    return NextResponse.json({ ok: false, error: "This is unavailable right now — try again soon." }, { status: 503 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const v = await verifyLogin(body.username, body.password);
  if ("error" in v) {
    return v.error === "locked"
      ? NextResponse.json({ ok: false, error: "Too many tries. Wait an hour, then try again." }, { status: 429 })
      : NextResponse.json({ ok: false, error: "That current password isn't right." }, { status: 403 });
  }
  const next = String(body.newPassword || "");
  const problem = ownPasswordProblem(next, v.rec.user);
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 });
  if (!(await setOwnPassword(v.rec, next))) {
    return NextResponse.json({ ok: false, error: "That login is gone. Ask your speech therapist for a new one." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
