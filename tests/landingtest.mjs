// LANDING1: speaksona.com's forms, driven in a real browser against fake
// routes, so what is posted, and where the visitor ends up, is what is checked.
//
// THE ROOT IS FOR PARENTS (Travis, 26 Sep 2026: "change it to target parents
// and caregivers only. not slps"): parents.html, one email box, one button,
// then the App Store (or the web app on Android), with nothing in between
// (4 Oct 2026). The clinician page it
// replaced (25 Sep 2026) lives on at /for-slps, still asking for an email and
// "I'm a…" (parent or caregiver · SLP or SLPA · other), and is driven below
// exactly as it was when it was the root. No name on either, no pop-up.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", css: "text/css", png: "image/png", jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", woff2: "font/woff2", webmanifest: "application/manifest+json" };
let fails = 0;
const ok = (name, cond, detail) => { if (!cond) fails++; console.log((cond ? "PASS " : "FAIL ") + name + (cond || detail === undefined ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); };

// What the fake routes answer, and what they were sent. charterReply null
// means /api/charter does not answer at all.
let posts = [], leadReply = { ok: true, captured: true }, authReply = { ok: true, sent: true, signedIn: true }, charterReply = null;
const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (req.method === "POST" && (u.pathname === "/api/lead" || u.pathname === "/api/slp/auth/request")) {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      posts.push({ path: u.pathname, body: JSON.parse(body || "{}") });
      const reply = u.pathname === "/api/lead" ? leadReply : authReply;
      res.writeHead(reply.ok ? 200 : 400, { "content-type": "application/json" });
      res.end(JSON.stringify(reply));
    });
    return;
  }
  if (u.pathname === "/api/charter" && charterReply) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(charterReply)); return; }
  if (u.pathname.startsWith("/api/")) { res.writeHead(404); res.end("{}"); return; }
  // next.config.js's rewrites: / is the parent page, /for-slps the clinician page
  const p = ROOT + (u.pathname === "/" ? "/parents.html" : u.pathname === "/for-slps" ? "/for-slps.html" : u.pathname === "/try" ? "/try.html" : u.pathname);
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
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + (opts.path || "/for-slps") + "?utm_source=fb&utm_campaign=launch&fbclid=abc123");
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
async function fill(page, email, role) {
  await page.fill("#fEmail", email);
  if (role) await page.selectOption("#fRole", role);
}
// WAIT FOR THE SCROLL, DON'T GUESS IT (25 Sep 2026): a fixed 700 ms wait
// turned main red on GitHub's slower runner, on a page that worked.
const settles = (page, fn) => page.waitForFunction(fn, null, { timeout: 5000, polling: 50 }).then(() => true, () => false);
const leftFor = (page, path, ms) => page.waitForURL((u) => !String(u).startsWith(origin + path + "?"), { timeout: ms }).then(() => true, () => false);

// ════════════════════════ the root: the parent page ════════════════════════
const PARENTS = readFileSync(ROOT + "/parents.html", "utf8");
const P_READY = /var APP_READY = true;/.test(PARENTS);
const P_NOTE = (PARENTS.match(/var LAUNCH_NOTE = "([^"]+)";/) || [])[1];
ok("the parent page carries the launch note", !!P_NOTE);

// ── what a parent sees, and the one form ──
{
  const { context, page, errors } = await fresh({ path: "/" });
  // Travis's own line (4 Oct 2026: "I want to make the website say speech
  // practice kids love"); it was the parent ads' "…kids ask for."
  ok("the root is the parent page: 'Speech practice kids love.'", (await page.textContent("h1")) === "Speech practice kids love.");
  ok("its form is an email box and one button: no 'I'm a…', no name",
    await page.isVisible("#fEmail") && (await page.$("#fRole")) === null && (await page.$("#fName")) === null &&
    (await page.$$("#signup input")).length === 1 && (await page.$$("#signup button")).length === 1);
  ok("the hero shows the new Echo and both game screens", await page.evaluate(() => {
    const s = document.querySelector(".stage");
    return !!s && !!s.querySelector('img[src="/assets/site/echo.webp"]') && !!s.querySelector('img[src="/assets/site/hero-slice.webp"]') && !!s.querySelector('img[src="/assets/site/hero-piano.webp"]');
  }));
  ok("…and Echo's bubble says a sound", /^[a-z]+!$/.test((await page.textContent("#bubble")).trim()));
  // A PARENT PAGE HAS NO SIGN IN (26 Sep 2026). A speech therapist finds
  // their page, and their Sign in, from the footer.
  ok("the header has no Sign in: the logo and one Start free", await page.evaluate(() => {
    const h = document.querySelector("header");
    return h.querySelectorAll("a").length === 1 && !/sign in/i.test(h.textContent) && !!h.querySelector("#topGo");
  }));
  ok("…and that button waits until the hero's own form has scrolled away", !(await page.isVisible("#topGo")));
  ok("the footer sends a speech therapist to /for-slps", await page.evaluate(() => !!document.querySelector('footer a[href="/for-slps"]')));
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
  // left to lazy loading; the rest still are (the 29 covers are about 5 MB);
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
  const { context, page } = await fresh({ path: "/", viewport: { width: 320, height: 640 } });
  const w = await page.evaluate(() => ({ d: document.documentElement.scrollWidth, b: document.body.scrollWidth, w: innerWidth }));
  ok("at 320 px wide nothing scrolls sideways", w.d <= w.w && w.b <= w.w, w);
  await context.close();
}

// ── a parent signs up: /api/lead, their email and "parent", then thanked ──
{
  const { context, page, errors } = await fresh({ path: "/" });
  posts = []; leadReply = { ok: true, captured: true };
  await fill(page, "dana@example.com");
  await page.click("#fGo");
  await page.waitForTimeout(300);
  const p = posts[0] || { body: {} };
  ok("parent page: one post, to /api/lead", posts.length === 1 && p.path === "/api/lead", posts);
  ok("parent page: it carries the email and 'parent', and no name of anyone",
    p.body.role === "parent" && p.body.email === "dana@example.com" && !("name" in p.body) && !("own_name" in p.body) && !("child" in p.body) && !("age" in p.body), p.body);
  ok("parent page: …and which ad brought them", p.body.utm_source === "fb" && p.body.utm_campaign === "launch" && p.body.fbclid === "abc123" && p.body.source === "fb" && p.body.landing === "/", p.body);
  if (!P_READY) {
    ok("parent page: …and asks for the welcome email", p.body.welcome === true, p.body);
    ok("parent page: thanked with the launch note, and nothing to tap to leave",
      (await page.textContent("#sentT")) === "You're on the list!" && (await page.textContent("#sentMsg")) === P_NOTE && !(await page.isVisible("#nextGo")));
    ok("parent page: and it stays on the page: no App Store, no web app", !(await leftFor(page, "/", 2500)), page.url());
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
  const { context, page } = await fresh({ path: "/", watch: true });
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
  const { context, page, errors } = await fresh({ path: "/", watch: true });
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
  const { context, page } = await fresh({ path: "/", watch: true });
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
  const { context, page } = await fresh({ path: "/", watch: true });
  await fill(page, "dana@example.com");
  await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("pagehide")); });
  ok("parent page: before a sign-up, switching away and back shows no panel", !(await page.isVisible("#sent")) && await page.isVisible("#signup"));
  await context.close();
}
// Android leaves for the web app the same way, and its button says so.
if (P_READY) {
  const { context, page } = await fresh({ path: "/", ua: ANDROID, watch: true });
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
  const { context, page, errors } = await fresh({ path: "/", ua: ANDROID });
  posts = []; leadReply = { ok: true, captured: true };
  await fill(page, "lee@example.com");
  await page.click("#fGo");
  if (P_READY) ok("parent page, Android: after the lead, the web app's setup, not the App Store", await page.waitForURL(/\/onboarding\.html/, { timeout: 5000 }).then(() => true, () => false));
  else ok("parent page, Android: thanked like everyone, and stays", (await page.waitForFunction(() => document.getElementById("sentT").textContent === "You're on the list!", null, { timeout: 3000 }).then(() => true, () => false)) && !(await leftFor(page, "/", 1500)));
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
  const { context, page, errors } = await fresh({ path: "/" });
  const shown = await settles(page, () => document.getElementById("costText").textContent !== "") && await page.waitForFunction((re) => new RegExp(re).test(document.getElementById("costText").textContent), want.source, { timeout: 3000 }).then(() => true, () => false);
  ok("the cost answer, " + label + ": " + (await page.textContent("#costText")), shown);
  ok("…and no dollar figure anywhere on the page", !/\$\s?\d/.test(await page.evaluate(() => document.body.innerText)));
  ok("…no page errors", errors.length === 0, errors);
  await context.close();
}
charterReply = null;

// ── reduced motion: everything is simply there, and nothing moves ──
{
  const { context, page, errors } = await fresh({ path: "/", reducedMotion: "reduce" });
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

// ═════════════════ /for-slps: the clinician page, unchanged ═════════════════
// ── the form ──
{
  const { context, page, errors } = await fresh();
  ok("/for-slps: the form is on the page itself: an email box and 'I'm a…', no name", await page.isVisible("#fEmail") && await page.isVisible("#fRole") && (await page.$("#fName")) === null && (await page.$("#startModal")) === null);
  ok("…and nothing is chosen for them", (await page.inputValue("#fRole")) === "");
  const fit = await page.evaluate(() => { const r = document.getElementById("signup").getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth }; });
  ok("on a phone the form fits the screen, with no sideways scroll", fit.l >= 0 && fit.r <= fit.w && !fit.overflow, fit);
  ok("the hero shows Echo and the caseload card", await page.evaluate(() => { const r = document.querySelector(".hero-r"); return !!r && !!r.querySelector("img.mascot") && /Your caseload this week/.test(r.textContent); }));
  ok("…and nothing sits under the form's button", await page.evaluate(() => !document.querySelector(".consent, #mNext, .hnote")));

  // What the visitor is told before anything is sent.
  posts = [];
  await page.click("#fGo");
  ok("no email: asked for a valid one, nothing sent", /valid email/.test(await page.textContent("#fErr")) && posts.length === 0);
  await fill(page, "not-an-email");
  await page.click("#fGo");
  ok("a bad email: asked for a valid one, nothing sent", /valid email/.test(await page.textContent("#fErr")) && posts.length === 0);
  await fill(page, "dana@example.com");
  await page.click("#fGo");
  ok("no answer to I'm a…: asked to choose, nothing sent", /Choose one/.test(await page.textContent("#fErr")) && posts.length === 0);

  // The closing Start free comes back to this one form. (There is no For
  // parents link any more: Travis, 26 Sep 2026.)
  ok("the header has no For parents link", (await page.$("#forParents")) === null);
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, document.body.scrollHeight); });
  await page.click("#finalGo");
  ok("the closing Start free comes back to the same form", await settles(page, () => { const r = document.getElementById("signup").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && document.activeElement && document.activeElement.id === "fEmail"; }));
  ok("no page errors", errors.length === 0, errors);
  await context.close();
}

// UNTIL THE APP IS READY (Travis, 25 Sep 2026): no App Store and no web app.
// A parent or "other" is thanked and told the app launches Friday (and
// emailed, by /api/lead); a speech therapist goes to their dashboard.
const PAGE = readFileSync(ROOT + "/for-slps.html", "utf8");
const READY = /var APP_READY = true;/.test(PAGE);
const NOTE = (PAGE.match(/var LAUNCH_NOTE = "([^"]+)";/) || [])[1];
ok("the launch note is on the page", !!NOTE);

// ── a parent, or other: /api/lead, email and role only, then thanked ──
for (const role of ["parent", "other"]) {
  const { context, page, errors } = await fresh();
  posts = []; leadReply = { ok: true, captured: true };
  await fill(page, "dana@example.com", role);
  await page.click("#fGo");
  await page.waitForTimeout(300);
  const p = posts[0] || { body: {} };
  ok(role + ": one post, to /api/lead", posts.length === 1 && p.path === "/api/lead", posts);
  ok(role + ": it carries the email and the role, and no name of anyone",
    p.body.role === role && p.body.email === "dana@example.com" && !("name" in p.body) && !("own_name" in p.body) && !("child" in p.body) && !("age" in p.body), p.body);
  ok(role + ": …and which ad brought them", p.body.utm_source === "fb" && p.body.utm_campaign === "launch" && p.body.fbclid === "abc123" && p.body.source === "fb", p.body);
  if (!READY) {
    ok(role + ": …and asks for the welcome email", p.body.welcome === true, p.body);
    ok(role + ": thanked on the page with the launch note, and nothing to tap to leave",
      (await page.textContent("#sentT")) === "You're on the list!" && (await page.textContent("#sentMsg")) === NOTE && !(await page.isVisible("#nextGo")) && !(await page.isVisible("#straight")));
    ok(role + ": and it stays on the page: no App Store, no web app", !(await leftFor(page, "/for-slps", 2500)), page.url());
  } else {
    ok(role + ": then the page goes to the App Store listing", await page.waitForURL(/apps\.apple\.com/, { timeout: 5000 }).then(() => true, () => false));
  }
  ok(role + ": no page errors", errors.length === 0, errors);
  await context.close();
}

// The Lead fires only after the server said yes.
{
  const { context, page } = await fresh();
  posts = []; leadReply = { ok: false, error: "A valid email is required." };
  await fill(page, "dana@example.com", "parent");
  await page.click("#fGo");
  await page.waitForTimeout(400);
  ok("a refused lead shows the server's reason and stays put", /valid email is required/.test(await page.textContent("#fErr")) && /127\.0\.0\.1/.test(page.url()));
  ok("…and fires no Lead", (await page.evaluate(() => window.__track.length)) === 0);
  leadReply = { ok: true, captured: true };
  await page.click("#fGo");
  await page.waitForTimeout(500);
  ok("an accepted lead fires Lead once, with no parameters", JSON.stringify(await page.evaluate(() => window.__track)) === '["Lead"]');
  await context.close();
}

// ── an SLP or SLPA: the account and the dashboard email, then the dashboard ──
{
  const { context, page, errors } = await fresh();
  posts = []; authReply = { ok: true, sent: true, signedIn: true };
  await fill(page, "sam@clinic.org", "slp");
  const target = READY ? /apps\.apple\.com/ : /\/slp\.html#community$/;
  const nav = page.waitForURL(target, { timeout: 6000 }).then(() => true, () => false);
  await page.click("#fGo");
  await page.waitForTimeout(300);
  const p = posts[0] || { body: {} };
  ok("SLP: one post, to the clinician sign-up (which forwards the lead itself)", posts.length === 1 && p.path === "/api/slp/auth/request", posts);
  ok("SLP: it carries the email and the ad, and no name", p.body.email === "sam@clinic.org" && !("name" in p.body) && p.body.attrib && p.body.attrib.fbclid === "abc123", p.body);
  ok("SLP: told the dashboard link is in their email" + (READY ? "" : " and the family app launches Friday, October 2"),
    /emailed sam@clinic\.org a link/.test(await page.textContent("#sentMsg")) && (READY || /launches Friday, October 2/.test(await page.textContent("#sentMsg"))));
  ok("SLP: a new clinician is marked as one", JSON.stringify(await page.evaluate(() => window.__track)) === '["Lead","CompleteRegistration"]');
  ok("SLP: then into " + (READY ? "the App Store" : "the dashboard's community"), await nav, page.url());
  ok("SLP: no page errors", errors.filter((e) => !/api\/slp/.test(e)).length === 0, errors);
  await context.close();
}
for (const [label, reply, want] of [
  ["email refused, signed in", { ok: true, sent: false, signedIn: true }, /didn't go out just now, so bookmark the dashboard/],
  ["email refused, not signed in", { ok: true, sent: false, signedIn: false }, /hello@speaksona\.com/],
]) {
  const { context, page } = await fresh();
  posts = []; authReply = reply;
  await fill(page, "sam@clinic.org", "slp");
  await page.click("#fGo");
  await page.waitForTimeout(3200);
  ok("SLP, " + label + ": says so, and stays, so the way in is not lost", want.test(await page.textContent("#sentMsg")) && /127\.0\.0\.1/.test(page.url()));
  ok("SLP, " + label + ": " + (READY ? "the App Store is one tap away" : "and no App Store button while the app is not ready"), (await page.isVisible("#nextGo")) === READY);
  await context.close();
}

// ── Android: the same as everyone while the app is not ready ──
{
  const { context, page, errors } = await fresh({ ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36" });
  posts = []; leadReply = { ok: true, captured: true };
  await fill(page, "lee@example.com", "parent");
  await page.click("#fGo");
  if (READY) ok("Android: after the lead, the web app's setup, not the App Store", await page.waitForURL(/\/onboarding\.html/, { timeout: 5000 }).then(() => true, () => false));
  else ok("Android: thanked like everyone, and stays", (await page.waitForFunction(() => document.getElementById("sentT").textContent === "You're on the list!", null, { timeout: 3000 }).then(() => true, () => false)) && !(await leftFor(page, "/for-slps", 1500)));
  ok("Android: no page errors", errors.length === 0, errors);
  await context.close();
}

// ── the queued books all open on one day (27 Sep, 1 Oct 2026) ──
// The page counts only the books the shelf has opened and tags the rest with
// their day, worked out on the visitor's own calendar, so a parent is never
// promised a book their child can't open yet.
// Every queued book comes out on Friday 9 Oct (Travis, 1 Oct 2026: "everything
// that is currently in queue to just say for next Friday"), so the day before
// still shows 15 and the day itself shows them all.
for (const [when, count, first] of [["2026-10-01T09:00:00", 29, null]]   /* every book live since 1 Oct 2026 */) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
  const page = await context.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(when));
  await page.goto(origin + "/");
  const got = await page.evaluate(() => ({ n: document.getElementById("bookCount").textContent,
    tags: [...document.querySelectorAll(".tile.b:not([aria-hidden]) .soon-tag")].map((t) => t.textContent),
    openTiles: document.querySelectorAll(".tile.b:not([aria-hidden]):not(.soon)").length }));
  ok("on " + when.slice(0, 10) + " the site counts " + count + " open books and tags the rest with their day",
    got.n === String(count) && got.openTiles === count && got.tags.length === 29 - count && (first ? got.tags.every((t) => t === first) : true), got);
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
      rachel: /Built with Rachel, MS, CF-SLP, a pediatric speech-language pathologist in her clinical fellowship\./.test(document.body.textContent),
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
