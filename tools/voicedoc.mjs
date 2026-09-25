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
//      Echo's ask; the parked readers; Coach Call) is located by an anchor
//      regex on the exact source, and where a page BUILDS a line (sayLine,
//      soundName, the cue-shortening rule) the page's own function is lifted
//      out and executed, so the printed text is the page's text.
//
// FAILS LOUDLY, on purpose. An anchor that no longer matches, a say() call
// the anchors do not cover, a parked page that gained a link, a "dead" helper
// that gained a caller — each throws, prints why, and exits 1 with nothing on
// stdout. That is the point: a line cannot quietly vanish from or appear in
// the app without this script being looked at. When it fires, read the
// message, look at the diff, and update the anchor (and the sheet).
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
const promptCall = find(CH, /return human\?queueSpeech\(null,false,human,sayLine\):say\(sayLine\(\)\);/, "playPrompt");
const humanPath = find(CH, /var human=ITEM\.level==="isolation"&&HUMANCLIPS\?"\/coach\/say\/"\+SOUND\+"\.mp3":null;/, "human clip path");
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
    if (!/^queueSpeech\((null,false,human,sayLine|t,false,null,null|t,true,null,null)\)/.test(s)) fail(`charge.html has a queueSpeech() call the script does not know at ${cite(CH, h.idx)}: ${s}`);
  }
}

// ───────────────────────── Feed Echo (live) ─────────────────────────
const FEED = "public/arcade-feed.html";
const feedAsk = find(FEED, /say\("(Where is the )"\+target\.w\+"(\? Say\.\.\. )"\+target\.w\+"(\.)"\)/, "Feed Echo ask");
const feedPoolFn = find(FEED, /^    function pool\(sound\)\{.*\}$/m, "Feed Echo word pool");
const feedPool = new Function("S", feedPoolFn.m[0] + "\nreturn pool;")(S);
find(FEED, /var SOUND=\(S&&S\.rotSound\)\?S\.rotSound\(\):"R";/, "Feed Echo sound");
{
  const text = src(FEED); const re = /(?<![\w$.])say\(/g; let m;
  while ((m = re.exec(text))) {
    if (/function $/.test(text.slice(m.index - 9, m.index))) continue;
    if (m.index < feedAsk.idx || m.index >= feedAsk.end) fail(`arcade-feed.html has a spoken line the script does not know at ${cite(FEED, m.index)}: ${text.slice(m.index, m.index + 80)}`);
  }
}
const feedLine = (w) => feedAsk.m[1] + w + feedAsk.m[2] + w + feedAsk.m[3];
// The five arcade games speak nothing; the keep-playing card is text.
const ARCADE = ["arcade-slice", "arcade-tiles", "arcade-stack", "arcade-run", "arcade-glide"].map((n) => "public/" + n + ".html");
const keepPlaying = ARCADE.map((f) => {
  const h = find(f, /\$\("revTitle"\)\.textContent="Say \\u201C"\+SAYTXT\+"\\u201D to keep playing!";/, "keep-playing card title");
  const text = src(f); const re = /(?<![\w$.])(say|speak|speakNow)\(/g; let m;
  while ((m = re.exec(text))) fail(`${f} now speaks at ${cite(f, m.index)} — the arcade games were silent; add it to the script.`);
  return h.cite;
});

// ───────────────────────── parked / unlinked pages ─────────────────────────
const PARKED_PAGES = ["story.html", "library.html", "chapter.html", "check.html", "coach-call.html", "arcade-bubbles.html", "arcade-peekaboo.html"];
function linkGuard() {
  const files = readdirSync(join(ROOT, "public")).filter((f) => f.endsWith(".html") && !PARKED_PAGES.includes(f));
  for (const f of files) {
    const text = src("public/" + f);
    const re = new RegExp(`(href=|location\\.(href|replace|assign)\\s*[=(]\\s*|window\\.open\\()["']/?(${PARKED_PAGES.map((p) => p.replace(".", "\\.")).join("|")})`, "g");
    let m; while ((m = re.exec(text))) fail(`public/${f} links to ${m[3]} at ${cite("public/" + f, m.index)} — that page was parked or unlinked. Move its lines out of Part E.`);
  }
}
linkGuard();
if (!S.GAME_ACTS.bubbles.comingSoon || !S.GAME_ACTS.peekaboo.comingSoon) fail("Bubble Pop / Peekaboo are no longer comingSoon in GAME_ACTS — move their line out of Part E.");
find("public/coach-call.html", /if\(!DEVMODE\)\{\n\s*\$\("ringOvl"\)\.style\.display="none";\n\s*\$\("soonOvl"\)\.classList\.add\("show"\);/, "Coach Call 'coming soon' gate");

// simple-play.js (Bubble Pop / Peekaboo): the bare word
const SP = "public/simple-play.js";
const spWord = find(SP, /body: JSON\.stringify\(\{ text: word, voice: profile\.voiceId \|\| "", stable: true \}\)/, "simple-play word request");
find(SP, /S\.wordsFor\(sound, "i"\) \|\| \[\] : \[\]\)\.filter\(function \(w\) \{ return w && w\.w && w\.e; \}\)\n\s*\.sort\(function \(a, b\) \{ return a\.w\.length - b\.w\.length; \}\)\.slice\(0, 8\);/, "simple-play word pool (same rule as Feed Echo)");
for (const p of ["public/arcade-bubbles.html", "public/arcade-peekaboo.html"]) if (!src(p).includes("simple-play.js")) fail(`${p} no longer loads simple-play.js`);

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
const GC = "public/gamecontent.js";
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

// library.html (Books)
const LB = "public/library.html";
const bookCover = find(LB, /say\(BOOK\.title \+ "(! A story full of )" \+ BOOK\.sound \+ "( sounds\.)"\);/, "book cover line");
const bookEnd = find(LB, /say\("(The end! Great listening!)"\);/, "book end line");
const bookPage = find(LB, /readAlong\(pg\.t\);/, "book page read-aloud");
const bookWordTap = find(LB, /readAlong\(sp\.textContent\.replace\(\/\[\^a-zA-Z'\]\/g, ""\)\);/, "book word tap");
const bookHear = find(LB, /say\(BOOK\.pages\[page\]\.t\); \};/, "book 'Hear it'");
const wordBox = find(LB, /say\(w\.w\); \};/, "word box");
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
P("sound name and a count, Feed Echo's ask) with every blank filled in. **D** — the");
P("word bank. **E** — what NOT to record: parked, unlinked and dead lines.");
P();
P("## How to record");
P();
P("- **One take per row, a beat of silence at each end.** Trailing silence gets");
P("  trimmed; a clipped word ending cannot be recovered.");
P("- **Room tone matters more than the mic.** Soft furnishings, no fan, no laptop on");
P("  the table, phone on silent. Same room, same distance, for the whole set.");
P("- **Talk to one small child sitting next to you.** Calm, warm, unhurried. Full");
P("  stops, not exclamation marks — every live line was rewritten on 24 Sep 2026 so");
P("  the voice does not jump. The one \"!\" line left is the quiet screen (row noted).");
P("- **These get re-voiced afterwards** (ElevenLabs speech-to-speech). That keeps your");
P("  pacing, stress and warmth and changes only who it sounds like — so deliver for the");
P("  child, not for the mic. Timbre does not matter; timing and kindness do.");
P("- **Say the text exactly as printed.** Tests pin these strings character for");
P("  character (`tests/voicetest3.mjs`, `tests/micquietpracticetest.mjs`); a recording");
P("  that says something else needs a code change to match, which is fine — but it is");
P("  a decision, not an accident. Where the code says a letter name (\"make your R");
P("  sound\") you may perform the sound instead; which wording per sound is Rachel's call.");
P("- **Save as `<File name>.mp3`** (44.1 kHz, mono is fine). Level the finished set");
P("  to about −20 dB RMS / −3 dB peak so a recording sits at the same loudness as a");
P("  TTS line (`/api/tts` levels its output to that; a file plays as-is).");
P();
P(`Switch state right now: \`HUMAN_CLIPS = ${HUMAN_ON}\` (${humanSwitch.cite}) — Rachel's clips are ${HUMAN_ON ? "ON" : "OFF"}; the app speaks every line below through TTS.`);

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
P("or popped sound. With the switch on, `<SOUND>.mp3` plays *in place of* the C1 prompt");
P(`for that sound (${humanPath.cite}); \`<SOUND>-demo.mp3\` is used only by the parked Coach Call.`);
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
P("Not in this list because they speak nothing: Home, setup, settings, the voice");
P("picker, the five arcade games (Fruit Slice, Piano Tiles, Block Stacker, Sound");
P(`Sprint, Flappy Glide — their "Say “rrrr” to keep playing!" card is text only: ${keepPlaying.map((c) => c.replace("public/", "")).join(", ")}),`);
P("the mic-permission screens, the chest captions and every in-round label. See E8.");

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
P(`With Rachel's clips on, \`/coach/say/{SOUND}.mp3\` plays instead (${promptCall.cite}).`);
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
P("hear it again\"). With Rachel's clips on, the tap replays her clip instead.");
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
P(`**{target} = a syllable** — the sound's onset plus ah / ee / oo / oh / ay (${sylFn.cite}); ${SOUNDS.length} × 5 = ${SOUNDS.length * 5} (TH and THV share the same five):`);
P();
P("| Sound | Syllables |");
P("|---|---|");
let sylCount = 0;
SOUNDS.forEach((s) => { const sy = SC.syllables(s).map((x) => x.t); sylCount += sy.length; P(`| ${SOUND_TITLE(s)} | ${sy.join(", ")} |`); });
totals.fillers += sylCount;
P();
P(`**{target} = a word** — by default the sound's Beginning-position words (THV has none, so all ten); any other bank word reaches this prompt when an SLP's homework names it. The whole bank is Part D (${wordsLine.cite}).`);
P();
P(`**{target} = a sentence** — one of ${SENTENCE_FRAMES.length} frames with a bank word dropped in (${sentFrames.cite}): ${SENTENCE_FRAMES.map((f) => `"${f}"`).join(", ")}. The word comes from the position chosen in Settings (default Beginning; "Mixed" opens the whole bank), so ${SENTENCE_FRAMES.length} × ${Object.values(S.WORDS).reduce((a, b) => a + b.length, 0)} = ${SENTENCE_FRAMES.length * Object.values(S.WORDS).reduce((a, b) => a + b.length, 0)} sentences are possible; not expanded here.`);
P();
P(`Two things for Rachel here: the frames are applied blindly, so "I have a rain" and "Here is a bathe" are reachable — the same carrier-phrase problem the word bank once had; and the sentence's own full stop survives into the prompt ("Ready? Say I see a robot., five times." — \`display\` keeps it), harmless for TTS, but a recording should drop it.`);
totals.fillers += SENTENCE_FRAMES.length;

P();
P("### C4 — Hear it slooow (the turtle)");
P();
P(`Not a separate recording. The turtle pill replays the current line slowed to ${turtleRate.m[1]}× by the app (${turtleRate.cite}); on a sound-alone round that is the C1/C2 text, on any other round it is just the target — syllable, word, or sentence without its full stop (${turtle.cite}). Always the TTS text today, even with Rachel's clips on; if recordings ship, the turtle needs to slow the recording.`);

P();
P("### C5 — Echo's idea, with a syllable or a word");
P();
P(`\`${ideaTemplate}\` (${idea.cite})`);
P();
P("The step-down after two misses on a word or sentence round: {target} is a syllable");
P("(C3 list) or a Beginning-position word (Part D) from one rung down. (Rarely — the");
P("fifth round for a child who has already mastered sentences — it can be a sentence.)");
P("The sound-alone form is fixed and sits in B3. Best left to TTS.");

P();
P("### C6 — Feed Echo");
P();
P(`\`${feedLine("{word}")}\` (${feedAsk.cite})`);
P();
P("Live, free, opened straight from Home. Echo asks this at the start of each of the");
P("five turns, before the child taps one of four pictures; nothing is spoken on a right");
P("tap, a wrong tap or at the finish. The sound is the one the child's rotation is on that");
P("round (homework sounds first, else the child's focus sounds, else R); the pool is that sound's shortest");
P(`eight Beginning-position words with a picture (${feedPoolFn.cite}). The screen says "Where's" while the voice says "Where is".`);
P();
P("| Sound | {word} pool |");
P("|---|---|");
let feedCount = 0;
SOUNDS.forEach((s) => { const pool = feedPool(s).map((w) => w.w); feedCount += pool.length; P(`| ${SOUND_TITLE(s)} | ${pool.join(", ")} |`); });
totals.fillers += feedCount;
P();
P(`${feedCount} lines if recorded as fixed clips (\`feed-<word>.mp3\`); best left to TTS.`);

// ── Part D ──
P();
P("---");
P();
P("## Part D — The word bank");
P();
P(`Every practice word, by sound and by where the sound sits in the word (${wordsLine.cite}).`);
P("**Best left to TTS in the cloned voice** — words render fine; only bare sounds do");
P("not. Listed so nothing is hidden, and because a word can reach the child three ways:");
P("the word rung of a practice round (Beginning words by default; any word an SLP's");
P("homework names), the sentence rung (the position chosen in Settings), and Feed Echo");
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
P(`The books were parked on 19 Sep 2026 ("coming soon" on Home); \`tests/day1.mjs\` pins that Home has no door. When the page opens, each page is read aloud as it turns — the chapter's opening line, then its six beats (${chapPages.cite}, ${chapSay.cite}); "Read it to me" says the same page again (${chapHear.cite}). Tomorrow's hook is shown on the finish card, not spoken. The table is \`EPISODES\` (${episodes.cite}). Read as a bedtime story if they ever come back: slower than the prompts, the last line of each page landing softly.`);
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
P(`Reachable only from the parked books page and gated behind \`Sona.gated('story')\`. Each page is read aloud when it opens (${storyPage.cite}) and on "Hear it" (${storyHear.cite}); then "${storyNowYou.m[1]}{word}${storyNowYou.m[2]}" (${storyNowYou.cite}); a heard try gets one of the five praise lines (${storyPraise.cite}); a missed one gets the bare word again (${storyRetry.cite}). The pages are normally an AI-written story from \`/api/story\` — unbounded text that cannot be pre-recorded. The fallback pages are ${STORY_FRAMES.length} frames with a bank word (${storyFrames.cite}): ${STORY_FRAMES.map((f) => `"${f}"`).join(", ")}.`);
totals.parked += 1 + STORY_FRAMES.length;

// E3 library
const bookPages = STORIES.reduce((a, b) => a + b.pages.length, 0);
P();
P(`### E3 — Books (\`library.html\`, parked): ${STORIES.length} books, ${bookPages} pages`);
P();
P(`Cover: "{title}${bookCover.m[1]}{sound}${bookCover.m[2]}" (${bookCover.cite}) — the sound is read as its letter, "R sounds". Each page is read aloud as it opens and on "Hear it" (${bookPage.cite}, ${bookHear.cite}); tapping any word says that word (${bookWordTap.cite}); the word box at the bottom says any bank word alone (${wordBox.cite}). Last page: "${bookEnd.m[1]}" (${bookEnd.cite}).`);
totals.parked += STORIES.length + 1;
STORIES.forEach((b) => {
  const at = src(LB).indexOf(`title: ${JSON.stringify(b.title)}`);
  P(); P(`**${b.title}** — ${b.sound} (${cite(LB, at)})`); P();
  b.pages.forEach((pg, i) => { totals.parked++; P(`${i + 1}. ${pg.t}`); });
});

// E4 simple-play
P();
P("### E4 — Bubble Pop and Peekaboo (`simple-play.js`, parked)");
P();
P(`Both are "coming soon" in the catalog and their Home cards are disabled. The only spoken line is the bare **{word}** when the bubble pops or the door opens, and on "Hear it" (${spWord.cite}) — the same per-sound pools as Feed Echo (C6).`);
totals.parked += 1;

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
P("the games' \"Say “rrrr” to keep playing!\" card and their end cards, and Feed Echo's");
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
P(`**Totals.** Part A: ${SOUNDS.length} sound models (${SOUNDS.length * 2} files, Rachel's). Part B: **${totals.fixed} fixed clips** to record. Part C: **${totals.expansions} template lines written out** (C1 ${SOUNDS.length * NEEDS.length} + C2 ${SOUNDS.length * NEEDS.length}) plus ${totals.fillers} fillers listed (${SOUNDS.length} cues, ${SOUNDS.length} sound names, ${sylCount} syllables, ${SENTENCE_FRAMES.length} sentence frames, ${feedCount} Feed Echo words). Part D: **${totals.words} bank entries, ${totals.distinct} distinct words** (TTS). Part E: ${totals.parked} parked/unlinked lines not to record (${chapterLines} chapter pages, ${bookPages} book pages, ${ccLines.length} Coach Call, ${checkWords.length} Speech Check, the rest single lines).`);
P();
P(`Record B first (${totals.fixed} lines — an hour), then C1 and C2 (${SOUNDS.length * NEEDS.length * 2} lines, where you perform the sound), and stop there: Parts C3–C6 and D are words, and words are what TTS already does well.`);

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
