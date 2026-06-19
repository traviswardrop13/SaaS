import { NextRequest, NextResponse } from "next/server";

/**
 * SLP master roster — returns each family's latest progress for an SLP's code,
 * read from the KV store that /api/pilot writes to (slp:<code> → { childId: record }).
 *
 * Degrades gracefully: if no KV store is configured, returns configured:false so
 * the SLP page can still show the share link + handout (the live roster lights up
 * once a Vercel KV store is added to the project).
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
function configured() {
  return !!(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
    (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

export async function GET(req: NextRequest) {
  const code = (new URL(req.url).searchParams.get("code") || "").trim().slice(0, 48);
  if (!code) return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });
  if (!configured()) return NextResponse.json({ ok: true, configured: false, kids: [] });

  const flat = await kvCmd(["HGETALL", "slp:" + code]);
  const kids: { at?: string }[] = [];
  if (Array.isArray(flat)) {
    for (let i = 0; i < flat.length; i += 2) {
      try {
        kids.push(JSON.parse(String(flat[i + 1])));
      } catch {
        // skip malformed
      }
    }
  }
  kids.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  return NextResponse.json({ ok: true, configured: true, kids });
}
