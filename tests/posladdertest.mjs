// POSLADDER1: every word position, and the climb at each (Travis, 22 Oct
// 2026: "a full, in-depth, thorough build-out of word positions … Rachel
// talks about the importance of not just saying the sound of the letter R, but
// to progress where we're doing re, ra, ru, and then we're doing a full word
// and applying that to each letter … build that so it works in the games …
// let's at least just build it in so it's an option that can be selected").
//
// What this holds:
//   - every position is open to families, saved as profile.wordPosition; the
//     old practicePosition (from before 1 Oct) is never read; homework wins,
//     for its own sounds;
//   - each sound is practised at a place it has words for (Sona.soundPos):
//     vocalic R is R's, blends are R's, S's and L's, TH (v) has no
//     start-of-word words;
//   - each place climbs on its own, with the sound alone shared, and R's end
//     and vocalic R one climb; reset, backup and a removal treat it like the
//     rest;
//   - every step is that place's: syllables from its own table (asked only
//     once someone has listened: SYL_POS_ON), its words, sentences built on
//     them; a step with nothing in it is skipped, never asked or earned
//     (every new place ships off: sound → words until someone listens);
//   - "Each day's practice starts with" (profile.ladderStart), and the
//     practice page's own climb, run from its source;
//   - a step down stays at the place and on the same target;
//   - sentences are English (SENT_FORM covers every bank word);
//   - the picture games ask the place's words; Feed Echo's wrong pictures
//     never carry the sound; the themes stay at the start of a word;
//   - a try at the sound alone or a syllable is never booked as a word place;
//   - Progress never shows "Talking" or "Mastered".
// The words, syllables and sentences themselves are Rachel's calls.
//
// No browser: sona.js and gamecontent.js run in node's vm with a stub window.
import vm from "vm";
import { readFileSync } from "fs";
import { ROOT } from "./_env.mjs";

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (typeof extra === "string" ? extra : JSON.stringify(extra)))); };

function boot(opts = {}) {
  const local = {}, session = {}, noop = () => {};
  const storage = (store) => ({ getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: (i) => Object.keys(store)[i] || null, get length() { return Object.keys(store).length; } });
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, setAttribute: noop, appendChild: noop, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [] });
  const ctx = {
    localStorage: storage(local), sessionStorage: storage(session), console, setTimeout, clearTimeout, setInterval, clearInterval,
    document: { addEventListener: noop, removeEventListener: noop, createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], body: el(), head: el(), documentElement: el(), cookie: "", visibilityState: "visible", referrer: "" },
    navigator: { userAgent: "node", mediaDevices: {} },
    location: { href: "http://x/charge.html", pathname: "/charge.html", search: "", hash: "", hostname: "x", origin: "http://x", replace: noop },
    addEventListener: noop, removeEventListener: noop, history: { replaceState: noop }, matchMedia: () => ({ matches: false, addEventListener: noop }),
    fetch: () => Promise.reject(new Error("offline")),
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ["", "2", "3", "4", "5"].forEach((n) => { local["sona.freeera" + n + ".v1"] = n ? "done" : "post"; });
  local["sona.profile.v1"] = JSON.stringify(Object.assign({ childName: "Mia", childAge: "7", focusSounds: ["R"], onboarded: true }, opts.profile || {}));
  vm.runInContext(readFileSync(ROOT + "/sona.js", "utf8"), ctx, { filename: "sona.js" });
  if (opts.content !== false) vm.runInContext(readFileSync(ROOT + "/gamecontent.js", "utf8"), ctx, { filename: "gamecontent.js" });
  return { S: ctx.Sona, SC: ctx.SonaContent, ctx, local, session };
}
const homework = (p, over) => { p.local[p.S.kkey("sona.homework.v1")] = JSON.stringify({ hw: Object.assign({ id: "hw1", title: "t", note: "n", sounds: ["R"], pos: "f", repsPerDay: 40, words: null, start: "2000-01-01", due: "2999-01-01", by: "Rachel" }, over || {}), at: 1 }); };
const words = (S, s, p) => S.WORDS[s].filter((w) => (w.pos || "i") === p).map((w) => w.w);

// ── 1. which place: the family's pick, never the old field; homework first ──
{
  const p = boot({ profile: { practicePosition: "f" } }), { S } = p;
  ok("all six positions are open to families", S.FAMILY_POSITIONS.join() === "i,m,f,v,b,mix");
  ok("a pick saved before 1 Oct (practicePosition) is never read: the start of a word", S.practicePos() === "i" && S.soundPos("R") === "i");
  S.saveProfile({ wordPosition: "m" });
  ok("the family's own pick (wordPosition) is the place", S.practicePos() === "m" && S.soundPos("R") === "m");
  S.saveProfile({ wordPosition: "zz" });
  ok("an id this build does not open reads as the start of a word", S.practicePos() === "i");
  S.saveProfile({ wordPosition: "m", focusSounds: ["R", "S"] });
  homework(p, { sounds: ["R"], pos: "f" });
  ok("homework's position wins for its own sounds", S.practicePos() === "f" && S.soundPos("R") === "f");
  ok("…and only for them: another sound keeps the family's place", S.soundPos("S") === "m");
}

// ── 2. a place each sound really has ──
{
  const at = (pos) => boot({ profile: { wordPosition: pos } }).S;
  ok("vocalic R is R's alone: S and K practise the start of words", at("v").soundPos("R") === "v" && at("v").soundPos("S") === "i" && at("v").soundPos("K") === "i");
  ok("blends are R's, S's and L's: K practises the start of words", ["R", "S", "L"].every((x) => at("b").soundPos(x) === "b") && at("b").soundPos("K") === "i");
  ok("TH (v) has no start-of-word words: it practises anywhere in a word", at("i").soundPos("THV") === "mix" && at("m").soundPos("THV") === "m");
  ok("Mixed is Mixed for every sound", ["R", "K", "THV"].every((x) => at("mix").soundPos(x) === "mix"));
  const p = boot({ profile: { wordPosition: "i" } }); homework(p, { pos: "i", words: ["car", "star"] });
  ok("homework that names this sound's words keeps its own position", p.S.soundPos("R") === "i" && p.S.ladderContent("R", 2).map((x) => x.word).join() === "car,star");
  ok("…and its syllables are those of the place its words sit (car, star: the end of a word)", p.S.ladderContent("R", 1).every((x) => x.pos === "f"));
}

// ── 2b. ages 2 to 4: never vocalic R or blends from a grown-up's pick ──
{
  const at = (pos) => boot({ profile: { wordPosition: pos, childAge: "4" } });
  ok("a four-year-old's vocalic R or blends pick practises the start of a word", at("v").S.soundPos("R") === "i" && at("b").S.soundPos("S") === "i");
  ok("…the middle and end of a word still apply", at("f").S.soundPos("R") === "f" && at("m").S.soundPos("R") === "m");
  const mx = at("mix").S;
  ok("…and their Mixed leaves out vocalic R and blend words", mx.playWords("R").length > 0 && mx.playWords("R").every((w) => w.pos !== "v" && w.pos !== "b") && mx.ladderContent("R", 2).every((x) => x.pos !== "v" && x.pos !== "b"));
  const hw = at("i"); homework(hw, { pos: "v" });
  ok("…while their speech therapist's homework keeps its own place", hw.S.soundPos("R") === "v");
}

// ── 3. one climb per place ──
{
  const p = boot({ profile: { wordPosition: "f" } }), { S } = p;
  ok("a fresh child starts every place at the sound", ["i", "m", "f", "v", "b", "mix"].every((x) => S.rungOf("R", x) === 0));
  S.rungWin("R", 0, "i"); S.rungWin("R", 0, "i");
  ok("the sound alone, passed at one place, counts at every place (it is the same sound)", ["i", "m", "f", "v", "b", "mix"].every((x) => S.rungOf("R", x) === 1));
  S.rungWin("R", 1, "f"); S.rungWin("R", 1, "f");
  ok("a step earned at the end of a word is that place's", S.rungOf("R", "f") === 2 && S.rungOf("R", "i") === 1 && S.rungOf("R", "m") === 1, [S.rungOf("R", "f"), S.rungOf("R", "i"), S.rungOf("R", "m")]);
  ok("…and R at the end of a word and vocalic R are one climb", S.rungOf("R", "v") === 2 && S.ladderKey("R", "f") === "R.v" && S.ladderKey("R", "v") === "R.v");
  ok("the start of a word keeps the sound's own record: stage.R, and win counts like \"R.1\"", JSON.stringify(S.getProgress().stage) === '{"R":1}' && JSON.stringify(S.getProgress().stageAt) === '{"R.v":2}');
  S.rungWin("R", 2, "m");
  ok("a place's wins are counted apart (\"R.m.2\")", S.getProgress().rungWins["R.m.2"] === 1 && !("R.2" in S.getProgress().rungWins));
  ok("Sona.rungOf(sound) with no place is the place practised now", S.rungOf("R") === S.rungOf("R", "f"));
  const back = S.exportString();
  S.resetProgress();
  ok("resetting practice steps clears every place's climb", S.rungOf("R", "f") === 0 && !S.getProgress().stageAt);
  S.importData(back);
  ok("…and a backup carries every place's climb", S.rungOf("R", "f") === 2 && S.rungOf("R", "i") === 1);
  const t = boot({ profile: { wordPosition: "i" } });
  const g = t.S.getProgress(); g.stage.THV = 3; t.local[t.S.kkey("sona.progress.v1")] = JSON.stringify(g);
  ok("TH (v)'s \"anywhere\" place keeps the sound's own climb (no step it earned is lost)", t.S.soundPos("THV") === "mix" && t.S.rungOf("THV") === 3);
  ok("Progress's milestones belong to a child: sona.firsts.v1 is per child", (() => { const slot = t.S.addKid("Sib", "6"); t.S.switchKid(slot); return t.S.kkey("sona.firsts.v1") !== "sona.firsts.v1"; })());
}

// ── 4. every step is the place's own ──
{
  const at = (pos, sound, on) => { const { S, SC } = boot({ profile: { wordPosition: pos } }); (on || []).forEach((p) => SC.SYL_POS_ON[p].push(sound)); return (r) => S.ladderContent(sound, r); };
  const off = boot({ profile: { wordPosition: "f" } });
  ok("every new place ships switched off: End of word, R climbs the sound, then end words (no syllable step)", off.S.ladderSteps("R").join() === "0,2,3" && off.S.ladderContent("R", 1).length === 0 && JSON.stringify(off.SC.SYL_POS_ON) === '{"m":[],"f":[],"v":[],"b":[]}');
  const f = at("f", "R", ["f"]);
  ok("switched on, End of word, R: the sound alone, then vocalic syllables, end words, sentences on end words",
    f(0)[0].t === "rrrr" && f(0)[0].pos === "" && f(1).map((x) => x.t).join() === "ar,or,air,ear,ire" && f(2).every((x) => x.pos === "f") && f(3).every((x) => x.pos === "f" && x.t.indexOf(x.word) > 0),
    [f(1).map((x) => x.t), f(2).map((x) => x.t)]);
  ok("…and Echo is given real words for the vocalic syllables (\"Say are\", never a bare \"ar\")", f(1).map((x) => x.say).join() === "are,ore,air,ear,ire");
  const i = at("i", "R");
  ok("Beginning of word, R: rah ree roo roh ray and start-of-word words, exactly as before", i(1).map((x) => x.t).join() === "rah,ree,roo,roh,ray" && i(2).map((x) => x.word).join() === words(boot().S, "R", "i").join());
  const m = boot({ profile: { wordPosition: "m" } });
  ok("a place whose syllables are not switched on yet has no syllable step: the climb goes from the sound to words", m.S.ladderSteps("R").join() === "0,2,3" && m.S.ladderContent("R", 1).length === 0);
  m.SC.SYL_POS_ON.m.push("R");
  ok("…switched on, its own table: ah-rah oo-roo oh-roh ay-ray", m.S.ladderSteps("R").join() === "0,1,2,3" && m.S.ladderContent("R", 1).map((x) => x.t).join() === "ah-rah,oo-roo,oh-roh,ay-ray");
  const th = boot({ profile: { wordPosition: "f" } });
  ok("TH (v) at the end of a word has no sentence step (no sentence holds bathe or breathe)", th.S.ladderSteps("THV").join() === "0,2" && th.S.ladderTop("THV") === 2);
  const k = boot({ profile: { wordPosition: "mix" } });
  ok("a word filed at two places is asked once (cake, at the start and end of K)", k.S.ladderContent("K", 2).filter((x) => x.word === "cake").length === 1);
  ok("the practice page's highest step is sentences: the talking step has nothing to say", k.S.PRACTICE_TOP === 3 && k.S.LADDER[k.S.PRACTICE_TOP] === "sentence");
}

// ── 5. the practice page's own climb, run from its source ──
{
  const charge = readFileSync(ROOT + "/charge.html", "utf8");
  const stepAt = (charge.match(/function stepAt\(r\)\{[^\n]*\}/) || [""])[0];
  const use = (charge.match(/var useRung = STEPS\[[^;]*;/) || [""])[0];
  ok("the practice page climbs the place's own steps (stepAt, STEPS)", !!stepAt && !!use && /S\.ladderSteps\(SOUND,POS\)/.test(charge) && /S\.rungOf\(SOUND,POS\)/.test(charge) && /S\.ladderStart\(\)/.test(charge));
  const day = (STEPS, RUNG, START) => [0, 1, 2, 3, 4].map((ROUNDIX) => vm.runInNewContext(stepAt + use + "useRung", { STEPS, RUNG, START, ROUNDIX, Math }));
  ok("a fresh child, every step: the sound, then syllables for the rest of the day", day([0, 1, 2, 3], 0, 0).join() === "0,1,1,1,1");
  ok("words earned: the sound, syllables, words, then sentences, and never the talking step", day([0, 1, 2, 3], 2, 0).join() === "0,1,2,3,3" && day([0, 1, 2, 3], 5, 0).join() === "0,1,2,3,3");
  ok("\"starts with Words\": words, then sentences", day([0, 1, 2, 3], 0, 2).join() === "2,3,3,3,3");
  ok("\"starts with Syllables\": syllables, then words", day([0, 1, 2, 3], 0, 1).join() === "1,2,2,2,2");
  ok("a place with no syllables switched on: the sound, then words", day([0, 2, 3], 0, 0).join() === "0,2,2,2,2" && day([0, 2, 3], 1, 0).join() === "0,2,3,3,3");
  ok("…and \"starts with Syllables\" there starts at words", day([0, 2, 3], 0, 1).join() === "2,3,3,3,3");
  ok("a place with no sentence step tops out at words", day([0, 1, 2], 3, 0).join() === "0,1,2,2,2" && day([0, 1, 2], 0, 3).join() === "2,2,2,2,2");
  ok("the round's step is the one its items come from: an empty step walks down, and the step with it",
    /for\(var ur=useRung;ur>=0&&!ITEMS\.length;ur--\)\{[^\n]*if\(ITEMS\.length\)useRung=ur; \}/.test(charge) && /if\(!ITEMS\.length\)\{ useRung=0;/.test(charge));
  ok("wins are counted at the place, never in a replay of the demonstration", /if\(v==="pass" && useRung>=RUNG && S && S\.rungWin && !DEMO_REPLAY\)/.test(charge) && /S\.rungWin\(SOUND,useRung,POS\)/.test(charge));
  ok("a try is logged with its step and place, and the place goes with the hand-over to the game",
    /level:ITEM\.level\|\|"",pos:ITEM\.pos\|\|""/.test(charge) && /sessionStorage\.setItem\("sona\.boost\.pos",POS\)/.test(charge));
  ok("Echo is given ITEM.say (a sentence without its full stop, a respelled syllable)", /ask="say "\+\(ITEM\.say\|\|ITEM\.display\|\|ITEM\.t\)/.test(charge));
  ok("a day that starts above the sound carries the mouth cue on its first round", /if\(ITEM&&START>0&&ROUNDIX===0\)ITEM\.cueFirst=true;/.test(charge) && /ITEM\.level==="isolation"\|\|ITEM\.cueFirst/.test(charge));
}

// ── 6. "Each day's practice starts with" ──
{
  const at = (v) => boot({ profile: { ladderStart: v } }).S.ladderStart();
  ok("the sound by default; syllables, words or sentences when picked; anything else is the sound", at("") === 0 && at("syllable") === 1 && at("word") === 2 && at("sentence") === 3 && at("conversation") === 0 && at("x") === 0);
  const p = boot({ profile: { ladderStart: "word" } }); homework(p);
  ok("under homework every day starts at the sound, whatever is saved", p.S.ladderStart() === 0);
}

// ── 7. a step down stays at the place, on the same target ──
{
  const { S, SC } = boot({ profile: { wordPosition: "f" } }); SC.SYL_POS_ON.f.push("R");
  const sent = S.ladderContent("R", 3).find((x) => x.word === "bear") || S.ladderContent("R", 3)[0];
  ok("a sentence steps down to its own word", S.stepDown(sent, "R", "f").word === sent.word && S.stepDown(sent, "R", "f").level === "word");
  const car = S.ladderContent("R", 2).find((x) => x.word === "car");
  ok("a word steps down to the syllable with its own vowel (car → ar, bear → air, four → or)", S.stepDown(car, "R", "f").t === "ar" && S.stepDown(car, "R", "f").level === "syllable"
    && S.stepDown(S.ladderContent("R", 2).find((x) => x.word === "bear"), "R", "f").t === "air" && S.stepDown(S.ladderContent("R", 2).find((x) => x.word === "four"), "R", "f").t === "or");
  const v = boot({ profile: { wordPosition: "v" } }); v.SC.SYL_POS_ON.v.push("R");
  ok("…and an \"er\" word (bird, water) steps down to the sound alone, which already is that vowel", v.S.stepDown(v.S.ladderContent("R", 2).find((x) => x.word === "bird"), "R", "v").level === "isolation");
  const ri = boot({ profile: { wordPosition: "i" } }).S;
  ok("at the start of a word, the syllable that shares the most of it (rabbit → rah)", ri.stepDown(ri.ladderContent("R", 2).find((x) => x.word === "rabbit"), "R", "i").t === "rah");
  ok("a syllable steps down to the sound alone", S.stepDown(S.ladderContent("R", 1)[0], "R", "f").level === "isolation");
  const s = boot({ profile: { wordPosition: "f", focusSounds: ["S"] } }).S;
  ok("where the syllables are off, a word steps down to the sound alone", s.stepDown(s.ladderContent("S", 2)[0], "S", "f").level === "isolation");
  const h = boot({ profile: { wordPosition: "i" } }); homework(h, { pos: "f", words: null });
  const rab = { t: "rabbit", word: "rabbit", level: "word", pos: "i" };
  ok("a word steps down at its OWN place (rabbit → rah, even under end-of-word homework)", /^r/.test(h.S.stepDown(rab, "R").t));
}

// ── 8. sentences that are English ──
{
  const { S, SC } = boot();
  const bank = [...new Set(Object.values(S.WORDS).flat().map((w) => w.w))];
  const missing = bank.filter((w) => !(w in SC.SENT_FORM)), odd = Object.keys(SC.SENT_FORM).filter((w) => !["a", "an", "none", "pl", "the", "my", "x"].includes(SC.SENT_FORM[w]));
  ok("SENT_FORM says how a sentence holds EVERY word in the bank (" + bank.length + ")", missing.length === 0 && odd.length === 0, { missing, odd });
  const vowel = bank.filter((w) => /^[aeiou]/.test(w) && ["a", "an"].includes(SC.SENT_FORM[w]));
  ok("every counted word starting with a vowel takes \"an\"", vowel.every((w) => SC.SENT_FORM[w] === "an"), vowel.filter((w) => SC.SENT_FORM[w] !== "an"));
  const all = [];
  for (const pos of ["i", "m", "f", "v", "b", "mix"]) for (const s of S.ALL_SOUNDS) for (let k = 0; k < 4; k++) all.push(...SC.sentences(s, pos));
  const bad = all.filter((x) => /\ba [aeiou]/i.test(x.t) || /\ban [^aeiou\s]/i.test(x.t) || SC.SENT_FORM[x.word] === "x" || /\s{2}/.test(x.t) || /\.\s*$/.test(x.say));
  ok("no sentence says \"a ear\", builds on a word that is not a thing, or gives Echo a full stop (" + all.length + " built)", bad.length === 0, bad.slice(0, 5).map((x) => x.t));
  ok("\"I see an egg.\", \"Here is milk.\", \"Here are grapes.\", \"I see the sun.\", \"I see my mom.\", and no sentence for \"think\"",
    SC.sentenceFor("egg", 0).t === "I see an egg." && SC.sentenceFor("milk", 3).t === "Here is milk." && SC.sentenceFor("grapes", 3).t === "Here are grapes." && SC.sentenceFor("sun", 0).t === "I see the sun." && SC.sentenceFor("mom", 0).t === "I see my mom." && SC.sentenceFor("think", 0) === null);
  ok("nobody \"has\" their mom or the sun: those take \"I like\" instead", SC.sentenceFor("mom", 1).t === "I like my mom." && SC.sentenceFor("sun", 1).t === "I like the sun.");
  ok("a word you count keeps the five frames exactly as they were", [0, 1, 2, 3, 4].map((i) => SC.sentenceFor("rabbit", i).t).join("|") === "I see a rabbit.|I have a rabbit.|Look at the rabbit.|Here is a rabbit.|I like my rabbit.");
  ok("\"sandwich\" is an end-of-word CH (its ch is at the end)", S.WORDS.CH.find((w) => w.w === "sandwich").pos === "f");
}

// ── 9. the games ──
{
  const at = (pos, over) => boot({ profile: Object.assign({ wordPosition: pos }, over || {}) });
  const f = at("f").S;
  ok("the picture games ask the place's words (End: car, star, door, four, bear)", f.playWords("R").map((w) => w.w).join() === words(f, "R", "f").join());
  ok("…and the start-of-word themes stay out (a themed \"rock\" would undo an end-of-word round)", f.gameWords("dino", "R").length === 0 && at("i").S.gameWords("dino", "R").map((w) => w.w).join() === "rock");
  ok("…once each (cake)", at("mix").S.playWords("K").filter((w) => w.w === "cake").length === 1);
  ok("…and GAMES_FOLLOW_POS is the one switch back to start-of-word words", f.GAMES_FOLLOW_POS === true);
  ok("a word carries the sound by its spelling, and an x is a k and an s", f.hasSound("glass", "S") && f.hasSound("fox", "K") && f.hasSound("fox", "S") && !f.hasSound("cat", "S") && !f.hasSound("ball", "R"));
  const feed = readFileSync(ROOT + "/arcade-feed.html", "utf8");
  ok("Feed Echo's wrong pictures never carry the practice sound", /!\(S\.hasSound&&S\.hasSound\(w\.w,SOUND\)\)/.test(feed));
}

// ── 10. what is booked as practice, and where ──
{
  const { S } = boot({ profile: { wordPosition: "f" } });
  S.logAttempt({ game: "charge", sound: "R", pass: true, word: "rrrr", level: "isolation", pos: "" });
  S.logAttempt({ game: "charge", sound: "R", pass: true, word: "ar", level: "syllable", pos: "f" });
  S.logAttempt({ game: "charge", sound: "R", pass: true, word: "car", level: "word", pos: "f" });
  S.logAttempt({ game: "charge", sound: "K", pass: true, word: "cake", level: "word", pos: "mix" });
  const o = S.outcomes();
  ok("the sound alone and a syllable are never booked as a place in a word", JSON.stringify(o.R.byPos) === '{"f":{"a":1,"p":1}}', o.R.byPos);
  ok("…every try still counts toward the sound", o.R.attempts === 3);
  ok("a word asked under Mixed is booked at its own bank place", JSON.stringify(o.K.byPos) === '{"i":{"a":1,"p":1}}', o.K.byPos);
}

// ── 11. what a grown-up reads ──
{
  const { S, local } = boot({ profile: { wordPosition: "f" } });
  const g = S.getProgress(); g.stage.R = 5; g.stageAt = { "R.v": 4 }; local[S.kkey("sona.progress.v1")] = JSON.stringify(g);
  ok("past the last step: \"All steps done\", never \"Talking\" or \"Mastered\"", S.stepLabel("R", "i") === "All steps done" && S.stepLabel("R", "f") === "All steps done");
  ok("ladderWhere lists each place climbed, named as practised (R at the end of a word)", S.ladderWhere("R").map((w) => w.pos + ":" + w.done).join() === "i:true,f:true");
  ok("one set of position names, with how a line says each", S.posPhrase("R", "f") === "R at the end of words" && S.posPhrase("R", "v") === "Vocalic R" && S.posPhrase("S", "b") === "S in blends" && S.posInfo("v").only.join() === "R");
  const pl = boot({ profile: { wordPosition: "f" } }), plan = pl.S.ladderPlan("R");
  ok("ladderPlan gives Settings the steps the practice page will ask, with a fixed example each", plan.pos === "f" && plan.have.join() === "0,2,3" && plan.steps[0].sample === "rrrr" && plan.steps[2].sample === "car" && plan.steps[3].sample === "I see a car.", plan);
  pl.SC.SYL_POS_ON.f.push("R");
  ok("…and the syllable step once it is switched on", pl.S.ladderPlan("R").have.join() === "0,1,2,3" && pl.S.ladderPlan("R").steps[1].sample === "ar");
}

console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
