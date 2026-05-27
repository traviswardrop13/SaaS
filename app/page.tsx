"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadState } from "@/lib/storage";

export default function LandingPage() {
  const [hasParent, setHasParent] = useState(false);
  const [hasChildren, setHasChildren] = useState(false);

  useEffect(() => {
    const s = loadState();
    setHasParent(Boolean(s.parent));
    setHasChildren(s.children.length > 0);
  }, []);

  const ctaHref = !hasParent ? "/setup" : hasChildren ? "/dashboard" : "/setup";
  const ctaLabel = !hasParent
    ? "Get started"
    : hasChildren
      ? "Open dashboard"
      : "Add a child";

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-6 text-7xl" aria-hidden>
        🦁
      </div>
      <h1 className="font-display text-5xl font-extrabold text-brand-600 sm:text-6xl">
        SpeakUp Kids
      </h1>
      <p className="mt-4 max-w-xl text-lg text-gray-700">
        A friendly, game-style way for kids to practice tricky speech sounds —
        with daily streaks, XP, and a roaring mascot cheering them on.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link href={ctaHref} className="btn-primary text-lg">
          {ctaLabel}
        </Link>
        <Link href="/dashboard" className="btn-ghost text-lg">
          Parent dashboard
        </Link>
      </div>

      <div className="mt-16 grid w-full gap-6 sm:grid-cols-3">
        <Feature
          emoji="🎤"
          title="Say it, hear it"
          body="Tap the mic, say the word, and get instant friendly feedback."
        />
        <Feature
          emoji="⭐"
          title="Earn stars & XP"
          body="Lessons unlock as kids progress through a colourful skill tree."
        />
        <Feature
          emoji="📈"
          title="Parent insights"
          body="See streaks, XP, and which sounds still need a little more work."
        />
      </div>

      <p className="mt-12 max-w-md text-sm text-gray-500">
        This MVP runs entirely in your browser. No audio is uploaded — speech is
        transcribed on-device using your browser&apos;s speech recognition.
      </p>
    </main>
  );
}

function Feature({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <div className="card text-left">
      <div className="text-4xl" aria-hidden>
        {emoji}
      </div>
      <h3 className="mt-3 font-display text-xl font-bold">{title}</h3>
      <p className="mt-1 text-gray-600">{body}</p>
    </div>
  );
}
