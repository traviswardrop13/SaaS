import { NextRequest, NextResponse } from "next/server";
import { kvConfigured, safeEqualStr } from "@/lib/slpAuth";
import { MAX_BODY, alertNew, apply, moveAway, readEvent, welcome } from "@/lib/revenuecat";

/**
 * REVENUECAT'S WEBHOOK (RCHOOK1, 16 Oct 2026; lib/revenuecat.ts says what it
 * does with each message). RevenueCat posts here whenever an App Store
 * purchase of Sona Premium starts, renews, is cancelled or ends.
 *
 * Set up (NATIVE.md, "RevenueCat webhook"): REVENUECAT_WEBHOOK_AUTH in Vercel,
 * a long random value of 16+ characters, and the SAME value as the
 * "Authorization header value" of RevenueCat's webhook (Integrations ›
 * Webhooks), which sends it unchanged with every message. To change it
 * without a gap, move the old value to REVENUECAT_WEBHOOK_AUTH_PREV first.
 *
 * Answers: 200 for anything dealt with or ignored on purpose (RevenueCat
 * treats any other answer as a failure and tries again, 5 times over about
 * two and a half hours); 401 for a wrong header; 503 when the secret is not
 * set or the store did not answer (so a retry can still land). Nothing about
 * a message is logged, and no address ever is.
 */
export const runtime = "nodejs";

/** Founder health check: presence booleans only, never values. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "revenuecat", auth: secrets().length > 0, store: kvConfigured(), sandbox: process.env.REVENUECAT_SANDBOX === "1" });
}

// read at call time, not import time, so a suite can flip them
function secrets(): string[] {
  return [process.env.REVENUECAT_WEBHOOK_AUTH || "", process.env.REVENUECAT_WEBHOOK_AUTH_PREV || ""].filter((s) => s.length >= 16);
}

const done = (what: string) => NextResponse.json({ ok: true, [what === "ok" ? "applied" : "ignored"]: what === "ok" ? true : what });
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  const want = secrets();
  if (!want.length) return fail("Set REVENUECAT_WEBHOOK_AUTH (16+ characters) in Vercel, then redeploy.", 503);
  const given = req.headers.get("authorization") || "";
  if (!want.some((w) => safeEqualStr(given, w))) return fail("Wrong key.", 401);

  if (Number(req.headers.get("content-length")) > MAX_BODY) return fail("Too large.", 413);
  let body: unknown;
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY) return fail("Too large.", 413);
    body = JSON.parse(raw);
  } catch {
    return fail("Invalid JSON.", 400);
  }
  const ev = readEvent(body);
  if (!ev) return fail("Not a RevenueCat event.", 400);

  // a dashboard test, a type Sona has no use for, Apple's sandbox, or a
  // family who gave the app no email: nothing to do, and nothing to retry
  if (ev.type === "TEST") return done("test");
  // a subscription moved to another device's customer: it carries no email,
  // so it is matched by the customer ids Sona saw with an address before
  if (ev.type === "TRANSFER") {
    if (ev.sandbox && process.env.REVENUECAT_SANDBOX !== "1") return done("sandbox");
    if (!ev.from.length) return done("type");
    if (!kvConfigured()) return fail("No data store is connected.", 503);
    const m = await moveAway(ev);
    if (m === "retry") return NextResponse.json({ ok: false, retry: true }, { status: 503 });
    return done(m);
  }
  if (!ev.state) return done("type");
  if (ev.sandbox && process.env.REVENUECAT_SANDBOX !== "1") return done("sandbox");
  // Travis's "new trial" email, before the email check: a family who gave
  // the app no address is still a new trial. Best-effort, never a retry.
  if (kvConfigured()) await alertNew(ev);
  if (!ev.email) return done("no email");

  if (!kvConfigured()) return fail("No data store is connected.", 503);
  const r = await apply({ ...ev, state: ev.state });
  if (r === "retry") return NextResponse.json({ ok: false, retry: true }, { status: 503 });
  // free days just started: Rachel's welcome (once a year an address, best-effort)
  if (r === "ok") await welcome(ev);
  return done(r);
}
