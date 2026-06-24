"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { findSkill, LEVEL_INFO, type Lesson } from "@/lib/lessons";
import { isLessonUnlocked, loadState, type Child } from "@/lib/storage";

/**
 * Vertical challenge path inside a single skill — the "level detail" screen.
 * Modeled after Duolingo ABC: a winding vertical path of nodes (one per
 * lesson). Each node is a circle the kid taps to start that lesson.
 *
 * The path zigzags left-right going upward, with the first (easiest) node
 * at the bottom. Locked nodes show a lock emoji. Completed nodes glow.
 */

/** Visual position of each node on the zigzag path */
function nodePosition(index: number, total: number) {
  // Path zigzags: even index → left side, odd → right side
  const isLeft = index % 2 === 0;
  const x = isLeft ? 30 : 70; // percentage from left
  // Bottom-up: first node at bottom, last at top
  const yPct = ((total - 1 - index) / Math.max(total - 1, 1)) * 100;
  return { x, yPct, isLeft };
}

export default function LevelPathPage() {
  const params = useParams<{ id: string; skillId: string }>();
  const [child, setChild] = useState<Child | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const s = loadState();
    const found = s.children.find((c) => c.id === params.id);
    if (!found) setMissing(true);
    else setChild(found);
  }, [params.id]);

  const skill = findSkill(params.skillId);

  if (missing || !skill) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="font-display text-3xl">
          {missing ? "Can't find that kid." : "Can't find that skill."}
        </h1>
        <Link href="/dashboard" className="btn-primary mt-6 inline-flex">
          Back
        </Link>
      </main>
    );
  }
  if (!child) return null;

  const lessons = skill.lessons;
  const total = lessons.length;

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col overflow-hidden bg-gradient-to-b from-sky-100 via-white to-green-50 px-4 py-6">
      {/* Header */}
      <header className="mb-4 flex items-center gap-3">
        <Link
          href={`/kid/${child.id}`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-chunky-sm transition hover:text-gray-700"
        >
          ←
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-extrabold text-gray-800">
            <span className="mr-2">{skill.emoji}</span>
            {skill.title}
          </h1>
          <p className="text-sm text-gray-500">{skill.subtitle}</p>
        </div>
        <div className="text-right">
          <div className="font-display text-lg font-extrabold text-brand-600">
            {child.xp} XP
          </div>
          <div className="text-xs text-gray-500">{child.streak}🔥</div>
        </div>
      </header>

      {/* Vertical challenge path */}
      <div
        className="relative flex-1"
        style={{ minHeight: `${total * 120 + 60}px` }}
      >
        {/* Connecting path line (SVG behind nodes) */}
        <svg
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          aria-hidden
        >
          {lessons.map((_, i) => {
            if (i === 0) return null;
            const prev = nodePosition(i - 1, total);
            const curr = nodePosition(i, total);
            const prevY =
              40 + (prev.yPct / 100) * (total * 120 - 40);
            const currY =
              40 + (curr.yPct / 100) * (total * 120 - 40);
            const prevX = `${prev.x}%`;
            const currX = `${curr.x}%`;
            return (
              <line
                key={`line-${i}`}
                x1={prevX}
                y1={prevY}
                x2={currX}
                y2={currY}
                stroke="#d1d5db"
                strokeWidth="4"
                strokeDasharray="8 6"
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {lessons.map((lesson, i) => {
          const { x, yPct } = nodePosition(i, total);
          const unlocked = isLessonUnlocked(child, lesson.id);
          const progress = child.progress[lesson.id];
          const stars = progress?.stars ?? 0;
          const isComplete = stars > 0;
          const yPos = 40 + (yPct / 100) * (total * 120 - 40);

          return (
            <motion.div
              key={lesson.id}
              className="absolute"
              style={{
                left: `${x}%`,
                top: `${yPos}px`,
                transform: "translate(-50%, -50%)",
              }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
            >
              {unlocked ? (
                <Link
                  href={`/kid/${child.id}/lesson/${skill.id}/${lesson.id}`}
                  className="group flex flex-col items-center"
                >
                  {/* Node circle */}
                  <div
                    className={`relative flex h-16 w-16 items-center justify-center rounded-full text-xl font-extrabold text-white shadow-chunky transition group-hover:scale-110 ${
                      isComplete
                        ? "bg-grass-500 ring-4 ring-grass-400/40"
                        : `${skill.color}`
                    }`}
                  >
                    {isComplete ? (
                      <span className="text-2xl">✓</span>
                    ) : (
                      <span className="font-display text-lg">{skill.sound}</span>
                    )}

                    {/* Star badges */}
                    {stars > 0 && (
                      <div className="absolute -bottom-2 flex gap-0.5">
                        {[0, 1, 2].map((s) => (
                          <span
                            key={s}
                            className={`text-xs ${
                              s < stars ? "" : "opacity-25 grayscale"
                            }`}
                          >
                            ⭐
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Pulse for the "current" (next to play) node */}
                    {!isComplete && (
                      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-sky-400 opacity-20" />
                    )}
                  </div>

                  {/* Label */}
                  <div className="mt-3 max-w-[120px] text-center">
                    <LevelChip level={lesson.level} />
                    <div className="mt-0.5 font-display text-sm font-bold text-gray-700">
                      {lesson.title}
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="flex flex-col items-center opacity-50">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-300 text-2xl shadow-chunky-sm">
                    🔒
                  </div>
                  <div className="mt-3 max-w-[120px] text-center">
                    <LevelChip level={lesson.level} />
                    <div className="mt-0.5 font-display text-sm font-bold text-gray-500">
                      {lesson.title}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </main>
  );
}

function LevelChip({ level }: { level: Lesson["level"] }) {
  const info = LEVEL_INFO[level];
  return (
    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
      {info.short}·{info.label}
    </span>
  );
}
