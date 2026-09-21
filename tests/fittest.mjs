// Device-matrix fit suite: the kid screens must be USABLE on every iPhone —
// portrait (SE → Pro Max), iOS zoomed-display, and landscape. "Fits" means:
// no horizontal overflow ever; on locked portrait layouts the last element
// clears a simulated 34px home-indicator inset; the hero/practice card never
// collapses; and landscape (short-wide) unlocks scrolling instead of clipping.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", png: "image/png", css: "text/css", woff2: "font/woff2", webmanifest: "application/manifest+json" };
const srv = createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (existsSync(p) && !p.endsWith("/")) { res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(p)); }
  else { res.writeHead(404); res.end(); }
});
await new Promise((r) => srv.listen(8143, r));

const browser = await chromium.launch(launchOpts());
let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };
const HOME_BAR = 34; // real-device bottom inset headless runs don't simulate

const PORTRAIT = [["SE", 375, 667], ["X", 375, 812], ["14", 390, 844], ["ProMax", 430, 932], ["X-zoomed", 320, 693],
  // active-call / hotspot pill steals height — the layout must absorb it
  ["X-callpill", 375, 788], ["ProMax-callpill", 430, 908]];
const LANDSCAPE = [["X-land", 812, 375], ["ProMax-land", 932, 430]];

async function measure(page, url) {
  await page.goto("http://localhost:8143/" + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  return page.evaluate(() => {
    const doc = document.documentElement;
    const el = (id) => { const e = document.getElementById(id); if (!e) return null; const cs = getComputedStyle(e); if (cs.display === "none") return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }; };
    return {
      oX: Math.round(doc.scrollWidth - innerWidth),
      oY: Math.round(doc.scrollHeight - innerHeight),
      scrollLocked: getComputedStyle(document.body).overflowY === "hidden" || getComputedStyle(doc).overflowY === "hidden",
      hero: el("heroCard"), cap: el("heroCap"), thumbs: document.querySelectorAll("#thumbs .thumb").length,
      mic: el("micWrap"), build: el("reveals"), go: el("goBtn"),
      innerH: innerHeight,
    };
  });
}

for (const [dev, w, h] of PORTRAIT) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript(() => {
    // worst-case rows visible: founding banner + check nudge, mic primer skipped
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Leo", focusSounds: ["R"], onboarded: true, earlyAdopter: true }));
    localStorage.setItem("sona.micok", "1");
  });
  let m = await measure(page, "today.html");
  ok(dev + " today: no sideways overflow", m.oX <= 1, "oX=" + m.oX);
  // the sticker-book home: the hero card breathes into whatever height is left
  ok(dev + " today: hero card has a real size", m.hero && m.hero.h >= 150, m.hero && "heroH=" + (m.hero && m.hero.h));
  ok(dev + " today: the day's three game cards all fit", m.thumbs === 3, "thumbs=" + m.thumbs);
  // goBtn is the fixed bottom CTA; on hardware env(safe-area-inset-bottom)
  // adds the home-bar gap (0 in headless), so assert against the page floor.
  ok(dev + " today: LET'S GO never overflows the page", m.go && m.go.bottom <= m.innerH - 15, m.go && m.go.bottom + "/" + (m.innerH - 15));
  // the caption plate must never be pushed under the CTA
  ok(dev + " today: hero caption clears the CTA", m.cap && m.go && m.cap.bottom <= m.go.top + 1, JSON.stringify({ c: m.cap, g: m.go }));
  m = await measure(page, "charge.html?game=arcade-slice.html");
  ok(dev + " charge: mic clears the home bar", m.mic && m.mic.bottom <= m.innerH - HOME_BAR + 1, m.mic && m.mic.bottom + "/" + (m.innerH - HOME_BAR));
  ok(dev + " charge: no sideways overflow", m.oX <= 1, "oX=" + m.oX);
  // Workstream A: the build centerpiece must sit clear above the mic
  ok(dev + " charge: build clears the mic", m.build && m.mic && m.build.bottom <= m.mic.top + 1, JSON.stringify({ b: m.build, mic: m.mic }));
  // Story Time: instruction pill must never overlap the controls (the old
  // absolute anchor collided with Read-it-to-me on every device)
  await page.goto("http://localhost:8143/story.html?sound=R", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => {
    const r = (id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
    return { prompt: r("bubble"), hear: r("hear"), mic: r("micBtn"), oX: Math.round(document.documentElement.scrollWidth - innerWidth), innerH: innerHeight };
  });
  ok(dev + " story: Echo's bubble clears the buttons", st.prompt && st.hear && st.prompt.bottom <= st.hear.top + 1, JSON.stringify({ p: st.prompt, h: st.hear }));
  // padding-floor rule (see goBtn note above): #bottom pads 16px + env(),
  // env()=0 headless — assert against the page's own 16px, not the device inset
  ok(dev + " story: mic never overflows the page", st.mic && st.mic.bottom <= st.innerH - 15, st.mic && st.mic.bottom + "/" + (st.innerH - 15));
  ok(dev + " story: no sideways overflow", st.oX <= 1, "oX=" + st.oX);
  await page.close();
}

// A small portrait screen may scroll, but the longer adventure preview must
// still occupy its own space between the star jar and the game choices.
{
  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await page.addInitScript(() => {
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Leo", focusSounds: ["R"], onboarded: true, earlyAdopter: true }));
    localStorage.setItem("sona.micok", "1");
  });
  await measure(page, "today.html");
  const layout = await page.evaluate(() => {
    const rect = (id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    };
    return { jar: rect("jarRow"), hero: rect("heroCard"), caption: rect("heroCap"), choices: rect("upNextLbl") };
  });
  ok("small portrait today: the hero clears the star jar",
    layout.jar.bottom <= layout.hero.top + 1, JSON.stringify(layout));
  ok("small portrait today: the caption clears the game choices",
    layout.caption.bottom <= layout.choices.top + 1, JSON.stringify(layout));
  // Exercise actual scrolling, rather than accepting a CTA positioned below
  // the screen inside an overflow-hidden container.
  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(200);
  const cta = await page.evaluate(() => {
    const button = document.getElementById("goBtn");
    const r = button.getBoundingClientRect();
    const target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      visible: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
      reachable: target === button || button.contains(target),
      overflowX: document.documentElement.scrollWidth - innerWidth,
    };
  });
  ok("small portrait today: the adventure button is reachable after scrolling", cta.visible && cta.reachable, JSON.stringify(cta));
  ok("small portrait today: no sideways overflow", cta.overflowX <= 1, JSON.stringify(cta));
  await page.close();
}

for (const [dev, w, h] of LANDSCAPE) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript(() => {
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Leo", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.micok", "1");
  });
  let m = await measure(page, "today.html");
  ok(dev + " today: hero card has a real size in landscape", m.hero && m.hero.h >= 200, m.hero && "heroH=" + (m.hero && m.hero.h));
  ok(dev + " today: landscape scrolls instead of clipping", !m.scrollLocked, "overflow still hidden");
  m = await measure(page, "charge.html?game=arcade-slice.html");
  ok(dev + " charge: landscape scrolls instead of clipping", !m.scrollLocked, "overflow still hidden");
  await page.close();
}

// ── the charge header is one line, not two, not "P…" ──
// "Round 1 of 5 · P sound" wrapped to two lines on a 390px phone between the
// close button, the ticket pill and the star count; nowrap alone turned it
// into "P…". The label is shorter now and must fit without overflowing.
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("http://localhost:8143/charge.html?daily=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const hdr = await page.evaluate(() => {
    const e = document.getElementById("ctxLine"); if (!e) return null;
    return { text: e.textContent, over: e.scrollWidth > e.clientWidth + 1, h: e.getBoundingClientRect().height, fs: parseFloat(getComputedStyle(e).fontSize) };
  });
  ok("the charge header fits on one line at 390px", !!hdr && !hdr.over && hdr.h <= hdr.fs * 1.8, JSON.stringify(hdr));
  ok("…and still names the round and the sound", !!hdr && /Round \d+ of \d+ · \S+/.test(hdr.text), hdr && hdr.text);
  await page.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
