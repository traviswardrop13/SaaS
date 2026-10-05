import { matchTopics, topicById, allTopics, type Topic } from "./topics";
import { resolveRefs } from "./scriptures";
import { planStudy, type Candidate } from "./ai";
import type { StudyResult, StudyQuote } from "./types";

const FALLBACK_TOPIC_IDS = [
  "faith",
  "jesus-christ",
  "revelation",
  "scriptures",
  "gods-love",
];

const MAX_VERSES = 10;
const MAX_QUOTES = 5;

/**
 * Turn a chosen class question into study material: the most relevant gospel
 * topics, a short neutral framing, real scripture verses (validated text), and
 * verified prophet/apostle quotes.
 */
export async function buildStudy(question: string): Promise<StudyResult> {
  const matches = matchTopics(question, 8);

  // Candidate topics for the AI to choose among. Fall back to a broad set when
  // keyword matching finds nothing.
  let candidateTopics: Topic[] = matches.map((m) => m.topic);
  if (candidateTopics.length === 0) {
    const fallback = FALLBACK_TOPIC_IDS.map(topicById).filter(
      (t): t is Topic => Boolean(t),
    );
    candidateTopics = fallback.length ? fallback : allTopics().slice(0, 8);
  }

  const candidates: Candidate[] = candidateTopics.map((t) => ({
    id: t.id,
    name: t.name,
    summary: t.summary,
  }));

  const plan = await planStudy(question, candidates);
  const aiUsed = plan !== null;

  // Which topics to draw scriptures/quotes from.
  let chosenIds =
    plan && plan.chosenTopicIds.length ? plan.chosenTopicIds : candidates.slice(0, 3).map((c) => c.id);
  const chosenTopics = chosenIds
    .map(topicById)
    .filter((t): t is Topic => Boolean(t));

  // References: topic refs first (with their "why"), then AI-suggested extras.
  const refInputs: { ref: string; why?: string }[] = [];
  for (const t of chosenTopics) {
    for (const r of t.references) refInputs.push(r);
  }
  if (plan) {
    for (const r of plan.extraRefs) refInputs.push({ ref: r });
  }
  const verses = resolveRefs(refInputs).slice(0, MAX_VERSES);

  // Quotes: verified only (drop anything explicitly marked unverified), deduped.
  const quotes: StudyQuote[] = [];
  const seenQuote = new Set<string>();
  for (const t of chosenTopics) {
    for (const q of t.quotes) {
      if (q.verified === false) continue;
      const k = q.text.slice(0, 60).toLowerCase();
      if (seenQuote.has(k)) continue;
      seenQuote.add(k);
      quotes.push({
        text: q.text,
        author: q.author,
        role: q.role,
        source: q.source,
        year: q.year,
        sourceUrl: q.sourceUrl,
      });
      if (quotes.length >= MAX_QUOTES) break;
    }
    if (quotes.length >= MAX_QUOTES) break;
  }

  const topicNames = chosenTopics.map((t) => t.name);
  const framing =
    (plan && plan.framing) ||
    (topicNames.length
      ? `Scriptures and latter-day teachings on ${topicNames.join(", ")} that speak to this question.`
      : "Scriptures and latter-day teachings that speak to this question.");

  return {
    question,
    framing,
    topics: topicNames,
    verses,
    quotes,
    aiUsed,
  };
}
