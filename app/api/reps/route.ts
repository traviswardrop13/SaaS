import { NextResponse } from "next/server";

/** Retired anonymous practice board. Old clients may still POST a beacon;
 * acknowledge it without reading, retaining, or forwarding family data. */
export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ ok: true, retired: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return NextResponse.json({ ok: false, retired: true }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
