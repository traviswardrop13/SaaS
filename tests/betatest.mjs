// Beta feedback loop: onboarding survey step, pulse cadence, banner swap, API posts.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, OUT, launchOpts } from "./_env.mjs";
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", png: "image/png", css: "text/css" };
let fbPosts = [];
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/feedback" && req.method === "POST") {
    let b = ""; req.on("data", (c) => (b += c));
    req.on("end", () => { try { fbPosts.push(JSON.parse(b)); } catch (e) {} res.writeHead(200, { "content-type": "application/json" }); res.end('{"ok":true}'); });
    return;
  }
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8129, r));
const browser = await chromium.launch(launchOpts());
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
let errs = [];
page.on("pageerror", (e) => errs.push(e.message));
let fails = 0;
const ok = (n, p) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n); };

// ── onboarding: slim flow — 8 steps, Pip preselected, achieve as finale ──
await page.goto("http://localhost:8129/onboarding.html?slp=RACHEL1");
await page.waitForTimeout(900);
// CODES1: founding access now requires the VERIFIED credential. sona.slpok is
// what a successful /api/slp/redeem writes — seeded post-load (about:blank has
// no localStorage) to simulate a family arriving through a valid CODE&k=KEY link.
await page.evaluate(() => { localStorage.setItem("sona.slpok", "RACHEL1"); localStorage.setItem("sona.slpunlock", "1"); });
const ob = await page.evaluate(() => ({
  betaStep: !!document.querySelector('[data-step="beta"]'),
  segs: document.querySelectorAll("#seg i").length,
  preselected: !!document.querySelector("#obBuddies .bopt.on"),
}));
ok("beta step removed", !ob.betaStep);

// ── one mascot at a time ──
// Every bubble on the opening steps is Echo speaking ("Hi! I'm Echo!"), but the
// mascot slot was painted from draft.character on load — and a fresh family's
// default is Pip the fox. A fox introduced itself as Echo: two mascots in one
// flow, which the Aug 10 review flagged. The buddy is the CHILD's pick, so it
// may only replace Echo once they have picked one.
// A returning profile is the harder case: DEFAULT_PROFILE.character is "fox",
// so a family that never reached the buddy step looks identical to one that
// picked Pip. The rule is therefore the STEP, not the stored profile.
for (const [who, seed] of [["a fresh family", () => {}],
  ["a returning family", () => localStorage.setItem("sona.profile.v1",
    JSON.stringify({ childName: "Milo", childAge: "7", character: "fox", focusSounds: ["R"], onboarded: true }))]]) {
  const ob2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await ob2.addInitScript(seed);
  await ob2.goto("http://localhost:8129/onboarding.html");
  await ob2.waitForTimeout(700);
  const m = await ob2.evaluate(() => ({
    html: (document.getElementById("leo") || {}).innerHTML || "",
    says: (document.getElementById("bubble") || {}).textContent || "",
  }));
  ok(who + " meets Echo, not a fox wearing Echo's words",
    /echo-avatar\.svg/.test(m.html) && !/bFox/i.test(m.html));
  ok("…and the bubble beside it is Echo's", /Echo/.test(m.says));

  // …and the buddy still takes the slot the moment the child picks one
  const at = await ob2.evaluate(async () => {
    const nm = document.querySelector('[data-step="name"] input');
    for (let i = 0; i < 8; i++) {
      const cur = (document.querySelector(".step.on") || {}).dataset?.step;
      if (cur === "buddy") return document.getElementById("leo").innerHTML;
      if (cur === "name" && nm && !nm.value) nm.value = "Milo";
      document.getElementById("nextBtn").click();
      await new Promise((r) => setTimeout(r, 220));
    }
    return "(never reached the buddy step)";
  });
  ok("…and the child's buddy takes over at the buddy step", /bFox|<svg/.test(at) && !/echo-avatar/.test(at));
  await ob2.close();
}
ok("10 progress segments (role + path steps)", ob.segs === 10);
ok("buddy preselected (Pip)", ob.preselected);
// real walk: click through every step to finish()
const clickNext = async () => { await page.evaluate(() => document.getElementById("nextBtn").click()); await page.waitForTimeout(250); };
await clickNext(); // welcome →
await page.evaluate(() => document.querySelector('#obRole .choice[data-val="parent"]').click());
await clickNext(); // role →
await page.evaluate(() => document.querySelector('#obPath .choice[data-val="speech"]').click());
await clickNext(); // path →
await page.evaluate(() => { document.getElementById("obName").value = "Milo"; });
await clickNext(); // name →
await clickNext(); // buddy →
await clickNext(); // interests →
await clickNext(); // sounds →
// the "building the plan" beat fires over the next step, named + non-blocking
const build = await page.evaluate(() => ({
  shown: !!document.querySelector("#obBuild.show"),
  txt: (document.getElementById("obBuild") || {}).textContent || "",
  passthru: getComputedStyle(document.getElementById("obBuild")).pointerEvents === "none",
}));
ok("sound-plan build beat shows (named, non-blocking)", build.shown && /Milo's sound plan/.test(build.txt) && build.passthru);
await page.evaluate(() => document.querySelector('#obGoal .choice[data-val="3"]').click());
await clickNext(); // goal →
await clickNext(); // slp →
await page.evaluate(() => { document.getElementById("obEmail").value = "mom@example.com"; });
await clickNext(); // email → finish()
await page.waitForTimeout(500);
const fin = await page.evaluate(() => ({
  achieveShown: document.querySelector('[data-step="achieve"]').classList.contains("on"),
  achName: document.getElementById("achName").textContent,
  cta: document.getElementById("nextBtn").textContent,
}));
ok("achieve finale shows after email", fin.achieveShown && fin.achName === "Milo");
ok("CTA says Let's practice", /Let's practice/.test(fin.cta));
const prof = await page.evaluate(() => JSON.parse(localStorage.getItem("sona.profile.v1") || "{}"));
ok("SLP-referred → founding access + weeklyGoal", prof.earlyAdopter === true && prof.slpCode === "RACHEL1" && prof.weeklyGoal === 3);
ok("onboarding no pageerrors", errs.length === 0);

// ── email is the default ask but never a gate: "Skip for now" still finishes ──
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto("http://localhost:8129/onboarding.html"); await page.waitForTimeout(900);
const nameStep = await page.evaluate(() => document.querySelector('[data-step="name"]').textContent);
ok("name question carries justification microcopy", /cheers them on by name/.test(nameStep));
await clickNext(); // welcome →
await page.evaluate(() => document.querySelector('#obRole .choice[data-val="slp"]').click());
await clickNext(); // role → (this walk is an SLP — the play door is SKIPPED)
const slpSkip = await page.evaluate(() => ({
  onPath: document.querySelector('[data-step="path"]').classList.contains("on"),
  onName: document.querySelector('[data-step="name"]').classList.contains("on"),
}));
ok("an SLP never sees the play door", !slpSkip.onPath && slpSkip.onName, JSON.stringify(slpSkip));
await page.evaluate(() => { document.getElementById("obName").value = "Zoe"; });
await clickNext(); // name →
await clickNext(); // buddy →
await clickNext(); // interests →
// SOUNDS1: the picker is open for everyone (no SLP code) — add S next to R
const pickState = await page.evaluate(() => {
  const chips = [...document.querySelectorAll("#obSounds .sound")];
  chips.find((b) => b.textContent.trim() === "S").click();
  return { total: chips.length, soon: document.querySelectorAll("#obSounds .soon").length };
});
ok("every sound chip is open (no SOON)", pickState.total >= 15 && pickState.soon === 0);
await clickNext(); // sounds →
await page.evaluate(() => document.querySelector('#obGoal .choice[data-val="3"]').click());
await clickNext(); // goal →
await clickNext(); // slp →
// CODES1: an SLP can't skip email — the share credential IS the account
const slpSkipHidden = await page.evaluate(() => {
  const esk = document.getElementById("obEmailSkip");
  return getComputedStyle(esk.parentElement).display === "none";
});
ok("SLPs can't skip email (the credential needs it)", slpSkipHidden);
await page.evaluate(() => { document.getElementById("obEmail").value = "slp@example.com"; });
await page.evaluate(() => document.getElementById("nextBtn").click()); // email → finish()
await page.waitForTimeout(500);
const skipFin = await page.evaluate(() => ({
  achieveShown: document.querySelector('[data-step="achieve"]').classList.contains("on"),
  cred: !!document.getElementById("obSlpCred"),
  prof: JSON.parse(localStorage.getItem("sona.profile.v1") || "{}"),
}));
ok("SLP finish lands on the finale with the credential slot", skipFin.achieveShown && skipFin.cred && skipFin.prof.onboarded === true && skipFin.prof.childName === "Zoe");
ok("open sound picker: S saved next to R", (skipFin.prof.focusSounds || []).includes("S") && (skipFin.prof.focusSounds || []).includes("R"));
ok("role is captured (SLP)", skipFin.prof.role === "slp", JSON.stringify(skipFin.prof.role));

// ── PLAY1: the play door — no sound picker, every sound, easiest first ──
// The niece case: a kid who doesn't need speech help still gets the games.
// The picker IS the clinical framing, so the play path must never show it.
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto("http://localhost:8129/onboarding.html"); await page.waitForTimeout(900);
await clickNext(); // welcome →
await page.evaluate(() => document.querySelector('#obRole .choice[data-val="parent"]').click());
await clickNext(); // role →
await page.evaluate(() => document.querySelector('#obPath .choice[data-val="play"]').click());
await clickNext(); // path →
await page.evaluate(() => { document.getElementById("obName").value = "Nora"; });
await clickNext(); // name →
await clickNext(); // buddy →
await clickNext(); // interests → (sounds is SKIPPED; the build beat fires here)
const playSkip = await page.evaluate(() => ({
  onSounds: document.querySelector('[data-step="sounds"]').classList.contains("on"),
  onGoal: document.querySelector('[data-step="goal"]').classList.contains("on"),
  build: (document.getElementById("obBuild") || {}).textContent || "",
}));
ok("play path skips the sound picker entirely", !playSkip.onSounds && playSkip.onGoal, JSON.stringify(playSkip));
ok("the build beat says play list, not sound plan", /Nora's play list/.test(playSkip.build), playSkip.build);
await clickNext(); // goal →
await clickNext(); // slp →
// parents can still skip email — never a gate for families
const parentSkipShown = await page.evaluate(() => getComputedStyle(document.getElementById("obEmailSkip").parentElement).display !== "none");
ok("parents can still skip email (no gate)", parentSkipShown);
await page.evaluate(() => document.getElementById("obEmailSkip").click());
await page.waitForTimeout(500);
const playProf = await page.evaluate(() => JSON.parse(localStorage.getItem("sona.profile.v1") || "{}"));
ok("email skip still finishes onboarding", playProf.onboarded === true && playProf.email === "");
ok("play mode is recorded", playProf.mode === "play", playProf.mode);
ok("play rotation covers every sound", (playProf.focusSounds || []).length === 19, String((playProf.focusSounds || []).length));
ok("easiest sounds first, R last", playProf.focusSounds[0] === "P" && playProf.focusSounds[18] === "R", JSON.stringify([playProf.focusSounds[0], playProf.focusSounds[18]]));

// the home greeting drops the clinical framing, and nothing pitches an evaluation
await page.goto("http://localhost:8129/today.html"); await page.waitForTimeout(700);
const playHome = await page.evaluate(() => ({
  sub: document.getElementById("subLine").textContent,
  nudge: !!document.getElementById("checkNudge"),
  body: document.body.innerText,
  firstSound: Sona.rotSound(),
}));
ok("play greeting talks about games, not a target sound", /talking games/i.test(playHome.sub), playHome.sub);
// the nudge used to be hidden in play mode; the Sound Check is gone entirely,
// which is the stronger guarantee — there is no clinical pitch left to hide
ok("the Sound Check nudge no longer exists at all", playHome.nudge === false);
ok("nothing on the kid home offers a Sound Check", !/sound check/i.test(playHome.body), playHome.body.slice(0, 160));
ok("the rotation starts on the easiest sound", playHome.firstSound === "P", playHome.firstSound);

// Settings: the play note shows, and hand-picking sounds moves to focus mode
await page.evaluate(() => { try { Sona.gateVerify(); } catch (e) {} });
await page.goto("http://localhost:8129/settings.html"); await page.waitForTimeout(700);
const noteShown = await page.evaluate(() => getComputedStyle(document.getElementById("playNote")).display !== "none");
ok("Settings shows the play-mode note", noteShown);
await page.evaluate(() => {
  const chips = [...document.querySelectorAll("#sounds .sound")];
  chips.filter((b) => !/^R\b/.test(b.textContent.trim())).slice(0, 18).forEach((b) => b.click()); // deselect all but one
  document.getElementById("save").click();
});
await page.waitForTimeout(300);
const flipped = await page.evaluate(() => JSON.parse(localStorage.getItem("sona.profile.v1") || "{}").mode);
ok("hand-picking sounds exits play mode", flipped === "speech", flipped);

// ── pulse: shows on 3rd visit for early adopters, chip-first, X cools 14d ──
fbPosts = []; errs = [];
await page.addInitScript(() => {
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R"], earlyAdopter: true }));
});
await page.goto("http://localhost:8129/today.html"); await page.waitForTimeout(600); // visit 1
let vis = await page.evaluate(() => document.getElementById("pulseOvl").classList.contains("show"));
ok("no pulse on visit 1", !vis);
await page.goto("http://localhost:8129/today.html"); await page.waitForTimeout(600); // visit 2
await page.goto("http://localhost:8129/today.html"); await page.waitForTimeout(1500); // visit 3
vis = await page.evaluate(() => document.getElementById("pulseOvl").classList.contains("show"));
ok("pulse shows on visit 3", vis);
const q1 = await page.evaluate(() => document.getElementById("pulseQ").textContent);
console.log("      Q:", q1);
await page.screenshot({ path: OUT + "/beta-pulse.png" });
// chip-first: note+Send stay hidden until a chip is picked, then chips+note post together
const preChip = await page.evaluate(() => ({
  chips: document.querySelectorAll("#pulseChips .pulseChip").length,
  moreHidden: document.getElementById("pulseMore").style.display === "none",
}));
ok("pulse offers chips with note hidden", preChip.chips >= 5 && preChip.moreHidden);
await page.evaluate(() => {
  const chips = [...document.querySelectorAll("#pulseChips .pulseChip")];
  chips.find((c) => c.textContent === "More games").click();
  document.getElementById("pulseText").value = "please add a dragon game";
  document.getElementById("pulseSend").click();
});
await page.waitForTimeout(500);
ok("pulse chips posted", fbPosts.length === 1 && fbPosts[0].src === "pulse" && fbPosts[0].q === "pulse.chips" && /More games/.test(fbPosts[0].text) && /dragon game/.test(fbPosts[0].text));
vis = await page.evaluate(() => document.getElementById("pulseOvl").classList.contains("show"));
ok("pulse closes after answer", !vis);
const coolSend = await page.evaluate(() => JSON.parse(localStorage.getItem("sona.pulse.v1")).cool || 0);
ok("send cools the auto-ask ~14d", coolSend > Date.now() + 13 * 24 * 3600 * 1000);
// banner
const banner = await page.evaluate(() => ({ show: getComputedStyle(document.getElementById("trialBanner")).display !== "none", txt: document.getElementById("trialMsg").textContent }));
ok("founding banner shows (kid-safe copy)", banner.show && /building Sona with us/.test(banner.txt) && !/\$/.test(banner.txt));
console.log("      banner:", banner.txt);
// banner tap opens pulse (force)
await page.evaluate(() => document.getElementById("trialBanner").click());
vis = await page.evaluate(() => document.getElementById("pulseOvl").classList.contains("show"));
ok("banner tap opens pulse", vis);
// X dismisses + cools the auto-ask for ~14 days
await page.evaluate(() => document.getElementById("pulseX").click());
vis = await page.evaluate(() => document.getElementById("pulseOvl").classList.contains("show"));
ok("X dismisses", !vis);
const coolX = await page.evaluate(() => JSON.parse(localStorage.getItem("sona.pulse.v1")).cool || 0);
ok("X cools future auto-asks ~14d", coolX > Date.now() + 13 * 24 * 3600 * 1000);
ok("today no pageerrors", errs.length === 0);

// ── HONEST1: the email screen must not promise a save that doesn't happen ──
// It was headed "Save <child>'s progress" and offered to "save progress across
// devices and send a free starter guide + progress report". None of the three
// existed: the email starts the trial clock and goes to lead capture, there is
// no starter guide in the product, and the weekly email carries COHORT stats
// plus a link BECAUSE per-child practice never leaves the device. A parent who
// believed it and wiped their phone lost everything. The real mechanism is
// Backup & restore in Settings, and this asserts the screen points there.
{
  const ob = readFileSync(ROOT + "/onboarding.html", "utf8");
  const step = (ob.match(/<div class="step" data-step="email">[\s\S]*?<\/div>\s*<\/div>/) || [""])[0];
  ok("the email step exists to read", step.length > 0);
  for (const lie of [/save progress across devices/i, /starter guide/i, /progress report/i, /just your child's progress/i]) {
    ok("…and claims no sync that does not exist: " + lie.source,
      !lie.test(step), step.slice(0, 200));
  }
  ok("…and says where the practice actually lives",
    /stays on this device/i.test(step) && /Backup &amp; restore/i.test(step),
    "a parent who is not told will find out by losing it: " + step.slice(0, 300));
  // the one promise that IS kept: the email restores a purchase
  ok("…and names the thing the email genuinely does",
    /subscription back/i.test(step), step.slice(0, 300));
  // Settings must still carry the mechanism the screen now points at
  const set = readFileSync(ROOT + "/settings.html", "utf8");
  ok("Settings still has Backup & restore to point at",
    /Backup &amp; restore/i.test(set) && /id="backupCopy"/.test(set) && /id="restoreBk"/.test(set));
  // …and it must not overclaim either: copying to a clipboard is not a backup
  ok("…and copying a code is reported as a copy, not a completed backup",
    !/backed up ✓|backup complete/i.test(set), "an attempted clipboard write is not a remote backup");
}

// ── HONEST1b: restoring a backup is reversible, and the confirm is accurate ──
// Two problems on one screen. The confirm said the restore "replaces the
// progress on this device" — importData MERGES, writing only the keys the
// backup contains, so an old backup over a newer save leaves a hybrid and the
// parent was told otherwise. And the overwrite was final: paste the wrong
// code, and the only copy of a child's practice that exists anywhere is gone,
// because nothing is uploaded. Snapshot first, and let them take it back.
{
  const set = readFileSync(ROOT + "/settings.html", "utf8");
  ok("the confirm no longer claims a replace that doesn't happen",
    !/replaces the progress on this device/.test(set) && /left as it is/.test(set));
  ok("the safety snapshot is kept OUTSIDE the \"sona.\" namespace",
    /var SNAP = "_sonaPreRestore"/.test(set),
    "a snapshot inside the namespace would nest inside backups of itself");

  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const pg = await ctx.newPage();
  pg.on("dialog", (d) => d.accept());
  await pg.goto("http://localhost:8129/today.html"); await pg.waitForTimeout(500);
  const backup = await pg.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done");
    Sona.saveProfile({ childName: "Ada", childAge: "7", focusSounds: ["R"], onboarded: true });
    Sona.addCoins(40);
    const old = Sona.exportString();   // the backup they will paste, later
    Sona.addCoins(60);                 // …and then the child keeps practising
    sessionStorage.setItem("sona.gate.v1", String(Date.now()));
    return old;
  });
  ok("the device is ahead of the backup before we start",
    (await pg.evaluate(() => Sona.getCoins())) === 100);

  await pg.goto("http://localhost:8129/settings.html"); await pg.waitForTimeout(800);
  // The restore box sits inside two nested collapsed <details> — a parent has
  // to go looking for it, which is the right default for a destructive
  // control. Drive it from script rather than fighting the disclosure widget:
  // what is under test is the restore and its safety net, not the accordion.
  await pg.evaluate((b) => {
    const ta = document.getElementById("restoreIn");
    let e = ta; while (e) { if (e.tagName === "DETAILS") e.open = true; e = e.parentElement; }
    ta.value = b;
    document.getElementById("restoreBk").click();
  }, backup);
  await pg.waitForTimeout(1600);       // the handler reloads after 900ms
  const done = await pg.evaluate(() => ({
    coins: Sona.getCoins(),
    snap: !!localStorage.getItem("_sonaPreRestore"),
    undo: document.getElementById("undoRow").style.display,
  }));
  ok("the backup lands", done.coins === 40);
  ok("…and the device it overwrote was snapshotted first", done.snap === true);
  ok("…and Undo is offered, not hidden in a support email", done.undo === "block");

  await pg.evaluate(() => {
    let e = document.getElementById("undoRestore"); while (e) { if (e.tagName === "DETAILS") e.open = true; e = e.parentElement; }
    document.getElementById("undoRestore").click();
  });
  await pg.waitForTimeout(1600);
  const back = await pg.evaluate(() => ({
    coins: Sona.getCoins(),
    snap: !!localStorage.getItem("_sonaPreRestore"),
    undo: document.getElementById("undoRow").style.display,
  }));
  ok("Undo puts the practice back", back.coins === 100);
  ok("…and spends the snapshot, so it cannot undo twice", back.snap === false && back.undo === "none");
  await ctx.close();
}

// ── HONEST1c: the README describes THIS product ───────────────────────
// It described "SpeakUp Kids" — a Next.js/Tailwind skill tree that posted
// recordings to a Speechace scoring API at /api/score — for months after none
// of that was true. That is not a cosmetic problem: it is the first thing a
// new contributor, or an outside coding agent, builds its mental model from,
// and it pointed at an architecture and a privacy posture the product had
// abandoned. Cheap pin, exact regression.
{
  const readme = readFileSync(ROOT + "/../README.md", "utf8");
  // DESCRIBING is not DISAVOWING. The README carries a blockquote naming the
  // old claims in order to disown them, which is worth keeping — a reader who
  // remembers the old file should be told it is gone, not left wondering. So
  // the check reads the file with its blockquote stripped: what is left is
  // what the README actually asserts about this product.
  const claims = readme.split("\n").filter((l) => !l.trimStart().startsWith(">")).join("\n");
  for (const dead of ["SpeakUp Kids", "/api/score", "SPEECHACE_API_KEY", "Tailwind"]) {
    ok("README does not describe a product that no longer exists: " + dead,
      !claims.includes(dead));
  }
  ok("…and it does still say plainly that the old description was wrong",
    /SpeakUp Kids/.test(readme) && readme !== claims);
  ok("README names the app and where it runs",
    /# Sona/.test(readme) && /speaksona\.com/.test(readme));
  ok("…and the verification command that actually exists",
    /node tests\/run-all\.mjs/.test(readme) && /There is no `npm test`/.test(readme));
  ok("…and the privacy posture the code actually keeps",
    /No audio ever leaves the device/i.test(readme));
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
