import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

/**
 * The Coach brain — the "speech pathologist in your pocket" voice for a live
 * practice session. The client runs the session state machine (which word,
 * record, Speechace score, decide advance/retry) and asks this endpoint only
 * for the *spoken coaching line* that matches the moment. Keeping the control
 * flow on the client makes the session reliable and cheap; Claude provides the
 * warm, adaptive, never-repetitive coaching language a child actually feels.
 *
 * Request: {
 *   childName?, targetWord, targetSound,
 *   action: "intro" | "praise" | "encourage" | "moveon" | "finish",
 *   transcript?, score?, attempt?, sessionStats?
 * }
 * Response: { ok: true, say: string } | { ok: false, error }
 */

type Action = "intro" | "praise" | "encourage" | "moveon" | "finish";

type Body = {
  childName?: string;
  targetWord?: string;
  targetSound?: string;
  action?: Action;
  transcript?: string;
  score?: number | null;
  attempt?: number;
  sessionStats?: { practiced?: number; great?: number };
};

// Vetted, SLP-checkable placement cues (mirror of Sona.CUES). The coach must use
// these VERBATIM and must NEVER invent its own tongue/mouth placement — wrong
// articulation advice entrenches errors, so anatomy is never AI-generated.
const CUE: Record<string, string> = {
  R: "Pull your tongue back and up like a tiger growl — rrr.",
  S: "Teeth together, big smile, let the air hiss out — sss.",
  L: "Tongue tip up behind your top teeth — lll.",
  K: "Pop the back of your tongue up in the back — k, k, k.",
  G: "Like K, but turn your voice on — g, g, g.",
  F: "Top teeth on your bottom lip, blow soft — ffff.",
  V: "Like F, but buzz your voice — vvvv.",
  SH: "Round your lips and whisper quiet — shhh.",
  CH: "Pop it like a little train — ch, ch, ch.",
  J: "Like CH, but turn your voice on — j, j, j.",
  TH: "Peek your tongue between your teeth and blow soft — th.",
  THV: "Put your tongue between your teeth and buzz — th, like in 'the'.",
  Z: "Teeth together and buzz like a bee — zzzz.",
  P: "Press your lips and pop a little puff — p, p, p.",
  B: "Lips together, then turn your voice on — b, b, b.",
  M: "Lips together and hum — mmmm.",
  N: "Tongue up behind your teeth and hum — nnnn.",
  T: "Tongue taps behind your top teeth — t, t, t.",
  D: "Like T, but turn your voice on — d, d, d.",
};
function cueFor(sound?: string): string {
  return (sound && CUE[sound.trim().toUpperCase()]) || "";
}

const SYSTEM = [
  "You are Leo, a cheerful, gentle lion cub who is a child's personal speech practice coach (the child is about 3 to 9 years old). You run a warm, encouraging practice session, like a kind speech coach — but you are NOT a doctor or therapist and never diagnose or treat anything.",
  "",
  "HOW YOU TALK:",
  "- You're talking to a small child. Use very simple words and ONE short sentence (occasionally two). ",
  "- Warm, playful, full of encouragement. Celebrate every attempt, never shame.",
  "- Your line is read aloud by text-to-speech: output ONLY plain speakable words. No emoji, asterisks, stage directions, or markdown.",
  "- Vary your wording every time — never sound canned or repetitive.",
  "",
  "COACHING:",
  "- 'intro': introduce the target word in a fun way and invite them to say it (e.g. 'Let's try rabbit! Say it with me — rabbit.').",
  "- 'praise': they said it well — celebrate specifically and briefly, then move on.",
  "- 'encourage': not quite right — stay positive, gently model the correct word, then include the EXACT mouth cue you are given (verbatim — never change it or make up your own), and invite them to try again. Never say 'wrong' or 'no'.",
  "- 'moveon': it was okay; give kind encouragement and move to the next word.",
  "- 'finish': the session is over — give a short, proud, celebratory sign-off using their progress.",
  "",
  "SAFETY: Keep everything gentle and child-appropriate. Never ask for personal info. If the child seems upset or says something concerning, be kind and suggest telling their grown-up.",
  "CLINICAL SAFETY: NEVER invent, guess, or improvise tongue, mouth, lip, or jaw placement. Only ever repeat the exact mouth cue you are handed. If you are not given a cue, just warmly invite another try without describing how to move the mouth.",
  "",
  "OUTPUT: ONLY Leo's spoken line. Short, warm, speakable. Nothing else.",
].join("\n");

function userPrompt(b: Body): string {
  const name = b.childName?.trim() || "the child";
  const word = b.targetWord?.trim() || "the word";
  const sound = b.targetSound?.trim() || "the sound";
  const heard = b.transcript?.trim();
  switch (b.action) {
    case "intro":
      return `Action: intro. Child: ${name}. Target word: "${word}" (practicing the ${sound} sound). Say a fun one-sentence intro inviting them to say "${word}".`;
    case "praise":
      return `Action: praise. Child: ${name}. They said "${word}" well${
        b.score != null ? ` (score ${b.score})` : ""
      }. Celebrate briefly and specifically.`;
    case "encourage": {
      const cue = cueFor(b.targetSound);
      return `Action: encourage. Child: ${name}. Target word "${word}", ${sound} sound.${
        heard ? ` It sounded like "${heard}".` : ""
      } Stay positive and model "${word}" correctly. Then include this mouth cue VERBATIM, do not change it or invent your own: "${cue || "Listen to me and try it again."}". Invite another try.`;
    }
    case "moveon":
      return `Action: moveon. Child: ${name}. They tried "${word}". Give kind encouragement and move on to the next word.`;
    case "finish":
      return `Action: finish. Child: ${name}. Session done — practiced ${
        b.sessionStats?.practiced ?? 0
      } words, ${
        b.sessionStats?.great ?? 0
      } sounded great. Give a short, proud, celebratory sign-off.`;
    default:
      return `Say a short, warm line of encouragement to ${name}.`;
  }
}

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Server is missing ANTHROPIC_API_KEY." },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: key });
  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 90,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt(body) }],
    });
    const say = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    return NextResponse.json({ ok: true, say: say || "Great job! Let's keep going." });
  } catch (e: unknown) {
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status ?? 502 });
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Coach failed." },
      { status: 502 },
    );
  }
}
