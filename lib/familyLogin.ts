import crypto from "node:crypto";
import { kvCmd } from "@/lib/slpAuth";

/**
 * FAMILY LOGINS (Travis, 14 Nov 2026): "on the first screen of the onboarding
 * … log in if they already have an account", and "in the SLP dashboard …
 * auto-generate login username and password for parents that they can
 * immediately share and have them go log into the app and get immediate
 * access".
 *
 * WHY A LOGIN AND NOT THE LINK. A clinician's join link opens in Safari, and
 * the iPhone app keeps its own storage apart from Safari's, so a family who
 * taps the link and then opens the app arrives in a blank app. A username
 * and password typed INTO the app lands where the family actually plays.
 *
 * WHAT A LOGIN BRINGS (Travis's call, 14 Nov 2026: "Access + SLP link"). The
 * same as the clinician's link: this device is connected to that clinician,
 * holds an enrolment ticket, and has Premium whenever the caseload is
 * covered. NOTHING ABOUT A CHILD IS STORED HERE: no name, no age, no
 * practice. A login on a new phone does not bring the old phone's practice
 * back; that history stays on the phone it happened on.
 *
 * A LOGIN IS NOT CONSENT. Logging in connects; sharing is still asked on the
 * family's own device ("Yes, share progress"), exactly as after a link.
 *
 * WHO KNOWS THE PASSWORD (Travis's call, 14 Nov 2026: "Reusable, parent can
 * change it"). The clinician makes it and sees it ONCE (only a salted scrypt
 * hash is kept), shares it, and the family can change it in Settings; from
 * then on `own` is true, the dashboard says so, and the clinician no longer
 * knows it. The clinician can always make a new one (a forgotten password),
 * which they then know again.
 *
 * Keys (the clinician's code lowercased, as every roster key):
 *   famlogin:<username>    the login: code, owner, what it belongs to, the
 *                          hash. Lives LOGIN_TTL from its last use; a login
 *                          made for an invite and never used lives only as
 *                          long as that invite.
 *   famlogins:<code>       index: "inv:<token>" or "cid:<childId>" → username.
 *                          The invite a login was made for, until the family
 *                          claims it; then the child it became.
 *   famloginfail:<user>    wrong passwords in the last hour (FAIL_LIMIT).
 *
 * Every function takes the KV command last, so tests hand in a fake store.
 */

export type Kv = (cmd: (string | number)[]) => Promise<unknown>;

export const LOGIN_TTL = 60 * 60 * 24 * 400;   // as long as a ticket lives; refreshed on every use
export const FAIL_LIMIT = 10;                  // wrong passwords per username per hour
export const FAIL_WINDOW = 3600;
export const PASS_LEN = 8;
export const OWN_MIN = 8;                      // a password the family chooses
export const OWN_MAX = 64;

// Friendly words a parent can read off a text message: animals and things,
// never a word that is also a common first name (a login must never look
// like it names the child).
export const LOGIN_WORDS = [
  "otter", "comet", "panda", "tiger", "koala", "cedar", "pebble", "acorn", "bison", "coral",
  "eagle", "gecko", "heron", "lemon", "mango", "walrus", "zebra", "rocket", "cloud", "cactus",
  "kiwi", "llama", "moose", "owl", "puffin", "seal", "toucan", "yak", "badger", "beaver",
  "camel", "falcon", "goose", "hippo", "lobster", "parrot", "turtle", "whale", "frog", "bear",
];
// The family key's unambiguous alphabet (lib/slpAuth KEY_ALPHABET), in lower
// case: no 0/o, 1/i/l, and no shift key on a phone.
export const PASS_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

const lc = (s: string) => String(s || "").toLowerCase();
export function loginKey(user: string): string { return "famlogin:" + user; }
export function loginIndexKey(code: string): string { return "famlogins:" + lc(code); }
export function failKey(user: string): string { return "famloginfail:" + user; }

/** What a login belongs to: an invite the clinician made, or the child it became. */
export type LoginRef = { inv?: string; cid?: string };
export function refField(ref: LoginRef): string {
  if (ref.cid) return "cid:" + ref.cid;
  if (ref.inv) return "inv:" + ref.inv;
  return "";
}

export type LoginRecord = {
  v: 1;
  user: string;
  code: string;        // the clinician's code, lowercase
  owner: string;       // the clinician's account email
  inv: string;         // the invite it was made for, until claimed
  cid: string;         // the child it became, once claimed
  salt: string;
  hash: string;
  own: boolean;        // the family chose this password; the clinician no longer knows it
  createdAt: string;
  changedAt: string;
  usedAt: string;
};

function pick(alphabet: string, n: number): string {
  const bytes = crypto.randomBytes(n);
  let s = "";
  for (let i = 0; i < n; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

/** "otter4827": a word and four digits, about 360,000 of them. */
export function makeUsername(): string {
  const w = LOGIN_WORDS[crypto.randomInt(LOGIN_WORDS.length)];
  return w + String(crypto.randomInt(1000, 10000));
}

/** Eight characters of PASS_ALPHABET: 31^8 ≈ 8.5×10^11. */
export function makePassword(): string {
  return pick(PASS_ALPHABET, PASS_LEN);
}

/** A typed username: any case, stray spaces, at most 24 characters of a–z and 0–9. */
export function cleanUsername(v: unknown): string {
  return String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
}

/** A clinician-made password as a parent may retype it: any case, spaces and dashes dropped. */
export function cleanGenerated(v: unknown): string {
  return String(v || "").toLowerCase().replace(/[\s-]/g, "").slice(0, 32);
}

// scrypt with Node's defaults made explicit: N=16384, r=8, p=1, 32 bytes.
// A few tens of milliseconds a check, which is nothing for a family and a
// great deal for anyone trying passwords against a stolen copy of the store.
const SCRYPT = { N: 16384, r: 8, p: 1 };
export function hashPassword(pw: string, salt = crypto.randomBytes(16).toString("base64url")): { salt: string; hash: string } {
  const hash = crypto.scryptSync(pw, salt, 32, SCRYPT).toString("base64url");
  return { salt, hash };
}
function hashMatches(pw: string, salt: string, hash: string): boolean {
  const want = Buffer.from(String(hash || ""), "base64url");
  const got = crypto.scryptSync(pw, String(salt || ""), 32, SCRYPT);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
/** The password as the record expects it: a made one forgives case and spaces; one the family chose is exact. */
export function checkPassword(pw: string, rec: Pick<LoginRecord, "salt" | "hash" | "own">): boolean {
  const typed = rec.own ? String(pw || "") : cleanGenerated(pw);
  if (!typed) return false;
  return hashMatches(typed, rec.salt, rec.hash);
}
// An unknown username costs the same as a known one, so timing cannot tell
// which usernames exist.
const DUMMY = hashPassword("not-a-real-password");

/** "" when a password the family chose is acceptable; otherwise what to fix. */
export function ownPasswordProblem(pw: string, user: string): string {
  const p = String(pw || "");
  if (p.length < OWN_MIN) return "Use at least " + OWN_MIN + " characters.";
  if (p.length > OWN_MAX) return "Use at most " + OWN_MAX + " characters.";
  if (cleanUsername(p) === user) return "Pick something other than your username.";
  return "";
}

function parse(raw: unknown): LoginRecord | null {
  if (raw === null || raw === undefined) return null;
  try {
    const r = JSON.parse(String(raw)) as LoginRecord;
    return r && r.v === 1 && r.user && r.code ? r : null;
  } catch {
    return null;
  }
}

export async function readLogin(user: string, kv: Kv = kvCmd): Promise<LoginRecord | null> {
  const u = cleanUsername(user);
  if (!u) return null;
  return parse(await kv(["GET", loginKey(u)]));
}

async function writeLogin(rec: LoginRecord, ttl: number, kv: Kv): Promise<void> {
  await kv(["SET", loginKey(rec.user), JSON.stringify(rec), "EX", Math.max(60, Math.floor(ttl))]);
}

async function touchIndex(code: string, kv: Kv): Promise<void> {
  await kv(["EXPIRE", loginIndexKey(code), LOGIN_TTL]);
}

/** field → username, for one clinician. */
export async function readLoginIndex(code: string, kv: Kv = kvCmd): Promise<Record<string, string>> {
  const flat = await kv(["HGETALL", loginIndexKey(code)]);
  const out: Record<string, string> = {};
  if (Array.isArray(flat)) for (let i = 0; i < flat.length; i += 2) out[String(flat[i])] = String(flat[i + 1]);
  return out;
}

/** What the dashboard may show about each login: never the password, never the hash. */
export type LoginSummary = { user: string; own: boolean; createdAt: string; usedAt: string };

/**
 * Every live login for a clinician, keyed by field ("inv:<token>" or
 * "cid:<childId>"). An index row whose login has expired is dropped here,
 * the way readInvites drops an invite nobody tapped.
 */
export async function loginsFor(code: string, kv: Kv = kvCmd): Promise<Record<string, LoginSummary>> {
  const index = await readLoginIndex(code, kv);
  const fields = Object.keys(index);
  const out: Record<string, LoginSummary> = {};
  if (!fields.length) return out;
  const vals = await kv(["MGET", ...fields.map((f) => loginKey(index[f]))]);
  let dropped = 0;
  for (let i = 0; i < fields.length; i++) {
    const rec = parse(Array.isArray(vals) ? vals[i] : null);
    if (rec && rec.code === lc(code)) {
      out[fields[i]] = { user: rec.user, own: !!rec.own, createdAt: rec.createdAt, usedAt: rec.usedAt || "" };
    } else {
      await kv(["HDEL", loginIndexKey(code), fields[i]]);
      dropped++;
    }
  }
  if (dropped) await touchIndex(code, kv);
  return out;
}

/**
 * Make the login for an invite or a child, or give it a new password if it
 * has one already (same username, so the family's habit survives a reset).
 * The password is returned ONCE, here, and never stored. `ttl` is how long an
 * unused login may live (an invite's remaining days); a used one lives
 * LOGIN_TTL from each use.
 */
export async function makeLogin(
  code: string, owner: string, ref: LoginRef, opts: { ttl?: number } = {}, kv: Kv = kvCmd,
): Promise<{ user: string; password: string; reset: boolean } | null> {
  const field = refField(ref);
  if (!field) return null;
  const now = new Date().toISOString();
  const password = makePassword();
  const { salt, hash } = hashPassword(password);
  const ttl = opts.ttl ?? LOGIN_TTL;
  // a reset: same username, new password, the clinician knows it again
  const had = await kv(["HGET", loginIndexKey(code), field]);
  if (had) {
    const rec = await readLogin(String(had), kv);
    if (rec && rec.code === lc(code)) {
      const next: LoginRecord = { ...rec, salt, hash, own: false, changedAt: now };
      await writeLogin(next, rec.usedAt ? LOGIN_TTL : ttl, kv);
      await kv(["DEL", failKey(rec.user)]);
      return { user: rec.user, password, reset: true };
    }
  }
  for (let tries = 0; tries < 12; tries++) {
    const user = makeUsername();
    const rec: LoginRecord = {
      v: 1, user, code: lc(code), owner: String(owner).trim().toLowerCase(),
      inv: ref.cid ? "" : String(ref.inv || ""), cid: String(ref.cid || ""),
      salt, hash, own: false, createdAt: now, changedAt: "", usedAt: "",
    };
    const won = await kv(["SET", loginKey(user), JSON.stringify(rec), "NX", "EX", Math.max(60, Math.floor(ttl))]);
    if (!won) continue;   // that username is taken; draw another
    await kv(["HSET", loginIndexKey(code), field, user]);
    await touchIndex(code, kv);
    return { user, password, reset: false };
  }
  return null;
}

/** The login and its index row both go. True if there was one. */
export async function deleteLogin(code: string, ref: LoginRef, kv: Kv = kvCmd): Promise<boolean> {
  const field = refField(ref);
  if (!field) return false;
  const user = await kv(["HGET", loginIndexKey(code), field]);
  if (!user) return false;
  const rec = await readLogin(String(user), kv);
  if (rec && rec.code === lc(code)) await kv(["DEL", loginKey(rec.user)]);
  await kv(["HDEL", loginIndexKey(code), field]);
  await touchIndex(code, kv);
  return true;
}

/**
 * The family said yes and claimed the invite: the login now belongs to the
 * child, so taking the child off the caseload takes the login with it, and it
 * lives LOGIN_TTL instead of the invite's 30 days.
 */
export async function moveLoginToChild(code: string, inv: string, cid: string, kv: Kv = kvCmd): Promise<boolean> {
  if (!inv || !cid) return false;
  const user = await kv(["HGET", loginIndexKey(code), "inv:" + inv]);
  if (!user) return false;
  const rec = await readLogin(String(user), kv);
  await kv(["HDEL", loginIndexKey(code), "inv:" + inv]);
  if (!rec || rec.code !== lc(code)) { await touchIndex(code, kv); return false; }
  await writeLogin({ ...rec, inv: "", cid }, LOGIN_TTL, kv);
  await kv(["HSET", loginIndexKey(code), "cid:" + cid, rec.user]);
  await touchIndex(code, kv);
  return true;
}

/**
 * Check a username and password. Ten wrong passwords for one username in an
 * hour lock it for the rest of that hour ("locked"); a right one clears the
 * count. An unknown username costs the same scrypt as a known one.
 */
export async function verifyLogin(
  username: unknown, password: unknown, kv: Kv = kvCmd,
): Promise<{ rec: LoginRecord } | { error: "wrong" | "locked" }> {
  const user = cleanUsername(username);
  const pw = String(password || "");
  if (!user || !pw) { hashMatches("x", DUMMY.salt, DUMMY.hash); return { error: "wrong" }; }
  // No password Sona makes or accepts is longer than OWN_MAX; a huge one is
  // turned away before the slow hash ever sees it.
  if (pw.length > 4 * OWN_MAX) return { error: "wrong" };
  const fails = Number((await kv(["GET", failKey(user)])) || 0);
  if (fails >= FAIL_LIMIT) return { error: "locked" };
  const rec = await readLogin(user, kv);
  const good = rec ? checkPassword(pw, rec) : (hashMatches("x", DUMMY.salt, DUMMY.hash), false);
  if (!rec || !good) {
    const n = await kv(["INCR", failKey(user)]);
    if (n === 1) await kv(["EXPIRE", failKey(user), FAIL_WINDOW]);
    return { error: "wrong" };
  }
  if (fails) await kv(["DEL", failKey(user)]);
  return { rec };
}

// The record as it is NOW, for a write that follows a slower step (the
// cap's Stripe check, a new hash): a claim or a password change in between
// must not be written over with the copy read before it. A login deleted in
// between stays deleted.
async function current(rec: LoginRecord, kv: Kv): Promise<LoginRecord | null> {
  const now = await readLogin(rec.user, kv);
  return now && now.code === rec.code ? now : null;
}

/** A successful login: the login lives LOGIN_TTL from now. */
export async function markUsed(rec: LoginRecord, kv: Kv = kvCmd): Promise<void> {
  const now = await current(rec, kv);
  if (now) await writeLogin({ ...now, usedAt: new Date().toISOString() }, LOGIN_TTL, kv);
}

/** The family chooses its own password: from now on the clinician does not know it. False if the login is gone. */
export async function setOwnPassword(rec: LoginRecord, next: string, kv: Kv = kvCmd): Promise<boolean> {
  const { salt, hash } = hashPassword(String(next));
  const now = await current(rec, kv);
  if (!now) return false;
  await writeLogin({ ...now, salt, hash, own: true, changedAt: new Date().toISOString() }, LOGIN_TTL, kv);
  return true;
}
