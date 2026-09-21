import crypto from "node:crypto";
import { kvCmd, rosterKey } from "@/lib/slpAuth";
import { hwKey, SOUND_NORM, POSITIONS, HW_MAX_SOUNDS, NOTE_MAX } from "@/lib/homework";

/**
 * The clinician's side of the roster: what an SLP knows about a child that the
 * child's device must never overwrite, children set up AHEAD of the family
 * joining, and children who have been taken off — by the clinician, or by
 * the family themselves.
 *
 * Why more keys beside slp:<code>. The roster row is written wholesale by the
 * child's device on every sync (/api/pilot HSETs the whole record), so
 * anything a clinician typed onto it would last exactly until the next
 * practice. That is right for practice data — the device IS the source of
 * truth for reps and outcomes — and useless for what only the clinician
 * knows: when this child was invited and joined, and whether they still want
 * to see them. So:
 *
 *   slpmeta:<code>        hash childId → clinician-owned per-child data:
 *                         joinedAt, invitedAt, archived. NO name, NO age —
 *                         the roster row already carries what the parent
 *                         typed, and a second copy is a second thing to erase.
 *   inv:<code>:<token>    ONE invite, as its own key with its own 30-day
 *                         expiry (SET … EX), so an invite nobody tapped
 *                         genuinely ceases to exist rather than being hidden
 *                         by a filter. Holds a LABEL (initials or a nickname,
 *                         never the child's name) and the first target.
 *   inv:<code>            the index: hash token → { createdAt, expiresAt,
 *                         claimedBy?, claimedAt? }. No child data at all. A
 *                         listing walks this, fetches the data keys, and drops
 *                         index rows whose data key has expired — that IS the
 *                         auto-delete.
 *   invclaim:<code>:<tok> the single-use lock: SET … NX by the device that
 *                         claims the invite; a second device loses the race
 *                         and is told so.
 *   slpgone:<code>        hash childId → when. A child who was taken off the
 *                         roster. The device still holds a valid ticket and
 *                         would re-create the row on its next sync; every
 *                         write path checks here first. Lives 400 days, as
 *                         long as any ticket can.
 *
 * All keyed on the lowercased code, the same rule as rosterKey() and for the
 * same reason — a case-mismatched key once emptied the whole caseload
 * silently. The hashes carry the roster's ~5-month expiry, refreshed on every
 * write, so a caseload that goes quiet ages out of every key together.
 *
 * NOT stored anywhere here, deliberately: no diagnosis, no goal-bank, no
 * free-text clinical notes. The only free text is the invite's label and the
 * note to the parent — the same line lib/homework holds.
 *
 * Every function takes the KV command as its last argument so a test can hand
 * in a fake store and watch the commands. Routes pass nothing and get the
 * real one.
 */

export type Kv = (cmd: (string | number)[]) => Promise<unknown>;

export const HASH_TTL = 60 * 60 * 24 * 150;   // ~5 months, same as the roster and hw hashes
export const TOMB_TTL = 60 * 60 * 24 * 400;   // as long as a ticket can live
export const INVITE_TTL = 2592000;            // 30 days, in seconds — the invite's own EX
export const CLAIM_TTL = 60 * 60 * 24 * 150;  // the single-use lock outlives the index row it guards
export const INVITE_CAP = 200;                // pending invites per code; a caseload is a fraction of this
export const LABEL_MAX = 40;
export const AGE_MAX_CHARS = 2;

// The same unambiguous alphabet the family key uses (KEY_ALPHABET in
// lib/slpAuth): no 0/O, 1/I/L, so a token survives being read off a printed
// handout or over the phone. Kept in step by tests/slpapi.mjs.
export const TOKEN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const TOKEN_LEN = 12;

const lc = (code: string) => String(code || "").toLowerCase();
export function metaKey(code: string): string { return "slpmeta:" + lc(code); }
export function invIndexKey(code: string): string { return "inv:" + lc(code); }
export function invDataKey(code: string, token: string): string { return "inv:" + lc(code) + ":" + token; }
export function invClaimKey(code: string, token: string): string { return "invclaim:" + lc(code) + ":" + token; }
export function goneKey(code: string): string { return "slpgone:" + lc(code); }

/** Twelve random characters — 31^12 ≈ 8×10^17, hopeless to guess at any rate limit. */
export function makeInviteToken(): string {
  const bytes = crypto.randomBytes(TOKEN_LEN);
  let t = "";
  for (let i = 0; i < TOKEN_LEN; i++) t += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  return t;
}

/** The same shape the pilot and homework routes accept for a child id. */
export function cleanChildId(v: unknown): string {
  return String(v || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
}
/** Uppercase, alphabet only — whatever case a link was retyped in. */
export function cleanToken(v: unknown): string {
  const t = String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return t.length === TOKEN_LEN ? t : "";
}

/**
 * Refresh a hash's expiry after a write. One helper, called after EVERY
 * mutation, so no key in this file can outlive the roster it describes or —
 * worse — be left with no expiry at all by a code path that forgot.
 */
async function touch(key: string, kv: Kv, ttl = HASH_TTL): Promise<void> {
  await kv(["EXPIRE", key, ttl]);
}

// ── per-child meta ──────────────────────────────────────────────────────────

export type ChildMeta = {
  joinedAt?: string;    // when the family's device claimed the invite
  invitedAt?: string;   // when the clinician created that invite
  archived?: boolean;   // hidden from the default roster view; the device keeps syncing
  updatedAt: string;
};

export async function readMeta(code: string, kv: Kv = kvCmd): Promise<Record<string, ChildMeta>> {
  const flat = await kv(["HGETALL", metaKey(code)]);
  const out: Record<string, ChildMeta> = {};
  if (Array.isArray(flat)) {
    for (let i = 0; i < flat.length; i += 2) {
      try {
        out[String(flat[i])] = JSON.parse(String(flat[i + 1])) as ChildMeta;
      } catch {
        // skip malformed
      }
    }
  }
  return out;
}

/**
 * MERGE, never replace: archiving must not lose when the child joined; a
 * claim must not lose an archive flag. Only the fields the type names are
 * kept, so nothing a caller passes by accident becomes a stored field —
 * and in particular a name or an age can never land here.
 */
export async function writeMeta(code: string, childId: string, patch: Partial<ChildMeta>, kv: Kv = kvCmd): Promise<ChildMeta> {
  const key = metaKey(code);
  let cur: Partial<ChildMeta> = {};
  try {
    const raw = await kv(["HGET", key, childId]);
    if (raw) cur = JSON.parse(String(raw)) as ChildMeta;
  } catch {
    cur = {};
  }
  const next: ChildMeta = { updatedAt: new Date().toISOString() };
  const joinedAt = patch.joinedAt !== undefined ? patch.joinedAt : cur.joinedAt;
  const invitedAt = patch.invitedAt !== undefined ? patch.invitedAt : cur.invitedAt;
  if (joinedAt) next.joinedAt = String(joinedAt).slice(0, 40);
  if (invitedAt) next.invitedAt = String(invitedAt).slice(0, 40);
  const archived = patch.archived !== undefined ? patch.archived : cur.archived;
  if (archived) next.archived = true;
  await kv(["HSET", key, childId, JSON.stringify(next)]);
  await touch(key, kv);
  return next;
}

// ── invites ─────────────────────────────────────────────────────────────────

export type InviteFields = {
  label: string;        // initials or a nickname — NOT the child's name; the family types that when they join
  age: string;
  sounds: string[];     // may be empty: an invite with no first target is still an invite
  pos: string;
  repsPerDay: number;
  note: string;         // to the parent, capped like homework's note
};
/** The data key: what the clinician typed, plus when it was made and when it dies. */
export type Invite = InviteFields & { token: string; createdAt: string; expiresAt: string };
/** The index row: timestamps and who claimed it. Never any child data. */
export type InviteIndexEntry = { createdAt: string; expiresAt: string; claimedBy?: string; claimedAt?: string };

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
}
function cleanLabel(v: unknown): string {
  return String(v || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, LABEL_MAX);
}
function cleanAge(v: unknown): string {
  return String(v || "").replace(/\D/g, "").slice(0, AGE_MAX_CHARS);
}

/**
 * What a clinician may put in an invite, clamped the way lib/homework clamps
 * an assignment — with one exception. The label is REQUIRED, not defaulted:
 * it is the only thing the list of pending invites can show, and a row that
 * says nothing on a caseload of twelve is worse than an error the clinician
 * can see. It is captioned in the UI as initials or a nickname; the family
 * enters the child's name themselves when they join.
 */
export function normalizeInvite(input: unknown): InviteFields | { error: string } {
  const b = (input || {}) as Record<string, unknown>;
  const label = cleanLabel(b.label);
  if (!label) return { error: "a label is needed — initials or a nickname" };
  const sounds = (Array.isArray(b.sounds) ? b.sounds : [])
    .map((s) => String(s || "").toUpperCase().replace(/[^A-Z]/g, ""))
    .filter((s, i, arr) => s && !!SOUND_NORM[s] && arr.indexOf(s) === i)
    .slice(0, HW_MAX_SOUNDS);
  return {
    label,
    age: cleanAge(b.age),
    sounds,
    pos: POSITIONS.indexOf(String(b.pos || "")) >= 0 ? String(b.pos) : "mix",
    repsPerDay: clampInt(b.repsPerDay, 5, 200, 20),
    note: String(b.note || "").replace(/[\u0000-\u001f]/g, " ").slice(0, NOTE_MAX).trim(),
  };
}

/**
 * The store's EX is what deletes an invite; this is the belt to that brace,
 * for a data key that somehow outlived its expiresAt. Pure, so it is tested.
 */
export function isExpiredInvite(inv: { expiresAt?: string }, now = Date.now()): boolean {
  const t = Date.parse(String(inv.expiresAt || ""));
  return !Number.isFinite(t) || t <= now;
}

function parseJson<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return null;
  }
}

export async function readInviteIndex(code: string, kv: Kv = kvCmd): Promise<Record<string, InviteIndexEntry>> {
  const flat = await kv(["HGETALL", invIndexKey(code)]);
  const out: Record<string, InviteIndexEntry> = {};
  if (Array.isArray(flat)) {
    for (let i = 0; i < flat.length; i += 2) {
      const e = parseJson<InviteIndexEntry>(flat[i + 1]);
      if (e) out[String(flat[i])] = e;
    }
  }
  return out;
}

/**
 * Every PENDING invite for a clinic, newest first. Walks the index, fetches
 * the data keys in one MGET, and drops any index row whose data key is gone
 * — the store expired it, or the clinician deleted it — which is how a
 * 30-day-old invite disappears from the list without a sweeper. Claimed rows
 * are skipped, not dropped: they record which token a child joined through.
 */
export async function readInvites(code: string, kv: Kv = kvCmd): Promise<Invite[]> {
  const index = await readInviteIndex(code, kv);
  const pending = Object.keys(index).filter((t) => !index[t].claimedBy);
  if (!pending.length) return [];
  const vals = await kv(["MGET", ...pending.map((t) => invDataKey(code, t))]);
  const out: Invite[] = [];
  let dropped = 0;
  for (let i = 0; i < pending.length; i++) {
    const inv = parseJson<Invite>(Array.isArray(vals) ? vals[i] : null);
    if (inv && !isExpiredInvite(inv)) {
      out.push(inv);
    } else {
      await kv(["HDEL", invIndexKey(code), pending[i]]);
      dropped++;
    }
  }
  if (dropped) await touch(invIndexKey(code), kv);
  out.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return out;
}

/** One invite's data by token; expired reads as gone (and is removed). */
export async function readInviteData(code: string, token: string, kv: Kv = kvCmd): Promise<Invite | null> {
  const inv = parseJson<Invite>(await kv(["GET", invDataKey(code, token)]));
  if (!inv) return null;
  if (isExpiredInvite(inv)) {
    await kv(["DEL", invDataKey(code, token)]);
    return null;
  }
  return inv;
}

/**
 * Mint an invite. Null means the cap is hit: a clinician with 200 invites
 * nobody has tapped is not inviting, they are looping, and the index would
 * otherwise grow without bound.
 */
export async function createInvite(code: string, fields: InviteFields, kv: Kv = kvCmd): Promise<Invite | null> {
  const pending = await readInvites(code, kv);
  if (pending.length >= INVITE_CAP) return null;
  const now = new Date();
  const inv: Invite = {
    ...fields,
    token: makeInviteToken(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + INVITE_TTL * 1000).toISOString(),
  };
  await kv(["SET", invDataKey(code, inv.token), JSON.stringify(inv), "EX", INVITE_TTL]);
  const entry: InviteIndexEntry = { createdAt: inv.createdAt, expiresAt: inv.expiresAt };
  await kv(["HSET", invIndexKey(code), inv.token, JSON.stringify(entry)]);
  await touch(invIndexKey(code), kv);
  return inv;
}

/** Data key and index row both go. True if there was anything to delete. */
export async function deleteInvite(code: string, token: string, kv: Kv = kvCmd): Promise<boolean> {
  const a = await kv(["DEL", invDataKey(code, token)]);
  const b = await kv(["HDEL", invIndexKey(code), token]);
  await touch(invIndexKey(code), kv);
  return a === 1 || b === 1;
}

/**
 * The single-use lock. SET NX means exactly one device can win a token; a
 * second device — someone the link was forwarded to — loses and is told the
 * invite was used. The device that won can tap again ("mine") and finish
 * what it started, which is what makes a claim safe to retry.
 */
export async function claimInvite(code: string, token: string, childId: string, kv: Kv = kvCmd): Promise<"won" | "mine" | "used"> {
  const won = await kv(["SET", invClaimKey(code, token), childId, "NX", "EX", CLAIM_TTL]);
  if (won) return "won";
  const holder = await kv(["GET", invClaimKey(code, token)]);
  return String(holder || "") === childId ? "mine" : "used";
}

/** Who holds the lock on a token, if anyone. */
export async function claimHolder(code: string, token: string, kv: Kv = kvCmd): Promise<string> {
  const holder = await kv(["GET", invClaimKey(code, token)]);
  return holder ? String(holder) : "";
}

/**
 * Close the claim: the index remembers who and when, and the data key — the
 * label and the target — is DELETED. The roster row will carry the name the
 * parent types, and the assignment already went to the homework hash, so
 * nothing the clinician typed needs to outlive the tap.
 */
export async function finishClaim(code: string, token: string, childId: string, kv: Kv = kvCmd): Promise<void> {
  const index = await readInviteIndex(code, kv);
  const entry: InviteIndexEntry = {
    ...(index[token] || { createdAt: "", expiresAt: "" }),
    claimedBy: childId,
    claimedAt: new Date().toISOString(),
  };
  await kv(["HSET", invIndexKey(code), token, JSON.stringify(entry)]);
  await touch(invIndexKey(code), kv);
  await kv(["DEL", invDataKey(code, token)]);
}

// ── gone: children taken off the roster ─────────────────────────────────────

export async function isGone(code: string, childId: string, kv: Kv = kvCmd): Promise<boolean> {
  return (await kv(["HEXISTS", goneKey(code), childId])) === 1;
}

export async function readGone(code: string, kv: Kv = kvCmd): Promise<Set<string>> {
  const flat = await kv(["HGETALL", goneKey(code)]);
  const out = new Set<string>();
  if (Array.isArray(flat)) for (let i = 0; i < flat.length; i += 2) out.add(String(flat[i]));
  return out;
}

export async function markGone(code: string, childId: string, kv: Kv = kvCmd): Promise<void> {
  await kv(["HSET", goneKey(code), childId, new Date().toISOString()]);
  await touch(goneKey(code), kv, TOMB_TTL);
}

/**
 * A claimed invite lifts the mark. A claim proves two things at once — the
 * device passed this clinic's code+key AND holds a token only the
 * clinician's own link carries — so it is the clinician inviting this family
 * back, and any earlier removal is theirs, or the family's, to undo.
 */
export async function unmarkGone(code: string, childId: string, kv: Kv = kvCmd): Promise<void> {
  await kv(["HDEL", goneKey(code), childId]);
  await touch(goneKey(code), kv, TOMB_TTL);
}

/**
 * Take a child off the caseload — from the clinician's dashboard or from the
 * family's own "stop sharing" button; the deletion is the same. Roster row,
 * homework row, clinician meta and the index row of the invite they came in
 * through all go, and the child is marked gone so the device's next sync
 * cannot quietly put the row back (/api/pilot and /api/homework check first).
 * Nothing on the device is touched: the family keeps the app and their
 * unlock; the clinician just stops receiving.
 */
export async function removeChild(code: string, childId: string, kv: Kv = kvCmd): Promise<{ removed: string }> {
  await kv(["HDEL", rosterKey(code), childId]);
  await touch(rosterKey(code), kv);
  await kv(["HDEL", hwKey(code), childId]);
  await touch(hwKey(code), kv);
  await kv(["HDEL", metaKey(code), childId]);
  await touch(metaKey(code), kv);
  const index = await readInviteIndex(code, kv);
  for (const token of Object.keys(index)) {
    if (index[token].claimedBy === childId) await deleteInvite(code, token, kv);
  }
  await markGone(code, childId, kv);
  return { removed: childId };
}

// ── the roster record the device writes ─────────────────────────────────────

export const ROSTER_RECORD_MAX = 16000;   // chars of JSON; a real child's year fits with room to spare
export const ROSTER_DAYS_KEEP = 90;

type SoundOutcome = { days?: Record<string, unknown>; byWord?: unknown; [k: string]: unknown };

/**
 * Serialise a roster record so that it is ALWAYS valid JSON. The write used
 * to `.slice(0, 16000)` the string, which past the limit stored a truncated
 * document that JSON.parse could not read — the dashboard then skipped that
 * child as malformed, silently, and the family it happened to was the one
 * who had practised the most. Now, if the record is too long, the per-word
 * breakdown goes first (the least a clinician reads), then each sound's day
 * ledger is trimmed to the newest 90 dates, and whatever remains is stored
 * whole. Nothing is ever cut mid-character.
 */
export function fitRosterRecord(row: Record<string, unknown>): string {
  let s = JSON.stringify(row);
  if (s.length <= ROSTER_RECORD_MAX) return s;
  const outcomes = (row.outcomes && typeof row.outcomes === "object" ? row.outcomes : {}) as Record<string, SoundOutcome>;
  const slim: Record<string, SoundOutcome> = {};
  for (const snd of Object.keys(outcomes)) {
    const o = outcomes[snd];
    if (!o || typeof o !== "object") continue;
    const { byWord: _drop, ...rest } = o;   // eslint-disable-line @typescript-eslint/no-unused-vars
    slim[snd] = rest;
  }
  s = JSON.stringify({ ...row, outcomes: slim });
  if (s.length <= ROSTER_RECORD_MAX) return s;
  for (const snd of Object.keys(slim)) {
    const days = slim[snd].days;
    if (!days || typeof days !== "object") continue;
    const keep = Object.keys(days).sort().slice(-ROSTER_DAYS_KEEP);
    const trimmed: Record<string, unknown> = {};
    for (const d of keep) trimmed[d] = days[d];
    slim[snd] = { ...slim[snd], days: trimmed };
  }
  return JSON.stringify({ ...row, outcomes: slim });
}

// ── the clinician's account, as every roster route needs it ────────────────

export type SlpAccount = { code: string; familyKey: string; name: string; clinic: string };

/** The signed-in clinician's code, key and display name — from the account the session names. */
export async function readAccount(email: string, kv: Kv = kvCmd): Promise<SlpAccount> {
  const out: SlpAccount = { code: "", familyKey: "", name: "", clinic: "" };
  try {
    const raw = await kv(["GET", "slpacct:" + email]);
    if (raw) {
      const a = JSON.parse(String(raw)) as Partial<SlpAccount>;
      out.code = String(a.code || "");
      out.familyKey = String(a.familyKey || "");
      out.name = String(a.name || "");
      out.clinic = String(a.clinic || "");
    }
  } catch {
    /* an unreadable account reads as no account */
  }
  return out;
}
