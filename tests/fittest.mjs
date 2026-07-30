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
      street: el("street"), houses: (document.querySelectorAll("#street .house") || []).length,
      mic: el("micWrap"), build: el("reveals"),
      // CITY1: the CTA is per-house, so measure the one on the slide in view
      go: (function(){ const s = document.getElementById("street"); if (!s) return null;
        const ix = s.clientWidth ? Math.round(s.scrollLeft / s.clientWidth) : 0;
        const b = (s.children[ix] || {}).querySelector ? s.children[ix].querySelector(".hgo") : null;
        if (!b) return null; const r = b.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }; })(),
      plate: (function(){ const s = document.getElementById("street"); if (!s) return null;
        const ix = s.clientWidth ? Math.round(s.scrollLeft / s.clientWidth) : 0;
        const b = (s.children[ix] || {}).querySelector ? s.children[ix].querySelector(".hplate") : null;
        if (!b) return null; const r = b.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; })(),
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
  // CITY1: the street fills real height and every house is on it
  ok(dev + " today: street has a real size", m.street && m.street.h >= 150, m.street && "streetH=" + (m.street && m.street.h));
  ok(dev + " today: every house renders", m.houses === 7, "houses=" + m.houses);
  // the house CTA sits inside the slide; on hardware env(safe-area-inset-bottom)
  // adds the home-bar gap (0 in headless), so assert against the page floor.
  ok(dev + " today: house CTA never overflows the page", m.go && m.go.bottom <= m.innerH - 15, m.go && m.go.bottom + "/" + (m.innerH - 15));
  // the plate must not sit under the CTA — the whole point is reading the chapter
  ok(dev + " today: chapter plate clears the CTA", m.plate && m.go && m.plate.bottom <= m.go.top + 1, JSON.stringify({ p: m.plate, g: m.go }));
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

for (const [dev, w, h] of LANDSCAPE) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript(() => {
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Leo", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.micok", "1");
  });
  let m = await measure(page, "today.html");
  ok(dev + " today: street has a real size in landscape", m.street && m.street.h >= 200, m.street && "streetH=" + (m.street && m.street.h));
  ok(dev + " today: landscape scrolls instead of clipping", !m.scrollLocked, "overflow still hidden");
  m = await measure(page, "charge.html?game=arcade-slice.html");
  ok(dev + " charge: landscape scrolls instead of clipping", !m.scrollLocked, "overflow still hidden");
  await page.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
