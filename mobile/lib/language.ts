/**
 * Language track content — the second Sona product: receptive & expressive
 * LANGUAGE practice (vocabulary, concepts, WH-questions, sentence building).
 *
 * Tap-to-answer — no microphone, no cloud scoring — so it runs anywhere
 * (including Expo Go) and is easy to expand. Shares the design system,
 * mascot, and XP/streak engine with speech.
 *
 * Content is organised into named SECTIONS of themed skills (categories
 * inspired by common early-language curricula). Exercise kinds:
 *  - pickImage : receptive vocabulary — hear a word, tap the matching picture
 *  - choice    : categories / concepts / WH-questions — tap the right answer
 *  - build     : expressive syntax — arrange word tiles into a sentence
 */

export type LangOption = { label: string; emoji?: string; correct?: boolean };

export type Exercise =
  | { kind: "pickImage"; prompt: string; say: string; options: LangOption[] }
  | { kind: "choice"; prompt: string; say?: string; options: LangOption[] }
  | {
      kind: "build";
      prompt: string;
      emoji?: string;
      say?: string;
      answer: string[];
      bank: string[];
    };

export type LanguageLesson = {
  id: string;
  skillId: string;
  title: string;
  exercises: Exercise[];
};

export type LanguageSkill = {
  id: string;
  section: string; // grouping header on the home screen
  title: string;
  subtitle: string;
  emoji: string;
  color: string; // tailwind bg-* for the section banner
  lessons: LanguageLesson[];
};

// helper to keep the data terse
function L(
  id: string,
  skillId: string,
  title: string,
  exercises: Exercise[],
): LanguageLesson {
  return { id, skillId, title, exercises };
}
const pick = (
  prompt: string,
  say: string,
  options: LangOption[],
): Exercise => ({ kind: "pickImage", prompt, say, options });
const choice = (prompt: string, options: LangOption[]): Exercise => ({
  kind: "choice",
  prompt,
  say: prompt,
  options,
});
const build = (
  emoji: string,
  answer: string[],
  bank: string[],
): Exercise => ({
  kind: "build",
  prompt: "Make a sentence",
  emoji,
  say: answer.join(" "),
  answer,
  bank,
});

export const LANGUAGE_SKILLS: LanguageSkill[] = [
  // ───────────────── First Words ─────────────────
  {
    id: "first-words",
    section: "First Words",
    title: "Animals",
    subtitle: "Find the picture",
    emoji: "🐶",
    color: "bg-sky-500",
    lessons: [
      L("fw-animals", "first-words", "Animals", [
        pick("Find the dog", "dog", [
          { label: "dog", emoji: "🐶", correct: true },
          { label: "cat", emoji: "🐱" },
          { label: "cow", emoji: "🐄" },
          { label: "duck", emoji: "🦆" },
        ]),
        pick("Find the cat", "cat", [
          { label: "cat", emoji: "🐱", correct: true },
          { label: "pig", emoji: "🐷" },
          { label: "fish", emoji: "🐟" },
          { label: "bird", emoji: "🐦" },
        ]),
        pick("Find the bird", "bird", [
          { label: "bird", emoji: "🐦", correct: true },
          { label: "frog", emoji: "🐸" },
          { label: "bear", emoji: "🐻" },
          { label: "lion", emoji: "🦁" },
        ]),
        pick("Where is the fish?", "fish", [
          { label: "fish", emoji: "🐟", correct: true },
          { label: "dog", emoji: "🐶" },
          { label: "cow", emoji: "🐄" },
          { label: "cat", emoji: "🐱" },
        ]),
      ]),
    ],
  },
  {
    id: "first-food",
    section: "First Words",
    title: "Food",
    subtitle: "Find the picture",
    emoji: "🍎",
    color: "bg-grass-500",
    lessons: [
      L("fw-food", "first-food", "Food", [
        pick("Find the apple", "apple", [
          { label: "apple", emoji: "🍎", correct: true },
          { label: "milk", emoji: "🥛" },
          { label: "bread", emoji: "🍞" },
          { label: "egg", emoji: "🥚" },
        ]),
        pick("Find the banana", "banana", [
          { label: "banana", emoji: "🍌", correct: true },
          { label: "apple", emoji: "🍎" },
          { label: "carrot", emoji: "🥕" },
          { label: "cookie", emoji: "🍪" },
        ]),
        pick("Find the pizza", "pizza", [
          { label: "pizza", emoji: "🍕", correct: true },
          { label: "milk", emoji: "🥛" },
          { label: "apple", emoji: "🍎" },
          { label: "banana", emoji: "🍌" },
        ]),
      ]),
    ],
  },
  {
    id: "colors",
    section: "First Words",
    title: "Colors",
    subtitle: "Learn your colors",
    emoji: "🌈",
    color: "bg-brand-500",
    lessons: [
      L("col-1", "colors", "Colors", [
        pick("Find red", "red", [
          { label: "red", emoji: "🔴", correct: true },
          { label: "blue", emoji: "🔵" },
          { label: "green", emoji: "🟢" },
          { label: "yellow", emoji: "🟡" },
        ]),
        pick("Find blue", "blue", [
          { label: "blue", emoji: "🔵", correct: true },
          { label: "red", emoji: "🔴" },
          { label: "yellow", emoji: "🟡" },
          { label: "purple", emoji: "🟣" },
        ]),
        choice("What color is the banana?", [
          { label: "Yellow", emoji: "🟡", correct: true },
          { label: "Red", emoji: "🔴" },
          { label: "Blue", emoji: "🔵" },
        ]),
        choice("What color is grass?", [
          { label: "Green", emoji: "🟢", correct: true },
          { label: "Purple", emoji: "🟣" },
          { label: "Orange", emoji: "🟠" },
        ]),
      ]),
    ],
  },
  {
    id: "body",
    section: "First Words",
    title: "My Body",
    subtitle: "Name body parts",
    emoji: "👀",
    color: "bg-sky-500",
    lessons: [
      L("body-1", "body", "My Body", [
        pick("Find the eye", "eye", [
          { label: "eye", emoji: "👁️", correct: true },
          { label: "nose", emoji: "👃" },
          { label: "ear", emoji: "👂" },
          { label: "hand", emoji: "✋" },
        ]),
        pick("Find the nose", "nose", [
          { label: "nose", emoji: "👃", correct: true },
          { label: "mouth", emoji: "👄" },
          { label: "foot", emoji: "🦶" },
          { label: "eye", emoji: "👁️" },
        ]),
        choice("What do you see with?", [
          { label: "Eyes", emoji: "👁️", correct: true },
          { label: "Feet", emoji: "🦶" },
          { label: "Hands", emoji: "✋" },
        ]),
        choice("What do you hear with?", [
          { label: "Ears", emoji: "👂", correct: true },
          { label: "Nose", emoji: "👃" },
          { label: "Mouth", emoji: "👄" },
        ]),
      ]),
    ],
  },
  {
    id: "vehicles",
    section: "First Words",
    title: "Things That Go",
    subtitle: "Find the picture",
    emoji: "🚗",
    color: "bg-grass-500",
    lessons: [
      L("veh-1", "vehicles", "Things That Go", [
        pick("Find the car", "car", [
          { label: "car", emoji: "🚗", correct: true },
          { label: "bus", emoji: "🚌" },
          { label: "plane", emoji: "✈️" },
          { label: "boat", emoji: "⛵" },
        ]),
        pick("Find the airplane", "airplane", [
          { label: "plane", emoji: "✈️", correct: true },
          { label: "bike", emoji: "🚲" },
          { label: "train", emoji: "🚂" },
          { label: "car", emoji: "🚗" },
        ]),
        choice("Which one goes on water?", [
          { label: "Boat", emoji: "⛵", correct: true },
          { label: "Car", emoji: "🚗" },
          { label: "Bike", emoji: "🚲" },
        ]),
      ]),
    ],
  },

  // ───────────────── All About Me ─────────────────
  {
    id: "family",
    section: "All About Me",
    title: "My Family",
    subtitle: "Who is who?",
    emoji: "👨‍👩‍👧",
    color: "bg-brand-500",
    lessons: [
      L("fam-1", "family", "My Family", [
        pick("Find the baby", "baby", [
          { label: "baby", emoji: "👶", correct: true },
          { label: "mom", emoji: "👩" },
          { label: "dad", emoji: "👨" },
          { label: "grandma", emoji: "👵" },
        ]),
        pick("Find the mom", "mom", [
          { label: "mom", emoji: "👩", correct: true },
          { label: "dad", emoji: "👨" },
          { label: "baby", emoji: "👶" },
          { label: "grandpa", emoji: "👴" },
        ]),
        choice("Who is the grown-up boy?", [
          { label: "Dad", emoji: "👨", correct: true },
          { label: "Baby", emoji: "👶" },
          { label: "Mom", emoji: "👩" },
        ]),
      ]),
    ],
  },
  {
    id: "feelings",
    section: "All About Me",
    title: "Feelings",
    subtitle: "How do they feel?",
    emoji: "😀",
    color: "bg-sky-500",
    lessons: [
      L("feel-1", "feelings", "Feelings", [
        pick("Find happy", "happy", [
          { label: "happy", emoji: "😀", correct: true },
          { label: "sad", emoji: "😢" },
          { label: "mad", emoji: "😡" },
          { label: "scared", emoji: "😱" },
        ]),
        pick("Find sad", "sad", [
          { label: "sad", emoji: "😢", correct: true },
          { label: "happy", emoji: "😀" },
          { label: "sleepy", emoji: "😴" },
          { label: "mad", emoji: "😡" },
        ]),
        choice("How do you feel when you get a present?", [
          { label: "Happy", emoji: "😀", correct: true },
          { label: "Sad", emoji: "😢" },
          { label: "Mad", emoji: "😡" },
        ]),
      ]),
    ],
  },
  {
    id: "jobs",
    section: "All About Me",
    title: "Helpers",
    subtitle: "Who does what?",
    emoji: "🚒",
    color: "bg-grass-500",
    lessons: [
      L("jobs-1", "jobs", "Community Helpers", [
        choice("Who puts out fires?", [
          { label: "Firefighter", emoji: "🧑‍🚒", correct: true },
          { label: "Chef", emoji: "🧑‍🍳" },
          { label: "Farmer", emoji: "🧑‍🌾" },
        ]),
        choice("Who helps you when you are sick?", [
          { label: "Doctor", emoji: "🧑‍⚕️", correct: true },
          { label: "Police", emoji: "👮" },
          { label: "Teacher", emoji: "🧑‍🏫" },
        ]),
        choice("Who cooks food at a restaurant?", [
          { label: "Chef", emoji: "🧑‍🍳", correct: true },
          { label: "Doctor", emoji: "🧑‍⚕️" },
          { label: "Firefighter", emoji: "🧑‍🚒" },
        ]),
      ]),
    ],
  },

  // ───────────────── Everyday Routines ─────────────────
  {
    id: "morning",
    section: "Everyday Routines",
    title: "Morning Time",
    subtitle: "What do we do?",
    emoji: "🌅",
    color: "bg-brand-500",
    lessons: [
      L("morn-1", "morning", "Morning Time", [
        choice("What do you clean your teeth with?", [
          { label: "Toothbrush", emoji: "🪥", correct: true },
          { label: "Spoon", emoji: "🥄" },
          { label: "Sock", emoji: "🧦" },
        ]),
        choice("What do you wash with?", [
          { label: "Soap", emoji: "🧼", correct: true },
          { label: "Cup", emoji: "🥤" },
          { label: "Book", emoji: "📖" },
        ]),
        choice("What do you wear on your feet?", [
          { label: "Shoes", emoji: "👟", correct: true },
          { label: "Hat", emoji: "🧢" },
          { label: "Gloves", emoji: "🧤" },
        ]),
      ]),
    ],
  },
  {
    id: "mealtime",
    section: "Everyday Routines",
    title: "Mealtime",
    subtitle: "Eating & drinking",
    emoji: "🍽️",
    color: "bg-sky-500",
    lessons: [
      L("meal-1", "mealtime", "Mealtime", [
        choice("What do you drink from?", [
          { label: "Cup", emoji: "🥤", correct: true },
          { label: "Shoe", emoji: "👟" },
          { label: "Hat", emoji: "🧢" },
        ]),
        choice("What do you eat soup with?", [
          { label: "Spoon", emoji: "🥄", correct: true },
          { label: "Sock", emoji: "🧦" },
          { label: "Pen", emoji: "🖊️" },
        ]),
        choice("Where does food go?", [
          { label: "On a plate", emoji: "🍽️", correct: true },
          { label: "In a shoe", emoji: "👟" },
          { label: "In a car", emoji: "🚗" },
        ]),
      ]),
    ],
  },
  {
    id: "bedtime",
    section: "Everyday Routines",
    title: "Bedtime",
    subtitle: "Night time",
    emoji: "🌙",
    color: "bg-grass-500",
    lessons: [
      L("bed-1", "bedtime", "Bedtime", [
        choice("Where do you sleep?", [
          { label: "Bed", emoji: "🛏️", correct: true },
          { label: "Car", emoji: "🚗" },
          { label: "Tree", emoji: "🌳" },
        ]),
        choice("What is in the sky at night?", [
          { label: "Moon", emoji: "🌙", correct: true },
          { label: "Sun", emoji: "☀️" },
          { label: "Shoe", emoji: "👟" },
        ]),
        choice("What do you read before bed?", [
          { label: "Book", emoji: "📖", correct: true },
          { label: "Spoon", emoji: "🥄" },
          { label: "Sock", emoji: "🧦" },
        ]),
      ]),
    ],
  },

  // ───────────────── Thinking Skills ─────────────────
  {
    id: "categories",
    section: "Thinking Skills",
    title: "Categories",
    subtitle: "Sort it out",
    emoji: "🧺",
    color: "bg-brand-500",
    lessons: [
      L("cat-1", "categories", "Categories", [
        choice("Which one is an animal?", [
          { label: "Dog", emoji: "🐶", correct: true },
          { label: "Hat", emoji: "🎩" },
          { label: "Cup", emoji: "🥤" },
        ]),
        choice("Which one is food?", [
          { label: "Pizza", emoji: "🍕", correct: true },
          { label: "Shoe", emoji: "👟" },
          { label: "Ball", emoji: "⚽" },
        ]),
        choice("Which one can fly?", [
          { label: "Bird", emoji: "🐦", correct: true },
          { label: "Fish", emoji: "🐟" },
          { label: "Dog", emoji: "🐶" },
        ]),
      ]),
    ],
  },
  {
    id: "opposites",
    section: "Thinking Skills",
    title: "Opposites",
    subtitle: "Big and little",
    emoji: "↔️",
    color: "bg-sky-500",
    lessons: [
      L("opp-1", "opposites", "Opposites", [
        choice("What is the opposite of BIG?", [
          { label: "Little", emoji: "🐭", correct: true },
          { label: "Tall", emoji: "🦒" },
          { label: "Fast", emoji: "🏎️" },
        ]),
        choice("What is the opposite of HOT?", [
          { label: "Cold", emoji: "❄️", correct: true },
          { label: "Wet", emoji: "💧" },
          { label: "Loud", emoji: "🔊" },
        ]),
        choice("What is the opposite of DAY?", [
          { label: "Night", emoji: "🌙", correct: true },
          { label: "Sun", emoji: "☀️" },
          { label: "Up", emoji: "⬆️" },
        ]),
      ]),
    ],
  },
  {
    id: "odd-one",
    section: "Thinking Skills",
    title: "What's Different",
    subtitle: "Find the odd one",
    emoji: "🔎",
    color: "bg-grass-500",
    lessons: [
      L("odd-1", "odd-one", "What's Different", [
        choice("Which one is NOT an animal?", [
          { label: "Car", emoji: "🚗", correct: true },
          { label: "Dog", emoji: "🐶" },
          { label: "Cat", emoji: "🐱" },
        ]),
        choice("Which one is NOT food?", [
          { label: "Shoe", emoji: "👟", correct: true },
          { label: "Apple", emoji: "🍎" },
          { label: "Bread", emoji: "🍞" },
        ]),
        choice("Which one does NOT go in the sky?", [
          { label: "Fish", emoji: "🐟", correct: true },
          { label: "Bird", emoji: "🐦" },
          { label: "Plane", emoji: "✈️" },
        ]),
      ]),
    ],
  },
  {
    id: "questions",
    section: "Thinking Skills",
    title: "Questions",
    subtitle: "Where & what",
    emoji: "❓",
    color: "bg-brand-500",
    lessons: [
      L("q-1", "questions", "Questions", [
        choice("Where does a fish live?", [
          { label: "Water", emoji: "💧", correct: true },
          { label: "Sky", emoji: "☁️" },
          { label: "Bed", emoji: "🛏️" },
        ]),
        choice("What do you wear when it rains?", [
          { label: "Coat", emoji: "🧥", correct: true },
          { label: "Swimsuit", emoji: "🩱" },
          { label: "Pajamas", emoji: "👕" },
        ]),
        choice("Where do you buy food?", [
          { label: "Store", emoji: "🏪", correct: true },
          { label: "Bed", emoji: "🛏️" },
          { label: "Car", emoji: "🚗" },
        ]),
      ]),
    ],
  },

  // ───────────────── Build Sentences ─────────────────
  {
    id: "build-short",
    section: "Build Sentences",
    title: "Little Sentences",
    subtitle: "Put words in order",
    emoji: "🧩",
    color: "bg-sky-500",
    lessons: [
      L("bi-short", "build-short", "Little Sentences", [
        build("🐶", ["The", "dog", "runs"], ["dog", "runs", "The", "cat"]),
        build("🐱", ["The", "cat", "sleeps"], ["cat", "The", "sleeps", "jumps"]),
        build("🍎", ["The", "apple", "is", "red"], ["apple", "is", "The", "red", "big"]),
      ]),
    ],
  },
  {
    id: "build-action",
    section: "Build Sentences",
    title: "Action Words",
    subtitle: "What are they doing?",
    emoji: "🏃",
    color: "bg-grass-500",
    lessons: [
      L("bi-action", "build-action", "Action Words", [
        build("🏃", ["I", "can", "run"], ["run", "I", "can", "sit"]),
        build("🐸", ["The", "frog", "jumps"], ["frog", "jumps", "The", "swims"]),
        build("🐦", ["Birds", "like", "to", "fly"], ["fly", "to", "Birds", "like", "swim"]),
      ]),
    ],
  },
];

/** Section order for the home screen (first appearance wins). */
export function languageSections(): string[] {
  const seen: string[] = [];
  for (const s of LANGUAGE_SKILLS) if (!seen.includes(s.section)) seen.push(s.section);
  return seen;
}

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
