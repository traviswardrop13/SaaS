// LAUNCH1: the app is locked until launch day (Travis, 30 Sep 2026: "the
// official V1 of Sona launches Friday, October 2nd ... lock the app until
// Friday ... they can turn on a notification if they press notify me or ...
// put in their email"). Until LAUNCH_AT every family page answers with
// public/launching.html (middleware.ts): the date and one email box. From
// LAUNCH_AT it opens by itself, and a team door lets Travis and Rachel in first.
//
// The server half is TypeScript; like caseloadtest, this suite transpiles it
// with the repo's own `typescript` and calls it with real NextRequests.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import path from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(REPO, "public");
let fails = 0, passes = 0;
const ok = (name, cond, info) => {
  if (cond) { passes++; console.log("PASS " + name); }
  else { fails++; console.log("FAIL " + name + (info === undefined ? "" : "  → " + (typeof info === "string" ? info : JSON.stringify(info)))); }
};

// ── the loader: TS → CJS, "@/x" → the repo ──
// `lock` loads lib/launch.ts with LAUNCH_LOCK set to that value instead, so
// the lock is tested switched on and off whichever way the code ships it
// (Travis lifted it early on 30 Sep 2026: "Reopen the app").
function loader(lock) {
  const cache = new Map();
  return function loadTs(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    let src = readFileSync(file, "utf8");
    if (lock !== undefined && file === path.join(REPO, "lib/launch.ts")) src = src.replace(/export const LAUNCH_LOCK = (true|false);/, "export const LAUNCH_LOCK = " + lock + ";");
    const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const req = (s) => s.startsWith("@/") ? loadTs(path.join(REPO, s.slice(2) + (s.endsWith(".ts") ? "" : ".ts")))
      : s === "next/server" ? require(path.join(REPO, "node_modules/next/server"))
      : require(s);
    new Function("require", "module", "exports", js)(req, mod, mod.exports);
    return mod.exports;
  };
}
const loadTs = loader();
const { NextRequest } = require(path.join(REPO, "node_modules/next/server"));
const L = loadTs(path.join(REPO, "lib/launch.ts"));
const PREVIEW = loadTs(path.join(REPO, "app/api/launch/preview/route.ts"));
// the lock switched on, for sections 3 and 4; the shipped switch, below
const MW = loader(true)(path.join(REPO, "middleware.ts"));
const MW_OFF = loader(false)(path.join(REPO, "middleware.ts"));
const MW_SHIPPED = loadTs(path.join(REPO, "middleware.ts"));

// ── 1. the date, and its copies ──
const AT = Date.parse(L.LAUNCH_AT);
ok("launch is midnight at the start of Friday 2 October in Idaho (06:00 UTC)", L.LAUNCH_AT === "2026-10-02T06:00:00Z" && new Date(AT).getUTCDay() === 5, L.LAUNCH_AT);
ok("…locked a second before, open at the instant and after", !L.launched(AT - 1000) && L.launched(AT) && L.launched(AT + 86400000));
const LOCKPAGE = readFileSync(path.join(PUB, "launching.html"), "utf8");
ok("the lock page's copy of the launch instant is lib/launch's (it cannot import it)", (LOCKPAGE.match(/var LAUNCH_AT = "([^"]+)";/) || [])[1] === L.LAUNCH_AT);
ok("…and its thank-you is lib/launch's LAUNCH_NOTE, the words the welcome email uses", (LOCKPAGE.match(/var LAUNCH_NOTE = "([^"]+)";/) || [])[1] === L.LAUNCH_NOTE, L.LAUNCH_NOTE);
ok("the note names the day Travis emailed the list", /^Sona launches Friday, October 2\./.test(L.LAUNCH_NOTE), L.LAUNCH_NOTE);

// ── 2. which pages lock ──
const pages = readdirSync(PUB).filter((f) => f.endsWith(".html"));
ok("every open page is a real page (a typo would lock the one it meant)", L.OPEN_PAGES.every((f) => existsSync(path.join(PUB, f))), L.OPEN_PAGES.filter((f) => !existsSync(path.join(PUB, f))));
const mustLock = ["today.html", "onboarding.html", "charge.html", "arcade-slice.html", "arcade-feed.html", "arcade-hoops.html", "library.html", "join.html", "subscribe.html", "settings.html", "progress.html", "check.html", "customize.html", "stickers.html", "premium.html", "trial.html"];
ok("the family app locks: Home, setup, practice, every game, the books, a clinician's family link, the plan and grown-up pages",
  mustLock.every((f) => L.lockedPage("/" + f)), mustLock.filter((f) => !L.lockedPage("/" + f)));
const mustOpen = ["parents.html", "for-slps.html", "slp.html", "slp-login.html", "leads.html", "founders.html", "privacy.html", "launching.html"];
ok("the websites, the clinician's dashboard and sign-in, the founder pages, privacy and the lock page stay open",
  mustOpen.every((f) => !L.lockedPage("/" + f)), mustOpen.filter((f) => L.lockedPage("/" + f)));
ok("every other page on disk is part of the app, and locks", pages.filter((f) => !L.OPEN_PAGES.includes(f)).every((f) => L.lockedPage("/" + f)));
ok("pictures, scripts, sounds, the API and the root never lock", ["/", "/sona.js", "/assets/crafted/echo-welcome.webp", "/api/lead", "/coach/say-echo/R-sound.wav", "/for-slps", "/slps", "/assets/x/today.html"].every((p) => !L.lockedPage(p)));
const { pathToRegexp } = require(path.join(REPO, "node_modules/next/dist/compiled/path-to-regexp"));
const matcher = (MW.config && MW.config.matcher) || [];
const hits = (p) => matcher.some((m) => pathToRegexp(m).test(p));
ok("the middleware is asked only about .html pages, never the API or Next's own files",
  hits("/today.html") && hits("/arcade-slice.html") && !hits("/api/lead") && !hits("/api/x.html") && !hits("/_next/static/a.html") && !hits("/sona.js") && !hits("/assets/crafted/echo-welcome.webp"), matcher);

// ── 3. the middleware (the lock switched on) ──
const realNow = Date.now;
const at = (t, fn) => async (...a) => { Date.now = () => t; try { return await fn(...a); } finally { Date.now = realNow; } };
const ask = (p, cookie) => MW.middleware(new NextRequest("https://speaksona.com" + p, { headers: cookie ? { cookie } : {} }));
const rewrittenTo = (res) => { const u = res.headers.get("x-middleware-rewrite"); return u ? new URL(u).pathname : null; };
const passes_ = (res) => res.headers.get("x-middleware-next") === "1" && !res.headers.get("x-middleware-rewrite");
process.env.FOUNDER_KEY = "team-key-for-the-tests";
const before = AT - 3600000, after = AT + 60000;
let r = await at(before, ask)("/today.html");
ok("before launch, Home answers with the lock page, at the same address", rewrittenTo(r) === "/launching.html", Object.fromEntries(r.headers));
r = await at(before, ask)("/charge.html?game=arcade-slice.html");
ok("…and so does the practice page, its game dropped (the lock page takes no query)", rewrittenTo(r) === "/launching.html" && !new URL(r.headers.get("x-middleware-rewrite")).search);
r = await at(before, ask)("/parents.html");
ok("…the parent website stays itself", passes_(r));
r = await at(before, ask)("/slp.html");
ok("…and so does the clinician's dashboard", passes_(r));
r = await at(after, ask)("/today.html");
ok("from launch, Home is Home, with no deploy", passes_(r));
const token = await L.previewToken(process.env.FOUNDER_KEY);
r = await at(before, ask)("/today.html", L.PREVIEW_COOKIE + "=" + token);
ok("the team cookie opens the app before launch", passes_(r));
r = await at(before, ask)("/today.html", L.PREVIEW_COOKIE + "=" + token.replace(/.$/, (c) => (c === "0" ? "1" : "0")));
ok("…a forged one doesn't", rewrittenTo(r) === "/launching.html");
const otherKey = await L.previewToken("a-different-founder-key");
r = await at(before, ask)("/today.html", L.PREVIEW_COOKIE + "=" + otherKey);
ok("…nor one made with another key (a changed key closes every old cookie)", rewrittenTo(r) === "/launching.html");
process.env.FOUNDER_KEY = "short";
r = await at(before, ask)("/today.html", L.PREVIEW_COOKIE + "=" + (await L.previewToken("short")));
ok("…and with no proper founder key set, there is no team door at all", rewrittenTo(r) === "/launching.html");

// ── 3b. the switch ──
// LAUNCH_LOCK off opens every page whatever the date; the shipped code is
// whichever Travis last chose, and the middleware obeys it.
ok("the lock has one switch, LAUNCH_LOCK in lib/launch.ts", typeof L.LAUNCH_LOCK === "boolean" && /export const LAUNCH_LOCK = (true|false);/.test(readFileSync(path.join(REPO, "lib/launch.ts"), "utf8")));
const askWith = (mw) => (p) => mw.middleware(new NextRequest("https://speaksona.com" + p));
r = await at(before, askWith(MW_OFF))("/today.html");
ok("with the switch off, Home is Home even before the launch date", passes_(r), Object.fromEntries(r.headers));
r = await at(before, askWith(MW_OFF))("/charge.html?game=arcade-slice.html");
ok("…and so is every other family page", passes_(r));
r = await at(before, askWith(MW_SHIPPED))("/today.html");
ok("the middleware as shipped obeys the shipped switch (" + (L.LAUNCH_LOCK ? "locked until launch" : "open now") + ")",
  L.LAUNCH_LOCK ? rewrittenTo(r) === "/launching.html" : passes_(r), Object.fromEntries(r.headers));
ok("locked() is the switch and the date together", L.locked(before) === L.LAUNCH_LOCK && L.locked(after) === false);

// ── 4. the team door's route ──
const door = async (key, envKey) => {
  if (envKey === undefined) delete process.env.FOUNDER_KEY; else process.env.FOUNDER_KEY = envKey;
  const res = await PREVIEW.POST(new NextRequest("https://speaksona.com/api/launch/preview", { method: "POST", headers: key === null ? {} : { "x-founder-key": key } }));
  let json = null; try { json = await res.clone().json(); } catch {}
  return { status: res.status, json, cookie: res.headers.get("set-cookie") || "" };
};
let d = await door("anything", undefined);
ok("the door is closed (503) while no founder key is set", d.status === 503 && !d.cookie, d);
d = await door("team-key-for-the-tests", "team-key-for-the-tests".slice(0, 8));
ok("…or while it is shorter than 12 characters", d.status === 503 && !d.cookie, d);
d = await door("wrong-key-for-the-tests", "team-key-for-the-tests");
ok("a wrong key gets 401 and no cookie", d.status === 401 && !d.cookie, d);
d = await door(null, "team-key-for-the-tests");
ok("…and so does no key", d.status === 401 && !d.cookie, d);
d = await door("team-key-for-the-tests", "team-key-for-the-tests");
const val = (d.cookie.match(new RegExp(L.PREVIEW_COOKIE + "=([^;]+)")) || [])[1];
ok("the right key gets a cookie the page's scripts can't read, over HTTPS only",
  d.status === 200 && d.json && d.json.ok && !!val && /HttpOnly/i.test(d.cookie) && /Secure/i.test(d.cookie) && /Path=\//i.test(d.cookie), d);
process.env.FOUNDER_KEY = "team-key-for-the-tests";
r = await at(before, ask)("/today.html", L.PREVIEW_COOKIE + "=" + val);
ok("…and the middleware lets that cookie through", passes_(r));
ok("the key is read from a header, never the address (so it stays out of history and logs)",
  !/searchParams|nextUrl\.search|\?key=/.test(readFileSync(path.join(REPO, "app/api/launch/preview/route.ts"), "utf8")) && /x-founder-key/.test(LOCKPAGE));

// ── 5. the lock page, in a phone ──
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", webp: "image/webp", png: "image/png", svg: "image/svg+xml", woff2: "font/woff2", json: "application/json" };
const server = createServer((q, s) => {
  const u = decodeURIComponent(new URL(q.url, "http://x").pathname);
  const f = path.join(PUB, u === "/" ? "parents.html" : u);
  if (!f.startsWith(PUB) || !existsSync(f) || statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { "Content-Type": MIME[f.split(".").pop()] || "application/octet-stream" }); s.end(readFileSync(f));
});
await new Promise((res) => server.listen(0, "127.0.0.1", res));
const BASE = "http://127.0.0.1:" + server.address().port;
const { chromium, launchOpts } = await import("./_env.mjs");
const browser = await chromium.launch(launchOpts());
async function phone(when, vp) {
  const ctx = await browser.newContext({ viewport: vp || { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage(); const errs = [], posts = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.clock.setFixedTime(new Date(when));
  await ctx.route("**/api/**", async (route) => {
    const q = route.request();
    posts.push({ path: new URL(q.url()).pathname, body: q.postDataJSON ? (() => { try { return q.postDataJSON(); } catch { return null; } })() : null, headers: q.headers() });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  return { ctx, pg, errs, posts };
}
let p = await phone(before);
await p.pg.goto(BASE + "/launching.html");
await p.pg.waitForTimeout(300);
const txt = (await p.pg.textContent("body")).replace(/\s+/g, " ");
ok("the lock page says when: Friday, October 2", /Sona opens Friday, October 2/.test(txt) && /Launching Friday, October 2/.test(txt), txt.slice(0, 200));
ok("…one email box and nothing else to fill in: no name, nothing about a child", (await p.pg.locator("#notify input").count()) === 1 && (await p.pg.getAttribute("#email", "type")) === "email");
ok("…with the line every page that takes an email carries", /We'll also send occasional tips from Rachel\. Unsubscribe anytime\./.test(txt));
ok("…and the team door hidden", !(await p.pg.isVisible("#team")));
await p.pg.fill("#email", "not-an-email");
await p.pg.click("#go");
ok("a mistyped email is caught on the page, and nothing is sent", /valid email/.test(await p.pg.textContent("#err")) && p.posts.length === 0);
await p.pg.fill("#email", "  mom@example.com ");
await p.pg.click("#go");
await p.pg.waitForSelector("#done:not([hidden])", { timeout: 3000 }).catch(() => {});
const lead = p.posts.find((x) => x.path === "/api/lead");
ok("Notify me sends one lead: the email, 'parent', where it came from, and the one launch email",
  p.posts.length === 1 && lead && JSON.stringify(lead.body) === JSON.stringify({ email: "mom@example.com", role: "parent", source: "app-launch", welcome: true }), p.posts);
ok("…then thanks them with the launch note", (await p.pg.textContent("#doneMsg")) === L.LAUNCH_NOTE && !(await p.pg.isVisible("#notify")));
for (let i = 0; i < 5; i++) await p.pg.click("#echo");
ok("five taps on Echo show the team door", await p.pg.isVisible("#team"));
await p.pg.fill("#teamKey", "team-key-for-the-tests");
const nav = p.pg.waitForURL(/\/today\.html$/, { timeout: 4000 }).then(() => true, () => false);
await p.pg.click("#teamGo");
const door2 = p.posts.find((x) => x.path === "/api/launch/preview");
ok("…the key goes in a header, not the address or the body", door2 && door2.headers["x-founder-key"] === "team-key-for-the-tests" && !/team-key/.test(p.pg.url()));
ok("…and once the door opens, the lock page's own address goes Home", await nav, p.pg.url());
ok("no page errors on the lock page", p.errs.length === 0, p.errs);
await p.ctx.close();

// a phone left on the page opens the app by itself at launch
p = await phone(AT + 120000);
const went = p.pg.waitForURL(/\/today\.html$/, { timeout: 4000 }).then(() => true, () => false);
await p.pg.goto(BASE + "/launching.html");
ok("after launch the lock page opens the app by itself", await went, p.pg.url());
await p.ctx.close();

// a lock page brought back to the front opens the app once the lock has
// lifted early, and stays while Home is still the lock page
for (const lifted of [false, true]) {
  p = await phone(before);
  await p.ctx.route("**/today.html", (route) => route.fulfill({ status: 200, contentType: "text/html",
    body: lifted ? "<!doctype html><title>Pick a game</title><p>Home</p>" : LOCKPAGE }));
  await p.pg.goto(BASE + "/launching.html");
  await p.pg.waitForTimeout(300);
  const moved = p.pg.waitForURL(/\/today\.html$/, { timeout: 2500 }).then(() => true, () => false);
  await p.pg.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  const wentHome = await moved;
  ok(lifted ? "a lock page brought back to the front opens the app once the lock has lifted early" : "…and stays put while Home is still the lock page",
    wentHome === lifted, { lifted, url: p.pg.url() });
  ok("…with no page errors", p.errs.length === 0, p.errs);
  await p.ctx.close();
}

// and it fits a small phone
p = await phone(before, { width: 320, height: 568 });
await p.pg.goto(BASE + "/launching.html");
await p.pg.waitForTimeout(300);
const fit = await p.pg.evaluate(() => { const b = document.getElementById("go").getBoundingClientRect(); return { over: document.documentElement.scrollWidth - innerWidth, left: b.left, right: b.right, w: innerWidth }; });
ok("on a 320 px phone nothing runs off the side, Notify me included", fit.over <= 0 && fit.left >= 0 && fit.right <= fit.w, fit);
await p.ctx.close();

await browser.close(); server.close();
console.log(fails ? fails + " FAILURES / " + (passes + fails) + " assertions" : "ALL GREEN — " + passes + " assertions");
process.exit(fails ? 1 : 0);
