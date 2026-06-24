"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * SoundSorter mini-game — words appear one at a time and the kid taps
 * "Has it!" or "Nope!" depending on whether the word contains the target
 * sound. Builds auditory discrimination skills — the foundation of
 * articulation therapy per the Van Riper approach.
 *
 * Design: big word card in the center, two buckets below. Swiping or
 * tapping sorts the word. Score at the end.
 */

export type SortWord = {
  text: string;
  emoji?: string;
  hasTarget: boolean;
};

type Props = {
  targetSound: string;
  words: SortWord[];
  color: string;
  onComplete: (correct: number, total: number) => void;
};

export default function SoundSorter({
  targetSound,
  words,
  color,
  onComplete,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<"right" | "wrong" | null>(null);

  const current = words[idx];
  const total = words.length;
  const done = idx >= total;

  const handleSort = useCallback(
    (saidHasIt: boolean) => {
      if (done || feedback) return;
      const isRight = saidHasIt === current.hasTarget;
      if (isRight) setCorrect((c) => c + 1);
      setFeedback(isRight ? "right" : "wrong");

      setTimeout(() => {
        setFeedback(null);
        const next = idx + 1;
        if (next >= total) {
          onComplete(correct + (isRight ? 1 : 0), total);
        } else {
          setIdx(next);
        }
      }, 800);
    },
    [current, done, feedback, idx, total, correct, onComplete],
  );

  if (done) return null; // parent handles done state

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col items-center"
    >
      <h2 className="font-display text-xl font-extrabold text-gray-800 sm:text-2xl">
        Does this word have{" "}
        <span className={`inline-block rounded-lg px-2 text-white ${color}`}>
          /{targetSound}/
        </span>
        ?
      </h2>

      {/* Progress dots */}
      <div className="mt-3 flex gap-1.5">
        {words.map((_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full transition ${
              i < idx
                ? "bg-grass-500"
                : i === idx
                  ? `${color} scale-125`
                  : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {/* Word card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ type: "spring", damping: 20, stiffness: 200 }}
          className={`mt-8 flex h-48 w-64 flex-col items-center justify-center rounded-3xl bg-white shadow-chunky ${
            feedback === "right"
              ? "ring-4 ring-green-400"
              : feedback === "wrong"
                ? "ring-4 ring-red-400"
                : ""
          }`}
        >
          {current.emoji && (
            <span className="text-5xl">{current.emoji}</span>
          )}
          <span className="mt-2 font-display text-3xl font-extrabold text-gray-800">
            {current.text}
          </span>
          {feedback && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="mt-2 text-2xl"
            >
              {feedback === "right" ? "✅" : "❌"}
            </motion.span>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Sort buttons */}
      <div className="mt-8 flex w-full max-w-sm gap-4">
        <button
          onClick={() => handleSort(false)}
          disabled={!!feedback}
          className="flex-1 rounded-2xl border-3 border-red-200 bg-red-50 py-4 font-display text-lg font-extrabold text-red-500 shadow-chunky-sm transition hover:bg-red-100 active:translate-y-1 disabled:opacity-50"
        >
          Nope! 🚫
        </button>
        <button
          onClick={() => handleSort(true)}
          disabled={!!feedback}
          className="flex-1 rounded-2xl border-3 border-green-200 bg-green-50 py-4 font-display text-lg font-extrabold text-green-600 shadow-chunky-sm transition hover:bg-green-100 active:translate-y-1 disabled:opacity-50"
        >
          Has it! ✅
        </button>
      </div>

      <p className="mt-3 text-xs font-bold text-gray-400">
        {idx + 1} of {total}
      </p>
    </motion.div>
  );
}
