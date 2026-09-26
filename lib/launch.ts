/**
 * IS THE APP READY? (Travis, 25 Sep 2026.) The iPhone app closes on launch on
 * iOS 27 until 1.0.3 is in the App Store, so the landing page stops sending
 * people there. Instead it thanks them, says the app launches next week, and
 * emails them to say the same; a speech therapist goes to their dashboard.
 *
 * ONE SWITCH, THREE COPIES, like FREE_MODE: this one (the emails) and
 * `var APP_READY` in public/parents.html (the root) and public/for-slps.html,
 * which are static and cannot import this. tests/shiptest.mjs fails if they
 * disagree. When the app is live, set all three to true: the pages send people
 * to the App Store again and these emails stop.
 */
export const APP_READY = false;

/** Travis's words, the same on the page, in the welcome and in the SLP's email. */
export const LAUNCH_NOTE = "The Sona app launches next week. We'll email you the moment it's ready.";

/**
 * THE ONE EMAIL A PARENT OR "OTHER" GETS FOR SIGNING UP while the app is not
 * ready: thank you, it launches next week, watch for our email. Sent through
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
