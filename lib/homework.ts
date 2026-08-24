import { kvCmd } from "@/lib/slpAuth";

/**
 * Homework: what an SLP asks one child to practise, and how the app honours it.
 *
 * The design decision that matters: homework does NOT arrive as a to-do list
 * beside the app. It REPLACES what the daily rotation would have picked — the
 * child's device reads the assignment and rotSounds()/repGoal()/position all
 * defer to it. Homework the app ignores is a checkbox; homework that changes
 * tomorrow's words is a plan the clinician actually set.
 *
 * Storage is one hash per clinician, field per child: hw:<code> → { childId: json }.
 * Same shape and the same ~5-month expiry as the roster it sits beside, so a
 * caseload that goes quiet ages out of both together.
 *
 * NOT stored here, deliberately: no diagnosis, no goal-bank, no free-text
 * clinical notes. The moment this holds those it stops being practice data and
 * starts being a medical record, with everything that follows. The one free
 * text field is `note`, addressed to the PARENT, and it is capped and treated
 * as untrusted display text everywhere it is rendered.
 */

export const HW_MAX_SOUNDS = 3;
export const HW_MAX_WORDS = 24;
export const HW_MAX_DAYS = 120;
export const NOTE_MAX = 240;
export const TITLE_MAX = 60;

// Mirrors SOUND_NORM in sona.js — the age a sound is typically acquired. Kept
// here so the server can FLAG an assignment above a child's age without the
// dashboard being the only thing that knows. It flags; it does not block. An
// SLP assigning /r/ to a four-year-old may be exactly right in a way a parent
// picking it off a menu is not, so the override is recorded, not refused.
export const SOUND_NORM: Record<string, number> = {
  P: 3, B: 3, M: 3, N: 4, T: 4, D: 4, K: 4, G: 4, F: 4,
  V: 6, S: 5, Z: 6, SH: 6, CH: 6, J: 6, L: 6, R: 7, TH: 6, THV: 7,
};
export const POSITIONS = ["i", "m", "f", "v", "b", "mix"];

export type Homework = {
  id: string;
  title: string;
  note: string;              // to the parent, not a clinical note
  sounds: string[];
  pos: string;
  repsPerDay: number;
  words: string[] | null;    // null = use the app's own bank for those sounds
  start: string;             // YYYY-MM-DD, local to the clinician
  due: string;               // YYYY-MM-DD inclusive
  by: string;                // clinician display name, shown to the parent
  createdAt: string;
  aboveNorm: string[];       // sounds assigned above the child's age norm
  modelClip: null;           // reserved: the SLP's own voice modelling the word
};

export type HomeworkProgress = {
  id: string;
  days: Record<string, number>;   // YYYY-MM-DD → reps that day
  updatedAt: string;
};

export type HomeworkRecord = { hw: Homework | null; progress: HomeworkProgress | null };

export function hwKey(code: string): string {
  return "hw:" + String(code || "").toLowerCase();
}

export function isoDay(d = new Date()): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
}

function cleanDay(v: unknown, fallback: string): string {
  const s = String(v || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallback;
}

/** Days between two YYYY-MM-DD strings, a-to-b, ignoring clocks entirely. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  if (!ay || !by) return 0;
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/**
 * Normalise whatever the dashboard posted into something safe to store and
 * safe to hand a child's device. Everything is clamped rather than rejected:
 * a clinician mid-session should never lose an assignment to a validation
 * error they cannot see the cause of.
 */
export function normalizeHomework(input: unknown, opts: { by: string; childAge?: number }): Homework {
  const b = (input || {}) as Record<string, unknown>;
  const today = isoDay();

  const sounds = (Array.isArray(b.sounds) ? b.sounds : [])
    .map((s) => String(s || "").toUpperCase().replace(/[^A-Z]/g, ""))
    .filter((s, i, arr) => s && !!SOUND_NORM[s] && arr.indexOf(s) === i)
    .slice(0, HW_MAX_SOUNDS);

  const words = Array.isArray(b.words)
    ? (b.words as unknown[])
        .map((w) => String(w || "").toLowerCase().replace(/[^a-z' -]/g, "").trim())
        .filter((w, i, arr) => w && w.length <= 24 && arr.indexOf(w) === i)
        .slice(0, HW_MAX_WORDS)
    : [];

  const start = cleanDay(b.start, today);
  let due = cleanDay(b.due, start);
  if (daysBetween(start, due) < 0) due = start;
  if (daysBetween(start, due) > HW_MAX_DAYS) {
    const [y, m, d] = start.split("-").map(Number);
    due = isoDay(new Date(Date.UTC(y, m - 1, d + HW_MAX_DAYS)));
  }

  const age = clampInt(opts.childAge, 0, 18, 0);
  const aboveNorm = age ? sounds.filter((s) => SOUND_NORM[s] > age) : [];

  const pos = POSITIONS.indexOf(String(b.pos || "")) >= 0 ? String(b.pos) : "mix";

  return {
    id: String(b.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "hw" + Date.now().toString(36),
    title: String(b.title || "").slice(0, TITLE_MAX).trim() || "Practice at home",
    note: String(b.note || "").slice(0, NOTE_MAX).trim(),
    sounds: sounds.length ? sounds : ["R"],
    pos,
    repsPerDay: clampInt(b.repsPerDay, 5, 200, 20),
    words: words.length ? words : null,
    start,
    due,
    by: String(opts.by || "").slice(0, 60),
    createdAt: new Date().toISOString(),
    aboveNorm,
    modelClip: null,
  };
}

/** Active = today falls inside [start, due]. Nothing here reads a clock the child controls. */
export function isActive(hw: Homework | null, day = isoDay()): boolean {
  if (!hw) return false;
  return daysBetween(hw.start, day) >= 0 && daysBetween(day, hw.due) >= 0;
}

/**
 * Active / Completed / Missed — the reporting spine, derived from practice the
 * child already produced. "Completed" means they hit the daily rep target on
 * at least half the days of the assignment; "missed" means the window closed
 * and they did not. Deliberately coarse: this is a practice summary, never a
 * score, and it is never shown to the child.
 */
export function hwStatus(rec: HomeworkRecord, day = isoDay()): "none" | "active" | "completed" | "missed" {
  const hw = rec.hw;
  if (!hw) return "none";
  const days = (rec.progress && rec.progress.id === hw.id ? rec.progress.days : null) || {};
  const span = Math.max(1, daysBetween(hw.start, hw.due) + 1);
  let hit = 0;
  for (const k of Object.keys(days)) if (days[k] >= hw.repsPerDay) hit++;
  if (isActive(hw, day)) return "active";
  return hit >= Math.ceil(span / 2) ? "completed" : "missed";
}

export async function readHomework(code: string, childId: string): Promise<HomeworkRecord> {
  const raw = await kvCmd(["HGET", hwKey(code), String(childId)]);
  if (!raw) return { hw: null, progress: null };
  try {
    const j = JSON.parse(String(raw)) as HomeworkRecord;
    return { hw: j.hw || null, progress: j.progress || null };
  } catch {
    return { hw: null, progress: null };
  }
}

export async function writeHomework(code: string, childId: string, rec: HomeworkRecord): Promise<void> {
  await kvCmd(["HSET", hwKey(code), String(childId), JSON.stringify(rec)]);
  await kvCmd(["EXPIRE", hwKey(code), 60 * 60 * 24 * 150]); // ~5 months, same as the roster
}

export async function readAllHomework(code: string): Promise<Record<string, HomeworkRecord>> {
  const flat = await kvCmd(["HGETALL", hwKey(code)]);
  const out: Record<string, HomeworkRecord> = {};
  if (Array.isArray(flat)) {
    for (let i = 0; i < flat.length; i += 2) {
      try {
        const j = JSON.parse(String(flat[i + 1])) as HomeworkRecord;
        out[String(flat[i])] = { hw: j.hw || null, progress: j.progress || null };
      } catch {
        // skip malformed
      }
    }
  }
  return out;
}
