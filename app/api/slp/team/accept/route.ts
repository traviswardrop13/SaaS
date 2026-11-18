import { NextRequest, NextResponse } from "next/server";
import { kvConfigured, readSession, liveSession } from "@/lib/slpAuth";
import { readAccount } from "@/lib/roster";
import { StoreUnavailable, CLINIC_NAME } from "@/lib/caseload";
import { peekInvite, acceptInvite, inviteAsker, OWNER_SEES, esc } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/slp/team/accept?token=… — the link in a Sona Clinic invite email
 * (17 Nov 2026; lib/team).
 *
 * GET CHANGES NOTHING (18 Nov 2026, review). It joined the clinician on the
 * spot, so a district's link scanner (Safe Links, Mimecast), which opens
 * every link in an email, joined them for them, and showed the owner their
 * numbers. Now GET shows one page: who is asking, what that owner will see,
 * and a Join button that POSTs back here, as the weekly report's confirm link
 * does (app/api/report/confirm). Nothing is spent until the button.
 *
 * JOINING IS NOT SIGNING IN (18 Nov 2026, review). The link lives fourteen
 * days and may be forwarded or sit in a shared practice inbox; when it also
 * signed the clinician in, whoever opened it had their whole dashboard,
 * children included, for a month. So the button only joins. A browser
 * already signed in as that clinician goes straight to their plan page; any
 * other goes to the sign-in page, which says they joined and asks for the
 * ordinary fifteen-minute link or code (and carries the email list's consent
 * line, which this door never showed).
 *
 * A link that is spent, expired, withdrawn (the owner removed the seat) or
 * replaced (a newer Resend) goes to the sign-in page saying so. One whose
 * owner's plan is off, or for a clinician who owns a Clinic plan, says that
 * and stays good for its fourteen days.
 */

function page(title: string, body: string, action?: string, button = "Join your clinic"): NextResponse {
  const form = action
    ? `<form method="post" action="${esc(action)}" style="margin:20px 0 0;"><button type="submit" style="border:none;border-radius:14px;background:#0e9c99;color:#fff;font-weight:800;font-size:16px;padding:14px 30px;cursor:pointer;">${esc(button)}</button></form>`
    : "";
  return new NextResponse(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Sona</title><body style="margin:0;background:#f4f8fc;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;"><main style="background:#fff;border-radius:20px;padding:32px 26px;max-width:420px;margin:20px;text-align:center;box-shadow:0 6px 24px rgba(22,56,79,.08);"><h1 style="margin:0;font-size:21px;font-weight:800;color:#16384f;">${esc(title)}</h1>${body}${form}</main></body></html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex",
        // The token is in this page's address: never sent on to another
        // site. "same-origin", not "no-referrer", which makes a browser send
        // the Join button's POST with Origin "null".
        "referrer-policy": "same-origin",
      },
    },
  );
}
const para = (t: string, muted = false) =>
  `<p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:${muted ? "#6b86a3" : "#46627a"};">${esc(t)}</p>`;

const PLAN_OFF = ["Your clinic's plan isn't on right now", "So there is nothing to join yet. Ask whoever added you to turn it back on; this link keeps working until it expires."] as const;
const OWN_CLINIC = ["You have your own " + CLINIC_NAME + " plan", "While it's on, you can't join another clinic's. This link keeps working until it expires."] as const;

const refused = (why: "gone" | "planOff" | "ownClinic") =>
  why === "planOff" ? page(PLAN_OFF[0], para(PLAN_OFF[1])) : page(OWN_CLINIC[0], para(OWN_CLINIC[1]));

const back = (url: URL, q: string, status = 302) => NextResponse.redirect(url.origin + "/slp-login.html?" + q, status);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (!kvConfigured()) return back(url, "err=store");
  try {
    const st = await peekInvite(token);
    if (!st.ok && st.why === "gone") return back(url, "err=expired");
    if (!st.ok) return refused(st.why);
    const o = await readAccount(st.owner);
    const { asker, askerMid } = inviteAsker(o.name, o.clinic);
    return page(
      "Join your clinic on Sona?",
      para(asker + " added you to their " + CLINIC_NAME + " plan: your own dashboard, every game on your own phone or tablet, and every game for every family who joins through your link.") +
      `<p style="margin:16px 0 0;font-size:15px;font-weight:800;color:#16384f;">${esc("What " + askerMid + " will see")}</p>` + para(OWNER_SEES) +
      (st.moving ? para("You're on another clinic's Sona plan now. Joining this one takes you off it.") : "") +
      para("After you join, sign in with this email address. You can leave the clinic anytime from your dashboard.", true),
      "/api/slp/team/accept?token=" + encodeURIComponent(token),
    );
  } catch (e) {
    if (e instanceof StoreUnavailable) return back(url, "err=store");
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  // Sona's own page only: a form on another site that somehow held the
  // token cannot press Join for anyone.
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) return page("That didn't work", para("Open the link in your invite email again."));
  const token = url.searchParams.get("token") || "";
  if (!kvConfigured()) return back(url, "err=store", 303);
  try {
    const st = await acceptInvite(token);
    if (!st.ok && st.why === "gone") return back(url, "err=expired", 303);
    if (!st.ok) return refused(st.why);
    // Already signed in here as the clinician who joined: their plan page.
    // Never a session made here (see above).
    let s = null;
    try { s = await liveSession(readSession(req)); } catch { s = null; }
    if (s && s.email.toLowerCase() === st.member) return NextResponse.redirect(url.origin + "/slp.html?joined=team#premium", 303);
    return back(url, "joined=team", 303);
  } catch (e) {
    if (e instanceof StoreUnavailable) return back(url, "err=store", 303);
    throw e;
  }
}
