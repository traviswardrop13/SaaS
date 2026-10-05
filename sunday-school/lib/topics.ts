import fs from "fs";
import path from "path";

/**
 * The curated topical index: gospel topics, each with matching keywords, a set
 * of real scripture references, and web-verified prophet/apostle quotes. This
 * is what turns a free-form class question into relevant, trustworthy study
 * material. Data is compiled + fact-checked offline into data/topics.json.
 */

export interface TopicQuote {
  text: string;
  author: string;
  role?: string;
  source?: string;
  year?: string;
  sourceUrl?: string;
  verified?: boolean;
}

export interface Topic {
  id: string;
  name: string;
  summary: string;
  keywords: string[];
  references: { ref: string; why?: string }[];
  quotes: TopicQuote[];
}

let TOPICS: Topic[] | null = null;

export function allTopics(): Topic[] {
  if (TOPICS) return TOPICS;
  const p = path.join(process.cwd(), "data", "topics.json");
  try {
    TOPICS = JSON.parse(fs.readFileSync(p, "utf8")) as Topic[];
  } catch {
    TOPICS = [];
  }
  return TOPICS;
}

export function topicById(id: string): Topic | undefined {
  return allTopics().find((t) => t.id === id);
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "been", "do", "does", "did", "how", "why",
  "what", "when", "where", "who", "which", "can", "could", "should", "would",
  "i", "we", "you", "he", "she", "they", "it", "my", "our", "your", "me", "us",
  "about", "if", "so", "that", "this", "these", "those", "there", "here", "as",
  "at", "by", "from", "into", "than", "then", "will", "have", "has", "not",
]);

// Words that appear across nearly every gospel topic — matching on them tells
// us almost nothing, so they don't count toward a topic's score.
const GENERIC = new Set([
  "god", "jesus", "christ", "lord", "gospel", "church", "know", "feel",
  "help", "life", "people", "person", "thing", "things", "good", "make",
  "want", "need", "get", "way", "really", "think", "mean", "gods",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export interface TopicMatch {
  topic: Topic;
  score: number;
}

/**
 * Rank topics against a free-form question. Scoring blends three signals:
 *  - a full keyword phrase appearing verbatim (strongest),
 *  - overlap between the question's words and a keyword's words,
 *  - overlap with the topic name.
 * Generic gospel words (god, jesus, know, …) are ignored so a topic can't win
 * just because it shares a filler word with the question.
 */
export function matchTopics(question: string, limit = 8): TopicMatch[] {
  const topics = allTopics();
  const q = " " + question.toLowerCase() + " ";
  const qTokens = new Set(tokenize(question).filter((w) => !GENERIC.has(w)));

  const scored: TopicMatch[] = topics.map((topic) => {
    let score = 0;

    for (const kwRaw of topic.keywords) {
      const kw = kwRaw.toLowerCase().trim();
      if (!kw) continue;

      if (kw.includes(" ")) {
        // Phrase keyword: big signal if the whole phrase appears verbatim,
        // otherwise credit each meaningful shared word.
        if (q.includes(" " + kw + " ") || q.includes(kw)) {
          score += 5;
        } else {
          for (const w of tokenize(kw)) {
            if (!GENERIC.has(w) && qTokens.has(w)) score += 1;
          }
        }
      } else if (!GENERIC.has(kw) && qTokens.has(kw)) {
        score += 2;
      }
    }

    // Topic name words (generic words excluded).
    for (const w of tokenize(topic.name)) {
      if (!GENERIC.has(w) && qTokens.has(w)) score += 1;
    }

    return { topic, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
