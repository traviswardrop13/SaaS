import { NextRequest, NextResponse } from "next/server";
import { readSession, liveSession, kvConfigured } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { readAccount } from "@/lib/roster";
import { clinicStatus, bumpDaily, StoreUnavailable, CLINIC_SEATS, CLINIC_NAME } from "@/lib/caseload";
import {
  addMember, removeMember, leaveTeam, ownerView, viewerToday, sendTeamInviteEmail, isEmail,
} from "@/lib/team";

/**
 * SONA CLINIC'S TEAM (17 Nov 2026; lib/team says what the owner may see, and
 * why it is two numbers per clinician and never a child).
 *
 *   GET  /api/slp/team[?today=YYYY-MM-DD]
 *        → owner:  { ok, role: "owner", active, seats, used, rows: [{ email, name, state,
 *                    children, practicedWeek, linkReady, you? }] }   (owner first, then by name)
 *        → member: { ok, role: "member", owner, ownerName, practiceName }
 *        → else:   { ok, role: null }
 *   POST { action: "add", email }    → owner, Clinic plan live: add a clinician, email them a link
 *                                      → { ok, sent, resent, devLink? }
 *   POST { action: "remove", email } → owner: take a seat back. Always works, plan or no plan.
 *   POST { action: "leave" }         → member: leave the clinic.
 *
 * Signed-in clinicians only; the email acted FOR is the SESSION's, never the
 * body's. `?today` is the viewer's own date, so "practiced this week" matches
 * each clinician's own Today page; the server believes it within a day.
 * Reading the view writes nothing. Not behind the dashboard lock: a removal
 * must always work, and a member reads who added them even while locked.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const down = () => NextResponse.json({ ok: false, error: "Couldn't reach your clinic just now. Try again in a moment." }, { status: 503, headers: NO_STORE });

export async function GET(req: NextRequest) {
  const s = await liveSession(readSession(req));
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(req, { key: "slpteam-read", limit: 120, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  try {
    const st = await clinicStatus(s.email);
    if (st.role === "owner") {
      const today = viewerToday(new URL(req.url).searchParams.get("today"));
      const view = await ownerView(s.email, st.active, today);
      return NextResponse.json({ ok: true, role: "owner", active: st.active, seats: CLINIC_SEATS, used: view.used, rows: view.rows }, { headers: NO_STORE });
    }
    if (st.role === "member") {
      const o = await readAccount(st.owner);
      return NextResponse.json({
        ok: true, role: "member", owner: st.owner, ownerName: String(o.name || "").slice(0, 80), practiceName: String(o.clinic || "").slice(0, 80),
      }, { headers: NO_STORE });
    }
    return NextResponse.json({ ok: true, role: null }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof StoreUnavailable) return down();
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  // Sona's own page only (the session cookie is SameSite=Lax already; this
  // also refuses a script on another site that holds one).
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) return NextResponse.json({ ok: false, error: "Use your Sona dashboard for this." }, { status: 403 });
  const s = await liveSession(readSession(req));
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  const rl = await rateLimit(req, { key: "slpteam", limit: 60, windowSec: 3600 });
  if (rl) return rl;
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "no data store connected" }, { status: 503 });
  let body: { action?: unknown; email?: unknown };
  try { body = (await req.json()) || {}; } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  const action = String(body.action || "");
  const email = String(body.email || "").trim().toLowerCase().slice(0, 120);

  try {
    if (action === "leave") {
      const owner = await leaveTeam(s.email);
      return NextResponse.json({ ok: true, left: !!owner });
    }
    if (action === "remove") {
      if (!isEmail(email)) return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
      const removed = await removeMember(s.email, email);
      return NextResponse.json({ ok: true, removed });
    }
    if (action !== "add") return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });

    // Adding is the plan's: a live Clinic plan (its trial counts), bought by
    // this address. A member of someone else's clinic cannot add anyone.
    const st = await clinicStatus(s.email);
    if (st.role !== "owner" || !st.active) {
      return NextResponse.json({ ok: false, needPlan: true, error: "Adding clinicians comes with " + CLINIC_NAME + "." }, { status: 403 });
    }
    if (!isEmail(email)) return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
    // TEAM_INVITES_PER_DAY a day per owner (lib/team), counted only for an
    // invite that will really be sent.
    const r = await addMember(s.email, email, undefined, undefined, () => bumpDaily("slpteammail", s.email));
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
    // The link's host is this deployment's own, never a header's: it goes
    // out in an email under Sona's name.
    const link = url.origin + "/api/slp/team/accept?token=" + encodeURIComponent(r.token);
    const me = await readAccount(s.email);
    const mail = await sendTeamInviteEmail(email, link, me.name, me.clinic);
    return NextResponse.json({ ok: true, sent: mail.sent, resent: r.resent, ...(mail.devLink ? { devLink: mail.devLink } : {}) });
  } catch (e) {
    if (e instanceof StoreUnavailable) return down();
    throw e;
  }
}
