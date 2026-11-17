// SLPCLEAN1 (17 Nov 2026): the dashboard's AI planner, "Plan activities".
// Travis: "I want to make sure there's an AI that is specifically for in
// session activity creation and planning. So they can say, I have a kid who
// is 5, who's interested in XYZ, and then it auto creates activities for that
// kid." He chose free typing, and accepted what it means: the text the
// clinician types is the one thing that goes to the AI provider (Anthropic).
// The page asks them not to type a child's name, and the prompt tells the
// model never to repeat one.
//
// The checks and the prompt live here, not in the route (a Next route file
// may export only its handlers), so tests can run them. Replaced PLANDAY1's
// lib/dayPlan.ts and the AI homework draft.

export const TEXT_MIN = 3;
export const TEXT_MAX = 600;
export const NAME_MAX = 60;
export const NEED_MAX = 160;
export const STEP_MAX = 200;
export const ADJUST_MAX = 160; // "easier" and "harder" each
export const STEPS_MIN = 2;
export const STEPS_MAX = 4;
export const ACTS_MIN = 2;      // a reply with fewer is not used
export const ACTS_MAX = 4;      // a reply with more is not used
export const ACTS_KEEP = 3;     // what the clinician is shown

// Rachel's to review: every word of this prompt, and what it suggests.
export const ACTIVITY_PROMPT = `You help a pediatric speech-language clinician plan activities to run IN a speech session. The clinician describes a child and the session in their own words: usually the child's age, what the child is interested in, the target sound and where it sits in words, and how long the session is.

Write 3 play-based activities built around the child's interests, using ordinary clinic materials (picture cards, toys, board games, books, crafts, movement). For each activity, say how target practice fits into the play, and give one way to make it easier and one way to make it harder. Fit the activities to the child's age and to the session length.

Do not list practice words or stimulus items: the clinician chooses those. Do not diagnose, set goals, evaluate, or score. Never repeat any person's name that appears in the text; refer to "the child". If the text is not about planning a speech session, return activities only if you can still make sensible ones; otherwise return {"activities":[]}.

Return only JSON, with no other text: {"activities":[{"name":"...","need":"...","steps":["...","..."],"easier":"...","harder":"..."}]}
- "name": the activity's name, at most ${NAME_MAX} characters.
- "need": what the clinician needs for it, at most ${NEED_MAX} characters.
- "steps": 2 to 4 short steps, in order, each at most ${STEP_MAX} characters, saying where target practice fits into the play.
- "easier": one way to make it easier, at most ${ADJUST_MAX} characters.
- "harder": one way to make it harder, at most ${ADJUST_MAX} characters.`;

export type Activity = { name: string; need: string; steps: string[]; easier: string; harder: string };

/**
 * The request: `{ text }` and nothing else is read. Control characters go
 * (a newline stays), the ends are trimmed, and the length is checked, never
 * cut: a clinician's text is sent as typed or not at all.
 */
export function readText(input: unknown): { text: string } | { error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Describe the child and the session." };
  const raw = (input as Record<string, unknown>).text;
  if (typeof raw !== "string") return { error: "Describe the child and the session." };
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length < TEXT_MIN) return { error: "Describe the child and the session." };
  if (text.length > TEXT_MAX) return { error: "Keep it under " + TEXT_MAX + " characters." };
  return { text };
}

function field(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t && t.length <= max ? t : null;
}

/**
 * The model's reply, read strictly: 2 to 4 activities (the first 3 kept),
 * each with every field present, non-empty and within its limit. An empty
 * list is the model saying the text was not a session to plan ("empty").
 * Anything else is null, and the clinician is never shown it.
 */
export function readActivities(reply: string): Activity[] | "empty" | null {
  const json = String(reply || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return null; }
  const list = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as { activities?: unknown }).activities : null;
  if (!Array.isArray(list)) return null;
  if (list.length === 0) return "empty";
  if (list.length < ACTS_MIN || list.length > ACTS_MAX) return null;
  const out: Activity[] = [];
  for (const a of list.slice(0, ACTS_KEEP)) {
    if (!a || typeof a !== "object" || Array.isArray(a)) return null;
    const r = a as Record<string, unknown>;
    const name = field(r.name, NAME_MAX), need = field(r.need, NEED_MAX);
    const easier = field(r.easier, ADJUST_MAX), harder = field(r.harder, ADJUST_MAX);
    if (!name || !need || !easier || !harder || !Array.isArray(r.steps)) return null;
    if (r.steps.length < STEPS_MIN || r.steps.length > STEPS_MAX) return null;
    const steps: string[] = [];
    for (const s of r.steps) { const t = field(s, STEP_MAX); if (!t) return null; steps.push(t); }
    // Rebuilt field by field: nothing else the model wrote reaches the page.
    out.push({ name, need, steps, easier, harder });
  }
  return out;
}
