import { NextResponse } from "next/server";
import { kvCmd, kvConfigured } from "@/lib/slpAuth";

/**
 * Per-IP rate limiting for the vendor-calling API routes (Anthropic / ElevenLabs
 * / SpeechAce). Without this, those routes are unauthenticated and anyone on the
 * internet can loop them to run up the bill.
 *
 * Uses KV (INCR + EXPIRE) when configured; otherwise a per-instance in-memory
 * fallback (weaker on serverless, but still caps a single hammering client on a
 * warm instance). Limits are generous so a real practice session — which fires
 * many tts/score calls a minute — never trips them; only scripted abuse does.
 */

const mem = new Map<string, { n: number; reset: number }>();

function clientIp(req: Request): string {
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
 * Returns null if the request is allowed, or a 429 NextResponse if it should be
 * blocked. Call at the very top of a route's POST handler:
 *   const limited = await rateLimit(req, { key: "story", limit: 40, windowSec: 60 });
 *   if (limited) return limited;
 */
export async function rateLimit(
  req: Request,
  opts: { key: string; limit: number; windowSec: number },
): Promise<NextResponse | null> {
  const bucket = `rl:${opts.key}:${clientIp(req)}`;
  try {
    if (kvConfigured()) {
      const n = await kvCmd(["INCR", bucket]);
      if (n === 1) await kvCmd(["EXPIRE", bucket, opts.windowSec]);
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
