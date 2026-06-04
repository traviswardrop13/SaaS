"use client";

import { motion } from "framer-motion";
import type { TargetSound } from "@/lib/scoring";

/**
 * Sagittal (side-view) cross-section of the mouth showing tongue, teeth,
 * palate and lips. The tongue shape morphs per target sound — this is the
 * standard speech-therapy visual that shows a child *what's happening
 * inside* their mouth, not just what it looks like from outside.
 *
 * Coordinates are tuned for a 240x240 viewBox. The head profile faces
 * right; the mouth cavity is in the lower-right quarter where there's
 * room to render meaningful tongue movement.
 *
 * Note: this is a stylised diagram, not anatomical realism. Real SLP
 * teaching diagrams use the same simplification — clarity > correctness
 * at this scale.
 */

const TONGUE_PATHS: Record<TargetSound, string> = {
  // Tip up behind upper teeth, slight groove down the centre for airflow.
  S: "M 78 195 Q 100 178 130 174 Q 155 174 160 168 Q 162 175 158 184 L 158 198 L 90 198 Z",
  // Bunched in the middle, tip retracted.
  R: "M 78 198 Q 100 186 122 174 Q 140 176 150 188 L 158 200 L 90 200 Z",
  // Tip touches alveolar ridge, sides relaxed down.
  L: "M 78 195 Q 105 176 145 168 Q 158 168 162 178 L 162 198 L 90 198 Z",
  // Body bunched back, lips will round forward (drawn separately).
  SH: "M 78 196 Q 100 186 130 184 Q 152 188 162 196 L 90 200 Z",
  // Tip pokes forward between the teeth.
  TH: "M 78 192 Q 105 178 145 178 Q 165 184 175 192 L 90 200 Z",
  // Like SH but slightly more forward and tip up.
  CH: "M 78 195 Q 105 180 135 180 Q 155 184 162 192 L 90 200 Z",
  // Back of tongue raised against soft palate.
  K: "M 78 200 Q 95 196 115 190 Q 140 178 158 168 Q 165 174 162 184 L 162 200 L 90 202 Z",
  G: "M 78 200 Q 95 196 115 190 Q 140 178 158 168 Q 165 174 162 184 L 162 200 L 90 202 Z",
  // Resting low; the action is at the lip (drawn separately).
  F: "M 78 200 Q 105 196 140 198 Q 158 200 162 202 L 90 204 Z",
  P: "M 78 200 Q 105 196 140 198 Q 158 200 162 202 L 90 204 Z",
  // Tip up to alveolar ridge, body flat.
  T: "M 78 195 Q 100 184 140 178 Q 158 180 162 188 L 162 200 L 90 200 Z",
  M: "M 78 200 Q 105 196 140 198 Q 158 200 162 202 L 90 204 Z",
  N: "M 78 195 Q 100 184 140 178 Q 158 180 162 188 L 162 200 L 90 200 Z",
};

const HINTS: Partial<Record<TargetSound, string>> = {
  S: "Tongue tip up behind your top teeth. Air whistles out the front.",
  R: "Pull your tongue back and bunch it up high inside.",
  L: "Tongue tip up — touch the bumpy spot behind your top teeth.",
  SH: "Tongue pulled back, lips rounded forward — like a fish.",
  TH: "Stick your tongue tip between your teeth — barely poking out.",
  CH: "Tongue tip behind top teeth, then pop and release — choo choo!",
  K: "Back of your tongue lifts up to the back roof of your mouth.",
  G: "Like K, but turn your voice on.",
  F: "Top teeth on your bottom lip — then blow softly.",
  P: "Lips closed, then pop them open with a puff of air.",
  T: "Tongue tip behind your top teeth — tap and release.",
  M: "Lips closed — humming sound through your nose.",
  N: "Tongue tip up — humming sound through your nose.",
};

/** Lips: closed (P/B/M), rounded forward (SH/CH/OO), or lower-on-upper-teeth (F/V). */
function lipState(sound: TargetSound): "closed" | "rounded" | "labiodental" | "open" {
  if (sound === "P" || sound === "M") return "closed";
  if (sound === "SH" || sound === "CH") return "rounded";
  if (sound === "F") return "labiodental";
  return "open";
}

export default function MouthDiagram({
  sound,
  size = 220,
  showHint = true,
  showAirflow = true,
}: {
  sound: TargetSound;
  size?: number;
  showHint?: boolean;
  showAirflow?: boolean;
}) {
  const lips = lipState(sound);
  const hasAirflow =
    showAirflow && (sound === "S" || sound === "SH" || sound === "TH" || sound === "F");

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 240 240" width={size} height={size} aria-hidden>
        {/* Head profile — facing right */}
        <path
          d="M 110 30 Q 75 35 60 70 Q 50 105 55 145 Q 60 180 78 200 Q 88 215 105 220 Q 130 222 150 218 Q 165 215 168 205 L 178 200 Q 195 185 198 160 Q 210 130 200 95 Q 188 55 155 38 Q 130 28 110 30 Z"
          fill="#fde68a"
          stroke="#b45309"
          strokeWidth="2"
        />

        {/* Hair */}
        <path
          d="M 88 45 Q 90 22 130 22 Q 175 24 198 50 Q 200 70 192 80 Q 180 60 145 55 Q 110 52 88 60 Z"
          fill="#7c2d12"
        />

        {/* Ear */}
        <ellipse cx="172" cy="115" rx="6" ry="11" fill="#fcd34d" stroke="#b45309" strokeWidth="1.5" />

        {/* Eye */}
        <ellipse cx="118" cy="108" rx="3.5" ry="4" fill="#1f2937" />
        <circle cx="119" cy="106" r="1.2" fill="#ffffff" />

        {/* Eyebrow */}
        <path
          d="M 107 96 Q 118 91 130 95"
          stroke="#7c2d12"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />

        {/* Nose */}
        <path
          d="M 95 135 Q 70 142 70 158 Q 72 168 90 165"
          fill="#fde68a"
          stroke="#b45309"
          strokeWidth="2"
        />

        {/* ====== Mouth cross-section ====== */}

        {/* Mouth cavity (dark interior) */}
        <path
          d="M 70 178 Q 80 184 100 186 L 162 174 L 175 180 L 170 198 L 100 206 Q 80 204 65 196 Z"
          fill="#7f1d1d"
        />

        {/* Hard palate curve */}
        <path
          d="M 92 178 Q 130 168 168 175"
          stroke="#fef3c7"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Upper teeth row */}
        <g fill="white" stroke="#e5e7eb" strokeWidth="0.5">
          <rect x="92" y="176" width="6" height="10" rx="1" />
          <rect x="100" y="176" width="6" height="10" rx="1" />
          <rect x="108" y="176" width="6" height="10" rx="1" />
        </g>

        {/* Lower teeth row */}
        <g fill="white" stroke="#e5e7eb" strokeWidth="0.5">
          <rect x="92" y="192" width="6" height="10" rx="1" />
          <rect x="100" y="192" width="6" height="10" rx="1" />
          <rect x="108" y="192" width="6" height="10" rx="1" />
        </g>

        {/* Tongue — morphs per sound */}
        <motion.path
          animate={{ d: TONGUE_PATHS[sound] }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          fill="#fb7185"
          stroke="#9f1239"
          strokeWidth="1.5"
        />

        {/* Lips — state changes by sound (closed / rounded / labiodental / open) */}
        {lips === "closed" && (
          <>
            <path d="M 60 184 Q 75 178 90 184 L 90 192 Q 75 198 60 192 Z" fill="#dc2626" />
          </>
        )}
        {lips === "open" && (
          <>
            <path d="M 60 178 Q 75 172 90 176 L 90 182 Q 75 184 60 184 Z" fill="#dc2626" />
            <path d="M 60 196 Q 75 204 90 200 L 90 192 Q 75 192 60 192 Z" fill="#dc2626" />
          </>
        )}
        {lips === "rounded" && (
          <>
            {/* Pursed forward */}
            <path d="M 52 184 Q 65 175 82 180 L 82 188 Q 70 195 52 196 Z" fill="#dc2626" />
            <path d="M 52 196 Q 65 205 82 200 L 82 188 L 52 188 Z" fill="#b91c1c" />
          </>
        )}
        {lips === "labiodental" && (
          <>
            {/* Lower lip tucked against upper teeth */}
            <path d="M 60 178 Q 75 172 90 176 L 90 182 Q 75 184 60 184 Z" fill="#dc2626" />
            <path d="M 70 192 Q 82 184 100 188 Q 95 196 75 198 Z" fill="#dc2626" />
          </>
        )}

        {/* Airflow indication — dashed line + arrowhead, pulsing */}
        {hasAirflow && (
          <motion.g
            stroke="#0ea5e9"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="4 4"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.3, repeat: Infinity }}
          >
            <path d="M 60 188 Q 40 188 25 184" />
            <path d="M 25 184 L 32 180 M 25 184 L 32 188" strokeDasharray="0" />
          </motion.g>
        )}
      </svg>

      {showHint && HINTS[sound] && (
        <p className="mt-3 max-w-xs text-center text-sm font-bold text-gray-700">
          {HINTS[sound]}
        </p>
      )}
    </div>
  );
}
