"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { findLesson, LEVEL_INFO } from "@/lib/lessons";
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
import TalkingFace from "@/components/TalkingFace";

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
  const [isSpeaking, setIsSpeaking] = useState(false);
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

  // Auto-play the target word whenever we land on a fresh prompt — Duolingo's
  // pattern. The face animates while the audio plays so the kid sees the
  // mouth move at the same time they hear the word.
  const currentWordText =
    lessonInfo?.lesson.words[wordIdx]?.text ?? "";
  useEffect(() => {
    if (phase === "prompt" && currentWordText) {
      playWord();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentWordText]);

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
  // Browser speech recognition is unreliable on isolated phonemes ("ssss"),
  // so isolation lessons always use the self-rate UI instead of the mic.
  const useSelfRate = !supported || lesson.level === "isolation";

  function playWord() {
    if (!word) return;
    speak(word.text, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
  }

  function beginLesson() {
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
        setPhase("prompt");
      },
      onEnd: () => {
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
      blend: lesson.blend,
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
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col bg-white px-4 py-4">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href={`/kid/${child.id}`}
          aria-label="Close lesson"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:text-gray-700"
        >
          ✕
        </Link>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full ${skill.color} transition-all duration-300`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      <AnimatePresence mode="wait">
        {phase === "intro" && (
          <IntroPanel
            key="intro"
            skillEmoji={skill.emoji}
            title={lesson.title}
            hint={lesson.hint}
            supported={supported}
            onStart={beginLesson}
          />
        )}

        {(phase === "prompt" || phase === "listening" || phase === "result") &&
          word && (
            <motion.div
              key={`word-${wordIdx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-1 flex-col"
            >
              {/* Level badge + heading */}
              <div className="text-center">
                <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-gray-500">
                  Level {LEVEL_INFO[lesson.level].short} ·{" "}
                  {LEVEL_INFO[lesson.level].label}
                </span>
                <h2 className="mt-2 font-display text-2xl font-extrabold text-gray-800 sm:text-3xl">
                  {lesson.level === "isolation"
                    ? "Make the sound"
                    : "Say it out loud"}
                </h2>
              </div>

              {/* Speech bubble with the target word */}
              <div className="mx-auto mt-6 max-w-md">
                <button
                  type="button"
                  onClick={playWord}
                  className="relative flex w-full items-center gap-3 rounded-3xl border-2 border-gray-100 bg-white px-5 py-4 text-left shadow-chunky-sm transition active:scale-95"
                  aria-label={`Play ${word.text}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${skill.color}`}
                    aria-hidden
                  >
                    🔊
                  </span>
                  <span className="flex-1">
                    <span className="font-display text-2xl font-extrabold text-gray-800 sm:text-3xl">
                      {word.text}
                    </span>
                  </span>
                  {word.emoji && (
                    <span className="text-4xl" aria-hidden>
                      {word.emoji}
                    </span>
                  )}
                </button>
                {/* Bubble pointer */}
                <div className="relative mx-auto h-3 w-6">
                  <div className="absolute inset-0 -translate-y-1 rotate-45 border-b-2 border-r-2 border-gray-100 bg-white" />
                </div>
              </div>

              {/* Talking face */}
              <div className="mt-4 flex justify-center">
                <TalkingFace speaking={isSpeaking} size={220} />
              </div>

              {/* Mic / self-rate area */}
              <div className="mt-auto flex flex-col items-center gap-2 pb-4">
                {!useSelfRate ? (
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
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      {phase === "listening"
                        ? "Listening… tap to stop"
                        : "Tap the mic and say the word"}
                    </p>
                    {interim && phase === "listening" && (
                      <p className="text-sm text-gray-500">
                        I hear:{" "}
                        <span className="italic">{interim}</span>
                      </p>
                    )}
                  </>
                ) : (
                  <div className="w-full space-y-2">
                    <p className="text-center text-sm font-bold text-gray-500">
                      {lesson.level === "isolation"
                        ? "How did your child sound?"
                        : "Speech recognition isn't available here. How did it sound?"}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => selfRate("tryAgain")}
                        className="btn-warn"
                      >
                        Again
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
              </div>
            </motion.div>
          )}

        {phase === "done" && (
          <DonePanel
            key="done"
            childName={child.name}
            onMap={undefined}
            childId={child.id}
            scores={scores}
            onReplay={() => {
              setWordIdx(0);
              setScores([]);
              setResult(null);
              setInterim("");
              alternativesRef.current = [];
              setPhase("intro");
            }}
          />
        )}
      </AnimatePresence>

      {/* Result card slides up from bottom when scoring lands */}
      <AnimatePresence>
        {phase === "result" && result && (
          <ResultCard
            key="result"
            result={result}
            onContinue={nextWord}
            onRetry={() => {
              setResult(null);
              setInterim("");
              alternativesRef.current = [];
              setPhase("prompt");
              setScores((prev) => prev.slice(0, -1));
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function IntroPanel({
  skillEmoji,
  title,
  hint,
  supported,
  onStart,
}: {
  skillEmoji: string;
  title: string;
  hint: string;
  supported: boolean;
  onStart: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.2 }}
      className="flex flex-1 flex-col items-center justify-center text-center"
    >
      <div className="text-7xl">{skillEmoji}</div>
      <h1 className="mt-4 font-display text-3xl font-extrabold text-gray-800">
        {title}
      </h1>
      <p className="mt-2 max-w-sm text-gray-600">{hint}</p>
      {!supported && (
        <p className="mt-4 max-w-sm rounded-2xl bg-brand-50 p-3 text-sm text-brand-700">
          Your browser doesn&apos;t support speech recognition (try Chrome or
          Edge). You can still practise — just tap how you think you did on
          each word.
        </p>
      )}
      <button onClick={onStart} className="btn-primary mt-8 w-full uppercase">
        Let&apos;s go
      </button>
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

/**
 * Duolingo-style result card that slides up from the bottom and pins to it.
 * Uses motion.div for spring-y entrance.
 */
function ResultCard({
  result,
  onContinue,
  onRetry,
}: {
  result: ScoreResult;
  onContinue: () => void;
  onRetry: () => void;
}) {
  const great = result.rating === "great";
  const ok = result.rating === "ok";
  const palette = great
    ? { bg: "bg-grass-500/15", border: "border-grass-500", text: "text-grass-600", emoji: "✓", title: "Good job!" }
    : ok
      ? { bg: "bg-sky-500/15", border: "border-sky-500", text: "text-sky-600", emoji: "👍", title: "Nice try!" }
      : { bg: "bg-brand-500/15", border: "border-brand-500", text: "text-brand-600", emoji: "💪", title: "Let's try again" };
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 220 }}
      className={`fixed inset-x-0 bottom-0 z-20 ${palette.bg} border-t-4 ${palette.border}`}
    >
      <div className="mx-auto max-w-xl px-4 pb-6 pt-4">
        <div className="flex items-center gap-3">
          <span className={`text-3xl ${palette.text}`} aria-hidden>
            {palette.emoji}
          </span>
          <h2
            className={`font-display text-2xl font-extrabold sm:text-3xl ${palette.text}`}
          >
            {palette.title}
          </h2>
        </div>
        {result.bestHeard && (
          <p className="mt-1 text-sm text-gray-600">
            I heard:{" "}
            <span className="italic">&ldquo;{result.bestHeard}&rdquo;</span>
          </p>
        )}
        {result.hint && (
          <p className="mt-2 rounded-xl bg-white p-2 text-sm font-bold text-gray-700">
            {result.hint}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          {!great && (
            <button onClick={onRetry} className="btn-ghost flex-1 uppercase">
              Try again
            </button>
          )}
          <button
            onClick={onContinue}
            className={`flex-1 uppercase ${great ? "btn-primary" : "btn-secondary"}`}
          >
            Continue
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function DonePanel({
  childName,
  childId,
  scores,
  onReplay,
}: {
  childName: string;
  childId: string;
  onMap?: never;
  scores: number[];
  onReplay: () => void;
}) {
  const avg =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const stars = avg >= 0.85 ? 3 : avg >= 0.65 ? 2 : 1;
  const accuracy = Math.round(avg * 100);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.2 }}
      className="flex flex-1 flex-col items-center justify-center text-center"
    >
      <div className="text-7xl">🎉</div>
      <h1 className="mt-4 font-display text-4xl font-extrabold text-brand-600">
        Lesson complete!
      </h1>
      <p className="mt-2 max-w-sm text-gray-600">
        Amazing work, {childName}. Keep that streak alive!
      </p>
      <div className="mt-6 grid w-full max-w-sm grid-cols-3 gap-3">
        <Stat label="Stars" value={`${stars}⭐`} />
        <Stat label="Accuracy" value={`${accuracy}%`} />
        <Stat label="XP" value={`+${10 + stars * 5}`} />
      </div>
      <div className="mt-8 flex w-full max-w-sm flex-col gap-2">
        <Link href={`/kid/${childId}`} className="btn-primary uppercase">
          Back to map
        </Link>
        <button onClick={onReplay} className="btn-ghost uppercase">
          Play again
        </button>
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-brand-50 px-3 py-3 text-center">
      <div className="font-display text-xl font-extrabold text-brand-600">
        {value}
      </div>
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
    </div>
  );
}
