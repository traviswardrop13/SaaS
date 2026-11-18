import { config, esc, unsubscribed, unsubToken } from "@/lib/nurture";
import { sendMail } from "@/lib/mail";

/**
 * THE PACKET'S EMAIL (17 Nov 2026). speaksona.com/ (public/packet.html) asks a
 * clinician for their email in exchange for a free printable home-practice
 * packet, and /api/lead hands every opt-in posted with this source to
 * sendPacketEmail: one email with the packet's link. A role "slp" lead gets no
 * other automatic email (never the parents' welcome series, audit B2), so
 * without this the packet would never arrive.
 *
 * - ONCE PER ADDRESS a year (`packetmail:<email>`, SET NX before sending, so a
 *   double tap or a retry cannot send two). A send that fails takes the mark
 *   back, so asking again tomorrow works; the page links the packet either way.
 * - Never to an address in `email:unsub`, and a store that does not answer
 *   sends nothing (fail closed, as the series does).
 * - CAN-SPAM, like every list email: the mailing address (EMAIL_POSTAL) and a
 *   one-tap unsubscribe link, both from lib/nurture's config(). Without that
 *   config nothing sends, silently: the opt-in has already taken the visitor
 *   to a page that links the packet.
 * - Through lib/mail (GoHighLevel when it is set up, else Resend), tagged
 *   `sona-packet` so a GoHighLevel workflow can tell it from a sign-in email.
 *   Nothing about any child: the only thing it knows is an email address.
 */
export const PACKET_SOURCE = "slp-packet";
export const PACKET_URL = "https://www.speaksona.com/packet";
export const PLANS_URL = "https://www.speaksona.com/plans";
export const PACKET_SUBJECT = "Your free home-practice packet";

type Kv = (cmd: (string | number)[]) => Promise<unknown>;
type Fetch = typeof fetch;
export type PacketResult = "sent" | "already" | "unsub" | "off" | "failed";

export const packetKey = (email: string) => "packetmail:" + email;

export function renderPacket(unsubUrl: string, postal: string): { subject: string; html: string; text: string } {
  const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;"';
  const paras = [
    "Here is your free home-practice packet: word lists for every sound, sorted by where the sound sits in the word, a one-page guide for parents, and a tick-box tracker on every page.",
    "Circle the sound and the place in the word each child is ready for, print that page with the parent guide, and send it home.",
  ];
  const after = "When you want families to practice between sessions with games they will play, and to see who practiced, here are Sona's plans for speech therapists:";
  const html =
    `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;">` +
    `<div style="display:none;max-height:0;overflow:hidden;">Word lists for every sound, and a one-page guide for parents.</div>` +
    `<div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    paras.map((p) => `<p ${P}>${esc(p)}</p>`).join("") +
    `<p style="margin:24px 0 16px;"><a href="${PACKET_URL}" style="display:inline-block;background:#146d73;color:#ffffff;text-decoration:none;font-weight:700;font-size:17px;padding:13px 26px;border-radius:12px;">Open your packet</a></p>` +
    `<p ${P}>${esc(after)} <a href="${PLANS_URL}" style="color:#0b4e55;">speaksona.com/plans</a></p>` +
    `<p style="margin:24px 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;">Rachel, MS, CF-SLP<br>Sona co-founder</p>` +
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#8a8a8a;">You’re getting this because you asked for Sona’s home-practice packet.<br>Sona · ${esc(postal)}<br><a href="${unsubUrl}" style="color:#8a8a8a;">Unsubscribe</a></p>` +
    `</div></body></html>`;
  const text =
    paras.join("\n\n") + `\n\nOpen your packet: ${PACKET_URL}\n\n${after} ${PLANS_URL}\n\n` +
    "Rachel, MS, CF-SLP\nSona co-founder\n" +
    `--\nYou’re getting this because you asked for Sona’s home-practice packet.\nSona · ${postal}\nUnsubscribe: ${unsubUrl}\n`;
  return { subject: PACKET_SUBJECT, html, text };
}

/** Never throws. "off": mail or its unsubscribe config is not set up here. */
export async function sendPacketEmail(rawEmail: string, kv: Kv, f: Fetch = fetch): Promise<PacketResult> {
  const email = rawEmail.trim().toLowerCase();
  try {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "failed";
    const cfg = config();
    if (!cfg) return "off";
    const unsub = await unsubscribed(email, kv);
    if (unsub === true) return "unsub";
    if (unsub !== false) return "failed";
    const first = await kv(["SET", packetKey(email), new Date().toISOString(), "NX", "EX", 31536000]);
    if (first !== "OK") return first === null ? "already" : "failed";
    const unsubUrl = `https://speaksona.com/api/email/unsub?e=${encodeURIComponent(email)}&k=${unsubToken(email, cfg.secret)}`;
    const { subject, html, text } = renderPacket(unsubUrl, cfg.postal);
    const r = await sendMail({
      from: cfg.from, to: email, replyTo: cfg.replyTo, subject, html, text,
      idempotencyKey: `packet-${email}`,
      headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      tags: ["sona-packet"],
    }, { fetch: f, retry429Ms: 1100 });
    if (r.ok) return "sent";
    console.error("[packet] the email was refused", r.status);
    try { await kv(["DEL", packetKey(email)]); } catch { /* the mark expires in a year */ }
    return "failed";
  } catch {
    return "failed";
  }
}
