import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

/**
 * Friday parent email (Vercel cron → GET, or manual with ?key=FOUNDER_KEY).
 *
 * What it sends — and what it deliberately can't: per-child practice data
 * lives ON DEVICE (the reps beacon is anonymous by design), so this email is
 * a warm weekly nudge with COHORT-level stats plus a link to the in-app
 * report where the family's real numbers live. No child data ever leaves
 * the device to make this email possible.
 *
 * Recipients: the `trials` KV set (families who left an email in the app),
 * minus the `email:unsub` set. Sends via Resend (RESEND_API_KEY). Set
 * RESEND_FROM once the domain is verified in Resend, e.g.
 * "Sona <hello@speaksona.com>" — until then the Resend sandbox sender is
 * used, which only reaches the account owner's own address.
 *
 * Safety: one send per ISO week (KV NX lock; ?force=1 with the founder key
 * overrides), 200-recipient cap per run, per-send failures never abort the
 * batch. Auth: Vercel cron's `Authorization: Bearer CRON_SECRET` when that
 * env is set, or ?key=FOUNDER_KEY for a manual run.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

async function kvCmd(cmd: (string | number)[]): Promise<unknown> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) return undefined;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    if (!r.ok) return undefined;
    const j = (await r.json()) as { result?: unknown };
    return j.result;
  } catch {
    return undefined;
  }
}

function isoWeek(d = new Date()): string {
  // same math as sona.js isoWeek: Thursday-anchored ISO week
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const start = new Date(Date.UTC(y, 0, 1));
  const wk = Math.ceil(((t.getTime() - start.getTime()) / 86400000 + 1) / 7);
  return y + "-W" + String(wk).padStart(2, "0");
}

function unsubToken(email: string): string {
  const secret = process.env.UNSUB_SECRET || process.env.FOUNDER_KEY || "sona";
  return createHmac("sha256", secret).update(email).digest("hex").slice(0, 24);
}

const TIPS = [
  "Practice lands best in tiny bursts — two minutes in the car counts.",
  "Let them hear YOU try the sound and miss — kids love coaching the grown-up.",
  "The chest opens after 5 rounds — racing the chest beats “go practice.”",
  "Story Time counts as practice their brain doesn't notice.",
  "Same time every day beats twice as long every other day.",
];

function emailHtml(opts: { cohortLine: string; tip: string; unsubUrl: string }): string {
  return `<!doctype html><body style="margin:0;padding:0;background:#fff6e9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff6e9;padding:28px 14px;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
<tr><td style="text-align:center;padding-bottom:14px;font-size:26px;font-weight:800;color:#0e9add;">Sona</td></tr>
<tr><td style="background:#ffffff;border-radius:20px;padding:26px 24px;">
  <div style="font-size:20px;font-weight:800;color:#4a2c14;">Your week of brave sounds 🧡</div>
  <p style="margin:12px 0 0;font-size:14.5px;line-height:1.6;color:#6b5138;">${opts.cohortLine}</p>
  <p style="margin:12px 0 0;font-size:14.5px;line-height:1.6;color:#6b5138;">Your child's own week — reps, sounds, and the clips worth hearing twice — is waiting in your report.</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto 6px;"><tr><td style="border-radius:14px;background:#ff8a3d;">
    <a href="https://speaksona.com/progress.html" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;">Open your report</a>
  </td></tr></table>
  <p style="margin:18px 0 0;padding:12px 14px;background:#fff6e9;border-radius:12px;font-size:13px;line-height:1.55;color:#6b5138;"><b style="color:#4a2c14;">Rachel's tip:</b> ${opts.tip}</p>
</td></tr>
<tr><td style="text-align:center;padding:16px 8px 0;font-size:11.5px;color:#b08d63;">
  Sona · Wardrop Ventures LLC · <a href="${opts.unsubUrl}" style="color:#b08d63;">Unsubscribe</a>
</td></tr>
</table></td></tr></table></body>`;
}

export async function GET(req: NextRequest) {
  // auth: Vercel cron bearer, or the founder key for a manual run
  const auth = req.headers.get("authorization") || "";
  const key = req.nextUrl.searchParams.get("key") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  const founderKey = process.env.FOUNDER_KEY || "";
  const okCron = cronSecret && auth === `Bearer ${cronSecret}`;
  const okManual = founderKey && key === founderKey;
  if (!okCron && !okManual) return NextResponse.json({ ok: false }, { status: 401 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ ok: false, error: "RESEND_API_KEY missing." }, { status: 503 });

  const week = isoWeek();
  const force = req.nextUrl.searchParams.get("force") === "1" && okManual;

  // once per week, ever — the lock is taken before any send
  if (!force) {
    const lock = await kvCmd(["SET", "weekly:sent:" + week, String(Date.now()), "NX"]);
    if (lock === null) return NextResponse.json({ ok: true, skipped: "already sent " + week });
    if (lock === undefined) return NextResponse.json({ ok: false, error: "No KV store." }, { status: 503 });
    await kvCmd(["EXPIRE", "weekly:sent:" + week, 60 * 60 * 24 * 21]);
  }

  // recipients: trial emails minus unsubscribes
  const raw = (await kvCmd(["SMEMBERS", "trials"])) as string[] | undefined;
  const emails = (raw || []).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e))).slice(0, 200);
  const unsubbed = new Set<string>();
  for (const e of emails) {
    const u = await kvCmd(["SISMEMBER", "email:unsub", e]);
    if (u === 1 || u === "1") unsubbed.add(e);
  }
  const to = emails.filter((e) => !unsubbed.has(e));

  // cohort stats from the anonymous weekly board
  const flat = (await kvCmd(["HGETALL", "reps:" + week])) as unknown;
  let cohort = 0, total = 0;
  if (Array.isArray(flat)) for (let i = 1; i < flat.length; i += 2) { cohort++; total += parseInt(String(flat[i]), 10) || 0; }
  else if (flat && typeof flat === "object") for (const v of Object.values(flat as Record<string, unknown>)) { cohort++; total += parseInt(String(v), 10) || 0; }
  const cohortLine = cohort >= 3
    ? `This week, Sona families logged <b style="color:#4a2c14;">${total.toLocaleString()} practice reps</b> — every one of them a brave little rep out loud.`
    : `Another week of brave sounds in the books — every rep out loud counts.`;

  const from = process.env.RESEND_FROM || "Sona <onboarding@resend.dev>";
  const tip = TIPS[Math.floor(Date.now() / 604800000) % TIPS.length];
  let sent = 0, failed = 0;
  for (const email of to) {
    try {
      const unsubUrl = `https://speaksona.com/api/email/unsub?e=${encodeURIComponent(email)}&k=${unsubToken(email)}`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: email,
          subject: "Your week of brave sounds — Sona",
          html: emailHtml({ cohortLine, tip, unsubUrl }),
          headers: { "List-Unsubscribe": `<${unsubUrl}>` },
        }),
      });
      if (r.ok) sent++; else failed++;
      await new Promise((res) => setTimeout(res, 600)); // stay under Resend's rate limit
    } catch {
      failed++;
    }
  }
  return NextResponse.json({ ok: true, week, recipients: to.length, sent, failed, cohort, totalReps: total });
}
