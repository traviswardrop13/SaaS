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
import { readFileSync, existsSync, statSync } from "fs";
import { createHash } from "crypto";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp" };
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
  // a day every twelve-page book is open (they open a few a week, below)
  await pg.clock.setFixedTime(new Date("2026-11-02T10:00:00"));
  await pg.goto("http://localhost:8153/library.html");
  await pg.waitForTimeout(800);
  const books = await pg.evaluate(() => STORIES.filter((b) => b.words).map((b) => ({ sound: b.sound, title: b.title,
    words: b.words, allow: b.allow || [], forbid: b.forbid || [], keys: b.keys || [], pages: b.pages.map((p) => p.t) })));
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

  // THE KEY WORDS (family redesign brief, 28 Sep 2026): one word per page that
  // Echo asks the child to say before the page turns. They came from the
  // brief's book-keywords.json, picked automatically, so each is held to the
  // same rule as the book's other practice words: a whole word ON its own
  // page, one of the book's listed words (so it is tinted), and the book's
  // sound at the start before a vowel. Which word a child is asked to say is
  // Rachel's call; this only keeps an edited one honest.
  const keyProbs = [];
  for (const b of books) {
    const tp = TARGET[b.sound];
    if (b.keys.length !== 12) keyProbs.push(`${b.title}: ${b.keys.length} key words, not 12`);
    b.keys.forEach((k, i) => {
      if (!toks(b.pages[i] || "").includes(k)) keyProbs.push(`${b.title} p${i + 1}: key "${k}" is not a word on its page`);
      if (!b.words.includes(k)) keyProbs.push(`${b.title} p${i + 1}: key "${k}" is not one of the book's practice words`);
      const ph = k in LEX ? phones(k) : [];
      if (ph[0] !== tp || !VOWEL.test(ph[1] || "")) keyProbs.push(`${b.title} p${i + 1}: key "${k}" doesn't start with ${b.sound} and a vowel`);
    });
  }
  ok("every fuller book asks for one key word a page, each a practice word on that page that starts with the sound",
    books.length >= 19 && books.reduce((n, b) => n + b.keys.length, 0) === 228 && keyProbs.length === 0, keyProbs.slice(0, 8).join(" | "));

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

// ── the books open a few a week (Travis, 27 Sep 2026) ──
// "a solid book for the top four or five most popular letters... everything
// else, we can just set a date on it... new drops every week." R, S, L, SH and
// TH are open; every other book waits on the shelf, greyed, saying the day it
// opens, and that day is the phone's own, not London's.
{
  const lib = readFileSync(ROOT + "/library.html", "utf8");
  const dated = [...lib.matchAll(/opens: "([\d-]+)", title: "([^"]+)"/g)].map((m) => ({ opens: m[1], title: m[2] }));
  const open12 = [...lib.matchAll(/\{ sound: "(\w+)", emoji: "[^"]*", title: "([^"]+)"[^\n]*\n\s*cover: "\/assets\/books\//g)].map((m) => m[1]).sort();
  ok("R, S, L, SH and TH are the twelve-page books open now", JSON.stringify(open12) === JSON.stringify(["L", "R", "S", "SH", "TH"]), open12.join(" "));
  ok("every other book has a Sunday it opens, a few at a time, the six-page ones last",
    dated.length === 27 && dated.every((d) => new Date(d.opens + "T12:00:00").getDay() === 0) &&
    Object.values(dated.reduce((n, d) => ((n[d.opens] = (n[d.opens] || 0) + 1), n), {})).every((c) => c <= 3) &&
    dated.filter((d) => /^(Rory the Rabbit|Reba the Robot|Ruby the Rooster|Remy the Raccoon|Rex the Rhino|Sunny the Seal|Lily the Lion|Kiki the Koala|Shelly the Sheep|Charlie the Chick|Theo the Sloth|Gus the Goat|Fifi the Fox)$/.test(d.title)).every((d) => d.opens > "2026-11-01"),
    JSON.stringify(dated.slice(0, 4)));
  const shelfAt = async (when, focus) => {
    const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, timezoneId: "America/Denver" });
    const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
    await pg.addInitScript(seed);
    await pg.addInitScript((f) => localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "7", focusSounds: f, onboarded: true, earlyAdopter: true })), focus);
    await pg.clock.setFixedTime(new Date(when));
    await pg.goto("http://localhost:8153/library.html");
    await pg.waitForTimeout(500);
    const shelf = await pg.evaluate(() => [...document.querySelectorAll("#shelf .bookBtn")].map((b) => ({ t: b.querySelector(".bt").textContent, off: b.disabled, s: b.querySelector(".bs").textContent })));
    return { ctx, pg, errs, shelf };
  };
  let r = await shelfAt("2026-09-28T09:00:00-06:00", ["R"]);
  ok("a child on R: Rory and the Rainbow first and open, the six-page R books greyed with their day",
    r.shelf[0].t === "Rory and the Rainbow" && !r.shelf[0].off && r.shelf.length === 6 && r.shelf.slice(1).every((b) => b.off && /^Coming (Nov|Dec) \d+$/.test(b.s)), JSON.stringify(r.shelf));
  await r.pg.evaluate(() => [...document.querySelectorAll("#shelf .bookBtn")][1].click());
  const shut = await r.pg.evaluate(() => { openBook(STORIES.filter((b) => b.title === "Rex the Rhino")[0]); return !document.getElementById("book").classList.contains("show"); });
  ok("…and a coming book can't be opened, by a tap or by the reader itself", shut && !(await r.pg.evaluate(() => document.getElementById("book").classList.contains("show"))));
  ok("…no page errors on a dated shelf", r.errs.length === 0, r.errs.join(" | ")); await r.ctx.close();
  r = await shelfAt("2026-09-28T09:00:00-06:00", ["K"]);
  ok("a child whose sound has nothing open yet gets every open book first, then their own, coming",
    r.shelf.slice(0, 5).every((b) => !b.off) && JSON.stringify(r.shelf.slice(5).map((b) => b.t)) === JSON.stringify(["Kip's Kite", "Kiki the Koala"]) && r.shelf.slice(5).every((b) => b.off) && r.shelf[5].s === "Coming Oct 4",
    JSON.stringify(r.shelf)); await r.ctx.close();
  r = await shelfAt("2026-10-03T23:55:00-06:00", ["K"]);
  ok("late on Saturday where the family is (already Sunday in London), Kip's Kite still waits", r.shelf.find((b) => b.t === "Kip's Kite").off, JSON.stringify(r.shelf)); await r.ctx.close();
  r = await shelfAt("2026-10-04T00:05:00-06:00", ["K"]);
  ok("…and on Sunday it opens, first on a K child's shelf", r.shelf[0].t === "Kip's Kite" && !r.shelf[0].off, JSON.stringify(r.shelf)); await r.ctx.close();
}

// ── the painted books (Codex, 28 Sep 2026) ──
// The thirteen six-page books got their pictures from ChatGPT's image tool:
// one picture per book holding its six scenes, three across and two down, in
// reading order, drawn for these exact sentences. The reader shows page i's
// scene by position; the shelf shows a small copy of the first, so a book that
// isn't open yet never pulls the whole picture. In the full-screen reader (29
// Sep 2026) each scene is cut out of its book's picture on the phone and fills
// the page like any wide drawn page: whole, at full width, its own edges
// carried to the screen's, the cream card over its foot.
{
  const lib = readFileSync(ROOT + "/library.html", "utf8");
  const SIX = ["Rory the Rabbit", "Reba the Robot", "Ruby the Rooster", "Remy the Raccoon", "Rex the Rhino", "Sunny the Seal", "Lily the Lion", "Kiki the Koala", "Shelly the Sheep", "Charlie the Chick", "Theo the Sloth", "Gus the Goat", "Fifi the Fox"];
  const painted = [...lib.matchAll(/title: "([^"]+)", painted: "([a-z]+)", colors: \[[^\]]+\], pages: \[([\s\S]*?)\] \}/g)]
    .map((m) => ({ title: m[1], id: m[2], lines: [...m[3].matchAll(/t: "((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]) }));
  const file = (id, c) => ROOT + "/assets/books/painted/" + id + (c ? "-cover" : "") + ".webp";
  ok("all 13 six-page books are painted, each with its picture and a small cover",
    painted.length === 13 && SIX.every((t) => painted.some((b) => b.title === t)) && painted.every((b) => existsSync(file(b.id)) && existsSync(file(b.id, 1))),
    JSON.stringify(painted.map((b) => b.title)));
  ok("…small enough for a phone: each book's picture under 400 KB, each cover under 40 KB",
    painted.every((b) => existsSync(file(b.id)) && statSync(file(b.id)).size < 400e3 && statSync(file(b.id, 1)).size < 40e3));
  ok("…and the 78 sentences are the ones the pictures were drawn for (change one, redraw its scene)",
    createHash("sha1").update(JSON.stringify(painted.map((b) => [b.title, b.lines]))).digest("hex") === "73b75ea59038d1d5609747e499180af69189158f");

  const reader = async (when, vp) => {
    const ctx = await browser.newContext({ viewport: vp || { width: 390, height: 844 } });
    const pg = await ctx.newPage(); const errs = [], got = [];
    pg.on("pageerror", (e) => errs.push(e.message));
    pg.on("request", (q) => { const m = q.url().match(/\/painted\/([a-z-]+)\.webp/); if (m) got.push(m[1]); });
    await pg.addInitScript(seed);
    await pg.clock.setFixedTime(new Date(when));
    await pg.goto("http://localhost:8153/library.html");
    await pg.waitForTimeout(500);
    return { ctx, pg, errs, got };
  };
  // Which of the book's six scenes the page is showing, found by looking:
  // the page's picture and each sixth of the sheet, shrunk to 16 x 16 and
  // compared, so the pin holds however the reader cuts them out.
  const scene = (pg, id) => pg.evaluate(async (id) => {
    const img = document.querySelector("#bkStage .bkart.scene img, #bkStage img.bkcover");
    if (!img) return null;
    await img.decode().catch(() => {});
    const sheet = new Image(); sheet.src = "/assets/books/painted/" + id + ".webp"; await sheet.decode();
    const px = (src, sx, sy, sw, sh) => { const c = document.createElement("canvas"); c.width = c.height = 16; const g = c.getContext("2d"); g.drawImage(src, sx, sy, sw, sh, 0, 0, 16, 16); return g.getImageData(0, 0, 16, 16).data; };
    const mine = px(img, 0, 0, img.naturalWidth, img.naturalHeight), W = sheet.naturalWidth / 3, H = sheet.naturalHeight / 2;
    const diff = [0, 1, 2, 3, 4, 5].map((i) => { const d = px(sheet, (i % 3) * W, Math.floor(i / 3) * H, W, H); let t = 0; for (let k = 0; k < d.length; k++) t += Math.abs(d[k] - mine[k]); return t / d.length; });
    const best = diff.indexOf(Math.min(...diff)), b = img.getBoundingClientRect(), book = document.getElementById("book");
    return { best, close: diff[best] < 12, fullSize: img.naturalWidth === W && img.naturalHeight === H, cover: img.classList.contains("bkcover"),
      fullWidth: Math.abs(Math.min(b.width, b.height * img.naturalWidth / img.naturalHeight) - innerWidth) < 2, edges: book.classList.contains("edges"), tall: book.classList.contains("tall"), mode: window.__book && window.__book.mode };
  }, id);
  const fitsNow = (pg) => pg.evaluate(() => { const t = document.querySelector(".bktext").getBoundingClientRect(), n = document.getElementById("bkNext").getBoundingClientRect(), c = document.querySelector(".bkcard").getBoundingClientRect(), img = document.querySelector("#bkStage .bkart.scene img"), a = img && img.getBoundingClientRect();
    return t.bottom <= n.top && n.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth && !!a && a.height > 150 && a.top < c.top; });
  let r = await reader("2026-12-07T10:00:00");
  await r.pg.locator(".bookBtn", { hasText: "Rory the Rabbit" }).click();
  // the title page swaps the shelf's small copy for the full-size first scene once it is cut
  const sharp = await r.pg.waitForFunction(() => /^(blob|data):/.test((document.querySelector("#bkStage img.bkcover") || {}).src || ""), null, { timeout: 4000 }).then(() => true, () => false);
  const seen = [await scene(r.pg, "rory")];
  let fits = true;
  for (let i = 0; i < 6; i++) {
    await r.pg.click("#bkNext");
    await r.pg.waitForFunction(() => { const i = document.querySelector("#bkStage .bkart.scene img"); return !!(i && i.complete && i.naturalWidth); }, null, { timeout: 4000 }).catch(() => {});
    seen.push(await scene(r.pg, "rory"));
    fits = fits && await fitsNow(r.pg);
  }
  ok("the reader shows the cover's scene, then each page's own, in reading order",
    JSON.stringify(seen.map((x) => x && x.best)) === JSON.stringify([0, 0, 1, 2, 3, 4, 5]) && seen.every((x) => x.close), JSON.stringify(seen));
  ok("…the title page at full size once it is cut (the shelf's small copy only until then)", sharp && seen[0].cover && seen[0].fullSize, JSON.stringify(seen[0]));
  ok("…each page's scene a picture of its own, filling the page like a drawn one: whole, full width, its edges carried out, never a small square",
    seen.slice(1).every((x) => !x.cover && x.fullSize && x.fullWidth && x.edges && !x.tall), JSON.stringify(seen.slice(1)));
  ok("…no key-word moment in a six-page book: Next on every page", seen.slice(1).every((x) => x.mode === "next"), JSON.stringify(seen.map((x) => x && x.mode)));
  ok("…and the line and Next stay on a 390 x 844 phone below the picture", fits);
  ok("…with the book's picture downloaded once for all six pages", r.got.filter((n) => n === "rory").length === 1, JSON.stringify(r.got));
  ok("…with no page errors", r.errs.length === 0, r.errs.join(" | ")); await r.ctx.close();
  // a small phone: the scene still shows whole above the card
  r = await reader("2026-12-07T10:00:00", { width: 320, height: 568 });
  await r.pg.locator(".bookBtn", { hasText: "Reba the Robot" }).click(); await r.pg.waitForTimeout(200);
  await r.pg.click("#bkNext"); await r.pg.click("#bkNext");
  await r.pg.waitForFunction(() => { const i = document.querySelector("#bkStage .bkart.scene img"); return !!(i && i.complete && i.naturalWidth); }, null, { timeout: 4000 }).catch(() => {});
  const small = await scene(r.pg, "reba");
  ok("on a 320 x 568 phone a painted page shows its own scene over its edges, with the line and Next below it",
    small && small.best === 1 && small.close && small.edges && await fitsNow(r.pg), JSON.stringify(small));
  ok("…with no page errors", r.errs.length === 0, r.errs.join(" | ")); await r.ctx.close();
  r = await reader("2026-09-29T10:00:00");
  ok("a painted book that isn't open yet costs only its small cover, never its whole picture",
    r.got.length === 5 && r.got.every((n) => /-cover$/.test(n)), JSON.stringify(r.got)); await r.ctx.close();
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
