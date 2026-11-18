// APPHOST1 (17 Nov 2026): the app moves to app.speaksona.com so speaksona.com
// can become GoHighLevel's website. A phone keeps a family's Sona under the
// exact address it was used on, so the move must carry it: www sends a
// browser to the same page on the app's address, and the app's address
// copies this same phone's www storage across once (moving.html asking
// www/handoff.html). This plays it with both addresses served from public/.
import { readFileSync } from "fs";
import { chromium, launchOpts, ROOT } from "./_env.mjs";

let fails = 0;
const ok = (n, p, extra) => { if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (extra || ""))); };

const WWW = "https://www.speaksona.com", APP = "https://app.speaksona.com";
const TYPES = { html: "text/html", js: "application/javascript", css: "text/css", json: "application/json", webp: "image/webp", png: "image/png", svg: "image/svg+xml", webmanifest: "application/manifest+json" };

const browser = await chromium.launch(launchOpts);

// Both addresses serve this repo's public/; the API answers nothing; every
// other host is cut off. `opts.handoff` replaces www's handoff page.
async function phone(opts = {}) {
  const ctx = await browser.newContext(opts.ctx || {});
  const asked = [];
  await ctx.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (!/(^|\.)speaksona\.com$/.test(u.hostname) && u.hostname !== "evil.example") return route.abort();
    asked.push(u.origin + u.pathname);
    if (u.hostname === "evil.example") {
      return route.fulfill({ contentType: "text/html", body: "<!doctype html><body><script>window.got=[];addEventListener('message',e=>got.push(e.data));</script><iframe src='" + WWW + "/handoff.html'></iframe></body>" });
    }
    if (u.pathname === "/handoff.html" && u.hostname === "www.speaksona.com" && opts.handoff) return opts.handoff(route);
    if (u.pathname.startsWith("/api/")) return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    const p = u.pathname === "/" ? "/for-slps.html" : u.pathname;
    try {
      const body = readFileSync(ROOT + decodeURIComponent(p));
      return route.fulfill({ body, contentType: TYPES[(p.split(".").pop() || "").toLowerCase()] || "application/octet-stream" });
    } catch (e) { return route.fulfill({ status: 404, body: "" }); }
  });
  if (opts.init) await ctx.addInitScript(opts.init);
  return { ctx, asked };
}
// Storage is set on a page that loads no sona.js, so nothing moves while seeding.
async function seed(ctx, origin, items) {
  const pg = await ctx.newPage();
  await pg.goto(origin + "/privacy.html");
  await pg.evaluate((it) => { for (const k in it) localStorage.setItem(k, it[k]); }, items);
  await pg.close();
}
const store = (pg) => pg.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
const moved = async (pg) => JSON.parse((await pg.evaluate(() => localStorage.getItem("sona.moved.v1"))) || "null");
// Every address the tab was on, in order: the app itself may then send a
// made-up test family on (to setup), so a check reads where moving.html went.
async function open(ctx, url) {
  const pg = await ctx.newPage();
  pg.trail = [];
  pg.on("framenavigated", (f) => { if (f === pg.mainFrame()) pg.trail.push(f.url()); });
  await pg.goto(url, { waitUntil: "commit" });
  // Done once moving.html has passed the tab on, or when it never came.
  const t0 = Date.now();
  for (;;) {
    const i = pg.trail.findIndex((t) => t.includes("/moving.html"));
    if (i >= 0 && pg.trail.length > i + 1) break;
    if (i < 0 && Date.now() - t0 > 2500) break;
    if (Date.now() - t0 > 15000) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await pg.waitForLoadState("load").catch(() => {});
  return pg;
}
// The first address after moving.html (or the first one on the app's address).
const landed = (pg) => {
  const i = pg.trail.findIndex((u) => u.includes("/moving.html"));
  const after = pg.trail.slice(i + 1).filter((u) => new URL(u).hostname === "app.speaksona.com");
  return new URL(after[0] || pg.url());
};

const FAMILY = {
  "sona.profile.v1": JSON.stringify({ onboarded: true, childName: "Mia", age: 5 }),
  "sona.freeera4.v1": "1",
  "sona.coins.v1": "37",
  "sona.kids.v1": JSON.stringify({ list: [{ slot: "", name: "Mia" }], active: "" }),
};

// 1. A family on www, first open after the move: same page, same address bar
// details, everything copied verbatim, www left untouched.
{
  const { ctx, asked } = await phone();
  await seed(ctx, WWW, FAMILY);
  const pg = await open(ctx, WWW + "/today.html?from=email#week");
  const u = landed(pg);
  ok("www sends a browser to the same page on app.speaksona.com", u.origin === APP && u.pathname === "/today.html", pg.trail.join(" "));
  ok("…keeping its query and hash", u.search === "?from=email" && u.hash === "#week", pg.trail.join(" "));
  ok("…by way of moving.html, which asked www's handoff page", asked.includes(APP + "/moving.html") && asked.includes(WWW + "/handoff.html"), asked.join(" "));
  const here = await store(pg);
  // (the app itself adds to the profile once it runs, so the child is checked by name)
  ok("every key the family had on www is on the app's address, verbatim (free-era mark included)", Object.keys(FAMILY).every((k) => k === "sona.profile.v1" ? /"childName":"Mia"/.test(here[k] || "") : here[k] === FAMILY[k]), JSON.stringify(here));
  ok("…and the family lands home, not back in setup", !pg.trail.some((t) => t.includes("/onboarding.html")), pg.trail.join(" "));
  ok("…and the move is marked copied", (await moved(pg))?.how === "copied", JSON.stringify(await moved(pg)));
  const www = await ctx.newPage(); await www.goto(WWW + "/privacy.html");
  const left = await store(www);
  ok("…while www keeps its own copy (the move only copies)", Object.keys(FAMILY).every((k) => left[k] === FAMILY[k]) && !left["sona.moved.v1"], JSON.stringify(left));
  // 2. Every later open goes straight to the page.
  const before = asked.length;
  const again = await open(ctx, APP + "/today.html");
  ok("a later open never visits moving.html again", !asked.slice(before).some((a) => a.endsWith("/moving.html") || a.endsWith("/handoff.html")) && again.trail[0].endsWith("/today.html"), again.trail.join(" "));
  await ctx.close();
}

// 3. A family who already set up on the new address keeps what they made.
{
  const { ctx } = await phone();
  await seed(ctx, WWW, { ...FAMILY, "sona.test.wwwonly": "1" });
  await seed(ctx, APP, { "sona.profile.v1": JSON.stringify({ onboarded: true, childName: "Leo" }) });
  const pg = await open(ctx, APP + "/today.html");
  const s = await store(pg);
  ok("a child already made on app.speaksona.com is never overwritten", !("sona.test.wwwonly" in s) && /Leo/.test(s["sona.profile.v1"] || ""), JSON.stringify(s));
  ok("…and the move is marked kept", (await moved(pg))?.how === "kept");
  await ctx.close();
}

// 4. A brand-new family: nothing on www, marked once, never asked again.
{
  const { ctx } = await phone();
  const pg = await open(ctx, APP + "/today.html");
  ok("a phone with nothing on www is marked empty and goes on to its page", (await moved(pg))?.how === "empty" && landed(pg).pathname === "/today.html", pg.trail.join(" "));
  await ctx.close();
}

// 5. www doesn't answer (offline, or speaksona.com is GoHighLevel's already):
// no loop, two more tries on later opens, then it stops asking.
{
  const { ctx, asked } = await phone({ handoff: (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><p>another site</p>" }) });
  const t0 = Date.now();
  const pg = await open(ctx, APP + "/today.html");
  ok("no answer: the family still reaches their page, after the wait", landed(pg).pathname === "/today.html" && Date.now() - t0 < 14000, pg.trail.join(" "));
  ok("…unmarked, one try counted", (await moved(pg)) === null && (await pg.evaluate(() => localStorage.getItem("sona.moved.tries"))) === "1");
  await pg.goto(APP + "/today.html"); await pg.waitForLoadState("load");
  ok("…and opening it again in the same tab does not loop back to moving.html", asked.filter((a) => a.endsWith("/moving.html")).length === 1, pg.trail.join(" "));
  await open(ctx, APP + "/today.html");
  const last = await open(ctx, APP + "/today.html");
  ok("…after three opens with no answer it stops asking (gaveup)", (await moved(last))?.how === "gaveup", JSON.stringify(await moved(last)));
  await ctx.close();
}

// 6. Only www's own page can hand anything over.
{
  const { ctx } = await phone({ handoff: async (r) => { await new Promise((s) => setTimeout(s, 3000)); return r.fulfill({ contentType: "text/html", body: readFileSync(ROOT + "/handoff.html", "utf8") }); } });
  await seed(ctx, WWW, FAMILY);
  const pg = await ctx.newPage();
  await pg.goto(APP + "/today.html", { waitUntil: "commit" });
  await pg.waitForURL(/moving\.html/, { waitUntil: "commit" });
  await pg.evaluate(() => window.postMessage({ app: "sona-handoff", v: 1, items: { "sona.sub.v1": "forged", "sona.profile.v1": "{}" } }, "*"));
  await pg.waitForURL((u) => !u.pathname.startsWith("/moving.html"), { timeout: 15000 });
  const s = await store(pg);
  ok("a message from any other sender is ignored (no forged plan)", s["sona.sub.v1"] !== "forged" && /Mia/.test(s["sona.profile.v1"] || ""), JSON.stringify(s));
  // and the handoff page tells nobody else
  const evil = await ctx.newPage();
  await evil.goto("https://evil.example/");
  await evil.waitForTimeout(1500);
  ok("www's handoff page sends this phone's Sona to no other site that frames it", (await evil.evaluate(() => window.got.length)) === 0);
  await ctx.close();
}

// 7. Who stays on www, for now.
{
  const cap = "window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };";
  const { ctx, asked } = await phone({ init: cap });
  const pg = await ctx.newPage();
  await pg.goto(WWW + "/today.html"); await pg.waitForTimeout(800);
  ok("an App Store build from before the move stays on www (its native mic and purchases are proven there)", new URL(pg.url()).origin === WWW && !asked.some((a) => a.startsWith(APP)), pg.url());
  await ctx.close();
}
{
  const { ctx } = await phone({ ctx: { userAgent: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 SonaSLPApp/1" } });
  const pg = await ctx.newPage();
  await pg.goto(WWW + "/slp.html"); await pg.waitForTimeout(800);
  ok("the clinicians' app from before the move stays on www (its shell only allows www)", new URL(pg.url()).origin === WWW, pg.url());
  await ctx.close();
}
{
  const { ctx } = await phone({ init: "Object.defineProperty(navigator, 'standalone', { get: () => true });" });
  const pg = await ctx.newPage();
  await pg.goto(WWW + "/today.html"); await pg.waitForTimeout(800);
  ok("a home-screen copy stays on www (its storage may not cross)", new URL(pg.url()).origin === WWW, pg.url());
  await ctx.close();
}

// 8. moving.html only ever goes to a page on this site.
{
  const { ctx } = await phone();
  for (const bad of ["//evil.example/x", "https://evil.example/", "javascript:alert(1)", "/moving.html?next=/x"]) {
    const pg = await ctx.newPage();
    await pg.evaluate(() => 0);
    await pg.goto(APP + "/moving.html?next=" + encodeURIComponent(bad));
    await pg.waitForURL((u) => !u.pathname.startsWith("/moving.html"), { timeout: 15000 }).catch(() => {});
    const u = new URL(pg.url());
    ok("moving.html refuses next=" + bad + " and goes home instead", u.origin === APP && u.pathname !== "/moving.html", pg.url());
    await pg.evaluate(() => { localStorage.removeItem("sona.moved.v1"); sessionStorage.clear(); });
    await pg.close();
  }
  const direct = await ctx.newPage();
  await direct.goto(WWW + "/handoff.html");
  await direct.waitForURL((u) => u.origin === APP, { timeout: 8000 }).catch(() => {});
  ok("handoff.html opened on its own just goes to the app", new URL(direct.url()).origin === APP, direct.url());
  await ctx.close();
}

// 9. The pieces outside the browser.
const cap = JSON.parse(readFileSync(ROOT + "/../capacitor.config.json", "utf8"));
ok("the family iPhone app's next build loads app.speaksona.com", cap.server.url === APP && cap.server.allowNavigation.includes("*.speaksona.com"), JSON.stringify(cap.server));
const slpCap = JSON.parse(readFileSync(ROOT + "/../native/slp-ios/capacitor.config.json", "utf8"));
ok("the clinicians' app's next build loads app.speaksona.com", slpCap.server.url === APP && slpCap.server.allowNavigation.includes("app.speaksona.com"), JSON.stringify(slpCap.server));
const LIB = ["nurture.ts", "report.ts", "revenuecat.ts", "board.ts", "slpAuth.ts"].map((f) => readFileSync(ROOT + "/../lib/" + f, "utf8")).join("\n");
ok("no emailed link points at speaksona.com (it becomes GoHighLevel's site)", !/https:\/\/(www\.)?speaksona\.com\/(api|privacy|slp)/.test(LIB));
ok("…they use the one constant in lib/site.ts", /APP_ORIGIN = "https:\/\/" \+ APP_HOST/.test(readFileSync(ROOT + "/../lib/site.ts", "utf8")) && /\$\{APP_ORIGIN\}\/api\/email\/unsub/.test(LIB));
ok("the sign-in and board emails build their links on the app's address", /linkOrigin\(origin\)/.test(readFileSync(ROOT + "/../app/api/slp/auth/request/route.ts", "utf8")) && /linkOrigin\(new URL\(req\.url\)\.origin\)/.test(readFileSync(ROOT + "/../app/api/board/start/route.ts", "utf8")));
const sona = readFileSync(ROOT + "/sona.js", "utf8");
ok("the move's marks never ride a backup in or out", /NO_EXPORT = \["sona\.moved\.v1", "sona\.moved\.tries"/.test(sona) && /NO_IMPORT = \["sona\.moved\.v1", "sona\.moved\.tries"/.test(sona));
ok("moving.html and handoff.html are never behind the launch lock", /"moving\.html", "handoff\.html"/.test(readFileSync(ROOT + "/../lib/launch.ts", "utf8")));

await browser.close();
console.log(fails ? `\n${fails} FAILED` : "\nALL GREEN");
process.exit(fails ? 1 : 0);
