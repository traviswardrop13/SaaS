import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

/**
 * Unsubscribe for the weekly parent email — scanner-proof and RFC 8058 ready.
 *
 * GET  — NO side effects (Outlook SafeLinks/Proofpoint prefetch every link in
 *        an email with GET): renders a one-tap confirmation form that POSTs
 *        back to this same URL.
 * POST — validates the HMAC token and adds the address to the `email:unsub`
 *        KV suppression set. This is also the RFC 8058 one-click endpoint
 *        (Gmail/Yahoo POST here directly via List-Unsubscribe-Post).
 *
 * The token is HMAC-SHA256(email, UNSUB_SECRET) — UNSUB_SECRET is required,
 * never defaulted, so tokens can't be forged from a public constant. The
 * page reveals nothing on a bad token, and only claims success when the KV
 * write actually succeeded.
 */
export const runtime = "nodejs";

async function kvCmd(cmd: (string | number)[]): Promise<unknown> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) return undefined;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    if (!r.ok) return undefined;
    const j = (await r.json()) as { result?: unknown };
    return j.result;
  } catch {
    return undefined;
  }
}

function page(title: string, body: string, form?: { e: string; k: string }): NextResponse {
  const inner = form
    ? `<form method="post" action="/api/email/unsub?e=${encodeURIComponent(form.e)}&k=${encodeURIComponent(form.k)}" style="margin:18px 0 0;">
         <button type="submit" style="border:none;border-radius:14px;background:#ff8a3d;color:#fff;font-weight:800;font-size:15px;padding:13px 30px;cursor:pointer;">Yes, unsubscribe me</button>
       </form>`
    : "";
  return new NextResponse(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sona</title><body style="margin:0;background:#fff6e9;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;"><div style="background:#fff;border-radius:20px;padding:34px 28px;max-width:380px;margin:20px;text-align:center;"><div style="font-size:21px;font-weight:800;color:#4a2c14;">${title}</div><p style="margin:10px 0 0;font-size:14.5px;line-height:1.6;color:#6b5138;">${body}</p>${inner}</div></body>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function validate(req: NextRequest): { email: string } | null {
  const secret = process.env.UNSUB_SECRET;
  if (!secret) return null; // never fall back to a guessable constant
  const email = String(req.nextUrl.searchParams.get("e") || "").trim().toLowerCase().slice(0, 120);
  const k = String(req.nextUrl.searchParams.get("k") || "");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  const want = createHmac("sha256", secret).update(email).digest("hex").slice(0, 24);
  return k === want ? { email } : null;
}

export async function GET(req: NextRequest) {
  const v = validate(req);
  if (!v) return page("That link didn't work", "It may have expired. Reply to any Sona email and we'll take care of it by hand.");
  return page(
    "Unsubscribe from the weekly email?",
    "One tap and you're out — your child's practice and report stay right in the app, always.",
    { e: v.email, k: String(req.nextUrl.searchParams.get("k") || "") },
  );
}

export async function POST(req: NextRequest) {
  const v = validate(req);
  if (!v) return page("That link didn't work", "It may have expired. Reply to any Sona email and we'll take care of it by hand.");
  const res = await kvCmd(["SADD", "email:unsub", v.email]);
  if (res === undefined) {
    return page("Almost — one hiccup", "We couldn't save that just now. Reply to any Sona email and we'll unsubscribe you by hand today.");
  }
  return page("You're unsubscribed 🧡", "No more weekly emails. Your child's practice and report stay right in the app, always.");
}
