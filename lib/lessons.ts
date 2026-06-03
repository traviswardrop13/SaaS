import type { SoundPosition, TargetSound } from "./scoring";

export type Word = {
  /** the target word the child should say */
  text: string;
  /** emoji used as the picture cue */
  emoji: string;
  /** acceptable transcription variants (lowercase, no punctuation) */
  accepts?: string[];
};

export type Lesson = {
  id: string;
  title: string;
  /** very short hint shown before the lesson starts */
  hint: string;
  /** Which phoneme this lesson is targeting. */
  targetSound: TargetSound;
  /** Where the target sound sits in each word. */
  position: SoundPosition;
  /**
   * If set, the recognized word must begin with this consonant cluster
   * (e.g. "sp", "br", "bl") to count. Used by cluster-reduction lessons to
   * distinguish "spoon" from "soon" (cluster reduced).
   */
  blend?: string;
  words: Word[];
};

/**
 * High-level category — used in the focus-picker so a parent can say
 * "my kid is working on S-blends" without having to know every lesson.
 */
export type SkillCategory =
  | "single-sound"
  | "s-blend"
  | "r-blend"
  | "l-blend"
  | "final-sound"
  | "fronting";

export type Skill = {
  id: string;
  /** the phoneme this skill primarily targets, e.g. "S" */
  sound: TargetSound;
  category: SkillCategory;
  title: string;
  subtitle: string;
  color: string; // tailwind bg-* class for the node
  emoji: string;
  lessons: Lesson[];
};

export const SKILLS: Skill[] = [
  // ───────────────────────── Single sounds ─────────────────────────
  {
    id: "s-sounds",
    sound: "S",
    category: "single-sound",
    title: "Silly S",
    subtitle: "the /s/ sound",
    color: "bg-sky-500",
    emoji: "🐍",
    lessons: [
      {
        id: "s-initial",
        title: "S at the start",
        hint: "Hiss like a snake — sssss!",
        targetSound: "S",
        position: "initial",
        words: [
          { text: "sun", emoji: "☀️", accepts: ["son"] },
          { text: "sock", emoji: "🧦", accepts: ["socks"] },
          { text: "soup", emoji: "🍲" },
          { text: "seal", emoji: "🦭", accepts: ["seel"] },
          { text: "snake", emoji: "🐍" },
        ],
      },
      {
        id: "s-medial",
        title: "S in the middle",
        hint: "Keep the snake hiss going in the middle.",
        targetSound: "S",
        position: "medial",
        words: [
          { text: "pencil", emoji: "✏️" },
          { text: "racing", emoji: "🏁" },
          { text: "music", emoji: "🎵" },
          { text: "tossing", emoji: "🤾", accepts: ["toss"] },
        ],
      },
      {
        id: "s-final",
        title: "S at the end",
        hint: "Finish strong with a long ssss.",
        targetSound: "S",
        position: "final",
        words: [
          { text: "bus", emoji: "🚌", accepts: ["buss"] },
          { text: "house", emoji: "🏠" },
          { text: "mouse", emoji: "🐭" },
          { text: "ice", emoji: "🧊", accepts: ["eyes"] },
        ],
      },
    ],
  },
  {
    id: "r-sounds",
    sound: "R",
    category: "single-sound",
    title: "Roaring R",
    subtitle: "the /r/ sound",
    color: "bg-brand-500",
    emoji: "🦁",
    lessons: [
      {
        id: "r-initial",
        title: "R at the start",
        hint: "Roar like a lion — rrrrr!",
        targetSound: "R",
        position: "initial",
        words: [
          { text: "rain", emoji: "🌧️", accepts: ["rein", "reign"] },
          { text: "robot", emoji: "🤖" },
          { text: "rabbit", emoji: "🐰" },
          { text: "rocket", emoji: "🚀", accepts: ["rock it"] },
          { text: "ring", emoji: "💍", accepts: ["wring"] },
        ],
      },
      {
        id: "r-medial",
        title: "R in the middle",
        hint: "Keep the roar going in the middle.",
        targetSound: "R",
        position: "medial",
        words: [
          { text: "carrot", emoji: "🥕", accepts: ["caret", "karat"] },
          { text: "parrot", emoji: "🦜" },
          { text: "berry", emoji: "🍓", accepts: ["bury"] },
          { text: "story", emoji: "📖" },
        ],
      },
    ],
  },
  {
    id: "l-sounds",
    sound: "L",
    category: "single-sound",
    title: "Lovely L",
    subtitle: "the /l/ sound",
    color: "bg-grass-500",
    emoji: "🍋",
    lessons: [
      {
        id: "l-initial",
        title: "L at the start",
        hint: "Tongue up — la la la!",
        targetSound: "L",
        position: "initial",
        words: [
          { text: "lion", emoji: "🦁" },
          { text: "leaf", emoji: "🍃" },
          { text: "lamp", emoji: "💡" },
          { text: "lemon", emoji: "🍋" },
          { text: "log", emoji: "🪵" },
        ],
      },
      {
        id: "l-final",
        title: "L at the end",
        hint: "Tongue tip up at the end — ball!",
        targetSound: "L",
        position: "final",
        words: [
          { text: "ball", emoji: "⚽", accepts: ["bawl"] },
          { text: "bell", emoji: "🔔", accepts: ["belle"] },
          { text: "owl", emoji: "🦉" },
          { text: "snail", emoji: "🐌" },
        ],
      },
    ],
  },
  {
    id: "sh-sounds",
    sound: "SH",
    category: "single-sound",
    title: "Shushy SH",
    subtitle: "the /sh/ sound",
    color: "bg-sky-400",
    emoji: "🤫",
    lessons: [
      {
        id: "sh-initial",
        title: "SH at the start",
        hint: "Like telling someone to be quiet — shhh!",
        targetSound: "SH",
        position: "initial",
        words: [
          { text: "shoe", emoji: "👟", accepts: ["shoo"] },
          { text: "ship", emoji: "🚢" },
          { text: "shark", emoji: "🦈" },
          { text: "sheep", emoji: "🐑" },
          { text: "shell", emoji: "🐚" },
        ],
      },
    ],
  },
  {
    id: "th-sounds",
    sound: "TH",
    category: "single-sound",
    title: "Thinky TH",
    subtitle: "the /th/ sound",
    color: "bg-brand-400",
    emoji: "🦷",
    lessons: [
      {
        id: "th-initial",
        title: "TH at the start",
        hint: "Tongue peeks out between your teeth.",
        targetSound: "TH",
        position: "initial",
        words: [
          { text: "thumb", emoji: "👍", accepts: ["thum"] },
          { text: "think", emoji: "🤔" },
          { text: "three", emoji: "3️⃣" },
          { text: "thirsty", emoji: "🥤" },
        ],
      },
    ],
  },
  {
    id: "ch-sounds",
    sound: "CH",
    category: "single-sound",
    title: "Choo-choo CH",
    subtitle: "the /ch/ sound",
    color: "bg-grass-400",
    emoji: "🚂",
    lessons: [
      {
        id: "ch-initial",
        title: "CH at the start",
        hint: "Like a train — choo choo!",
        targetSound: "CH",
        position: "initial",
        words: [
          { text: "chair", emoji: "🪑" },
          { text: "cheese", emoji: "🧀" },
          { text: "cherry", emoji: "🍒" },
          { text: "chicken", emoji: "🐔" },
          { text: "chocolate", emoji: "🍫" },
        ],
      },
    ],
  },
  {
    id: "k-sounds",
    sound: "K",
    category: "single-sound",
    title: "Kicky K",
    subtitle: "the /k/ sound (helps with fronting)",
    color: "bg-sky-500",
    emoji: "🦘",
    lessons: [
      {
        id: "k-initial",
        title: "K at the start",
        hint: "Sound from the back of the throat — k, k, k!",
        targetSound: "K",
        position: "initial",
        words: [
          { text: "key", emoji: "🔑" },
          { text: "cat", emoji: "🐱" },
          { text: "cake", emoji: "🎂" },
          { text: "cookie", emoji: "🍪" },
          { text: "kite", emoji: "🪁" },
        ],
      },
      {
        id: "k-final",
        title: "K at the end",
        hint: "Pop the K at the end — book!",
        targetSound: "K",
        position: "final",
        words: [
          { text: "book", emoji: "📚" },
          { text: "duck", emoji: "🦆" },
          { text: "rock", emoji: "🪨" },
          { text: "sock", emoji: "🧦" },
        ],
      },
    ],
  },
  {
    id: "g-sounds",
    sound: "G",
    category: "single-sound",
    title: "Giggle G",
    subtitle: "the /g/ sound (helps with fronting)",
    color: "bg-grass-500",
    emoji: "🐊",
    lessons: [
      {
        id: "g-initial",
        title: "G at the start",
        hint: "From the back of your throat — g, g, g!",
        targetSound: "G",
        position: "initial",
        words: [
          { text: "girl", emoji: "👧" },
          { text: "goat", emoji: "🐐" },
          { text: "goose", emoji: "🦢" },
          { text: "guitar", emoji: "🎸" },
          { text: "gum", emoji: "🍬" },
        ],
      },
    ],
  },
  {
    id: "f-sounds",
    sound: "F",
    category: "single-sound",
    title: "Fluffy F",
    subtitle: "the /f/ sound",
    color: "bg-brand-400",
    emoji: "🐟",
    lessons: [
      {
        id: "f-initial",
        title: "F at the start",
        hint: "Top teeth on bottom lip — fffff!",
        targetSound: "F",
        position: "initial",
        words: [
          { text: "fish", emoji: "🐟" },
          { text: "frog", emoji: "🐸" },
          { text: "foot", emoji: "🦶" },
          { text: "fork", emoji: "🍴" },
          { text: "fire", emoji: "🔥" },
        ],
      },
    ],
  },

  // ───────────────────────── S-Blends ─────────────────────────
  {
    id: "s-blends",
    sound: "S",
    category: "s-blend",
    title: "S-Blends",
    subtitle: "two sounds together — sp, st, sk, sl",
    color: "bg-sky-500",
    emoji: "🌟",
    lessons: [
      {
        id: "sp-initial",
        title: "SP words",
        hint: "Both sounds — ssss + p — together!",
        targetSound: "S",
        position: "initial",
        blend: "sp",
        words: [
          { text: "spoon", emoji: "🥄" },
          { text: "spider", emoji: "🕷️" },
          { text: "space", emoji: "🚀" },
          { text: "spot", emoji: "🐶" },
        ],
      },
      {
        id: "st-initial",
        title: "ST words",
        hint: "Don't drop the S — ssss + t!",
        targetSound: "S",
        position: "initial",
        blend: "st",
        words: [
          { text: "star", emoji: "⭐" },
          { text: "stop", emoji: "🛑" },
          { text: "stick", emoji: "🥢" },
          { text: "stone", emoji: "🪨" },
        ],
      },
      {
        id: "sk-initial",
        title: "SK words",
        hint: "Two sounds — ssss + k!",
        targetSound: "S",
        position: "initial",
        blend: "sk",
        words: [
          { text: "sky", emoji: "🌤️" },
          { text: "skate", emoji: "⛸️" },
          { text: "school", emoji: "🏫" },
          { text: "skunk", emoji: "🦨" },
        ],
      },
      {
        id: "sl-initial",
        title: "SL words",
        hint: "Both sounds — ssss + l!",
        targetSound: "S",
        position: "initial",
        blend: "sl",
        words: [
          { text: "slide", emoji: "🛝" },
          { text: "sleep", emoji: "😴" },
          { text: "slime", emoji: "🟢" },
          { text: "sloth", emoji: "🦥" },
        ],
      },
    ],
  },

  // ───────────────────────── L-Blends ─────────────────────────
  {
    id: "l-blends",
    sound: "L",
    category: "l-blend",
    title: "L-Blends",
    subtitle: "bl, cl, fl, pl together",
    color: "bg-grass-500",
    emoji: "🌸",
    lessons: [
      {
        id: "bl-initial",
        title: "BL words",
        hint: "B and L together — bl!",
        targetSound: "L",
        position: "initial",
        blend: "bl",
        words: [
          { text: "blue", emoji: "🔵" },
          { text: "block", emoji: "🧱" },
          { text: "blanket", emoji: "🛏️" },
          { text: "blow", emoji: "🌬️" },
        ],
      },
      {
        id: "cl-initial",
        title: "CL words",
        hint: "C and L together — cl!",
        targetSound: "L",
        position: "initial",
        blend: "cl",
        words: [
          { text: "clock", emoji: "🕰️" },
          { text: "cloud", emoji: "☁️" },
          { text: "clap", emoji: "👏" },
          { text: "climb", emoji: "🧗" },
        ],
      },
      {
        id: "fl-initial",
        title: "FL words",
        hint: "F and L together — fl!",
        targetSound: "L",
        position: "initial",
        blend: "fl",
        words: [
          { text: "flag", emoji: "🚩" },
          { text: "flower", emoji: "🌸" },
          { text: "fly", emoji: "🪰" },
          { text: "flame", emoji: "🔥" },
        ],
      },
      {
        id: "pl-initial",
        title: "PL words",
        hint: "P and L together — pl!",
        targetSound: "L",
        position: "initial",
        blend: "pl",
        words: [
          { text: "plane", emoji: "✈️" },
          { text: "plant", emoji: "🪴" },
          { text: "plate", emoji: "🍽️" },
          { text: "plus", emoji: "➕" },
        ],
      },
    ],
  },

  // ───────────────────────── R-Blends ─────────────────────────
  {
    id: "r-blends",
    sound: "R",
    category: "r-blend",
    title: "R-Blends",
    subtitle: "br, cr, dr, tr together",
    color: "bg-brand-500",
    emoji: "🌈",
    lessons: [
      {
        id: "br-initial",
        title: "BR words",
        hint: "B and R together — br!",
        targetSound: "R",
        position: "initial",
        blend: "br",
        words: [
          { text: "bread", emoji: "🍞" },
          { text: "brown", emoji: "🟫" },
          { text: "brush", emoji: "🪥" },
          { text: "bridge", emoji: "🌉" },
        ],
      },
      {
        id: "cr-initial",
        title: "CR words",
        hint: "C and R together — cr!",
        targetSound: "R",
        position: "initial",
        blend: "cr",
        words: [
          { text: "crab", emoji: "🦀" },
          { text: "crown", emoji: "👑" },
          { text: "cry", emoji: "😢" },
          { text: "crayon", emoji: "🖍️" },
        ],
      },
      {
        id: "dr-initial",
        title: "DR words",
        hint: "D and R together — dr!",
        targetSound: "R",
        position: "initial",
        blend: "dr",
        words: [
          { text: "drum", emoji: "🥁" },
          { text: "dragon", emoji: "🐉" },
          { text: "drink", emoji: "🥤" },
          { text: "draw", emoji: "✏️" },
        ],
      },
      {
        id: "tr-initial",
        title: "TR words",
        hint: "T and R together — tr!",
        targetSound: "R",
        position: "initial",
        blend: "tr",
        words: [
          { text: "tree", emoji: "🌳" },
          { text: "train", emoji: "🚂" },
          { text: "truck", emoji: "🚚" },
          { text: "trophy", emoji: "🏆" },
        ],
      },
    ],
  },

  // ───────────────────────── Final sounds (final consonant deletion) ─────────
  {
    id: "final-sounds",
    sound: "P",
    category: "final-sound",
    title: "Finishing Sounds",
    subtitle: "don't drop the ending!",
    color: "bg-brand-500",
    emoji: "🎯",
    lessons: [
      {
        id: "final-p",
        title: "End with P",
        hint: "Pop your lips at the end — p!",
        targetSound: "P",
        position: "final",
        words: [
          { text: "cup", emoji: "☕" },
          { text: "sheep", emoji: "🐑" },
          { text: "soap", emoji: "🧼" },
          { text: "soup", emoji: "🍲" },
        ],
      },
      {
        id: "final-t",
        title: "End with T",
        hint: "Tap your tongue at the end — t!",
        targetSound: "T",
        position: "final",
        words: [
          { text: "boat", emoji: "⛵" },
          { text: "hat", emoji: "🎩" },
          { text: "cat", emoji: "🐱" },
          { text: "foot", emoji: "🦶" },
        ],
      },
      {
        id: "final-m",
        title: "End with M",
        hint: "Close your lips at the end — mmm!",
        targetSound: "M",
        position: "final",
        words: [
          { text: "drum", emoji: "🥁" },
          { text: "broom", emoji: "🧹" },
          { text: "gum", emoji: "🍬" },
          { text: "thumb", emoji: "👍" },
        ],
      },
      {
        id: "final-n",
        title: "End with N",
        hint: "Tongue tip up at the end — nnn!",
        targetSound: "N",
        position: "final",
        words: [
          { text: "moon", emoji: "🌙" },
          { text: "rain", emoji: "🌧️" },
          { text: "sun", emoji: "☀️" },
          { text: "spoon", emoji: "🥄" },
        ],
      },
    ],
  },
];

/** Friendly group labels for the focus picker. */
export const CATEGORY_INFO: Record<
  SkillCategory,
  { label: string; description: string; emoji: string }
> = {
  "single-sound": {
    label: "Single sounds",
    description: "Practice tricky letters like S, R, L, SH, TH, CH, K, G, F.",
    emoji: "🔤",
  },
  "s-blend": {
    label: "S-Blends",
    description: "Two sounds together — sp, st, sk, sl (e.g. spoon, star).",
    emoji: "🌟",
  },
  "l-blend": {
    label: "L-Blends",
    description: "Pairs like bl, cl, fl, pl (e.g. blue, cloud).",
    emoji: "🌸",
  },
  "r-blend": {
    label: "R-Blends",
    description: "Pairs like br, cr, dr, tr (e.g. tree, drum).",
    emoji: "🌈",
  },
  "final-sound": {
    label: "Finishing sounds",
    description: "Working on producing the ends of words (cup, hat, drum).",
    emoji: "🎯",
  },
  fronting: {
    label: "Back sounds (K & G)",
    description: "Helps if your child says 'tat' for 'cat' or 'doat' for 'goat'.",
    emoji: "🦘",
  },
};

/**
 * Diagnostic options for the "Find my level" onboarding step. Each option
 * describes a pattern a parent might actually recognize in their child's
 * speech, and maps it to one or more skills we should put in their plan.
 */
export type DiagnosticChallenge = {
  id: string;
  label: string;
  example: string;
  emoji: string;
  focusSkillIds: string[];
};

export const DIAGNOSTIC_CHALLENGES: DiagnosticChallenge[] = [
  {
    id: "r",
    label: "R sound is tricky",
    example: "“wabbit” for “rabbit”",
    emoji: "🦁",
    focusSkillIds: ["r-sounds", "r-blends"],
  },
  {
    id: "l",
    label: "L sound is tricky",
    example: "“wion” for “lion”",
    emoji: "🍋",
    focusSkillIds: ["l-sounds", "l-blends"],
  },
  {
    id: "s-lisp",
    label: "Lisps on S",
    example: "“thun” for “sun”",
    emoji: "🐍",
    focusSkillIds: ["s-sounds"],
  },
  {
    id: "fronting",
    label: "Says T/D instead of K/G",
    example: "“tat” for “cat”",
    emoji: "🦘",
    focusSkillIds: ["k-sounds", "g-sounds"],
  },
  {
    id: "final",
    label: "Drops the end of words",
    example: "“ca” for “cat”",
    emoji: "🎯",
    focusSkillIds: ["final-sounds"],
  },
  {
    id: "clusters",
    label: "Skips sounds in clusters",
    example: "“poon” for “spoon”",
    emoji: "🌟",
    focusSkillIds: ["s-blends", "l-blends", "r-blends"],
  },
  {
    id: "th",
    label: "TH sound is tricky",
    example: "“fumb” for “thumb”",
    emoji: "🦷",
    focusSkillIds: ["th-sounds"],
  },
  {
    id: "sh",
    label: "SH sound is tricky",
    example: "“sip” for “ship”",
    emoji: "🤫",
    focusSkillIds: ["sh-sounds"],
  },
  {
    id: "ch",
    label: "CH sound is tricky",
    example: "“sip” for “chip”",
    emoji: "🚂",
    focusSkillIds: ["ch-sounds"],
  },
];

/**
 * Top-level goal tiles for the onboarding picker — matches Duolingo's
 * "I want to learn…" big-tile grid. Each tile expands to one or more skill
 * IDs so multi-selecting a few tiles still picks a meaningful focus set.
 */
export type GoalTile = {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  skillIds: string[];
};

export const GOAL_TILES: GoalTile[] = [
  {
    id: "single-sounds",
    emoji: "🔤",
    title: "Single Sounds",
    subtitle: "S, R, L, SH, TH, CH, K, G, F",
    skillIds: [
      "s-sounds",
      "r-sounds",
      "l-sounds",
      "sh-sounds",
      "th-sounds",
      "ch-sounds",
      "k-sounds",
      "g-sounds",
      "f-sounds",
    ],
  },
  {
    id: "s-blends",
    emoji: "🌟",
    title: "S-Blends",
    subtitle: "sp, st, sk, sl",
    skillIds: ["s-blends"],
  },
  {
    id: "l-blends",
    emoji: "🌸",
    title: "L-Blends",
    subtitle: "bl, cl, fl, pl",
    skillIds: ["l-blends"],
  },
  {
    id: "r-blends",
    emoji: "🌈",
    title: "R-Blends",
    subtitle: "br, cr, dr, tr",
    skillIds: ["r-blends"],
  },
  {
    id: "endings",
    emoji: "🎯",
    title: "Word Endings",
    subtitle: "for dropped final sounds",
    skillIds: ["final-sounds"],
  },
  {
    id: "kg",
    emoji: "🦘",
    title: "K & G Sounds",
    subtitle: "for fronting",
    skillIds: ["k-sounds", "g-sounds"],
  },
];

export function tilesToFocus(tileIds: string[]): string[] {
  const out = new Set<string>();
  for (const id of tileIds) {
    const t = GOAL_TILES.find((g) => g.id === id);
    if (!t) continue;
    for (const sid of t.skillIds) out.add(sid);
  }
  return Array.from(out);
}

/** Resolve picked diagnostic options into a deduplicated skill-id list. */
export function diagnosticToFocus(challengeIds: string[]): string[] {
  const out = new Set<string>();
  for (const id of challengeIds) {
    const c = DIAGNOSTIC_CHALLENGES.find((d) => d.id === id);
    if (!c) continue;
    for (const sid of c.focusSkillIds) out.add(sid);
  }
  return Array.from(out);
}

export function skillsByCategory(category: SkillCategory): Skill[] {
  if (category === "fronting") {
    // "Fronting" therapy targets initial K and G — surface those single-sound skills.
    return SKILLS.filter((s) => s.id === "k-sounds" || s.id === "g-sounds");
  }
  return SKILLS.filter((s) => s.category === category);
}

export function findSkill(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}

export function findLesson(
  skillId: string,
  lessonId: string,
): { skill: Skill; lesson: Lesson } | undefined {
  const skill = findSkill(skillId);
  if (!skill) return undefined;
  const lesson = skill.lessons.find((l) => l.id === lessonId);
  if (!lesson) return undefined;
  return { skill, lesson };
}

/** Stable ordered list of lessons across all skills, for unlock logic. */
export function allLessonsInOrder(): { skillId: string; lessonId: string }[] {
  const out: { skillId: string; lessonId: string }[] = [];
  for (const skill of SKILLS) {
    for (const lesson of skill.lessons) {
      out.push({ skillId: skill.id, lessonId: lesson.id });
    }
  }
  return out;
}
