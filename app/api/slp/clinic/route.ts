import { NextRequest, NextResponse } from "next/server";
import { readSession, kvConfigured, sendClinicInviteEmail } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { readAccount } from "@/lib/roster";
import { planStatus, readAcct, StoreUnavailable, CLINIC_PLAN, CLINIC_SEATS } from "@/lib/caseload";
import { readMembers, seatsUsed, addMember, removeMember, leaveClinic, memberTotals } from "@/lib/clinic";

/**
 * THE CLINIC (17 Nov 2026) — lib/clinic.ts says what the owner may see and why.
 *
 *   GET  /api/slp/clinic → { role: "owner", seats, used, rows[] }  (owner of a live Clinic plan)
 *                          { role: "member", owner, ownerName, clinicName }
 *                          { role: "none" }
 *   POST { action: "add", email }    → owner: add a clinician (emails them a link)
 *   POST { action: "remove", email } → owner: take a seat back
 *   POST { action: "leave" }         → member: leave the clinic
 *
 * Signed-in clinicians only, and the email acted on is the SESSION's. Every
 * row the owner gets is two counts and an address the owner typed; no child
 * appears in any answer from this route.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const down = () => NextResponse.json({ ok: false, error: "Couldn't reach your clinic just now — try again in a moment." }, { status: 503, headers: NO_STORE });

async function ownerStatus(email: string) {
  const acct = await readAcct(email);
  const plan = await planStatus(email, { acct });
  return { acct, plan, isOwner: plan.source === "paid" && plan.plan === CLINIC_PLAN };
}

export async function GET(req: NextRequest) {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(req, { key: "slpclinic-read", limit: 120, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  try {
    const { plan, isOwner } = await ownerStatus(s.email);
    if (isOwner) {
      const members = await readMembers(s.email);
      const people = [s.email, ...members.filter((m) => m.state === "active").map((m) => m.email)];
      const totals = await Promise.all(people.map((e) => memberTotals(e)));
      const names = await Promise.all(people.map((e) => readAccount(e).then((a) => a.name).catch(() => "")));
      const byEmail = new Map(people.map((e, i) => [e, { ...totals[i], name: names[i] }]));
      const rows = [
        { email: s.email, you: true, state: "active", ...byEmail.get(s.email)! },
        ...members.map((m) => m.state === "active"
          ? { email: m.email, state: m.state, addedAt: m.addedAt, ...byEmail.get(m.email)! }
          : { email: m.email, state: m.state, addedAt: m.addedAt, name: "", families: null, practicedWeek: null, linkReady: false }),
      ];
      return NextResponse.json({ ok: true, role: "owner", seats: CLINIC_SEATS, used: seatsUsed(members), rows }, { headers: NO_STORE });
    }
    if (plan.source === "clinic" && plan.owner) {
      const o = await readAccount(plan.owner);
      return NextResponse.json({ ok: true, role: "member", owner: plan.owner, ownerName: o.name, clinicName: o.clinic }, { headers: NO_STORE });
    }
    return NextResponse.json({ ok: true, role: "none" }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof StoreUnavailable) return down();
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(req, { key: "slpclinic", limit: 60, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  let body: { action?: string; email?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  const action = String(body.action || "");
  const email = String(body.email || "").trim().toLowerCase().slice(0, 120);

  try {
    if (action === "leave") {
      const owner = await leaveClinic(s.email);
      return NextResponse.json({ ok: true, left: !!owner });
    }
    if (action !== "add" && action !== "remove") return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });

    const { acct, isOwner } = await ownerStatus(s.email);
    if (!isOwner) return NextResponse.json({ ok: false, error: "Adding clinicians needs the Clinic plan." }, { status: 403 });

    if (action === "remove") {
      const removed = await removeMember(s.email, email);
      return NextResponse.json({ ok: true, removed });
    }

    const r = await addMember(s.email, email);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const link = origin + "/api/slp/clinic/accept?token=" + encodeURIComponent(r.token);
    const mail = await sendClinicInviteEmail(email, link, String((acct && acct.name) || ""), String((acct && acct.clinic) || ""));
    return NextResponse.json({ ok: true, sent: mail.sent, resent: r.resent, devLink: mail.devLink });
  } catch (e) {
    if (e instanceof StoreUnavailable) return down();
    throw e;
  }
}
