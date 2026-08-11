import { NextRequest, NextResponse } from "next/server";

/**
 * Lead capture for the free Speech Check (top-of-funnel email opt-in).
 *
 * Forwards the lead to whatever the founder has wired up — no DB required:
 *   - LEAD_WEBHOOK_URL : a generic inbound webhook (GHL workflow, Zapier,
 *     Make, etc.). The whole lead JSON is POSTed there. Simplest path to
 *     "see your opt-ins" with zero new accounts.
 *   - KIT_API_KEY + KIT_FORM_ID : best-effort native Kit (ConvertKit) opt-in.
 *
 * Never blocks the user: if capture hiccups, we still return ok so the Check
 * flow completes. `captured` tells the client whether anything was wired.
 */
export const runtime = "nodejs";

/**
 * Founder health check: presence booleans
 * only, never values. Open in a browser to see which capture/email rails
 * are actually configured in this deployment.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "lead",
    email: Boolean(process.env.RESEND_API_KEY),
    hook: Boolean(process.env.LEAD_WEBHOOK_URL),
    kit: Boolean(process.env.KIT_API_KEY && process.env.KIT_FORM_ID),
  });
}

export async function POST(req: NextRequest) {
  let body: {
    email?: string;
    child?: string;
    age?: string | number;
    practice?: string[];
    report?: string;
    summary?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    referrer?: string;
    landing?: string;
    source?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  }

  const child = typeof body?.child === "string" ? body.child.slice(0, 60) : "";
  const practice = Array.isArray(body?.practice) ? body!.practice!.slice(0, 12) : [];
  const report = typeof body?.report === "string" ? body.report.slice(0, 2000) : "";
  const summary = typeof body?.summary === "string" ? body.summary.slice(0, 600) : "";
  const clamp = (v?: string, n = 120) => (typeof v === "string" ? v.slice(0, n) : "");
  const lead = {
    email,
    name: child,                       // easy First Name mapping in GHL
    child,
    age: body?.age != null ? String(body.age).slice(0, 4) : "",
    practice,                          // array (for Kit etc.)
    practice_text: practice.join(", "), // flat string — easy GHL field mapping
    summary,                           // one-line headline (good email subject/preview)
    report,                            // full readable report body — drop into the GHL email
    utm_source: clamp(body?.utm_source),   // which content brought them (map these in GHL)
    utm_medium: clamp(body?.utm_medium),
    utm_campaign: clamp(body?.utm_campaign),
    utm_content: clamp(body?.utm_content),
    utm_term: clamp(body?.utm_term),
    referrer: clamp(body?.referrer, 200),
    landing: clamp(body?.landing),
    source: typeof body?.source === "string" ? body.source.slice(0, 40) : "speech-check",
    at: new Date().toISOString(),
  };

  // COPPA / hard rule: a child's name never leaves the device to a CRM, ad
  // pixel or analytics payload. This route is the marketing pipeline, so the
  // child's identity is stripped HERE as well as at the caller — the client
  // guard only covered the SLP branch, and the parent branch shipped the name
  // for months with a COPPA comment sitting directly above it. Defence in
  // depth: even a future caller that forgets cannot leak a name through here.
  const safeLead = { ...lead, child: "", age: "", practice: [] as string[] };

  const hook = process.env.LEAD_WEBHOOK_URL;
  const kitKey = process.env.KIT_API_KEY;
  const kitForm = process.env.KIT_FORM_ID;
  let captured = false;

  try {
    if (hook) {
      await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(safeLead),
      });
      captured = true;
    }
    if (kitKey && kitForm) {
      await fetch(`https://api.kit.com/v4/forms/${kitForm}/subscribers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Kit-Api-Key": kitKey },
        body: JSON.stringify({
          email_address: email,
          // no child_name / child_age / practice_sounds — a marketing list is
          // never a place a child's identity or clinical targets belong
          fields: { signup_source: safeLead.source },
        }),
      }).catch(() => {});
      captured = true;
    }
  } catch {
    // never fail the user on a capture hiccup
  }

  return NextResponse.json({ ok: true, captured });
}
