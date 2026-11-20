// SESSION GAMES (SLPPRO1, 17 Nov 2026): the dashboard's AI picks Sona's own
// games for a session. Travis: "picks sona games but also give the slp the
// opp to suggest a new game or activity to be built inside the app". It
// replaced SLPCLEAN1's "Plan activities" (lib/activityPlan.ts), which wrote
// activities a clinician had to prepare ("not what I am after").
//
// What crosses to the AI: the target sound, where it sits in words, the age
// band, the session length, the clinician's optional few words on what the
// child loves (`loves`, the one free text, 120 characters), and the catalog
// (lib/sonaCatalog). Never a name, a roster, an account or practice data: the
// page asks for no name and refuses a caseload child's name in `loves`.
// What it suggests is Rachel's to review (PICKS_PROMPT). The checks live here,
// not in the route (a Next route file may export only its handlers), so tests
// run them.

import { AGE_BANDS, MINUTES, POSITION_LABEL, SOUND_LABEL, catalogFor, positionFits, soundOk, type CatalogItem } from "@/lib/sonaCatalog";

export const LOVES_MAX = 120;
export const WHY_MAX = 200;
export const HOW_MAX = 180;
export const HOW_MIN = 2;
export const HOW_MAXN = 3;
export const PICKS_MIN = 2;   // a reply with fewer usable picks is not used
export const PICKS_MAX = 4;   // a reply with more is not used
export const PICKS_KEEP = 3;  // what the clinician is shown

// Rachel's to review: every word of this prompt, and what it suggests.
export const PICKS_PROMPT = `You help a pediatric speech-language clinician choose what to play in a speech session, from the Sona app. You are given the child's target sound, where the sound sits in words, the child's age band, how long the session is, sometimes a few words on what the child loves, and a CATALOG of Sona's games, its talking story for the sound (when there is one) and its books for the sound. Sona itself chooses the practice words for the sound and position, listens for them, and makes the game move when the child says them.

Pick the 3 catalog items that fit this child best: their age (the catalog marks each game "3-4" or "5-8"), what they love, and the session length. Prefer variety (not three of the same kind of game). For each pick write:
- "why": one sentence on why it fits this child, at most ${WHY_MAX} characters.
- "how": 2 or 3 short steps for using it in the session, each at most ${HOW_MAX} characters: for example taking turns with the child, when the child says their word, and one way to make it easier or harder.

Only use keys from the catalog. Do not list practice words or stimulus items. Do not diagnose, set goals, evaluate or score. Never repeat any person's name; refer to "the child". If you cannot make sensible picks, return {"picks":[]}.

Return only JSON, with no other text: {"picks":[{"key":"...","why":"...","how":["...","..."]}]}`;

export type PickInput = { sound: string; pos: string; age: string; minutes: number; loves: string };
export type Pick = { key: string; kind: CatalogItem["kind"]; name: string; pic: string; why: string; how: string[] };

/**
 * The request, rebuilt field by field: anything else in it is never read.
 * `loves` is the one free text: control characters go, spaces close up, the
 * ends are trimmed, and the length is checked, never cut.
 */
export function readPickInput(input: unknown): PickInput | { error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Choose a sound first." };
  const b = input as Record<string, unknown>;
  const sound = typeof b.sound === "string" ? b.sound : "";
  if (!soundOk(sound)) return { error: "Choose a sound first." };
  const pos = typeof b.pos === "string" ? b.pos : "i";
  if (!positionFits(sound, pos)) return { error: "That word position doesn't fit " + sound + "." };
  const age = typeof b.age === "string" ? b.age : "";
  if ((AGE_BANDS as readonly string[]).indexOf(age) < 0) return { error: "Choose the child's age." };
  const minutes = Number(b.minutes === undefined ? 30 : b.minutes);
  if ((MINUTES as readonly number[]).indexOf(minutes) < 0) return { error: "Choose 20, 30 or 45 minutes." };
  let loves = "";
  if (b.loves !== undefined && b.loves !== null) {
    if (typeof b.loves !== "string") return { error: "Say what they love in a few words." };
    loves = b.loves.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim();
    if (loves.length > LOVES_MAX) return { error: "Keep what they love under " + LOVES_MAX + " characters." };
  }
  return { sound, pos, age, minutes, loves };
}

/** The one user message: the choices, the clinician's words, and the catalog. */
export function pickMessage(input: PickInput, items: CatalogItem[]): string {
  const sound = SOUND_LABEL[input.sound] || input.sound;
  return [
    "Target sound: " + sound,
    "Where it sits: " + POSITION_LABEL[input.pos],
    "Age: " + input.age,
    "Session: " + input.minutes + " minutes",
    "What the child loves: " + (input.loves || "(not given)"),
    "",
    "CATALOG (key: name, ages: what the child does)",
    ...items.map((c) => "- " + c.key + ": " + c.name + ", " + (c.ages === "all" ? "any age" : "ages " + c.ages) + ": " + c.does),
  ].join("\n");
}

function line(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t && t.length <= max ? t : null;
}

/**
 * The model's reply, read strictly. A pick of a key not in the catalog it was
 * shown, a repeat, or one with a field missing, empty or too long is dropped;
 * 2 to 4 picks must be left (the first 3 kept), or nothing is used (null). An
 * empty list is the model saying it could not pick ("empty").
 */
export function readPicks(reply: string, items: CatalogItem[]): Pick[] | "empty" | null {
  const json = String(reply || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return null; }
  const list = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as { picks?: unknown }).picks : null;
  if (!Array.isArray(list)) return null;
  if (list.length === 0) return "empty";
  if (list.length > PICKS_MAX) return null;
  const out: Pick[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const p = raw as Record<string, unknown>;
    const item = typeof p.key === "string" ? items.find((c) => c.key === p.key) : undefined;
    if (!item || out.some((o) => o.key === item.key)) continue;
    const why = line(p.why, WHY_MAX);
    if (!why || !Array.isArray(p.how) || p.how.length < HOW_MIN || p.how.length > HOW_MAXN) continue;
    const how = p.how.map((h) => line(h, HOW_MAX));
    if (how.some((h) => !h)) continue;
    out.push({ key: item.key, kind: item.kind, name: item.name, pic: item.pic, why, how: how as string[] });
  }
  if (out.length < PICKS_MIN) return null;
  return out.slice(0, PICKS_KEEP);
}

export { catalogFor };
