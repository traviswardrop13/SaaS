// Progression: sound rotation (one letter per 5-round pass), per-round ladder
// climb capped at earned+1, saved daily-goal state on Today, charge round label,
// pulse copy. Real pages; rotation advanced via the exported Sona API.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, OUT, launchOpts } from "./_env.mjs";
const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", png: "image/png", css: "text/css" };
let repsPosts = [];
let repsQuery = { cohort: 0, pct: 0, nextPct: null, nextReps: null };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/reps" && req.method === "POST") {
    let b = ""; req.on("data", (c) => (b += c));
    req.on("end", () => { try { repsPosts.push(JSON.parse(b)); } catch (e) {} res.writeHead(200, { "content-type": "application/json" }); res.end('{"ok":true}'); });
    return;
  }
  if (u.pathname === "/api/reps") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, ...repsQuery }));
    return;
  }
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8131, r));
const browser = await chromium.launch(launchOpts(["--autoplay-policy=no-user-gesture-required"]));
const ctx = await browser.newContext({ permissions: ["microphone"], viewport: { width: 430, height: 932 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MediaStream());
  if (!localStorage.getItem("sona.profile.v1")) localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done"); localStorage.setItem("sona.freeera3.v1","done");localStorage.setItem("sona.freeera4.v1","done");localStorage.setItem("sona.freeera5.v1","done"); localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R", "S"] }));
});
let fails = 0;
const ok = (n, p) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n); };

// ── source tripwires (node-side) ──
const chargeSrc = readFileSync(ROOT + "/charge.html", "utf8");
const todaySrc = readFileSync(ROOT + "/today.html", "utf8");
ok("rung advance no longer daily-only", /if\(v==="pass" && useRung>=RUNG/.test(chargeSrc));
// This used to pin the OLD formula, /Math.min(isDaily?(run?run.round:0):ROTR, RUNG+1)/,
// which is the bug: the header counted today's ring while the rung counted the
// persistent rotation, so the level a child got and the round a parent read were
// different numbers. An assertion that pins an implementation can lock a bug in.
ok("the ladder step and the header read ONE counter",
  /var ROUNDIX = isDaily \? \(\(run\?run\.round:0\)\|0\) : \(_ringN % _runLen\);/.test(chargeSrc)
  && /Math\.min\(ROUNDIX, RUNG\+1\)/.test(chargeSrc)
  && /Math\.min\(ROUNDIX\+1,DAILY_SEQ\.length\)/.test(chargeSrc));
ok('pulse placeholder drops "complaint"', !/complaint/i.test(todaySrc));

// ── today.html: fresh day, ring empty, rotation letter = R ──
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(700);
let t = await page.evaluate(() => ({
  ring: String(Sona.repsToday()),
  title: document.querySelector(".library-intro h1").textContent,
  sound: Sona.rotSound(), round: Sona.rotRound(),
  ph: (document.getElementById("pulseText") || {}).placeholder || "",
}));
ok("fresh Home has no earned reps", t.ring === "0");
ok("Home invites choosing a game", /pick a game/i.test(t.title));
ok("rotation starts R round 0", t.sound === "R" && t.round === 0);

// ── the complete library, and the rotation behind it ──
const DECK = () => ({
  ps: Sona.pathState(),
  games: [...document.querySelectorAll("#activityGroups .game-card[data-game]")].map(card => card.dataset.game),
  expected: (g => g.flatMap(group => group.games.filter(game => !game.comingSoon).map(game => game.key)).concat(g.flatMap(group => group.games.filter(game => game.comingSoon).map(game => game.key))))(Sona.activityLibrary().groups), // playable first, then the one Coming soon section (1 Oct 2026)
  library: !document.getElementById("libraryApp").hidden,
});
let pp = await page.evaluate(DECK);
ok("Home opens the library without choosing a game", pp.library && /today\.html$/.test(page.url()), JSON.stringify(pp));
ok("library offers every game once in the age shelves", JSON.stringify(pp.games) === JSON.stringify(pp.expected) && new Set(pp.games).size === pp.games.length, JSON.stringify(pp));
ok("deck: fresh family starts at step 0", pp.ps.steps === 0, JSON.stringify(pp.ps));

// ── charge free play: round 1 = isolation, header context line ──
// (Workstream A: the bubble target is the SUSTAINED sound — "rrrr", not
// "your R sound" — and round context lives in the header #ctxLine.)
// The ladder sections below open Premium games (Piano Tiles, Sound Sprint,
// Flappy Glide). Since 24 Sep 2026 a family on the free version is bounced
// from those before practice starts, so this family holds every game — a
// founder key, which the per-navigation profile seed above cannot erase —
// and the climb is tested whichever way the pricing switch points. The key
// is dropped again before the plan-screen section, which needs a family
// WITHOUT Premium.
await page.evaluate(() => localStorage.setItem("sona.founder", "1"));
await page.goto("http://localhost:8131/charge.html?game=arcade-slice.html"); await page.waitForTimeout(700);
let c = await page.evaluate(() => ({ prompt: document.getElementById("bTarget").textContent, lbl: document.getElementById("ctxLine").textContent }));
ok("round 1 practices isolation", /^r+$/i.test(c.prompt.trim()), c.prompt);
// "· R", not "· R sound": the longer form wrapped to two lines on a 390px
// phone between the close button, the ticket pill and the star count
ok("free-play header names its game", c.lbl === "Fruit Slice", c.lbl);

// ── every prompt below the sentence rung is ONE word ──
// "Say a rain" was the bug: the phrase rung prefixed a carrier, so the target a
// child read and imitated was not the target being scored. That rung is gone
// now (word → sentence), so the ladder below sentences is 0..2.
{
  const bad = await page.evaluate(() => {
    const out = [];
    for (const snd of Sona.ALL_SOUNDS) {
      for (const rung of [0, 1, 2]) {             // isolation, syllable, word
        for (const it of Sona.ladderContent(snd, rung) || []) {
          // rung 0's display is a sound LABEL, not a target — THV reads "TH (v)"
          // on purpose, to separate it from voiceless TH. Its spoken form still
          // has to be one piece.
          const parts = rung === 0 ? [it.say] : [it.display || it.t, it.say];
          for (const piece of parts) {
            if (/\s/.test(String(piece || ""))) out.push(snd + " rung" + rung + ": " + JSON.stringify(piece));
          }
        }
      }
    }
    return out;
  });
  ok("no prompt below the sentence rung is more than one word", bad.length === 0, bad.slice(0, 6).join(" | "));
  // the sentence rung is untouched — it is supposed to be a sentence
  const sent = await page.evaluate(() => (Sona.ladderContent("R", 3) || []).map((s) => s.t));
  ok("the sentence rung still returns sentences", sent.length > 0 && sent.every((t) => /\s/.test(t)), JSON.stringify(sent.slice(0, 2)));
}

// ── ?sound= override beats the rotation (SLP/deep-link escape hatch) ──
await page.goto("http://localhost:8131/charge.html?game=arcade-slice.html&sound=T"); await page.waitForTimeout(700);
c = await page.evaluate(() => document.getElementById("bTarget").textContent);
ok("?sound=T overrides rotation", /^tuh$/i.test(c.trim()), c);

// ── one finished round → syllables (stretch = earned 0 + 1) ──
await page.evaluate(() => Sona.rotAdvance());
await page.goto("http://localhost:8131/charge.html?game=arcade-tiles.html"); await page.waitForTimeout(700);
c = await page.evaluate(() => ({ prompt: document.getElementById("bTarget").textContent, lbl: document.getElementById("ctxLine").textContent }));
ok("round 2 climbs to syllables", /^r(ah|ee|oo|oh|ay)$/i.test(c.prompt.trim()));
ok("free-play header stays with the selected game", c.lbl === "Piano Tiles", c.lbl);

// ── rounds 3-4 stay CAPPED at syllables while the rung is unearned ──
await page.evaluate(() => { Sona.rotAdvance(); Sona.rotAdvance(); });
await page.goto("http://localhost:8131/charge.html?game=arcade-run.html"); await page.waitForTimeout(700);
c = await page.evaluate(() => document.getElementById("bTarget").textContent);
ok("round 4 capped at earned+1 (still syllables)", /^r(ah|ee|oo|oh|ay)$/i.test(c.trim()));


// ── rep pill mid-day: the number the kid watches only climbs (RING1) ──
await page.evaluate(() => Sona.bumpReps(12));
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(700);
t = await page.evaluate(() => ({ ring: String(Sona.repsToday()), sound: Sona.rotSound() }));
ok("Home keeps today's real rep count", t.ring === "12", t.ring);
ok("library leaves the current practice sound intact", t.sound === "R");
pp = await page.evaluate(DECK);
ok("deck: steps track the rotation", pp.ps.steps === 3, JSON.stringify(pp.ps));
ok("library: mid-day still offers the complete catalog", JSON.stringify(pp.games) === JSON.stringify(pp.expected), JSON.stringify(pp));
ok("Home keeps saved reps and rounds without the old star-jar menu", await page.evaluate(() => Sona.repsToday() === 12 && Sona.rotRound() === 3 && !document.getElementById("jarInfo")));
await page.screenshot({ path: OUT + "/prog-ring-mid.png" });

// ── finish the rotation: 5 rounds → next letter S, ring goes gold ──
await page.evaluate(() => { Sona.rotAdvance(); Sona.rotAdvance(); });
t = await page.evaluate(() => ({ sound: Sona.rotSound(), round: Sona.rotRound(), ring: Sona.todayRing() }));
ok("rotation flips to S at 5 rounds", t.sound === "S" && t.round === 0);
ok("todayRing done at 5", t.ring.n === 5 && t.ring.done === true);
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(700);
t = await page.evaluate(() => ({
  ring: String(Sona.repsToday()),
  gold: Sona.todayRing().done,
  sound: Sona.rotSound(),
}));
ok("Home keeps the finished-round status independently of reps", t.gold === true && /^\d+$/.test(t.ring));
ok("Home preserves the next current practice sound", t.sound === "S");
pp = await page.evaluate(DECK);
ok("deck: full day = five rotation steps", pp.ps.steps === 5, JSON.stringify(pp.ps));

await page.screenshot({ path: OUT + "/prog-ring-done.png" });

// ── bonus rounds practice the NEXT letter from isolation ──
await page.goto("http://localhost:8131/charge.html?game=arcade-glide.html"); await page.waitForTimeout(700);
c = await page.evaluate(() => ({ prompt: document.getElementById("bTarget").textContent, lbl: document.getElementById("ctxLine").textContent }));
ok("next rotation practices the S sound", /^s+$/i.test(c.prompt.trim()), c.prompt);
ok("extra free play keeps its game title", c.lbl === "Flappy Glide", c.lbl);

// ── Echo's voice never counts as reps; no prices on the kid's home ──
ok("engine ignores mic while ANY app audio plays", /if\(speaking\|\|ttsPlaying\|\|_sayN\)\{[\s\S]{0,130}voiced=0;inBurst=false;/.test(chargeSrc));
ok("no dollar pricing in kid-facing today.html", !/\$\d/.test(todaySrc));
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(700);
// this profile is NOT a founding family → trial banner path
let bn = await page.evaluate(() => ({
  shown: getComputedStyle(document.getElementById("trialBanner")).display !== "none",
  txt: document.getElementById("trialMsg").textContent,
}));
ok("trial banner is kid-neutral", !bn.shown || (!/\$/.test(bn.txt) && /Grown-ups/.test(bn.txt)));
if (bn.shown) {
  await page.evaluate(() => document.getElementById("trialBanner").click());
  const gate = await page.evaluate(() => document.getElementById("gateOvl").classList.contains("show"));
  ok("banner tap opens the parent gate (not checkout)", gate);
  await page.evaluate(() => document.getElementById("gateClose").click());
}

// ── retry ladder: Echo thinks while scoring; two misses step DOWN a rung ──
ok("Echo shows a visual checking state", /echo-checking/.test(chargeSrc) && /leo\.think\{animation:think/.test(chargeSrc.replace(/#/g, "")));
// 24 Sep 2026: the spoken line is calm now ("I have an idea. Let's try this one.").
ok("step-down retry offers an easier same-sound target", /Let's try this one/.test(chargeSrc) && /ladderContent\(SOUND,useRung-1\)/.test(chargeSrc));

// ── voice revive: "keep playing" copy + family-aware trigger in all 5 games ──
{
  const { readFileSync: rf } = await import("fs");
  const games = ["arcade-slice", "arcade-tiles", "arcade-stack", "arcade-run", "arcade-glide"];
  const all = games.every((g) => {
    const src = rf(ROOT + "/" + g + ".html", "utf8");
    return src.includes("to keep playing!") && src.includes("famOK") && src.includes("Sona.frameShape");
  });
  ok("all 5 games: revive says 'keep playing' + family-checked", all);
  const sj = rf(ROOT + "/sona.js", "utf8");
  ok("sona.js exports the shape helpers", /soundFamily, frameShape,/.test(sj));
}

// ── pulse: chip-first — chips render, note stays optional-and-hidden ──
await page.evaluate(() => { try { window.showPulse && showPulse(true); } catch (e) {} });
t = await page.evaluate(() => ({
  chips: document.querySelectorAll("#pulseChips .pulseChip").length,
  hidden: (document.getElementById("pulseMore") || {}).style ? document.getElementById("pulseMore").style.display === "none" : false,
  ph: (document.getElementById("pulseText") || {}).placeholder || "",
}));
if (t.chips) {
  ok("pulse opens chip-first with note hidden", t.chips >= 5 && t.hidden);
  ok("pulse note reads optional", /optional/i.test(t.ph));
} else ok("pulse chips in source", /PULSE_CHIPS/.test(todaySrc));

// ── the ring resets overnight: yesterday's rounds never survive to today ──
await page.evaluate(() => { localStorage.setItem("sona.today.v1", JSON.stringify({ d: "2026-07-10", n: 3 })); localStorage.setItem("sona.reps.v1", JSON.stringify({ d: "2026-07-10", n: 44 })); });
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(600);
t = await page.evaluate(() => ({ ring: String(Sona.repsToday()), api: Sona.todayRing() }));
ok("stale day → rep pill and rounds reset to 0", t.ring === "0" && t.api.n === 0 && !t.api.done);

// ── done state carries the tomorrow-hook (forward pull, no breakable number) ──
await page.evaluate(() => {
  const d = new Date(); const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  localStorage.setItem("sona.today.v1", JSON.stringify({ d: iso, n: 5 }));
});
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(600);
t = await page.evaluate(() => ({ sound: Sona.rotSound(), gold: Sona.todayRing().done }));
ok("completed rounds preserve the next sound goal", t.sound === "S" && t.gold === true);
await page.evaluate(() => localStorage.removeItem("sona.today.v1"));

// ── no comeback popup: opening the app after days away goes STRAIGHT to the
// day, no "You're back!" modal in the way. Removed on Travis's call — a popup
// between the kid and the story was friction on exactly the visit we most
// want to go well. Still no broken-streak guilt anywhere on the page either.
await page.evaluate(() => {
  const g = Sona.getProgress(); g.practiceDays = { "2026-06-30": 1 }; g.streak = { lastDate: "2026-06-30", count: 1 };
  localStorage.setItem("sona.progress.v1", JSON.stringify(g));
});
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(700);
let cb = await page.evaluate(() => ({
  overlays: [...document.querySelectorAll(".ovl.show")].map((e) => e.id),
  body: document.body.textContent,
}));
ok("no popup after 3+ days away — the day is just there", cb.overlays.length === 0, JSON.stringify(cb.overlays));
ok("…and nothing guilt-trips about the gap", !/you're back|missed you|streak (lost|broken)/i.test(cb.body));

// ── mic primer: first-ever mic ask explains before the browser prompt ──
await page.addInitScript(() => {
  navigator.permissions = navigator.permissions || {};
  navigator.permissions.query = () => Promise.resolve({ state: "prompt" });
});
await page.evaluate(() => localStorage.removeItem("sona.micok")); // one-shot: fresh family
await page.goto("http://localhost:8131/charge.html?game=arcade-slice.html"); await page.waitForTimeout(900);
let mp = await page.evaluate(() => ({
  shown: document.getElementById("micPrime").classList.contains("show"),
  txt: document.getElementById("micPrime").textContent,
}));
ok("primer shows before the mic prompt", mp.shown);
// This used to pin the phrases "nothing is recorded" and "doesn't keep them",
// which sat either side of a claim that practice words were sent away to be
// scored. That upload stopped existing when the cloud scorer was removed, so
// the strings were pinning a promise the code no longer kept. What the primer
// owes a parent is unchanged — SCOPE (when the mic is live), HANDLING (where
// the sound goes), and the games/practice distinction — so those are what is
// pinned now, in the form that is currently true. mictest.mjs guards the other
// direction: no sending claim may come back without the mechanism.
// Shortened on 1 Oct 2026 (Travis: "way too many words here") and again on
// 2 Oct 2026 ("just say audio is never recorded or uploaded"): that nothing is
// uploaded, and the one try a day kept on the phone. Not "never recorded":
// that one try is recorded, on the phone, and the line must not deny it.
ok("primer explains listening honestly",
  /never uploaded/.test(mp.txt) && /One try a day is saved on this phone/.test(mp.txt) && !/never recorded/i.test(mp.txt), mp.txt);
ok("primer offers a soft decline (protects the OS prompt)", /Not now/.test(mp.txt));
await page.evaluate(() => document.getElementById("micPrimeBtn").click());
await page.waitForTimeout(500);
mp = await page.evaluate(() => ({
  gone: !document.getElementById("micPrime").classList.contains("show"),
  micok: localStorage.getItem("sona.micok"),
}));
ok("primer dismisses into the mic grant + remembers", mp.gone && mp.micok === "1");
await page.goto("http://localhost:8131/charge.html?game=arcade-slice.html"); await page.waitForTimeout(800);
mp = await page.evaluate(() => document.getElementById("micPrime").classList.contains("show"));
ok("primer never shows again after grant", !mp);

// ── mic DENIED → recovery screen: grown-up steps + a Try Again that retries ──
await page.evaluate(() => localStorage.removeItem("sona.micok"));
await page.addInitScript(() => {
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
});
await page.goto("http://localhost:8131/charge.html?game=arcade-slice.html"); await page.waitForTimeout(900);
await page.evaluate(() => document.getElementById("micPrimeBtn").click());
await page.waitForTimeout(700);
mp = await page.evaluate(() => ({
  txt: (document.getElementById("sonaMicDenied") || {}).textContent || "",
  retry: !!document.getElementById("sonaMicRetry"),
}));
ok("denied state shows grown-up recovery steps", /can’t hear you yet/.test(mp.txt) && /Settings/.test(mp.txt) && /Microphone/.test(mp.txt));
ok("denied state offers try-again + back", mp.retry && /Back home/.test(mp.txt));

// ── ad rail: pixel armed, kid pages clean, SLP links split the cohorts ──
{
  const { readFileSync: rf, readdirSync: rd } = await import("fs");
  ok("pixel armed with the Sona ID", /28886011914332605/.test(rf(ROOT + "/pixel.js", "utf8")));
  // COPPA guard, hardened after the review: enumerate EVERY kid/game page (not
  // a hand-picked 10) and reject ANY third-party code — the Meta/PostHog
  // loaders AND remote script hosts (Vercel Insights, esm.sh, jsDelivr, unpkg).
  // Parent/marketing/SLP surfaces are allowed analytics and are excluded.
  const PARENT_PAGES = new Set([
    "onboarding.html", "subscribe.html", "check.html", "for-slps.html", "parents.html", "slp.html",
    "slp-login.html", "settings.html", "progress.html", "trial.html", // voices.html deleted 29 Sep 2026 (one coach voice)
    "pilot.html", "privacy.html", "founders.html", "founding.html", "join.html",
    // experimental HeyGen live-avatar pages — orphaned (nothing links to them),
    // load a remote SDK, gated/removed before any kid-flow release (F4 review).
  ]);
  const BANNED = /pixel\.js|analytics\.js|fbevents|_vercel\/insights|esm\.sh|jsdelivr|unpkg\.com|googletagmanager|connect\.facebook/;
  const dirty = rd(ROOT).filter((f) => f.endsWith(".html") && !PARENT_PAGES.has(f))
    .filter((f) => BANNED.test(rf(ROOT + "/" + f, "utf8")));
  ok("no third-party code on any kid/game page (COPPA)", dirty.length === 0, "dirty=" + dirty.join(","));
}
await page.evaluate(() => { localStorage.removeItem("sona.slp"); });
await page.goto("http://localhost:8131/today.html?slp=DrSmith22"); await page.waitForTimeout(500);
t = await page.evaluate(() => localStorage.getItem("sona.slp"));
ok("?slp= link sticks (uppercased)", t === "DRSMITH22");
// trial-cohort family (no slp, not founding) sees the plan picker on subscribe
await page.evaluate(() => {
  localStorage.removeItem("sona.founder");      // the ladder sections' Premium, gone
  localStorage.removeItem("sona.slp");
  const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.earlyAdopter = false; delete p.slpCode;
  localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done"); localStorage.setItem("sona.freeera3.v1","done");localStorage.setItem("sona.freeera4.v1","done");localStorage.setItem("sona.freeera5.v1","done"); localStorage.setItem("sona.profile.v1", JSON.stringify(p));
  sessionStorage.setItem("sona.gate.v1", String(Date.now()));
  // THE WEB CARD, WHICHEVER WAY THE SWITCHES SHIP. ?paid=1 in the address
  // below is only read while Sona is free, and it says nothing about the second
  // switch: since 1 Oct 2026 (Travis: "i dont want them paying on the
  // website") a browser shows this card only while Sona.webSales() says yes.
  // Both seams are session keys, set here before the page loads and taken off
  // again after this section. Without them every click below lands on a hidden
  // button: a 30-second wait, a throw at the top level, and nothing after this
  // point in the file would run.
  sessionStorage.setItem("sona.paidui", "1");
  sessionStorage.setItem("sona.websalesui", "1");
});
await page.goto("http://localhost:8131/subscribe.html?paid=1"); await page.waitForTimeout(700);
t = await page.evaluate(() => ({
  pick: document.getElementById("pickCard").style.display,
  founding: document.getElementById("foundingCard").style.display,
  life: document.getElementById("planLife").textContent,
  line: document.getElementById("planLine").textContent,
  // counted and measured on the screen: the card is always in the file, so
  // its markup alone would satisfy a count with the card hidden
  cards: [...document.querySelectorAll("#pickCard .plan")].filter((n) => n.getBoundingClientRect().height > 0).length,
  seen: document.getElementById("buyLife").getBoundingClientRect().height > 0,
  app: document.getElementById("appCard").style.display,
}));
ok("unpaid family sees the yearly card first ($59.99/yr, best value)",
  t.pick === "block" && t.founding === "none" && /59\.99/.test(t.life) && /\/yr|per year|yearly/i.test(t.life));
ok("…on the screen, with its button, and not the 'it's in the iPhone app' card", t.seen && t.app === "none", JSON.stringify({ seen: t.seen, app: t.app }));
// TWO WAYS TO PAY as of 1 Oct 2026 (Travis: "add to the paywall a $10 a month
// option ... that does not have a free trial. That's a pay today, but the
// $59.99 has a three-day trial. And have that as the default option
// selected"). Monthly was retired on 18 Sep and is back, sold for real: the
// checkout honours it (caseloadtest plays the route). A THIRD box would be a
// tier nobody approved.
ok("TWO ways to pay exactly — the yearly plan and the monthly one", t.cards === 2, "cards=" + t.cards);
// THE HEADING SAYS WHAT THE BUTTON DOES. On arrival the yearly plan is picked
// and the button starts free days, so the heading says so; it is never the
// bare "Pick your plan". And the decline sat two screens below the offer,
// past the SLP card — it now sits directly beneath the card it declines.
{
  const shape = await page.evaluate(() => {
    const h = document.querySelector("#pickCard h2");
    const order = [...document.querySelectorAll("#pickCard, #declineRow")].map((e) => e.id);
    const slpCard = !!document.getElementById("slpEntryCard");
    return { heading: h ? h.textContent.trim() : "", order, slpCard };
  });
  ok("the plan card is headed by what the button does on arrival: free days, the yearly plan's",
    /Start your free days/.test(shape.heading) && !/Pick your plan/.test(shape.heading), shape.heading);
  ok("…and the decline sits directly under the plan card",
    shape.order.join(">") === "pickCard>declineRow", shape.order.join(">"));
  // the SLP side is hidden (19 Sep 2026): the plan screen no longer offers it
  ok("…and the 'working with a speech therapist?' card is gone from the plan screen", !shape.slpCard);
}
// The button and its "what happens when" lines sit UNDER both plan boxes
// since 1 Oct 2026 (one button, two plans), so the cancel promise is read
// there, as a parent sees it: innerText, which leaves out anything hidden.
const buyArea = await page.evaluate(() => document.querySelector("#pickCard .planbuy").innerText);
ok("yearly card states the 3-day trial, and the cancel promise sits with the button",
  /3 days free/i.test(t.life) && /cancel any ?time/i.test(buyArea), buyArea.slice(0, 160));
ok("…and nothing a parent can read under that button says the monthly plan's 'charged today, then every month'",
  !/then every month|\$9\.99 is charged/i.test(buyArea), buyArea.slice(0, 200));
// The comparison figures did NOT come back with monthly. $119.88 really is
// twelve months of $9.99 again, but "save $59.89" is true only while the
// charter price lasts: at family fifty-one the yearly plan is $99.99 and the
// saving is $19.89, so a typed saving is a number with an expiry date. What
// must survive is the per-month reading, which is just $59.99/12.
ok("…and no was-price or 'you save' figure rides back in with the monthly plan",
  !/119\.88/.test(t.life) && !/59\.89/.test(t.life),
  "the saving is only true for the first 50 families: " + t.life.slice(0, 120));
ok("…while the honest per-month reading stays, and says it is billed once a year",
  /under \$5 a month, billed once a year/i.test(t.life), t.life.slice(0, 120));
// THE HEADER LINE IS PRICE COPY TOO. The page WRITES #planLine at runtime, so
// read what the parent reads. It names both ways to pay, with what makes each
// one different, and still carries no was-price.
ok("the header line carries no was-price and no invented saving",
  !/119\.88/.test(t.line) && !/59\.89/.test(t.line), "planLine: " + t.line.slice(0, 200));
ok("…says the true thing about the yearly plan: its price and its 3 free days",
  /59\.99/.test(t.line) && /3 days free/i.test(t.line) && /under \$5 a month<?[^.]*billed once a year/i.test(t.line), "planLine: " + t.line.slice(0, 200));
ok("…and the true thing about the monthly one: its price, and that it is charged today",
  /\$9\.99 a month, charged today/.test(t.line), "planLine: " + t.line.slice(0, 200));
{
  // THE MONTHLY BOX IS HONEST, AND YEARLY IS THE ONE PICKED. /\$9\.99/, with
  // the dollar sign: a bare /9\.99/ also matches "$59.99" and "$99.99" and
  // passed on a page with no monthly price on it at all.
  const pay = await page.evaluate(() => {
    const g = (id) => document.getElementById(id);
    // by what is PAINTED, never by the hidden attribute the page sets: a
    // display rule that beats the attribute is exactly the bug to catch
    const seen = (el) => !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0;
    return {
      month: g("planMonth") ? g("planMonth").innerText : null,
      yearPicked: g("planLife").getAttribute("aria-checked"), monthPicked: g("planMonth") && g("planMonth").getAttribute("aria-checked"),
      secondButton: !!g("buyMonth"), buttons: document.querySelectorAll("#pickCard button.go").length,
      button: g("buyLife").textContent, timeline: seen(g("webTL")), payToday: seen(g("monthMath")),
      bill: g("webTL").innerText, renewShown: seen(g("webRenew")),
    };
  });
  // "Charged today", not "no free trial" (Travis, 1 Oct 2026: "dont say no
  // free trial at the bottom"): the same fact, said as what the plan does.
  // It must never say "free" at all — that word is the yearly plan's.
  ok("the monthly box is honest: $9.99, charged today — and never the word 'free'",
    !!pay.month && /\$9\.99/.test(pay.month) && /charged today/i.test(pay.month) && !/free/i.test(pay.month), JSON.stringify(pay.month));
  ok("…and it never borrows the charter price or a spots-left number",
    !!pay.month && !/charter|spots? left|first 50/i.test(pay.month), JSON.stringify(pay.month));
  ok("the yearly plan is the one picked when the page opens", pay.yearPicked === "true" && pay.monthPicked === "false", JSON.stringify(pay));
  ok("one button serves both plans — no second buy button", pay.buttons === 1 && !pay.secondButton, JSON.stringify(pay));
  ok("on arrival the button starts free days, the billing day is showing and 'charged today' is not",
    pay.button === "Start 3 days free" && pay.timeline && !pay.payToday, JSON.stringify(pay));
  // ONE LINE UNDER THE BUTTON (Travis, 2 Oct 2026: "there's still too much
  // information ... just briefly say like what day they'll be billed"): the
  // day the free days end and the price after them, and the small print that
  // said the same steps aside for the yearly plan.
  ok("…in one line: free until a named day, then the yearly price, cancel anytime, and no second small print saying it again",
    /^Free until [A-Z][a-z]+ \d{1,2}, then \$\d+\.\d\d a year\. Cancel anytime\.$/.test(pay.bill.trim()) && !pay.renewShown, JSON.stringify([pay.bill, pay.renewShown]));
}
{
  // WHAT THE BUTTON SENDS. Every browser suite answers /api/* with an error,
  // so until now nothing read what the plan screen posts to checkout: a
  // "monthly" pick that posted "annual" would have passed everything.
  const posts = [];
  await page.route("**/api/checkout", (r) => { posts.push(r.request().postDataJSON()); r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: false, error: "test: not opened" }) }); });
  const look = () => page.evaluate(() => {
    const g = (id) => document.getElementById(id);
    // by what is PAINTED, never by the hidden attribute the page sets: a
    // display rule that beats the attribute is exactly the bug to catch
    const seen = (el) => !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0;
    return { button: g("buyLife").textContent, disabled: g("buyLife").disabled, timeline: seen(g("webTL")), noChargeToday: seen(g("trialMath")), payToday: seen(g("monthMath")),
      area: document.querySelector("#pickCard .planbuy").innerText, renew: g("webRenew").innerText, renewShown: seen(g("webRenew")), heading: g("pickTitle").textContent,
      yearPicked: g("planLife").getAttribute("aria-checked"), monthPicked: g("planMonth").getAttribute("aria-checked") };
  });
  await page.waitForFunction(() => !document.getElementById("buyLife").disabled);   // the price check has let go
  await page.locator("#buyLife").click(); await page.waitForTimeout(250);
  ok("with nothing touched, the button buys the yearly plan", posts.length === 1 && posts[0].plan === "annual", JSON.stringify(posts));
  await page.locator("#planMonth").click(); await page.waitForTimeout(150);
  let m = await look();
  ok("picking monthly: the button names the price charged today", m.monthPicked === "true" && m.yearPicked === "false" && m.button === "Subscribe — $9.99 a month", JSON.stringify(m));
  ok("…the free days' billing line and 'no charge today' leave the screen: nothing under the button says 'free'", !m.timeline && !m.noChargeToday && !/free|nothing is charged|no charge today/i.test(m.area), m.area.slice(0, 200));
  ok("…and 'charged today, then every month' is what is under the button", m.payToday && /\$9\.99 is charged today, then every month/i.test(m.area), m.area.slice(0, 200));
  ok("…the small print is the monthly plan's, on screen: charged today, $9.99 a month", m.renewShown && /charged today/i.test(m.renew) && /\$9\.99 a month/.test(m.renew) && !/3-day|a year|free/i.test(m.renew), m.renew);
  // a family who paid on the web has no account page with a cancel button,
  // so the new line names the way that works (the Terms say the same)
  ok("…and it names a way to cancel that exists: an email address, not 'in your account'", /To cancel, email \S+@speaksona\.com/.test(m.renew) && !/in your account/i.test(m.renew), m.renew);
  ok("…and the heading stops promising free days", !/free days/i.test(m.heading), m.heading);
  await page.locator("#buyLife").click(); await page.waitForTimeout(250);
  ok("…and the button now buys the monthly plan", posts.length === 2 && posts[1].plan === "monthly", JSON.stringify(posts));
  await page.locator("#planLife").click(); await page.waitForTimeout(150);
  m = await look();
  ok("picking yearly again puts every yearly line back, and takes the monthly ones off the screen", m.yearPicked === "true" && m.button === "Start 3 days free" && m.timeline && !m.payToday && !/then every month/i.test(m.area) && !m.renewShown && /free days/i.test(m.heading), JSON.stringify(m).slice(0, 300));
  await page.locator("#planMonth").focus(); await page.keyboard.press("Space"); await page.waitForTimeout(100);
  const key1 = await look();
  await page.keyboard.press("ArrowUp"); await page.waitForTimeout(100);
  const key2 = await look();
  ok("the two boxes work from a keyboard: Space picks, an arrow moves", key1.monthPicked === "true" && key2.yearPicked === "true", JSON.stringify([key1.monthPicked, key2.yearPicked]));
  await page.unroute("**/api/checkout");
}
// paywall trust: named-SLP proof strip above the plan
t = await page.evaluate(() => (document.querySelector("#pickCard .proof") || {}).textContent || "");
ok("proof strip: named SLP credential above the plan",
  /Rachel/.test(t) && /speech-language pathologist/.test(t));
// THE SAME FAMILY, WHEN THE WEBSITE DOES NOT SELL (Travis, 1 Oct 2026: "i dont
// want them paying on the website"). The seam forced off: the web card and its
// button are gone, and in their place the page says where Premium is bought,
// with no figure of any kind. Nothing here clicks: there is nothing to buy.
{
  await page.evaluate(() => sessionStorage.setItem("sona.websalesui", "0"));
  const posts = [];
  await page.route("**/api/checkout", (r) => { posts.push(r.request().method()); r.fulfill({ contentType: "application/json", body: "{}" }); });
  await page.goto("http://localhost:8131/subscribe.html?paid=1"); await page.waitForTimeout(700);
  const off = await page.evaluate(() => {
    const g = (id) => document.getElementById(id);
    const seen = (el) => !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0;
    return { pick: g("pickCard").style.display, card: seen(g("pickCard")), buy: seen(g("buyLife")), boxes: [...document.querySelectorAll("#pickCard .plan")].filter(seen).length,
      app: g("appCard").style.display, appSeen: seen(g("appCard")), store: seen(g("appStoreGo")) ? g("appStoreGo").getAttribute("href") : "",
      title: g("appTitle").textContent, words: g("appCard").innerText, free: g("freeTierCard").style.display, founding: g("foundingCard").style.display,
      line: g("planLine").textContent, body: document.body.innerText, order: [...document.querySelectorAll("#appCard, #freeTierCard")].map((e) => e.id).join(">") };
  });
  ok("web sales off: no plan boxes and no buy button are on the screen",
    off.pick === "none" && !off.card && !off.buy && off.boxes === 0, JSON.stringify({ pick: off.pick, card: off.card, buy: off.buy, boxes: off.boxes }));
  ok("…the page says Sona Premium is in the iPhone and iPad app, and links the App Store",
    off.app === "block" && off.appSeen && off.title === "Sona Premium is in the iPhone and iPad app" &&
    off.store === "https://apps.apple.com/us/app/sona-speech/id6785755867" && /Get Sona on the App Store/.test(off.words), JSON.stringify({ app: off.app, store: off.store, title: off.title }));
  ok("…in the settled words: bought there, opens there, practice and the free games stay free here",
    /Premium opens every game and every book in the Sona app\. You buy it there, through the App Store, and it opens there\. Daily practice and the free games stay free here\./.test(off.words), off.words);
  ok("…and tells someone who already paid on the website that the plan keeps working",
    /Already paid on speaksona\.com\? Your plan keeps working\./.test(off.words), off.words);
  ok("…with what stays free right under it, and no free-era card",
    off.order === "appCard>freeTierCard" && off.free === "block" && off.founding === "none", JSON.stringify({ order: off.order, free: off.free, founding: off.founding }));
  ok("…the header line says where Premium is bought, and never 'founding family'",
    /free version/.test(off.line) && /Sona Premium is bought in the iPhone and iPad app/.test(off.line) && !/founding/i.test(off.line), off.line);
  ok("…and no dollar figure, free-days promise or charter line is anywhere a parent can read",
    !/\$/.test(off.body) && !/3 days free|free trial|charter|spots? left|charged today/i.test(off.body),
    (off.body.match(/\$[^\s]*|3 days free|free trial|charter|spots? left|charged today/i) || [])[0]);
  ok("…and nothing was sent to checkout", posts.length === 0, posts.join(","));
  await page.unroute("**/api/checkout");
  // the seams come off: everything after this runs on the switches as shipped
  await page.evaluate(() => { sessionStorage.removeItem("sona.websalesui"); sessionStorage.removeItem("sona.paidui"); });
}
// ── practice volume: local tries and the family's own prior week only ──
{
  const iso = new Date().toISOString().slice(0, 10);
  await page.evaluate((d) => {
    sessionStorage.setItem("sona.gate.v1", String(Date.now()));
    const out = { R: { attempts: 6, passes: 4, tries: 30, days: {} } };
    out.R.days[d] = { a: 6, p: 4, tries: 30 };
    localStorage.setItem("sona.outcomes.v1", JSON.stringify(out));
  }, iso);
  repsPosts = [];
  await page.goto("http://localhost:8131/progress.html"); await page.waitForTimeout(900);
  t = await page.evaluate(() => ({
    tries: document.getElementById("volReps").textContent,
    ranking: !!document.getElementById("volChip") || !!document.getElementById("volNext"),
    last: document.getElementById("volLast").textContent,
  }));
  ok("volume card shows detected tries rather than the number of sound checks", t.tries === "30");
  ok("peer ranking is removed", !t.ranking);
  ok("the baseline is the family's own previous week", /Last week: 0 tries/.test(t.last));
  ok("opening Progress posts no anonymous practice volume", repsPosts.length === 0);
  await page.evaluate(() => localStorage.removeItem("sona.outcomes.v1"));
}

// ── progress report: narrative hero + non-clinical hedge + review pre-gate ──
{
  const iso = new Date().toISOString().slice(0, 10);
  await page.evaluate((d) => {
    sessionStorage.setItem("sona.gate.v1", String(Date.now()));
    const g = JSON.parse(localStorage.getItem("sona.progress.v1") || "{}");
    g.totals = Object.assign({}, g.totals, { sessions: 6, words: 40, stars: 3 });
    g.streak = g.streak || { count: 1, lastDate: d };
    localStorage.setItem("sona.progress.v1", JSON.stringify(g));
    // A day logged since tries were counted (REPWEEKS1): sound checks alone are not reps.
    const out = {}; out.R = { attempts: 24, passes: 20, tries: 24, days: {} }; out.R.days[d] = { a: 24, p: 20, tries: 24 };
    localStorage.setItem("sona.outcomes.v1", JSON.stringify(out));
    localStorage.removeItem("sona.rateask.v1");
  }, iso);
  await page.goto("http://localhost:8131/progress.html"); await page.waitForTimeout(800);
  t = await page.evaluate(() => ({
    story: document.getElementById("storyLine").textContent,
    hedge: document.body.textContent.includes("A practice snapshot, not a clinical assessment"),
    rate: document.getElementById("rateCard").style.display,
    yesHref: document.getElementById("rateYes").getAttribute("href"),
    noHref: document.getElementById("rateNo").getAttribute("href"),
  }));
  ok("report opens with a narrative sentence (name + sound + count)", /practiced the R sound with 24 tries this week/.test(t.story));
  ok("non-clinical hedge present", t.hedge);
  // AN EMPTY REPORT IS THE STATE MOST LIKELY TO READ AS "BROKEN". A parent who
  // opens Progress before any practice must be told what will fill it and
  // handed the one action that fills it — not left on a blank card.
  {
    const ctx = await browser.newContext(); const pg = await ctx.newPage();
    await pg.goto("http://localhost:8131/today.html"); await pg.waitForTimeout(300);
    await pg.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done"); localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done"); localStorage.setItem("sona.freeera5.v1", "done");
      Sona.saveProfile({ childName: "Ada", childAge: "7", focusSounds: ["R"], onboarded: true });
      sessionStorage.setItem("sona.gate.v1", String(Date.now()));
    });
    await pg.goto("http://localhost:8131/progress.html"); await pg.waitForTimeout(900);
    const empty = await pg.evaluate(() => {
      const one = document.getElementById("storyLine");
      return {
        says: one.textContent,
        action: !!one.querySelector('a[href="/today.html"]'),
        cards: [...document.querySelectorAll("#bysound p, #acc p")].map((e) => !!e.querySelector('a[href="/today.html"]')),
      };
    });
    ok("an empty report explains what will appear", /adds its first tries to this page/.test(empty.says), empty.says);
    ok("…and hands the parent one next action", empty.action, empty.says);
    ok("empty detail cards do not duplicate the main practice action",
      empty.cards.length > 0 && empty.cards.every((hasAction) => !hasAction), JSON.stringify(empty.cards));
    await ctx.close();
  }
  // "Could be better" goes to Talk to us now, not a mailto (29 Sep 2026): every
  // family note reaches the team through that one in-app page.
  ok("review pre-gate shows after real value, Bear-style fork",
    t.rate === "block" && /action=write-review/.test(t.yesHref) && t.noHref === "/talk.html");
  await page.evaluate(() => document.getElementById("rateX").click());
  await page.goto("http://localhost:8131/progress.html"); await page.waitForTimeout(700);
  t = await page.evaluate(() => document.getElementById("rateCard").style.display);
  ok("dismissed pre-gate stays quiet on the next visit (60d cooldown)", t !== "block");
  await page.evaluate(() => { localStorage.removeItem("sona.outcomes.v1"); localStorage.removeItem("sona.rateask.v1"); });
}

// A founding / free-era family keeps the free story on the plan page. Run in a
// FRESH context: four hundred lines of prior mutations in this file leave the
// shared one in a state that has nothing to do with what's being asserted.
{
  const fctx = await browser.newContext();
  const fpg = await fctx.newPage();
  await fpg.goto("http://localhost:8131/today.html");
  await fpg.evaluate(() => {
    localStorage.setItem("sona.freeera.v1","post"); localStorage.setItem("sona.freeera2.v1","done"); localStorage.setItem("sona.freeera3.v1","done");localStorage.setItem("sona.freeera4.v1","done");localStorage.setItem("sona.freeera5.v1","done");
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true }));
    try { Sona.gateVerify(); } catch (e) {}
  });
  await fpg.goto("http://localhost:8131/subscribe.html"); await fpg.waitForTimeout(800);
  const f = await fpg.evaluate(() => ({
    early: Sona.getProfile().earlyAdopter,
    pick: document.getElementById("pickCard").style.display,
    founding: document.getElementById("foundingCard").style.display,
    app: document.getElementById("appCard").style.display,
  }));
  ok("founding family keeps the free story", f.early === true && f.pick !== "block" && f.founding !== "none");
  // …whichever way the website's switch points: no seam here, on purpose
  ok("…and is never sent to the App Store to buy what they were promised free", f.app !== "block", String(f.app));
  await fctx.close();
}

// ── the session CLIMBS, and the header agrees with the level ──
// "Round 3 of 5" handed a child a phrase: the header read today's ring while the
// ladder step read sona.js's persistent rotation counter, so the number a parent
// saw and the level their child got were two different things — and a new day
// could open at phrases instead of warming up on the sound.
{
  const climb = [];
  for (const n of [0, 1, 2]) {
    await page.evaluate((k) => {
      const t = Sona.localDay();
      localStorage.setItem(Sona.kkey("sona.today.v1"), JSON.stringify({ d: t, n: k }));
      const g = Sona.getProgress(); g.stage = g.stage || {}; g.stage.R = 5;  // nothing capped
      localStorage.setItem(Sona.kkey("sona.progress.v1"), JSON.stringify(g));
    }, n);
    await page.goto("http://localhost:8131/charge.html?game=arcade-slice.html&sound=R"); await page.waitForTimeout(700);
    climb.push(await page.evaluate(() => ({
      hdr: document.getElementById("ctxLine").textContent,
      target: document.getElementById("bTarget").textContent.trim(),
      syls: (Sona.ladderContent("R", 1) || []).map((x) => x.t),
      words: (Sona.ladderContent("R", 2) || []).map((x) => x.t),
    })));
  }
  ok("round 1 warms up on the sound in isolation", /^r+$/i.test(climb[0].target), climb[0].target);
  ok("round 2 moves to a syllable", climb[1].syls.includes(climb[1].target), JSON.stringify([climb[1].target, climb[1].syls]));
  ok("round 3 moves to a word", climb[2].words.includes(climb[2].target), JSON.stringify([climb[2].target, climb[2].words]));
  ok("free-play names the game while the practice target climbs",
    climb.every(c => c.hdr === "Fruit Slice"),
    climb.map((c) => c.hdr).join(" | "));
  // and the cap still protects a child who has earned nothing
  await page.evaluate(() => {
    localStorage.setItem(Sona.kkey("sona.today.v1"), JSON.stringify({ d: Sona.localDay(), n: 4 }));
    const g = Sona.getProgress(); g.stage = g.stage || {}; g.stage.R = 0;
    localStorage.setItem(Sona.kkey("sona.progress.v1"), JSON.stringify(g));
  });
  await page.goto("http://localhost:8131/charge.html?game=arcade-slice.html&sound=R"); await page.waitForTimeout(700);
  const capped = await page.evaluate(() => ({
    target: document.getElementById("bTarget").textContent.trim(),
    syls: (Sona.ladderContent("R", 1) || []).map((x) => x.t),
  }));
  ok("a child who has earned nothing is still capped at earned+1",
    capped.syls.includes(capped.target), JSON.stringify(capped));
  await page.evaluate(() => localStorage.removeItem(Sona.kkey("sona.today.v1")));
}

// ── the word step asks for the position being practised (30 Sep 2026) ──
// It passed no position, so whatever Settings' Word position or an SLP's
// homework said, the word step asked for start-of-word words: End-of-word
// homework still got "rabbit". Travis: the position must actually drive the
// practice page — homework's first, then the family's setting. A position
// with no words for that sound falls back to start-of-word words rather than
// an empty round. (hwtest holds the sentence step to the same rule.)
//
// 1 Oct 2026 (Travis: "have the options listed but to not let them select
// other positioning because it's not built yet"): a FAMILY can pick only the
// start of a word for now (Sona.FAMILY_POSITIONS). Homework still names its
// own position; a family's Middle saved earlier reads as the start of a word.
{
  const HW = (pos) => `localStorage.setItem(Sona.kkey("sona.homework.v1"), JSON.stringify({ hw: { id: "hwpos", title: "R at the end", note: "", sounds: ["R"], pos: "${pos}", repsPerDay: 20, words: null, start: "2000-01-01", due: "2999-01-01", by: "Rachel" }, at: Date.now() }))`;
  const pw = await page.evaluate((hw) => {
    const bank = (s, p) => Sona.WORDS[s].filter((w) => (w.pos || "i") === p).map((w) => w.w).join();
    const step = (s) => (Sona.ladderContent(s, 2) || []).map((x) => x.word).join();
    const out = { iR: bank("R", "i"), fR: bank("R", "f"), mR: bank("R", "m"), iK: bank("K", "i") };
    out.none = { pos: Sona.practicePos(), words: step("R") };
    eval(hw);                                          // homework: R at End
    Sona.saveProfile({ practicePosition: "m" });       // …while the family picked Middle
    out.hw = { pos: Sona.practicePos(), words: step("R") };
    localStorage.removeItem(Sona.kkey("sona.homework.v1"));
    out.fam = { pos: Sona.practicePos(), words: step("R") };
    Sona.saveProfile({ practicePosition: "v" });       // Vocalic R, for a sound with none
    out.noneForK = step("K");
    Sona.saveProfile({ practicePosition: "i" });
    return out;
  }, HW("f"));
  ok("with no homework and no setting, the word step asks for start-of-word words", pw.none.pos === "i" && pw.none.words === pw.iR, JSON.stringify(pw.none));
  ok("homework at End: every word at the word step is an End word, over the family's Middle", pw.hw.pos === "f" && pw.hw.words === pw.fR, JSON.stringify(pw.hw));
  ok("no homework, family's old Middle setting: the word step asks for start-of-word words (Middle is not open to families yet)",
    pw.fam.pos === "i" && pw.fam.words === pw.iR && pw.mR && pw.mR !== pw.iR, JSON.stringify(pw.fam));
  ok("a position with no words for the sound falls back to start-of-word words", pw.noneForK === pw.iK, pw.noneForK);

  // …and on the real page: round 3 of a child with words earned, homework at End
  await page.evaluate((hw) => {
    eval(hw);
    localStorage.setItem(Sona.kkey("sona.today.v1"), JSON.stringify({ d: Sona.localDay(), n: 2 }));
    const g = Sona.getProgress(); g.stage = g.stage || {}; g.stage.R = 5;
    localStorage.setItem(Sona.kkey("sona.progress.v1"), JSON.stringify(g));
  }, HW("f"));
  await page.goto("http://localhost:8131/charge.html?game=arcade-slice.html&sound=R"); await page.waitForTimeout(700);
  const onPage = await page.evaluate(() => document.getElementById("bTarget").textContent.trim());
  ok("the practice page's word step shows an End word for End-of-word homework", pw.fR.split(",").includes(onPage), onPage);
  await page.evaluate(() => { localStorage.removeItem(Sona.kkey("sona.homework.v1")); localStorage.removeItem(Sona.kkey("sona.today.v1")); });
}

// ── earned rung feeds the climb: stage.R=2 (words earned) stretches to the
//    rung above, which is now SENTENCES — the phrase rung in between is gone ──
// Pin the round index instead of inheriting whatever the rotation left behind,
// so this proves the CAP and not the test's own ordering.
await page.evaluate(() => {
  const g = Sona.getProgress(); g.stage = g.stage || {}; g.stage.R = 2;
  localStorage.setItem(Sona.kkey("sona.progress.v1"), JSON.stringify(g));
  localStorage.setItem(Sona.kkey("sona.today.v1"), JSON.stringify({ d: Sona.localDay(), n: 3 }));
});
// This checks the practice ladder, so use a free game: the earlier paywall
// checks deliberately leave the paid UI seam enabled in this browser tab.
await page.goto("http://localhost:8131/charge.html?game=arcade-slice.html&sound=R"); await page.waitForTimeout(700);
c = await page.evaluate(() => ({
  t: document.getElementById("bTarget").textContent.trim(),
  syls: (Sona.ladderContent("R", 1) || []).map((x) => x.t),
  words: (Sona.ladderContent("R", 2) || []).map((x) => x.t),
}));
// the sentence set is randomly SAMPLED per call, so it can't be compared
// against a regenerated list — match the frame shape instead
ok("earned words stretches one rung up — straight to a sentence",
  /^(I see|I have|Look at|Here is|I like)\b/.test(c.t) && !c.syls.includes(c.t) && !c.words.includes(c.t),
  JSON.stringify(c));
await page.evaluate(() => localStorage.removeItem(Sona.kkey("sona.today.v1")));
await page.evaluate(() => { const g = Sona.getProgress(); g.stage.R = 0; localStorage.setItem("sona.progress.v1", JSON.stringify(g)); });

// ── ladder v2 migration: stored rungs still mean what they meant ──
// Real children are mid-ladder right now. Removing "phrase" shifts every index
// above it, so this walks the whole old range through a real page load.
{
  const mig = await page.evaluate(() => {
    localStorage.setItem(Sona.kkey("sona.progress.v1"), JSON.stringify({
      stage: { R: 0, S: 1, L: 2, K: 3, G: 4, T: 5 },
      totals: {}, streak: {}, bySound: {}, sessions: [], chests: {}, missed: [],
    }));
    const g = Sona.getProgress();
    const named = {}; Object.keys(g.stage).forEach((k) => { named[k] = Sona.rungName(g.stage[k]); });
    const again = Sona.getProgress();           // must not shift a second time
    return { stage: g.stage, named, flag: g.ladderV, stable: JSON.stringify(again.stage) === JSON.stringify(g.stage) };
  });
  ok("isolation/syllable/word are untouched",
    mig.named.R === "isolation" && mig.named.S === "syllable" && mig.named.L === "word", JSON.stringify(mig.named));
  ok("a child on the old phrase rung lands on word, never higher",
    mig.named.K === "word", JSON.stringify(mig.named));
  ok("a child on sentences stays on sentences", mig.named.G === "sentence", JSON.stringify(mig.named));
  ok("a child on conversation stays on conversation", mig.named.T === "conversation", JSON.stringify(mig.named));
  ok("the migration is flagged and idempotent", mig.flag === 2 && mig.stable, JSON.stringify(mig));
}

// ── TRACK1: the goal beacon fires exactly once, the SLP beacon once per code ──
{
  await page.addInitScript(() => {
    window.__beacons = [];
    navigator.sendBeacon = (url, body) => { try { window.__beacons.push({ url, body: String(body) }); } catch (e) {} return true; };
  });
  await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(600);
  const goal = await page.evaluate(() => {
    window.__beacons.length = 0;
    localStorage.setItem(Sona.kkey("sona.today.v1"), JSON.stringify({ d: Sona.localDay(), n: 0 }));
    for (let i = 0; i < 7; i++) Sona.rotAdvance();     // through the goal and past it
    return window.__beacons.filter((b) => b.url === "/api/track" && /day goal done/.test(b.body));
  });
  ok("day goal done fires exactly once, at the fifth round", goal.length === 1, "fired " + goal.length + "×");
  ok("the goal beacon carries the practiced sound", /"sound":"[A-Z]{1,3}"/.test((goal[0] || {}).body || ""), (goal[0] || {}).body);

  // CODES1: the event means A REAL FAMILY UNLOCKED — a bare unverified code
  // (the old honor system) must fire nothing.
  await page.goto("http://localhost:8131/today.html?slp=RACHEL1"); await page.waitForTimeout(600);
  let slp = await page.evaluate(() => window.__beacons.filter((b) => /slp code redeemed/.test(b.body)));
  ok("a bare unverified code fires NO redemption beacon", slp.length === 0, JSON.stringify(slp));
  // a VERIFIED redemption fires it exactly once
  slp = await page.evaluate(async () => {
    window.__beacons.length = 0;
    const orig = window.fetch;
    window.fetch = async (url, opts) => /\/api\/slp\/redeem/.test(String(url))
      ? new Response(JSON.stringify({ ok: true, valid: true, name: "Rachel" }), { headers: { "Content-Type": "application/json" } })
      : orig(url, opts);
    await Sona.slpRedeem("rachel-k4", "RACHELKEY");
    window.fetch = orig;
    return window.__beacons.filter((b) => /slp code redeemed/.test(b.body));
  });
  ok("a verified redemption fires the beacon once", slp.length === 1 && /RACHEL-K4/.test(slp[0].body), JSON.stringify(slp));
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
