// SOUNDMARK: only the letters that make the practice sound are orange.
//
// The family's redesign brief (28 Sep 2026): "The practice sound's letters are
// always orange (the r in rabbit, rrrr)." Until then every page painted the
// WHOLE word orange. Sona.soundMark(text, sound, pos) narrows it — and a
// narrowing that points at the wrong letter (the c of "cheese" for a Z word,
// the s of "is" in "Here is a bus") teaches a child the wrong thing, which is
// worse than the whole word. So this suite holds the helper to three things,
// over EVERY word in the bank, every sound, every position:
//   - the text is unchanged (tags stripped, the child reads the same word);
//   - exactly one mark per word;
//   - the marked letters are one of that sound's spellings, or the whole word.
// Then explicit pins for the words English makes hard.
//
// No browser: sona.js runs in node's vm with a stub window, so this is fast
// and binds no port. SOUNDMARK_TABLE=<path> also writes every word's mark as a
// Markdown table — which letters a child is shown as "the sound" is Rachel's
// call, and she reviews the table, not the regexes.
import vm from "vm";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "fs";
import { ROOT } from "./_env.mjs";

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (typeof extra === "string" ? extra : JSON.stringify(extra)))); };

// ── load sona.js the way a page does, minus the page ──
const store = {};
const noop = () => {};
const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, setAttribute: noop, appendChild: noop, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [] });
const storage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: (i) => Object.keys(store)[i] || null, get length() { return Object.keys(store).length; } };
const ctx = {
  localStorage: storage, sessionStorage: storage, console, setTimeout, clearTimeout, setInterval, clearInterval,
  document: { addEventListener: noop, removeEventListener: noop, createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: el(), head: el(), documentElement: el(), cookie: "", visibilityState: "visible", referrer: "" },
  navigator: { userAgent: "node", mediaDevices: {} },
  location: { href: "http://x/today.html", pathname: "/today.html", search: "", hash: "", hostname: "x", origin: "http://x", replace: noop },
  addEventListener: noop, removeEventListener: noop, history: { replaceState: noop }, matchMedia: () => ({ matches: false, addEventListener: noop }),
  fetch: () => Promise.reject(new Error("offline")),
};
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(ROOT + "/sona.js", "utf8"), ctx, { filename: "sona.js" });
const S = ctx.Sona;
ok("Sona.soundMark is exported", typeof S.soundMark === "function");

const unesc = (h) => h.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const marks = (h) => [...h.matchAll(/<b class="snd">([\s\S]*?)<\/b>/g)].map((m) => unesc(m[1]));
// [marked letters, index] for a single-word result
const markOf = (h) => { const m = h.match(/^([\s\S]*?)<b class="snd">([\s\S]*?)<\/b>/); return m ? [unesc(m[2]), unesc(m[1]).length] : [null, -1]; };

// What counts as a spelling of each sound. Written here, independently of
// sona.js, so a change to the helper's tables has to agree with a reader.
const SPELL = {
  R: ["r", "rr", "wr", "ar", "er", "ir", "or", "ur", "ear", "air", "eer", "our", "oar", "oor"],
  S: ["s", "ss", "c"], Z: ["z", "zz", "s", "ss", "x"], L: ["l", "ll"], K: ["k", "c", "ck", "q"], G: ["g", "gg", "gh"],
  F: ["f", "ff", "ph", "gh"], SH: ["sh", "s", "ss", "ti", "ci", "ce", "ch"], CH: ["ch", "tch", "t"], TH: ["th"], THV: ["th"],
  J: ["j", "g", "dg"], P: ["p", "pp"], B: ["b", "bb"], M: ["m", "mm"], N: ["n", "nn", "kn", "gn"], T: ["t", "tt"],
  D: ["d", "dd"], V: ["v"],
};

// ── every word in the bank ──
const rows = [];
const bad = { text: [], count: [], spelling: [] };
let n = 0, whole = 0;
for (const snd of Object.keys(S.WORDS)) {
  for (const w of S.WORDS[snd]) {
    n++;
    const h = S.soundMark(w.w, snd, w.pos);
    const ms = marks(h);
    const [m, at] = markOf(h);
    if (unesc(h) !== w.w) bad.text.push(snd + " " + w.w + " → " + h);
    if (ms.length !== 1) bad.count.push(snd + " " + w.w + " → " + h);
    if (m !== w.w && !(SPELL[snd] || []).includes(String(m).toLowerCase())) bad.spelling.push(snd + " " + w.w + " → " + m);
    if (m === w.w) whole++;
    rows.push({ snd, pos: w.pos || "i", w: w.w, h, m, at });
  }
}
ok("the bank is not empty (not vacuous)", n > 300, n);
ok("every bank word reads the same after marking (only tags added)", bad.text.length === 0, bad.text.slice(0, 6));
ok("every bank word gets exactly one mark", bad.count.length === 0, bad.count.slice(0, 6));
ok("every mark is one of the sound's spellings, or the whole word", bad.spelling.length === 0, bad.spelling.slice(0, 6));
ok("…and the helper narrows almost every word (a whole-word fallback is the exception)", whole <= 2, rows.filter((r) => r.m === r.w).map((r) => r.snd + ":" + r.w));

// Game-only theme words may borrow a word that the practice bank filed at
// another position (cave is final V there), but must model their own onset.
{
  ok("game-only word provider is exported",typeof S.gameWords==="function"&&!!S.GAME_WORDS);
  vm.runInContext(readFileSync(ROOT+"/crafted-words.js","utf8"),ctx);
  const bad=[];let count=0;
  for(const [key,sounds] of Object.entries(S.GAME_WORDS||{}))for(const [snd,names] of Object.entries(sounds)){
    const words=S.gameWords(key,snd);
    if(words.length!==names.length)bad.push(key+"/"+snd+" dropped a theme word");
    for(const w of words){
      count++;const html=S.soundMark(w.w,snd,w.pos),[m,at]=markOf(html),pic=ctx.SonaCraftedWords.picture(w.w,64);
      if(w.pos!=="i"||at!==0||marks(html).length!==1||!SPELL[snd].includes(String(m).toLowerCase())||unesc(html)!==w.w)bad.push(key+" "+snd+" "+w.w+" marker "+html);
      if(!/^[a-z]+$/.test(w.w)||!m||!/[aeiouy]/.test(w.w.charAt(m.length)))bad.push(key+" "+w.w+" is not an isolated onset before a vowel");
      const art=pic&&pic.match(/background-image:url\(([^)]+)\)/);
      if(!art||!existsSync(ROOT+art[1]))bad.push(key+" "+w.w+" has no shipped painted picture");
    }
  }
  ok("every game-only theme word is pictured, isolated, has no onset blend, and marks its sound at the beginning ("+count+")",count>20&&bad.length===0,bad);
  ok("Bubble Pop keeps its ordinary word bank",S.gameWords&&S.gameWords("bubbles","B").length===0);
  ok("Dino cave models its K onset without changing the practice bank's final V",S.gameWords&&markOf(S.soundMark(S.gameWords("dino","K")[0].w,"K","i"))[0]==="c"&&S.WORDS.V.some(w=>w.w==="cave"&&w.pos==="f"));
}

// ── the words English makes hard, pinned: [word, sound, pos, letters, index] ──
const PINS = [
  ["rabbit", "R", "i", "r", 0], ["carrot", "R", "m", "rr", 2], ["car", "R", "f", "r", 2], ["four", "R", "f", "r", 3],
  ["cake", "K", "f", "k", 2], ["cake", "K", "i", "c", 0], ["duck", "K", "f", "ck", 2], ["bucket", "K", "m", "ck", 2], ["pumpkin", "K", "m", "k", 4],
  ["nose", "Z", "f", "s", 2], ["cheese", "Z", "f", "s", 4], ["cheese", "CH", "i", "ch", 0], ["zebra", "Z", "i", "z", 0], ["scissors", "Z", "m", "ss", 3],
  ["ship", "SH", "i", "sh", 0], ["sure", "SH", "i", "s", 0], ["ocean", "SH", "m", "ce", 1], ["tissue", "SH", "m", "ss", 2],
  ["pencil", "S", "m", "c", 3], ["bicycle", "S", "m", "c", 2], ["ice", "S", "f", "c", 1], ["glass", "S", "f", "ss", 3], ["castle", "S", "m", "s", 2],
  ["watch", "CH", "f", "tch", 2], ["kitchen", "CH", "m", "tch", 2], ["sandwich", "CH", "m", "ch", 6],
  ["giraffe", "J", "i", "g", 0], ["giraffe", "F", "f", "ff", 4], ["bridge", "J", "f", "dg", 3], ["cage", "J", "f", "g", 2], ["magic", "J", "m", "g", 2],
  ["elephant", "F", "m", "ph", 3], ["knife", "F", "f", "f", 3], ["finger", "G", "m", "g", 3], ["egg", "G", "f", "gg", 1],
  ["toothbrush", "TH", "m", "th", 3], ["bathe", "THV", "f", "th", 2], ["lamb", "M", "f", "m", 2],
  // vocalic R: the vowel the r colours goes with it
  ["bird", "R", "v", "ir", 1], ["girl", "R", "v", "ir", 1], ["shark", "R", "v", "ar", 2], ["fork", "R", "v", "or", 1], ["corn", "R", "v", "or", 1],
  ["chair", "R", "v", "air", 2], ["water", "R", "v", "er", 3], ["tiger", "R", "v", "er", 3], ["ear", "R", "v", "ear", 0],
  // blends: only the practice sound's letter, not its neighbour
  ["tree", "R", "b", "r", 1], ["grapes", "R", "b", "r", 1], ["spoon", "S", "b", "s", 0], ["school", "S", "b", "s", 0], ["clock", "L", "b", "l", 1], ["sled", "L", "b", "l", 1],
  // …and a doubled letter is one sound, not a blend of two: asked as a blend
  // (a homework word at another position), never half of "ss" or "rr"
  ["glass", "S", "b", "ss", 3], ["carrot", "R", "b", "rr", 2],
  // spellings the book reader's openings already handled
  ["knife", "N", "i", "kn", 0], ["wrap", "R", "i", "wr", 0], ["phone", "F", "i", "ph", 0], ["city", "S", "i", "c", 0], ["gem", "J", "i", "g", 0],
];
const pinBad = [];
for (const [w, snd, pos, want, at] of PINS) {
  const [m, i] = markOf(S.soundMark(w, snd, pos));
  if (m !== want || i !== at) pinBad.push(w + " (" + snd + "/" + pos + "): got " + m + "@" + i + ", want " + want + "@" + at);
}
ok("the hard words mark the letters that make the sound (" + PINS.length + " pins)", pinBad.length === 0, pinBad);

// a caller that doesn't know the position: the bank's own position decides
ok("no position given: the bank's position for the word decides (car is a final R)", markOf(S.soundMark("car", "R"))[0] === "r" && markOf(S.soundMark("car", "R"))[1] === 2);
ok("…and a homework word shown at the wrong position still marks its sound (carrot asked as a beginning)", markOf(S.soundMark("carrot", "R", "i"))[0] === "rr");
ok("capitals are kept, and punctuation stays outside the mark", S.soundMark("Rabbit!", "R", "i") === '<b class="snd">R</b>abbit!');

// ── the sound on its own is ALL sound ──
const iso = [["rrrr", "R"], ["sh sh", "SH"], ["ch ch", "CH"], ["shhh", "SH"], ["sss", "S"], ["zzz", "Z"], ["r r r", "R"], ["R", "R"], ["TH (v)", "THV"]];
for (const s of Object.keys(S.SOUND_SAY)) iso.push([S.SOUND_SAY[s], s]);
const isoBad = iso.filter(([t, s]) => S.soundMark(t, s) !== '<b class="snd">' + t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;") + "</b>");
ok("an isolation target (rrrr, sh sh, kuh) is wrapped whole", isoBad.length === 0, isoBad);
ok("a syllable marks its onset (rah, shoo)", markOf(S.soundMark("rah", "R"))[0] === "r" && markOf(S.soundMark("shoo", "SH"))[0] === "sh");

// ── what a game's say-it card asks (Travis, 1 Oct 2026: the sound, then one
// syllable, then a short word): Sona.gameAsk hands the card its HTML, so the
// same rule holds there. Every sound is switched on here (only R ships on),
// so a sound added later is already held to it. ──
{
  vm.runInContext(readFileSync(ROOT + "/gamecontent.js", "utf8"), ctx, { filename: "gamecontent.js" });
  const SC = ctx.SonaContent, shipped = [...SC.GAME_SYL_ON];
  S.ALL_SOUNDS.forEach((x) => { if (!SC.GAME_SYL_ON.includes(x)) SC.GAME_SYL_ON.push(x); });
  S.saveProfile({ gameLevel: "word" });
  const bad = []; let n = 0;
  for (const snd of S.ALL_SOUNDS) {
    const bare = S.gameAsk(snd, 0);
    n++; if (bare.html !== '<b class="snd">' + bare.text + "</b>" || bare.text !== S.soundSay(snd)) bad.push(snd + " bare: " + bare.html);
    const asks = SC.gameSyllables(snd).map((x) => ({ text: x.t, html: S.soundMark(x.t, snd) }));
    for (const c of [1, 2]) asks.push(S.gameAsk(snd, c));
    for (const a of asks) {
      n++; const mk = marks(a.html), [m, at] = markOf(a.html);
      if (unesc(a.html) !== a.text || mk.length !== 1 || at !== 0 || m === a.text || !SPELL[snd].includes(String(m).toLowerCase())) bad.push(snd + " " + a.text + ": " + a.html);
    }
  }
  ok("every game ask, all 19 sounds: the bare sound is orange whole; a syllable or word marks only the sound's letters, once (" + n + " asks)", bad.length === 0, bad);
  const r = S.gameAsk("R", 2);
  ok("R's short word marks only its r", r.text === "rot" && r.html === '<b class="snd">r</b>ot', r);
  SC.GAME_SYL_ON.length = 0; shipped.forEach((x) => SC.GAME_SYL_ON.push(x)); S.saveProfile({ gameLevel: "" });
}

// ── sentences: only the practice words ──
const sent = S.soundMark("I see a rabbit.", "R", "i");
ok("a sentence marks only its practice word", marks(sent).join() === "r" && unesc(sent) === "I see a rabbit." && /a <b class="snd">r<\/b>abbit\./.test(sent), sent);
const bus = S.soundMark("Here is a bus.", "S", "f");
ok("…never a frame word that only looks like the sound (the z-sounding s of \"is\")", marks(bus).join() === "s" && /bu<b class="snd">s<\/b>\./.test(bus), bus);
const chat = S.soundMark("Which do you like — a car or a star?", "R", "f");
ok("…and every practice word in a two-choice question", marks(chat).join() === "r,r" && unesc(chat) === "Which do you like — a car or a star?", chat);
const none = S.soundMark("hello there", "R");
ok("a sentence with no practice word in it: unsure, so the whole text (today's behaviour)", none === '<b class="snd">hello there</b>', none);
const lesson = S.soundMark("box", "K", "f");
ok("a word whose sound has no spelling the helper knows: the whole word, never a guess", lesson === '<b class="snd">box</b>', lesson);

// ── it is HTML, so it escapes ──
const x = S.soundMark('<img src=x onerror="alert(1)">', "R");
ok("text is escaped before it becomes HTML", !/<img/.test(x) && unesc(x) === '<img src=x onerror="alert(1)">', x);
ok("empty text marks nothing", S.soundMark("", "R") === "" && S.soundMark(null, "R") === "");

// ── the class it wraps with is the one action.css colours ──
const act = readFileSync(ROOT + "/action.css", "utf8");
ok("action.css colours .snd with the sound token", /\.snd\{[^}]*color:var\(--snd\)/.test(act.replace(/\s+/g, "")));

// ── callers feature-detect it (a cached old sona.js must not break a page) ──
const callers = [], blind = [];
for (const f of readdirSync(ROOT).filter((f) => /\.(html|js)$/.test(f) && f !== "sona.js")) {
  const src = readFileSync(ROOT + "/" + f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  if (!/\bsoundMark\(/.test(src)) continue;
  callers.push(f);
  if (!/(?:Sona|S)\s*&&\s*(?:Sona|S)\.soundMark\b|typeof\s+(?:Sona|S)\.soundMark\b/.test(src)) blind.push(f);
}
ok("every page that calls Sona.soundMark feature-detects it first", callers.length > 0 && blind.length === 0, { callers, blind });
ok("the Say & Play word and Feed Echo's ask colour only the sound's letters", ["sayplay.js", "arcade-feed.html"].every((f) => callers.includes(f)), callers);

// ── the table for Rachel ──
if (process.env.SOUNDMARK_TABLE) {
  const POS = { i: "beginning", m: "middle", f: "end", v: "vocalic R", b: "blend" };
  const show = (r) => r.w.slice(0, r.at) + "**" + r.m.toUpperCase() + "**" + r.w.slice(r.at + r.m.length);
  let md = "# Which letters Sona colours orange\n\n"
    + "Every practice word in the app, and the letters `Sona.soundMark()` colours as \"the sound\" (shown in **BOLD CAPITALS**). "
    + "A word shown fully bold is one the helper could not narrow with confidence, so it stays all orange, as today.\n\n"
    + "Generated by `SOUNDMARK_TABLE=<file> node tests/soundmarktest.mjs` on " + new Date().toISOString().slice(0, 10) + ".\n\n"
    + "| Sound | Position | Word | Coloured |\n|---|---|---|---|\n";
  for (const r of rows) md += "| " + r.snd + " | " + (POS[r.pos] || r.pos) + " | " + r.w + " | " + (r.m === r.w ? "**" + r.w.toUpperCase() + "** (whole word)" : show(r)) + " |\n";
  md += "\n## Sentences and targets\n\n| Text | Sound | Coloured |\n|---|---|---|\n";
  for (const [t, s, p] of [["rrrr", "R"], ["sh sh", "SH"], ["kuh", "K"], ["rah", "R"], ["I see a rabbit.", "R", "i"], ["Here is a bus.", "S", "f"], ["Look at the lion.", "L", "i"], ["Which do you like — a car or a star?", "R", "f"]]) {
    md += "| " + t + " | " + s + " | " + S.soundMark(t, s, p).replace(/<b class="snd">([\s\S]*?)<\/b>/g, (m0, a) => "**" + unesc(a).toUpperCase() + "**") + " |\n";
  }
  writeFileSync(process.env.SOUNDMARK_TABLE, md);
  console.log("table written to " + process.env.SOUNDMARK_TABLE + " (" + rows.length + " words)");
}

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
