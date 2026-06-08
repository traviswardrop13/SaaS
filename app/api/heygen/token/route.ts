import { NextRequest, NextResponse } from "next/server";

/**
 * Creates a **LiveAvatar** session token (api.liveavatar.com) from the
 * server-side LIVEAVATAR_API_KEY. The classic Streaming Avatar API was sunset, so
 * we use LiveAvatar's /v1/sessions/token. The avatar + voice can be passed via
 * ?avatar=&voice= (or JSON body); they default to the configured coach.
 */
// Valid LiveAvatar IDs (HeyGen IDs don't carry over). "Ann" — warm female coach.
const DEFAULT_AVATAR = "513fd1b7-7ef9-466d-9af2-344e51eeb833";
const DEFAULT_VOICE = "de5574fc-009e-4a01-a881-9919ef8f5a0c";

export async function POST(req: NextRequest) {
  // LiveAvatar uses its OWN key (from app.liveavatar.com/developers) — the old
  // HeyGen key is NOT compatible. Accept either env name so the rename is clean.
  const key = process.env.LIVEAVATAR_API_KEY || process.env.HEYGEN_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Server is missing LIVEAVATAR_API_KEY." },
      { status: 500 },
    );
  }

  // Everything is URL-driven so we can iterate in the browser without redeploys:
  //   ?avatar=&voice=&mode=FULL|LITE&sandbox=1
  const { searchParams } = new URL(req.url);
  let avatarId = searchParams.get("avatar");
  let voiceId = searchParams.get("voice");
  const mode = (searchParams.get("mode") || "FULL").toUpperCase();
  const sandbox = ["1", "true", "yes"].includes(
    (searchParams.get("sandbox") || "").toLowerCase(),
  );
  if (req.method === "POST") {
    try {
      const b = await req.json();
      avatarId = avatarId || b?.avatar_id || b?.avatar;
      voiceId = voiceId || b?.voice_id || b?.voice;
    } catch {
      // no/blank body — fine
    }
  }
  avatarId = avatarId || DEFAULT_AVATAR;
  voiceId = voiceId || DEFAULT_VOICE;

  try {
    const body: Record<string, unknown> = {
      // FULL = LiveAvatar does the TTS, so we can hand her text and she speaks it
      // (repeat()). We puppet her with our Claude coach's exact lines and never
      // enable their LLM/voice-chat. LITE blocks text-to-speech (needs audio).
      mode,
      avatar_id: avatarId,
      avatar_persona: { voice_id: voiceId, language: "en" },
    };
    if (sandbox) body.is_sandbox = true;
    const r = await fetch("https://api.liveavatar.com/v1/sessions/token", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await r.json().catch(() => ({}));
    // Token field name isn't documented for us yet — try the likely spots and
    // surface the raw payload if we miss, so we can see the real shape.
    const token =
      json?.data?.token ??
      json?.token ??
      json?.session_token ??
      json?.data?.session_token ??
      json?.access_token ??
      json?.data?.access_token ??
      json?.data?.session_access_token;
    if (!token) {
      const apiMsg =
        (typeof json?.message === "string" && json.message) ||
        (Array.isArray(json?.data) && json.data[0] && json.data[0].message) ||
        (typeof json?.error === "string" && json.error) ||
        "";
      return NextResponse.json(
        { ok: false, error: apiMsg ? `LiveAvatar: ${apiMsg}` : "No token field found in LiveAvatar response.", status: r.status, raw: json },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, token });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Token request failed." },
      { status: 502 },
    );
  }
}

export const GET = POST;
