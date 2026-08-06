// Emits the recording page Rachel actually works from, using the same content
// tables as VOICE_SCRIPT.md so the sheet and the page can never disagree.
//   node tools/voicepage.mjs > /tmp/voice-script.html
import { readFileSync } from "fs";

globalThis.window = {};
globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
globalThis.location = { search: "" };
globalThis.document = { addEventListener() {}, documentElement: {} };
(0, eval)(readFileSync(new URL("../public/sona.js", import.meta.url), "utf8"));
const S = window.Sona;

const STRETCH = new Set(["R", "S", "L", "F", "V", "SH", "TH", "THV", "Z", "M", "N"]);
const sections = [];
const sec = (id, title, folder, note) => { const s = { id, title, folder, note, rows: [] }; sections.push(s); return s; };
const add = (s, file, text, note, kind) => s.rows.push({ file, text, note: note || "", kind: kind || "" });

const s1 = sec("models", "Sound models", "public/coach/model/",
  "The clinical core — do these first. Continuants are held; stops are not. A held /p/ teaches a schwa the child then has to unlearn.");
S.ALL_SOUNDS.forEach((snd) => add(s1, `model-${snd}.mp3`, S.soundSay(snd), `/${snd}/`, STRETCH.has(snd) ? "stretch" : "pop"));
S.ALL_SOUNDS.forEach((snd) => {
  const tip = (S.CUES[snd] || {}).tip;
  if (tip) add(s1, `cue-${snd}.mp3`, tip.replace(/\p{Extended_Pictographic}/gu, "").trim(), `placement cue · /${snd}/`, "line");
});

const s2 = sec("prompts", "Round prompts", "public/coach/say/",
  "Said at the top of a round. The target sound is spliced in at runtime, so leave a clean beat at the ellipsis.");
[["ask-ready", "Are you ready?", "opens a round"], ["ask-yourturn", "Your turn!", ""],
 ["ask-again", "Let's try that again.", "after a miss — warm, never disappointed"], ["ask-onemore", "One more time!", ""],
 ["ask-listen", "Listen…", "before a model"], ["ask-nowyou", "Now you try!", "after a model"],
 ["ask-repeat", "Repeat after me…", ""], ["ask-louder", "A little louder!", ""],
 ["ask-slow", "Nice and slow.", ""], ["ask-great-listening", "Great listening!", ""]]
  .forEach(([f, t, n]) => add(s2, f + ".mp3", t, n, "line"));

const s3 = sec("praise", "Praise", "public/coach/praise/",
  "These fire constantly. Give each a different energy so a child hears a person, not a soundboard.");
const ENERGY = ["warm", "quick", "big", "delighted", "surprised", "proud"];
S.PRAISES.forEach((p, i) => add(s3, `praise-${i + 1}.mp3`, p, ENERGY[i] || "", "line"));
[["praise-chest", "You filled it up! Open your chest!", "daily goal hit"],
 ["praise-streak", "That's three days in a row!", "streak"],
 ["praise-done", "All done for today. See you tomorrow!", "end of session"]]
  .forEach(([f, t, n]) => add(s3, f + ".mp3", t, n, "line"));

S.EPISODES.forEach((ep, ei) => {
  const s = sec(`ch${ei + 1}`, `Chapter ${ei + 1} — ${ep.t}`, "public/coach/story/",
    "Read as a bedtime story: slower than the prompts, each page landing softly. The hook is a cliffhanger — give it mischief.");
  add(s, `ch${ei + 1}-title.mp3`, ep.t, "title card", "line");
  add(s, `ch${ei + 1}-p1.mp3`, ep.open, "page 1", "line");
  (ep.beats || []).forEach((b, bi) => add(s, `ch${ei + 1}-p${bi + 2}.mp3`, b, `page ${bi + 2}`, "line"));
  add(s, `ch${ei + 1}-hook.mp3`, ep.hook, "tomorrow's hook", "line");
});

const s5 = sec("ui", "Navigation & UI", "public/coach/ui/", "Short, friendly, never robotic.");
[["ui-welcome", "Hi! I'm Echo. Let's practice together!", "first launch"],
 ["ui-welcomeback", "You're back! I missed you.", "comeback greeting"],
 ["ui-storyfirst", "Read today's story to unlock your games!", "the daily gate"],
 ["ui-unlocked", "You did it! Three games are unlocked.", "story finished"],
 ["ui-locked", "Not yet! Finish the story first.", "tapping a locked game"],
 ["ui-tapstart", "Tap to start!", ""],
 ["ui-micplease", "I need to hear you — can you turn on the microphone?", "mic denied"],
 ["ui-goodbye", "Bye for now!", ""]].forEach(([f, t, n]) => add(s5, f + ".mp3", t, n, "line"));

let idx = 0;
sections.forEach((s) => s.rows.forEach((r) => { r.n = ++idx; }));
const TOTAL = idx;
console.log(JSON.stringify({ sections, total: TOTAL }, null, 0));
