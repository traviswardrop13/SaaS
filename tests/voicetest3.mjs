// Verify: TTS never performs a bare sound; syllable rounds list the set and
// rotate the card. E2E (real page, stubbed mic) asserts the /api/tts body for
// round 1 (isolation) and round 2 (syllables); a same-source harness asserts
// line composition for R/S/SH/THV/word/fail plus card rotation.
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
// Isolation now plays the HUMAN model clip (/coach/say/R.mp3) — the real
// sound, which TTS can't perform. So round 1 posts NO TTS prompt; if the
// headless env can't decode the mp3, the exact TTS fallback line is the
// only acceptable substitute (and noSustained still guards every post).
const r1ok = ttsPosts.length === 0 || ttsPosts[0] === "Ready? Pull your tongue back and up, and make your R sound... five times... Go!";
console.log((r1ok ? "PASS" : "FAIL") + "  E2E r1 human clip replaces TTS (or exact fallback)  → " + JSON.stringify(ttsPosts[0] || "(no TTS — clip played)"));
if (!r1ok) fails++;
ok("human model clips enabled in source", /var HUMANCLIPS=true/.test(html), true);
// Workstream A: the sound chip is gone — the header context line carries the sound
ok("E2E r1 header names the sound", await page.evaluate(() => /R sound/.test(document.getElementById("ctxLine").textContent)), true);

// ---- E2E round 2 of a daily run: syllables — chip label + spoken set ----
ttsPosts = [];
await page.evaluate(() => sessionStorage.setItem("sona.run.v1", JSON.stringify({ active: true, round: 1, sum: 12, scores: [12], sound: "R", level: 1, pending: false })));
await page.goto("http://localhost:8123/charge.html?daily=1&sound=R");
await page.waitForTimeout(2500);
const r2 = await page.evaluate(() => ({
  chip: document.getElementById("ctxLine").textContent,
  prompt: document.getElementById("bTarget").textContent,
  sylls: (window.SonaContent && SonaContent.syllables) ? SonaContent.syllables("R").map((s) => s.t) : [],
}));
ok("E2E r2 header (daily round 2)", /Round 2 of 4/.test(r2.chip) && /R sound/.test(r2.chip), true);
console.log((r2.sylls.includes(r2.prompt) ? "PASS" : "FAIL") + "  E2E r2 card shows a syllable  (" + r2.prompt + " ∈ " + JSON.stringify(r2.sylls) + ")");
if (!r2.sylls.includes(r2.prompt)) fails++;
const sylLine = ttsPosts[0] || "";
// ONE syllable per round now — the card no longer rotates rah→ree→roo mid-round
const sylWant = /^Ready\? Say [a-z]+\.\.\. five times\.\.\. Go!$/;
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
      return "Hmm, that was a different sound! " + tip + ". Try again!";
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

ok("R first", cases.rFirst, "Ready? Pull your tongue back and up, and make your R sound... five times... Go!");
ok("R repeat", cases.rRepeat, "Ready? Make your R sound... five times... Go!");
ok("S first", cases.sFirst, "Ready? Teeth together, and make your S sound... five times... Go!");
ok("S repeat", cases.sRepeat, "Ready? Make your S sound... five times... Go!");
ok("SH first", cases.shFirst, "Ready? Round your lips and whisper quiet, and make your S H sound... five times... Go!");
ok("THV first", cases.thvFirst, "Ready? Tongue between your teeth and buzz, and make your T H sound... five times... Go!");
ok("word level", cases.word, "Ready? Say rabbit... five times... Go!");
ok("syllable one target", cases.sylFirst, "Ready? Say rah... five times... Go!");
ok("syllable one target repeat", cases.sylRepeat, "Ready? Say rah... five times... Go!");
ok("card flip prompt", cases.cardPrompt, "ree");
// isolation shows the SUSTAINED target on screen (huge, orange) — the
// no-sustained rule below guards SPOKEN lines only, so card* is excluded
ok("card isolation prompt", cases.cardIso, "rrrr");
ok("fail R", cases.failR, "Hmm, that was a different sound! Pull your tongue back and up like a tiger growl. Try again!");
ok("fail S", cases.failS, "Hmm, that was a different sound! Teeth together, big smile, let the air hiss out. Try again!");
ok("fail Z", cases.failZ, "Hmm, that was a different sound! Teeth together and buzz like a bee. Try again!");
ok("fail M", cases.failM, "Hmm, that was a different sound! Lips together and hum. Try again!");
for (const [k, v] of Object.entries(cases)) if (!/^card/.test(k)) noSustained(k, v);

await browser.close();
srv.close();
console.log(fails ? `\n${fails} FAILURES` : "\nALL GREEN");
process.exit(fails ? 1 : 0);
