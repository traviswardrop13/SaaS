/**
 * Game data for mini-games (PictureMatch, FillTheBlank, SoundSorter).
 *
 * Each sound has sets of items for each game type. The lesson system
 * picks a random game for variety so kids don't get bored doing the
 * same listen → say → score loop every time.
 */

import type { PictureOption } from "@/components/games/PictureMatch";
import type { BlankItem } from "@/components/games/FillTheBlank";
import type { SortWord } from "@/components/games/SoundSorter";
import type { TargetSound } from "@/lib/scoring";

// ═══════════════════════════════════════════════════════════════════
// Picture Match sets — 4 options each, exactly 1 correct
// ═══════════════════════════════════════════════════════════════════

export const PICTURE_MATCH: Partial<Record<TargetSound, PictureOption[][]>> = {
  S: [
    [
      { text: "Sun", emoji: "☀️", hasTarget: true },
      { text: "Dog", emoji: "🐕", hasTarget: false },
      { text: "Ball", emoji: "⚽", hasTarget: false },
      { text: "Tree", emoji: "🌳", hasTarget: false },
    ],
    [
      { text: "Cat", emoji: "🐱", hasTarget: false },
      { text: "Star", emoji: "⭐", hasTarget: true },
      { text: "Bed", emoji: "🛏️", hasTarget: false },
      { text: "Hat", emoji: "🎩", hasTarget: false },
    ],
    [
      { text: "Cake", emoji: "🎂", hasTarget: false },
      { text: "Book", emoji: "📕", hasTarget: false },
      { text: "Sock", emoji: "🧦", hasTarget: true },
      { text: "Frog", emoji: "🐸", hasTarget: false },
    ],
  ],
  R: [
    [
      { text: "Rain", emoji: "🌧️", hasTarget: true },
      { text: "Cup", emoji: "☕", hasTarget: false },
      { text: "Fan", emoji: "🪭", hasTarget: false },
      { text: "Pen", emoji: "🖊️", hasTarget: false },
    ],
    [
      { text: "Lamp", emoji: "💡", hasTarget: false },
      { text: "Robot", emoji: "🤖", hasTarget: true },
      { text: "Egg", emoji: "🥚", hasTarget: false },
      { text: "Bus", emoji: "🚌", hasTarget: false },
    ],
    [
      { text: "Kite", emoji: "🪁", hasTarget: false },
      { text: "Bell", emoji: "🔔", hasTarget: false },
      { text: "Door", emoji: "🚪", hasTarget: false },
      { text: "Ring", emoji: "💍", hasTarget: true },
    ],
  ],
  L: [
    [
      { text: "Lion", emoji: "🦁", hasTarget: true },
      { text: "Moon", emoji: "🌙", hasTarget: false },
      { text: "Car", emoji: "🚗", hasTarget: false },
      { text: "Shoe", emoji: "👟", hasTarget: false },
    ],
    [
      { text: "Bug", emoji: "🐛", hasTarget: false },
      { text: "Leaf", emoji: "🍃", hasTarget: true },
      { text: "Fish", emoji: "🐟", hasTarget: false },
      { text: "Key", emoji: "🔑", hasTarget: false },
    ],
  ],
  K: [
    [
      { text: "King", emoji: "🤴", hasTarget: true },
      { text: "Pig", emoji: "🐷", hasTarget: false },
      { text: "Bee", emoji: "🐝", hasTarget: false },
      { text: "Jet", emoji: "✈️", hasTarget: false },
    ],
    [
      { text: "Ship", emoji: "🚢", hasTarget: false },
      { text: "Cow", emoji: "🐄", hasTarget: true },
      { text: "Net", emoji: "🥅", hasTarget: false },
      { text: "Bag", emoji: "👜", hasTarget: false },
    ],
  ],
  SH: [
    [
      { text: "Ship", emoji: "🚢", hasTarget: true },
      { text: "Frog", emoji: "🐸", hasTarget: false },
      { text: "Milk", emoji: "🥛", hasTarget: false },
      { text: "Drum", emoji: "🥁", hasTarget: false },
    ],
    [
      { text: "Tent", emoji: "⛺", hasTarget: false },
      { text: "Shell", emoji: "🐚", hasTarget: true },
      { text: "Nest", emoji: "🪺", hasTarget: false },
      { text: "Kite", emoji: "🪁", hasTarget: false },
    ],
  ],
  CH: [
    [
      { text: "Cheese", emoji: "🧀", hasTarget: true },
      { text: "Sock", emoji: "🧦", hasTarget: false },
      { text: "Mouse", emoji: "🐭", hasTarget: false },
      { text: "Drum", emoji: "🥁", hasTarget: false },
    ],
  ],
  TH: [
    [
      { text: "Thumb", emoji: "👍", hasTarget: true },
      { text: "Lamp", emoji: "💡", hasTarget: false },
      { text: "Gem", emoji: "💎", hasTarget: false },
      { text: "Wig", emoji: "💇", hasTarget: false },
    ],
  ],
  G: [
    [
      { text: "Goat", emoji: "🐐", hasTarget: true },
      { text: "Nut", emoji: "🥜", hasTarget: false },
      { text: "Pen", emoji: "🖊️", hasTarget: false },
      { text: "Map", emoji: "🗺️", hasTarget: false },
    ],
  ],
  F: [
    [
      { text: "Fish", emoji: "🐟", hasTarget: true },
      { text: "Drum", emoji: "🥁", hasTarget: false },
      { text: "Cake", emoji: "🎂", hasTarget: false },
      { text: "Pig", emoji: "🐷", hasTarget: false },
    ],
  ],
};

// ═══════════════════════════════════════════════════════════════════
// Fill-the-blank sentences — carrier phrases with missing word
// ═══════════════════════════════════════════════════════════════════

export const FILL_BLANKS: Partial<Record<TargetSound, BlankItem[]>> = {
  S: [
    { sentence: "The ___ is shining.", answer: "sun", emoji: "☀️" },
    { sentence: "I wear a ___ on my foot.", answer: "sock", emoji: "🧦" },
    { sentence: "Look at the pretty ___!", answer: "star", emoji: "⭐" },
    { sentence: "The ___ can slither.", answer: "snake", emoji: "🐍" },
    { sentence: "I ate my ___ at lunch.", answer: "soup", emoji: "🍜" },
    { sentence: "I can ___ very fast!", answer: "swim", emoji: "🏊" },
  ],
  R: [
    { sentence: "It's starting to ___.", answer: "rain", emoji: "🌧️" },
    { sentence: "The ___ is so pretty!", answer: "rainbow", emoji: "🌈" },
    { sentence: "The ___ is hopping.", answer: "rabbit", emoji: "🐰" },
    { sentence: "I can ___ really fast!", answer: "run", emoji: "🏃" },
    { sentence: "The ___ is red.", answer: "rose", emoji: "🌹" },
  ],
  L: [
    { sentence: "The ___ is roaring!", answer: "lion", emoji: "🦁" },
    { sentence: "Turn on the ___.", answer: "light", emoji: "💡" },
    { sentence: "I love to eat ___.", answer: "lollipops", emoji: "🍭" },
    { sentence: "The ___ fell from the tree.", answer: "leaf", emoji: "🍃" },
  ],
  K: [
    { sentence: "The ___ is purring.", answer: "cat", emoji: "🐱", accepts: ["cat", "kitty", "kitten"] },
    { sentence: "I ate a big ___.", answer: "cake", emoji: "🎂" },
    { sentence: "Let's fly a ___!", answer: "kite", emoji: "🪁" },
    { sentence: "The ___ wears a crown.", answer: "king", emoji: "🤴" },
  ],
  SH: [
    { sentence: "The ___ sails on the sea.", answer: "ship", emoji: "🚢" },
    { sentence: "Put on your ___.", answer: "shoes", emoji: "👟" },
    { sentence: "I found a ___ on the beach.", answer: "shell", emoji: "🐚" },
  ],
  CH: [
    { sentence: "I love ___ on my pizza.", answer: "cheese", emoji: "🧀" },
    { sentence: "Sit on the ___.", answer: "chair", emoji: "🪑" },
    { sentence: "The baby ___ is hatching.", answer: "chick", emoji: "🐣" },
  ],
  TH: [
    { sentence: "Give me a ___ up!", answer: "thumbs", emoji: "👍" },
    { sentence: "I need to ___ about it.", answer: "think", emoji: "🤔" },
    { sentence: "___ you very much!", answer: "thank", emoji: "🙏" },
  ],
  G: [
    { sentence: "The ___ says baa!", answer: "goat", emoji: "🐐" },
    { sentence: "Let's play a ___.", answer: "game", emoji: "🎮" },
    { sentence: "I see a ___ in the garden.", answer: "grasshopper", emoji: "🦗", accepts: ["grasshopper", "bug"] },
  ],
  F: [
    { sentence: "The ___ swims in water.", answer: "fish", emoji: "🐟" },
    { sentence: "I picked a ___ for you.", answer: "flower", emoji: "🌸" },
    { sentence: "The ___ can fly.", answer: "flamingo", emoji: "🦩" },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// Sound Sorter word lists — mix of target & non-target words
// ═══════════════════════════════════════════════════════════════════

export const SORT_WORDS: Partial<Record<TargetSound, SortWord[]>> = {
  S: [
    { text: "Sun", emoji: "☀️", hasTarget: true },
    { text: "Dog", emoji: "🐕", hasTarget: false },
    { text: "Sock", emoji: "🧦", hasTarget: true },
    { text: "Ball", emoji: "⚽", hasTarget: false },
    { text: "Star", emoji: "⭐", hasTarget: true },
    { text: "Pig", emoji: "🐷", hasTarget: false },
    { text: "Bus", emoji: "🚌", hasTarget: true },
    { text: "Hat", emoji: "🎩", hasTarget: false },
  ],
  R: [
    { text: "Rain", emoji: "🌧️", hasTarget: true },
    { text: "Cup", emoji: "☕", hasTarget: false },
    { text: "Ring", emoji: "💍", hasTarget: true },
    { text: "Pen", emoji: "🖊️", hasTarget: false },
    { text: "Rock", emoji: "🪨", hasTarget: true },
    { text: "Bed", emoji: "🛏️", hasTarget: false },
    { text: "Door", emoji: "🚪", hasTarget: true },
    { text: "Kite", emoji: "🪁", hasTarget: false },
  ],
  L: [
    { text: "Lion", emoji: "🦁", hasTarget: true },
    { text: "Moon", emoji: "🌙", hasTarget: false },
    { text: "Leaf", emoji: "🍃", hasTarget: true },
    { text: "Fish", emoji: "🐟", hasTarget: false },
    { text: "Lamp", emoji: "💡", hasTarget: true },
    { text: "Egg", emoji: "🥚", hasTarget: false },
    { text: "Ball", emoji: "⚽", hasTarget: true },
    { text: "Sun", emoji: "☀️", hasTarget: false },
  ],
  K: [
    { text: "Cat", emoji: "🐱", hasTarget: true },
    { text: "Pig", emoji: "🐷", hasTarget: false },
    { text: "King", emoji: "🤴", hasTarget: true },
    { text: "Bee", emoji: "🐝", hasTarget: false },
    { text: "Cake", emoji: "🎂", hasTarget: true },
    { text: "Net", emoji: "🥅", hasTarget: false },
  ],
  SH: [
    { text: "Ship", emoji: "🚢", hasTarget: true },
    { text: "Frog", emoji: "🐸", hasTarget: false },
    { text: "Shell", emoji: "🐚", hasTarget: true },
    { text: "Drum", emoji: "🥁", hasTarget: false },
    { text: "Shoe", emoji: "👟", hasTarget: true },
    { text: "Cake", emoji: "🎂", hasTarget: false },
  ],
  CH: [
    { text: "Cheese", emoji: "🧀", hasTarget: true },
    { text: "Sock", emoji: "🧦", hasTarget: false },
    { text: "Chair", emoji: "🪑", hasTarget: true },
    { text: "Mouse", emoji: "🐭", hasTarget: false },
    { text: "Chick", emoji: "🐣", hasTarget: true },
    { text: "Lamp", emoji: "💡", hasTarget: false },
  ],
  TH: [
    { text: "Thumb", emoji: "👍", hasTarget: true },
    { text: "Lamp", emoji: "💡", hasTarget: false },
    { text: "Tooth", emoji: "🦷", hasTarget: true },
    { text: "Cup", emoji: "☕", hasTarget: false },
    { text: "Three", emoji: "3️⃣", hasTarget: true },
    { text: "Dog", emoji: "🐕", hasTarget: false },
  ],
  G: [
    { text: "Goat", emoji: "🐐", hasTarget: true },
    { text: "Nut", emoji: "🥜", hasTarget: false },
    { text: "Game", emoji: "🎮", hasTarget: true },
    { text: "Pen", emoji: "🖊️", hasTarget: false },
    { text: "Bug", emoji: "🐛", hasTarget: true },
    { text: "Hat", emoji: "🎩", hasTarget: false },
  ],
  F: [
    { text: "Fish", emoji: "🐟", hasTarget: true },
    { text: "Drum", emoji: "🥁", hasTarget: false },
    { text: "Flower", emoji: "🌸", hasTarget: true },
    { text: "Pig", emoji: "🐷", hasTarget: false },
    { text: "Leaf", emoji: "🍃", hasTarget: true },
    { text: "Moon", emoji: "🌙", hasTarget: false },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// Utility: pick a random game type for variety
// ═══════════════════════════════════════════════════════════════════

export type GameType = "speak" | "pictureMatch" | "fillBlank" | "soundSort";

/**
 * Given a target sound and lesson level, pick a game type. Higher levels
 * lean toward speaking; lower levels mix in identification games.
 *
 * Returns "speak" if no game data exists for this sound.
 */
export function pickGameType(
  sound: TargetSound,
  level: string,
  /** Force a specific game for testing */
  force?: GameType,
): GameType {
  if (force) return force;

  // Isolation level — always speak (it's the core articulation practice)
  if (level === "isolation") return "speak";

  // Build list of available games for this sound
  const available: GameType[] = ["speak"];
  if (PICTURE_MATCH[sound]?.length) available.push("pictureMatch");
  if (FILL_BLANKS[sound]?.length) available.push("fillBlank");
  if (SORT_WORDS[sound]?.length) available.push("soundSort");

  // At word level, occasionally mix in identification games (30% chance)
  if (level === "word" && available.length > 1) {
    if (Math.random() < 0.3) {
      const nonSpeak = available.filter((g) => g !== "speak");
      return nonSpeak[Math.floor(Math.random() * nonSpeak.length)];
    }
  }

  // At phrase/sentence level, higher chance of fill-the-blank (40%)
  if ((level === "phrase" || level === "sentence") && FILL_BLANKS[sound]?.length) {
    if (Math.random() < 0.4) return "fillBlank";
  }

  return "speak";
}

/** Pick a random set of picture match options for a sound. */
export function getRandomPictureSet(sound: TargetSound): PictureOption[] | null {
  const sets = PICTURE_MATCH[sound];
  if (!sets?.length) return null;
  return sets[Math.floor(Math.random() * sets.length)];
}

/** Pick a random fill-the-blank item for a sound. */
export function getRandomBlankItem(sound: TargetSound): BlankItem | null {
  const items = FILL_BLANKS[sound];
  if (!items?.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

/** Get shuffled sort words for a sound (pick 6). */
export function getSortWords(sound: TargetSound, count = 6): SortWord[] {
  const all = SORT_WORDS[sound];
  if (!all?.length) return [];
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
