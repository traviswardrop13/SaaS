import { kvCmd, rosterKey, hashToken, randomToken } from "@/lib/slpAuth";
import { readMeta, readGone, readAccount } from "@/lib/roster";
import { readAllHomework, isoDay } from "@/lib/homework";
import {
  CLINIC_SEATS, StoreUnavailable, clinicOfKey, clinicMembersKey, type Kv,
} from "@/lib/caseload";

/**
 * THE CLINIC PLAN'S OWNER VIEW (Travis, 17 Nov 2026) — one owner, up to
 * CLINIC_SEATS clinicians, each with their own dashboard, all covered by the
 * owner's $99-a-month plan.
 *
 * WHAT THE OWNER SEES IS TOTALS PER CLINICIAN, NEVER A CHILD (Travis chose
 * this, 17 Nov 2026). Families said "Yes, share progress" to THEIR speech
 * therapist, by name, on their own phone. Nothing in that consent mentions a
 * clinic owner, so the owner gets two numbers per clinician — families on
 * Sona, and how many practiced in the last 7 days — and no route here ever
 * returns a name, an age, a sound or a pass rate. Showing children to the
 * owner would need new consent wording that names the clinic; that is
 * Rachel's call and a privacy review's, not a code change.
 *
 * MEMBERSHIP IS ACCEPTED FROM THE MEMBER'S OWN INBOX. The owner types an
 * email; the seat is "invited" until that person taps the emailed link, which
 * signs them in and makes the seat "active". Only an active seat covers
 * anyone (lib/caseload clinicOwnerOf), so an owner who mistypes an address,
 * or adds someone who never agreed, covers nobody and sees nothing.
 *
 * Keys: `clinicmem:<owner>` (hash member → JSON) and `clinicof:<member>`
 * (owner), both defined in lib/caseload because planStatus reads them, and
 * `clinicinv:<sha256(token)>` for the emailed link (14 days, single use).
 */

export const INVITE_TTL_SEC = 60 * 60 * 24 * 14;
export const INVITES_PER_DAY = 30;

export type MemberState = "invited" | "active";
export type MemberRow = { email: string; state: MemberState; addedAt: string; acceptedAt?: string };
export type MemberTotals = { families: number; practicedWeek: number; linkReady: boolean };

const norm = (e: unknown): string => String(e || "").trim().toLowerCase();
export const isEmail = (e: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 120;
export function inviteKey(token: string): string { return "clinicinv:" + hashToken(token); }

/** Every seat on this owner's clinic (the owner is not a row). Throws if the store is down. */
export async function readMembers(owner: string, kv: Kv = kvCmd): Promise<MemberRow[]> {
  const flat = await kv(["HGETALL", clinicMembersKey(owner)]);
  if (flat === undefined) throw new StoreUnavailable("clinicmem");
  const out: MemberRow[] = [];
  if (Array.isArray(flat)) {
    for (let i = 0; i + 1 < flat.length; i += 2) {
      try {
        const m = JSON.parse(String(flat[i + 1])) as Partial<MemberRow>;
        out.push({
          email: norm(flat[i]),
          state: m.state === "active" ? "active" : "invited",
          addedAt: String(m.addedAt || ""),
          ...(m.acceptedAt ? { acceptedAt: String(m.acceptedAt) } : {}),
        });
      } catch { /* an unreadable row is not a seat */ }
    }
  }
  out.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  return out;
}

/** Seats in use: the owner plus every invited or active clinician. */
export function seatsUsed(members: MemberRow[]): number { return 1 + members.length; }

export type AddResult =
  | { ok: true; token: string; resent: boolean }
  | { ok: false; status: number; error: string };

/**
 * Add a clinician (or re-send their invite). The caller has already checked
 * that `owner` is signed in and holds a live Clinic plan.
 */
export async function addMember(owner: string, email: string, kv: Kv = kvCmd, now = Date.now()): Promise<AddResult> {
  const o = norm(owner), m = norm(email);
  if (!isEmail(m)) return { ok: false, status: 400, error: "Enter a valid email." };
  if (m === o) return { ok: false, status: 400, error: "That's you — you're already on your clinic's plan." };
  const members = await readMembers(o, kv);
  const existing = members.find((r) => r.email === m);
  if (existing && existing.state === "active") return { ok: false, status: 409, error: "They're already on your clinic's plan." };
  if (!existing && seatsUsed(members) >= CLINIC_SEATS) {
    return { ok: false, status: 409, error: `Your clinic plan has ${CLINIC_SEATS} seats, and they're all in use. Email hello@speaksona.com to add more.` };
  }
  // A clinician can be on one clinic at a time. Joining another means
  // leaving the first, and that is theirs to do, not a second owner's.
  const other = norm(await kv(["GET", clinicOfKey(m)]));
  if (other && other !== o) {
    const row = await kv(["HGET", clinicMembersKey(other), m]);
    if (row) return { ok: false, status: 409, error: "They're already on another clinic's plan. They can leave it from their own dashboard, then you can add them." };
  }
  // Daily cap on invite emails per owner: the link is sent to an address
  // the owner typed, and a mail form with no ceiling is a spam relay.
  const dayKey = "clinicinvn:" + o + ":" + isoDay(new Date(now));
  const n = await kv(["INCR", dayKey]);
  if (n === 1) await kv(["EXPIRE", dayKey, 60 * 60 * 26]);
  if (typeof n === "number" && n > INVITES_PER_DAY) {
    return { ok: false, status: 429, error: "That's a lot of invites for one day — try again tomorrow." };
  }
  const row: MemberRow = { email: m, state: "invited", addedAt: existing ? existing.addedAt : new Date(now).toISOString() };
  await kv(["HSET", clinicMembersKey(o), m, JSON.stringify(row)]);
  const token = randomToken();
  await kv(["SET", inviteKey(token), JSON.stringify({ owner: o, member: m }), "EX", INVITE_TTL_SEC]);
  return { ok: true, token, resent: !!existing };
}

/** The owner removes a seat. The pointer goes only if it points at THIS owner. */
export async function removeMember(owner: string, email: string, kv: Kv = kvCmd): Promise<boolean> {
  const o = norm(owner), m = norm(email);
  const n = await kv(["HDEL", clinicMembersKey(o), m]);
  if (norm(await kv(["GET", clinicOfKey(m)])) === o) await kv(["DEL", clinicOfKey(m)]);
  return Number(n) > 0;
}

/** A member leaves the clinic they are on. */
export async function leaveClinic(member: string, kv: Kv = kvCmd): Promise<string> {
  const m = norm(member);
  const owner = norm(await kv(["GET", clinicOfKey(m)]));
  if (owner) await kv(["HDEL", clinicMembersKey(owner), m]);
  await kv(["DEL", clinicOfKey(m)]);
  return owner;
}

/**
 * The emailed link, tapped. Single use (GETDEL). The seat must still exist —
 * an owner who removed them in the meantime has withdrawn the invite.
 * Returns the member's email on success, so the route can sign them in.
 */
export async function acceptInvite(token: string, kv: Kv = kvCmd, now = Date.now()): Promise<{ member: string; owner: string } | null> {
  if (!token || token.length > 200) return null;
  const raw = await kv(["GETDEL", inviteKey(token)]);
  if (!raw) return null;
  let inv: { owner?: string; member?: string };
  try { inv = JSON.parse(String(raw)); } catch { return null; }
  const o = norm(inv.owner), m = norm(inv.member);
  if (!o || !m) return null;
  const row = await kv(["HGET", clinicMembersKey(o), m]);
  if (!row) return null;
  // Leaving a previous clinic is implied by accepting this one: a clinician
  // is on one clinic at a time, and they just chose this one.
  const prev = norm(await kv(["GET", clinicOfKey(m)]));
  if (prev && prev !== o) await kv(["HDEL", clinicMembersKey(prev), m]);
  let added = new Date(now).toISOString();
  try { added = String((JSON.parse(String(row)) as MemberRow).addedAt || added); } catch { /* keep now */ }
  const next: MemberRow = { email: m, state: "active", addedAt: added, acceptedAt: new Date(now).toISOString() };
  await kv(["HSET", clinicMembersKey(o), m, JSON.stringify(next)]);
  await kv(["SET", clinicOfKey(m), o]);
  return { member: m, owner: o };
}

/**
 * The two numbers the owner sees for one clinician. Counted the way the
 * clinician's own Today page counts "practiced this week": a child with any
 * attempt, or any homework rep, in the last 7 days (today and the 6 before).
 * Removed and archived children are not counted. Nothing about any child
 * leaves this function but the two counts.
 */
export async function memberTotals(email: string, kv: Kv = kvCmd, now = new Date()): Promise<MemberTotals> {
  const acct = await readAccount(norm(email), kv);
  if (!acct.code) return { families: 0, practicedWeek: 0, linkReady: false };
  const code = acct.code;
  const [flat, meta, gone, homework] = await Promise.all([
    kv(["HGETALL", rosterKey(code)]),
    readMeta(code, kv),
    readGone(code, kv),
    readAllHomework(code).catch(() => ({} as Awaited<ReturnType<typeof readAllHomework>>)),
  ]);
  const rows = new Map<string, Record<string, unknown>>();
  if (Array.isArray(flat)) {
    for (let i = 0; i + 1 < flat.length; i += 2) {
      try { rows.set(String(flat[i]), JSON.parse(String(flat[i + 1]))); } catch { /* skip */ }
    }
  }
  const today = isoDay(now);
  const from = isoDay(new Date(now.getTime() - 6 * 86400000));
  const inWeek = (day: string) => day >= from && day <= today;
  let families = 0, practicedWeek = 0;
  for (const id of new Set([...rows.keys(), ...Object.keys(meta)])) {
    if (gone.has(id)) continue;
    if (meta[id] && meta[id].archived) continue;
    families++;
    let practiced = false;
    const out = (rows.get(id) || {}).outcomes as Record<string, { days?: Record<string, { a?: number }> }> | undefined;
    for (const s of Object.keys(out || {})) {
      const days = (out![s] && out![s].days) || {};
      if (Object.keys(days).some((d) => inWeek(d) && Number(days[d] && days[d].a) > 0)) { practiced = true; break; }
    }
    const rec = homework[id];
    if (!practiced && rec && rec.hw && rec.progress && rec.progress.id === rec.hw.id) {
      const hd = rec.progress.days || {};
      practiced = Object.keys(hd).some((d) => inWeek(d) && Number(hd[d]) > 0);
    }
    if (practiced) practicedWeek++;
  }
  return { families, practicedWeek, linkReady: true };
}
