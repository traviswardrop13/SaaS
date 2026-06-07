import { NextResponse } from "next/server";

/**
 * Lists the avatars available to this LiveAvatar account so we can pick a valid
 * avatar_id + voice_id. HeyGen avatar IDs do NOT carry over to LiveAvatar, so we
 * need real LiveAvatar IDs. Open /api/heygen/avatars in a browser to see them.
 * Calls both the public library and any custom (owned) avatars.
 */
const KEY = () => process.env.LIVEAVATAR_API_KEY || process.env.HEYGEN_API_KEY;

async function getJson(url: string, key: string) {
  try {
    const r = await fetch(url, { headers: { "X-API-KEY": key } });
    const json = await r.json().catch(() => ({}));
    return { status: r.status, json };
  } catch (e: unknown) {
    return { status: 0, json: { error: e instanceof Error ? e.message : "fetch failed" } };
  }
}

// LiveAvatar wraps lists in { data: { avatars: [...] } } (shapes vary) — pull out
// a tidy [{ id, name, voice }] regardless of exact nesting.
function simplify(json: unknown): Array<Record<string, unknown>> {
  const j = json as Record<string, any>;
  const arr =
    j?.data?.avatars ?? j?.data?.list ?? j?.avatars ?? (Array.isArray(j?.data) ? j.data : null);
  if (!Array.isArray(arr)) return [];
  return arr.map((a: Record<string, any>) => ({
    avatar_id: a.avatar_id ?? a.id ?? a.avatarId,
    name: a.name ?? a.avatar_name ?? a.display_name,
    default_voice_id: a.default_voice_id ?? a.voice_id ?? a.voice?.voice_id,
  }));
}

export async function GET() {
  const key = KEY();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Server is missing LIVEAVATAR_API_KEY." },
      { status: 500 },
    );
  }

  const pub = await getJson("https://api.liveavatar.com/v1/avatars/public", key);
  const own = await getJson("https://api.liveavatar.com/v1/avatars", key);

  const publicAvatars = simplify(pub.json);
  const customAvatars = simplify(own.json);

  // If we couldn't tidy anything, return the raw payloads so we can see the shape.
  if (publicAvatars.length === 0 && customAvatars.length === 0) {
    return NextResponse.json({
      ok: false,
      note: "No avatars parsed — showing raw responses to inspect the shape.",
      publicStatus: pub.status,
      ownStatus: own.status,
      rawPublic: pub.json,
      rawOwn: own.json,
    });
  }

  return NextResponse.json({
    ok: true,
    customAvatars,
    publicAvatars,
  });
}
