import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { allLessonsInOrder, SKILLS, skillDevRank, type Skill } from "./lessons";

/**
 * Persistent app state for Sona. Web used synchronous localStorage; React
 * Native only has async AsyncStorage, so we load once into memory on mount
 * and keep an in-memory copy that screens read synchronously. Every mutation
 * updates memory immediately (instant UI) and writes to disk in the
 * background.
 */

const KEY = "sona.state.v1";
const UNLOCK_STAR_THRESHOLD = 2;

export type LessonProgress = {
  stars: number;
  attempts: number;
  bestScore: number;
};

export type Child = {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  streak: number;
  lastActiveDay: string | null;
  progress: Record<string, LessonProgress>;
  focusAreas?: string[];
  dailyGoalMinutes?: number;
  remindersEnabled?: boolean;
  /** Soft currency earned from practice, spent in Leo's World. */
  coins?: number;
  /** Ids of world items the child has unlocked/placed. */
  world?: string[];
  // ── session-first model ──
  /** child's age in years, used to suggest the coach style */
  age?: number;
  /** which coach the parent picked for this child */
  coachStyle?: "animated" | "realistic";
  /** high-level goals from onboarding (see lib/goals.ts) */
  goals?: string[];
  /** weekly cadence the family committed to (2, 3, or 4) */
  sessionsPerWeek?: number;
  /** session length in minutes (10, 15, 20) */
  sessionMinutes?: number;
  /** has the free first session been used (then the paywall applies) */
  freeSessionUsed?: boolean;
  /** ISO dates a session was completed — drives the weekly goal */
  sessionDays?: string[];
};

export type AppState = {
  parent: { name: string; email: string } | null;
  children: Child[];
  activeChildId: string | null;
  /** account-level subscription flag (local stub until App Store IAP) */
  subscribed?: boolean;
};

const EMPTY: AppState = {
  parent: null,
  children: [],
  activeChildId: null,
  subscribed: false,
};

// ───────────────────────── pure helpers (no I/O) ─────────────────────────

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Monday of the current week, as an ISO date (for the weekly goal). */
function startOfWeekISO(): string {
  const d = new Date();
  const mondayOffset = (d.getDay() + 6) % 7; // Sun=0 -> 6, Mon=1 -> 0 …
  d.setDate(d.getDate() - mondayOffset);
  return d.toISOString().slice(0, 10);
}

/** Distinct days a session was completed this (Mon-start) week. */
export function weeklySessionCount(child: Child): number {
  const start = startOfWeekISO();
  const days = child.sessionDays ?? [];
  return new Set(days.filter((d) => d >= start)).size;
}

/** The family's weekly session goal (defaults to 3 if unset). */
export function weeklyGoal(child: Child): number {
  return child.sessionsPerWeek ?? 3;
}

let idCounter = 0;
export function newChild(name: string, avatar: string): Child {
  // RN has no crypto.randomUUID in all runtimes; a timestamp + counter id is
  // plenty for local profiles.
  idCounter += 1;
  return {
    id: `c_${Date.now().toString(36)}_${idCounter}`,
    name,
    avatar,
    xp: 0,
    streak: 0,
    lastActiveDay: null,
    progress: {},
    focusAreas: [],
    coins: 0,
    world: [],
  };
}

export function isLessonUnlocked(child: Child, lessonId: string): boolean {
  const focus = child.focusAreas ?? [];
  const order =
    focus.length > 0
      ? allLessonsInOrder().filter((o) => focus.includes(o.skillId))
      : allLessonsInOrder();
  const idx = order.findIndex((o) => o.lessonId === lessonId);
  if (idx <= 0) return true;
  const prev = order[idx - 1];
  return (child.progress[prev.lessonId]?.stars ?? 0) >= UNLOCK_STAR_THRESHOLD;
}

export function visibleSkills(child: Child): Skill[] {
  const focus = child.focusAreas ?? [];
  const list = focus.length === 0 ? SKILLS : SKILLS.filter((s) => focus.includes(s.id));
  // Easiest-first, so a child's personalized plan starts with achievable
  // sounds before late-developing ones (R, TH).
  return [...list].sort((a, b) => skillDevRank(a.id) - skillDevRank(b.id));
}

// ───────────────────────── context ─────────────────────────

type StoreValue = {
  state: AppState;
  ready: boolean;
  activeChild: Child | null;
  setActiveChild: (childId: string) => void;
  addChild: (
    child: Omit<Child, "id" | "xp" | "streak" | "lastActiveDay" | "progress"> & {
      id?: string;
    },
  ) => Child;
  setParent: (parent: { name: string; email: string }) => void;
  setChildFocus: (childId: string, focusAreas: string[]) => void;
  setReminders: (childId: string, enabled: boolean) => void;
  recordLessonComplete: (
    childId: string,
    lessonId: string,
    result: {
      stars: number;
      score: number;
      xpEarned: number;
      coinsEarned?: number;
    },
  ) => void;
  /** Spend coins to unlock a world item. Returns true if the purchase went
   *  through (enough coins, not already owned). */
  purchaseItem: (childId: string, itemId: string, cost: number) => boolean;
  /** Record that a full coaching session was completed today (drives the
   *  weekly goal and marks the free session as used). */
  recordSession: (childId: string) => void;
  /** Whether the account has an active subscription (local stub until IAP). */
  subscribed: boolean;
  setSubscribed: (on: boolean) => void;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setState({ ...EMPTY, ...JSON.parse(raw) });
      } catch {
        // ignore — start empty
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback((next: AppState) => {
    setState(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const mutate = useCallback(
    (fn: (s: AppState) => void) => {
      setState((cur) => {
        const next: AppState = JSON.parse(JSON.stringify(cur));
        fn(next);
        AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  const value = useMemo<StoreValue>(() => {
    const activeChild =
      state.children.find((c) => c.id === state.activeChildId) ?? null;

    return {
      state,
      ready,
      activeChild,
      setActiveChild: (childId) =>
        mutate((s) => {
          s.activeChildId = childId;
        }),
      setParent: (parent) =>
        mutate((s) => {
          s.parent = parent;
        }),
      addChild: (partial) => {
        const child: Child = {
          ...newChild(partial.name, partial.avatar),
          focusAreas: partial.focusAreas ?? [],
          dailyGoalMinutes: partial.dailyGoalMinutes,
          remindersEnabled: partial.remindersEnabled,
          age: partial.age,
          coachStyle: partial.coachStyle,
          goals: partial.goals ?? [],
          sessionsPerWeek: partial.sessionsPerWeek,
          sessionMinutes: partial.sessionMinutes,
        };
        mutate((s) => {
          s.children.push(child);
          s.activeChildId = child.id;
        });
        return child;
      },
      setChildFocus: (childId, focusAreas) =>
        mutate((s) => {
          const c = s.children.find((x) => x.id === childId);
          if (c) c.focusAreas = focusAreas;
        }),
      setReminders: (childId, enabled) =>
        mutate((s) => {
          const c = s.children.find((x) => x.id === childId);
          if (c) c.remindersEnabled = enabled;
        }),
      recordLessonComplete: (childId, lessonId, result) =>
        mutate((s) => {
          const c = s.children.find((x) => x.id === childId);
          if (!c) return;
          const prev = c.progress[lessonId];
          c.progress[lessonId] = {
            stars: Math.max(prev?.stars ?? 0, result.stars),
            attempts: (prev?.attempts ?? 0) + 1,
            bestScore: Math.max(prev?.bestScore ?? 0, result.score),
          };
          c.xp += result.xpEarned;
          c.coins = (c.coins ?? 0) + (result.coinsEarned ?? 0);
          const today = todayISO();
          if (c.lastActiveDay === today) {
            // already counted today
          } else if (c.lastActiveDay === yesterdayISO()) {
            c.streak += 1;
          } else {
            c.streak = 1;
          }
          c.lastActiveDay = today;
        }),
      purchaseItem: (childId, itemId, cost) => {
        let ok = false;
        mutate((s) => {
          const c = s.children.find((x) => x.id === childId);
          if (!c) return;
          const world = c.world ?? (c.world = []);
          if (world.includes(itemId)) return; // already owned
          if ((c.coins ?? 0) < cost) return; // can't afford
          c.coins = (c.coins ?? 0) - cost;
          world.push(itemId);
          ok = true;
        });
        return ok;
      },
      recordSession: (childId) =>
        mutate((s) => {
          const c = s.children.find((x) => x.id === childId);
          if (!c) return;
          const today = todayISO();
          const days = c.sessionDays ?? (c.sessionDays = []);
          if (!days.includes(today)) days.push(today);
          c.freeSessionUsed = true;
        }),
      subscribed: state.subscribed ?? false,
      setSubscribed: (on) =>
        mutate((s) => {
          s.subscribed = on;
        }),
    };
  }, [state, ready, mutate]);

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
