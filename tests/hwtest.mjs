// HW1: homework an SLP assigned, and the app honouring it.
//
// The contract worth pinning is not "the API returns 200" — it is that an
// assignment CHANGES WHAT THE CHILD PRACTISES. Homework the app ignores is a
// checkbox, so every assertion below is about rotSounds(), the position, the
// rep goal and the word list actually deferring to it, plus the two things a
// clinician must not be able to do by accident: read another family's
// assignment, or have their date window quietly ignored.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", woff2: "font/woff2" };
let lastHwBody = null;
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/homework") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try { lastHwBody = JSON.parse(raw); } catch { lastHwBody = null; }
      res.writeHead(200, { "content-type": "application/json" });
      // the shape /api/homework really returns: the assignment, nothing else
      res.end(JSON.stringify({
        ok: true,
        hw: {
          id: "hw1", title: "R in the middle", note: "Two minutes after breakfast.",
          sounds: ["S"], pos: "f", repsPerDay: 40, words: null,
          start: "2000-01-01", due: "2999-01-01", by: "Rachel, CF-SLP",
        },
      }));
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

async function page() {
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:8191/today.html");
  await pg.evaluate(() => {
    localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done");
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
  ok("homework inside its window is what the child practises",
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
  ok("the SLP's own words are the ones practised",
    st.picked.length > 0 && st.picked.every((w) => ["bus", "glass"].indexOf(w) >= 0), JSON.stringify(st.picked));
  ok("words Sona has no target for fall back to the bank, never to an empty round",
    st.junk.length > 0, JSON.stringify(st.junk));
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
// A "this must NOT appear" assertion has to read CODE, not prose. Twice now a
// comment explaining why something was removed has tripped the check guarding
// its removal — the tombstone is not the corpse. Strip comments first.
const noComments = (src) => src
  .replace(/<!--[\s\S]*?-->/g, " ")      // html
  .replace(/\/\*[\s\S]*?\*\//g, " ")     // block
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1"); // line, without eating https://
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
  ok("homework is declared per-child",
    /"sona\.homework\.v1"/.test(readFileSync(ROOT + "/sona.js", "utf8").match(/const PER_KID[\s\S]{0,600}?\]\)/)[0]),
    "two siblings on one iPad must not share one assignment");
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
