"use client";

import type { PublicQuestion } from "@/lib/types";

interface Props {
  questions: PublicQuestion[];
  onVote?: (id: string) => void;
  onSelect?: (id: string) => void;
  selectLabel?: string;
  busyId?: string | null;
  emptyText?: string;
}

export default function QuestionList({
  questions,
  onVote,
  onSelect,
  selectLabel = "Study this",
  busyId,
  emptyText = "No questions yet.",
}: Props) {
  if (questions.length === 0) {
    return <p className="py-8 text-center text-ink/50">{emptyText}</p>;
  }

  return (
    <ul className="space-y-3">
      {questions.map((q) => (
        <li
          key={q.id}
          className={`flex items-stretch gap-3 rounded-xl border bg-white/80 p-3 shadow-sm transition ${
            q.mine ? "border-sky-200" : "border-black/5"
          }`}
        >
          {onVote && (
            <button
              type="button"
              onClick={() => onVote(q.id)}
              disabled={busyId === q.id}
              aria-pressed={q.voted}
              className={`flex w-14 flex-col items-center justify-center rounded-lg border text-center transition disabled:opacity-50 ${
                q.voted
                  ? "border-sky-500 bg-sky-500 text-white"
                  : "border-sky-100 bg-sky-50 text-sky-700 hover:border-sky-300"
              }`}
            >
              <span className="text-lg leading-none">▲</span>
              <span className="mt-0.5 text-sm font-bold tabular-nums">{q.votes}</span>
            </button>
          )}

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="leading-snug text-ink/90">{q.text}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-ink/50">
              {q.author && <span>— {q.author}</span>}
              {q.mine && <span className="text-sky-600">you</span>}
              {!onVote && <span className="tabular-nums">{q.votes} votes</span>}
            </div>
          </div>

          {onSelect && (
            <button
              type="button"
              onClick={() => onSelect(q.id)}
              disabled={busyId === q.id}
              className="self-center whitespace-nowrap rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:opacity-50"
            >
              {busyId === q.id ? "…" : selectLabel}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
