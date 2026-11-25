import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { kvConfigured, kvCmd, randomToken, hashToken, sendMagicEmail, signFreeDashboardSignup, authSecretOk } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { foreignOrigin } from "@/lib/origin";
import { cleanRef } from "@/lib/referral";
import { linkOrigin } from "@/lib/site";
import { activateFromSession, PRO_PLAN, PRO_NAME } from "@/lib/caseload";

/**
 * BACK FROM STRIPE ON /plans (BUYNOW1, 25 Nov 2026; see /api/slp/checkout).
 *
 *   POST /api/slp/checkout/done { session: "cs_…" } → { ok, activated }
 *
 * The checkout signed nobody in, so once Stripe says it is complete this
 * stores the plan (lib/caseload activateFromSession, the dashboard's own
 * return) and emails the clinician ONE sign-in link for that checkout
 * (`slpbuymail:<session>`): "Sona Pro is on." The link is the sign-up
 * door's (a signed pending sign-up, with the Share & earn code the
 * checkout carried), so the account is made, and the inbox proved, when it
 * is opened. The session id is only a question to ask Stripe: a checkout
 * not made by /plans (`from: plans`), not Sona Pro or not complete is
 * refused, and nothing is sent.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_ID = /^cs_[A-Za-z0-9_]{10,240}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NO_STORE = { "Cache-Control": "no-store" };
const DAY = 86400;

function reply(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  if (foreignOrigin(req)) return reply({ ok: false }, 403);
  const rl = await rateLimit(req, { key: "slpcheckout-done", limit: 30, windowSec: 3600, v6prefix: true });
  if (rl) return rl;
  if (!kvConfigured()) return reply({ ok: false, error: "no data store connected" }, 503);
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return reply({ ok: false, error: "Server is missing STRIPE_SECRET_KEY." }, 500);

  let body: { session?: unknown } = {};
  try { body = (await req.json()) || {}; } catch { body = {}; }
  const sid = typeof body.session === "string" ? body.session.trim() : "";
  if (!SESSION_ID.test(sid)) return reply({ ok: false }, 400);

  const stripe = new Stripe(key);
  let email = "";
  let ref = "";
  try {
    const cs = await stripe.checkout.sessions.retrieve(sid);
    const md = cs.metadata || {};
    if (md.from !== "plans" || md.plan !== PRO_PLAN) return reply({ ok: false }, 404);
    email = String(md.slp || "").trim().toLowerCase();
    ref = cleanRef(md.ref);
  } catch {
    return reply({ ok: false, retry: true }, 502);
  }
  if (!EMAIL.test(email)) return reply({ ok: false }, 404);

  let got: Awaited<ReturnType<typeof activateFromSession>>;
  try { got = await activateFromSession(email, sid, { stripe }); }
  catch { return reply({ ok: false, retry: true }, 502); }
  if (!got.activated) return reply({ ok: false, activated: false }, 409);

  // ONE sign-in email a checkout, however often the page is reloaded.
  let sent = false;
  try {
    if (authSecretOk() && (await kvCmd(["SET", "slpbuymail:" + sid, "1", "NX", "EX", 30 * DAY])) === "OK") {
      const token = randomToken();
      const pending = signFreeDashboardSignup({ email, source: "plans-checkout", attrib: {}, ...(ref ? { ref } : {}) });
      if ((await kvCmd(["SET", "slptok:" + hashToken(token), pending, "EX", 900])) === "OK") {
        const link = linkOrigin(new URL(req.url).origin) + "/api/slp/auth/verify?token=" + encodeURIComponent(token);
        sent = (await sendMagicEmail(email, link, "", { started: { name: PRO_NAME, trial: got.status === "trialing" } })).sent;
      }
    }
  } catch { /* they can still sign in by email at /slp-login.html */ }
  return reply({ ok: true, activated: true, sent });
}
