// HW1: homework an SLP assigned, and the app honouring it.
//
// The contract worth pinning is not "the API returns 200" — it is that an
// assignment CHANGES WHAT THE CHILD PRACTICES. Homework the app ignores is a
// checkbox, so every assertion below is about rotSounds(), the position, the
// rep goal and the word list actually deferring to it, plus the two things a
// clinician must not be able to do by accident: read another family's
// assignment, or have their date window quietly ignored.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", woff2: "font/woff2" };
let lastHwBody = null;
// knobs the switch-race test turns: a response that takes long enough for a
// parent to change children while it is in flight, and an id that says whose
// assignment it is
let hwDelayMs = 0, hwId = "hw1";
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/homework") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try { lastHwBody = JSON.parse(raw); } catch { lastHwBody = null; }
      const send = () => {
        res.writeHead(200, { "content-type": "application/json" });
        // the shape /api/homework really returns: the assignment, nothing else
        res.end(JSON.stringify({
          ok: true,
          hw: {
            id: hwId, title: "R in the middle", note: "Two minutes after breakfast.",
            sounds: ["S"], pos: "f", repsPerDay: 40, words: null,
            start: "2000-01-01", due: "2999-01-01", by: "Rachel, CF-SLP",
          },
        }));
      };
      if (hwDelayMs) setTimeout(send, hwDelayMs); else send();
    });
    return;
  }
  if (u.pathname.startsWith("/api/")) { res.writeHead(200, { "content-type": "application/json" }); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8191, r));

const browser = await chromium.launch(launchOpts());
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };
// A "this must NOT appear" assertion has to read CODE, not prose. Twice now a
// comment explaining why something was removed has tripped the check guarding
// its removal — the tombstone is not the corpse. Strip comments first.
const noComments = (src) => src
  .replace(/<!--[\s\S]*?-->/g, " ")      // html
  .replace(/\/\*[\s\S]*?\*\//g, " ")     // block
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1"); // line, without eating https://

async function page() {
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8191/today.html");
  await pg.evaluate(() => {
    localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done"); localStorage.setItem("sona.freeera3.v1","done");localStorage.setItem("sona.freeera4.v1","done");localStorage.setItem("sona.freeera5.v1","done");
    Sona.saveProfile({ childName: "Mia", childAge: "7", focusSounds: ["R"], practicePosition: "i", dailyGoal: 15, onboarded: true });
  });
  return { ctx, pg };
}
// write the cache the way syncHomework() does, so these test the READER
const CACHE = (over) => `localStorage.setItem(Sona.kkey("sona.homework.v1"), JSON.stringify({ hw: Object.assign({
  id:"hw1", title:"R in the middle", note:"n", sounds:["S"], pos:"f", repsPerDay:40, words:null,
  start:"2000-01-01", due:"2999-01-01", by:"Rachel"
}, ${JSON.stringify(over || {})}), at: Date.now() }))`;

// ── 1. an assignment replaces what the app would have picked ──
{
  const { ctx, pg } = await page();
  const before = await pg.evaluate(() => ({ sounds: Sona.rotSounds(), pos: Sona.practicePos(), goal: Sona.repGoal() }));
  ok("without homework the family's own settings drive practice",
    before.sounds.join() === "R" && before.pos === "i" && before.goal === 15, JSON.stringify(before));

  await pg.evaluate(CACHE());
  const after = await pg.evaluate(() => ({
    sounds: Sona.rotSounds(), pos: Sona.practicePos(), goal: Sona.repGoal(), hw: !!Sona.homework(),
  }));
  ok("homework replaces the practice sound", after.hw && after.sounds.join() === "S", JSON.stringify(after));
  ok("…the word position", after.pos === "f", JSON.stringify(after));
  ok("…and the daily rep goal the jar fills to", after.goal === 40, JSON.stringify(after));
  await ctx.close();
}

// ── 1b. …and the position reaches the words the practice page asks for ──
// practicePos() returning "f" proved only the reader. The practice page's word
// step (ladderContent's word rung) and sentence step (gamecontent.js) each
// chose a position of their own, and neither was this one: End-of-word
// homework still asked for "rabbit" and "I see a rabbit." Travis, 30 Sep 2026:
// the position must actually drive the practice page, homework first, then the
// family's setting. The games keep start-of-word words on purpose.
// 1 Oct 2026: a family can pick only the start of a word for now
// (Sona.FAMILY_POSITIONS), so a Middle saved earlier asks for start-of-word
// words; homework's own position is untouched.
{
  const { ctx, pg } = await page();
  await pg.addScriptTag({ url: "/gamecontent.js" });   // charge.html loads it; today.html does not
  const st = await pg.evaluate((c) => {
    const at = (sound, rung) => {
      const pos = {}; Sona.WORDS[sound].forEach((w) => { pos[w.w] = w.pos || "i"; });
      return Sona.ladderContent(sound, Sona.LADDER.indexOf(rung)).map((x) => ({ t: x.t, word: x.word, pos: pos[x.word] }));
    };
    const read = (sound) => ({ pos: Sona.practicePos(), word: at(sound, "word"), sent: at(sound, "sentence") });
    const out = { sc: !!(window.SonaContent && SonaContent.sentences) };
    eval(c);                                         // homework: S at End; the family is on Beginning
    out.hw = read("S");
    localStorage.removeItem(Sona.kkey("sona.homework.v1"));
    Sona.saveProfile({ practicePosition: "m" });     // no homework; the family's setting says Middle, from before it was closed
    out.fam = read("R");
    return out;
  }, CACHE());
  const all = (xs, p) => xs.length > 0 && xs.every((x) => x.pos === p);
  const show = (xs) => JSON.stringify(xs.map((x) => x.t + " [" + x.pos + "]"));
  // a sentence built by gamecontent.js is a frame around the word; the bare
  // word is ladderContent's fallback for a page without it, which this is not
  const framed = (xs) => xs.every((x) => x.t !== x.word && x.t.indexOf(x.word) >= 0);
  ok("the sentence step is gamecontent.js's, not the bare-word fallback", st.sc && framed(st.hw.sent) && framed(st.fam.sent), show(st.hw.sent));
  ok("homework at End: every sentence is built on an End word", st.hw.pos === "f" && all(st.hw.sent, "f"), show(st.hw.sent));
  ok("…and so is every word at the word step", all(st.hw.word, "f"), show(st.hw.word));
  ok("no homework, family's old Middle setting: every sentence is built on a start-of-word word (Middle is not open to families yet)", st.fam.pos === "i" && all(st.fam.sent, "i"), show(st.fam.sent));
  ok("…and so is every word at the word step", all(st.fam.word, "i"), show(st.fam.word));
  await ctx.close();

  // Feed Echo, Bubble Pop and the Say & Play games (Hoops) ask for
  // start-of-word words whatever the setting says (Travis, 30 Sep 2026): which
  // positions suit a three-year-old's game is a separate call, Rachel's.
  const gameSrc = { "arcade-feed.html": /S\.wordsFor\(sound,\s*"i"\)/, "simple-play.js": /S\.wordsFor\(sound,\s*"i"\)/, "sayplay.js": /S\.wordsFor\(sound,\s*"i"\)/ };
  const drifted = Object.keys(gameSrc).filter((f) => !gameSrc[f].test(noComments(readFileSync(ROOT + "/" + f, "utf8"))));
  ok("the games keep start-of-word words", drifted.length === 0, "now reading another position: " + drifted.join(", "));
}

// ── 2. the date window is real in both directions ──
{
  const { ctx, pg } = await page();
  const st = await pg.evaluate((c) => {
    const out = {};
    const day = Sona.localDay();
    eval(c.replace('"2000-01-01"', '"2999-01-01"'));           // starts in the future
    out.future = { hw: !!Sona.homework(), sounds: Sona.rotSounds() };
    localStorage.removeItem(Sona.kkey("sona.homework.v1"));
    eval(c.replace('"2999-01-01"', '"2000-01-02"'));           // already ended
    out.past = { hw: !!Sona.homework(), sounds: Sona.rotSounds() };
    localStorage.removeItem(Sona.kkey("sona.homework.v1"));
    eval(c);
    out.now = { hw: !!Sona.homework(), sounds: Sona.rotSounds(), day };
    return out;
  }, CACHE());
  ok("homework that has not started yet changes nothing",
    st.future.hw === false && st.future.sounds.join() === "R", JSON.stringify(st.future));
  ok("homework past its end date changes nothing",
    st.past.hw === false && st.past.sounds.join() === "R", JSON.stringify(st.past));
  ok("homework inside its window is what the child practices",
    st.now.hw === true && st.now.sounds.join() === "S", JSON.stringify(st.now));
  await ctx.close();
}

// ── 3. a named word list is honoured, and unknown words never strand a round ──
{
  const { ctx, pg } = await page();
  const st = await pg.evaluate((c) => {
    eval(c.replace('words:null', 'words:["bus","glass"]'));
    const picked = Sona.wordsFor("S", Sona.practicePos()).map((w) => w.w);
    localStorage.removeItem(Sona.kkey("sona.homework.v1"));
    eval(c.replace('words:null', 'words:["zzzznotaword","qqqq"]'));
    const junk = Sona.wordsFor("S", Sona.practicePos()).map((w) => w.w);
    return { picked, junk, bankHas: Sona.WORDS.S.map((w) => w.w) };
  }, CACHE());
  ok("the SLP's own words are the ones practiced",
    st.picked.length > 0 && st.picked.every((w) => ["bus", "glass"].indexOf(w) >= 0), JSON.stringify(st.picked));
  ok("words Sona has no target for fall back to the bank, never to an empty round",
    st.junk.length > 0, JSON.stringify(st.junk));
  await ctx.close();
}

// Named homework wins even when a word could be on a themed court/pit.
{
  const {ctx,pg}=await page();
  const result=await pg.evaluate((cache)=>{
    const free={hoops:Sona.gameWords("hoops","S").map(w=>w.w),dino:Sona.gameWords("dino","S").map(w=>w.w)};
    eval(cache);
    const assigned={hoops:Sona.gameWords("hoops","S"),soccer:Sona.gameWords("soccer","S"),dino:Sona.gameWords("dino","S"),pool:Sona.wordsFor("S","i").map(w=>w.w),unassigned:Sona.gameWords("dino","R").map(w=>w.w)};
    localStorage.removeItem(Sona.kkey("sona.homework.v1"));
    return {free,assigned,restored:Sona.gameWords("dino","S").map(w=>w.w)};
  },CACHE({words:["bus","glass"]}));
  ok("Hoops and Dino have themed words without named homework",result.free.hoops.join() === "sock"&&result.free.dino.join()==="sand,sun",JSON.stringify(result));
  ok("named homework disables every game's themes for its assigned sound",result.assigned.hoops.length===0&&result.assigned.soccer.length===0&&result.assigned.dino.length===0&&result.assigned.pool.length===2&&result.assigned.pool.every(w=>["bus","glass"].includes(w)),JSON.stringify(result.assigned));
  ok("homework cannot disable themes for another sound, and removing it restores themes",result.assigned.unassigned.join()==="rock"&&result.restored.join()==="sand,sun",JSON.stringify(result));
  await ctx.close();
}

// ── 3b. the cards between a game's rounds follow the assignment too ──
// (Travis, 1 Oct 2026: "start with isolation then ree rah roh then rot".)
// Fruit Slice's card may now ask a syllable, then a short word. "ree" is an R
// at the START of a syllable: when the therapist set the end of a word, or
// "er, ar, or", that is a different target from hers. So under that homework
// the cards skip the syllable step: the sound, then one of the homework's own
// words if it names any. Read on the game's own page, through the one reader
// its card calls (Sona.gameAsk). What those cards should ask is Rachel's call.
{
  const { ctx, pg } = await page();
  // the grown-up picked the top step, so the word card is open to this child
  await pg.evaluate(() => Sona.saveProfile({ gameLevel: "word" }));
  const asks = async (over) => {
    await pg.evaluate(over ? CACHE(over) : `localStorage.removeItem(Sona.kkey("sona.homework.v1"))`);
    await pg.goto("http://localhost:8191/arcade-slice.html?from=charge");
    await pg.waitForFunction(() => window.Sona && window.SonaContent);
    return pg.evaluate(() => ({ pos: Sona.practicePos(), top: Sona.gameTop("R"), t: [0, 1, 2].map((c) => Sona.gameAsk("R", c).text) }));
  };
  const syl = (t) => /^r(ah|ee|oo|oh|ay)$/.test(t);
  let a = await asks({ sounds: ["R"], pos: "f", words: ["car", "star"] });
  ok("end-of-word homework: the game's cards stay on the sound, then ask one of the homework's own words",
    a.pos === "f" && a.t[0] === "rrrr" && a.t[1] === "rrrr" && ["car", "star"].indexOf(a.t[2]) >= 0, JSON.stringify(a));
  ok("…and never a start-of-word syllable", !a.t.some(syl), JSON.stringify(a.t));
  a = await asks({ sounds: ["R"], pos: "v", words: null });
  ok("\"er, ar, or\" homework that names no words: every card stays on the bare sound",
    a.pos === "v" && a.top === 0 && a.t.join() === "rrrr,rrrr,rrrr", JSON.stringify(a));
  a = await asks({ sounds: ["R"], pos: "i", words: ["rain"] });
  ok("start-of-word homework keeps the syllable step, and its word card asks the homework's word, not the app's",
    syl(a.t[1]) && a.t[2] === "rain", JSON.stringify(a));
  a = await asks(null);
  ok("with no homework the same child gets the app's own steps: the sound, a syllable, then rot",
    a.pos === "i" && a.top === 2 && syl(a.t[1]) && a.t[2] === "rot", JSON.stringify(a));
  await ctx.close();
}

// ── 4. the sync reports a TOTAL, never a delta ──
// A retried request must not be able to inflate a child's practice, the same
// reason mintCoins() derives from the day's count instead of incrementing.
{
  const { ctx, pg } = await page();
  lastHwBody = null;
  const st = await pg.evaluate(async (c) => {
    eval(c);
    Sona.startPilot("rachel");
    localStorage.setItem("sona.slpticket", "fake.ticket");
    Sona.bumpReps(7);
    await Sona.syncHomework(true);
    return { reps: Sona.repsToday() };
  }, CACHE());
  await pg.waitForTimeout(300);
  ok("the device reports today's rep TOTAL against the assignment it holds",
    lastHwBody && lastHwBody.reps === st.reps && lastHwBody.forId === "hw1", JSON.stringify(lastHwBody));
  ok("…and sends only the credential, the child id and a count — no audio, no name",
    lastHwBody && Object.keys(lastHwBody).sort().join() === "childId,code,forId,reps,ticket",
    JSON.stringify(Object.keys(lastHwBody || {})));
  await ctx.close();
}

// ── 5. no ticket, no homework ──
{
  const { ctx, pg } = await page();
  lastHwBody = null;
  await pg.evaluate(async () => {
    Sona.startPilot("rachel");
    localStorage.removeItem("sona.slpticket");
    await Sona.syncHomework(true);
  });
  await pg.waitForTimeout(300);
  ok("a device with no enrolment ticket never asks for an assignment", lastHwBody === null, JSON.stringify(lastHwBody));
  await ctx.close();
}

// ── 6. server-side contracts ──
// (noComments, defined at the top, keeps these reading code, not prose.)
{
  const hwLib = readFileSync(ROOT + "/../lib/homework.ts", "utf8");
  const devApi = readFileSync(ROOT + "/../app/api/homework/route.ts", "utf8");
  const slpApi = readFileSync(ROOT + "/../app/api/slp/homework/route.ts", "utf8");
  const auth = readFileSync(ROOT + "/../lib/slpAuth.ts", "utf8");

  ok("the clinic code comes from the session, never a query param",
    /codeFor\(s\.email\)/.test(slpApi) && !/searchParams\.get\("code"\)/.test(slpApi),
    "a clinic slug is printed on every family link");
  ok("a child must already be on the caseload before homework can be written",
    /not on your caseload/.test(slpApi),
    "otherwise an authenticated session can write arbitrary hash fields");
  ok("the device read requires a valid enrolment ticket",
    /readTicket\(ticket, code\)/.test(devApi) && /not enrolled/.test(devApi));
  ok("a ticket bound to one child cannot read another's homework",
    /t\.cid && t\.cid !== childId/.test(devApi),
    "one family on a caseload could otherwise read the whole caseload's targets");
  ok("tickets are bound to a child where we know it, and legacy ones still work",
    /if \(childId\) payload\.cid/.test(auth) && /cid\?: string/.test(auth));
  ok("reps are stored as a max, so a retry cannot inflate practice",
    /Math\.max\(prog\.days\[day\] \|\| 0, reps\)/.test(devApi));
  ok("the device is handed the assignment and nothing else",
    /function publicHomework/.test(devApi) && !/child:|childName/.test(devApi),
    "no name, no age, no roster — a family is not a clinician");
  ok("developmental norms are FLAGGED, not silently allowed or blocked",
    /aboveNorm/.test(hwLib) && /aboveNorm/.test(slpApi),
    "an SLP may be right to assign above the norm; they should still see it");
  ok("no diagnosis, goal-bank or clinical-notes field exists",
    !/diagnos|goalBank|clinicalNote|icd/i.test(noComments(hwLib)),
    "the moment this stores those it is a medical record");
  ok("the parent note is length-capped",
    /NOTE_MAX = \d+/.test(hwLib) && /slice\(0, NOTE_MAX\)/.test(hwLib));

  const slpHtml = readFileSync(ROOT + "/slp.html", "utf8");
  ok("the composer shows the parent's-eye view before sending",
    /What the family sees/.test(slpHtml) && /pvTitle/.test(slpHtml),
    "a clinician will not trust a send they cannot see the shape of");
  ok("the dashboard says pass rate, not accuracy",
    /Avg pass rate/.test(slpHtml) && !/Avg Accuracy/.test(slpHtml),
    "the on-device check asks 'did that sound like this sound', not 'was the word right'");
  ok("no therapy/treatment/diagnosis register on the clinician page",
    !/\b(diagnos\w*|treatment plan|plan of care)\b/i.test(noComments(slpHtml)),
    "product copy stays practice/homework/sounds — never clinical");
  // The 600-char window here did not merely fail when PER_KID grew — .match()
  // returned null and [0] THREW, taking the whole suite down with a stack
  // trace instead of a failing assertion. Matched to the list's real end now.
  const perKid = (readFileSync(ROOT + "/sona.js", "utf8")
    .match(/const PER_KID = new Set\(\[([\s\S]*?)\]\);/) || ["", ""])[1];
  ok("homework is declared per-child",
    perKid.includes('"sona.homework.v1"'),
    "two siblings on one iPad must not share one assignment");
  ok("…and so is the clinician identity that reports it",
    perKid.includes('"sona.pilot.v1"'),
    "siblings sharing one pilot childId overwrite each other's roster row");
}

// ── SWITCHING CHILDREN WHILE AN ASSIGNMENT IS IN FLIGHT ─────────────────
// The per-child pilot key fixed the synchronous half of sibling crossover.
// This is the asynchronous half, and it is the one that ends with a child
// practicing someone else's clinical assignment. save() resolves the active
// child at WRITE time, so a response that lands after a parent taps "switch
// child" was stored under the wrong slot: child A's SLP assignment became
// child B's, and B then practiced A's sound at A's position with A's reps
// reported against it.
{
  const { ctx, pg } = await page();
  const sib = await pg.evaluate(() => {
    localStorage.setItem("sona.slpticket", "fake.ticket");
    Sona.startPilot("rachel");                 // the first child is enrolled
    const slot = Sona.addKid("Sibling", "5");  // a sibling exists but is not
    Sona.switchKid("");                        // addKid makes the new child
    return slot;                               // active; go back to the first
  });
  ok("the first child is the enrolled one, and is active",
    await pg.evaluate(() => (Sona.activeKid() || {}).slot === "" && Sona.isPilot() === true));

  hwDelayMs = 900; hwId = "for-the-first-child";
  await pg.evaluate(() => { window.__hw = Sona.syncHomework(true); });
  await pg.waitForTimeout(150);
  await pg.evaluate((slot) => Sona.switchKid(slot), sib);   // mid-flight
  await pg.waitForTimeout(1500);
  hwDelayMs = 0;

  const landed = await pg.evaluate((slot) => ({
    first: JSON.parse(localStorage.getItem("sona.homework.v1") || "null"),
    sibling: JSON.parse(localStorage.getItem("sona.homework.v1@" + slot) || "null"),
    activeSees: Sona.homework(),
  }), sib);
  ok("an assignment lands on the child who asked for it",
    !!(landed.first && landed.first.hw && landed.first.hw.id === "for-the-first-child"),
    JSON.stringify(landed.first));
  ok("…and never on the sibling who happened to be active when it returned",
    landed.sibling === null,
    "a child practicing another child's SLP assignment: " + JSON.stringify(landed.sibling));
  ok("…so the sibling is still shown no homework at all",
    landed.activeSees === null, JSON.stringify(landed.activeSees));

  // …and the hourly throttle is per child too. One shared timestamp meant the
  // first child's sync silenced the sibling's for an hour, so a second child
  // on the same iPad could never see an assignment written minutes ago.
  lastHwBody = null; hwId = "for-the-sibling";
  await pg.evaluate(() => { Sona.startPilot("rachel"); });   // sibling enrols now
  await pg.evaluate(() => Sona.syncHomework());              // NOT forced
  await pg.waitForTimeout(500);
  ok("a sibling's own sync is not suppressed by the first child's",
    lastHwBody !== null, "the throttle must be per child, not per device");
  const sibHw = await pg.evaluate(() => Sona.homework());
  ok("…and the sibling's assignment is their own",
    !!(sibHw && sibHw.id === "for-the-sibling"), JSON.stringify(sibHw));
  await ctx.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
