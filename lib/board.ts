import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { kvCmd, kvConfigured, resendSend } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";

/**
 * THE PRACTICE BOARD, SERVER SIDE (BOARD1, 11 Oct 2026). Built dark.
 *
 * A monthly board of the Sona kids whose grown-up turned it on, counting the
 * days each met the daily goal. Travis chose it ("a board of every kid in
 * Sona", counting days practiced; nicknames made up; the server counts the
 * days so nobody can fake them). It reverses the anonymous weekly board that
 * was retired for App Review on 22 Sep 2026, so it ships switched OFF here
 * and in public/sona.js, and only Travis's go flips both.
 *
 * What the server keeps, per child: a random id, a made-up nickname, a buddy
 * id, the time zone the family joined from, the date it joined and which days
 * counted this month. Never a name, an age, a sound, audio, a device id
 * (`fid`), a child id, a clinician code, an email address or a raw IP. The
 * grown-up's address is handed to Resend once, for the confirmation email,
 * and only a one-day HMAC of it is kept, to send it at most two a day.
 *
 * What it can promise (spec §9.8): a day counts at most once; the server's
 * clock decides the day, so only today and yesterday can be claimed in the
 * family's own zone ("a day can be added up to a day late, never early");
 * nobody passes the calendar days since joining; only the phone holding the
 * token can claim; every member came through an emailed link the phone never
 * sees. It cannot prove a child spoke: no audio ever leaves the phone.
 *
 * Every write is ONE Lua script that checks first that the key it changes
 * still exists and sets every time limit inside itself, so a race with a
 * deletion can never leave a board key without one. A KV error (`kvCmd`
 * answering undefined) is never read as "already done": the route answers 503
 * and the phone keeps its queued day or deletion. Deleting always works, live
 * or not, paused or not.
 */

/** Pinned equal to `BOARD_LIVE` in public/sona.js by tests/boardapitest.mjs. Flipping it is Travis's go. */
export const BOARD_LIVE = false;

/**
 * Where this code runs, failing closed: no `VERCEL` is a developer's machine;
 * on Vercel only an explicit "preview" or "development" is a preview, and
 * anything else, a missing `VERCEL_ENV` included, counts as production.
 */
export function boardEnv(): "local" | "preview" | "prod" {
  if (!process.env.VERCEL) return "local";
  const e = process.env.VERCEL_ENV;
  return e === "preview" || e === "development" ? "preview" : "prod";
}

/**
 * Every board key's prefix. A preview may share production's Upstash (the
 * case lib/caseload.ts plans for), so outside production the board lives
 * under its own prefix and can never write into, or read, the real board.
 */
export function boardPrefix(): string {
  return boardEnv() === "prod" ? "board:" : "board-pv:";
}

/** Live in production only by the constant; a preview or a laptop may force it on, under `board-pv:`. */
export function boardLive(): boolean {
  return BOARD_LIVE || (boardEnv() !== "prod" && process.env.BOARD_FORCE_LIVE === "1");
}

/**
 * The signing keys, newest first. Tokens are signed with the first and
 * checked against each, so rotating BOARD_SECRET (the old one moved to
 * BOARD_SECRET_PREV) never turns every phone's token into a 401. The fixed
 * development key exists only on a developer's machine; anywhere else no
 * BOARD_SECRET means every route answers 503.
 */
export function boardSecrets(): string[] {
  const now = process.env.BOARD_SECRET || "";
  if (!now) return boardEnv() === "local" ? ["sona-board-dev"] : [];
  const prev = process.env.BOARD_SECRET_PREV || "";
  return prev ? [now, prev] : [now];
}

// ── Fixed data ─────────────────────────────────────────────────────────────

/** The buddy ids a row may show: public/sona.js's CHARACTERS ids (pinned equal by boardapitest). Anything else is the fox. */
export const BUDDY_IDS = ["fox", "bunny", "dragon", "cat", "bee", "octopus", "dino", "panda", "frog", "penguin", "lion", "unicorn"];

/**
 * Nicknames are made up here, never typed: an adjective, an animal and a
 * number from 10 to 99, "Brave Fox 42". 32 × 32 × 86 = 88,064 of them. The
 * lists are checked against a denylist of words a child should not be called
 * (boardapitest). A pair a reviewer rejects goes in NICK_BLOCK.
 */
export const ADJECTIVES = [
  "Brave", "Bright", "Bouncy", "Calm", "Cheery", "Clever", "Cozy", "Curious",
  "Daring", "Dreamy", "Eager", "Friendly", "Gentle", "Giggly", "Golden", "Happy",
  "Jolly", "Kind", "Lively", "Lucky", "Merry", "Mighty", "Peppy", "Plucky",
  "Quick", "Sparkly", "Speedy", "Starry", "Sunny", "Swift", "Twinkly", "Zippy",
];
export const ANIMALS = [
  "Fox", "Bunny", "Panda", "Otter", "Koala", "Owl", "Duck", "Frog",
  "Turtle", "Penguin", "Puppy", "Kitten", "Lamb", "Pony", "Seal", "Whale",
  "Dolphin", "Tiger", "Lion", "Bear", "Robin", "Parrot", "Llama", "Hedgehog",
  "Squirrel", "Mouse", "Zebra", "Giraffe", "Moose", "Raccoon", "Puffin", "Gecko",
];
/** Numbers never shown: they read as something else to a grown-up. */
export const NUMBER_SKIP = [14, 18, 69, 88];
/** "Adjective Animal" pairs a reviewer rejected. None yet. */
export const NICK_BLOCK: string[] = [];

/** The confirmation code's letters: no 0/O, 1/I/L, 2/Z, 5/S, 6/G, 8/B, U/V. */
export const CODE_ALPHABET = "ACDEFHJKMNPQRTWXY347";

// Time limits, in seconds.
export const PEND_TTL = 172800;        // a pending request: 48 hours
export const MEMBER_TTL = 8640000;     // a member, its nickname and its remove-link record: 100 days after the last counted day
export const TICK_TTL = 259200;        // "this day already counted": 3 days
export const DAY_TTL = 172800;         // per-UTC-day counters and snapshots: 2 days
export const MAILTO_TTL = 86400;       // the one-day scrambled address
export const JOINS_TTL = 1296000;      // the daily join count the founder page reads back 14 days (no one in it)
export const MAX_AGO = 172800;         // a queued day older than 48 hours is dropped by the phone and refused here
export const DAY_CAP = 12;             // day claims per member per UTC day
export const VIEW_CAP = 120;           // views per member per hour
export const NICK_HOUR_CAP = 10;       // nickname asks per member per hour
export const MAIL_CAP = 300;           // confirmation emails per UTC day, everyone together
export const MAILTO_CAP = 2;           // confirmation emails per address per day
export const JOINS_HIGH = 500;         // a day with more joins than this is logged (never blocked)
export const NICK_TRIES = 8;           // candidate nicknames drawn per child

// ── Helpers ────────────────────────────────────────────────────────────────

/** 16 random bytes, base64url: a member id, a request id, a confirm secret. */
export function makeId(): string {
  return crypto.randomBytes(16).toString("base64url");
}

function mac(secret: string, kind: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update("sona-board:" + kind + ":" + payload).digest("base64url");
}

/**
 * Four kinds of signed value, never interchangeable: "m" a member's token
 * (kept by the phone), "p" a pending request (kept by the phone), "c" confirm
 * and "x" remove (only ever in the email; they carry `rid.cid`). The phone
 * never sees `cid`, so it can neither confirm its own request nor read its
 * remove link back.
 */
export function sign(kind: "m" | "p" | "c" | "x", payload: string): string {
  const secret = boardSecrets()[0];
  if (!secret) throw new Error("no board secret");
  return kind + "." + payload + "." + mac(secret, kind, payload);
}

const ID = "[A-Za-z0-9_-]{16,64}";
const PAYLOAD: Record<string, RegExp> = { m: new RegExp("^" + ID + "$"), p: new RegExp("^" + ID + "$"), c: new RegExp("^" + ID + "\\." + ID + "$"), x: new RegExp("^" + ID + "\\." + ID + "$") };

/** The payload of a value of this kind signed with any key on the ring, else null. */
export function readSigned(kind: "m" | "p" | "c" | "x", token: unknown): string | null {
  if (typeof token !== "string" || token.length > 300 || !token.startsWith(kind + ".")) return null;
  const rest = token.slice(kind.length + 1);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = rest.slice(0, dot);
  if (!PAYLOAD[kind].test(payload)) return null;
  const given = Buffer.from(rest.slice(dot + 1));
  let good = false;
  for (const secret of boardSecrets()) {
    const want = Buffer.from(mac(secret, kind, payload));
    if (given.length === want.length && crypto.timingSafeEqual(given, want)) good = true;
  }
  return good ? payload : null;
}

/** The SHA-256 of a confirm secret: what the store keeps instead of it. */
export function cidHash(cid: string): string {
  return crypto.createHash("sha256").update("sona-board-cid:" + cid).digest("hex");
}

/** A time-zone offset in minutes east of UTC, as the phone sends it: −720 to 840, a multiple of 15. */
export function offsetOk(tz: unknown): tz is number {
  return typeof tz === "number" && Number.isInteger(tz) && tz >= -720 && tz <= 840 && tz % 15 === 0;
}

/** The family's calendar day `agoSec` seconds ago, by the server's clock, in zone `tz`. */
export function memberDay(nowMs: number, tz: number, agoSec: number): string {
  return new Date(nowMs - agoSec * 1000 + tz * 60000).toISOString().slice(0, 10);
}

export function utcDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function utcHour(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 13);
}

export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** A month list is erased 8 days after its month ends (seconds since the epoch). */
export function monthExpiry(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return Date.UTC(y, m, 1) / 1000 + 8 * 86400;
}

/** The UTC month `delta` months from `ym`. */
export function monthShift(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function lastDayOf(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function dayNum(day: string): number {
  return Math.round(Date.parse(day + "T00:00:00Z") / 86400000);
}

function shiftDay(day: string, delta: number): string {
  return new Date((dayNum(day) + delta) * 86400000).toISOString().slice(0, 10);
}

/**
 * The most days a member can hold in `day`'s month: the calendar days from
 * the later of the day they joined and the 1st of that month, up to the
 * earlier of today and that month's last day, inclusive.
 */
export function ceilingFor(day: string, joined: string, today: string): number {
  const ym = monthOf(day);
  const start = joined > ym + "-01" ? joined : ym + "-01";
  const last = lastDayOf(ym);
  const end = today < last ? today : last;
  return Math.max(0, dayNum(end) - dayNum(start) + 1);
}

/** Competition ranking of scores sorted high to low: 5, 5, 3 → 1, 1, 3. */
export function places(scores: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < scores.length; i++) out.push(i > 0 && scores[i] === scores[i - 1] ? out[i - 1] : i + 1);
  return out;
}

/**
 * A one-day scrambled form of an address, to send it at most two links a
 * day: the UTC day is inside the HMAC, so today's value cannot be matched
 * to yesterday's, and the key holding it lives one day.
 */
export function mailKey(email: string, nowMs: number): string {
  const secret = boardSecrets()[0] || "";
  return crypto.createHmac("sha256", secret).update("mail:" + utcDay(nowMs) + ":" + email.toLowerCase()).digest("hex").slice(0, 32);
}

export function makeCode(): string {
  let s = "";
  for (let i = 0; i < 3; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return s;
}

/** `count` made-up nicknames, never a skipped number or a blocked pair. */
export function nickCandidates(count: number): string[] {
  const out: string[] = [];
  const blocked = new Set(NICK_BLOCK.map((p) => p.toLowerCase()));
  while (out.length < count) {
    const pair = ADJECTIVES[crypto.randomInt(ADJECTIVES.length)] + " " + ANIMALS[crypto.randomInt(ANIMALS.length)];
    const n = 10 + crypto.randomInt(90);
    if (NUMBER_SKIP.includes(n) || blocked.has(pair.toLowerCase())) continue;
    out.push(pair + " " + n);
  }
  return out;
}

/** A nickname as the server makes it, for the founder's removal by nickname. */
export function nickShape(s: unknown): s is string {
  return typeof s === "string" && s.length <= 40 && /^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/.test(s);
}

/**
 * The keys a member's id can sit in or under, for a deletion: the month
 * lists of the previous, current and next UTC months and their snapshots
 * of today, yesterday and the day before (a snapshot lives two days), and
 * the "already counted" marks of the days from five days ago to tomorrow
 * (a mark lives three days, and a family's day is at most a day off UTC).
 */
export function leaveArgs(nowMs: number): (string | number)[] {
  const P = boardPrefix();
  const today = utcDay(nowMs), ym = monthOf(today);
  const zkeys: string[] = [];
  for (const d of [-1, 0, 1]) {
    const m = monthShift(ym, d);
    zkeys.push(P + "m:" + m);
    for (const back of [0, 1, 2]) zkeys.push(P + "snap:" + m + ":" + shiftDay(today, -back));
  }
  const days: string[] = [];
  for (let d = -5; d <= 1; d++) days.push(shiftDay(today, d));
  return [zkeys.length, ...zkeys, days.length, ...days];
}

// ── The scripts ────────────────────────────────────────────────────────────
// Each starts with its marker line; tests/boardapitest.mjs models each one by
// it (the slpcommunityapi pattern) and can run them all against a real Redis
// (BOARD_REDIS_SERVER=…/redis-server). Days and times are worked out by the
// route and passed in: a script never reads a clock.

/** -- board:mail — the global and the per-address email counters, each with its time limit. */
export const SCRIPT_MAIL = `-- board:mail
local g = redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
if g > tonumber(ARGV[3]) then return {g, 0} end
local a = redis.call('INCR', KEYS[2])
if redis.call('TTL', KEYS[2]) < 0 then redis.call('EXPIRE', KEYS[2], ARGV[2]) end
return {g, a}
`;

/**
 * -- board:start — a new pending request ("new": only when the key is new),
 * or one more confirm secret on a live, unclaimed one ("add": at most three
 * kept, the oldest dropped). The request keeps its own 48 hours.
 */
export const SCRIPT_START = `-- board:start
local pend = KEYS[1]
if ARGV[1] == 'new' then
  if redis.call('EXISTS', pend) == 1 then return 0 end
  redis.call('HSET', pend, 'n', ARGV[4], 'buddies', ARGV[5], 'tz', ARGV[6], 'code', ARGV[7], 'ok', '0', 'cidh1', ARGV[3])
  redis.call('EXPIRE', pend, ARGV[2])
  return 1
end
if redis.call('EXISTS', pend) == 0 then return 0 end
local f = redis.call('HMGET', pend, 'mids', 'cidh1', 'cidh2', 'cidh3')
if f[1] then return 0 end
if not f[2] then redis.call('HSET', pend, 'cidh1', ARGV[3])
elseif not f[3] then redis.call('HSET', pend, 'cidh2', ARGV[3])
elseif not f[4] then redis.call('HSET', pend, 'cidh3', ARGV[3])
else redis.call('HSET', pend, 'cidh1', f[3], 'cidh2', f[4], 'cidh3', ARGV[3]) end
return 1
`;

/** -- board:confirm — the emailed secret's hash must be one the request holds. */
export const SCRIPT_CONFIRM = `-- board:confirm
local pend = KEYS[1]
if redis.call('EXISTS', pend) == 0 then return 0 end
local h = redis.call('HMGET', pend, 'cidh1', 'cidh2', 'cidh3')
if h[1] ~= ARGV[1] and h[2] ~= ARGV[1] and h[3] ~= ARGV[1] then return 0 end
redis.call('HSET', pend, 'ok', '1')
return 1
`;

/**
 * -- board:claim — once the grown-up has confirmed, one member per child,
 * each with the first free nickname. Repeatable: a second claim, a retry or
 * a lost answer gets the same members back (`mids`), never a second set.
 * If any child gets no nickname, every key it made is taken back.
 */
export const SCRIPT_CLAIM = `-- board:claim
local pend, rk, jk = KEYS[1], KEYS[2], KEYS[3]
local P, rid, joined, ttl, per, given = ARGV[1], ARGV[2], ARGV[3], tonumber(ARGV[4]), tonumber(ARGV[5]), tonumber(ARGV[6])
if redis.call('EXISTS', pend) == 0 then return cjson.encode({s = 'expired'}) end
local f = redis.call('HMGET', pend, 'ok', 'mids', 'n', 'buddies', 'tz', 'code', 'cidh1', 'cidh2', 'cidh3')
if f[1] ~= '1' then return cjson.encode({s = 'waiting'}) end
if f[2] then
  local out = {}
  for id in string.gmatch(f[2], '[^,]+') do
    local nk = redis.call('HGET', P .. 'mem:' .. id, 'nick')
    out[#out + 1] = {id, nk or ''}
  end
  return cjson.encode({s = 'done', m = out})
end
local n = tonumber(f[3]) or 0
if n < 1 or n > given then return cjson.encode({s = 'busy'}) end
local buds = {}
for b in string.gmatch(f[4] or '', '[^,]+') do buds[#buds + 1] = b end
local made, ids, out = {}, {}, {}
for i = 1, n do
  local base = 8 + (i - 1) * (per + 1)
  local id = ARGV[base]
  local nick = false
  for j = 1, per do
    local cand = ARGV[base + j]
    if redis.call('SET', P .. 'nick:' .. cand, id, 'NX', 'EX', ttl) then nick = cand break end
  end
  if not nick then
    for _, k in ipairs(made) do redis.call('DEL', k) end
    return cjson.encode({s = 'busy'})
  end
  made[#made + 1] = P .. 'nick:' .. nick
  ids[i] = id
  out[i] = {id, nick}
end
for i = 1, n do
  local mem = P .. 'mem:' .. ids[i]
  redis.call('HSET', mem, 'nick', out[i][2], 'buddy', buds[i] or 'fox', 'tz', f[5], 'tz0', f[5], 'tzAt', '0', 'joined', joined, 'rid', rid, 'nkd', '', 'nkm', '', 'nkn', '0')
  redis.call('EXPIRE', mem, ttl)
end
local r = {'HSET', rk, 'ids', table.concat(ids, ','), 'code', f[6]}
for i = 7, 9 do if f[i] then r[#r + 1] = 'cidh' .. (i - 6); r[#r + 1] = f[i] end end
redis.call(unpack(r))
redis.call('EXPIRE', rk, ttl)
redis.call('HSET', pend, 'mids', table.concat(ids, ','))
local joins = redis.call('INCRBY', jk, n)
if redis.call('TTL', jk) < 0 then redis.call('EXPIRE', jk, ARGV[7]) end
return cjson.encode({s = 'new', m = out, joins = joins})
`;

/**
 * -- board:day — one counted day. The member must still exist; at most 12
 * claims a UTC day; a day already counted answers "already counted" (a
 * retry is normal, and must never read as an error); never past the month's
 * ceiling; once per day (SET NX).
 * Only a counted day refreshes the member's 100 days, and only a counted day
 * may move its time zone: within two hours of where it joined, once in 20
 * hours (daylight saving, a short trip).
 */
export const SCRIPT_DAY = `-- board:day
local mem, dk, tk, mz = KEYS[1], KEYS[2], KEYS[3], KEYS[4]
local P, id, ceiling, ttl, mexp, buddy, ntz, now = ARGV[1], ARGV[2], tonumber(ARGV[3]), tonumber(ARGV[4]), tonumber(ARGV[5]), ARGV[6], ARGV[7], tonumber(ARGV[8])
if redis.call('EXISTS', mem) == 0 then return cjson.encode({s = 'gone'}) end
local dn = redis.call('INCR', dk)
if redis.call('TTL', dk) < 0 then redis.call('EXPIRE', dk, ARGV[9]) end
if dn > tonumber(ARGV[10]) then return cjson.encode({s = 'limit'}) end
local cur = tonumber(redis.call('ZSCORE', mz, id) or '0')
if redis.call('EXISTS', tk) == 1 then return cjson.encode({s = 'dup', days = cur}) end
if cur + 1 > ceiling then return cjson.encode({s = 'ceiling', days = cur}) end
if not redis.call('SET', tk, '1', 'NX', 'EX', ARGV[11]) then return cjson.encode({s = 'dup', days = cur}) end
local days = tonumber(redis.call('ZINCRBY', mz, 1, id))
redis.call('EXPIREAT', mz, mexp)
redis.call('EXPIRE', mem, ttl)
local f = redis.call('HMGET', mem, 'nick', 'rid', 'tz', 'tz0', 'tzAt')
if f[1] then redis.call('EXPIRE', P .. 'nick:' .. f[1], ttl) end
if f[2] then redis.call('EXPIRE', P .. 'rid:' .. f[2], ttl) end
if buddy ~= '' then redis.call('HSET', mem, 'buddy', buddy) end
if ntz ~= '' and ntz ~= f[3] then
  local t, t0, at = tonumber(ntz), tonumber(f[4] or '0'), tonumber(f[5] or '0')
  if math.abs(t - t0) <= 120 and now - at >= 72000 then redis.call('HSET', mem, 'tz', ntz, 'tzAt', now) end
end
return cjson.encode({s = 'counted', days = days})
`;

/**
 * -- board:view — the day's snapshot of the month (made on the first view
 * of the UTC day, so polling never shows when another child practiced), up
 * to 50 rows of it with their nickname and buddy, the size of each tie group
 * shown, and the asking child's own live days. Refreshes no time limit.
 */
export const SCRIPT_VIEW = `-- board:view
local mem, mz, snap, mark, vk = KEYS[1], KEYS[2], KEYS[3], KEYS[4], KEYS[5]
local P, id = ARGV[1], ARGV[2]
if redis.call('EXISTS', mem) == 0 then return cjson.encode({s = 'gone'}) end
local vn = redis.call('INCR', vk)
if redis.call('TTL', vk) < 0 then redis.call('EXPIRE', vk, 3600) end
if vn > tonumber(ARGV[3]) then return cjson.encode({s = 'limit'}) end
if redis.call('EXISTS', mark) == 0 then
  redis.call('ZUNIONSTORE', snap, 1, mz)
  redis.call('EXPIRE', snap, ARGV[4])
  redis.call('SET', mark, '1', 'EX', ARGV[4])
end
local rows = redis.call('ZREVRANGE', snap, 0, 49, 'WITHSCORES')
local out = {}
for i = 1, #rows, 2 do
  local h = redis.call('HMGET', P .. 'mem:' .. rows[i], 'nick', 'buddy')
  if h[1] then out[#out + 1] = {rows[i] == id and 1 or 0, h[1], h[2] or 'fox', tonumber(rows[i + 1])}
  else redis.call('ZREM', snap, rows[i]) end
end
local seen, ties = {}, {}
for _, r in ipairs(out) do
  if not seen[r[4]] then seen[r[4]] = true; ties[#ties + 1] = {r[4], redis.call('ZCOUNT', snap, r[4], r[4])} end
end
local days = tonumber(redis.call('ZSCORE', mz, id) or '0')
local above = 0
if days > 0 then above = redis.call('ZCOUNT', snap, '(' .. days, '+inf') end
local me = redis.call('HMGET', mem, 'nick', 'buddy')
return cjson.encode({s = 'ok', rows = out, ties = ties, card = redis.call('ZCARD', snap), days = days, above = above, snapme = tonumber(redis.call('ZSCORE', snap, id) or '-1'), nick = me[1], buddy = me[2] or 'fox'})
`;

/**
 * -- board:nick — a new nickname: at most one a day and three a month, the
 * first free candidate taken with the member's own remaining time, the old
 * one let go.
 */
export const SCRIPT_NICK = `-- board:nick
local mem, hk = KEYS[1], KEYS[2]
local P, id, day, ym = ARGV[1], ARGV[2], ARGV[3], ARGV[4]
if redis.call('EXISTS', mem) == 0 then return cjson.encode({s = 'gone'}) end
local hn = redis.call('INCR', hk)
if redis.call('TTL', hk) < 0 then redis.call('EXPIRE', hk, 3600) end
if hn > tonumber(ARGV[5]) then return cjson.encode({s = 'limit'}) end
local f = redis.call('HMGET', mem, 'nick', 'nkd', 'nkm', 'nkn')
if f[2] == day then return cjson.encode({s = 'limit'}) end
local used = tonumber(f[4] or '0') or 0
if f[3] ~= ym then used = 0 end
if used >= 3 then return cjson.encode({s = 'limit'}) end
local pttl = redis.call('PTTL', mem)
if pttl <= 0 then return cjson.encode({s = 'busy'}) end
for i = 6, #ARGV do
  local cand = ARGV[i]
  if redis.call('SET', P .. 'nick:' .. cand, id, 'NX', 'PX', pttl) then
    if f[1] and f[1] ~= cand then
      local old = P .. 'nick:' .. f[1]
      if redis.call('GET', old) == id then redis.call('DEL', old) end
    end
    redis.call('HSET', mem, 'nick', cand, 'nkd', day, 'nkm', ym, 'nkn', used + 1)
    return cjson.encode({s = 'ok', nick = cand})
  end
end
return cjson.encode({s = 'busy'})
`;

// One member's deletion, shared by the leave and remove scripts: its
// nickname, its place in every month list and snapshot it could be in, its
// "already counted" marks, the member itself, and its id on the remove-link
// record (the record goes when it holds nobody).
const LEAVE_FN = `local function leave(P, id, zkeys, days)
  local mem = P .. 'mem:' .. id
  if redis.call('EXISTS', mem) == 0 then return 0 end
  local n = 0
  local f = redis.call('HMGET', mem, 'nick', 'rid')
  if f[1] then
    local nk = P .. 'nick:' .. f[1]
    if redis.call('GET', nk) == id then n = n + redis.call('DEL', nk) end
  end
  for _, z in ipairs(zkeys) do n = n + redis.call('ZREM', z, id) end
  for _, d in ipairs(days) do n = n + redis.call('DEL', P .. 'tick:' .. id .. ':' .. d) end
  n = n + redis.call('DEL', mem)
  if f[2] then
    local rk = P .. 'rid:' .. f[2]
    local ids = redis.call('HGET', rk, 'ids')
    if ids then
      local keep = {}
      for x in string.gmatch(ids, '[^,]+') do if x ~= id then keep[#keep + 1] = x end end
      if #keep == 0 then redis.call('DEL', rk) else redis.call('HSET', rk, 'ids', table.concat(keep, ',')) end
    end
  end
  return n
end
local function lists(from)
  local nz = tonumber(ARGV[from])
  local zkeys, days = {}, {}
  for i = 1, nz do zkeys[i] = ARGV[from + i] end
  local nd = tonumber(ARGV[from + nz + 1])
  for i = 1, nd do days[i] = ARGV[from + nz + 1 + i] end
  return zkeys, days
end
`;

/** -- board:leave — one member, gone. An absent member is 0 (deleting twice is fine). */
export const SCRIPT_LEAVE = `-- board:leave
${LEAVE_FN}local zkeys, days = lists(3)
return leave(ARGV[1], ARGV[2], zkeys, days)
`;

/**
 * -- board:remove — the email's remove link: every member of that request,
 * the remove-link record, and the pending request if it is still there
 * (claimed or not). Answers {found, keys removed}.
 */
export const SCRIPT_REMOVE = `-- board:remove
${LEAVE_FN}local pend, rk = KEYS[1], KEYS[2]
local P, cidh = ARGV[1], ARGV[2]
local zkeys, days = lists(3)
local function holds(key)
  local h = redis.call('HMGET', key, 'cidh1', 'cidh2', 'cidh3')
  return h[1] == cidh or h[2] == cidh or h[3] == cidh
end
local found, n = 0, 0
if redis.call('EXISTS', rk) == 1 and holds(rk) then
  found = 1
  local ids = redis.call('HGET', rk, 'ids') or ''
  for id in string.gmatch(ids, '[^,]+') do n = n + leave(P, id, zkeys, days) end
  redis.call('DEL', rk)
end
if redis.call('EXISTS', pend) == 1 and holds(pend) then
  found = 1
  local mids = redis.call('HGET', pend, 'mids') or ''
  for id in string.gmatch(mids, '[^,]+') do n = n + leave(P, id, zkeys, days) end
  redis.call('DEL', pend)
end
return {found, n}
`;

/** One script call. undefined is a store error, never an answer. */
export async function runScript(script: string, keys: string[], args: (string | number)[]): Promise<unknown> {
  return kvCmd(["EVAL", script, keys.length, ...keys, ...args.map(String)]);
}

/** A script's cjson answer, or undefined when it is not one (an error). */
export function parseAnswer(r: unknown): Record<string, unknown> | undefined {
  if (typeof r !== "string") return undefined;
  try {
    const v = JSON.parse(r);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** Upstash's HMGET answer as a list, or undefined on an error. */
export function hmget(r: unknown, n: number): (string | null)[] | undefined {
  if (!Array.isArray(r) || r.length !== n) return undefined;
  return r.map((v) => (v === null || v === undefined || v === false ? null : String(v)));
}

/** A cjson list: an empty Lua table encodes as {} rather than []. */
export function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

// ── Requests and answers ───────────────────────────────────────────────────

const NO_STORE = { "Cache-Control": "no-store" };

export function boardJson(body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...extra } });
}

export const MAX_BODY = 2000;
export const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
export const LONE_SURROGATE = /\p{Cs}/u;

/** The body as text, at most 2,000 bytes. Never req.formData(): mictest allows that only in the founder clip tools. */
export async function readBody(req: Request): Promise<string | null> {
  if (Number(req.headers.get("content-length")) > MAX_BODY) return null;
  try {
    const raw = await req.text();
    return Buffer.byteLength(raw, "utf8") > MAX_BODY ? null : raw;
  } catch {
    return null;
  }
}

export type Gate =
  | { ok: true; secret: string; P: string; body: Record<string, unknown> }
  | { ok: false; res: NextResponse };

/**
 * Every JSON route's preamble, in this order: same origin; a body of at
 * most 2,000 bytes; the board live (except where deleting must always
 * work); a secret and a store; not paused (only start, claim, view, nick:
 * days keep counting and every deletion still happens while paused).
 */
export async function gateJson(req: Request, opts: { anyState?: boolean; pausable?: boolean }): Promise<Gate> {
  if (req.headers.get("origin") !== new URL(req.url).origin) return { ok: false, res: boardJson({ ok: false, error: "origin" }, 403) };
  const raw = await readBody(req);
  if (raw === null) return { ok: false, res: boardJson({ ok: false, error: "size" }, 413) };
  let body: Record<string, unknown>;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("shape");
    body = v as Record<string, unknown>;
  } catch {
    return { ok: false, res: boardJson({ ok: false, error: "json" }, 400) };
  }
  if (!opts.anyState && !boardLive()) return { ok: false, res: boardJson({ ok: false, off: true }, 503) };
  const secret = boardSecrets()[0];
  if (!secret || !kvConfigured()) return { ok: false, res: boardJson({ ok: false, off: true }, 503) };
  if (opts.pausable && process.env.BOARD_PAUSE === "1") return { ok: false, res: boardJson({ ok: false, paused: true }, 503) };
  return { ok: true, secret, P: boardPrefix(), body };
}

/**
 * A rate limit by the requester's address, hashed with the board's secret
 * (an IPv6 address counts by its /64): the bucket never holds the address.
 * True when the request must stop.
 */
export async function overLimit(req: Request, key: string, limit: number, secret: string): Promise<boolean> {
  return !!(await rateLimit(req, { key, limit, windowSec: 3600, hashKey: secret, v6prefix: true }));
}

export const RETRY = { ok: false, retry: true };

// ── Pages (confirm and remove; no script, no pixel) ────────────────────────

export const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

export function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

const STYLE =
  "body{margin:0;background:#fff6e9;color:#16384f;font:16px/1.55 -apple-system,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}" +
  ".card{background:#fff;border-radius:20px;padding:30px 24px;max-width:420px;margin:16px;box-shadow:0 4px 18px rgba(74,44,20,.08)}" +
  "h1{font-size:21px;line-height:1.3;margin:0 0 12px}p{margin:10px 0}.muted{color:#5d6f7f;font-size:14px}" +
  "button{border:0;border-radius:999px;background:#1d8a84;color:#fff;font-weight:800;font-size:16px;padding:14px 26px;margin:14px 0 4px;cursor:pointer}" +
  "a{color:#1d6f8a}";

/** A page with the board's CSP: inline styles only, forms post only here, never framed. */
export function boardPage(title: string, inner: string, status = 200): NextResponse {
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex"><title>Sona</title><style>${STYLE}</style></head>` +
    `<body><main class="card"><h1>${esc(title)}</h1>${inner}</main></body></html>`;
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": PAGE_CSP,
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      ...NO_STORE,
    },
  });
}

/** The same sentence the email and the Settings sheet use for what other families see. */
export const OTHERS_SEE =
  "The board shows a made-up nickname (like Brave Fox 42), a buddy picture and how many days each child practiced this month, to other families who turned it on. Never a name, age, photo or voice.";

export const PAGES = {
  off: () => boardPage("The Practice Board is off right now.", `<p class="muted">Nothing was changed.</p>`, 503),
  error: () => boardPage("Something went wrong on our side.", `<p>Nothing was changed. Please try again in a minute.</p>`, 503),
  limit: () => boardPage("Too many tries from here.", `<p>Please try again in an hour.</p>`, 429),
  expired: (status = 200) => boardPage("This link has run out.", `<p>Start again in Sona: Settings › Practice Board.</p>`, status),
  done: () => boardPage("Done!", `<p>Now finish on your child's phone: Settings › Practice Board › Finish.</p>`),
  confirm: (c: string, code: string, n: number) =>
    boardPage(
      "Put " + (n === 1 ? "your child" : n + " children") + " on Sona's Practice Board?",
      `<p>The code on the phone should be <strong>${esc(code)}</strong>.</p>` +
        `<p>${esc(OTHERS_SEE)}</p>` +
        `<form method="POST" action="/api/board/confirm"><input type="hidden" name="c" value="${esc(c)}"><button type="submit">Yes, turn it on</button></form>` +
        `<p class="muted">Not now? Just close this page.</p>` +
        `<p class="muted"><a href="/privacy.html">Privacy policy</a></p>`,
    ),
  removeAsk: (x: string) =>
    boardPage(
      "Take these children off Sona's Practice Board?",
      `<form method="POST" action="/api/board/remove"><input type="hidden" name="x" value="${esc(x)}"><button type="submit">Yes, delete them</button></form>` +
        `<p class="muted"><a href="/privacy.html">Privacy policy</a></p>`,
    ),
  removed: () => boardPage("Done. Those board entries are deleted.", `<p>You can turn the board on again any time in Settings.</p>`),
  nothing: (status = 200) => boardPage("There's nothing on the board for this link.", `<p class="muted">Nothing was changed.</p>`, status),
};

// ── The confirmation email ─────────────────────────────────────────────────

const FRAME = "font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:15px;color:#16384f;line-height:1.6;max-width:520px;";
const BUTTON = "display:inline-block;background:#1d8a84;color:#fff;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:12px;font-size:16px;";

/**
 * The one email that turns the board on (spec §9.15), through the repo's own
 * Resend call (`resendSend`, logBody off: Resend's refusal text can quote
 * the recipient, and the address must never reach a log). No child's name,
 * no tracking pixel, and no link but the confirm link, the remove link and
 * the privacy page. Without RESEND_API_KEY, on a developer's machine only,
 * the two links go to the server console (never the address, never a
 * response).
 */
export async function sendBoardConfirmEmail(
  to: string,
  m: { confirm: string; remove: string; code: string; n: number },
): Promise<{ sent: boolean }> {
  const who = m.n === 1 ? "a child" : m.n + " children";
  const keeps =
    "for each child, a random board number, the nickname, the buddy picture, your time zone, the date it was turned on, and which days counted this month. We used your address only to send this email; Sona keeps no copy of it (only a scrambled form for one day, to stop repeat emails).";
  const privacy = "https://speaksona.com/privacy.html";
  const r = await resendSend(
    {
      to,
      subject: "Confirm Sona's Practice Board (code " + m.code + ")",
      html:
        `<div style="${FRAME}">` +
        `<p>Hi,</p>` +
        `<p>Someone using Sona asked to put ${who} on Sona's Practice Board. The code on their screen is <strong>${esc(m.code)}</strong>.</p>` +
        `<p>${esc(OTHERS_SEE)}</p>` +
        `<p>If this was you, tap the button, then finish in Sona: Settings › Practice Board › Finish.</p>` +
        `<p><a href="${esc(m.confirm)}" style="${BUTTON}">Yes, turn it on</a></p>` +
        `<p>If it wasn't you, ignore this email and nothing happens. The link works for 2 days.</p>` +
        `<p><strong>What Sona's server keeps if you turn it on:</strong> ${esc(keeps)}</p>` +
        `<p><strong>You can turn it off at any time</strong> in Settings › Practice Board, or with this link, from any phone or computer: <a href="${esc(m.remove)}">Take them off the board</a></p>` +
        `<p style="color:#6b86a3;font-size:13px;margin-top:22px;">Privacy policy: <a href="${privacy}">${privacy}</a></p>` +
        `</div>`,
      text:
        "Hi,\n\n" +
        "Someone using Sona asked to put " + who + " on Sona's Practice Board. The code on their screen is " + m.code + ".\n\n" +
        OTHERS_SEE + "\n\n" +
        "If this was you, open this link, then finish in Sona: Settings › Practice Board › Finish.\n" + m.confirm + "\n\n" +
        "If it wasn't you, ignore this email and nothing happens. The link works for 2 days.\n\n" +
        "What Sona's server keeps if you turn it on: " + keeps + "\n\n" +
        "You can turn it off at any time in Settings › Practice Board, or with this link, from any phone or computer:\n" + m.remove + "\n\n" +
        "Privacy policy: " + privacy + "\n",
    },
    "board confirmation",
    false,
  );
  if (!r.configured && boardEnv() === "local") {
    console.log("[board] no RESEND_API_KEY: confirm " + m.confirm + " · remove " + m.remove);
    return { sent: true };
  }
  return { sent: r.sent };
}
