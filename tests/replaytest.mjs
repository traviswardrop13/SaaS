// REPLAY1: PostHog's session recording on four grown-up screens (Travis, 15
// Oct 2026: "how do i start recording", then yes to recording only the
// grown-up screens with names and typing blanked out). public/analytics.js
// holds the rules; setup (onboarding.html) and the plan screen
// (subscribe.html) say when.
//
// This suite runs the REAL recorder: posthog-js 1.438.12 (the version the
// CDN served that day), loaded from node_modules in place of PostHog's CDN,
// on pages served at https://speaksona.com (analytics.js records nowhere
// else), against a fake PostHog that keeps every request. Its project
// settings are as loose as PostHog allows (no input masking, console logs,
// network bodies, canvas, heatmaps, dead clicks, exceptions, surveys), so
// every guarantee below is the page's own and none is PostHog's default.
// What is checked is what would actually be sent:
//   - a recording happens where it should (not a vacuous pass), and nowhere
//     else: not Settings, not a clinician's setup, not a test server;
//   - no child's name, no parent's address, nothing typed, ever;
//   - setup's speech therapy question and the screen that repeats its
//     answer are never recorded, not even a pointer moving over them;
//   - nothing after "Hand the phone to <Name>!".
// Needs posthog-js: `npm install --no-save posthog-js@1.438.12` (CI's tests
// job installs it beside playwright).
import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";
import { phone, ZONE } from "./_phone.mjs";

let fails = 0, passes = 0;
const ok = (name, cond, info) => {
  if (cond) { passes++; console.log("PASS " + name); }
  else { fails++; console.log("FAIL " + name + (info === undefined ? "" : "  → " + JSON.stringify(info).slice(0, 700))); }
};
async function scenario(label, run) { try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

const require = createRequire(import.meta.url);
let PH = null;
try { PH = path.join(path.dirname(require.resolve("posthog-js/package.json")), "dist"); } catch (e) {}
if (!PH || !existsSync(path.join(PH, "array.js")) || !existsSync(path.join(PH, "lazy-recorder.js"))) {
  console.log("FAIL posthog-js is installed (npm install --no-save posthog-js@1.438.12)");
  process.exit(1);
}

const SRC = readFileSync(path.join(ROOT, "analytics.js"), "utf8");
const TOKEN = (SRC.match(/POSTHOG_KEY = "(phc_[A-Za-z0-9]+)"/) || [])[1];
const MIME = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", woff2: "font/woff2", json: "application/json", wav: "audio/wav", mp3: "audio/mpeg", ico: "image/x-icon", webmanifest: "application/manifest+json" };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, OPTIONS" };
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
// PostHog's project settings, as loose as they go: the page must hold every line itself
const REMOTE = {
  sessionRecording: {
    endpoint: "/s/",
    masking: { maskAllInputs: false, maskTextSelector: null, blockSelector: null },
    recordCanvas: true, canvasFps: 4, canvasQuality: "0.4",
    consoleLogRecordingEnabled: true,
    networkPayloadCapture: { recordHeaders: true, recordBody: true },
    minimumDurationMilliseconds: 0,
  },
  capturePerformance: { network_timing: true, web_vitals: true },
  autocaptureExceptions: true, heatmaps: true, captureDeadClicks: true, surveys: true,
  supportedCompression: ["gzip-js"], hasFeatureFlags: false,
};

// ── the fake web: speaksona.com from public/, PostHog's CDN from node_modules ──
function file(p) {
  const f = path.join(ROOT, decodeURIComponent(p));
  return f.startsWith(ROOT) && existsSync(f) && statSync(f).isFile() ? f : null;
}
function decode(req) {
  const buf = req.postDataBuffer();
  if (!buf || !buf.length) return [];
  let text;
  if (buf[0] === 0x1f && buf[1] === 0x8b) text = gunzipSync(buf).toString("utf8");
  else {
    text = buf.toString("utf8");
    if (/compression=base64/.test(req.url()) || /^data=/.test(text)) {
      const d = new URLSearchParams(text).get("data") || text;
      text = Buffer.from(d, "base64").toString("utf8");
    }
  }
  const v = JSON.parse(text);
  return Array.isArray(v) ? v : (v && Array.isArray(v.batch) ? v.batch : [v]);
}
async function world(browser, cfg = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", timezoneId: ZONE, userAgent: IPHONE });
  // PostHog drops every event from a browser it takes for a bot (navigator.webdriver)
  await context.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }); } catch (e) {} });
  if (cfg.phone) await context.addInitScript(phone, cfg.phone);
  if (cfg.seed) await context.addInitScript((seed) => { try { if (localStorage.getItem("__seeded")) return; localStorage.setItem("__seeded", "1"); for (const k in seed) localStorage.setItem(k, typeof seed[k] === "string" ? seed[k] : JSON.stringify(seed[k])); } catch (e) {} }, cfg.seed);
  const w = { context, sent: [], assets: [], api: [], aborted: [] };
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (u.hostname === "speaksona.com" || u.hostname === "www.speaksona.com" || u.hostname === "127.0.0.1") {
      if (u.pathname.startsWith("/api/")) { w.api.push({ path: u.pathname, body: req.postData() }); return route.fulfill({ status: 503, contentType: "application/json", body: "{}" }); }
      if (cfg.stubs && cfg.stubs[u.pathname]) return route.fulfill({ status: 200, contentType: "text/html", body: cfg.stubs[u.pathname] });
      const p = u.pathname === "/" ? "/parents.html" : (u.pathname === "/try" ? "/try.html" : (u.pathname === "/for-slps" ? "/for-slps.html" : u.pathname));
      const f = file(p);
      if (!f) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ status: 200, headers: { "content-type": MIME[f.split(".").pop().toLowerCase()] || "application/octet-stream" }, body: readFileSync(f) });
    }
    if (u.hostname === "us-assets.i.posthog.com") {
      w.assets.push(u.pathname);
      if (u.pathname === "/static/array.js") return route.fulfill({ status: 200, headers: Object.assign({ "content-type": "text/javascript" }, CORS), body: readFileSync(path.join(PH, "array.js")) });
      if (/\/lazy-recorder\.js$/.test(u.pathname)) return route.fulfill({ status: 200, headers: Object.assign({ "content-type": "text/javascript" }, CORS), body: readFileSync(path.join(PH, "lazy-recorder.js")) });
      if (u.pathname === "/array/" + TOKEN + "/config.js") return route.fulfill({ status: 200, headers: Object.assign({ "content-type": "text/javascript" }, CORS), body: "window._POSTHOG_REMOTE_CONFIG=window._POSTHOG_REMOTE_CONFIG||{};window._POSTHOG_REMOTE_CONFIG[" + JSON.stringify(TOKEN) + "]={config:" + JSON.stringify(REMOTE) + ",siteApps:[]};" });
      if (u.pathname === "/array/" + TOKEN + "/config") return route.fulfill({ status: 200, headers: Object.assign({ "content-type": "application/json" }, CORS), body: JSON.stringify(REMOTE) });
      return route.fulfill({ status: 404, headers: CORS, body: "" });
    }
    if (u.hostname === "us.i.posthog.com") {
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS, body: "" });
      if (req.method() === "POST") {
        let events = [], raw = "";
        try { events = decode(req); } catch (e) { raw = String((req.postDataBuffer() || "").toString("latin1")).slice(0, 2000); }
        w.sent.push({ path: u.pathname, events, raw, bytes: (req.postDataBuffer() || []).length });
      }
      return route.fulfill({ status: 200, headers: Object.assign({ "content-type": "application/json" }, CORS), body: JSON.stringify({ status: 1 }) });
    }
    w.aborted.push(u.hostname);
    return route.abort();
  });
  w.page = await context.newPage();
  w.page.setDefaultTimeout(8000);
  w.errors = [];
  w.page.on("pageerror", (e) => w.errors.push(e.message));
  w.page.on("dialog", (d) => d.dismiss());
  // What reached PostHog, decoded: every event, the snapshots among them, and the rrweb events inside
  w.events = () => w.sent.flatMap((s) => s.events).filter((e) => e && typeof e.event === "string");
  w.snaps = () => w.events().filter((e) => e && e.event === "$snapshot");
  w.rr = () => w.snaps().flatMap((e) => (e.properties && e.properties.$snapshot_data) || []);
  w.text = () => JSON.stringify(w.sent);
  // Wait until PostHog has sent everything it holds: recordings flush about
  // every 2 s and the request queue every 3 s, so 4 s of quiet is the end.
  w.settle = async (minMs = 2500) => {
    await w.page.waitForTimeout(minMs);
    let n = -1, quiet = 0;
    for (let i = 0; i < 40 && quiet < 4; i++) { if (w.sent.length === n) quiet++; else { quiet = 0; n = w.sent.length; } await w.page.waitForTimeout(1000); }
  };
  return w;
}
// rrweb's event types and incremental sources (stable since rrweb 1)
const FULL = 2, INCR = 3, META = 4, PLUGIN = 6, MOVE = 1, TOUCHMOVE = 6, INTERACTION = 2, INPUT = 5;
const positions = (rr) => rr.filter((e) => e.type === INCR && (e.data.source === MOVE || e.data.source === TOUCHMOVE)).flatMap((e) => e.data.positions || []);
const hasPos = (rr, x, y) => positions(rr).some((p) => Math.round(p.x) === x && Math.round(p.y) === y);
// every node of every full snapshot and every added node, flattened
function nodes(rr) {
  const out = [];
  const walk = (n) => { if (!n || typeof n !== "object") return; out.push(n); (n.childNodes || []).forEach(walk); };
  for (const e of rr) {
    if (e.type === FULL && e.data && e.data.node) walk(e.data.node);
    if (e.type === INCR && e.data && Array.isArray(e.data.adds)) e.data.adds.forEach((a) => walk(a.node));
  }
  return out;
}
// A pointer path no other screen's taps would make: x stays under 12, where
// no button of these pages starts, and each y is unique to this suite.
async function mark(page, y) { for (let i = 0; i < 4; i++) { await page.mouse.move(3 + i * 2, y + i); await page.waitForTimeout(120); } }
const marked = (rr, y) => [0, 1, 2, 3].some((i) => hasPos(rr, 3 + i * 2, y + i));
async function next(page) { await page.evaluate(() => document.body.classList.remove("ob-settling", "price-settling")); await page.locator("#nextBtn").click(); }
const screen = (page) => page.evaluate(() => document.body.dataset.setupScreen);

const browser = await chromium.launch(launchOpts());
try {
  // ── 0. the rules as written ──
  await scenario("analytics.js, as written", async () => {
    ok("posthog-js 1.438.12 is the copy under test (the CDN's on 15 Oct 2026)", JSON.parse(readFileSync(path.join(PH, "..", "package.json"), "utf8")).version === "1.438.12");
    ok("recording is off at the start on every page", /disable_session_recording: true,/.test(SRC));
    ok("only speaksona.com itself records", /ON_SITE = HERE\.hostname === "speaksona\.com" \|\| HERE\.hostname === "www\.speaksona\.com"/.test(SRC));
    for (const [what, re] of [
      ["no console capture", /enable_recording_console_log: false/],
      ["no page or network timings", /capture_performance: false/],
      ["no dead-click capture (it sends the tapped words)", /capture_dead_clicks: false/],
      ["no heatmaps", /capture_heatmaps: false/],
      ["no exception capture", /capture_exceptions: false/],
      ["no surveys", /disable_surveys: true/],
      ["autocapture off", /autocapture: false/],
      ["events uncompressed until they are scrubbed", /compress_events: false/],
      ["every box blocked", /blockSelector: "input, textarea, select, \[contenteditable\]"/],
      ["every text through the scrubber", /maskTextSelector: "\*"/],
      ["every event through the scrubber before it is sent", /before_send: beforeSend/],
      ["no canvas", /captureCanvas: \{ recordCanvas: false \}/],
      ["no request headers or bodies", /recordHeaders: false,[\s\S]{0,40}recordBody: false/],
    ]) ok("analytics.js: " + what, re.test(SRC));
  });

  // ── 1. the scrubber ──
  await scenario("the scrubber", async () => {
    const w = await world(browser, { seed: {
      "sona.profile.v1": { childName: "Zephyrine", email: "Zeph.Parent@Example.com", onboarded: true },
      "sona.profile.v1@k2": { childName: "Al", onboarded: true },
      "sona.kids.v1": { active: "", list: [{ slot: "", name: "Zephyrine" }, { slot: "k2", name: "Al" }] },
    } });
    await w.page.goto("https://speaksona.com/try");
    await w.page.waitForFunction(() => window.SonaAnalytics && window.SonaAnalytics.redact);
    const r = (s) => w.page.evaluate((s) => window.SonaAnalytics.redact(s), s);
    ok("a name anywhere, any case", await r("Is ZEPHYRINE ready? zephyrine’s turn") === "Is [child] ready? [child]’s turn", await r("Is ZEPHYRINE ready? zephyrine’s turn"));
    ok("a two-letter name only as a whole word (not inside Alba or also)", await r("Al, Alba and al’s friend also") === "[child], Alba and [child]’s friend also", await r("Al, Alba and al’s friend also"));
    ok("an address, any case, before the name inside it", await r("write to zeph.parent@example.com") === "write to [email]", await r("write to zeph.parent@example.com"));
    // a name changed later is still scrubbed: nothing is forgotten while the page is open
    await w.page.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.childName = "Quillon"; localStorage.setItem("sona.profile.v1", JSON.stringify(p)); });
    ok("a new name and the old one", await r("Quillon or Zephyrine") === "[child] or [child]", await r("Quillon or Zephyrine"));
    ok("words that are not a name are left alone", await r("Sona practice is ready") === "Sona practice is ready");
    await w.context.close();
  });

  // ── 2. a parent's setup on speaksona.com, in a browser ──
  await scenario("a parent's setup on speaksona.com", async () => {
    const w = await world(browser, { stubs: { "/today.html": "<p>Home</p>", "/charge.html": "<p>Practice</p>", "/arcade-feed.html": "<p>Feed</p>" } });
    const { page } = w;
    await page.goto("https://speaksona.com/onboarding.html?utm_source=ad&fbclid=XYZ123");
    await page.waitForFunction(() => window.Sona && document.getElementById("nextBtn"));
    await mark(page, 101);                          // the hello: recorded
    await next(page);
    await page.locator('[data-step="name"].on').waitFor();
    await page.locator("#obName").fill("Zephyrine");
    await page.locator('#obAge [data-age="6"]').click();
    await next(page);
    await page.locator('[data-step="therapy"].on').waitFor();
    await mark(page, 201);                          // the therapy question: never recorded
    await page.evaluate(() => document.body.classList.remove("ob-settling"));
    await page.locator('[data-step="therapy"] .ask-pick[data-val="t_yes"]').click();
    await page.locator('[data-step="sounds"].on').waitFor();
    // Back to the name, and a new one: both names stay out
    await page.waitForTimeout(500);
    await page.evaluate(() => document.body.classList.remove("ob-settling"));
    await page.locator("#backBtn").click();
    await page.locator('[data-step="therapy"].on').waitFor();
    await mark(page, 211);                          // the therapy question again, an answer held: never recorded
    await page.evaluate(() => document.body.classList.remove("ob-settling"));
    await page.locator("#backBtn").click();
    await page.locator('[data-step="name"].on').waitFor();
    await page.locator("#obName").fill("Quillon");
    await next(page);
    await page.locator('[data-step="therapy"].on').waitFor();
    await page.evaluate(() => document.body.classList.remove("ob-settling"));
    await page.locator('[data-step="therapy"] .ask-pick[data-val="t_yes"]').click();
    await page.locator('[data-step="sounds"].on').waitFor();
    await mark(page, 301);                          // the sounds: recorded (the control)
    await page.evaluate(() => document.body.classList.remove("ob-settling"));
    const chip = page.locator('#obSounds [data-sound="R"]');
    if (await chip.getAttribute("aria-pressed") !== "true") await chip.click();
    await next(page);
    await page.locator('[data-step="goal"].on').waitFor();
    await page.evaluate(() => document.body.classList.remove("ob-settling"));
    await page.locator("#goalSkip").click();
    await page.locator('[data-step="updates"].on').waitFor();
    await page.locator("#updEmail").fill("zeph.parent@example.com");
    await next(page);
    await page.locator('[data-step="ready"].on').waitFor();
    await mark(page, 401);                          // the ready screen: never recorded
    await next(page);
    await page.locator('[data-step="mic"].on').waitFor();
    await mark(page, 501);                          // the microphone: recorded
    await page.evaluate(() => document.body.classList.remove("ob-settling"));
    await page.locator("#micNotNow").click();
    await page.locator('[data-step="achieve"].on').waitFor();
    await mark(page, 601);                          // the hand-off: never recorded
    await w.settle();
    const rr = w.rr(), text = w.text();
    ok("setup: a recording was sent (full snapshots of the page)", rr.filter((e) => e.type === FULL).length >= 2, rr.length);
    ok("setup: the hello's pointer was recorded (the control)", marked(rr, 101));
    ok("setup: the sounds' pointer was recorded (the control)", marked(rr, 301));
    ok("setup: the microphone's pointer was recorded (the control)", marked(rr, 501));
    ok("setup: nothing on the therapy question, first visit", !marked(rr, 201));
    ok("setup: nothing on the therapy question after Back", !marked(rr, 211));
    ok("setup: nothing on the ready screen", !marked(rr, 401));
    ok("setup: nothing on the hand-off", !marked(rr, 601));
    ok("setup: neither name, nor any part of either, is in anything sent", !/zephyr|quillon/i.test(text), (text.match(/.{60}(zephyr|quillon).{60}/i) || [])[0]);
    ok("setup: the address is in nothing sent", !/zeph\.parent|example\.com/i.test(text));
    ok("setup: the names were there to scrub ([child] in the recorded words)", /\[child\]/.test(JSON.stringify(rr)));
    ok("setup: neither ready-screen sentence (the therapy answer) is in anything sent", !/between speech visits|practice you can do at home/i.test(text));
    const all = nodes(rr);
    const therapy = all.filter((n) => n.attributes && /\bph-no-capture\b/.test(n.attributes.class || "") && /\bstep\b/.test(n.attributes.class || ""));
    ok("setup: the therapy screen is an empty shape in every picture of the page", therapy.length > 0 && therapy.every((n) => !(n.childNodes || []).length && !("data-step" in n.attributes) && !("aria-pressed" in n.attributes)), therapy.slice(0, 2));
    const lines = all.filter((n) => n.attributes && /\bready-lines\b/.test(n.attributes.class || ""));
    ok("setup: the ready screen's lines are an empty shape in every picture", lines.length > 0 && lines.every((n) => !(n.childNodes || []).length && !("hidden" in n.attributes)), lines.slice(0, 2));
    const boxes = all.filter((n) => /^(input|textarea|select)$/i.test(n.tagName || ""));
    ok("setup: every box is an empty shape (no value, no type, no placeholder)", boxes.length > 0 && boxes.every((n) => !("value" in n.attributes) && !("placeholder" in n.attributes)), boxes.slice(0, 2));
    ok("setup: no keystroke or box value was recorded", !rr.some((e) => e.type === INCR && e.data.source === INPUT));
    const metas = rr.filter((e) => e.type === META);
    ok("setup: the page address is recorded without its query string (no ad click id)", metas.length > 0 && metas.every((e) => e.data.href === "https://speaksona.com/onboarding.html"), metas.map((e) => e.data.href));
    // PostHog keeps one entry of the page's own load timing for its player,
    // with the address emptied (posthog-js config.js, "Initial entries are
    // required performance metadata"): that, and nothing else, may appear
    const plug = rr.filter((e) => e.type === PLUGIN);
    const bare = (q) => q && q.name === "" && q.isInitial === true && Object.keys(q).every((k) => ["name", "entryType", "startTime", "duration", "endTime", "timeOrigin", "timestamp", "isInitial"].includes(k));
    ok("setup: no console capture and no network request inside the recording (only the page's own load timing, no address)", plug.every((e) => e.data.plugin === "rrweb/network@1" && ((e.data.payload || {}).requests || []).every(bare)) && !/\/api\/|posthog\.com\/(e|s|flags)\//.test(JSON.stringify(rr)), plug.map((e) => e.data));
    ok("setup: no event was compressed past the scrubber", !rr.some((e) => e.cv));
    ok("setup: PostHog loaded only itself, its settings and the recorder (no dead clicks, surveys, exceptions, web vitals, logs)", w.assets.every((p) => p === "/static/array.js" || /lazy-recorder\.js$/.test(p) || p.indexOf("/array/" + TOKEN + "/config") === 0), w.assets);
    ok("setup: no event but setup's own and the recording", w.events().every((e) => ["$snapshot", "setup step", "$pageview", "$identify", "$set", "onboarding completed", "Lead", "CompleteRegistration", "weekly summary opted in", "$opt_in"].includes(e.event)), [...new Set(w.events().map((e) => e.event))]);
    ok("setup: no page error", w.errors.length === 0, w.errors);
    await w.context.close();
  });

  // ── 3. the plan screen, in the app, as the offer ──
  await scenario("the plan screen as the offer, in the app", async () => {
    const RECAP = { "sona.outcomes.v1": { R: { days: {} } } };
    for (const [label, url, local] of [
      ["after a first run (?first=1)", "https://speaksona.com/subscribe.html?first=1", RECAP],
      ["a grey game (?from=slice)", "https://speaksona.com/subscribe.html?from=slice", {}],
    ]) {
      const w = await world(browser, { phone: { app: "buy", stamp: "post", setUp: true, local } });
      await w.page.goto(url);
      await w.page.locator("body.offer").waitFor();
      await mark(w.page, 701);
      await w.settle();
      const rr = w.rr(), text = w.text();
      ok("plan screen, " + label + ": a recording was sent", rr.some((e) => e.type === FULL), rr.length);
      ok("plan screen, " + label + ": the pointer was recorded", marked(rr, 701));
      ok("plan screen, " + label + ": the child's name is in nothing sent", !/\bmia\b/i.test(text), (text.match(/.{60}\bmia\b.{60}/i) || [])[0]);
      ok("plan screen, " + label + ": the name was there to scrub", /\[child\]/.test(JSON.stringify(rr)));
      const recap = nodes(rr).filter((n) => n.attributes && /\bph-no-capture\b/.test(n.attributes.class || "") && n.attributes.class.indexOf("card") >= 0);
      ok("plan screen, " + label + ": the practice recap is an empty shape", recap.length > 0 && recap.every((n) => !(n.childNodes || []).length), recap.length);
      const door = url.split("?")[1];
      ok("plan screen, " + label + ": the address keeps only which door opened it", rr.filter((e) => e.type === META).every((e) => e.data.href === "https://speaksona.com/subscribe.html?" + door), rr.filter((e) => e.type === META).map((e) => e.data.href));
      ok("plan screen, " + label + ": no page error", w.errors.length === 0, w.errors);
      await w.context.close();
    }
  });

  // ── 4. speaksona.com and /try: recorded by themselves, nothing typed ──
  await scenario("the two pages the ads open", async () => {
    for (const [label, url, type] of [["speaksona.com", "https://speaksona.com/?utm_source=meta&fbclid=ABC987", true], ["/try", "https://speaksona.com/try", false]]) {
      const w = await world(browser);
      await w.page.goto(url);
      await w.page.waitForFunction(() => window.posthog && window.posthog.__loaded);
      if (type) await w.page.locator("#fEmail").fill("dad.parent@example.com");
      await mark(w.page, 801);
      await w.settle();
      const rr = w.rr(), text = w.text();
      ok(label + ": a recording was sent", rr.some((e) => e.type === FULL), rr.length);
      ok(label + ": the pointer was recorded", marked(rr, 801));
      if (type) ok(label + ": what was typed is in nothing sent", !/dad\.parent|example\.com/i.test(text));
      ok(label + ": the recorded address has no ad click id or campaign", rr.filter((e) => e.type === META).every((e) => !/[?&#]/.test(e.data.href)), rr.filter((e) => e.type === META).map((e) => e.data.href));
      await w.context.close();
    }
  });

  // ── 5. everywhere else: never ──
  await scenario("pages that are never recorded", async () => {
    const seeded = { phone: { setUp: true, stamp: "kept" } };
    for (const [label, url, cfg, ready] of [
      ["Settings", "https://speaksona.com/settings.html", seeded, null],
      ["Settings › Your plan (the plan screen without an offer)", "https://speaksona.com/subscribe.html", { phone: { app: "buy", stamp: "post", setUp: true } }, null],
      ["the speech check", "https://speaksona.com/check.html", {}, null],
      ["the clinician page", "https://speaksona.com/for-slps", {}, null],
      ["a clinician's own setup (?slp=1)", "https://speaksona.com/onboarding.html?slp=1", {}, "slp"],
      ["setup on a test server (not speaksona.com)", "http://127.0.0.1:1/onboarding.html", {}, "local"],
    ]) {
      const w = await world(browser, cfg);
      await w.page.goto(url.replace("127.0.0.1:1", "127.0.0.1"));
      await w.page.waitForFunction(() => window.posthog && window.posthog.__loaded).catch(() => {});
      if (ready === "slp" || ready === "local") {
        await w.page.waitForFunction(() => window.Sona && document.getElementById("nextBtn"));
        if (ready === "local") await next(w.page).catch(() => {});
        if (ready === "slp") await w.page.locator("#obName").fill("Zephyrine").catch(() => {});
      }
      await mark(w.page, 901);
      await w.settle(2000);
      ok(label + ": nothing recorded", w.snaps().length === 0, w.snaps().length);
      ok(label + ": the recorder was never even loaded", !w.assets.some((p) => /lazy-recorder/.test(p)), w.assets);
      await w.context.close();
    }
  });

  // ── 6. the pages wire it where they say ──
  await scenario("the pages", async () => {
    const ob = readFileSync(path.join(ROOT, "onboarding.html"), "utf8"), sub = readFileSync(path.join(ROOT, "subscribe.html"), "utf8");
    ok("onboarding.html: the therapy screen carries ph-no-capture", /<div class="step ph-no-capture" data-step="therapy">/.test(ob));
    ok("onboarding.html: the ready screen's lines carry ph-no-capture", /class="ready-lines ph-no-capture" id="readyLines"/.test(ob));
    ok("onboarding.html: never recorded on the therapy, ready or clinician screens", /NO_REPLAY=\{therapy:1,ready:1,slp:1,email:1\}/.test(ob));
    ok("onboarding.html: off before a screen is painted, on only after", /var key=ORDER\[idx\];\s*replayAt\(key,false\);/.test(ob) && /stepSeen\(key\);\s*replayAt\(key,true\);\s*\}/.test(ob));
    ok("onboarding.html: the hand-off ends it for good", /function showHandoff\(\)\{[\s\S]{0,140}replayDone=true;[^\n]*SonaAnalytics\.replay\(false\)/.test(ob));
    ok("subscribe.html: on only once the offer is painted", /fitOffer\(\);[\s\S]{0,400}SonaAnalytics\.replay\(true\)/.test(sub) && (sub.match(/SonaAnalytics\.replay\(/g) || []).length === 1);
    ok("subscribe.html: the recap card carries ph-no-capture", /class="card ph-no-capture" id="recapCard"/.test(sub));
  });
} finally {
  await browser.close();
}
console.log("\n" + passes + " passed, " + fails + " failed");
process.exit(fails ? 1 : 0);
