import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { founderGate } from "@/lib/founder";

/**
 * In-the-moment, per-game feedback — sent from the feedback bubble that appears
 * on each game's win screen during a pilot/SLP session (or in ?debug mode).
 *
 * Its live caller is Home's founding-family pulse (today.html, src "pulse");
 * the parked story page's feedback card is the other.
 *
 * It forwards each note to the founder's collector (FEEDBACK_WEBHOOK_URL ||
 * PILOT_WEBHOOK_URL || LEAD_WEBHOOK_URL) and keeps survey and pulse answers in
 * one capped list (fb:beta) that GET reads. Both are best-effort.
 *
 * Hardened 14 Nov 2026 (server.md B8): same-origin only (a missing Origin is
 * refused too), 10 an hour per IP, an 8 KB body, the record built field by
 * field with no child id, and no per-code list (anyone could make unlimited
 * feedback:<anything> lists, and nothing read them). GET takes the founder
 * key from the x-founder-key header only, compared in constant time.
 */
export const runtime = "nodejs";

// Tiny KV over REST (Vercel KV / Upstash) — no SDK. undefined if not configured.
async function kvCmd(cmd: (string | number)[]): Promise<unknown> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) return undefined;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    if (!r.ok) return undefined;
    const j = (await r.json()) as { result?: unknown };
    return j.result;
  } catch {
    return undefined;
  }
}

const MAX_BODY = 8 * 1024;

export async function POST(req: NextRequest) {
  // A browser always sends Origin on a POST, so a missing one is a script.
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }
  const rl = await rateLimit(req, { key: "feedback", limit: 10, windowSec: 3600, v6prefix: true });
  if (rl) return rl;

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return NextResponse.json({ ok: false, error: "Too long." }, { status: 413 });
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const str = (v: unknown, n: number) => (typeof v === "string" ? v : "").slice(0, n);
  const text = str(body.text, 1000).trim();
  if (!text) return NextResponse.json({ ok: false, error: "Empty feedback." }, { status: 400 });

  // Field by field, nothing else: never a child id.
  const at = str(body.at, 40);
  const rec = {
    text,
    q: str(body.q, 80), // survey/pulse question id
    src: str(body.src, 24), // "onboarding" | "pulse" | ""
    game: str(body.game, 80),
    sound: str(body.sound, 16),
    code: str(body.code, 48),
    level: typeof body.level === "number" && Number.isFinite(body.level) ? body.level : "",
    at: /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(at) ? at : new Date().toISOString(),
  };

  const hook =
    process.env.FEEDBACK_WEBHOOK_URL ||
    process.env.PILOT_WEBHOOK_URL ||
    process.env.LEAD_WEBHOOK_URL;
  let captured = false;
  try {
    if (hook) {
      await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rec, kind: "game-feedback" }),
      });
      captured = true;
    }
  } catch {
    // never fail the app on a capture hiccup
  }

  // Beta survey/pulse answers land in ONE capped list so the founder can read
  // every early-adopter signal in a single place.
  try {
    if (rec.src === "onboarding" || rec.src === "pulse") {
      await kvCmd(["LPUSH", "fb:beta", JSON.stringify(rec).slice(0, 4000)]);
      await kvCmd(["LTRIM", "fb:beta", 0, 1999]);
    }
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, captured });
}

// Founder-only read: newest beta answers (x-founder-key header, [?n=200])
export async function GET(req: NextRequest) {
  const denied = founderGate(req);
  if (denied) return denied;
  const n = Math.min(500, Math.max(1, parseInt(req.nextUrl.searchParams.get("n") || "200", 10) || 200));
  const raw = (await kvCmd(["LRANGE", "fb:beta", 0, n - 1])) as string[] | undefined;
  const items = (raw || [])
    .map((s) => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return NextResponse.json({ ok: true, items });
}
