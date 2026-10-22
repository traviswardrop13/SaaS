// BOOK1: every book asks the child to say one word from the page before the
// page turns. Story Time always did; the Library's sound stories and the
// daily chapter were tap-through, so a child could finish a whole book
// without making a sound. Pins:
//   - every page of every book has a word to say, and in a sound story that
//     word carries the book's sound (one word, in isolation — never a phrase)
//   - Next does NOT turn the page while the child is silent: it is the mic
//   - a voiced turn does turn it
//   - Sona.bookTurn hears silence as silence and a voice as a voice
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8157, r));
const BASE = "http://localhost:8157";

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

const browser = await chromium.launch(launchOpts(["--autoplay-policy=no-user-gesture-required"]));
const ctx = await browser.newContext({ permissions: ["microphone"], viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  // a mic that is silent until the test turns the voice on (a loud tone —
  // plenty to read as voicing, and nothing a quiet room produces)
  navigator.mediaDevices.getUserMedia = () => {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const dst = ac.createMediaStreamDestination();
    const g = ac.createGain(); g.gain.value = 0; g.connect(dst);
    const osc = ac.createOscillator(); osc.frequency.value = 220; osc.connect(g); osc.start();
    window.__voice = (on) => { g.gain.value = on ? 0.8 : 0; };
    return Promise.resolve(dst.stream);
  };
  try { window.speechSynthesis.speak = (u) => { try { u.onend && setTimeout(u.onend, 5); } catch (e) {} }; } catch (e) {}
  localStorage.setItem("sona.freeera.v1", "post"); localStorage.setItem("sona.freeera2.v1", "done");
  localStorage.setItem("sona.freeera3.v1", "done"); localStorage.setItem("sona.freeera4.v1", "done");
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", childAge: "7", focusSounds: ["R"], onboarded: true }));
});
const pg = await ctx.newPage();
const errs = [];
pg.on("pageerror", (e) => errs.push(e.message));

// ── every page has a word ──────────────────────────────────────────────
// The library filters its shelf to the child's sounds, so read every book
// straight from the source rather than from the rendered shelf.
const lib = readFileSync(ROOT + "/library.html", "utf8");
const from = lib.indexOf("var STORIES = [");
const lit = lib.slice(from + "var STORIES = ".length, lib.indexOf("\n    ];", from) + 6);
const STORIES = new Function("return " + lit)();
ok("the library has its sound stories", STORIES.length >= 10, STORIES.length);

await pg.goto(BASE + "/library.html");
const missing = await pg.evaluate((books) => {
  const bad = [];
  books.forEach((b) => b.pages.forEach((p, i) => {
    const w = Sona.pageWord(p.t, b.sound), s = b.sound.toLowerCase();
    const inText = new RegExp("\\b" + w + "\\b", "i").test(p.t.replace(/'/g, ""));
    if (!w || !inText || (w.indexOf(s) < 0 && !(s === "k" && /^c[^hiey]/.test(w))) || /\s/.test(w)) bad.push(b.title + " p" + (i + 1) + ": " + JSON.stringify(w));
  }));
  return bad;
}, STORIES);
ok("every page of every sound story has one word, from the page, carrying the book's sound", missing.length === 0, missing.join(" | "));

const chapters = await pg.evaluate(() => {
  const bad = [];
  Sona.EPISODES.forEach((ep) => [ep.open].concat(ep.beats || []).forEach((t, i) => {
    ["R", "S", "L", "K"].forEach((snd) => { const w = Sona.pageWord(t, snd); if (!w || /\s/.test(w)) bad.push(ep.id + " p" + (i + 1) + " " + snd); });
  }));
  return bad;
});
ok("every page of every chapter has a word to say, whatever the child's sound", chapters.length === 0, chapters.join(" | "));
ok("/s/ never picks a /sh/ word, /t/ never a /th/ word", await pg.evaluate(() => Sona.pageWord("Shelly sees the sun", "S") === "sees" && Sona.pageWord("The thin tiger", "T") === "tiger"));

// ── the mic itself: silence is silence, a voice is a voice ─────────────
const heard = await pg.evaluate(async () => {
  const quiet = await Sona.bookTurn({ maxMs: 1500 });
  setTimeout(() => window.__voice(true), 500);
  const loud = await Sona.bookTurn({ maxMs: 3000 });
  window.__voice(false);
  return { quiet: quiet.spoke, loud: loud.spoke };
});
ok("bookTurn hears a silent room as no turn", heard.quiet === false, JSON.stringify(heard));
ok("bookTurn hears a voice as a turn", heard.loud === true, JSON.stringify(heard));

// ── a Library book: silence holds the page, a voice turns it ──────────
await pg.goto(BASE + "/library.html");
await pg.waitForTimeout(300);
await pg.evaluate(() => document.querySelector("#shelf button, #shelf [onclick], #shelf > *").click());
await pg.waitForTimeout(200);
await pg.evaluate(() => document.getElementById("bkNext").click()); // cover → page 1
await pg.waitForTimeout(400);
const ribbon = () => pg.evaluate(() => { const r = document.querySelector("#bkStage .ribbon"); return r ? r.textContent : "cover/end"; });
const p1 = await ribbon();
for (let k = 0; k < 4; k++) { await pg.evaluate(() => document.getElementById("bkNext").click()); await pg.waitForTimeout(250); }
await pg.waitForTimeout(2500);
ok("library: tapping Next while silent does not turn the page", (await ribbon()) === p1, p1 + " → " + (await ribbon()));
ok("library: Next says it wants the word", /say it/i.test(await pg.locator("#bkNext").innerText()), await pg.locator("#bkNext").innerText());
ok("library: the page shows which word to say", /say/i.test(await pg.locator("#bkSay").innerText()) && (await pg.locator("#bkSay b").innerText()).length > 1);
await pg.evaluate(() => window.__voice(true));
await pg.evaluate(() => document.getElementById("bkNext").click());
await pg.waitForFunction((t) => { const r = document.querySelector("#bkStage .ribbon"); return r && r.textContent !== t; }, p1, { timeout: 9000 }).catch(() => {});
await pg.evaluate(() => window.__voice(false));
ok("library: saying the word turns the page", (await ribbon()) !== p1, p1 + " → " + (await ribbon()));

// ── the daily chapter: same rule ───────────────────────────────────────
await pg.goto(BASE + "/chapter.html");
await pg.waitForTimeout(500);
const text = () => pg.evaluate(() => document.getElementById("text").textContent);
const c1 = await text();
for (let k = 0; k < 4; k++) { await pg.evaluate(() => document.getElementById("next").click()); await pg.waitForTimeout(250); }
await pg.waitForTimeout(2500);
ok("chapter: tapping Next while silent does not turn the page", (await text()) === c1);
ok("chapter: Next says it wants the word", /say it/i.test(await pg.locator("#next").innerText()), await pg.locator("#next").innerText());
await pg.evaluate(() => window.__voice(true));
await pg.evaluate(() => document.getElementById("next").click());
await pg.waitForFunction((t) => document.getElementById("text").textContent !== t, c1, { timeout: 9000 }).catch(() => {});
await pg.evaluate(() => window.__voice(false));
ok("chapter: saying the word turns the page", (await text()) !== c1);

// ── Story Time already did this; keep it that way ──────────────────────
const story = readFileSync(ROOT + "/story.html", "utf8");
ok("Story Time still turns a page only on a passed turn", /if\(sa\.pass\)\{[\s\S]{0,400}pi\+\+/.test(story));

ok("no page errors", errs.length === 0, errs.join(" | "));
await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "all passed");
process.exit(fails ? 1 : 0);
