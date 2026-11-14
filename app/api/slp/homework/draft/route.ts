import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { dashboardGate } from "@/lib/proGate";
import { NOTE_MAX, POSITIONS, SOUND_NORM, TITLE_MAX } from "@/lib/homework";
import { rateLimit } from "@/lib/rateLimit";
import { kvCmd, readSession, liveSession } from "@/lib/slpAuth";

export const runtime = "nodejs";

const DRAFT_PROMPT = `Write a short family-facing title and note for a speech-language clinician to edit. The clinician has already chosen the sound, word position and practice count. Help the family fit those choices into a simple routine. Do not suggest words, mouth movements, cues, target sounds, exercises, other practice counts or clinical advice. Do not mention a child by name. Return a JSON object with only "title" (up to ${TITLE_MAX} characters) and "note" (up to ${NOTE_MAX} characters).`;

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  const session = await liveSession(readSession(req));
  if (!session) return error("Sign in to draft homework.", 401);

  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return error("Open the draft from your dashboard.", 403);

  const limited = await rateLimit(req, { key: "slp-homework-draft", limit: 24, windowSec: 3600 });
  if (limited) return limited;

  const account = await kvCmd(["GET", "slpacct:" + session.email]);
  if (account === undefined) return error("Couldn't load your account. Try again shortly.", 503);
  if (!account) return error("Sign in to draft homework.", 401);
  const locked = await dashboardGate(session.email);
  if (locked) return locked;

  const input: unknown = await req.json().catch(() => null);
  if (!input || typeof input !== "object" || Array.isArray(input)) return error("Choose your practice details.", 400);
  const { sound, position, reps } = input as Record<string, unknown>;
  if (typeof sound !== "string" || !Object.hasOwn(SOUND_NORM, sound) ||
      typeof position !== "string" || !POSITIONS.includes(position) ||
      typeof reps !== "number" || ![10, 15, 20, 30, 40, 60].includes(reps)) {
    return error("Choose a sound, word position and practice count.", 400);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return error("AI drafting is unavailable right now.", 503);
  try {
    const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 12000 });
    const result = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 200,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: DRAFT_PROMPT,
      // Only validated choices cross this boundary. No roster, account or free text.
      messages: [{ role: "user", content: JSON.stringify({ sound, position, reps }) }],
    });
    const content = result.content.find((part): part is Anthropic.TextBlock => part.type === "text");
    const json = content?.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "") || "";
    const draft: { title?: unknown; note?: unknown } | null = JSON.parse(json);
    const title = typeof draft?.title === "string" ? draft.title.trim() : "";
    const note = typeof draft?.note === "string" ? draft.note.trim() : "";
    if (!title || title.length > TITLE_MAX || !note || note.length > NOTE_MAX) throw new Error("Invalid draft");
    return NextResponse.json({ ok: true, title, note });
  } catch {
    return error("Couldn't draft the note. Try again or write your own.", 502);
  }
}
