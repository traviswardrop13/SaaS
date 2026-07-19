import type { Session, PublicSession, PublicQuestion, StoredQuestion } from "./types";
import { isShared } from "./store";

function shape(q: StoredQuestion, clientId?: string): PublicQuestion {
  return {
    id: q.id,
    text: q.text,
    author: q.author,
    votes: q.voters.length,
    voted: clientId ? q.voters.includes(clientId) : false,
    mine: clientId ? q.by === clientId : false,
  };
}

/**
 * Shape a stored session for a specific client.
 *
 * During the "ask" phase we deliberately return only the client's OWN
 * questions (plus a total count), so no one sees the class's questions until
 * the teacher reveals them — that's the "auto-show every question" moment.
 * From "vote" onward, everyone's questions are returned, sorted by votes.
 */
export function toPublic(session: Session, clientId?: string): PublicSession {
  const submittedCount = session.questions.length;

  let questions: PublicQuestion[];
  if (session.phase === "ask") {
    questions = session.questions
      .filter((q) => clientId && q.by === clientId)
      .map((q) => shape(q, clientId));
  } else {
    questions = session.questions
      .map((q) => shape(q, clientId))
      .sort((a, b) => b.votes - a.votes || a.text.localeCompare(b.text));
  }

  return {
    code: session.code,
    phase: session.phase,
    questions,
    submittedCount,
    selectedQuestionId: session.selectedQuestionId,
    study: session.study,
    shared: isShared(),
  };
}
