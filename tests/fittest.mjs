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

const PORTRAIT = [["SE", 375, 667], ["X", 375, 812], ["14", 390, 844], ["ProMax", 430, 932], ["X-zoomed", 320, 693]];
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
      thumbs: el("thumbs"), hero: el("heroCard"), mic: el("micWrap"), panel: el("gamePanel"),
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
  ok(dev + " today: thumbs clear the home bar", m.thumbs && m.thumbs.bottom <= m.innerH - HOME_BAR + 1, m.thumbs && m.thumbs.bottom + "/" + (m.innerH - HOME_BAR));
  ok(dev + " today: hero never collapses", m.hero && m.hero.h >= 150, m.hero && "heroH=" + m.hero.h);
  m = await measure(page, "charge.html?game=arcade-slice.html");
  ok(dev + " charge: mic clears the home bar", m.mic && m.mic.bottom <= m.innerH - HOME_BAR + 1, m.mic && m.mic.bottom + "/" + (m.innerH - HOME_BAR));
  ok(dev + " charge: no sideways overflow", m.oX <= 1, "oX=" + m.oX);
  await page.close();
}

for (const [dev, w, h] of LANDSCAPE) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript(() => {
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Leo", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.micok", "1");
  });
  let m = await measure(page, "today.html");
  ok(dev + " today: hero has a real size in landscape", m.hero && m.hero.h >= 200, m.hero && "heroH=" + m.hero.h);
  ok(dev + " today: landscape scrolls instead of clipping", !m.scrollLocked, "overflow still hidden");
  m = await measure(page, "charge.html?game=arcade-slice.html");
  ok(dev + " charge: landscape scrolls instead of clipping", !m.scrollLocked, "overflow still hidden");
  await page.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
