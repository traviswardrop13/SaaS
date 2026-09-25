// LANDING1: speaksona.com's one form (Travis, 25 Sep 2026). The page speaks to
// parents and SLPs alike, and asks for as little as possible: an email and
// "I'm a…" (parent or caregiver · SLP or SLPA · other), one button, then the
// App Store — or the web app on Android, which has no Sona app to download.
// No name, no pop-up. Driven in a real browser against fake routes, so what is
// posted, and where the visitor ends up, is what is checked.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", css: "text/css", png: "image/png", jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", woff2: "font/woff2", webmanifest: "application/manifest+json" };
let fails = 0;
const ok = (name, cond, detail) => { if (!cond) fails++; console.log((cond ? "PASS " : "FAIL ") + name + (cond || detail === undefined ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); };

// What the fake routes answer, and what they were sent.
let posts = [], leadReply = { ok: true, captured: true }, authReply = { ok: true, sent: true, signedIn: true };
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
  if (u.pathname.startsWith("/api/")) { res.writeHead(404); res.end("{}"); return; }
  const p = ROOT + (u.pathname === "/" ? "/for-slps.html" : u.pathname);
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(8163, "127.0.0.1", r));
const origin = "http://127.0.0.1:8163";
const browser = await chromium.launch(launchOpts());

async function fresh(opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, userAgent: opts.ua });
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
  await page.goto(origin + "/?utm_source=fb&utm_campaign=launch&fbclid=abc123");
  return { context, page, errors };
}
async function fill(page, email, role) {
  await page.fill("#fEmail", email);
  if (role) await page.selectOption("#fRole", role);
}

// ── the form ──
{
  const { context, page, errors } = await fresh();
  ok("the form is on the page itself: an email box and 'I'm a…', no name", await page.isVisible("#fEmail") && await page.isVisible("#fRole") && (await page.$("#fName")) === null && (await page.$("#startModal")) === null);
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

  // For parents and the closing Start free both come back to this one form.
  await page.evaluate(() => { document.getElementById("fRole").value = ""; window.scrollTo(0, document.body.scrollHeight); });
  await page.click("#forParents");
  await page.waitForTimeout(700);
  ok("For parents brings a parent to the form, with Parent or caregiver chosen and the email box ready",
    (await page.inputValue("#fRole")) === "parent" && await page.evaluate(() => document.activeElement && document.activeElement.id === "fEmail"));
  await page.selectOption("#fRole", "other");
  await page.click("#forParents");
  ok("…and never overwrites an answer already chosen", (await page.inputValue("#fRole")) === "other");
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, document.body.scrollHeight); });
  await page.click("#finalGo");
  await page.waitForTimeout(700);
  ok("the closing Start free comes back to the same form", await page.evaluate(() => { const r = document.getElementById("signup").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && document.activeElement.id === "fEmail"; }));
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
const leftFor = (page, ms) => page.waitForURL((u) => !String(u).startsWith(origin + "/?"), { timeout: ms }).then(() => true, () => false);

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
    ok(role + ": and it stays on the page: no App Store, no web app", !(await leftFor(page, 2500)), page.url());
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
  else ok("Android: thanked like everyone, and stays", (await page.waitForFunction(() => document.getElementById("sentT").textContent === "You're on the list!", null, { timeout: 3000 }).then(() => true, () => false)) && !(await leftFor(page, 1500)));
  ok("Android: no page errors", errors.length === 0, errors);
  await context.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
