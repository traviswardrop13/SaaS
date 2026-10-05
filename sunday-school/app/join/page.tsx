"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { PublicSession } from "@/lib/types";
import {
  clientId,
  fetchSession,
  submitQuestion,
  toggleVote,
} from "@/lib/clientApi";
import QuestionList from "@/components/QuestionList";
import StudyView from "@/components/StudyView";

function JoinInner() {
  const params = useSearchParams();
  const cid = useRef<string>("");

  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [name, setName] = useState("");
  const [session, setSession] = useState<PublicSession | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Init: client id, saved name, and initial code (URL ?code wins).
  useEffect(() => {
    cid.current = clientId();
    const savedName = localStorage.getItem("gq_name") || "";
    setName(savedName);
    const urlCode = (params.get("code") || "").toUpperCase();
    const savedCode = localStorage.getItem("gq_join_code") || "";
    const initial = urlCode || savedCode;
    if (initial) {
      setCodeInput(initial);
      setActiveCode(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll live state once joined.
  useEffect(() => {
    if (!activeCode) return;
    let alive = true;
    const tick = async () => {
      try {
        const s = await fetchSession(activeCode, cid.current);
        if (alive) {
          setSession(s);
          setError("");
        }
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Connection problem.");
        if (e instanceof Error && /found/i.test(e.message)) {
          setActiveCode(null);
          setSession(null);
        }
      }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [activeCode]);

  const join = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const code = codeInput.trim().toUpperCase();
      if (!code) return;
      localStorage.setItem("gq_join_code", code);
      if (name.trim()) localStorage.setItem("gq_name", name.trim());
      setActiveCode(code);
    },
    [codeInput, name],
  );

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeCode || !draft.trim()) return;
      setSubmitting(true);
      setError("");
      try {
        const s = await submitQuestion(activeCode, {
          text: draft.trim(),
          author: name.trim() || undefined,
          clientId: cid.current,
        });
        setSession(s);
        setDraft("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not submit.");
      } finally {
        setSubmitting(false);
      }
    },
    [activeCode, draft, name],
  );

  const vote = useCallback(
    async (questionId: string) => {
      if (!activeCode) return;
      setBusyId(questionId);
      try {
        const s = await toggleVote(activeCode, {
          questionId,
          clientId: cid.current,
        });
        setSession(s);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Vote failed.");
      } finally {
        setBusyId(null);
      }
    },
    [activeCode],
  );

  const leave = useCallback(() => {
    localStorage.removeItem("gq_join_code");
    setActiveCode(null);
    setSession(null);
    setCodeInput("");
  }, []);

  // ── Join form ──────────────────────────────────────────────────────────────
  if (!activeCode) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <h1 className="text-center text-3xl font-bold text-ink">Join your class</h1>
        <form onSubmit={join} className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              Class code
            </label>
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="ABCD"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={6}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-sky-700 shadow-sm outline-none focus:border-sky-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">
              Your name <span className="text-ink/40">(optional)</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name"
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 shadow-sm outline-none focus:border-sky-400"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-full bg-sky-600 py-3 text-lg font-semibold text-white shadow-sm transition hover:bg-sky-700"
          >
            Join
          </button>
          {error && <p className="text-center text-sm text-red-600">{error}</p>}
        </form>
        <Link href="/" className="mt-8 text-center text-sm text-ink/50 hover:text-ink/80">
          ← Back
        </Link>
      </main>
    );
  }

  const phase = session?.phase ?? "ask";
  const myQuestions = session?.questions ?? [];

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between text-sm text-ink/60">
        <span className="rounded-md bg-white/70 px-2 py-1 font-mono font-bold tracking-widest text-sky-700 shadow-sm">
          {activeCode}
        </span>
        <button onClick={leave} className="hover:text-ink/80">
          Leave
        </button>
      </div>

      {error && <p className="mb-4 text-center text-sm text-red-600">{error}</p>}

      {/* ── ASK ─────────────────────────────────────────────────────────── */}
      {phase === "ask" && (
        <section className="animate-fadeUp">
          <h1 className="text-2xl font-bold text-ink">
            What&apos;s your gospel question?
          </h1>
          <p className="mt-2 text-ink/70">
            Write down a question that&apos;s on your mind. You can add more than
            one. They stay private until your teacher reveals them to the class.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="e.g. How can I know the Holy Ghost is speaking to me?"
              className="w-full resize-none rounded-xl border border-black/10 bg-white px-4 py-3 leading-relaxed shadow-sm outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              disabled={submitting || !draft.trim()}
              className="rounded-full bg-sky-600 px-7 py-2.5 font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50"
            >
              {submitting ? "Adding…" : "Add my question"}
            </button>
          </form>

          {myQuestions.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/50">
                Your questions ({myQuestions.length})
              </h2>
              <ul className="space-y-2">
                {myQuestions.map((q) => (
                  <li
                    key={q.id}
                    className="rounded-lg border border-sky-100 bg-white/80 px-4 py-2 text-ink/90 shadow-sm"
                  >
                    {q.text}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-ink/55">
                Nicely done. Waiting for the teacher to start voting…
              </p>
            </div>
          )}
        </section>
      )}

      {/* ── VOTE ────────────────────────────────────────────────────────── */}
      {phase === "vote" && (
        <section className="animate-fadeUp">
          <h1 className="text-2xl font-bold text-ink">Vote on the questions</h1>
          <p className="mt-2 text-ink/70">
            Tap ▲ on the questions you most want the class to study. You can vote
            for several.
          </p>
          <div className="mt-5">
            <QuestionList
              questions={session?.questions ?? []}
              onVote={vote}
              busyId={busyId}
              emptyText="Waiting for questions…"
            />
          </div>
        </section>
      )}

      {/* ── STUDY ───────────────────────────────────────────────────────── */}
      {phase === "study" && (
        <section>
          {session?.study ? (
            <StudyView study={session.study} />
          ) : (
            <p className="py-16 text-center text-ink/60">
              Your teacher is choosing a question…
            </p>
          )}
        </section>
      )}
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-ink/50">
          Loading…
        </main>
      }
    >
      <JoinInner />
    </Suspense>
  );
}
