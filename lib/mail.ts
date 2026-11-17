/**
 * EVERY EMAIL SONA SENDS GOES THROUGH HERE (16 Nov 2026, Travis: "I don't
 * want resend doing the emails. I want it all connected with high level").
 *
 * With GHL_API_TOKEN (a GoHighLevel Private Integration token with the
 * contacts and conversations/message scopes) and GHL_LOCATION_ID both set,
 * an email is sent by GoHighLevel: the address is made (or found) as a
 * contact in that location, then the email goes out as a message in that
 * contact's conversation. Without them it falls back to Resend
 * (RESEND_API_KEY), exactly as every send worked before, so nothing breaks
 * the day this ships, before the token is in Vercel.
 *
 * What GoHighLevel's send does not have, and so a GHL email does not carry:
 *  - a reply-to (a reply lands in the contact's GHL conversation);
 *  - our List-Unsubscribe headers (each email's own unsubscribe link, in its
 *    footer, still works: /api/email/unsub);
 *  - an idempotency key: the callers' own sent marks stop a double send, and
 *    only a 429 (nothing was sent) is tried again here.
 * A contact whose email is on Do Not Disturb in GHL is sent nothing by GHL,
 * the sign-in link included.
 *
 * Never logged: the token, an address, a subject or a body. A refusal logs
 * its status only.
 */

type Fetch = typeof fetch;

export const GHL_API = "https://services.leadconnectorhq.com";
/** GHL's API versions, from its v2 docs: contacts and conversations differ. */
export const GHL_CONTACTS_VERSION = "2021-07-28";
export const GHL_MESSAGES_VERSION = "2021-04-15";

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** "Name <address>" or an address; GHL is given the address alone. */
  from?: string;
  /** Resend only. */
  replyTo?: string;
  /** Resend only. */
  idempotencyKey?: string;
  /** Resend only (List-Unsubscribe). */
  headers?: Record<string, string>;
  /** GHL only: tags put on the contact, so a GHL workflow can tell a transactional address from a lead. */
  tags?: string[];
};

export type MailResult = { ok: boolean; id?: string; status: number; detail: string; via: "ghl" | "resend" | "none" };

export type MailOpts = {
  fetch?: Fetch;
  /** The fuse on each request, in ms (about 8 s). */
  timeoutMs?: number;
  /** Resend only: try a 429 once more after this many ms (nurture's 1.1 s). GHL always tries a 429 once more. */
  retry429Ms?: number;
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_FROM = "Sona <login@speaksona.com>";

function ghlCreds(): { token: string; location: string } | null {
  const token = (process.env.GHL_API_TOKEN || "").trim();
  const location = (process.env.GHL_LOCATION_ID || "").trim();
  return token && location ? { token, location } : null;
}

/** GoHighLevel will send. */
export function ghlConfigured(): boolean {
  return ghlCreds() !== null;
}

/** Something will send: GoHighLevel, or Resend as the fallback. */
export function mailConfigured(): boolean {
  return ghlConfigured() || Boolean((process.env.RESEND_API_KEY || "").trim());
}

/** The address out of "Name <address>". */
export function addressOf(from: string): string {
  const m = /<([^>]+)>/.exec(from);
  return (m ? m[1] : from).trim();
}

const wait = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

/**
 * A refusal's own words, cut short, for `detail`. lib/mail never logs it: a
 * caller that knows the address belongs to an account holder may (the
 * sign-in email does, so an unverified sending domain is named in the log);
 * a caller writing to anyone else must not, since the text can quote the
 * recipient.
 */
async function why(r: Response): Promise<string> {
  try { return (await r.text()).slice(0, 300); } catch { return ""; }
}

async function timed(f: Fetch, url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await f(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function ghlHeaders(token: string, version: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Version: version, "Content-Type": "application/json", Accept: "application/json" };
}

/** One GHL call, tried once more on a 429. */
async function ghlCall(f: Fetch, url: string, init: RequestInit, ms: number, sleep: (ms: number) => Promise<void>): Promise<Response> {
  let r = await timed(f, url, init, ms);
  if (r.status === 429) {
    await sleep(1100);
    r = await timed(f, url, init, ms);
  }
  return r;
}

/** The contact id for an address (made if new). Throws on a refusal, with the status only. */
async function ghlContact(f: Fetch, c: { token: string; location: string }, email: string, tags: string[] | undefined, ms: number, sleep: (ms: number) => Promise<void>): Promise<{ id: string; status: number; text?: string }> {
  const body: Record<string, unknown> = { locationId: c.location, email };
  if (tags && tags.length) body.tags = tags;
  const r = await ghlCall(f, `${GHL_API}/contacts/upsert`, { method: "POST", headers: ghlHeaders(c.token, GHL_CONTACTS_VERSION), body: JSON.stringify(body) }, ms, sleep);
  if (!r.ok) return { id: "", status: r.status, text: await why(r) };
  let j: { contact?: { id?: unknown } } = {};
  try { j = (await r.json()) as typeof j; } catch { /* no body */ }
  const id = typeof j.contact?.id === "string" ? j.contact.id : "";
  return { id, status: r.status };
}

async function viaGhl(msg: Mail, c: { token: string; location: string }, f: Fetch, ms: number, sleep: (ms: number) => Promise<void>): Promise<MailResult> {
  const contact = await ghlContact(f, c, msg.to, msg.tags, ms, sleep);
  if (!contact.id) {
    console.error("[mail] GoHighLevel refused the contact:", contact.status);
    return { ok: false, status: contact.status || 502, detail: ("GoHighLevel contact " + (contact.text || "had no id")).trim(), via: "ghl" };
  }
  const body: Record<string, unknown> = {
    type: "Email",
    contactId: contact.id,
    subject: msg.subject,
    html: msg.html,
    message: msg.text,
    emailTo: msg.to,
  };
  const fromEnv = (process.env.GHL_EMAIL_FROM || "").trim();
  const from = fromEnv || (msg.from ? addressOf(msg.from) : "");
  if (from) body.emailFrom = from;
  const r = await ghlCall(f, `${GHL_API}/conversations/messages`, { method: "POST", headers: ghlHeaders(c.token, GHL_MESSAGES_VERSION), body: JSON.stringify(body) }, ms, sleep);
  if (!r.ok) {
    console.error("[mail] GoHighLevel refused the email:", r.status);
    return { ok: false, status: r.status, detail: ("GoHighLevel " + (await why(r))).trim(), via: "ghl" };
  }
  let j: { messageId?: unknown; emailMessageId?: unknown } = {};
  try { j = (await r.json()) as typeof j; } catch { /* no body */ }
  const id = typeof j.messageId === "string" ? j.messageId : typeof j.emailMessageId === "string" ? j.emailMessageId : undefined;
  return { ok: true, id, status: r.status, detail: "sent", via: "ghl" };
}

async function viaResend(msg: Mail, key: string, f: Fetch, opts: MailOpts, ms: number, sleep: (ms: number) => Promise<void>): Promise<MailResult> {
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  if (msg.idempotencyKey) headers["Idempotency-Key"] = msg.idempotencyKey;
  const body: Record<string, unknown> = { from: msg.from || process.env.RESEND_FROM || DEFAULT_FROM, to: [msg.to] };
  if (msg.replyTo) body.reply_to = msg.replyTo;
  body.subject = msg.subject;
  body.html = msg.html;
  body.text = msg.text;
  if (msg.headers) body.headers = msg.headers;
  const send = () => timed(f, "https://api.resend.com/emails", { method: "POST", headers, body: JSON.stringify(body) }, ms);
  let r = await send();
  if (r.status === 429 && opts.retry429Ms) {
    await sleep(opts.retry429Ms);
    r = await send();
  }
  if (!r.ok) return { ok: false, status: r.status, detail: await why(r), via: "resend" };
  let id: string | undefined;
  try { const j = (await r.json()) as { id?: unknown }; if (typeof j.id === "string") id = j.id; } catch { /* no body */ }
  return { ok: true, id, status: r.status, detail: "sent", via: "resend" };
}

/**
 * Send one email. Never throws: a network error or the fuse is
 * `{ ok: false, status: 0 }`. Callers keep their own sent marks, pacing and
 * logging; this logs only a GHL refusal's status.
 */
export async function sendMail(msg: Mail, opts: MailOpts = {}): Promise<MailResult> {
  const f = opts.fetch || fetch;
  const ms = opts.timeoutMs || 8000;
  const sleep = opts.sleep || wait;
  try {
    const c = ghlCreds();
    if (c) return await viaGhl(msg, c, f, ms, sleep);
    const key = (process.env.RESEND_API_KEY || "").trim();
    if (key) return await viaResend(msg, key, f, opts, ms, sleep);
    return { ok: false, status: 0, detail: "not configured", via: "none" };
  } catch (e) {
    const name = e instanceof Error && e.name === "AbortError" ? "timeout" : "network";
    return { ok: false, status: 0, detail: name, via: ghlConfigured() ? "ghl" : "resend" };
  }
}

/**
 * An unsubscribe, told to GoHighLevel: the contact's email goes on Do Not
 * Disturb (dndSettings.Email "active"; calls and texts untouched). From then
 * on GHL sends that address nothing, Sona's sign-in links included: a
 * clinician who unsubscribes and later asks for a sign-in link gets no email
 * until the DND is lifted in GHL. True when GHL took it; false when GHL is
 * not configured or did not answer (`email:unsub` already stops every email
 * Sona itself sends, so a miss here only matters to GHL's own workflows).
 */
export async function ghlEmailDnd(email: string, opts: MailOpts = {}): Promise<boolean> {
  const c = ghlCreds();
  if (!c) return false;
  const f = opts.fetch || fetch;
  const ms = opts.timeoutMs || 8000;
  const sleep = opts.sleep || wait;
  try {
    const contact = await ghlContact(f, c, email, undefined, ms, sleep);
    if (!contact.id) {
      console.error("[mail] GoHighLevel refused the contact for an unsubscribe:", contact.status);
      return false;
    }
    const r = await ghlCall(f, `${GHL_API}/contacts/${encodeURIComponent(contact.id)}`, {
      method: "PUT",
      headers: ghlHeaders(c.token, GHL_CONTACTS_VERSION),
      body: JSON.stringify({ dndSettings: { Email: { status: "active", message: "Unsubscribed from a Sona email" } } }),
    }, ms, sleep);
    if (!r.ok) console.error("[mail] GoHighLevel refused the email DND:", r.status);
    return r.ok;
  } catch {
    return false;
  }
}
