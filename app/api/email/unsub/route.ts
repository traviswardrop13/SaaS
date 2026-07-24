import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

/**
 * One-click unsubscribe for the weekly parent email. The link carries an
 * HMAC of the email (UNSUB_SECRET || FOUNDER_KEY) so nobody can unsubscribe
 * someone else by guessing addresses. Adds to the `email:unsub` KV set the
 * weekly sender checks. Always answers with a friendly page — even on a bad
 * token it reveals nothing.
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

function page(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#fff6e9;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;"><div style="background:#fff;border-radius:20px;padding:34px 28px;max-width:380px;margin:20px;text-align:center;"><div style="font-size:21px;font-weight:800;color:#4a2c14;">${title}</div><p style="margin:10px 0 0;font-size:14.5px;line-height:1.6;color:#6b5138;">${body}</p></div></body>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const email = String(req.nextUrl.searchParams.get("e") || "").trim().toLowerCase().slice(0, 120);
  const k = String(req.nextUrl.searchParams.get("k") || "");
  const secret = process.env.UNSUB_SECRET || process.env.FOUNDER_KEY || "sona";
  const want = createHmac("sha256", secret).update(email).digest("hex").slice(0, 24);
  if (!email || k !== want) {
    return page("That link didn't work", "It may have expired. Reply to any Sona email and we'll take care of it by hand.");
  }
  await kvCmd(["SADD", "email:unsub", email]);
  return page("You're unsubscribed 🧡", "No more weekly emails. Your child's practice and report stay right in the app, always.");
}
