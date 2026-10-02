#!/usr/bin/env node
// Regenerates VOICE_SCRIPT.md — the recording script for Echo's voice — from
// the LIVE code, so the sheet Travis reads into a mic can never drift from
// what the app actually sends to the voice.
//
//   node tools/voicedoc.mjs > VOICE_SCRIPT.md     print the script
//   node tools/voicedoc.mjs --write               write VOICE_SCRIPT.md in place
//   node tools/voicedoc.mjs --check               exit 1 if VOICE_SCRIPT.md is stale
//
// Two sources, both read every run:
//   1. public/sona.js and public/gamecontent.js are eval'd against browser
//      stubs (as before) so the tables come from the code: CUES, PRAISES,
//      WORDS, SOUND_SAY, EPISODES, the syllable and sentence generators.
//   2. The pages are read as text. Every spoken line a page builds itself
//      (charge.html's prompt, coaching, win and quiet-screen lines; Feed
//      Echo's asks; the round games' say-it card, sound power and how-to-play
//      line; the picture games; the books; the parked readers; Coach Call) is
//      located by an anchor regex on the exact source, and where a page
//      BUILDS a line (sayLine, soundName, soundSlot, the cue-shortening rule,
//      a game's SLOW_HELP) the page's own code is lifted out and executed, so
//      the printed text is the page's text.
//
// FAILS LOUDLY, on purpose. An anchor that no longer matches, a say() call
// or a voice request the anchors do not cover, a file that reaches the voice
// and is not read here, a parked page that gained a link, a "dead" helper
// that gained a caller — each throws, prints why, and exits 1 with nothing on
// stdout. That is the point: a line cannot quietly vanish from or appear in
// the app without this script being looked at. When it fires, read the
// message, look at the diff, and update the anchor (and the sheet).
//
// Nothing runs this for you: it is not in tests/run-all.mjs. It sat broken
// from 29 Sep to 2 Oct 2026 while the practice prompt, the books, Feed Echo
// and Fruit Slice's card all changed what they say. Run --check after any
// change to what Echo says.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = join(ROOT, "VOICE_SCRIPT.md");
const FILES = {};
const src = (p) => (FILES[p] ??= readFileSync(join(ROOT, p), "utf8"));

class Drift extends Error {}
function fail(msg) { throw new Drift(msg); }
process.on("uncaughtException", (e) => {
  if (!(e instanceof Drift)) throw e;
  process.stderr.write(`voicedoc: the app's spoken lines drifted from this script — nothing written.\n  ${e.message}\n`);
  process.exit(1);
});
function lineOf(file, idx) { return src(file).slice(0, idx).split("\n").length; }
function cite(file, idx) { return `${file}:${lineOf(file, idx)}`; }
// One anchor: the exact source we expect. Returns the match plus a citation.
function find(file, re, label) {
  const m = re.exec(src(file));
  if (!m) fail(`"${label}" was not found in ${file}.\n  Anchor: ${re}\n  The line moved, was reworded or was removed. Update the anchor in tools/voicedoc.mjs and re-read the sheet.`);
  return { m, idx: m.index, end: m.index + m[0].length, line: lineOf(file, m.index), cite: cite(file, m.index) };
}
function allIdx(file, re) { const out = []; const text = src(file); let m; const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"); while ((m = g.exec(text))) out.push({ idx: m.index, m }); return out; }
// Lift a `function name(){...}` out of a page and return its source text.
function liftFn(file, name, multiline) {
  const re = multiline
    ? new RegExp(`^    function ${name}\\(\\)\\{\\n[\\s\\S]*?^    \\}$`, "m")
    : new RegExp(`^    function ${name}\\(\\)\\{.*\\}$`, "m");
  return find(file, re, `function ${name}()`);
}
// Every match of `re` in a file must sit inside one of the anchors given.
// Skipped: a definition (`function say(`) and, unless emptyCounts, a call
// with nothing in it (`say()` is how a comment names the function, and a real
// say() of nothing speaks nothing).
function coverAll(file, re, covered, what, emptyCounts) {
  const text = src(file);
  for (const h of allIdx(file, re)) {
    if (/function $/.test(text.slice(Math.max(0, h.idx - 9), h.idx))) continue;
    if (!emptyCounts && text[h.idx + h.m[0].length] === ")" && h.m[0].endsWith("(")) continue;
    if (!covered.some((c) => h.idx >= c.idx && h.idx < c.end)) fail(`${file} has ${what || "a spoken line"} the script does not know at ${cite(file, h.idx)}: ${text.slice(h.idx, h.idx + 90).split("\n")[0]}\n  Add an anchor for it in tools/voicedoc.mjs.`);
  }
}
// The ways a page reaches the voice with a line of its own: a request to the
// voice service, and sona.js's speak()/speakNow() (an empty line is only a
// stop). The browser's voice (speechSynthesis.speak) is each player's last
// resort for the same text, so it is not a line of its own.
const TTS_CALL = /fetch\(\s*["']\/api\/tts/;
const SPEAK_CALL = /(?<!speechSynthesis)\.speak(?:Now)?\((?!""\))/;

// ───────────────────────── the app's own tables ─────────────────────────
globalThis.window = {};
globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
globalThis.location = { search: "" };
globalThis.document = { addEventListener() {}, documentElement: {} };
(0, eval)(src("public/sona.js"));
const S = window.Sona;
globalThis.Sona = S; // gamecontent.js reads the bare global
(0, eval)(src("public/gamecontent.js"));
const SC = window.SonaContent;
const GC = "public/gamecontent.js";
const SOUNDS = S.ALL_SOUNDS.slice();
const STRETCH = new Set(["R", "S", "L", "F", "V", "SH", "TH", "THV", "Z", "M", "N"]);
for (const s of SOUNDS) {
  if (!S.CUES[s] || !S.CUES[s].tip) fail(`CUES has no tip for ${s} — the prompt for that sound would fall back to the default cue.`);
  if (!S.SOUND_SAY[s]) fail(`SOUND_SAY has no entry for ${s}.`);
  if (!S.WORDS[s] || !S.WORDS[s].length) fail(`WORDS has no bank for ${s}.`);
}
const POSNAME = {}; (S.POSITIONS || []).forEach((p) => { POSNAME[p.id] = p.name; });
const posName = (id) => POSNAME[id] || id;

// ───────────────────────── charge.html: the practice screen ─────────────────────────
const CH = "public/charge.html";
const chargeNeed = find("public/sona.js", /const CHARGE_NEED = (\d+);/, "CHARGE_NEED");
const NEED_DEFAULT = Number(chargeNeed.m[1]);
const humanSwitch = find("public/sona.js", /const HUMAN_CLIPS = (true|false);/, "HUMAN_CLIPS switch");
const HUMAN_ON = humanSwitch.m[1] === "true";
const numword = find(CH, /var NUMWORD=(\{[^}]*\});/, "NUMWORD table");
const NUMWORD = (0, eval)("(" + numword.m[1] + ")");
const retryNeeds = [...new Set(allIdx(CH, /burstAndVerify\((\d+)\)/).map((h) => Number(h.m[1])))];
if (!retryNeeds.length) fail("no burstAndVerify(n) retry call found in charge.html");
const NEEDS = [NEED_DEFAULT, ...retryNeeds.filter((n) => n !== NEED_DEFAULT)];
for (const n of NEEDS) if (!NUMWORD[n]) fail(`NUMWORD has no word for ${n}; the prompt would read the digit.`);

// The page's own line builders, lifted and run.
const soundNameFn = liftFn(CH, "soundName", false);
const soundNameOf = (sound) => new Function("SOUND", soundNameFn.m[0] + "\nreturn soundName;")(sound)();
const cueShortRule = find(CH, /var CUESHORT=\((.*)\);\n/, "CUESHORT rule");
const cueShortOf = (sound) => new Function("CUETIP", "var CUESHORT=(" + cueShortRule.m[1] + "); return CUESHORT;")(S.cue(sound).tip || "");
const tipRule = find(CH, /var tip=\((.*)\);\n/, "retry tip rule");
const tipOf = (sound) => new Function("c", "soundName", "var tip=(" + tipRule.m[1] + "); return tip;")(S.cue(sound), () => soundNameOf(sound));
const sayLineFn = liftFn(CH, "sayLine", true);
find(CH, /if\(ITEM\.level==="isolation"\) ask="make your "\+soundName\(\)\+" sound";\n\s*else ask="say "\+\(ITEM\.display\|\|ITEM\.t\);/, "sayLine ask forms");
find(CH, /return "Ready\? "\+CUESHORT\+", and "\+ask\+", "\+times\+"\.";/, "cued first prompt");
find(CH, /return "Ready\? "\+ask\.charAt\(0\)\.toUpperCase\(\)\+ask\.slice\(1\)\+", "\+times\+"\.";/, "plain prompt");
// Run the page's own sayLine() with the page's inputs (or placeholders, for the template rows).
function runSayLine(env) {
  const f = new Function("NUMWORD", "soundName", "ITEM", "NEED", "CUESHORT", sayLineFn.m[0] + "\nreturn sayLine;")(env.NUMWORD, env.soundName, env.ITEM, env.NEED, env.CUESHORT);
  f._cued = !!env.cued;
  return f();
}
function sayLine(sound, item, need, cuedAlready) {
  return runSayLine({ NUMWORD, soundName: () => soundNameOf(sound), ITEM: item, NEED: need, CUESHORT: cueShortOf(sound), cued: cuedAlready });
}
const TEMPLATE_ENV = { NUMWORD: { [NEED_DEFAULT]: "{n}" }, soundName: () => "{sound}", NEED: NEED_DEFAULT, CUESHORT: "{cue}" };
const isoItem = (sound) => S.ladderContent(sound, 0)[0];
const promptCall = find(CH, /function playPrompt\(\)\{\n\s*if\(mutedSpeech\(\)\)return Promise\.resolve\(\);\n\s*return say\(sayLine\(\)\);\n\s*\}/, "playPrompt");
// Echo's words, Rachel's sound: on a sound round, wherever a line names the
// sound ("make your R sound") ONE recorded take of it plays in the letter's
// place. The page's own soundSlot() says where the line is cut.
const soundSlotFn = find(CH, /^    function soundSlot\(text\)\{\n[\s\S]*?^    \}$/m, "function soundSlot()");
const slotOf = (sound, text) => new Function("HUMANCLIPS", "ITEM", "SOUND", "soundName", soundSlotFn.m[0] + "\nreturn soundSlot;")(true, { level: "isolation" }, sound, () => soundNameOf(sound))(text);
find(CH, /HUMANCLIPS=!!\(S&&S\.humanClipsOn&&S\.humanClipsOn\(\)\);/, "the practice page reads the shared sound-model switch");
find(CH, /var packet=\{text:t,slow:!!slow,slot:soundSlot\(t\),epoch:practiceEpoch\};/, "every queued line is offered the sound slot");
const voiceDown = find(CH, /if\(result==="voice-down"\)result=await playMedia\(packet\.slot\.whole,packet\.slow,job\);/, "her whole July line when the voice service is down");
const promptStart = find(CH, /await playPrompt\(\);/, "the first prompt of a round");
const promptTap = find(CH, /\$\("echoBuddy"\)\.onclick=function\(\)\{.*playPrompt\(\); \};/, "tap on Echo replays the prompt");
const turtle = find(CH, /function turtleText\(\)\{ return ITEM\.level==="isolation" \? sayLine\(\) : String\(ITEM\.say\|\|ITEM\.display\|\|ITEM\.t\); \}/, "turtle text");
const turtleRate = find(CH, /if\(slow\)\{a\.playbackRate=(0\.\d+);/, "turtle playback rate");
find(CH, /\$\("turtleBtn"\)\.onclick=function\(\)\{.*saySlow\(turtleText\(\)\); \};/, "turtle tap");
const coach = find(CH, /await say\("(Let's try that one again\. )"\+tip\+"(\.)"\);/, "coaching line");
const idea = find(CH, /await say\("(I have an idea\. Let's try this one\. )"\+\(ITEM\.level==="isolation"\?\("(Make your )"\+soundName\(\)\+"( sound)"\):\("(Say )"\+\(ITEM\.say\|\|ITEM\.t\)\)\)\+"(\.)"\);/, "Echo's idea line");
// The idea line's pieces: [1] prefix, [2] "Make your ", [3] " sound", [4] "Say ", [5] full stop.
const ideaSound = (s) => idea.m[1] + idea.m[2] + soundNameOf(s) + idea.m[3] + idea.m[5];
const ideaTemplate = idea.m[1] + idea.m[4] + "{target}" + idea.m[5];
// Every line that names the sound must take her recording, and the recording
// must be there: the first prompt, the prompt again, and Echo's idea.
const SLOT = {};
for (const s of SOUNDS) for (const line of [sayLine(s, isoItem(s), NEED_DEFAULT, false), sayLine(s, isoItem(s), NEED_DEFAULT, true), ideaSound(s)]) {
  const slot = slotOf(s, line);
  if (!slot) fail(`soundSlot() finds no place for ${s}'s recorded sound in "${line}" — that line would be spoken letter and all.`);
  for (const f of [slot.clip, slot.whole]) if (!existsSync(join(ROOT, "public", f))) fail(`public${f} is missing.`);
  SLOT[s] ??= slot;
}
const praise = find(CH, /await say\(\(S&&S\.praiseLine\)\?S\.praiseLine\(\):"([^"]*)"\);/, "praise after the easier target");
const roundEnd = find(CH, /await say\("(Good practicing\. Let's play\.)"\);/, "round end after two misses");
const win = find(CH, /await sayAfterChime\("(You did it\. Let's play\.)"\);/, "the win line");
const chest = find(CH, /sayAfterChime\("(Look what we found\.)",/, "the chest line");
const advEnd = find(CH, /sayAfterChime\("(We finished the whole adventure\.)",/, "the adventure-end line");
const quiet = find(CH, /if\(!microphone\)say\("(I couldn't hear you! Say it big — I'm all ears!)"\);/, "the quiet-screen line");
const afterChime = find(CH, /var AFTER_CHIME_MS=(\d+);/, "AFTER_CHIME_MS");
const nudge = find(CH, /nudges\+\+;playPrompt\(\);nextNudge=activeMs\(\)\+(\d+);armIdle\(\);/, "idle nudge");
const armIdleRefs = allIdx(CH, /armIdle\(\)/).length;
if (armIdleRefs !== 3) fail(`armIdle() now has ${armIdleRefs} references (expected 3: its definition and two recursive calls). If the idle nudge was wired up, move it out of Part E.`);
find(CH, /ITEMS=\(S\.ladderContent\(SOUND,useRung\)\|\|\[\]\)\.filter\(function\(it\)\{return it&&it\.t;\}\);/, "ladder filter on it.t (keeps the conversation rung silent)");
// Completeness: every say()/sayAfterChime() call site in charge.html must sit inside one anchor.
{
  const covered = [promptCall, coach, idea, praise, roundEnd, win, chest, advEnd, quiet];
  const text = src(CH);
  const re = /(?<![\w$.])(say|sayAfterChime)\(/g; let m;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 9), m.index);
    if (/function $/.test(before)) continue; // the definitions
    if (text.startsWith("say(text)", m.index)) continue; // sayAfterChime's own forward to say()
    if (text.startsWith("say(t)", m.index)) continue; // queueSpeech wrapper
    if (!covered.some((c) => m.index >= c.idx && m.index < c.end)) fail(`charge.html has a spoken line the script does not know at ${cite(CH, m.index)}: ${text.slice(m.index, m.index + 90).split("\n")[0]}\n  Add an anchor for it in tools/voicedoc.mjs.`);
  }
  const qs = allIdx(CH, /queueSpeech\(/).filter((h) => !/function $/.test(text.slice(h.idx - 9, h.idx)));
  for (const h of qs) {
    const s = text.slice(h.idx, h.idx + 60);
    if (!/^queueSpeech\(t,(false|true)\)/.test(s)) fail(`charge.html has a queueSpeech() call the script does not know at ${cite(CH, h.idx)}: ${s}`);
  }
}

// ───────────────────────── Feed Echo (live) ─────────────────────────
const FEED = "public/arcade-feed.html";
const feedAsk = find(FEED, /say\("(Where is the )"\+target\.w\+"(\? Say\.\.\. )"\+target\.w\+"(\.)"\)/, "Feed Echo ask");
const feedPoolFn = find(FEED, /^    function pool\(sound\)\{.*\}$/m, "Feed Echo word pool");
const feedPool = new Function("S", feedPoolFn.m[0] + "\nreturn pool;")(S);
find(FEED, /var SOUND=\(S&&S\.rotSound\)\?S\.rotSound\(\):"R";/, "Feed Echo sound");
// The mic button that waits after a quiet turn says the word again, alone.
const feedAgain = find(FEED, /say\("(Say\.\.\. )"\+target\.w\+"(\.)"\)/, "Feed Echo's mic-button ask");
const feedWait = find(FEED, /var LISTEN_MS=(\d+)/, "Feed Echo's listening window");
const feedVoice = find(FEED, /fetch\("\/api\/tts",\{method:"POST",headers:\{"Content-Type":"application\/json"\},body:JSON\.stringify\(\{text:t,voice:profile\.voiceId\|\|"",stable:true\}\)\}\)/, "Feed Echo's voice request");
coverAll(FEED, /(?<![\w$.])say\(/, [feedAsk, feedAgain]);
coverAll(FEED, TTS_CALL, [feedVoice], "a voice request"); coverAll(FEED, SPEAK_CALL, [], "a voice call");
const feedLine = (w) => feedAsk.m[1] + w + feedAsk.m[2] + w + feedAsk.m[3];

// ───────────────────────── the five round games ─────────────────────────
// Fruit Slice, Piano Tiles, Block Stacker, Sound Sprint, Flappy Glide. Three
// things can speak in them: the say-it card between rounds (Fruit Slice's
// only — the other four cards are text), Echo's power button (all five), and
// Sound Sprint's how-to-play line.
const ROUND_KEYS = ["slice", "tiles", "stack", "run", "glide"];
const roundFile = (k) => `public/arcade-${k}.html`;
for (const k of ROUND_KEYS) if (!S.GAME_ACTS[k] || !String(S.GAME_ACTS[k].go).includes(`arcade-${k}.html`) || S.GAME_ACTS[k].comingSoon) fail(`GAME_ACTS.${k} is no longer a live round game at arcade-${k}.html — re-read the round games' section.`);
const roundName = (k) => S.GAME_ACTS[k].name;
const SLICE = roundFile("slice"), TILES = roundFile("tiles"), RUN = roundFile("run");
// The card's title. Painted, never spoken: on Fruit Slice with what the card
// asks (ASK), on the other four with the bare sound (SAYTXT).
const cardTitle = { slice: find(SLICE, /function paintAsk\(\)\{ \$\("revTitle"\)\.innerHTML="Say \\u201C"\+ASK\.html\+"\\u201D "\+esc\(askTail\); \}/, "Fruit Slice's say-it card title") };
find(SLICE, /askTail=tail\|\|"to keep playing!"; paintAsk\(\);/, "Fruit Slice's say-it card tail");
for (const k of ROUND_KEYS.slice(1)) cardTitle[k] = find(roundFile(k), /\$\("revTitle"\)\.innerHTML=markTitle\(title\|\|\("Say \\u201C"\+SAYTXT\+"\\u201D to keep playing!"\)\);/, "say-it card title");

// Fruit Slice's card, spoken (speakRevive). What it asks comes from one
// reader, Sona.gameAsk: the bare sound, a syllable or a short word.
const gameAskFn = find("public/sona.js", /function gameAsk\(sound, card, opts\) \{/, "gameAsk()");
const gameAskVoice = find("public/sona.js", /clip: rung \? "" : "\/coach\/say-echo\/" \+ sound \+ "-sound\.wav", say: rung \? text : "",/, "gameAsk(): her recording for the bare sound, Echo's line past it");
const sylOn = find(GC, /var GAME_SYL_ON = \[/, "GAME_SYL_ON");
const gameSkip = find(GC, /var GAME_SKIP = \{/, "GAME_SKIP");
const gameShort = find(GC, /var GAME_SHORT = \{/, "GAME_SHORT");
find(SLICE, /var a=null; try\{ a=S\.gameAsk\(SND,n\); \}catch\(e\)\{\}/, "Fruit Slice's card reads Sona.gameAsk");
const sliceAsk = find(SLICE, /L\.p=fetch\("\/api\/tts",\{method:"POST",headers:\{"Content-Type":"application\/json"\},body:JSON\.stringify\(\{text:"(To keep playing, say\.\.\. )"\+a\.say\+"(\.)",voice:profile\.voiceId\|\|"",stable:true\}\)/, "Fruit Slice's card: the syllable or word line");
const sliceAskPlay = find(SLICE, /var said=!!\(askLine&&askLine\.say===ASK\.say&&askLine\.bytes\)&&await reviveBytes\(askLine\.bytes,gen\);/, "Fruit Slice's card plays the line it holds");
const sliceLineFn = find(SLICE, /async function reviveLine\(text,gen\)\{[\s\S]*?fetch\("\/api\/tts",\{method:"POST",headers:\{"Content-Type":"application\/json"\},body:JSON\.stringify\(\{text:text,voice:profile\.voiceId\|\|"",stable:true\}\)/, "Fruit Slice's reviveLine()");
const sliceLead = find(SLICE, /else if\(lead\)await reviveLine\(idea\?"(I have an idea\. Let's try this one\.)":"(To keep playing, say)",gen\);/, "Fruit Slice's card: Echo's words before the bare sound");
const sliceSound = find(SLICE, /if\(!ASK\.say&&gen===reviveVoice&&S\.ALL_SOUNDS\.indexOf\(SND\)>=0&&S\.humanClipsOn&&S\.humanClipsOn\(\)\)await reviveAudio\(ASK\.clip,gen\);/, "Fruit Slice's card: Rachel's recording of the bare sound");
const sliceBack = find(SLICE, /closeReviveMic\(\); askHeld=ASK; ASK=cardAsk\(0\); paintAsk\(\); speakRevive\(true\);/, "Fruit Slice's card steps back to the bare sound");
const sliceWait = find(SLICE, /var ASK_WAIT_MS=(\d+), askT=0;/, "ASK_WAIT_MS");
const sliceMuted = find(SLICE, /if\(voiceOff\(\)\)\{askNext=null;if\(ASK\.rung\)\{ASK=cardAsk\(0\);paintAsk\(\);\}openReviveMic\(\);return;\}/, "Fruit Slice's card says nothing while Sona's sound is off");
coverAll(SLICE, TTS_CALL, [sliceAsk, sliceLineFn], "a voice request");
coverAll(SLICE, /(?<![\w$.])reviveLine\(/, [sliceLead]);
coverAll(SLICE, /(?<![\w$.])reviveBytes\(/, [sliceAskPlay]);
const sliceAskLine = (ask) => sliceAsk.m[1] + ask + sliceAsk.m[2];
// What a card may ask past the bare sound: the lists in gamecontent.js.
const GAME_ON = SC.GAME_SYL_ON.slice();
for (const s of GAME_ON) if (!SOUNDS.includes(s)) fail(`GAME_SYL_ON names ${s}, which is not one of the ${SOUNDS.length} sounds.`);
const gameSteps = (s) => ({ syl: SC.gameSyllables(s).map((x) => x.t), word: SC.gameWord(s) });
for (const s of SOUNDS) if (!existsSync(join(ROOT, "public/coach/say-echo", s + "-sound.wav"))) fail(`public/coach/say-echo/${s}-sound.wav is missing — the games and the practice page play it for ${s}.`);

// Echo's power button: an instruction in Echo's voice, then her recording.
// Four games share arcade-speech-help.js and set their own SLOW_HELP;
// Piano Tiles carries its own copy.
const HELP = "public/arcade-speech-help.js";
const helpLine = find(HELP, /fetch\("\/api\/tts",\{method:"POST",headers:\{"Content-Type":"application\/json"\},body:JSON\.stringify\(\{text:(SLOW_HELP\.say\|\|\("To "\+SLOW_HELP\.action\+", say"\)),voice:p\.voiceId\|\|"",stable:true\}\)/, "the sound power's instruction");
find(HELP, /var instruct=!\(SLOW_HELP\.sayOnce&&slowSaid\);/, "the sound power's say-it-once rule");
const helpSound = find(HELP, /S\.humanClipsOn&&S\.humanClipsOn\(\)\)return slowAudio\("\/coach\/say-echo\/"\+SND\+"-sound\.wav",t\);/, "the sound power: Rachel's recording");
const MUTED = /if\(p\.voiceOn===false\|\|Number\(p\.volume\)===0\)return Promise\.resolve\(\);/;
const helpMuted = find(HELP, MUTED, "the sound power says nothing while Sona's sound is off");
coverAll(HELP, TTS_CALL, [helpLine], "a voice request"); coverAll(HELP, SPEAK_CALL, [], "a voice call");
const HELP_KEYS = ROUND_KEYS.filter((k) => src(roundFile(k)).includes("/arcade-speech-help.js"));
for (const f of readdirSync(join(ROOT, "public")).filter((f) => f.endsWith(".html"))) {
  if (src("public/" + f).includes("/arcade-speech-help.js") && !HELP_KEYS.some((k) => roundFile(k) === "public/" + f)) fail(`public/${f} loads arcade-speech-help.js — another page now has Echo's sound power. Add it to the script.`);
}
const power = {};
for (const k of HELP_KEYS) {
  const cfg = find(roundFile(k), /<script>window\.SLOW_HELP=(\{.*\});<\/script>/, "SLOW_HELP");
  const opts = (0, eval)("(" + cfg.m[1] + ")");
  power[k] = { text: new Function("SLOW_HELP", "return " + helpLine.m[1] + ";")(opts), once: !!opts.sayOnce, cite: cfg.cite };
}
const tilesLine = find(TILES, /fetch\("\/api\/tts",\{method:"POST",headers:\{"Content-Type":"application\/json"\},body:JSON\.stringify\(\{text:"([^"]*)",voice:p\.voiceId\|\|"",stable:true\}\)/, "Piano Tiles' sound power: the instruction");
find(TILES, /S\.ALL_SOUNDS\.indexOf\(SND\)>=0\)return slowAudio\("\/coach\/say-echo\/"\+SND\+"-sound\.wav",t\);/, "Piano Tiles' sound power: Rachel's recording");
find(TILES, MUTED, "Piano Tiles' sound power says nothing while Sona's sound is off");
if (HELP_KEYS.includes("tiles")) fail("Piano Tiles now loads arcade-speech-help.js — it carried its own copy of the sound power. Re-read it.");
power.tiles = { text: tilesLine.m[1], once: false, cite: tilesLine.cite };
for (const k of ROUND_KEYS) if (!power[k]) fail(`${roundName(k)} has no sound power the script can read.`);

// Sound Sprint says how to play, on the start card of a child's first races.
const runLine = find(RUN, /var START_LINE="([^"]*)";/, "Sound Sprint's how-to-play line");
const runRaces = find(RUN, /var START_RACES=(\d+), STARTKEY=/, "Sound Sprint's START_RACES");
const runVoice = find(RUN, /fetch\("\/api\/tts",\{method:"POST",headers:\{"Content-Type":"application\/json"\},body:JSON\.stringify\(\{text:START_LINE,voice:S\.getProfile\(\)\.voiceId\|\|"",stable:true\}\)/, "Sound Sprint asks the voice for its line");
const runFallback = find(RUN, /said=S\.speakNow\(START_LINE\);/, "Sound Sprint's fallback voice");
const runMuted = find(RUN, /if\(!sc\.line\|\|!startVoiceOn\(\)\)\{ beginRace\(\); return; \}/, "Sound Sprint says nothing while Sona's sound is off");
// Nothing else in the five pages reaches the voice.
const roundKnown = { slice: [sliceAsk, sliceLineFn], tiles: [tilesLine], run: [runVoice, runFallback], stack: [], glide: [] };
for (const k of ROUND_KEYS) {
  const f = roundFile(k);
  coverAll(f, TTS_CALL, roundKnown[k], "a voice request");
  coverAll(f, SPEAK_CALL, roundKnown[k], "a voice call");
  coverAll(f, /(?<![\w$.])(say|speak|speakNow)\(/, []);
  coverAll(f, /SpeechSynthesisUtterance/, [], "a browser-voice line");
}

// ───────────────────────── the picture games (Say & Play) ─────────────────────────
// One shared script, sayplay.js, and one spoken line: Echo models the word.
const SAYPLAY = "public/sayplay.js";
const spAsk = find(SAYPLAY, /say\("(Say\.\.\. )" \+ word\.w \+ "(\.)"\)/, "Say & Play's ask");
const spPoolFn = find(SAYPLAY, /^  function pool\(sound\) \{\n[\s\S]*?^  \}$/m, "Say & Play's word pool");
const spPool = new Function("S", spPoolFn.m[0] + "\nreturn pool;")(S);
find(SAYPLAY, /SOUND = String\(\(S\.rotSound && S\.rotSound\(\)\) \|\| "R"\)\.toUpperCase\(\);/, "Say & Play's sound");
const spVoice = find(SAYPLAY, /fetch\("\/api\/tts", \{ method: "POST", headers: \{ "Content-Type": "application\/json" \}, body: JSON\.stringify\(\{ text: t, voice: profile\.voiceId \|\| "", stable: true \}\)/, "Say & Play's voice request");
coverAll(SAYPLAY, /(?<![\w$.])say\(/, [spAsk]);
coverAll(SAYPLAY, TTS_CALL, [spVoice], "a voice request"); coverAll(SAYPLAY, SPEAK_CALL, [], "a voice call");
const spLine = (w) => spAsk.m[1] + w + spAsk.m[2];
// Which game a page is, from the catalog. A page that loads a speaking
// script and is in no catalog entry is a page the sheet cannot name.
const gameOfPage = (f) => {
  const key = Object.keys(S.GAME_ACTS).find((k) => String(S.GAME_ACTS[k].go).split("?")[0] === "/" + f);
  if (!key) fail(`public/${f} loads a speaking game script but GAME_ACTS has no game at /${f}. Add it to the script.`);
  return S.GAME_ACTS[key];
};
const pagesLoading = (script) => readdirSync(join(ROOT, "public")).filter((f) => f.endsWith(".html") && src("public/" + f).includes(script)).sort();
const spGames = pagesLoading("/sayplay.js").map(gameOfPage);
if (!spGames.length) fail("no page loads sayplay.js any more — the picture games moved.");

// ───────────────────────── parked / unlinked pages ─────────────────────────
// simple-play.js (Bubble Pop and Peekaboo were built on it): the bare word.
// Which pages still load it, and which of those are "coming soon", is read
// from the pages and the catalog — a game moves between Part C and Part E on
// its own when it is switched on, parked or rebuilt on another script.
const SP = "public/simple-play.js";
const spWord = find(SP, /body: JSON\.stringify\(\{ text: word, voice: profile\.voiceId \|\| "", stable: true \}\)/, "simple-play word request");
find(SP, /S\.wordsFor\(sound, "i"\) \|\| \[\] : \[\]\)\.filter\(function \(w\) \{ return w && w\.w && w\.e; \}\)\n\s*\.sort\(function \(a, b\) \{ return a\.w\.length - b\.w\.length; \}\)\.slice\(0, 8\);/, "simple-play word pool (same rule as Feed Echo)");
const simpleSay = find(SP, /render\(\); effect\("tap"\); sayWord\(\); focus\(\$\("hearWord"\)\);/, "simple-play says the word when the picture is revealed");
const simpleHear = find(SP, /\$\("hearWord"\)\.onclick = sayWord;/, "simple-play 'Hear it'");
const simpleVoice = find(SP, /fetch\("\/api\/tts", options\)/, "simple-play's voice request");
coverAll(SP, /(?<![\w$.])sayWord\(/, [simpleSay], "a spoken line", true);
coverAll(SP, TTS_CALL, [simpleVoice], "a voice request"); coverAll(SP, SPEAK_CALL, [], "a voice call");
const simplePages = pagesLoading("/simple-play.js");
const simpleGames = simplePages.map(gameOfPage);
const simpleLive = simpleGames.filter((g) => !g.comingSoon), simpleSoon = simpleGames.filter((g) => g.comingSoon);

// ───────────────────────── parked / unlinked pages ─────────────────────────
// A "coming soon" simple-play page is parked with the readers; a live one is not.
const PARKED_PAGES = ["story.html", "chapter.html", "check.html", "coach-call.html"].concat(simplePages.filter((f) => gameOfPage(f).comingSoon));
// The Books page keeps the door to Your Adventure in its markup, hidden, and
// nothing un-hides it. That one link is known; any other is a new door.
const LB = "public/library.html";
const advTile = find(LB, /<button id="advTile" hidden onclick="location\.href='\/story\.html'"/, "the Books page's hidden adventure tile");
if (allIdx(LB, /advTile/).length !== 1) fail("library.html now mentions advTile more than once — if something un-hides the adventure tile, story.html is live: move E2 out of Part E.");
function linkGuard() {
  const files = readdirSync(join(ROOT, "public")).filter((f) => f.endsWith(".html") && !PARKED_PAGES.includes(f));
  for (const f of files) {
    const text = src("public/" + f);
    const re = new RegExp(`(href=|location\\.(href|replace|assign)\\s*[=(]\\s*|window\\.open\\()["']/?(${PARKED_PAGES.map((p) => p.replace(".", "\\.")).join("|")})`, "g");
    let m; while ((m = re.exec(text))) {
      if ("public/" + f === LB && m.index >= advTile.idx && m.index < advTile.end) continue;
      fail(`public/${f} links to ${m[3]} at ${cite("public/" + f, m.index)} — that page was parked or unlinked. Move its lines out of Part E.`);
    }
  }
}
linkGuard();
find("public/coach-call.html", /if\(!DEVMODE\)\{\n\s*\$\("ringOvl"\)\.style\.display="none";\n\s*\$\("soonOvl"\)\.classList\.add\("show"\);/, "Coach Call 'coming soon' gate");

// check.html (Speech Check)
const CK = "public/check.html";
const checkAsk = find(CK, /await say\("(Say: )"\+it\.w\);/, "Speech Check ask");
const checkWords = (0, eval)(find(CK, /var WORDS=(\[[\s\S]*?\]);/, "Speech Check word list").m[1]);

// story.html (Your Adventure)
const ST = "public/story.html";
const storyPage = find(ST, /await say\(fixText\(p\.text\)\.replace\("___",p\.word\)\);/, "story page read-aloud");
const storyNowYou = find(ST, /await say\("(Now you! Say\.\.\. )"\+p\.word\+"(!)"\);/, "story 'Now you' line");
const storyPraise = find(ST, /await say\(Sona\.praiseLine\(\)\);/, "story praise");
const storyRetry = find(ST, /say\(p\.word\)\.then\(function\(\)\{ turn\(\); \}\);/, "story retry word");
const storyHear = find(ST, /Sona\.speakNow\(p\.text\.replace\("___",p\.word\),SPEAK_OPTS\);/, "story 'Hear it'");
find(ST, /var FALLBACK=\(window\.SonaContent\?SonaContent\.storyPages\(SOUND\):/, "story fallback pages");
const framesOf = (fn) => (0, eval)(find(GC, new RegExp(`function ${fn}\\(sound\\) \\{\\s*var frames = (\\[[^\\]]*\\]);`), `${fn}() frames`).m[1]);
const SENTENCE_FRAMES = framesOf("sentences"), STORY_FRAMES = framesOf("storyPages"), CHAT_FRAMES = framesOf("chats");
const storyFrames = find(GC, /function storyPages\(sound\) \{/, "storyPages()");
const chatFrames = find(GC, /function chats\(sound\) \{/, "chats()");
const sentFrames = find(GC, /function sentences\(sound\) \{/, "sentences()");
const sylFn = find(GC, /function syllables\(sound\) \{/, "syllables()");

// chapter.html (today's chapter)
const CP = "public/chapter.html";
const chapPages = find(CP, /PAGES=\[EP\.open\]\.concat\(EP\.beats\|\|\[\]\);/, "chapter pages");
const chapSay = find(CP, /say\(PAGES\[i\]\);/, "chapter page read-aloud");
const chapDone = find(CP, /say\("(You did it! Three games are unlocked\.)"\);/, "chapter finish line");
const chapHear = find(CP, /S\.speakNow\(PAGES\[i\]\);/, "chapter 'Read it to me'");
const episodes = find("public/sona.js", /const EPISODES = \[/, "EPISODES");

// library.html (Books) — live since 26 Sep 2026. Echo reads the cover and
// each page; a tapped word is said alone; and on a page with a key word he
// asks for it (the key-word moment), through saycheck.js's say().
const bookCover = find(LB, /readAlong\(BOOK\.title \+ "(! A story full of )" \+ sndLabel\(BOOK\.sound\)\.replace\(" \(v\)", ""\) \+ "( sounds\.)"\);/, "book cover line");
find(LB, /function sndLabel\(s\)\{ return \(window\.Sona&&Sona\.soundLabel\)\?Sona\.soundLabel\(s\):s; \}/, "book cover: the sound's label");
const bookEnd = find(LB, /say\("(The end! Great listening!)"\);/, "book end line");
const bookPage = find(LB, /readAlong\(pg\.t\)\.then\(function \(\) \{ if \(on && tok === momTok\) startMoment\(\); \}\);/, "book page read-aloud");
const bookHear = find(LB, /readAlong\(pg\.t\)\.then\(function \(\) \{\n\s*if \(tok !== momTok\) return;/, "book 'Hear it'");
find(LB, /var w = sp\.textContent\.replace\(\/\[\^a-zA-Z'\]\/g, ""\), tok = hush\(\);/, "book word tap: the word's letters");
const bookWordTap = find(LB, /readAlong\(w\)\.then\(function \(\) \{ if \(tok !== momTok \|\| !M\) return;/, "book word tap");
const bookAsk = find(LB, /SC\.say\(\(again \? "(One more time\.\.\. )" : "(Can you say\.\.\. )"\) \+ M\.word \+ "(\.)", function/, "book key-word ask");
const bookBye = find(LB, /SC\.say\("(Great trying\. Let's turn the page\.)", function/, "book: Echo's line after three tries");
const bookTries = find(LB, /if \(M\.tries < (\d+)\) return ask\(true\);/, "book: tries before the page turns");
find(LB, /M = \{ word: keyShown\(BOOK\.keys\[page\]\), tries: 0, ok: false, leaving: false \};/, "book key word: one per page, from BOOK.keys");
const bookAge = find(LB, /var age = parseInt\(profile\.childAge, 10\) \|\| 0, norm = \(window\.Sona && Sona\.soundNorm\) \? Sona\.soundNorm\(BOOK\.sound\) : null;\n\s*return !\(age && norm && age < norm\);/, "book key word: never asked below the sound's age");
const bookVoice = find(LB, /fetch\("\/api\/tts", \{ method: "POST", headers: \{ "Content-Type": "application\/json" \}, body: JSON\.stringify\(\{ text: text, voice: profile\.voiceId \|\| "" \}\)/, "the Books page's voice request");
const bookBrowser = find(LB, /var u = new SpeechSynthesisUtterance\(text\);/, "the Books page's browser-voice fallback");
find(LB, /var p = say\(text\), tok = sayToken;/, "readAlong() forwards to say()");
{
  const inReadAlong = (h) => src(LB).startsWith("say(text)", h.idx);
  const covered = [bookCover, bookEnd, bookPage, bookHear, bookWordTap, bookAsk, bookBye];
  for (const h of allIdx(LB, /(?<![\w$.])(say|readAlong)\(|SC\.say\(/)) {
    const text = src(LB);
    if (/function $/.test(text.slice(h.idx - 9, h.idx)) || text[h.idx + h.m[0].length] === ")" || inReadAlong(h)) continue;
    if (!covered.some((c) => h.idx >= c.idx && h.idx < c.end)) fail(`library.html has a spoken line the script does not know at ${cite(LB, h.idx)}: ${text.slice(h.idx, h.idx + 90).split("\n")[0]}\n  Add an anchor for it in tools/voicedoc.mjs.`);
  }
  coverAll(LB, TTS_CALL, [bookVoice], "a voice request"); coverAll(LB, SPEAK_CALL, [], "a voice call");
  coverAll(LB, /SpeechSynthesisUtterance\(/, [bookBrowser], "a browser-voice line", true);
}
// The key word as Echo shows and says it: stored lower-case, a name keeps its capital.
const keyShownFn = find(LB, /^    function keyShown\(word\) \{\n[\s\S]*?^    \}$/m, "function keyShown()");
const keyShownOf = (book, word) => new Function("BOOK", keyShownFn.m[0] + "\nreturn keyShown;")(book)(word);
// saycheck.js: the key-word moment's voice and mic. Only the Books page loads it.
const SCK = "public/saycheck.js";
const checkVoice = find(SCK, /fetch\("\/api\/tts", \{ method: "POST", headers: \{ "Content-Type": "application\/json" \}, body: JSON\.stringify\(\{ text: t, voice: prof\(\)\.voiceId \|\| "", stable: true \}\)/, "saycheck.js's voice request");
coverAll(SCK, TTS_CALL, [checkVoice], "a voice request"); coverAll(SCK, SPEAK_CALL, [], "a voice call");
coverAll(SCK, /(?<![\w$.])say\(/, []);
{
  const users = pagesLoading("/saycheck.js");
  if (users.join() !== "library.html") fail(`saycheck.js is now loaded by ${users.join(", ") || "no page"} — only the Books page spoke through it. Add the new page's lines to the script.`);
}
const STORIES = (0, eval)(find(LB, /var STORIES = (\[[\s\S]*?\n    \]);/, "STORIES table").m[1]);

// coach-call.html — every line is built by concatenation; render them with the page's own pieces.
const CC = "public/coach-call.html";
const ccText = src(CC);
function readExpr(text, i) {
  let depth = 0, out = "", q = null;
  for (; i < text.length; i++) {
    const c = text[i];
    if (q) { out += c; if (c === "\\") { out += text[++i]; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; out += c; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    if (c === ")" || c === "]" || c === "}") { if (depth === 0) break; depth--; }
    if (depth === 0 && (c === "," || c === ";")) break;
    out += c;
  }
  return out.trim();
}
const soundAskDef = find(CC, /var soundAsk=(.*);\n/, "soundAsk");
const CC_SUBS = [
  [/\(\(HIST\.lastSound&&S\.soundLabel\)\?S\.soundLabel\(HIST\.lastSound\):LETTER\)/g, "{letter}"],
  [/\(W1\.display\|\|W1\.t\)/g, "{word1}"], [/\(W2\.display\|\|W2\.t\)/g, "{word2}"],
  [/\(CUESHORT\|\|"[^"]*"\)/g, "{cue}"],
  [/\bBUDDYNAME\b/g, "{buddy}"], [/\bNAME\b/g, "{name}"], [/\bLETTER\b/g, "{letter}"],
];
function renderConcat(expr, extra) {
  let e = expr;
  for (const [re, to] of (extra || []).concat(CC_SUBS)) e = e.replace(re, JSON.stringify(to));
  const parts = []; let depth = 0, q = null, cur = "";
  for (let i = 0; i < e.length; i++) {
    const c = e[i];
    if (q) { cur += c; if (c === "\\") { cur += e[++i]; continue; } if (c === q) q = null; continue; }
    if (c === '"') { q = c; cur += c; continue; }
    if (c === "(") depth++; if (c === ")") depth--;
    if (c === "+" && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts.map((p) => { p = p.trim(); if (!/^"(?:[^"\\]|\\.)*"$/.test(p)) fail(`coach-call.html: cannot render "${p}" inside: ${expr}`); return JSON.parse(p); }).join("").replace(/\*/g, "");
}
const soundAsk = renderConcat(soundAskDef.m[1]);
const ccSubs = [[/\bsoundAsk\b/g, soundAsk]];
const ccLines = []; // {text, line, when}
{
  const region = { from: ccText.indexOf("function opener(){"), to: ccText.indexOf("var SCRIPT=") };
  if (region.from < 0 || region.to < 0) fail("coach-call.html: the script tables moved.");
  const add = (idx, expr, when) => {
    if (/^(opener\(\)|WARMUPS\[|BYES\[)/.test(expr)) return;
    ccLines.push({ text: renderConcat(expr, ccSubs), line: lineOf(CC, idx), when });
  };
  const opener = /function opener\(\)\{[\s\S]*?\n    \}/.exec(ccText);
  if (!opener) fail("coach-call.html: opener() moved.");
  for (const h of allIdx(CC, /return "/)) if (h.idx > opener.index && h.idx < opener.index + opener[0].length) add(h.idx, readExpr(ccText, h.idx + 7), "opener");
  for (const name of ["WARMUPS", "BYES"]) {
    const start = ccText.indexOf(`var ${name}=[`); if (start < 0) fail(`coach-call.html: ${name} moved.`);
    let i = start + `var ${name}=[`.length;
    while (true) {
      while (/\s/.test(ccText[i])) i++;
      if (ccText[i] === "]") break;
      const expr = readExpr(ccText, i); add(i, expr, name.toLowerCase()); i += expr.length; if (ccText[i] === ",") i++;
    }
  }
  const keys = /\b(say|line|pass|fail):\s*/g; let m;
  while ((m = keys.exec(ccText))) { if (m.index < region.from || m.index > region.to) continue; add(m.index, readExpr(ccText, m.index + m[0].length), { say: "Echo says", line: "ask", pass: "if the try passed", fail: "if the try missed" }[m[1]]); }
  const runFrom = ccText.indexOf("async function runStep"), runTo = ccText.indexOf("async function runCall");
  const calls = /await say\(/g;
  while ((m = calls.exec(ccText))) {
    if (m.index < runFrom || m.index > runTo) continue;
    const expr = readExpr(ccText, m.index + m[0].length);
    if (/^st\.(say|ask\.line|pass|fail)$/.test(expr)) continue;
    const pr = /^\(S&&S\.praiseLine\)\?S\.praiseLine\(\):"([^"]*)"$/.exec(expr);
    if (pr) { ccLines.push({ text: `{praise} — one of the five praise lines (fallback "${pr[1]}")`, line: lineOf(CC, m.index), when: "a retry passed, or the check could not tell" }); continue; }
    add(m.index, expr, "runStep");
  }
  ccLines.sort((a, b) => a.line - b.line);
  if (ccLines.length < 30) fail(`coach-call.html: only ${ccLines.length} lines rendered — the tables changed shape.`);
}

// A file that reaches the voice at all must be one this script reads: that is
// what makes "a page that gains a spoken line is in the sheet" true. (The
// picture games and the round games' power button speak through the shared
// scripts read above; the pages themselves hold no voice call.)
{
  const READ = [CH, FEED, SLICE, TILES, RUN, HELP, SAYPLAY, SCK, LB, SP, CK, ST, CP, CC, "public/sona.js"];
  for (const f of readdirSync(join(ROOT, "public")).filter((f) => f.endsWith(".html") || f.endsWith(".js"))) {
    const text = src("public/" + f);
    const m = /\/api\/tts|SpeechSynthesisUtterance/.exec(text) || SPEAK_CALL.exec(text);
    if (m && !READ.includes("public/" + f)) fail(`public/${f} now reaches Echo's voice at ${cite("public/" + f, m.index)} (${m[0]}) and this script does not read it. Add its lines to the sheet.`);
  }
  // Rachel's held demos (<SOUND>-demo.mp3) play nowhere but the parked Coach Call.
  for (const f of readdirSync(join(ROOT, "public")).filter((f) => (f.endsWith(".html") || f.endsWith(".js")) && "public/" + f !== CC)) {
    const m = /-demo\.mp3/.exec(src("public/" + f));
    if (m) fail(`public/${f} plays a <SOUND>-demo.mp3 at ${cite("public/" + f, m.index)} — only the parked Coach Call did. Part A says so; re-read it.`);
  }
}

// Dead helpers must stay dead.
{
  const pages = readdirSync(join(ROOT, "public")).filter((f) => (f.endsWith(".html") || f.endsWith(".js")) && f !== "sona.js" && f !== "gamecontent.js");
  for (const f of pages) {
    const text = src("public/" + f);
    const m = /\b(actionCue|repeatCue|coachLine|chats)\(/.exec(text);
    if (m) fail(`public/${f} calls ${m[1]}() at ${cite("public/" + f, m.index)} — that helper was dead. Move its line out of Part E.`);
  }
}
const deadActionCue = find("public/sona.js", /function actionCue\(sound, reps, action\) \{/, "actionCue");
const deadRepeatCue = find("public/sona.js", /function repeatCue\(sound\) \{/, "repeatCue");
const deadCoachLine = find("public/sona.js", /function coachLine\(sound, feedback\) \{/, "coachLine");
const cueFallback = find("public/sona.js", /function cue\(sound\) \{ return CUES\[sound\] \|\| \{ mouth: "[^"]*", tip: "([^"]*)" \}; \}/, "cue() fallback");
const praisesLine = find("public/sona.js", /const PRAISES = \[/, "PRAISES");
const cuesLine = find("public/sona.js", /const CUES = \{/, "CUES");
const soundSayLine = find("public/sona.js", /const SOUND_SAY = \{/, "SOUND_SAY");
const wordsLine = find("public/sona.js", /const WORDS = \{/, "WORDS");
const clipDir = join(ROOT, "public/coach/say");
for (const s of SOUNDS) for (const f of [`${s}.mp3`, `${s}-demo.mp3`]) if (!existsSync(join(clipDir, f))) fail(`public/coach/say/${f} is missing.`);
const CLIP_CAP_S = Number(find(CH, /function playMedia\(url,slow,job\)\{[\s\S]*?var timer=setTimeout\(function\(\)\{done\(null\);\},(\d+)\);/, "media clip cap (playMedia)").m[1]) / 1000;
// Seconds of an MP3 from its first frame header (CBR assumed; these are). Null if unreadable.
function mp3Seconds(buf) {
  let i = 0;
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) i = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]); // skip ID3v2
  for (; i < buf.length - 4; i++) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) continue;
    const ver = (buf[i + 1] >> 3) & 3, layer = (buf[i + 1] >> 1) & 3, bi = buf[i + 2] >> 4;
    if (ver === 1 || layer === 0 || bi === 0 || bi === 15) continue;
    const V1 = ver === 3, table = layer === 1 ? (V1 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]) : null;
    if (!table) return null;
    return (buf.length - i) / (table[bi] * 1000 / 8);
  }
  return null;
}

// ───────────────────────── the sheet ─────────────────────────
const out = [];
const P = (s = "") => out.push(s);
const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const cueOf = (s) => S.cue(s).tip;
const spokenName = (s) => soundNameOf(s);
const SOUND_TITLE = (s) => (s === "THV" ? "TH (voiced, as in 'the')" : s === "TH" ? "TH (as in 'thumb')" : s);
const totals = { fixed: 0, expansions: 0, fillers: 0, words: 0, distinct: 0, parked: 0 };
const bangLines = [roundEnd.m[1], win.m[1], chest.m[1], advEnd.m[1], quiet.m[1], sliceLead.m[2], sliceLead.m[1], ...ROUND_KEYS.map((k) => power[k].text), runLine.m[1], bookEnd.m[1], bookBye.m[1]].filter((l) => l.includes("!"));
let bN = 0, cN = 0;

P("# Echo's Recording Script");
P();
P("Every line Echo — the app's voice — can say out loud, in the exact words the code");
P("sends to the voice, with the file and line each one comes from. Generated from the");
P("live code by `node tools/voicedoc.mjs > VOICE_SCRIPT.md` (or `--write`); the");
P("generator stops with an error if a line it knows disappears or a new spoken line");
P("appears, so this sheet cannot drift from the app.");
P();
P("Five parts. **A** — the 19 sound models Rachel already recorded. **B** — the fixed");
P("lines to record, numbered. **C** — the lines with a blank in them (the prompt with a");
P("sound name and a count, the games' asks, the books) with the blanks filled in. **D** —");
P("the word bank. **E** — what NOT to record: parked, unlinked and dead lines.");
P();
P("## How to record");
P();
P("- **One take per row, a beat of silence at each end.** Trailing silence gets");
P("  trimmed; a clipped word ending cannot be recovered.");
P("- **Room tone matters more than the mic.** Soft furnishings, no fan, no laptop on");
P("  the table, phone on silent. Same room, same distance, for the whole set.");
P("- **Talk to one small child sitting next to you.** Calm, warm, unhurried. Full");
P("  stops, not exclamation marks — the practice lines were rewritten on 24 Sep 2026 so");
P(`  the voice does not jump. The fixed lines that still carry a "!": ${bangLines.map((l) => `"${l}"`).join(", ")}.`);
P("- **These get re-voiced afterwards** (ElevenLabs speech-to-speech). That keeps your");
P("  pacing, stress and warmth and changes only who it sounds like — so deliver for the");
P("  child, not for the mic. Timbre does not matter; timing and kindness do.");
P("- **Say the text exactly as printed.** Tests pin these strings character for");
P("  character (`tests/voicetest3.mjs`, `tests/micquietpracticetest.mjs`); a recording");
P("  that says something else needs a code change to match, which is fine — but it is");
P("  a decision, not an accident. Where the code says a letter name (\"make your R");
P("  sound\") you may perform the sound instead; which wording per sound is Rachel's call.");
P("- **Save as `<File name>.mp3`** (44.1 kHz, mono is fine), then run");
P("  `node tools/levelclips.mjs <folder>`: it brings every file to the loudness of a TTS");
P("  line (−20 dB RMS / −3 dB peak, with `/api/tts`'s own levelling), because a file");
P("  plays as-is, and an unlevelled one is the one sound that can still jump.");
P();
P(`Switch state right now: \`HUMAN_CLIPS = ${HUMAN_ON}\` (${humanSwitch.cite}) — Rachel's recorded sounds (Part A) are ${HUMAN_ON ? "ON: one take of the sound plays in the letter's place in the practice prompt (C1, C2, the turtle, B3) and after the games' \"…say\" lines (B5)" : "OFF"}; every word below is spoken through TTS.`);

// ── Part A ──
P();
P("---");
P();
P("## Part A — The 19 sound models (already recorded by Rachel)");
P();
P("**Do not re-record these unless Rachel says so — they are the clinical model.** She");
P("recorded them in July (`git show 7ad8219`): 19 practice prompts and 19 bare-sound");
P("demos in `public/coach/say/`. Each prompt clip is the whole opening line with the");
P("sound actually performed in it (her \"Ready?\" stitched on the front, a \"Go\" at the");
P("end — July wording, before the calm rewrite), because TTS cannot perform a stretched");
P("or popped sound. The one take of each sound that every game and the practice page play");
P("is cut from these, in her own voice (`tools/soundclips.mjs`, all 19 since 2 Oct 2026:");
P("re-voicing turned her L into an \"ee\" and her R toward W). Her whole lines and demos are");
P("also run through ElevenLabs speech-to-speech into Echo's voice by `tools/revoice.mjs`, into");
P("`public/coach/say-echo/` (25 Sep 2026). With the");
P("switch on, the C1 prompt for a sound is Echo's words with her one take in the letter's");
P("place, and `say-echo/<SOUND>.mp3` plays in its stead only when the voice service is down");
P(`(${voiceDown.cite}); \`say-echo/<SOUND>-demo.mp3\` is used only by the parked Coach Call.`);
P();
P("Continuants are **stretched** (held about 1.5 s); stops are **popped** (one crisp");
P("burst, never held — a held /p/ teaches a schwa the child then has to unlearn).");
P();
P("| # | Sound | On screen it shows | Stretch / pop | Rachel's files | Her mouth cue (shown under the target) |");
P("|---|---|---|---|---|---|");
SOUNDS.forEach((s, i) => {
  P(`| A${i + 1} | ${SOUND_TITLE(s)} | **${S.soundSay(s)}** | ${STRETCH.has(s) ? "STRETCH ~1.5 s" : "POP — crisp, no schwa"} | \`${s}.mp3\`, \`${s}-demo.mp3\` | ${esc(cueOf(s))} |`);
});
P();
P(`Sources: models ${soundSayLine.cite} (\`SOUND_SAY\`, shown on the practice card and the games' keep-playing card, never sent to TTS); cues ${cuesLine.cite} (\`CUES\`).`);
{
  const over = SOUNDS.map((s) => [s, mp3Seconds(readFileSync(join(clipDir, s + ".mp3")))]).filter(([, sec]) => sec != null && sec > CLIP_CAP_S);
  if (over.length) P(`\nEngineering note, not a recording note: the page cuts a clip at ${CLIP_CAP_S} s and then speaks the TTS prompt, and these prompt clips run longer than that: ${over.map(([s, sec]) => `${s} (${sec.toFixed(1)} s)`).join(", ")}. Trim them or raise the cap before the switch goes on.`);
}

// ── Part B ──
P();
P("---");
P();
P("## Part B — Fixed lines to record");
P();
P("Every live line that never changes. Today TTS speaks all of them; nothing in the");
P("app plays a file for these yet, so the file names are a proposal (one folder,");
P("`public/coach/lines/`) that the player can be built against. Numbered so you can");
P("tick them off. Delivery notes are one line each; the register for all of them is");
P("a grown-up talking softly to a small child.");
const bRows = [];
const B = (file, text, when, delivery, cite) => { bN++; totals.fixed++; bRows.push([`B${bN}`, file, text, when, delivery, cite]); };
const bTable = (title, intro) => {
  P(); P(`### ${title}`); if (intro) { P(); P(intro); }
  P(); P("| # | File | Say this | When Echo says it | Delivery | Source |"); P("|---|---|---|---|---|---|");
  bRows.splice(0).forEach((r) => P(`| ${r.map(esc).join(" | ")} |`));
};
S.PRAISES.forEach((p, i) => B(`praise-${i + 1}.mp3`, p, i === 0 ? `After the easier target (the "I have an idea" line, B3/C5) passes — one of the five, picked at random. The only spoken praise in the live app, and the win line (B45) follows it; a normal pass gets only the win line.` : "Same moment, random pick of five.", "Soft and pleased, a small smile in it. Not a cheer.", `${praisesLine.cite}; spoken at ${praise.cite}`));
bTable("B1 — Praise (5)", `Pinned as exactly this list with no "!" (\`tests/voicetest3.mjs\`).`);
SOUNDS.forEach((s) => B(`coach-${s}.mp3`, coach.m[1] + tipOf(s) + coach.m[2], `Once per round, when the on-device check heard a clearly different sound on ${SOUND_TITLE(s)}. Screen: "Almost! {cue} —" / "Try again — you've got this!". Then one retry of three tries.`, "Kind and unhurried. A helpful hint, never a correction. The mouth cue is Rachel's, word for word.", coach.cite));
bTable("B2 — Coaching after a miss (19)", `\`${coach.m[1]}{tip}${coach.m[2]}\` — the tip is Rachel's mouth cue cut at the dash (rule at ${tipRule.cite}).`);
SOUNDS.forEach((s) => B(`idea-${s}.mp3`, ideaSound(s), `After the retry ALSO missed on a syllable round of ${SOUND_TITLE(s)}: Echo steps down to the bare sound. Screen: "Echo's idea — say" / "An easier one — you've got this!". Then three tries.`, "Bright and easy, like a good idea just arrived. Not a consolation.", idea.cite));
bTable("B3 — Echo's idea, sound alone (19)", `\`${idea.m[1]}${idea.m[2]}{sound}${idea.m[3]}${idea.m[5]}\` — the same line with a syllable or a word in it is a template (C5). Where the code spells the letter name ("S H", "C H", "T H"), say the sound name as a person would.`);
B("roundend.mp3", roundEnd.m[1], "Round end when the retry (and the easier target, if there was one) still came back as the wrong sound. The game opens anyway; the win line is NOT spoken in this case.", "Warm and light. There is no disappointment in it — the child practised, and now they play.", roundEnd.cite);
B("win.mp3", win.m[1], `The win: five tries heard and the last check passed. Spoken ${afterChime.m[1]} ms after the win chime; the game loads 1.2 s later.`, "Quietly delighted. A full stop, not a fanfare.", win.cite);
B("chest.mp3", chest.m[1], `The treasure chest at the end of the adventure: after the child's third tap opens it, ${afterChime.m[1]} ms after the tap chime, while the sticker shows.`, "A small wonder, like peeking into a box together.", chest.cite);
B("adventure-end.mp3", advEnd.m[1], `Adventure end: when the fifth round's game hands back and the "Adventure complete!" card appears, ${afterChime.m[1]} ms after its chime.`, "Proud and settled, winding down.", advEnd.cite);
B("quiet.mp3", quiet.m[1], "The quiet screen: a listening window ended with nothing heard. Mic already closed. Screen: \"I couldn't hear you!\" / \"Say it big — I'm all ears!\" with Try again / Maybe later. Tapping Try again reopens the mic without re-speaking the prompt.", "Gentle and playful. This is the one line that kept its \"!\" on 24 Sep — \"Say it big\" is a production cue, so give it a little lift without shouting. Any rewording is Rachel's call.", quiet.cite);
bTable("B4 — Round end, win, chest, adventure end, quiet screen (5)");
P();
{
  const bare = S.soundSay("R"), secs = (ms) => Number(ms) / 1000;
  B("card-say.mp3", sliceLead.m[2], `${roundName("slice")}'s say-it card (between rounds, and its keep-playing card), when the card asks for the sound alone: Echo says this, then Rachel's recording of the sound plays (\`say-echo/<SOUND>-sound.wav\`, Part A), then the mic opens. Screen: "Say “${bare}” for wave 2!" or "…to keep playing!". When the card asks for a syllable or a word, the whole ask is one line instead (C7).`, "Friendly and plain. It runs straight into the sound, so leave it open at the end.", `${sliceLead.cite}; her sound at ${sliceSound.cite}`);
  B("card-idea.mp3", sliceLead.m[1], `${roundName("slice")}'s card, when a syllable or a word got no answer for ${secs(sliceWait.m[1])} s: the mic closes, the card goes back to the sound alone, Echo says this, then Rachel's recording plays. The practice page's own words for the same move (B3).`, "As B3: a good idea just arrived. Not a consolation.", `${sliceLead.cite}; the step back at ${sliceBack.cite}`);
  for (const k of ROUND_KEYS) B(`power-${k}.mp3`, power[k].text, `${roundName(k)}: the child taps Echo during a round. The game holds, Echo says this, then Rachel's recording of the sound plays and the mic opens.${power[k].once ? " Spoken the first time in a game only; after that the tap plays just the sound." : ""}`, `Short and bright. It runs straight into the sound, so leave it open at the end.${power[k].text.includes("!") ? ' Has a "!": a little lift, not a shout.' : ""}`, power[k].cite);
  B("sprint-howto.mp3", runLine.m[1], `${roundName("run")}'s start card, on a child's first ${NUMWORD[runRaces.m[1]] || runRaces.m[1]} races: after the tap on "Let's run!" Echo says this while the card stays, and the race starts when he stops ("Skip" ends it early).`, 'Clear and easy, one instruction at a time. Ends on a "!": a little lift, not a shout.', `${runLine.cite}; asked for at ${runVoice.cite}`);
}
bTable(`B5 — The round games (${2 + ROUND_KEYS.length + 1})`, `${roundName("slice")}'s say-it card, Echo's power button in all five round games (instruction at ${helpLine.cite}, her sound at ${helpSound.cite}), and ${roundName("run")}'s how-to-play line. None of them is spoken while Sona's sound is off (${[sliceMuted, helpMuted, runMuted].map((a) => a.cite.replace("public/", "")).join(", ")}). The lines ending in "say" are followed by the sound itself, which is Rachel's recording (Part A), never TTS.`);
B("book-end.mp3", bookEnd.m[1], 'The last page of every book ("The End!"), with the star and the chime.', 'Warm and pleased, winding down. Still has its "!".', bookEnd.cite);
B("book-turn.mp3", bookBye.m[1], `A book page's key word (C9): after ${NUMWORD[bookTries.m[1]] || bookTries.m[1]} tries that were a voice but not the book's kind of sound, Echo says this and the page turns. Screen: "Great trying! Let's turn the page."`, "Kind and light. The page turns on a good note.", bookBye.cite);
bTable("B6 — Books (2)");
P();
P("Not in this list because they speak nothing: Home, setup, settings, the voice");
P("picker, the mic-permission screens, the chest captions, every in-round label, and");
P(`the say-it card between rounds of ${ROUND_KEYS.slice(1).map(roundName).join(", ")} — their`);
P(`"Say “rrrr” to keep playing!" card is text only (${ROUND_KEYS.slice(1).map((k) => cardTitle[k].cite.replace("public/", "")).join(", ")}). See E8.`);

// ── Part C ──
P();
P("---");
P();
P("## Part C — Templates, with every blank filled");
P();
P("These lines have a blank in them. The template comes first, then the fillers, then");
P("the lines fully written out where the set is small enough to record as fixed clips.");
P("Numbered like Part B so they can be ticked off.");
const cRows = [];
const C = (file, text, when, cite) => { cN++; totals.expansions++; cRows.push([`C${cN}`, file, text, when, cite]); };
const cTable = () => { P(); P("| # | File | Say this | When | Source |"); P("|---|---|---|---|---|"); cRows.splice(0).forEach((r) => P(`| ${r.map(esc).join(" | ")} |`)); };
const needWord = (n) => NUMWORD[n];
const cuedTemplate = runSayLine({ ...TEMPLATE_ENV, ITEM: isoItem("R"), cued: false });
const plainTemplate = runSayLine({ ...TEMPLATE_ENV, ITEM: isoItem("R"), cued: true });
const targetTemplate = runSayLine({ ...TEMPLATE_ENV, ITEM: { t: "{target}", say: "{target}", display: "{target}", level: "syllable" }, cued: true });

P();
P("### C1 — The first prompt of a sound-alone round");
P();
P(`\`${cuedTemplate}\` (${promptStart.cite}, built at ${sayLineFn.cite})`);
P();
P("Spoken once, into a closed mic, right after the mic opens and the room is measured.");
P("Every session's first round is a sound-alone round, so a child hears this every day.");
P(`With the sound models on, Echo says the words and one take of Rachel's recorded sound (\`${SLOT.R.clip.replace("/R-", "/{SOUND}-")}\`, Part A) plays in the letter's place: "${SLOT.R.before} [${S.soundSay("R")}] ${SLOT.R.after}" (${soundSlotFn.cite}; spoken at ${promptCall.cite}).`);
P();
P("**Fillers.**");
P();
P("| Sound | {cue} — Rachel's tip cut at the first dash, \" like \" or comma | {sound} as the code spells it for TTS |");
P("|---|---|---|");
SOUNDS.forEach((s) => P(`| ${SOUND_TITLE(s)} | ${esc(cueShortOf(s))} | ${spokenName(s)} |`));
totals.fillers += SOUNDS.length * 2;
P();
P(`{n}: the number words the page knows are ${Object.keys(NUMWORD).map((k) => `${k} → "${NUMWORD[k]}"`).join(", ")} (${numword.cite}). The ones actually used: **${needWord(NEED_DEFAULT)}** on every normal prompt (\`CHARGE_NEED = ${NEED_DEFAULT}\`, ${chargeNeed.cite}) and **${retryNeeds.map(needWord).join("/")}** during a retry window after a miss (\`burstAndVerify(${retryNeeds.join("|")})\`, ${cite(CH, allIdx(CH, /burstAndVerify\(\d+\)/)[0].idx)}). The cued form can fire with "${needWord(retryNeeds[0])}" only when a syllable round stepped down to the sound and the child then tapped Echo.`);
P();
P(`Worth Rachel's eye: the comma/\"like\" cut leaves ${SOUNDS.filter((s) => cueShortOf(s).split(" ").length <= 2).map((s) => `"${cueShortOf(s)}" (${s})`).join(", ")} — a G round opens "${sayLine("G", isoItem("G"), NEED_DEFAULT, false)}". TH and THV are both spelled "T H", so only the cue tells them apart.`);
P();
P(`**All ${SOUNDS.length * NEEDS.length} lines.** Where the code says "make your R sound" you may perform the sound instead — that is the whole reason for a human recording. Delivery: even and calm; a short beat after "Ready?", the cue as a friendly reminder, the count plain.`);
for (const n of NEEDS) SOUNDS.forEach((s) => C(`prompt-${s}-cued-${n}.mp3`, sayLine(s, isoItem(s), n, false), n === NEED_DEFAULT ? `First prompt of a ${SOUND_TITLE(s)} sound-alone round.` : `Same, tapped during a retry window (${needWord(n)} tries).`, sayLineFn.cite));
cTable();

P();
P("### C2 — The prompt again (tap on Echo)");
P();
P(`\`${plainTemplate}\` (tap: ${promptTap.cite}; built at ${sayLineFn.cite})`);
P();
P("Every later prompt of the same sound-alone round: the child taps Echo (\"Tap Echo to");
P("hear it again\"). With the sound models on, her take sits in the letter's place here too.");
P(`**All ${SOUNDS.length * NEEDS.length} lines.**`);
for (const n of NEEDS) SOUNDS.forEach((s) => C(`prompt-${s}-${n}.mp3`, sayLine(s, isoItem(s), n, true), n === NEED_DEFAULT ? `Repeat prompt, ${SOUND_TITLE(s)}.` : `Repeat prompt during a retry window (${needWord(n)} tries).`, sayLineFn.cite));
cTable();

P();
P("### C3 — The prompt on a syllable, word or sentence round");
P();
P(`\`${targetTemplate}\` (${sayLineFn.cite}; targets from \`ladderContent\`)`);
P();
P("Round two onward of an adventure climbs sound → syllable → word → sentence, capped");
P("one rung above what the child has mastered. One target per round; the same line");
P("repeats on a tap. {n} as in C1. **Best left to TTS in the cloned voice** — the");
P("blank is a word, and words render fine; only bare sounds do not. Listed so nothing");
P("is hidden.");
P();
P(`**{target} = a syllable** — the sound's onset plus ah / ee / oo / oh / ay (${sylFn.cite}), except G's "gay" is "guy" and P's "poo" is "pie": two words a child is never asked to say (Travis, 30 Sep 2026); ${SOUNDS.length} × 5 = ${SOUNDS.length * 5} (TH and THV share the same five):`);
P();
P("| Sound | Syllables |");
P("|---|---|");
let sylCount = 0;
SOUNDS.forEach((s) => { const sy = SC.syllables(s).map((x) => x.t); sylCount += sy.length; P(`| ${SOUND_TITLE(s)} | ${sy.join(", ")} |`); });
totals.fillers += sylCount;
P();
P(`**{target} = a word** — the sound's words at the practice position: an SLP's homework position first, then the one chosen in Settings (\`Sona.practicePos()\`; default Beginning, and THV has no Beginning words, so all ten); any other bank word reaches this prompt when an SLP's homework names it. The whole bank is Part D (${wordsLine.cite}).`);
P();
P(`**{target} = a sentence** — one of ${SENTENCE_FRAMES.length} frames with a bank word dropped in (${sentFrames.cite}): ${SENTENCE_FRAMES.map((f) => `"${f}"`).join(", ")}. The word comes from the same practice position as the word round (homework first, then Settings; default Beginning; "Mixed" opens the whole bank), so ${SENTENCE_FRAMES.length} × ${Object.values(S.WORDS).reduce((a, b) => a + b.length, 0)} = ${SENTENCE_FRAMES.length * Object.values(S.WORDS).reduce((a, b) => a + b.length, 0)} sentences are possible; not expanded here.`);
P();
P(`Two things for Rachel here: the frames are applied blindly, so "I have a rain" and "Here is a bathe" are reachable — the same carrier-phrase problem the word bank once had; and the sentence's own full stop survives into the prompt ("Ready? Say I see a robot., five times." — \`display\` keeps it), harmless for TTS, but a recording should drop it.`);
totals.fillers += SENTENCE_FRAMES.length;

P();
P("### C4 — Hear it slooow (the turtle)");
P();
P(`Not a separate recording. The turtle pill replays the current line slowed to ${turtleRate.m[1]}× by the app (${turtleRate.cite}); on a sound-alone round that is the C1/C2 text, on any other round it is just the target — syllable, word, or sentence without its full stop (${turtle.cite}). On a sound-alone round with the sound models on, the slowed line has Rachel's take in the letter's place, slowed with it.`);

P();
P("### C5 — Echo's idea, with a syllable or a word");
P();
P(`\`${ideaTemplate}\` (${idea.cite})`);
P();
P("The step-down after two misses on a word or sentence round: {target} is a syllable");
P("(C3 list) or a word at the practice position (Part D) from one rung down. (Rarely — the");
P("fifth round for a child who has already mastered sentences — it can be a sentence.)");
P("The sound-alone form is fixed and sits in B3. Best left to TTS.");

P();
P("### C6 — Feed Echo");
P();
P(`\`${feedLine("{word}")}\` (${feedAsk.cite})`);
P();
P("Live, free, opened straight from Home. Echo asks this at the start of each of the");
P("five turns; the four pictures stay locked until he hears the word, and nothing is");
P("spoken on a right tap, a wrong tap or at the finish. If nothing is heard for");
P(`${Number(feedWait.m[1]) / 1000} s the mic closes and a mic button waits; a tap on it says \`${feedAgain.m[1]}{word}${feedAgain.m[2]}\``);
P(`(${feedAgain.cite}) and listens again. The sound is the one the child's rotation is on that`);
P("round (homework sounds first, else the child's focus sounds, else R); the pool is that sound's shortest");
P(`eight Beginning-position words with a picture (${feedPoolFn.cite}). The screen says "Where's" while the voice says "Where is".`);
P();
P("| Sound | {word} pool |");
P("|---|---|");
let feedCount = 0;
SOUNDS.forEach((s) => { const pool = feedPool(s).map((w) => w.w); feedCount += pool.length; P(`| ${SOUND_TITLE(s)} | ${pool.join(", ")} |`); });
totals.fillers += feedCount;
P();
P(`${feedCount} words, two lines each, if recorded as fixed clips (\`feed-<word>.mp3\`, \`feed-again-<word>.mp3\`); best left to TTS.`);

// C7 Fruit Slice's card
P();
P(`### C7 — ${roundName("slice")}'s say-it card, with a syllable or a word`);
P();
P(`\`${sliceAskLine("{ask}")}\` (${sliceAsk.cite})`);
P();
P(`The card between rounds of ${roundName("slice")}. When it asks for more than the sound alone, Echo`);
P("says the whole ask as ONE line in his own voice, the syllable or word last and after");
P("a pause, because nothing past the bare sound is recorded. The line is downloaded before");
P("the syllable is shown; if it does not come, or will not play, the card stays on the");
P(`sound alone and "${sliceLead.m[2]}" plus Rachel's recording plays instead (B5). What a card`);
P(`asks comes from one reader, \`Sona.gameAsk\` (${gameAskFn.cite}; which voice at ${gameAskVoice.cite}):`);
P("the sound alone, then one syllable a card, then a short word, as far as that child's");
P(`cards go. Screen: "Say “${(gameSteps(GAME_ON[0] || "R").syl[0]) || S.soundSay("R")}” for wave 2!". The card hears only a voice of the right`);
P("kind — it cannot tell a syllable from the bare sound — and nothing here says \"correct\".");
P(`The other four round games' cards are text and ask only the sound.`);
P();
P(`**{ask} = a syllable or the short word** — only for the sounds switched on in \`GAME_SYL_ON\` (${sylOn.cite}); today: ${GAME_ON.join(", ") || "none"}. One syllable a card, moving on one each day. The short word is \`GAME_SHORT\` (${gameShort.cite}). Never asked, \`GAME_SKIP\` (${gameSkip.cite}): ${Object.keys(SC.GAME_SKIP).map((s) => `${s} ${SC.GAME_SKIP[s].map((x) => `"${x}"`).join(", ")}`).join("; ")}.`);
P();
P("| Sound | Syllables, in order | Short word |");
P("|---|---|---|");
GAME_ON.forEach((s) => { const g = gameSteps(s); totals.fillers += g.syl.length + (g.word ? 1 : 0); P(`| ${SOUND_TITLE(s)} | ${g.syl.join(", ")} | ${g.word || "—"} |`); });
P();
P(`**{ask} can also be** a word from a speech therapist's homework for that sound, or the syllable or word the "Say it 5 times" page just ended on (it hands it over, so a card never asks below it). Those are C3's syllables and Part D's words; not expanded here.`);
P();
P(`Rachel's calls, built on defaults until she answers: which syllables and in what order, whether "${SC.GAME_SHORT.R || "rot"}" is the word, the lists for the other ${SOUNDS.length - GAME_ON.length} sounds, and Echo's TTS voice modelling a syllable at all.`);
P();
const cardLines = GAME_ON.reduce((a, s) => a + gameSteps(s).syl.length + (gameSteps(s).word ? 1 : 0), 0);
P(`**All ${cardLines} lines for the sounds switched on.** Best left to TTS; listed so nothing is hidden.`);
GAME_ON.forEach((s) => { const g = gameSteps(s); g.syl.concat(g.word ? [g.word] : []).forEach((a, i) => C(`card-${s}-${a}.mp3`, sliceAskLine(a), i < g.syl.length ? `${roundName("slice")}'s card asks ${SOUND_TITLE(s)} in a syllable.` : `${roundName("slice")}'s card asks ${SOUND_TITLE(s)} in a short word.`, sliceAsk.cite)); });
cTable();

// C8 the picture games
const spLive = spGames.filter((g) => !g.comingSoon), spSoon = spGames.filter((g) => g.comingSoon);
P();
P("### C8 — The picture games (Say & Play)");
P();
P(`\`${spLine("{word}")}\` (${spAsk.cite})`);
P();
P(`One shared script (\`sayplay.js\`) runs every picture game. Each turn shows a picture and`);
P("its word, Echo models the word with this line, then the mic opens. It is the only line");
P("these games speak: the cheers (\"Yes!\", \"You did it!\") are text. The sound is the one the");
P(`child's rotation is on (else R); the pool is up to ten of that sound's shortest`);
P(`Beginning-position words with a picture (${spPoolFn.cite}). **Best left to TTS.**`);
P();
P(`Live today (${spLive.length}): ${spLive.map((g) => g.name).join(", ") || "none"}. Coming soon (${spSoon.length}), the same line when they open: ${spSoon.map((g) => g.name).join(", ") || "none"}.`);
P();
P("| Sound | {word} pool |");
P("|---|---|");
let spCount = 0;
SOUNDS.forEach((s) => { const pool = spPool(s).map((w) => w.w); spCount += pool.length; P(`| ${SOUND_TITLE(s)} | ${pool.join(", ")} |`); });
totals.fillers += spCount;

// C9 Books
const bookPages = STORIES.reduce((a, b) => a + b.pages.length, 0);
const bookKeys = STORIES.reduce((a, b) => a + (b.keys || []).filter(Boolean).length, 0);
const coverLine = (b) => b.title + bookCover.m[1] + S.soundLabel(b.sound).replace(" (v)", "") + bookCover.m[2];
P();
P(`### C9 — Books (\`library.html\`): ${STORIES.length} books, ${bookPages} pages`);
P();
P("Live: Home's Books card opens the shelf. Echo reads everything in a book aloud.");
P("**Best left to TTS** — it is a lot of text, and it changes when a book does. Listed so");
P("nothing is hidden. Four templates, and two fixed lines (B6):");
P();
P(`- **The cover:** \`{title}${bookCover.m[1]}{sound}${bookCover.m[2]}\` (${bookCover.cite}) — {sound} is read as its letters ("R", "SH", "TH"). Written out under each book below.`);
P(`- **A page:** the page's text, read as the page opens (${bookPage.cite}) and again on "Hear it" (${bookHear.cite}).`);
P(`- **A tapped word:** that word alone (${bookWordTap.cite}).`);
P(`- **The key word:** ${bookKeys} of the ${bookPages} pages have one, shown in bold below. After reading the page Echo asks \`${bookAsk.m[2]}{word}${bookAsk.m[3]}\`; after a try that was a voice but not the book's kind of sound, \`${bookAsk.m[1]}{word}${bookAsk.m[3]}\` (${bookAsk.cite}); after ${NUMWORD[bookTries.m[1]] || bookTries.m[1]} of those, the B6 line and the page turns. A name keeps its capital. Silence never turns the page. A child younger than the age the book's sound usually arrives is never asked (${bookAge.cite}), and the first ask of a visit waits for a grown-up's yes to the mic. Screen: "Can you say {word}?".`);
totals.fillers += bookPages;
STORIES.forEach((b) => {
  const at = src(LB).indexOf(`title: ${JSON.stringify(b.title)}`);
  P(); P(`**${b.title}** — ${S.soundLabel(b.sound)}${b.season ? `, on the shelf ${b.season.startsOn} to ${b.season.endsOn}` : ""} (${cite(LB, at)}). Cover: "${coverLine(b)}"`); P();
  b.pages.forEach((pg, i) => { const k = b.keys && b.keys[i]; P(`${i + 1}. ${pg.t}${k ? ` — **${keyShownOf(b, k)}**` : ""}`); });
});

// C10 simple-play, for the games on it that are live
if (simpleLive.length) {
  P();
  P(`### C10 — ${simpleLive.map((g) => g.name).join(" and ")} (\`simple-play.js\`)`);
  P();
  P(`\`{word}\` — the bare word (${spWord.cite})`);
  P();
  P(`The only spoken line is the word alone, when the picture is revealed (${simpleSay.cite}) and on "Hear it" (${simpleHear.cite}) — the same per-sound pools as Feed Echo (C6). **Best left to TTS.**`);
}

// ── Part D ──
P();
P("---");
P();
P("## Part D — The word bank");
P();
P(`Every practice word, by sound and by where the sound sits in the word (${wordsLine.cite}).`);
P("**Best left to TTS in the cloned voice** — words render fine; only bare sounds do");
P("not. Listed so nothing is hidden, and because a word can reach the child three ways:");
P("the word rung and the sentence rung of a practice round (both at the practice position:");
P("homework's, else Settings', Beginning by default; any word an SLP's homework names), and Feed Echo");
P("(the shortest eight Beginning words with a picture).");
P();
const distinct = new Set();
let bankTotal = 0;
SOUNDS.forEach((s) => {
  const ws = S.WORDS[s]; bankTotal += ws.length;
  const groups = {}; ws.forEach((w) => { const p = w.pos || "i"; (groups[p] ??= []).push(w.w); distinct.add(w.w.toLowerCase()); });
  P(`**${SOUND_TITLE(s)} (${ws.length})** — ${Object.keys(groups).map((p) => `${posName(p)} (${groups[p].length}): ${groups[p].join(", ")}`).join(" · ")}`);
  P();
});
totals.words = bankTotal; totals.distinct = distinct.size;
P(`${bankTotal} entries, ${distinct.size} distinct words (a word can sit in more than one sound's list).`);

// ── Part E ──
P();
P("---");
P();
P("## Part E — Do not record yet: parked, unlinked and dead lines");
P();
P("Listed so nothing is hidden. **Parked** = the page exists but no page links to it");
P("(reachable only by a typed URL) or it shows \"coming soon\". **Unlinked** = same, for a");
P("page that was never in the app's flow. **Dead** = code that nothing calls. None of");
P("these reach a child today; if one comes back, its lines move up into B or C.");

// E1 stories
const chapterLines = S.EPISODES.reduce((a, e) => a + 1 + (e.beats || []).length, 0);
P();
P(`### E1 — Today's chapter (\`chapter.html\`, parked): ${S.EPISODES.length} chapters, ${chapterLines} spoken pages`);
P();
P(`The chapter reader was parked on 19 Sep 2026 and stayed parked when the picture books came back (C9); \`tests/day1.mjs\` pins that Home has no door to it. When the page opens, each page is read aloud as it turns — the chapter's opening line, then its six beats (${chapPages.cite}, ${chapSay.cite}); "Read it to me" says the same page again (${chapHear.cite}). Tomorrow's hook is shown on the finish card, not spoken. The table is \`EPISODES\` (${episodes.cite}). Read as a bedtime story if they ever come back: slower than the prompts, the last line of each page landing softly.`);
P();
P(`One fixed line: "${chapDone.m[1]}" — the finish card (${chapDone.cite}). Still has its "!" — the parked pages never got the calm rewrite.`);
totals.parked += 1;
S.EPISODES.forEach((ep, ei) => {
  const at = src("public/sona.js").indexOf(`t: ${JSON.stringify(ep.t)}`);
  P(); P(`**Chapter ${ei + 1} — ${ep.t}** (${at >= 0 ? cite("public/sona.js", at) : episodes.cite})`); P();
  [ep.open].concat(ep.beats || []).forEach((line, pi) => { totals.parked++; P(`${pi + 1}. ${line}`); });
});

// E2 story.html
P();
P("### E2 — Your Adventure (`story.html`, parked)");
P();
P(`No page opens it: the Books page keeps its tile hidden (${advTile.cite}), and it is gated behind \`Sona.gated('story')\`. Each page is read aloud when it opens (${storyPage.cite}) and on "Hear it" (${storyHear.cite}); then "${storyNowYou.m[1]}{word}${storyNowYou.m[2]}" (${storyNowYou.cite}); a heard try gets one of the five praise lines (${storyPraise.cite}); a missed one gets the bare word again (${storyRetry.cite}). The pages are normally an AI-written story from \`/api/story\` — unbounded text that cannot be pre-recorded. The fallback pages are ${STORY_FRAMES.length} frames with a bank word (${storyFrames.cite}): ${STORY_FRAMES.map((f) => `"${f}"`).join(", ")}.`);
totals.parked += 1 + STORY_FRAMES.length;

// E3 — the books moved out
P();
P("### E3 — Books: no longer parked");
P();
P("The picture books are live again; their lines are in B6 and C9. The number is kept so");
P("the sections after it keep theirs.");

// E4 simple-play, for the games on it that are still "coming soon"
P();
P(`### E4 — ${simpleSoon.length ? simpleSoon.map((g) => g.name).join(" and ") + " (`simple-play.js`, coming soon)" : "`simple-play.js`: nothing parked"}`);
P();
if (simpleSoon.length) {
  P(`"Coming soon" in the catalog, with a disabled Home card. The only spoken line is the bare **{word}** when the picture is revealed (${simpleSay.cite}) and on "Hear it" (${simpleHear.cite}) — the same per-sound pools as Feed Echo (C6).${simpleLive.length ? ` ${simpleLive.map((g) => g.name).join(" and ")} runs on the same script and is live (C10).` : ""}`);
  totals.parked += 1;
} else P("Every page built on this script is live (C10) or has moved to another script.");

// E5 check
P();
P("### E5 — Speech Check (`check.html`, unlinked)");
P();
P(`The ad-funnel page; nothing in the app links to it. "${checkAsk.m[1]}{word}" for each of ${checkWords.length} words in this order (${checkAsk.cite}): ${checkWords.map((w) => w.w).join(", ")}. It sends no voice id, so it always uses the default voice.`);
totals.parked += checkWords.length;

// E6 coach-call
P();
P(`### E6 — Coach Call (\`coach-call.html\`, parked): ${ccLines.length} lines`);
P();
P("No page links to it and without `?dev=1` it shows \"Coming soon\". Its lines still carry");
P("the old register — \"Go!\", CAPITALS, and [excited] / [whispers] / [happy] tags that are");
P("sent to the voice as text — and three asks read \"your very best your R sound\"");
P("because the sound phrase already starts with \"your\". Listed for completeness; skip");
P("unless the feature is revived, and then rewrite first. Blanks: {name} the child's");
P("name (default \"friend\"), {buddy} the buddy character (default \"Pip\"), {letter} the");
P("sound's label, {cue} the C1 cue, {word1}/{word2} the first two ladder words, {praise}");
P("one of the five praise lines.");
P();
P("| Line | Where | When |");
P("|---|---|---|");
ccLines.forEach((l) => { totals.parked++; P(`| ${esc(l.text)} | ${CC}:${l.line} | ${esc(l.when)} |`); });

// E7 dead
P();
P("### E7 — Dead code: never spoken");
P();
P(`- **The idle nudge** (${cite(CH, nudge.idx)}): would replay the prompt after ${Number(nudge.m[1]) / 1000} s of silence, up to twice. \`armIdle()\` is defined but never called; the not-heard path is the quiet screen (B4).`);
P(`- **"${praise.m[1]}"** (${praise.cite}): fallback praise only if \`praiseLine\` were missing — \`sona.js\` always provides it.`);
P(`- **"Let's try our {sound} sound again"** (${tipRule.cite}): fallback coaching only for a sound with no tip — all ${SOUNDS.length} have one.`);
P(`- **"${cueFallback.m[1]}"** (${cueFallback.cite}): the default cue for an unknown sound; the practice page forces the sound to one of the ${SOUNDS.length}.`);
P(`- **\`actionCue\`, \`repeatCue\`, \`coachLine\`** (${deadActionCue.cite}, ${deadRepeatCue.cite}, ${deadCoachLine.cite}): exported, no caller anywhere. Pre-calm wording — e.g. "${S.actionCue("R", NEED_DEFAULT)}", "${S.repeatCue("R")}", "${S.coachLine("R").replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim()}".`);
P(`- **The conversation rung** (${chatFrames.cite}): ${CHAT_FRAMES.map((f) => `"${f}"`).join(", ")} — the practice page keeps only items with a target (\`it.t\`) and these have none, so a conversation round falls back to the bare sound.`);
P(`- **The sound models as text** (${soundSayLine.cite}): ${SOUNDS.map((s) => S.soundSay(s)).join(", ")} — shown on screen, never sent to TTS, because a synthesized "rrrr" comes out mangled. The performed sound is Rachel's clip (Part A).`);

// E8 shown only
P();
P("### E8 — Shown on screen, never spoken (so nobody records them by mistake)");
P();
P("The mic primer (\"Let Echo hear you practice!\"), the \"That's okay!\" decline card, the");
P("mic-denied screen (\"Echo can't hear you yet!\"), the grown-up variant of the quiet");
P("screen (\"Let's get a grown-up\" / \"Another app may be using the microphone\"), the");
P("\"Adventure complete!\" / \"See you next time!\" cards, the chest captions (\"A treasure");
P("chest! Tap, tap, tap to open!\", \"Tap, tap!\", \"One more tap!\", \"You found the {sticker}");
P("sticker!\"), the in-round labels (\"Say\", \"Almost! {cue} —\", \"Try again — you've got");
P("this!\", \"Echo's idea — say\", \"YES! That's the one!\", \"Here we go!\", \"Say it {n}");
P("times\", \"Just 1 more!\", \"Tap Echo to hear it again\", \"Your turn\", \"Listen to Echo\"),");
P("the round games' \"Say “rrrr” to keep playing!\" card title (only Fruit Slice's card is");
P("also spoken: B5, C7) and their end cards, the picture games' cheers, the books' \"Can you");
P("say {word}?\" bubble, \"Your turn!\" and \"I heard you!\", and Feed Echo's");
P("\"Where's the {word}?\" / \"Say it out loud, then tap it!\" / \"Echo heard you!\".");

// E9 retired
P();
P("### E9 — Rows retired from the previous version of this sheet");
P();
P("The old sheet listed round prompts (\"Are you ready?\", \"Your turn!\", \"Now you try!\"),");
P("navigation lines (\"Hi! I'm Echo. Let's practice together!\", \"Read today's story to");
P("unlock your games!\", \"Bye for now!\") and extra praise (\"You filled it up! Open your");
P("chest!\", \"That's three days in a row!\") under folders `public/coach/model/`,");
P("`public/coach/praise/`, `public/coach/ui/`. The app never spoke any of them (two survive");
P("only as dead helpers, E7, and two as on-screen text) and never loaded audio from those");
P("folders; they were a wish-list. They are gone, and so is the old `tools/voicepage.mjs`.");

// Totals
P();
P("---");
P();
P(`**Totals.** Part A: ${SOUNDS.length} sound models (${SOUNDS.length * 2} files, Rachel's). Part B: **${totals.fixed} fixed clips** to record. Part C: **${totals.expansions} template lines written out** (C1 ${SOUNDS.length * NEEDS.length} + C2 ${SOUNDS.length * NEEDS.length} + C7 ${cardLines}) plus ${totals.fillers} fillers listed (${SOUNDS.length} cues, ${SOUNDS.length} sound names, ${sylCount} syllables, ${SENTENCE_FRAMES.length} sentence frames, ${feedCount} Feed Echo words, ${cardLines} game-card asks, ${spCount} picture-game words, ${bookPages} book pages in ${STORIES.length} books). Part D: **${totals.words} bank entries, ${totals.distinct} distinct words** (TTS). Part E: ${totals.parked} parked/unlinked lines not to record (${chapterLines} chapter pages, ${ccLines.length} Coach Call, ${checkWords.length} Speech Check, the rest single lines).`);
P();
P(`Record B first (${totals.fixed} lines — an hour), then C1 and C2 (${SOUNDS.length * NEEDS.length * 2} lines, where you perform the sound), and stop there: the rest of Part C and Part D are words, and words are what TTS already does well.`);

// ───────────────────────── write / check / print ─────────────────────────
const text = out.join("\n") + "\n";
const argv = process.argv.slice(2);
if (argv.includes("--check")) {
  const cur = existsSync(OUT_PATH) ? readFileSync(OUT_PATH, "utf8") : "";
  if (cur !== text) { process.stderr.write("VOICE_SCRIPT.md is stale — run: node tools/voicedoc.mjs --write\n"); process.exit(1); }
  process.stderr.write(`VOICE_SCRIPT.md is current (${totals.fixed} fixed, ${totals.expansions} expansions, ${totals.words} words).\n`);
} else if (argv.includes("--write")) {
  writeFileSync(OUT_PATH, text);
  process.stderr.write(`wrote VOICE_SCRIPT.md: ${totals.fixed} fixed, ${totals.expansions} expansions, ${totals.words} words, ${totals.parked} parked.\n`);
} else {
  process.stdout.write(text);
}
