// GAMEASK1: what a round game's say-it card asks for (Travis, 1 Oct 2026: "we
// need to add back the increase of complexity to the sounds in the games and
// start with isolation then ree rah roh then rot. and maybe have that be
// something to update in settings").
//
// The card between rounds always said the bare sound. It now climbs: the sound
// alone, then ONE syllable a card, then a short word. Sona.gameAsk(sound, card)
// is the one reader the games and the Settings picker both call; this holds it
// to its rules:
//   - a fresh child's cards stop at syllables; an EARNED level opens the word;
//   - a grown-up's pick in Settings wins, up and down, and never past a word;
//   - a sound whose syllables nobody has listened to yet stays on the bare
//     sound, exactly as before (only R ships switched on);
//   - so does a child aged 2 to 4 (Settings hides the picker for them), and
//     any child while Echo's voice is off (only his voice models a syllable);
//     Sona.gameHold names the reason, for the Settings line;
//   - a card never asks below what the "Say it 5 times" page just asked, and
//     reuses that page's own syllable or word;
//   - an SLP's homework wins: its words, and no start-of-word syllable when
//     the target is the end of a word;
//   - it only READS. Nothing it does touches a practice record or a game rep.
// What a card HEARS is not here: it hears "a voice of the right kind" and
// cannot tell "ree" from "rrrr" or "rot" (slicetest and micquietgamestest
// drive the real card, the step back after silence included).
//
// No browser: sona.js and gamecontent.js run in node's vm with a stub window
// and a clock this suite sets, so it is fast and binds no port.
import vm from "vm";
import { readFileSync } from "fs";
import { ROOT } from "./_env.mjs";

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (typeof extra === "string" ? extra : JSON.stringify(extra)))); };

// ── a page, minus the page: its own localStorage, sessionStorage and clock ──
function boot(opts = {}) {
  const local = {}, session = {}, noop = () => {};
  const storage = (store) => ({ getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: (i) => Object.keys(store)[i] || null, get length() { return Object.keys(store).length; } });
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, setAttribute: noop, appendChild: noop, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [] });
  const clock = { now: new Date(2026, 9, 2, 10, 0, 0).getTime() };
  const ctx = {
    localStorage: storage(local), sessionStorage: storage(session), console, setTimeout, clearTimeout, setInterval, clearInterval,
    document: { addEventListener: noop, removeEventListener: noop, createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: el(), head: el(), documentElement: el(), cookie: "", visibilityState: "visible", referrer: "" },
    navigator: { userAgent: "node", mediaDevices: {} },
    location: { href: "http://x/arcade-slice.html", pathname: "/arcade-slice.html", search: "", hash: "", hostname: "x", origin: "http://x", replace: noop },
    addEventListener: noop, removeEventListener: noop, history: { replaceState: noop }, matchMedia: () => ({ matches: false, addEventListener: noop }),
    fetch: () => Promise.reject(new Error("offline")),
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  // the page's clock: new Date() and Date.now() read clock.now, so a test can turn the calendar
  ctx.__clock = clock;
  vm.runInContext("(function(){var R=Date;function D(a,b,c,d,e,f,g){var n=arguments.length;return n===0?new R(__clock.now):n===1?new R(a):new R(a,b,c||1,d||0,e||0,f||0,g||0);}D.prototype=R.prototype;D.now=function(){return __clock.now;};D.parse=R.parse;D.UTC=R.UTC;Date=D;})();", ctx);
  local["sona.profile.v1"] = JSON.stringify(Object.assign({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true }, opts.profile || {}));
  vm.runInContext(readFileSync(ROOT + "/sona.js", "utf8"), ctx, { filename: "sona.js" });
  if (opts.content !== false) vm.runInContext(readFileSync(ROOT + "/gamecontent.js", "utf8"), ctx, { filename: "gamecontent.js" });
  return { S: ctx.Sona, SC: ctx.SonaContent, ctx, local, session, clock };
}
const DAY = 864e5;
const texts = (S, snd, o) => [0, 1, 2].map((c) => S.gameAsk(snd, c, o).text);
const hand = (p, sound, level, ask) => { p.session["sona.boost.sound"] = sound; p.session["sona.boost.level"] = level; p.session["sona.boost.ask"] = ask; };
const homework = (p, over) => { p.local[p.S.kkey("sona.homework.v1")] = JSON.stringify({ hw: Object.assign({ id: "hw1", title: "t", note: "n", sounds: ["R"], pos: "i", repsPerDay: 40, words: null, start: "2000-01-01", due: "2999-01-01", by: "Rachel" }, over || {}), at: 1 }); };

// ── 1. a fresh child on R, the first game of the day ──
{
  const p = boot(), { S, SC } = p;
  ok("Sona exports the reader: gameTop() and gameAsk()", typeof S.gameTop === "function" && typeof S.gameAsk === "function");
  const a0 = S.gameAsk("R", 0), a1 = S.gameAsk("R", 1), a2 = S.gameAsk("R", 2), syl = SC.gameSyllables("R").map((x) => x.t);
  ok("card 0 is the bare sound, modelled by Rachel's recording, with nothing for the computer voice to say",
    a0.rung === 0 && a0.level === "isolation" && a0.text === "rrrr" && a0.html === '<b class="snd">rrrr</b>' && a0.clip === "/coach/say-echo/R-sound.wav" && a0.say === "", a0);
  ok("a fresh child's cards top out at syllables: one step past what they have earned", S.gameTop("R") === 1 && a1.rung === 1 && a2.rung === 1 && a1.level === "syllable", { top: S.gameTop("R"), a1, a2 });
  ok("each card asks ONE syllable, never three in a breath, and the two cards ask different ones",
    syl.includes(a1.text) && syl.includes(a2.text) && a1.text !== a2.text && !/\s/.test(a1.text + a2.text), [a1.text, a2.text]);
  ok("a syllable is modelled by one spoken line (say), never a recording, and only its r is orange",
    a1.say === a1.text && a1.clip === "" && a1.html === '<b class="snd">r</b>' + a1.text.slice(1), a1);
  // the calendar turns the syllable: nothing is stored to remember "next time rah"
  const days = [0, 1, 2, 3].map((d) => { p.clock.now += d ? DAY : 0; return S.gameAsk("R", 1).text; });
  ok("card 1 moves to the next syllable each calendar day, in the order ree, rah, roh, and comes round again",
    new Set(days.slice(0, 3)).size === 3 && days[3] === days[0] && [0, 1, 2].every((i) => syl[(syl.indexOf(days[i]) + 1) % 3] === days[i + 1]), days);
  ok("…and card 2 is the one after card 1", syl[(syl.indexOf(S.gameAsk("R", 1).text) + 1) % 3] === S.gameAsk("R", 2).text);
  ok("a card number out of range reads as the nearest card", S.gameAsk("R", 9).text === S.gameAsk("R", 2).text && S.gameAsk("R", -3).text === "rrrr" && S.gameAsk("R").text === "rrrr");
  ok("the sound is read whatever its case", S.gameAsk("r", 1).text === S.gameAsk("R", 1).text);
}

// ── 2. the earned level opens the word; nothing goes past a word ──
{
  const p = boot(), { S } = p;
  S.recordRung("R", 0, 1);   // the practice page's own two-clean-rounds move, here given directly
  const t = texts(S, "R");
  ok("earned level 1 (Syllables) opens the short word: the sound, a syllable, then rot", S.gameTop("R") === 2 && t[0] === "rrrr" && /^r(ee|ah|oh)$/.test(t[1]) && t[2] === "rot", t);
  const w = S.gameAsk("R", 2);
  ok("the short word is one spoken line too, and only its r is orange", w.rung === 2 && w.level === "word" && w.say === "rot" && w.clip === "" && w.html === '<b class="snd">r</b>ot', w);
  S.recordRung("R", 1, 1); S.recordRung("R", 2, 1); S.recordRung("R", 3, 1);
  ok("a child who has earned sentences still gets a word at most: cards never go past a word", S.rungOf("R") === 4 && S.gameTop("R") === 2 && S.gameAsk("R", 2).text === "rot", { rung: S.rungOf("R"), top: S.gameTop("R") });
}

// ── 3. the grown-up's pick in Settings wins, up and down ──
{
  const up = boot({ profile: { gameLevel: "word" } });
  ok("\"…then a short word\" on a child who has earned nothing: a syllable, then rot", up.S.rungOf("R") === 0 && up.S.gameTop("R") === 2 && /^r(ee|ah|oh)$/.test(up.S.gameAsk("R", 1).text) && up.S.gameAsk("R", 2).text === "rot", texts(up.S, "R"));
  const down = boot({ profile: { gameLevel: "isolation" } });
  down.S.recordRung("R", 0, 1); down.S.recordRung("R", 1, 1);
  ok("\"Just the sound\" on a child who has earned words: every card is the bare sound", down.S.gameTop("R") === 0 && texts(down.S, "R").join() === "rrrr,rrrr,rrrr", texts(down.S, "R"));
  hand(down, "R", "word", "rabbit");
  ok("…even when the practice page just asked a word: the pick is a ceiling", texts(down.S, "R").join() === "rrrr,rrrr,rrrr", texts(down.S, "R"));
  const mid = boot({ profile: { gameLevel: "syllable" } });
  mid.S.recordRung("R", 0, 1); mid.S.recordRung("R", 1, 1);
  ok("\"The sound, then syllables\" stops at syllables whatever was earned", mid.S.gameTop("R") === 1 && mid.S.gameAsk("R", 2).rung === 1, texts(mid.S, "R"));
  const odd = boot({ profile: { gameLevel: "sentence" } });
  ok("a pick this build does not know reads as \"Sona decides\"", odd.S.gameTop("R") === 1, odd.S.gameTop("R"));
  ok("the pick is the child's own, kept on their profile, and never the earned level", up.S.getProfile().gameLevel === "word" && up.S.rungOf("R") === 0 && JSON.stringify(up.S.getProgress().stage) === "{}");
}

// ── 4. a sound that is not switched on keeps the bare sound, exactly as before ──
{
  const p = boot({ profile: { focusSounds: ["S"], gameLevel: "word" } }), { S, SC } = p;
  S.recordRung("S", 0, 1); hand(p, "S", "word", "sun");
  const all = [0, 1, 2].map((c) => S.gameAsk("S", c));
  ok("S is not switched on: every card is \"sss\" and its recording, whatever was earned, picked or just practised",
    S.gameTop("S") === 0 && all.every((a) => a.rung === 0 && a.text === "sss" && a.html === '<b class="snd">sss</b>' && a.clip === "/coach/say-echo/S-sound.wav" && a.say === ""), all);
  const others = S.ALL_SOUNDS.filter((x) => SC.GAME_SYL_ON.indexOf(x) < 0).filter((x) => [1, 2].some((c) => S.gameAsk(x, c).text !== S.soundSay(x)));
  ok("…and so is every other sound but R", others.length === 0, others);
  const bare = boot({ content: false, profile: { gameLevel: "word" } });
  ok("a page without gamecontent.js (no syllable maker) asks the bare sound", bare.S.gameTop("R") === 0 && texts(bare.S, "R").join() === "rrrr,rrrr,rrrr", texts(bare.S, "R"));
}

// ── 4b. a child aged 2 to 4, and Echo's voice off: the bare sound, with the reason ──
// Home shows a four-year-old the round games too (Fruit Slice is free and
// open), and Settings hides the picker for that age. So the cards must not
// climb for them, whatever was earned, handed over, or saved in a pick made
// when the age read older. Whether little ones should ever be asked a
// syllable is Rachel's call.
{
  for (const age of ["2", "3", "4"]) for (const pick of ["", "word"]) {
    const p = boot({ profile: { childAge: age, gameLevel: pick } }), { S } = p;
    S.recordRung("R", 0, 1); hand(p, "R", "word", "rabbit");
    ok("age " + age + (pick ? ", with \"short word\" still saved" : "") + ": every card is the bare sound and its recording",
      S.playStyle() === "simple" && S.gameTop("R") === 0 && S.gameHold("R") === "little" && [0, 1, 2].every((c) => { const a = S.gameAsk("R", c); return a.rung === 0 && a.text === "rrrr" && a.say === "" && a.clip === "/coach/say-echo/R-sound.wav"; })
      && texts(S, "R", { first: true }).join() === "rrrr,rrrr,rrrr", { style: S.playStyle(), hold: S.gameHold("R"), t: texts(S, "R") });
  }
  const five = boot({ profile: { childAge: "5" } });
  ok("a five-year-old is not held: the cards climb", five.S.playStyle() === "arcade" && five.S.gameHold("R") === "" && five.S.gameAsk("R", 1).rung === 1, texts(five.S, "R"));
  // Only Echo's voice can model a syllable or a word. With Sona muted the
  // reader itself answers the bare sound, so the card and the Settings line
  // (both read it) cannot disagree.
  const mute = boot({ profile: { volume: 0, gameLevel: "word" } });
  mute.S.recordRung("R", 0, 1); hand(mute, "R", "word", "rabbit");
  ok("Sona muted (volume 0): every card is the bare sound, whatever was earned, picked or just practised, and the reader says why",
    mute.S.gameTop("R") === 0 && mute.S.gameHold("R") === "muted" && texts(mute.S, "R").join() === "rrrr,rrrr,rrrr" && texts(mute.S, "R", { first: true }).join() === "rrrr,rrrr,rrrr", { hold: mute.S.gameHold("R"), t: texts(mute.S, "R") });
  // an old voiceOn:false with an audible volume is healed by getProfile (there is no control left to undo it), so that child's voice is ON
  const healed = boot({ profile: { voiceOn: false, volume: 0.6 } });
  ok("a legacy voiceOn:false with sound on is healed, not muted: the cards climb", healed.S.getProfile().voiceOn === true && healed.S.gameHold("R") === "" && healed.S.gameAsk("R", 1).rung === 1, healed.S.gameHold("R"));
  const plain = boot();
  ok("the reader names what holds a sound's cards: nothing for R, \"sound\" for one not switched on", plain.S.gameHold("R") === "" && plain.S.gameHold("r") === "" && plain.S.gameHold("S") === "sound");
  ok("…\"sound\" on a page without gamecontent.js", boot({ content: false }).S.gameHold("R") === "sound");
  homework(plain, { pos: "f", words: ["car"] });
  ok("…and \"position\" under homework for another part of the word", plain.S.gameHold("R") === "position");
}

// ── 5. the practice page's hand-over: never below what was just asked ──
{
  const p = boot(), { S } = p;
  hand(p, "R", "isolation", "rrrr");
  ok("after a first game of the day on the bare sound, the cards start one step up", S.gameAsk("R", 1).rung === 1 && S.gameAsk("R", 2).rung === 1, texts(S, "R"));
  hand(p, "R", "syllable", "roo");
  ok("the page just asked \"roo\": a syllable card repeats that same one, not a second target", S.gameAsk("R", 1).text === "roo" && S.gameAsk("R", 2).text === "roo", texts(S, "R"));
  ok("card 0 is still the bare sound: it is where a card steps back to", S.gameAsk("R", 0).text === "rrrr" && S.gameAsk("R", 0).rung === 0);
  ok("Settings paints its line as on the first game of a day, ignoring the hand-over", S.gameAsk("R", 1, { first: true }).text !== "roo");
  S.recordRung("R", 0, 1);
  ok("…and once the word is earned, the card after \"roo\" is the short word", S.gameAsk("R", 1).text === "rot" && S.gameAsk("R", 2).text === "rot", texts(S, "R"));
  hand(p, "R", "word", "rabbit");
  ok("the page just asked \"rabbit\" five times: both cards ask rabbit, never \"ree\" after it", texts(S, "R").join() === "rrrr,rabbit,rabbit" && S.gameAsk("R", 1).html === '<b class="snd">r</b>abbit', texts(S, "R"));
  hand(p, "R", "sentence", "rocket");
  ok("a sentence hands over its practice word, and the cards ask that word", texts(S, "R").join() === "rrrr,rocket,rocket", texts(S, "R"));
  hand(p, "R", "word", "taco");
  ok("a handed-over word that is not one of this sound's words is not asked: the short word instead", S.gameAsk("R", 1).text === "rot", texts(S, "R"));
  hand(p, "S", "word", "sun");
  ok("a hand-over for another sound is not this sound's floor", S.gameAsk("R", 1).rung === 1, texts(S, "R"));
  p.session["sona.boost.sound"] = "R"; delete p.session["sona.boost.level"]; delete p.session["sona.boost.ask"];
  ok("a missing hand-over (an older practice page, a restored tab) just means the cards start from the sound", S.gameAsk("R", 1).rung === 1 && S.gameAsk("R", 2).rung === 2, texts(S, "R"));
}
// The skip list holds on the hand-over path too. The practice page DOES ask
// "pee", "gee" and "thee" today; the day P, G or TH is switched on, a card
// must not repeat one after it (Echo's voice reads "gee" as "jee" and "thee"
// as the loud th; "pee" is a potty word). Latent while only R is on, so each
// is switched on here.
{
  const p = boot({ profile: { focusSounds: ["P"], gameLevel: "syllable" } }), { S, SC } = p;
  for (const [snd, bad] of [["P", "pee"], ["G", "gee"], ["TH", "thee"]]) {
    SC.GAME_SYL_ON.push(snd);
    ok("the practice page really does ask \"" + bad + "\" (so the hand-over can carry it)", SC.syllables(snd).some((x) => x.t === bad));
    hand(p, snd, "syllable", bad);
    const t = [1, 2].map((c) => S.gameAsk(snd, c)), own = SC.gameSyllables(snd).map((x) => x.t);
    ok("the practice page just asked \"" + bad + "\": neither card repeats it; each asks one of " + snd + "'s own game syllables instead",
      t.every((a) => a.rung === 1 && a.text !== bad && a.say !== bad && own.includes(a.text)) && !own.includes(bad), t.map((a) => a.text));
    const kept = SC.syllables(snd).map((x) => x.t).filter((x) => x !== bad)[0];
    hand(p, snd, "syllable", kept);
    ok("…while a syllable that is not skipped (\"" + kept + "\") is still repeated", S.gameAsk(snd, 1).text === kept && S.gameAsk(snd, 2).text === kept, [1, 2].map((c) => S.gameAsk(snd, c).text));
  }
}

// ── 6. an SLP's homework ──
{
  const p = boot({ profile: { gameLevel: "word" } }), { S } = p;
  homework(p, { words: ["rain", "rose"] });
  ok("homework that names its words: the word card asks one of them, not rot", /^r(ee|ah|oh)$/.test(S.gameAsk("R", 1).text) && ["rain", "rose"].includes(S.gameAsk("R", 2).text), texts(S, "R"));
  homework(p, { pos: "f", words: ["car", "star"] });
  const t = texts(S, "R");
  ok("end-of-word homework: the cards stay on the sound, then one of the homework's own words; never a start-of-word syllable",
    S.practicePos() === "f" && t[0] === "rrrr" && t[1] === "rrrr" && ["car", "star"].includes(t[2]) && S.gameAsk("R", 2).html === t[2].slice(0, -1) + '<b class="snd">r</b>', t);
  homework(p, { pos: "v", words: null });
  ok("\"er, ar, or\" homework that names no words: every card stays on the sound", S.practicePos() === "v" && texts(S, "R").join() === "rrrr,rrrr,rrrr" && S.gameTop("R") === 0, texts(S, "R"));
  hand(p, "R", "word", "bird");
  ok("…unless the practice page just asked one of its words: the cards repeat it", texts(S, "R").join() === "rrrr,bird,bird", texts(S, "R"));
  hand(p, "R", "syllable", "ree");
  ok("…and a syllable the practice page asked is not carried into the cards under that homework", texts(S, "R").join() === "rrrr,rrrr,rrrr", texts(S, "R"));
  const q = boot(); homework(q, { pos: "f", words: ["car"] });
  ok("with \"Sona decides\", the homework's word still waits for the earned level", texts(q.S, "R").join() === "rrrr,rrrr,rrrr", texts(q.S, "R"));
  q.S.recordRung("R", 0, 1);
  ok("…and comes once it is earned", texts(q.S, "R").join() === "rrrr,rrrr,car", texts(q.S, "R"));
}

// ── 7. it only reads ──
{
  const p = boot({ profile: { gameLevel: "word" } }), { S } = p;
  S.getProgress();   // a brand-new child's first read saves the ladder migration once; that is not this reader's write
  hand(p, "R", "syllable", "rah");
  const snap = () => JSON.stringify([p.local, p.session]);
  const before = snap(), stage = JSON.stringify(S.getProgress().stage), reps = S.weekReps(0);
  for (const snd of S.ALL_SOUNDS) { S.gameTop(snd); for (let c = 0; c <= 2; c++) { S.gameAsk(snd, c); S.gameAsk(snd, c, { first: true }); } }
  ok("reading the asks for all 19 sounds changes nothing that is stored", snap() === before);
  ok("…so not the earned level, the practice records or the week's reps",
    JSON.stringify(S.getProgress().stage) === stage && JSON.stringify(S.outcomes()) === "{}" && !("sona.attempts.v1" in p.local) && !("sona.gamereps.v1" in p.local) && S.weekReps(0) === reps);
  const src = readFileSync(ROOT + "/sona.js", "utf8"), at = src.indexOf("GAMEASK1"), end = src.indexOf("the week, narrated", at);
  const body = src.slice(at, end).replace(/\/\/[^\n]*/g, "");
  ok("the reader's code never moves a level, logs an attempt, counts a rep or saves", at > 0 && end > at && !/recordRung|logAttempt|bumpReps|gameRep\(|\bsave\(|setItem|saveProfile/.test(body));
}

// ── 8. switching children drops the whole hand-over, not just the sound ──
{
  const src = readFileSync(ROOT + "/sona.js", "utf8");
  ok("a switch to a sibling clears the practice page's level and item with its sound",
    /\["sona\.play\.token", "sona\.play\.active", "sona\.boost\.sound", "sona\.boost\.level", "sona\.boost\.ask"\]\.forEach\(\(k\) => sessionStorage\.removeItem\(k\)\)/.test(src));
  const charge = readFileSync(ROOT + "/charge.html", "utf8");
  ok("the practice page hands over the step it ended on and its item, beside the sound",
    /sessionStorage\.setItem\("sona\.boost\.sound",SOUND\)/.test(charge) && /sessionStorage\.setItem\("sona\.boost\.level",ITEM\.level\|\|"isolation"\); sessionStorage\.setItem\("sona\.boost\.ask",String\(ITEM\.word\|\|ITEM\.t\|\|""\)\)/.test(charge));
}

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
