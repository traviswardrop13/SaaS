import { POSITIONS, SOUND_NORM } from "@/lib/homework";

// PLANDAY1: the day planner's checks and its prompt, kept out of the route
// file (a Next route may export only its handlers) so tests can run them.

export const AGES = ["3-4", "5-6", "7-8", "9+"];
export const MINUTES = [20, 30, 45];
export const MAX_SESSIONS = 8;
export const NAME_MAX = 40;
export const HOW_MAX = 220;

export const POS_WORDS: Record<string, string> = {
  i: "the beginning of words", m: "the middle of words", f: "the end of words",
  v: "vocalic R", b: "consonant blends", mix: "any position in words",
};

export const PLAN_PROMPT = `You help a pediatric speech-language clinician prepare tomorrow's sessions. You get a JSON list of sessions. Each has a target sound (a letter code; "TH" is the voiceless th, "THV" the voiced th), the word position being practiced, the child's age range, and the session length in minutes. For each session, suggest 2 or 3 play-based activities the clinician can run with ordinary clinic materials (picture cards, board games, toys, books, crafts, movement). For each activity, say in one or two plain sentences how target practice fits into the play and one way to make it easier or harder. Fit the activities to the age range and to the time. Do not list practice words or stimulus items: the clinician chooses those. Do not diagnose, set goals, evaluate, score, or mention a child by name. Return only a JSON object: {"sessions":[{"activities":[{"name":"...","how":"..."}]}]} with one entry per session, in the same order. Each name is at most ${NAME_MAX} characters and each "how" at most ${HOW_MAX} characters.`;

export type PlanSession = { sound: string; position: string; age: string; minutes: number };

export function validSessions(input: unknown): PlanSession[] | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const list = (input as Record<string, unknown>).sessions;
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_SESSIONS) return null;
  const out: PlanSession[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const { sound, position, age, minutes } = raw as Record<string, unknown>;
    if (typeof sound !== "string" || !Object.hasOwn(SOUND_NORM, sound)) return null;
    if (typeof position !== "string" || !POSITIONS.includes(position)) return null;
    if (position === "v" && sound !== "R") return null;
    if (position === "b" && !["R", "S", "L"].includes(sound)) return null;
    if (typeof age !== "string" || !AGES.includes(age)) return null;
    if (typeof minutes !== "number" || !MINUTES.includes(minutes)) return null;
    // Rebuilt field by field, so nothing else the page sent can ride along.
    out.push({ sound, position, age, minutes });
  }
  return out;
}

export function readPlans(text: string, count: number): { name: string; how: string }[][] | null {
  const json = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return null; }
  const list = parsed && typeof parsed === "object" ? (parsed as { sessions?: unknown }).sessions : null;
  if (!Array.isArray(list) || list.length !== count) return null;
  const plans: { name: string; how: string }[][] = [];
  for (const entry of list) {
    const acts = entry && typeof entry === "object" ? (entry as { activities?: unknown }).activities : null;
    if (!Array.isArray(acts) || acts.length < 1) return null;
    const kept: { name: string; how: string }[] = [];
    for (const a of acts.slice(0, 3)) {
      const name = a && typeof a.name === "string" ? a.name.trim() : "";
      const how = a && typeof a.how === "string" ? a.how.trim() : "";
      if (!name || name.length > NAME_MAX || !how || how.length > HOW_MAX) return null;
      kept.push({ name, how });
    }
    plans.push(kept);
  }
  return plans;
}
