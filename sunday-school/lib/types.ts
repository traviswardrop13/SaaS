// Shared types for the Gospel Questions app.

export type Phase = "ask" | "vote" | "study";

/** A single gospel question submitted by a class member. */
export interface StoredQuestion {
  id: string;
  text: string;
  author?: string;
  by: string; // anonymous client id of the submitter
  voters: string[]; // anonymous client ids that upvoted
  createdAt: number;
}

/** Server-side session record (kept in the shared store). */
export interface Session {
  code: string;
  createdAt: number;
  hostToken: string; // secret returned only to the teacher; gates phase changes
  phase: Phase;
  questions: StoredQuestion[];
  selectedQuestionId?: string;
  study?: StudyResult;
}

/** Public question shape sent to clients. */
export interface PublicQuestion {
  id: string;
  text: string;
  author?: string;
  votes: number;
  voted: boolean; // did the requesting client vote for this one
  mine: boolean; // did the requesting client submit this one
}

/** Public session shape sent to clients. */
export interface PublicSession {
  code: string;
  phase: Phase;
  questions: PublicQuestion[];
  submittedCount: number; // total questions submitted (used during the "ask" phase)
  selectedQuestionId?: string;
  study?: StudyResult;
  shared: boolean; // true when a shared multi-device store is configured
}

// ── Study result (scriptures + quotes for a chosen question) ─────────────────

export interface StudyVerse {
  ref: string;
  text: string;
  why?: string;
}

export interface StudyQuote {
  text: string;
  author: string;
  role?: string;
  source?: string;
  year?: string;
  sourceUrl?: string;
}

export interface StudyResult {
  question: string;
  framing: string;
  topics: string[];
  verses: StudyVerse[];
  quotes: StudyQuote[];
  aiUsed: boolean;
}
