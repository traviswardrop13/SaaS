/**
 * IS THIS A WORK EMAIL? (24 Sep 2026)
 *
 * The clinician dashboard is open to ANY address — the landing page collects
 * every email and a new clinician goes straight in. What needs a work address
 * is one thing only: the clinician's OWN free Premium on their own phone.
 * A school or clinic domain is weak evidence that the person is a practising
 * clinician; a free-mail inbox is no evidence at all, and "sign up with a
 * gmail, get Premium free" would be a coupon anyone could print. So free-mail
 * domains are refused there, with a "Request access" button beside the
 * refusal, and the founder approves real clinicians who use one by hand on
 * /leads.html (lib/caseload: slpaccess).
 *
 * A BLOCK LIST, not an allow list. There is no list of every school district,
 * hospital and private practice, and there never will be; there IS a short
 * list of the inboxes anyone can open in a minute. Getting one wrong in either
 * direction costs little: a missed free-mail domain gets one clinician-priced
 * phone, and a wrongly blocked work domain gets a button that reaches a human.
 */

/** Consumer mailbox domains, exactly as they appear after the @. */
export const CONSUMER_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com",
  "ymail.com", "rocketmail.com",
  "msn.com",
  "icloud.com", "me.com", "mac.com",
  "aol.com",
  "proton.me", "protonmail.com", "pm.me",
  "mail.com", "zoho.com", "hey.com", "fastmail.com",
  // US internet providers: the address comes with the home broadband
  "comcast.net", "att.net", "sbcglobal.net", "verizon.net", "cox.net",
  "charter.net", "bellsouth.net", "earthlink.net", "frontier.com", "optonline.net",
]);

/**
 * Brands whose free mail lives under many country domains — yahoo.co.uk,
 * hotmail.fr, outlook.com.au, live.ca, gmx.de, yandex.ru. Matched as
 * "<brand>.<tld>" or "<brand>.<second-level>.<country>" and nothing deeper,
 * so a school's own "live.district.k12.ca.us" is not caught by the word.
 */
export const CONSUMER_MAIL_BRANDS: ReadonlySet<string> = new Set([
  "yahoo", "hotmail", "outlook", "live", "gmx", "yandex",
]);

const BRAND_TLD = /^([a-z0-9-]+)\.([a-z]{2,3})(\.[a-z]{2})?$/;

/** The part after the @, lowercased, or "" when there is no usable one. */
export function emailDomain(email: unknown): string {
  const s = String(email || "").trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at < 1) return "";
  const d = s.slice(at + 1).replace(/\.+$/, "");
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : "";
}

/** True for a free-mail domain (gmail, yahoo.*, icloud, a home ISP, …). */
export function isConsumerDomain(domain: string): boolean {
  const d = String(domain || "").toLowerCase();
  if (CONSUMER_MAIL_DOMAINS.has(d)) return true;
  const m = d.match(BRAND_TLD);
  return !!m && CONSUMER_MAIL_BRANDS.has(m[1]);
}

/**
 * True when the address is plausibly an employer's — a well-formed address
 * whose domain is not a free-mail one. A malformed address is never a work
 * address: whatever it is, it is not evidence.
 */
export function isWorkEmail(email: unknown): boolean {
  const d = emailDomain(email);
  return !!d && !isConsumerDomain(d);
}
