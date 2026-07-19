"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import type { PublicSession } from "@/lib/types";
import {
  clientId,
  createSession,
  fetchSession,
  setPhase,
  toggleVote,
} from "@/lib/clientApi";
import QuestionList from "@/components/QuestionList";
import StudyView from "@/components/StudyView";

interface HostCreds {
  code: string;
  hostToken: string;
}

const STORE_KEY = "gq_host";

export default function HostPage() {
  const [creds, setCreds] = useState<HostCreds | null>(null);
  const [session, setSession] = useState<PublicSession | null>(null);
  const [qr, setQr] = useState<string>("");
  const [joinUrl, setJoinUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [starting, setStarting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const cid = useRef<string>("");

  // Restore an in-progress class + client id.
  useEffect(() => {
    cid.current = clientId();
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setCreds(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Build the join URL + QR once we have a code.
  useEffect(() => {
    if (!creds) return;
    const url = `${window.location.origin}/join?code=${creds.code}`;
    setJoinUrl(url);
    QRCode.toDataURL(url, { margin: 1, width: 240 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [creds]);

  // Poll live state.
  useEffect(() => {
    if (!creds) return;
    let alive = true;
    const tick = async () => {
      try {
        const s = await fetchSession(creds.code, cid.current);
        if (alive) setSession(s);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Connection problem.");
      }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [creds]);

  const start = useCallback(async () => {
    setStarting(true);
    setError("");
    try {
      const c = await createSession();
      const next = { code: c.code, hostToken: c.hostToken };
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
      setCreds(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a class.");
    } finally {
      setStarting(false);
    }
  }, []);

  const changePhase = useCallback(
    async (phase: "ask" | "vote" | "study", selectedQuestionId?: string) => {
      if (!creds) return;
      setError("");
      if (selectedQuestionId) setBusyId(selectedQuestionId);
      try {
        const s = await setPhase(creds.code, {
          phase,
          selectedQuestionId,
          hostToken: creds.hostToken,
        });
        setSession(s);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusyId(null);
      }
    },
    [creds],
  );

  const vote = useCallback(
    async (questionId: string) => {
      if (!creds) return;
      try {
        const s = await toggleVote(creds.code, { questionId, clientId: cid.current });
        setSession(s);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Vote failed.");
      }
    },
    [creds],
  );

  const endClass = useCallback(() => {
    if (!confirm("End this class and clear the room? This can't be undone.")) return;
    localStorage.removeItem(STORE_KEY);
    setCreds(null);
    setSession(null);
    setQr("");
  }, []);

  // ── Start screen ───────────────────────────────────────────────────────────
  if (!creds) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-bold text-ink">Start a class</h1>
        <p className="mt-3 max-w-sm text-ink/70">
          This creates a room with a join code your class members can open on
          their phones.
        </p>
        <button
          onClick={start}
          disabled={starting}
          className="mt-8 rounded-full bg-sky-600 px-8 py-3 text-lg font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
        >
          {starting ? "Creating…" : "Create class"}
        </button>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <Link href="/" className="mt-10 text-sm text-ink/50 hover:text-ink/80">
          ← Back
        </Link>
      </main>
    );
  }

  const phase = session?.phase ?? "ask";

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-ink/60">
          <span className="rounded-md bg-white/70 px-2 py-1 font-mono text-base font-bold tracking-widest text-sky-700 shadow-sm">
            {creds.code}
          </span>
          <span>teacher view</span>
        </div>
        <button
          onClick={endClass}
          className="text-sm text-ink/40 underline-offset-2 hover:text-red-600 hover:underline"
        >
          End class
        </button>
      </div>

      {session && !session.shared && (
        <div className="mb-6 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Single-screen mode.</strong> Phones won&apos;t sync yet — this
          works on one device (great for testing). To let everyone join on their
          own phones, connect a shared store (see the README).
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* ── ASK ─────────────────────────────────────────────────────────── */}
      {phase === "ask" && (
        <section className="animate-fadeUp text-center">
          <h1 className="text-2xl font-bold text-ink">Have your class join</h1>
          <p className="mt-2 text-ink/70">
            They can scan this code or go to the address below and enter{" "}
            <span className="font-mono font-bold text-sky-700">{creds.code}</span>.
          </p>

          <div className="mx-auto mt-6 w-fit rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="Join QR code" width={240} height={240} />
            ) : (
              <div className="h-[240px] w-[240px] animate-pulse rounded bg-black/5" />
            )}
          </div>
          {joinUrl && (
            <p className="mt-3 break-all text-sm text-ink/60">{joinUrl}</p>
          )}

          <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-white/70 px-5 py-2 shadow-sm">
            <span className="text-2xl font-bold tabular-nums text-sky-700">
              {session?.submittedCount ?? 0}
            </span>
            <span className="text-ink/70">
              question{(session?.submittedCount ?? 0) === 1 ? "" : "s"} written
              so far
            </span>
          </div>

          <p className="mt-2 text-xs text-ink/45">
            Questions stay hidden from the class until you reveal them.
          </p>

          <div>
            <button
              onClick={() => changePhase("vote")}
              disabled={(session?.submittedCount ?? 0) === 0}
              className="mt-6 rounded-full bg-gold-500 px-8 py-3 text-lg font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reveal all &amp; start voting →
            </button>
          </div>
        </section>
      )}

      {/* ── VOTE ────────────────────────────────────────────────────────── */}
      {phase === "vote" && (
        <section className="animate-fadeUp">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-ink">Vote on the questions</h1>
              <p className="text-sm text-ink/65">
                Everyone taps ▲ on the questions they most want to study. Pick one
                when you&apos;re ready.
              </p>
            </div>
            <button
              onClick={() => changePhase("ask")}
              className="whitespace-nowrap text-sm text-ink/50 hover:text-ink/80"
            >
              ← Collect more
            </button>
          </div>

          <QuestionList
            questions={session?.questions ?? []}
            onVote={vote}
            onSelect={(id) => changePhase("study", id)}
            selectLabel="Study this"
            busyId={busyId}
            emptyText="No questions were submitted."
          />
        </section>
      )}

      {/* ── STUDY ───────────────────────────────────────────────────────── */}
      {phase === "study" && (
        <section>
          <button
            onClick={() => changePhase("vote")}
            className="mb-4 text-sm text-ink/50 hover:text-ink/80"
          >
            ← Back to questions
          </button>
          {session?.study ? (
            <StudyView study={session.study} />
          ) : (
            <p className="py-16 text-center text-ink/60">
              Gathering scriptures and teachings…
            </p>
          )}
        </section>
      )}
    </main>
  );
}
