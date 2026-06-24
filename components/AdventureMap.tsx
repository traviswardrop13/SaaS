"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Skill } from "@/lib/lessons";
import type { Child } from "@/lib/storage";

/**
 * Duolingo ABC–style adventure map. Each skill is a "world" shown as a
 * colourful building on a horizontal-scrolling cityscape. The child taps
 * a building to enter the vertical challenge path inside that world.
 *
 * Design: chunky, playful, kid-friendly with big tap targets.
 */

/** Decorative building shapes — one per index, wraps around. */
const BUILDINGS: {
  svg: (color: string, emoji: string) => React.ReactNode;
}[] = [
  {
    // Tall house with pointed roof
    svg: (color, emoji) => (
      <g>
        <rect x="15" y="50" width="70" height="80" rx="8" fill={color} />
        <polygon points="10,55 50,15 90,55" fill={color} />
        <rect x="35" y="90" width="30" height="40" rx="4" fill="#fef3c7" />
        <circle cx="50" cy="40" r="4" fill="#fef3c7" />
        <text x="50" y="75" textAnchor="middle" fontSize="28">{emoji}</text>
      </g>
    ),
  },
  {
    // Round dome / observatory
    svg: (color, emoji) => (
      <g>
        <rect x="20" y="65" width="60" height="65" rx="8" fill={color} />
        <ellipse cx="50" cy="65" rx="35" ry="25" fill={color} />
        <rect x="32" y="95" width="36" height="35" rx="4" fill="#fef3c7" />
        <text x="50" y="62" textAnchor="middle" fontSize="28">{emoji}</text>
      </g>
    ),
  },
  {
    // Castle with turrets
    svg: (color, emoji) => (
      <g>
        <rect x="15" y="55" width="70" height="75" rx="6" fill={color} />
        <rect x="10" y="40" width="18" height="28" rx="3" fill={color} />
        <rect x="72" y="40" width="18" height="28" rx="3" fill={color} />
        <rect x="35" y="95" width="30" height="35" rx="4" fill="#fef3c7" />
        <text x="50" y="80" textAnchor="middle" fontSize="28">{emoji}</text>
      </g>
    ),
  },
  {
    // Mushroom house
    svg: (color, emoji) => (
      <g>
        <rect x="30" y="75" width="40" height="55" rx="6" fill="#fef3c7" />
        <ellipse cx="50" cy="75" rx="42" ry="30" fill={color} />
        <circle cx="35" cy="68" r="6" fill="#fef3c7" opacity="0.4" />
        <circle cx="60" cy="62" r="4" fill="#fef3c7" opacity="0.4" />
        <rect x="38" y="100" width="24" height="30" rx="4" fill={color} opacity="0.5" />
        <text x="50" y="78" textAnchor="middle" fontSize="24">{emoji}</text>
      </g>
    ),
  },
  {
    // Treehouse
    svg: (color, emoji) => (
      <g>
        <rect x="44" y="80" width="12" height="50" rx="3" fill="#a16207" />
        <rect x="20" y="40" width="60" height="50" rx="8" fill={color} />
        <polygon points="15,45 50,18 85,45" fill={color} />
        <rect x="38" y="60" width="24" height="30" rx="3" fill="#fef3c7" />
        <text x="50" y="56" textAnchor="middle" fontSize="24">{emoji}</text>
      </g>
    ),
  },
];

/** Background colour for each Tailwind bg class → actual hex */
const COLOR_MAP: Record<string, string> = {
  "bg-sky-500": "#1cb0f6",
  "bg-rose-500": "#f43f5e",
  "bg-amber-500": "#f59e0b",
  "bg-emerald-500": "#10b981",
  "bg-violet-500": "#8b5cf6",
  "bg-pink-500": "#ec4899",
  "bg-teal-500": "#14b8a6",
  "bg-orange-500": "#f97316",
  "bg-lime-500": "#84cc16",
  "bg-indigo-500": "#6366f1",
  "bg-cyan-500": "#06b6d4",
  "bg-fuchsia-500": "#d946ef",
};

function resolveColor(twClass: string): string {
  return COLOR_MAP[twClass] || "#1cb0f6";
}

function completedLessonsCount(child: Child, skill: Skill): number {
  return skill.lessons.filter((l) => (child.progress[l.id]?.stars ?? 0) > 0).length;
}

function totalStarsInSkill(child: Child, skill: Skill): number {
  return skill.lessons.reduce((n, l) => n + (child.progress[l.id]?.stars ?? 0), 0);
}

export default function AdventureMap({
  skills,
  child,
}: {
  skills: Skill[];
  child: Child;
}) {
  return (
    <div className="relative w-full overflow-x-auto pb-4">
      {/* Scrollable cityscape */}
      <div
        className="flex items-end gap-4 px-4 pt-8"
        style={{ minWidth: `${skills.length * 140 + 32}px` }}
      >
        {skills.map((skill, i) => {
          const building = BUILDINGS[i % BUILDINGS.length];
          const color = resolveColor(skill.color);
          const done = completedLessonsCount(child, skill);
          const total = skill.lessons.length;
          const stars = totalStarsInSkill(child, skill);
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;

          return (
            <Link
              key={skill.id}
              href={`/kid/${child.id}/level/${skill.id}`}
              className="group flex flex-col items-center"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative"
              >
                {/* Building SVG */}
                <svg
                  viewBox="0 0 100 140"
                  width={120}
                  height={168}
                  className="drop-shadow-lg transition group-hover:drop-shadow-xl"
                >
                  {building.svg(color, skill.emoji)}

                  {/* Ground */}
                  <rect x="0" y="130" width="100" height="10" rx="5" fill="#86efac" />
                </svg>

                {/* Star count badge */}
                {stars > 0 && (
                  <div className="absolute -right-1 -top-1 flex items-center gap-0.5 rounded-full bg-white px-2 py-0.5 text-xs font-extrabold text-brand-600 shadow-chunky-sm">
                    {stars}⭐
                  </div>
                )}
              </motion.div>

              {/* Label */}
              <div className="mt-1 text-center">
                <div className="font-display text-sm font-extrabold text-gray-800 sm:text-base">
                  {skill.title}
                </div>
                <div className="text-xs text-gray-500">
                  {done}/{total} lessons
                </div>
              </div>

              {/* Mini progress bar */}
              <div className="mt-1 h-2 w-20 overflow-hidden rounded-full bg-gray-200">
                <motion.div
                  className="h-full rounded-full bg-grass-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Decorative ground line */}
      <div className="absolute bottom-0 left-0 right-0 h-4 rounded-t-full bg-gradient-to-r from-green-200 via-green-300 to-green-200" />
    </div>
  );
}
