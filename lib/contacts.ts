import { createHash } from "crypto";
import { kvCmd } from "@/lib/slpAuth";
import { mailbox, suppressed } from "@/lib/report";
import { readClinicians, readLeads } from "@/lib/founder";

/**
 * THE EMAIL LIST IS RESEND'S CONTACTS (Travis, 16 Oct 2026: "I am done using
 * Kit. I'm going to be using Resend", then "how can we get it so every new
 * email goes into like a resend contact list ... I want to be able to not
 * have to go into that HTML page"). Kit held the list from 24 Sep to 16 Oct
 * 2026; Resend already sent every email Sona sends, so now it holds the list
 * too, and Travis sees and emails it from Resend's own dashboard.
 *
 * Every grown-up's email that reaches /api/lead becomes a Resend contact,
 * in one of three segments by who they said they are (Parents, Speech
 * therapists, Other) and, once the phone says they started Sona Premium, in
 * "Started Premium" too. Each contact carries three properties: `role`,
 * `source` (where the address was given) and `plan` ("trial" or "paid").
 * What reaches Resend: the email address, a CLINICIAN's own first name
 * (never a parent's, never a child's: the lead route passes one only for
 * role "slp"), and those three words. Nothing about a child, ever.
 *
 * Unsubscribes, both ways:
 *  - an address in Sona's `email:unsub` (lib/report.ts suppressed: the exact
 *    address or its plain mailbox) is created as unsubscribed, and Sona's
 *    own unsubscribe link marks the contact unsubscribed (markUnsubscribed);
 *  - a contact who unsubscribed in Resend (from a broadcast Travis sent)
 *    joins `email:unsub` on the daily run (pullUnsubscribes), so the welcome
 *    series and the weekly report stop for them too. One list.
 *  - before any address Sona already held is added (the backfill), Kit's
 *    own unsubscribes are copied into `email:unsub` once (importKit), while
 *    Kit's key still works, so nobody who left Kit is put back on a list.
 *
 * Resend allows about two requests a second for the whole account, shared
 * with every email Sona sends, so every call here is retried once after a
 * 429 and the daily backfill paces itself.
 */

type Kv = (cmd: (string | number)[]) => Promise<unknown>;
type Fetch = typeof fetch;
export type Io = { kv: Kv; f: Fetch; sleep: (ms: number) => Promise<void> };
const realIo = (): Io => ({ kv: kvCmd, f: fetch, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });

const API = "https://api.resend.com";
const KIT_API = "https://api.kit.com/v4";
const STEP_MS = 2500;
const RETRY_MS = 1100;

export type Role = "parent" | "slp" | "other";
export type Plan = "trial" | "paid" | "";

/** The segments Travis sees in Resend, by the key Sona files them under. */
export const SEGMENTS: Record<Role | "plan", string> = {
  parent: "Parents",
  slp: "Speech therapists",
  other: "Other",
  plan: "Started Premium",
};
export const PROPERTIES = ["role", "source", "plan"] as const;

/** Addresses Resend already has (from /api/lead or the backfill). lib/founder
 * reads the same key for the leads page (it cannot import this file, which
 * reads it). */
export const SYNCED = "resend:synced";
/** Set once Kit's unsubscribes are in `email:unsub` (JSON: when, how many). */
export const KIT_DONE = "resend:kitunsub";

export type ListResult = { ok: boolean; status: number; detail: string };

export function contactsConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY || "").trim();
}

/**
 * Who a lead is, for the segment: clinicians (SLPs and SLPAs), "other", and
 * parents, which is also every lead that arrives without a role (the Speech
 * Check, the reminder pledge). The same three Kit's tags were.
 */
export function roleOf(role: unknown): Role {
  return role === "slp" ? "slp" : role === "other" ? "other" : "parent";
}

/**
 * THE PLAN (5 Oct 2026): sona.js posts "trial" when Apple started a parent's
 * free days and "paid" when it charged them at once. Only these two words
 * ever arrive; anything else is no plan.
 */
export function planWord(plan: unknown): Plan {
  return plan === "trial" ? "trial" : plan === "paid" ? "paid" : "";
}

export function cleanEmail(raw: unknown): string {
  const e = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return e.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : "";
}

type Call = { ok: boolean; status: number; json: Record<string, unknown> | null; text: string };

async function call(io: Io, base: string, path: string, method: string, body?: unknown, headers?: Record<string, string>): Promise<Call> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctl = new AbortController();
    const fuse = setTimeout(() => ctl.abort(), STEP_MS);
    let out: Call;
    try {
      const r = await io.f(base + path, {
        method,
        headers: { "Content-Type": "application/json", Accept: "application/json", ...(headers || {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctl.signal,
      });
      const text = await r.text().catch(() => "");
      let json: Record<string, unknown> | null = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }
      out = { ok: r.ok, status: r.status, json, text: text.slice(0, 300) };
    } catch (e) {
      out = { ok: false, status: 0, json: null, text: e instanceof Error ? e.message : String(e) };
    } finally {
      clearTimeout(fuse);
    }
    if (out.status !== 429 || attempt === 1) return out;
    await io.sleep(RETRY_MS);
  }
  return { ok: false, status: 0, json: null, text: "unreachable" };
}

const resend = (io: Io, path: string, method: string, body?: unknown) =>
  call(io, API, path, method, body, { Authorization: "Bearer " + (process.env.RESEND_API_KEY || "") });

/** The words a founder reads when a call fails. */
function why(c: Call): string {
  if (c.status === 401 || c.status === 403) return "the Resend key can only send emails: give it Full access (" + c.status + ")";
  if (c.status === 0) return "unreachable";
  const msg = c.json && typeof c.json.message === "string" ? ": " + c.json.message.slice(0, 120) : "";
  return String(c.status) + msg;
}

/**
 * The segment ids and the properties, made the first time and kept in the
 * store under the key's own hash (a new Resend account, a new key, starts
 * fresh). A segment or property Travis already made by the same name is
 * used, never a second copy.
 */
function listKey(): string {
  return "resend:list:" + createHash("sha256").update(process.env.RESEND_API_KEY || "").digest("hex").slice(0, 12);
}

function hashOf(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(raw)) for (let i = 0; i + 1 < raw.length; i += 2) out[String(raw[i])] = String(raw[i + 1]);
  else if (raw && typeof raw === "object") for (const [k, v] of Object.entries(raw as Record<string, unknown>)) out[k] = String(v);
  return out;
}

type Segs = Record<Role | "plan", string>;
const SEG_KEYS = Object.keys(SEGMENTS) as (Role | "plan")[];

async function listAll(io: Io, path: string): Promise<{ ok: true; rows: Record<string, unknown>[] } | { ok: false; c: Call }> {
  const rows: Record<string, unknown>[] = [];
  let after = "";
  for (let page = 0; page < 10; page++) {
    const c = await resend(io, path + "?limit=100" + (after ? "&after=" + encodeURIComponent(after) : ""), "GET");
    if (!c.ok || !c.json) return { ok: false, c };
    const data = Array.isArray(c.json.data) ? (c.json.data as Record<string, unknown>[]) : [];
    rows.push(...data);
    if (!c.json.has_more || !data.length) break;
    after = String(data[data.length - 1].id || "");
    if (!after) break;
  }
  return { ok: true, rows };
}

const LIST_LOCK = "resend:listlock";

export async function ensureList(io: Io = realIo()): Promise<{ ok: true; segs: Segs } | { ok: false; detail: string; status: number }> {
  const key = listKey();
  let have: Record<string, string> = {};
  try { have = hashOf(await io.kv(["HGETALL", key])); } catch { have = {}; }
  if (SEG_KEYS.every((k) => have["seg:" + k]) && have.props === "1") {
    return { ok: true, segs: Object.fromEntries(SEG_KEYS.map((k) => [k, have["seg:" + k]])) as Segs };
  }

  // One setter at a time: two first leads at once (or a lead and the daily
  // run) would each make a "Parents". The one that waits is not captured
  // now, and the daily backfill adds it.
  let lock: unknown = null;
  try { lock = await io.kv(["SET", LIST_LOCK, "1", "NX", "EX", 30]); } catch { lock = null; }
  if (lock !== "OK") return { ok: false, detail: "the list is being set up", status: 0 };
  try {
    const segs = await listAll(io, "/segments");
    if (!segs.ok) return { ok: false, detail: "segments " + why(segs.c), status: segs.c.status };
    const byName = new Map(segs.rows.map((s) => [String(s.name || "").toLowerCase(), String(s.id || "")]));
    const found: Partial<Segs> = {};
    for (const k of SEG_KEYS) {
      let id = byName.get(SEGMENTS[k].toLowerCase()) || "";
      if (!id) {
        const made = await resend(io, "/segments", "POST", { name: SEGMENTS[k] });
        id = made.ok && made.json ? String(made.json.id || "") : "";
        if (!id) return { ok: false, detail: "segment " + SEGMENTS[k] + " " + why(made), status: made.status };
      }
      found[k] = id;
    }

    const props = await listAll(io, "/contact-properties");
    if (!props.ok) return { ok: false, detail: "properties " + why(props.c), status: props.c.status };
    const keys = new Set(props.rows.map((p) => String(p.key || "")));
    for (const p of PROPERTIES) {
      if (keys.has(p)) continue;
      const made = await resend(io, "/contact-properties", "POST", { key: p, type: "string" });
      // 409/422: it exists after all (made a moment ago, or Travis made it)
      if (!made.ok && made.status !== 409 && made.status !== 422) return { ok: false, detail: "property " + p + " " + why(made), status: made.status };
    }

    const fields: (string | number)[] = [];
    for (const k of SEG_KEYS) fields.push("seg:" + k, String(found[k]));
    fields.push("props", "1");
    try { await io.kv(["HSET", key, ...fields]); } catch { /* found again next time */ }
    return { ok: true, segs: found as Segs };
  } finally {
    try { await io.kv(["DEL", LIST_LOCK]); } catch { /* it expires */ }
  }
}

const forgetList = async (io: Io) => { try { await io.kv(["DEL", listKey()]); } catch { /* fine */ } };

export type Contact = { email: string; firstName?: string; role?: unknown; source?: string; plan?: unknown };

/**
 * A post that did not fully reach Resend (a refusal, a timeout, a 429 twice,
 * a segment not added) waits here, address → what it carried, until the
 * daily run tries it again (retryContacts). It matters most for a purchase:
 * the phone tells Sona once, and the address is usually already in Resend.
 */
export const RETRY = "resend:retry";

async function owe(io: Io, c: Contact): Promise<void> {
  const email = cleanEmail(c.email);
  if (!email) return;
  try {
    let was: Contact | null = null;
    try { was = JSON.parse(String(await io.kv(["HGET", RETRY, email]))) as Contact | null; } catch { was = null; }
    // never lose a purchase the phone will not say again: paid over trial
    const plan = planWord(c.plan) === "paid" || planWord(was && was.plan) === "paid" ? "paid" : planWord(c.plan) || planWord(was && was.plan);
    const keep: Contact = { email, firstName: c.firstName || (was && was.firstName) || "", role: c.role || (was && was.role) || "",
      source: c.source || (was && was.source) || "", plan };
    await io.kv(["HSET", RETRY, email, JSON.stringify(keep)]);
  } catch { /* the ledger still has the lead */ }
}

/** A contact Resend holds: the plan (if any), unsubscribed (only ever true), the segments, paced. */
async function topUp(io: Io, email: string, plan: Plan, off: boolean, segIds: string[], getFirst: boolean): Promise<{ ok: boolean; status: number; notes: string[] }> {
  const at = "/contacts/" + encodeURIComponent(email);
  const patch = { ...(plan ? { properties: { plan } } : {}), ...(off ? { unsubscribed: true } : {}) };
  let status = 200;
  // Resend's two requests a second are the whole account's: the create has
  // just gone, so every call here waits its turn
  if (Object.keys(patch).length || getFirst) {
    await io.sleep(550);
    const there = Object.keys(patch).length ? await resend(io, at, "PATCH", patch) : await resend(io, at, "GET");
    if (!there.ok) return { ok: false, status: there.status, notes: [] };
    status = there.status;
  }
  const notes: string[] = [];
  for (const id of segIds) {
    await io.sleep(550);
    const s = await resend(io, at + "/segments/" + encodeURIComponent(id), "POST");
    if (!s.ok && s.status !== 409 && s.status !== 422) notes.push("segment " + why(s));
  }
  return { ok: true, status, notes };
}

/**
 * One grown-up into Resend: made as a contact in their segment(s), or, when
 * Resend already has them, given the plan (if any) and the segment(s). It
 * never re-subscribes anyone: `unsubscribed` is only ever set to true, and
 * only when Sona's own list says so. Counts as ok once Resend holds the
 * address; anything that did not fully land is owed (RETRY).
 */
export async function upsertContact(c: Contact, io: Io = realIo()): Promise<ListResult> {
  if (!contactsConfigured()) return { ok: false, status: 0, detail: "not configured" };
  const email = cleanEmail(c.email);
  if (!email) return { ok: false, status: 0, detail: "not an address" };
  const r = await upsertOnce({ ...c, email }, io);
  if (r.full) { try { await io.kv(["HDEL", RETRY, email]); } catch { /* tried again, harmlessly */ } }
  else await owe(io, { ...c, email });
  return { ok: r.ok, status: r.status, detail: r.detail };
}

async function upsertOnce(c: Contact & { email: string }, io: Io): Promise<ListResult & { full: boolean }> {
  const email = c.email;
  const role = roleOf(c.role), plan = planWord(c.plan);
  const source = typeof c.source === "string" ? c.source.slice(0, 40) : "";
  // only a clinician's own name travels (the lead route already blanks the rest)
  const firstName = role === "slp" && typeof c.firstName === "string" ? c.firstName.trim().slice(0, 60) : "";

  let off: boolean | null = null;
  try { off = await suppressed(email, io.kv); } catch { off = null; }
  // the store didn't answer: never add someone as subscribed on a guess
  if (off === null) return { ok: false, full: false, status: 0, detail: "store did not answer" };

  const list = await ensureList(io);
  if (!list.ok) return { ok: false, full: false, status: list.status, detail: list.detail };
  const segIds = [list.segs[role], ...(plan ? [list.segs.plan] : [])];

  const made = await resend(io, "/contacts", "POST", {
    email,
    ...(firstName ? { first_name: firstName } : {}),
    ...(off ? { unsubscribed: true } : {}),
    properties: { role, ...(source ? { source } : {}), ...(plan ? { plan } : {}) },
    segments: segIds.map((id) => ({ id })),
  });
  if (made.ok) {
    // If Resend answers a known address with a success too, it may have kept
    // the old contact as it was: what matters most (a purchase, or that they
    // left) is given to it again. Both are safe to repeat.
    let notes: string[] = [];
    if (plan || off) {
      const t = await topUp(io, email, plan, off, segIds, false);
      notes = t.ok ? t.notes : ["update " + why({ ok: false, status: t.status, json: null, text: "" })];
    }
    try { await io.kv(["SADD", SYNCED, email]); } catch { /* the backfill re-adds harmlessly */ }
    return { ok: true, full: !notes.length, status: made.status, detail: notes.length ? "added (" + notes.join(", ") + ")" : "added" };
  }
  if (made.status === 401 || made.status === 403 || made.status === 0 || made.status === 429 || made.status >= 500) {
    return { ok: false, full: false, status: made.status, detail: "contact " + why(made) };
  }

  // Resend refused to make it: most likely it already has this address. Give
  // it what is new (the plan; unsubscribed only ever true), then the segments.
  const t = await topUp(io, email, plan, off, segIds, true);
  if (!t.ok) {
    // Not there either (a definite 404): the refusal was something else,
    // perhaps a segment Travis deleted, so look the segments up again next
    // time. A slow or busy Resend says nothing about the segments.
    if (t.status === 404) await forgetList(io);
    const what = t.status === 404 ? "contact " + why(made) : "update " + why({ ok: false, status: t.status, json: null, text: "" });
    return { ok: false, full: false, status: t.status === 404 ? made.status : t.status, detail: what };
  }
  try { await io.kv(["SADD", SYNCED, email]); } catch { /* fine */ }
  return { ok: true, full: !t.notes.length, status: t.status, detail: t.notes.length ? "updated (" + t.notes.join(", ") + ")" : "updated" };
}

/** Unsubscribes Sona's link could not hand Resend: paid first on the daily run. */
export const UNSUB_OWED = "resend:unsubowed";

/**
 * Sona's own unsubscribe link: the contact is unsubscribed in Resend at once
 * (and the plain mailbox's contact, another spelling of the same Gmail
 * inbox), so a broadcast Travis sends from Resend skips them. A contact
 * Resend does not have yet (404) is fine: it will be made unsubscribed. The
 * address is owed first and paid on success, so a Resend that does not
 * answer, or a function cut off mid-call, leaves it for the daily run.
 */
export async function markUnsubscribed(raw: string, io: Io = realIo()): Promise<boolean> {
  const email = cleanEmail(raw);
  if (!email || !contactsConfigured()) return false;
  try { await io.kv(["SADD", UNSUB_OWED, email]); } catch { /* the daily check still finds them */ }
  const box = mailbox(email);
  let done = true;
  for (const e of box === email ? [email] : [email, box]) {
    const r = await resend(io, "/contacts/" + encodeURIComponent(e), "PATCH", { unsubscribed: true });
    if (!r.ok && r.status !== 404) done = false;
  }
  if (done) { try { await io.kv(["SREM", UNSUB_OWED, email]); } catch { /* paid again, harmlessly */ } }
  return done;
}

/**
 * SADD to `email:unsub`: the address and, unless `exact`, its plain mailbox.
 * The number added, or null when the store did not take it.
 */
async function addUnsub(io: Io, email: string, exact = false): Promise<number | null> {
  const box = mailbox(email);
  let r: unknown;
  try { r = await io.kv(box === email || exact ? ["SADD", "email:unsub", email] : ["SADD", "email:unsub", email, box]); } catch { r = undefined; }
  return typeof r === "number" ? r : null;
}

/** Where the daily check stopped, so the next one carries on from there. */
export const RECONCILE_AT = "resend:reconcile:after";

/**
 * THE DAILY CHECK, BOTH WAYS. Every Resend contact is read:
 *  - one who unsubscribed in Resend (a broadcast's link) joins `email:unsub`,
 *    with the plain mailbox, so Sona's own emails stop for them too;
 *  - one still subscribed whom Sona's list says has left (Kit's leavers,
 *    another spelling of the same Gmail inbox) is unsubscribed in Resend.
 * A run that runs out of time keeps its place (RECONCILE_AT), and the next
 * carries on from it; a whole pass starts again from the top.
 */
export async function reconcileUnsubscribes(io: Io = realIo(), deadline = Infinity, maxPages = 50):
  Promise<{ ok: boolean; added: number; stopped: number; detail: string }> {
  const out = { ok: false, added: 0, stopped: 0, detail: "" };
  if (!contactsConfigured()) { out.detail = "not configured"; return out; }
  let gone: Set<string>;
  try {
    const m = await io.kv(["SMEMBERS", "email:unsub"]);
    if (!Array.isArray(m)) { out.detail = "store did not answer"; return out; }
    gone = new Set(m.map((e) => String(e).toLowerCase()));
  } catch { out.detail = "store did not answer"; return out; }
  let after = "";
  try { const v = await io.kv(["GET", RECONCILE_AT]); after = typeof v === "string" ? v : ""; } catch { after = ""; }
  const resumed = !!after;
  const keep = async (at: string) => { try { await io.kv(at ? ["SET", RECONCILE_AT, at, "EX", 7 * 86400] : ["DEL", RECONCILE_AT]); } catch { /* starts at the top */ } };
  for (let page = 0; page < maxPages; page++) {
    // the account's two requests a second are shared with every email
    if (page) await io.sleep(550);
    if (Date.now() > deadline) { await keep(after); out.ok = true; out.detail = "stopped for time after " + page + " pages"; return out; }
    const c = await resend(io, "/contacts?limit=100" + (after ? "&after=" + encodeURIComponent(after) : ""), "GET");
    if (!c.ok || !c.json) {
      // a kept place Resend no longer knows (that contact was deleted): from the top next time
      if (resumed && page === 0 && c.status >= 400 && c.status < 500 && c.status !== 429) await keep("");
      out.detail = "contacts " + why(c); return out;
    }
    const data = Array.isArray(c.json.data) ? (c.json.data as Record<string, unknown>[]) : [];
    for (const row of data) {
      const email = cleanEmail(row.email);
      if (!email) continue;
      if (row.unsubscribed === true) {
        const n = await addUnsub(io, email);
        if (n === null) { out.detail = "store did not take an unsubscribe"; return out; }
        out.added += n;
        gone.add(email); gone.add(mailbox(email));
      } else if (gone.has(email) || gone.has(mailbox(email))) {
        // out of time mid-page: this page again next time
        if (Date.now() > deadline) { await keep(after); out.ok = true; out.detail = "stopped for time"; return out; }
        await io.sleep(550);
        const id = typeof row.id === "string" && row.id ? row.id : email;
        const r = await resend(io, "/contacts/" + encodeURIComponent(id), "PATCH", { unsubscribed: true });
        if (r.ok) out.stopped++;
      }
    }
    const next = data.length ? String(data[data.length - 1].id || "") : "";
    if (!c.json.has_more || !next) { await keep(""); out.ok = true; out.detail = "done"; return out; }
    after = next;
  }
  await keep(after);
  out.ok = true; out.detail = "stopped after " + maxPages + " pages; carries on tomorrow";
  return out;
}

/**
 * KIT'S LEAVERS, EVERY DAY WHILE KIT IS OPEN (16 Oct 2026). Kit is being
 * closed, and until it is, an old Kit email's unsubscribe link still works,
 * so while KIT_API_KEY is set each daily run copies every subscriber Kit
 * lists as having left into `email:unsub` (adding is safe to repeat). The
 * first complete copy (`resend:kitunsub`) opens the backfill. "Complete"
 * means all three statuses answered in full and the store took every
 * address: a spam complaint missed here would be emailed by the next
 * broadcast.
 */
// "inactive" is not one of them: in Kit it is someone who never confirmed,
// not someone who left, and `email:unsub` also stops the weekly report a
// parent asked Sona for.
export const KIT_GONE = ["cancelled", "bounced", "complained"] as const;

export async function importKit(io: Io = realIo(), deadline = Infinity): Promise<{ ok: boolean; added: number; detail: string }> {
  const key = (process.env.KIT_API_KEY || "").trim();
  if (!key) return { ok: false, added: 0, detail: "no KIT_API_KEY" };
  let added = 0;
  for (const status of KIT_GONE) {
    let after = "", complete = false;
    for (let page = 0; page < 50; page++) {
      if (page) await io.sleep(300);
      if (Date.now() > deadline) return { ok: false, added, detail: "Kit: stopped for time (" + status + "), tried again tomorrow" };
      const c = await call(io, KIT_API, "/subscribers?status=" + status + "&per_page=1000" + (after ? "&after=" + encodeURIComponent(after) : ""), "GET",
        undefined, { "X-Kit-Api-Key": key });
      if (!c.ok || !c.json || !Array.isArray(c.json.subscribers)) return { ok: false, added, detail: "Kit did not answer: " + status + " " + why(c) };
      for (const s of c.json.subscribers as Record<string, unknown>[]) {
        // a filtered answer is every subscriber in that status; one Kit says
        // is still active is left alone
        if (s.state === "active") continue;
        const email = cleanEmail(s.email_address);
        if (!email) continue;
        // A bounce is a mailbox that does not exist, not a person who left:
        // "john+sona@" bouncing says nothing of "john@", so only the exact
        // address. Someone who unsubscribed or complained left from that
        // inbox, whatever its spelling.
        const n = await addUnsub(io, email, status === "bounced");
        if (n === null) return { ok: false, added, detail: "the store did not take Kit's " + status };
        added += n;
      }
      const p = c.json.pagination as { has_next_page?: boolean; end_cursor?: string } | undefined;
      if (!p || !p.has_next_page || !p.end_cursor) { complete = true; break; }
      after = p.end_cursor;
    }
    if (!complete) return { ok: false, added, detail: "Kit: more than 50 pages of " + status };
  }
  let saved: unknown;
  try { saved = await io.kv(["SET", KIT_DONE, JSON.stringify({ at: new Date().toISOString(), added })]); } catch { saved = undefined; }
  if (saved !== "OK") return { ok: false, added, detail: "the store did not keep done; tried again tomorrow" };
  return { ok: true, added, detail: "done" };
}

/**
 * Everyone Sona already holds: every lead the ledger kept and every
 * clinician account (an account wins: whoever holds one is a clinician,
 * with their own name). One address's rows are read together, newest
 * first: the newest role and source that say anything, and a purchase from
 * any of them (paid over trial).
 */
export async function everyone(): Promise<Contact[]> {
  const by = new Map<string, Contact>();
  for (const l of await readLeads()) {
    const email = cleanEmail(l.email);
    if (!email) continue;
    const was = by.get(email);
    const plan = planWord(l.plan);
    if (!was) {
      by.set(email, { email, firstName: l.role === "slp" ? String(l.first_name || "") : "", role: l.role ? roleOf(l.role) : "",
        source: String(l.source || ""), plan });
      continue;
    }
    if (!was.role && l.role) { was.role = roleOf(l.role); if (l.role === "slp" && !was.firstName) was.firstName = String(l.first_name || ""); }
    if (!was.source && l.source) was.source = String(l.source);
    if (plan === "paid" || (plan && !was.plan)) was.plan = plan;
  }
  for (const c of await readClinicians()) {
    const email = cleanEmail(c.email);
    if (!email) continue;
    const was = by.get(email);
    by.set(email, { email, firstName: c.name, role: "slp", source: was?.source || "slp-signup", plan: was?.plan || "" });
  }
  return [...by.values()];
}

/**
 * THE DAILY RUN, PART ONE (/api/cron/nurture, before the emails go out):
 * the unsubscribes Sona's link still owes Resend, Kit's leavers while Kit is
 * open, then the check both ways, so a broadcast's unsubscribe stops today's
 * welcome emails and reports.
 */
export async function syncUnsubscribes(opts: { deadline?: number } = {}, io: Io = realIo()):
  Promise<{ ok: boolean; owed: number; kit: string; unsub: string; added: number; stopped: number }> {
  const out = { ok: false, owed: 0, kit: "", unsub: "", added: 0, stopped: 0 };
  if (!contactsConfigured()) { out.unsub = "not configured"; return out; }
  const deadline = opts.deadline ?? Date.now() + 45000;
  let owed: string[] = [];
  try { const m = await io.kv(["SMEMBERS", UNSUB_OWED]); if (Array.isArray(m)) owed = m.map(String); } catch { owed = []; }
  for (const e of owed.slice(0, 50)) {
    if (Date.now() > deadline) break;
    if (await markUnsubscribed(e, io)) out.owed++;
    await io.sleep(550);
  }
  if ((process.env.KIT_API_KEY || "").trim()) {
    const k = await importKit(io, deadline);
    out.kit = k.ok ? "copied " + k.added + " new" : k.detail;
  } else {
    let done = false;
    try { done = !!(await io.kv(["GET", KIT_DONE])); } catch { done = false; }
    out.kit = done ? "Kit closed (its leavers were copied)" : "no KIT_API_KEY: the older emails wait";
  }
  const u = await reconcileUnsubscribes(io, deadline);
  out.unsub = u.detail; out.added = u.added; out.stopped = u.stopped; out.ok = u.ok;
  return out;
}

/**
 * THE DAILY RUN, PART TWO (after the emails, with the time left). First the
 * posts that did not fully land (RETRY: new sign-ups and purchases, which
 * /api/lead would have added anyway), then a batch of the addresses Sona
 * already held and Resend does not have yet. That second part waits until
 * Kit's leavers are in: without KIT_API_KEY it waits for good, because
 * putting someone who left Kit back on a list is the one mistake here that
 * cannot be taken back. A clinician's account is never rewritten here (a
 * daily run racing their own edit could put an old copy back): the leads
 * page reads SYNCED.
 */
export async function backfill(opts: { deadline?: number; batch?: number; people?: () => Promise<Contact[]> } = {}, io: Io = realIo()):
  Promise<{ ok: boolean; retried: number; added: number; left: number; detail: string }> {
  const out = { ok: false, retried: 0, added: 0, left: 0, detail: "" };
  if (!contactsConfigured()) { out.detail = "not configured"; return out; }
  const deadline = opts.deadline ?? Date.now() + 30000;
  const batch = opts.batch ?? 150;
  let tried = 0;
  const stop = (r: ListResult) => r.status === 401 || r.status === 403 || r.status === 429;

  let owed: Record<string, string> = {};
  try { owed = hashOf(await io.kv(["HGETALL", RETRY])); } catch { owed = {}; }
  for (const [email, raw] of Object.entries(owed)) {
    if (tried >= batch || Date.now() > deadline) break;
    tried++;
    let c: Contact;
    try { c = { ...(JSON.parse(raw) as Contact), email }; } catch { c = { email }; }
    const r = await upsertContact(c, io);
    if (r.ok) out.retried++;
    else if (stop(r)) { out.detail = r.detail; out.ok = true; return out; }
    await io.sleep(600);
  }

  let kitDone = false;
  try { kitDone = !!(await io.kv(["GET", KIT_DONE])); } catch { kitDone = false; }
  if (!kitDone) { out.ok = true; out.detail = "the older emails wait for Kit's unsubscribes"; return out; }

  let have: Set<string>;
  try {
    const m = await io.kv(["SMEMBERS", SYNCED]);
    if (!Array.isArray(m)) { out.detail = "store did not answer"; return out; }
    have = new Set(m.map(String));
  } catch { out.detail = "store did not answer"; return out; }
  const todo = (await (opts.people || everyone)()).filter((p) => !have.has(cleanEmail(p.email)));
  for (const p of todo) {
    if (tried >= batch || Date.now() > deadline) break;
    tried++;
    const r = await upsertContact(p, io);
    if (r.ok) out.added++;
    else if (stop(r)) { out.detail = r.detail; break; }
    await io.sleep(600);
  }
  out.left = todo.length - out.added;
  out.ok = true;
  if (!out.detail) out.detail = "done";
  return out;
}
