"use client";

import { allLessonsInOrder } from "./lessons";

const KEY = "speakup.state.v1";

export type Child = {
  id: string;
  name: string;
  avatar: string; // emoji
  xp: number;
  streak: number;
  /** ISO date (YYYY-MM-DD) of the last day a lesson was completed */
  lastActiveDay: string | null;
  /** lessonId -> { stars 0..3, attempts, bestScore } */
  progress: Record<string, LessonProgress>;
};

export type LessonProgress = {
  stars: number;
  attempts: number;
  bestScore: number;
};

export type AppState = {
  parent: { name: string; email: string } | null;
  children: Child[];
  activeChildId: string | null;
};

const EMPTY: AppState = {
  parent: null,
  children: [],
  activeChildId: null,
};

export function loadState(): AppState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return EMPTY;
  }
}

export function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function update(mutator: (s: AppState) => void): AppState {
  const s = loadState();
  mutator(s);
  saveState(s);
  return s;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function newChild(name: string, avatar: string): Child {
  return {
    id: crypto.randomUUID(),
    name,
    avatar,
    xp: 0,
    streak: 0,
    lastActiveDay: null,
    progress: {},
  };
}

/**
 * Record a finished lesson on a child profile. Updates XP, streak,
 * and per-lesson best-score.
 */
export function recordLessonComplete(
  childId: string,
  lessonId: string,
  result: { stars: number; score: number; xpEarned: number },
): AppState {
  return update((s) => {
    const child = s.children.find((c) => c.id === childId);
    if (!child) return;
    const prev = child.progress[lessonId];
    child.progress[lessonId] = {
      stars: Math.max(prev?.stars ?? 0, result.stars),
      attempts: (prev?.attempts ?? 0) + 1,
      bestScore: Math.max(prev?.bestScore ?? 0, result.score),
    };
    child.xp += result.xpEarned;

    const today = todayISO();
    if (child.lastActiveDay === today) {
      // already counted today
    } else if (child.lastActiveDay === yesterdayISO()) {
      child.streak += 1;
    } else {
      child.streak = 1;
    }
    child.lastActiveDay = today;
  });
}

export function setActiveChild(childId: string): AppState {
  return update((s) => {
    s.activeChildId = childId;
  });
}

/**
 * A lesson is unlocked if it is the first lesson, OR the lesson immediately
 * before it (in skill-tree order) has at least one star.
 */
export function isLessonUnlocked(child: Child, lessonId: string): boolean {
  const order = allLessonsInOrder();
  const idx = order.findIndex((o) => o.lessonId === lessonId);
  if (idx <= 0) return true;
  const prev = order[idx - 1];
  return (child.progress[prev.lessonId]?.stars ?? 0) > 0;
}
