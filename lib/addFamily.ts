// ADD A FAMILY (SLPCLEAN1, 17 Nov 2026): what /api/slp/family reads from the
// dashboard's "Add a family" panel, kept out of the route file (a Next route
// may export only its handlers) so tests can run it.
//
// The panel sends the parent's email (required) and, only if the clinician
// gave them, initials or a nickname, an age and up to three sounds. Nothing
// else is read: the invite is built from these alone (lib/roster's
// normalizeInvite clamps each), so no child's name, note or anything else
// the page might send rides along.

/** What the pending list shows when the clinician gave no initials. */
export const DEFAULT_LABEL = "New family";

/**
 * The parent's address, the shape the other email boxes accept and no longer
 * than an address can be (RFC 5321). "" when missing, null when it does not
 * look like an address.
 */
export function parentEmailOf(v: unknown): string | null {
  if (v === undefined || v === null) return "";
  const e = String(v).trim();
  if (!e) return "";
  if (e.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return null;
  return e;
}

/**
 * The invite's fields, from the panel's optional ones only: initials, age, up
 * to three sounds, and since 25 Nov 2026 (CHILDGAMES1) where in the word and
 * the games the therapist picked. normalizeInvite clamps each (an unknown
 * position is "mix", an unknown game is dropped, no list is every game).
 */
export function familyInvite(body: Record<string, unknown>): { label: unknown; age: unknown; sounds: unknown; pos: unknown; repsPerDay: number; note: string; games: unknown } {
  const label = typeof body.label === "string" && body.label.trim() ? body.label : DEFAULT_LABEL;
  return { label, age: body.age, sounds: Array.isArray(body.sounds) ? body.sounds : [], pos: typeof body.pos === "string" ? body.pos : "mix", repsPerDay: 20, note: "", games: Array.isArray(body.games) ? body.games : null };
}
