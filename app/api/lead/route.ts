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

export async function POST(req: NextRequest) {
  let body: { email?: string; child?: string; age?: string | number; practice?: string[] };
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
  const lead = {
    email,
    name: child,                       // easy First Name mapping in GHL
    child,
    age: body?.age != null ? String(body.age).slice(0, 4) : "",
    practice,                          // array (for Kit etc.)
    practice_text: practice.join(", "), // flat string — easy GHL field mapping
    source: "speech-check",
    at: new Date().toISOString(),
  };

  const hook = process.env.LEAD_WEBHOOK_URL;
  const kitKey = process.env.KIT_API_KEY;
  const kitForm = process.env.KIT_FORM_ID;
  let captured = false;

  try {
    if (hook) {
      await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
      captured = true;
    }
    if (kitKey && kitForm) {
      await fetch(`https://api.kit.com/v4/forms/${kitForm}/subscribers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Kit-Api-Key": kitKey },
        body: JSON.stringify({
          email_address: email,
          fields: { child_name: lead.child, child_age: lead.age, practice_sounds: lead.practice.join(", ") },
        }),
      }).catch(() => {});
      captured = true;
    }
  } catch {
    // never fail the user on a capture hiccup
  }

  return NextResponse.json({ ok: true, captured });
}
