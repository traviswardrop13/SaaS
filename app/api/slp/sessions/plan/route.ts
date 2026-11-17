import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { dashboardGate } from "@/lib/proGate";
import { PLAN_PROMPT, POS_WORDS, readPlans, validSessions } from "@/lib/dayPlan";
import { rateLimit } from "@/lib/rateLimit";
import { kvCmd, readSession, liveSession } from "@/lib/slpAuth";

// PLANDAY1 (Travis, 14 Nov 2026: "auto plan sessions and activities for the
// upcoming day"). The clinician lists tomorrow's sessions on the dashboard;
// this route suggests play-based activities for each. ONLY validated choices
// cross to the AI: a sound code, a word position, an age range and a session
// length per session. Never a name, initials, roster data, practice numbers
// or free text — the page joins its own notes to the suggestions locally.
// The ideas are a prep aid for the clinician to edit; nothing reaches a
// family or a child's app from here. What activities are suggested is
// Rachel's to review (the prompt below).

export const runtime = "nodejs";
// Up to 8 sessions in one reply can take longer than the default limit.
export const maxDuration = 30;

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  const session = await liveSession(readSession(req));
  if (!session) return error("Sign in to plan sessions.", 401);

  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return error("Open the planner from your dashboard.", 403);

  const limited = await rateLimit(req, { key: "slp-day-plan", limit: 12, windowSec: 3600 });
  if (limited) return limited;

  const account = await kvCmd(["GET", "slpacct:" + session.email]);
  if (account === undefined) return error("Couldn't load your account. Try again shortly.", 503);
  if (!account) return error("Sign in to plan sessions.", 401);
  const locked = await dashboardGate(session.email);
  if (locked) return locked;

  const sessions = validSessions(await req.json().catch(() => null));
  if (!sessions) return error("Choose a sound, word position, age and length for each session.", 400);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return error("AI planning is unavailable right now.", 503);
  try {
    const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 25000 });
    const result = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 400 * sessions.length,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: PLAN_PROMPT,
      messages: [{
        role: "user",
        content: JSON.stringify(sessions.map((s) => ({
          sound: s.sound, position: POS_WORDS[s.position], age: s.age, minutes: s.minutes,
        }))),
      }],
    });
    const content = result.content.find((part): part is Anthropic.TextBlock => part.type === "text");
    const plans = readPlans(content?.text || "", sessions.length);
    if (!plans) throw new Error("Invalid plan");
    return NextResponse.json({ ok: true, plans });
  } catch {
    return error("Couldn't plan the activities. Try again or write your own.", 502);
  }
}
