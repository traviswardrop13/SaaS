// KIDS1: more than one child per device.
//
// The thing that has to be true: two children on one phone keep SEPARATE
// practice histories, and the family's entitlement is NOT one of the things
// that splits — a family pays once, so a second child must never land behind a
// paywall or re-trigger the OS mic prompt.
//
// The first child keeps the original un-suffixed keys, so an existing family
// needs no migration. That is the case most likely to break silently, so it is
// asserted directly.
import { createServer } from "http";
import { readFileSync, existsSync, readdirSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  // A saved pre-fix shared script makes the sibling-run regression reproducible.
  const p = u.pathname === "/sona.js" && process.env.KIDTEST_SONA_SOURCE ? process.env.KIDTEST_SONA_SOURCE : ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8153, r));

const browser = await chromium.launch(launchOpts());
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
const page = await ctx.newPage();
let errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript(() => {
  // an EXISTING family, already on the un-suffixed keys
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true, practicePosition: "f" }));
  localStorage.setItem("sona.sub.v1", JSON.stringify({ active: true, source: "apple" }));
  localStorage.setItem("sona.micok", "1");
});
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

await page.goto("http://localhost:8153/today.html");
await page.waitForTimeout(700);

// ── the existing family becomes kid one, on their own keys ──
let st = await page.evaluate(() => ({
  kids: Sona.kids(),
  active: Sona.activeKid(),
  name: Sona.getProfile().childName,
}));
ok("an existing family seeds one kid", st.kids.length === 1, JSON.stringify(st.kids));
ok("that kid is the active one", !!st.active && st.active.slot === "", JSON.stringify(st.active));
ok("their name comes from their own profile", st.name === "Milo", st.name);

// An unfinished adventure belongs to this child, including an earned but
// unopened chest. Keep the exact payload: switching must neither lose nor
// reinterpret any completed work. No microphone or practice engine is used.
await page.evaluate(() => {
  window.__kidRunA = JSON.stringify({ active: true, round: 2, tries: 8, sound: "R", pending: false, scores: [12, 9], sum: 21, ready: { round: 2, chest: { taps: 1, opened: false } } });
  window.__kidRunB = JSON.stringify({ active: true, round: 1, tries: 4, sound: "S", pending: true, scores: [7], sum: 7 });
  window.__kidRecordingKeyA = Sona.kkey("sona.reclast");
  sessionStorage.setItem("sona.run.v1", window.__kidRunA);
});

// ── add a sibling: separate profile, separate progress, from the first write ──
st = await page.evaluate(() => {
  const slot = Sona.addKid("Ana", "5");
  const runCleared = sessionStorage.getItem("sona.run.v1") === null;
  const recordingKey = Sona.kkey("sona.reclast");
  sessionStorage.setItem("sona.run.v1", window.__kidRunB);
  Sona.saveProfile({ focusSounds: ["S"], onboarded: true });
  Sona.bumpReps(9);
  const g = Sona.getProgress(); g.stage = g.stage || {}; g.stage.S = 2;
  localStorage.setItem(Sona.kkey("sona.progress.v1"), JSON.stringify(g));
  return {
    slot, runCleared, recordingKey, originalRecordingKey: window.__kidRecordingKeyA,
    name: Sona.getProfile().childName, age: Sona.getProfile().childAge,
    focus: Sona.getProfile().focusSounds,
    reps: Sona.repsToday(),
    kids: Sona.kids().map((k) => k.name + (k.active ? "*" : "")),
  };
});
ok("adding a child starts without the previous child's active adventure", st.runCleared, JSON.stringify(st));
ok("the daily recording marker is separate for each child", st.recordingKey !== st.originalRecordingKey, JSON.stringify(st));
ok("adding a kid takes a new slot", st.slot === "k2", st.slot);
ok("the new kid is switched to immediately", /Ana\*/.test(st.kids.join(",")), st.kids.join(","));
ok("their name and age land on THEIR profile", st.name === "Ana" && st.age === "5", JSON.stringify(st));
ok("their focus sounds are their own", JSON.stringify(st.focus) === '["S"]', JSON.stringify(st.focus));
ok("their reps are their own", st.reps === 9, String(st.reps));

// ── switch back: kid one is exactly as they were ──
st = await page.evaluate(() => {
  Sona.switchKid("");
  return {
    name: Sona.getProfile().childName,
    focus: Sona.getProfile().focusSounds,
    pos: Sona.getProfile().practicePosition,
    reps: Sona.repsToday(),
    stageS: (Sona.getProgress().stage || {}).S,
    runRestored: sessionStorage.getItem("sona.run.v1") === window.__kidRunA,
  };
});
ok("switching back restores the first child's exact unfinished adventure", st.runRestored, JSON.stringify(st));
ok("switching back restores the first child's profile", st.name === "Milo", st.name);
ok("their focus sound was never overwritten", JSON.stringify(st.focus) === '["R"]', JSON.stringify(st.focus));
ok("their word position survived", st.pos === "f", st.pos);
ok("the sibling's reps did not leak in", st.reps === 0, String(st.reps));
ok("the sibling's earned rung did not leak in", st.stageS === undefined, JSON.stringify(st.stageS));

// ── entitlement is FAMILY-wide: paying twice for two kids is not a thing ──
st = await page.evaluate(() => {
  const a = !!(Sona.isSubscribed && Sona.isSubscribed());
  Sona.switchKid("k2");
  const b = !!(Sona.isSubscribed && Sona.isSubscribed());
  const siblingRunRestored = sessionStorage.getItem("sona.run.v1") === window.__kidRunB;
  const mic = localStorage.getItem("sona.micok");
  Sona.switchKid("");
  const originalRunRestored = sessionStorage.getItem("sona.run.v1") === window.__kidRunA;
  return { a, b, mic, siblingRunRestored, originalRunRestored };
});
ok("repeated switching restores each child's own run without overwriting either", st.siblingRunRestored && st.originalRunRestored, JSON.stringify(st));
ok("both children share the family's plan", st.a === true && st.b === true, JSON.stringify(st));
ok("the mic grant is per DEVICE, not per child", st.mic === "1", String(st.mic));

// ── removing a sibling clears their data and never leaves zero children ──
st = await page.evaluate(() => {
  const before = Sona.kids().length;
  // Simulate another saved step for the active child just before removal, so
  // this check fails independently of a broken preceding switch.
  sessionStorage.setItem("sona.run.v1", window.__kidRunA);
  const removedLast = Sona.removeKid("");         // two exist, so this one is allowed
  Sona.switchKid("");
  const midway = Sona.kids().length;
  return { before, removedLast, midway, active: Sona.activeKid().slot, survivorRun: sessionStorage.getItem("sona.run.v1") === window.__kidRunB, removedRunAbsent: sessionStorage.getItem("sona.run.v1") !== window.__kidRunA, keys: Object.keys(localStorage).filter((k) => k.indexOf("@k2") > -1).length };
});
ok("removing the active child restores the survivor's run without the removed run", st.active === "k2" && st.survivorRun && st.removedRunAbsent, JSON.stringify(st));
ok("a removal takes the child out of the list", st.midway === st.before - 1, JSON.stringify(st));

st = await page.evaluate(() => ({ blocked: Sona.removeKid(Sona.kids()[0].slot), n: Sona.kids().length }));
ok("the last child can never be removed", st.blocked === false && st.n === 1, JSON.stringify(st));

// ── a grandfathered household stays grandfathered through its children ──
// (24 Sep 2026) The free-era sweeps mark the profiles that exist when they
// run, and earlyAdopterAnyKid() only reads children still on the list. A
// family who added a sibling and then removed the first child — the only one
// ever marked — dropped to the free version. addKid copies the household's
// mark onto the new child now; a household without one gives none.
{
  const c2 = await browser.newContext(); const p2 = await c2.newPage();
  await p2.goto("http://localhost:8153/today.html"); await p2.waitForTimeout(400);
  const seed = (early) => p2.evaluate((early) => {
    localStorage.clear();
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done");
    localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done"); localStorage.setItem("sona.freeera5.v1", "done");
    localStorage.setItem("sona.profile.v1", JSON.stringify(Object.assign({ childName: "Ada", childAge: "6", focusSounds: ["R"], onboarded: true }, early ? { earlyAdopter: true, freeEra: true, freeEra4: true } : {})));
    sessionStorage.setItem("sona.paidui", "1");
    localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
  }, early);
  await seed(true);
  st = await p2.evaluate(() => {
    const before = Sona.premium();
    Sona.addKid("Ben", "5");
    const copied = !!Sona.getProfile().earlyAdopter;
    const removed = Sona.removeKid("");              // the child the sweep marked
    return { before, copied, removed, kids: Sona.kids().length, after: Sona.premium(), tiles: Sona.gameAccess("tiles").allowed };
  });
  ok("a new child in a grandfathered household carries the household's grant", st.before === true && st.copied === true, JSON.stringify(st));
  ok("…so removing the first child keeps the family's Premium", st.removed && st.kids === 1 && st.after === true && st.tiles === true, JSON.stringify(st));
  await seed(false);
  st = await p2.evaluate(() => { Sona.addKid("Cy", "5"); return { early: !!Sona.getProfile().earlyAdopter, premium: Sona.premium() }; });
  ok("…while a household never grandfathered gains nothing by adding one", st.early === false && st.premium === false, JSON.stringify(st));
  await c2.close();
}

// ── a level is earned by ONE child's two passes, never two siblings' one each ──
// (1 Oct 2026) The practice page counted "two clean first-listen passes at the
// stretch level" under a key named for the sound and rung
// ("sona.rungwins.R.0") and ran it through kkey() — but PER_KID holds fixed
// names, so that key was never suffixed and the count belonged to the device.
// Milo's one pass plus Ana's one pass moved a level for whichever of them
// passed second. The count lives in each child's own progress now
// (Sona.rungWin). When a level is earned is Rachel's rule and is not what
// this pins; this pins whose passes are counted.
{
  const c2 = await browser.newContext(); const p2 = await c2.newPage();
  const e2 = []; p2.on("pageerror", (e) => e2.push(e.message));
  await p2.goto("http://localhost:8153/today.html"); await p2.waitForTimeout(400);
  await p2.evaluate(() => {
    localStorage.clear();
    ["", "2", "3", "4", "5"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true }));
    // what a real device may still hold from the build before this one: a
    // device-wide pass. It is not read, so it can complete nobody's level.
    localStorage.setItem("sona.rungwins.R.0", "1");
    Sona.addKid("Ana", "7"); Sona.saveProfile({ focusSounds: ["R"], onboarded: true });
    Sona.switchKid("");
  });
  const level = () => p2.evaluate(() => {
    const was = Sona.activeKid().slot, out = {};
    Sona.switchKid(""); out.milo = Sona.rungOf("R");
    Sona.switchKid("k2"); out.ana = Sona.rungOf("R");
    Sona.switchKid(was);
    return out;
  });
  const pass = (slot, rung) => p2.evaluate(([slot, rung]) => { Sona.switchKid(slot); return Sona.rungWin("R", rung); }, [slot, rung || 0]);

  await pass("");                                   // Milo: one clean stretch round on R
  st = await level();
  ok("one pass alone earns no level, whatever an older build left on the device", st.milo === 0 && st.ana === 0, JSON.stringify(st));
  await pass("k2");                                 // Ana: one clean stretch round on R
  st = await level();
  ok("one pass from each of two siblings moves NEITHER child's earned level", st.milo === 0 && st.ana === 0, JSON.stringify(st));
  await pass("");                                   // Milo's second
  st = await level();
  ok("the child who passes a second time earns the level — and only that child", st.milo === 1 && st.ana === 0, JSON.stringify(st));
  await pass("k2");                                 // Ana's own second
  st = await level();
  ok("the sibling still needs, and gets, a second pass of their own", st.milo === 1 && st.ana === 1, JSON.stringify(st));
  await pass("", 0); await pass("", 0);             // two passes a level BELOW what Milo has earned
  st = await level();
  ok("an earned level never moves down", st.milo === 1, JSON.stringify(st));

  // half-earned travels with the child in a backup, and stays theirs
  await pass("", 1);                                // Milo: one pass at the next stretch
  st = await p2.evaluate(() => {
    const backup = Sona.exportString();
    const stray = Object.keys(localStorage).filter((k) => k.indexOf("sona.rungwins") === 0 && k !== "sona.rungwins.R.0");
    const old = localStorage.getItem("sona.rungwins.R.0");
    localStorage.clear();
    const r = Sona.importData(backup);
    Sona.switchKid("k2"); const anaFirst = Sona.rungWin("R", 1);   // Ana's first at that level
    Sona.switchKid(""); const miloSecond = Sona.rungWin("R", 1);   // Milo's second
    return { stray, old, restored: r.ok, anaFirst, miloSecond };
  });
  ok("the count is kept in the child's progress — no key of its own, old one untouched", st.stray.length === 0 && st.old === "1", JSON.stringify(st));
  ok("a restored backup keeps each child's half-earned level with that child", st.restored && st.miloSecond === 2 && st.anaFirst === 1, JSON.stringify(st));

  // removing a child removes their count with the rest of their progress
  st = await p2.evaluate(() => {
    Sona.switchKid("k2"); Sona.rungWin("S", 0);
    const had = /"rungWins":\{[^}]*"S\.0":1/.test(localStorage.getItem("sona.progress.v1@k2") || "");
    Sona.removeKid("k2");
    return { had, left: Object.keys(localStorage).filter((k) => k.indexOf("@k2") > -1) };
  });
  ok("removing a child removes their half-earned levels too", st.had && st.left.length === 0, JSON.stringify(st));
  ok("no pageerrors (levels)", e2.length === 0, e2.join(" | "));
  await c2.close();
}

// ── per-kid keys that pages own directly must be namespaced too ──
// PER_KID is a promise; a key listed there but read with a raw localStorage call
// keeps none of it. These are the live surfaces that keep their own key.
{
  const lib = readFileSync(ROOT + "/library.html", "utf8");
  const feed = readFileSync(ROOT + "/arcade-feed.html", "utf8");
  const story = readFileSync(ROOT + "/story.html", "utf8");
  const today = readFileSync(ROOT + "/today.html", "utf8");
  ok("library read-stars are per child", /Sona\.kkey\("sona\.lib\.read\.v1"\)/.test(lib));
  ok("library's story-done check is per child", /kkey\("sona\.games\.v1"\)/.test(lib));
  ok("Echo's size is per child", /Sona\.kkey\("sona\.feed\.v1"\)/.test(feed));
  ok("Story Time's finished flag is per child", /kkey\("sona\.games\.v1"\)/.test(story));
  // …and the reverse: kkey() only suffixes the fixed names in PER_KID, so a
  // key BUILT at run time ("sona.rungwins." + sound + …) passes straight
  // through un-suffixed while reading as if it were per-child.
  {
    const built = readdirSync(ROOT).filter((f) => /\.(html|js)$/.test(f))
      .filter((f) => /kkey\(\s*(?:"[^"]*"|'[^']*')\s*\+/.test(readFileSync(ROOT + "/" + f, "utf8")));
    ok("no page hands kkey() a key built at run time", built.length === 0, built.join(", "));
    const charge = readFileSync(ROOT + "/charge.html", "utf8");
    ok("the practice page counts level passes through Sona.rungWin, with no key of its own",
      /S\.rungWin\(SOUND,useRung,POS\)/.test(charge) && !/sona\.rungwins/.test(charge));
  }
  // the comeback greeting was removed on Travis's call — nothing should write
  // its key or resurrect the overlay
  ok("the comeback popup stays gone", !/cbOvl|sona\.comeback\.v1/.test(today));
  // the first-run guard runs before sona.js and must resolve the slot itself
  ok("the first-run guard reads the ACTIVE child's profile",
    /sona\.kids\.v1[\s\S]{0,320}sona\.profile\.v1"\s*\+\s*\(slot/.test(today),
    "it would always read child one, so a new sibling would skip setup");
}

// ── Settings surfaces the switcher ──
await page.goto("http://localhost:8153/settings.html?gate=1");
await page.waitForTimeout(600);
await page.evaluate(() => { try { Sona.gateVerify(); } catch (e) {} });
await page.goto("http://localhost:8153/settings.html");
await page.waitForTimeout(700);
const ui = await page.evaluate(() => ({
  card: !!document.getElementById("kidsCard"),
  rows: document.querySelectorAll("#kidList [data-slot]").length,
  active: document.querySelectorAll('#kidList [data-active="1"]').length,
  addBtn: !!document.getElementById("addKidBtn"),
  copy: (document.getElementById("kidsCard") || {}).textContent || "",
}));
ok("Settings has a Kids card", ui.card);
ok("it lists every child", ui.rows >= 1, "rows=" + ui.rows);
ok("exactly one child is marked as practicing now", ui.active === 1, "active=" + ui.active);
ok("it offers adding a kid", ui.addBtn);
// The line under "Your family" no longer says "Everything below this card
// belongs to whoever is selected" (22 Oct 2026: Settings is down to the
// minimum). What tells a parent whose settings these are is the child card
// itself: it is headed with the selected child's name.
ok("it says each child keeps their own sounds and progress", /Each child keeps their own sounds and progress\./.test(ui.copy), ui.copy.slice(0, 120));
{
  const head = await page.evaluate(() => ({ title: (document.getElementById("aboutTitle") || {}).textContent || "", name: Sona.getProfile().childName, active: (document.querySelector('#kidList [data-active="1"]') || {}).textContent || "" }));
  ok("the child card under it is headed with the selected child's name", !!head.name && head.title.trim() === "About " + head.name && head.active.indexOf(head.name) >= 0, JSON.stringify(head));
}

// ── Word position: every position can be picked (Travis, 22 Oct 2026: "a
// full, in-depth, thorough build-out of word positions … build that so it
// works in the games"; from 1 Oct only the start of a word was open). The
// switch is still Sona.FAMILY_POSITIONS. The family's pick is
// profile.wordPosition; the old practicePosition is never read again, so a
// pick saved before 1 Oct cannot come back on its own. ──
{
  const before = await page.evaluate(() => { const p = Sona.getProfile(), was = { practicePosition: p.practicePosition, wordPosition: p.wordPosition, ladderStart: p.ladderStart, focusSounds: p.focusSounds, childAge: p.childAge }; Sona.saveProfile({ practicePosition: "f", focusSounds: ["R", "S"] }); delete p.wordPosition; const q = Sona.getProfile(); delete q.wordPosition; delete q.ladderStart; localStorage.setItem(Sona.kkey("sona.profile.v1"), JSON.stringify(q)); return was; });
  await page.reload(); await page.waitForTimeout(700);
  const read = () => page.evaluate(() => {
    const el = document.getElementById("practicePos"), st = document.getElementById("ladderStart"), note = document.getElementById("posNote"), ln = document.getElementById("ladderNote");
    const vis = (n) => n && !n.hidden && n.getBoundingClientRect().height > 0 ? n.textContent.trim() : "";
    return {
      open: (Sona.FAMILY_POSITIONS || []).slice(), value: el.value, off: el.disabled, saved: Sona.getProfile().wordPosition,
      opts: [...el.options].map((o) => ({ v: o.value, off: o.disabled, text: o.textContent.trim() })),
      note: vis(note), practice: Sona.practicePos(), soundPos: Sona.soundPos("R"),
      start: st.value, startOff: st.disabled, startSaved: Sona.getProfile().ladderStart, startOpts: [...st.options].map((o) => o.value + "=" + o.textContent.trim()).join("|"),
      startLabel: (document.querySelector('label[for="ladderStart"]') || {}).textContent, ladderNote: vis(ln),
      order: !!(el.compareDocumentPosition(st) & 4) && !document.getElementById("gameLevel"),
    };
  });
  let pos = await read();
  ok("Settings lists all six word positions", pos.opts.map((o) => o.v).join() === "i,m,f,v,b,mix", JSON.stringify(pos.opts));
  ok("all six are open: nothing says coming soon", pos.open.join() === "i,m,f,v,b,mix" && pos.opts.every((o) => !o.off && !/coming soon/i.test(o.text)), JSON.stringify(pos.opts));
  ok("a position saved before 1 Oct (practicePosition) is never read: Beginning shows, and practice asks for the start of a word",
    pos.value === "i" && pos.practice === "i" && !pos.saved && !pos.note, JSON.stringify({ value: pos.value, practice: pos.practice, note: pos.note }));
  await page.selectOption("#practicePos", "f"); await page.waitForTimeout(250);
  pos = await read();
  ok("picking End of word saves it as wordPosition, by itself, and practice and the games read it",
    pos.saved === "f" && pos.practice === "f" && pos.soundPos === "f" && (await page.evaluate(() => Sona.playWords("R").map((w) => w.w).join())) === "car,star,door,four,bear", JSON.stringify(pos));
  ok("…and the line under it says the picture games use these words too", pos.note === "Games with pictures use these words too.", pos.note);
  await page.selectOption("#practicePos", "v"); await page.waitForTimeout(250);
  pos = await read();
  ok("Vocalic R with R and S: the line says S practices the start of words", pos.note === "Only R has vocalic R. S practices the start of words. Games with pictures use these words too." && (await page.evaluate(() => Sona.soundPos("S"))) === "i", pos.note);
  // a child with no R: vocalic R is greyed out, and so are blends without R, S or L
  await page.evaluate(() => Sona.saveProfile({ focusSounds: ["K"] }));
  await page.reload(); await page.waitForTimeout(700);
  pos = await read();
  ok("for a child on K only, vocalic R and blends are greyed out and say whose they are",
    pos.opts.filter((o) => o.off).map((o) => o.text).join("|") === "Vocalic R (er, ar, or…) · R only|Blends (tr, st, bl…) · R, S, L only", JSON.stringify(pos.opts));
  ok("…while the saved pick stays as it was, and K practices the start of words", pos.saved === "v" && (await page.evaluate(() => Sona.soundPos("K"))) === "i" && /K practices the start of words/.test(pos.note), JSON.stringify({ saved: pos.saved, note: pos.note }));
  // a four-year-old: vocalic R and blends are not given from a grown-up's pick
  // (Sona.soundPos; Rachel's call), and Settings says so
  await page.evaluate(() => Sona.saveProfile({ focusSounds: ["R"], childAge: "4" }));
  await page.reload(); await page.waitForTimeout(700);
  pos = await read();
  ok("for a four-year-old, vocalic R and blends are greyed out for their age, and the line says the start of words instead",
    pos.opts.filter((o) => o.off).map((o) => o.text).join("|") === "Vocalic R (er, ar, or…) · not for ages 2–4|Blends (tr, st, bl…) · not for ages 2–4"
    && /^Blends and vocalic R usually come later, so .+ practices the start of words\.$/.test(pos.note) && pos.soundPos === "i" && pos.saved === "v", JSON.stringify(pos));
  await page.evaluate(() => Sona.saveProfile({ focusSounds: ["R", "S"], wordPosition: "f", childAge: "7" }));
  await page.reload(); await page.waitForTimeout(700);
  // "Each day's practice starts with"
  pos = await read();
  ok("a second picker sits under Word position (and no game picker is back): Each day's practice starts with",
    pos.order && pos.startLabel === "Each day’s practice starts with" && pos.startOpts === "=The sound|syllable=Syllables|word=Words|sentence=Sentences" && pos.start === "" && !pos.startSaved, JSON.stringify(pos));
  // End's syllables ship switched off until someone has listened, so the day
  // goes from the sound straight to end words
  ok("its line shows the steps the practice page will really ask, at the place picked", /^R at the end of words: “rrrr”, then “(car|star|door|four|bear)”, one step each game\. Harder steps open as /.test(pos.ladderNote), pos.ladderNote);
  await page.selectOption("#ladderStart", "word"); await page.waitForTimeout(250);
  pos = await read();
  ok("picking Words saves it, and the day's practice starts at words", pos.startSaved === "word" && (await page.evaluate(() => Sona.ladderStart())) === 2
    && /^R at the end of words: “(car|star|door|four|bear)”, then “I see a (car|star|door|four|bear)”, one step each game\. A word that’s too hard steps back to “rrrr”\.$/.test(pos.ladderNote), pos.ladderNote);
  // 320 px: every choice of both pickers reads in full while closed
  await page.setViewportSize({ width: 320, height: 700 });
  const fit = await page.evaluate(() => ["practicePos", "ladderStart"].map((id) => { const el = document.getElementById(id), cs = getComputedStyle(el), c = document.createElement("canvas").getContext("2d");
    c.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
    return { id, room: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 28, widths: [...el.options].filter((o) => !o.disabled).map((o) => Math.ceil(c.measureText(o.textContent.trim()).width)) }; }));
  await page.setViewportSize({ width: 430, height: 932 });
  ok("every open choice of both pickers can be read in full while closed, on a 320 px phone", fit.every((f) => f.room > 100 && f.widths.every((w) => w > 20 && w <= f.room)), JSON.stringify(fit));
  // a speech therapist's homework: both pickers show what it sets, locked, and
  // saving anything else never writes the homework's position as the family's
  await page.evaluate(() => localStorage.setItem(Sona.kkey("sona.homework.v1"), JSON.stringify({ hw: { id: "hw1", title: "t", note: "n", sounds: ["R"], pos: "m", repsPerDay: 40, words: null, start: "2000-01-01", due: "2999-01-01", by: "Rachel" }, at: Date.now() })));
  await page.reload(); await page.waitForTimeout(700);
  pos = await read();
  ok("under homework the position picker shows the homework's, locked, and says so", pos.off && pos.value === "m" && pos.practice === "m" && /^Set by the speech therapist’s homework: Middle of word\./.test(pos.note), JSON.stringify(pos));
  ok("…and the day starts at the sound, locked, and the line says the homework climbs every step", pos.startOff && pos.start === "" && (await page.evaluate(() => Sona.ladderStart())) === 0 && /^The homework climbs every step, from the sound\. R in the middle of words: “rrrr”/.test(pos.ladderNote), pos.ladderNote);
  await page.click('#sounds [data-s="L"]'); await page.waitForTimeout(250);
  ok("…and changing a sound under homework keeps the family's own position and start", (await page.evaluate(() => [Sona.getProfile().wordPosition, Sona.getProfile().ladderStart].join())) === "f,word");
  await page.click('#sounds [data-s="L"]'); await page.waitForTimeout(250);
  await page.evaluate(() => localStorage.removeItem(Sona.kkey("sona.homework.v1")));
  await page.evaluate((was) => { Sona.saveProfile({ focusSounds: was.focusSounds || ["R"], practicePosition: was.practicePosition, childAge: was.childAge || "" }); const q = Sona.getProfile(); if (was.wordPosition) q.wordPosition = was.wordPosition; else delete q.wordPosition; if (was.ladderStart) q.ladderStart = was.ladderStart; else delete q.ladderStart; localStorage.setItem(Sona.kkey("sona.profile.v1"), JSON.stringify(q)); }, before);
  await page.reload(); await page.waitForTimeout(700);
}

// The day Sona.FAMILY_POSITIONS opens a second position, the picker comes back
// by itself with the closed ones still greyed, and the line steps aside. Played
// on its own phone, with the list widened as sona.js hands it to the page.
{
  const c3 = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const p3 = await c3.newPage();
  const e3 = []; p3.on("pageerror", (e) => e3.push(e.message));
  await p3.goto("http://localhost:8153/onboarding.html"); await p3.waitForTimeout(300);
  await p3.evaluate(() => {
    localStorage.clear();
    ["", "2", "3", "4", "5"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
    Sona.saveProfile({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true, wordPosition: "m" });
    Sona.gateVerify();
  });
  await c3.addInitScript(() => {
    let s; Object.defineProperty(window, "Sona", { configurable: true, get: () => s, set: (v) => { s = v; if (v && Array.isArray(v.FAMILY_POSITIONS)) v.FAMILY_POSITIONS = ["i", "m"]; } });
  });
  await p3.goto("http://localhost:8153/settings.html"); await p3.waitForTimeout(700);
  const two = await p3.evaluate(() => {
    const el = document.getElementById("practicePos"), box = document.getElementById("posBox"), note = document.getElementById("posNote");
    return { open: Sona.FAMILY_POSITIONS.join(), shown: !box.hidden && el.getBoundingClientRect().height > 0, value: el.value,
      off: [...el.options].filter((o) => o.disabled).map((o) => o.value).join(), noteHidden: !/For now/.test(note.hidden ? "" : note.textContent) };
  });
  ok("with a second position open, the picker shows by itself, the parent's saved Middle selected and the rest still greyed",
    two.open === "i,m" && two.shown && two.value === "m" && two.off === "f,v,b,mix", JSON.stringify(two));
  ok("…and the one-position line steps aside", two.noteHidden, JSON.stringify(two));
  ok("no pageerrors (two positions)", e3.length === 0, e3.join(" | "));
  await c3.close();
}

// ── No game-card picker (Travis, 22 Oct 2026: "simplify settings. It's too
// busy. Get rid of as much as we possibly can"). "Between rounds in a game,
// Echo asks for" set a ceiling on Fruit Slice's say-it cards by hand. It is
// gone, and so is any way to change a pick saved from it, so getProfile drops
// that pick (profile.gameLevel): a child's cards follow only what they have
// EARNED on the practice page (one step past it), never a stale pick that
// would hold them at that step for good. gameasktest holds the reader to it;
// this is the page and a real child's saved profile. ──
{
  // whoever is active here, as a seven-year-old on R who has earned the
  // syllable step, with an old "Just the sound" pick still in their profile
  const was = await page.evaluate(() => { const p = Sona.getProfile(), w = { focusSounds: p.focusSounds, childAge: p.childAge }; return { w, stage: localStorage.getItem(Sona.kkey("sona.progress.v1")) }; });
  await page.evaluate(() => {
    Sona.saveProfile({ focusSounds: ["R"], childAge: "7" });
    Sona.recordRung("R", 0, 1);
    const k = Sona.kkey("sona.profile.v1"), raw = JSON.parse(localStorage.getItem(k)); raw.gameLevel = "isolation"; localStorage.setItem(k, JSON.stringify(raw));
  });
  await page.reload(); await page.waitForTimeout(700);
  // Settings no longer loads the syllable lists (gamecontent.js): they were
  // there only to paint the picker's line. The cards are read the way a
  // round game reads them, with those lists on the page.
  const read = async () => { if (!(await page.evaluate(() => !!window.SonaContent))) await page.addScriptTag({ url: "/gamecontent.js" }); return page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem(Sona.kkey("sona.profile.v1")) || "{}");
    return {
      picker: ["gameLevel", "gameLevelBox", "gameLevelNote"].filter((id) => document.getElementById(id)),
      words: /Echo asks for|Between rounds|Sona decides|Just the sound|Sound, then syllables|Sound, syllables, word/.test(document.body.innerText),
      read: Sona.getProfile().gameLevel, stored: raw.gameLevel, rung: Sona.rungOf("R"), hold: Sona.gameHold("R"),
      top: Sona.gameTop("R"), asks: [0, 1, 2].map((c) => Sona.gameAsk("R", c, { first: true }).text),
    };
  }); };
  let g = await read();
  ok("Settings has no game-card picker: no control, no note, none of its words", g.picker.length === 0 && !g.words, JSON.stringify({ picker: g.picker, words: g.words }));
  ok("a saved \"Just the sound\" pick is dropped as the profile is read", g.stored === "isolation" && g.read === undefined, JSON.stringify({ stored: g.stored, read: g.read }));
  ok("…so the cards follow what the child earned: the sound, a syllable, then the short word",
    g.rung === 1 && g.hold === "" && g.top === 2 && g.asks[0] === "rrrr" && /^r(ee|ah|oh)$/.test(g.asks[1]) && g.asks[2] === "rot", JSON.stringify(g));
  // a parent's next change on this page writes the profile back without it
  await page.click('#sounds .sound[data-s="S"]'); await page.waitForTimeout(250);
  g = await read();
  ok("the next change saved on Settings (a sound tapped) takes the old pick out of the stored profile", g.stored === undefined && g.read === undefined, JSON.stringify({ stored: g.stored }));
  await page.click('#sounds .sound[data-s="S"]'); await page.waitForTimeout(250);
  // the other way: an old "short word" pick on a child who has earned nothing does not open the word
  await page.evaluate(() => {
    localStorage.removeItem(Sona.kkey("sona.progress.v1"));
    const k = Sona.kkey("sona.profile.v1"), raw = JSON.parse(localStorage.getItem(k)); raw.gameLevel = "word"; localStorage.setItem(k, JSON.stringify(raw));
  });
  await page.reload(); await page.waitForTimeout(700);
  g = await read();
  ok("an old \"short word\" pick on a child who has earned nothing opens no word: the sound, then syllables",
    g.stored === "word" && g.read === undefined && g.rung === 0 && g.top === 1 && g.asks[0] === "rrrr" && g.asks.slice(1).every((t) => /^r(ee|ah|oh)$/.test(t)), JSON.stringify(g));
  ok("…and dropping it wrote no earned level", (await page.evaluate(() => JSON.stringify(Sona.getProgress().stage))) === "{}");
  // Sona muted: only Echo's voice can model a syllable or a word, so the
  // cards keep the bare sound whatever was earned. Settings still shows the
  // one line that says so, and its button undoes it.
  await page.evaluate(() => { Sona.recordRung("R", 0, 1); Sona.saveProfile({ volume: 0 }); });
  await page.reload(); await page.waitForTimeout(700);
  await read();   // the syllable lists on the page, so the hold below is the mute's, not theirs
  const muted = await page.evaluate(() => ({ line: !document.getElementById("soundOff").hidden ? document.querySelector("#soundOff span").textContent.trim() : "", hold: Sona.gameHold("R"), asks: [0, 1, 2].map((c) => Sona.gameAsk("R", c, { first: true }).text).join() }));
  ok("with Sona's sound off, Settings says so and the cards keep the bare sound, whatever was earned",
    muted.line === "Sound is off in Sona." && muted.hold === "muted" && muted.asks === "rrrr,rrrr,rrrr", JSON.stringify(muted));
  await page.click("#soundOnBtn"); await page.waitForTimeout(250);
  g = await read();
  ok("…and \"Turn sound on\" brings the earned syllable and word back to the cards at once",
    (await page.evaluate(() => document.getElementById("soundOff").hidden)) && g.hold === "" && g.top === 2 && g.asks[2] === "rot", JSON.stringify(g));
  // Ages 2 to 4: Home shows them Fruit Slice too, and their cards keep the
  // bare sound, whatever was earned or left saved by the old picker. Whether
  // little ones should ever be asked a syllable is Rachel's call.
  await page.evaluate(() => { Sona.saveProfile({ childAge: "4" }); const k = Sona.kkey("sona.profile.v1"), raw = JSON.parse(localStorage.getItem(k)); raw.gameLevel = "word"; localStorage.setItem(k, JSON.stringify(raw)); });
  await page.reload(); await page.waitForTimeout(700);
  g = await read();
  ok("a four-year-old's cards keep the bare sound, with the word earned and an old \"short word\" pick still stored",
    g.rung === 1 && g.stored === "word" && g.hold === "little" && g.top === 0 && g.asks.join() === "rrrr,rrrr,rrrr" && (await page.evaluate(() => Sona.playStyle())) === "simple", JSON.stringify(g));
  ok("…and no picker appears for them either", g.picker.length === 0 && !g.words);
  await page.evaluate(({ w, stage }) => {
    Sona.saveProfile(w);
    const k = Sona.kkey("sona.progress.v1"); if (stage == null) localStorage.removeItem(k); else localStorage.setItem(k, stage);
  }, was);
  await page.reload(); await page.waitForTimeout(700);
}

// ── Remove and Add leave the page only once the saved tries are dealt with ──
// (30 Sep 2026) Both reload or move on at once, and leaving a page aborts an
// IndexedDB delete still in flight: Settings' Remove reloaded before the
// removed child's clips were deleted, every time, while repguardtest (which
// calls removeKid without leaving) passed. So this goes through the buttons.
{
  const c2 = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const p2 = await c2.newPage();
  const e2 = []; p2.on("pageerror", (e) => e2.push(e.message));
  p2.on("dialog", (d) => d.accept());
  const rows = () => p2.evaluate(() => new Promise((res) => {
    const o = indexedDB.open("sona", 1);
    o.onupgradeneeded = () => o.result.createObjectStore("recordings", { keyPath: "id", autoIncrement: true });
    o.onsuccess = () => { const g = o.result.transaction("recordings", "readonly").objectStore("recordings").getAll(); g.onsuccess = () => { o.result.close(); res(g.result.map((r) => r.kid || "")); }; };
    o.onerror = () => res(null);
  }));
  await p2.goto("http://localhost:8153/onboarding.html"); await p2.waitForTimeout(300);
  await p2.evaluate(async () => {
    localStorage.clear();
    ["", "2", "3", "4", "5"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
    Sona.saveProfile({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true });
    Sona.gateVerify();
    Sona.addKid("Ana", "5");
    await Sona.saveRecording({ sound: "S", word: "sun", blob: new Blob(["ana"], { type: "audio/webm" }) });
    Sona.switchKid("");
  });
  await p2.goto("http://localhost:8153/settings.html"); await p2.waitForTimeout(700);
  ok("the sibling has a saved try before the removal", (await rows() || []).includes("k2"));
  await Promise.all([p2.waitForNavigation({ timeout: 5000 }).catch(() => {}), p2.click('#kidList button[data-remove="k2"]')]);
  await p2.waitForTimeout(500);
  const left = await rows();
  ok("Settings' Remove deletes the removed child's saved tries from the phone", Array.isArray(left) && !left.includes("k2"), JSON.stringify(left));
  // A device that removed a child before this build left clips behind under
  // the slot the next child is given; Add must clear them before moving on.
  await p2.evaluate(() => new Promise((res) => { const o = indexedDB.open("sona", 1); o.onsuccess = () => { const tx = o.result.transaction("recordings", "readwrite"); tx.objectStore("recordings").add({ sound: "S", word: "sun", date: new Date().toISOString(), kid: "k3", blob: new Blob(["orphan"], { type: "audio/webm" }) }); tx.oncomplete = () => { o.result.close(); res(); }; }; }));
  await p2.click("#addKidBtn"); await p2.fill("#newKidName", "Ben"); await p2.fill("#newKidAge", "6");
  await Promise.all([p2.waitForURL(/\/onboarding\.html/, { timeout: 5000 }).catch(() => {}), p2.click("#newKidSave")]);
  await p2.waitForTimeout(300);
  const after = await rows();
  const slot = await p2.evaluate(() => (Sona.activeKid() || {}).slot);
  ok("Add gives the next child a fresh slot and clears what an older build left under it", slot === "k3" && Array.isArray(after) && !after.includes("k3"), JSON.stringify({ slot, after }));
  ok("no pageerrors (remove/add)", e2.length === 0, e2.join(" | "));
  await c2.close();
}

ok("no pageerrors", errs.length === 0, errs.join(" | "));
await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
