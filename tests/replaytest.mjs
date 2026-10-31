// REPLAY1: PostHog's session recording on four grown-up screens (Travis, 15
// Oct 2026: "how do i start recording", then yes to recording only the
// grown-up screens with names and typing blanked out). public/analytics.js
// holds the rules; setup (onboarding.html) and the plan screen
// (subscribe.html) say when.
//
// This suite runs the REAL recorder: the posthog-js build speaksona.com
// serves itself (public/vendor/posthog/static/<version>/, the one version
// this suite checks), on pages served at https://speaksona.com (analytics.js
// records nowhere else), against a fake PostHog that keeps every request.
// Its project settings are as loose as PostHog allows (no input masking,
// console logs, network bodies, canvas, heatmaps, dead clicks, exceptions,
// surveys), so every guarantee below is the page's own, none PostHog's
// default. What is checked is what would actually be sent:
//   - a recording happens where it should (never a vacuous pass), and
//     nowhere else: not Settings, not a child's tap on a locked game, not a
//     clinician's setup, not a test server;
//   - no child's name, no parent's address, nothing typed, ever, even for a
//     name that is also a word on the page ("Echo") or inside one ("Max");
//   - setup's speech therapy question and the ready screen that repeats its
//     answer are never recorded, not even a pointer moving over them;
//   - nothing after "Hand the phone to <Name>!";
//   - PostHog's ordinary events go out exactly as PostHog wrote them.
import { readFileSync, existsSync, statSync } from "node:fs";
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

const SRC = readFileSync(path.join(ROOT, "analytics.js"), "utf8");
const PH_VERSION = (SRC.match(/PH_VERSION = "([0-9.]+)"/) || [])[1];
const PH = path.join(ROOT, "vendor", "posthog", "static", String(PH_VERSION));
if (!PH_VERSION || !existsSync(path.join(PH, "array.js")) || !existsSync(path.join(PH, "lazy-recorder.js"))) {
  console.log("FAIL the posthog-js build analytics.js names is in public/vendor/posthog/static/" + PH_VERSION + "/");
  process.exit(1);
}
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
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

// ── the fake web: speaksona.com from public/ (PostHog's code included), PostHog's own hosts faked ──
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
  // PostHog drops every event from a browser it takes for a bot: one that
  // says navigator.webdriver, or whose navigator.userAgentData names
  // "HeadlessChrome" (CI's headless shell does; the cloud container's full
  // Chromium does not, so only CI ever saw it). An iPhone's Safari has no
  // userAgentData at all, so the page sees none, as on the phone.
  await context.addInitScript(() => {
    try { Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }); } catch (e) {}
    try { Object.defineProperty(Navigator.prototype, "userAgentData", { get: () => undefined }); } catch (e) {}
  });
  if (cfg.phone) await context.addInitScript(phone, cfg.phone);
  if (cfg.seed) await context.addInitScript((seed) => { try { if (localStorage.getItem("__seeded")) return; localStorage.setItem("__seeded", "1"); for (const k in seed) localStorage.setItem(k, typeof seed[k] === "string" ? seed[k] : JSON.stringify(seed[k])); } catch (e) {} }, cfg.seed);
  const w = { context, sent: [], assets: [], vendor: [], api: [], aborted: [] };
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (u.hostname === "speaksona.com" || u.hostname === "www.speaksona.com" || u.hostname === "127.0.0.1") {
      if (u.pathname.startsWith("/api/")) { w.api.push({ path: u.pathname, body: req.postData() }); return route.fulfill({ status: 503, contentType: "application/json", body: "{}" }); }
      if (cfg.stubs && cfg.stubs[u.pathname]) return route.fulfill({ status: 200, contentType: "text/html", body: cfg.stubs[u.pathname] });
      if (u.pathname.indexOf("/vendor/posthog/") === 0) w.vendor.push(u.pathname);
      const p = u.pathname === "/" ? "/parents.html" : (u.pathname === "/try" ? "/try.html" : (u.pathname === "/for-slps" ? "/for-slps.html" : u.pathname));
      const f = file(p);
      if (!f) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ status: 200, headers: { "content-type": MIME[f.split(".").pop().toLowerCase()] || "application/octet-stream" }, body: readFileSync(f) });
    }
    if (u.hostname === "us-assets.i.posthog.com") {
      w.assets.push(u.pathname);
      // off speaksona.com analytics.js loads PostHog's own copy: the same build stands in for it
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
// The recorder loads after the page: a pointer moved before it runs is not
// an interaction it saw, and a fresh recording waits for one before it sends.
const recording = (page) => page.waitForFunction(() => window.posthog && window.posthog.sessionRecordingStarted && window.posthog.sessionRecordingStarted(), null, { timeout: 15000 });
// A pointer path no other screen's taps would make: x stays under 12, where
// no button of these pages starts, and each y is unique within a scenario
// and inside the 844 px tall screen (a move below it never reaches the page).
async function mark(page, y) { for (let i = 0; i < 4; i++) { await page.mouse.move(3 + i * 2, y + i); await page.waitForTimeout(120); } }
const marked = (rr, y) => [0, 1, 2, 3].some((i) => hasPos(rr, 3 + i * 2, y + i));
async function next(page) { await page.evaluate(() => document.body.classList.remove("ob-settling", "price-settling")); await page.locator("#nextBtn").click(); }
const screen = (page) => page.evaluate(() => document.body.dataset.setupScreen);

const browser = await chromium.launch(launchOpts());
try {
  // ── 0. the rules as written ──
  await scenario("analytics.js, as written", async () => {
    ok("the vendored build is the version analytics.js names (" + PH_VERSION + ")", readFileSync(path.join(PH, "array.js"), "utf8").indexOf('LIB_VERSION="' + PH_VERSION + '"') >= 0);
    ok("on speaksona.com the loader and the recorder come from this site", /PH_SRC = ON_SITE \? PH_SELF \+ "\/static\/" \+ PH_VERSION \+ "\/array\.js"/.test(SRC) && /p\.src = PH_SRC/.test(SRC) && /asset_host: ON_SITE \?/.test(SRC));
    ok("only recordings are checked; ordinary events pass as PostHog wrote them", /if \(!ev \|\| ev\.event !== "\$snapshot"\) return ev;/.test(SRC));
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
      ["the name's own spots recorded as [child]", /maskTextSelector: "\.ph-name"/],
      ["every recording checked before it is sent", /before_send: beforeSend/],
      ["no canvas", /captureCanvas: \{ recordCanvas: false \}/],
      ["no request headers or bodies", /recordHeaders: false,[\s\S]{0,40}recordBody: false/],
    ]) ok("analytics.js: " + what, re.test(SRC));
  });

  // ── 1. the check before sending ──
  await scenario("the check before sending", async () => {
    const w = await world(browser, { seed: {
      "sona.profile.v1": { childName: "Max", email: "Zeph.Parent@Example.com", onboarded: true },
      "sona.profile.v1@k2": { childName: "Al", onboarded: true },
      "sona.kids.v1": { active: "", list: [{ slot: "", name: "Max" }, { slot: "k2", name: "Al" }] },
    } });
    await w.page.goto("https://speaksona.com/try");
    await w.page.waitForFunction(() => window.SonaAnalytics && window.SonaAnalytics.holdsName);
    const h = (t) => w.page.evaluate((t) => window.SonaAnalytics.holdsName(t), t);
    ok("a name as a word, any case, before an apostrophe", await h("is MAX ready?") && await h("max’s turn") && await h("Al’s turn"));
    ok("not inside a longer word, nor glued to a hyphen (max-width, minmax, Alba, also)", !(await h("max-width: 560px; minmax(0,1fr); Alba also")));
    ok("an address, any case", await h("write to zeph.parent@example.com"));
    ok("the placeholder is not a name", !(await h("Turn on the mic so Echo can hear [child].")));
    await w.page.evaluate(() => { const p = JSON.parse(localStorage.getItem("sona.profile.v1")); p.childName = "Quillon"; localStorage.setItem("sona.profile.v1", JSON.stringify(p)); });
    ok("a new name and the old one both count (nothing is forgotten while the page is open)", await h("Quillon") && await h("Max"));
    await w.context.close();
  });

  // ── 2. a parent's setup on speaksona.com, in a browser ──
  await scenario("a parent's setup on speaksona.com", async () => {
    const w = await world(browser, { stubs: { "/today.html": "<p>Home</p>", "/charge.html": "<p>Practice</p>", "/arcade-feed.html": "<p>Feed</p>" } });
    const { page } = w;
    const calmed = () => page.evaluate(() => document.body.classList.remove("ob-settling"));
    const rest = () => page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
    await page.goto("https://speaksona.com/onboarding.html?utm_source=ad&fbclid=XYZ123");
    await page.waitForFunction(() => window.Sona && document.getElementById("nextBtn"));
    await recording(page);
    await mark(page, 101);                          // the hello: recorded
    // THE SCREENS THAT SELL (22 Oct 2026) come first: the problem, the games
    // playing and Rachel, all recorded, none showing the name
    await next(page);
    await page.locator('[data-step="problem"].on').waitFor(); await rest();
    await mark(page, 111);                          // "Speech homework is hard at home.": recorded
    await next(page);
    await page.locator('[data-step="reel"].on').waitFor(); await rest();
    await mark(page, 121);                          // Fruit Slice's sound-power demo: recorded
    await next(page);
    await page.locator('[data-step="piano"].on').waitFor(); await rest();
    await mark(page, 126);                          // Piano Tiles' sound-power demo: recorded
    await next(page);
    await page.locator('[data-step="rachel"].on').waitFor(); await rest();
    await mark(page, 131);                          // Rachel, on her own: recorded
    await next(page);
    await page.locator('[data-step="name"].on').waitFor();
    await page.locator("#obName").fill("Zephyrine");
    await page.locator('#obAge [data-age="6"]').click();
    await next(page);
    // "What does <Name> love?" and "Games for <Name>." show the name, as ph-name; both are recorded
    await page.locator('[data-step="interests"].on').waitFor(); await rest();
    await mark(page, 141);                          // what the child loves: recorded, the name as [child]
    await calmed(); await page.locator('#obInterests [data-val="sports"]').click();
    await next(page);
    await page.locator('[data-step="games"].on').waitFor();
    await page.evaluate(() => Promise.all([...document.querySelectorAll(".step.on img")].map((i) => i.decode().catch(() => {}))));
    await rest();
    await mark(page, 151);                          // "Games for <Name>.": recorded, the name as [child]
    await next(page);
    await page.locator('[data-step="therapy"].on').waitFor();
    await mark(page, 201);                          // the therapy question: never recorded
    await calmed();
    await page.locator('[data-step="therapy"] .ask-pick[data-val="t_yes"]').click();
    await page.locator('[data-step="sounds"].on').waitFor();   // the screen the answer lands on (since 22 Oct 2026)
    // Back to the name, and a new one: both names stay out
    await page.waitForTimeout(500);
    await calmed(); await page.locator("#backBtn").click();
    await page.locator('[data-step="therapy"].on').waitFor();
    await mark(page, 211);                          // the therapy question again, an answer held: never recorded
    for (const k of ["games", "interests", "name"]) { await calmed(); await page.locator("#backBtn").click(); await page.locator('[data-step="' + k + '"].on').waitFor(); }
    await page.locator("#obName").fill("Quillon");
    await next(page); await page.locator('[data-step="interests"].on').waitFor();
    await next(page); await page.locator('[data-step="games"].on').waitFor();
    await next(page); await page.locator('[data-step="therapy"].on').waitFor();
    await calmed();
    // This time a double tap, the way a hurried thumb answers: the second tap
    // lands on the next screen, and then the pointer moves on from the answer
    const yes = await page.locator('[data-step="therapy"] .ask-pick[data-val="t_yes"]').boundingBox();
    const t1 = await page.evaluate(() => Date.now());
    await page.locator('[data-step="therapy"] .ask-pick[data-val="t_yes"]').dblclick();
    await page.locator('[data-step="sounds"].on').waitFor();
    for (let i = 0; i <= 10; i++) { await page.mouse.move(yes.x + yes.width / 2 + i * 5, yes.y + yes.height / 2 + i * 30); await page.waitForTimeout(60); }
    await mark(page, 301);                          // the screen after the answer (the sounds): not recorded either
    const t2 = await page.evaluate(() => Date.now());
    await calmed();
    const chip = page.locator('#obSounds [data-sound="R"]');
    if (await chip.getAttribute("aria-pressed") !== "true") await chip.click();
    await next(page);
    await page.locator('[data-step="minutes"].on').waitFor(); await rest();
    await mark(page, 351);                          // how long each day, two screens past the answer: recorded (the control)
    await calmed();
    await page.locator("#minutesSkip").click();
    await page.locator('[data-step="updates"].on').waitFor();
    await page.locator("#updEmail").fill("zeph.parent@example.com");
    await next(page);
    // THE PLAN MOMENT (31 Oct 2026): a first setup reaches the ready screen
    // through a short build beat over the page, never recorded either
    await page.locator("#obBuild").waitFor();
    await mark(page, 391);                          // the build beat: never recorded
    await page.locator('[data-step="ready"].on').waitFor();
    await mark(page, 401);                          // the ready screen: never recorded
    await next(page);
    await page.locator('[data-step="mic"].on').waitFor();
    await mark(page, 501);                          // the microphone: recorded
    await calmed();
    await page.locator("#micNotNow").click();
    await page.locator('[data-step="achieve"].on').waitFor();
    await mark(page, 601);                          // the hand-off: never recorded
    await w.settle();
    const rr = w.rr(), text = w.text();
    ok("setup: a recording was sent (full snapshots of the page)", rr.filter((e) => e.type === FULL).length >= 2, rr.length);
    ok("setup: the hello's pointer was recorded (the control)", marked(rr, 101));
    ok("setup: the problem, both game demos and Rachel's screen were recorded (the controls)", marked(rr, 111) && marked(rr, 121) && marked(rr, 126) && marked(rr, 131), [marked(rr, 111), marked(rr, 121), marked(rr, 126), marked(rr, 131)]);
    ok("setup: the minutes screen's pointer was recorded (the control)", marked(rr, 351));
    ok("setup: nothing on the screen a therapy answer lands on (the sounds)", !marked(rr, 301));
    ok("setup: \"What does <Name> love?\" and \"Games for <Name>.\" were recorded (the controls)", marked(rr, 141) && marked(rr, 151), [marked(rr, 141), marked(rr, 151)]);
    // every spot those two screens show the name is recorded as [child], and
    // the screens' own words are there, so the check below is not vacuous
    const allNodes = nodes(rr), byId = (id) => allNodes.filter((n) => n.attributes && n.attributes.id === id);
    const said = (n) => (n.childNodes || []).map((c) => c.textContent || "").join("");
    ok("setup: the name on the screens that sell is recorded as [child], every time (intName, gamesName)", ["intName", "gamesName"].every((id) => byId(id).length > 0 && byId(id).every((n) => said(n) === "[child]")), ["intName", "gamesName"].map((id) => byId(id).map(said)));
    ok("setup: the screens that sell were recorded with their words (speech through play, both demos, Rachel, what they love, the games)", /Speech practice/.test(text) && /Through play/.test(text) && /Slow the fruit/.test(text) && /Slow the keys/.test(text) && /pediatric speech-language pathologist in her clinical fellowship/.test(text) && /What does/.test(text) && /Games for/.test(text) && /Fruit Slice/.test(text));
    // every incremental event, each pointer position at its own time
    const when = (e) => (e.type === INCR && Array.isArray(e.data.positions)) ? e.data.positions.map((q) => e.timestamp + (q.timeOffset || 0)) : [e.timestamp];
    const between = rr.filter((e) => e.type === INCR && when(e).some((t) => t >= t1 && t <= t2));
    ok("setup: nothing at all from the double-tapped answer to the next footer tap (no tap, no pointer at the answer's place)", between.length === 0, between.slice(0, 3));
    ok("setup: the microphone's pointer was recorded (the control)", marked(rr, 501));
    ok("setup: nothing on the therapy question, first visit", !marked(rr, 201));
    ok("setup: nothing on the therapy question after Back", !marked(rr, 211));
    ok("setup: nothing during the build beat before the ready screen", !marked(rr, 391));
    ok("setup: nothing on the ready screen", !marked(rr, 401));
    ok("setup: the build beat's words (\"Building <Name>'s practice…\") are in nothing sent, nor its overlay in any picture", !/practice\u2026/.test(text) && !nodes(rr).some((n) => n.attributes && n.attributes.id === "obBuild"));
    ok("setup: nothing on the hand-off", !marked(rr, 601));
    ok("setup: neither name, nor any part of either, is in anything sent", !/zephyr|quillon/i.test(text), (text.match(/.{60}(zephyr|quillon).{60}/i) || [])[0]);
    ok("setup: the address is in nothing sent", !/zeph\.parent|example\.com/i.test(text));
    ok("setup: the names were there to scrub ([child] in the recorded words)", /\[child\]/.test(JSON.stringify(rr)));
    ok("setup: neither ready-screen sentence (the therapy answer) is in anything sent", !/between speech visits|practice you can do at home/i.test(text));
    const all = nodes(rr);
    const therapy = all.filter((n) => n.attributes && /\bph-no-capture\b/.test(n.attributes.class || "") && /\bstep\b/.test(n.attributes.class || ""));
    ok("setup: the therapy screen is an empty shape in every picture of the page", therapy.length > 0 && therapy.every((n) => !(n.childNodes || []).length && !("data-step" in n.attributes) && !("aria-pressed" in n.attributes)), therapy.slice(0, 2));
    const blocked = (re) => all.filter((n) => n.attributes && /\bph-no-capture\b/.test(n.attributes.class || "") && re.test(n.attributes.class || ""));
    const empty = (list) => list.length > 0 && list.every((n) => !(n.childNodes || []).length && Object.keys(n.attributes).every((k) => k === "class" || /^rr_/.test(k)));
    ok("setup: the therapy screen is an empty shape, nothing but its class and size", empty(therapy));
    ok("setup: the ready screen is an empty shape in every picture", !all.some((n) => n.attributes && n.attributes.id === "readyLines") && !/practice is ready/i.test(text));
    ok("setup: no ready-screen line made it in some other way", !all.some((n) => n.attributes && /\bready-lines\b/.test(n.attributes.class || "")));
    ok("setup: the clinician screens are empty shapes too", blocked(/\bstep\b/).length >= 2);
    ok("setup: every PostHog request was read (none the test could not decode)", w.sent.every((x) => !x.raw), w.sent.filter((x) => x.raw).map((x) => x.path));
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
    ok("setup: PostHog's code came from speaksona.com, the tested build, and nothing else of it loaded (no surveys, toolbar, logs, dead clicks, exceptions, web vitals)", JSON.stringify(w.vendor.slice().sort()) === JSON.stringify(["/vendor/posthog/static/" + PH_VERSION + "/array.js", "/vendor/posthog/static/" + PH_VERSION + "/lazy-recorder.js"]) && w.assets.every((p) => p.indexOf("/array/" + TOKEN + "/config") === 0), { vendor: w.vendor, cdn: w.assets });
    ok("setup: no event but setup's own and the recording", w.events().every((e) => ["$snapshot", "setup step", "$pageview", "$identify", "$set", "onboarding completed", "Lead", "CompleteRegistration", "weekly summary opted in", "$opt_in"].includes(e.event)), [...new Set(w.events().map((e) => e.event))]);
    ok("setup: what the child loves rides in no event (a recording may show the picks: Rachel's to know)", !w.events().some((e) => e.event !== "$snapshot" && /sports/i.test(JSON.stringify(e.properties || {}))));
    ok("setup: no page error", w.errors.length === 0, w.errors);
    // The child now holds the phone. "Let's play!", then Back (no page
    // cache: setup loads afresh, set up): never recorded again in this tab
    const before = w.snaps().length;
    await calmed();
    await page.locator("#nextBtn").click();
    await page.waitForURL(/charge\.html|arcade-feed|today\.html/);
    await page.goBack();
    await page.waitForFunction(() => window.Sona && document.getElementById("nextBtn") && window.posthog && window.posthog.__loaded);
    await mark(page, 171);
    await w.settle(2000);
    ok("after the hand-off, Back into setup: never recorded again", w.snaps().length === before && !(await page.evaluate(() => window.posthog.sessionRecordingStarted())), { before, after: w.snaps().length });
    await w.context.close();
  });

  // ── 3. the plan screen, in the app, as the offer a grown-up opened ──
  await scenario("the plan screen as the offer, in the app", async () => {
    const PRACTICED = { "sona.outcomes.v1": { R: { days: { [TODAY]: { a: 12, p: 9, tries: 12 } } } }, "sona.reps.v1": { d: TODAY, n: 12 } };
    for (const [label, url, cfg] of [
      ["from setup (?setup=1)", "https://speaksona.com/subscribe.html?setup=1", { app: "buy", stamp: "post", setUp: true, marker: true }],
      ["after a first practice run (?first=1)", "https://speaksona.com/subscribe.html?first=1", { app: "buy", stamp: "kept", setUp: true, local: PRACTICED }],
    ]) {
      const w = await world(browser, { phone: cfg });
      await w.page.goto(url);
      await w.page.locator("body.offer").waitFor();
      await recording(w.page);
      const pill = await w.page.evaluate(() => (document.getElementById("offerPill") || {}).textContent || "");
      await mark(w.page, 701);
      await w.settle();
      const rr = w.rr(), text = w.text();
      ok("plan screen, " + label + ": a recording was sent", rr.some((e) => e.type === FULL), rr.length);
      ok("plan screen, " + label + ": the pointer was recorded", marked(rr, 701));
      ok("plan screen, " + label + ": the child's name is in nothing sent", !/\bmia\b/i.test(text), (text.match(/.{60}\bmia\b.{60}/i) || [])[0]);
      ok("plan screen, " + label + ": the headline's name is recorded as [child]", /\[child\]/.test(JSON.stringify(rr)));
      if (/first/.test(url)) {
        ok("plan screen, " + label + ": the line on screen names what was practiced (the case this checks)", /practiced the R sound/.test(pill), pill);
        ok("plan screen, " + label + ": …and that line is in nothing sent", !/practiced the|out loud/i.test(text));
      }
      const recap = nodes(rr).filter((n) => n.attributes && /\bph-no-capture\b/.test(n.attributes.class || "") && /\bcard\b/.test(n.attributes.class));
      ok("plan screen, " + label + ": the practice recap is an empty shape", recap.length > 0 && recap.every((n) => !(n.childNodes || []).length), recap.length);
      const door = url.split("?")[1];
      ok("plan screen, " + label + ": the address keeps only which door opened it", rr.filter((e) => e.type === META).every((e) => e.data.href === "https://speaksona.com/subscribe.html?" + door), rr.filter((e) => e.type === META).map((e) => e.data.href));
      ok("plan screen, " + label + ": every PostHog request was read", w.sent.every((x) => !x.raw));
      ok("plan screen, " + label + ": no page error", w.errors.length === 0, w.errors);
      await w.context.close();
    }
  });

  // ── 3b. a name that is also a word on the page, or inside one ──
  await scenario("names that are words", async () => {
    // "Echo" is all over setup: no piece of recording holding it may go,
    // and nothing may be swapped out of the page's own words either
    const w = await world(browser, { seed: { "sona.obdraft.v1": { childName: "Echo", email: "" } } });
    await w.page.goto("https://speaksona.com/onboarding.html");
    await w.page.waitForFunction(() => window.Sona && document.getElementById("nextBtn"));
    await recording(w.page);
    await mark(w.page, 111);
    await w.settle();
    const sentText = JSON.stringify(w.rr().filter((e) => e.type === FULL || (e.type === INCR && e.data.source === 0)));
    ok("Echo: no picture of the page holding the word was sent", !/\becho\b/i.test(sentText.replace(/"(_cssText|tagName|class|src|href)":"[^"]*"/g, "")), (sentText.match(/.{50}\becho\b.{50}/i) || [])[0]);
    ok("Echo: no page word was swapped for [child]", !/\[child\]/.test(sentText) || !/I'm \[child\]/.test(sentText));
    await w.context.close();
    // "Max" sits inside max-width and minmax: those are the page's own code and stay as they are
    const m = await world(browser, { seed: { "sona.profile.v1": { childName: "Max", onboarded: true } } });
    await m.page.goto("https://speaksona.com/");
    await recording(m.page);
    await mark(m.page, 121);
    await m.settle();
    const rrm = m.rr();
    ok("Max: the page was recorded (max-width is not a name)", rrm.some((e) => e.type === FULL) && marked(rrm, 121));
    ok("Max: the page's styles went as written, not rewritten", /max-width/.test(JSON.stringify(rrm)) && !/\[child\]-width|min\[child\]/.test(JSON.stringify(rrm)));
    await m.context.close();
  });

  // ── 3c. PostHog's ordinary events are not touched ──
  await scenario("ordinary events", async () => {
    const w = await world(browser, { seed: { "sona.profile.v1": { childName: "Eric", onboarded: true } } });
    await w.page.goto("https://speaksona.com/check.html");
    await w.page.waitForFunction(() => window.posthog && window.posthog.__loaded);
    await w.settle(2000);
    const pv = w.events().filter((e) => e.event === "$pageview");
    ok("a pageview went, with its time zone and browser as PostHog wrote them (Eric is in America)", pv.length > 0 && pv.every((e) => e.properties.$timezone === ZONE && !/\[child\]/.test(JSON.stringify(e))), pv.map((e) => e.properties.$timezone));
    await w.context.close();
  });

  // ── 3d. a set-up child walking setup again, with an old answer painted
  // into its hidden clinician screen ──
  await scenario("an old clinician-screen answer", async () => {
    const w = await world(browser, { seed: { "sona.profile.v1": { childName: "Zephyrine", onboarded: true, slpEvaluated: "yes", focusSounds: ["R"] } } });
    await w.page.goto("https://speaksona.com/onboarding.html");
    await w.page.waitForFunction(() => window.Sona && document.getElementById("nextBtn"));
    const painted = await w.page.evaluate(() => !!document.querySelector('#obSlp .choice.on'));
    await w.page.waitForFunction(() => window.posthog && window.posthog.__loaded);
    await mark(w.page, 131);
    await w.settle();
    const text = w.text();
    ok("the old answer is painted in the page (the case this checks)", painted);
    ok("a child already set up, walking setup again: PostHog was taking events, so not recording means something", w.events().length > 0, w.sent.length);
    ok("a child already set up, walking setup again, is not recorded at all", !w.rr().length && !w.vendor.some((x) => /lazy-recorder/.test(x)), w.vendor);
    ok("no recording holds the question or the answer", !/seen a speech therapist/i.test(text) && !/"choice on"/.test(text));
    await w.context.close();
  });

  // ── 4. speaksona.com and /try: recorded by themselves, nothing typed ──
  await scenario("the two pages the ads open", async () => {
    for (const [label, url, type] of [["speaksona.com", "https://speaksona.com/?utm_source=meta&fbclid=ABC987", true], ["/try", "https://speaksona.com/try", false]]) {
      const w = await world(browser);
      await w.page.goto(url);
      await w.page.waitForFunction(() => window.posthog && window.posthog.__loaded);
      await recording(w.page);
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
      ["the offer a child opens by tapping a locked game (?from=slice)", "https://speaksona.com/subscribe.html?from=slice", { phone: { app: "buy", stamp: "post", setUp: true } }, "offer"],
      ["the offer Home opens by itself (?from=home)", "https://speaksona.com/subscribe.html?from=home", { phone: { app: "buy", stamp: "post", setUp: true } }, "offer"],
      ["the speech check", "https://speaksona.com/check.html", {}, null],
      ["the clinician page", "https://speaksona.com/for-slps", {}, null],
      ["a clinician's own setup (?slp=1)", "https://speaksona.com/onboarding.html?slp=1", {}, "slp"],
      ["setup on a test server (not speaksona.com)", "http://127.0.0.1:1/onboarding.html", {}, "local"],
    ]) {
      const w = await world(browser, cfg);
      await w.page.goto(url.replace("127.0.0.1:1", "127.0.0.1"));
      await w.page.waitForFunction(() => window.posthog && window.posthog.__loaded).catch(() => {});
      if (ready === "offer") await w.page.locator("body.offer").waitFor();
      if (ready === "slp" || ready === "local") {
        await w.page.waitForFunction(() => window.Sona && document.getElementById("nextBtn"));
        if (ready === "local") await next(w.page).catch(() => {});
        if (ready === "slp") await w.page.locator("#obName").fill("Zephyrine").catch(() => {});
      }
      await mark(w.page, 151);
      await w.settle(2000);
      ok(label + ": PostHog was taking this page's events, so nothing recorded means something", w.events().length > 0, w.sent.length);
      ok(label + ": nothing recorded", w.snaps().length === 0, w.snaps().length);
      ok(label + ": the recorder was never even loaded", !w.assets.some((p) => /lazy-recorder/.test(p)), w.assets);
      await w.context.close();
    }
  });

  // ── 6. the pages wire it where they say ──
  await scenario("the pages", async () => {
    const ob = readFileSync(path.join(ROOT, "onboarding.html"), "utf8"), sub = readFileSync(path.join(ROOT, "subscribe.html"), "utf8");
    ok("onboarding.html: the therapy screen carries ph-no-capture", /<div class="step ph-no-capture" data-step="therapy">/.test(ob));
    ok("onboarding.html: the ready screen, the clinician screens and the build overlay carry ph-no-capture", /<div class="step ph-no-capture" data-step="ready">/.test(ob) && /<div class="step ph-no-capture" data-step="slp">/.test(ob) && /<div class="step ph-no-capture" data-step="email">/.test(ob) && /d\.className="show ph-no-capture"/.test(ob));
    ok("onboarding.html: every spot that shows the name is a ph-name", ["intName", "micName", "achName", "emName"].every((id) => new RegExp('class="ph-name" id="' + id + '"').test(ob)));
    ok("onboarding.html: never recorded on the therapy, ready or clinician screens", /NO_REPLAY=\{therapy:1,ready:1,slp:1,email:1\}/.test(ob));
    ok("onboarding.html: nor the screen a therapy answer lands on, nor a set-up child walking setup again", /replayHold=replayFrom==="therapy"/.test(ob) && /var REWALK=!!\(p\.onboarded&&!AFTER\);/.test(ob) && /var ok=!replayDone&&!REWALK&&!replayHold&&/.test(ob));
    ok("onboarding.html + analytics.js: the hand-off ends recording for the tab", /sessionStorage\.setItem\("sona\.replayoff\.v1","1"\)/.test(ob) && /sessionStorage\.getItem\("sona\.replayoff\.v1"\)\) return; \} catch \(e\) \{ return; \}/.test(SRC));
    ok("onboarding.html: off before a screen is painted, on only after", /var key=ORDER\[idx\];\s*replayAt\(key,false\);/.test(ob) && /stepSeen\(key\);\s*replayAt\(key,true\);\s*\}/.test(ob));
    {const render = ob.slice(ob.indexOf("function render(){"), ob.indexOf("function next(){"));
     ok("onboarding.html: the plan moment's build beat starts only after recording is off for the ready screen (31 Oct 2026)", render.indexOf("replayAt(key,false);") > 0 && render.indexOf("planBeat();return;") > render.indexOf("replayAt(key,false);") && /if\(key==="ready"&&PLAN_MOMENT&&ORDER===ORDER_PARENT&&!beatDone/.test(render));}
    ok("onboarding.html: the hand-off ends it for good", /function showHandoff\(\)\{[\s\S]{0,140}replayDone=true;[^\n]*SonaAnalytics\.replay\(false\)/.test(ob));
    ok("subscribe.html: on only once the offer is painted, and only for a grown-up's door", /fitOffer\(\);[\s\S]{0,700}if \(OFFER_SETUP \|\| OFFER_FIRST\) \{ try \{ if \(window\.SonaAnalytics && SonaAnalytics\.replay\) SonaAnalytics\.replay\(true\)/.test(sub) && (sub.match(/SonaAnalytics\.replay\(/g) || []).length === 1);
    ok("subscribe.html: the headline's name is a ph-name, and the practice line is blocked", /nm\.className = "ph-name"/.test(sub) && /class="offer-pill ph-no-capture" id="offerPill"/.test(sub));
    ok("subscribe.html: the recap card carries ph-no-capture", /class="card ph-no-capture" id="recapCard"/.test(sub));
  });
} finally {
  await browser.close();
}
console.log("\n" + passes + " passed, " + fails + " failed");
process.exit(fails ? 1 : 0);
