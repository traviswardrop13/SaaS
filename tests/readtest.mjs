// Books must NEVER be silent. library.html was the only speaking page without
// a browser-voice fallback, so when /api/tts failed (quota, key, network) the
// reader went quiet while every other page kept talking — and a hung fetch
// left `playing` true, silently disabling "Hear it" for the rest of the
// session. This suite serves a DEAD /api/tts on purpose.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png" };
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  // every TTS call fails — the condition that silenced the books
  if (u.pathname === "/api/tts") { res.writeHead(500); res.end("{}"); return; }
  if (u.pathname.startsWith("/api/")) { res.writeHead(500); res.end("{}"); return; }
  const p = ROOT + u.pathname;
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8153, r));

const browser = await chromium.launch(launchOpts(["--autoplay-policy=no-user-gesture-required"]));
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
let errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.addInitScript(() => {
  // record every browser-voice utterance so we can prove sound was attempted
  window.__spoke = [];
  try {
    const real = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = (u) => { window.__spoke.push(u.text); try { u.onend && setTimeout(u.onend, 10); } catch (e) {} };
    void real;
  } catch (e) {}
  localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Milo", focusSounds: ["R"], onboarded: true }));
});
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

// ── source contract: the fallback exists at all ──
{
  const src = readFileSync(ROOT + "/library.html", "utf8");
  ok("library has a browser-voice fallback", /function speakFallback/.test(src),
    "without it a dead /api/tts leaves the books silent");
  ok("library's TTS fetch can't hang forever", /AbortController/.test(src),
    "a hung fetch leaves `playing` true and kills the Hear button for the session");
}

// ── open a book and press "Hear it" with TTS dead ──
await page.goto("http://localhost:8153/library.html");
await page.waitForTimeout(1200);
await page.evaluate(() => document.querySelector("#shelf .bookBtn").click());
await page.waitForTimeout(600);
await page.evaluate(() => document.getElementById("bkNext").click());   // cover → page 1
await page.waitForTimeout(500);

const pageText = await page.evaluate(() => (document.getElementById("bkText") || {}).textContent || "");
await page.evaluate(() => document.getElementById("bkHear").click());
await page.waitForTimeout(2500);
let spoke = await page.evaluate(() => window.__spoke.slice());
ok("'Hear it' speaks even when /api/tts is dead", spoke.length > 0,
  `nothing was spoken; page text was ${JSON.stringify(pageText.slice(0, 40))}`);

// ── and it must still work the SECOND time (no stuck `playing` flag) ──
await page.evaluate(() => { window.__spoke.length = 0; });
await page.evaluate(() => document.getElementById("bkHear").click());
await page.waitForTimeout(2500);
spoke = await page.evaluate(() => window.__spoke.slice());
ok("'Hear it' still works on a second press", spoke.length > 0,
  "the `playing` flag stuck true after the first failure");

ok("no pageerrors", errs.length === 0, errs.join(" | "));
await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
