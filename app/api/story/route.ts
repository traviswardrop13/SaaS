import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import {
  hasTargetSound,
  type SoundPosition,
  type TargetSound,
} from "@/lib/wordSounds";

/**
 * AI Story Adventures — generates a short, personalized, illustrated story for
 * a child to practice a target speech sound, themed to whatever they love
 * (dragons, space, mermaids…). It's the "AI-first" core: infinite, never the
 * same twice, and secretly engineered so the words the child says are packed
 * with their target sound.
 *
 * THE LOOP (in /public/story.html): the buddy SPEAKS each page aloud (/api/tts),
 * the child REPEATS the highlighted word, judged on-device (no upload).
 * Listen-and-repeat — never "read it yourself" — because our 3–7yo users mostly
 * can't read yet, and imitation is exactly how articulation practice works.
 *
 * WHY THE LLM IS GATED BY RULES: the model only *writes* (creative). Whether a
 * page is on-target, safe, and sayable is decided by a deterministic validation
 * pass below before any page reaches a kid. Strip the AI out and there's no
 * fresh content — but the model can't ship an off-target or unsafe page.
 *
 * Request (JSON):
 *   { name?, interest?, sound?, position?, minutes?, level? }
 * Response:
 *   { ok:true, story:{ title, interest, sound, position, pages:[{text,word,e,targetWords}] } }
 *   { ok:false, error }   // client falls back to static SonaContent.storyPages
 */

export const runtime = "nodejs";

// Sounds our spelling-based on-target checker (lib/wordSounds) understands. For
// any other focus sound we skip the strict check and lean on the prompt +
// safety pass (better to ship a slightly-loose page than block the feature).
const CHECKABLE: TargetSound[] = [
  "S", "R", "L", "SH", "TH", "CH", "K", "G", "F", "P", "T", "M", "N",
];

const POSITIONS: SoundPosition[] = ["initial", "medial", "final"];

// Cheap, fast safety net. The prompt already forbids scary themes; this catches
// anything that slips through before a child ever sees it.
const BANNED = [
  "kill", "dead", "death", "die", "blood", "gun", "knife", "weapon", "war",
  "fight", "punch", "hurt", "scary", "scared", "afraid", "monster", "ghost",
  "demon", "devil", "hell", "drug", "beer", "wine", "sexy", "kiss", "naked",
  "stupid", "hate", "dumb", "idiot",
];

function clampLineCount(minutes: number, lineCount: number): number {
  // ~1 line ≈ 1 turn ≈ 50–70s for a young child with listen + repeat.
  const target = minutes >= 15 ? 9 : minutes >= 10 ? 7 : 5;
  return Math.max(4, Math.min(target, lineCount || target));
}

type RawPage = {
  sentence?: string;
  blankWord?: string;
  emoji?: string;
  targetWords?: string[];
};

function buildSystemPrompt(opts: {
  name: string;
  interest: string;
  sound: string;
  position: SoundPosition;
  lineCount: number;
  wordsPerLine: number;
}): string {
  const { name, interest, sound, position, lineCount, wordsPerLine } = opts;
  return [
    "You are a warm children's story writer for a speech-practice app. You write a SHORT, gentle, playful adventure that a young child (about 3 to 7) will hear read aloud and then repeat, one page at a time, to practice a specific speech sound.",
    "",
    "ABOUT THIS STORY:",
    `- The hero is the child, named ${name}, on a happy little adventure about ${interest}.`,
    `- Target sound: "${sound}" in the ${position} position of words (e.g. ${position} ${sound}).`,
    `- Write exactly ${lineCount} pages. Tiny arc: setup -> a small friendly problem -> a happy resolution.`,
    "",
    "EACH PAGE MUST HAVE:",
    `- A single, simple sentence of about ${wordsPerLine} words or fewer that is easy for a small child to say out loud.`,
    `- One "blankWord": a common, age-appropriate word IN that sentence that clearly contains the target "${sound}" sound in the ${position} position. A 4-year-old should know the word. The blankWord MUST appear verbatim in the sentence.`,
    `- "targetWords": every word in the sentence that carries the target sound (include the blankWord).`,
    "- An \"emoji\": one emoji that matches the page.",
    "",
    "HARD RULES:",
    "- Totally safe and gentle. No violence, danger, fear, scary creatures, sadness, or anything a parent wouldn't want a preschooler to repeat. Always a happy ending.",
    "- Plain spoken words only in the sentence: no emoji, numbers, symbols, quotation marks, or stage directions.",
    "- Keep it cheerful and concrete. Reuse the child's name and the theme so it feels custom.",
    "",
    "OUTPUT: Return ONLY valid minified JSON, no markdown, in exactly this shape:",
    '{"title":"...","pages":[{"sentence":"...","blankWord":"...","emoji":"...","targetWords":["...","..."]}]}',
  ].join("\n");
}

function extractJson(text: string): any | null {
  if (!text) return null;
  let t = text.trim();
  // Strip ``` fences if the model added them.
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

function isSafe(text: string): boolean {
  const w = ` ${text.toLowerCase()} `;
  return !BANNED.some((b) => w.includes(b));
}

function toStoryPage(
  raw: RawPage,
  sound: string,
  position: SoundPosition,
  wordsPerLine: number,
): { text: string; word: string; e: string; targetWords: string[] } | null {
  const sentence = (raw.sentence || "").trim().replace(/\s+/g, " ");
  const blankWord = (raw.blankWord || "").trim();
  if (!sentence || !blankWord) return null;

  // Sayable: not too long, no digits/symbols.
  const wordCount = sentence.split(" ").length;
  if (wordCount > wordsPerLine + 3) return null;
  if (/[0-9@#$%^&*_=<>{}\\/|~`]/.test(sentence)) return null;

  // Safe.
  if (!isSafe(sentence)) return null;

  // On-target: the spoken word must carry the target sound in position (for
  // sounds we can check). The word must also actually appear in the sentence.
  const cleanWord = blankWord.replace(/[^A-Za-z']/g, "");
  if (!cleanWord) return null;
  const sentenceLc = sentence.toLowerCase();
  if (!sentenceLc.includes(cleanWord.toLowerCase())) return null;

  const su = sound.toUpperCase();
  if ((CHECKABLE as string[]).includes(su)) {
    if (!hasTargetSound(cleanWord, su as TargetSound, position)) return null;
  }

  // Build the page in the shape story.html consumes: a sentence with the spoken
  // word swapped for "___" (story.html highlights it and asks the child to say
  // it). Replace only the first verbatim occurrence, case-insensitive.
  const re = new RegExp(
    cleanWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "i",
  );
  const text = sentence.replace(re, "___");
  if (!text.includes("___")) return null;

  const targetWords = Array.isArray(raw.targetWords)
    ? raw.targetWords.map((s) => String(s)).filter(Boolean)
    : [cleanWord];

  return {
    text,
    word: cleanWord,
    e: (raw.emoji || "📖").trim().slice(0, 4) || "📖",
    targetWords,
  };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "story",
    hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
    hint: "POST { name, interest, sound, position, minutes } to generate a themed adventure.",
  });
}

export async function POST(req: NextRequest) {
  const _rl = await rateLimit(req, { key: "story", limit: 30, windowSec: 60 }); if (_rl) return _rl;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Server is missing ANTHROPIC_API_KEY." },
      { status: 500 },
    );
  }

  let body: {
    name?: string;
    interest?: string;
    sound?: string;
    position?: string;
    minutes?: number;
    level?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const name = (body.name || "").trim().slice(0, 40) || "you";
  const interest = (body.interest || "").trim().slice(0, 40) || "a fun adventure";
  const sound = (body.sound || "R").trim().toUpperCase().slice(0, 4);
  const position = POSITIONS.includes(body.position as SoundPosition)
    ? (body.position as SoundPosition)
    : "initial";
  const minutes = Number(body.minutes) || 5;
  const lineCount = clampLineCount(minutes, 0);
  const wordsPerLine = 8;

  const client = new Anthropic({ apiKey: key });

  // Up to 2 generation attempts. We keep all valid pages from an attempt; if we
  // can't get at least 4 good pages, we tell the client to fall back to the
  // built-in static story so the child never sees a broken adventure.
  let lastErr = "Could not generate a valid story.";
  for (let attempt = 0; attempt < 2; attempt++) {
    let rawText = "";
    try {
      const system = buildSystemPrompt({
        name,
        interest,
        sound,
        position,
        lineCount,
        wordsPerLine,
      });
      const messages: Anthropic.MessageParam[] = [
        {
          role: "user",
          content:
            attempt === 0
              ? `Write the adventure now for ${name}, theme: ${interest}, sound: ${sound} (${position}).`
              : `Try again. Every page's blankWord MUST contain a ${position}-position ${sound} sound and appear in its sentence. Theme: ${interest}, child: ${name}.`,
        },
      ];
      let msg: Anthropic.Message;
      try {
        // Preferred path: newer low-effort / no-thinking params (cheaper + faster).
        msg = await client.messages.create({
          model: "claude-opus-4-8",
          max_tokens: 1600,
          thinking: { type: "disabled" },
          output_config: { effort: "low" },
          system,
          messages,
        });
      } catch (paramErr) {
        // Some API versions reject those newer params for this model — retry with
        // a plain call so generation still works instead of falling back to the
        // generic story.
        msg = await client.messages.create({
          model: "claude-opus-4-8",
          max_tokens: 1600,
          system,
          messages,
        });
      }
      rawText = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
    } catch (e: unknown) {
      lastErr =
        e instanceof Anthropic.APIError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Story generation failed.";
      continue;
    }

    const parsed = extractJson(rawText);
    if (!parsed || !Array.isArray(parsed.pages)) {
      lastErr = "Model returned no usable pages.";
      continue;
    }

    const pages = (parsed.pages as RawPage[])
      .map((p) => toStoryPage(p, sound, position, wordsPerLine))
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .slice(0, lineCount);

    if (pages.length >= 4) {
      const title =
        typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title.trim().slice(0, 80)
          : `${name}'s Adventure`;
      return NextResponse.json({
        ok: true,
        story: { title, interest, sound, position, pages },
      });
    }
    lastErr = `Only ${pages.length} valid page(s) passed the on-target/safety check.`;
  }

  return NextResponse.json({ ok: false, error: lastErr }, { status: 502 });
}
