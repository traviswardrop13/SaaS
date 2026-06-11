import { NextResponse } from "next/server";

/**
 * Lists every avatar available to this LiveAvatar account so we can find one
 * that works in FULL mode. HeyGen IDs don't carry over, and FULL vs LITE appear
 * to accept different avatars — so we pull ALL pages of the public catalog plus
 * any custom (owned) avatars, and group by `type` (VIDEO vs STREAMING/etc).
 * Open /api/heygen/avatars in a browser.
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

type Av = { avatar_id?: unknown; name?: unknown; type?: unknown; default_voice_id?: unknown };

function rows(json: unknown): Av[] {
  const j = json as Record<string, any>;
  const arr =
    j?.data?.results ??
    j?.data?.avatars ??
    j?.data?.list ??
    j?.avatars ??
    (Array.isArray(j?.data) ? j.data : null);
  if (!Array.isArray(arr)) return [];
  return arr.map((a: Record<string, any>) => ({
    avatar_id: a.avatar_id ?? a.id ?? a.avatarId,
    name: a.name ?? a.avatar_name ?? a.display_name,
    type: a.type ?? a.avatar_type ?? "?",
    default_voice_id: a.default_voice_id ?? a.voice_id ?? a.default_voice?.id ?? a.voice?.voice_id,
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

  // Walk all pages of the public catalog (count was ~83 at 20/page).
  const all: Av[] = [];
  let firstStatus = 0;
  let firstRaw: unknown = null;
  for (let page = 1; page <= 8; page++) {
    const { status, json } = await getJson(
      `https://api.liveavatar.com/v1/avatars/public?page=${page}&page_size=50`,
      key,
    );
    if (page === 1) {
      firstStatus = status;
      firstRaw = json;
    }
    const r = rows(json);
    if (r.length === 0) break;
    all.push(...r);
    // stop if the API signals no next page
    const next = (json as Record<string, any>)?.data?.next;
    if (!next) break;
  }

  const own = await getJson("https://api.liveavatar.com/v1/avatars", key);
  const ownRows = rows(own.json);

  if (all.length === 0 && ownRows.length === 0) {
    return NextResponse.json({
      ok: false,
      note: "No avatars parsed — raw shown to inspect shape.",
      publicStatus: firstStatus,
      ownStatus: own.status,
      rawPublic: firstRaw,
      rawOwn: own.json,
    });
  }

  // Group by type so we can see if a non-VIDEO (streaming/interactive) set exists.
  const byType: Record<string, Av[]> = {};
  for (const a of all) {
    const t = String(a.type ?? "?");
    (byType[t] ||= []).push(a);
  }
  const typeCounts = Object.fromEntries(
    Object.entries(byType).map(([t, list]) => [t, list.length]),
  );
  // Show a few example IDs per type (not all 83) plus any owned avatars.
  const samplesByType = Object.fromEntries(
    Object.entries(byType).map(([t, list]) => [t, list.slice(0, 6)]),
  );

  return NextResponse.json({
    ok: true,
    publicCount: all.length,
    typeCounts,
    samplesByType,
    customAvatars: ownRows,
  });
}
