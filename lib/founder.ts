import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { kvCmd, kvConfigured } from "@/lib/slpAuth";
import { grandfathered, recordActive, accessKey, planKey, type PlanRecord } from "@/lib/caseload";
import { isWorkEmail } from "@/lib/workEmail";

/**
 * What the founder-only routes share: the FOUNDER_KEY gate, and reading the
 * two lists of grown-ups Sona holds — the lead ledger and the clinician
 * accounts. One copy, so the leads page and the Kit backfill can never
 * disagree about who is on them.
 */

/**
 * FOUNDER_KEY, 12+ characters, compared in constant time and taken from a
 * header so it stays out of URLs, browser history and server logs. Returns a
 * response to send back when the request may not proceed, else null.
 */
export function founderGate(req: NextRequest): NextResponse | null {
  const need = process.env.FOUNDER_KEY || "";
  if (need.length < 12) {
    return NextResponse.json({ ok: false, error: "Set FOUNDER_KEY (12+ characters) in Vercel, then redeploy." }, { status: 503 });
  }
  const given = Buffer.from(req.headers.get("x-founder-key") || "");
  const want = Buffer.from(need);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return NextResponse.json({ ok: false, error: "Wrong key." }, { status: 401 });
  }
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "No data store is connected." }, { status: 503 });
  return null;
}

/** Every lead /api/lead has kept (since 24 Sep 2026), newest first. */
export async function readLeads(): Promise<Record<string, string>[]> {
  const raw = ((await kvCmd(["LRANGE", "leads:all", 0, 9999])) as string[] | undefined) || [];
  const out: Record<string, string>[] = [];
  for (const s of raw) { try { out.push(JSON.parse(s)); } catch { /* skip a bad row */ } }
  return out;
}

export type Clinician = {
  email: string; name: string; clinic: string; createdAt: string; source: string; inCrm: string;
  // The caseload plan (lib/caseload, 24 Sep 2026), for the founder's
  // clinicians table: whether the address is a work one, whether they asked
  // for their own Premium without one (and whether it was approved), and
  // how their caseload is covered.
  workEmail: "yes" | "no";
  accessRequested: string;           // ISO time of the first request, or ""
  approved: "yes" | "no";
  caseload: "paid" | "grandfathered" | "none";
};

/** An Upstash HGETALL answer — a flat [field, value, …] list — as an object. */
function hashObj(flat: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(flat)) for (let i = 0; i + 1 < flat.length; i += 2) out[String(flat[i])] = String(flat[i + 1]);
  return out;
}

/**
 * Every clinician account, however it was created. SCAN, not KEYS, so a large
 * store is walked in pages instead of blocked; capped at 5000.
 *
 * "paid" here is the plan mirror as last written (slpplan), not a fresh
 * Stripe call per clinician: this is a list of everyone, and the mirror is
 * at most ten minutes behind for anyone whose families are checking in.
 */
export async function readClinicians(): Promise<Clinician[]> {
  const out: Clinician[] = [];
  let cursor = "0";
  let rounds = 0;
  do {
    const res = (await kvCmd(["SCAN", cursor, "MATCH", "slpacct:*", "COUNT", 200])) as [string, string[]] | undefined;
    if (!res) break;
    cursor = String(res[0]);
    for (const key of res[1] || []) {
      if (out.length >= 5000) break;
      try {
        const a = JSON.parse(String(await kvCmd(["GET", key])));
        const email = String(a.email || key.slice("slpacct:".length));
        const access = hashObj(await kvCmd(["HGETALL", accessKey(email)]));
        let plan: PlanRecord | null = null;
        try { plan = JSON.parse(String(await kvCmd(["GET", planKey(email)]))) as PlanRecord | null; } catch { plan = null; }
        out.push({
          email,
          name: String(a.name || ""),
          clinic: String(a.clinic || ""),
          createdAt: String(a.createdAt || ""),
          source: String(a.source || ""),
          inCrm: a.crmAt ? "yes" : "not yet",
          workEmail: isWorkEmail(email) ? "yes" : "no",
          accessRequested: access.requestedAt || "",
          approved: access.approved === "1" ? "yes" : "no",
          caseload: grandfathered(a) ? "grandfathered" : recordActive(plan) ? "paid" : "none",
        });
      } catch { /* skip */ }
    }
    rounds++;
  } while (cursor !== "0" && rounds < 200 && out.length < 5000);
  out.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  return out;
}
