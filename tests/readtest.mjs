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
  // a day every twelve-page book is open (the queued ones open 9 Oct, below)
  await pg.clock.setFixedTime(new Date("2026-10-09T10:00:00"));
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
    books.length >= 19 && books.reduce((n, b) => n + b.keys.length, 0) === 12 * books.length && keyProbs.length === 0, keyProbs.slice(0, 8).join(" | "));

  // EVERY BOOK ASKS NOW (Travis, 1 Oct 2026: "we want to make that something
  // that is happening on every book"). The thirteen six-page books got six
  // key words each. Their SENTENCES can't keep the rule above: they put the
  // sound anywhere in a word, and they are fixed (the pictures were painted
  // for them, pinned further down). Their KEYS can, and do, because a key is
  // the one word the child is asked to say: six keys for six pages,
  // lower-case, each a whole word ON its own page as the reader splits the
  // line (on spaces, so "choo-choo" is one word and "choo" is none), that
  // STARTS with the book's sound before a vowel by its pronouncing entry,
  // never by its spelling ("then" is the other th, "worm" has no R). "The
  // sound somewhere in the word" was the first rule here, and it would have
  // passed "corn" (K AO1 R N) as an R word and "all" as an L word.
  // No `words` list: that one means "every word that starts with the sound".
  //
  // The words that can't meet it are listed BY NAME, so each is a decision
  // someone made and the next one fails here until it is made too:
  //   ELSEWHERE  the sound is in the word but not at its start. The TH book's
  //              page 5 ("Then a warm bath — both feet in.") has no word that
  //              starts with that th, so its key ends with it.
  //   R_TWICE    an R book's key with a second r-coloured sound after the
  //              first (R or ER): harder than the one R the child is working
  //              on. "Rory" is the page's easiest ("roars" has two as well).
  // Which word a child is asked to say is Rachel's call; take a word off
  // these lists when she swaps it, add one only on her say-so.
  const ELSEWHERE = { "Theo the Sloth p5": "bath" };
  const R_TWICE = { "Rory the Rabbit p6": "rory" };
  const all = await pg.evaluate(() => STORIES.map((b) => ({ sound: b.sound, title: b.title, six: !!b.painted, listed: !!b.words, keys: b.keys || [], pages: b.pages.map((p) => p.t) })));
  const six = all.filter((b) => b.six);
  ok("every book on the shelf has one key word per page, the six-page books too",
    all.length === 48 /* 35 twelve-page books, October's six Halloween ones among them, and 13 six-page */ && all.length === books.length + six.length && six.length === 13 && all.every((b) => b.keys.length === b.pages.length && b.keys.every(Boolean)),
    all.filter((b) => b.keys.length !== b.pages.length).map((b) => b.title + ": " + b.keys.length + " keys, " + b.pages.length + " pages").join(" | "));
  const spanWord = (w) => w.toLowerCase().replace(/[^a-z']/g, "").replace(/^'+|'+$/g, "");   // the reader's markKey, word for word
  // the rule itself, so the made-up words below go through the same lines
  const sixKeyProb = (sound, k, at) => {
    const tp = TARGET[sound];
    if (!(k in LEX)) return `key "${k}" is not in tests/booklex.json`;
    const ph = phones(k);
    if (ELSEWHERE[at] === k) { if (!ph.includes(tp)) return `key "${k}" has no ${sound} sound in it`; }
    else if (ph[0] !== tp || !VOWEL.test(ph[1] || "")) return `key "${k}" doesn't start with ${sound} and a vowel, and isn't a listed exception`;
    if (sound === "R" && R_TWICE[at] !== k && ph.slice(1).some((x) => x === "R" || x === "ER")) return `key "${k}" has a second r-coloured sound, and isn't a listed exception`;
    return "";
  };
  const sixProbs = [], named = { ELSEWHERE: [], R_TWICE: [] };
  for (const b of six) {
    if (b.pages.length !== 6 || b.keys.length !== 6) sixProbs.push(`${b.title}: ${b.keys.length} key words for ${b.pages.length} pages, not 6 and 6`);
    if (b.listed) sixProbs.push(`${b.title}: a six-page book lists \`words\`, which would hold every line to the start-of-word rule`);
    b.keys.forEach((k, i) => {
      const at = `${b.title} p${i + 1}`;
      if (!/^[a-z']+$/.test(k)) sixProbs.push(`${at}: key "${k}" is not lower-case letters (Echo would show it as written)`);
      if (!(b.pages[i] || "").split(" ").map(spanWord).includes(k)) sixProbs.push(`${at}: key "${k}" is not a whole word on its page`);
      const prob = sixKeyProb(b.sound, k, at);
      if (prob) sixProbs.push(`${at}: ${prob}`);
      if (ELSEWHERE[at] === k) named.ELSEWHERE.push(at);
      if (R_TWICE[at] === k) named.R_TWICE.push(at);
    });
  }
  ok("…every key word of a six-page book is a word on its own page that starts with the book's sound before a vowel, by its pronouncing entry",
    six.reduce((n, b) => n + b.keys.length, 0) === 78 && sixProbs.length === 0, sixProbs.slice(0, 8).join(" | "));
  ok("…but for the words listed by name: \"bath\" (no word on that page starts with its th) and \"rory\" (two r sounds), and each list still names a real key",
    JSON.stringify(named.ELSEWHERE) === JSON.stringify(Object.keys(ELSEWHERE)) && JSON.stringify(named.R_TWICE) === JSON.stringify(Object.keys(R_TWICE)), JSON.stringify(named));
  ok("…and the rule would catch the next one: \"corn\" is no R word, \"shh\" has no vowel after it, \"rooster\" and \"river\" carry a second r-coloured sound, \"bath\" passes only on its own page",
    ["corn", "rooster", "river", "rory"].every((w) => sixKeyProb("R", w, "Ruby the Rooster p5")) && !sixKeyProb("R", "rows", "Ruby the Rooster p5")
      && sixKeyProb("SH", "shh", "Shelly the Sheep p3") && sixKeyProb("SH", "fish", "Shelly the Sheep p2") && !sixKeyProb("SH", "she", "Shelly the Sheep p5")
      && sixKeyProb("TH", "bath", "Theo the Sloth p4") && !sixKeyProb("TH", "bath", "Theo the Sloth p5") && sixKeyProb("TH", "then", "Theo the Sloth p5"),
    JSON.stringify(["corn", "rooster", "river", "rory", "rows"].map((w) => w + ": " + sixKeyProb("R", w, "Ruby the Rooster p5"))));
  // A key the reader can't find fails silently (Echo asks, nothing glows), so
  // every one of them goes through the reader's own line and its own
  // highlighter: exactly one word lights up, and it is the key.
  //
  // And the ORANGE LETTERS in that word are the ones Echo's bubble shows.
  // Orange means "these letters make the sound". The line and the bubble are
  // on screen together, on the word the child is asked to say, and they used
  // to disagree on 21 of the six-page books' 78 words: the old line coloured
  // every letter equal to the sound's first letter ("[s]heep" beside the
  // bubble's "[sh]eep", "[c]hi[c]k", "ba[t]h", "ca[k]e", and "cow" with no
  // orange at all). So for every page of every book: the lit word carries one
  // mark, the bubble carries one mark, and they are the same letters at the
  // same place in the word. In a six-page book nothing else on the line is
  // orange (the old tint also lit "sips" in the SH book and "feet" in the TH
  // one), the mark is a spelling of the book's sound and never the whole
  // word (soundMark's answer when it isn't sure), and it starts the word
  // everywhere but in "bath". The reader always tells soundMark "start of the
  // word"; "ba[th]" comes from a fallback inside it, which this pins.
  const SPELLS = { R: ["r"], S: ["s"], L: ["l"], K: ["k", "c"], SH: ["sh"], CH: ["ch"], TH: ["th"], G: ["g"], F: ["f"] };
  const lit = await pg.evaluate(() => {
    const rows = [], keepStage = bkStage.innerHTML, keepBook = BOOK, tmp = document.createElement("div");
    const norm = (w) => w.toLowerCase().replace(/[^a-z']/g, "").replace(/^'+|'+$/g, "");
    // [letters before the mark, the mark], lower-case letters only; null unless there is exactly one mark
    const mark = (el) => {
      const bs = el ? el.querySelectorAll("b.snd") : [];
      if (bs.length !== 1) return null;
      const r = document.createRange(); r.setStart(el, 0); r.setEndBefore(bs[0]);
      return [r.toString().toLowerCase().replace(/[^a-z']/g, ""), bs[0].textContent.toLowerCase()];
    };
    STORIES.forEach((b) => b.pages.forEach((p, i) => {
      const k = (b.keys || [])[i];
      bkStage.innerHTML = '<div class="bktext">' + lineHTML(b, i) + "</div>";
      markKey(k);
      const kw = bkStage.querySelectorAll(".bktext .kw");
      BOOK = b; tmp.innerHTML = askHTML(keyShown(k));
      rows.push({ at: b.title + " p" + (i + 1), six: !!b.painted, sound: b.sound, key: k, lit: kw.length === 1 ? norm(kw[0].textContent) : null,
        line: mark(kw[0]), bubble: mark(tmp.querySelector(".bkw")), orange: bkStage.querySelectorAll(".bktext b.snd").length });
    }));
    BOOK = keepBook; bkStage.innerHTML = keepStage;
    return rows;
  });
  const show = (r) => r.at + ": " + r.key + " line=" + JSON.stringify(r.line) + " bubble=" + JSON.stringify(r.bubble);
  const dark = lit.filter((r) => r.lit !== r.key);
  ok("…and the reader lights up every key word on its page, in every book (" + lit.length + " pages)",
    lit.length === all.reduce((n, b) => n + b.pages.length, 0) && lit.length >= 498 /* 35 × 12 + 13 × 6 */ && dark.length === 0, dark.slice(0, 8).map(show).join(" | "));
  const apart = lit.filter((r) => !r.line || !r.bubble || r.line[0] !== r.bubble[0] || r.line[1] !== r.bubble[1]);
  ok("…with the same orange letters in the lit word as in Echo's bubble beside it, in every book", lit.length >= 498 && apart.length === 0, apart.slice(0, 8).map(show).join(" | "));
  const sixLit = lit.filter((r) => r.six);
  const off = sixLit.filter((r) => !r.line || r.orange !== 1 || !(SPELLS[r.sound] || []).includes(r.line[1]) || r.line[1] === r.key
    || (ELSEWHERE[r.at] === r.key ? r.line[0] === "" : r.line[0] !== ""));
  ok("…in a six-page book that word is the only orange on the line, the letters spell the book's sound (never the whole word), and they start the word everywhere but \"bath\"",
    sixLit.length === 78 && off.length === 0, off.slice(0, 8).map((r) => show(r) + " orange=" + r.orange).join(" | "));
  const pin = (at) => { const r = sixLit.find((x) => x.at === at) || {}; return [r.key, r.line, r.bubble]; };
  ok("…\"ba[th]\" in the TH book, \"[sh]e\" and \"[sh]eep\" in the SH one, \"[ch]ick\" in the CH one, \"[c]ake\" and \"[c]ow\" in the K one",
    JSON.stringify([pin("Theo the Sloth p5"), pin("Shelly the Sheep p5"), pin("Shelly the Sheep p1"), pin("Charlie the Chick p1"), pin("Kiki the Koala p1"), pin("Kiki the Koala p5")])
      === JSON.stringify([["bath", ["ba", "th"], ["ba", "th"]], ["she", ["", "sh"], ["", "sh"]], ["sheep", ["", "sh"], ["", "sh"]], ["chick", ["", "ch"], ["", "ch"]], ["cake", ["", "c"], ["", "c"]], ["cow", ["", "c"], ["", "c"]]]),
    JSON.stringify(["Theo the Sloth p5", "Shelly the Sheep p5", "Shelly the Sheep p1", "Charlie the Chick p1", "Kiki the Koala p1", "Kiki the Koala p5"].map(pin)));

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

// ── the queued books all open next Friday (Travis, 27 Sep and 1 Oct 2026) ──
// "a solid book for the top four or five most popular letters... everything
// else, we can just set a date on it", then "I don't want all these books and
// games to have different dates ... everything that is currently in queue to
// just say for next Friday." R, S, L, SH and TH are open; every other book
// waits on the shelf, greyed, saying the day it opens, and that day is the
// phone's own, not London's. The day is Friday 9 Oct, for every one of them.
{
  const lib = readFileSync(ROOT + "/library.html", "utf8");
  // Every book is live (Travis, 1 Oct 2026: "if anything is made ... let's
  // just make it live"): no book carries a day any more.
  ok("no book waits for a day: every one on the shelf is out", !/opens: "/.test(lib));
  // premium: false is a family on the free version, paywall on: every free
  // era already judged (so no sweep adopts them), the demonstration over, no
  // trial, no subscription. The books then lock one by one.
  const shelfAt = async (when, focus, premium = true, mode, viewport) => {
    const ctx = await browser.newContext({ viewport: viewport || { width: 430, height: 932 }, timezoneId: "America/Denver" });
    const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
    await pg.addInitScript(seed);
    await pg.addInitScript(([f, premium, mode]) => {
      localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "7", focusSounds: f, onboarded: true, earlyAdopter: premium, mode: mode || undefined }));
      if (!premium) {
        ["sona.freeera2.v1", "sona.freeera3.v1", "sona.freeera4.v1", "sona.freeera5.v1"].forEach((k) => localStorage.setItem(k, "done"));
        localStorage.setItem("sona.demo.v1", JSON.stringify({ started: 1, done: 1 }));
      }
    }, [focus, premium, mode || ""]);
    await pg.clock.setFixedTime(new Date(when));
    await pg.goto("http://localhost:8153/library.html");
    await pg.waitForTimeout(500);
    const shelf = await pg.evaluate(() => [...document.querySelectorAll("#shelf .bookBtn")].map((b) => ({ t: b.querySelector(".bt").textContent, off: b.disabled, s: b.querySelector(".bs").textContent, locked: b.classList.contains("locked") })));
    return { ctx, pg, errs, shelf };
  };
  let r = await shelfAt("2026-10-01T09:00:00-06:00", ["R"]);
  ok("a child on R: Rory and the Rainbow first, and every R book open",
    r.shelf[0].t === "Rory and the Rainbow" && r.shelf.length === 9 /* 8 R books + October's Halloween book */ && r.shelf.every((b) => !b.off), JSON.stringify(r.shelf));
  ok("…no page errors", r.errs.length === 0, r.errs.join(" | ")); await r.ctx.close();
  r = await shelfAt("2026-10-01T09:00:00-06:00", ["K"]);
  ok("a K child's shelf is their own books, open, and October's Halloween book",
    JSON.stringify(r.shelf.map((b) => b.t)) === JSON.stringify(["Kip's Kite", "Kiki the Koala", "Boo the Bat on Halloween"]) && r.shelf.every((b) => !b.off), JSON.stringify(r.shelf)); await r.ctx.close();
  r = await shelfAt("2026-10-01T09:00:00-06:00", []);
  ok("every book on the shelf is open, nothing still coming",
    r.shelf.length === 48 /* 42 + October's six Halloween books */ && r.shelf.every((b) => !b.off && !/^Coming/.test(b.s)), JSON.stringify(r.shelf.filter((b) => b.off))); await r.ctx.close();
  // HALLOWEEN IN YOUR OWN SOUND (Travis, 2 Oct 2026: "take a popular book
  // like the halloween and make a version for other letter"): a child gets
  // the Halloween book in their sound, and Boo only when their sounds have
  // none (Sona.seasonPick); Home's Limited time row asks the same rule.
  r = await shelfAt("2026-10-02T09:00:00-06:00", ["S"]);
  const sHome = await r.pg.evaluate(() => { const row = (Sona.activityLibrary().featured.find((f) => f.id === "seasonal") || { games: [] }).games; return row.map((g) => g.name); });
  ok("an S child gets Sid's Halloween book, not Boo, on the shelf and on Home",
    r.shelf.some((b) => b.t === "Sid the Seagull on Halloween") && !r.shelf.some((b) => /Halloween|Trick-or-Treat/.test(b.t) && b.t !== "Sid the Seagull on Halloween") &&
    JSON.stringify(sHome) === JSON.stringify(["Sid the Seagull on Halloween"]), JSON.stringify({ shelf: r.shelf.map((b) => b.t), home: sHome })); await r.ctx.close();
  r = await shelfAt("2026-10-02T09:00:00-06:00", ["K"]);
  const kHome = await r.pg.evaluate(() => (Sona.activityLibrary().featured.find((f) => f.id === "seasonal") || { games: [] }).games.map((g) => g.name));
  ok("…a K child, whose sound has none, gets Boo the Bat on both",
    r.shelf.filter((b) => /Halloween|Trick-or-Treat/.test(b.t)).map((b) => b.t).join() === "Boo the Bat on Halloween" && JSON.stringify(kHome) === JSON.stringify(["Boo the Bat on Halloween"]), JSON.stringify({ home: kHome })); await r.ctx.close();
  r = await shelfAt("2026-11-01T09:00:00-06:00", ["S"]);
  ok("…and after October no child has one", !r.shelf.some((b) => /Halloween|Trick-or-Treat/.test(b.t))); await r.ctx.close();

  // ── ONE FREE BOOK, THE REST PREMIUM (Travis, 30 Sep 2026) ──
  // "one book uh so like the letter r book ... to be free and the rest is
  // grayed out ... once they purchase it'll open up everything else." The
  // shelf opens for every family; without Premium, Rory and the Rainbow reads
  // and every other book that is out asks for a grown-up.
  const free = JSON.parse((readFileSync(ROOT + "/sona.js", "utf8").match(/const FREE_BOOKS = (\[[^\]]*\]);/) || [, "[]"])[1]);
  ok("the free book is named once, in sona.js, and it is a book on the shelf",
    JSON.stringify(free) === JSON.stringify(["Rory and the Rainbow"]) && free.every((t) => lib.includes('title: "' + t + '"')), JSON.stringify(free));
  r = await shelfAt("2026-09-28T09:00:00-06:00", ["R"], false);
  ok("without Premium, a child on R: Rory and the Rainbow first, open and marked Free, every other R book Premium",
    r.shelf[0].t === "Rory and the Rainbow" && !r.shelf[0].off && r.shelf[0].s === "Free" && r.shelf.length === 8 && r.shelf.slice(1).every((b) => !b.off && b.locked && b.s === "Premium"), JSON.stringify(r.shelf));
  await r.pg.evaluate(() => [...document.querySelectorAll("#shelf .bookBtn")][0].click());
  ok("…and the free book opens", await r.pg.waitForFunction(() => document.getElementById("book").classList.contains("show"), null, { timeout: 3000 }).then(() => true, () => false));
  ok("…no page errors", r.errs.length === 0, r.errs.join(" | ")); await r.ctx.close();
  r = await shelfAt("2026-09-28T09:00:00-06:00", ["S"], false);
  ok("without Premium, a child on S: the free book first, then Sid the Seagull greyed and marked Premium, then the other S books, Premium too",
    JSON.stringify(r.shelf.map((b) => b.t)) === JSON.stringify(["Rory and the Rainbow", "Sid the Seagull", "Sam's Sailboat", "Sophie's Silly Soup", "Sunny the Seal"])
      && r.shelf[0].s === "Free" && !r.shelf[0].locked
      && r.shelf[1].s === "Premium" && r.shelf[1].locked && !r.shelf[1].off
      && r.shelf.slice(1).every((b) => !b.off && b.locked && b.s === "Premium"), JSON.stringify(r.shelf));
  await r.pg.evaluate(() => [...document.querySelectorAll("#shelf .bookBtn")][1].click());
  await r.pg.waitForTimeout(100);
  const asked = await r.pg.evaluate(() => ({ open: document.getElementById("book").classList.contains("show"), notice: !document.getElementById("bookNotice").hidden,
    msg: document.getElementById("bookMessage").textContent, role: document.getElementById("bookMessage").getAttribute("role"), url: location.pathname }));
  ok("…a tap on the Premium book stays on the shelf and asks for a grown-up, naming the book and the free one",
    !asked.open && asked.notice && asked.role === "status" && asked.url === "/library.html" && /grown-up/.test(asked.msg) && /Sid the Seagull/.test(asked.msg) && /Rory and the Rainbow is free/.test(asked.msg), JSON.stringify(asked));
  const sealed = await r.pg.evaluate(() => { openBook(STORIES.filter((b) => b.title === "Sid the Seagull")[0]); return !document.getElementById("book").classList.contains("show"); });
  ok("…and the reader itself refuses it", sealed);
  await r.pg.locator("#bookUnlock").click();
  await r.pg.waitForURL((u) => !/\/library\.html/.test(u.pathname), { timeout: 3000 }).catch(() => {});
  ok("…while \"Ask a grown-up\" goes to the grown-ups' side, never straight to a price", /\/(premium|today)\.html/.test(new URL(r.pg.url()).pathname), r.pg.url());
  ok("…no page errors", r.errs.length === 0, r.errs.join(" | ")); await r.ctx.close();
  r = await shelfAt("2026-09-28T09:00:00-06:00", ["S"], true);
  ok("with Premium, the same shelf opens Sid the Seagull, and nothing says Free or Premium",
    r.shelf[0].t === "Sid the Seagull" && !r.shelf[0].off && !r.shelf.some((b) => b.locked || /^(Free|Premium)$/.test(b.s)), JSON.stringify(r.shelf)); await r.ctx.close();

  // ── MORE BOOKS: the other sounds' books, closed up under the shelf ──
  // Travis, 1 Oct 2026: "the other ones ... they're still there, but like
  // closed up ... there's like a button you can press to like drop down and
  // then it shows the books for the other letters ... a kid, like they might
  // be like wanting to just do the Halloween one." The top shelf (#shelf,
  // every check above) is chosen exactly as before; every other in-season
  // book waits on #moreShelf behind one closed control.
  //
  // What "as before" means changed under this on the same day. Every book
  // that is made is out, so nothing behind the button is "coming" any more.
  // And Halloween has a book for six sounds (B, R, S, L, Z and F): the top
  // shelf keeps the one(s) Sona.seasonPick gives this child (their own
  // sound's; Boo the Bat only when their sounds have none), and the other
  // sounds' Halloween books are behind the button with the rest. The counts
  // are stated AND added up: 42 books all year, 48 in October, and the two
  // shelves together are that list, each book once.
  const HALLOWEEN = /Halloween|Trick-or-Treat/;
  const SIX_HALLOWEEN = ["Boo the Bat on Halloween", "Finn the Fish on Halloween", "Leon's Trick-or-Treat Night", "Rory the Rabbit on Halloween", "Sid the Seagull on Halloween", "Zoe the Zebra on Halloween"];
  const more = (pg) => pg.evaluate(() => {
    const btn = document.getElementById("moreBtn"), box = document.getElementById(btn.getAttribute("aria-controls") || "x");
    const seen = (e) => !!(e && !e.hidden && e.offsetParent !== null);
    const soundOf = (t) => (ALL_STORIES.filter((x) => x.title === t)[0] || {}).sound;
    return { tag: btn.tagName, type: btn.type, cream: btn.classList.contains("cream-pill"), shown: seen(btn), label: btn.textContent.trim(), open: btn.getAttribute("aria-expanded"),
      box: seen(box), head: box ? (box.querySelector(".shelfhead h2") || {}).textContent : null, chev: !!btn.querySelector("svg"), h: btn.getBoundingClientRect().height,
      // what the browser paints it with, beside a bare cream pill put next to it
      paint: (() => { const bare = document.createElement("button"); bare.className = "cream-pill"; bare.type = "button"; btn.parentNode.insertBefore(bare, btn);
        const of = (e) => { const c = getComputedStyle(e); return [c.backgroundColor, c.backgroundImage, c.color, c.borderTopColor, c.borderBottomColor, c.borderLeftColor, c.borderRightColor, c.boxShadow, c.textShadow, c.opacity, c.filter].join(" | "); };
        const out = { pill: of(btn), bare: of(bare) }; bare.remove(); return out; })(),
      top: [...document.querySelectorAll("#shelf .bookBtn")].map((b) => b.querySelector(".bt").textContent),
      topSounds: [...document.querySelectorAll("#shelf .bookBtn")].map((b) => soundOf(b.querySelector(".bt").textContent)),
      topMarks: [...document.querySelectorAll("#shelf .bookBtn")].map((b) => b.querySelector(".bs").textContent),
      // every book button on the page that is not on the top shelf, and whether a child can see it
      rest: [...document.querySelectorAll(".bookBtn")].filter((b) => !b.closest("#shelf")).map((b) => ({ t: b.querySelector(".bt").textContent, off: b.disabled, s: b.querySelector(".bs").textContent,
        locked: b.classList.contains("locked"), soon: b.classList.contains("soon"), seen: seen(b), in: !!b.closest("#moreShelf"), sound: soundOf(b.querySelector(".bt").textContent), at: ALL_STORIES.map((x) => x.title).indexOf(b.querySelector(".bt").textContent) })),
      all: ALL_STORIES.map((x) => x.title), sounds: ALL_STORIES.map((x) => x.sound).filter((x, i, a) => a.indexOf(x) === i), wide: document.documentElement.scrollWidth > innerWidth };
  });
  const sameSet = (a, b) => a.length === b.length && new Set(a).size === a.length && a.every((t) => b.includes(t));
  // the two shelves together are the whole in-season list, each book once
  const whole = (m) => m.rest.every((b) => b.in && !m.top.includes(b.t)) && sameSet(m.top.concat(m.rest.map((b) => b.t)), m.all);
  const spooky = (list) => list.filter((t) => HALLOWEEN.test(t)).sort();
  const others = (mine) => SIX_HALLOWEEN.filter((t) => !mine.includes(t));
  // A tap that answers instead of throwing: a control that is missing, hidden
  // or not taking taps must be a FAIL line with its own name, not a stack
  // trace that ends the suite before the checks below it have run. (For a
  // beat after More books opens or closes the page takes no tap, see "a small
  // finger taps twice" below; a real tap waits that beat out.) A book is
  // named by its whole title: "Sid the Seagull" is not "Sid the Seagull on
  // Halloween", which now stands right before it.
  const tap = (pg, sel, title) => (title ? pg.locator(sel, { has: pg.locator(".bt", { hasText: new RegExp("^" + title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$") }) }) : pg.locator(sel))
    .first().click({ timeout: 4000 }).then(() => true, () => false);
  r = await shelfAt("2026-10-01T10:00:00-06:00", ["R"]);
  let m = await more(r.pg);
  ok("October has 48 books in season: the 42 that are always there and the six Halloween ones", m.all.length === 48 && JSON.stringify(spooky(m.all)) === JSON.stringify(SIX_HALLOWEEN), JSON.stringify(spooky(m.all)));
  ok("a child on R in October: the top shelf is their eight R books and their own Halloween book, Rory the Rabbit on Halloween, nothing else",
    m.top.length === 9 && m.topSounds.every((x) => x === "R") && JSON.stringify(spooky(m.top)) === JSON.stringify(["Rory the Rabbit on Halloween"]), JSON.stringify(m.top));
  ok("…under it one closed More books control: a real button, a cream pill tall enough for a small finger, saying how many books are behind it (48 less the 9 on top)",
    m.tag === "BUTTON" && m.type === "button" && m.cream && m.shown && m.open === "false" && m.label === "More books (39)" && m.label === "More books (" + (m.all.length - m.top.length) + ")" && m.chev && m.h >= 48 && !m.wide,
    JSON.stringify(m, ["tag", "type", "cream", "shown", "open", "label", "chev", "h", "wide"]));
  // "Never paste the hex values into a page": the tests above and loadtest
  // only ask whether it has the class and looks light and warm, which a cream
  // hex pasted onto it would pass. So the page may size and place the pill
  // and nothing more, and the browser must paint it exactly as it paints a
  // bare cream pill.
  {
    const css = (lib.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((x) => /#moreBtn\b/.test(x[1]));
    const PAINT = /^(background(-[a-z-]+)?|color|border|border-(top|right|bottom|left)|border-((top|right|bottom|left)-)?color|box-shadow|text-shadow|outline|outline-color|fill|stroke|filter|opacity)$/i;
    const bad = [];
    for (const [, sel, body] of rules) for (const d of body.split(";")) {
      const i = d.indexOf(":"); if (i === -1) continue;
      const prop = d.slice(0, i).trim(), val = d.slice(i + 1).trim();
      if (PAINT.test(prop) || /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(val)) bad.push(sel.trim() + " { " + prop + ": " + val + " }");
    }
    const tag = (lib.match(/<button id="moreBtn"[^>]*>/) || [""])[0];
    ok("…its colours are the cream pill's own: the page's rules for it set size and place, never a colour, a border or a shadow",
      rules.length >= 2 && bad.length === 0 && /class="cream-pill"/.test(tag) && !/\sstyle=/.test(tag), bad.join(" | ") || tag);
    ok("…and the browser paints it exactly as it paints a bare cream pill", !!m.paint.bare && m.paint.pill === m.paint.bare && !/rgba\(0, 0, 0, 0\) \| none \|/.test(m.paint.pill.slice(0, 30)), JSON.stringify(m.paint));
  }
  ok("…and none of the other sounds' books on the page until it is opened", !m.box && m.rest.length === 0, JSON.stringify(m.rest.map((b) => b.t)));
  let tapped = await tap(r.pg, "#moreBtn"); await r.pg.waitForTimeout(150);
  m = await more(r.pg);
  ok("a tap opens it: \"Books for other sounds\", every in-season book that is not on the top shelf (39), each exactly once",
    tapped && m.open === "true" && m.box && m.head === "Books for other sounds" && m.rest.length === 39 && m.rest.every((b) => b.seen) && whole(m) && !m.wide,
    JSON.stringify({ open: m.open, head: m.head, n: m.rest.length }));
  ok("…the other five Halloween books are behind it, Boo the Bat too (an R child has their own), and Rory's is on the top shelf only",
    JSON.stringify(spooky(m.rest.map((b) => b.t))) === JSON.stringify(others(["Rory the Rabbit on Halloween"])) && m.rest.length - spooky(m.rest.map((b) => b.t)).length === 34,
    JSON.stringify(spooky(m.rest.map((b) => b.t))));
  // every one of them can be read (with Premium); the sounds in the order
  // STORIES names them, each sound's books side by side and in STORIES' order
  const inOrder = (list) => { const at = list.map((b) => m.sounds.indexOf(b.sound)); return at.every((x, i) => x >= 0 && (!i || at[i - 1] < x || (at[i - 1] === x && list[i - 1].at < list[i].at))); };
  ok("…each sound's books together, the sounds in the shelf's own order (in October the ones with a Halloween book first), no R among them",
    JSON.stringify(m.rest.map((b) => b.sound).filter((x, i, a) => a.indexOf(x) === i)) === JSON.stringify(["B", "S", "L", "Z", "F", "P", "M", "N", "T", "D", "K", "G", "V", "SH", "CH", "J", "TH", "THV"]) && inOrder(m.rest)
      && JSON.stringify(m.rest.slice(0, 7).map((b) => b.t)) === JSON.stringify(["Boo the Bat on Halloween", "Bo's Beach Day", "Sid the Seagull on Halloween", "Sid the Seagull", "Sam's Sailboat", "Sophie's Silly Soup", "Sunny the Seal"])
      && m.rest.findIndex((b) => b.t === "Kiki the Koala") === m.rest.findIndex((b) => b.t === "Kip's Kite") + 1, JSON.stringify(m.rest.map((b) => b.sound + ":" + b.t)));
  // Every book that is made is out (the check that used to stand here found
  // a greyed "Coming Oct 9" button and proved it could not be opened).
  ok("…every book behind it is out: a real button that takes a tap and says its pages, none switched off, none \"Coming\"",
    m.rest.length === 39 && m.rest.every((b) => !b.off && !b.soon && !b.locked && /^(6|12) pages$/.test(b.s)) && m.topMarks.every((x) => /^(6|12) pages$/.test(x)), JSON.stringify(m.rest.filter((b) => b.off || b.soon || !/pages$/.test(b.s))));
  tapped = await tap(r.pg, "#moreShelf .bookBtn", "Sid the Seagull");
  const read = await r.pg.waitForFunction(() => document.getElementById("book").classList.contains("show"), null, { timeout: 3000 }).then(() => true, () => false);
  ok("…and a tap on one opens its reader, on its own title page", tapped && read && await r.pg.evaluate(() => (document.querySelector("#bkStage .bktitle") || {}).textContent) === "Sid the Seagull", JSON.stringify({ tapped, read }));
  await r.pg.evaluate(() => document.getElementById("bkClose").click());
  m = await more(r.pg);
  ok("…closing the book comes back to the shelf still open", m.open === "true" && m.box && m.rest.length === 39 && m.rest.every((b) => b.seen));
  tapped = await tap(r.pg, "#moreBtn"); await r.pg.waitForTimeout(100);
  m = await more(r.pg);
  ok("a second tap closes it: no other sound's book left showing", tapped && m.open === "false" && !m.box && m.rest.every((b) => !b.seen) && m.top.length === 9, JSON.stringify({ tapped, open: m.open, box: m.box }));
  await tap(r.pg, "#moreBtn"); await r.pg.waitForTimeout(100);
  await r.pg.reload(); await r.pg.waitForTimeout(500);
  m = await more(r.pg);
  ok("…and it is closed again whenever the page loads, with nothing remembered", m.open === "false" && !m.box && m.rest.length === 0 && m.shown, JSON.stringify({ open: m.open, rest: m.rest.length }));
  ok("…no page errors", r.errs.length === 0, r.errs.join(" | ")); await r.ctx.close();
  r = await shelfAt("2026-10-01T10:00:00-06:00", ["R"], true, "play");
  m = await more(r.pg);
  ok("play mode keeps the whole shelf on top, all 48 and all six Halloween books, so there is no More books control",
    m.top.length === 48 && sameSet(m.top, m.all) && spooky(m.top).length === 6 && !m.shown && !m.box && m.rest.length === 0, JSON.stringify({ top: m.top.length, shown: m.shown })); await r.ctx.close();
  r = await shelfAt("2026-10-01T10:00:00-06:00", []);
  m = await more(r.pg);
  ok("…nor for a child with no sounds picked: every book is already on the shelf", m.top.length === 48 && sameSet(m.top, m.all) && spooky(m.top).length === 6 && !m.shown && m.rest.length === 0, JSON.stringify({ top: m.top.length, shown: m.shown })); await r.ctx.close();
  // WHOSE HALLOWEEN BOOK (Sona.seasonPick, checked on the top shelf further
  // up): here, that the ones it leaves off are behind the button and not
  // gone. K has no Halloween book, so a K child's is Boo the Bat, the one
  // written for everyone; B has one, and it is that same Boo, there by its
  // sound; a child on two sounds has both of theirs.
  r = await shelfAt("2026-10-01T10:00:00-06:00", ["K"]);
  tapped = await tap(r.pg, "#moreBtn"); await r.pg.waitForTimeout(150);
  m = await more(r.pg);
  ok("a child on K in October: Kip's Kite, Kiki the Koala and Boo the Bat on top, the other 45 behind More books, the five other Halloween books among them",
    tapped && JSON.stringify(m.top) === JSON.stringify(["Kip's Kite", "Kiki the Koala", "Boo the Bat on Halloween"]) && m.label === "More books (45)" && m.rest.length === 45 && m.rest.every((b) => b.seen && !b.off) && whole(m) && m.all.length === 48
      && JSON.stringify(spooky(m.rest.map((b) => b.t))) === JSON.stringify(others(["Boo the Bat on Halloween"])),
    JSON.stringify({ top: m.top, label: m.label, rest: m.rest.length, all: m.all.length, spooky: spooky(m.rest.map((b) => b.t)) })); await r.ctx.close();
  r = await shelfAt("2026-10-01T10:00:00-06:00", ["B"]);
  tapped = await tap(r.pg, "#moreBtn"); await r.pg.waitForTimeout(150);
  m = await more(r.pg);
  ok("a child on B: Boo the Bat is their own sound's Halloween book, on top beside Bo's Beach Day, and the other 46 are behind",
    tapped && sameSet(m.top, ["Boo the Bat on Halloween", "Bo's Beach Day"]) && m.label === "More books (46)" && m.rest.length === 46 && whole(m)
      && JSON.stringify(spooky(m.rest.map((b) => b.t))) === JSON.stringify(others(["Boo the Bat on Halloween"])), JSON.stringify({ top: m.top, label: m.label })); await r.ctx.close();
  r = await shelfAt("2026-10-01T10:00:00-06:00", ["R", "S"]);
  tapped = await tap(r.pg, "#moreBtn"); await r.pg.waitForTimeout(150);
  m = await more(r.pg);
  ok("a child on R and S has both their Halloween books on top (14 books) and the other four behind (34 books), never Boo on top",
    tapped && m.top.length === 14 && JSON.stringify(spooky(m.top)) === JSON.stringify(["Rory the Rabbit on Halloween", "Sid the Seagull on Halloween"]) && m.label === "More books (34)" && m.rest.length === 34 && whole(m)
      && JSON.stringify(spooky(m.rest.map((b) => b.t))) === JSON.stringify(others(["Rory the Rabbit on Halloween", "Sid the Seagull on Halloween"])), JSON.stringify({ top: m.top, label: m.label })); await r.ctx.close();
  // outside October the six are on neither shelf (before it and after it)
  r = await shelfAt("2026-09-28T09:00:00-06:00", ["K"]);
  tapped = await tap(r.pg, "#moreBtn"); await r.pg.waitForTimeout(150);
  m = await more(r.pg);
  ok("a child on K in September: their 2 books on top and the 40 behind More books make the whole shelf of 42, with no Halloween book on either",
    tapped && JSON.stringify(m.top) === JSON.stringify(["Kip's Kite", "Kiki the Koala"]) && m.label === "More books (40)" && m.rest.length === 40 && m.rest.every((b) => !b.off && b.seen) && whole(m) && m.all.length === 42 && spooky(m.all).length === 0,
    JSON.stringify({ top: m.top.length, label: m.label, rest: m.rest.length, all: m.all.length })); await r.ctx.close();
  r = await shelfAt("2026-11-01T09:00:00-06:00", ["R"]);
  tapped = await tap(r.pg, "#moreBtn"); await r.pg.waitForTimeout(150);
  m = await more(r.pg);
  ok("…and a child on R in November: 8 on top, 34 behind, 42 in all, Halloween gone from both",
    tapped && m.top.length === 8 && m.topSounds.every((x) => x === "R") && m.label === "More books (34)" && m.rest.length === 34 && whole(m) && m.all.length === 42 && spooky(m.all).length === 0,
    JSON.stringify({ top: m.top.length, label: m.label, rest: m.rest.length, all: m.all.length })); await r.ctx.close();
  // WITHOUT PREMIUM every book but the free one is locked, on either shelf.
  r = await shelfAt("2026-10-01T10:00:00-06:00", ["R"], false);
  tapped = await tap(r.pg, "#moreBtn"); await r.pg.waitForTimeout(150);
  m = await more(r.pg);
  ok("without Premium, all 39 books behind More books are greyed and marked Premium, none switched off; the free book is on top, marked Free",
    tapped && m.rest.length === 39 && m.rest.every((b) => b.locked && !b.off && !b.soon && b.s === "Premium") && whole(m)
      && m.top[0] === "Rory and the Rainbow" && m.topMarks[0] === "Free" && m.topMarks.slice(1).every((x) => x === "Premium"), JSON.stringify(m.rest.filter((b) => !b.locked || b.off || b.s !== "Premium")));
  tapped = await tap(r.pg, "#moreShelf .bookBtn", "Sid the Seagull"); await r.pg.waitForTimeout(100);
  const asked2 = await r.pg.evaluate(() => ({ open: document.getElementById("book").classList.contains("show"), notice: !document.getElementById("bookNotice").hidden, msg: document.getElementById("bookMessage").textContent, url: location.pathname }));
  ok("…and a tap on one shows the same grown-up message, naming the book and the free one, and opens nothing",
    tapped && !asked2.open && asked2.notice && asked2.url === "/library.html" && /grown-up/.test(asked2.msg) && /open Sid the Seagull\./.test(asked2.msg) && /Rory and the Rainbow is free/.test(asked2.msg), JSON.stringify(asked2));
  ok("…no page errors", r.errs.length === 0, r.errs.join(" | ")); await r.ctx.close();
  // The shelf's escape hatch (a child whose own books are all locked sees the
  // free book first) puts a book on top that is not in their sound. It must
  // not ALSO be behind the button.
  r = await shelfAt("2026-10-01T10:00:00-06:00", ["K"], false);
  tapped = await tap(r.pg, "#moreBtn"); await r.pg.waitForTimeout(150);
  m = await more(r.pg);
  ok("without Premium, a child on K: the free book leads the top shelf (4 books) and is not behind More books as well (44 books)",
    tapped && JSON.stringify(m.top) === JSON.stringify(["Rory and the Rainbow", "Kip's Kite", "Kiki the Koala", "Boo the Bat on Halloween"]) && JSON.stringify(m.topMarks) === JSON.stringify(["Free", "Premium", "Premium", "Premium"])
      && m.label === "More books (44)" && m.rest.length === 44 && !m.rest.some((b) => b.t === "Rory and the Rainbow") && m.rest.every((b) => b.locked && b.s === "Premium") && whole(m),
    JSON.stringify({ top: m.top, marks: m.topMarks, label: m.label, rest: m.rest.length })); await r.ctx.close();

  // A SMALL FINGER TAPS TWICE (found in review, 1 Oct 2026). Opening slides
  // the button to the top of the screen, and closing lets the page spring
  // back, so the second tap of a double tap landed on whatever had moved
  // under the finger: a book the child never picked (its reader opened; or,
  // without Premium, "Ask a grown-up to help open ..." came up for it, a push
  // toward the plan screen nobody asked for). Two taps on one spot, 250 ms
  // apart, on a phone-sized screen where the button really does move away.
  const twice = async (w, h, premium) => {
    const d = await shelfAt("2026-10-01T10:00:00-06:00", ["R"], premium, "", { width: w, height: h });
    const look = (p) => d.pg.evaluate((p) => {
      const u = document.elementFromPoint(p.x, p.y), bk = u && u.closest(".bookBtn");
      return { exp: document.getElementById("moreBtn").getAttribute("aria-expanded"), reader: document.getElementById("book").classList.contains("show"), notice: !document.getElementById("bookNotice").hidden,
        msg: document.getElementById("bookMessage").textContent, path: location.pathname, settling: document.querySelector(".wrap").classList.contains("settling"),
        under: !u ? "" : u.closest("#moreBtn") ? "the button" : bk ? "book: " + bk.querySelector(".bt").textContent : u.tagName + (u.id ? "#" + u.id : "") };
    }, p);
    const spot = () => d.pg.evaluate(() => { const b = document.getElementById("moreBtn"); b.scrollIntoView({ block: "nearest" }); const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
    const two = async () => { const p = await spot(); await d.pg.mouse.click(p.x, p.y); await d.pg.waitForTimeout(250); await d.pg.mouse.click(p.x, p.y); await d.pg.waitForTimeout(1300); return look(p); };
    const opened = await two(), closed = await two();
    const out = { opened, closed, errs: d.errs.slice() }; await d.ctx.close(); return out;
  };
  const calm = (x) => !x.reader && !x.notice && x.msg === "" && x.path === "/library.html";
  for (const [w, h] of [[390, 844], [320, 568]]) {
    const prem = await twice(w, h, true), free = await twice(w, h, false);
    ok("a double tap on More books at " + w + "×" + h + " opens it once, though the button slid out from under the finger: no reader opens for a book the child never picked",
      prem.opened.exp === "true" && calm(prem.opened) && prem.opened.under !== "the button", JSON.stringify(prem.opened));
    ok("…and without Premium no grown-up message comes up for a book nobody tapped", free.opened.exp === "true" && calm(free.opened) && free.opened.under !== "the button", JSON.stringify(free.opened));
    ok("…a double tap that closes it closes it once: nothing that sprang back under the finger opens, with Premium or without",
      prem.closed.exp === "false" && calm(prem.closed) && free.closed.exp === "false" && calm(free.closed), JSON.stringify({ prem: prem.closed, free: free.closed }));
    ok("…and the page takes taps again a beat later, with no page errors", !prem.opened.settling && !prem.closed.settling && !free.closed.settling && prem.errs.length + free.errs.length === 0, JSON.stringify({ prem: prem.errs, free: free.errs }));
  }
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
//
// Since 1 Oct 2026 they ask for a word on every page, like the twelve-page
// books (Travis: "we want to make that something that is happening on every
// book"): each entry carries six `keys` beside its six sentences. The
// sentences did not change, and the hash below still says so. So Next is no
// longer on a page when it opens: the mic rests in its place and, on a phone
// that has never been asked, a grown-ups' question comes up. This section
// reads the books the way a family that answers "Not now" does (one answer,
// then Next for the rest of the visit) and presses only buttons a finger
// could. booktest plays the other answer with a fake mic: every page asks,
// and a voice turns it.
{
  const lib = readFileSync(ROOT + "/library.html", "utf8");
  const SIX = ["Rory the Rabbit", "Reba the Robot", "Ruby the Rooster", "Remy the Raccoon", "Rex the Rhino", "Sunny the Seal", "Lily the Lion", "Kiki the Koala", "Shelly the Sheep", "Charlie the Chick", "Theo the Sloth", "Gus the Goat", "Fifi the Fox"];
  const painted = [...lib.matchAll(/title: "([^"]+)", painted: "([a-z]+)", colors: \[[^\]]+\],\s*keys: \[([^\]]+)\],\s*pages: \[([\s\S]*?)\] \}/g)]
    .map((m) => ({ title: m[1], id: m[2], keys: [...m[3].matchAll(/"([^"]+)"/g)].map((x) => x[1]), lines: [...m[4].matchAll(/t: "((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]) }));
  const file = (id, c) => ROOT + "/assets/books/painted/" + id + (c ? "-cover" : "") + ".webp";
  ok("all 13 six-page books are painted, each with its picture and a small cover",
    painted.length === 13 && SIX.every((t) => painted.some((b) => b.title === t)) && painted.every((b) => existsSync(file(b.id)) && existsSync(file(b.id, 1))),
    JSON.stringify(painted.map((b) => b.title)));
  ok("…small enough for a phone: each book's picture under 400 KB, each cover under 40 KB",
    painted.every((b) => existsSync(file(b.id)) && statSync(file(b.id)).size < 400e3 && statSync(file(b.id, 1)).size < 40e3));
  ok("…each with six key words beside its six sentences", painted.length === 13 && painted.every((b) => b.keys.length === 6 && b.lines.length === 6),
    JSON.stringify(painted.filter((b) => b.keys.length !== 6 || b.lines.length !== 6).map((b) => b.title)));
  // the keys sit outside this hash on purpose: a key word can change on
  // Rachel's say-so without a redraw, a sentence can't
  ok("…and the 78 sentences are the ones the pictures were drawn for (change one, redraw its scene)",
    createHash("sha1").update(JSON.stringify(painted.map((b) => [b.title, b.lines]))).digest("hex") === "73b75ea59038d1d5609747e499180af69189158f");

  const reader = async (when, vp) => {
    const ctx = await browser.newContext({ viewport: vp || { width: 390, height: 844 } });
    const pg = await ctx.newPage(); const errs = [], got = [];
    // a button that isn't there to press fails its check in 8 s; it doesn't
    // hang the suite for 30 and take every section below down with it
    pg.setDefaultTimeout(8000);
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
  // a real press, as a finger would: false if the button isn't there to press
  const tap = (pg, sel) => pg.click(sel).then(() => true, () => false);
  const sceneUp = (pg) => pg.waitForFunction(() => { const i = document.querySelector("#bkStage .bkart.scene img"); return !!(i && i.complete && i.naturalWidth); }, null, { timeout: 4000 }).catch(() => {});
  // what the bottom bar and the line show right now
  const bar = (pg) => pg.evaluate(() => {
    const vis = (id) => { const e = document.getElementById(id); return !!(e && !e.hidden && e.offsetParent !== null); }, b = window.__book || {};
    const kw = document.querySelector("#bkStage .bktext .kw"), bub = document.getElementById("bkBubble");
    return { page: b.page, mode: b.mode, primer: !!b.primer, next: vis("bkNext"), mic: vis("bkMic"), skip: vis("bkSkip"),
      kw: kw ? kw.textContent : null, ask: bub && !bub.hidden ? document.getElementById("bkAsk").textContent : null,
      // every orange letter on the line, each with the word it sits in, and the bubble's
      tint: [...document.querySelectorAll("#bkStage .bktext b.snd")].map((x) => x.textContent + " in " + x.parentNode.textContent).join(", "),
      askTint: [...document.querySelectorAll("#bkAsk b.snd")].map((x) => x.textContent).join(", ") };
  });
  // the grown-ups' question comes up once Echo has read the page; "Not now"
  // gives the book back its Next for the rest of the visit
  const question = (pg) => pg.waitForFunction(() => window.__book && window.__book.primer === true, null, { timeout: 6000 }).then(() => true, () => false);
  let r = await reader("2026-10-09T10:00:00");
  await r.pg.locator(".bookBtn", { has: r.pg.locator(".bt", { hasText: /^Rory the Rabbit$/ }) }).click();
  // the title page swaps the shelf's small copy for the full-size first scene once it is cut
  const sharp = await r.pg.waitForFunction(() => /^(blob|data):/.test((document.querySelector("#bkStage img.bkcover") || {}).src || ""), null, { timeout: 4000 }).then(() => true, () => false);
  const seen = [await scene(r.pg, "rory")];
  let fits = true, pressed = await tap(r.pg, "#bkNext");   // the title page's Start
  await sceneUp(r.pg);
  seen.push(await scene(r.pg, "rory"));                    // page 1, as it opens
  const asked = await question(r.pg), asking = await bar(r.pg);
  pressed = await tap(r.pg, "#bkPrimerNo") && pressed;
  const after = await bar(r.pg);
  fits = fits && await fitsNow(r.pg);
  for (let i = 1; i < 6; i++) {
    pressed = await tap(r.pg, "#bkNext") && pressed;
    await sceneUp(r.pg);
    seen.push(await scene(r.pg, "rory"));
    fits = fits && await fitsNow(r.pg);
  }
  ok("the reader shows the cover's scene, then each page's own, in reading order",
    JSON.stringify(seen.map((x) => x && x.best)) === JSON.stringify([0, 0, 1, 2, 3, 4, 5]) && seen.every((x) => x.close), JSON.stringify(seen));
  ok("…the title page at full size once it is cut (the shelf's small copy only until then)", sharp && seen[0].cover && seen[0].fullSize, JSON.stringify(seen[0]));
  ok("…each page's scene a picture of its own, filling the page like a drawn one: whole, full width, its edges carried out, never a small square",
    seen.slice(1).every((x) => !x.cover && x.fullSize && x.fullWidth && x.edges && !x.tall), JSON.stringify(seen.slice(1)));
  ok("…a six-page book asks for its key word: the mic rests where Next was, with Skip, the page's word lit, and a grown-up is asked first",
    asked && seen[1] && seen[1].mode === "wait" && asking.page === 0 && asking.mode === "wait" && asking.primer && !asking.next && asking.mic && asking.skip
      && asking.kw === "rabbit" && asking.ask === "Can you say rabbit?", JSON.stringify({ asked, opened: seen[1] && seen[1].mode, asking }));
  // "Rory the rabbit rides a red rocket." used to light all seven r's; the
  // word to say is "rabbit", and its r is the one the bubble shows
  ok("…and the only orange on the line is that word's own sound, the r of \"rabbit\", the same letter Echo's bubble shows; it stays when the glow goes",
    asking.tint === "r in rabbit" && asking.askTint === "r" && after.tint === "r in rabbit", JSON.stringify({ asking: asking.tint, bubble: asking.askTint, after: after.tint }));
  ok("…after \"Not now\" Next is back, nothing is lit or asked, and every page after reads on with it",
    pressed && after.mode === "next" && after.next && !after.mic && !after.kw && !after.ask && seen.length === 7 && seen.slice(2).every((x) => x && x.mode === "next"),
    JSON.stringify({ pressed, after, modes: seen.map((x) => x && x.mode) }));
  ok("…and the line and Next stay on a 390 x 844 phone below the picture", fits);
  ok("…with the book's picture downloaded once for all six pages", r.got.filter((n) => n === "rory").length === 1, JSON.stringify(r.got));
  ok("…with no page errors", r.errs.length === 0, r.errs.join(" | ")); await r.ctx.close();
  // a small phone: the scene still shows whole above the card
  r = await reader("2026-10-09T10:00:00", { width: 320, height: 568 });
  await r.pg.locator(".bookBtn", { hasText: "Reba the Robot" }).click(); await r.pg.waitForTimeout(200);
  // Start, the grown-up's "Not now" on page 1, then Next to page 2
  const walked = await tap(r.pg, "#bkNext") && await question(r.pg) && await tap(r.pg, "#bkPrimerNo") && await tap(r.pg, "#bkNext");
  await sceneUp(r.pg);
  const small = await scene(r.pg, "reba");
  ok("on a 320 x 568 phone a painted page shows its own scene over its edges, with the line and Next below it",
    walked && small && small.best === 1 && small.close && small.edges && small.mode === "next" && await fitsNow(r.pg), JSON.stringify({ walked, small }));
  ok("…with no page errors", r.errs.length === 0, r.errs.join(" | ")); await r.ctx.close();
  // The End's "Read again" and "All done" used to run off both sides of a
  // 375 px phone: the hidden "Hear it" button between them still took its room.
  const ends = [];
  for (const [w, h] of [[375, 667], [320, 693]]) {
    r = await reader("2026-10-09T10:00:00", { width: w, height: h });
    await r.pg.locator(".bookBtn", { has: r.pg.locator(".bt", { hasText: /^Rory the Rabbit$/ }) }).click(); await r.pg.waitForTimeout(250);
    // Start; "Not now" to the grown-ups' question on page 1; Next six times
    await tap(r.pg, "#bkNext"); await question(r.pg); await tap(r.pg, "#bkPrimerNo");
    for (let i = 0; i < 6; i++) { await tap(r.pg, "#bkNext"); await r.pg.waitForTimeout(120); }
    // Measure only once The End is on screen and its fonts have loaded: a
    // slower runner, or a fallback font still showing, is not the bug.
    await r.pg.waitForFunction(() => /The End!/.test(document.getElementById("bkStage").textContent), null, { timeout: 5000 }).catch(() => {});
    await r.pg.evaluate(() => document.fonts.ready.then(() => true));
    ends.push(await r.pg.evaluate(() => {
      const box = (id) => document.getElementById(id).getBoundingClientRect();
      const p = box("bkPrev"), n = box("bkNext");
      return { w: innerWidth, end: /The End!/.test(document.getElementById("bkStage").textContent), prev: [p.left, p.right], next: [n.left, n.right],
        fits: p.width > 40 && n.width > 40 && p.left >= 0 && n.right <= innerWidth && p.right <= n.left && document.getElementById("bkNext").scrollWidth <= document.getElementById("bkNext").clientWidth };
    }));
    await r.ctx.close();
  }
  ok("…and The End's \"Read again\" and \"All done\" fit a 375 and a 320 px phone", ends.every((e) => e.end && e.fits), JSON.stringify(ends));
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
