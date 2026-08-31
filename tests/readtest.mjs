// Readers must NEVER be silent — and never WEDGE.
//
// Round one (library.html): no browser-voice fallback, so a dead /api/tts
// silenced the books. Pinned below with a 500ing TTS.
//
// Round two (chapter.html, story.html): each page carried its own COPY of the
// speech path, without library's cure. Two unbounded hangs — a TTS fetch with
// no timeout, and a PCM promise that only resolved from source.onended, which
// never fires on a suspended iOS AudioContext. One stuck call pinned the
// page's depth-capped say-queue, after which every tap of "Read it to me" was
// dropped with no sound and no error. That is the field bug ("I press the
// button and it doesn't do it"), and it is why the pipeline now lives ONCE in
// sona.js (SPEAK1): every unit bounded, and the button superseding the queue.
// These tests run a TTS that HANGS — accepts the request and never answers —
// and a context that will not run, the two real shapes of the failure.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png" };
// dead → 500 now. hang → never answer (the wedge). pcm → 200 with real bytes.
let ttsMode = "dead";
const held = [];
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/tts") {
    if (ttsMode === "hang") { held.push(res); return; }   // the socket just sits
    if (ttsMode === "pcm") {
      const b = Buffer.alloc(9600);                        // 0.2s of silence @24k s16le
      res.writeHead(200, { "content-type": "application/octet-stream" });
      res.end(b);
      return;
    }
    res.writeHead(500); res.end("{}"); return;
  }
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8153, r));

const browser = await chromium.launch(launchOpts(["--autoplay-policy=no-user-gesture-required"]));
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

// every page records browser-voice utterances in __spoke, so "sound was
// attempted" is observable; the profile is entitled (earlyAdopter) so
// story.html's gate does not bounce the harness to the paywall
const seed = () => {
  window.__spoke = [];
  try {
    window.speechSynthesis.speak = (u) => { window.__spoke.push(u.text); try { u.onend && setTimeout(u.onend, 10); } catch (e) {} };
  } catch (e) {}
  localStorage.setItem("sona.freeera.v1", "post");
  localStorage.setItem("sona.freeera2.v1", "done");
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true }));
};
async function mkPage(extraInit) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.addInitScript(seed);
  if (extraInit) await pg.addInitScript(extraInit);
  return { ctx, pg, errs };
}
// poll instead of a flat wait: the abort bound is 7s, so a pass lands late
// and a hard sleep would make every run worst-case
async function waitSpoke(pg, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const n = await pg.evaluate(() => window.__spoke.length);
    if (n > 0) return pg.evaluate(() => window.__spoke.slice());
    await pg.waitForTimeout(250);
  }
  return [];
}

// ── source contracts ──
// The cure must EXIST, and it must exist ONCE. chapter/story regrowing a
// private copy is exactly how this bug shipped the second time.
{
  const noComments = (s) => s.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  ok("sona.js speech pipeline bounds the TTS fetch", /AbortController/.test(sona) && /7000/.test(sona),
    "a hung fetch wedges the say-queue for the life of the page");
  ok("…refuses PCM on a context that will not run", /state !== "running"/.test(sona),
    "a source scheduled on a suspended iOS context never fires onended");
  ok("…and keeps a watchdog on every started source", /duration \* 1000\) \+ 1500/.test(sona));
  for (const f of ["chapter.html", "story.html"]) {
    const src = noComments(readFileSync(ROOT + "/" + f, "utf8"));
    ok(f + " has no private speech pipeline", !/playPCM|speakFallback|api\/tts/.test(src),
      "the page must call Sona.speak/speakNow — a second copy is how the cure missed this page last time");
  }
  const lib = readFileSync(ROOT + "/library.html", "utf8");
  ok("library has a browser-voice fallback", /function speakFallback/.test(lib),
    "without it a dead /api/tts leaves the books silent");
  ok("library's TTS fetch can't hang forever", /AbortController/.test(lib),
    "a hung fetch leaves `playing` true and kills the Hear button for the session");
}

// ── library: open a book and press "Hear it" with TTS dead ──
{
  ttsMode = "dead";
  const { ctx, pg, errs } = await mkPage();
  await pg.goto("http://localhost:8153/library.html");
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => document.querySelector("#shelf .bookBtn").click());
  await pg.waitForTimeout(600);
  await pg.evaluate(() => document.getElementById("bkNext").click());   // cover → page 1
  await pg.waitForTimeout(500);
  await pg.evaluate(() => document.getElementById("bkHear").click());
  let spoke = await waitSpoke(pg, 4000);
  ok("'Hear it' speaks even when /api/tts is dead", spoke.length > 0, "nothing was spoken");

  // and the SECOND press must work too (no stuck `playing` flag).
  // waitSpoke returns the moment the utterance is PUSHED, which can be before
  // its onend releases `playing` — give that 10ms callback room to run, or
  // this presses while the first speak is still officially in flight.
  await pg.waitForTimeout(300);
  await pg.evaluate(() => { window.__spoke.length = 0; });
  await pg.evaluate(() => document.getElementById("bkHear").click());
  spoke = await waitSpoke(pg, 4000);
  ok("'Hear it' still works on a second press", spoke.length > 0, "the `playing` flag stuck true after the first failure");
  ok("no pageerrors on library.html", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// ── chapter: a HUNG TTS cannot wedge "Read it to me" ──
// The auto-read is already stuck in the hung fetch when the child taps. The
// old pipeline dropped the tap at the depth cap — silence, forever. Now the
// tap supersedes, its own fetch aborts at 7s, and the browser voice carries it.
{
  ttsMode = "hang";
  const { ctx, pg, errs } = await mkPage();
  await pg.goto("http://localhost:8153/chapter.html");
  await pg.waitForTimeout(1500);   // auto-read is now wedged in the hung fetch
  const want = await pg.evaluate(() => PAGES[i]);
  await pg.evaluate(() => document.getElementById("hear").click());
  const spoke = await waitSpoke(pg, 10000);
  ok("chapter: the tap still speaks while a TTS request hangs", spoke.length > 0,
    "the queue wedged — the exact field bug");
  ok("…and it reads THIS page", spoke[0] === want, JSON.stringify({ spoke: spoke[0], want }));
  ok("no pageerrors on chapter.html", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// ── story: boot, then the button, twice, under the same hung TTS ──
// This page also PARSED to nothing for a while (top-level await), so the
// pageerror assertion here is load-bearing, not hygiene.
{
  const { ctx, pg, errs } = await mkPage();
  await pg.goto("http://localhost:8153/story.html");
  await pg.waitForTimeout(1500);   // /api/story 500s fast → built-in pages
  const started = await pg.evaluate(() => {
    const b = document.getElementById("startBtn");
    if (!b || document.getElementById("start").style.display === "none") return false;
    b.click(); return true;
  });
  ok("story boots to its start button with every API down", started, "start overlay never appeared");
  await pg.waitForTimeout(800);    // readPage() is now wedged in the hung fetch
  const want = await pg.evaluate(() => { const p = PAGES[pi]; return p.text.replace("___", p.word); });
  await pg.evaluate(() => document.getElementById("hear").click());
  let spoke = await waitSpoke(pg, 10000);
  ok("story: the tap still speaks while a TTS request hangs", spoke.length > 0, "the queue wedged");
  ok("…and it reads THIS page", spoke[0] === want, JSON.stringify({ spoke: spoke[0], want }));

  // a second tap supersedes the first — speakNow must reset its own state
  await pg.evaluate(() => { window.__spoke.length = 0; });
  await pg.evaluate(() => document.getElementById("hear").click());
  spoke = await waitSpoke(pg, 10000);
  ok("story: the button works a second time", spoke.length > 0,
    "speakNow left the queue counted-full — taps are being dropped again");
  ok("no pageerrors on story.html", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// ── a context that will not run: PCM is refused, the browser voice carries ──
// TTS SUCCEEDS here. The old bug was exactly this shape: bytes arrive, the
// suspended context schedules them, onended never fires, the queue is dead.
{
  ttsMode = "pcm";
  const { ctx, pg, errs } = await mkPage(() => {
    const RealAC = window.AudioContext || window.webkitAudioContext;
    const Fake = function () {
      const c = new RealAC();
      Object.defineProperty(c, "state", { get: () => "suspended" });
      c.resume = () => Promise.resolve();
      return c;
    };
    window.AudioContext = Fake; window.webkitAudioContext = Fake;
  });
  await pg.goto("http://localhost:8153/chapter.html");
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => document.getElementById("hear").click());
  const spoke = await waitSpoke(pg, 5000);
  ok("PCM on a suspended context falls through to the browser voice", spoke.length > 0,
    "the source was scheduled on a context that will never play it — the silent wedge");
  ok("no pageerrors under the suspended context", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

await browser.close();
for (const r of held) { try { r.socket.destroy(); } catch (e) {} }
srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
