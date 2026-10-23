import { createHash } from "crypto";
import { kvCmd } from "@/lib/slpAuth";
import { APP_URL, DAY_MS, DUE_KEY, config, esc } from "@/lib/nurture";
import { PACE_MS, SEND_DAYS, addressOk, confirmKey, kidLines, mailHash, mondayOf, range, resend, sentKey, suppressed, unsubUrlFor, type Kid } from "@/lib/report";
import { KIT_DONE, everyone, type Contact } from "@/lib/contacts";

/**
 * THE MONDAY EMAIL (Travis, 23 Oct 2026: "afterwards, I want to do 1 email a
 * week that's kind of like the weekly progress report. And just send it to
 * everybody so that they get one every week ... every Monday and if they're
 * not signed up, it'll just say like what they could be monitoring. So that
 * they can see what a report would look like if they were signed up"; then
 * "Parents only").
 *
 * Every parent on Sona's list hears from Sona once a week, on Monday (Tuesday
 * and Wednesday catch up, as the report does):
 *  - a household that turned the weekly progress report on and confirmed it
 *    gets the real one (lib/report.ts runReports, which runs first), and
 *    nothing from here: an address that was sent this week's report, or that
 *    has a phone confirmed for it (`report:dev:<hash>`, even in a week with
 *    no practice, which sends no report), is left alone;
 *  - everyone else gets EXAMPLE's report, the real email's own lines with
 *    made-up numbers, marked "Example", and how to turn theirs on (Grown-ups,
 *    then Settings: settings.html's weekly report switch).
 * Nothing about a child, ever: the example's numbers are typed here.
 *
 * Who: the addresses Sona holds (lib/contacts everyone(): the leads ledger
 * and the clinician accounts), a parent or a lead with no role (the Speech
 * Check, the reminder pledge), never a speech therapist, a clinician account
 * or someone who chose "Other". Not while their welcome series is still on
 * (`nurture:due`), nor in their first three days, so the series' three emails
 * come first. Never anyone in `email:unsub` (that address or its plain
 * mailbox). An address that joined before Resend took the list from Kit (16
 * Oct 2026), or with no sign-up time (`nurture:0` lasts a year), waits until
 * Kit's leavers are in `email:unsub` (KIT_DONE), as the backfill does:
 * someone who left Kit is never written to again.
 *
 * Once an address a week (`weekly:sent:<monday>:<email>`, SET NX, released
 * when Resend does not take it or the store did not answer). An address that
 * is not for this week (the series, a real report, unsubscribed) keeps its
 * mark, so the catch-up runs pass it with one call. Paced for Resend's limit,
 * at most WEEKLY_CAP sends a run, stopping before the cron's time runs out
 * and on a second 429. The order is shuffled by the week, so a run that
 * stops early leaves a different tail each week, never the same parents.
 *
 * KNOWN LIMITS, both far off on 23 Oct 2026, and both said in the run's
 * answer rather than hidden: the audience is everyone(), whose leads come
 * from a ledger capped at LEDGER_CAP rows (`full`: past that, the oldest
 * parents drop off), and three runs of WEEKLY_CAP send about 750 a week
 * (`stopped: "cap"` on Wednesday means some waited a week; past that it
 * needs Resend's batch send and its own list of parents).
 *
 * Wording is Rachel's to change (renderExample); weeklytest holds it to the
 * house email rules: her byline, the hedge, no clinical words, no emoji, no
 * prices, no name.
 */

type Kv = (cmd: (string | number)[]) => Promise<unknown>;
type Fetch = typeof fetch;

export const WEEKLY_CAP = 250;
export const WEEKLY_KEEP_SEC = 10 * 24 * 60 * 60;
export const SERIES_DAYS = 3;
export const KIT_CUTOFF = Date.parse("2026-10-17T00:00:00Z");
export const weeklyKey = (wk: string, email: string) => "weekly:sent:" + wk + ":" + email;

/** The example's child: made-up numbers, in the real report's shape (no plan: most families never pick one). */
export const EXAMPLE: Kid = { d: 4, g: 3, r: 86, p: 52, s: ["R"] };

export function renderExample(wk: string, unsubUrl: string, postal: string): { subject: string; html: string; text: string } {
  const subject = "Your child’s week on Sona, every Monday";
  const preview = "Here’s what Sona’s weekly progress report shows.";
  const intro = ["Hi there,", "Sona can email you a short progress report every Monday, with last week’s practice from your phone. Here’s what one looks like:"];
  const head = `Example · ${range(wk)}`;
  const lines = kidLines(EXAMPLE);
  const madeUp = "These numbers are made up. Yours would show your child’s own week.";
  const how = "To get yours, open Sona, tap Grown-ups, and turn on Weekly progress report in Settings.";
  const button = "Open Sona";
  const after = [
    "Already turned it on? Tap the link in the email we sent you, and the next one will be your child’s.",
    "A rep is one time your child says their sound or word out loud. Silence never counts.",
  ];
  const hedge = "The report is a practice snapshot from your phone, not an evaluation.";
  const footer = "You’re getting this because you gave Sona your email.";

  const P = 'style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;"';
  const html =
    `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff;">` +
    `<div style="display:none;max-height:0;overflow:hidden;">${esc(preview)}</div>` +
    `<div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    intro.map((p) => `<p ${P}>${esc(p)}</p>`).join("") +
    `<div style="margin:0 0 8px;padding:14px 16px;background:#fff6e9;border-radius:12px;">` +
    `<p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#2b2b2b;">${esc(head)}</p>` +
    lines.map((l) => `<p style="margin:0 0 6px;font-size:16px;line-height:1.5;color:#2b2b2b;">${esc(l)}</p>`).join("") +
    `</div>` +
    `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#6b6b6b;">${esc(madeUp)}</p>` +
    `<p ${P}>${esc(how)}</p>` +
    `<p style="margin:24px 0 16px;"><a href="${APP_URL}" style="display:inline-block;background:#ff8a3d;color:#ffffff;text-decoration:none;font-weight:700;font-size:17px;padding:13px 26px;border-radius:12px;">${esc(button)}</a></p>` +
    after.map((p) => `<p ${P}>${esc(p)}</p>`).join("") +
    `<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#6b6b6b;">${esc(hedge)}</p>` +
    `<p style="margin:24px 0 16px;font-size:16px;line-height:1.55;color:#2b2b2b;">Rachel, MS, CF-SLP<br>Sona co-founder</p>` +
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#8a8a8a;">${esc(footer)}<br>Sona · ${esc(postal)}<br><a href="${unsubUrl}" style="color:#8a8a8a;">Unsubscribe</a></p>` +
    `</div></body></html>`;
  const text =
    intro.join("\n\n") + "\n\n" +
    head + "\n" + lines.map((l) => "- " + l).join("\n") + "\n\n" +
    madeUp + "\n\n" + how + "\n\n" + `${button}: ${APP_URL}\n\n` +
    after.join("\n\n") + "\n\n" + hedge + "\n\n" +
    "Rachel, MS, CF-SLP\nSona co-founder\n" +
    `--\n${footer}\nSona · ${postal}\nUnsubscribe: ${unsubUrl}\n`;
  return { subject, html, text };
}

/** A parent, or a lead that never said (every one of those is a parent's: lib/contacts roleOf). */
export const isParent = (c: Contact) => c.role === "parent" || c.role === "";

export type WeeklyResult = { week: string | null; people: number; sent: number; failed: number; skipped: number; waiting: number; stopped?: string; full?: boolean };
/** The leads ledger's length cap (/api/lead LTRIM 0 9999, lib/founder readLeads). */
export const LEDGER_CAP = 10000;

/**
 * Monday's send, after the reports (Tuesday and Wednesday catch up). `force`
 * (a founder's manual run, ?weekly=1) sends on any day, still once an address
 * a week. `deadline` (real time, ms) stops before the function is cut off.
 * `people` is everyone() unless a test hands in its own.
 */
export async function runWeekly(kv: Kv = kvCmd, f: Fetch = fetch, now: number = Date.now(),
  opts: { force?: boolean; deadline?: number; sleep?: (ms: number) => Promise<void>; people?: () => Promise<Contact[]> } = {}): Promise<WeeklyResult> {
  const res: WeeklyResult = { week: null, people: 0, sent: 0, failed: 0, skipped: 0, waiting: 0 };
  const cfg = config();
  if (!cfg || (!opts.force && !SEND_DAYS.includes(new Date(now).getUTCDay()))) return res;
  const sleep = opts.sleep || ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  // the week the reports cover, so the example is dated like the real one
  const wk = mondayOf(now - 7 * DAY_MS);
  res.week = wk;
  let kitDone = false;
  try { kitDone = !!(await kv(["GET", KIT_DONE])); } catch { kitDone = false; }
  let all: Contact[] = [];
  try { all = await (opts.people || everyone)(); } catch (e) { res.stopped = "no list"; console.error("[weekly] list:", e instanceof Error ? e.message : String(e)); return res; }
  const seen = new Set<string>();
  const list = all.filter(isParent).map((c) => addressOk(c.email)).filter((e) => e && !seen.has(e) && seen.add(e))
    .map((e) => ({ e, o: createHash("sha256").update(wk + " " + e).digest("hex") }))
    .sort((a, b) => (a.o < b.o ? -1 : 1)).map((x) => x.e);
  res.people = list.length;
  // no silent caps: once the ledger is full, the parents whose only rows were
  // trimmed are not in everyone() and get no Monday email; the run says so
  try {
    if (Number(await kv(["LLEN", "leads:all"])) >= LEDGER_CAP) { res.full = true; console.error("[weekly] the leads ledger is full: the oldest parents are no longer on the Monday list"); }
  } catch { /* only a warning */ }
  let tries = 0;
  for (const email of list) {
    if (tries >= WEEKLY_CAP) { res.stopped = "cap"; break; } // the next run picks up the rest
    if (opts.deadline && Date.now() > opts.deadline) { res.stopped = "time"; break; }
    const mark = weeklyKey(wk, email);
    if ((await kv(["SET", mark, String(now), "NX", "EX", WEEKLY_KEEP_SEC])) !== "OK") { res.skipped++; continue; } // done this week, or no answer
    // keep: not for this week, the mark stays; release: try again next run
    let keep = false, release = true;
    try {
      const unsub = await suppressed(email, kv);
      if (unsub === null) continue;
      if (unsub) { keep = true; continue; }
      const joined = await kv(["GET", "nurture:0:" + email]);
      if (joined === undefined) continue;
      const started = typeof joined === "string" ? Date.parse(joined) : NaN;
      const inSeries = await kv(["ZSCORE", DUE_KEY, email]);
      if (inSeries === undefined) continue;
      if (inSeries !== null || (Number.isFinite(started) && now - started < SERIES_DAYS * DAY_MS)) { keep = true; continue; }
      if (!kitDone && !(started >= KIT_CUTOFF)) { res.waiting++; continue; }
      const got = await kv(["EXISTS", sentKey(wk, email)]);
      const devs = await kv(["SCARD", confirmKey(mailHash(email, cfg.secret))]);
      if (got === undefined || got === null || devs === undefined || devs === null) continue;
      if (Number(got) > 0 || Number(devs) > 0) { keep = true; continue; } // the real report is theirs
      tries++;
      const unsubUrl = unsubUrlFor(email, cfg.secret);
      const m = renderExample(wk, unsubUrl, cfg.postal);
      const key = `weekly-${wk}-${createHash("sha256").update(email).digest("hex").slice(0, 32)}`;
      let r = { ok: false, status: 0 };
      for (let attempt = 0; attempt < 2; attempt++) {
        await sleep(attempt ? PACE_MS * 3 : PACE_MS);
        r = await resend(f, cfg, { to: email, ...m, unsubUrl, key });
        if (r.status !== 429) break;
      }
      if (r.ok) { res.sent++; release = false; continue; }
      res.failed++;
      if (r.status === 429) { res.stopped = "rate"; break; } // still too fast: the next run carries on
    } catch (e) {
      res.failed++;
      console.error("[weekly] address failed:", e instanceof Error ? e.message : String(e));
    } finally {
      if (keep) { res.skipped++; release = false; }
      if (release) await kv(["DEL", mark]);
    }
  }
  return res;
}
