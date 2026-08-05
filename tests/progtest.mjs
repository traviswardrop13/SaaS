// Progression: sound rotation (one letter per 5-round pass), per-round ladder
// climb capped at earned+1, daily-goal ring on Today, charge round label,
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
  if (!localStorage.getItem("sona.profile.v1")) localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R", "S"] }));
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
  && /Math\.min\(ROUNDIX\+1,_goal\)/.test(chargeSrc));
ok('pulse placeholder drops "complaint"', !/complaint/i.test(todaySrc));

// ── today.html: fresh day, ring empty, rotation letter = R ──
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(700);
let t = await page.evaluate(() => ({
  ring: document.getElementById("ringTxt").textContent,
  sub: document.getElementById("subLine").textContent,
  sound: Sona.rotSound(), round: Sona.rotRound(),
  ph: (document.getElementById("pulseText") || {}).placeholder || "",
}));
ok("rep pill starts at 0", t.ring === "0");
ok("subLine invites the R sound", /your R sound/.test(t.sub));
ok("rotation starts R round 0", t.sound === "R" && t.round === 0);

// ── the home deck: hero + two up-next, and the rotation behind it ──
const DECK = () => ({
  ps: Sona.pathState(),
  hero: document.getElementById("heroName").textContent,
  launch: document.getElementById("goBtn").dataset.launch,
  thumbs: [...document.querySelectorAll("#thumbs .thumb")].map((t) => t.dataset.key),
});
let pp = await page.evaluate(DECK);
ok("deck: hero card is named and opens a door", pp.hero.length > 3 && !!pp.launch, JSON.stringify(pp));
ok("deck: two up-next cards, both different from each other", pp.thumbs.length === 2 && pp.thumbs[0] !== pp.thumbs[1], JSON.stringify(pp.thumbs));
ok("deck: fresh family starts at step 0", pp.ps.steps === 0, JSON.stringify(pp.ps));

// ── charge free play: round 1 = isolation, header context line ──
// (Workstream A: the bubble target is the SUSTAINED sound — "rrrr", not
// "your R sound" — and round context lives in the header #ctxLine.)
await page.goto("http://localhost:8131/charge.html?game=arcade-slice.html"); await page.waitForTimeout(700);
let c = await page.evaluate(() => ({ prompt: document.getElementById("bTarget").textContent, lbl: document.getElementById("ctxLine").textContent }));
ok("round 1 practices isolation", /^r+$/i.test(c.prompt.trim()), c.prompt);
ok('header "Round 1 of 5 · R sound"', /Round 1 of 5/.test(c.lbl) && /R sound/.test(c.lbl), c.lbl);

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
ok('header "Round 2 of 5"', /Round 2 of 5/.test(c.lbl), c.lbl);

// ── rounds 3-4 stay CAPPED at syllables while the rung is unearned ──
await page.evaluate(() => { Sona.rotAdvance(); Sona.rotAdvance(); });
await page.goto("http://localhost:8131/charge.html?game=arcade-run.html"); await page.waitForTimeout(700);
c = await page.evaluate(() => document.getElementById("bTarget").textContent);
ok("round 4 capped at earned+1 (still syllables)", /^r(ah|ee|oo|oh|ay)$/i.test(c.trim()));


// ── rep pill mid-day: the number the kid watches only climbs (RING1) ──
await page.evaluate(() => Sona.bumpReps(12));
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(700);
t = await page.evaluate(() => ({ ring: document.getElementById("ringTxt").textContent, sub: document.getElementById("subLine").textContent }));
ok("rep pill shows today's reps climbing", t.ring === "12", t.ring);
ok("subLine counts down the goal", /2 more rounds/.test(t.sub));
pp = await page.evaluate(DECK);
ok("deck: steps track the rotation", pp.ps.steps === 3, JSON.stringify(pp.ps));
ok("deck: mid-day still offers the whole deck", pp.thumbs.length === 2 && !!pp.launch, JSON.stringify(pp));
await page.evaluate(() => document.getElementById("ringBtn").click());
let toast = await page.evaluate(() => document.getElementById("toast").textContent);
ok("pill tap explains reps + rounds honestly", /12 reps today/.test(toast) && /3 of 5 rounds done/.test(toast) && /R sound/.test(toast));
await page.screenshot({ path: OUT + "/prog-ring-mid.png" });

// ── finish the rotation: 5 rounds → next letter S, ring goes gold ──
await page.evaluate(() => { Sona.rotAdvance(); Sona.rotAdvance(); });
t = await page.evaluate(() => ({ sound: Sona.rotSound(), round: Sona.rotRound(), ring: Sona.todayRing() }));
ok("rotation flips to S at 5 rounds", t.sound === "S" && t.round === 0);
ok("todayRing done at 5", t.ring.n === 5 && t.ring.done === true);
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(700);
t = await page.evaluate(() => ({
  ring: document.getElementById("ringTxt").textContent,
  gold: document.getElementById("ringBtn").className.includes("gold"),
  sub: document.getElementById("subLine").textContent,
}));
ok("rep pill goes gold when the day is done", t.gold === true && /^\d+$/.test(t.ring));
ok("subLine celebrates the goal with the tomorrow-hook", /All done today/.test(t.sub) && /tomorrow/.test(t.sub));
pp = await page.evaluate(DECK);
ok("deck: full day = five rotation steps", pp.ps.steps === 5, JSON.stringify(pp.ps));

await page.screenshot({ path: OUT + "/prog-ring-done.png" });

// ── bonus rounds practice the NEXT letter from isolation ──
await page.goto("http://localhost:8131/charge.html?game=arcade-glide.html"); await page.waitForTimeout(700);
c = await page.evaluate(() => ({ prompt: document.getElementById("bTarget").textContent, lbl: document.getElementById("ctxLine").textContent }));
ok("next rotation practices the S sound", /^s+$/i.test(c.prompt.trim()), c.prompt);
ok("charge header flips to bonus", /Goal done — bonus round!/.test(c.lbl), c.lbl);

// ── Echo's voice never counts as reps; no prices on the kid's home ──
ok("engine ignores mic while ANY app audio plays", /if\(speaking\|\|ttsPlaying\)\{ silent\+\+; voiced=0; inBurst=false;/.test(chargeSrc));
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
ok("Echo's thinking state while the scorer runs", /Echo's thinking…/.test(chargeSrc) && /leo\.think\{animation:think/.test(chargeSrc.replace(/#/g, "")));
ok("step-down retry offers an easier same-sound target", /Let's try something easier/.test(chargeSrc) && /ladderContent\(SOUND,useRung-1\)/.test(chargeSrc));

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
t = await page.evaluate(() => ({ ring: document.getElementById("ringTxt").textContent, api: Sona.todayRing() }));
ok("stale day → rep pill and rounds reset to 0", t.ring === "0" && t.api.n === 0 && !t.api.done);

// ── done state carries the tomorrow-hook (forward pull, no breakable number) ──
await page.evaluate(() => {
  const d = new Date(); const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  localStorage.setItem("sona.today.v1", JSON.stringify({ d: iso, n: 5 }));
});
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(600);
t = await page.evaluate(() => ({ sub: document.getElementById("subLine").textContent, gold: document.getElementById("ringBtn").className.includes("gold") }));
ok("ring done → tomorrow-hook line + gold pill", /tomorrow/.test(t.sub) && t.gold === true);
await page.evaluate(() => localStorage.removeItem("sona.today.v1"));

// ── comeback greeting: 3+ idle days → numberless "Echo missed you", once/day ──
await page.evaluate(() => {
  const g = Sona.getProgress(); g.practiceDays = { "2026-06-30": 1 }; g.streak = { lastDate: "2026-06-30", count: 1 };
  localStorage.setItem("sona.progress.v1", JSON.stringify(g));
  localStorage.removeItem("sona.comeback.v1");
});
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(700);
let cb = await page.evaluate(() => ({
  shown: document.getElementById("cbOvl").classList.contains("show"),
  txt: document.getElementById("cbOvl").textContent,
}));
ok("comeback greeting shows after 3+ days away", cb.shown);
ok("comeback is numberless (no day counts)", !/\d/.test(cb.txt.replace(/Let's play!/, "")));
await page.evaluate(() => document.getElementById("cbBtn").click());
cb = await page.evaluate(() => document.getElementById("cbOvl").classList.contains("show"));
ok("Let's play dismisses it", !cb);
await page.goto("http://localhost:8131/today.html"); await page.waitForTimeout(600);
cb = await page.evaluate(() => document.getElementById("cbOvl").classList.contains("show"));
ok("shows at most once per day", !cb);

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
ok("primer explains listening honestly", /only during practice/.test(mp.txt) && /doesn't keep them/.test(mp.txt) && /nothing is recorded/.test(mp.txt));
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
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("NotAllowedError"));
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
    "onboarding.html", "subscribe.html", "check.html", "for-slps.html", "slp.html",
    "slp-login.html", "settings.html", "voices.html", "progress.html", "trial.html",
    "pilot.html", "privacy.html", "founders.html", "founding.html", "model.html", "join.html",
    // experimental HeyGen live-avatar pages — orphaned (nothing links to them),
    // load a remote SDK, gated/removed before any kid-flow release (F4 review).
    "coach.html", "avatar.html",
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
  localStorage.removeItem("sona.slp");
  const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.earlyAdopter = false; delete p.slpCode;
  localStorage.setItem("sona.profile.v1", JSON.stringify(p));
  sessionStorage.setItem("sona.gate.v1", String(Date.now()));
});
await page.goto("http://localhost:8131/subscribe.html?paid=1"); await page.waitForTimeout(700);
t = await page.evaluate(() => ({
  pick: document.getElementById("pickCard").style.display,
  founding: document.getElementById("foundingCard").style.display,
  life: document.getElementById("planLife").textContent,
  cards: document.querySelectorAll("#pickCard .plan").length,
}));
ok("unpaid family sees the yearly card first ($59.99/yr, best value)",
  t.pick === "block" && t.founding === "none" && /59\.99/.test(t.life) && /\/yr|per year|yearly/i.test(t.life));
// PRICE2: exactly TWO offers — yearly (trialed) and monthly (no trial).
// A third card is a retired tier creeping back.
ok("TWO offers exactly — yearly + monthly, nothing retired", t.cards === 2, "cards=" + t.cards);
// the trial is the YEARLY plan's perk: stated with the cancel promise beside
// it, and never promised on the monthly card
ok("yearly card states the 3-day trial and the cancel promise",
  /3 days free/i.test(t.life) && /cancel anytime/i.test(t.life));
t = await page.evaluate(() => (document.getElementById("planMonth") || {}).textContent || "");
ok("monthly card is honest: $9.99, billed today, no trial",
  /9\.99/.test(t) && /billed today, no trial/i.test(t));
// paywall trust: named-SLP proof strip above the plan
t = await page.evaluate(() => (document.querySelector("#pickCard .proof") || {}).textContent || "");
ok("proof strip: named SLP credential above the plan",
  /Rachel/.test(t) && /speech-language pathologist/.test(t));
// ── practice volume: weekly reps + percentile chip (volume only, cohort-gated) ──
{
  const iso = new Date().toISOString().slice(0, 10);
  await page.evaluate((d) => {
    sessionStorage.setItem("sona.gate.v1", String(Date.now()));
    const out = { R: { days: {} } }; out.R.days[d] = { a: 30, p: 24 };
    localStorage.setItem("sona.outcomes.v1", JSON.stringify(out));
    localStorage.removeItem("sona.repsync.v1");
  }, iso);
  repsPosts = []; repsQuery = { cohort: 40, pct: 80, nextPct: 90, nextReps: 12 };
  await page.goto("http://localhost:8131/progress.html"); await page.waitForTimeout(900);
  t = await page.evaluate(() => ({
    reps: document.getElementById("volReps").textContent,
    chip: document.getElementById("volChip").textContent,
    chipShown: document.getElementById("volChip").style.display,
    next: document.getElementById("volNext").textContent,
  }));
  ok("volume card shows the week's honest reps", t.reps === "30");
  ok("percentile chip: top % + out-practicing framing", t.chipShown === "block" && /Top 20%/.test(t.chip) && /80%/.test(t.chip));
  ok("bump line names the reps to the next decile", /12 more reps/.test(t.next) && /top 10%/.test(t.next));
  ok("beacon posted anonymous volume", repsPosts.length >= 1 && repsPosts[0].reps === 30 && /^f[a-z0-9]+/.test(repsPosts[0].fid) && /^\d{4}-W\d{2}$/.test(repsPosts[0].week));
  // tiny cohort → no percentile theater
  repsQuery = { cohort: 7, pct: 80, nextPct: 90, nextReps: 3 };
  await page.goto("http://localhost:8131/progress.html"); await page.waitForTimeout(900);
  t = await page.evaluate(() => document.getElementById("volChip").style.display);
  ok("percentile hides under 20 reporting families", t !== "block");
  await page.evaluate(() => { localStorage.removeItem("sona.outcomes.v1"); localStorage.removeItem("sona.repsync.v1"); });
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
    const out = {}; out.R = { days: {} }; out.R.days[d] = { a: 24, p: 20 };
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
  ok("report opens with a narrative sentence (name + sound + count)", /practiced the R sound 24 times this week/.test(t.story));
  ok("non-clinical hedge present", t.hedge);
  ok("review pre-gate shows after real value, Bear-style fork",
    t.rate === "block" && /action=write-review/.test(t.yesHref) && /^mailto:/.test(t.noHref));
  await page.evaluate(() => document.getElementById("rateX").click());
  await page.goto("http://localhost:8131/progress.html"); await page.waitForTimeout(700);
  t = await page.evaluate(() => document.getElementById("rateCard").style.display);
  ok("dismissed pre-gate stays quiet on the next visit (60d cooldown)", t !== "block");
  await page.evaluate(() => { localStorage.removeItem("sona.outcomes.v1"); localStorage.removeItem("sona.rateask.v1"); });
}

// founding family keeps the free story
await page.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.earlyAdopter = true; localStorage.setItem("sona.profile.v1", JSON.stringify(p)); });
await page.goto("http://localhost:8131/subscribe.html?paid=1"); await page.waitForTimeout(700);
t = await page.evaluate(() => ({ pick: document.getElementById("pickCard").style.display, founding: document.getElementById("foundingCard").style.display }));
ok("founding family keeps the free story", t.pick !== "block" && t.founding !== "none");

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
  ok("the header counts the same rounds the ladder does",
    /Round 1 of/.test(climb[0].hdr) && /Round 2 of/.test(climb[1].hdr) && /Round 3 of/.test(climb[2].hdr),
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

// ── earned rung feeds the climb: stage.R=2 (words earned) stretches to the
//    rung above, which is now SENTENCES — the phrase rung in between is gone ──
// Pin the round index instead of inheriting whatever the rotation left behind,
// so this proves the CAP and not the test's own ordering.
await page.evaluate(() => {
  const g = Sona.getProgress(); g.stage = g.stage || {}; g.stage.R = 2;
  localStorage.setItem(Sona.kkey("sona.progress.v1"), JSON.stringify(g));
  localStorage.setItem(Sona.kkey("sona.today.v1"), JSON.stringify({ d: Sona.localDay(), n: 3 }));
});
await page.goto("http://localhost:8131/charge.html?game=arcade-run.html&sound=R"); await page.waitForTimeout(700);
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
