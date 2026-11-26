import { NextRequest, NextResponse } from "next/server";
import { dashboardGate } from "@/lib/proGate";
import { AGE_BANDS, catalogItem, positionFits, soundOk } from "@/lib/sonaCatalog";
import { rateLimit } from "@/lib/rateLimit";
import { kvCmd, readSession, liveSession } from "@/lib/slpAuth";

// SESSION PLAY (SESSPLAY1, 17 Nov 2026). Travis: "I want it built into their
// app so that it's accessible on the SLPs ... loaded into their app". "Play
// now" on Session games opens one of Sona's games on the clinician's own
// device, set to the child's sound, for the session.
//
// This route is the server's yes. It answers only a signed-in clinician
// whose dashboard is open (Sona Pro, Sona Clinic owned or joined, or a free
// dashboard promised before 12 Nov 2026: dashboardGate), on this site's own
// page, for a key in Sona's catalog (lib/sonaCatalog) with a real sound, a
// word position that fits it and an age band. The answer is the page to open and when the session ends
// (12 hours); the dashboard writes its tab-only record (sessionStorage
// "sona.sessplay.v1") only after this said ok, and public/sona.js (block
// SESSPLAY1) runs the game from that record: every game open in that tab, a
// temporary profile with no name, nothing written to the device's family
// storage and nothing sent anywhere. The address opens nothing by itself.

export const runtime = "nodejs";

const SESSION_MS = 12 * 60 * 60 * 1000;

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  const session = await liveSession(readSession(req));
  if (!session) return error("Sign in to play.", 401);

  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return error("Open the game from your dashboard.", 403);

  const limited = await rateLimit(req, { key: "slp-play", limit: 120, windowSec: 3600 });
  if (limited) return limited;

  const account = await kvCmd(["GET", "slpacct:" + session.email]);
  if (account === undefined) return error("Couldn't load your account. Try again shortly.", 503);
  if (!account) return error("Sign in to play.", 401);
  const locked = await dashboardGate(session.email);
  if (locked) return locked;

  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!b || typeof b !== "object" || Array.isArray(b)) return error("Choose a game.", 400);
  const sound = typeof b.sound === "string" ? b.sound : "";
  if (!soundOk(sound)) return error("Choose a sound.", 400);
  const pos = typeof b.pos === "string" ? b.pos : "";
  if (!positionFits(sound, pos)) return error("That word position doesn't fit " + sound + ".", 400);
  const age = typeof b.age === "string" ? b.age : "";
  if ((AGE_BANDS as readonly string[]).indexOf(age) < 0) return error("Choose the child's age.", 400);
  const item = catalogItem(b.key, sound);
  if (!item) return error("That game isn't in Sona.", 400);
  return NextResponse.json({ ok: true, exp: Date.now() + SESSION_MS, go: item.go, key: item.key });
}
