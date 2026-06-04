"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SKILLS, findSkill } from "@/lib/lessons";
import {
  variantsForLesson,
  clipFilename,
  type ClipVariant,
} from "@/lib/clipVariants";
import AudioRecorder from "@/components/AudioRecorder";

/**
 * Admin workspace for recording labelled audio clips of correct *and*
 * incorrect productions (e.g. "spot" said cleanly vs with cluster
 * reduction). The recorder downloads each clip with a structured
 * filename; once committed to /public/audio/ in the repo the rest of
 * the app can reference them.
 *
 * NOT linked from the kid UI on purpose — this is a tool for adults.
 */
const STORAGE_KEY = "speakup.admin.savedClips.v1";

function loadSaved(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function persistSaved(s: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(s)));
}

export default function AdminClipsPage() {
  const [skillId, setSkillId] = useState<string>(SKILLS[0]?.id ?? "");
  const [lessonId, setLessonId] = useState<string>("");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSaved(loadSaved());
    setMounted(true);
  }, []);

  const skill = useMemo(() => findSkill(skillId), [skillId]);

  // Default lesson to the first one in the chosen skill.
  useEffect(() => {
    if (!skill) return;
    if (!skill.lessons.find((l) => l.id === lessonId)) {
      setLessonId(skill.lessons[0]?.id ?? "");
    }
  }, [skill, lessonId]);

  const lesson = skill?.lessons.find((l) => l.id === lessonId);

  function markSaved(filename: string) {
    setSaved((prev) => {
      const next = new Set(prev);
      next.add(filename);
      persistSaved(next);
      return next;
    });
  }

  const totalAcrossLibrary = useMemo(() => {
    let n = 0;
    for (const sk of SKILLS) {
      for (const ls of sk.lessons) {
        const variants = variantsForLesson({
          targetSound: ls.targetSound,
          position: ls.position,
          blend: ls.blend,
        });
        n += ls.words.length * variants.length;
      }
    }
    return n;
  }, []);

  if (!mounted) return null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <Link
            href="/"
            className="font-display text-sm text-gray-500 hover:text-gray-700"
          >
            ← Home
          </Link>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-brand-600">
            Reference clip recorder
          </h1>
          <p className="mt-1 text-gray-600">
            Record clean and intentionally-incorrect productions for each word.
            Each recording downloads with a structured filename — drop them in{" "}
            <code className="rounded bg-gray-100 px-1">public/audio/</code> and
            commit.
          </p>
        </div>
        <div className="rounded-2xl bg-brand-50 px-3 py-2 text-right">
          <div className="font-display text-2xl font-extrabold text-brand-600">
            {saved.size}
          </div>
          <div className="text-xs uppercase tracking-wide text-gray-500">
            of {totalAcrossLibrary} saved
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block font-display font-bold text-gray-700">
            Skill
          </span>
          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-base"
          >
            {SKILLS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.emoji} {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-display font-bold text-gray-700">
            Lesson
          </span>
          <select
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
            className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-base"
          >
            {skill?.lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            )) ?? null}
          </select>
        </label>
      </div>

      {lesson && (
        <>
          <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-sm">
            <p>
              <span className="font-bold">Target sound:</span>{" "}
              /{lesson.targetSound}/ ({lesson.position})
              {lesson.blend && (
                <>
                  {" "}
                  · <span className="font-bold">Blend:</span>{" "}
                  {lesson.blend.toUpperCase()}
                </>
              )}
            </p>
            <p className="mt-1 text-gray-600">{lesson.hint}</p>
          </div>

          <ol className="mt-6 space-y-6">
            {lesson.words.map((word, i) => {
              const variants = variantsForLesson({
                targetSound: lesson.targetSound,
                position: lesson.position,
                blend: lesson.blend,
              });
              const wordSaved = variants.filter((v) =>
                saved.has(clipFilename(word.text, v.id)),
              ).length;
              return (
                <li
                  key={`${word.text}-${i}`}
                  className="rounded-3xl border-2 border-gray-100 p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-2xl font-extrabold text-gray-800">
                      {word.emoji && (
                        <span className="mr-2" aria-hidden>
                          {word.emoji}
                        </span>
                      )}
                      {word.text}
                    </h2>
                    <span className="text-xs uppercase tracking-wider text-gray-500">
                      {wordSaved}/{variants.length} recorded
                    </span>
                  </div>

                  <div className="mt-3 space-y-3">
                    {variants.map((variant) => (
                      <VariantRow
                        key={variant.id}
                        wordText={word.text}
                        variant={variant}
                        isSaved={saved.has(clipFilename(word.text, variant.id))}
                        onSaved={markSaved}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <div className="mt-10 rounded-2xl bg-sky-500/10 p-4 text-sm text-sky-700">
        <p className="font-bold">What to do with the downloaded files</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          <li>Save each .webm clip somewhere safe as you go.</li>
          <li>
            Once you have a batch, send them to the dev environment (or drop
            them in <code>public/audio/</code> and commit) so the app can play
            them.
          </li>
          <li>
            The “saved” counter above is local to this browser — it only tracks
            what you&apos;ve clicked Save on, not what&apos;s actually in the
            repo.
          </li>
        </ol>
      </div>
    </main>
  );
}

function VariantRow({
  wordText,
  variant,
  isSaved,
  onSaved,
}: {
  wordText: string;
  variant: ClipVariant;
  isSaved: boolean;
  onSaved: (filename: string) => void;
}) {
  return (
    <div
      className={`rounded-2xl p-3 ${
        isSaved ? "bg-grass-500/10" : "bg-white"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gray-100 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider text-gray-600">
            {variant.label}
          </span>
          {isSaved && (
            <span className="text-xs font-bold text-grass-600">✓ Saved</span>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-600">{variant.howToSayIt}</p>
      <div className="mt-3">
        <AudioRecorder
          filename={clipFilename(wordText, variant.id)}
          onSaved={(_, fn) => onSaved(fn)}
        />
      </div>
    </div>
  );
}
