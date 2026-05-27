"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadState, type AppState } from "@/lib/storage";
import { SKILLS } from "@/lib/lessons";

export default function DashboardPage() {
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  if (!state) return null;

  if (!state.parent) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="font-display text-3xl font-extrabold text-brand-600">
          Let&apos;s get set up
        </h1>
        <p className="mt-2 text-gray-600">
          Create a parent profile first.
        </p>
        <Link href="/setup" className="btn-primary mt-6 inline-flex">
          Set up
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="font-display text-sm text-gray-500 hover:text-gray-700"
          >
            ← Home
          </Link>
          <h1 className="mt-1 font-display text-4xl font-extrabold text-brand-600">
            Hi {state.parent.name} 👋
          </h1>
          <p className="text-gray-600">Your kids&apos; progress at a glance.</p>
        </div>
        <Link href="/setup" className="btn-secondary">
          + Add child
        </Link>
      </header>

      {state.children.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-600">No child profiles yet.</p>
          <Link href="/setup" className="btn-primary mt-4 inline-flex">
            Add your first child
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {state.children.map((child) => {
            const completed = Object.keys(child.progress).length;
            const totalLessons = SKILLS.reduce(
              (n, s) => n + s.lessons.length,
              0,
            );
            const totalStars = Object.values(child.progress).reduce(
              (n, p) => n + p.stars,
              0,
            );
            return (
              <Link
                key={child.id}
                href={`/kid/${child.id}`}
                className="card flex flex-col gap-4 transition hover:-translate-y-1"
              >
                <div className="flex items-center gap-4">
                  <div className="text-6xl" aria-hidden>
                    {child.avatar}
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-extrabold">
                      {child.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {completed} of {totalLessons} lessons
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Stat label="XP" value={child.xp} accent="text-brand-500" />
                  <Stat
                    label="Streak"
                    value={`${child.streak}🔥`}
                    accent="text-grass-600"
                  />
                  <Stat
                    label="Stars"
                    value={`${totalStars}⭐`}
                    accent="text-sky-500"
                  />
                </div>
                <SkillBreakdown childProgress={child.progress} />
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="flex-1 rounded-2xl bg-brand-50 p-3 text-center">
      <div className={`font-display text-2xl font-extrabold ${accent}`}>
        {value}
      </div>
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
    </div>
  );
}

function SkillBreakdown({
  childProgress,
}: {
  childProgress: Record<string, { stars: number }>;
}) {
  return (
    <div className="border-t pt-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
        By sound
      </p>
      <div className="flex flex-wrap gap-2">
        {SKILLS.map((skill) => {
          const earned = skill.lessons.reduce(
            (n, l) => n + (childProgress[l.id]?.stars ?? 0),
            0,
          );
          const max = skill.lessons.length * 3;
          return (
            <span
              key={skill.id}
              className="rounded-full bg-gray-100 px-3 py-1 text-sm"
              title={`${earned}/${max} stars in ${skill.title}`}
            >
              <span className="mr-1">{skill.emoji}</span>
              {skill.sound}: {earned}/{max}
            </span>
          );
        })}
      </div>
    </div>
  );
}
