import { NextRequest, NextResponse } from "next/server";

/**
 * In-the-moment, per-game feedback — sent from the feedback bubble that appears
 * on each game's win screen during a pilot/SLP session (or in ?debug mode).
 *
 * It forwards each note to the founder's collector (FEEDBACK_WEBHOOK_URL ||
 * PILOT_WEBHOOK_URL || LEAD_WEBHOOK_URL) and, if a Vercel KV / Upstash store is
 * configured, appends it to a per-code list (feedback:<code>) for later review.
 * Both are best-effort: with nothing configured the app still works, you just
 * won't see the note come back yet.
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

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const text = String((body.text as string) || "").slice(0, 1000).trim();
  if (!text) return NextResponse.json({ ok: false, error: "Empty feedback." }, { status: 400 });

  const rec = {
    text,
    game: String((body.game as string) || "").slice(0, 80),
    sound: String((body.sound as string) || "").slice(0, 16),
    code: String((body.code as string) || "").slice(0, 48),
    childId: String((body.childId as string) || "").slice(0, 48),
    level: body.level ?? "",
    at: (body.at as string) || new Date().toISOString(),
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

  // Append to a per-code feedback list (best-effort), newest kept.
  try {
    const key = "feedback:" + (rec.code || "pilot");
    await kvCmd(["RPUSH", key, JSON.stringify(rec).slice(0, 4000)]);
    await kvCmd(["LTRIM", key, -500, -1]);
    await kvCmd(["EXPIRE", key, 60 * 60 * 24 * 180]); // ~6 months
  } catch {
    // list is best-effort
  }

  return NextResponse.json({ ok: true, captured });
}
