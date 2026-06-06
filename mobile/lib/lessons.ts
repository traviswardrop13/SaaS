import type { LessonLevel, SoundPosition, TargetSound } from "./scoring";

export type Word = {
  /** the target word/syllable/phrase the child should say */
  text: string;
  /** optional emoji picture cue (skipped for isolation/syllables) */
  emoji?: string;
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
  /** Where the target sound sits in each item. */
  position: SoundPosition;
  /** Articulation-hierarchy level — controls UI + unlock gating. */
  level: LessonLevel;
  /**
   * If set, the recognized word must begin with this consonant cluster
   * (e.g. "sp", "br", "bl") to count. Used by cluster-reduction lessons to
   * distinguish "spoon" from "soon" (cluster reduced).
   */
  blend?: string;
  /**
   * Same idea but for final-position clusters (e.g. "nd" / "mp" / "st") —
   * "hand" → "han" should not pass.
   */
  endBlend?: string;
  words: Word[];
};

/** Friendly label and ordering rank for hierarchy levels. */
export const LEVEL_INFO: Record<
  LessonLevel,
  { label: string; rank: number; short: string }
> = {
  isolation: { label: "Isolation", rank: 1, short: "1" },
  syllables: { label: "Syllables", rank: 2, short: "2" },
  words: { label: "Words", rank: 3, short: "3" },
  phrases: { label: "Phrases", rank: 4, short: "4" },
  sentences: { label: "Sentences", rank: 5, short: "5" },
};

export type SkillCategory =
  | "single-sound"
  | "s-blend"
  | "r-blend"
  | "l-blend"
  | "final-sound"
  | "final-cluster"
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
        id: "s-isolation",
        title: "Just the S sound",
        hint: "Hiss like a snake — sssss!",
        targetSound: "S",
        position: "initial",
        level: "isolation",
        words: [
          { text: "sss", accepts: ["s", "ss"] },
          { text: "sss", accepts: ["s", "ss"] },
          { text: "sss", accepts: ["s", "ss"] },
        ],
      },
      {
        id: "s-syllables",
        title: "S syllables",
        hint: "Add a vowel — sah, see, sigh, so, sue.",
        targetSound: "S",
        position: "initial",
        level: "syllables",
        words: [
          { text: "sah", accepts: ["sa", "saw"] },
          { text: "see", accepts: ["sea", "si"] },
          { text: "sigh", accepts: ["sy", "psi"] },
          { text: "so", accepts: ["sow", "sew"] },
          { text: "sue", accepts: ["soo", "su"] },
        ],
      },
      {
        id: "s-initial",
        title: "S at the start of words",
        hint: "Start strong — ssssss!",
        targetSound: "S",
        position: "initial",
        level: "words",
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
        title: "S in the middle of words",
        hint: "Keep the snake hiss going in the middle.",
        targetSound: "S",
        position: "medial",
        level: "words",
        words: [
          { text: "pencil", emoji: "✏️" },
          { text: "racing", emoji: "🏁" },
          { text: "music", emoji: "🎵" },
          { text: "tossing", emoji: "🤾", accepts: ["toss"] },
        ],
      },
      {
        id: "s-final",
        title: "S at the end of words",
        hint: "Finish strong with a long ssss.",
        targetSound: "S",
        position: "final",
        level: "words",
        words: [
          { text: "bus", emoji: "🚌", accepts: ["buss"] },
          { text: "house", emoji: "🏠" },
          { text: "mouse", emoji: "🐭" },
          { text: "ice", emoji: "🧊", accepts: ["eyes"] },
        ],
      },
      {
        id: "s-phrases",
        title: "S in short phrases",
        hint: "Two S words together!",
        targetSound: "S",
        position: "initial",
        level: "phrases",
        words: [
          { text: "see the sun" },
          { text: "soft soap" },
          { text: "six seals" },
          { text: "sing a song" },
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
        id: "r-isolation",
        title: "Just the R sound",
        hint: "Make the R sound by itself — errr!",
        targetSound: "R",
        position: "initial",
        level: "isolation",
        words: [
          { text: "er", accepts: ["err", "ur", "ir"] },
          { text: "er", accepts: ["err", "ur", "ir"] },
          { text: "er", accepts: ["err", "ur", "ir"] },
        ],
      },
      {
        id: "r-syllables",
        title: "R syllables",
        hint: "Add a vowel — rah, ree, rye, row, roo.",
        targetSound: "R",
        position: "initial",
        level: "syllables",
        words: [
          { text: "rah", accepts: ["ra", "raw"] },
          { text: "ree", accepts: ["re"] },
          { text: "rye", accepts: ["ry", "ri"] },
          { text: "row", accepts: ["ro"] },
          { text: "roo", accepts: ["ru", "rue"] },
        ],
      },
      {
        id: "r-initial",
        title: "R at the start of words",
        hint: "Roar like a lion — rrrrrr!",
        targetSound: "R",
        position: "initial",
        level: "words",
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
        title: "R in the middle of words",
        hint: "Keep the roar going in the middle.",
        targetSound: "R",
        position: "medial",
        level: "words",
        words: [
          { text: "carrot", emoji: "🥕", accepts: ["caret", "karat"] },
          { text: "parrot", emoji: "🦜" },
          { text: "berry", emoji: "🍓", accepts: ["bury"] },
          { text: "story", emoji: "📖" },
        ],
      },
      {
        id: "r-phrases",
        title: "R in short phrases",
        hint: "Two R words together!",
        targetSound: "R",
        position: "initial",
        level: "phrases",
        words: [
          { text: "red rain" },
          { text: "run fast" },
          { text: "ride a bike" },
          { text: "round and round" },
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
        id: "l-isolation",
        title: "Just the L sound",
        hint: "Tongue tip up behind your teeth — llll!",
        targetSound: "L",
        position: "initial",
        level: "isolation",
        words: [
          { text: "lll", accepts: ["l", "ll", "el"] },
          { text: "lll", accepts: ["l", "ll", "el"] },
          { text: "lll", accepts: ["l", "ll", "el"] },
        ],
      },
      {
        id: "l-syllables",
        title: "L syllables",
        hint: "Add a vowel — lah, lee, lye, low, loo.",
        targetSound: "L",
        position: "initial",
        level: "syllables",
        words: [
          { text: "lah", accepts: ["la", "law"] },
          { text: "lee", accepts: ["lea"] },
          { text: "lye", accepts: ["lie", "li"] },
          { text: "low", accepts: ["lo"] },
          { text: "loo", accepts: ["lou", "lu"] },
        ],
      },
      {
        id: "l-initial",
        title: "L at the start of words",
        hint: "Tongue up — la la la!",
        targetSound: "L",
        position: "initial",
        level: "words",
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
        title: "L at the end of words",
        hint: "Tongue tip up at the end — ball!",
        targetSound: "L",
        position: "final",
        level: "words",
        words: [
          { text: "ball", emoji: "⚽", accepts: ["bawl"] },
          { text: "bell", emoji: "🔔", accepts: ["belle"] },
          { text: "owl", emoji: "🦉" },
          { text: "snail", emoji: "🐌" },
        ],
      },
      {
        id: "l-phrases",
        title: "L in short phrases",
        hint: "Two L words together!",
        targetSound: "L",
        position: "initial",
        level: "phrases",
        words: [
          { text: "look at me" },
          { text: "lemon ice" },
          { text: "let me see" },
          { text: "low light" },
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
        id: "sh-isolation",
        title: "Just the SH sound",
        hint: "Quiet sound — shhhh!",
        targetSound: "SH",
        position: "initial",
        level: "isolation",
        words: [
          { text: "shh", accepts: ["sh", "shhh"] },
          { text: "shh", accepts: ["sh", "shhh"] },
          { text: "shh", accepts: ["sh", "shhh"] },
        ],
      },
      {
        id: "sh-syllables",
        title: "SH syllables",
        hint: "Add a vowel — shah, she, shy, show, shoe.",
        targetSound: "SH",
        position: "initial",
        level: "syllables",
        words: [
          { text: "shah", accepts: ["sha"] },
          { text: "she" },
          { text: "shy", accepts: ["shi"] },
          { text: "show", accepts: ["sho"] },
          { text: "shoe", accepts: ["shoo", "shu"] },
        ],
      },
      {
        id: "sh-initial",
        title: "SH at the start of words",
        hint: "Like telling someone to be quiet — shhh!",
        targetSound: "SH",
        position: "initial",
        level: "words",
        words: [
          { text: "shoe", emoji: "👟", accepts: ["shoo"] },
          { text: "ship", emoji: "🚢" },
          { text: "shark", emoji: "🦈" },
          { text: "sheep", emoji: "🐑" },
          { text: "shell", emoji: "🐚" },
        ],
      },
      {
        id: "sh-phrases",
        title: "SH in short phrases",
        hint: "Two SH words together!",
        targetSound: "SH",
        position: "initial",
        level: "phrases",
        words: [
          { text: "shiny shoes" },
          { text: "sheep on a ship" },
          { text: "shake the shell" },
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
        id: "th-isolation",
        title: "Just the TH sound",
        hint: "Tongue between your teeth — thhh!",
        targetSound: "TH",
        position: "initial",
        level: "isolation",
        words: [
          { text: "th", accepts: ["thh", "thhh"] },
          { text: "th", accepts: ["thh", "thhh"] },
          { text: "th", accepts: ["thh", "thhh"] },
        ],
      },
      {
        id: "th-syllables",
        title: "TH syllables",
        hint: "Add a vowel — thah, thee, thigh, thoe, thoo.",
        targetSound: "TH",
        position: "initial",
        level: "syllables",
        words: [
          { text: "thah", accepts: ["tha"] },
          { text: "thee", accepts: ["the"] },
          { text: "thigh", accepts: ["thi"] },
          { text: "thoe", accepts: ["tho", "though"] },
          { text: "thoo", accepts: ["thu"] },
        ],
      },
      {
        id: "th-initial",
        title: "TH at the start of words",
        hint: "Tongue peeks out between your teeth.",
        targetSound: "TH",
        position: "initial",
        level: "words",
        words: [
          { text: "thumb", emoji: "👍", accepts: ["thum"] },
          { text: "think", emoji: "🤔" },
          { text: "three", emoji: "3️⃣" },
          { text: "thirsty", emoji: "🥤" },
        ],
      },
      {
        id: "th-phrases",
        title: "TH in short phrases",
        hint: "Two TH words together!",
        targetSound: "TH",
        position: "initial",
        level: "phrases",
        words: [
          { text: "three thumbs" },
          { text: "think and thank" },
          { text: "thick and thin" },
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
        id: "ch-isolation",
        title: "Just the CH sound",
        hint: "Pop the train sound — ch! ch! ch!",
        targetSound: "CH",
        position: "initial",
        level: "isolation",
        words: [
          { text: "ch", accepts: ["chh", "tch"] },
          { text: "ch", accepts: ["chh", "tch"] },
          { text: "ch", accepts: ["chh", "tch"] },
        ],
      },
      {
        id: "ch-syllables",
        title: "CH syllables",
        hint: "Add a vowel — chah, chee, chy, cho, choo.",
        targetSound: "CH",
        position: "initial",
        level: "syllables",
        words: [
          { text: "chah", accepts: ["cha"] },
          { text: "chee", accepts: ["che"] },
          { text: "chy", accepts: ["chi", "chai"] },
          { text: "cho" },
          { text: "choo", accepts: ["chu", "chew"] },
        ],
      },
      {
        id: "ch-initial",
        title: "CH at the start of words",
        hint: "Like a train — choo choo!",
        targetSound: "CH",
        position: "initial",
        level: "words",
        words: [
          { text: "chair", emoji: "🪑" },
          { text: "cheese", emoji: "🧀" },
          { text: "cherry", emoji: "🍒" },
          { text: "chicken", emoji: "🐔" },
          { text: "chocolate", emoji: "🍫" },
        ],
      },
      {
        id: "ch-phrases",
        title: "CH in short phrases",
        hint: "Two CH words together!",
        targetSound: "CH",
        position: "initial",
        level: "phrases",
        words: [
          { text: "chocolate chip" },
          { text: "cheesy chips" },
          { text: "chase the chicken" },
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
        id: "k-isolation",
        title: "Just the K sound",
        hint: "From the back of your throat — k! k! k!",
        targetSound: "K",
        position: "initial",
        level: "isolation",
        words: [
          { text: "kuh", accepts: ["k", "cuh"] },
          { text: "kuh", accepts: ["k", "cuh"] },
          { text: "kuh", accepts: ["k", "cuh"] },
        ],
      },
      {
        id: "k-syllables",
        title: "K syllables",
        hint: "Add a vowel — kah, kee, kye, ko, koo.",
        targetSound: "K",
        position: "initial",
        level: "syllables",
        words: [
          { text: "kah", accepts: ["ka", "caw"] },
          { text: "kee", accepts: ["key"] },
          { text: "kye", accepts: ["ki"] },
          { text: "ko", accepts: ["coe"] },
          { text: "koo", accepts: ["coo", "ku"] },
        ],
      },
      {
        id: "k-initial",
        title: "K at the start of words",
        hint: "Sound from the back of the throat — k, k, k!",
        targetSound: "K",
        position: "initial",
        level: "words",
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
        title: "K at the end of words",
        hint: "Pop the K at the end — book!",
        targetSound: "K",
        position: "final",
        level: "words",
        words: [
          { text: "book", emoji: "📚" },
          { text: "duck", emoji: "🦆" },
          { text: "rock", emoji: "🪨" },
          { text: "sock", emoji: "🧦" },
        ],
      },
      {
        id: "k-phrases",
        title: "K in short phrases",
        hint: "Two K words together!",
        targetSound: "K",
        position: "initial",
        level: "phrases",
        words: [
          { text: "kick the can" },
          { text: "cool cookie" },
          { text: "cat in a coat" },
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
        id: "g-isolation",
        title: "Just the G sound",
        hint: "Back of your throat — g! g! g!",
        targetSound: "G",
        position: "initial",
        level: "isolation",
        words: [
          { text: "guh", accepts: ["g", "gah"] },
          { text: "guh", accepts: ["g", "gah"] },
          { text: "guh", accepts: ["g", "gah"] },
        ],
      },
      {
        id: "g-syllables",
        title: "G syllables",
        hint: "Add a vowel — gah, gee, guy, go, goo.",
        targetSound: "G",
        position: "initial",
        level: "syllables",
        words: [
          { text: "gah", accepts: ["ga"] },
          { text: "gee", accepts: ["ge"] },
          { text: "guy", accepts: ["gi"] },
          { text: "go" },
          { text: "goo", accepts: ["gu"] },
        ],
      },
      {
        id: "g-initial",
        title: "G at the start of words",
        hint: "From the back of your throat — g, g, g!",
        targetSound: "G",
        position: "initial",
        level: "words",
        words: [
          { text: "girl", emoji: "👧" },
          { text: "goat", emoji: "🐐" },
          { text: "goose", emoji: "🦢" },
          { text: "guitar", emoji: "🎸" },
          { text: "gum", emoji: "🍬" },
        ],
      },
      {
        id: "g-phrases",
        title: "G in short phrases",
        hint: "Two G words together!",
        targetSound: "G",
        position: "initial",
        level: "phrases",
        words: [
          { text: "go get gum" },
          { text: "good girl" },
          { text: "great goal" },
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
        id: "f-isolation",
        title: "Just the F sound",
        hint: "Top teeth on bottom lip — ffff!",
        targetSound: "F",
        position: "initial",
        level: "isolation",
        words: [
          { text: "fff", accepts: ["f", "ff"] },
          { text: "fff", accepts: ["f", "ff"] },
          { text: "fff", accepts: ["f", "ff"] },
        ],
      },
      {
        id: "f-syllables",
        title: "F syllables",
        hint: "Add a vowel — fah, fee, fye, fo, foo.",
        targetSound: "F",
        position: "initial",
        level: "syllables",
        words: [
          { text: "fah", accepts: ["fa"] },
          { text: "fee" },
          { text: "fye", accepts: ["fi", "fie"] },
          { text: "fo", accepts: ["foe"] },
          { text: "foo", accepts: ["fu"] },
        ],
      },
      {
        id: "f-initial",
        title: "F at the start of words",
        hint: "Top teeth on bottom lip — fffff!",
        targetSound: "F",
        position: "initial",
        level: "words",
        words: [
          { text: "fish", emoji: "🐟" },
          { text: "frog", emoji: "🐸" },
          { text: "foot", emoji: "🦶" },
          { text: "fork", emoji: "🍴" },
          { text: "fire", emoji: "🔥" },
        ],
      },
      {
        id: "f-phrases",
        title: "F in short phrases",
        hint: "Two F words together!",
        targetSound: "F",
        position: "initial",
        level: "phrases",
        words: [
          { text: "fish fingers" },
          { text: "fast fox" },
          { text: "five fingers" },
        ],
      },
    ],
  },

  {
    id: "z-sounds",
    sound: "Z",
    category: "single-sound",
    title: "Buzzy Z",
    subtitle: "the /z/ sound",
    color: "bg-sky-500",
    emoji: "🐝",
    lessons: [
      {
        id: "z-isolation",
        title: "Just the Z sound",
        hint: "Buzz like a bee — zzzz!",
        targetSound: "Z",
        position: "initial",
        level: "isolation",
        words: [
          { text: "zzz", accepts: ["z", "zz"] },
          { text: "zzz", accepts: ["z", "zz"] },
          { text: "zzz", accepts: ["z", "zz"] },
        ],
      },
      {
        id: "z-syllables",
        title: "Z syllables",
        hint: "Add a vowel — zah, zee, zy, zo, zoo.",
        targetSound: "Z",
        position: "initial",
        level: "syllables",
        words: [
          { text: "zah", accepts: ["za"] },
          { text: "zee", accepts: ["ze"] },
          { text: "zy", accepts: ["zi"] },
          { text: "zo", accepts: ["zoe"] },
          { text: "zoo", accepts: ["zu"] },
        ],
      },
      {
        id: "z-initial",
        title: "Z at the start of words",
        hint: "Turn your voice on and buzz — zzz!",
        targetSound: "Z",
        position: "initial",
        level: "words",
        words: [
          { text: "zebra", emoji: "🦓" },
          { text: "zero", emoji: "0️⃣" },
          { text: "zipper", emoji: "🤐", accepts: ["zip"] },
          { text: "zoom", emoji: "💨" },
        ],
      },
      {
        id: "z-final",
        title: "Z at the end of words",
        hint: "Keep the buzz going at the end — zzz!",
        targetSound: "Z",
        position: "final",
        level: "words",
        words: [
          { text: "buzz", emoji: "🐝" },
          { text: "fizz", emoji: "🥤" },
          { text: "jazz", emoji: "🎷" },
          { text: "quiz", emoji: "📝" },
        ],
      },
      {
        id: "z-phrases",
        title: "Z in short phrases",
        hint: "Two Z words together!",
        targetSound: "Z",
        position: "initial",
        level: "phrases",
        words: [
          { text: "buzzing bees" },
          { text: "lazy zebra" },
          { text: "zoom zoom" },
        ],
      },
    ],
  },
  {
    id: "v-sounds",
    sound: "V",
    category: "single-sound",
    title: "Vroom V",
    subtitle: "the /v/ sound",
    color: "bg-brand-500",
    emoji: "🚐",
    lessons: [
      {
        id: "v-isolation",
        title: "Just the V sound",
        hint: "Top teeth on your lip and buzz — vvvv!",
        targetSound: "V",
        position: "initial",
        level: "isolation",
        words: [
          { text: "vvv", accepts: ["v", "vv"] },
          { text: "vvv", accepts: ["v", "vv"] },
          { text: "vvv", accepts: ["v", "vv"] },
        ],
      },
      {
        id: "v-syllables",
        title: "V syllables",
        hint: "Add a vowel — vah, vee, vy, vo, voo.",
        targetSound: "V",
        position: "initial",
        level: "syllables",
        words: [
          { text: "vah", accepts: ["va"] },
          { text: "vee", accepts: ["ve"] },
          { text: "vy", accepts: ["vi"] },
          { text: "vo", accepts: ["voe"] },
          { text: "voo", accepts: ["vu"] },
        ],
      },
      {
        id: "v-initial",
        title: "V at the start of words",
        hint: "Top teeth on your lip — vvv!",
        targetSound: "V",
        position: "initial",
        level: "words",
        words: [
          { text: "van", emoji: "🚐" },
          { text: "violin", emoji: "🎻" },
          { text: "vest", emoji: "🦺" },
          { text: "volcano", emoji: "🌋" },
        ],
      },
      {
        id: "v-phrases",
        title: "V in short phrases",
        hint: "Two V words together!",
        targetSound: "V",
        position: "initial",
        level: "phrases",
        words: [
          { text: "very fast van" },
          { text: "five violins" },
          { text: "velvet vest" },
        ],
      },
    ],
  },
  {
    id: "j-sounds",
    sound: "J",
    category: "single-sound",
    title: "Jumpy J",
    subtitle: "the /j/ sound",
    color: "bg-grass-500",
    emoji: "🤸",
    lessons: [
      {
        id: "j-isolation",
        title: "Just the J sound",
        hint: "Squish D and SH together — j! j! j!",
        targetSound: "J",
        position: "initial",
        level: "isolation",
        words: [
          { text: "juh", accepts: ["j", "jah"] },
          { text: "juh", accepts: ["j", "jah"] },
          { text: "juh", accepts: ["j", "jah"] },
        ],
      },
      {
        id: "j-syllables",
        title: "J syllables",
        hint: "Add a vowel — jah, jee, jy, jo, joo.",
        targetSound: "J",
        position: "initial",
        level: "syllables",
        words: [
          { text: "jah", accepts: ["ja"] },
          { text: "jee", accepts: ["je", "gee"] },
          { text: "jy", accepts: ["ji"] },
          { text: "jo", accepts: ["joe"] },
          { text: "joo", accepts: ["ju", "jew"] },
        ],
      },
      {
        id: "j-initial",
        title: "J at the start of words",
        hint: "Turn your voice on — j, not ch!",
        targetSound: "J",
        position: "initial",
        level: "words",
        words: [
          { text: "jump", emoji: "🤸" },
          { text: "jet", emoji: "✈️" },
          { text: "juice", emoji: "🧃" },
          { text: "jar", emoji: "🫙" },
        ],
      },
      {
        id: "j-phrases",
        title: "J in short phrases",
        hint: "Two J words together!",
        targetSound: "J",
        position: "initial",
        level: "phrases",
        words: [
          { text: "jump up" },
          { text: "juice and jam" },
          { text: "jolly jet" },
        ],
      },
    ],
  },

  {
    id: "th-voiced-sounds",
    sound: "THV",
    category: "single-sound",
    title: "Voicey TH",
    subtitle: "the voiced /th/ — this, that, the",
    color: "bg-brand-500",
    emoji: "👅",
    lessons: [
      {
        id: "thv-isolation",
        title: "Just the voiced TH",
        hint: "Tongue between teeth and turn your voice on — thhh!",
        targetSound: "THV",
        position: "initial",
        level: "isolation",
        words: [
          { text: "thh", accepts: ["th", "thhh"] },
          { text: "thh", accepts: ["th", "thhh"] },
          { text: "thh", accepts: ["th", "thhh"] },
        ],
      },
      {
        id: "thv-syllables",
        title: "Voicey TH syllables",
        hint: "Buzz the TH into a vowel — thee, thoo, thah.",
        targetSound: "THV",
        position: "initial",
        level: "syllables",
        words: [
          { text: "thee", accepts: ["the"] },
          { text: "thoo", accepts: ["thu"] },
          { text: "thah", accepts: ["tha"] },
        ],
      },
      {
        id: "thv-initial",
        title: "Voicey TH at the start of words",
        hint: "Tongue peeks out — voice on!",
        targetSound: "THV",
        position: "initial",
        level: "words",
        words: [
          { text: "this", emoji: "👇", accepts: ["thiss"] },
          { text: "that", emoji: "👉" },
          { text: "the", emoji: "🅰️", accepts: ["thuh"] },
          { text: "they", emoji: "👫" },
          { text: "them", emoji: "👨‍👩‍👧" },
        ],
      },
      {
        id: "thv-phrases",
        title: "Voicey TH in short phrases",
        hint: "Two voiced TH words in a row!",
        targetSound: "THV",
        position: "initial",
        level: "phrases",
        words: [
          { text: "this and that" },
          { text: "the other day" },
          { text: "they are there" },
        ],
      },
    ],
  },

  // ───────────────────────── S-Blends ─────────────────────────
  // Cluster reduction work is inherently about combining two sounds — no
  // isolation/syllables level. Practice goes straight to words + phrases.
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
        level: "words",
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
        level: "words",
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
        level: "words",
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
        level: "words",
        blend: "sl",
        words: [
          { text: "slide", emoji: "🛝" },
          { text: "sleep", emoji: "😴" },
          { text: "slime", emoji: "🟢" },
          { text: "sloth", emoji: "🦥" },
        ],
      },
      {
        id: "sm-initial",
        title: "SM words",
        hint: "Both sounds — ssss + m!",
        targetSound: "S",
        position: "initial",
        level: "words",
        blend: "sm",
        words: [
          { text: "smile", emoji: "😊" },
          { text: "smell", emoji: "👃" },
          { text: "small", emoji: "🤏" },
          { text: "smoke", emoji: "💨" },
        ],
      },
      {
        id: "sn-initial",
        title: "SN words",
        hint: "Both sounds — ssss + n!",
        targetSound: "S",
        position: "initial",
        level: "words",
        blend: "sn",
        words: [
          { text: "snake", emoji: "🐍" },
          { text: "snail", emoji: "🐌" },
          { text: "snow", emoji: "❄️" },
          { text: "snack", emoji: "🍿" },
        ],
      },
      {
        id: "sw-initial",
        title: "SW words",
        hint: "Both sounds — ssss + w!",
        targetSound: "S",
        position: "initial",
        level: "words",
        blend: "sw",
        words: [
          { text: "swim", emoji: "🏊" },
          { text: "swing", emoji: "🛝" },
          { text: "sweet", emoji: "🍬" },
          { text: "swan", emoji: "🦢" },
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
        level: "words",
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
        level: "words",
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
        level: "words",
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
        level: "words",
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
        level: "words",
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
        level: "words",
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
        level: "words",
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
        level: "words",
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

  // ───────────────── Big blends (3-sound clusters) ─────────────────
  {
    id: "big-blends",
    sound: "R",
    category: "s-blend",
    title: "Big Blends",
    subtitle: "three sounds — str, spl, spr",
    color: "bg-sky-500",
    emoji: "💪",
    lessons: [
      {
        id: "str-initial",
        title: "STR words",
        hint: "Three sounds — s + t + r!",
        targetSound: "R",
        position: "initial",
        level: "words",
        blend: "str",
        words: [
          { text: "string", emoji: "🧵" },
          { text: "straw", emoji: "🥤" },
          { text: "strong", emoji: "💪" },
          { text: "street", emoji: "🛣️" },
        ],
      },
      {
        id: "spl-initial",
        title: "SPL words",
        hint: "Three sounds — s + p + l!",
        targetSound: "L",
        position: "initial",
        level: "words",
        blend: "spl",
        words: [
          { text: "splash", emoji: "💦" },
          { text: "split", emoji: "🍌" },
          { text: "splat", emoji: "🎨" },
        ],
      },
      {
        id: "spr-initial",
        title: "SPR words",
        hint: "Three sounds — s + p + r!",
        targetSound: "R",
        position: "initial",
        level: "words",
        blend: "spr",
        words: [
          { text: "spray", emoji: "💨" },
          { text: "spring", emoji: "🌱" },
          { text: "sprout", emoji: "🌱" },
        ],
      },
    ],
  },

  // ───────────────── Final sounds (final consonant deletion) ─────────────────
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
        level: "words",
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
        level: "words",
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
        level: "words",
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
        level: "words",
        words: [
          { text: "moon", emoji: "🌙" },
          { text: "rain", emoji: "🌧️" },
          { text: "sun", emoji: "☀️" },
          { text: "spoon", emoji: "🥄" },
        ],
      },
    ],
  },

  // ───────────────── Final clusters (two sounds at the end) ─────────────────
  // Different from initial blends — these target *end* clusters where the
  // child commonly reduces ("hand" → "han"). endBlend in the scorer enforces
  // both sounds are pronounced at the end.
  {
    id: "final-clusters",
    sound: "T",
    category: "final-cluster",
    title: "Finishing Clusters",
    subtitle: "two sounds at the end — st, nd, mp, nk",
    color: "bg-grass-500",
    emoji: "🏁",
    lessons: [
      {
        id: "fc-st",
        title: "-ST words",
        hint: "Don't drop the T — finish strong with ST!",
        targetSound: "T",
        position: "final",
        level: "words",
        endBlend: "st",
        words: [
          { text: "fast", emoji: "🏃" },
          { text: "nest", emoji: "🪺" },
          { text: "ghost", emoji: "👻" },
          { text: "list", emoji: "📋" },
        ],
      },
      {
        id: "fc-nd",
        title: "-ND words",
        hint: "Don't drop the D — finish with ND!",
        targetSound: "T",
        position: "final",
        level: "words",
        endBlend: "nd",
        words: [
          { text: "hand", emoji: "✋" },
          { text: "sand", emoji: "🏖️" },
          { text: "wind", emoji: "💨" },
          { text: "band", emoji: "🎸" },
        ],
      },
      {
        id: "fc-mp",
        title: "-MP words",
        hint: "Pop the P at the end — say MP!",
        targetSound: "P",
        position: "final",
        level: "words",
        endBlend: "mp",
        words: [
          { text: "jump", emoji: "🤸" },
          { text: "lamp", emoji: "💡" },
          { text: "stamp", emoji: "📮" },
          { text: "bump", emoji: "🥴" },
        ],
      },
      {
        id: "fc-nk",
        title: "-NK words",
        hint: "Don't drop the K — finish with NK!",
        targetSound: "K",
        position: "final",
        level: "words",
        endBlend: "nk",
        words: [
          { text: "bank", emoji: "🏦" },
          { text: "pink", emoji: "🩷" },
          { text: "drink", emoji: "🥤" },
          { text: "skunk", emoji: "🦨" },
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
  "final-cluster": {
    label: "Ending clusters",
    description: "Two-sound endings — -st, -nd, -mp, -nk (fast, hand, jump).",
    emoji: "🏁",
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
  {
    id: "z",
    label: "Z sound is tricky",
    example: "“sip” for “zip”",
    emoji: "🐝",
    focusSkillIds: ["z-sounds"],
  },
  {
    id: "v",
    label: "V sound is tricky",
    example: "“berry” for “very”",
    emoji: "🚐",
    focusSkillIds: ["v-sounds"],
  },
  {
    id: "j",
    label: "J sound is tricky",
    example: "“dump” for “jump”",
    emoji: "🤸",
    focusSkillIds: ["j-sounds"],
  },
  {
    id: "thv",
    label: "Voiced TH is tricky",
    example: "“dis” for “this”",
    emoji: "👅",
    focusSkillIds: ["th-voiced-sounds"],
  },
  {
    id: "final-clusters",
    label: "Drops end-of-word clusters",
    example: "“han” for “hand”",
    emoji: "🏁",
    focusSkillIds: ["final-clusters"],
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
    subtitle: "S, R, L, SH, CH, K, G, F, Z, V, J…",
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
      "z-sounds",
      "v-sounds",
      "j-sounds",
      "th-voiced-sounds",
    ],
  },
  {
    id: "s-blends",
    emoji: "🌟",
    title: "S-Blends",
    subtitle: "sp, st, sk, sl, sm, sn, sw",
    skillIds: ["s-blends", "big-blends"],
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
    id: "endings-clusters",
    emoji: "🏁",
    title: "End Clusters",
    subtitle: "-st, -nd, -mp, -nk",
    skillIds: ["final-clusters"],
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

/**
 * Developmental order (early-acquired → late-acquired) used to sequence a
 * child's plan so they start with achievable sounds. Lower = earlier. Roughly
 * follows typical English acquisition norms; ties keep their natural grouping.
 */
const DEV_RANK: Record<string, number> = {
  "k-sounds": 1,
  "g-sounds": 1,
  "f-sounds": 2,
  "final-sounds": 2,
  "s-sounds": 3,
  "l-sounds": 3,
  "z-sounds": 3,
  "sh-sounds": 4,
  "ch-sounds": 4,
  "v-sounds": 4,
  "j-sounds": 4,
  "s-blends": 5,
  "l-blends": 5,
  "r-sounds": 6,
  "th-sounds": 6,
  "th-voiced-sounds": 6,
  "r-blends": 7,
  "final-clusters": 7,
  "big-blends": 8,
};

export function skillDevRank(id: string): number {
  return DEV_RANK[id] ?? 99;
}

/** All skills, ordered easiest-first by developmental norm. */
export function skillsInDevOrder(): Skill[] {
  return [...SKILLS].sort((a, b) => skillDevRank(a.id) - skillDevRank(b.id));
}

export function skillsByCategory(category: SkillCategory): Skill[] {
  if (category === "fronting") {
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

/**
 * Stable ordered list of lessons across all skills, for unlock logic. Ordered
 * by developmental rank so the unlock ladder matches the easiest-first order
 * the home screen shows.
 */
export function allLessonsInOrder(): { skillId: string; lessonId: string }[] {
  const out: { skillId: string; lessonId: string }[] = [];
  for (const skill of skillsInDevOrder()) {
    for (const lesson of skill.lessons) {
      out.push({ skillId: skill.id, lessonId: lesson.id });
    }
  }
  return out;
}
