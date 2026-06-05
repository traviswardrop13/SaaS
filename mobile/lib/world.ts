/**
 * Leo's World — the reward space. Coins earned from practice unlock items that
 * get placed into a growing backyard scene, giving kids a reason to come back.
 *
 * Positions are percentages of the scene (center of each item). Emoji are
 * placeholders that will be swapped for illustrated assets as art lands.
 */
export type WorldItem = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  leftPct: number; // 0..100 (center x)
  topPct: number; // 0..100 (center y)
  size: number; // px
};

// Ordered roughly by price so there's always a next thing to save for.
export const WORLD_ITEMS: WorldItem[] = [
  { id: "flowers", name: "Flowers", emoji: "🌷", cost: 15, leftPct: 74, topPct: 84, size: 46 },
  { id: "butterfly", name: "Butterfly", emoji: "🦋", cost: 18, leftPct: 50, topPct: 42, size: 40 },
  { id: "tree", name: "Big Tree", emoji: "🌳", cost: 25, leftPct: 16, topPct: 50, size: 120 },
  { id: "kite", name: "Kite", emoji: "🪁", cost: 30, leftPct: 84, topPct: 20, size: 54 },
  { id: "balloons", name: "Balloons", emoji: "🎈", cost: 35, leftPct: 90, topPct: 52, size: 50 },
  { id: "sandbox", name: "Sandbox", emoji: "🏖️", cost: 45, leftPct: 32, topPct: 84, size: 64 },
  { id: "slide", name: "Slide", emoji: "🛝", cost: 55, leftPct: 62, topPct: 66, size: 92 },
  { id: "pond", name: "Pond", emoji: "⛲", cost: 65, leftPct: 17, topPct: 84, size: 66 },
  { id: "puppy", name: "Puppy", emoji: "🐶", cost: 80, leftPct: 44, topPct: 88, size: 52 },
  { id: "rainbow", name: "Rainbow", emoji: "🌈", cost: 120, leftPct: 50, topPct: 16, size: 150 },
];
