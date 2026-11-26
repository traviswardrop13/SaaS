// SESSPLAY1: a Sona game played in a clinician's session, on the clinician's
// own device (Travis, 17 Nov 2026: "I want it built into their app so that
// it's accessible on the SLPs ... loaded into their app"). Session games'
// "Play now" asks /api/slp/play, then writes this tab's record
// (sessionStorage "sona.sessplay.v1") and opens the game. Pinned here, in a
// real browser:
//   1. a valid record runs the game set to its sound (a temporary child: no
//      name, the record's age band, its one sound and position), with every
//      game, the sound's talking story and its books open, in that tab only;
//   2. the device's family storage is never touched (the real localStorage
//      is the same before and after, byte for byte), and nothing leaves but
//      the page's own files and Echo's voice (/api/tts): no /api call, no
//      beacon, no other site;
//   3. no setup, price, Settings or Home: any other page, and every game's
//      way out (Home), lands on the dashboard's Session games, which ends the
//      session (the record and its box go, and a play token left by the
//      session cannot open that game again in the tab);
//   4. a record that is broken, expired, too far ahead, for a sound or
//      position that does not exist, or absent is no session at all: the
//      page behaves as it always has;
//   5. the clinicians' iPhone app (SonaSLPApp/1) may open a game page only
//      while a session runs; lib/slpApp allows the play pages and still
//      never Home, setup or the price.
// No network beyond a local server.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const APP = ROOT.replace(/\/public$/, "");
let checks = 0, fails = 0;
const ok = (n, p, extra) => { checks++; if (!p) fails++; console.log((p ? "PASS " : "FAIL ") + n + (p ? "" : "  → " + (typeof extra === "string" ? extra : JSON.stringify(extra)))); };

// ── part 1: the clinicians' app's page list (lib/slpApp.ts, run for real) ──
{
  const js = ts.transpileModule(readFileSync(path.join(APP, "lib/slpApp.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} }; new Function("module", "exports", js)(mod, mod.exports);
  const L = mod.exports;
  const yes = ["/slp.html", "/slp-login.html", "/privacy.html", "/charge.html", "/arcade-hoops.html", "/arcade-slice.html", "/library.html", "/adventure.html", "/assets/crafted/home-fruit.webp", "/sona.js"];
  const no = ["/today.html", "/onboarding.html", "/subscribe.html", "/settings.html", "/progress.html", "/premium.html", "/activities.html", "/road.html", "/story-game.html"];
  ok("the app may load the play pages (practice, every game, the talking story, the books) and its own", yes.every((p) => L.slpAppPageAllowed(p)), yes.filter((p) => !L.slpAppPageAllowed(p)));
  ok("…and never the family's Home, setup, Settings, the price or the rest", no.every((p) => !L.slpAppPageAllowed(p)), no.filter((p) => L.slpAppPageAllowed(p)));
}

// ── part 2: sona.js holds the rule (read as source) ──
const SONA = readFileSync(path.join(ROOT, "sona.js"), "utf8");
{
  const block = SONA.slice(SONA.indexOf("// ── SESSPLAY1"), SONA.indexOf("function sessionPlay()"));
  ok("the session is read from this tab's sessionStorage record alone, never from the address", block.length > 500 &&
    /sessionStorage\.getItem\(SESS_KEY\)/.test(block) && !/location\.(search|hash)|URLSearchParams/.test(block));
  ok("…at most 12 hours (and 5 minutes of clock slack) ahead", /exp <= now \+ 12 \* 3600000 \+ 300000/.test(block));
  ok("premium(), canSellHere() and track() answer the session first",
    /function premium\(\) \{\n    if \(_sess\) return true;/.test(SONA) && /function canSellHere\(\) \{\n    if \(_sess\) return false;/.test(SONA) && /function track\(ev, props\) \{\n    if \(_sess\) return;/.test(SONA));
  ok("Sona.sessionPlay is exported", /global\.Sona = \{ sessionPlay,/.test(SONA));
}

// ── the browser ──
const PORT = 8471;
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", webp: "image/webp", jpg: "image/jpeg", json: "application/json", mp4: "video/mp4", wav: "audio/wav", mp3: "audio/mpeg", woff2: "font/woff2" };
let hits = [];
const ACCOUNT = { ok: true, email: "rachel@example.com", code: "rachel-k4", familyKey: "ABCD2345", name: "Rachel K", clinic: "Bright Steps", onboarded: true };
const PLAN = { ok: true, active: false, source: "none", periodEnd: null, cancelAtPeriodEnd: false, self: { active: false }, pro: { active: true, status: "trialing", offer: false, name: "Sona Pro", price: "$19.99", per: "a month", trialDays: 14, trialAvailable: false }, dashboard: { open: true } };
const server = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  let body = ""; req.on("data", (c) => (body += c));
  req.on("end", () => {
    const json = (v, s = 200) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(v)); };
    if (u.pathname.startsWith("/api/")) {
      hits.push(req.method + " " + u.pathname);
      if (u.pathname === "/api/slp/auth/me") return json(ACCOUNT);
      if (u.pathname === "/api/slp") return json({ ok: true, configured: true, kids: [], invites: [] });
      if (u.pathname === "/api/slp/plan") return json(PLAN);
      if (u.pathname === "/api/tts") return json({ error: "off" }, 503);
      return json({ ok: true });
    }
    const p = path.join(ROOT, u.pathname === "/" ? "/index.html" : u.pathname);
    if (!p.startsWith(ROOT) || !existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": MIME[p.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(p));
  });
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const ORIGIN = "http://127.0.0.1:" + PORT;
const browser = await chromium.launch(launchOpts());

// A family already on this device: their profile, practice and Premium must
// come through a session exactly as they were.
const FAMILY = {
  "sona.profile.v1": JSON.stringify({ childName: "Mia", childAge: 6, focusSounds: ["S"], onboarded: true, wordPosition: "m" }),
  "sona.progress.v1": JSON.stringify({ sessions: [{ d: "2026-11-10" }], totals: { sessions: 1, words: 12, stars: 3, coins: 40 }, streak: { count: 1, lastDate: "2026-11-10" }, bySound: {}, stage: { S: 2 }, chests: {}, missed: [] }),
  "sona.freever.v1": "post", "sona.buddyset.v1": "post",
  "sona.freeera.v1": "1", "sona.freeera2.v1": "1", "sona.freeera3.v1": "1", "sona.freeera4.v1": "1", "sona.freeera5.v1": "1",
};
const record = (o = {}) => ({ sound: "R", pos: "i", age: "5-6", exp: Date.now() + 3600000, game: "hoops", ...o });

async function fresh(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...(opts.ua ? { userAgent: opts.ua } : {}) });
  const page = await ctx.newPage(); page.setDefaultTimeout(5000);
  const errors = [], requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.method() + " " + r.url()));
  await page.goto(ORIGIN + "/fonts.css");
  await page.evaluate(({ fam, rec, seedFamily }) => {
    if (seedFamily) Object.keys(fam).forEach((k) => localStorage.setItem(k, fam[k]));
    if (rec) sessionStorage.setItem("sona.sessplay.v1", typeof rec === "string" ? rec : JSON.stringify(rec));
  }, { fam: FAMILY, rec: opts.record === undefined ? record() : opts.record, seedFamily: opts.family !== false });
  return { ctx, page, errors, requests };
}
const realStore = async (ctx) => {
  const st = await ctx.storageState();
  const o = st.origins.find((x) => x.origin === ORIGIN);
  const out = {}; (o ? o.localStorage : []).forEach((kv) => { out[kv.name] = kv.value; });
  return out;
};
const settle = (page, ms = 1200) => page.waitForTimeout(ms);

try {
  // ── 1 & 2: a session on a Say & Play game ──
  {
    hits = [];
    const { ctx, page, errors, requests } = await fresh();
    const before = await realStore(ctx);
    await page.goto(ORIGIN + "/arcade-hoops.html"); await settle(page);
    const st = await page.evaluate(() => {
      const p = Sona.getProfile();
      return { url: location.pathname, sess: Sona.sessionPlay(), sounds: p.focusSounds, name: p.childName, age: Number(p.childAge), pos: p.wordPosition, onboarded: p.onboarded,
        premium: Sona.premium(), sell: Sona.trialFirst(), hoops: Sona.gameAccess("hoops").allowed, stack: Sona.gameAccess("stack").allowed, puppy: Sona.gameAccess("puppy").allowed,
        box: Object.keys(sessionStorage).filter((k) => k.indexOf("sona.sp:") === 0).length };
    });
    ok("a valid record: the game stays open in session play", st.url === "/arcade-hoops.html" && st.sess && st.sess.sound === "R" && st.sess.game === "hoops", st);
    ok("…for a temporary child with no name: the record's one sound, its position and its age band, set up",
      JSON.stringify(st.sounds) === '["R"]' && st.name === "" && st.age === 6 && st.pos === "i" && st.onboarded === true, st);
    ok("…every finished game open in this tab (a parked one still shut), and no price", st.premium === true && st.hoops && st.stack && !st.puppy && st.sell === false, st);
    ok("…its storage in a box in this tab's sessionStorage", st.box >= 1, st);
    // the page tries to talk to the server: nothing leaves
    const sent = await page.evaluate(async () => {
      const r = await fetch("/api/pilot", { method: "POST", body: "{}" }).then((x) => x.json());
      const b = navigator.sendBeacon("/api/track", "{}");
      try { await fetch("https://example.com/collect", { method: "POST", body: "x" }); } catch (e) {}
      Sona.track("game opened", { game: "hoops" });
      return { r, b };
    });
    await settle(page, 400);
    ok("a call to /api/pilot, a beacon and another site are answered on the device, unsent", sent.r.sessionPlay === true && sent.b === true &&
      !hits.some((h) => /\/api\/(pilot|track)/.test(h)) && !requests.some((r) => /example\.com/.test(r)), { hits, requests: requests.filter((r) => !/127\.0\.0\.1/.test(r)) });
    ok("…nothing reached the server but Echo's voice", hits.every((h) => h === "POST /api/tts"), hits);
    const after = await realStore(ctx);
    ok("the device's family storage is exactly as it was, every key", JSON.stringify(after) === JSON.stringify(before) && JSON.parse(after["sona.profile.v1"]).childName === "Mia", { before: Object.keys(before), after: Object.keys(after) });
    ok("no page errors", errors.length === 0, errors);

    // the practice page of a round game, the books, the sound's talking story
    hits = [];
    await page.goto(ORIGIN + "/charge.html?game=arcade-slice.html"); await settle(page);
    const ch = await page.evaluate(() => ({ url: location.pathname, rot: Sona.rotSounds(), slice: Sona.gameAccess("slice").allowed }));
    ok("Fruit Slice's practice page opens set to R", ch.url === "/charge.html" && JSON.stringify(ch.rot) === '["R"]' && ch.slice, ch);
    await page.goto(ORIGIN + "/library.html"); await settle(page);
    const lib = await page.evaluate(() => ({ url: location.pathname, open: Sona.booksOpen(), target: Sona.targetSound ? Sona.targetSound() : "" }));
    ok("the bookshelf opens, every book open, on R", lib.url === "/library.html" && lib.open === true && (lib.target === "R" || lib.target === ""), lib);
    await page.goto(ORIGIN + "/adventure.html?again=1&story=robo"); await settle(page);
    const adv = await page.evaluate(() => ({ url: location.pathname, replay: Sona.storyReplay("robo"), other: Sona.storyReplay("sandy") }));
    ok("R's talking story is told in the session, though this child finished nothing; another sound's is not", adv.url === "/adventure.html" && adv.replay === true && adv.other === false, adv);
    ok("…and still nothing left but Echo's voice", hits.every((h) => h === "POST /api/tts"), hits);
    const after2 = await realStore(ctx);
    ok("…and the family's storage is still untouched", JSON.stringify(after2) === JSON.stringify(before), Object.keys(after2));

    // 3: no setup, price, Settings or Home; the way out is Session games
    for (const p of ["/onboarding.html", "/subscribe.html?setup=1", "/settings.html", "/today.html", "/activities.html"]) {
      await page.goto(ORIGIN + p); await page.waitForURL(/\/slp\.html/, { timeout: 5000 }).catch(() => {});
      const at = await page.evaluate(() => location.pathname + location.hash);
      ok(p + " in a session goes to the dashboard's Session games", /^\/slp\.html#play/.test(at), at);
      if (p !== "/activities.html") {
        // put the session back for the next page: the dashboard ended it
        await page.evaluate((r) => sessionStorage.setItem("sona.sessplay.v1", JSON.stringify(r)), record());
      }
    }
    await page.waitForSelector("#page-play.active", { timeout: 5000 }).catch(() => {});
    const dash = await page.evaluate(() => ({ active: document.getElementById("page-play").classList.contains("active"), left: Object.keys(sessionStorage).filter((k) => /^sona\.(sessplay|sp:|play\.|run\.)/.test(k)) }));
    ok("…where Session games is open, and the session is over: its record, its box and any play token are gone", dash.active && dash.left.length === 0, dash);
    await ctx.close();
  }
  // a play token left by a session does not open its game after it
  {
    const { ctx, page } = await fresh({ family: false });
    await page.goto(ORIGIN + "/charge.html?game=arcade-stack.html"); await settle(page, 600);
    await page.evaluate(() => { sessionStorage.setItem("sona.play.token", "arcade-stack.html"); });
    await page.goto(ORIGIN + "/today.html"); await page.waitForURL(/\/slp\.html/, { timeout: 5000 }).catch(() => {});
    await settle(page, 600);
    const left = await page.evaluate(() => sessionStorage.getItem("sona.play.token"));
    ok("a play token a session left is cleared when the dashboard opens", left === null, left);
    await ctx.close();
  }
  // a talking story for another sound sends the session back
  {
    const { ctx, page } = await fresh({ record: record({ sound: "S", game: "robo" }) });
    await page.goto(ORIGIN + "/adventure.html?again=1&story=robo"); await page.waitForURL(/\/slp\.html/, { timeout: 5000 }).catch(() => {});
    ok("another sound's talking story is never told in a session: back to Session games", /\/slp\.html/.test(page.url()), page.url());
    await ctx.close();
  }

  // ── 4: no session at all ──
  for (const [label, rec] of [
    ["no record", null],
    ["an expired record", record({ exp: Date.now() - 1000 })],
    ["a record set for two days ahead", record({ exp: Date.now() + 48 * 3600000 })],
    ["a sound that does not exist", record({ sound: "X" })],
    ["vocalic R for S", record({ sound: "S", pos: "v" })],
    ["blends for K", record({ sound: "K", pos: "b" })],
    ["an age band that does not exist", record({ age: "10-12" })],
    ["a broken record", "{not json"],
  ]) {
    hits = [];
    const { ctx, page } = await fresh({ record: rec, family: false });
    await page.goto(ORIGIN + "/arcade-hoops.html"); await page.waitForURL(/activities|today|onboarding/, { timeout: 4000 }).catch(() => {});
    await settle(page, 500);
    const st = await page.evaluate(() => ({ url: location.pathname + location.search, sess: window.Sona ? Sona.sessionPlay() : "none", ls: typeof localStorage.getItem === "function" && Object.getOwnPropertyDescriptor(window, "localStorage") ? !!Object.getOwnPropertyDescriptor(window, "localStorage").get && localStorage.constructor === Object : false }));
    ok(label + ": no session, and Hoops is Premium as ever (a fresh device is sent away)", st.sess === null && !/\/arcade-hoops\.html$/.test(st.url) && st.ls === false, st);
    await ctx.close();
  }

  // ── 5: the clinicians' iPhone app ──
  {
    const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SonaSLPApp/1";
    let { ctx, page } = await fresh({ ua: UA, record: null, family: false });
    await page.goto(ORIGIN + "/arcade-hoops.html"); await page.waitForURL(/\/slp\.html/, { timeout: 5000 }).catch(() => {});
    ok("in the clinicians' app, a game page with no session goes to the dashboard", /\/slp\.html/.test(page.url()), page.url());
    await ctx.close();
    ({ ctx, page } = await fresh({ ua: UA, family: false }));
    await page.goto(ORIGIN + "/arcade-hoops.html"); await settle(page);
    ok("…and opens, set to R, while the dashboard's session runs", page.url().endsWith("/arcade-hoops.html") && (await page.evaluate(() => Sona.sessionPlay() && Sona.sessionPlay().sound)) === "R", page.url());
    await page.goto(ORIGIN + "/today.html"); await page.waitForURL(/\/slp\.html/, { timeout: 5000 }).catch(() => {});
    ok("…and its way out is the dashboard, never the family's Home", /\/slp\.html/.test(page.url()), page.url());
    await ctx.close();
  }
} finally {
  await browser.close(); server.close();
}
console.log(checks + " checks; " + fails + " failures");
process.exit(fails ? 1 : 0);
