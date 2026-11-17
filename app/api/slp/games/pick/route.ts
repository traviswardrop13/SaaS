import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { dashboardGate } from "@/lib/proGate";
import { PICKS_PROMPT, catalogFor, pickMessage, readPickInput, readPicks } from "@/lib/gamePicks";
import { rateLimit } from "@/lib/rateLimit";
import { kvCmd, readSession, liveSession } from "@/lib/slpAuth";

// SESSION GAMES (SLPPRO1, 17 Nov 2026): the dashboard's AI picks three of
// Sona's own games (or the sound's talking story, or its books) for a
// session. It replaced "Plan activities" (/api/slp/activities). The request
// is rebuilt field by field (lib/gamePicks readPickInput): the sound, word
// position, age band, minutes and the clinician's optional few words on what
// the child loves are all that crosses to the AI, with Sona's catalog. No
// name, roster, account or practice data is added here. Nothing is stored,
// and nothing reaches a family. What is suggested is Rachel's to review
// (PICKS_PROMPT).
//
// The guards are the planner's, in the same order: a live session, this
// site's own page, a rate limit, the account, the dashboard's plan (Sona Pro,
// or a free dashboard promised before 12 Nov 2026); then the request.

export const runtime = "nodejs";
// The AI's reply can take most of the default limit.
export const maxDuration = 30;

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

const FAILED = "Couldn't pick games just now. Try again.";

export async function POST(req: NextRequest) {
  const session = await liveSession(readSession(req));
  if (!session) return error("Sign in to find Sona games.", 401);

  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return error("Open Session games from your dashboard.", 403);

  const limited = await rateLimit(req, { key: "slp-games", limit: 30, windowSec: 3600 });
  if (limited) return limited;

  const account = await kvCmd(["GET", "slpacct:" + session.email]);
  if (account === undefined) return error("Couldn't load your account. Try again shortly.", 503);
  if (!account) return error("Sign in to find Sona games.", 401);
  const locked = await dashboardGate(session.email);
  if (locked) return locked;

  const input = readPickInput(await req.json().catch(() => null));
  if ("error" in input) return error(input.error, 400);
  const items = catalogFor(input.sound);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return error("Game picks are unavailable right now.", 503);
  try {
    const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 25000 });
    // No `thinking` field: this model thinks adaptively and refuses a request
    // that turns thinking off. Low effort keeps the reply quick.
    const result = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low" },
      system: PICKS_PROMPT,
      messages: [{ role: "user", content: pickMessage(input, items) }],
    });
    if (result.stop_reason === "refusal" || result.stop_reason === "max_tokens") return error(FAILED, 502);
    const content = result.content.find((part): part is Anthropic.TextBlock => part.type === "text");
    const picks = readPicks(content?.text || "", items);
    if (picks === "empty") return error("No good fit for that. Change the age or what they love, and try again.", 422);
    if (!picks) return error(FAILED, 502);
    return NextResponse.json({ ok: true, picks });
  } catch {
    return error(FAILED, 502);
  }
}
