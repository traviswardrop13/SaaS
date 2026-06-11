"use client";

import { motion } from "framer-motion";

/**
 * Big friendly face whose mouth opens and closes while speaking. Used in
 * the lesson player so children doing speech therapy can *see* the mouth
 * shape the word at the same time they hear it.
 *
 * The animation isn't phoneme-accurate (a real viseme track per word would
 * be the next step). Instead it pulses the mouth at a typical speech
 * rate while `speaking` is true, which is enough for kids to use the
 * visual as a "match my mouth" cue.
 */
export default function TalkingFace({
  speaking,
  size = 240,
  className,
}: {
  speaking: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      {/* Mane suggestion (slightly bigger circle behind the face) */}
      <circle cx="120" cy="120" r="115" fill="#fb923c" />
      <g fill="#f97316">
        {/* Tufts around the mane to suggest lion fur */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * Math.PI * 2) / 12;
          const cx = 120 + Math.cos(angle) * 110;
          const cy = 120 + Math.sin(angle) * 110;
          return <circle key={i} cx={cx} cy={cy} r="14" />;
        })}
      </g>

      {/* Face */}
      <circle cx="120" cy="120" r="82" fill="#fef3c7" />
      <circle
        cx="120"
        cy="120"
        r="82"
        fill="none"
        stroke="#c2410c"
        strokeWidth="3"
        opacity="0.25"
      />

      {/* Cheeks */}
      <ellipse cx="68" cy="140" rx="14" ry="9" fill="#fbcfe8" />
      <ellipse cx="172" cy="140" rx="14" ry="9" fill="#fbcfe8" />

      {/* Eyes */}
      <motion.g
        animate={{ scaleY: [1, 1, 0.1, 1] }}
        transition={{
          duration: 4,
          repeat: Infinity,
          repeatDelay: 2,
          times: [0, 0.94, 0.97, 1],
        }}
        style={{ transformOrigin: "120px 108px" }}
      >
        <circle cx="92" cy="108" r="10" fill="#1f2937" />
        <circle cx="148" cy="108" r="10" fill="#1f2937" />
        <circle cx="95" cy="104" r="3.5" fill="#ffffff" />
        <circle cx="151" cy="104" r="3.5" fill="#ffffff" />
      </motion.g>

      {/* Nose */}
      <path d="M114 132 L126 132 L120 144 Z" fill="#c2410c" />

      {/* Mouth — the focal point. Animates open/closed while speaking. */}
      <motion.ellipse
        cx="120"
        cy="172"
        rx="30"
        fill="#7c2d12"
        animate={{
          ry: speaking ? [4, 18, 8, 15, 4] : 5,
        }}
        transition={
          speaking
            ? {
                duration: 0.6,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : { duration: 0.2 }
        }
      />

      {/* Tongue hint inside mouth (only visible when mouth is open) */}
      <motion.ellipse
        cx="120"
        cy="178"
        rx="18"
        fill="#ef4444"
        animate={{
          ry: speaking ? [0, 6, 2, 5, 0] : 0,
          opacity: speaking ? 0.8 : 0,
        }}
        transition={
          speaking
            ? {
                duration: 0.6,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : { duration: 0.2 }
        }
      />

      {/* Teeth highlight */}
      <rect
        x="100"
        y="168"
        width="40"
        height="3"
        fill="#fef3c7"
        rx="1.5"
        opacity="0.9"
      />
    </svg>
  );
}
