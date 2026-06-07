import { NextRequest, NextResponse } from "next/server";

/**
 * Creates a HeyGen **LiveAvatar** session token (api.liveavatar.com) from the
 * server-side HEYGEN_API_KEY. The classic Streaming Avatar API was sunset, so
 * we use LiveAvatar's /v1/sessions/token. The avatar + voice can be passed via
 * ?avatar=&voice= (or JSON body); they default to the configured coach.
 */
const DEFAULT_AVATAR = "7f89caae735346619beafd1bc541ae42";
const DEFAULT_VOICE = "2b5d5579ca074543942d7c9b85fa743c";

export async function POST(req: NextRequest) {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Server is missing HEYGEN_API_KEY." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  let avatarId = searchParams.get("avatar");
  let voiceId = searchParams.get("voice");
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
    const r = await fetch("https://api.liveavatar.com/v1/sessions/token", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        avatar_id: avatarId,
        avatar_persona: { voice_id: voiceId, language: "en" },
      }),
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
      return NextResponse.json(
        { ok: false, error: "No token field found in LiveAvatar response.", status: r.status, raw: json },
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
