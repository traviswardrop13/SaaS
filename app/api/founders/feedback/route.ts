import { NextRequest, NextResponse } from "next/server";
import { kvCmd } from "@/lib/slpAuth";
import { founderGate } from "@/lib/founder";

/**
 * FOUNDER VIEW OF EVERY MESSAGE — the "Messages" section of /leads.html.
 *
 * Until this route, nothing showed Travis a parent's or a clinician's
 * feedback or call request except Slack (if its webhook was set, and live
 * delivery was never exercised). The store kept them where no page read them.
 *
 *  - `family`: /api/family/feedback, the parents' "Talk to us" page — one
 *    list, `family-feedback`, newest first, up to 300.
 *  - `slp`: /api/slp/feedback, the dashboard's "Talk to Rachel" — one list
 *    per clinician (`slp-feedback:<code or email>`), walked with a bounded
 *    SCAN, the latest 100 of each, merged newest first, up to 300.
 *
 * Behind FOUNDER_KEY (lib/founder), from a header. Every field is returned as
 * text for the page to escape; nothing here is rendered as markup.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = 300;
type Row = Record<string, unknown>;

function parse(raw: unknown): Row | null {
  try {
    const v = JSON.parse(String(raw));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : null;
  } catch { return null; }
}
const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const newestFirst = (a: Row, b: Row) => str(b.at).localeCompare(str(a.at));

async function readFamily(): Promise<Row[]> {
  const raw = ((await kvCmd(["LRANGE", "family-feedback", -LIMIT, -1])) as unknown[] | undefined) || [];
  const out: Row[] = [];
  for (const s of raw) {
    const r = parse(s);
    if (!r) continue;
    out.push({
      kind: r.kind === "call" ? "call" : "feedback",
      chips: Array.isArray(r.chips) ? r.chips.filter((c) => typeof c === "string").slice(0, 6) : [],
      text: str(r.text),
      recommend: str(r.recommend, 20),
      replyEmail: str(r.replyEmail, 254),
      prefer: str(r.prefer, 10),
      availability: str(r.availability, 240),
      timezone: str(r.timezone, 80),
      app: str(r.app, 10),
      at: str(r.at, 40),
    });
  }
  return out.sort(newestFirst).slice(0, LIMIT);
}

async function readSlp(): Promise<Row[]> {
  const keys: string[] = [];
  let cursor = "0";
  let rounds = 0;
  do {
    const res = (await kvCmd(["SCAN", cursor, "MATCH", "slp-feedback:*", "COUNT", 1000])) as [string, string[]] | undefined;
    if (!res) break;
    cursor = String(res[0]);
    for (const k of res[1] || []) if (keys.length < 200 && !keys.includes(k)) keys.push(k);
    rounds++;
  } while (cursor !== "0" && rounds < 200 && keys.length < 200);
  const out: Row[] = [];
  for (const key of keys) {
    const raw = ((await kvCmd(["LRANGE", key, -100, -1])) as unknown[] | undefined) || [];
    for (const s of raw) {
      const r = parse(s);
      if (!r) continue;
      out.push({
        kind: r.kind === "call" ? "call" : "feedback",
        text: str(r.text),
        category: str(r.category, 40),
        availability: str(r.availability, 240),
        timezone: str(r.timezone, 80),
        replyEmail: str(r.replyEmail, 254),
        slpName: str(r.slpName, 120),
        slpCode: str(r.slpCode, 48),
        at: str(r.at, 40),
      });
    }
  }
  return out.sort(newestFirst).slice(0, LIMIT);
}

export async function GET(req: NextRequest) {
  const denied = founderGate(req);
  if (denied) return denied;
  const [family, slp] = await Promise.all([readFamily(), readSlp()]);
  return NextResponse.json({ ok: true, family, slp }, { headers: { "Cache-Control": "no-store" } });
}
