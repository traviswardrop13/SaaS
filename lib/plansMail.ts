import { kvCmd, randomToken, hashToken, sendMagicEmail, signFreeDashboardSignup, authSecretOk } from "@/lib/slpAuth";
import { mailConfigured } from "@/lib/mail";
import { cleanRef } from "@/lib/referral";
import { PRO_NAME } from "@/lib/caseload";

/**
 * THE SIGN-IN EMAIL AFTER A SONA PRO BOUGHT ON /plans (BUYNOW1, 25 Nov 2026).
 *
 * /plans sends a visitor straight to Stripe with no sign-in first, so once
 * Stripe says the plan is on, the clinician is emailed ONE sign-in link for
 * that subscription. Two doors ask for it and share this one function and
 * its mark, so whichever comes first sends and the other finds it sent:
 *   - the page Stripe returns to (/api/slp/checkout/done);
 *   - Stripe's webhook (a `from: plans` subscription turning active or
 *     trialing), for a buyer who closed Stripe and never came back.
 *
 * The mark, `slpbuymail:<subscription>`:
 *   - a random value while one request is sending (HOLD_SEC), so two at
 *     once never send two emails;
 *   - "sent" for a year once the email went (a reload of the return page
 *     months later still sends nothing);
 *   - given back (only by the request that holds it) when the link could
 *     not be stored or the email did not go, so the next try sends.
 *
 * The link is the sign-up door's (a signed pending sign-up, carrying the
 * Share & earn code the checkout carried), so the account is made, and the
 * inbox proved, when it is opened.
 */

export type PlansMail =
  | "sent"     // this call sent it
  | "already"  // an earlier call sent it
  | "busy"     // another call is sending it right now
  | "failed"   // it did not go; the mark is free, so try again
  | "off";     // nothing can send here (no mail, no signing secret, no store)

export const PLANS_MAIL_PREFIX = "slpbuymail:";
const HOLD_SEC = 120;
const KEEP_SEC = 365 * 86400;
const RELEASE = `-- slpbuymail:release
if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) end
return 0`;

type Kv = (cmd: (string | number)[]) => Promise<unknown>;

export async function plansSignInMail(o: {
  email: string; sub: string; trial: boolean; ref?: unknown; origin: string; kv?: Kv;
}): Promise<PlansMail> {
  const kv = o.kv || kvCmd;
  if (!o.sub || !o.email) return "failed";
  if (!authSecretOk() || !mailConfigured()) return "off";
  const key = PLANS_MAIL_PREFIX + o.sub;
  const mine = randomToken();
  const took = await kv(["SET", key, mine, "NX", "EX", HOLD_SEC]);
  if (took === undefined) return "failed";
  if (took !== "OK") return (await kv(["GET", key])) === "sent" ? "already" : "busy";
  const giveBack = async (): Promise<PlansMail> => {
    try { await kv(["EVAL", RELEASE, 1, key, mine]); } catch { /* the hold runs out by itself */ }
    return "failed";
  };
  try {
    const ref = cleanRef(o.ref);
    const token = randomToken();
    const pending = signFreeDashboardSignup({ email: o.email, source: "plans-checkout", attrib: {}, ...(ref ? { ref } : {}) });
    if ((await kv(["SET", "slptok:" + hashToken(token), pending, "EX", 900])) !== "OK") return giveBack();
    const link = o.origin + "/api/slp/auth/verify?token=" + encodeURIComponent(token);
    const r = await sendMagicEmail(o.email, link, "", { started: { name: PRO_NAME, trial: o.trial } });
    if (!r.sent) return giveBack();
  } catch {
    return giveBack();
  }
  // Sent. If the store misses this write, the hold runs out in two minutes
  // and a later try could send once more: a second link, never none.
  await kv(["SET", key, "sent", "EX", KEEP_SEC]);
  return "sent";
}
