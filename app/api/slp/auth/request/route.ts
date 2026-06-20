import { NextRequest, NextResponse } from "next/server";
import { kvCmd, kvConfigured, randomToken, hashToken, sendMagicEmail } from "@/lib/slpAuth";

export const runtime = "nodejs";

// POST { email } → email a single-use magic sign-in link.
export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }
  if (!kvConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Accounts aren't enabled yet — a data store needs to be connected." },
      { status: 503 },
    );
  }

  // Light rate limit: max 5 link requests per email per hour.
  const rl = "slprl:" + email;
  const n = await kvCmd(["INCR", rl]);
  if (n === 1) await kvCmd(["EXPIRE", rl, 3600]);
  if (typeof n === "number" && n > 5) {
    return NextResponse.json({ ok: true, sent: true, devLink: null }); // silently cap
  }

  const token = randomToken();
  await kvCmd(["SET", "slptok:" + hashToken(token), email, "EX", 900]); // 15 min
  const link = new URL(req.url).origin + "/api/slp/auth/verify?token=" + encodeURIComponent(token);
  const res = await sendMagicEmail(email, link);
  return NextResponse.json({ ok: true, sent: res.sent, devLink: res.devLink });
}
