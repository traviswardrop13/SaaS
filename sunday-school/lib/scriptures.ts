import fs from "fs";
import path from "path";
import type { StudyVerse } from "./types";

/**
 * Access to the full LDS standard works (Old/New Testament, Book of Mormon,
 * Doctrine and Covenants, Pearl of Great Price) — 41,995 verses of real text.
 *
 * Every reference the app displays is resolved here against the real dataset,
 * so a fabricated or mistyped reference simply returns nothing and is dropped.
 * That's the guarantee: the class never sees a made-up verse.
 */

let MAP: Record<string, string> | null = null;

function load(): Record<string, string> {
  if (MAP) return MAP;
  const p = path.join(process.cwd(), "data", "scriptures.min.json");
  MAP = JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, string>;
  return MAP;
}

// Common ways a reference might be written → the canonical prefix the dataset
// uses. Only the book portion is normalized; chapter/verse are left intact.
const BOOK_ALIASES: [RegExp, string][] = [
  [/^doctrine\s*(and|&)\s*covenants/i, "D&C"],
  [/^d\s*&\s*c/i, "D&C"],
  [/^d\s*and\s*c/i, "D&C"],
  [/^dc\b/i, "D&C"],
  [/^joseph\s*smith[\s—–-]*history/i, "Joseph Smith—History"],
  [/^js[\s—–-]*h\b/i, "Joseph Smith—History"],
  [/^joseph\s*smith[\s—–-]*matthew/i, "Joseph Smith—Matthew"],
  [/^js[\s—–-]*m\b/i, "Joseph Smith—Matthew"],
  [/^articles\s*of\s*faith/i, "Articles of Faith"],
  [/^a\s*of\s*f\b/i, "Articles of Faith"],
  [/^song\s*of\s*songs/i, "Song of Solomon"],
];

function normalizeRef(input: string): string {
  let s = input.trim().replace(/\s+/g, " ");
  for (const [re, canonical] of BOOK_ALIASES) {
    if (re.test(s)) {
      s = s.replace(re, canonical);
      break;
    }
  }
  return s;
}

/**
 * Resolve one reference to its verse text. Supports a single verse
 * ("1 Nephi 3:7"), a verse range ("D&C 121:7-8", "Matthew 5:14-16"), and a
 * chapter-only reference ("Alma 32"). Returns null if nothing resolves.
 */
export function verseText(ref: string): string | null {
  const map = load();
  const norm = normalizeRef(ref);

  // Direct hit.
  if (map[norm]) return map[norm];

  const colon = norm.lastIndexOf(":");
  if (colon === -1) {
    // Chapter-only: gather every verse in that chapter, in order.
    const prefix = `${norm}:`;
    const verses = Object.keys(map)
      .filter((k) => k.startsWith(prefix))
      .sort((a, b) => versNum(a) - versNum(b));
    if (verses.length === 0) return null;
    return verses.map((k) => map[k]).join(" ");
  }

  const left = norm.slice(0, colon); // "Book Chapter"
  const spec = norm.slice(colon + 1).trim(); // "7" or "7-8" or "7–8"

  const rangeMatch = spec.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (end < start || end - start > 40) return map[`${left}:${start}`] ?? null;
    const parts: string[] = [];
    for (let v = start; v <= end; v++) {
      const t = map[`${left}:${v}`];
      if (t) parts.push(t);
    }
    return parts.length ? parts.join(" ") : null;
  }

  const single = spec.match(/^(\d+)/);
  if (single) return map[`${left}:${single[1]}`] ?? null;

  return null;
}

function versNum(key: string): number {
  const m = key.match(/:(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

/** True when a reference resolves to real scripture text. */
export function isValidRef(ref: string): boolean {
  return verseText(ref) !== null;
}

/**
 * Resolve a list of references to display verses, keeping the canonical form,
 * dropping any that don't resolve, and de-duplicating.
 */
export function resolveRefs(
  refs: { ref: string; why?: string }[],
): StudyVerse[] {
  const out: StudyVerse[] = [];
  const seen = new Set<string>();
  for (const { ref, why } of refs) {
    const norm = normalizeRef(ref);
    if (seen.has(norm)) continue;
    const text = verseText(norm);
    if (!text) continue;
    seen.add(norm);
    out.push({ ref: norm, text, why });
  }
  return out;
}
