import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

/**
 * "Talk with Leo" — the AI conversation companion. Leo (our mascot) holds a
 * short, warm, spoken conversation with a child to practice their target
 * speech sound and language in real back-and-forth (the carryover/conversation
 * level that's hardest to practice and where an infinitely-patient AI shines).
 *
 * The Anthropic key is server-side only. Built on the official SDK with
 * claude-opus-4-8, tuned for fast, short, speakable replies.
 *
 * Request body:
 *   { messages: [{ role: "user" | "leo", text }], child?: { name?, sound?, focus? } }
 * Response:
 *   { ok: true, reply: string }  |  { ok: false, error }
 */

type Turn = { role: "user" | "leo"; text: string };

function systemPrompt(child?: {
  name?: string;
  sound?: string;
  focus?: string;
}): string {
  const name = child?.name?.trim();
  const sound = child?.sound?.trim();
  return [
    "You are Leo, a cheerful, gentle lion cub who helps a young child (about 3 to 9 years old) practice talking at home. You are a friendly practice buddy, NOT a therapist, doctor, or real person, and you never claim to diagnose or treat anything.",
    "",
    "HOW YOU TALK:",
    "- You are talking to a small child. Use very simple words and SHORT sentences.",
    "- Keep every reply to one or two short sentences, then usually ask one simple, fun question to keep them talking (favorite animal, color, what they did today, etc.). Ask only one question at a time.",
    "- Be warm, playful, and encouraging. Celebrate every try.",
    "- Stay calm and natural, like a kind big brother — not hyper. Use at most one exclamation mark per reply; your words are read aloud, and stacked exclamations sound shouty and fake.",
    "- Your reply will be read aloud by text-to-speech, so write only plain, speakable words. No emoji, no asterisks, no stage directions, no markdown — just what Leo says out loud.",
    "",
    "HELPING WITH SPEECH (gently):",
    name ? `- The child's name is ${name}. Use it warmly now and then.` : "",
    sound
      ? `- Gently encourage their target sound, "${sound}". Naturally bring up fun words that contain it, and model words clearly. If they mispronounce a word, NEVER say they are wrong — just say the word back correctly and kindly in your reply (for example, if they say "wabbit", you say "A rabbit! I love rabbits.").`
      : "- Model words back clearly and kindly. If they mispronounce a word, never say they are wrong — just say it back correctly and warmly.",
    "- Never correct harshly, never shame, never say 'no that's wrong'. Always stay positive.",
    "",
    "SAFETY (very important — this is a young child):",
    "- Never ask for or repeat personal information: full name, address, school, phone number, passwords, or where they live. If they share any, do not repeat it; gently change the subject to something fun.",
    "- Keep everything strictly child-appropriate and gentle. Nothing scary, violent, romantic, or unsafe.",
    "- If the child says anything that sounds like they are hurt, unsafe, very upset, or something inappropriate, respond kindly and calmly, do not ask probing questions, and gently suggest they tell their grown-up. Do not give medical, legal, or safety advice.",
    "- If asked something off-topic, too grown-up, or beyond a kid chat, gently steer back to a simple, fun topic.",
    "",
    "OUTPUT: Reply with ONLY what Leo says out loud — short, warm, and speakable. Nothing else.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: NextRequest) {
  const _rl = await rateLimit(req, { key: "chat", limit: 40, windowSec: 60 }); if (_rl) return _rl;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Server is missing ANTHROPIC_API_KEY." },
      { status: 500 },
    );
  }

  let body: { messages?: Turn[]; child?: { name?: string; sound?: string; focus?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const history = Array.isArray(body.messages) ? body.messages : [];
  // Map our turns to Anthropic messages. An empty history means "Leo, say hi
  // and start the conversation" — seed a single user nudge so the API has a
  // valid first user turn.
  const messages: Anthropic.MessageParam[] = history
    .filter((t) => t && typeof t.text === "string" && t.text.trim())
    .map((t) => ({
      role: t.role === "leo" ? ("assistant" as const) : ("user" as const),
      content: t.text.trim(),
    }));
  if (messages.length === 0 || messages[0].role !== "user") {
    messages.unshift({
      role: "user",
      content: "(The child just opened the app. Say a short, friendly hello and ask one simple, fun question to get them talking.)",
    });
  }

  const client = new Anthropic({ apiKey: key });
  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 200,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: systemPrompt(body.child),
      messages,
    });
    const reply = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    return NextResponse.json({ ok: true, reply: reply || "Hi there! I'm Leo!" });
  } catch (e: unknown) {
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json(
        { ok: false, error: e.message },
        { status: e.status ?? 502 },
      );
    }
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Chat failed." },
      { status: 502 },
    );
  }
}
