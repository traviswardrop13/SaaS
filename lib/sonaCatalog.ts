// SESSION GAMES (SLPPRO1, 17 Nov 2026). Travis, of the AI planner that told a
// clinician what to prepare: "what I need it to do is ... have it loaded into
// their app. Or just suggesting what game or activity to go and play inside
// of Sona speech", then "picks sona games but also give the slp the opp to
// suggest a new game or activity to be built inside the app".
//
// THE CATALOG the session-games AI may pick from, and the only things the
// dashboard's "Play now" can open: every game a child can open in Sona today,
// the talking story for a sound (where one exists) and that sound's
// bookshelf. The server cannot read public/sona.js, so this is a copy of its
// lists, held to them by tests/sessiongamestest.mjs: it fails on a key that is
// not in GAME_ACTS or STORY_TALK, on a parked (comingSoon) game, on a game
// whose page here is not GAME_ACTS's `go`, and on a playable game left out.
// A game that comes back from Coming soon is one line here.
//
// Each line says, in plain words for a clinician, what the child does and
// where their word comes in. Edge-safe: no Node modules.

export const SOUNDS = ["P", "B", "M", "N", "T", "D", "K", "G", "F", "V", "S", "Z", "SH", "CH", "J", "L", "R", "TH", "THV"] as const;
export const SOUND_LABEL: Record<string, string> = { THV: "TH (voiced, as in \"this\")", TH: "TH (as in \"thumb\")" };

/** Word positions, the homework composer's codes. */
export const POSITIONS = ["i", "m", "f", "v", "b", "mix"] as const;
export const POSITION_LABEL: Record<string, string> = {
  i: "the beginning of words", m: "the middle of words", f: "the end of words",
  v: "vocalic R", b: "blends", mix: "mixed positions",
};
/** The homework composer's rule: vocalic R only for R; blends only for R, S and L. */
export function positionFits(sound: string, pos: string): boolean {
  if ((POSITIONS as readonly string[]).indexOf(pos) < 0) return false;
  if (pos === "v") return sound === "R";
  if (pos === "b") return sound === "R" || sound === "S" || sound === "L";
  return true;
}
export const AGE_BANDS = ["3-4", "5-6", "7-8", "9+"] as const;
export const MINUTES = [20, 30, 45] as const;

export type CatalogItem = {
  key: string;
  kind: "game" | "story" | "books";
  name: string;
  ages: "3-4" | "5-8" | "all";
  does: string;
  go: string;
  pic: string;
  sound?: string;
};

const ROUND = "First the child says their sound 5 times on the practice page to start the game; mid-game Echo asks for the sound to slow it down, and saying it brings back a lost life.";
const SAY = "Each word, said two times, earns the next move; the child's finger makes the move.";

function game(key: string, name: string, card: string, ages: "3-4" | "5-8", go: string, does: string): CatalogItem {
  return { key, kind: "game", name, ages, does, go, pic: "/assets/crafted/home-" + card + ".webp" };
}

/** Every game a child can open today (GAME_ACTS without comingSoon), in Home's order. */
export const GAMES: CatalogItem[] = [
  game("slice", "Fruit Slice", "fruit", "5-8", "/charge.html?game=arcade-slice.html", "Swipe to slice flying fruit over three waves, then a giant watermelon. " + ROUND),
  game("tiles", "Piano Tiles", "piano", "5-8", "/charge.html?game=arcade-tiles.html", "Tap the falling tiles to play little songs. " + ROUND),
  game("stack", "Block Stacker", "stack", "5-8", "/charge.html?game=arcade-stack.html", "Time a tap to stack a tower three floors high. " + ROUND),
  game("run", "Sound Sprint", "run", "5-8", "/charge.html?game=arcade-run.html", "Switch lanes to dodge rocks and collect stars in a race. " + ROUND),
  game("glide", "Flappy Glide", "glide", "5-8", "/charge.html?game=arcade-glide.html", "Tap to float a balloon through gaps in the hedges. " + ROUND),
  game("feed", "Feed Echo", "feed", "3-4", "/arcade-feed.html", "Echo asks for a picture word; once the child says it, they tap that picture to feed him. No timer."),
  game("bubbles", "Bubble Pop", "bubbles", "3-4", "/arcade-bubbles.html", "Each word, said once, makes Echo blow bubbles to pop. Calm, no timer."),
  game("peekaboo", "Peekaboo", "peekaboo", "3-4", "/arcade-peekaboo.html", "The word hides a picture behind a door; the doors move, and the child taps the right one. " + SAY),
  game("balloon", "Balloon Party", "balloon", "3-4", "/arcade-balloon.html", "Pump up balloons and pull them into a party ring for a friend. " + SAY),
  game("flower", "Grow a Flower", "flower", "3-4", "/arcade-flower.html", "Water the glowing soil to grow a flower. " + SAY),
  game("rocket", "Rocket Blast", "rocket", "3-4", "/arcade-rocket.html", "Pull a rocket back and let go to land on planets, collecting new ones. " + SAY),
  game("snowman", "Build a Snowman", "snowman", "3-4", "/arcade-snowman.html", "Roll, stack and dress a snowman, a new look every round. " + SAY),
  game("train", "Choo-Choo Train", "train", "3-4", "/arcade-train.html", "Drive a train, stop at the station and help a friend aboard. " + SAY),
  game("stars", "Bedtime Stars", "stars", "3-4", "/arcade-stars.html", "Slide from star to star to draw a surprise picture in the sky. " + SAY),
  game("cake", "Birthday Cake", "cake", "3-4", "/arcade-cake.html", "Stir, pour, ice and decorate a birthday cake for a friend. " + SAY),
  game("racecar", "Race Car", "racecar", "5-8", "/arcade-racecar.html", "Steer around cones and into the glowing ring. " + SAY),
  game("treasure", "Treasure Map", "treasure", "5-8", "/arcade-treasure.html", "Draw a boat's route around islands to the next harbour, then the treasure. " + SAY),
  game("soccer", "Soccer Goal", "soccer", "5-8", "/arcade-soccer.html", "Swipe to kick the ball past a goalie. " + SAY),
  game("hoops", "Hoops", "hoops", "5-8", "/arcade-hoops.html", "Swipe up to shoot a ball into a sliding hoop. " + SAY),
  game("robot", "Robot Builder", "robot", "5-8", "/arcade-robot.html", "Turn wires to power each part of a robot, a new puzzle every circuit. " + SAY),
  game("castle", "Castle Builder", "castle", "5-8", "/arcade-castle.html", "Slide a crane over the glow and lower castle pieces in. " + SAY),
  game("dino", "Dino Dig", "dino", "5-8", "/arcade-dino.html", "Rub away the sand to dig up dinosaur bones. " + SAY),
  game("space", "Space Trip", "space", "5-8", "/arcade-space.html", "Fly a rocket and land softly on eight planets. " + SAY),
  game("pizza", "Pizza Chef", "pizza", "5-8", "/arcade-pizza.html", "Roll, spread, top, bake and slice a pizza; the last word is a silly topping. " + SAY),
  game("rise", "Rise Up", "rise", "5-8", "/charge.html?game=arcade-rise.html", "Drag a shield to keep a rising balloon safe from falling blocks. " + ROUND),
];

/** The talking stories (STORY_TALK in sona.js): one a sound, every page asks a word in it. */
export const TALKING_STORIES: { id: string; sound: string; name: string }[] = [
  { id: "robo", sound: "R", name: "Robo's Rocket" },
  { id: "lulu", sound: "L", name: "Lulu's Lantern Party" },
  { id: "fizz", sound: "F", name: "Fizz and the Sleepy Fireflies" },
  { id: "sandy", sound: "S", name: "Sandy's Sandcastle" },
  { id: "zippy", sound: "Z", name: "Zippy's Zoo Parade" },
  { id: "kiki", sound: "K", name: "Kiki's Camping Night" },
  { id: "gus", sound: "G", name: "Gus's Goose Chase" },
  { id: "shelly", sound: "SH", name: "Shelly's Shell Show" },
  { id: "chip", sound: "CH", name: "Chip's Cherry Pie" },
  { id: "theo", sound: "TH", name: "Theo's Big Show" },
];

export function soundOk(sound: unknown): sound is string {
  return typeof sound === "string" && (SOUNDS as readonly string[]).indexOf(sound) >= 0;
}

/** What may be picked, or played, for this sound: every game, its talking story, its bookshelf. */
export function catalogFor(sound: string): CatalogItem[] {
  if (!soundOk(sound)) return [];
  const out = GAMES.slice();
  const story = TALKING_STORIES.find((t) => t.sound === sound);
  if (story) {
    out.push({
      key: story.id, kind: "story", name: story.name, ages: "all", sound,
      does: "A talking story read aloud by Echo: every page asks one word in this sound, said three times, and the child's voice turns the page.",
      go: "/adventure.html?again=1&story=" + story.id, pic: "/assets/crafted/home-" + story.id + ".webp",
    });
  }
  out.push({
    key: "books", kind: "books", name: "Books for " + (SOUND_LABEL[sound] || sound), ages: "all", sound,
    does: "Sona's picture books for this sound. Echo reads each page, then asks the child to say one key word to turn it.",
    go: "/library.html", pic: "/assets/crafted/home-books.webp",
  });
  return out;
}

export function catalogItem(key: unknown, sound: string): CatalogItem | null {
  if (typeof key !== "string") return null;
  return catalogFor(sound).find((c) => c.key === key) || null;
}
