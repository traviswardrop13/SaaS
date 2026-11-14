import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { kvCmd, kvConfigured } from "@/lib/slpAuth";

/**
 * Per-IP rate limiting for the vendor-calling API routes (Anthropic / ElevenLabs
 * ). Without this, those routes are unauthenticated and anyone on the
 * internet can loop them to run up the bill.
 *
 * Uses KV (INCR + EXPIRE, in one script) when configured; otherwise a
 * per-instance in-memory fallback (weaker on serverless, but still caps a
 * single hammering client on a warm instance). Limits are generous so a real practice session — which fires
 * many tts/score calls a minute — never trips them; only scripted abuse does.
 */

const mem = new Map<string, { n: number; reset: number }>();

/**
 * The count and its time limit in one atomic call. They were two calls, INCR
 * then EXPIRE on the first hit, and kvCmd swallows a failed call: a lost
 * EXPIRE (or a lost INCR reply) left the bucket with no time limit, so it held
 * the address for good (privacy.html says "for up to an hour") and, once at its
 * limit, refused that address on that route for good. The TTL check also
 * mends any bucket already left without one. (Final review, 12 Oct 2026.)
 */
const RL_SCRIPT = `-- rl:incr
local n = redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n
`;

export function clientIp(req: Request): string {
  // x-real-ip is set by Vercel's edge from the true socket peer and cannot be
  // spoofed by the client; the LEFTMOST x-forwarded-for entry is client-
  // supplied and trivially rotated to dodge a per-IP bucket. Prefer x-real-ip;
  // fall back to the RIGHTMOST XFF hop (the closest trusted proxy), never the
  // leftmost.
  const real = (req.headers.get("x-real-ip") || "").trim();
  if (real) return real;
  const fwd = (req.headers.get("x-forwarded-for") || "").split(",").map((s) => s.trim()).filter(Boolean);
  return fwd.length ? fwd[fwd.length - 1] : "anon";
}

/**
 * An IPv6 address's /64 (the first four groups), so one client cannot dodge
 * its bucket by rotating through the addresses of its own network: a home or
 * phone connection is handed a whole /64. An IPv4 address, an IPv4-mapped
 * IPv6 address ("::ffff:1.2.3.4") and anything unreadable come back as they
 * are. (Practice Board, 11 Oct 2026.)
 */
export function ipBucket(ip: string): string {
  const a = String(ip || "").trim().replace(/^\[|\]$/g, "").replace(/%.*$/, "").toLowerCase();
  if (!a.includes(":")) return a;
  const mapped = a.match(/^(?:0*:)*:?ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  if (/\d+\.\d+\.\d+\.\d+$/.test(a)) return a; // another embedded-IPv4 form: leave it whole
  const halves = a.split("::");
  if (halves.length > 2) return a;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return a;
  const groups = [...head, ...Array(fill).fill("0"), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return a;
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

/**
 * Returns null if the request is allowed, or a 429 NextResponse if it should be
 * blocked. Call at the very top of a route's POST handler:
 *   const limited = await rateLimit(req, { key: "story", limit: 40, windowSec: 60 });
 *   if (limited) return limited;
 *
 * Two additive options (Practice Board, 11 Oct 2026; every existing caller is
 * unchanged):
 *  - `v6prefix`: an IPv6 address counts by its /64 (`ipBucket`).
 *  - `hashKey`: the bucket holds `h:` and the first 16 hex of an HMAC of the
 *    address under that key, never the address itself. The board passes its
 *    own secret, and calls this only after checking one is set, so no bucket
 *    is ever hashed with a public string.
 */
export async function rateLimit(
  req: Request,
  opts: { key: string; limit: number; windowSec: number; hashKey?: string; v6prefix?: boolean },
): Promise<NextResponse | null> {
  const ip = opts.v6prefix ? ipBucket(clientIp(req)) : clientIp(req);
  const who = opts.hashKey ? "h:" + crypto.createHmac("sha256", opts.hashKey).update(ip).digest("hex").slice(0, 16) : ip;
  const bucket = `rl:${opts.key}:${who}`;
  try {
    if (kvConfigured()) {
      const n = await kvCmd(["EVAL", RL_SCRIPT, 1, bucket, opts.windowSec]);
      if (typeof n === "number" && n > opts.limit) return tooMany(opts.windowSec);
      return null;
    }
  } catch {
    // KV hiccup: fall through to the in-memory limiter rather than failing open hard.
  }
  const now = Date.now();
  const e = mem.get(bucket);
  if (!e || now > e.reset) {
    mem.set(bucket, { n: 1, reset: now + opts.windowSec * 1000 });
    if (mem.size > 5000) for (const [k, v] of mem) if (now > v.reset) mem.delete(k);
    return null;
  }
  e.n++;
  return e.n > opts.limit ? tooMany(opts.windowSec) : null;
}

function tooMany(windowSec: number): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Too many requests — please slow down." },
    { status: 429, headers: { "Retry-After": String(windowSec) } },
  );
}

/**
 * A spending budget: a count that grows by `amount` a call and refuses once it
 * would pass `cap` inside `windowSec` (TTSBUDGET1, 14 Nov 2026: Echo's voice
 * characters, per IP an hour and for everyone a day). Answers true when the
 * amount was charged, false when it would pass the cap. A refusal charges
 * NOTHING: the check and the charge are one script, so two requests at once
 * cannot both slip under the cap, and a refused request never eats into what
 * is left. Its own marker ('-- rl:spend'), so the suites that emulate
 * '-- rl:incr' are untouched.
 *
 * With no KV store, or one that does not answer, it counts in this instance's
 * memory, as rateLimit does: open across instances, never closed, because a
 * closed budget would put every family on the phone's robot voice whenever
 * the store blinks.
 */
export const RL_SPEND_SCRIPT = `-- rl:spend
local cur = tonumber(redis.call('GET', KEYS[1]) or '0') or 0
local amt = tonumber(ARGV[1])
if cur + amt > tonumber(ARGV[2]) then return -1 end
local n = redis.call('INCRBY', KEYS[1], amt)
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[3]) end
return n
`;
const spent = new Map<string, { n: number; reset: number }>();

export async function spendBudget(key: string, amount: number, cap: number, windowSec: number): Promise<boolean> {
  const amt = Math.max(0, Math.ceil(Number(amount) || 0));
  try {
    if (kvConfigured()) {
      const n = await kvCmd(["EVAL", RL_SPEND_SCRIPT, 1, key, amt, cap, windowSec]);
      if (typeof n === "number") return n >= 0;
    }
  } catch {
    // KV hiccup: count in memory instead.
  }
  const now = Date.now();
  let e = spent.get(key);
  if (!e || now > e.reset) {
    e = { n: 0, reset: now + windowSec * 1000 };
    spent.set(key, e);
    if (spent.size > 5000) for (const [k, v] of spent) if (now > v.reset) spent.delete(k);
  }
  if (e.n + amt > cap) return false;
  e.n += amt;
  return true;
}
