/**
 * THE BLACK FRIDAY EMAIL (BFMAIL1, Travis, 25 Nov 2026: "set up resend to
 * send them an email once they opt in as a lead. And these emails right now,
 * I want to be focusing on the Black Friday promotion").
 *
 * A speech therapist (role "slp") who gives an email on either opt-in (/ or
 * /blackfriday) while the deal is on (lib/caseload's bfOn: Sona Pro $9.99 a
 * month for 3 months, no free trial, until Sunday 29 Nov 11:59 PM Mountain)
 * gets ONE email from Rachel, at once: the deal, what Sona Pro does, when it
 * ends, and a button to the deal's plans. Once per address (`bfmail:<email>`,
 * set before the send, given back if the send fails), never to an address
 * that unsubscribed, always with the unsubscribe link and the mailing
 * address. After the end nothing is sent. Never anything about a child.
 *
 * It goes through lib/mail's one door (Resend while GoHighLevel is off,
 * GHLEXIT1). Every word is Travis's to change; the figures are lib/caseload's.
 */
import { kvCmd } from "@/lib/slpAuth";
import { sendMail } from "@/lib/mail";
import { config, esc, unsubToken, unsubscribed } from "@/lib/nurture";
import { APP_ORIGIN } from "@/lib/site";
import { BF_ENDS_AT, BF_MONTHS, BF_PRICE, PRO_PRICE, bfOn } from "@/lib/caseload";

type Kv = (cmd: (string | number)[]) => Promise<unknown>;
type Fetch = typeof fetch;

/** The deal's plans, on the website (the marketing pages live on www). */
export const BF_PLANS_URL = "https://www.speaksona.com/blackfriday/plans?utm_source=email&utm_campaign=bf-2026#pricing";

export const bfKey = (email: string) => "bfmail:" + email;

export function bfContent(): { subject: string; preview: string; paras: string[]; button: string; after: string[] } {
  return {
    subject: "Sona Pro is half off until Sunday",
    preview: `${BF_PRICE} a month for your first ${BF_MONTHS} months. Ends Sunday at 11:59 PM Mountain.`,
    paras: [
      "Hi! Thanks for checking out Sona.",
      `This week only, Sona Pro is half off: ${BF_PRICE} a month for your first ${BF_MONTHS} months, then ${PRO_PRICE} a month.`,
      "Kids say their sound to play Sona’s games, in your sessions and at home. With Sona Pro, every family on your caseload gets every game, and you see who practiced between sessions.",
      `The deal ends Sunday, November 29 at 11:59 PM Mountain. It has no free trial: you pay ${BF_PRICE} today, and you can cancel anytime.`,
    ],
    button: "Get the Black Friday price",
    after: ["Questions? Just reply to this email."],
  };
}

export function renderBf(unsubUrl: string, postal: string): { subject: string; html: string; text: string } {
  const c = bfContent();
  const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;"';
  const html =
    `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;">` +
    `<div style="display:none;max-height:0;overflow:hidden;">${esc(c.preview)}</div>` +
    `<div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    c.paras.map((p) => `<p ${P}>${esc(p)}</p>`).join("") +
    `<p style="margin:24px 0 16px;"><a href="${BF_PLANS_URL}" style="display:inline-block;background:#1d2b4f;color:#ffffff;text-decoration:none;font-weight:700;font-size:17px;padding:13px 26px;border-radius:12px;">${esc(c.button)}</a></p>` +
    c.after.map((p) => `<p ${P}>${esc(p)}</p>`).join("") +
    `<p style="margin:24px 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;">Rachel, MS, CF-SLP<br>Sona co-founder</p>` +
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#8a8a8a;">You’re getting this because you gave Sona your email.<br>Sona · ${esc(postal)}<br><a href="${unsubUrl}" style="color:#8a8a8a;">Unsubscribe</a></p>` +
    `</div></body></html>`;
  const text =
    c.paras.join("\n\n") + `\n\n${c.button}: ${BF_PLANS_URL}\n\n` +
    c.after.join("\n\n") + "\n\n" +
    "Rachel, MS, CF-SLP\nSona co-founder\n" +
    `--\nYou’re getting this because you gave Sona your email.\nSona · ${postal}\nUnsubscribe: ${unsubUrl}\n`;
  return { subject: c.subject, html, text };
}

/**
 * Send the Black Friday email to a speech therapist's new lead, once. True
 * only when it was sent now. Never throws.
 */
export async function sendBfEmail(rawEmail: string, kv: Kv = kvCmd, f: Fetch = fetch, now: number = Date.now()): Promise<boolean> {
  try {
    const email = rawEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !bfOn(now)) return false;
    const cfg = config();
    if (!cfg) return false;
    if ((await unsubscribed(email, kv)) !== false) return false;
    const left = Math.max(60, Math.ceil((BF_ENDS_AT - now) / 1000) + 30 * 86400);
    const first = await kv(["SET", bfKey(email), new Date(now).toISOString(), "NX", "EX", left]);
    if (first !== "OK") return false;
    const unsubUrl = `${APP_ORIGIN}/api/email/unsub?e=${encodeURIComponent(email)}&k=${unsubToken(email, cfg.secret)}`;
    const { subject, html, text } = renderBf(unsubUrl, cfg.postal);
    const r = await sendMail({
      from: cfg.from, to: email, replyTo: cfg.replyTo, subject, html, text,
      idempotencyKey: `bfmail-2026-${email}`,
      headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }, { fetch: f, retry429Ms: 1100 });
    if (!r.ok) {
      console.error("[bfmail] the email was refused", r.status);
      try { await kv(["DEL", bfKey(email)]); } catch { /* the next opt-in tries again */ }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
