import { NextRequest, NextResponse } from "next/server";

/**
 * Founder dashboard feed — the applications from /founding joined with each
 * family's practice beacon (the pilot roster hash slp:ff-<id> that
 * sendProgress writes). Locked behind FOUNDER_KEY; counts only, never audio.
 */
export const runtime = "nodejs";

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

// Upstash HGETALL returns a flat [field, value, field, value] array.
function hashToObj(flat: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(flat)) {
    for (let i = 0; i + 1 < flat.length; i += 2) out[String(flat[i])] = String(flat[i + 1]);
  } else if (flat && typeof flat === "object") {
    for (const [k, v] of Object.entries(flat as Record<string, unknown>)) out[k] = String(v);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const need = process.env.FOUNDER_KEY;
  if (!need) return NextResponse.json({ ok: false, error: "Set FOUNDER_KEY in Vercel env to enable the dashboard." }, { status: 503 });
  const key = req.nextUrl.searchParams.get("key") || "";
  if (key !== need) return NextResponse.json({ ok: false, error: "Wrong key." }, { status: 401 });

  const ids = ((await kvCmd(["LRANGE", "ff:apps", 0, 199])) as string[] | undefined) || [];
  const apps: Record<string, unknown>[] = [];

  for (const id of ids) {
    let app: Record<string, unknown> = { id };
    try {
      const raw = (await kvCmd(["GET", "ff:app:" + id])) as string | undefined;
      if (raw) app = JSON.parse(raw);
    } catch {
      // keep the id-only stub
    }
    const kids = hashToObj(await kvCmd(["HGETALL", "slp:ff-" + id]));
    const children = Object.values(kids).map((s) => {
      try {
        const r = JSON.parse(s);
        // per-sound accuracy summary only — keep the payload light
        const acc: Record<string, { a: number; p: number }> = {};
        for (const [snd, o] of Object.entries((r.outcomes || {}) as Record<string, { attempts?: number; passes?: number }>)) {
          acc[snd] = { a: o.attempts || 0, p: o.passes || 0 };
        }
        return { childId: r.childId, child: r.child || "", sessions: r.sessions || 0, streak: r.streak || 0, at: r.at || "", acc };
      } catch {
        return null;
      }
    }).filter(Boolean);
    apps.push({ ...app, children });
  }

  return NextResponse.json({ ok: true, apps });
}
