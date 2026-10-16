import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { kvCmd, kvConfigured, leadSig } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { APP_READY, sendWelcomeEmail } from "@/lib/launch";
import { enroll, inAppSource, markBuyer, planWord } from "@/lib/nurture";

/**
 * THE ONE PLACE A GROWN-UP'S EMAIL GOES: the SLP sign-up (via the auth route's
 * tellCrm), the app's setup (a clinician's account email, a parent's
 * optional email step, before the price since 13 Oct 2026), a purchase's
 * plan post (sona.js _tellPlan) and the Speech Check.
 *
 * SONA'S OWN LIST. Every lead is saved in the store (the ledger below), and
 * that is the email list: the welcome series (lib/nurture.ts) mails it, the
 * weekly report and RevenueCat's notes reach the same addresses, and
 * /leads.html reads it. Kit was the list from 24 Sep to 16 Oct 2026 (Travis,
 * 16 Oct 2026: "I'm also done using Kit"); nothing goes there now.
 * LEAD_WEBHOOK_URL is a generic webhook, GoHighLevel's until 24 Sep 2026;
 * remove the variable and that path goes quiet.
 *
 * Never blocks the visitor: a capture hiccup still returns ok. `captured` says
 * whether the lead was actually kept (or the webhook took it), and the auth
 * route stamps a clinician's account only when it was.
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
    list: kvConfigured(),
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
    name?: string;
    role?: string;
    fbclid?: string;
    welcome?: boolean;
    plan?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  // 254 is the longest address email itself allows; anything longer is not
  // an address, and every lead is now kept, so nothing unbounded gets in.
  if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
  }

  /**
   * A STRANGER CANNOT FLOOD THE LIST. This door takes posts from anyone, and
   * each one is kept and welcomed — so a script could fill the ledger past
   * its cap (pushing real leads out) and stuff the list with junk. Ten an
   * hour from one address is far more than any family or clinician sends.
   * Our own sign-up route forwards every clinician from the same few server
   * addresses, so it signs its leads and a valid signature skips the limit.
   */
  const sig = req.headers.get("x-sona-lead-sig") || "";
  const want = leadSig(email);
  const internal = sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
  if (!internal) {
    const limited = await rateLimit(req, { key: "lead", limit: 10, windowSec: 3600 });
    if (limited) return limited;
  }

  const child = typeof body?.child === "string" ? body.child.slice(0, 60) : "";
  const practice = Array.isArray(body?.practice) ? body!.practice!.slice(0, 12) : [];
  const report = typeof body?.report === "string" ? body.report.slice(0, 2000) : "";
  const summary = typeof body?.summary === "string" ? body.summary.slice(0, 600) : "";
  const clamp = (v?: string, n = 120) => (typeof v === "string" ? v.slice(0, n) : "");
  const lead = {
    email,
    name: child,                       // stripped below — never sent (see safeLead)
    child,
    age: body?.age != null ? String(body.age).slice(0, 4) : "",
    practice,                          // array (stripped below, never sent)
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
    // WHO THEY ARE: "slp" (an SLP or SLPA), "parent", or "other" (since
    // 25 Sep 2026 the landing page asks every visitor). A label, not an
    // identity.
    role: body?.role === "slp" ? "slp" : body?.role === "parent" ? "parent" : body?.role === "other" ? "other" : "",
    // Only a clinician signing up for themselves sends a first name that
    // travels — theirs, typed about themselves. On the parent paths the only
    // name a caller holds is a child's, so `name` never becomes first_name
    // there, and the landing page asks nobody for a name at all.
    first_name: body?.role === "slp" && typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "",
    fbclid: clamp(body?.fbclid),
    // A PARENT STARTED SONA PREMIUM IN THE APP (5 Oct 2026): "trial" when
    // Apple started their free days, "paid" when it charged them at once,
    // sent by sona.js once the purchase has gone through. It is kept on the
    // ledger, and it marks the address a buyer, so the welcome series skips
    // its sales emails (lib/nurture.ts) even before RevenueCat's own message
    // arrives (lib/revenuecat.ts). Those two words only.
    plan: planWord(body?.plan),
    at: new Date().toISOString(),
  };

  // COPPA / hard rule: a child's name never leaves the device to a CRM, ad
  // pixel or analytics payload. This route is the marketing pipeline, so the
  // child's identity is stripped HERE as well as at the caller — the client
  // guard only covered the SLP branch, and the parent branch shipped the name
  // for months with a COPPA comment sitting directly above it. Defence in
  // depth: even a future caller that forgets cannot leak a name through here.
  //
  // ALLOW-LIST, not a deny-list, and that is the whole point. This was
  // `{ ...lead, child: "", age: "", practice: [] }` — every safe field implied,
  // every unsafe one enumerated — and `name: child` sailed straight through it,
  // because nobody thought to add the new field to the blank-list. The promise
  // above cannot be kept by a list of exceptions someone has to remember to
  // update. Spreading `lead` here again would reintroduce exactly that bug: if
  // a field is not named below, it does not leave this process.
  const safeLead = {
    email: lead.email,
    // No parent name is collected on this route, and the child's never goes.
    // The key stays so an existing GHL "First Name" mapping keeps resolving —
    // to empty, which is the honest answer to "what is this person called".
    name: "",
    child: "",
    age: "",
    practice: [] as string[],
    practice_text: "",
    summary: lead.summary,
    report: lead.report,
    utm_source: lead.utm_source,
    utm_medium: lead.utm_medium,
    utm_campaign: lead.utm_campaign,
    utm_content: lead.utm_content,
    utm_term: lead.utm_term,
    referrer: lead.referrer,
    landing: lead.landing,
    source: lead.source,
    role: lead.role,
    // The CLINICIAN's first name, separate from `name` on purpose: `name` is
    // the field a CRM maps to "First Name" for every lead, and it stays blank
    // because on the parent path the only name available is a child's.
    first_name: lead.first_name,
    fbclid: lead.fbclid,
    // the grown-up's own purchase, never anything about the child
    plan: lead.plan,
    at: lead.at,
  };

  const hook = process.env.LEAD_WEBHOOK_URL;
  let crm: { ok: boolean; status: number } | null = null;

  /**
   * CAPTURED MEANS IT WAS REALLY KEPT. It used to be set the moment a fetch
   * returned, whatever the CRM answered, so a refusal read everywhere
   * downstream as a lead safely delivered. Now it is true only when the
   * ledger (Sona's own list) took the lead, or the legacy webhook (GoHighLevel,
   * deleted 24 Sep 2026 — remove LEAD_WEBHOOK_URL once it is gone) did.
   */
  const toHook = async (): Promise<void> => {
    if (!hook) return;
    const ctl = new AbortController();
    const fuse = setTimeout(() => ctl.abort(), 5000);
    try {
      const r = await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(safeLead),
        signal: ctl.signal,
      });
      crm = { ok: r.ok, status: r.status };
      if (!r.ok) console.error("[lead] CRM webhook refused the lead:", r.status, (await r.text().catch(() => "")).slice(0, 300));
    } catch (e) {
      crm = { ok: false, status: 0 };
      console.error("[lead] CRM webhook failed:", e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(fuse);
    }
  };
  try {
    await toHook();
  } catch {
    // never fail the visitor on a capture hiccup
  }
  const hookRes = crm as { ok: boolean; status: number } | null;
  let kept = false;

  /**
   * THE LEDGER: EVERY LEAD IS KEPT ON OUR SIDE. Until 24 Sep 2026 this
   * route forwarded and forgot, so a lead the CRM dropped was gone — and the
   * first ad produced 26 "Website Leads" that nobody could find. Each lead is
   * appended to the store (since 16 Oct 2026 that IS the list), and the
   * founder view (/leads.html, behind FOUNDER_KEY) reads it back.
   *
   * Built from safeLead, field by field, never from `lead`: the grown-up's
   * email and the campaign tags, never a child's name, age or targets, and
   * not the free-text report either. Capped so it cannot grow without end.
   */
  if (kvConfigured()) {
    try {
      const entry = {
        at: safeLead.at,
        email: safeLead.email,
        first_name: safeLead.first_name,
        role: safeLead.role,
        source: safeLead.source,
        summary: safeLead.summary.slice(0, 120),
        utm_source: safeLead.utm_source,
        utm_medium: safeLead.utm_medium,
        utm_campaign: safeLead.utm_campaign,
        utm_content: safeLead.utm_content,
        fbclid: safeLead.fbclid,
        landing: safeLead.landing,
        plan: safeLead.plan,
        // status 0 is a timeout or a network failure, not a refusal: the
        // webhook may never have seen it, or may have it without replying
        crm: hookRes ? (hookRes.ok ? "accepted" : hookRes.status ? "refused " + hookRes.status : "unreachable") : "not configured",
      };
      kept = Number(await kvCmd(["LPUSH", "leads:all", JSON.stringify(entry)])) > 0;
      await kvCmd(["LTRIM", "leads:all", 0, 9999]);
    } catch {
      // a failed write never costs the visitor anything; `captured` says so
    }
  }
  const captured = kept || !!(hookRes && hookRes.ok);

  // A PURCHASE'S PLAN POST: the welcome series sends this address no more
  // sales emails (day 3 "Try Sona free", day 5 "Start your free trial")
  if (lead.plan && kvConfigured()) {
    try { await markBuyer(email, kvCmd); } catch { /* never fail the visitor */ }
  }

  /**
   * THE WELCOME, while the app is not ready (lib/launch.ts, 25 Sep 2026): the
   * landing page asks for it for a parent or "other"; a clinician gets the
   * same news in their sign-in email instead. Once per address, ever — the
   * marker is set before sending, so a double tap or a retry cannot send two,
   * and a failed send is not retried (the lead is kept either way). Sent after
   * the lead is safely stored, and it never fails the visitor.
   */
  let welcomed = false;
  if (!APP_READY && body?.welcome === true && (lead.role === "parent" || lead.role === "other") && kvConfigured()) {
    try {
      const first = await kvCmd(["SET", "launchmail:" + email.toLowerCase(), new Date().toISOString(), "NX", "EX", 31536000]);
      if (first === "OK") welcomed = await sendWelcomeEmail(email);
    } catch {
      // never fail the visitor on the welcome
    }
  }

  // THE WELCOME SERIES (lib/nurture.ts, 6 Oct 2026): now that the app is out,
  // every grown-up who gives an email gets Rachel's welcome right away and the
  // 5-minute email the next day — once per address, with a real unsubscribe.
  // An email given inside the app (IN_APP_SOURCES in lib/nurture.ts) skips
  // the App Store email and starts at the 5-minute one: they have the app.
  if (APP_READY && kvConfigured()) {
    try {
      welcomed = (await enroll(email, kvCmd, fetch, Date.now(), { inApp: inAppSource(lead.source) })) || welcomed;
    } catch {
      // never fail the visitor on the welcome
    }
  }

  return NextResponse.json({ ok: true, captured, welcomed });
}
