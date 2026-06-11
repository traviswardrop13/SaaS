/**
 * High-level onboarding goals — what the parent says they want to work on.
 * Deliberately practice-safe and non-clinical (no medical conditions, no
 * "therapy"/"treatment" claims). Each maps to how we seed the child's plan.
 */
export type Goal = {
  id: string;
  emoji: string;
  label: string;
  /** which track this points at */
  track: "speech" | "language" | "screen";
};

export const GOALS: Goal[] = [
  {
    id: "sounds",
    emoji: "🗣️",
    label: "Saying sounds clearly",
    track: "speech",
  },
  {
    id: "words",
    emoji: "💬",
    label: "Using words & sentences",
    track: "language",
  },
  {
    id: "understanding",
    emoji: "👂",
    label: "Understanding others",
    track: "language",
  },
  {
    id: "confidence",
    emoji: "⭐",
    label: "Talking with confidence",
    track: "speech",
  },
  {
    id: "unsure",
    emoji: "❓",
    label: "Not sure — help me find out",
    track: "screen",
  },
];

export function findGoal(id: string): Goal | undefined {
  return GOALS.find((g) => g.id === id);
}

/** Should we route the new child into the AI sound check after onboarding? */
export function goalsWantScreener(goalIds: string[]): boolean {
  return goalIds.some((id) => {
    const g = findGoal(id);
    return g?.track === "speech" || g?.track === "screen";
  });
}

export const SESSIONS_PER_WEEK = [2, 3, 4] as const;
export const SESSION_MINUTES = [10, 15, 20] as const;
export const RECOMMENDED_PER_WEEK = 3;
export const RECOMMENDED_MINUTES = 15;
