import { NextRequest, NextResponse } from "next/server";
import { kvCmd } from "@/lib/slpAuth";
import { founderGate, readLeads, readClinicians } from "@/lib/founder";
import { kitConfigured, kitSubscribe, kitTagFor } from "@/lib/kit";

/**
 * ONE-TIME CATCH-UP: everyone Sona already holds, into Kit.
 *
 * GoHighLevel was deleted on 24 Sep 2026, so the clinicians who signed up
 * before Kit existed — and the leads the ledger kept — are on no list at all.
 * /leads.html drives this in small batches: each call handles BATCH people and
 * says where to continue, because Kit allows about 120 requests a minute and
 * each person costs up to three, and because a serverless function should not
 * run for minutes. Safe to run again: Kit treats a repeat as an update.
 *
 * Clinicians go with their own first name and the sona-slp tag, and their
 * account is stamped (crmAt) once Kit has them, so their next sign-in does not
 * send them again. Everyone else goes with no name at all: sona-other if they
 * answered "Other" on the landing page (25 Sep 2026), else sona-parent. Kit
 * tags only ever add, so without that case a re-run would have stuck a
 * parent tag on everyone who said "Other".
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BATCH = 5;

type Person = { email: string; firstName: string; role: "slp" | "parent" | "other"; account: boolean };

async function everyone(): Promise<Person[]> {
  const byEmail = new Map<string, Person>();
  for (const l of await readLeads()) {
    const email = String(l.email || "").trim().toLowerCase();
    if (!email || byEmail.has(email)) continue;
    const slp = l.role === "slp";
    byEmail.set(email, { email, firstName: slp ? String(l.first_name || "") : "", role: slp ? "slp" : l.role === "other" ? "other" : "parent", account: false });
  }
  // An account wins: whoever holds one is a clinician, with their own name.
  for (const c of await readClinicians()) {
    const email = c.email.trim().toLowerCase();
    if (!email) continue;
    byEmail.set(email, { email, firstName: c.name, role: "slp", account: true });
  }
  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
}

export async function POST(req: NextRequest) {
  const denied = founderGate(req);
  if (denied) return denied;
  if (!kitConfigured()) {
    return NextResponse.json({ ok: false, error: "Set KIT_API_KEY in Vercel, then redeploy." }, { status: 503 });
  }
  let offset = 0;
  try { offset = Math.max(0, Math.floor(Number((await req.json()).offset) || 0)); } catch { offset = 0; }

  const people = await everyone();
  const results: { email: string; role: string; result: string }[] = [];
  let next = offset;
  for (const p of people.slice(offset, offset + BATCH)) {
    const r = await kitSubscribe({ email: p.email, firstName: p.role === "slp" ? p.firstName : "", tag: kitTagFor(p.role) });
    if (r.status === 429) {
      // Kit's rate limit: stop here and let the page wait, rather than
      // burning through the rest of the batch into refusals.
      return NextResponse.json({ ok: true, total: people.length, next, done: false, retryAfter: 60, results });
    }
    results.push({ email: p.email, role: p.role, result: r.ok ? r.detail : "failed (" + r.detail + ")" });
    if (r.ok && p.account) {
      try {
        const key = "slpacct:" + p.email;
        const acct = JSON.parse(String(await kvCmd(["GET", key])));
        acct.crmAt = new Date().toISOString();
        await kvCmd(["SET", key, JSON.stringify(acct)]);
      } catch { /* the stamp is a convenience; Kit already has them */ }
    }
    next++;
  }
  return NextResponse.json({ ok: true, total: people.length, next, done: next >= people.length, results });
}
