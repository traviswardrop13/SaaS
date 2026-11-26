// THE GAMES A THERAPIST PICKS FOR A CHILD (CHILDGAMES1, 25 Nov 2026).
//
// Travis: when a therapist sends a parent a login, "be able to customize the
// app for them before hand so like being able to choose the sound and word
// position even the games for them to play. so they can give full access or
// limited access and customize it for each kid."
//
// The sound and the position already ride the invite into the child's first
// homework (app/api/slp/claim). The games are this: a list of catalog game
// keys, or nothing (every game, as before). It lives in its own hash beside
// homework's (`hwgames:<code>`, field childId), not inside the homework
// record, because every homework write replaces that record whole and a
// clinician's new assignment must never quietly give a child every game
// back. The child's device reads it with its homework (/api/homework) and
// hides every other catalog game: no card, no grey slot, no price screen.
// Stories and books are never limited by it.
//
// A limit is never access: a game on the list that the family's plan does not
// open stays locked exactly as before. Removing the child, or deleting the
// clinician's account, deletes the list with the rest (lib/roster
// removeChild, lib/slpDelete).
import { kvCmd } from "@/lib/slpAuth";
import { GAMES } from "@/lib/sonaCatalog";

type Kv = (cmd: (string | number)[]) => Promise<unknown>;

/** Every game a therapist may pick: the catalog Session games plays from. */
export const PICKABLE_GAMES: string[] = GAMES.map((g) => g.key);
const TTL = 60 * 60 * 24 * 150;   // ~5 months, the homework hash's

export function gamesKey(code: string): string {
  return "hwgames:" + String(code || "").toLowerCase();
}

/**
 * A picked list, cleaned: known game keys only, each once, in the catalog's
 * order. `null` means every game: anything that is not a list, and a list
 * that names no known game (a child is never left with nothing to play).
 */
export function cleanGames(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const want = new Set(v.map((x) => String(x || "").toLowerCase()));
  const out = PICKABLE_GAMES.filter((k) => want.has(k));
  return out.length ? out : null;
}

export async function readGames(code: string, childId: string, kv: Kv = kvCmd): Promise<string[] | null> {
  const raw = await kv(["HGET", gamesKey(code), String(childId)]);
  if (!raw) return null;
  try { return cleanGames(JSON.parse(String(raw))); } catch { return null; }
}

/** `null` (every game) deletes the row. */
export async function writeGames(code: string, childId: string, games: string[] | null, kv: Kv = kvCmd): Promise<void> {
  const g = cleanGames(games);
  if (!g) { await kv(["HDEL", gamesKey(code), String(childId)]); return; }
  await kv(["HSET", gamesKey(code), String(childId), JSON.stringify(g)]);
  await kv(["EXPIRE", gamesKey(code), TTL]);
}
