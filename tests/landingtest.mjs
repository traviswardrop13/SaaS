// LANDING1: speaksona.com's forms, driven in a real browser against fake
// routes, so what is posted, and where the visitor ends up, is what is checked.
//
// THE ROOT IS FOR PARENTS (Travis, 26 Sep 2026: "change it to target parents
// and caregivers only. not slps"): parents.html, one email box, one button,
// then the App Store (or the web app on Android). The clinician page it
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
  const p = ROOT + (u.pathname === "/" ? "/parents.html" : u.pathname === "/for-slps" ? "/for-slps.html" : u.pathname);
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
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + (opts.path || "/for-slps") + "?utm_source=fb&utm_campaign=launch&fbclid=abc123");
  return { context, page, errors };
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
  ok("the root is the parent page: 'Speech practice kids ask for.'", (await page.textContent("h1")) === "Speech practice kids ask for.");
  ok("its form is an email box and one button: no 'I'm a…', no name",
    await page.isVisible("#fEmail") && (await page.$("#fRole")) === null && (await page.$("#fName")) === null &&
    (await page.$$("#signup input")).length === 1 && (await page.$$("#signup button")).length === 1);
  ok("the hero shows the new Echo and both game screens", await page.evaluate(() => {
    const s = document.querySelector(".stage");
    return !!s && !!s.querySelector('img[src="/assets/site/echo.webp"]') && !!s.querySelector('img[src="/assets/site/slice.webp"]') && !!s.querySelector('img[src="/assets/site/piano.webp"]');
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
    return !/caseload|dashboard|\bSLPA?\b|clinician/i.test(main);
  }));
  const fit = await page.evaluate(() => { const r = document.getElementById("signup").getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth }; });
  ok("on a phone the form fits the screen, and nothing on the page scrolls sideways", fit.l >= 0 && fit.r <= fit.w && !fit.overflow, fit);

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
    ok("parent page: the launch pill and the phones answer say it launches next week",
      await page.isVisible("text=Coming to iPhone and iPad next week") && /launches next week/.test(await page.evaluate(() => document.getElementById("a7").textContent.replace(/\s+/g, " ")) || ""));
  } else {
    ok("parent page: then it goes to the App Store listing", await page.waitForURL(/apps\.apple\.com/, { timeout: 5000 }).then(() => true, () => false));
  }
  ok("parent page: no page errors", errors.length === 0, errors);
  await context.close();
}
// The Lead fires only after the server said yes.
{
  const { context, page } = await fresh({ path: "/" });
  posts = []; leadReply = { ok: false, error: "A valid email is required." };
  await fill(page, "dana@example.com");
  await page.click("#fGo");
  await page.waitForTimeout(400);
  ok("parent page: a refused lead shows the server's reason and stays put", /valid email is required/.test(await page.textContent("#fErr")) && /127\.0\.0\.1/.test(page.url()));
  ok("parent page: …and fires no Lead", (await page.evaluate(() => window.__track.length)) === 0);
  leadReply = { ok: true, captured: true };
  await page.click("#fGo");
  await page.waitForTimeout(500);
  ok("parent page: an accepted lead fires Lead once, with no parameters", JSON.stringify(await page.evaluate(() => window.__track)) === '["Lead"]');
  await context.close();
}
// Android: the same as everyone while the app is not ready.
{
  const { context, page, errors } = await fresh({ path: "/", ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36" });
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
  ["no answer", null, /^Sona is free to start: daily practice and free games, with no card\.$/],
  ["free right now", { ok: true, free: true }, /^Right now, all of Sona is free: daily practice, every game and every book, with no card\.$/],
  ["priced", { ok: true, free: false, price: 59.99, standard: 99.99, left: 12, cap: 50 }, /^Daily practice and free games are free, with no card\. Premium unlocks every game and every book, and the app shows its price before you pay anything\.$/],
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
// A parent or "other" is thanked and told the app launches next week (and
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
  ok("SLP: told the dashboard link is in their email" + (READY ? "" : " and the family app launches next week"),
    /emailed sam@clinic\.org a link/.test(await page.textContent("#sentMsg")) && (READY || /launches next week/.test(await page.textContent("#sentMsg"))));
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

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
