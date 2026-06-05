/**
 * Language track content — the second Sona product: receptive & expressive
 * LANGUAGE practice (vocabulary, categories, WH-questions, sentence building).
 *
 * Unlike the speech track, these exercises are tap-to-answer — no microphone,
 * no cloud scoring — so they run anywhere (including Expo Go) and are easy to
 * expand. Shares the design system, mascot, and XP/streak engine with speech.
 *
 * Exercise kinds:
 *  - pickImage : receptive vocabulary — hear a word, tap the matching picture
 *  - choice    : categories / WH-questions — a question, tap the right answer
 *  - build     : expressive syntax — arrange word tiles into a sentence
 */

export type LangOption = { label: string; emoji?: string; correct?: boolean };

export type Exercise =
  | {
      kind: "pickImage";
      prompt: string; // e.g. "Find the dog"
      say: string; // spoken word, e.g. "dog"
      options: LangOption[]; // each has an emoji "picture"
    }
  | {
      kind: "choice";
      prompt: string; // e.g. "Which one is a fruit?"
      say?: string; // optional spoken prompt
      options: LangOption[]; // text answers (optional emoji)
    }
  | {
      kind: "build";
      prompt: string; // e.g. "Make a sentence"
      emoji?: string; // optional picture cue
      say?: string;
      answer: string[]; // correct word order
      bank: string[]; // shuffled tiles incl. a distractor or two
    };

export type LanguageLesson = {
  id: string;
  skillId: string;
  title: string;
  exercises: Exercise[];
};

export type LanguageSkill = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  color: string; // tailwind bg-* for the section banner
  lessons: LanguageLesson[];
};

export const LANGUAGE_SKILLS: LanguageSkill[] = [
  {
    id: "first-words",
    title: "First Words",
    subtitle: "Find the picture",
    emoji: "🐶",
    color: "bg-sky-500",
    lessons: [
      {
        id: "fw-animals",
        skillId: "first-words",
        title: "Animals",
        exercises: [
          {
            kind: "pickImage",
            prompt: "Find the dog",
            say: "dog",
            options: [
              { label: "dog", emoji: "🐶", correct: true },
              { label: "cat", emoji: "🐱" },
              { label: "cow", emoji: "🐄" },
              { label: "duck", emoji: "🦆" },
            ],
          },
          {
            kind: "pickImage",
            prompt: "Find the cat",
            say: "cat",
            options: [
              { label: "cat", emoji: "🐱", correct: true },
              { label: "pig", emoji: "🐷" },
              { label: "fish", emoji: "🐟" },
              { label: "bird", emoji: "🐦" },
            ],
          },
          {
            kind: "pickImage",
            prompt: "Find the bird",
            say: "bird",
            options: [
              { label: "bird", emoji: "🐦", correct: true },
              { label: "frog", emoji: "🐸" },
              { label: "bear", emoji: "🐻" },
              { label: "lion", emoji: "🦁" },
            ],
          },
          {
            kind: "pickImage",
            prompt: "Where is the fish?",
            say: "fish",
            options: [
              { label: "fish", emoji: "🐟", correct: true },
              { label: "dog", emoji: "🐶" },
              { label: "cow", emoji: "🐄" },
              { label: "cat", emoji: "🐱" },
            ],
          },
        ],
      },
      {
        id: "fw-food",
        skillId: "first-words",
        title: "Food",
        exercises: [
          {
            kind: "pickImage",
            prompt: "Find the apple",
            say: "apple",
            options: [
              { label: "apple", emoji: "🍎", correct: true },
              { label: "milk", emoji: "🥛" },
              { label: "bread", emoji: "🍞" },
              { label: "egg", emoji: "🥚" },
            ],
          },
          {
            kind: "pickImage",
            prompt: "Find the banana",
            say: "banana",
            options: [
              { label: "banana", emoji: "🍌", correct: true },
              { label: "apple", emoji: "🍎" },
              { label: "carrot", emoji: "🥕" },
              { label: "cookie", emoji: "🍪" },
            ],
          },
          {
            kind: "pickImage",
            prompt: "Find the milk",
            say: "milk",
            options: [
              { label: "milk", emoji: "🥛", correct: true },
              { label: "pizza", emoji: "🍕" },
              { label: "apple", emoji: "🍎" },
              { label: "banana", emoji: "🍌" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "which-one",
    title: "Which One?",
    subtitle: "Think and choose",
    emoji: "🤔",
    color: "bg-grass-500",
    lessons: [
      {
        id: "wo-categories",
        skillId: "which-one",
        title: "Categories",
        exercises: [
          {
            kind: "choice",
            prompt: "Which one is an animal?",
            options: [
              { label: "Dog", emoji: "🐶", correct: true },
              { label: "Hat", emoji: "🎩" },
              { label: "Cup", emoji: "🥤" },
            ],
          },
          {
            kind: "choice",
            prompt: "Which one is food?",
            options: [
              { label: "Pizza", emoji: "🍕", correct: true },
              { label: "Shoe", emoji: "👟" },
              { label: "Ball", emoji: "⚽" },
            ],
          },
          {
            kind: "choice",
            prompt: "Which one can fly?",
            options: [
              { label: "Bird", emoji: "🐦", correct: true },
              { label: "Fish", emoji: "🐟" },
              { label: "Dog", emoji: "🐶" },
            ],
          },
        ],
      },
      {
        id: "wo-where",
        skillId: "which-one",
        title: "Where & What",
        exercises: [
          {
            kind: "choice",
            prompt: "Where do you sleep?",
            say: "Where do you sleep?",
            options: [
              { label: "Bed", emoji: "🛏️", correct: true },
              { label: "Car", emoji: "🚗" },
              { label: "Tree", emoji: "🌳" },
            ],
          },
          {
            kind: "choice",
            prompt: "What do you eat with?",
            say: "What do you eat with?",
            options: [
              { label: "Fork", emoji: "🍴", correct: true },
              { label: "Sock", emoji: "🧦" },
              { label: "Book", emoji: "📖" },
            ],
          },
          {
            kind: "choice",
            prompt: "Where does a fish live?",
            say: "Where does a fish live?",
            options: [
              { label: "Water", emoji: "💧", correct: true },
              { label: "Sky", emoji: "☁️" },
              { label: "Bed", emoji: "🛏️" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "build-it",
    title: "Build a Sentence",
    subtitle: "Put the words in order",
    emoji: "🧩",
    color: "bg-brand-500",
    lessons: [
      {
        id: "bi-short",
        skillId: "build-it",
        title: "Little Sentences",
        exercises: [
          {
            kind: "build",
            prompt: "Make a sentence",
            emoji: "🐶",
            say: "The dog runs",
            answer: ["The", "dog", "runs"],
            bank: ["dog", "runs", "The", "cat"],
          },
          {
            kind: "build",
            prompt: "Make a sentence",
            emoji: "🐱",
            say: "The cat sleeps",
            answer: ["The", "cat", "sleeps"],
            bank: ["cat", "The", "sleeps", "jumps"],
          },
          {
            kind: "build",
            prompt: "Make a sentence",
            emoji: "🍎",
            say: "The apple is red",
            answer: ["The", "apple", "is", "red"],
            bank: ["apple", "is", "The", "red", "big"],
          },
        ],
      },
    ],
  },
];

export function findLanguageLesson(
  skillId: string,
  lessonId: string,
): { skill: LanguageSkill; lesson: LanguageLesson } | null {
  const skill = LANGUAGE_SKILLS.find((s) => s.id === skillId);
  const lesson = skill?.lessons.find((l) => l.id === lessonId);
  if (!skill || !lesson) return null;
  return { skill, lesson };
}

/** Flat list of language lessons in order, for sequential unlocking. */
export function languageLessonsInOrder(): { skillId: string; lessonId: string }[] {
  return LANGUAGE_SKILLS.flatMap((s) =>
    s.lessons.map((l) => ({ skillId: s.id, lessonId: l.id })),
  );
}
