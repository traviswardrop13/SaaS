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

// ── the first fuller book (26 Sep 2026): Rory and the Rainbow ──
// Travis: "start with a good solid book with the letter R as the focus", then
// better pictures for it. It leads the R shelf, runs twelve pages, and every
// page is a drawn scene that actually loads: a broken image in a picture book
// is a blank page.
{
  ttsMode = "dead";
  const { ctx, pg, errs } = await mkPage();
  await pg.goto("http://localhost:8153/library.html");
  await pg.waitForTimeout(800);
  const first = await pg.evaluate(() => (document.querySelector("#shelf .bookBtn .bt") || {}).textContent);
  ok("the R shelf opens with Rory and the Rainbow", first === "Rory and the Rainbow", first);
  await pg.evaluate(() => document.querySelector("#shelf .bookBtn").click());
  const loaded = (sel) => pg.waitForFunction((s) => { const i = document.querySelector(s); return !!(i && i.complete && i.naturalWidth > 0); }, sel, { timeout: 4000 }).then(() => true, () => false);
  ok("…its cover is the drawn cover", await loaded("#bkStage img.bkcover"));
  const pages = [];
  for (let i = 0; i < 12; i++) {
    await pg.evaluate(() => document.getElementById("bkNext").click());
    const art = await loaded("#bkStage .bkart.scene img");
    pages.push(await pg.evaluate((art) => ({
      art, alt: !!(document.querySelector("#bkStage .bkart.scene img") || {}).alt,
      text: ((document.querySelector("#bkStage .bktext") || {}).textContent || "").trim(),
      tint: [...document.querySelectorAll("#bkStage .bktext b")].map((b) => b.textContent).join(""),
    }), art));
  }
  ok("…twelve pages, every one a drawn scene that loads, with words for a screen reader",
    pages.length === 12 && pages.every((p) => p.art && p.alt && p.text), JSON.stringify(pages.filter((p) => !p.art || !p.alt || !p.text)));
  ok("…and only the R that starts each practice word is tinted (Rory's second r is not)",
    pages[0].text === "Rain taps on the roof. Rory the rabbit looks up." && pages[0].tint === "RrRr", JSON.stringify(pages[0]));
  await pg.evaluate(() => document.getElementById("bkNext").click());
  await pg.waitForTimeout(200);
  ok("…and ends on The End", /The End!/.test(await pg.evaluate(() => document.getElementById("bkStage").textContent)));
  ok("no pageerrors reading Rory and the Rainbow", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

// ── every fuller book practises its sound in the one spot it says it does ──
// Travis: "do one for each letter". Each twelve-page book puts its sound at the
// start of a word, before a vowel, on every page, and nowhere else: not mid-word,
// not at the end, not in a blend, so every time the child hears the sound it is
// the one being practised. Spelling can't check that ("the" has no T sound,
// "says" ends in Z), so the words were checked against a pronouncing dictionary
// when the books were written, and this re-checks every line against those
// entries (tests/booklex.json). A word edited in later that the lexicon has never
// seen fails here until someone looks up how it sounds.
{
  const LEX = JSON.parse(readFileSync(new URL("./booklex.json", import.meta.url), "utf8"));
  const TARGET = { R: "R", P: "P", B: "B", M: "M", N: "N", T: "T", D: "D", K: "K", G: "G", F: "F", V: "V",
    S: "S", Z: "Z", SH: "SH", CH: "CH", J: "JH", L: "L", TH: "TH", THV: "DH" };
  const VOWEL = /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)$/;
  const phones = (w) => LEX[w].split(" ").map((x) => x.replace(/\d/, ""));
  const toks = (t) => t.split(/[^A-Za-z']+/).map((w) => w.replace(/^'+|'+$/g, "").toLowerCase()).filter(Boolean);
  const { ctx, pg, errs } = await mkPage(() => {
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "7", focusSounds: [], onboarded: true, earlyAdopter: true }));
  });
  await pg.goto("http://localhost:8153/library.html");
  await pg.waitForTimeout(800);
  const books = await pg.evaluate(() => STORIES.filter((b) => b.words).map((b) => ({ sound: b.sound, title: b.title,
    words: b.words, allow: b.allow || [], forbid: b.forbid || [], pages: b.pages.map((p) => p.t) })));
  const have = new Set(books.map((b) => b.sound));
  ok("there is a fuller book for every one of the 19 sounds", Object.keys(TARGET).every((s) => have.has(s)),
    Object.keys(TARGET).filter((s) => !have.has(s)).join(" "));
  const probs = [];
  for (const b of books) {
    const tp = TARGET[b.sound];
    if (b.pages.length !== 12) probs.push(`${b.title}: ${b.pages.length} pages`);
    for (const w of b.words) {
      const ph = w in LEX ? phones(w) : [];
      if (ph[0] !== tp || !VOWEL.test(ph[1] || "")) probs.push(`${b.title}: "${w}" is a practice word that doesn't start with ${b.sound} and a vowel`);
    }
    [b.title, ...b.pages].forEach((line, i) => {
      const ws = toks(line);
      if (i > 0 && !ws.some((w) => b.words.includes(w))) probs.push(`${b.title} p${i}: no practice word`);
      for (const w of ws) {
        if (!(w in LEX)) { probs.push(`${b.title}: "${w}" is not in tests/booklex.json`); continue; }
        const ph = phones(w);
        if (ph.slice(1).includes(tp) && !b.allow.includes(w)) probs.push(`${b.title}: "${w}" has ${b.sound} inside the word`);
        if (ph[0] === tp && ph.length > 1 && !VOWEL.test(ph[1])) probs.push(`${b.title}: "${w}" puts ${b.sound} in a blend`);
        for (const f of b.forbid) if (ph.includes(f)) probs.push(`${b.title}: "${w}" has the other th (${f})`);
        if (ph[0] === tp && VOWEL.test(ph[1] || "") && !b.words.includes(w)) probs.push(`${b.title}: "${w}" starts with ${b.sound} but isn't a listed practice word, so it won't be tinted`);
      }
    });
  }
  ok("…every line has a word that starts with its sound, and the sound is nowhere else in the book",
    books.length >= 19 && probs.length === 0, probs.slice(0, 8).join(" | "));

  // every fuller page is a drawn scene, and every file it names is really there:
  // the reader shows art over the sticker, so a missing file is a blank page
  const art = await pg.evaluate(() => STORIES.filter((b) => b.words).map((b) => ({ title: b.title, cover: b.cover, pages: b.pages.map((p) => p.art) })));
  const gone = [];
  for (const b of art) for (const f of [b.cover, ...b.pages]) if (!f || !existsSync(ROOT + f)) gone.push(b.title + ": " + (f || "(no picture)"));
  ok("…and every one of their covers and pages is a drawn picture that exists", art.length >= 19 && gone.length === 0, gone.slice(0, 6).join(" | "));
  await pg.evaluate(() => { openBook(STORIES.filter((b) => b.title === "Penny's Pebble Party")[0]); });
  const pennyCover = await pg.waitForFunction(() => { const i = document.querySelector("#bkStage img.bkcover"); return !!(i && i.complete && i.naturalWidth > 0); }, null, { timeout: 4000 }).then(() => true, () => false);
  await pg.evaluate(() => document.getElementById("bkNext").click());
  const pennyPage = await pg.waitForFunction(() => { const i = document.querySelector("#bkStage .bkart.scene img"); return !!(i && i.complete && i.naturalWidth > 0); }, null, { timeout: 4000 }).then(() => true, () => false);
  ok("…and a built book's cover and first page load in the reader", pennyCover && pennyPage, JSON.stringify({ pennyCover, pennyPage }));
  await pg.evaluate(() => closeBook());

  // the tint follows the sound, not the letter: "the" is not a T word, and
  // in the voiced-th book only the th that starts This and That lights up
  const tint = async (title, page) => {
    await pg.evaluate((t) => { closeBook(); openBook(STORIES.filter((b) => b.title === t)[0]); }, title);
    for (let i = 0; i < page; i++) await pg.evaluate(() => document.getElementById("bkNext").click());
    await pg.waitForTimeout(150);
    return pg.evaluate(() => [...document.querySelectorAll("#bkStage .bktext b")].map((b) => b.textContent + ">" + b.parentNode.textContent));
  };
  const toby = await tint("Toby's Tiny Tuba", 5);
  ok("the T book tints Tia, tune and taps, and not the t in \"the\"",
    JSON.stringify(toby) === JSON.stringify(["T>Tia", "t>tune.", "t>taps"]), JSON.stringify(toby));
  const bee = await tint("This Bear, That Bee", 1);
  ok("…the voiced-th book tints the th of This and That",
    JSON.stringify(bee) === JSON.stringify(["Th>This", "Th>That"]), JSON.stringify(bee));
  const head = await pg.evaluate(() => document.getElementById("bkHead").textContent);
  ok("…and calls its sound TH (v), never the internal code THV", /TH \(v\) sound/.test(head) && !/THV/.test(head), head);
  ok("no pageerrors across the fuller books", errs.length === 0, errs.join(" | "));
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

// ── the robot voice is a last resort, not a default ──
// Travis, from the field: lines the app speaks BY ITSELF on opening a screen
// came out flat and robotic, while the same line tapped by hand sounded like
// Echo. Not credits — /api/tts answers 200 throughout. Every page load makes a
// NEW AudioContext, browsers start it suspended until a gesture, so the fetched
// audio could not play and _spkOnce fell straight through to speechSynthesis.
//
// An AUTO line now waits for the tap that is coming anyway. A line the child
// ASKED for still falls back, because there the choice is robot-or-nothing.
{
  const sona = readFileSync(ROOT + "/sona.js", "utf8");
  ok("an auto-spoken line parks on a locked context instead of robot-voicing",
    /if \(how === "blocked" && opts\.auto\) \{ _spkPark\(/.test(sona),
    "this is the whole bug: the good audio was fetched, then thrown away for the robot");
  ok("…and speak() is auto by default, so pages get it without opting in",
    /function speak\(text, opts\) \{\s*opts = Object\.assign\(\{ auto: true \}/.test(sona));
  ok("…while speakNow() explicitly is NOT, so a tapped line always makes a sound",
    /function speakNow\(text, opts\) \{\s*opts = Object\.assign\(\{\}, opts \|\| \{\}, \{ auto: false \}\)/.test(sona),
    "the Hear button must never go silent — that was the original field bug");
  ok("the first gesture releases whatever was waiting",
    /function speakUnlock\(\)[\s\S]{0,700}_spkFlush/.test(sona));
  ok("…and only ONE line is ever held",
    /let _spkPending = null;/.test(sona) && /function _spkPark\(text, opts\) \{ _spkPending = /.test(sona),
    "a backlog would make a child sit through instructions that already scrolled past");
  ok("…and a still-locked context drops it rather than queueing forever",
    /function _spkFlush[\s\S]{0,420}state !== "running"\) return;/.test(sona));
}

await browser.close();
for (const r of held) { try { r.socket.destroy(); } catch (e) {} }
srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
