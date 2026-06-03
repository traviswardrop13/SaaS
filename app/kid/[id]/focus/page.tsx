"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  CATEGORY_INFO,
  SKILLS,
  skillsByCategory,
  type Skill,
  type SkillCategory,
} from "@/lib/lessons";
import { loadState, setChildFocus, type Child } from "@/lib/storage";

const CATEGORY_ORDER: SkillCategory[] = [
  "single-sound",
  "s-blend",
  "l-blend",
  "r-blend",
  "final-sound",
  "fronting",
];

export default function FocusPickerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "1";

  const [child, setChild] = useState<Child | null>(null);
  const [missing, setMissing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const s = loadState();
    const found = s.children.find((c) => c.id === params.id);
    if (!found) {
      setMissing(true);
      return;
    }
    setChild(found);
    setSelected(new Set(found.focusAreas ?? []));
  }, [params.id]);

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      skills: skillsByCategory(category),
    })).filter((g) => g.skills.length > 0);
  }, []);

  if (missing) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="font-display text-3xl">We can&apos;t find that kid.</h1>
        <Link href="/dashboard" className="btn-primary mt-6 inline-flex">
          Back to dashboard
        </Link>
      </main>
    );
  }
  if (!child) return null;

  function toggleSkill(skillId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  }

  function toggleCategory(category: SkillCategory, skills: Skill[]) {
    const skillIds = skills.map((s) => s.id);
    const allSelected = skillIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        skillIds.forEach((id) => next.delete(id));
      } else {
        skillIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function save() {
    setChildFocus(child!.id, Array.from(selected));
    router.push(`/kid/${child!.id}`);
  }

  function skipAll() {
    // Empty focusAreas means "show everything".
    setChildFocus(child!.id, []);
    router.push(`/kid/${child!.id}`);
  }

  const total = selected.size;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <Link
          href={isOnboarding ? "/setup" : `/kid/${child.id}`}
          className="font-display text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-brand-600 sm:text-4xl">
          {isOnboarding
            ? `What does ${child.name} want to work on?`
            : `Update ${child.name}'s focus`}
        </h1>
        <p className="mt-2 text-gray-600">
          Pick the goal areas your child is practicing. You can change this
          any time. (Not sure? Skip — we&apos;ll show all lessons.)
        </p>
      </header>

      <div className="space-y-8">
        {grouped.map(({ category, skills }) => {
          const info = CATEGORY_INFO[category];
          const allOn = skills.every((s) => selected.has(s.id));
          return (
            <section key={category} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-extrabold">
                    <span className="mr-2">{info.emoji}</span>
                    {info.label}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {info.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCategory(category, skills)}
                  className="rounded-full bg-gray-100 px-4 py-1 text-sm font-bold text-gray-700 hover:bg-gray-200"
                >
                  {allOn ? "Clear all" : "Select all"}
                </button>
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {skills.map((skill) => {
                  const on = selected.has(skill.id);
                  return (
                    <li key={skill.id}>
                      <button
                        type="button"
                        onClick={() => toggleSkill(skill.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                          on
                            ? "bg-grass-500 text-white shadow-chunky-sm"
                            : "bg-gray-50 hover:bg-gray-100"
                        }`}
                        aria-pressed={on}
                      >
                        <span className="text-3xl" aria-hidden>
                          {skill.emoji}
                        </span>
                        <span className="flex-1">
                          <span className="block font-display font-bold">
                            {skill.title}
                          </span>
                          <span
                            className={`block text-xs ${
                              on ? "text-white/80" : "text-gray-500"
                            }`}
                          >
                            {skill.subtitle}
                          </span>
                        </span>
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                            on
                              ? "bg-white text-grass-600"
                              : "bg-white text-gray-300"
                          }`}
                          aria-hidden
                        >
                          {on ? "✓" : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="sticky bottom-4 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow-chunky">
        <div className="font-display text-lg">
          {total === 0 ? (
            <span className="text-gray-500">Nothing picked yet</span>
          ) : (
            <span>
              <span className="font-extrabold text-brand-600">{total}</span>{" "}
              goal{total === 1 ? "" : "s"} selected
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={skipAll} type="button" className="btn-ghost">
            Show me everything
          </button>
          <button
            onClick={save}
            type="button"
            disabled={total === 0}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isOnboarding ? "Let's go!" : "Save"}
          </button>
        </div>
      </div>

      {SKILLS.length === 0 && (
        <p className="mt-6 text-center text-gray-500">No skills available.</p>
      )}
    </main>
  );
}
