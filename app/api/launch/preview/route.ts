import { NextRequest, NextResponse } from "next/server";
import { PREVIEW_COOKIE, previewToken } from "@/lib/launch";

// The same runtime as middleware.ts, so the cookie is made by the same Web
// Crypto that checks it.
export const runtime = "edge";

/** Equal strings, compared without stopping at the first difference. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/**
 * THE TEAM DOOR through the launch lock (lib/launch.ts). The lock page's
 * hidden form sends the founder key in a header (never in the URL, so it stays
 * out of history and logs); the answer is a cookie the middleware accepts, on
 * this phone or browser only. The iPhone app keeps its own cookies, so the
 * door is opened from inside the app.
 */
export async function POST(req: NextRequest) {
  const key = process.env.FOUNDER_KEY || "";
  if (key.length < 12) {
    return NextResponse.json({ ok: false, error: "The team door is closed: set FOUNDER_KEY (12+ characters) in Vercel." }, { status: 503 });
  }
  if (!same(req.headers.get("x-founder-key") || "", key)) {
    return NextResponse.json({ ok: false, error: "That key didn't work." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PREVIEW_COOKIE, await previewToken(key), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 14 * 86400 });
  return res;
}
