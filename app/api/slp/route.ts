import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/slpAuth";

/**
 * SLP master roster — returns each family's latest progress for the SIGNED-IN
 * SLP's own code (slp:<code> → { childId: record }, written by /api/pilot).
 *
 * The roster holds children's names, ages and progress, so the code is derived
 * from the authenticated session — NOT from a query param. The clinic slug is a
 * public share slug (printed on every family link), so trusting ?code= let
 * anyone holding a link read the whole roster.
 *
 * Degrades gracefully: if no KV store is configured, returns configured:false so
 * the SLP page can still show the share link + handout.
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
  // roster read requires the SLP's own session; the code comes from the
  // authenticated account, never the query string.
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  if (!configured()) return NextResponse.json({ ok: true, configured: false, kids: [] });
  let code = "";
  try {
    const raw = await kvCmd(["GET", "slpacct:" + s.email]);
    if (raw) code = (JSON.parse(String(raw)).code as string) || "";
  } catch {
    code = "";
  }
  if (!code) return NextResponse.json({ ok: true, configured: true, kids: [] });

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
