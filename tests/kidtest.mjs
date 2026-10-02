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
      /S\.rungWin\(SOUND,useRung\)/.test(charge) && !/sona\.rungwins/.test(charge));
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
ok("it says the settings below belong to the selected child", /belongs to whoever is selected/i.test(ui.copy), ui.copy.slice(0, 120));

// ── Word position: every position is listed, only the start of a word can be
// picked (Travis, 1 Oct 2026: "have the options listed but to not let them
// select other positioning because it's not built yet ... make it clear that
// it's just the initial position"). The switch is Sona.FAMILY_POSITIONS. ──
{
  // this child saved End of word before the others were closed
  const before = await page.evaluate(() => { const was = Sona.getProfile().practicePosition; Sona.saveProfile({ practicePosition: "f" }); return was; });
  await page.reload(); await page.waitForTimeout(700);
  const pos = await page.evaluate(() => {
    const el = document.getElementById("practicePos"), note = document.getElementById("posNote");
    return {
      open: (Sona.FAMILY_POSITIONS || []).slice(), value: el.value, saved: Sona.getProfile().practicePosition,
      opts: [...el.options].map((o) => ({ v: o.value, off: o.disabled, text: o.textContent.trim() })),
      note: note && !note.hidden && note.getBoundingClientRect().height > 0 ? note.textContent.trim() : "",
      practice: Sona.practicePos(),
    };
  });
  const off = pos.opts.filter((o) => o.v !== "i");
  ok("Settings lists all six word positions", pos.opts.map((o) => o.v).join() === "i,m,f,v,b,mix", JSON.stringify(pos.opts));
  ok("only Beginning of word can be picked", pos.open.join() === "i" && !pos.opts[0].off && off.every((o) => o.off), JSON.stringify(pos.opts));
  ok("each of the others says it is coming soon, and Beginning does not", off.every((o) => /coming soon$/i.test(o.text)) && !/coming soon/i.test(pos.opts[0].text), JSON.stringify(pos.opts.map((o) => o.text)));
  ok("a line under the list says practice is at the beginning of a word for now", /beginning of a word/i.test(pos.note) && /coming soon/i.test(pos.note), pos.note);
  ok("a child whose saved position was End sees Beginning selected, and practice asks for the start of a word",
    pos.saved === "f" && pos.value === "i" && pos.practice === "i", JSON.stringify({ saved: pos.saved, value: pos.value, practice: pos.practice }));
  await page.evaluate((was) => Sona.saveProfile({ practicePosition: was || "i" }), before);
}

// ── What a game's say-it card asks for: one picker, per child (Travis, 1 Oct
// 2026: "start with isolation then ree rah roh then rot. and maybe have that
// be something to update in settings"). A ceiling for the cards between
// rounds; it never writes the level the child has earned. Its grey line is
// painted from the reader the games call, so it says only what will really be
// asked, names the one game that does it so far, and says why when something
// holds the cards to the bare sound (Sona muted, a sound not switched on, a
// speech therapist's homework for another part of the word). ──
{
  // whoever is active here, as a seven-year-old on R with nothing picked yet
  const was = await page.evaluate(() => { const p = Sona.getProfile(), w = { focusSounds: p.focusSounds, childAge: p.childAge, gameLevel: p.gameLevel || "" }; Sona.saveProfile({ focusSounds: ["R"], childAge: "7", gameLevel: "" }); return w; });
  await page.reload(); await page.waitForTimeout(700);
  const read = () => page.evaluate(() => {
    const el = document.getElementById("gameLevel"), box = document.getElementById("gameLevelBox"), note = document.getElementById("gameLevelNote");
    return {
      label: (document.querySelector('label[for="gameLevel"]') || {}).textContent, value: el.value, shown: !box.hidden && box.getBoundingClientRect().height > 0,
      opts: [...el.options].map((o) => ({ v: o.value, text: o.textContent.trim(), off: o.disabled })), note: note.textContent.trim(),
      asks: [0, 1, 2].map((c) => Sona.gameAsk("R", c, { first: true }).text).filter((t, i, a) => a.indexOf(t) === i),
      soundOff: !document.getElementById("soundOff").hidden, hold: Sona.gameHold(Sona.rotSounds()[0]),
      saved: Sona.getProfile().gameLevel, stage: JSON.stringify(Sona.getProgress().stage), slot: Sona.activeKid().slot, under: !!(document.getElementById("practicePos").compareDocumentPosition(el) & 4),
    };
  });
  const quoted = (a) => a.map((t) => "“" + t + "”").join(", then ");
  let g = await read();
  ok("Settings has the picker under Word position, labelled for what it changes: between rounds in a game", g.shown && g.under && g.label === "Between rounds in a game, Echo asks for", JSON.stringify({ shown: g.shown, under: g.under, label: g.label }));
  ok("it has four choices, all open, and starts on \"Sona decides\"",
    g.opts.map((o) => o.v).join() === ",isolation,syllable,word" && g.opts.every((o) => !o.off) && g.value === "" && !g.saved
    && g.opts.map((o) => o.text).join("|") === "Sona decides|Just the sound|Sound, then syllables|Sound, syllables, word", JSON.stringify(g.opts));
  // A phone's closed picker cut the first, longer labels off ("Sona decides
  // (starts easy, gets h…"), and two of them then read the same. Measured on
  // the narrowest phone, with room left for the picker's own arrow.
  await page.setViewportSize({ width: 320, height: 700 });
  const fit = await page.evaluate(() => { const el = document.getElementById("gameLevel"), cs = getComputedStyle(el), c = document.createElement("canvas").getContext("2d");
    c.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
    return { room: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 28, widths: [...el.options].map((o) => Math.ceil(c.measureText(o.textContent.trim()).width)) }; });
  await page.setViewportSize({ width: 430, height: 932 });
  ok("every choice can be read in full while the picker is closed, on a 320 px phone", fit.room > 100 && fit.widths.every((w) => w > 20 && w <= fit.room), JSON.stringify(fit));
  ok("the grey line shows what the reader will really ask this child today, and says it is Fruit Slice only for now",
    g.asks.length === 3 && g.hold === "" && g.note === "Sona starts easy and gets harder. For R in Fruit Slice today: " + quoted(g.asks) + ". The other games don’t have this yet.", g.note);
  const stage0 = g.stage;
  await page.selectOption("#gameLevel", "isolation"); await page.waitForTimeout(250);
  g = await read();
  ok("picking \"Just the sound\" saves by itself, on this child's profile, and the line follows it", g.saved === "isolation" && g.note === "For R in Fruit Slice today: “rrrr”. The other games don’t have this yet.", JSON.stringify({ saved: g.saved, note: g.note }));
  await page.selectOption("#gameLevel", "word"); await page.waitForTimeout(250);
  g = await read();
  ok("picking the top choice shows the sound, a syllable, then the short word", g.saved === "word" && /^For R in Fruit Slice today: “rrrr”, then “r(ee|ah|oh)”, then “rot”\. /.test(g.note), g.note);
  ok("the pick never writes the earned level", g.stage === stage0 && (await page.evaluate(() => Sona.rungOf("R"))) === 0, g.stage);
  // a sibling added now: their profile is their own, and the pick does not follow them
  const sib = await page.evaluate(() => { const me = Sona.activeKid().slot, slot = Sona.addKid("Sib", "6"); Sona.switchKid(slot); const theirs = Sona.getProfile().gameLevel || ""; Sona.switchKid(me); const mine = Sona.getProfile().gameLevel; Sona.removeKid(slot); return { slot, theirs, mine, kids: Sona.kids().length }; });
  ok("a sibling's pick stays their own", !!sib.slot && sib.theirs === "" && sib.mine === "word", JSON.stringify(sib));
  await page.reload(); await page.waitForTimeout(700);
  ok("the pick is still there after a reload", (await read()).value === "word");
  // a child on a sound that is not switched on yet: the line promises only the bare sound
  await page.evaluate(() => Sona.saveProfile({ focusSounds: ["S"] }));
  await page.reload(); await page.waitForTimeout(700);
  g = await read();
  ok("for a child on S the line shows just the bare sound, whatever is picked, and says only R goes further so far",
    g.note === "For S today: “sss”. So far only R has syllables and a short word, and only in Fruit Slice.", g.note);
  // Sona muted: only Echo's voice can model a syllable, so the cards ask the
  // bare sound, and the line must say so. It once promised syllables right
  // under "Sound is off in Sona."
  await page.evaluate(() => Sona.saveProfile({ focusSounds: ["R"], volume: 0 }));
  await page.reload(); await page.waitForTimeout(700);
  g = await read();
  ok("with Sona's sound off the line shows just the bare sound, whatever is picked, and says why",
    g.soundOff && g.value === "word" && g.hold === "muted" && g.asks.join() === "rrrr" && g.note === "For R in Fruit Slice today: “rrrr”. Sound is off in Sona, so the cards ask just the sound.", JSON.stringify({ soundOff: g.soundOff, note: g.note }));
  await page.click("#soundOnBtn"); await page.waitForTimeout(250);
  g = await read();
  ok("…and \"Turn sound on\" brings the syllable and the word back to the line at once",
    !g.soundOff && g.hold === "" && /^For R in Fruit Slice today: “rrrr”, then “r(ee|ah|oh)”, then “rot”\. The other games don’t have this yet\.$/.test(g.note), g.note);
  // An SLP's homework: the line describes the sound a game will really ask
  // (the homework's, not the first focus sound), and says why the picker
  // changes nothing when the homework is for another part of the word.
  const hwSet = (over) => page.evaluate((over) => { if (over) localStorage.setItem(Sona.kkey("sona.homework.v1"), JSON.stringify({ hw: Object.assign({ id: "hw1", title: "t", note: "n", sounds: ["R"], pos: "i", repsPerDay: 40, words: null, start: "2000-01-01", due: "2999-01-01", by: "Rachel" }, over), at: Date.now() })); else localStorage.removeItem(Sona.kkey("sona.homework.v1")); }, over);
  await hwSet({ sounds: ["S"] });
  await page.reload(); await page.waitForTimeout(700);
  g = await read();
  ok("under homework for S, the line is about S (what the game will ask), not the child's first focus sound R",
    (await page.evaluate(() => Sona.rotSounds().join())) === "S" && g.note === "For S today: “sss”. So far only R has syllables and a short word, and only in Fruit Slice.", g.note);
  await hwSet({ pos: "f" });
  await page.reload(); await page.waitForTimeout(700);
  g = await read();
  ok("under end-of-word homework that names no words, the line shows just the sound and says the speech therapist's homework is why",
    g.hold === "position" && g.note === "For R in Fruit Slice today: “rrrr”. Your child’s speech therapist set a different part of the word, so the cards keep to the sound.", g.note);
  await hwSet({ pos: "f", words: ["car", "star"] });
  await page.reload(); await page.waitForTimeout(700);
  g = await read();
  ok("…and when it names words, the sound, then one of them",
    /^For R in Fruit Slice today: “rrrr”, then “(car|star)”\. Your child’s speech therapist set a different part of the word, so the cards keep to the sound, then one of the homework’s words\.$/.test(g.note), g.note);
  await hwSet(null);
  // Ages 2 to 4: Home shows them Fruit Slice too, so the picker is hidden for
  // a reason that has to be TRUE: their cards keep the bare sound, whatever a
  // pick saved at an older age says ("word" is still saved here). Whether
  // little ones should ever be asked a syllable is Rachel's call.
  await page.evaluate(() => Sona.saveProfile({ focusSounds: ["R"], childAge: "4" }));
  await page.reload(); await page.waitForTimeout(700);
  g = await read();
  ok("the picker is hidden for a child aged 2 to 4", !g.shown && (await page.evaluate(() => Sona.playStyle())) === "simple");
  ok("…and that child's cards keep the bare sound, even with \"short word\" still saved from before",
    g.saved === "word" && g.hold === "little" && (await page.evaluate(() => [0, 1, 2].map((c) => Sona.gameAsk("R", c).text).join())) === "rrrr,rrrr,rrrr" && (await page.evaluate(() => Sona.gameTop("R"))) === 0, JSON.stringify({ saved: g.saved, hold: g.hold }));
  await page.evaluate(() => Sona.saveProfile({ childAge: "7", gameLevel: "" }));
  await page.reload(); await page.waitForTimeout(700);
  ok("…and back for a seven-year-old", (await read()).shown);
  await page.evaluate((w) => Sona.saveProfile(w), was);
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
