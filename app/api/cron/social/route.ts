import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kvCmd, kvConfigured } from "@/lib/slpAuth";
import { dayKey, topicFor } from "@/lib/socialRules";
import {
  type DayRecord, missingEnv, paused, postState, postVideo, readDay, startVideo, videoState, writeDay, writeScript,
} from "@/lib/social";

/**
 * The daily short video (lib/social.ts says what and why). Vercel cron calls
 * this three times a day (vercel.json):
 *
 *   ?step=make  — write today's script, check it, start the HeyGen render
 *   ?step=post  — if today's render is done, post it everywhere
 *   ?step=post  — again three hours later, for a render that was slow
 *
 * Posting is once per day by construction: the day's record moves to
 * "posted" and Upload-Post is called with the day's own idempotency key.
 *
 * Auth: Vercel's cron bearer (CRON_SECRET), or the founder key in the
 * X-Founder-Key header for a manual run. Founder-only extras:
 *   ?step=status        — the last 14 days, and today's per-network results
 *   ?step=make&dry=1    — write and check a script, render nothing
 *
 * Stop it: set SOCIAL_PAUSED=1 in Vercel. Every step then does nothing.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

function same(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function who(req: NextRequest): "cron" | "founder" | null {
  const cron = process.env.CRON_SECRET || "";
  const founder = process.env.FOUNDER_KEY || "";
  if (cron && same(req.headers.get("authorization") || "", `Bearer ${cron}`)) return "cron";
  if (founder.length >= 12 && same(req.headers.get("x-founder-key") || "", founder)) return "founder";
  return null;
}

export async function GET(req: NextRequest) {
  const caller = who(req);
  if (!caller) return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 401 });
  if (!kvConfigured()) return NextResponse.json({ ok: false, error: "No data store is connected." }, { status: 503 });

  const step = req.nextUrl.searchParams.get("step") || "";
  if (step === "status") {
    if (caller !== "founder") return NextResponse.json({ ok: false, error: "Founder only." }, { status: 403 });
    return status();
  }
  if (paused()) return NextResponse.json({ ok: true, paused: true, note: "SOCIAL_PAUSED is set; nothing was made or posted." });
  const missing = missingEnv();
  if (missing.length) {
    console.error("social: not configured, missing " + missing.join(", "));
    return NextResponse.json({ ok: false, error: "Missing settings in Vercel: " + missing.join(", ") }, { status: 503 });
  }

  const day = dayKey(new Date());
  try {
    if (step === "make") return await make(day, caller === "founder" && req.nextUrl.searchParams.get("dry") === "1");
    if (step === "post") return await post(day);
  } catch (e) {
    const msg = e instanceof Anthropic.APIError ? `Claude ${e.status}: ${e.message}` : e instanceof Error ? e.message : String(e);
    console.error(`social ${step} ${day}: ${msg}`);
    return NextResponse.json({ ok: false, day, error: msg }, { status: 502 });
  }
  return NextResponse.json({ ok: false, error: "step must be make, post or status" }, { status: 400 });
}

async function make(day: string, dry: boolean): Promise<NextResponse> {
  if (dry) {
    const n = Number(await kvCmd(["GET", "social:topic"])) || 0;
    const topic = topicFor(n);
    const { script, problems } = await writeScript(topic);
    return NextResponse.json({ ok: !!script, dry: true, topic, script, problems });
  }

  // One make per day, even if a manual run and the cron overlap.
  const got = await kvCmd(["SET", `social:lock:make:${day}`, "1", "NX", "EX", 60 * 60 * 24]);
  if (got !== "OK") return NextResponse.json({ ok: true, day, note: "already made today", record: await readDay(day) });

  const n = Number(await kvCmd(["INCR", "social:topic"])) - 1;
  const topic = topicFor(Number.isFinite(n) ? n : 0);
  const now = new Date().toISOString();
  const rec: DayRecord = { day, topic, stage: "writing", createdAt: now, updatedAt: now };
  await writeDay(rec);

  let written: Awaited<ReturnType<typeof writeScript>>;
  try {
    written = await writeScript(topic);
  } catch (e) {
    // Claude was unreachable: record why and free the day, so a manual
    // ?step=make can try again instead of the day being silently lost.
    rec.stage = "write_failed";
    rec.error = e instanceof Anthropic.APIError ? `Claude ${e.status}: ${e.message}` : e instanceof Error ? e.message : String(e);
    await writeDay(rec);
    await kvCmd(["DEL", `social:lock:make:${day}`]);
    return NextResponse.json({ ok: false, day, stage: rec.stage, error: rec.error }, { status: 502 });
  }
  const { script, problems } = written;
  if (!script) {
    rec.stage = "blocked";
    rec.problems = problems;
    await writeDay(rec);
    console.error(`social make ${day}: skipped, script broke rules: ${problems.join("; ")}`);
    return NextResponse.json({ ok: true, day, skipped: true, problems });
  }
  Object.assign(rec, script);
  try {
    rec.videoId = await startVideo(script, day);
    rec.stage = "rendering";
  } catch (e) {
    rec.stage = "render_failed";
    rec.error = e instanceof Error ? e.message : String(e);
  }
  await writeDay(rec);
  return NextResponse.json({ ok: rec.stage === "rendering", day, stage: rec.stage, title: rec.title, error: rec.error });
}

async function post(day: string): Promise<NextResponse> {
  const rec = await readDay(day);
  if (!rec || !rec.videoId || !rec.script) {
    return NextResponse.json({ ok: true, day, note: rec ? `nothing to post (${rec.stage})` : "nothing made today" });
  }
  if (rec.stage === "posted" || rec.stage === "posting") {
    return NextResponse.json({ ok: true, day, note: "already posted", postRequestId: rec.postRequestId });
  }

  const v = await videoState(rec.videoId);
  if (v.status === "failed") {
    rec.stage = "render_failed";
    rec.error = v.error || "HeyGen render failed";
    await writeDay(rec);
    return NextResponse.json({ ok: false, day, stage: rec.stage, error: rec.error });
  }
  if (v.status !== "completed" || !v.url) {
    return NextResponse.json({ ok: true, day, note: `video not ready yet (${v.status}); the next run will post it` });
  }

  // Two overlapping runs must not both reach Upload-Post.
  const got = await kvCmd(["SET", `social:lock:post:${day}`, "1", "NX", "EX", 600]);
  if (got !== "OK") return NextResponse.json({ ok: true, day, note: "another run is posting" });
  rec.stage = "posting";
  await writeDay(rec);
  try {
    rec.postRequestId = await postVideo(v.url, {
      title: rec.title || "", script: rec.script, caption: rec.caption || "", hashtags: rec.hashtags || [],
    }, day);
    rec.stage = "posted";
    rec.error = undefined;
  } catch (e) {
    rec.stage = "post_failed";
    rec.error = e instanceof Error ? e.message : String(e);
    // Let the afternoon run try again.
    await kvCmd(["DEL", `social:lock:post:${day}`]);
  }
  await writeDay(rec);
  return NextResponse.json({ ok: rec.stage === "posted", day, stage: rec.stage, postRequestId: rec.postRequestId, error: rec.error });
}

async function status(): Promise<NextResponse> {
  const days: (DayRecord | null)[] = [];
  const now = Date.now();
  for (let i = 0; i < 14; i++) days.push(await readDay(dayKey(new Date(now - i * 86400000))));
  const today = days[0];
  const networks = today?.postRequestId && process.env.UPLOADPOST_API_KEY ? await postState(today.postRequestId) : null;
  return NextResponse.json({
    ok: true,
    paused: paused(),
    missingSettings: missingEnv(),
    today: networks,
    days: days.filter(Boolean),
  });
}
