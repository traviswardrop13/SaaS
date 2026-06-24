"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { type Lesson } from "@/lib/lessons";
import {
  loadState,
  visibleSkills,
  type Child,
} from "@/lib/storage";
import AdventureMap from "@/components/AdventureMap";

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

      {/* Adventure Map — Duolingo ABC style */}
      {skills.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-2xl font-extrabold text-gray-800">
            🏘️ Your Adventure
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Tap a building to start practicing!
          </p>
          <AdventureMap skills={skills} child={child} />
        </section>
      )}
    </main>
  );
}
