import { NextRequest, NextResponse } from "next/server";
import { readSession, kvCmd, kvConfigured, rosterKey, healLegacyRoster } from "@/lib/slpAuth";
import { readAllHomework, hwStatus, type Homework, type HomeworkRecord } from "@/lib/homework";
import { readMeta, readInvites, readGone, readAccount, type ChildMeta } from "@/lib/roster";

/**
 * SLP master roster — returns each family's latest progress for the SIGNED-IN
 * SLP's own code (slp:<code> → { childId: record }, written by /api/pilot),
 * with what the dashboard needs beside it: the clinician's own per-child
 * notes (slpmeta), each child's homework status (hw), and the invites that
 * have not been tapped yet.
 *
 * The roster holds children's names, ages and progress, so the code is derived
 * from the authenticated session — NOT from a query param. The clinic slug is a
 * public share slug (printed on every family link), so trusting ?code= let
 * anyone holding a link read the whole roster.
 *
 * What is merged and what wins. The device's roster row is practice truth
 * (reps, outcomes, streak, last sync) and is returned as-is. The clinician's
 * meta rides beside it under `meta`, never spliced INTO it: the name a
 * clinician typed on an invite and the name a parent typed at onboarding can
 * differ, and the dashboard should show both rather than have this route
 * pick. A child who was taken off — by the clinician, or by the family's
 * own "stop sharing" — is left out entirely, even if a stale device row is
 * still there: slpgone is the decision, the row is the leftover.
 *
 * Degrades gracefully: if no KV store is configured, returns configured:false so
 * the SLP page can still show the share link + handout.
 */
export const runtime = "nodejs";

type RosterRow = { childId?: string; at?: string; [k: string]: unknown };

/**
 * The assignment as the clinician wrote it. The device-facing fields
 * (/api/homework's publicHomework) plus createdAt and the above-norm flag —
 * the clinician was shown that flag when they assigned, so they see it here.
 */
function hwSummary(hw: Homework) {
  return {
    id: hw.id, title: hw.title, note: hw.note, sounds: hw.sounds, pos: hw.pos,
    repsPerDay: hw.repsPerDay, words: hw.words, start: hw.start, due: hw.due, by: hw.by,
    createdAt: hw.createdAt, aboveNorm: hw.aboveNorm,
  };
}

/**
 * status / assignment / days-practiced for one child. Days are shown only
 * for the assignment they were practiced against (the same id check
 * hwStatus makes), so last month's ledger never reads as this week's.
 */
function hwFor(rec: HomeworkRecord | undefined): { status: ReturnType<typeof hwStatus>; hw: ReturnType<typeof hwSummary> | null; days: Record<string, number> } {
  if (!rec) return { status: "none", hw: null, days: {} };
  const days = rec.hw && rec.progress && rec.progress.id === rec.hw.id ? rec.progress.days || {} : {};
  return { status: hwStatus(rec), hw: rec.hw ? hwSummary(rec.hw) : null, days };
}

export async function GET(req: NextRequest) {
  // roster read requires the SLP's own session; the code comes from the
  // authenticated account, never the query string.
  const s = readSession(req);
  if (!s) return NextResponse.json({ ok: false, error: "sign in required" }, { status: 401 });
  if (!kvConfigured()) return NextResponse.json({ ok: true, configured: false, kids: [], invites: [] });
  const { code } = await readAccount(s.email);
  if (!code) return NextResponse.json({ ok: true, configured: true, kids: [], invites: [] });

  // Families who enrolled while the roster key was case-mismatched wrote to
  // slp:<UPPERCASE> and have been invisible here ever since. Pull them back
  // before reading — idempotent, and this is the screen where their absence
  // would otherwise look like "nobody signed up".
  await healLegacyRoster(code);

  const [flat, meta, homework, gone, invites] = await Promise.all([
    kvCmd(["HGETALL", rosterKey(code)]),
    readMeta(code),
    readAllHomework(code),
    readGone(code),
    readInvites(code),          // pending only; drops index rows whose 30-day data key has expired
  ]);

  // The hash FIELD is the child's id; the row's own childId is what the
  // device claimed, and the two agree except for malformed rows we skip.
  const rows = new Map<string, RosterRow>();
  if (Array.isArray(flat)) {
    for (let i = 0; i < flat.length; i += 2) {
      try {
        rows.set(String(flat[i]), JSON.parse(String(flat[i + 1])) as RosterRow);
      } catch {
        // skip malformed
      }
    }
  }

  // A child whose device claimed an invite but has not synced yet exists only
  // in meta (joinedAt, no practice, no name yet — the parent types that at
  // onboarding and the first sync brings it). They get a row with
  // `synced: false` so the clinician can see the tap landed.
  const ids = new Set<string>([...rows.keys(), ...Object.keys(meta)]);
  const kids: (RosterRow & { childId: string; synced: boolean; meta: ChildMeta | null; hw: ReturnType<typeof hwFor> })[] = [];
  for (const childId of ids) {
    if (gone.has(childId)) continue;
    const row = rows.get(childId);
    kids.push({
      ...(row || {}),
      childId,
      synced: !!row,
      meta: meta[childId] || null,
      hw: hwFor(homework[childId]),
    });
  }
  kids.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));

  return NextResponse.json({
    ok: true,
    configured: true,
    kids,
    // Pending invites only — readInvites skips claimed index rows (a claimed
    // invite is a child now, listed above under the childId that claimed it,
    // and its label was discarded at the claim). Each carries expiresAt so
    // the page can say when it deletes itself.
    invites: invites.map((i) => ({
      token: i.token, label: i.label, age: i.age, sounds: i.sounds, pos: i.pos,
      repsPerDay: i.repsPerDay, note: i.note, createdAt: i.createdAt, expiresAt: i.expiresAt,
    })),
  });
}
