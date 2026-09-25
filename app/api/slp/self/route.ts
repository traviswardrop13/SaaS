import { NextRequest, NextResponse } from "next/server";
import { readSession, kvCmd, kvConfigured, randomToken, sendSelfLinkEmail } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { readAccount } from "@/lib/roster";
import {
  selfAccess, requestAccess, bumpDaily, selfTokenKey, StoreUnavailable,
  SELF_LINKS_PER_DAY, SELF_TOKEN_TTL,
} from "@/lib/caseload";

/**
 * THE CLINICIAN'S OWN PHONE (24 Sep 2026): Premium on the clinician's own
 * device, free, so they can show a family every game in session.
 *
 *   POST { action: "send" }    → email an own-phone link to the ACCOUNT's
 *                                own address → { ok, sent }
 *   POST { action: "request" } → "No work email? Request access" → { ok, requested }
 *
 * WHO. A work address (lib/workEmail), or the founder's approval by hand on
 * /leads.html for a real clinician who uses a free-mail inbox. The dashboard
 * itself stays open to any email; only this needs the evidence, because a
 * gmail-to-free-Premium door is a coupon anyone could print.
 *
 * WHY EMAIL, NOT A LINK ON THE PAGE. The link goes to the address the account
 * is under — the one inbox the person asking is supposed to control — so it
 * proves more than a session cookie on a shared clinic computer does. The
 * token is single-use (redeem GETDELs it), lives thirty days, and is bound
 * to this clinician's code; each send is metered per clinician per day.
 *
 * NEVER "ONE PHONE" in anything this sends or says (24 Sep 2026). Each link
 * works once, but SELF_LINKS_PER_DAY links a day each switch on a device and
 * nothing retires an earlier one — so the promise is "your own phone or
 * tablet, each link works once", the words the dashboard and Terms use.
 * How many devices is Travis's open call; until he makes it, no copy may
 * claim a limit the server does not keep. caseloadtest pins the email.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(req, { key: "slpself", limit: 20, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }

  if (body.action === "request") {
    // Recorded on its own key (slpaccess, a hash), never on the account
    // JSON two routes rewrite whole. The founder sees it on /leads.html.
    await requestAccess(s.email);
    return NextResponse.json({ ok: true, requested: true });
  }
  if (body.action !== "send") return NextResponse.json({ ok: false, error: "which action?" }, { status: 400 });

  let eligible = false;
  try {
    eligible = (await selfAccess(s.email)).eligible;
  } catch (e) {
    if (e instanceof StoreUnavailable) return NextResponse.json({ ok: false, error: "Couldn't check just now — try again." }, { status: 503 });
    throw e;
  }
  if (!eligible) {
    return NextResponse.json({
      ok: false, needWorkEmail: true,
      error: "Your own Premium needs a work email. No work email? Request access and we'll take a look.",
    }, { status: 403 });
  }

  const { code, familyKey, name } = await readAccount(s.email);
  if (!code || !familyKey) return NextResponse.json({ ok: false, error: "finish your profile first" }, { status: 409 });

  const n = await bumpDaily("slpselfmail", s.email);
  if (n === null) return NextResponse.json({ ok: false, error: "Couldn't send just now — try again." }, { status: 503 });
  if (n > SELF_LINKS_PER_DAY) {
    return NextResponse.json({ ok: false, error: "That's " + SELF_LINKS_PER_DAY + " links today. Check your inbox for the last one, or try tomorrow." }, { status: 429 });
  }

  const token = randomToken();
  const stored = await kvCmd(["SET", selfTokenKey(code, token), s.email, "EX", SELF_TOKEN_TTL]);
  if (stored !== "OK") return NextResponse.json({ ok: false, error: "Couldn't make the link just now — try again." }, { status: 503 });

  // The family link every share uses, plus `me` — join.html hands it to
  // redeem, which turns it into a ticket marked as this clinician's own.
  const link =
    new URL(req.url).origin +
    "/join.html?slp=" + encodeURIComponent(code.toUpperCase()) +
    "&k=" + encodeURIComponent(familyKey) +
    "&me=" + encodeURIComponent(token);
  const sent = await sendSelfLinkEmail(s.email, link, name);
  if (!sent.sent && !sent.devLink) {
    return NextResponse.json({ ok: false, sent: false, error: "The email didn't go through — try again in a minute." }, { status: 502 });
  }
  // devLink only off production with no email provider (lib/slpAuth), so a
  // preview can be tested end to end; production only ever emails it.
  return NextResponse.json(sent.devLink ? { ok: true, sent: sent.sent, devLink: sent.devLink } : { ok: true, sent: true });
}
