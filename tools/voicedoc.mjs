// Regenerates VOICE_SCRIPT.md from the app's own copy, so the recording sheet
// can never drift from the lines that actually ship.
//   node tools/voicedoc.mjs > VOICE_SCRIPT.md
import { readFileSync } from "fs";

globalThis.window = {};
globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
globalThis.location = { search: "" };
globalThis.document = { addEventListener() {}, documentElement: {} };
// sona.js is a browser IIFE; eval it against the stubs above to read its content tables
(0, eval)(readFileSync(new URL("../public/sona.js", import.meta.url), "utf8"));
const S = window.Sona;

const out = [];
const P = (s) => out.push(s);
let n = 0;
const row = (file, text, note) => { n++; P(`| ${n} | \`${file}\` | ${String(text).replace(/\|/g, "\\|")} | ${note || ""} |`); };
const head = () => P("\n| # | File name | Say this | Notes |\n|---|---|---|---|");

P("# Sona — Voice Recording Script");
P("");
P("Every line the app can speak, generated from `public/sona.js` so it can't drift");
P("from what actually ships. Regenerate with `node tools/voicedoc.mjs > VOICE_SCRIPT.md`.");
P("");
P("**How to record.** One take per row, a beat of silence at each end — trailing");
P("silence gets trimmed, clipped word endings can't be recovered. Room tone matters");
P("more than mic quality: soft furnishings, no fan, no laptop on the table.");
P("Save as `<File name>.mp3` (or .wav) in the folder named at the top of each");
P("section. A row you skip falls back to the synthetic voice, so partial delivery");
P("is fine — record the sound models first, they carry the clinical weight.");
P("");
P("**Read it as you'd say it to a 5-year-old in session.** These get re-voiced");
P("through the coach timbre afterwards, which keeps your pacing, stress and warmth");
P("and changes only who it sounds like. Deliver for the child, not for the mic.");

P("\n---\n\n## 1. Sound models — `public/coach/model/`");
P("\nThe clinical core. Each sound is recorded **stretched** (held ~1.5s, continuants)");
P("or **popped** (crisp single burst, stops). Poppers must NOT be held — a held /p/");
P("teaches a schwa the child then has to unlearn.");
const STRETCH = new Set(["R", "S", "L", "F", "V", "SH", "TH", "THV", "Z", "M", "N"]);
head();
S.ALL_SOUNDS.forEach((snd) => {
  row(`model-${snd}.mp3`, `**${S.soundSay(snd)}**`, (STRETCH.has(snd) ? "STRETCH ~1.5s" : "POP — crisp, no schwa") + ` · /${snd}/`);
});
S.ALL_SOUNDS.forEach((snd) => {
  const cue = S.CUES[snd] || {};
  if (cue.tip) row(`cue-${snd}.mp3`, cue.tip.replace(/\p{Extended_Pictographic}/gu, "").trim(), `placement cue for /${snd}/`);
});

P("\n---\n\n## 2. Round prompts — `public/coach/say/`");
P("\nSaid at the top of a round. The target sound is spliced in at runtime from");
P("section 1, so leave a clean beat where the ellipsis is.");
head();
[["ask-ready", "Are you ready?", "opens a round"],
 ["ask-yourturn", "Your turn!", ""],
 ["ask-again", "Let's try that again.", "after a miss — warm, never disappointed"],
 ["ask-onemore", "One more time!", ""],
 ["ask-listen", "Listen…", "before a model"],
 ["ask-nowyou", "Now you try!", "after a model"],
 ["ask-repeat", "Repeat after me…", ""],
 ["ask-louder", "A little louder!", ""],
 ["ask-slow", "Nice and slow.", ""],
 ["ask-great-listening", "Great listening!", ""]].forEach(([f, t, note]) => row(f + ".mp3", t, note));

P("\n---\n\n## 3. Praise — `public/coach/praise/`");
P("\nThese fire constantly, so variety is the whole point. Give each a different");
P("energy so a child hears a person and not a soundboard.");
head();
const ENERGY = ["warm", "quick", "big", "delighted", "surprised", "proud"];
S.PRAISES.forEach((p, i) => row(`praise-${i + 1}.mp3`, p, ENERGY[i] || ""));
row("praise-chest.mp3", "You filled it up! Open your chest!", "daily goal hit");
row("praise-streak.mp3", "That's three days in a row!", "streak");
row("praise-done.mp3", "All done for today. See you tomorrow!", "end of session");

P("\n---\n\n## 4. Story chapters — `public/coach/story/`");
P("\nThe daily short story — this is what a child hears every single day. Read it as");
P("a bedtime story: slower than the prompts, the last line of each page landing");
P("softly. The hook is a cliffhanger; give it a little mischief.");
S.EPISODES.forEach((ep, ei) => {
  P(`\n### Chapter ${ei + 1} — *${ep.t}*`);
  head();
  row(`ch${ei + 1}-title.mp3`, ep.t, "title card");
  row(`ch${ei + 1}-p1.mp3`, ep.open, "page 1 — the opening");
  (ep.beats || []).forEach((b, bi) => row(`ch${ei + 1}-p${bi + 2}.mp3`, b, `page ${bi + 2}`));
  row(`ch${ei + 1}-hook.mp3`, ep.hook, "tomorrow's hook — playful");
});

P("\n---\n\n## 5. Navigation & UI — `public/coach/ui/`");
head();
[["ui-welcome", "Hi! I'm Echo. Let's practice together!", "first launch"],
 ["ui-welcomeback", "You're back! I missed you.", "comeback greeting"],
 ["ui-storyfirst", "Read today's story to unlock your games!", "the daily gate"],
 ["ui-unlocked", "You did it! Three games are unlocked.", "story finished"],
 ["ui-locked", "Not yet! Finish the story first.", "tapping a locked game"],
 ["ui-tapstart", "Tap to start!", ""],
 ["ui-micplease", "I need to hear you — can you turn on the microphone?", "mic denied"],
 ["ui-goodbye", "Bye for now!", ""]].forEach(([f, t, note]) => row(f + ".mp3", t, note));

P("");
P("---");
P("");
P(`**Total rows: ${n}.** Sections 1 and 4 first — the sound models are the clinical`);
P("product, and the story is the part a child hears every day.");
console.log(out.join("\n"));
