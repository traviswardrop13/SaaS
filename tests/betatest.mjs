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

// ── onboarding: THREE setup steps before a child says a word ────────────
// It was ten screens — role, path, name, buddy, interests, sounds, weekly
// goal, a summary and an email — all in front of a parent who had just come
// off an ad and had no idea yet whether the thing worked. Everything not
// needed to run the FIRST session now waits until after it.
await page.goto("http://localhost:8129/onboarding.html?slp=RACHEL1");
await page.waitForTimeout(900);
// CODES1: sona.slpok is what a successful /api/slp/redeem writes — seeded
// post-load (about:blank has no localStorage) to simulate a family arriving
// through a valid CODE&k=KEY link. Post-load also means AFTER this build's
// first load, so it is a redemption the era-four sweep correctly ignores.
await page.evaluate(() => { localStorage.setItem("sona.slpok", "RACHEL1"); localStorage.setItem("sona.slpunlock", "1"); });
const ob = await page.evaluate(() => ({
  betaStep: !!document.querySelector('[data-step="beta"]'),
  segs: document.querySelectorAll("#seg i").length,
  preselected: !!document.querySelector("#obBuddies .bopt.on"),
  clinicianDoor: !!document.querySelector('.who-pick[data-role="slp"]') && !!document.querySelector('.who-pick[data-role="parent"]'),
  restoreDoor: !!document.getElementById("moveLink") || /Moving from another phone|Enter your code/.test(document.body.innerText),
}));
ok("beta step removed", !ob.betaStep);
ok("three progress groups match the three setup questions", ob.segs === 3, "segs=" + ob.segs);
ok("buddy is preselected, so it never needs to be a step", ob.preselected);
// THE CLINICIAN DOOR STAYS OPEN. It was removed on 19 Sep while the SLP side
// was hidden and restored on 21 Sep: it is the only entrance to the clinician
// setup flow, so if it goes again that flow becomes dead code. Since 1 Oct 2026
// it is one of the two answers to "Who's setting up Sona?" (Travis: "have the
// very first step in onboarding ask if they are a parent/caregiver or an
// slp/slpa"), on its own page after the hello since 2 Oct. The move-in code
// left setup that day: a family moving phones uses Settings, and one who paid
// on the website restores by email there.
ok("setup asks who is setting up: a parent or caregiver, or an SLP or SLPA", ob.clinicianDoor);
ok("…and carries no move-in code (Travis, 2 Oct 2026: \"take off moving from another phone enter your code\")", !ob.restoreDoor);

// ── one mascot at a time ──
// Every bubble in setup is Echo speaking, and the buddy is the CHILD's pick.
// The mascot slot used to be painted from draft.character on load — a fresh
// family's default is Pip the fox — so a fox introduced itself as Echo. With
// the buddy step deferred there is now no point in setup where the slot should
// change hands at all, which is a stronger rule than the old one.
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
    /(echo-avatar\.svg|echo-welcome\.webp)/.test(m.html) && !/bFox/i.test(m.html));
  ok("…and the bubble beside it is Echo's", /Echo/.test(m.says));

  const hosts = await ob2.evaluate(async () => {
    const nm = document.querySelector('[data-step="name"] input');
    const seen = [];
    for (let i = 0; i < 8; i++) {
      const cur = (document.querySelector(".step.on") || {}).dataset?.step;
      if (!cur) break;
      seen.push(cur + ":" + (/(echo-avatar\.svg|echo-welcome\.webp)/.test(document.getElementById("leo").innerHTML) ? "echo" : "other"));
      if (cur === "mic") break;
      if (cur === "name" && nm && !nm.value) nm.value = "Milo";
      if (cur === "sounds" && !document.querySelector("#obSounds .on")) document.querySelector('#obSounds [data-sound="R"]').click();
      (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })();
      await new Promise((r) => setTimeout(r, 220));
    }
    return seen;
  });
  ok("…and Echo hosts every step of setup, start to finish",
    hosts.length > 1 && hosts.every((h) => h.endsWith(":echo")), JSON.stringify(hosts));
  await ob2.close();
}

// ── the real walk, to finish() ──
// one press of whatever moves setup on (2 Oct 2026): the parent's answer on
// the question, "Not now" on the microphone, Continue everywhere else
const clickNext = async () => { await page.evaluate(() => (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })()); await page.waitForTimeout(250); };
await clickNext(); await clickNext(); // the hello → the question → name (the parent's answer)
await page.evaluate(() => { document.getElementById("obName").value = "Milo"; });
await clickNext(); // name →
if(await page.locator('#obSounds [data-sound="R"]').getAttribute('aria-pressed')!=='true')await page.locator('#obSounds [data-sound="R"]').click();
await clickNext(); // sounds → Meet Rachel
// MEET RACHEL (29 Sep 2026; moved 2 Oct 2026): who made this, right before the
// microphone. It is a Continue, not a step: no field, no choice, and no
// progress segment, which is why the three groups above still match the three
// questions.
const meet = await page.evaluate(() => {
  const st = document.querySelector('[data-step="rachel"]');
  return { step: (document.querySelector(".step.on") || {}).dataset?.step,
           asks: st ? st.querySelectorAll("input,select,textarea,button,.sound,.choice").length : -1,
           segHidden: document.getElementById("seg").hidden };
});
ok("the screen after the sounds is Rachel's, and it asks nothing",
  meet.step === "rachel" && meet.asks === 0 && meet.segHidden, JSON.stringify(meet));
await clickNext(); // Meet Rachel → mic
// The "building the plan" beat used to fire HERE, on the way into the
// microphone step, and sit over it for 1.8s — the one setup screen whose
// words matter. It now plays from finish(), between the last answer and the
// finale, so this asserts it is ABSENT here and present there.
ok("the build beat no longer covers the microphone step",
  await page.evaluate(() => !document.querySelector("#obBuild.show")));
const atMic = await page.evaluate(() => ({
  step: (document.querySelector(".step.on") || {}).dataset?.step,
  cta: document.getElementById("nextBtn").textContent,
  says: document.querySelector('[data-step="mic"]').textContent,
}));
ok("the last setup step is the microphone, not a price or an email",
  atMic.step === "mic", atMic.step);
// the promise on this screen has to match the one charge.html makes, because
// two screens promising different things about a child's voice is how the
// stale upload wording survived for months
ok("…and it tells the truth about the microphone",
  atMic.says.includes(await page.evaluate(() => Sona.MIC_PROMISE)) && /never uploaded/.test(atMic.says) && /saved on this phone/.test(atMic.says));
ok("…and offers an in-app decline before the OS prompt", /Not now/.test(atMic.says));
await page.evaluate(() => document.getElementById("micNotNow").click()); await page.waitForTimeout(250); // mic → finish()

// the build beat, now between the last answer and the finale: named, and
// calm and bounded, before the child can start
const build = await page.evaluate(() => {
  const el = document.getElementById("obBuild");
  return { shown: !!(el && el.classList.contains("show")), txt: el ? el.textContent : "",
           solid: el ? getComputedStyle(el).backgroundColor === "rgb(255, 246, 233)" : false };
});
ok("sound-plan build beat calmly shows the family answers", build.shown && /Milo's sound plan/.test(build.txt) && build.solid, JSON.stringify(build));
await page.waitForTimeout(2000);
const fin = await page.evaluate(() => ({
  achieveShown: document.querySelector('[data-step="achieve"]').classList.contains("on"),
  achName: document.getElementById("achName").textContent,
  cta: document.getElementById("nextBtn").textContent,
}));
ok("achieve finale shows after the last step", fin.achieveShown && fin.achName === "Milo");
ok("CTA invites the child to play", /Let's play/.test(fin.cta));
const prof = await page.evaluate(() => JSON.parse(localStorage.getItem("sona.profile.v1") || "{}"));
// REWRITTEN 24 Sep 2026. This was "SLP-referred → founding access": setup
// wrote earlyAdopter for a verified family. It writes no grant now. A family
// who redeems a clinician's link after this build gets Premium through that
// clinician's coverage (asked of the server), and one who redeemed before it
// was grandfathered by the era-four sweep — never by the setup screen. What
// setup still owes the clinician is the roster tag.
ok("SLP-referred → tagged for the clinician's roster, with no founding grant written by setup",
  prof.slpCode === "RACHEL1" && prof.earlyAdopter !== true);
// the deferred questions must not have been silently answered on the parent's
// behalf either — they are asked later, in Settings, or they keep their default
ok("the weekly goal keeps its default rather than being asked for", prof.weeklyGoal === 5);
ok("no email was demanded to finish", prof.email === "");
ok("onboarding no pageerrors", errs.length === 0);

// ── SETUP3: what the screenshots showed ──────────────────────────────────
// Photographed at 390px: "I'm not sure where to start" rendered one word per
// line (a row layout gave a six-word title a ~90px column); the age chip a
// parent had just picked was cream on white, the one selection on the screen
// nobody could see; and the welcome never said how long setup was.
{
  const ob = readFileSync(ROOT + "/onboarding.html", "utf8");
  ok("the extra practice-direction page has been removed",
    !/data-step="path"/.test(ob));
  ok("the picked age chip uses the app's one selection colour",
    /\.schips \.sound\.on\{[^}]*border-color:var\(--act\)/.test(ob),   // teal since 1 Oct 2026: no green anywhere
    "cream on white is not a selection anyone can see");
  const pg2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pg2.goto("http://localhost:8129/onboarding.html"); await pg2.waitForTimeout(700);
  await pg2.evaluate(() => document.getElementById("nextBtn").click()); await pg2.waitForTimeout(200);   // the hello's Continue
  const seen = await pg2.evaluate(() => ({ title: (document.getElementById("whoTitle") || {}).textContent || "", on: (document.querySelector(".step.on") || {}).dataset?.step }));
  ok("the screen after the hello is one short question", seen.on === "who" && /^Who's setting up Sona\?$/.test(seen.title.trim()), JSON.stringify(seen));
  // Parents now go directly from the child's details to a compact sound grid.
  // (one tap on "Parent or caregiver" reaches the child's details)
  await pg2.evaluate(() => document.querySelector('.who-pick[data-role="parent"]').click()); await pg2.waitForTimeout(200);
  await pg2.evaluate(() => { document.getElementById("obName").value = "Milo"; (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })(); }); await pg2.waitForTimeout(300);
  const grid = await pg2.evaluate(() => ({onSounds:document.querySelector('[data-step="sounds"]').classList.contains('on'),overflow:document.documentElement.scrollWidth>innerWidth,labels:[...document.querySelectorAll('#obSounds .sound')].map(b=>b.textContent.trim())}));
  ok("…and the sound grid is the next screen and fits at 390px", grid.onSounds&&!grid.overflow&&grid.labels.length===19, JSON.stringify(grid));
  await pg2.close();
}

// ── SETUP1: partial setup survives an interruption ────────────────────
// draft lived in memory only. A phone call, a locked screen or a stray
// back-swipe at step seven threw away everything a parent had typed and put
// them back at the top — and a parent who has just retyped their child's name
// once does not do it twice.
{
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pg.goto("http://localhost:8129/onboarding.html"); await pg.waitForTimeout(800);
  await pg.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await pg.goto("http://localhost:8129/onboarding.html"); await pg.waitForTimeout(800);
  await pg.evaluate(() => (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })()); await pg.waitForTimeout(250); await pg.evaluate(() => (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })()); await pg.waitForTimeout(250); // the hello → the question → name
  await pg.evaluate(() => { document.getElementById("obName").value = "Rosie"; });
  await pg.evaluate(() => document.querySelector('#obAge .sound[data-age="6"]').click());
  await pg.evaluate(() => (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })()); await pg.waitForTimeout(250);
  const held = await pg.evaluate(() => JSON.parse(localStorage.getItem("sona.obdraft.v1") || "null"));
  ok("what a parent typed is written down as they go",
    !!held && held.childName === "Rosie" && String(held.childAge) === "6", JSON.stringify(held));

  await pg.reload(); await pg.waitForTimeout(800);        // the interruption
  const back = await pg.evaluate(() => ({
    name: document.getElementById("obName").value,
    age: (document.querySelector("#obAge .sound.on") || {}).dataset?.age,
  }));
  ok("…and is still there after the phone rings", back.name === "Rosie" && back.age === "6", JSON.stringify(back));

  // it is a scratchpad, not a profile: finishing must clear it, or a stale
  // draft shadows the real thing on the next visit
  // the reload put them back at the top with their answers intact, so this
  // walks the whole short flow again: the hello → the question → name →
  // sounds → Meet Rachel → mic → finish
  await pg.evaluate(() => (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })()); await pg.waitForTimeout(250);
  await pg.evaluate(() => (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })()); await pg.waitForTimeout(250);
  await pg.evaluate(() => (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })()); await pg.waitForTimeout(250);
  await pg.locator('#obExploreSounds').click();
  await pg.evaluate(() => (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })()); await pg.waitForTimeout(250);
  await pg.evaluate(() => (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })()); await pg.waitForTimeout(700);
  const after = await pg.evaluate(() => ({
    draft: localStorage.getItem("sona.obdraft.v1"),
    prof: JSON.parse(localStorage.getItem("sona.profile.v1") || "{}"),
  }));
  ok("…and the scratchpad is torn up once the profile is real",
    after.draft === null && after.prof.onboarded === true, JSON.stringify(after.draft));
  await pg.close();
}

// ── SETUP2: "I'm not sure" is a starting point, never a finding ─────────
// A parent who does not know which sounds their child needs must be able to
// say so and still start. What they must NOT get is Sona appearing to have
// decided something about their child: it does not assess, and a door that
// quietly picked targets would be it assessing.
{
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await pg.goto("http://localhost:8129/onboarding.html"); await pg.waitForTimeout(800);
  await pg.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await pg.goto("http://localhost:8129/onboarding.html"); await pg.waitForTimeout(800);
  const door = await pg.evaluate(() => ({
    has: !!document.querySelector('#obExploreSounds'),
    says: document.querySelector('[data-step="sounds"]').textContent,
  }));
  ok("a parent can say they don't know where to start", door.has);
  ok("…and the screen says plainly that Sona does not test or diagnose",
    /doesn't test or diagnose/.test(door.says), door.says.slice(0, 160));
  ok("…and does not dress the choice up as a recommendation",
    !/recommend|we think|based on|diagnos(is|e)\b|assess(ment)?\b/i.test(door.says.replace(/doesn't test or diagnose/, "")),
    door.says.slice(0, 200));

  await pg.evaluate(() => (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })()); await pg.waitForTimeout(250); await pg.evaluate(() => (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })()); await pg.waitForTimeout(250); // the hello → the question → name
  await pg.evaluate(() => { document.getElementById("obName").value = "Sam"; });
  await pg.evaluate(() => (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })()); await pg.waitForTimeout(250);
  await pg.locator('#obExploreSounds').click();
  const landed = await pg.evaluate(() => ({
    onSounds: document.querySelector('[data-step="sounds"]').classList.contains("on"),
    onRachel: document.querySelector('[data-step="rachel"]').classList.contains("on"),
  }));
  ok("…and can continue without choosing a target (to Meet Rachel, then the microphone)",
    !landed.onSounds && landed.onRachel, JSON.stringify(landed));
  await pg.evaluate(() => (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })()); await pg.waitForTimeout(250);
  await pg.evaluate(() => (() => { const st = (document.querySelector(".step.on") || {}).dataset?.step; if (st === "who") document.querySelector('.who-pick[data-role="parent"]').click(); else if (st === "mic") document.getElementById("micNotNow").click(); else document.getElementById("nextBtn").click(); })()); await pg.waitForTimeout(700);
  const prof = await pg.evaluate(() => JSON.parse(localStorage.getItem("sona.profile.v1") || "{}"));
  // the CONTENT path is the existing play path — mode stays "play", because
  // five other files read mode === "play" and a third value would have filed
  // an unsure family as a speech family everywhere
  ok("…lands on the existing general path, not a new one",
    prof.mode === "play" && (prof.focusSounds || []).length > 1, JSON.stringify(prof.mode));
  ok("…and the reason is kept separately, so the funnel can see it",
    prof.pathReason === "unsure", JSON.stringify(prof.pathReason));
  await pg.close();
}

// ── email is the default ask but never a gate: "Skip for now" still finishes ──
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto("http://localhost:8129/onboarding.html"); await page.waitForTimeout(900);
const nameStep = await page.evaluate(() => document.querySelector('[data-step="name"]').textContent);
ok("name question carries justification microcopy", /cheers them on by name|knows who to cheer for/.test(nameStep));
// This is the parent path, with an optional email after the core setup.
await clickNext(); await clickNext(); // the hello → the question → name
await page.evaluate(() => { document.getElementById("obName").value = "Zoe"; });
await clickNext(); // name → sounds
// SOUNDS1: the picker is open for everyone (no SLP code) — choose R and S
const pickState = await page.evaluate(() => {
  const chips = [...document.querySelectorAll("#obSounds .sound")];
  if(!chips.find((b) => b.dataset.sound === "R").classList.contains("on"))chips.find((b) => b.dataset.sound === "R").click();
  chips.find((b) => b.dataset.sound === "S").click();
  return { total: chips.length, soon: document.querySelectorAll("#obSounds .soon").length };
});
ok("every sound chip is open (no SOON)", pickState.total >= 15 && pickState.soon === 0);
await clickNext(); // sounds → Meet Rachel
await clickNext(); // Meet Rachel → mic
await clickNext(); // mic → finish()
await page.waitForTimeout(1800);
// THE WEEKLY-SUMMARY ASK LIVES ON THE FINALE, NOT IN THE STEPS. A parent has
// no email anywhere else: on the SLP channel the clinician owns the family
// relationship and Sona's roster deliberately carries no parent contact, so
// without this there is no route to a parent that does not go through their
// clinician. It is on the finale rather than as a sixth step because setup
// once ENDED at a price screen before the child had said a word, and the pin
// above ("the last setup step is the microphone, not a price or an email")
// exists to stop that shape coming back in a friendlier costume.
const finaleAsk = await page.evaluate(() => {
  const box = document.getElementById("achEmail");
  return {
    shown: !!(box && getComputedStyle(box).display !== "none"),
    named: (document.getElementById("achEmName") || {}).textContent || "",
    optional: /optional/i.test((box || {}).textContent || ""),
    cta: document.getElementById("nextBtn").textContent,
    required: !!document.querySelector("#achEmailInput[required]"),
  };
});
ok("the finale offers the weekly summary, named for the child", finaleAsk.shown && /Zoe/.test(finaleAsk.named), JSON.stringify(finaleAsk));
ok("…says it is optional, and never blocks the way into the app",
  finaleAsk.optional && !finaleAsk.required && /play|practice/i.test(finaleAsk.cta), JSON.stringify(finaleAsk));
const skipFin = await page.evaluate(() => ({
  achieveShown: document.querySelector('[data-step="achieve"]').classList.contains("on"),
  prof: JSON.parse(localStorage.getItem("sona.profile.v1") || "{}"),
}));
ok("…and leaving it blank keeps no address", !skipFin.prof.email, JSON.stringify(skipFin.prof.email));
ok("the parent finish lands on the finale", skipFin.achieveShown && skipFin.prof.onboarded === true && skipFin.prof.childName === "Zoe", JSON.stringify(skipFin.prof));
ok("open sound picker: S saved next to R", (skipFin.prof.focusSounds || []).includes("S") && (skipFin.prof.focusSounds || []).includes("R"), JSON.stringify(skipFin.prof.focusSounds));
ok("nobody becomes an SLP by accident", skipFin.prof.role !== "slp", JSON.stringify(skipFin.prof.role));

// ── PLAY1: explore every sound without choosing targets, easiest first ──
// General play remains a one-tap option on the shared sound-selection screen.
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto("http://localhost:8129/onboarding.html"); await page.waitForTimeout(900);
await clickNext(); await clickNext(); // the hello → the question → name
await page.evaluate(() => { document.getElementById("obName").value = "Nora"; });
await clickNext(); // name →
await page.locator('#obExploreSounds').click();
const playSkip = await page.evaluate(() => ({
  onSounds: document.querySelector('[data-step="sounds"]').classList.contains("on"),
  onRachel: document.querySelector('[data-step="rachel"]').classList.contains("on"),
  build: (document.getElementById("obBuild") || {}).textContent || "",
}));
ok("explore goes on (Meet Rachel, then the microphone) without selected targets", !playSkip.onSounds && playSkip.onRachel, JSON.stringify(playSkip));
// the beat plays from finish() now — walk the last steps and look there
await clickNext(); // Meet Rachel → mic
await clickNext(); // mic → finish()
await page.waitForTimeout(150);
const playBuild = await page.evaluate(() => (document.getElementById("obBuild") || {}).textContent || "");
ok("the build beat says play list, not sound plan", /Nora's play list/.test(playBuild), playBuild);
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
  title: document.querySelector(".library-intro h1").textContent,
  nudge: !!document.getElementById("checkNudge"),
  body: document.body.innerText,
  firstSound: Sona.rotSound(),
}));
ok("play Home invites choosing a game", /pick a game/i.test(playHome.title), playHome.title);
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
  // no Save button any more (29 Sep 2026): each chip tap saves on its own
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
// Backup & restore in Settings, and this asserts the screen points there:
// since 30 Sep 2026 by the link a parent actually sees, "Moving to a new
// phone?" at the bottom of Settings, which opens it.
{
  const ob = readFileSync(ROOT + "/onboarding.html", "utf8");
  const step = (ob.match(/<div class="step" data-step="email">[\s\S]*?<\/div>\s*<\/div>/) || [""])[0];
  ok("the email step exists to read", step.length > 0);
  for (const lie of [/save progress across devices/i, /starter guide/i, /progress report/i, /just your child's progress/i]) {
    ok("…and claims no sync that does not exist: " + lie.source,
      !lie.test(step), step.slice(0, 200));
  }
  ok("…and says where the practice actually lives",
    /stays on this device/i.test(step) && /Moving to a new phone\?<\/b> at the bottom of Settings/.test(step),
    "a parent who is not told will find out by losing it: " + step.slice(0, 300));
  // THIS STEP IS THE CLINICIAN'S. It is in ORDER_SLP and not in ORDER_PARENT,
  // so the parent-flavoured copy that used to sit here — "your email is how
  // you get your subscription back" — was unreachable, and untrue besides
  // while Sona is free. What it promises now is the thing the email actually
  // is: a passwordless account. The parent's ask moved to the finale.
  ok("…and names the thing the email genuinely does",
    /clinician account/i.test(step) && /no password/i.test(step) && !/subscription/i.test(step),
    step.slice(0, 300));
  // Settings must still carry the mechanism the screen now points at
  const set = readFileSync(ROOT + "/settings.html", "utf8");
  ok("Settings still has Backup & restore to point at, behind that link",
    /Backup &amp; restore/i.test(set) && /id="backupCopy"/.test(set) && /id="restoreBk"/.test(set) && /<summary>Moving to a new phone\?<\/summary>/.test(set));
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
    localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done"); localStorage.setItem("sona.freeera5.v1", "done");
    Sona.saveProfile({ childName: "Ada", childAge: "7", focusSounds: ["R"], onboarded: true });
    Sona.addCoins(40);
    const old = Sona.exportString();   // the backup they will paste, later
    Sona.addCoins(60);                 // …and then the child keeps practicing
    sessionStorage.setItem("sona.gate.v1", String(Date.now()));
    return old;
  });
  ok("the device is ahead of the backup before we start",
    (await pg.evaluate(() => Sona.getCoins())) === 100);

  await pg.goto("http://localhost:8129/settings.html"); await pg.waitForTimeout(800);
  // TUCKED AWAY (Travis, 30 Sep 2026): the whole Backup & restore card sits
  // behind one quiet "Moving to a new phone?" link at the foot of Settings,
  // closed until a parent opens it, with the same tools inside.
  const tucked = await pg.evaluate(() => {
    const box = document.getElementById("moveBox");
    return { closed: !!box && box.tagName === "DETAILS" && !box.open, label: box ? box.querySelector("summary").textContent.trim() : "",
      inside: ["backupCopy", "backupDl", "restoreIn", "restoreBk", "undoRestore"].every((id) => box && box.contains(document.getElementById(id))),
      // nothing a parent can see comes after it (a screen-reader-only status may)
      last: !!box && (!box.nextElementSibling || box.nextElementSibling.classList.contains("sr")),
      // (a closed <details> keeps its content's boxes in Chrome, so ask the browser)
      hidden: !document.getElementById("backupCopy").checkVisibility() };
  });
  ok("Backup & restore is tucked behind a closed 'Moving to a new phone?' link at the foot of Settings",
    tucked.closed && tucked.label === "Moving to a new phone?" && tucked.inside && tucked.last && tucked.hidden, JSON.stringify(tucked));
  // The restore box sits inside a collapsed <details> too — a parent has
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
    open: document.getElementById("moveBox").open,
  }));
  ok("the backup lands", done.coins === 40);
  ok("…and the device it overwrote was snapshotted first", done.snap === true);
  ok("…and Undo is offered, not hidden in a support email", done.undo === "block");
  ok("…with the fold it lives in already open after the reload", done.open === true);
  // …but only then: the snapshot never expires, so a family who moved phones
  // must not find the card open at the foot of Settings on every later visit
  await pg.goto("http://localhost:8129/today.html"); await pg.waitForTimeout(300);
  await pg.goto("http://localhost:8129/settings.html"); await pg.waitForTimeout(800);
  const later = await pg.evaluate(() => ({ open: document.getElementById("moveBox").open, undo: document.getElementById("undoRow").style.display }));
  ok("…and tucked away again on a later visit, with Undo still inside it", later.open === false && later.undo === "block", JSON.stringify(later));

  await pg.evaluate(() => {
    let e = document.getElementById("undoRestore"); while (e) { if (e.tagName === "DETAILS") e.open = true; e = e.parentElement; }
    document.getElementById("undoRestore").click();
  });
  await pg.waitForTimeout(1600);
  const back = await pg.evaluate(() => ({
    coins: Sona.getCoins(),
    snap: !!localStorage.getItem("_sonaPreRestore"),
    undo: document.getElementById("undoRow").style.display,
    open: document.getElementById("moveBox").open,
  }));
  ok("Undo puts the practice back", back.coins === 100);
  ok("…and spends the snapshot, so it cannot undo twice", back.snap === false && back.undo === "none");
  ok("…and the fold is tucked away again", back.open === false);
  await ctx.close();
}

// ── SET30: Settings, shorter (Travis, 30 Sep 2026) ─────────────────────
// No volume slider ("why can't we just use our phones to adjust volume on the
// side of our iphone?"): the phone's buttons set the level. Sona's own mute
// is the one thing they can't undo, so a line names it only while it is on,
// and its button writes the normal level back. And the focus-sound chips
// lose the ⚠ and the red for a sound a child is young for: every chip keeps
// the same grey "by ~Ny".
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const pg = await ctx.newPage();
  const pe = []; pg.on("pageerror", (e) => pe.push(e.message));
  await pg.goto("http://localhost:8129/today.html"); await pg.waitForTimeout(400);
  await pg.evaluate(() => {
    localStorage.clear();
    ["", "2", "3", "4", "5"].forEach((n) => localStorage.setItem("sona.freeera" + n + ".v1", n ? "done" : "post"));
    Sona.saveProfile({ childName: "Ada", childAge: "4", focusSounds: ["R", "P"], onboarded: true, volume: 0, voiceOn: false, soundOn: false });
    sessionStorage.setItem("sona.gate.v1", String(Date.now()));
  });
  await pg.goto("http://localhost:8129/settings.html"); await pg.waitForTimeout(700);
  const muted = await pg.evaluate(() => {
    const line = document.getElementById("soundOff");
    return { slider: !!document.querySelector('input[type="range"], #volume, #soundCard'), shown: !line.hidden && line.getClientRects().length > 0, text: line.innerText.replace(/\s+/g, " ").trim(),
      chips: [...document.querySelectorAll("#sounds .sound")].map((b) => ({ s: b.dataset.s, hint: (b.querySelector(".hint") || {}).textContent || "", early: !!b.querySelector(".early"), color: b.querySelector(".hint") ? getComputedStyle(b.querySelector(".hint")).color : "" })) };
  });
  ok("Settings has no volume slider", muted.slider === false);
  ok("a muted child's Settings says so, with one button to undo it", muted.shown && muted.text === "Sound is off in Sona. Turn sound on");
  const r = muted.chips.find((c) => c.s === "R");
  ok("a sound a 4-year-old is young for keeps its grey age line, with no warning sign and no red",
    !!r && /^by ~\d+y$/.test(r.hint) && muted.chips.every((c) => !/⚠/.test(c.hint) && !c.early) && new Set(muted.chips.map((c) => c.color)).size === 1);
  await pg.click("#soundOnBtn"); await pg.waitForTimeout(150);
  const on = await pg.evaluate(() => { const q = JSON.parse(localStorage.getItem("sona.profile.v1")); return { hidden: document.getElementById("soundOff").hidden, said: document.getElementById("soundSaid").textContent, volume: q.volume, voiceOn: q.voiceOn, soundOn: q.soundOn, name: q.childName }; });
  ok("Turn sound on saves the normal level with voice and effects on, and the line goes",
    on.hidden && on.said === "Sound is on." && on.volume === 0.8 && on.voiceOn === true && on.soundOn === true && on.name === "Ada");
  await pg.reload(); await pg.waitForTimeout(600);
  ok("…and stays gone", await pg.evaluate(() => document.getElementById("soundOff").hidden));
  // a save from any other control never writes sound, either way
  await pg.evaluate(() => { const n = document.getElementById("childName"); n.value = "Ada "; n.dispatchEvent(new Event("change")); });
  await pg.waitForTimeout(100);
  ok("saving a name leaves sound alone", await pg.evaluate(() => { const q = JSON.parse(localStorage.getItem("sona.profile.v1")); return q.volume === 0.8 && q.voiceOn === true && q.childName === "Ada"; }));
  ok("Settings: no page errors", pe.length === 0);
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
