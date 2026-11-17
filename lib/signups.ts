import { kvCmd } from "@/lib/slpAuth";
import { covered } from "@/lib/caseload";

/**
 * ONE SIGN-UP RULE, TWO DOORS (14 Nov 2026). A family gets onto a clinician's
 * caseload either through the clinician's link (/api/slp/redeem: code +
 * family key) or with a login the clinician made for them (/api/family/login:
 * username + password). Both are a successful sign-up, and both count against
 * the same cap: a login that did not count would be a way round the cap a
 * posted link is bounded by. The redeem route keeps its own copy of these
 * lines (caseloadtest and slpcode pin its source as written), and
 * familylogintest fails if the two ever disagree: the same 60, the same two
 * counters, the same window.
 *
 * The rule (unchanged from redeem, where it was written):
 *  - A COVERED clinician has no cap (Travis, 12 Nov 2026: "Remove the
 *    limit"). Every other clinician stops at REDEEM_CAP successful sign-ups.
 *  - Counted per CODE and per OWNER (slpredeem:<code>, slpredeem-owner:<email>),
 *    because a clinician can claim a new code at any time and every code
 *    shares one family key: a per-code cap alone was N times the cap for
 *    anyone who renamed N times.
 *  - Every successful check counts, re-taps included: a device cannot be
 *    deduplicated, and the cap still bounds a leaked credential hard.
 *  - The counters go on counting for a covered code too, so a plan that
 *    lapses meets the ordinary cap with the year's real number.
 *  - A store or Stripe hiccup reads as uncovered (the ordinary cap): at most a
 *    retry for family sixty-one of a covered clinician, never an uncovered
 *    link that runs forever.
 */
export const REDEEM_CAP = 60;
export const SIGNUP_WINDOW_S = 60 * 60 * 24 * 400; // ~annual, as long as a ticket lives

// The words a parent reads at the cap of a login. As at the link's cap, never
// "ask for a new one": the cap counts the clinician, so a new login from the
// same clinician hits the same wall, and only Sona can look at why.
export const CAPPED_LOGIN_ERROR = "Your speech therapist's sign-ups have reached their limit — ask them to contact Sona.";

type Kv = (cmd: (string | number)[]) => Promise<unknown>;

/**
 * Count one successful sign-up for `code` (lowercase) owned by `owner`.
 * True when it is past the cap and must be refused.
 */
export async function countSignup(code: string, owner: string, kv: Kv = kvCmd): Promise<boolean> {
  let isCovered = false;
  try { isCovered = await covered(String(owner)); } catch { isCovered = false; }
  const cap = isCovered ? Infinity : REDEEM_CAP;
  const capKey = "slpredeem:" + String(code).toLowerCase();
  const n = await kv(["INCR", capKey]);
  if (typeof n === "number") {
    if (n === 1) await kv(["EXPIRE", capKey, SIGNUP_WINDOW_S]);
    if (n > cap) return true;
  }
  const ownerKey = "slpredeem-owner:" + String(owner).trim().toLowerCase();
  const m = await kv(["INCR", ownerKey]);
  if (typeof m === "number") {
    if (m === 1) await kv(["EXPIRE", ownerKey, SIGNUP_WINDOW_S]);
    if (m > cap) return true;
  }
  return false;
}
