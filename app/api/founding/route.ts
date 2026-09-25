import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Founding Families signup — stores the application in KV and returns the
 * family code the parent opens on the child's device (/?ff=<id>), which
 * enrolls that device in pilot mode (free access + consented practice
 * beacon). Best-effort webhook so the founder gets a ping per signup.
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

/**
 * GET ?id=<code> → { ok, valid } — does this founding code actually exist?
 * The client validates before granting free pilot access, so a random
 * ?ff=<anything> can no longer unlock the app. Fail-closed on the client: if
 * this can't confirm valid:true (network error, KV down), no unlock happens.
 * If KV isn't configured, valid:false (there are no real codes to honor).
 */
export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, { key: "founding-check", limit: 30, windowSec: 60 });
  if (rl) return rl;
  const id = (new URL(req.url).searchParams.get("id") || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 24).toLowerCase();
  if (!id) return NextResponse.json({ ok: true, valid: false });
  const rec = await kvCmd(["GET", "ff:app:" + id]);
  return NextResponse.json({ ok: true, valid: !!rec });
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { key: "founding", limit: 10, windowSec: 3600 });
  if (rl) return rl;

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const parent = String(b.parent || "").trim().slice(0, 60);
  const cell = String(b.cell || "").replace(/[^\d+()\-\s]/g, "").trim().slice(0, 20);
  const child = String(b.child || "").trim().slice(0, 40);
  const age = String(b.age || "").trim().slice(0, 8);
  const sound = String(b.sound || "").trim().toUpperCase().slice(0, 4);
  const consent = b.consent === true;

  if (!parent || !child || cell.replace(/\D/g, "").length < 7) {
    return NextResponse.json({ ok: false, error: "Please fill in your name, your child's name, and a cell number." }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ ok: false, error: "The practice-progress consent box is required for the founding program." }, { status: 400 });
  }

  const id = Math.random().toString(36).slice(2, 8);
  const rec = { id, parent, cell, child, age, sound, at: new Date().toISOString() };

  await kvCmd(["SET", "ff:app:" + id, JSON.stringify(rec)]);
  await kvCmd(["LPUSH", "ff:apps", id]);
  await kvCmd(["LTRIM", "ff:apps", 0, 499]);

  try {
    const hook = process.env.LEAD_WEBHOOK_URL;
    if (hook) {
      await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rec, kind: "founding-family" }),
      });
    }
  } catch {
    // signup must never fail on a webhook hiccup
  }

  return NextResponse.json({ ok: true, id });
}
