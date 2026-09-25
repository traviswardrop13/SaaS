// LANDING1: speaksona.com's one call to action (Travis, 25 Sep 2026). The page
// speaks to parents and SLPs alike; every "Start free" (and "For parents")
// opens one pop-up: the grown-up's own first name, their email, and "I'm a…"
// (SLP or SLPA · parent · other), one button, then the App Store — or the web
// app on Android, which has no Sona app to download. Driven in a real browser
// against fake routes, so what is posted, and where the visitor ends up, is
// what is checked.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const MIME = { html: "text/html", js: "text/javascript", css: "text/css", png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml", woff2: "font/woff2", webmanifest: "application/manifest+json" };
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
const open = (page) => page.evaluate(() => !document.getElementById("startModal").hidden);
async function fill(page, name, email, role) {
  await page.fill("#fName", name); await page.fill("#fEmail", email);
  if (role) await page.selectOption("#fRole", role);
}

// ── the page and the pop-up ──
{
  const { context, page, errors } = await fresh();
  ok("the page opens with the pop-up closed", !(await open(page)));
  await page.click("#startGo");
  ok("Start free opens the pop-up", await open(page));
  ok("…with the first name box focused", await page.waitForFunction(() => document.activeElement && document.activeElement.id === "fName", null, { timeout: 2000 }).then(() => true, () => false));
  ok("…and the page behind it does not scroll", await page.evaluate(() => document.documentElement.classList.contains("mopen")));
  const fit = await page.evaluate(() => { const r = document.querySelector(".mcard").getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth }; });
  ok("on a phone the pop-up fits the screen, with no sideways scroll", fit.l >= 0 && fit.r <= fit.w && !fit.overflow, fit);
  await page.keyboard.press("Escape");
  ok("Escape closes it", !(await open(page)));
  await page.click("#forParents");
  ok("For parents opens the same pop-up, with Parent or caregiver chosen", (await open(page)) && (await page.inputValue("#fRole")) === "parent");
  await page.click("#mClose");
  ok("the close button closes it", !(await open(page)));
  await page.click("#finalGo");
  ok("the closing Start free opens it too", await open(page));
  await page.click("#mBack", { position: { x: 5, y: 5 } });
  ok("a tap outside the card closes it", !(await open(page)));

  // What the visitor is told before anything is sent.
  await page.click("#startGo");
  posts = [];
  await page.click("#fGo");
  ok("no name: asked for a first name, nothing sent", /first name/.test(await page.textContent("#fErr")) && posts.length === 0);
  await fill(page, "Dana", "not-an-email");
  await page.click("#fGo");
  ok("a bad email: asked for a valid one, nothing sent", /valid email/.test(await page.textContent("#fErr")) && posts.length === 0);
  await fill(page, "Dana", "dana@example.com");
  // For parents chose Parent above; clear it, as a visitor who arrived by
  // Start free has it.
  await page.evaluate(() => { document.getElementById("fRole").value = ""; });
  await page.click("#fGo");
  ok("no answer to I'm a…: asked to choose, nothing sent", /Choose one/.test(await page.textContent("#fErr")) && posts.length === 0);
  ok("the consent line is in the pop-up, before the email is given", /also send occasional tips from Rachel\. Unsubscribe anytime\./.test(await page.textContent("#signup")));
  ok("…and it says where the button goes: the App Store", /App Store/.test(await page.textContent("#mNext")));
  ok("no page errors", errors.length === 0, errors);
  await context.close();
}

// ── a parent: /api/lead, their own name, then the App Store ──
for (const role of ["parent", "other"]) {
  const { context, page, errors } = await fresh();
  posts = []; leadReply = { ok: true, captured: true };
  await page.click("#startGo");
  await fill(page, "Dana", "dana@example.com", role);
  const nav = page.waitForURL(/apps\.apple\.com/, { timeout: 5000 }).then(() => true, () => false);
  await page.click("#fGo");
  const went = await nav;
  const p = posts[0] || { body: {} };
  ok(role + ": one post, to /api/lead", posts.length === 1 && p.path === "/api/lead", posts);
  ok(role + ": it carries the role and the grown-up's own name as own_name, never name or anything about a child",
    p.body.role === role && p.body.own_name === "Dana" && p.body.email === "dana@example.com" && !("name" in p.body) && !("child" in p.body) && !("age" in p.body), p.body);
  ok(role + ": …and which ad brought them", p.body.utm_source === "fb" && p.body.utm_campaign === "launch" && p.body.fbclid === "abc123" && p.body.source === "fb", p.body);
  ok(role + ": then the page went to the App Store listing", went && /apps\.apple\.com\/us\/app\/sona-speech\/id6785755867/.test(page.url()), page.url());
  ok(role + ": no page errors", errors.length === 0, errors);
  await context.close();
}

// The Lead fires only after the server said yes (checked before navigation).
{
  const { context, page } = await fresh();
  posts = []; leadReply = { ok: false, error: "A valid email is required." };
  await page.click("#startGo");
  await fill(page, "Dana", "dana@example.com", "parent");
  await page.click("#fGo");
  await page.waitForTimeout(400);
  ok("a refused lead shows the server's reason and stays put", /valid email is required/.test(await page.textContent("#fErr")) && /127\.0\.0\.1/.test(page.url()));
  ok("…and fires no Lead", (await page.evaluate(() => window.__track.length)) === 0);
  leadReply = { ok: true, captured: true };
  const nav = page.waitForURL(/apps\.apple\.com/, { timeout: 5000 }).then(() => true, () => false);
  const track = page.evaluate(() => new Promise((r) => { const t = setInterval(() => { if (window.__track.length) { clearInterval(t); r(window.__track.slice()); } }, 10); }));
  await page.click("#fGo");
  const fired = await track;
  ok("an accepted lead fires Lead, with no parameters, before the page leaves", JSON.stringify(fired) === '["Lead"]', fired);
  ok("…and then leaves for the App Store", await nav);
  await context.close();
}

// ── an SLP or SLPA: the account and the dashboard email, then the App Store ──
{
  const { context, page, errors } = await fresh();
  posts = []; authReply = { ok: true, sent: true, signedIn: true };
  await page.click("#startGo");
  await fill(page, "Sam", "sam@clinic.org", "slp");
  const nav = page.waitForURL(/apps\.apple\.com/, { timeout: 6000 }).then(() => true, () => false);
  await page.click("#fGo");
  await page.waitForTimeout(300);
  const p = posts[0] || { body: {} };
  ok("SLP: one post, to the clinician sign-up (which forwards the lead itself)", posts.length === 1 && p.path === "/api/slp/auth/request", posts);
  ok("SLP: it carries their name, email and the ad", p.body.name === "Sam" && p.body.email === "sam@clinic.org" && p.body.attrib && p.body.attrib.fbclid === "abc123", p.body);
  ok("SLP: told the dashboard link is in their email, with the dashboard a tap away",
    /emailed sam@clinic\.org a link/.test(await page.textContent("#sentMsg")) && (await page.isVisible("#straight")));
  ok("SLP: a new clinician is marked as one", JSON.stringify(await page.evaluate(() => window.__track)) === '["Lead","CompleteRegistration"]');
  ok("SLP: then on to the App Store", await nav);
  ok("SLP: no page errors", errors.length === 0, errors);
  await context.close();
}
for (const [label, reply, want] of [
  ["email refused, signed in", { ok: true, sent: false, signedIn: true }, /didn't go out just now, so bookmark the dashboard/],
  ["email refused, not signed in", { ok: true, sent: false, signedIn: false }, /hello@speaksona\.com/],
]) {
  const { context, page } = await fresh();
  posts = []; authReply = reply;
  await page.click("#startGo");
  await fill(page, "Sam", "sam@clinic.org", "slp");
  await page.click("#fGo");
  await page.waitForTimeout(3200);
  ok("SLP, " + label + ": says so, and stays, so the way in is not lost", want.test(await page.textContent("#sentMsg")) && /127\.0\.0\.1/.test(page.url()));
  ok("SLP, " + label + ": the App Store is still one tap away", await page.isVisible("#nextGo"));
  await context.close();
}

// ── Android has no Sona app: the web app instead ──
{
  const { context, page, errors } = await fresh({ ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36" });
  posts = []; leadReply = { ok: true, captured: true };
  await page.click("#startGo");
  ok("Android: the pop-up says Sona opens in the browser", /browser/.test(await page.textContent("#mNext")));
  await fill(page, "Lee", "lee@example.com", "parent");
  const nav = page.waitForURL(/\/onboarding\.html/, { timeout: 5000 }).then(() => true, () => false);
  await page.click("#fGo");
  ok("Android: after the lead, the web app's setup, not the App Store", await nav, page.url());
  ok("Android: no page errors", errors.length === 0, errors);
  await context.close();
}

await browser.close(); srv.close();
console.log(fails ? fails + " FAILURES" : "ALL GREEN");
process.exit(fails ? 1 : 0);
