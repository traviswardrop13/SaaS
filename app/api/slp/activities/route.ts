import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { dashboardGate } from "@/lib/proGate";
import { ACTIVITY_PROMPT, readActivities, readText } from "@/lib/activityPlan";
import { rateLimit } from "@/lib/rateLimit";
import { kvCmd, readSession, liveSession } from "@/lib/slpAuth";

// SLPCLEAN1 (17 Nov 2026): "Plan activities", the dashboard's AI planner
// for in-session activities. The clinician describes the child and the
// session in their own words (Travis chose free typing, and accepted that
// what is typed goes to Anthropic); that text, rebuilt from the request's one
// `text` field, is the only thing that crosses to the AI. No name, roster,
// account or practice data is added here. The page asks the clinician not to
// type a child's name, and refuses to send one from their caseload. The
// ideas are a prep aid to edit: nothing is stored, and nothing reaches a
// family or a child's app. What is suggested is Rachel's to review
// (ACTIVITY_PROMPT, lib/activityPlan.ts).
//
// The guards are the old planner's (PLANDAY1), in the same order: a live
// session, this site's own page, a rate limit, the account, the dashboard's
// plan; then the text.

export const runtime = "nodejs";
// The AI's reply can take most of the default limit.
export const maxDuration = 30;

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

const FAILED = "Couldn't make activities. Try again or reword it.";

export async function POST(req: NextRequest) {
  const session = await liveSession(readSession(req));
  if (!session) return error("Sign in to plan activities.", 401);

  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return error("Open the planner from your dashboard.", 403);

  const limited = await rateLimit(req, { key: "slp-activities", limit: 30, windowSec: 3600 });
  if (limited) return limited;

  const account = await kvCmd(["GET", "slpacct:" + session.email]);
  if (account === undefined) return error("Couldn't load your account. Try again shortly.", 503);
  if (!account) return error("Sign in to plan activities.", 401);
  const locked = await dashboardGate(session.email);
  if (locked) return locked;

  const input = readText(await req.json().catch(() => null));
  if ("error" in input) return error(input.error, 400);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return error("AI planning is unavailable right now.", 503);
  try {
    const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 25000 });
    // No `thinking` field: this model thinks adaptively and refuses a request
    // that turns thinking off. Low effort keeps the reply quick.
    const result = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 3000,
      output_config: { effort: "low" },
      system: ACTIVITY_PROMPT,
      messages: [{ role: "user", content: input.text }],
    });
    if (result.stop_reason === "refusal" || result.stop_reason === "max_tokens") return error(FAILED, 502);
    const content = result.content.find((part): part is Anthropic.TextBlock => part.type === "text");
    const activities = readActivities(content?.text || "");
    if (activities === "empty") return error("Describe a child and the session you're planning, then try again.", 422);
    if (!activities) return error(FAILED, 502);
    return NextResponse.json({ ok: true, activities });
  } catch {
    return error(FAILED, 502);
  }
}
