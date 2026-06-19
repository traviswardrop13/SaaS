import { NextRequest, NextResponse } from "next/server";

/**
 * Pilot outcome capture — receives a child's (consented) practice progress and:
 *   1) forwards it to the founder's collector (PILOT_WEBHOOK_URL || LEAD_WEBHOOK_URL), and
 *   2) upserts it into a per-SLP roster store (Vercel KV / Upstash) so the SLP
 *      master dashboard can show each of their families' progress.
 *
 * Both are best-effort and degrade gracefully: with no webhook and no KV store
 * configured, the app still works — you just won't see the data come back yet.
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

  const hook = process.env.PILOT_WEBHOOK_URL || process.env.LEAD_WEBHOOK_URL;
  let captured = false;
  try {
    if (hook) {
      await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, kind: "pilot" }),
      });
      captured = true;
    }
  } catch {
    // never fail the app on a capture hiccup
  }

  // Upsert into the SLP roster (keyed slp:<code> → { childId: record }).
  try {
    const b = body as Record<string, any>;
    const code = typeof b.code === "string" ? b.code.slice(0, 48) : "";
    const childId = typeof b.childId === "string" ? b.childId.slice(0, 48) : "";
    if (code && childId) {
      const rec = JSON.stringify({
        childId,
        child: b.child || "",
        age: b.age || "",
        focus: b.focus || "",
        outcomes: b.outcomes || {},
        sessions: b.sessions || 0,
        streak: b.streak || 0,
        at: b.at || new Date().toISOString(),
      }).slice(0, 16000);
      await kvCmd(["HSET", "slp:" + code, childId, rec]);
      await kvCmd(["EXPIRE", "slp:" + code, 60 * 60 * 24 * 150]); // ~5 months
    }
  } catch {
    // roster is best-effort
  }

  return NextResponse.json({ ok: true, captured });
}
