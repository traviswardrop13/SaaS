import { kvCmd, rosterKey, hashToken, randomToken, resendSend } from "@/lib/slpAuth";
import { readMeta, readGone, readAccount } from "@/lib/roster";
import { hwKey, daysBetween, type HomeworkRecord } from "@/lib/homework";
import {
  CLINIC_NAME, CLINIC_SEATS, StoreUnavailable, teamKey, teamOfKey, parseTeamRow, teamOwnerOf,
  currentPlan, recordActive, type Kv, type TeamRow,
} from "@/lib/caseload";

/**
 * SONA CLINIC'S TEAM: THE OWNER ADDS CLINICIANS, AND SEES TWO NUMBERS EACH
 * (Travis, 17 Nov 2026). The practice owner buys Sona Clinic; every clinician
 * they add gets what Sona Pro gives, and the owner gets a view of them as
 * sub-accounts.
 *
 * WHAT THE OWNER SEES IS TOTALS PER CLINICIAN, NEVER A CHILD (Travis, 17 Nov
 * 2026). Per clinician: how many children they have on Sona, and how many of
 * those practiced in the last 7 days. Never a child's name, initials, age,
 * sound, pass rate, homework or any per-child row: a family said "Yes, share
 * progress" to THEIR speech therapist, and nothing in that consent names a
 * practice owner. Rows come back owner first, then by name — never sorted by
 * a count, never averaged, never ranked (CLAUDE.md: no leaderboard, no
 * comparison; a district privacy officer ends the app's use on that alone).
 *
 * JOINED FROM THE MEMBER'S OWN INBOX. The owner types an address and that
 * seat is "invited": it covers nobody and shows nothing. The emailed link
 * opens a page with one button, and only that button (a POST: acceptInvite)
 * makes it "active", so an owner who mistypes an address, or adds someone who
 * never agreed, sees no numbers of theirs, and a school's link scanner, which
 * only opens links, joins nobody (18 Nov 2026, review: the link used to join
 * on a plain GET). A clinician is on one team at a time; joining another
 * leaves the first, and the page says so first. The keys (lib/caseload
 * teamKey, teamOfKey) live beside the plan, because planStatus reads them;
 * the emailed link is `slpteaminv:<sha256>`, fourteen days, used once, and
 * only the newest one for a seat works (the row's `inv`).
 *
 * JOINING IS NOT SIGNING IN (18 Nov 2026, review). The link lives fourteen
 * days and may be forwarded ("is this legit?") or sit in a shared practice
 * inbox; when it also signed the clinician in, whoever opened it had their
 * whole dashboard, children included, for a month. Now it only joins, and the
 * clinician signs in the ordinary way: a fifteen-minute link or code, on the
 * sign-in page, which also carries the email list's consent line.
 *
 * NEVER WRITES A CLINICIAN'S CASELOAD. The counts read the same keys the
 * clinician's own GET /api/slp reads, and nothing else: that route heals a
 * legacy roster key on read (a write); this one reads both keys and merges
 * them in memory instead, so an owner looking can never change another
 * clinician's data.
 */

export const TEAM_INVITE_TTL = 60 * 60 * 24 * 14;       // the emailed link: fourteen days, once
export const TEAM_INVITES_PER_DAY = 30;                 // per owner, like the parent invites (bumpDaily)

const norm = (e: unknown): string => String(e || "").trim().toLowerCase();
export const isEmail = (e: string): boolean => e.length <= 120 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
export function teamInviteKey(token: string): string { return "slpteaminv:" + hashToken(token); }
const inviteKeyOfHash = (h: string) => "slpteaminv:" + h;

export type TeamMember = TeamRow & { email: string };

/** Every row on this owner's team (the owner is not a row). Throws if the store is down. */
export async function readTeam(owner: string, kv: Kv = kvCmd): Promise<TeamMember[]> {
  const flat = await kv(["HGETALL", teamKey(owner)]);
  if (flat === undefined) throw new StoreUnavailable("slpteam");
  const out: TeamMember[] = [];
  if (Array.isArray(flat)) {
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const row = parseTeamRow(flat[i + 1]);
      if (row) out.push({ email: norm(flat[i]), ...row });
    }
  }
  return out;
}

/** Seats in use: the owner, and every invited or joined clinician. */
export function seatsUsed(team: TeamMember[]): number { return 1 + team.length; }

/** Is this row JOINED: active, and the member's own key names this owner? Throws if the store is down. */
async function linked(owner: string, m: TeamMember, kv: Kv): Promise<boolean> {
  if (m.state !== "active") return false;
  const back = await kv(["GET", teamOfKey(m.email)]);
  if (back === undefined) throw new StoreUnavailable("slpteam-of");
  return typeof back === "string" && norm(back) === norm(owner);
}

export type AddResult =
  | { ok: true; token: string; resent: boolean }
  | { ok: false; status: number; error: string };

/**
 * Add a clinician, or send their invite again. The caller has checked that
 * `owner` is signed in and their Clinic plan is live; this decides whether
 * the seat may exist at all, then spends one of the day's invite emails
 * (`meter`, the route's bumpDaily) only for an invite that will really go,
 * before anything is written.
 */
export async function addMember(
  owner: string, email: string, kv: Kv = kvCmd, now = Date.now(),
  meter: () => Promise<number | null> = async () => 0,
): Promise<AddResult> {
  const o = norm(owner), m = norm(email);
  if (!isEmail(m)) return { ok: false, status: 400, error: "Enter a valid email." };
  if (m === o) return { ok: false, status: 400, error: "That's you. You're on your clinic's plan already." };
  const team = await readTeam(o, kv);
  const existing = team.find((r) => r.email === m);
  if (existing && await linked(o, existing, kv)) return { ok: false, status: 409, error: "They're on your clinic's plan already." };
  if (!existing && seatsUsed(team) >= CLINIC_SEATS) {
    return { ok: false, status: 409, error: "All " + CLINIC_SEATS + " seats on your clinic's plan are in use. Email hello@speaksona.com to add more." };
  }
  // NOTHING HERE SAYS WHETHER THEY ARE ON ANOTHER CLINIC, or own one (18 Nov
  // 2026, review). This refused "They're on another clinic's Sona plan", which
  // told any Clinic owner, trial included, which practice any address works
  // for. The invite goes like any other; the page behind the link tells the
  // clinician, and only them, that joining leaves their current clinic, and
  // refuses one who owns a Clinic plan (peekInvite). One team at a time still
  // holds, and an invite still never pulls anyone out: their own press does.
  // Metered per owner per day, as the parent invites are: the link goes to an
  // address the owner typed, and a mail form with no ceiling is a spam relay.
  // A store that does not answer refuses (an unmetered door is the risk).
  const n = await meter();
  if (n === null) throw new StoreUnavailable("slpteammail");
  if (n > TEAM_INVITES_PER_DAY) {
    return { ok: false, status: 429, error: "That's " + TEAM_INVITES_PER_DAY + " invites today, the daily limit. Try again tomorrow." };
  }
  // A Resend retires the link it replaces (18 Nov 2026, review): each one
  // stayed good for its fourteen days, so a seat could have several live
  // links in several inboxes. The row names the newest (`inv`), and the
  // older key goes.
  const token = randomToken();
  const row: TeamRow = {
    state: "invited", addedAt: existing && existing.addedAt ? existing.addedAt : new Date(now).toISOString(), inv: hashToken(token),
  };
  if ((await kv(["SET", teamInviteKey(token), JSON.stringify({ owner: o, member: m }), "EX", TEAM_INVITE_TTL])) !== "OK") {
    throw new StoreUnavailable("slpteaminv");
  }
  if (typeof (await kv(["HSET", teamKey(o), m, JSON.stringify(row)]) ) !== "number") throw new StoreUnavailable("slpteam");
  if (existing && existing.inv) await kv(["DEL", inviteKeyOfHash(existing.inv)]);
  return { ok: true, token, resent: !!existing };
}

/**
 * The owner takes a seat back. ALWAYS works, plan or no plan: it touches
 * only the owner's own team, and the member's key only when it names this
 * owner. Their coverage from this team ends with it.
 */
export async function removeMember(owner: string, email: string, kv: Kv = kvCmd): Promise<boolean> {
  const o = norm(owner), m = norm(email);
  if (!m || m === o) return false;
  // Its emailed link goes with the seat (18 Nov 2026).
  const had = parseTeamRow(await kv(["HGET", teamKey(o), m]));
  if (had && had.inv) await kv(["DEL", inviteKeyOfHash(had.inv)]);
  const n = await kv(["HDEL", teamKey(o), m]);
  if (n === undefined) throw new StoreUnavailable("slpteam");
  const back = await kv(["GET", teamOfKey(m)]);
  if (typeof back === "string" && norm(back) === o) await kv(["DEL", teamOfKey(m)]);
  return Number(n) > 0;
}

/** A member leaves the team they joined. Returns the owner they left, or "". */
export async function leaveTeam(member: string, kv: Kv = kvCmd): Promise<string> {
  const m = norm(member);
  const back = await kv(["GET", teamOfKey(m)]);
  if (back === undefined) throw new StoreUnavailable("slpteam-of");
  const o = typeof back === "string" ? norm(back) : "";
  if (o) await kv(["HDEL", teamKey(o), m]);
  await kv(["DEL", teamOfKey(m)]);
  return o;
}

export type InviteCheck =
  | { ok: true; owner: string; member: string; moving: boolean }
  | { ok: false; why: "gone" | "planOff" | "ownClinic" };

/** The invite and its seat, read together; a seat whose `inv` names another link is not this link's. */
async function readInvite(token: string, kv: Kv): Promise<{ o: string; m: string; seat: TeamRow } | null> {
  if (!token || token.length > 200) return null;
  const raw = await kv(["GET", teamInviteKey(token)]);
  if (raw === undefined) throw new StoreUnavailable("slpteaminv");
  if (typeof raw !== "string" || !raw) return null;
  let inv: { owner?: unknown; member?: unknown };
  try { inv = JSON.parse(raw); } catch { return null; }
  const o = norm(inv.owner), m = norm(inv.member);
  if (!isEmail(o) || !isEmail(m) || o === m) return null;
  const seatRaw = await kv(["HGET", teamKey(o), m]);
  if (seatRaw === undefined) throw new StoreUnavailable("slpteam");
  const seat = parseTeamRow(seatRaw);
  if (!seat || seat.state !== "invited" || seat.inv !== hashToken(token)) return null;
  return { o, m, seat };
}

/**
 * What the emailed link's page shows (18 Nov 2026, review), and what its
 * Join button checks again. READS ONLY: a link scanner's GET changes nothing,
 * and spends nothing. A link that is used, expired, withdrawn (the owner
 * removed the seat) or replaced (a newer Resend) is "gone"; a store that does
 * not answer throws, and the link stays good. Refused, with the link kept for
 * its fourteen days:
 *  - "planOff": the owner's Clinic plan is not live (a trial cancelled, a
 *    card that failed) — joining it would cover nobody, and the clinician
 *    would be told they had joined a plan their dashboard never shows;
 *  - "ownClinic": the clinician owns a live Clinic plan, whose owner view
 *    would hide the membership, and its Leave button with it.
 * `moving`: they are on another clinic's live plan now, and joining leaves it.
 */
export async function peekInvite(token: string, kv: Kv = kvCmd, now = Date.now()): Promise<InviteCheck> {
  const got = await readInvite(token, kv);
  if (!got) return { ok: false, why: "gone" };
  const { o, m } = got;
  if (!recordActive(await currentPlan(o, { kv, now, kind: "clinic" }), now)) return { ok: false, why: "planOff" };
  if (recordActive(await currentPlan(m, { kv, now, kind: "clinic" }), now)) return { ok: false, why: "ownClinic" };
  const other = await teamOwnerOf(m, kv);
  const moving = !!other && other !== o && recordActive(await currentPlan(other, { kv, now, kind: "clinic" }), now);
  return { ok: true, owner: o, member: m, moving };
}

/**
 * The Join button, pressed: the same checks, then the link is used once
 * (GETDEL) and the seat written "active". Every check reads before anything
 * is spent, so a store that stops answering part-way leaves the link good
 * (18 Nov 2026, review: it used to be spent first, and the clinician told
 * "expired"). Joining here leaves any team they were on before.
 */
export async function acceptInvite(token: string, kv: Kv = kvCmd, now = Date.now()): Promise<InviteCheck> {
  const st = await peekInvite(token, kv, now);
  if (!st.ok) return st;
  const used = await kv(["GETDEL", teamInviteKey(token)]);
  if (used === undefined) throw new StoreUnavailable("slpteaminv");
  if (typeof used !== "string" || !used) return { ok: false, why: "gone" };
  // The seat again, after the link is ours: removed or re-sent in between,
  // this link no longer joins it.
  const again = await readSeat(st.owner, st.member, kv);
  if (!again || again.state !== "invited" || again.inv !== hashToken(token)) return { ok: false, why: "gone" };
  const m = st.member, o = st.owner;
  const prev = await kv(["GET", teamOfKey(m)]);
  if (prev === undefined) throw new StoreUnavailable("slpteam-of");
  if (typeof prev === "string" && norm(prev) && norm(prev) !== o) await kv(["HDEL", teamKey(norm(prev)), m]);
  const row: TeamRow = { state: "active", addedAt: again.addedAt || new Date(now).toISOString(), acceptedAt: new Date(now).toISOString() };
  if (typeof (await kv(["HSET", teamKey(o), m, JSON.stringify(row)])) !== "number") throw new StoreUnavailable("slpteam");
  if ((await kv(["SET", teamOfKey(m), o])) !== "OK") throw new StoreUnavailable("slpteam-of");
  return st;
}

async function readSeat(owner: string, member: string, kv: Kv): Promise<TeamRow | null> {
  const raw = await kv(["HGET", teamKey(owner), member]);
  if (raw === undefined) throw new StoreUnavailable("slpteam");
  return parseTeamRow(raw);
}

// ── the owner's two numbers ────────────────────────────────────────────────

/** YYYY-MM-DD, n days from `iso`, by the calendar (no clock, no time zone). */
export function addDaysIso(iso: string, n: number): string {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * The day the 7-day window ends on: the VIEWER's own date when the page sends
 * it, so the owner and each clinician's Today page agree on "this week" (the
 * server runs on UTC, a US evening is already tomorrow there). Believed only
 * within a day of the server's date; anything else is the server's.
 */
export function viewerToday(given: unknown, now = Date.now()): string {
  const server = new Date(now).toISOString().slice(0, 10);
  const g = String(given || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g) || addDaysIso(g, 0) !== g) return server;
  return Math.abs(daysBetween(server, g)) <= 1 ? g : server;
}

export type Totals = { children: number; practicedWeek: number; linkReady: boolean };

type Outcomes = Record<string, { days?: Record<string, { a?: number }> } | undefined>;

function hashRows(flat: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (Array.isArray(flat)) for (let i = 0; i + 1 < flat.length; i += 2) out.set(String(flat[i]), String(flat[i + 1]));
  return out;
}

/**
 * One clinician's two numbers, counted the way their own Today page counts
 * them ("N of M children practiced in the last 7 days", public/slp.html
 * windowStats): the children their roster shows (synced rows and claimed
 * ones not synced yet, minus removed, minus archived), and of those, each
 * with an attempt on any sound, or a homework rep against the current
 * assignment, on a day from today-6 to today. Nothing about any child
 * leaves this function but the two counts. Reads only.
 */
export async function memberTotals(email: string, today: string, kv: Kv = kvCmd): Promise<Totals> {
  const acct = await readAccount(norm(email), kv);
  const code = String(acct.code || "").toLowerCase();
  if (!code) return { children: 0, practicedWeek: 0, linkReady: false };
  const canon = rosterKey(code), legacy = "slp:" + code.toUpperCase();
  const [flat, oldFlat, meta, gone, hwFlat] = await Promise.all([
    kv(["HGETALL", canon]),
    legacy !== canon ? kv(["HGETALL", legacy]) : Promise.resolve([]),
    readMeta(code, kv),
    readGone(code, kv),
    kv(["HGETALL", hwKey(code)]),
  ]);
  if (flat === undefined || hwFlat === undefined) throw new StoreUnavailable("slp");
  // The canonical row wins, as healLegacyRoster's HSETNX would have it.
  const rows = hashRows(oldFlat);
  for (const [k, v] of hashRows(flat)) rows.set(k, v);
  const hw = hashRows(hwFlat);
  const from = addDaysIso(today, -6);
  const inWeek = (day: string) => day >= from && day <= today;
  let children = 0, practicedWeek = 0;
  for (const id of new Set([...rows.keys(), ...Object.keys(meta)])) {
    if (gone.has(id)) continue;
    if (meta[id] && meta[id].archived) continue;
    children++;
    let practiced = false;
    let row: { outcomes?: Outcomes } = {};
    try { row = rows.has(id) ? JSON.parse(rows.get(id)!) : {}; } catch { row = {}; }
    const out = (row && typeof row.outcomes === "object" && row.outcomes) || {};
    for (const s of Object.keys(out)) {
      const days = (out[s] && out[s]!.days) || {};
      if (Object.keys(days).some((d) => inWeek(d) && Number(days[d] && days[d].a) > 0)) { practiced = true; break; }
    }
    if (!practiced && hw.has(id)) {
      // Homework days count only against the assignment they were done for,
      // as the dashboard shows them (app/api/slp hwFor).
      let rec: Partial<HomeworkRecord> = {};
      try { rec = JSON.parse(hw.get(id)!); } catch { rec = {}; }
      if (rec && rec.hw && rec.progress && rec.progress.id === rec.hw.id) {
        const hd = rec.progress.days || {};
        practiced = Object.keys(hd).some((d) => inWeek(d) && Number(hd[d]) > 0);
      }
    }
    if (practiced) practicedWeek++;
  }
  return { children, practicedWeek, linkReady: true };
}

export type OwnerRow = {
  email: string; name: string; state: "invited" | "active";
  children: number | null; practicedWeek: number | null; linkReady: boolean; you?: true;
};

/**
 * The owner's view: the owner's own row first, then every other seat by name
 * (then address). Numbers only for a JOINED clinician while the plan is live;
 * an invited seat, or one whose plan has lapsed, shows none, and no name
 * either until they join (the owner typed only an address).
 */
export async function ownerView(owner: string, planActive: boolean, today: string, kv: Kv = kvCmd): Promise<{ used: number; rows: OwnerRow[] }> {
  const o = norm(owner);
  const team = await readTeam(o, kv);
  const mine = await memberTotals(o, today, kv);
  const me = await readAccount(o, kv);
  // Each seat read on its own, side by side: up to CLINIC_SEATS of them.
  const rows: OwnerRow[] = await Promise.all(team.filter((m) => m.email !== o).map(async (m): Promise<OwnerRow> => {
    if (!(await linked(o, m, kv))) {
      return { email: m.email, name: "", state: "invited", children: null, practicedWeek: null, linkReady: false };
    }
    const a = await readAccount(m.email, kv);
    const t = planActive ? await memberTotals(m.email, today, kv) : null;
    return {
      email: m.email, name: String(a.name || "").slice(0, 80), state: "active",
      children: t ? t.children : null, practicedWeek: t ? t.practicedWeek : null, linkReady: !!a.code,
    };
  }));
  // BY NAME, NEVER BY A NUMBER: a list of clinicians sorted by how many of
  // their children practiced is a league table.
  const key = (r: OwnerRow) => (r.name || r.email).toLowerCase();
  rows.sort((a, b) => key(a).localeCompare(key(b)) || a.email.localeCompare(b.email));
  return {
    used: seatsUsed(team),
    rows: [{ email: o, name: String(me.name || "").slice(0, 80), state: "active", children: mine.children, practicedWeek: mine.practicedWeek, linkReady: mine.linkReady, you: true }, ...rows],
  };
}

// ── the invite email ───────────────────────────────────────────────────────

/** A clinician's name for a subject line: one line, no control characters, capped. */
export function oneLine(s: string, max: number): string {
  return String(s || "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
export function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/**
 * THE INVITE (17 Nov 2026). Transactional, like the sign-in email: one send
 * to the address the owner typed, through the same sender (lib/mail). It
 * names who is asking and the practice, and says exactly what that owner
 * will see — two counts, never a child — BEFORE the clinician joins, because
 * the Join button behind the link is the yes (its page says it again). No
 * child data at all. With no sender set, the link comes back off production
 * so a preview can be tested; never on production.
 */
export const OWNER_SEES = "How many children you have on Sona, and how many of them practiced in the last 7 days. Never a child's name, initials, sounds or pass rate.";
/** Who is asking, for the email and the Join page: "Olivia Owner at Bright Steps Therapy". */
export function inviteAsker(ownerName: string, practice: string): { asker: string; askerMid: string } {
  const who = oneLine(ownerName, 80);
  const where = oneLine(practice, 80);
  return {
    asker: who ? who + (where ? " at " + where : "") : where ? "Your colleagues at " + where : "A colleague",
    askerMid: who || "your clinic's owner",
  };
}
export async function sendTeamInviteEmail(
  to: string, link: string, ownerName: string, practice: string,
): Promise<{ sent: boolean; devLink: string | null }> {
  const { asker, askerMid } = inviteAsker(ownerName, practice);
  const seen = OWNER_SEES;
  const r = await resendSend({
    to,
    subject: oneLine(asker + " added you to " + CLINIC_NAME, 160),
    html:
      `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:15px;color:#16384f;line-height:1.6;max-width:520px;">` +
      `<p>Hi,</p>` +
      `<p>${esc(asker)} added you to their ${esc(CLINIC_NAME)} plan. It gives you your own Sona dashboard, every game on your own phone or tablet, and every game for every family who joins through your link, paid for by your clinic.</p>` +
      `<p><a href="${esc(link)}" style="display:inline-block;background:#58cc02;color:#fff;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:12px;font-size:16px;">Join your clinic</a></p>` +
      `<p style="margin-top:22px;"><b>What ${esc(askerMid)} will see</b></p>` +
      `<p style="color:#46627a;">${esc(seen)}</p>` +
      `<p style="color:#6b86a3;font-size:13px;margin-top:22px;">You can leave the clinic anytime from your dashboard. This link works once and expires in 14 days; after you join, sign in with this email address. If you didn't expect it, you can ignore it.</p>` +
      `</div>`,
    text:
      "Hi,\n\n" +
      asker + " added you to their " + CLINIC_NAME + " plan. It gives you your own Sona dashboard, every game on your own phone or tablet, and every game for every family who joins through your link, paid for by your clinic.\n\n" +
      "Join your clinic:\n" + link + "\n\n" +
      "What " + askerMid + " will see\n" + seen + "\n\n" +
      "You can leave the clinic anytime from your dashboard. This link works once and expires in 14 days; after you join, sign in with this email address. If you didn't expect it, you can ignore it.\n",
  }, "team invite", false);
  if (!r.configured) return { sent: false, devLink: process.env.VERCEL_ENV === "production" ? null : link };
  return { sent: r.sent, devLink: null };
}
