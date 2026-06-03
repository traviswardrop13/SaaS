"use client";

import { motion } from "framer-motion";

/**
 * Friendly mascot with a chat-bubble caption — Duolingo's "Duo" pattern but
 * with our lion. The bubble points back at the lion; the lion does a gentle
 * idle bounce so the screen feels alive.
 */
export default function Mascot({
  message,
  size = "md",
  align = "left",
}: {
  message?: string;
  size?: "sm" | "md" | "lg";
  align?: "left" | "center";
}) {
  const dim =
    size === "lg" ? "text-7xl sm:text-8xl" : size === "sm" ? "text-5xl" : "text-6xl sm:text-7xl";
  return (
    <div
      className={`flex w-full items-end gap-3 ${
        align === "center" ? "justify-center" : "justify-start"
      }`}
    >
      <motion.div
        className={dim}
        aria-hidden
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        🦁
      </motion.div>
      {message && (
        <div className="relative max-w-xs rounded-3xl rounded-bl-md border-2 border-gray-100 bg-white px-4 py-3 font-display text-lg font-bold text-gray-800 shadow-chunky-sm sm:text-xl">
          {message}
        </div>
      )}
    </div>
  );
}
