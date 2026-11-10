/**
 * GUIDES FOR PARENTS (Travis, 28 Oct 2026: "go build the pages", after the
 * search plan: pages that answer what a parent types into Google or asks
 * ChatGPT, like "how to practice the R sound at home").
 *
 * One list, read by the pages (app/guides), the sitemap and llms.txt, so a
 * guide can never be in one and not the others.
 *
 * RACHEL'S BEFORE IT SHIPS (CLAUDE.md: a page that explains how to practice
 * a sound is hers to review). Each guide carries `reviewed`: null until she
 * has read it, then the day she did. Until then, on speaksona.com the page
 * answers 404 and is in no sitemap, no llms.txt and no list of links; on a
 * preview deploy or a laptop it shows, marked noindex, so she can read it
 * there. Setting the date is what publishes it, and only then does the page
 * say "Reviewed by Rachel".
 *
 * What the words may say: what is true of the app (no "pronunciation
 * feedback": Sona hears that a child said a sound of the right kind, never
 * whether a word was right); the ages are SOUND_NORM's (sona.js), the
 * practice words are Sona's own start-of-word words, and the mix-ups are
 * HEAR_SUBS's, so a page never teaches something the app would not.
 * `guidestest` holds all three. No dollar figure, no count of games or books,
 * no testimonial, nothing about the clinician side (speaksona.com is for
 * parents), and no "SLP": a parent reads "speech-language pathologist".
 */

export type SoundKey = "R" | "S" | "Z" | "L" | "TH" | "THV" | "K" | "G" | "F" | "V" | "SH" | "CH" | "J";

export type Sound = {
  key: SoundKey;
  /** How the page writes it: "R", "TH (as in thumb)". */
  name: string;
  /** The age many children have it by: SOUND_NORM in sona.js, held equal. */
  age: number;
  /** How it is made, in a parent's words. Rachel's to check. */
  made: string;
  /** Typical mix-ups a parent will hear (HEAR_SUBS in sona.js). */
  swaps: string[];
  /** The sound on its own, as a parent would say it, and a way to play it. */
  alone: string;
  play: string;
  /** The sound with a vowel: the step between the sound alone and words. */
  syllables: string[];
  /** Words that start with the sound: Sona's own start-of-word bank. */
  words: string[];
  /** A short, real sentence with one of those words (never "a" glued on). */
  sentence: string;
};

export type Faq = { q: string; a: string };
export type Section = { h: string; paras?: string[]; bullets?: string[]; steps?: string[] };
export type App = {
  name: string;
  maker: string;
  ours?: boolean;
  bestFor: string;
  how: string;
  where: string;
  note: string;
};

export type Guide = {
  slug: string;
  kind: "hub" | "sound" | "apps";
  /** <title>, under ~60 characters with " — Sona". */
  title: string;
  h1: string;
  /** The meta description: what a search result shows under the title. */
  description: string;
  /** The short answer, first on the page: what an AI assistant quotes. */
  answer: string;
  /** Null until Rachel has read the page; then the day she did (YYYY-MM-DD). */
  reviewed: string | null;
  sounds?: Sound[];
  /** Why this sound is hard (a sound guide). */
  why?: string;
  /** Who wrote a list of apps, and how (an apps guide): said before the list. */
  disclosure?: string;
  sections?: Section[];
  apps?: App[];
  faq: Faq[];
  /** Other guides to suggest at the foot of the page, by slug. */
  related: string[];
};

export const SITE = "https://www.speaksona.com";
export const APP_STORE = "https://apps.apple.com/us/app/sona-speech/id6785755867";
/** Rachel's line, word for word (CLAUDE.md, 1 Oct 2026). */
export const RACHEL_LINE = "Built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship.";
export const RACHEL_REVIEW = "Reviewed by Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship";

const SOUNDS: Record<SoundKey, Sound> = {
  R: {
    key: "R", alone: "rrrr", play: "a growling tiger", name: "R", age: 7,
    made: "The tongue pulls back and up, and its sides press against the top back teeth. The tip doesn’t touch the roof of the mouth, and the lips stay relaxed: round, pushed-out lips turn R into W. Every child’s R looks a little different inside the mouth, so there is no one tongue shape you need to teach at home.",
    swaps: ["“wabbit” for rabbit", "“wed” for red", "“cah” for car, at the end of a word"],
    syllables: ["ree", "rah", "roh"],
    words: ["rabbit", "rocket", "ring", "rain", "robot", "rose", "rock"],
    sentence: "The rabbit is hopping.",
  },
  S: {
    key: "S", alone: "sssss", play: "a snake", name: "S", age: 5,
    made: "Teeth close together, like a smile. The tip of the tongue stays behind the teeth, not between them. Then blow a thin stream of air out the front: sssss, like a snake.",
    swaps: ["“thun” for sun (a lisp)", "“tock” for sock", "“shoap” for soap"],
    syllables: ["see", "sah", "soh"],
    words: ["sun", "soap", "sock", "soup", "seal", "sand", "sandwich"],
    sentence: "The sun is hot.",
  },
  Z: {
    key: "Z", alone: "zzzzz", play: "a buzzing bee", name: "Z", age: 6,
    made: "The same as S, with the voice turned on: zzzzz, like a buzzing bee.",
    swaps: ["“thoo” for zoo", "“doo” for zoo"],
    syllables: ["zee", "zah", "zoh"],
    words: ["zebra", "zoo", "zipper", "zero"],
    sentence: "We went to the zoo.",
  },
  L: {
    key: "L", alone: "lllll", play: "singing", name: "L", age: 6,
    made: "Open the mouth a little and lift the tip of the tongue to the bump just behind the top front teeth. Keep it there and let the voice come out around it: lllll. Singing “la la la” is an easy way in.",
    swaps: ["“wion” or “yion” for lion", "“weaf” for leaf"],
    syllables: ["lah", "lee", "loh"],
    words: ["lion", "leaf", "lemon", "ladder", "lamp", "lollipop", "lock"],
    sentence: "The lion is sleeping.",
  },
  TH: {
    key: "TH", alone: "th", play: "letting air out of a tire", name: "TH (as in thumb)", age: 6,
    made: "Let the tip of the tongue peek out just a little between the top and bottom teeth, and blow air over it: th, as in thumb. This is the one sound where sticking out your tongue is the right answer.",
    swaps: ["“fumb” for thumb", "“tink” for think"],
    syllables: ["thah", "thoh", "thoo"],
    words: ["thumb", "think", "thirty", "thorn"],
    sentence: "Show me your thumb.",
  },
  THV: {
    key: "THV", alone: "th", play: "", name: "TH (as in this)", age: 7,
    made: "The same tongue as the TH in thumb, with the voice turned on: the TH in “this” and “that” buzzes.",
    swaps: ["“dis” for this", "“dat” for that"],
    syllables: [],
    words: [],
    sentence: "",
  },
  K: {
    key: "K", alone: "k, k, k", play: "a tiny cough", name: "K", age: 4,
    made: "K happens at the back of the mouth. The back of the tongue lifts to touch the soft part of the roof, way in the back, then lets go: k, like a tiny cough. Keeping the tip of the tongue down, behind the bottom teeth, helps.",
    swaps: ["“tat” for cat", "“tey” for key"],
    syllables: ["kah", "kee", "koh"],
    words: ["cat", "key", "cake", "kite", "king", "cow", "cookie"],
    sentence: "The cat is sleeping.",
  },
  G: {
    key: "G", alone: "g, g, g", play: "a gulp", name: "G", age: 4,
    made: "The same place as K, with the voice turned on: g, like a gulp.",
    swaps: ["“doat” for goat", "“dame” for game"],
    syllables: ["gah", "goh", "goo"],
    words: ["goat", "girl", "gift", "game", "goose", "gate"],
    sentence: "The goat is eating.",
  },
  F: {
    key: "F", alone: "fffff", play: "blowing out a candle slowly", name: "F", age: 4,
    made: "Rest the top teeth gently on the bottom lip and blow: fffff. It should tickle the lip a little.",
    swaps: ["“pish” for fish", "“bork” for fork"],
    syllables: ["fah", "fee", "foh"],
    words: ["fish", "fox", "fan", "fire", "foot", "fork", "farm"],
    sentence: "The fish can swim.",
  },
  V: {
    key: "V", alone: "vvvvv", play: "a buzzing lip", name: "V", age: 6,
    made: "The same as F, with the voice turned on: vvvvv. The lip buzzes.",
    swaps: ["“ban” for van", "“fest” for vest"],
    syllables: ["vah", "vee", "voh"],
    words: ["van", "violin", "vase", "vest", "volcano"],
    sentence: "The van is red.",
  },
  SH: {
    key: "SH", alone: "shhhh", play: "hushing a sleeping baby", name: "SH", age: 6,
    made: "Round the lips and push them forward a little, keep the teeth close together, and blow a big, soft stream of air: shhhh, like asking a baby to be quiet.",
    swaps: ["“sip” for ship", "“sell” for shell"],
    syllables: ["shah", "shee", "shoh"],
    words: ["shoe", "ship", "shark", "sheep", "shell", "shirt"],
    sentence: "Where is my shoe?",
  },
  CH: {
    key: "CH", alone: "ch, ch, ch", play: "a train: ch-ch-ch", name: "CH", age: 6,
    made: "CH starts like T, with the tip of the tongue up behind the top teeth, then lets out a quick puff of SH: ch, like the end of a sneeze, ah-choo!",
    swaps: ["“sheese” for cheese", "“tair” for chair"],
    syllables: ["chah", "chee", "choh"],
    words: ["cheese", "chair", "cherry", "chicken", "chips"],
    sentence: "I like cheese.",
  },
  J: {
    key: "J", alone: "j, j, j", play: "a bouncing ball", name: "J", age: 6,
    made: "The same as CH, with the voice turned on: j, as in jam.",
    swaps: ["“dam” for jam", "“zuice” for juice"],
    syllables: ["jah", "jee", "joh"],
    words: ["jam", "juice", "jet", "jar", "jacket"],
    sentence: "I like jam.",
  },
};

/** What every guide ends with: when to ask someone who can actually check. */
export const ASK_SLP: string[] = [
  "people outside the family often can’t understand your child,",
  "your child gets upset about talking, or avoids it,",
  "or you’re simply worried. That is reason enough.",
];
export const FIND_SLP = "In the US, you can find a speech-language pathologist (often called a speech therapist) through ASHA’s ProFind, or ask your pediatrician. From age 3, your local public school district can also check a child’s speech for free.";
export const PROFIND = "https://www.asha.org/profind/";

/** The everyday routine every sound guide shares, with that sound's own examples. */
export function routine(s: Sound): string[] {
  return [
    `The sound on its own, a few times: ${s.alone}. Make it a game, like ${s.play}: a whisper, then a big one.`,
    `The sound with a vowel: ${s.syllables.join(", ")}.`,
    `Words that start with the sound: ${s.words.slice(0, 3).join(", ")}.`,
    `A short sentence with one of those words in it: “${s.sentence}”`,
    "End on a win. Finish with one your child can do, and stop while it’s still fun.",
  ];
}

export const GAMES: string[] = [
  "Treasure hunt: hide pictures of the practice words around the room. Your child says each word when they find it.",
  "Feed the puppet: a sock puppet only eats a picture once your child says its word.",
  "Stairs: one word on every step, up or down.",
  "Car rides: “I spy something that starts with …” using your child’s sound.",
  "Swap turns: you say a word, then your child does. Mix in a silly mistake for them to catch.",
];

export const RECAST = [
  "Don’t correct. Say it back the right way.",
  "If your child says “Look, a wabbit!”, skip “No, say rabbit.” Instead, say: “Yes! A rabbit! The rabbit is hopping!”",
  "They hear the sound the right way, and they don’t feel like they made a mistake. Do it a few times a day, and it adds up.",
];

/** The ages Sona uses for every sound, grouped: the hub's table. */
export const AGES: { age: number; sounds: string }[] = [
  { age: 3, sounds: "P, B, M" },
  { age: 4, sounds: "N, T, D, K, G, F" },
  { age: 5, sounds: "S" },
  { age: 6, sounds: "V, Z, SH, CH, J, L, TH (as in thumb)" },
  { age: 7, sounds: "R, TH (as in this)" },
];

const SONA_APP: App = {
  name: "Sona", maker: "Sona (that’s us)", ours: true,
  bestFor: "Kids about 3 to 8 who talk but are hard to understand, and are working on speech sounds like R, S, L or TH.",
  how: "Echo, a friendly bird, says a word that starts with your child’s sound. Your child says it back, and the game moves on. There are games and picture books, and practice takes a few minutes a day.",
  where: "iPhone and iPad. On an Android phone it works in the web browser.",
  note: "Every try is checked on the phone, and no audio ever leaves it. A try counts only when the phone hears your child’s voice: a quick check that keeps practice honest, not a test. " + RACHEL_LINE,
};
const HIVE: App = {
  name: "Articulation Station Hive", maker: "Little Bee Speech",
  bestFor: "Families and speech therapists who want structured practice for many sounds, step by step.",
  how: "Its maker describes practice at the word, sentence and story level, with picture flashcards and matching games. It replaced Little Bee Speech’s original Articulation Station app.",
  where: "iPhone, iPad and Mac.",
  note: "A membership, with a free trial.",
};
const BLUBS: App = {
  name: "Speech Blubs", maker: "Blub Blub",
  bestFor: "Toddlers and young children working on first words and early speech. Its maker says ages 1 to 8.",
  how: "Your child watches short videos of real children saying words and sounds, then copies them, with face filters and stickers along the way.",
  where: "iPhone, iPad and Android.",
  note: "A subscription after a free trial.",
};
const OTSIMO: App = {
  name: "Otsimo Speech Therapy", maker: "Otsimo",
  bestFor: "Young children with a speech delay who are working on first words and copying sounds.",
  how: "Games built around other children modeling words. Its maker says it uses speech recognition to adjust the games to what your child says.",
  where: "iPhone, iPad and Android.",
  note: "A subscription after a free trial. Its maker says it isn’t a replacement for a clinician.",
};
const START: App = {
  name: "staRt", maker: "a team at New York University",
  bestFor: "Older kids working on R, usually with their speech therapist. Its makers say ages 9 to 15.",
  how: "It shows the child’s R as moving waves on the screen, so they can see their sound change as they try.",
  where: "iPhone and iPad.",
  note: "Free to download.",
};

const sound = (...keys: SoundKey[]) => keys.map((k) => SOUNDS[k]);

export const GUIDES: Guide[] = [
  {
    slug: "", kind: "hub", reviewed: null,
    title: "Speech practice at home: a guide for parents — Sona",
    h1: "Speech practice at home: a simple guide for parents",
    description: "How to help your child with speech sounds at home in about 5 minutes a day: the routine, the say-it-back trick, games, the ages sounds come in, and when to ask for help.",
    answer: "The best speech practice at home is short and happens every day: about 5 minutes, kept light and fun. Start with your child’s sound on its own, then the sound with a vowel, then short words, and end on something they can do. During the day, when they say a word the old way, say it back the right way instead of correcting them.",
    sections: [
      {
        h: "Why a little every day works",
        paras: [
          "Tricky sounds like R, S and L are a lot like riding a bike. You don’t learn to ride by practicing once a week for an hour. You learn by doing a little every day.",
          "So keep it small: about 5 minutes, at a time that already happens every day, like after breakfast or in the bath.",
        ],
      },
      {
        h: "A 5-minute routine",
        steps: [
          "The sound on its own, a few times: rrrr, sssss, lllll.",
          "The sound with a vowel: ree, rah, roh.",
          "Words that start with the sound: rabbit, rocket, rain.",
          "A short sentence with one of those words: “The rabbit is hopping.”",
          "End on a win. Finish with one your child can do, and stop while it’s still fun.",
        ],
        paras: ["If a step is too hard, go back one. A child who ends on something they can do wants to come back tomorrow."],
      },
      { h: "Say it back, don’t correct", paras: RECAST },
      { h: "Make it a game", bullets: GAMES },
    ],
    faq: [
      { q: "How long should speech practice be each day?", a: "About 5 minutes. A little every day works better than a long session once a week, and it’s easier to keep up." },
      { q: "Should I correct my child’s speech?", a: "Try saying the word back the right way instead. If they say “wabbit”, answer “Yes, a rabbit!” They hear the sound clearly, and they don’t feel they made a mistake." },
      { q: "My child sees a speech therapist. Should we still practice at home?", a: "Ask your child’s speech-language pathologist what to practice. Short practice at home between visits is usually part of the plan." },
      { q: "Can an app replace speech therapy?", a: "No. An app can make daily practice easier to keep up, but it can’t check what your child needs or set goals. A speech-language pathologist can." },
    ],
    related: ["r-sound", "s-sound", "l-sound", "th-sound", "k-and-g-sounds", "best-speech-practice-apps"],
  },
  {
    slug: "r-sound", kind: "sound", reviewed: null, sounds: sound("R"),
    title: "How to practice the R sound at home — Sona",
    h1: "How to practice the R sound at home",
    description: "R is one of the last sounds kids learn, often around age 7. A 5-minute routine, R words to practice, games, and when to ask a speech-language pathologist.",
    answer: "R is one of the last sounds most children learn: many say it clearly by about age 7, so “wabbit” for rabbit is very common before then. The most helpful thing you can do at home is a few minutes of playful practice a day: the R sound on its own, then ree, rah, roh, then short words that start with R. When your child says it the old way, say the word back the right way instead of correcting them.",
    why: "R is hard because the tongue does all its work where nobody can see it. Children often swap in W, which is made with the lips, so they can see it and copy it. Some swap in L.",
    faq: [
      { q: "At what age should a child say the R sound?", a: "Many children say R clearly by about age 7, and some take a little longer. A 4- or 5-year-old who says “wabbit” is very common. If your child is about 7 or older and still swaps R, or you’re worried at any age, ask a speech-language pathologist." },
      { q: "Why does my child say W instead of R?", a: "W is made with the lips, which a child can see and copy. R happens inside the mouth, so it takes longer to learn. It’s one of the most common swaps there is." },
      { q: "Should I practice R with my 4-year-old?", a: "There’s no need to push R before it usually comes in. At 4, saying R words back the right way during the day is plenty. A speech-language pathologist can tell you what your child is ready for." },
    ],
    related: ["l-sound", "s-sound", "", "best-speech-practice-apps"],
  },
  {
    slug: "s-sound", kind: "sound", reviewed: null, sounds: sound("S", "Z"),
    title: "How to practice the S sound at home (and help a lisp) — Sona",
    h1: "How to practice the S sound at home, and help a lisp",
    description: "Many kids say “thun” for sun. What a lisp is, when S usually comes in, an S practice routine, S and Z words, and when to ask a speech-language pathologist.",
    answer: "Many children say S clearly by about age 5, and Z by about 6. Before then a lisp is common: the tongue slips between the teeth and “sun” comes out “thun”. At home, practice a few minutes a day: a long snake sound, sssss, then see, sah, soh, then words that start with S. When your child lisps during the day, say the word back the right way instead of correcting them.",
    why: "S needs the teeth close together and the tongue tucked in behind them, with a thin stream of air. If the tongue pushes forward between the teeth, S turns into TH.",
    sections: [
      {
        h: "Two kinds of lisp",
        paras: [
          "In a frontal lisp, the tongue peeks out between the teeth and S sounds like TH: “thun” for sun. Many young children do this.",
          "In a lateral lisp, air spills out the sides of the mouth and S sounds wet or slushy. That kind usually doesn’t go away by itself, so it’s worth asking a speech-language pathologist about at any age.",
        ],
      },
    ],
    faq: [
      { q: "At what age should a lisp go away?", a: "Many children say S clearly by about age 5. If your child still lisps around then, or S sounds wet or slushy at any age, ask a speech-language pathologist." },
      { q: "Will my child grow out of a lisp?", a: "Many children grow out of a frontal lisp, where the tongue peeks between the teeth. A lateral lisp, where S sounds wet or slushy, usually doesn’t go away by itself. A speech-language pathologist can tell you which kind your child has." },
      { q: "How do I help my child stop lisping at home?", a: "Keep it short and fun: a long snake sound with the teeth together and the tongue tucked in, then see, sah, soh, then S words. During the day, say lisped words back the right way. A speech-language pathologist can show you exactly what to practice." },
    ],
    related: ["th-sound", "sh-sound", "r-sound", ""],
  },
  {
    slug: "l-sound", kind: "sound", reviewed: null, sounds: sound("L"),
    title: "How to practice the L sound at home — Sona",
    h1: "How to practice the L sound at home",
    description: "Many kids say “wion” for lion until about age 6. How the L sound is made, a 5-minute routine, L words to practice, games, and when to ask for help.",
    answer: "Many children say L clearly by about age 6. Before then, “wion” or “yion” for lion is common. L is one of the easier sounds to show, because your child can see the tip of your tongue lift. Practice a few minutes a day: a singing lllll, then lah, lee, loh, then words that start with L.",
    why: "W and Y don’t need the tip of the tongue to lift, so they’re easier. L does. Practicing in front of a mirror helps your child see your tongue go up, and then theirs.",
    faq: [
      { q: "At what age should a child say the L sound?", a: "Many children say L clearly by about age 6. If your child is older and still says W or Y for L, or you’re worried at any age, ask a speech-language pathologist." },
      { q: "Why does my child say W or Y instead of L?", a: "W and Y don’t need the tongue tip to lift, so they come first. Practice with a mirror, so your child can see your tongue go up for L." },
    ],
    related: ["r-sound", "th-sound", "", "best-speech-practice-apps"],
  },
  {
    slug: "th-sound", kind: "sound", reviewed: null, sounds: sound("TH", "THV"),
    title: "How to practice the TH sound at home — Sona",
    h1: "How to practice the TH sound at home",
    description: "“Fumb” for thumb is very common until about age 6. How TH is made, a 5-minute routine, TH words to practice, games, and when to ask for help.",
    answer: "TH is a late sound. Many children say the TH in thumb clearly by about age 6, and the TH in “this” by about 7. Before then, “fumb” for thumb or “dis” for this is very common. Practice a few minutes a day: the tongue peeking out between the teeth with a little air, then thah, thoh, thoo, then words like thumb and think.",
    why: "TH needs the tongue between the teeth, which most children have spent years learning not to do. F and D are easier, so they come first.",
    faq: [
      { q: "Is it normal for a 4-year-old to say F for TH?", a: "Yes. TH is one of the last sounds to come in. Many children say the TH in thumb by about 6, and the TH in this by about 7." },
      { q: "Is TH one sound or two?", a: "Two. The quiet one is in thumb and think. The buzzing one, with the voice on, is in this and that. Sona practices both." },
    ],
    related: ["s-sound", "f-and-v-sounds", "", "best-speech-practice-apps"],
  },
  {
    slug: "k-and-g-sounds", kind: "sound", reviewed: null, sounds: sound("K", "G"),
    title: "How to practice the K and G sounds at home — Sona",
    h1: "How to practice the K and G sounds at home",
    description: "Saying “tat” for cat is called fronting. When K and G usually come in, how they’re made, a 5-minute routine, K and G words, and when to ask for help.",
    answer: "Many children say K and G clearly by about age 4. Before then, it’s common to make them at the front of the mouth instead: “tat” for cat, “doat” for goat. Speech-language pathologists call this fronting. Practice a few minutes a day: a tiny cough sound, k, then kah, kee, koh, then words that start with K or G.",
    why: "T and D are made with the tip of the tongue, right where a child can feel it. K and G happen at the back of the mouth, out of sight and harder to find.",
    faq: [
      { q: "What is fronting?", a: "Fronting is when a child makes back-of-the-mouth sounds like K and G at the front instead, as T and D: “tat” for cat, “doat” for goat. It’s common in young children." },
      { q: "At what age should a child say K and G?", a: "Many children say K and G by about age 4. If your child is older and still says T for K or D for G, or you’re worried at any age, ask a speech-language pathologist." },
    ],
    related: ["f-and-v-sounds", "s-sound", "", "best-speech-practice-apps"],
  },
  {
    slug: "f-and-v-sounds", kind: "sound", reviewed: null, sounds: sound("F", "V"),
    title: "How to practice the F and V sounds at home — Sona",
    h1: "How to practice the F and V sounds at home",
    description: "“Pish” for fish is common in young kids. When F and V usually come in, how they’re made, a 5-minute routine, F and V words, and when to ask for help.",
    answer: "Many children say F clearly by about age 4, and V by about 6. Before then, “pish” for fish or “ban” for van is common. F is easy to see, which makes it a good sound to practice in front of a mirror: top teeth on the bottom lip, and blow.",
    why: "P and B just pop the lips open. F and V need the top teeth on the lip and a steady stream of air, which takes more control.",
    faq: [
      { q: "At what age should a child say F and V?", a: "Many children say F by about age 4 and V by about 6. If your child is older and still swaps them, or you’re worried at any age, ask a speech-language pathologist." },
    ],
    related: ["th-sound", "k-and-g-sounds", "", "best-speech-practice-apps"],
  },
  {
    slug: "sh-sound", kind: "sound", reviewed: null, sounds: sound("SH"),
    title: "How to practice the SH sound at home — Sona",
    h1: "How to practice the SH sound at home",
    description: "“Sip” for ship is common until about age 6. How SH is made, a 5-minute routine, SH words to practice, games, and when to ask for help.",
    answer: "Many children say SH clearly by about age 6. Before then, “sip” for ship or “sell” for shell is common. SH is the “be quiet” sound, so it’s easy to make into a game: shhhh the sleeping baby, then shah, shee, shoh, then words that start with SH.",
    why: "S and SH are close neighbors. SH needs the lips rounded and pushed forward and a bigger, softer stream of air, so many children say S until they find it.",
    faq: [
      { q: "At what age should a child say SH?", a: "Many children say SH clearly by about age 6. If your child is older and still says S for SH, or you’re worried at any age, ask a speech-language pathologist." },
    ],
    related: ["ch-and-j-sounds", "s-sound", "", "best-speech-practice-apps"],
  },
  {
    slug: "ch-and-j-sounds", kind: "sound", reviewed: null, sounds: sound("CH", "J"),
    title: "How to practice the CH and J sounds at home — Sona",
    h1: "How to practice the CH and J sounds at home",
    description: "“Sheese” for cheese and “dam” for jam are common until about age 6. How CH and J are made, a routine, words to practice, and when to ask for help.",
    answer: "Many children say CH and J clearly by about age 6. Before then, “sheese” for cheese or “dam” for jam is common. CH sounds like the end of a sneeze, ah-choo, which makes it a fun one to practice: the sneeze, then chah, chee, choh, then words that start with CH.",
    why: "CH is two sounds in one: it starts like T and ends like SH. Many children make only one half at first.",
    faq: [
      { q: "At what age should a child say CH and J?", a: "Many children say CH and J clearly by about age 6. If your child is older and still swaps them, or you’re worried at any age, ask a speech-language pathologist." },
    ],
    related: ["sh-sound", "s-sound", "", "best-speech-practice-apps"],
  },
  {
    slug: "best-speech-practice-apps", kind: "apps", reviewed: null,
    title: "Best speech practice apps for kids (2026) — Sona",
    h1: "The best speech practice apps for kids in 2026",
    description: "An honest look at speech practice apps for kids: who each one fits, how kids practice, and what to check before you download. From the team that makes Sona.",
    answer: "The right speech app depends on what your child is working on. For a child who already talks but swaps sounds, like “wabbit” for rabbit or a lisp, look at apps built for sound practice: Sona and Articulation Station Hive. For a toddler working on first words, Speech Blubs and Otsimo are built for that. For an older child working on R with a speech therapist, ask about staRt. No app diagnoses a speech problem or replaces a speech-language pathologist.",
    disclosure: "We make Sona, one of the apps on this list. We’ve described every other app in its maker’s own terms, checked in October 2026, and tried to say plainly who each one fits. Prices change, so check the App Store or Google Play for the current price.",
    sections: [
      {
        h: "What to look for",
        bullets: [
          "Match the app to the goal. Some apps help toddlers say their first words. Others help kids who already talk practice certain sounds, like R or S.",
          "It should get your child talking out loud. Tapping and watching isn’t speech practice.",
          "Short and daily beats long and rare. Look for practice that takes a few minutes.",
          "Know where the audio goes. Check whether recordings stay on the phone or are uploaded.",
          "No app can diagnose. A speech-language pathologist can tell you what your child needs.",
        ],
      },
    ],
    apps: [SONA_APP, HIVE, BLUBS, OTSIMO, START],
    faq: [
      { q: "Do speech therapy apps work?", a: "An app can make daily practice easier to keep up, and a little practice every day is what helps. No app can diagnose a speech problem, set goals or replace a speech-language pathologist." },
      { q: "What is the best free speech app for kids?", a: "staRt is free, for older kids working on R with their speech therapist. Most others, Sona included, are free to try and then paid." },
      { q: "Which app is best for the R sound?", a: "For a child practicing R at home, an app built for speech sounds fits, like Sona or Articulation Station Hive. For an older child working on R with a speech therapist, ask them about staRt." },
    ],
    related: ["speech-blubs-alternatives", "", "r-sound", "s-sound"],
  },
  {
    slug: "speech-blubs-alternatives", kind: "apps", reviewed: null,
    title: "Speech Blubs alternatives for speech sound practice — Sona",
    h1: "Speech Blubs alternatives for kids working on speech sounds",
    description: "Speech Blubs is built for early talkers. If your child already talks but swaps sounds, like “wabbit” or a lisp, here are apps built for sound practice.",
    answer: "Speech Blubs is built around videos of real children, for early talkers (its maker says ages 1 to 8). If your child already talks in sentences and the trouble is certain sounds, like “wabbit” for rabbit or a lisp, an app built for sound practice may fit better: Sona or Articulation Station Hive, or, for an older child working on R with a speech therapist, staRt.",
    disclosure: "We make Sona, one of the apps on this page. We’ve described every other app in its maker’s own terms, checked in October 2026. Prices change, so check the App Store or Google Play for the current price.",
    sections: [
      {
        h: "When Speech Blubs is the better fit",
        paras: ["If your toddler is just starting to talk, or you’re working on first words rather than certain sounds, Speech Blubs and Otsimo are built for that. A speech-language pathologist can tell you which your child needs."],
      },
    ],
    apps: [SONA_APP, HIVE, START],
    faq: [
      { q: "What’s the difference between speech sounds and first words?", a: "Speech sounds are how words are said: the R in rabbit, the S in sun. First words and sentences are language. An app built for one isn’t always right for the other, and a speech-language pathologist can tell you which your child needs." },
      { q: "Is there a free alternative to Speech Blubs?", a: "staRt is free, for older kids working on R with their speech therapist. Most apps, Sona included, are free to try and then paid. Five minutes a day with picture cards and our home routine costs nothing." },
    ],
    related: ["best-speech-practice-apps", "", "r-sound", "s-sound"],
  },
];

export const guidePath = (g: Guide) => "/guides" + (g.slug ? "/" + g.slug : "");
export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
/** A guide is live once Rachel has read it: only then is it on speaksona.com. */
export const isLive = (g: Guide) => typeof g.reviewed === "string" && /^\d{4}-\d{2}-\d{2}$/.test(g.reviewed);
export const liveGuides = () => GUIDES.filter(isLive);
/** Production shows only live guides; a preview deploy or a laptop shows every one, noindex, for review. */
export const guideShown = (g: Guide, env: string | undefined = process.env.VERCEL_ENV) => isLive(g) || env !== "production";
