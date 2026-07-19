import Anthropic from "@anthropic-ai/sdk";

/**
 * Optional AI assist for the study view. Given the chosen question and a set of
 * candidate topics, Claude selects the most relevant topics, writes a short
 * NEUTRAL framing (it does not answer or editorialize — the class wants the
 * scriptures and prophets to speak), and may suggest additional REAL scripture
 * references. It never produces quotations, and every reference it returns is
 * later validated against the full scriptures dataset, so nothing fabricated
 * can reach the class. If no API key is set, callers fall back to keyword-only
 * matching.
 */

export interface AiStudyPlan {
  chosenTopicIds: string[];
  framing: string;
  extraRefs: string[];
}

export interface Candidate {
  id: string;
  name: string;
  summary: string;
}

const SYSTEM = [
  "You are a study assistant for a Latter-day Saint (LDS) Sunday school class.",
  "The class has chosen a gospel question. Your job is NOT to answer it or give your own opinion — they want the scriptures and prophetic teachings to speak for themselves.",
  "",
  "Do exactly three things and return them as STRICT JSON (no prose, no code fences):",
  '1. "chosenTopicIds": pick the 2-3 topic ids from the provided candidate list that best fit the question. Use ONLY ids from the list.',
  '2. "framing": ONE or TWO short sentences that name the gospel principle(s) the question touches and orient the reader to the passages below. Do NOT assert an answer, conclusion, or personal interpretation. Warm and reverent.',
  '3. "extraRefs": up to 4 ADDITIONAL scripture references (beyond what the topics already include) in exact canonical LDS format (e.g. "2 Nephi 2:25", "D&C 121:7-8", "John 14:27", "Moses 1:39"). Only include passages you are confident genuinely exist and are relevant. If none come to mind, use an empty array.',
  "",
  "Never invent or paraphrase a quotation. Never guess a reference you are unsure of.",
  'Output shape: {"chosenTopicIds": string[], "framing": string, "extraRefs": string[]}',
].join("\n");

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function planStudy(
  question: string,
  candidates: Candidate[],
): Promise<AiStudyPlan | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const client = new Anthropic({ apiKey: key });
  const userPrompt = [
    `Class question: "${question.trim()}"`,
    "",
    "Candidate topics (id — name — summary):",
    ...candidates.map((c) => `- ${c.id} — ${c.name} — ${c.summary}`),
  ].join("\n");

  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 600,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const parsed = extractJson(text) as Partial<AiStudyPlan> | null;
    if (!parsed || typeof parsed !== "object") return null;

    const validIds = new Set(candidates.map((c) => c.id));
    const chosenTopicIds = Array.isArray(parsed.chosenTopicIds)
      ? parsed.chosenTopicIds.filter((id): id is string => typeof id === "string" && validIds.has(id))
      : [];
    const framing = typeof parsed.framing === "string" ? parsed.framing.trim() : "";
    const extraRefs = Array.isArray(parsed.extraRefs)
      ? parsed.extraRefs.filter((r): r is string => typeof r === "string").slice(0, 6)
      : [];

    return { chosenTopicIds, framing, extraRefs };
  } catch {
    return null;
  }
}
