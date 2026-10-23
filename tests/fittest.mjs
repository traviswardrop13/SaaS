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
      library: el("libraryApp"), cards: document.querySelectorAll("#activityGroups .game-card").length,
      // Home draws every catalog game but the parked ones (19 Oct 2026)
      playable: window.Sona && Sona.GAME_ACTS ? Object.keys(Sona.GAME_ACTS).filter((k) => !Sona.GAME_ACTS[k].comingSoon).length : -1,
      firstCard: (()=>{const e=document.querySelector("#activityGroups .game-card");if(!e)return null;const r=e.getBoundingClientRect();return{w:r.width,h:r.height};})(),
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
  let m = await measure(page, "today.html?view=arcade");
  ok(dev + " today: no sideways overflow", m.oX <= 1, "oX=" + m.oX);
  ok(dev + " today: library cards have a usable touch area", m.firstCard && m.firstCard.w >= 120 && m.firstCard.h >= 80, JSON.stringify(m.firstCard));
  ok(dev + " today: every playable game's card (none Coming soon) remains visible by scrolling", m.cards === m.playable && m.playable >= 11 && !m.scrollLocked, JSON.stringify(m));
  ok(dev + " today: no retired adventure action is visible", m.go === null, JSON.stringify(m));
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

// The library (Home's Arcade since 22 Oct 2026, STORY1; Home's own first
// screen is measured by homestorytest) is intentionally taller than a phone.
// Its final game and the end of the page must be genuinely reachable, with
// no fixed action covering them. Since 23 Oct 2026 the Arcade is games only
// (Travis: "organize the arcade so that there are no books in there"): the
// Books card that used to end it is gone, so the page now ends on its last
// shelf and the age note, and the bookshelf's one way in is Home's Books
// door, which must still be reachable and tappable on the smallest phone.
{
  const page = await browser.newPage({viewport:{width:320,height:568}});
  await page.addInitScript(() => {
    localStorage.setItem("sona.profile.v1", JSON.stringify({childName:"Leo",childAge:"4",focusSounds:["P"],onboarded:true,voiceOn:false}));
  });
  await measure(page,"today.html?view=arcade");
  // reachable = on screen after scrolling to it, and the point a finger
  // lands on is the thing itself, not a fixed bar or notice over it
  const reach = (loc) => loc.evaluate(e => {
    const r=e.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return {visible:r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,reachable:hit===e||e.contains(hit),overflowX:document.documentElement.scrollWidth-innerWidth};
  });
  // Simple play now lays out two to a row like the Arcade shelf (23 Oct
  // 2026; every little-kid card was a full-width row before). A four-year-old
  // sees it first, so its first two cards must share a row and each keep a
  // real touch area at 320 px, and a lone last card stretches across.
  const simple = await page.evaluate(() => {
    const shelf=document.querySelector('#activityGroups .activity-group[data-group="simple"]');
    const cards=shelf?[...shelf.querySelectorAll(".game-card")].map(c=>{const r=c.getBoundingClientRect();return{t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};}):[];
    const grid=shelf&&shelf.querySelector(".game-grid");
    return {first:(document.querySelector("#activityGroups .activity-group")||{}).dataset?.group,n:cards.length,a:cards[0],b:cards[1],last:cards[cards.length-1],gridW:grid?Math.round(grid.getBoundingClientRect().width):0};
  });
  ok("small portrait today: Simple play, first for a four-year-old, shows two games a row, each a usable touch area",
    simple.first==="simple"&&simple.n>=2&&Math.abs(simple.a.t-simple.b.t)<=1&&[simple.a,simple.b].every(c=>c.w>=120&&c.h>=80&&c.w<simple.gridW*0.6),JSON.stringify(simple));
  ok("small portrait today: …and a lone last Simple play card spans the row", simple.n%2===0||simple.last.w>=simple.gridW-1,JSON.stringify(simple));
  const cards = page.locator("#activityGroups .game-card");
  const last = cards.last();
  await last.scrollIntoViewIfNeeded();
  const target = await reach(last);
  ok("small portrait today: the final game can be reached and tapped", target.visible&&target.reachable,JSON.stringify(target));
  ok("small portrait today: no sideways overflow",target.overflowX<=1,JSON.stringify(target));
  // the age note is the page's last line now that no Books card follows it
  const note = page.locator("#libraryApp .age-note");
  await note.scrollIntoViewIfNeeded();
  const end = await reach(note);
  ok("small portrait today: the end of the Arcade (its age note) is reachable, nothing fixed over it", end.visible&&end.reachable,JSON.stringify(end));
  ok("small portrait today: the Arcade has no Books card and no book anywhere in it",
    await page.locator("#booksCard, #libraryApp .book-card").count()===0);
  const heading=await page.locator(".library-intro h1").boundingBox();
  ok("small portrait today: content scrolls rather than clipping below the fold", heading.y<0,JSON.stringify(heading));
  // Home's Books door, the bookshelf's one way in: reachable and tappable at
  // 320×568, and a tap opens the bookshelf
  await measure(page,"today.html");
  const door = page.locator("#homeBooksBtn");
  await door.scrollIntoViewIfNeeded();
  const dr = await reach(door);
  ok("small portrait Home: the Books door is reachable and tappable", dr.visible&&dr.reachable&&dr.overflowX<=1,JSON.stringify(dr));
  await Promise.all([page.waitForURL(/\/library\.html$/,{timeout:5000}).catch(()=>{}), door.click()]);
  ok("small portrait Home: …and a tap on it opens the bookshelf", /\/library\.html$/.test(page.url()), page.url());
  await page.close();
}

for (const [dev, w, h] of LANDSCAPE) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript(() => {
    localStorage.setItem("sona.profile.v1", JSON.stringify({ childName: "Leo", focusSounds: ["R"], onboarded: true }));
    localStorage.setItem("sona.micok", "1");
  });
  let m = await measure(page, "today.html?view=arcade");
  ok(dev + " today: game cards have a real size in landscape", m.cards === m.playable && m.playable >= 11 && m.firstCard && m.firstCard.w >= 120 && m.firstCard.h >= 80, JSON.stringify(m));
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
    return { text: e.getAttribute("aria-label"), dots:e.querySelectorAll(".path-dot").length, over: e.scrollWidth > e.clientWidth + 1, h: e.getBoundingClientRect().height, fs: parseFloat(getComputedStyle(e).fontSize) };
  });
  ok("the charge header fits on one line at 390px", !!hdr && !hdr.over && hdr.h <= 44, JSON.stringify(hdr));
  ok("…five picture dots name the current adventure step accessibly", !!hdr && hdr.dots === 5 && /round \d+ of \d+/i.test(hdr.text), hdr && hdr.text);
  await page.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
