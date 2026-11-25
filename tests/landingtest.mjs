// LANDING1: speaksona.com's forms, driven in a real browser against fake
// routes, so what is posted, and where the visitor ends up, is what is checked.
//
// The clinicians' homepage at / (the same page as /plans) emails the Sona Pro
// trial's sign-in link.
// The parent page at /for-parents keeps its one email and its family app
// destination.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import nextConfig from "../next.config.js";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const FOR_SLPS = process.env.FOR_SLPS_TEST_HTML || ROOT + "/for-slps.html";
const rewrites = new Map((await nextConfig.rewrites()).map(rule => [rule.source, rule.destination]));
const oldClinicianUrl = (await nextConfig.redirects()).find(rule => rule.source === "/for-slps");
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", png: "image/png", jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", woff2: "font/woff2", webmanifest: "application/manifest+json" };
let fails = 0;
// The plan /plans left for the dashboard: {plan, at}, written just now
// (SLPSITE1, 18 Nov 2026: a pick counts for an hour). Run in the page.
const WANT = () => { try { const w = JSON.parse(localStorage.getItem("sona.slp.wantplan")); return w && typeof w.at === "number" && Math.abs(Date.now() - w.at) < 60000 ? w.plan : null; } catch (e) { return localStorage.getItem("sona.slp.wantplan") === null ? null : "?"; } };
const ok = (name, cond, detail) => { if (!cond) fails++; console.log((cond ? "PASS " : "FAIL ") + name + (cond || detail === undefined ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); };

// What the fake routes answer, and what they were sent. charterReply null
// means /api/charter does not answer at all.
let posts = [], leadReply = { ok: true, captured: true }, authReply = { ok: true, sent: true, signedIn: true }, charterReply = null;
// /api/slp/auth/me: null answers nobody signed in (the fake 404), as a fresh
// visitor's browser does; set, the clinician signed in on this browser.
let meReply = null;
// /api/slp/plan's GET for a signed-in visitor: null answers the fake 404.
let planReply = null;
// /plans served from this text instead of the file, when set: the page with
// Sona Clinic switched on (SLPSITE1), which ships off.
let forSlpsOverride = null;
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (req.method === "POST" && (u.pathname === "/api/lead" || u.pathname === "/api/slp/auth/request")) {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      posts.push({ path: u.pathname, body: JSON.parse(body || "{}") });
      const reply = u.pathname === "/api/lead" ? leadReply : authReply;
      res.writeHead(reply.ok ? 200 : (reply.status || 400), { "content-type": "application/json" });
      res.end(JSON.stringify(reply));
    });
    return;
  }
  if (u.pathname === "/api/slp/auth/me" && meReply) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(meReply)); return; }
  if (u.pathname === "/api/slp/plan" && planReply) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(planReply)); return; }
  if (u.pathname === "/api/charter" && charterReply) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(charterReply)); return; }
  if (u.pathname.startsWith("/api/")) { res.writeHead(404); res.end("{}"); return; }
  if (u.pathname === oldClinicianUrl?.source) {
    res.writeHead(oldClinicianUrl.permanent ? 308 : 307, { location: oldClinicianUrl.destination + u.search });
    res.end();
    return;
  }
  const route = rewrites.get(u.pathname) || u.pathname;
  const p = route === "/for-slps.html" ? FOR_SLPS : ROOT + route;
  if (p === FOR_SLPS && forSlpsOverride !== null) { res.writeHead(200, { "content-type": "text/html" }); res.end(forSlpsOverride); return; }
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8163, "127.0.0.1", r));
const origin = "http://127.0.0.1:8163";
const browser = await chromium.launch(launchOpts());

async function fresh(opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, userAgent: opts.ua, reducedMotion: opts.reducedMotion });
  // Nothing leaves for the real internet; the App Store answers with a stub.
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(origin)) return route.continue();
    if (url.startsWith("https://apps.apple.com/")) return route.fulfill({ status: 200, contentType: "text/html", body: "<title>App Store</title>" });
    return route.abort();
  });
  await context.addInitScript(() => {
    window.__track = [];
    Object.defineProperty(window, "sonaTrack", { configurable: true, get: () => (e) => window.__track.push(e), set() {} });
  });
  if (opts.watch) await context.addInitScript(watchLeaving);
  // A set clock (BF1): the page's Date.now starts at opts.now and runs on.
  // The clinicians' pages run after Black Friday unless a test says when,
  // so their ordinary words hold whatever day this suite runs.
  const now = opts.now !== undefined ? opts.now : /^\/for-parents/.test(opts.path || "/") ? null : "2026-12-15T19:00:00Z";
  if (now) await context.addInitScript((t) => { const T = Date.parse(t), real = Date.now, start = real(); Date.now = () => T + (real() - start); }, now);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + (opts.path || "/") + "?utm_source=fb&utm_campaign=launch&fbclid=abc123" + (opts.query || ""));
  return { context, page, errors };
}
// WHAT THE VISITOR SEES AS THE PAGE LEAVES (4 Oct 2026). Nothing can be read
// from a page whose navigation is pending: every call into it hangs until the
// next page has arrived, and by then the answer is gone. So the page's own
// "navigate" event is caught instead. It notes the form, the panel and the
// button at that instant, and how long after the server's yes it came, then
// cancels the navigation. The page is left showing, which is also what
// happens when an iPhone opens the App Store over Safari.
function watchLeaving() {
  window.__left = [];
  const realFetch = window.fetch;
  window.fetch = function (u) {
    return realFetch.apply(this, arguments).then((r) => { if (String(u).indexOf("/api/lead") >= 0) window.__yesAt = performance.now(); return r; });
  };
  window.navigation.addEventListener("navigate", (e) => {
    const to = new URL(e.destination.url);
    if (to.origin === location.origin && to.pathname === location.pathname) return;
    const g = (id) => document.getElementById(id), shown = (el) => !!el && !!(el.offsetWidth || el.offsetHeight);
    window.__left.push({
      to: e.destination.url, ms: Math.round(performance.now() - (window.__yesAt || 0)),
      form: shown(g("signup")), panel: shown(g("sent")), getApp: shown(g("nextGo")),
      btn: g("fGo").textContent, off: g("fGo").disabled, track: (window.__track || []).slice(),
    });
    e.preventDefault();
  });
}
async function fill(page, email) {
  await page.fill("#fEmail", email);
}
// WAIT FOR THE SCROLL, DON'T GUESS IT (25 Sep 2026): a fixed 700 ms wait
// turned main red on GitHub's slower runner, on a page that worked.
const settles = (page, fn) => page.waitForFunction(fn, null, { timeout: 5000, polling: 50 }).then(() => true, () => false);
const leftFor = (page, path, ms) => page.waitForURL((u) => !String(u).startsWith(origin + path + "?"), { timeout: ms }).then(() => true, () => false);

// ════════════════════════ /for-parents: the family page ════════════════════════
const PARENTS = readFileSync(ROOT + "/parents.html", "utf8");
const P_READY = /var APP_READY = true;/.test(PARENTS);
const P_NOTE = (PARENTS.match(/var LAUNCH_NOTE = "([^"]+)";/) || [])[1];
ok("the parent page carries the launch note", !!P_NOTE);

// ── what a parent sees, and the one form ──
{
  const { context, page, errors } = await fresh({ path: "/for-parents" });
  // Travis's own line (4 Oct 2026: "I want to make the website say speech
  // practice kids love"); it was the parent ads' "…kids ask for."
  ok("/for-parents serves the parent page: 'Speech practice kids love.'", (await page.textContent("h1")) === "Speech practice kids love.");
  ok("its form is an email box and one button: no 'I'm a…', no name",
    await page.isVisible("#fEmail") && (await page.$("#fRole")) === null && (await page.$("#fName")) === null &&
    (await page.$$("#signup input")).length === 1 && (await page.$$("#signup button")).length === 1);
  ok("the hero shows the new Echo and both game screens", await page.evaluate(() => {
    const s = document.querySelector(".stage");
    return !!s && !!s.querySelector('img[src="/assets/site/echo.webp"]') && !!s.querySelector('img[src="/assets/site/hero-slice.webp"]') && !!s.querySelector('img[src="/assets/site/hero-piano.webp"]');
  }));
  ok("…and Echo's bubble says a sound", /^[a-z]+!$/.test((await page.textContent("#bubble")).trim()));
  // A PARENT PAGE HAS NO SIGN IN (26 Sep 2026). From 22 Oct 2026 no way to
  // the clinician page at all; from 12 Nov 2026 (Travis: findable, "a small
  // 'For speech therapists' link") exactly one, in the footer.
  ok("the header has no Sign in: the logo and one Start free", await page.evaluate(() => {
    const h = document.querySelector("header");
    return h.querySelectorAll("a").length === 1 && !/sign in/i.test(h.textContent) && !!h.querySelector("#topGo");
  }));
  ok("…and that button waits until the hero's own form has scrolled away", !(await page.isVisible("#topGo")));
  ok("the one link to the clinician page is the footer's 'For speech therapists'", await page.evaluate(() => {
    const all = [...document.querySelectorAll('a[href^="/slp"], footer a[href="/"]')];
    return all.length === 1 && all[0].closest("footer") && all[0].textContent === "For speech therapists" && all[0].getAttribute("href") === "/";
  }));
  ok("…and nothing else on the page speaks to clinicians", await page.evaluate(() => {
    const main = document.querySelector("main").innerText;
    // 29 Sep 2026: Rachel's byline now reads "MS, CF-SLP" (Travis) — her credential, not copy aimed at clinicians.
    return !/caseload|dashboard|(?<!CF-)\bSLPA?\b|clinician/i.test(main);
  }));
  const fit = await page.evaluate(() => { const r = document.getElementById("signup").getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth }; });
  ok("on a phone the form fits the screen, and nothing on the page scrolls sideways", fit.l >= 0 && fit.r <= fit.w && !fit.overflow, fit);

  // THE ORDER (Travis, 4 Oct 2026): the games and books "passing across the
  // screen I want that a lot higher up on the website and I also want
  // Rachel's bio higher up". They were fifth and seventh; they are second and
  // third, straight after the hero.
  const order = await page.evaluate(() => [].map.call(document.querySelectorAll("main > section"), (sec) => sec.id || sec.className));
  ok("the sections run hero, the games and books, Rachel, then the rest", order.join(" ") === "hero library rachel familiar game how homework safe faqs final", order.join(" "));
  // The hero's wave is the next section rising into it. Moving a section
  // changes which colours meet there, and a wave left in the old one is a
  // stripe of the wrong colour across the top of the page.
  const seam = await page.evaluate(() => {
    const next = document.querySelector(".hero").nextElementSibling;
    return { next: next.id, wave: getComputedStyle(document.querySelector(".hero .wave path")).fill, under: getComputedStyle(next).backgroundColor };
  });
  ok("…and the hero's wave is the colour of the section under it", seam.next === "library" && seam.wave === seam.under, seam);
  // THE STRIPS ARE NEAR THE TOP NOW. The tiles that start on screen are not
  // left to lazy loading; the remaining book covers still are;
  // every tile keeps its box while its picture loads, so nothing moves; and
  // the heading over them does not wait for a scroll, which on a laptop left
  // the first screenful ending in an empty dark band.
  const strips = await page.evaluate(() => [].map.call(document.querySelectorAll(".strip"), (strip) => {
    const t = strip.querySelector(".track"), kids = [].slice.call(t.children), own = kids.filter((k) => !k.hasAttribute("aria-hidden"));
    const step = kids[1].offsetLeft - kids[0].offsetLeft, starts = own.filter((k, i) => i * step < innerWidth);
    const how = (k) => k.querySelector("img").getAttribute("loading");
    return {
      slides: getComputedStyle(t).animationName === "slide",
      // half the doubled track is exactly one run of tiles, so the loop has no hitch
      whole: kids[kids.length / 2].offsetLeft - kids[0].offsetLeft === t.scrollWidth / 2,
      starts: starts.length, eager: starts.every((k) => how(k) === "eager"), lazy: own.filter((k) => how(k) === "lazy").length,
      boxed: kids.every((k) => { const i = k.querySelector("img"); return i.offsetWidth === 150 && i.offsetHeight === 150 && !!i.getAttribute("width") && !!i.getAttribute("height"); }),
    };
  }));
  ok("both strips slide, and each loop comes round on a whole run of tiles", strips.length === 2 && strips.every((st) => st.slides && st.whole), strips);
  ok("the tiles that start on screen are fetched at once, and every tile keeps its box while its picture loads", strips.length === 2 && strips.every((st) => st.starts > 0 && st.eager && st.boxed), strips);
  ok("…and the covers further along stay lazy", strips.length === 2 && strips[1].lazy > 10, strips);
  ok("the library's heading is simply there: it does not wait for a scroll",
    await page.evaluate(() => { const els = document.querySelectorAll("#library .wrap > *"); return els.length === 3 && [].every.call(els, (el) => !el.classList.contains("rv") && getComputedStyle(el).opacity === "1"); }));

  posts = [];
  await page.click("#fGo");
  ok("no email: asked for a valid one, nothing sent", /valid email/.test(await page.textContent("#fErr")) && posts.length === 0);
  await fill(page, "not-an-email");
  await page.click("#fGo");
  ok("a bad email: asked for a valid one, nothing sent", /valid email/.test(await page.textContent("#fErr")) && posts.length === 0);

  // ONE FORM, ONE PLACE: both other Start free buttons come back to it.
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, document.body.scrollHeight); });
  await page.click("#finalGo");
  ok("the closing Start free comes back to the same form", await settles(page, () => { const r = document.getElementById("signup").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && document.activeElement && document.activeElement.id === "fEmail"; }));
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 2400); });
  ok("once the hero is gone, the header's Start free shows", await settles(page, () => { const b = document.getElementById("topGo"); return getComputedStyle(b).visibility === "visible"; }));
  await page.click("#topGo");
  ok("…and it comes back to the same form", await settles(page, () => { const r = document.getElementById("signup").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && document.activeElement && document.activeElement.id === "fEmail"; }));
  ok("no page errors", errors.length === 0, errors);
  await context.close();
}
// The smallest phones still fit.
{
  const { context, page } = await fresh({ path: "/for-parents", viewport: { width: 320, height: 640 } });
  const w = await page.evaluate(() => ({ d: document.documentElement.scrollWidth, b: document.body.scrollWidth, w: innerWidth }));
  ok("at 320 px wide nothing scrolls sideways", w.d <= w.w && w.b <= w.w, w);
  await context.close();
}

// ── a parent signs up: /api/lead, their email and "parent", then thanked ──
{
  const { context, page, errors } = await fresh({ path: "/for-parents" });
  posts = []; leadReply = { ok: true, captured: true };
  await fill(page, "dana@example.com");
  await page.click("#fGo");
  await page.waitForTimeout(300);
  const p = posts[0] || { body: {} };
  ok("parent page: one post, to /api/lead", posts.length === 1 && p.path === "/api/lead", posts);
  ok("parent page: it carries the email and 'parent', and no name of anyone",
    p.body.role === "parent" && p.body.email === "dana@example.com" && !("name" in p.body) && !("own_name" in p.body) && !("child" in p.body) && !("age" in p.body), p.body);
  ok("parent page: …and which ad brought them", p.body.utm_source === "fb" && p.body.utm_campaign === "launch" && p.body.fbclid === "abc123" && p.body.source === "fb" && p.body.landing === "/for-parents", p.body);
  if (!P_READY) {
    ok("parent page: …and asks for the welcome email", p.body.welcome === true, p.body);
    ok("parent page: thanked with the launch note, and nothing to tap to leave",
      (await page.textContent("#sentT")) === "You're on the list!" && (await page.textContent("#sentMsg")) === P_NOTE && !(await page.isVisible("#nextGo")));
    ok("parent page: and it stays on the page: no App Store, no web app", !(await leftFor(page, "/for-parents", 2500)), page.url());
    // The date Travis emailed the list (30 Sep 2026), the same as the lock's.
    ok("parent page: the launch pill and the phones answer say it launches Friday, October 2",
      await page.isVisible("text=Coming to iPhone and iPad Friday, October 2") && /launches Friday, October 2/.test(await page.evaluate(() => document.getElementById("a7").textContent.replace(/\s+/g, " ")) || ""));
  } else {
    ok("parent page: then it goes to the App Store listing", await page.waitForURL(/apps\.apple\.com/, { timeout: 5000 }).then(() => true, () => false));
  }
  ok("parent page: no page errors", errors.length === 0, errors);
  await context.close();
}
// The Lead fires only after the server said yes. (The page is watched, so it
// is still there to be asked once it has left for the App Store.)
{
  const { context, page } = await fresh({ path: "/for-parents", watch: true });
  posts = []; leadReply = { ok: false, error: "A valid email is required." };
  await fill(page, "dana@example.com");
  await page.click("#fGo");
  await page.waitForTimeout(400);
  ok("parent page: a refused lead shows the server's reason and stays put", /valid email is required/.test(await page.textContent("#fErr")) && /127\.0\.0\.1/.test(page.url()));
  ok("parent page: …and fires no Lead, and the button is back to Start free", (await page.evaluate(() => window.__track.length)) === 0 &&
    (await page.textContent("#fGo")) === "Start free" && !(await page.isDisabled("#fGo")) && (await page.evaluate(() => window.__left.length)) === 0);
  leadReply = { ok: true, captured: true };
  await page.click("#fGo");
  await page.waitForTimeout(500);
  ok("parent page: an accepted lead fires Lead once, with no parameters", JSON.stringify(await page.evaluate(() => window.__track)) === '["Lead"]');
  await context.close();
}

// STRAIGHT TO THE APP STORE (Travis, 4 Oct 2026: "when somebody puts in their
// email for a second it says there's a button to like press to go to the app
// store before it goes to the app store can you just make it happen without
// like delaying I just want it to go immediately to the app store"). Until
// then the page swapped to a "You're in" panel with a Get the app button and
// left 900 ms later. Now nothing comes between the server's yes and the App
// Store: the form stays, its button says where they are going, and the panel
// is only what they find when they come back.
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
if (P_READY) {
  const { context, page, errors } = await fresh({ path: "/for-parents", watch: true });
  posts = []; leadReply = { ok: true, captured: true };
  await fill(page, "dana@example.com");
  await page.click("#fGo");
  const went = await settles(page, () => window.__left.length === 1);
  const at = (await page.evaluate(() => window.__left[0])) || {};
  ok("parent page: the server's yes sends the page to the App Store listing", went && /^https:\/\/apps\.apple\.com\/us\/app\/sona-speech\//.test(at.to || ""), at);
  ok("parent page: …with the Lead already fired, once", JSON.stringify(at.track) === '["Lead"]', at);
  ok("parent page: …and no panel and no Get the app button on the way: the form is still there as the page leaves", at.form === true && at.panel === false && at.getApp === false, at);
  ok("parent page: …its button switched off and reading 'Opening the App Store…'", at.off === true && at.btn === "Opening the App Store…", at);
  ok("parent page: …at once (" + at.ms + " ms after the yes), not after the old 900", at.ms >= 0 && at.ms < 600, at);
  // The page is still showing, as it is when an iPhone opens the App Store
  // over Safari. "You're in" and Get the app arrive two seconds on.
  ok("parent page: just after leaving, there is still no panel", !(await page.isVisible("#sent")) && !(await page.isVisible("#nextGo")));
  ok("parent page: if the page is still showing two seconds on, 'You're in' and Get the app are there",
    (await page.waitForFunction(() => !document.getElementById("sent").hidden, null, { timeout: 5000 }).then(() => true, () => false)) &&
    (await page.textContent("#sentT")) === "You're in" && await page.isVisible("#nextGo") && (await page.textContent("#nextGo")) === "Get the app" && !(await page.isVisible("#signup")));
  await page.click("#nextGo");
  ok("parent page: …and Get the app goes to the same listing", await settles(page, () => window.__left.length === 2 && window.__left[1].to === window.__left[0].to));
  ok("parent page: still one post and one Lead", posts.length === 1 && JSON.stringify(await page.evaluate(() => window.__track)) === '["Lead"]', posts);
  ok("parent page: no page errors", errors.length === 0, errors);
  await context.close();
}
// They come back from the App Store. The page was hidden (or put away) after
// it left, and that is when the panel is swapped in, so it is what they find.
if (P_READY) for (const [what, fire] of [
  ["hidden and shown again", () => document.dispatchEvent(new Event("visibilitychange"))],
  ["put away and brought back", () => window.dispatchEvent(new Event("pagehide"))],
]) {
  const { context, page } = await fresh({ path: "/for-parents", watch: true });
  leadReply = { ok: true, captured: true };
  await fill(page, "dana@example.com");
  await page.click("#fGo");
  const went = await settles(page, () => window.__left.length === 1);
  const early = await page.isVisible("#sent");
  await page.evaluate(fire);
  ok("parent page: " + what + " after leaving, the visitor finds 'You're in' and Get the app",
    went && !early && await page.isVisible("#sent") && await page.isVisible("#nextGo") && (await page.textContent("#sentT")) === "You're in" && !(await page.isVisible("#signup")));
  await context.close();
}
// …and a page that has not left takes no notice of being hidden.
{
  const { context, page } = await fresh({ path: "/for-parents", watch: true });
  await fill(page, "dana@example.com");
  await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("pagehide")); });
  ok("parent page: before a sign-up, switching away and back shows no panel", !(await page.isVisible("#sent")) && await page.isVisible("#signup"));
  await context.close();
}
// Android leaves for the web app the same way, and its button says so.
if (P_READY) {
  const { context, page } = await fresh({ path: "/for-parents", ua: ANDROID, watch: true });
  leadReply = { ok: true, captured: true };
  await fill(page, "lee@example.com");
  await page.click("#fGo");
  const went = await settles(page, () => window.__left.length === 1);
  const at = (await page.evaluate(() => window.__left[0])) || {};
  ok("parent page, Android: the yes sends it to the web app's setup, the button reading 'Opening Sona…', with no panel on the way",
    went && /\/onboarding\.html$/.test(at.to || "") && at.btn === "Opening Sona…" && at.off === true && at.form === true && at.panel === false && at.getApp === false, at);
  await context.close();
}
// Android: the same as everyone while the app is not ready.
{
  const { context, page, errors } = await fresh({ path: "/for-parents", ua: ANDROID });
  posts = []; leadReply = { ok: true, captured: true };
  await fill(page, "lee@example.com");
  await page.click("#fGo");
  if (P_READY) ok("parent page, Android: after the lead, the web app's setup, not the App Store", await page.waitForURL(/\/onboarding\.html/, { timeout: 5000 }).then(() => true, () => false));
  else ok("parent page, Android: thanked like everyone, and stays", (await page.waitForFunction(() => document.getElementById("sentT").textContent === "You're on the list!", null, { timeout: 3000 }).then(() => true, () => false)) && !(await leftFor(page, "/for-parents", 1500)));
  ok("parent page, Android: no page errors", errors.length === 0, errors);
  await context.close();
}

// ── WHAT IT COSTS, FROM THE SWITCH: /api/charter says whether Sona is free ──
// The page never quotes a dollar figure, whatever the route says.
for (const [label, reply, want] of [
  // (trial first, 3 Oct 2026: no answer promises free games, which a new
  // family in the iPhone app no longer has)
  ["no answer", null, /^Sona is free to download, and the app shows its price before you pay anything\.$/],
  ["free right now", { ok: true, free: true }, /^Right now, all of Sona is free: daily practice, every game and every book, with no card\.$/],
  ["priced", { ok: true, free: false, price: 59.99, standard: 99.99, left: 12, cap: 50 }, /^Sona is free to download\. Sona Premium opens every game and every book, and the app shows its price before you pay anything\.$/],
  // the website not selling to families (the route's real answer in that
  // state): an Android parent is sent to the web version, so the answer says
  // where Premium is bought
  ["the website not selling", { ok: true, free: false, webSales: false, cap: 50, taken: 0, left: 0, open: false, source: "off" }, /^Sona is free to download\. Sona Premium opens every game and every book\. You buy it in the Sona app on iPhone and iPad, which shows its price before you pay anything\.$/],
]) {
  charterReply = reply;
  const { context, page, errors } = await fresh({ path: "/for-parents" });
  const shown = await settles(page, () => document.getElementById("costText").textContent !== "") && await page.waitForFunction((re) => new RegExp(re).test(document.getElementById("costText").textContent), want.source, { timeout: 3000 }).then(() => true, () => false);
  ok("the cost answer, " + label + ": " + (await page.textContent("#costText")), shown);
  ok("…and no dollar figure anywhere on the page", !/\$\s?\d/.test(await page.evaluate(() => document.body.innerText)));
  ok("…no page errors", errors.length === 0, errors);
  await context.close();
}
charterReply = null;

// ── reduced motion: everything is simply there, and nothing moves ──
{
  const { context, page, errors } = await fresh({ path: "/for-parents", reducedMotion: "reduce" });
  const still = await page.evaluate(() => {
    const rv = [].slice.call(document.querySelectorAll(".rv"));
    const tracks = [].slice.call(document.querySelectorAll(".strip .track"));
    return {
      shown: rv.length > 5 && rv.every((el) => el.classList.contains("in") && getComputedStyle(el).opacity === "1"),
      strips: tracks.length === 2 && tracks.every((t) => getComputedStyle(t).animationName === "none"),
      echo: getComputedStyle(document.querySelector(".echo-wrap")).animationName === "none",
      // with no loop there is no second copy of each list
      copies: document.querySelectorAll('.strip [aria-hidden="true"]').length === 0,
    };
  });
  ok("reduced motion: every section is shown at once", still.shown, still);
  ok("reduced motion: the game and book strips hold still, one copy each", still.strips && still.copies, still);
  ok("reduced motion: Echo holds still", still.echo, still);
  ok("reduced motion: no page errors", errors.length === 0, errors);
  await context.close();
}

// ═════════════════ the root: the clinicians' opt-in (GHLEXIT1, 24 Nov 2026) ═════════════════
// Travis: "an opt in page too separate from payments page", at "straight up
// speaksona.com". / serves start.html, one work-email box: the ads land
// here, the email is the Lead, and the visitor goes on to /plans with the
// ad's tags, the email waiting in this tab's sessionStorage to fill /plans'
// box, where the trial sign-up is then InitiateCheckout, never a second Lead.
{
  ok("/ is the opt-in (start.html), and /plans and /checkout the plans page (for-slps.html)",
    rewrites.get("/") === "/start.html" && rewrites.get("/plans") === "/for-slps.html" && rewrites.get("/checkout") === "/for-slps.html");
  const { context, page, errors } = await fresh();
  // A Lead fired just before the page leaves is kept in this tab, so the
  // next page can be asked what the last one sent.
  await page.evaluate(() => Object.defineProperty(window, "sonaTrack", { configurable: true, set() {}, get: () => (e) => {
    window.__track.push(e);
    const kept = JSON.parse(sessionStorage.getItem("__tracked") || "[]"); kept.push(e); sessionStorage.setItem("__tracked", JSON.stringify(kept));
  } }));
  // Travis: "literally just focus on grabbing the email ... just have the
  // button be like Get Started ... your email you@example.com".
  ok("/ is a headline, one email box and Get Started: no plans, no selling", await page.evaluate(() => {
    const form = document.getElementById("optin");
    return !!form && [...form.querySelectorAll("input,select")].map(el => el.id).join() === "oEmail" &&
      document.getElementById("oGo").textContent.trim() === "Get Started" && !document.getElementById("pricing") &&
      document.querySelector('label[for="oEmail"]').textContent.trim() === "Your email" &&
      document.getElementById("oEmail").placeholder === "you@example.com" &&
      document.querySelectorAll("main section").length === 1 && !document.querySelector("main .lede, main .trust, main .point");
  }));
  const pixel = await page.evaluate(() => (window.fbq?.queue || []).map(args => Array.from(args)));
  const init = pixel.findIndex(args => args[0] === "init");
  const quiet = pixel.findIndex(args => args[0] === "set" && args[1] === "autoConfig" && args[2] === false);
  ok("/: Meta automatic form capture is off before init and PageView is retained", quiet >= 0 && quiet < init &&
    pixel.some(args => args[0] === "track" && args[1] === "PageView"), pixel);
  posts = [];
  await page.click("#oGo");
  ok("/: no email: asked for a valid one, nothing sent, no Lead", /valid email/.test(await page.textContent("#oErr")) && posts.length === 0 &&
    (await page.evaluate(() => window.__track.length)) === 0);
  leadReply = { ok: false, error: "A valid email is required." };
  await page.fill("#oEmail", "sam@clinic.x");
  await page.click("#oGo");
  ok("/: an email the server refuses: its words on the page, no Lead, and the visitor stays", await settles(page, () => /valid email/.test(document.getElementById("oErr").textContent)) &&
    posts.length === 1 && (await page.evaluate(() => window.__track.length)) === 0 && new URL(page.url()).pathname === "/" &&
    (await page.textContent("#oGo")).trim() === "Get Started");
  leadReply = { ok: true, captured: true };
  posts = [];
  await page.fill("#oEmail", "sam@clinic.org");
  const went = page.waitForURL((u) => u.pathname === "/plans", { timeout: 5000 }).then(() => true, () => false);
  await page.click("#oGo");
  const arrived = await went;
  const url = new URL(page.url());
  const tracked = arrived ? await page.evaluate(() => sessionStorage.getItem("__tracked")) : null;
  ok("/: an accepted email is the lead (role slp, the ad's tags flat) and fires Lead once, with nothing attached",
    posts.length === 1 && posts[0].path === "/api/lead" && posts[0].body.email === "sam@clinic.org" && posts[0].body.role === "slp" &&
    posts[0].body.source === "fb" && posts[0].body.utm_campaign === "launch" && posts[0].body.fbclid === "abc123" && tracked === '["Lead"]', { posts, tracked });
  ok("…then goes on to /plans with the ad's tags, never the email in the address", arrived && url.searchParams.get("utm_campaign") === "launch" &&
    url.searchParams.get("fbclid") === "abc123" && !/sam|clinic\.org/.test(url.href), url.href);
  ok("/plans: the email is already in its box, from this tab", await page.inputValue("#fEmail") === "sam@clinic.org");
  posts = []; authReply = { ok: true, sent: true, signedIn: false };
  await page.click("#fGo");
  ok("/plans after the opt-in: the trial sign-up is InitiateCheckout, never a second Lead", await settles(page, () => !document.getElementById("sent").hidden) &&
    posts.length === 1 && posts[0].path === "/api/slp/auth/request" && posts[0].body.flow === "trial" &&
    JSON.stringify(await page.evaluate(() => window.__track)) === '["InitiateCheckout"]', posts);
  ok("/: no page errors", errors.length === 0, errors);
  await context.close();
}
// ── the opt-in when the server can't take the lead: no Lead, still the plans ──
{
  const { context, page, errors } = await fresh();
  leadReply = { ok: false, status: 429, error: "Too many tries." };
  posts = [];
  await page.fill("#oEmail", "sam@clinic.org");
  const went = page.waitForURL((u) => u.pathname === "/plans", { timeout: 5000 }).then(() => true, () => false);
  await page.click("#oGo");
  ok("/: a lead the server couldn't take (429) fires no Lead, and the visitor still reaches the plans", await went && posts.length === 1 &&
    (await page.evaluate(() => sessionStorage.getItem("sona.optin.lead"))) === null && await page.inputValue("#fEmail") === "sam@clinic.org");
  leadReply = { ok: true, captured: true };
  posts = []; authReply = { ok: true, sent: true, signedIn: false };
  await page.click("#fGo");
  ok("…where its trial sign-up is then the Lead", await settles(page, () => !document.getElementById("sent").hidden) &&
    JSON.stringify(await page.evaluate(() => window.__track)) === '["Lead"]');
  ok("…no page errors", errors.length === 0, errors);
  await context.close();
}
// ── /checkout (GoHighLevel's old links): the plans page, opened at the plans ──
{
  const { context, page, errors } = await fresh({ path: "/checkout" });
  ok("/checkout: the plans page, scrolled to the plans", await settles(page, () => {
    const r = document.getElementById("pricing").getBoundingClientRect();
    return !!document.getElementById("planPro") && r.top < innerHeight && r.bottom > 0 && scrollY > 0;
  }));
  ok("/checkout: no page errors", errors.length === 0, errors);
  await context.close();
}

// ═════════════════ Black Friday (BF1, Travis, 24 Nov 2026) ═════════════════
// /blackfriday: the deal, a countdown to Sunday 29 Nov 2026 at 11:59 PM
// Mountain, one email box; then /blackfriday/plans, the plans page in its
// Black Friday mode. The clock is set, never read, so these hold on any day.
const keepTracks = () => Object.defineProperty(window, "sonaTrack", { configurable: true, set() {}, get: () => (e) => {
  window.__track.push(e);
  const kept = JSON.parse(sessionStorage.getItem("__tracked") || "[]"); kept.push(e); sessionStorage.setItem("__tracked", JSON.stringify(kept));
} });
{
  ok("/blackfriday is the Black Friday opt-in, /blackfriday/plans the plans page", rewrites.get("/blackfriday") === "/bf.html" && rewrites.get("/blackfriday/plans") === "/for-slps.html");
  const { context, page, errors } = await fresh({ path: "/blackfriday", now: "2026-11-26T19:00:00Z" });
  await page.evaluate(keepTracks);
  const cd = await page.evaluate(() => ["cdD", "cdH", "cdM"].map((id) => document.getElementById(id).textContent).join(":"));
  ok("Thursday at noon Mountain: 3 days 11 hours 59 minutes left to Sunday 11:59 PM", cd === "3:11:59" || cd === "3:11:58", cd);
  ok("…the deal in its figures, Get Started, and no plans on the page", await page.evaluate(() =>
    /\$9\.99 a month for your first 3 months, then \$19\.99 a month\./.test(document.body.innerText) && /Ends Sunday, November 29 at 11:59 PM Mountain\./.test(document.body.innerText) &&
    document.getElementById("oGo").textContent.trim() === "Get Started" && !document.getElementById("pricing")));
  posts = []; leadReply = { ok: true, captured: true };
  await page.fill("#oEmail", "bf@clinic.org");
  const went = page.waitForURL((u) => u.pathname === "/blackfriday/plans", { timeout: 5000 }).then(() => true, () => false);
  await page.click("#oGo");
  const arrived = await went;
  const tracked = arrived ? await page.evaluate(() => sessionStorage.getItem("__tracked")) : null;
  ok("an accepted email is the lead and fires Lead once, then /blackfriday/plans with the ad's tags",
    arrived && posts.length === 1 && posts[0].path === "/api/lead" && posts[0].body.role === "slp" && posts[0].body.source === "fb" &&
    tracked === '["Lead"]' && new URL(page.url()).searchParams.get("utm_campaign") === "launch", { posts, tracked, url: page.url() });
  // Travis: "but no free trial on the promo": the deal's words, charged today.
  ok("/blackfriday/plans: the bar with the time left, the deal on the Sona Pro card, and its words everywhere: $9.99 for 3 months, charged today, no free trial", await page.evaluate(() =>
    !document.getElementById("bfBar").hidden && /^Ends in 3d \d\d:\d\d:\d\d$/.test(document.getElementById("bfLeft").textContent) && !document.getElementById("bfDeal").hidden &&
    document.getElementById("fTerms").textContent === "Black Friday: $9.99 a month for 3 months, then $19.99. Charged today, no free trial. Cancel anytime." &&
    /^\$9\.99 a month for your first 3 months, then \$19\.99 a month\. Charged today: no free trial on this deal\./.test(document.getElementById("proTerms").textContent) &&
    document.getElementById("fGo").textContent === "Get the Black Friday price" && document.getElementById("finalGo").textContent === "Get the Black Friday price" &&
    document.getElementById("proGo").textContent === "Get Sona Pro for $9.99" && !/free trial|days free/i.test(document.getElementById("pricing").querySelector("#planPro").innerText.replace(/no free trial/gi, ""))));
  ok("…with the email already in its box", await page.inputValue("#fEmail") === "bf@clinic.org");
  posts = []; authReply = { ok: true, sent: true, signedIn: false };
  await page.click("#fGo");
  ok("…and its sign-up is InitiateCheckout, never a second Lead, and its email is for the Black Friday price", await settles(page, () => !document.getElementById("sent").hidden) &&
    posts.length === 1 && posts[0].path === "/api/slp/auth/request" && JSON.stringify(await page.evaluate(() => window.__track)) === '["InitiateCheckout"]' &&
    /Open it to get your Black Friday price\./.test(await page.textContent("#sentMsg")), posts);
  ok("…no page errors", errors.length === 0, errors);
  await context.close();
}
// The countdown reaching 11:59 PM Sunday on an open page: the ordinary words again.
{
  const { context, page, errors } = await fresh({ path: "/blackfriday/plans", now: "2026-11-30T06:58:57Z" });
  const before = await page.evaluate(() => !document.getElementById("bfBar").hidden && !document.getElementById("bfDeal").hidden);
  const after = await settles(page, () => document.getElementById("bfBar").hidden && document.getElementById("bfDeal").hidden &&
    document.getElementById("fTerms").textContent === "14 days free, then $19.99 a month. Cancel anytime." &&
    document.getElementById("proTerms").textContent === "14 days free, then $19.99 a month. Card required. Cancel during the trial and you pay nothing. One free trial per clinician." &&
    document.getElementById("fGo").textContent === "Start your free trial" && document.getElementById("proGo").textContent === "Try Sona Pro free" &&
    document.getElementById("finalGo").textContent === "Start your free trial");
  ok("/blackfriday/plans three seconds before the end shows the deal, and at 11:59 PM goes back to the trial and its ordinary words", before && after);
  ok("…no page errors", errors.length === 0, errors);
  await context.close();
}
// After the end: the opt-in says so and leads to the ordinary plans.
{
  const { context, page, errors } = await fresh({ path: "/blackfriday", now: "2026-11-30T07:00:00Z" });
  ok("/blackfriday after the end: 'Black Friday is over.', the ordinary price, no countdown", await page.evaluate(() =>
    document.getElementById("bfH").textContent === "Black Friday is over." && document.getElementById("bfSub").textContent === "Sona Pro is $19.99 a month, with 14 days free." &&
    document.getElementById("cd").hidden && document.getElementById("bfEnds").hidden));
  posts = []; leadReply = { ok: true, captured: true };
  await page.fill("#oEmail", "late@clinic.org");
  const went = page.waitForURL((u) => u.pathname === "/plans", { timeout: 5000 }).then(() => true, () => false);
  await page.click("#oGo");
  ok("…its box leads to the ordinary plans, where there is no Black Friday mode", await went && await page.evaluate(() =>
    document.getElementById("bfBar").hidden && document.getElementById("fTerms").textContent === "14 days free, then $19.99 a month. Cancel anytime."));
  ok("…no page errors", errors.length === 0, errors);
  await context.close();
}
// /plans this week, from anywhere: every Sona Pro checkout until the end is
// the deal (/api/slp/plan), so the page says so wherever it is served.
{
  const { context, page, errors } = await fresh({ path: "/plans", now: "2026-11-26T19:00:00Z" });
  ok("/plans during Black Friday shows the deal too, since every Sona Pro checkout this week is the deal", await page.evaluate(() =>
    !document.getElementById("bfBar").hidden && !document.getElementById("bfDeal").hidden && document.getElementById("fGo").textContent === "Get the Black Friday price"));
  ok("…no page errors", errors.length === 0, errors);
  await context.close();
}

// ── the old clinician address lands on the homepage, campaign kept ──
// /for-slps has been a cached PERMANENT 308 to / since 12 Nov 2026.
{
  const { context, page, errors } = await fresh({ path: "/for-slps" });
  const url = new URL(page.url());
  ok("/for-slps: lands on the homepage at / (the opt-in) with the campaign parameters", url.pathname === "/" &&
    url.searchParams.get("utm_campaign") === "launch" && url.searchParams.get("fbclid") === "abc123" &&
    (await page.textContent("#oGo")).trim() === "Get Started", url.href);
  ok("/for-slps: no page errors", errors.length === 0, errors);
  await context.close();
}

// ═════════════════ /plans: Sona Pro, and the trial's emailed link ═════════════════
// Sona Clinic is hidden, not deleted (SLPSITE1, Travis, 18 Nov 2026: "i
// actually wanna get rid of the 99 or hide it for now"): the page ships with
// CLINIC_ON false, the Sona Pro card alone, and its switched-on state is
// played at the end of this part from a copy with the one value flipped.
const PLANS_SRC = readFileSync(FOR_SLPS, "utf8");
const PLANS_CLINIC_ON = /var CLINIC_ON = true;/.test(PLANS_SRC);
// ── the form and the plans ──
{
  charterReply = null;
  const { context, page, errors } = await fresh({ path: "/plans", query: "&clinicianRole=slpa&workSetting=school" });
  ok("the plans page's one form asks only for a work email", await page.evaluate(() => {
    const form = document.getElementById("signup");
    return [...form.querySelectorAll("input,select")].map(el => el.id).join() === "fEmail" &&
      form.querySelectorAll("button").length === 1 && !form.querySelector("textarea") &&
      document.forms.length === 1 && !document.getElementById("startModal") &&
      document.querySelector('label[for="fEmail"]').textContent.trim() === "Your work email" &&
      /^you@your(clinic|school)\./.test(document.getElementById("fEmail").placeholder);
  }));
  const pixel = await page.evaluate(() => (window.fbq?.queue || []).map(args => Array.from(args)));
  const init = pixel.findIndex(args => args[0] === "init");
  const quiet = pixel.findIndex(args => args[0] === "set" && args[1] === "autoConfig" && args[2] === false);
  ok("Meta automatic form capture is off before init and PageView is retained", quiet >= 0 && quiet < init &&
    pixel.some(args => args[0] === "track" && args[1] === "PageView"), pixel);
  const fit = await page.evaluate(() => {
    const r = document.getElementById("signup").getBoundingClientRect(), cards = [...document.querySelectorAll(".plan")].map((c) => c.getBoundingClientRect());
    return { l: r.left, r: r.right, w: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, cards: cards.map((c) => [Math.round(c.left), Math.round(c.right), Math.round(c.top)]) };
  });
  ok("on a phone the form and the plan cards fit the screen, stacked, with no sideways scroll", fit.l >= 0 && fit.r <= fit.w && !fit.overflow &&
    fit.cards.length === (PLANS_CLINIC_ON ? 3 : 2) && fit.cards.every(([l, r]) => l >= 0 && r <= fit.w) && (fit.cards.length < 2 || fit.cards[1][2] > fit.cards[0][2]), fit);
  ok("the clinician hero shows Echo and Fruit Slice without sample caseload data", await page.evaluate(() => {
    const hero = document.querySelector(".hero-r");
    return !!hero && !!hero.querySelector('img.mascot[src="/assets/site/echo.webp"]') &&
      !!hero.querySelector('.hero-game img[src="/assets/site/slice.webp"]') && !/Your caseload this week|\d+%/.test(hero.textContent);
  }));
  ok("the plans page points parents to /for-parents and keeps no consent line of its own", await page.evaluate(() =>
    !document.querySelector(".consent, #mNext, .hnote") && document.querySelector('a[href="/for-parents"]') !== null));
  ok("its buttons start the free trial, its terms beside the first, and it shows Sona Pro with its price and the trial's terms", await page.evaluate(() => {
    const t = document.getElementById("pricing").innerText;
    return document.getElementById("fGo").textContent.trim() === "Start your free trial" &&
      document.getElementById("finalGo").textContent.trim() === "Start your free trial" &&
      document.getElementById("fTerms").textContent.trim() === "14 days free, then $19.99 a month. Cancel anytime." &&
      /Sona Pro/.test(t) && /\$19\.99\s*a month/.test(t) && /14 days free, then \$19\.99 a month\. Card required\./.test(t) &&
      !/free dashboard|community/i.test(document.body.innerText);
  }));
  if (!PLANS_CLINIC_ON) {
    // HIDDEN, NOT DELETED: nothing a visitor or a screen reader meets names
    // Sona Clinic or $99 (its card waits in a <template>, which is not on the
    // page), and nothing on the page can ask for it.
    ok("Sona Clinic is hidden: no Clinic card, plan button, name or $99 anywhere on the page, its title or its description", await page.evaluate(() => {
      const seen = document.body.innerText + " " + document.title + " " + (document.querySelector('meta[name="description"]')?.content || "") +
        " " + [...document.querySelectorAll("[aria-label],[alt],[title]")].map((el) => el.getAttribute("aria-label") + el.getAttribute("alt") + el.getAttribute("title")).join(" ");
      return !/Sona Clinic|\$99(?![.\d])/.test(seen) && !document.getElementById("planClinic") && !document.querySelector('[data-plan="clinic"]') &&
        document.querySelectorAll("#pricing .plan").length === 2 && !!document.querySelector("template#planClinicTpl");
    }));
    ok("…and the kid-side line names the one plan on sale", /every game while your Sona Pro plan is on\./.test(await page.evaluate(() => document.querySelector(".kidside").innerText)));
  }
  // WHAT PARENTS PAY: hidden while /api/charter does not answer.
  ok("the parents' price stays hidden while /api/charter does not answer", await page.locator("#parentPrice").isHidden());

  // A plan button remembers the plan for the dashboard and brings the
  // visitor to the one form; it buys nothing here.
  posts = [];
  await page.evaluate(() => { document.activeElement.blur(); document.getElementById("pricing").scrollIntoView(); });
  await page.click('[data-plan="pro"]');
  ok("a plan button returns to the form, posting nothing and keeping nothing yet (only a sent email, or a signed-in visitor, writes the pick)", await settles(page, () => {
    const r = document.getElementById("signup").getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight && document.activeElement?.id === "fEmail" && localStorage.getItem("sona.slp.wantplan") === null;
  }) && posts.length === 0);

  await page.click("#fGo");
  ok("no email: asked for a valid one, nothing sent", /valid email/.test(await page.textContent("#fErr")) && posts.length === 0);
  await fill(page, "not-an-email");
  await page.click("#fGo");
  ok("a bad email: asked for a valid one, nothing sent", /valid email/.test(await page.textContent("#fErr")) && posts.length === 0);

  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, document.body.scrollHeight); });
  await page.click("#finalGo");
  ok("the closing button returns to the signup form", await settles(page, () => {
    const r = document.getElementById("signup").getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight && document.activeElement?.id === "fEmail";
  }));
  ok("no page errors", errors.length === 0, errors);
  await context.close();
}
// ── the parents' price line, only where it is true (Travis, 17 Nov 2026) ──
for (const [reply, shown, why] of [[{ ok: true, free: false, webSales: false }, true, "families pay (free: false)"], [{ ok: true, free: true }, false, "the family app is free"]]) {
  charterReply = reply;
  const { context, page } = await fresh({ path: "/plans" });
  const vis = await settles(page, () => !document.getElementById("parentPrice").hidden);
  ok("the parents' price line is " + (shown ? "shown" : "hidden") + " when " + why, vis === shown &&
    (!shown || /Parents who buy Sona on their own pay \$9\.99 a month in the iPhone app\./.test(await page.textContent("#parentPrice"))));
  await context.close();
}
charterReply = null;

// ── Sona Premium and Sona Pro side by side, centred, on a laptop (GHLEXIT1) ──
if (!PLANS_CLINIC_ON) {
  const { context, page, errors } = await fresh({ path: "/plans", viewport: { width: 1280, height: 900 } });
  const g = await page.evaluate(() => {
    const cs = [...document.querySelectorAll("#pricing .plan")].map((c) => c.getBoundingClientRect());
    return { ids: [...document.querySelectorAll("#pricing .plan")].map((c) => c.id).join(), tops: cs.map((c) => Math.round(c.top)),
      mid: Math.round((cs[0].left + cs[cs.length - 1].right) / 2), w: cs.map((c) => Math.round(c.width)), center: Math.round(document.documentElement.clientWidth / 2),
      align: getComputedStyle(document.getElementById("pricingH")).textAlign, h: document.getElementById("pricingH").textContent };
  });
  ok("on a laptop Sona Premium and Sona Pro stand side by side, centred under a centred 'Pick your plan.'", g.ids === "planApp,planPro" &&
    g.tops[0] === g.tops[1] && Math.abs(g.mid - g.center) <= 2 && g.w.every((w) => w >= 380 && w <= 560) && g.align === "center" && g.h === "Pick your plan.", g);
  ok("…no page errors", errors.length === 0, errors);
  await context.close();
}

// ── already signed in (SLPSITE1): "See plans" on the dashboard's locked
// screen brings a signed-in clinician here; a plan button takes them
// straight back to the dashboard (which opens the checkout), no email. ──
{
  meReply = { ok: true, email: "sam@clinic.org", code: "", onboarded: false };
  const { context, page, errors } = await fresh({ path: "/plans" });
  // The dashboard itself is another suite's (slptest): a stub here.
  await context.route("**/slp.html*", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Dashboard</title>" }));
  posts = [];
  await page.waitForTimeout(300);   // the session check answers first
  await page.evaluate(() => { document.activeElement.blur(); document.getElementById("pricing").scrollIntoView(); });
  const nav = page.waitForURL((u) => u.pathname === "/slp.html", { timeout: 4000 }).then(() => true, () => false);
  await page.click('[data-plan="pro"]');
  const went = await nav;
  ok("signed in already: a plan button remembers the plan ({plan, at}) and goes straight back to the dashboard, posting nothing",
    went && posts.length === 0 && await page.evaluate(WANT) === "pro", { went, posts, url: page.url() });
  ok("…no page errors", errors.length === 0, errors);
  await context.close();
  meReply = null;
}
// ── signed in, the page's other trial buttons too (review, 18 Nov 2026):
// the form asks for no email and says so, and its button and the closing
// one go straight back to the dashboard. With the trial already had, every
// button and its small print say what checkout will do, never "free". ──
for (const used of [false, true]) {
  meReply = { ok: true, email: "sam@clinic.org", code: "", onboarded: false };
  planReply = { ok: true, pro: { trialAvailable: !used, price: "$19.99", per: "a month", offer: true } };
  const { context, page, errors } = await fresh({ path: "/plans" });
  await context.route("**/slp.html*", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Dashboard</title>" }));
  posts = [];
  const st = used ? await settles(page, () => document.getElementById("fGo").textContent === "Get Sona Pro") : await settles(page, () => document.getElementById("fField").hidden);
  if (!used) await page.waitForTimeout(300);   // the plan's answer, which changes nothing here
  const st2 = await page.evaluate(() => ({ field: document.getElementById("fField").hidden, next: document.getElementById("fNext").textContent, go: document.getElementById("fGo").textContent, terms: document.getElementById("fTerms").textContent,
    pro: document.getElementById("proGo").textContent, proTerms: document.getElementById("proTerms").textContent, fin: document.getElementById("finalGo").textContent }));
  if (!used) ok("signed in, the trial still there: the form asks for no email and says \"You’re signed in. This opens your free trial.\"",
    !!st && st2.field && st2.next === "You’re signed in. This opens your free trial." && st2.go === "Start your free trial" && st2.pro === "Try Sona Pro free", st2);
  else ok("signed in, the trial already had: \"Get Sona Pro\" on every button, \"$19.99 a month, charged today. Cancel anytime.\", never \"free\"",
    st2.field && st2.next === "You’re signed in. This opens checkout." && st2.go === "Get Sona Pro" && st2.pro === "Get Sona Pro" && st2.fin === "Get Sona Pro" &&
    st2.terms === "$19.99 a month, charged today. Cancel anytime." && st2.proTerms === st2.terms, st2);
  const nav = page.waitForURL((u) => u.pathname === "/slp.html", { timeout: 4000 }).then(() => true, () => false);
  await page.click(used ? "#finalGo" : "#fGo");
  ok(`…and ${used ? "the closing button" : "the form's button"} goes straight back to the dashboard with Sona Pro remembered, sending no email`,
    await nav && posts.length === 0 && await page.evaluate(WANT) === "pro", { posts, url: page.url() });
  ok("…no page errors", errors.length === 0, errors);
  await context.close();
  meReply = null; planReply = null;
}

// ── the switch on: Sona Clinic's card comes back as it was (SLPSITE1) ──
// One value in this page (and its twin in lib/caseload.ts, which shiptest
// holds equal) brings the second card, the choice in the heading and both
// plans' names on the kid-side line.
{
  forSlpsOverride = PLANS_SRC.replace("var CLINIC_ON = false;", "var CLINIC_ON = true;");
  const { context, page, errors } = await fresh({ path: "/plans" });
  const got = await page.evaluate(() => ({ cards: [...document.querySelectorAll("#pricing .plan")].map((c) => c.id), h: document.getElementById("pricingH").textContent,
    t: document.getElementById("pricing").innerText, kid: document.querySelector(".kidside").innerText, one: document.getElementById("plans").classList.contains("one") }));
  ok("CLINIC_ON true: the Sona Clinic card follows Sona Pro with its price and the trial's terms, and the heading offers the choice",
    forSlpsOverride.includes("var CLINIC_ON = true;") && got.cards.join() === "planApp,planPro,planClinic" && !got.one && got.h === "Pick your plan." &&
    /Sona Clinic/.test(got.t) && /\$99\s*a month/.test(got.t) && /14 days free, then \$99 a month\. Card required\./.test(got.t), got);
  ok("…the kid-side line names both plans", /every game while your Sona Pro or Sona Clinic plan is on\./.test(got.kid), got.kid);
  await page.evaluate(() => { document.activeElement.blur(); document.getElementById("pricing").scrollIntoView(); });
  await page.click('[data-plan="clinic"]');
  ok("…its button returns to the form", await settles(page, () => document.activeElement?.id === "fEmail"));
  posts = []; authReply = { ok: true, sent: true, signedIn: false };
  await fill(page, "sam@clinic.org");
  await page.click("#fGo");
  ok("…and once the email is sent the form remembers the plan the button chose (clinic), never Sona Pro over it", await settles(page, () => !document.getElementById("sent").hidden) &&
    await page.evaluate(WANT) === "clinic");
  ok("…no page errors", errors.length === 0, errors);
  await context.close();
  forSlpsOverride = null;
}

// ── a trial: the emailed sign-in link, then the plan in the dashboard ──
{
  const { context, page, errors } = await fresh({ path: "/plans" });
  const url = new URL(page.url());
  ok("/plans keeps the campaign parameters", url.pathname === "/plans" &&
    url.searchParams.get("utm_campaign") === "launch" && url.searchParams.get("fbclid") === "abc123", url.href);
  posts = []; authReply = { ok: true, sent: true, signedIn: false };
  await fill(page, "sam@clinic.org");
  const left = leftFor(page, "/plans", 3000);
  await page.click("#fGo");
  ok("/plans: email confirmation identifies the address after delivery", await settles(page, () => {
    const sent = document.getElementById("sent");
    return !sent.hidden && /check your email/i.test(sent.textContent) && /sam@clinic\.org/.test(sent.textContent) && /start your free trial/i.test(sent.textContent);
  }));
  const p = posts[0] || { body: {} };
  ok("/plans: one post asks for the trial's sign-in email", posts.length === 1 && p.path === "/api/slp/auth/request" &&
    p.body.flow === "trial", posts);
  // SLPSITE1: the email link takes a LOCKED account to checkout only when a
  // plan is remembered, so the form remembers Sona Pro when nothing is.
  ok("/plans: once the email is sent the trial form remembers Sona Pro for the dashboard (sona.slp.wantplan, {plan, at}) when no plan button was pressed",
    await page.evaluate(WANT) === "pro");
  ok("/plans: the request carries the email and ad click, with no name",
    p.body.email === "sam@clinic.org" && !("name" in p.body) && p.body.attrib?.fbclid === "abc123" && p.body.source === "fb", p.body);
  ok("/plans: the request asks no role or work setting", !("clinicianRole" in p.body) &&
    !("workSetting" in p.body) && !!p.body.attrib && !("clinicianRole" in p.body.attrib) && !("workSetting" in p.body.attrib), p.body);
  // The page is the front door again (20 Nov 2026): a sent trial email is the Lead.
  ok("/plans: a sent email fires only Lead", JSON.stringify(await page.evaluate(() => window.__track)) === '["Lead"]');
  ok("/plans: the confirmation stays on the page", !(await left), page.url());
  ok("/plans: no page errors", errors.length === 0, errors);
  await context.close();
}
// The conversion fires only after the server said yes.
{
  const { context, page } = await fresh({ path: "/plans" });
  posts = []; authReply = { ok: false, error: "Enter a valid email." };
  await fill(page, "sam@clinic.org");
  await page.click("#fGo");
  ok("a refused signup shows the server's reason", await settles(page, () =>
    /Enter a valid email/.test(document.getElementById("fErr").textContent)));
  ok("…and fires no conversion", (await page.evaluate(() => window.__track.length)) === 0);
  await context.close();
}
{
  const { context, page } = await fresh({ path: "/plans" });
  posts = []; authReply = { ok: true, sent: false, signedIn: false };
  await fill(page, "sam@clinic.org");
  await page.click("#fGo");
  const canRetry = await settles(page, () => /email/i.test(document.getElementById("fErr").textContent)) &&
    await page.locator("#signup").isVisible() && await page.locator("#fGo").isEnabled() &&
    !await page.locator("#sent").isVisible() && await page.inputValue("#fEmail") === "sam@clinic.org";
  ok("a delivery failure leaves the form ready to retry without claiming the email was sent", canRetry);
  ok("a delivery failure fires no conversion", await page.evaluate(() => window.__track.length === 0));
  ok("…and remembers no plan for the dashboard", await page.evaluate(() => localStorage.getItem("sona.slp.wantplan")) === null);
  if (canRetry) {
    authReply = { ok: true, sent: true, signedIn: false };
    await page.click("#fGo");
    ok("retry confirms delivery after a successful send", await settles(page, () => !document.getElementById("sent").hidden) &&
      posts.length === 2, posts);
  }
  await context.close();
}

// A local preview offers its test link without reporting an email delivery.
{
  const { context, page } = await fresh({ path: "/plans" });
  posts = []; authReply = { ok: true, sent: false, signedIn: false, devLink: origin + "/api/slp/auth/verify?token=preview" };
  await fill(page, "sam@clinic.org");
  await page.click("#fGo");
  ok("local preview shows its sign-in link with no delivery claim", await settles(page, () => {
    const sent = document.getElementById("sent");
    return !sent.hidden && /preview sign-in/i.test(sent.textContent) && !/check your email/i.test(sent.textContent);
  }) && await page.locator("#devbox a").getAttribute("href") === authReply.devLink);
  ok("the preview link fires no conversion", await page.evaluate(() => window.__track.length === 0));
  await context.close();
}

// ── the queued books all open on one day (27 Sep, 1 Oct 2026) ──
// The page counts only the books the shelf has opened and tags the rest with
// their day, worked out on the visitor's own calendar, so a parent is never
// promised a book their child can't open yet.
// Every finished book is open. The seven new/expanded fuller books bring the
// parent strip to 36 year-round covers; seasonal books remain off that strip.
for (const [when, count, first] of [["2026-10-01T09:00:00", 36, null]]   /* every book live since 1 Oct 2026 */) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
  const page = await context.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(when));
  await page.goto(origin + "/for-parents");
  const got = await page.evaluate(() => ({ n: document.getElementById("bookCount").textContent,
    tags: [...document.querySelectorAll(".tile.b:not([aria-hidden]) .soon-tag")].map((t) => t.textContent),
    openTiles: document.querySelectorAll(".tile.b:not([aria-hidden]):not(.soon)").length }));
  ok("on " + when.slice(0, 10) + " the site counts " + count + " open books and tags the rest with their day",
    got.n === String(count) && got.openTiles === count && got.tags.length === 36 - count && (first ? got.tags.every((t) => t === first) : true), got);
  ok("…with no page errors", errors.length === 0, errors);
  await context.close();
}

// ── speaksona.com/try, the ad's bridge page (Travis, 9 Oct 2026) ──
// A headline, a sub-headline, Echo between two game screens and one button to
// the App Store. No email box and nothing posted; the tap tells the pixel the
// fact (ViewContent), and an Android phone gets the web app.
{
  const cfg = readFileSync(ROOT + "/../next.config.js", "utf8");
  ok("/try is rewritten to the bridge page", /source: "\/try", destination: "\/try\.html"/.test(cfg));
  for (const [ua, want] of [[null, "https://apps.apple.com/us/app/sona-speech/id6785755867"], ["Mozilla/5.0 (Linux; Android 14) Mobile", origin + "/onboarding.html"]]) {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 }, ...(ua ? { userAgent: ua } : {}) });
    await context.route("**/*", (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
    const page = await context.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => { window.__ev = []; Object.defineProperty(window, "sonaTrack", { configurable: true, set() {}, get() { return (e, p) => window.__ev.push([e, p]); } }); });
    const before = posts.length;
    await page.goto(origin + "/try");
    const got = await page.evaluate(() => ({ h1: document.querySelector("h1").textContent, inputs: document.querySelectorAll("input,form").length,
      href: document.getElementById("go").href, btnBottom: document.getElementById("go").getBoundingClientRect().bottom,
      rachel: /Built with Rachel, a pediatric speech-language pathologist in her clinical fellowship\./.test(document.body.textContent),
      robots: document.querySelector('meta[name="robots"]').content, pixel: !!document.querySelector('script[src="/pixel.js"]') }));
    const who = ua ? "Android" : "iPhone";
    ok(who + ": /try has the headline, no email box and the button on the first screen", got.h1 === "Speech practice kids love." && got.inputs === 0 && got.btnBottom <= 667, got);
    ok(who + ": its button goes to " + (ua ? "the web app" : "the App Store"), got.href === want, got.href);
    ok(who + ": Rachel's line word for word, noindex, and the pixel", got.rachel && got.robots === "noindex" && got.pixel, got);
    const nav = page.waitForURL((u) => !u.href.startsWith(origin + "/try"), { timeout: 3000 }).then(() => true, () => false);
    if (!ua) await context.route("https://apps.apple.com/**", (r) => r.fulfill({ status: 200, body: "store" }));
    const ev = await page.evaluate(() => { document.getElementById("go").click(); return window.__ev.slice(); });
    ok(who + ": a tap tells the pixel ViewContent, then leaves", ev.length === 1 && ev[0][0] === "ViewContent" && (await nav), ev);
    ok(who + ": nothing is posted from it", posts.length === before, posts.slice(before));
    ok(who + ": no page errors", errors.length === 0, errors);
    await context.close();
  }
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
