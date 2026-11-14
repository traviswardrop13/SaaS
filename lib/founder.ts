import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { clinicianRole, clinicianWorkSetting, kvCmd, kvConfigured, type ClinicianRole, type ClinicianWorkSetting } from "@/lib/slpAuth";
import { grandfathered, recordActive, accessKey, planKey, FREE_SELF_TERMS, type PlanRecord } from "@/lib/caseload";
import { isWorkEmail } from "@/lib/workEmail";

// lib/contacts SYNCED: every address Resend's contacts hold (not imported:
// lib/contacts reads this file for its backfill)
export const LIST_SYNCED = "resend:synced";

/**
 * What the founder-only routes share: the FOUNDER_KEY gate, and reading the
 * two lists of grown-ups Sona holds — the lead ledger and the clinician
 * accounts. One copy, so the leads page and the list's backfill can never
 * disagree about who is on them.
 */

/** True when `given` equals `want`, compared in constant time. */
export function sameSecret(given: string, want: string): boolean {
  const a = Buffer.from(given || "");
  const b = Buffer.from(want || "");
  return a.length === b.length && b.length > 0 && crypto.timingSafeEqual(a, b);
}

/**
 * FOUNDER_KEY alone: 12+ characters, compared in constant time and taken
 * from the x-founder-key header only (never ?key=), so it stays out of URLs,
 * browser history and server logs. The same on every deployment, previews
 * included. Returns a response to send back when the request may not
 * proceed, else null. For a route that needs no data store (the clip tools,
 * the daily job's manual run); founderGate adds the store check.
 */
export function founderKey(req: NextRequest): NextResponse | null {
  const need = process.env.FOUNDER_KEY || "";
  if (need.length < 12) {
    return NextResponse.json({ ok: false, error: "Set FOUNDER_KEY (12+ characters) in Vercel, then redeploy." }, { status: 503 });
  }
  if (!sameSecret(req.headers.get("x-founder-key") || "", need)) {
    return NextResponse.json({ ok: false, error: "Wrong key." }, { status: 401 });
  }
  return null;
}

/** founderKey, and a connected data store: for the founder pages' routes. */
export function founderGate(req: NextRequest): NextResponse | null {
  const denied = founderKey(req);
  if (denied) return denied;
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
  clinicianRole: ClinicianRole | "";
  workSetting: ClinicianWorkSetting | "";
  // The caseload plan (lib/caseload, 24 Sep 2026), for the founder's
  // clinicians table: whether the address is a work one, whether they asked
  // for their own Premium without one (and whether it was approved), and
  // how their caseload is covered.
  workEmail: "yes" | "no";
  accessRequested: string;           // ISO time of the first request, or ""
  approved: "yes" | "no";
  // "pro" / "pro trial": Sona Pro, the one plan on sale from 12 Nov 2026.
  caseload: "pro" | "pro trial" | "paid" | "grandfathered" | "none";
  // Their own Premium (29 Sep 2026): how it is on, if it is. Only a 24 to
  // 29 Sep account without a work email can still be approved by hand
  // (`canApprove`); everyone after that buys it.
  own: "pro" | "pro trial" | "paid" | "free" | "older plan" | "none";
  canApprove: "yes" | "no";
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
 * "paid" here is the plan mirrors as last written (slpplan, slpplan-self), not a fresh
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
        let mine: PlanRecord | null = null;
        try { mine = JSON.parse(String(await kvCmd(["GET", planKey(email, "self")]))) as PlanRecord | null; } catch { mine = null; }
        let pro: PlanRecord | null = null;
        try { pro = JSON.parse(String(await kvCmd(["GET", planKey(email, "pro")]))) as PlanRecord | null; } catch { pro = null; }
        const proOn: "pro" | "pro trial" | "" = recordActive(pro) ? (pro!.status === "trialing" ? "pro trial" : "pro") : "";
        // in Resend's contacts: lib/contacts SYNCED, which every add stamps
        // (an account's crmAt also counted the Kit years, so it is not read)
        let inList = false;
        try { inList = Number(await kvCmd(["SISMEMBER", LIST_SYNCED, email])) === 1; } catch { inList = false; }
        const earlier = a.terms === FREE_SELF_TERMS;
        const freeSelf = grandfathered(a) || (earlier && (isWorkEmail(email) || access.approved === "1"));
        out.push({
          email,
          name: String(a.name || ""),
          clinic: String(a.clinic || ""),
          clinicianRole: clinicianRole(a.clinicianRole),
          workSetting: clinicianWorkSetting(a.workSetting),
          createdAt: String(a.createdAt || ""),
          source: String(a.source || ""),
          inCrm: inList ? "yes" : "not yet",
          workEmail: isWorkEmail(email) ? "yes" : "no",
          accessRequested: access.requestedAt || "",
          approved: access.approved === "1" ? "yes" : "no",
          caseload: grandfathered(a) ? "grandfathered" : proOn || (recordActive(plan) ? "paid" : "none"),
          own: freeSelf ? "free" : proOn || (recordActive(mine) ? "paid" : recordActive(plan) && plan!.addon !== true ? "older plan" : "none"),
          canApprove: earlier && !isWorkEmail(email) && access.approved !== "1" ? "yes" : "no",
        });
      } catch { /* skip */ }
    }
    rounds++;
  } while (cursor !== "0" && rounds < 200 && out.length < 5000);
  out.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  return out;
}
