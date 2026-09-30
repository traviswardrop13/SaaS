import { NextRequest, NextResponse } from "next/server";
import { kvCmd } from "@/lib/slpAuth";
import { rateLimit } from "@/lib/rateLimit";
import { founderGate } from "@/lib/founder";

/**
 * QUICK NOTES FROM INSIDE THE FAMILY APP. Three places post here, all
 * fire-and-forget (keepalive, the answer never read), so the request shape is
 * fixed by what has already shipped:
 *  - the beta pulse on Home (public/today.html):
 *      { q: "pulse.chips", text, src: "pulse", code }
 *  - the "Quick thought on…" card on a game's win screen, in a pilot session
 *    or ?debug (Sona.gameFeedbackCard → sendFeedback):
 *      { game, sound, text, code, level, at }
 *  - the chips in Settings (public/settings.html):
 *      { q: "settings.chips", text, src: "settings" | "settings-slp", code }
 *
 * Brought up to /api/slp/feedback's standard on 29 Sep 2026. Until then it
 * fell back to PILOT_WEBHOOK_URL and then LEAD_WEBHOOK_URL (the pilot
 * collector and the old CRM slot), called a note "captured" when a hook
 * answered 500, always said ok, had no origin check, rate limit or body cap,
 * stored `code` and `childId` as the phone sent them under a KV key built
 * from that code (so any caller could mint keys), and put only pulse answers
 * where the founder could read them. Now:
 *  - same-origin only, a 20 KB body cap, 30 an hour per address;
 *  - the record is built field by field from an allowlist. childId, or
 *    anything else a phone adds, is dropped. A code is kept only if it has a
 *    code's shape: it says which clinician's link or founding code the family
 *    came through, never which child;
 *  - every note, from every surface, goes to ONE list (`fb:beta`, the key the
 *    pulse already used, newest first): the latest 2000, deleted a year after
 *    the last one, appended, capped and expired in one atomic step;
 *  - Slack (SLACK_FEEDBACK_WEBHOOK_URL) as plain_text, else only
 *    FEEDBACK_WEBHOOK_URL. Never the pilot or lead hooks;
 *  - 503 unless the store kept it or a notification accepted it.
 * The founder read is GET below: FOUNDER_KEY from a header (lib/founder), and
 * /leads.html shows it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 20000;
const KEY = "fb:beta";
const YEAR = 60 * 60 * 24 * 365;
// The game card sends no src; its `game` says where it came from.
const SOURCES = new Set(["pulse", "settings", "settings-slp", "onboarding"]);
const WHERE: Record<string, string> = {
  pulse: "Home pulse", settings: "Settings", "settings-slp": "Settings (clinician)", onboarding: "Setup survey", other: "The app",
};
// A clinician's code, a founding "ff-" code, or "pilot".
const CODE = /^[A-Za-z0-9_-]{1,48}$/;
const QUESTION = /^[A-Za-z0-9._-]{1,40}$/;
const SOUND = /^[A-Za-z]{1,4}$/;
// Newest first, so LTRIM keeps the head. The same one-step shape as the SLP
// inbox: a failed second request can never leave the list without an expiry.
const STORE_FEEDBACK = `
  local count = redis.call('LPUSH', KEYS[1], ARGV[1])
  redis.call('LTRIM', KEYS[1], 0, 1999)
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  return count
`;

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}
const shaped = (v: unknown, re: RegExp) => (typeof v === "string" && re.test(v.trim()) ? v.trim() : "");
function levelOf(v: unknown): number | "" {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,3}$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n < 1000 ? n : "";
}

export async function POST(req: NextRequest) {
  // A browser always sends Origin on a POST, so a missing one is a script.
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return fail("Please send this from the Sona app.", 403);
  }
  if (Number(req.headers.get("content-length")) > MAX_BODY) return fail("Please shorten your note.", 413);

  const limited = await rateLimit(req, { key: "feedback", limit: 30, windowSec: 3600 });
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY) return fail("Please shorten your note.", 413);
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("shape");
    body = value;
  } catch {
    return fail("Invalid JSON.");
  }

  // Only the note itself is required. Every other field is optional context,
  // and the callers never read this answer — so an odd one is dropped, not
  // allowed to cost the parent their note.
  if (typeof body.text !== "string" || !body.text.trim()) return fail("Please write a quick thought first.");
  const rec = {
    text: body.text.trim().slice(0, 1000),
    src: typeof body.src === "string" && body.src ? (SOURCES.has(body.src) ? body.src : "other") : "",
    q: shaped(body.q, QUESTION),
    game: typeof body.game === "string" ? body.game.trim().slice(0, 80) : "",
    sound: shaped(body.sound, SOUND).toUpperCase(),
    level: levelOf(body.level),
    code: shaped(body.code, CODE),
    // The server's clock, not the phone's.
    at: new Date().toISOString(),
  };

  // Stored whole: slicing a serialized record could corrupt it.
  const saved = await kvCmd(["EVAL", STORE_FEEDBACK, 1, KEY, JSON.stringify(rec), YEAR]);
  const stored = typeof saved === "number" && saved > 0;

  // Slack, as plain_text only — never mrkdwn — so "<!channel>" or a link a
  // stranger typed shows as the characters they typed. The top-level `text`
  // (which Slack does parse, for the notification) is a fixed phrase. The
  // code stays out of Slack: /leads.html has it.
  let slackSent = false;
  const slackUrl = process.env.SLACK_FEEDBACK_WEBHOOK_URL;
  if (slackUrl) {
    const title = rec.src === "pulse" ? "Beta pulse answer" : "In-app feedback";
    const where = rec.src ? WHERE[rec.src] : `${rec.game || "A game"}, win screen`;
    const details = [`From: ${where}`, rec.sound ? `Sound: ${rec.sound}` : "", rec.level !== "" ? `Level: ${rec.level}` : ""]
      .filter(Boolean).join("\n");
    try {
      const response = await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: title,
          blocks: [
            { type: "header", text: { type: "plain_text", text: title } },
            { type: "section", text: { type: "plain_text", text: details } },
            { type: "section", text: { type: "plain_text", text: rec.text } },
            { type: "context", elements: [{ type: "plain_text", text: `Sent at ${rec.at}` }] },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });
      slackSent = response.ok;
    } catch { /* the dedicated hook or the stored list may still have it */ }
  }

  // `kind: "game-feedback"` is the payload this hook has always received.
  let delivered = slackSent;
  const hook = process.env.FEEDBACK_WEBHOOK_URL;
  if (!delivered && hook) {
    try {
      const response = await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rec, kind: "game-feedback" }),
        signal: AbortSignal.timeout(5000),
      });
      delivered = response.ok;
    } catch { /* a confirmed KV save is still a received note */ }
  }

  if (!stored && !delivered) {
    return fail("We couldn't receive your note. Please try again shortly.", 503);
  }
  return NextResponse.json({ ok: true, stored, delivered, slackSent });
}

// ── FOUNDER READ — the "In-app answers" table on /leads.html ──
const LIMIT = 500;
type Row = Record<string, unknown>;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
function parse(raw: unknown): Row | null {
  try {
    const v = JSON.parse(String(raw));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : null;
  } catch { return null; }
}
// What the page may see of a stored note. Notes kept before 29 Sep 2026 can
// carry a childId; this allowlist is why it never leaves the store.
function clean(r: Row): Row {
  const level = typeof r.level === "number" || typeof r.level === "string" ? String(r.level).slice(0, 8) : "";
  return {
    text: str(r.text, 1000), src: str(r.src, 24), q: str(r.q, 80), game: str(r.game, 80),
    sound: str(r.sound, 16), level, code: str(r.code, 48), at: str(r.at, 40),
  };
}

// Before 29 Sep 2026 every note also went to a per-code list
// (`feedback:<code>`, kept ~6 months), and game and Settings notes went ONLY
// there, where nothing read them. Nothing writes them now; they are shown
// until they expire. Delete this walk after 28 Mar 2027.
async function legacyKeys(): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  let rounds = 0;
  do {
    const res = (await kvCmd(["SCAN", cursor, "MATCH", "feedback:*", "COUNT", 1000])) as [string, string[]] | undefined;
    if (!res) break;
    cursor = String(res[0]);
    for (const k of res[1] || []) if (keys.length < 200 && !keys.includes(k)) keys.push(k);
    rounds++;
  } while (cursor !== "0" && rounds < 200 && keys.length < 200);
  return keys;
}

export async function GET(req: NextRequest) {
  const denied = founderGate(req);
  if (denied) return denied;
  const items: Row[] = [];
  const seen = new Set<string>();
  // A pulse answer from before this build sits in both lists: show it once.
  const add = (s: unknown) => {
    const r = parse(s);
    if (!r) return;
    const row = clean(r);
    const id = row.at + "\n" + row.text;
    if (!row.text || seen.has(id)) return;
    seen.add(id);
    items.push(row);
  };
  for (const s of ((await kvCmd(["LRANGE", KEY, 0, LIMIT - 1])) as unknown[] | undefined) || []) add(s);
  for (const key of await legacyKeys()) {
    for (const s of ((await kvCmd(["LRANGE", key, -100, -1])) as unknown[] | undefined) || []) add(s);
  }
  items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return NextResponse.json({ ok: true, items: items.slice(0, LIMIT) }, { headers: { "Cache-Control": "no-store" } });
}
