/**
 * IS THE APP READY? (Travis, 25 Sep 2026.) The iPhone app closes on launch on
 * iOS 27 until 1.0.3 is in the App Store, so the landing page stops sending
 * people there. Instead it thanks them, says when the app launches, and
 * emails them to say the same; a speech therapist goes to their dashboard.
 *
 * ONE SWITCH, THREE COPIES, like FREE_MODE: this one (the emails) and
 * `var APP_READY` in public/parents.html (the root) and public/for-slps.html,
 * which are static and cannot import this. tests/shiptest.mjs fails if they
 * disagree. When the app is live, set all three to true: the pages send people
 * to the App Store again and these emails stop.
 */
export const APP_READY = false;

/** Travis's words, the same on the page, in the welcome and in the SLP's email.
 *  The date is the one he emailed the list (30 Sep 2026: "the official V1 of
 *  Sona launches Friday, October 2nd"). */
export const LAUNCH_NOTE = "Sona launches Friday, October 2. We'll email you the moment it's ready.";

/**
 * THE APP IS LOCKED UNTIL LAUNCH DAY (Travis, 30 Sep 2026: "if they click in
 * the app I want to lock the app until Friday ... they can turn on a
 * notification if they press notify me or ... put in their email"). Until
 * LAUNCH_AT every page of the family app, on the iPhone and on the web, shows
 * public/launching.html instead: the date and one email box. middleware.ts does
 * the swap on the server, so no page has to remember to check, and from
 * LAUNCH_AT the app is open with no deploy: nobody has to be awake for it.
 *
 * Midnight at the start of Friday 2 October in Idaho (MDT, UTC-6). The lock
 * page carries a copy of this instant to reload itself at launch (it is
 * static and cannot import this); tests/launchtest.mjs pins the two equal.
 */
export const LAUNCH_AT = "2026-10-02T06:00:00Z";
export function launched(now: number = Date.now()): boolean {
  return now >= Date.parse(LAUNCH_AT);
}

/**
 * What stays open while the app is locked: the two websites, the clinician's
 * dashboard and its sign-in, the founder pages, privacy, and the lock page
 * itself. Every other .html page is part of the family app and is locked.
 * An allowlist, not a blocklist: a page added to the app before Friday is
 * locked without anyone having to remember it.
 */
export const OPEN_PAGES = [
  "parents.html", "for-slps.html", "slp.html", "slp-login.html",
  "leads.html", "founders.html", "privacy.html", "launching.html",
];
export function lockedPage(pathname: string): boolean {
  const m = /^\/([a-z0-9-]+\.html)$/i.exec(pathname || "");
  return !!m && OPEN_PAGES.indexOf(m[1].toLowerCase()) === -1;
}

/**
 * THE TEAM DOOR. Travis and Rachel test the real app before Friday, so the
 * lock page hides a way in: the founder key (FOUNDER_KEY) buys a cookie, and
 * the cookie is an HMAC of this message under that key, so it cannot be made
 * without the key and dies if the key changes. It is not entitlement: it opens
 * no Premium, only the doors every family gets on Friday.
 */
export const PREVIEW_COOKIE = "sona_preview";
export const PREVIEW_MESSAGE = "sona-launch-preview-v1";
/** The cookie's value, with Web Crypto: the middleware runs on the edge. */
export async function previewToken(key: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(PREVIEW_MESSAGE)));
  let hex = "";
  for (let i = 0; i < sig.length; i++) hex += sig[i].toString(16).padStart(2, "0");
  return hex;
}

/**
 * THE ONE EMAIL A PARENT OR "OTHER" GETS FOR SIGNING UP while the app is not
 * ready: thank you, it launches Friday, watch for our email. Sent through
 * Resend, the same as the sign-in email, because it is the one sender that
 * works today. It carries no name — the landing page asks for none — and
 * nothing about a child. /api/lead sends it at most once per address.
 */
export async function sendWelcomeEmail(email: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.RESEND_FROM || "Sona <login@speaksona.com>";
  // WHERE A REPLY GOES (Travis, 26 Sep 2026: "where can i look to see if
  // there's been a response"). login@speaksona.com is a sending address with
  // no inbox behind it, so a family who writes back reaches nobody. Set
  // RESEND_REPLY_TO in Vercel to an inbox that is read and replies land there.
  const replyTo = (process.env.RESEND_REPLY_TO || "").trim();
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        ...(/^\S+@\S+\.\S+$/.test(replyTo) ? { reply_to: replyTo } : {}),
        subject: "You're on the list for Sona",
        html:
          `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:15px;color:#16384f;line-height:1.6;max-width:520px;">` +
          `<p>Hi,</p>` +
          `<p>Thank you for signing up for Sona, speech practice kids actually want to do.</p>` +
          `<p><b>${LAUNCH_NOTE}</b></p>` +
          `<p>Talk soon,<br>Travis and Rachel</p>` +
          `<p style="color:#6b86a3;font-size:13px;margin-top:22px;">You're getting this because this address was entered at speaksona.com. If that wasn't you, you can ignore it.</p>` +
          `</div>`,
        text:
          "Hi,\n\n" +
          "Thank you for signing up for Sona, speech practice kids actually want to do.\n\n" +
          LAUNCH_NOTE + "\n\n" +
          "Talk soon,\nTravis and Rachel\n\n" +
          "You're getting this because this address was entered at speaksona.com. If that wasn't you, you can ignore it.\n",
      }),
    });
    if (!r.ok) {
      let why = String(r.status);
      try { why += " " + (await r.text()).slice(0, 300); } catch { /* status alone */ }
      console.error("[launch] Resend refused the welcome email:", why);
    }
    return r.ok;
  } catch (e) {
    console.error("[launch] welcome email threw:", e instanceof Error ? e.message : String(e));
    return false;
  }
}
