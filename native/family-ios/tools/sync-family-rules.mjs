import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { feedSelection } from "./export-feed-selection.mjs";
import { arcadeCheckpointSelection } from "./export-arcade-checkpoint.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const target = resolve(root, "native/family-ios/modules/SonaFamilyRules/Sources/SonaFamilyRules/Rules");
const source = (path) => readFileSync(resolve(root, path), "utf8");

function present(name, data) {
  const file = resolve(target, name);
  if (process.argv.includes("--check")) {
    assert(existsSync(file) && readFileSync(file, "utf8") === data, name + " differs from current Sona source");
  } else {
    mkdirSync(target, { recursive: true });
    writeFileSync(file, data);
  }
}

present("sona.js", source("public/sona.js"));
present("gamecontent.js", source("public/gamecontent.js"));
present("feed-selection.js", feedSelection(source));
present("arcade-checkpoint-selection.js", arcadeCheckpointSelection(source));
present("story-game-copy.js", source("public/daily-adventures/pages.js"));
const library = source("public/library.html");
const bookKeyStart = library.indexOf("    function keyShown(word) {");
const bookKeyEnd = library.indexOf("    function askHTML", bookKeyStart);
assert(bookKeyStart >= 0 && bookKeyEnd > bookKeyStart, "Cannot locate book key-word display rules");
present("book-word-selection.js", `// Verbatim letter-case selection from the existing book reader.
function nativeBookWord(options) {
    var BOOK = {title: options.title, pages: (options.captions || []).map(t => ({t}))};
${library.slice(bookKeyStart, bookKeyEnd)}    return keyShown(options.word);
}
`);
const sayplay = source("public/sayplay.js");
const pickStart = sayplay.indexOf("  function pickWord() {");
const pickEnd = sayplay.indexOf("  function paintDots()", pickStart);
assert(pickStart >= 0 && pickEnd > pickStart && sayplay.slice(pickStart, pickEnd).includes("themedUsed"));
const pickWord = sayplay.slice(pickStart, pickEnd);
const gameNames = ["bubbles", "peekaboo", "hoops", "soccer", "dino", "racecar", "treasure", "space", "balloon",
  "flower", "rocket", "snowman", "train", "stars", "cake", "robot", "castle", "pizza"];
const sayGames = Object.fromEntries(gameNames.map((key) => {
  const page = source(`public/arcade-${key}.html`);
  const start = page.indexOf(`key:${page.includes(`key:"${key}"`) ? "" : " "}"${key}"`);
  assert(start >= 0, `Cannot locate the Say & Play config for ${key}`);
  const config = page.slice(start, page.indexOf("done:", start));
  const steps = config.match(/steps\s*:\s*(\[(?:\s*\[\]\s*,?){1,30}\s*\])/);
  const title = config.match(/title\s*:\s*("(?:[^"\\]|\\.)*")/);
  const intro = config.match(/intro\s*:\s*("(?:[^"\\]|\\.)*")/);
  assert(steps && title, `Cannot locate the original spoken turn counts and title for ${key}`);
  return [key, { title: JSON.parse(title[1]), intro: intro ? JSON.parse(intro[1]) : null,
    steps: JSON.parse(steps[1]).length, sayings: /sayTimes:\s*1\b/.test(config) ? 1 : 2 }];
}));
const storyFirstGames = Object.fromEntries(["lighthouse", "windup", "bridge"].map((key) => {
  const page = source(`public/arcade-${key}.html`);
  const intro = page.match(new RegExp(`${key === "windup" ? "var INTRO =" : "intro:"}\\s*little\\s*\\?\\s*("[^"\\n]+")\\s*:\\s*("[^"\\n]+")`));
  const title = page.match(new RegExp(`key:\\s*"${key}",\\s*title:\\s*("[^"\\n]+")`));
  assert(title && intro, `Cannot locate the original age-specific spoken instructions for ${key}`);
  return [key, { title: JSON.parse(title[1]), young: JSON.parse(intro[1]), regular: JSON.parse(intro[2]) }];
}));
present("say-game-selection.js", `// Say & Play config from its original game pages and word selection from public/sayplay.js.
const nativeSayGameConfig = ${JSON.stringify(sayGames, null, 2)};
const nativeFirstStoryConfig = ${JSON.stringify(storyFirstGames, null, 2)};
function nativeStoryGame(key) {
    const story = Sona.STORY_DAYS.find(item => item.game === key);
    if (!story) return null;
    const simple = Sona.playStyle() === "simple";
    const first = nativeFirstStoryConfig[key];
    if (first) return { title: first.title, intro: simple ? first.young : first.regular,
        steps: simple ? 6 : 8, sayings: Sona.STORY_SAY_TIMES };
    const copy = window.DailyAdventurePages[story.controller];
    return copy && { title: copy.title, intro: copy.intro, steps: simple ? 5 : 8, sayings: Sona.STORY_SAY_TIMES };
}
function nativeSayGame(options) {
    const config = nativeSayGameConfig[options.game] || nativeStoryGame(options.game);
    if (!config) return null;
    var SOUND = String(Sona.rotSound() || "R").toUpperCase();
    var WORDS = Sona.playPool(SOUND, 10);
    if (!WORDS.length) { SOUND = "R"; WORDS = Sona.playPool(SOUND, 10); }
    if (!WORDS.length) return null;
    var roundWords = [], themedUsed = [], used = [], step = 0, word = null;
    var themed = Sona.gameWords(options.game, SOUND);
${pickWord}    const targets = [];
    for (step = 0; step < config.steps; step++) {
        word = pickWord();
        if (!word || !word.w) return null;
        targets.push({ word: word.w, emoji: word.e || "", position: word.pos || "" });
    }
    const profile = Sona.getProfile();
    return { title: config.title, intro: config.intro, sayings: config.sayings, targets, sound: SOUND,
        voice: profile.voiceId || "", voiceOn: profile.voiceOn !== false,
        volume: profile.volume == null ? 0.8 : Number(profile.volume) };
}
`);
const charge = source("public/charge.html");
const from = charge.indexOf("    var POS=(S&&S.soundPos)?S.soundPos(SOUND)");
const to = charge.indexOf("    var NUMWORD=", from);
assert(from >= 0 && to > from && charge.slice(from, to).includes("var ITEM=SEQ[0]"));
const selected = charge.slice(from, to);
present("charge-selection.js", `// Verbatim content selection from public/charge.html.
function nativeChargeTarget(options) {
    var S = Sona, SOUND = options.sound || Sona.targetSound();
    var run = options.run || null, isDaily = !!run;
    var _runLen = Math.min(Sona.ROT_LEN || 5, Sona.adventureGames().length);
    function runSave() {}
${selected}    return {
        sound: SOUND,
        practicePosition: POS,
        masteredRung: RUNG,
        selectedRung: useRung,
        requiredReps: Sona.chargeState().need,
        target: ITEM,
        easier: useRung > 0 ? Sona.stepDown(ITEM, SOUND, POS) : null,
        cue: Sona.cue(SOUND),
        voiceID: Sona.getProfile().voiceId || "",
        voiceOn: Sona.getProfile().voiceOn !== false,
        voiceVolume: Sona.getProfile().volume == null ? 0.8 : Number(Sona.getProfile().volume),
        humanClipsEnabled: Sona.humanClipsOn(),
        praiseLine: Sona.praiseLine(),
        gameTitle: options.game ? Sona.gameMeta(options.game).name : ""
    };
}
`);
console.log("Native rules match the shipping source.");
