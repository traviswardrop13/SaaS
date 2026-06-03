"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { findLesson } from "@/lib/lessons";
import {
  loadState,
  recordLessonComplete,
  type Child,
} from "@/lib/storage";
import {
  isSpeechRecognitionSupported,
  prewarmMicrophone,
  speak,
  startRecognition,
  type RecognitionAlternative,
  type RecognitionHandle,
} from "@/lib/speech";
import { scoreUtterance, type ScoreResult } from "@/lib/scoring";

type Phase = "intro" | "prompt" | "listening" | "result" | "done";

export default function LessonPage() {
  const params = useParams<{ id: string; skillId: string; lessonId: string }>();

  const lessonInfo = useMemo(
    () => findLesson(params.skillId, params.lessonId),
    [params.skillId, params.lessonId],
  );
  const [child, setChild] = useState<Child | null>(null);
  const [missing, setMissing] = useState(false);
  const [supported, setSupported] = useState(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [wordIdx, setWordIdx] = useState(0);
  const [interim, setInterim] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const recRef = useRef<RecognitionHandle | null>(null);
  const alternativesRef = useRef<RecognitionAlternative[]>([]);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
    const s = loadState();
    const found = s.children.find((c) => c.id === params.id);
    if (!found) setMissing(true);
    else setChild(found);
  }, [params.id]);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
    };
  }, []);

  if (missing || !lessonInfo) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="font-display text-3xl">
          We couldn&apos;t find that lesson.
        </h1>
        <Link href="/dashboard" className="btn-primary mt-6 inline-flex">
          Back
        </Link>
      </main>
    );
  }
  if (!child) return null;

  const { skill, lesson } = lessonInfo;
  const word = lesson.words[wordIdx];
  const totalWords = lesson.words.length;
  const progressPct = Math.round((wordIdx / totalWords) * 100);

  function playWord() {
    if (word) speak(word.text);
  }

  function beginLesson() {
    // Fire and forget — getting permission now means the very first mic
    // tap doesn't stall on a permission prompt mid-recording.
    if (supported) void prewarmMicrophone();
    setPhase("prompt");
  }

  function startListening() {
    if (!word) return;
    setInterim("");
    setResult(null);
    alternativesRef.current = [];
    setPhase("listening");

    const handle = startRecognition({
      onResult: (alts, isFinal) => {
        alternativesRef.current = alts;
        setInterim(alts[0]?.transcript ?? "");
        if (isFinal) finishUtterance(alts);
      },
      onError: (err) => {
        if (err === "not-allowed" || err === "service-not-allowed") {
          setSupported(false);
        }
        // Any error: drop out of listening; let the kid try again.
        setPhase("prompt");
      },
      onEnd: () => {
        // onEnd fires after stop(). If we already produced a result, we're
        // done. Otherwise, score whatever interim alternatives we collected.
        setPhase((p) => {
          if (p !== "listening") return p;
          finishUtterance(alternativesRef.current);
          return "result";
        });
      },
    });
    recRef.current = handle;
  }

  function finishUtterance(alts: RecognitionAlternative[]) {
    if (!word) return;
    const s = scoreUtterance(alts, {
      target: word.text,
      accepts: word.accepts,
      targetSound: lesson.targetSound,
      position: lesson.position,
    });
    setResult(s);
    setScores((prev) => [...prev, s.similarity]);
    setPhase("result");
    recRef.current?.stop();
  }

  function selfRate(rating: ScoreResult["rating"]) {
    if (!word) return;
    const sim = rating === "great" ? 1 : rating === "ok" ? 0.7 : 0.3;
    const r: ScoreResult = {
      similarity: sim,
      rating,
      matchedAgainst: word.text,
      bestHeard: "",
    };
    setResult(r);
    setScores((prev) => [...prev, sim]);
    setPhase("result");
  }

  function nextWord() {
    const next = wordIdx + 1;
    if (next >= totalWords) {
      completeLesson();
    } else {
      setWordIdx(next);
      setResult(null);
      setInterim("");
      alternativesRef.current = [];
      setPhase("prompt");
    }
  }

  function completeLesson() {
    const avg =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
    const stars = avg >= 0.85 ? 3 : avg >= 0.65 ? 2 : 1;
    const xpEarned = 10 + stars * 5;
    recordLessonComplete(child!.id, lesson.id, {
      stars,
      score: Math.round(avg * 100),
      xpEarned,
    });
    setPhase("done");
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
      <header className="mb-4 flex items-center gap-3">
        <Link
          href={`/kid/${child.id}`}
          className="font-display text-sm text-gray-500 hover:text-gray-700"
        >
          ✕
        </Link>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white shadow-inner">
          <div
            className={`h-full ${skill.color} transition-all`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="font-display text-sm text-gray-500">
          {wordIdx}/{totalWords}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {phase === "intro" && (
          <Panel key="intro">
            <div className="text-6xl">{skill.emoji}</div>
            <h1 className="mt-3 font-display text-3xl font-extrabold">
              {lesson.title}
            </h1>
            <p className="mt-2 text-gray-600">{lesson.hint}</p>
            {!supported && (
              <p className="mt-4 rounded-2xl bg-brand-50 p-3 text-sm text-brand-700">
                Your browser doesn&apos;t support speech recognition (try
                Chrome or Edge). You can still practise — just tap how you
                think you did on each word.
              </p>
            )}
            <button
              onClick={beginLesson}
              className="btn-primary mt-6 w-full text-lg"
            >
              Let&apos;s go!
            </button>
          </Panel>
        )}

        {(phase === "prompt" || phase === "listening" || phase === "result") &&
          word && (
            <Panel key={`word-${wordIdx}-${phase}`}>
              <div className="text-8xl" aria-hidden>
                {word.emoji}
              </div>
              <div className="mt-4 font-display text-5xl font-extrabold text-gray-800">
                {word.text}
              </div>

              <button
                onClick={playWord}
                className="btn-ghost mt-4 text-sm"
                aria-label={`Hear ${word.text}`}
              >
                🔊 Hear it
              </button>

              {phase !== "result" ? (
                <div className="mt-6 w-full">
                  {supported ? (
                    <>
                      <MicButton
                        listening={phase === "listening"}
                        onPress={() => {
                          if (phase === "listening") {
                            recRef.current?.stop();
                          } else {
                            startListening();
                          }
                        }}
                      />
                      <p className="mt-3 text-xs text-gray-400">
                        {phase === "listening"
                          ? "Listening… tap to stop when you're done"
                          : "Tap the mic, then say the word"}
                      </p>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500">
                        How did that sound?
                      </p>
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => selfRate("tryAgain")}
                          className="btn-warn"
                        >
                          Try again
                        </button>
                        <button
                          onClick={() => selfRate("ok")}
                          className="btn-secondary"
                        >
                          Okay
                        </button>
                        <button
                          onClick={() => selfRate("great")}
                          className="btn-primary"
                        >
                          Great!
                        </button>
                      </div>
                    </div>
                  )}
                  {interim && phase === "listening" && (
                    <p className="mt-3 text-sm text-gray-500">
                      I hear: <span className="italic">{interim}</span>
                    </p>
                  )}
                </div>
              ) : (
                <ResultPanel
                  result={result!}
                  onNext={nextWord}
                  onRetry={() => {
                    setResult(null);
                    setInterim("");
                    alternativesRef.current = [];
                    setPhase("prompt");
                    setScores((prev) => prev.slice(0, -1));
                  }}
                />
              )}
            </Panel>
          )}

        {phase === "done" && (
          <Panel key="done">
            <div className="text-7xl">🎉</div>
            <h1 className="mt-3 font-display text-4xl font-extrabold text-brand-600">
              Lesson complete!
            </h1>
            <p className="mt-2 text-gray-600">
              Amazing work, {child.name}. Keep that streak alive!
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href={`/kid/${child.id}`} className="btn-primary">
                Back to map
              </Link>
              <button
                onClick={() => {
                  setWordIdx(0);
                  setScores([]);
                  setResult(null);
                  setInterim("");
                  alternativesRef.current = [];
                  setPhase("intro");
                }}
                className="btn-secondary"
              >
                Play again
              </button>
            </div>
          </Panel>
        )}
      </AnimatePresence>
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.2 }}
      className="card flex flex-1 flex-col items-center justify-center text-center"
    >
      {children}
    </motion.div>
  );
}

function MicButton({
  listening,
  onPress,
}: {
  listening: boolean;
  onPress: () => void;
}) {
  return (
    <button
      onClick={onPress}
      className={`relative mx-auto flex h-24 w-24 items-center justify-center rounded-full text-4xl text-white shadow-chunky transition active:translate-y-1 ${
        listening ? "bg-brand-500" : "bg-grass-500 hover:bg-grass-600"
      }`}
      aria-label={listening ? "Stop recording" : "Tap to record"}
    >
      {listening ? "⏹" : "🎤"}
      {listening && (
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-brand-500 opacity-40" />
      )}
    </button>
  );
}

function ResultPanel({
  result,
  onNext,
  onRetry,
}: {
  result: ScoreResult;
  onNext: () => void;
  onRetry: () => void;
}) {
  const copy =
    result.rating === "great"
      ? { emoji: "🌟", title: "Awesome!", color: "text-grass-600" }
      : result.rating === "ok"
        ? { emoji: "👍", title: "Nice try!", color: "text-sky-500" }
        : { emoji: "💪", title: "Let's try again", color: "text-brand-500" };
  return (
    <div className="mt-6 w-full">
      <div className="text-6xl">{copy.emoji}</div>
      <h2 className={`mt-2 font-display text-3xl font-extrabold ${copy.color}`}>
        {copy.title}
      </h2>
      {result.hint && (
        <p className="mx-auto mt-3 max-w-sm rounded-2xl bg-brand-50 p-3 text-sm font-bold text-brand-700">
          {result.hint}
        </p>
      )}
      {result.bestHeard && (
        <p className="mt-3 text-sm text-gray-500">
          I heard:{" "}
          <span className="italic">&ldquo;{result.bestHeard}&rdquo;</span>
        </p>
      )}
      <div className="mt-6 flex justify-center gap-3">
        {result.rating !== "great" && (
          <button onClick={onRetry} className="btn-ghost">
            Try again
          </button>
        )}
        <button onClick={onNext} className="btn-primary">
          {result.rating === "great" ? "Next" : "Keep going"}
        </button>
      </div>
    </div>
  );
}
