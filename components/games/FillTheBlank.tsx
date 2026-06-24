"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { speak } from "@/lib/speech";

/**
 * Fill-the-blank mini-game — a sentence with a gap where the target word
 * belongs. The kid sees the context and says the missing word out loud.
 *
 * Examples:
 *   "The _____ is shining"  →  kid says "sun"  (for /S/ sound)
 *   "I see a big _____"     →  kid says "rock" (for /R/ sound)
 *
 * Combines contextual language practice with articulation — SLPs call this
 * "carrier phrases" and it's a real clinical technique.
 */

export type BlankItem = {
  /** The full sentence with ___ where the word goes */
  sentence: string;
  /** The answer word the kid should say */
  answer: string;
  /** Emoji hint for the answer */
  emoji?: string;
  /** Optional accepted alternatives */
  accepts?: string[];
};

type Props = {
  item: BlankItem;
  color: string;
  /** Called when kid is ready to say the word — parent handles mic */
  onReady: () => void;
  /** Show the word after the kid says it */
  revealed?: boolean;
};

export default function FillTheBlank({
  item,
  color,
  onReady,
  revealed = false,
}: Props) {
  const [hasPlayed, setHasPlayed] = useState(false);

  // Auto-read the sentence on mount (pausing at the blank)
  useEffect(() => {
    setHasPlayed(false);
    const beforeBlank = item.sentence.split("___")[0]?.trim() || "";
    if (beforeBlank) {
      speak(beforeBlank + "…", {
        onEnd: () => setHasPlayed(true),
      });
    } else {
      setHasPlayed(true);
    }
  }, [item]);

  // Split sentence around the blank
  const parts = item.sentence.split("___");
  const before = parts[0] || "";
  const after = parts[1] || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col items-center text-center"
    >
      <h2 className="font-display text-xl font-extrabold text-gray-800 sm:text-2xl">
        Say the missing word! 🗣️
      </h2>

      {/* Sentence with blank */}
      <div className="mt-8 w-full max-w-md rounded-3xl bg-white p-6 shadow-chunky">
        <p className="font-display text-2xl font-extrabold leading-relaxed text-gray-800 sm:text-3xl">
          {before}
          <span
            className={`mx-1 inline-block min-w-[80px] rounded-xl border-b-4 px-3 py-1 ${
              revealed
                ? `${color} text-white border-transparent`
                : "border-dashed border-gray-300 bg-gray-50 text-gray-400"
            }`}
          >
            {revealed ? item.answer : "???"}
          </span>
          {after}
        </p>
      </div>

      {/* Emoji hint */}
      {item.emoji && (
        <motion.div
          className="mt-4 text-6xl"
          animate={{ rotate: [0, -5, 5, -5, 0] }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          {item.emoji}
        </motion.div>
      )}

      {/* Instruction */}
      {hasPlayed && !revealed && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-sm font-bold text-gray-500"
        >
          Can you fill in the blank?
        </motion.p>
      )}
    </motion.div>
  );
}
