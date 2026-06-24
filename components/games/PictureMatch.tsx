"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * PictureMatch mini-game — show 4 emoji/picture options, kid taps the one
 * that contains the target sound. Teaches sound *identification* — the
 * auditory discrimination SLPs want at the awareness level.
 *
 * After tapping, we optionally ask the kid to *say* the correct word so
 * it doubles as articulation practice.
 */

export type PictureOption = {
  text: string;
  emoji: string;
  hasTarget: boolean;
};

type Props = {
  /** The target sound (e.g. "S") — shown in the prompt */
  targetSound: string;
  /** 4 options, exactly 1 should have hasTarget = true */
  options: PictureOption[];
  /** Accent color class, e.g. "bg-sky-500" */
  color: string;
  /** Called with true/false after kid picks */
  onAnswer: (correct: boolean, chosen: PictureOption) => void;
};

export default function PictureMatch({
  targetSound,
  options,
  color,
  onAnswer,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Reset on new options
  useEffect(() => {
    setSelected(null);
    setRevealed(false);
  }, [options]);

  function handlePick(idx: number) {
    if (selected !== null) return; // already picked
    setSelected(idx);
    setRevealed(true);
    const opt = options[idx];
    // Short delay so kid sees the result
    setTimeout(() => onAnswer(opt.hasTarget, opt), 1200);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col items-center"
    >
      <h2 className="font-display text-2xl font-extrabold text-gray-800 sm:text-3xl">
        Which one has the{" "}
        <span className={`inline-block rounded-lg px-2 text-white ${color}`}>
          /{targetSound}/
        </span>{" "}
        sound?
      </h2>
      <p className="mt-1 text-sm text-gray-500">Tap the right picture!</p>

      <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-4">
        {options.map((opt, i) => {
          const isPicked = selected === i;
          const isCorrect = opt.hasTarget;
          let ringClass = "border-gray-200 hover:border-gray-300";
          if (revealed) {
            if (isCorrect) ringClass = "border-green-400 bg-green-50";
            else if (isPicked && !isCorrect)
              ringClass = "border-red-400 bg-red-50";
            else ringClass = "border-gray-200 opacity-50";
          }

          return (
            <motion.button
              key={i}
              onClick={() => handlePick(i)}
              whileTap={{ scale: 0.95 }}
              className={`flex flex-col items-center justify-center rounded-2xl border-3 p-6 shadow-chunky-sm transition ${ringClass}`}
              disabled={selected !== null}
            >
              <span className="text-5xl">{opt.emoji}</span>
              <span className="mt-2 font-display text-lg font-extrabold text-gray-700">
                {opt.text}
              </span>
              <AnimatePresence>
                {revealed && isCorrect && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="mt-1 text-xl"
                  >
                    ✅
                  </motion.span>
                )}
                {revealed && isPicked && !isCorrect && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="mt-1 text-xl"
                  >
                    ❌
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
