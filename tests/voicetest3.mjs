// Verify: TTS never performs a bare sound; syllable rounds list the set and
// rotate the card. E2E (real page, stubbed mic) asserts the /api/tts body for
// round 1 (isolation) and round 2 (syllables); a same-source harness asserts
// line composition for R/S/SH/THV/word/fail plus card rotation.
// Since 24 Sep 2026 it also pins the calm voice: no "!" in any practice line,
// the praise list, or what Echo says on Home, in setup and in the game picker;
// the trimmed win chimes; and no coach voice labelled "Rachel".
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, OUT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", png: "image/png", css: "text/css" };
let ttsPosts = [];

const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/tts") {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      try { ttsPosts.push(JSON.parse(b).text); } catch (e) {}
      res.writeHead(500); res.end();
    });
    return;
  }
  if (u.pathname === "/sfx-harness") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end('<!doctype html><html><body><script src="/sona.js"></script></body></html>');
    return;
  }
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end(); return; }
  const p = ROOT + (u.pathname === "/" ? "/today.html" : u.pathname);
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  const ext = p.split(".").pop();
  res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8123, r));

// ---- extract the real shipped functions from charge.html ----
const html = readFileSync(ROOT + "/charge.html", "utf8");
const soundNameSrc = html.match(/function soundName\(\)\{.*?\}(?=\n)/s)?.[0];
const sayLineSrc = html.match(/function sayLine\(\)\{[\s\S]*?\n    \}/)?.[0];
const cueShortSrc = html.match(/var CUESHORT=(.*);/)?.[1];
const failTipSrc = html.match(/var tip=(\(c&&c\.tip\?[^\n]*);/)?.[1];
const paintCardSrc = html.match(/function paintCard\(\)\{[\s\S]*?\n    \}/)?.[0];
if (!soundNameSrc || !sayLineSrc || !cueShortSrc || !failTipSrc || !paintCardSrc) {
  console.error("EXTRACT FAIL", { soundNameSrc: !!soundNameSrc, sayLineSrc: !!sayLineSrc, cueShortSrc: !!cueShortSrc, failTipSrc: !!failTipSrc, paintCardSrc: !!paintCardSrc });
  process.exit(1);
}

const browser = await chromium.launch(launchOpts(["--autoplay-policy=no-user-gesture-required"]));
const ctx = await browser.newContext({ permissions: ["microphone"] });
const page = await ctx.newPage();
await page.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = () => Promise.resolve(new MediaStream());
});

let fails = 0;
const ok = (name, got, want) => {
  const pass = got === want;
  if (!pass) fails++;
  console.log((pass ? "PASS" : "FAIL") + "  " + name + (pass ? "" : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`));
};
const noSustained = (name, s) => {
  const pass = !/([a-z])\1\1/i.test(s || "");
  if (!pass) fails++;
  console.log((pass ? "PASS" : "FAIL") + "  no-sustained-run  " + name + (pass ? "" : "  → " + JSON.stringify(s)));
};

// ---- E2E round 1: isolation — human clip 404s → TTS gets the clean line ----
await page.goto("http://localhost:8123/charge.html?sound=R&game=arcade-slice.html");
await page.waitForTimeout(2500);
// Isolation now plays the HUMAN model clip (/coach/say-echo/R.mp3) — the real
// sound, which TTS can't perform. So round 1 posts NO TTS prompt; if the
// headless env can't decode the mp3, the exact TTS fallback line is the
// only acceptable substitute (and noSustained still guards every post).
// CITY1: the house's story beat is spoken FIRST now, so the prompt is not
// necessarily post 0 — pick the prompt out by its shape, same as sylLine below.
const r1prompt = ttsPosts.filter((l) => /^Ready\?/.test(l))[0];
// CALM PROMPT (24 Sep 2026, rewritten deliberately): was "...five times...
// Go!". The voice reads "… Go!" as a jump in pitch and energy. Rewritten
// again the same day: no spoken "Your turn." — it was said into a closed mic,
// before anything could hear the child who obeyed it; the glowing mic hands
// the turn over instead. The mouth cue and the practice word inside it are
// unchanged (Rachel's calls).
const r1ok = !r1prompt || r1prompt === "Ready? Pull your tongue back and up, and make your R sound, five times.";
if (!r1ok) fails++;
console.log((r1ok ? "PASS" : "FAIL") + "  E2E r1 human clip replaces TTS (or exact fallback)  → " + JSON.stringify(r1prompt || "(no TTS prompt — clip played)"));
if (!r1ok) fails++;
// The clip switch is Sona.humanClipsOn() (sona.js), never a local true: the
// page's own default is false and only the shared switch turns it on. Since
// 25 Sep 2026 it is ON and plays /coach/say-echo/ — Rachel's takes re-voiced
// into Echo's voice (storytest pins that the raw /coach/say/ set never plays).
ok("the clip switch is shared, never a local true", /var HUMANCLIPS=false; try\{ HUMANCLIPS=!!\(S&&S\.humanClipsOn&&S\.humanClipsOn\(\)\); \}/.test(html), true);
// Free play names the selected game; the daily header is a visual path.
ok("E2E free-play header names its selected game", await page.evaluate(() => document.getElementById("ctxLine").textContent === "Fruit Slice" && document.querySelectorAll("#ctxLine .path-dot").length === 0), true);

// ---- E2E round 2 of a daily run: syllables — chip label + spoken set ----
ttsPosts = [];
await page.evaluate(() => sessionStorage.setItem("sona.run.v1", JSON.stringify({ active: true, round: 1, sum: 12, scores: [12], sound: "R", level: 1, pending: false, games: ["slice","tiles","stack","run","glide"] })));
await page.goto("http://localhost:8123/charge.html?daily=1&sound=R");
// STORY1: a daily round opens with the spoken episode beat (~3.2s on a bridge
// round) before the practice prompt, so this has to wait past it.
await page.waitForTimeout(6000);
const r2 = await page.evaluate(() => ({
  pathLabel: document.getElementById("ctxLine").getAttribute("aria-label"),
  dots: [...document.querySelectorAll("#ctxLine .path-dot")].map(dot => ({ done:dot.classList.contains("done"), current:dot.classList.contains("current"), icon:dot.querySelector("use")?.getAttribute("href") || null })),
  prompt: document.getElementById("bTarget").textContent,
  sylls: (window.SonaContent && SonaContent.syllables) ? SonaContent.syllables("R").map((s) => s.t) : [],
}));
// the daily run is ROT_LEN (5) rounds — same number the goal ring, the chest
// and today.html's path all count to. A shorter run leaves the ring unfillable.
ok("E2E r2 path exposes round 2 of 5 to assistive technology", r2.pathLabel, "Adventure, round 2 of 5");
ok("E2E r2 path shows one completed game and the current game's icon", r2.dots.length === 5 && r2.dots.filter(dot=>dot.done).length === 1 && r2.dots[0].done && r2.dots.filter(dot=>dot.current).length === 1 && r2.dots[1].current && r2.dots[1].icon === "#st-piano" && r2.dots.slice(2).every(dot=>!dot.done&&!dot.current&&!dot.icon), true);
console.log((r2.sylls.includes(r2.prompt) ? "PASS" : "FAIL") + "  E2E r2 card shows a syllable  (" + r2.prompt + " ∈ " + JSON.stringify(r2.sylls) + ")");
if (!r2.sylls.includes(r2.prompt)) fails++;
// STORY1: a daily round now opens with the episode beat spoken aloud (a
// pre-reader can't read the card), so the PRACTICE prompt is the first line
// matching the prompt grammar — not simply the first thing said.
const sylLine = ttsPosts.filter((l) => /^Ready\?/.test(l))[0] || ttsPosts[0] || "";
// ONE syllable per round now — the card no longer rotates rah→ree→roo mid-round
const sylWant = /^Ready\? Say [a-z]+, five times\.$/; // calm frame, no spoken "Your turn." (24 Sep 2026)
console.log((sylWant.test(sylLine) ? "PASS" : "FAIL") + "  E2E r2 spoken one syllable  → " + JSON.stringify(sylLine));
if (!sylWant.test(sylLine)) fails++;
for (const t of ttsPosts) noSustained("E2E:" + t.slice(0, 24), t);
await page.screenshot({ path: OUT + "/shot-charge-r2.png" });

// ---- same-source harness: lines + fail-coach + card rotation ----
const cases = await page.evaluate(
  ({ soundNameSrc, sayLineSrc, cueShortSrc, failTipSrc, paintCardSrc }) => {
    const S = window.Sona;
    const NUMWORD = { 2: "two", 3: "three", 4: "four", 5: "five", 6: "six" };
    function mk(SOUND, ITEM, NEED, SEQ, ROTATE) {
      const CUETIP = S.cue(SOUND).tip || "";
      const CUESHORT = new Function("CUETIP", "return " + cueShortSrc)(CUETIP);
      const fn = new Function("SOUND", "ITEM", "NEED", "NUMWORD", "CUESHORT", "S", "SEQ", "ROTATE",
        soundNameSrc + "\n" + sayLineSrc + "\nreturn {sayLine:sayLine};");
      return fn(SOUND, ITEM, NEED, NUMWORD, CUESHORT, S, SEQ || [], !!ROTATE);
    }
    const iso = (s) => ({ level: "isolation", t: S.soundSay(s), display: S.soundLabel(s) });
    const out = {};
    let h = mk("R", iso("R"), 5);
    out.rFirst = h.sayLine(); out.rRepeat = h.sayLine();
    h = mk("S", iso("S"), 5);
    out.sFirst = h.sayLine(); out.sRepeat = h.sayLine();
    h = mk("SH", iso("SH"), 5);
    out.shFirst = h.sayLine();
    h = mk("THV", iso("THV"), 5);
    out.thvFirst = h.sayLine();
    h = mk("R", { level: "word", t: "rabbit", display: "rabbit" }, 5);
    out.word = h.sayLine();
    const sq = [{ level: "syllable", t: "rah", display: "rah" }, { level: "syllable", t: "ree", display: "ree" }, { level: "syllable", t: "roo", display: "roo" }];
    h = mk("R", sq[0], 5, sq, true);
    out.sylFirst = h.sayLine(); out.sylRepeat = h.sayLine();
    // fail-coach spoken tip, exactly as shipped
    const failFor = (snd) => {
      const c = S.cue(snd);
      const soundName = () => { let x = String(snd).toUpperCase(); if (x === "THV") x = "TH"; return x.length > 1 ? x.split("").join(" ") : x; };
      const tip = new Function("c", "soundName", "return " + failTipSrc)(c, soundName);
      // 24 Sep 2026: the calm retry line (was "Hmm, that was a different
      // sound! {tip}. Try again!"). Pinned against charge.html's source below.
      return "Let's try that one again. " + tip + ".";
    };
    out.failR = failFor("R"); out.failS = failFor("S"); out.failZ = failFor("Z"); out.failM = failFor("M");
    // card rotation: paintCard with a syllable ITEM must update the bubble target
    const $ = (id) => document.getElementById(id);
    const pc = new Function("ITEM", "SOUND", "S", "$", paintCardSrc + "\npaintCard();");
    pc(sq[1], "R", S, $);
    out.cardPrompt = $("bTarget").textContent;
    pc({ level: "isolation", t: "rrrr", display: "R" }, "R", S, $);
    out.cardIso = $("bTarget").textContent;
    return out;
  },
  { soundNameSrc, sayLineSrc, cueShortSrc, failTipSrc, paintCardSrc }
);

// CALM FRAME (24 Sep 2026, rewritten deliberately from "...five times...
// Go!"): a comma and a full stop. "Your turn." was dropped the same day: Echo
// said it before the mic could hear, so an obedient child answered into
// nothing; the glowing mic, lit only once the window hears, marks the turn.
// The mouth cue (CUES tip, first clause) and the practice word are exactly
// what they were — Rachel's calls.
ok("R first", cases.rFirst, "Ready? Pull your tongue back and up, and make your R sound, five times.");
ok("R repeat", cases.rRepeat, "Ready? Make your R sound, five times.");
ok("S first", cases.sFirst, "Ready? Teeth together, and make your S sound, five times.");
ok("S repeat", cases.sRepeat, "Ready? Make your S sound, five times.");
ok("SH first", cases.shFirst, "Ready? Round your lips and whisper quiet, and make your S H sound, five times.");
ok("THV first", cases.thvFirst, "Ready? Tongue between your teeth and buzz, and make your T H sound, five times.");
ok("word level", cases.word, "Ready? Say rabbit, five times.");
ok("syllable one target", cases.sylFirst, "Ready? Say rah, five times.");
ok("syllable one target repeat", cases.sylRepeat, "Ready? Say rah, five times.");
ok("card flip prompt", cases.cardPrompt, "ree");
// isolation shows the SUSTAINED target on screen (huge, orange) — the
// no-sustained rule below guards SPOKEN lines only, so card* is excluded
ok("card isolation prompt", cases.cardIso, "rrrr");
// The tip text is Rachel's CUES wording, untouched; only the frame is calmer.
ok("fail R", cases.failR, "Let's try that one again. Pull your tongue back and up like a tiger growl.");
ok("fail S", cases.failS, "Let's try that one again. Teeth together, big smile, let the air hiss out.");
ok("fail Z", cases.failZ, "Let's try that one again. Teeth together and buzz like a bee.");
ok("fail M", cases.failM, "Let's try that one again. Lips together and hum.");
ok("charge.html speaks exactly the calm retry line pinned above", /await say\("Let's try that one again\. "\+tip\+"\."\);/.test(html), true);
for (const [k, v] of Object.entries(cases)) if (!/^card/.test(k)) noSustained(k, v);

// ---- CALM, NOT HYPED (24 Sep 2026) ----
// The voice reads "!" as a jump in pitch and energy. Travis heard the result
// as "jumpy and explosive" and asked for "relaxed and sweet, like talking to a
// little kid". So no line Echo SPEAKS in these places may carry a "!".
const noBang = (name, s) => {
  const pass = typeof s === "string" && s.length > 0 && !s.includes("!");
  if (!pass) fails++;
  console.log((pass ? "PASS" : "FAIL") + "  no \"!\"  " + name + (pass ? "" : "  → " + JSON.stringify(s)));
};
for (const [k, v] of Object.entries(cases)) if (!/^card/.test(k)) noBang("practice line " + k, v);
// The praise list, read from the live Sona object, not from a copy.
const praises = await page.evaluate(() => (window.Sona && Sona.PRAISES) ? Sona.PRAISES.slice() : null);
ok("praise is the calm list", JSON.stringify(praises), JSON.stringify(["Nice one.", "Good job.", "I heard that.", "That was lovely.", "Well done."]));
for (const p of praises || []) noBang("praise " + p, p);
ok("praiseLine() only ever returns a calm line", await page.evaluate(() => {
  for (let i = 0; i < 200; i++) { const l = Sona.praiseLine(); if (!Sona.PRAISES.includes(l) || l.includes("!")) return false; }
  return true;
}), true);
// Every string literal Echo is asked to say on Home, in setup and in the game
// picker. Scanned from source so a new spoken line is caught the day it lands;
// each page must yield its known lines, so the scan can never pass empty.
const spokenLiterals = (file) => {
  const src = readFileSync(ROOT + "/" + file, "utf8"), out = [];
  for (const m of src.matchAll(/\b(?:S|Sona)\.speak(?:Now)?\(((?:[^()]|\([^()]*\))*)\)/g)) {
    for (const lit of m[1].matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)) {
      const text = (lit[1] ?? lit[2]).replace(/\\(.)/g, "$1");
      if (text) out.push(text);
    }
  }
  return out;
};
// Home, setup and the library are silent since #140 (Travis, 24 Sep 2026:
// "Setup and menus stay quiet; spoken coaching belongs inside games"), so
// they must speak nothing at all; any line a later change adds there still
// has to be calm.
for (const file of ["today.html", "onboarding.html", "activities.html"]) {
  // speakNow("") is the audio unlock on a tap, not a line.
  const lines = spokenLiterals(file).filter((l) => l.trim());
  ok(file + " speaks no menu lines", JSON.stringify(lines), "[]");
  for (const l of lines) noBang(file + ": " + l, l);
}

// ---- No coach voice is labelled "Rachel" (24 Sep 2026) ----
// ElevenLabs' stock voice of that name sat in Settings → Choose coach voice,
// and Sona's co-founder SLP is Rachel: a parent could think they were hearing
// her. The voice stays (same id, so a family who chose it keeps it); the label
// is one that belongs to nobody at Sona.
{
  const voices = readFileSync(ROOT + "/voices.html", "utf8");
  const names = [...voices.matchAll(/\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)"/g)].map((m) => ({ id: m[1], name: m[2] }));
  ok("the voice picker lists its voices", names.length >= 8, true);
  ok("no coach voice is named Rachel", names.some((v) => /rachel/i.test(v.name)), false);
  ok("the stock voice is still offered under a new label", names.find((v) => v.id === "21m00Tcm4TlvDq8ikWAM")?.name, "Gentle");
}

// ---- Win chimes trimmed (24 Sep 2026) ----
// correct and complete land on the loudest moments, right beside Echo's voice:
// each note is 3 dB down (0.16 -> 0.113 at full volume) and swells in over
// 25 ms instead of snapping in over 15. Durations are unchanged — pages time
// the mic's quiet window after them.
const chimes = await (async () => {
  const c2 = await browser.newContext();
  const p2 = await c2.newPage();
  await p2.addInitScript(() => {
    const log = window.__notes = [];
    const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(v, t) { this.ramps.push([v, t]); }, ramps: [] });
    class Ctx {
      constructor() { this.state = "running"; this.currentTime = 0; this.destination = {}; }
      resume() { return Promise.resolve(); }
      createGain() { const g = { gain: param(), connect() {}, disconnect() {} }; return g; }
      createOscillator() { const o = { type: "", frequency: param(), connect(g) { this.g = g; }, disconnect() {}, start(t) { this.rec = { start: t, ramps: this.g && this.g.gain ? this.g.gain.ramps : [] }; log.push(this.rec); }, stop(t) { if (this.rec) this.rec.stop = t; } }; return o; }
    }
    window.AudioContext = window.webkitAudioContext = Ctx;
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Demo", onboarded: true, volume: 1, soundOn: true, voiceOn: true }));
  });
  await p2.goto("http://localhost:8123/sfx-harness");
  const read = (name) => p2.evaluate((n) => { window.__notes.length = 0; Sona.sfx[n](); return window.__notes.map((x) => ({ start: x.start, peak: x.ramps[0] && x.ramps[0][0], attack: x.ramps[0] && +(x.ramps[0][1] - x.start).toFixed(4), end: x.ramps[1] && +(x.ramps[1][1] - x.start).toFixed(4), stop: x.stop })); }, name);
  const out = { correct: await read("correct"), complete: await read("complete"), tap: await read("tap") };
  await c2.close();
  return out;
})();
for (const name of ["correct", "complete"]) {
  const notes = chimes[name];
  ok(name + ": every note is at or under 0.113 of full volume (3 dB under the old 0.16)", notes.length > 0 && notes.every((n) => n.peak <= 0.1131), true);
  ok(name + ": the main notes are exactly 3 dB down", notes.filter((n) => n.peak > 0.1).every((n) => Math.abs(20 * Math.log10(n.peak / 0.16) + 3) < 0.05), true);
  ok(name + ": every note swells in over 25 ms", notes.every((n) => n.attack === 0.025), true);
}
ok("correct keeps its length (last note ends 0.34 s in)", Math.max(...chimes.correct.map((n) => n.start + n.end)).toFixed(2), "0.34");
ok("complete keeps its length (last note ends 0.56 s in)", Math.max(...chimes.complete.map((n) => n.start + n.end)).toFixed(2), "0.56");
ok("the counted-try tap is untouched (15 ms attack)", chimes.tap.length === 2 && chimes.tap.every((n) => n.attack === 0.015), true);
// Sona must never hear its own chime as the child. The practice screen keeps
// the mic closed until a chime has finished (SFX_MS says how long each one
// rings, then ECHO_TAIL_MS) — so every chime must have fully stopped inside
// the time the page thinks it lasts.
// REWRITTEN 24 Sep 2026: this also pinned TAP_CHIME_MS, the deaf window after
// the chime that marked each counted try inside the open mic. That chime is
// gone — a counted try is seen, not heard — so the pin is now that no chime
// is played while the mic is listening at all: nothing in countRep sounds.
{
  const tapMs = +(html.match(/SFX_MS=\{[^}]*tap:(\d+)/)?.[1] || NaN);
  const winMs = +(html.match(/SFX_MS=\{[^}]*complete:(\d+)/)?.[1] || NaN);
  const lastStop = (notes) => Math.max(...notes.map((n) => n.stop)) * 1000;
  ok("charge.html declares how long its chimes ring", Number.isFinite(tapMs) && Number.isFinite(winMs), true);
  ok("the tap chime is silent before its window ends (" + lastStop(chimes.tap).toFixed(0) + " ms ≤ " + tapMs + " ms)", lastStop(chimes.tap) <= tapMs, true);
  ok("the win chime is silent before its window ends (" + lastStop(chimes.complete).toFixed(0) + " ms ≤ " + winMs + " ms)", lastStop(chimes.complete) <= winMs, true);
  const countRep = html.match(/function countRep\(now\)\{[\s\S]*?\n            \}/)?.[0] || "";
  ok("a counted try makes no sound into the open mic (no chime in countRep)", !!countRep && !/sfx|Chime|S\.sfx/.test(countRep.replace(/\/\/[^\n]*/g, "")), true);
  ok("the counted-try chime guard is gone", !/TAP_CHIME_MS|chimeUntil|tryChime/.test(html), true);
}

await browser.close();
srv.close();
console.log(fails ? `\n${fails} FAILURES` : "\nALL GREEN");
process.exit(fails ? 1 : 0);
