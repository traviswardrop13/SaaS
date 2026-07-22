import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Move-in codes: carry a family's local save across browser containers.
 *
 * iOS gives an added-to-home-screen web app its OWN storage, so a family who
 * finishes onboarding in Safari and then installs Sona lands in a blank app
 * and has to onboard again. Fix: at the end of onboarding the browser stashes
 * the export blob here under a short code; the installed app redeems the code
 * on first launch and imports everything.
 *
 * Privacy/safety properties:
 *  - payload is the same sona.* localStorage export as the manual backup code
 *    (profile + progress; never audio)
 *  - codes are 6 chars from an unambiguous alphabet, unguessable enough for a
 *    48h TTL, and SINGLE USE — redeeming deletes the stash
 *  - best-effort: with no KV configured the app still works, the code line
 *    just never appears
 */
export const runtime = "nodejs";

const TTL_S = 48 * 60 * 60;
const MAX_BYTES = 256 * 1024;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

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

function makeCode(): string {
  let c = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) c += ALPHABET[bytes[i] % ALPHABET.length];
  return c;
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, { key: "pair", limit: 20, windowSec: 60 });
  if (rl) return rl;
  let body: { data?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const data = typeof body?.data === "string" ? body.data : "";
  if (!data || data.length > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Bad payload." }, { status: 400 });
  }
  const code = makeCode();
  const ok = await kvCmd(["SET", `pair:${code}`, data, "EX", TTL_S, "NX"]);
  if (ok === undefined) return NextResponse.json({ ok: false, error: "Not configured." }, { status: 501 });
  if (ok === null) return NextResponse.json({ ok: false, error: "Try again." }, { status: 503 }); // freak collision
  return NextResponse.json({ ok: true, code, ttlHours: 48 });
}

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, { key: "pair-get", limit: 30, windowSec: 60 });
  if (rl) return rl;
  const code = (req.nextUrl.searchParams.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) return NextResponse.json({ ok: false, error: "Bad code." }, { status: 400 });
  // GETDEL is atomic: two concurrent redemptions can't both read the payload
  // before either deletes it (the old GET-then-DEL let a code be used twice).
  const data = await kvCmd(["GETDEL", `pair:${code}`]);
  if (data === undefined) return NextResponse.json({ ok: false, error: "Not configured." }, { status: 501 });
  if (!data) return NextResponse.json({ ok: false, error: "That code isn't valid anymore." }, { status: 404 });
  return NextResponse.json({ ok: true, data });
}
