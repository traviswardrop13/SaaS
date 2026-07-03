/**
 * Game Map — the Duolingo-style horizontal world. Each game has an illustrated
 * scene background. The first screen is "Today's Practice" which rotates daily
 * with a curated set of 3–4 games.
 *
 * Phase 1: 5 game types + Today's Practice hub
 * Later: modular house system (5 base shapes × decor layers = 30+ combos)
 */

/** A game the kid can play on its own screen. */
export type Game = {
  id: string;
  /** Display name shown on the card */
  title: string;
  /** Short description / subtitle */
  subtitle: string;
  /** Emoji icon for fallback / UI accent */
  emoji: string;
  /** The route to navigate to when tapped */
  route: string;
  /**
   * Sky gradient color — the status bar area above each scene matches the
   * illustration's sky so the whole screen feels immersive.
   */
  skyColor: string;
  /**
   * require() asset reference is set at the component level (can't be
   * dynamic in React Native), so we use an id-based lookup instead.
   */
};

export const GAMES: Game[] = [
  {
    id: "speech-clinic",
    title: "Speech Clinic",
    subtitle: "Practice sounds with the coach",
    emoji: "🎙️",
    route: "/session",
    skyColor: "#7EC8E3",
  },
  {
    id: "racing",
    title: "Sound Racer",
    subtitle: "Race by saying words fast",
    emoji: "🏎️",
    route: "/session",
    skyColor: "#F4845F",
  },
  {
    id: "storybook",
    title: "Story Time",
    subtitle: "Read and speak through stories",
    emoji: "📚",
    route: "/session",
    skyColor: "#9B72CF",
  },
  {
    id: "fruit-ninja",
    title: "Fruit Ninja",
    subtitle: "Slash fruits by saying their names",
    emoji: "🍉",
    route: "/session",
    skyColor: "#B8E550",
  },
  {
    id: "stacks",
    title: "Stacks",
    subtitle: "Stack blocks with correct sounds",
    emoji: "🧱",
    route: "/session",
    skyColor: "#5CE1E6",
  },
];

/**
 * Today's Practice — picks 3–4 games for the day from a rotating schedule.
 * Uses the day-of-year so every kid sees the same games on the same day,
 * and it naturally rotates through combinations.
 */
const DAILY_COMBOS: string[][] = [
  ["speech-clinic", "fruit-ninja", "stacks"],          // Monday
  ["racing", "storybook", "speech-clinic"],             // Tuesday
  ["fruit-ninja", "stacks", "racing"],                  // Wednesday
  ["storybook", "speech-clinic", "fruit-ninja"],        // Thursday
  ["stacks", "racing", "storybook"],                    // Friday
  ["speech-clinic", "racing", "fruit-ninja", "stacks"], // Saturday
  ["storybook", "fruit-ninja", "racing", "stacks"],     // Sunday
];

export function todaysGames(): Game[] {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      86_400_000,
  );
  const combo = DAILY_COMBOS[dayOfYear % DAILY_COMBOS.length];
  return combo
    .map((id) => GAMES.find((g) => g.id === id))
    .filter(Boolean) as Game[];
}

/** Friendly day-of-week label for the Today screen. */
export function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}
