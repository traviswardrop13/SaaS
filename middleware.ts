import { NextRequest, NextResponse } from "next/server";
import { launched, lockedPage, PREVIEW_COOKIE, previewToken } from "@/lib/launch";

/**
 * The launch lock (Travis, 30 Sep 2026; see LAUNCH_AT in lib/launch.ts).
 * Until launch day, a family page answers with the lock page instead, at the
 * same address: after launch a reload of that address is the real page, and
 * the iPhone app, which loads the site on every open, needs no new build.
 * Everything else passes: the websites, the clinician's dashboard, the API,
 * and every picture, script and sound (the matcher sends only .html here).
 */
export async function middleware(req: NextRequest) {
  if (launched() || !lockedPage(req.nextUrl.pathname)) return NextResponse.next();
  // The team door: a cookie only the founder key can make (app/api/launch/preview).
  const key = process.env.FOUNDER_KEY || "";
  const given = req.cookies.get(PREVIEW_COOKIE)?.value || "";
  if (key.length >= 12 && given && given === (await previewToken(key))) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/launching.html";
  url.search = "";
  return NextResponse.rewrite(url);
}

export const config = { matcher: ["/((?!api/|_next/).*\\.html)"] };
