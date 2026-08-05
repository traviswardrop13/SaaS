import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Founder unlock: Travis and Rachel use the whole app on any device with no
 * paywall. POST { key } checked against FOUNDER_KEY (the same env that guards
 * the founder dashboard) — constant-time, rate-limited, fail closed. On valid,
 * the client sets a local founder flag that gated() honors.
 *
 * This is an owner's key, not a growth surface: nothing links to it, and the
 * only way in is knowing the secret.
 */
export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { key: "founder-unlock", limit: 10, windowSec: 3600 });
  if (rl) return rl;

  const want = process.env.FOUNDER_KEY || "";
  if (want.length < 8) {
    return NextResponse.json({ ok: false, error: "Founder access isn't configured." }, { status: 503 });
  }
  let body: { key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const key = String(body.key || "").trim().slice(0, 128);
  const valid = key.length >= 8 && safeEqual(key, want);
  return NextResponse.json({ ok: true, valid });
}
