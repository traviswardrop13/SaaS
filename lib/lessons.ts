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
  words: Word[];
};

export type Skill = {
  id: string;
  /** the phoneme this skill targets, e.g. "S" */
  sound: string;
  title: string;
  subtitle: string;
  color: string; // tailwind bg-* class for the node
  emoji: string;
  lessons: Lesson[];
};

export const SKILLS: Skill[] = [
  {
    id: "s-sounds",
    sound: "S",
    title: "Silly S",
    subtitle: "the /s/ sound",
    color: "bg-sky-500",
    emoji: "🐍",
    lessons: [
      {
        id: "s-initial",
        title: "S at the start",
        hint: "Hiss like a snake — sssss!",
        words: [
          { text: "sun", emoji: "☀️" },
          { text: "sock", emoji: "🧦" },
          { text: "soup", emoji: "🍲" },
          { text: "seal", emoji: "🦭" },
          { text: "snake", emoji: "🐍" },
        ],
      },
      {
        id: "s-medial",
        title: "S in the middle",
        hint: "Keep the snake hiss going in the middle.",
        words: [
          { text: "pencil", emoji: "✏️" },
          { text: "racing", emoji: "🏁" },
          { text: "music", emoji: "🎵" },
          { text: "tossing", emoji: "🤾" },
        ],
      },
      {
        id: "s-final",
        title: "S at the end",
        hint: "Finish strong with a long ssss.",
        words: [
          { text: "bus", emoji: "🚌" },
          { text: "house", emoji: "🏠" },
          { text: "mouse", emoji: "🐭" },
          { text: "ice", emoji: "🧊" },
        ],
      },
    ],
  },
  {
    id: "r-sounds",
    sound: "R",
    title: "Roaring R",
    subtitle: "the /r/ sound",
    color: "bg-brand-500",
    emoji: "🦁",
    lessons: [
      {
        id: "r-initial",
        title: "R at the start",
        hint: "Roar like a lion — rrrrr!",
        words: [
          { text: "rain", emoji: "🌧️" },
          { text: "robot", emoji: "🤖" },
          { text: "rabbit", emoji: "🐰" },
          { text: "rocket", emoji: "🚀" },
          { text: "ring", emoji: "💍" },
        ],
      },
      {
        id: "r-medial",
        title: "R in the middle",
        hint: "Keep the roar going in the middle.",
        words: [
          { text: "carrot", emoji: "🥕" },
          { text: "parrot", emoji: "🦜" },
          { text: "berry", emoji: "🍓" },
          { text: "story", emoji: "📖" },
        ],
      },
    ],
  },
  {
    id: "l-sounds",
    sound: "L",
    title: "Lovely L",
    subtitle: "the /l/ sound",
    color: "bg-grass-500",
    emoji: "🍋",
    lessons: [
      {
        id: "l-initial",
        title: "L at the start",
        hint: "Tongue up — la la la!",
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
        words: [
          { text: "ball", emoji: "⚽" },
          { text: "bell", emoji: "🔔" },
          { text: "owl", emoji: "🦉" },
          { text: "snail", emoji: "🐌" },
        ],
      },
    ],
  },
  {
    id: "sh-sounds",
    sound: "SH",
    title: "Shushy SH",
    subtitle: "the /sh/ sound",
    color: "bg-sky-400",
    emoji: "🤫",
    lessons: [
      {
        id: "sh-initial",
        title: "SH at the start",
        hint: "Like telling someone to be quiet — shhh!",
        words: [
          { text: "shoe", emoji: "👟" },
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
    title: "Thinky TH",
    subtitle: "the /th/ sound",
    color: "bg-brand-400",
    emoji: "🦷",
    lessons: [
      {
        id: "th-initial",
        title: "TH at the start",
        hint: "Tongue peeks out between your teeth.",
        words: [
          { text: "thumb", emoji: "👍" },
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
    title: "Choo-choo CH",
    subtitle: "the /ch/ sound",
    color: "bg-grass-400",
    emoji: "🚂",
    lessons: [
      {
        id: "ch-initial",
        title: "CH at the start",
        hint: "Like a train — choo choo!",
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
];

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
