/**
 * Game definitions and daily rotation logic for the game-map world.
 *
 * Five games rotate through a 7-day schedule for "Today's Practice",
 * which picks 3-4 curated games per day. Kids get one shot per day
 * at the daily challenge; they can also swipe to individual game
 * screens and play freely.
 */

export type Game = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  /** Route path relative to /kid/[id]/ */
  route: string;
  /** Scene background image path */
  scene: string;
  /** Sky color for the scene */
  skyColor: string;
};

export const GAMES: Game[] = [
  {
    id: "speech-clinic",
    title: "Speech Clinic",
    subtitle: "Practice sounds with the coach",
    emoji: "🎙️",
    route: "lesson",
    scene: "/scenes/speech-clinic.png",
    skyColor: "#7EC8E3",
  },
  {
    id: "racing",
    title: "Sound Racer",
    subtitle: "Race by saying words fast",
    emoji: "🏎️",
    route: "lesson",
    scene: "/scenes/racing.png",
    skyColor: "#F4845F",
  },
  {
    id: "storybook",
    title: "Story Time",
    subtitle: "Read and speak through stories",
    emoji: "📚",
    route: "lesson",
    scene: "/scenes/storybook.png",
    skyColor: "#9B72CF",
  },
  {
    id: "fruit-ninja",
    title: "Fruit Ninja",
    subtitle: "Slash fruits by saying their names",
    emoji: "🍉",
    route: "lesson",
    scene: "/scenes/fruit-ninja.png",
    skyColor: "#B8E550",
  },
  {
    id: "stacks",
    title: "Stacks",
    subtitle: "Stack blocks with correct sounds",
    emoji: "🧱",
    route: "lesson",
    scene: "/scenes/stacks.png",
    skyColor: "#5CE1E6",
  },
];

/** 7-day rotation: index = day-of-week (0=Sunday … 6=Saturday) */
const DAILY_COMBOS: string[][] = [
  ["speech-clinic", "fruit-ninja", "stacks"],            // Sun
  ["racing", "storybook", "speech-clinic", "stacks"],    // Mon
  ["fruit-ninja", "racing", "storybook"],                // Tue
  ["speech-clinic", "stacks", "racing", "fruit-ninja"],  // Wed
  ["storybook", "speech-clinic", "fruit-ninja"],         // Thu
  ["stacks", "racing", "storybook", "speech-clinic"],    // Fri
  ["fruit-ninja", "storybook", "stacks"],                // Sat
];

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
] as const;

export function todaysGames(): Game[] {
  const dow = new Date().getDay();
  const ids = DAILY_COMBOS[dow];
  return ids.map((id) => GAMES.find((g) => g.id === id)!);
}

export function todayLabel(): string {
  return DAY_NAMES[new Date().getDay()];
}
