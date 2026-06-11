"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LEVEL_INFO, type Lesson } from "@/lib/lessons";
import {
  isLessonUnlocked,
  loadState,
  visibleSkills,
  type Child,
} from "@/lib/storage";

export default function KidHome() {
  const params = useParams<{ id: string }>();
  const [child, setChild] = useState<Child | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const s = loadState();
    const found = s.children.find((c) => c.id === params.id);
    if (!found) setMissing(true);
    else setChild(found);
  }, [params.id]);

  if (missing) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="font-display text-3xl">Hmm, we can&apos;t find that kid.</h1>
        <Link href="/dashboard" className="btn-primary mt-6 inline-flex">
          Back to dashboard
        </Link>
      </main>
    );
  }
  if (!child) return null;

  const skills = visibleSkills(child);
  const hasFocus = (child.focusAreas?.length ?? 0) > 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="font-display text-sm text-gray-500 hover:text-gray-700"
        >
          ← Dashboard
        </Link>
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="font-display text-xl font-extrabold">
              {child.name} {child.avatar}
            </div>
            <div className="text-sm text-gray-500">
              {child.xp} XP · {child.streak}🔥
            </div>
          </div>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/60 px-4 py-3 shadow-chunky-sm">
        <p className="text-sm text-gray-600">
          {hasFocus
            ? `Working on ${skills.length} goal${skills.length === 1 ? "" : "s"}`
            : "Showing all goals — pick what to focus on for a tailored plan."}
        </p>
        <Link
          href={`/kid/${child.id}/focus`}
          className="rounded-full bg-brand-100 px-4 py-1 text-sm font-bold text-brand-700 hover:bg-brand-50"
        >
          {hasFocus ? "Change focus" : "Choose focus"}
        </Link>
      </div>

      {skills.length === 0 && (
        <div className="card text-center">
          <p className="text-gray-600">
            No goals selected yet — pick what you want to work on.
          </p>
          <Link
            href={`/kid/${child.id}/focus`}
            className="btn-primary mt-4 inline-flex"
          >
            Pick goals
          </Link>
        </div>
      )}

      <div className="space-y-10">
        {skills.map((skill) => (
          <section key={skill.id}>
            <div className="mb-4 flex items-center gap-3">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shadow-chunky-sm ${skill.color}`}
              >
                {skill.emoji}
              </div>
              <div>
                <h2 className="font-display text-2xl font-extrabold">
                  {skill.title}
                </h2>
                <p className="text-sm text-gray-500">{skill.subtitle}</p>
              </div>
            </div>

            <ol className="grid gap-3 sm:grid-cols-2">
              {skill.lessons.map((lesson) => {
                const unlocked = isLessonUnlocked(child, lesson.id);
                const progress = child.progress[lesson.id];
                return (
                  <li key={lesson.id}>
                    {unlocked ? (
                      <Link
                        href={`/kid/${child.id}/lesson/${skill.id}/${lesson.id}`}
                        className={`card flex items-center gap-4 transition hover:-translate-y-1 ${
                          progress?.stars
                            ? "ring-4 ring-grass-400/40"
                            : ""
                        }`}
                      >
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-full font-display text-xl font-extrabold text-white ${skill.color}`}
                        >
                          {skill.sound}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <LevelChip level={lesson.level} />
                            <div className="font-display text-lg font-bold">
                              {lesson.title}
                            </div>
                          </div>
                          <div className="mt-0.5 text-sm text-gray-500">
                            {lesson.words.length}{" "}
                            {labelForCount(lesson)}
                          </div>
                        </div>
                        <Stars value={progress?.stars ?? 0} />
                      </Link>
                    ) : (
                      <div className="card flex items-center gap-4 opacity-50">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-300 text-xl">
                          🔒
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <LevelChip level={lesson.level} />
                            <div className="font-display text-lg font-bold">
                              {lesson.title}
                            </div>
                          </div>
                          <div className="mt-0.5 text-sm text-gray-500">
                            Earn 2⭐ on the previous lesson to unlock
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}

function LevelChip({ level }: { level: Lesson["level"] }) {
  const info = LEVEL_INFO[level];
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
      {info.short}·{info.label}
    </span>
  );
}

function labelForCount(lesson: Lesson) {
  switch (lesson.level) {
    case "isolation":
      return "reps";
    case "syllables":
      return "syllables";
    case "phrases":
      return "phrases";
    case "sentences":
      return "sentences";
    default:
      return "words";
  }
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5 text-xl" aria-label={`${value} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < value ? "" : "opacity-25 grayscale"}>
          ⭐
        </span>
      ))}
    </div>
  );
}
