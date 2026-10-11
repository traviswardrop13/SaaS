// BUDDY2: play as your buddy (Travis, 9 Oct 2026: "a currency so they can buy
// stuff like characters, and they actually BE the character in the game").
// The child's own buddy, in its painted poses (Sona.buddySprite), in eight of
// the ten games, each placement keeping that game's rules:
//   - Sound Sprint: the runner seen from behind (the fox's crop of
//     fox-runner.webp, every other buddy its own runner); without one, the
//     round badge clipped to a circle; an old helper with no drawCircle still
//     draws; "leo" (an old pick) is the fox;
//   - Flappy Glide: the badge in the basket, clipped to a circle;
//   - Fruit Slice and Block Stacker: a FOX child keeps today's painted scenes
//     exactly; any other buddy gets the scene without the fox, peeks over the
//     counter or sits on the bench, and rides in the rocket's porthole;
//   - Hoops, Soccer Goal, Dino Dig: the buddy stands opposite Echo and cheers
//     with him; the engine swaps the buddy's OWN pictures, never Echo's;
//   - Feed Echo: the buddy watches beside Echo, who is still the one fed;
//   - Bubble Pop and Piano Tiles: no buddy (nothing may sit on the lanes).
// Every buddy element stays on screen at 320 and 390 px, takes no finger, and
// covers neither Feed Echo's pictures nor Dino Dig's pit.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, ROOT, launchOpts } from "./_env.mjs";

let fails = 0;
function ok(label, pass, detail = "") { if (!pass) fails++; console.log((pass ? "PASS " : "FAIL ") + label + (pass ? "" : "  → " + (typeof detail === "string" ? detail : JSON.stringify(detail)))); }
async function section(label, run) { try { await run(); } catch (e) { ok(label + " completes", false, e.stack); } }

const MIME = { html: "text/html", js: "text/javascript", svg: "image/svg+xml", css: "text/css", png: "image/png", webp: "image/webp", woff2: "font/woff2", json: "application/json", mp3: "audio/mpeg", wav: "audio/wav" };
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) { res.writeHead(503, { "content-type": "application/json" }); res.end("{}"); return; }
  const file = path.join(ROOT, url.pathname);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[file.split(".").pop()] || "application/octet-stream" }); res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch(launchOpts());
// the word turn's stand-in (as levelsplaytest): the page hands its game to
// SayPlay.start, and the test drives the engine the way sayplay.js does once
// a word is heard
const STANDIN = "window.SayPlay={start:function(g){window.__G=g;}};";

// What every canvas draws, cut down to what this suite asks about: each
// buddy, runner, rocket or sticker picture drawn (with its numbers), and each
// clip, saying whether its path was a circle.
function spy() {
  const ev = window.__ev = []; let n = 0, arcd = false;
  const P = CanvasRenderingContext2D.prototype, di = P.drawImage, cl = P.clip, ar = P.arc, bp = P.beginPath;
  const name = (img) => { try { const s = String((img && (img.currentSrc || img.src)) || ""); return s.startsWith("data:") ? "data:svg" : s.split("?")[0].split("/").pop(); } catch (e) { return ""; } };
  const keep = (e) => { e.i = n++; ev.push(e); if (ev.length > 900) ev.splice(0, 300); };
  P.beginPath = function () { arcd = false; return bp.apply(this, arguments); };
  P.arc = function () { arcd = true; return ar.apply(this, arguments); };
  P.clip = function () { keep({ k: "clip", arc: arcd }); return cl.apply(this, arguments); };
  P.drawImage = function (img) { const s = name(img); if (/buddy-|fox-runner|stack-rocket|data:svg/.test(s)) keep({ k: "img", src: s, a: [].slice.call(arguments, 1).map((v) => Math.round(v * 100) / 100) }); return di.apply(this, arguments); };
}
function seed(cfg) {
  // Echo's mid-round ask for a sound power is arcadespeechhelptest's: held here
  document.addEventListener("DOMContentLoaded", () => { if (window.SLOW_ASK) { SLOW_ASK.first = SLOW_ASK.every = SLOW_ASK.quiet = SLOW_ASK.soon = 1e12; window.slowAskAt = 1e12; } });
  // a mic that hears the child only while __mic.voice is on (Feed Echo)
  const h = window.__mic = { voice: false, live: 0 };
  navigator.mediaDevices.getUserMedia = () => { h.live++; const t = { kind: "audio", readyState: "live", stop() { if (this.readyState !== "ended") { this.readyState = "ended"; h.live--; } } }; return Promise.resolve({ getTracks: () => [t], getAudioTracks: () => [t] }); };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    AC.prototype.createMediaStreamSource = function () { return { connect() {}, disconnect() {} }; };
    const real = AC.prototype.createAnalyser;
    AC.prototype.createAnalyser = function () { const an = real.call(this); an.getByteTimeDomainData = (d) => { for (let i = 0; i < d.length; i++) d[i] = h.voice ? (i % 2 ? 200 : 56) : 128; }; an.getByteFrequencyData = (d) => { d.fill(0); if (h.voice) for (let i = 1; i <= 10 && i < d.length; i++) d[i] = 220; }; return an; };
  }
  // a stand-in sona.js or helper, as an older or broken phone might have
  let sona, cb;
  Object.defineProperty(window, "Sona", { configurable: true, get: () => sona, set: (v) => { sona = v;
    if (cfg.noRun && v.buddySprite) { const real = v.buddySprite; v.buddySprite = function (id, pose) { return pose === "run" ? null : real.apply(this, arguments); }; } } });
  Object.defineProperty(window, "SonaCraftedBuddies", { configurable: true, get: () => cb, set: (v) => { cb = v; if (cfg.noCircle) delete v.drawCircle; } });
  if (sessionStorage.getItem("test.seeded")) return;
  sessionStorage.setItem("test.seeded", "1");
  ["", "2", "3", "4", "5"].forEach((k) => localStorage.setItem("sona.freeera" + k + ".v1", k ? "done" : "post"));
  localStorage.setItem("sona.freever.v1", "kept");
  const p = { childName: "Mia", childAge: cfg.age || "7", focusSounds: ["R"], onboarded: true, earlyAdopter: true, voiceOn: false, soundOn: false, volume: 0 };
  if (cfg.buddy) p.character = cfg.buddy;
  localStorage.setItem("sona.profile.v1", JSON.stringify(p));
  localStorage.setItem("sona.micok", "1");
  if (cfg.token) sessionStorage.setItem("sona.play.token", cfg.token);
}
async function open(file, cfg = {}) {
  const size = cfg.size || { width: 390, height: 844 };
  const context = await browser.newContext({ viewport: size, reducedMotion: "reduce" });
  await context.route("**/*", (r) => {
    const u = r.request().url(), p = u.startsWith(origin + "/") ? new URL(u).pathname : null;
    if (!p) return r.abort();
    if (cfg.standin && p === "/sayplay.js") return r.fulfill({ contentType: "text/javascript", body: STANDIN });
    if (cfg.missing && cfg.missing.includes(p)) return r.fulfill({ status: 404, body: "" });
    return r.continue();
  });
  await context.addInitScript(spy);
  const round = /^arcade-(slice|tiles|stack|run|glide)\.html/.test(file);
  await context.addInitScript(seed, Object.assign({ token: round ? file.split("?")[0] : "" }, cfg));
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/" + file);
  if (cfg.standin) {
    await page.waitForFunction(() => window.__G && window.__G.play);
    await page.evaluate(() => { window.__done = 0; __G.play.init({ sfx() {}, done() { window.__done++; }, hint() {}, cheer() {}, face() {} }, __G.steps.length); });
  }
  return { context, page, errors };
}
const until = (page, fn, ms, arg) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const events = (page) => page.evaluate(() => window.__ev.slice());
const drew = (ev, src) => ev.filter((e) => e.k === "img" && e.src === src);
// a circle clip, then (with nothing of interest between) that picture
const clipThen = (ev, src) => ev.some((e, i) => e.k === "clip" && e.arc && ev[i + 1] && ev[i + 1].k === "img" && ev[i + 1].src === src);
const file = (p) => String(p || "").split("?")[0].split("/").pop();
// an element's box, whether it is shown, and whether a finger passes through it
const box = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, shown: cs.display !== "none" && r.width > 0 && r.height > 0, pe: cs.pointerEvents, vw: innerWidth, vh: innerHeight, src: el.getAttribute("src") }; }, sel);
const inside = (b) => b && b.shown && b.l >= -0.5 && b.t >= -0.5 && b.r <= b.vw + 0.5 && b.b <= b.vh + 0.5;
const apart = (a, b) => a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t;

// ── 1. the pictures: every BUDDY_ART file and every portrait is on disk ──
await section("files", async () => {
  const src = readFileSync(path.join(ROOT, "sona.js"), "utf8");
  const block = (src.match(/const BUDDY_ART = \{([\s\S]*?)\n  \};/) || ["", ""])[1];
  const paths = [...block.matchAll(/"(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  ok("every BUDDY_ART picture exists", paths.length >= 38 && paths.every((p) => existsSync(path.join(ROOT, p))), paths.filter((p) => !existsSync(path.join(ROOT, p))));
  const ids = [...(src.match(/const CHARACTERS = \[([\s\S]*?)\n  \];/) || ["", ""])[1].matchAll(/\{ id: '(\w+)'/g)].map((m) => m[1]);
  ok("every buddy in the catalog has its painted portrait", ids.length >= 8 && ids.every((id) => existsSync(path.join(ROOT, "assets/crafted/buddy-" + id + "-v2.webp"))), ids);
  // the helper lists every catalog buddy and keeps the old eight as its fallback
  const helper = readFileSync(path.join(ROOT, "crafted-buddies.js"), "utf8");
  ok("crafted-buddies.js takes its buddies from Sona.CHARACTERS, keeps the eight as the fallback, and gives image, drawCircle and svgSrc",
    /Sona\.CHARACTERS/.test(helper) && /\["fox","bunny","dragon","cat","bee","octopus","dino","panda"\]/.test(helper) && /Sona\.buddySprite\(id,"portrait"\)/.test(helper) && /image:image,drawCircle:drawCircle,svgSrc:svgSrc/.test(helper) && /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(helper));
  // Echo's own cheer block is untouched in each engine; the buddy's swap only names the buddy's pictures
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  for (const [f, echo, bud] of [["hoops.js", "courtEcho", "courtBuddy"], ["soccer.js", "pitchEcho", "pitchBuddy"], ["dino.js", "digEcho", "digBuddy"]]) {
    const s = strip(readFileSync(path.join(ROOT, f), "utf8")), fn = (s.match(/function cheerBuddy\(id\) \{[\s\S]*?\n  \}/) || [""])[0];
    ok(f + ": Echo's cheer swaps only Echo, the buddy's cheer follows it, and the buddy's swap names no picture of its own",
      new RegExp('document\\.getElementById\\("' + echo + '"\\)[^\\n]*\\n[^\\n]*e\\.src = "/assets/crafted/echo-cheer\\.webp"[^\\n]*\\n\\s*cheerBuddy\\("' + bud + '"\\);').test(s)
      && fn && !/echo-|\.webp/.test(fn) && /b\.src = buddy\.cheer/.test(fn) && /if \(buddy\) b\.src = buddy\.rest/.test(fn)
      && /setBuddy: function \(p\) \{ buddy = \(p && typeof p\.rest === "string" && typeof p\.cheer === "string"\) \? \{ rest: p\.rest, cheer: p\.cheer \} : null; \}/.test(s));
  }
});

// ── 2. Sound Sprint: the child's own runner ──
await section("Sound Sprint", async () => {
  const run = async (cfg, label, check) => {
    const { context, page, errors } = await open("arcade-run.html?from=charge", cfg);
    try {
      await until(page, () => window.__ev.some((e) => e.k === "img"), 6000);
      await page.waitForTimeout(400);
      const ev = await events(page), tip = await page.evaluate(() => { const t = document.getElementById("tipBuddy"); return { cls: t.className, bg: getComputedStyle(t).backgroundImage, html: t.innerHTML }; });
      await check(ev, tip, page);
      ok("Sprint (" + label + "): no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  };
  await run({ buddy: "dragon" }, "dragon", async (ev, tip) => {
    ok("Sprint: a dragon child runs as the dragon's own runner, in the fox's box", drew(ev, "buddy-dragon-run.webp").length > 0 && !drew(ev, "fox-runner.webp").length && drew(ev, "buddy-dragon-run.webp")[0].a.length === 8, ev.slice(-4));
    ok("Sprint: …and the start card's lane shows that runner", tip.cls === "runner" && /buddy-dragon-run\.webp/.test(tip.bg), tip);
  });
  await run({}, "default child", async (ev, tip) => {
    const f = drew(ev, "fox-runner.webp");
    ok("Sprint: a child who never picked runs as the fox, cut from fox-runner.webp at (390, 205, 480, 840)", f.length > 0 && JSON.stringify(f[0].a.slice(0, 4)) === "[390,205,480,840]", f[0]);
    ok("Sprint: …and the start card keeps the fox's own crop", tip.cls === "fox" && /fox-runner\.webp/.test(tip.bg), tip);
  });
  await run({ buddy: "leo" }, "leo", async (ev, tip) => {
    ok("Sprint: \"leo\" (an old pick) is the fox", drew(ev, "fox-runner.webp").length > 0 && tip.cls === "fox", { tip, ev: ev.slice(-3) });
  });
  await run({ buddy: "dragon", noRun: true }, "no runner", async (ev, tip) => {
    ok("Sprint: a buddy with no runner is its round badge, clipped to a circle", clipThen(ev, "buddy-dragon-v2.webp") && !drew(ev, "buddy-dragon-run.webp").length, ev.slice(-6));
    ok("Sprint: …and on the start card its badge", tip.cls === "" && /buddy-dragon-v2\.webp/.test(tip.html), tip);
  });
  await run({ buddy: "dragon", noRun: true, noCircle: true }, "an old helper with no drawCircle", async (ev) => {
    ok("Sprint: with the helper's drawCircle gone, the page still draws the buddy", drew(ev, "buddy-dragon-v2.webp").length > 0, ev.slice(-4));
  });
});

// ── 3. Flappy Glide: the badge in the basket, round ──
await section("Flappy Glide", async () => {
  for (const [buddy, pic] of [["dragon", "buddy-dragon-v2.webp"], [null, "buddy-fox-v2.webp"]]) {
    const { context, page, errors } = await open("arcade-glide.html?from=charge", buddy ? { buddy } : {});
    try {
      await until(page, (pic) => window.__ev.some((e) => e.k === "img" && e.src === pic), 6000, pic);
      const ev = await events(page);
      ok("Glide (" + (buddy || "fox") + "): the badge is drawn clipped to a circle, never with square corners", clipThen(ev, pic) && drew(ev, pic).length > 0, ev.slice(-4));
      ok("Glide (" + (buddy || "fox") + "): no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  }
});

// ── 4. Fruit Slice: a fox child's market is today's; any other buddy peeks over the counter ──
await section("Fruit Slice", async () => {
  {
    const { context, page, errors } = await open("arcade-slice.html?from=charge", {});
    try {
      await page.waitForTimeout(400);
      const s = await page.evaluate(() => { const a = getComputedStyle(document.getElementById("app")), f = document.getElementById("standFront"), b = document.getElementById("sliceBuddy");
        return { bg: a.backgroundImage, size: a.backgroundSize, pos: a.backgroundPosition, cls: document.body.className, front: getComputedStyle(f).display, buddy: b.getAttribute("src"), buddyShown: getComputedStyle(b).display }; });
      const want = 'url("' + origin + '/assets/crafted/fruit-stand.webp"), url("' + origin + '/assets/crafted/fruit-market-v3.webp")';
      ok("Slice (fox): the market is today's, byte for byte: the counter with the fox painted in, over the orchard", s.bg === want && s.size === "100%, cover" && s.pos === "50% 100%, 50% 100%" && !/buddy-scene/.test(s.cls), s);
      ok("Slice (fox): no counter layer and no buddy picture", s.front === "none" && s.buddy === null && s.buddyShown === "none", s);
      ok("Slice (fox): no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  }
  {
    const { context, page, errors } = await open("arcade-slice.html?from=charge", { buddy: "dragon" });
    try {
      await until(page, () => { const b = document.getElementById("sliceBuddy"); return b.complete && b.naturalWidth > 0; }, 5000);
      const s = await page.evaluate(() => { const a = getComputedStyle(document.getElementById("app")), f = document.getElementById("standFront");
        return { bg: a.backgroundImage, size: a.backgroundSize, pos: a.backgroundPosition, cls: document.body.className, front: getComputedStyle(f).display, frontBg: getComputedStyle(f).backgroundImage, buddy: document.getElementById("sliceBuddy").getAttribute("src"), ledge: STAND_LEDGE,
          order: [...document.getElementById("app").children].slice(0, 3).map((e) => e.id), z: ["standFront", "sliceBuddy", "cv"].map((id) => getComputedStyle(document.getElementById(id)).zIndex) }; });
      ok("Slice (dragon): the page wears .buddy-scene, and #app is only the orchard, covering the screen", /buddy-scene/.test(s.cls) && s.bg === 'url("' + origin + '/assets/crafted/fruit-market-v3.webp")' && s.size === "cover", s);
      ok("Slice (dragon): the counter without the fox is its own layer", s.front === "block" && /fruit-stand-v2\.webp/.test(s.frontBg), s);
      ok("Slice (dragon): the dragon peeks over the ledge, in its peek pose", file(s.buddy) === "buddy-dragon-peek.webp", s.buddy);
      ok("Slice (dragon): both sit under the canvas (earlier in #app, no z-index), and the ledge the fruit stand on is unchanged", JSON.stringify(s.order) === '["standFront","sliceBuddy","cv"]' && s.z.every((z) => z === "auto") && s.ledge === 0.1979, s);
      // the peek's flat bottom on the counter's row 256 of 545, where the fox's paws ended
      const b = await box(page, "#sliceBuddy"), w = await page.evaluate(() => document.getElementById("app").clientWidth);
      ok("Slice (dragon): its frame is 23% of the width, at the left edge, its bottom (545-256)/1440 of the width above the screen's", Math.abs(b.w - w * 0.23) < 1.5 && Math.abs(b.l) < 1 && Math.abs((b.vh - b.b) - w * 289 / 1440) < 1.5, { b, w });
      ok("Slice (dragon): a wave still throws fruit", await until(page, () => fruits.length > 0, 7000));
      ok("Slice (dragon): no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  }
  {
    const { context, page, errors } = await open("arcade-slice.html?from=charge", { buddy: "dragon", missing: ["/assets/crafted/fruit-stand-v2.webp"] });
    try {
      await page.waitForTimeout(900);
      const s = await page.evaluate(() => ({ cls: document.body.className, bg: getComputedStyle(document.getElementById("app")).backgroundImage }));
      ok("Slice: a counter without the fox that won't load puts the old market back", !/buddy-scene/.test(s.cls) && /fruit-stand\.webp/.test(s.bg), s);
      ok("Slice (missing counter): no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  }
});

// ── 5. Block Stacker: the bench and the rocket ──
await section("Block Stacker", async () => {
  {
    const { context, page, errors } = await open("arcade-stack.html?from=charge", {});
    try {
      await page.waitForFunction(() => typeof startFinale === "function");
      await page.evaluate(() => startFinale());
      await until(page, () => window.__ev.some((e) => e.k === "img" && /stack-rocket/.test(e.src)), 5000);
      const s = await page.evaluate(() => ({ bg: getComputedStyle(document.getElementById("app")).backgroundImage, cls: document.body.className, buddy: document.getElementById("stackBuddy").getAttribute("src"), rocket: ROCKET_ART.src }));
      const ev = await events(page);
      ok("Stack (fox): the workshop with the fox on its bench, as today", s.bg === 'url("' + origin + '/assets/crafted/stack-workshop-v2.webp")' && !/buddy-scene/.test(s.cls) && s.buddy === null, s);
      ok("Stack (fox): the rocket with Echo in its window, and nobody clipped into it", file(s.rocket) === "stack-rocket-v2.webp" && drew(ev, "stack-rocket-v2.webp").length > 0 && !ev.some((e) => e.k === "img" && /^buddy-/.test(e.src)), { rocket: s.rocket });
      ok("Stack (fox): no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  }
  {
    const { context, page, errors } = await open("arcade-stack.html?from=charge", { buddy: "dragon" });
    try {
      await until(page, () => { const b = document.getElementById("stackBuddy"); return b.complete && b.naturalWidth > 0; }, 5000);
      const s = await page.evaluate(() => ({ bg: getComputedStyle(document.getElementById("app")).backgroundImage, cls: document.body.className, buddy: document.getElementById("stackBuddy").getAttribute("src"), first: document.getElementById("app").firstElementChild.id }));
      ok("Stack (dragon): the workshop without the fox, and the dragon sitting on the bench in its sit pose, under the canvas", /buddy-scene/.test(s.cls) && s.bg === 'url("' + origin + '/assets/crafted/stack-workshop-v3.webp")' && file(s.buddy) === "buddy-dragon-sit.webp" && s.first === "stackBuddy", s);
      const b = await box(page, "#stackBuddy"), a = await page.evaluate(() => { const r = document.getElementById("app").getBoundingClientRect(); return { w: r.width, h: r.height }; });
      // the frame (42% of the width, from 4% beyond the left edge, cut there by
      // object-fit) has its seat (the bottom 6%) on row 1228 of 1536
      ok("Stack (dragon): it sits where the fox sat: its seat on the bench's row 1228 of 1536", Math.abs(b.w - a.w * 0.38) < 1.5 && Math.abs(b.h - a.w * 0.42) < 1.5 && Math.abs((b.b - b.h * 0.06) - a.h * 1228 / 1536) < 2, { b, a });
      await page.evaluate(() => startFinale());
      await until(page, () => window.__ev.some((e) => e.k === "img" && e.src === "stack-rocket-v3.webp"), 5000);
      await page.waitForTimeout(300);
      const ev = await events(page), at = ev.findIndex((e) => e.k === "img" && e.src === "stack-rocket-v3.webp");
      ok("Stack (dragon): at the finale the rocket's porthole is empty glass, and the dragon's badge is clipped into it", at >= 0 && clipThen(ev.slice(at), "buddy-dragon-v2.webp") && !drew(ev, "stack-rocket-v2.webp").length, ev.slice(-5));
      const pin = ev.slice(at).find((e) => e.k === "img" && e.src === "buddy-dragon-v2.webp");
      ok("Stack (dragon): …at the glass's centre (-0.15, -67.65), 23 across, inside its 12.3 radius", pin && JSON.stringify(pin.a) === "[-11.65,-79.15,23,23]", pin);
      ok("Stack (dragon): no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  }
  for (const gone of ["stack-workshop-v3.webp", "stack-rocket-v3.webp"]) {
    const { context, page, errors } = await open("arcade-stack.html?from=charge", { buddy: "dragon", missing: ["/assets/crafted/" + gone] });
    try {
      await page.waitForTimeout(600);
      await page.waitForFunction(() => typeof startFinale === "function");
      await page.evaluate(() => startFinale());
      await until(page, () => window.__ev.some((e) => e.k === "img" && /stack-rocket/.test(e.src)), 5000);
      await page.waitForTimeout(200);
      const ev = await events(page), s = await page.evaluate(() => ({ cls: document.body.className, rocket: ROCKET_ART.src }));
      const scene = gone === "stack-workshop-v3.webp";
      ok("Stack: " + (scene ? "a workshop without the fox that won't load puts the old scene back, the old rocket with it" : "a rocket without Echo that won't load is the old one, with nobody added"),
        (scene ? !/buddy-scene/.test(s.cls) : /buddy-scene/.test(s.cls)) && file(s.rocket) === "stack-rocket-v2.webp" && !drew(ev, "buddy-dragon-v2.webp").length, { s, ev: ev.slice(-3) });
      ok("Stack (no " + gone + "): no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  }
});

// ── 6. Hoops, Soccer Goal, Dino Dig: the buddy opposite Echo, cheering with him ──
async function swipe(page, b, sideFrac, upPx, ms = 60) {
  const x0 = b.x + b.width / 2, y0 = b.y + b.height * 0.86;
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(x0 + sideFrac * b.width * i / 6, y0 - upPx * i / 6); await page.waitForTimeout(ms / 6); }
  await page.mouse.up();
}
async function rub(page, b, x0, x1, y, passes = 3) {
  await page.mouse.move(b.x + x0, b.y + y); await page.mouse.down();
  for (let p = 0; p < passes; p++) for (let i = 0; i <= 8; i++) { const t = i / 8, x = p % 2 ? x1 + (x0 - x1) * t : x0 + (x1 - x0) * t; await page.mouse.move(b.x + x, b.y + y + (p - 1) * 6); await page.waitForTimeout(12); }
  await page.mouse.up();
}
const PLAYED = [
  ["arcade-hoops.html", "Hoops", "courtEcho", "courtBuddy", "#court", "a basket", async (page) => {
    await page.evaluate(() => Hoops.onWord());
    if (!(await until(page, () => Hoops.snapshot().state === "ready", 5000))) return false;
    const b = await page.locator("#court").boundingBox();
    for (let t = 0; t < 4; t++) {
      const h = await page.evaluate(() => Hoops.snapshot()), up = 240;
      await swipe(page, b, (h.hoopX / 2.4) * up / b.width, up);
      if (await until(page, () => Hoops.snapshot().baskets === 1, 4000)) return true;
      await until(page, () => Hoops.snapshot().state === "ready", 5000);
    }
    return false;
  }],
  ["arcade-soccer.html", "Soccer", "pitchEcho", "pitchBuddy", "#pitch", "a goal", async (page) => {
    await page.evaluate(() => Soccer.onWord());
    if (!(await until(page, () => Soccer.snapshot().state === "ready", 5000))) return false;
    const b = await page.locator("#pitch").boundingBox();
    for (let t = 0; t < 4; t++) {
      await swipe(page, b, 0, 240);
      if (await until(page, () => Soccer.snapshot().goals === 1, 4000)) return true;
      await until(page, () => Soccer.snapshot().state === "ready", 5000);
    }
    return false;
  }],
  ["arcade-dino.html", "Dino", "digEcho", "digBuddy", "#dig", "a bone", async (page) => {
    await page.evaluate(() => Dino.onWord());
    const b = await page.locator("#dig").boundingBox(), stop = Date.now() + 20000;
    // rub over the bone until it pops out (the help widens with time, so a
    // slow machine still gets there), then wait for it to land
    while (Date.now() < stop) {
      const d = await page.evaluate(() => Dino.snapshot());
      if (d.state !== "ready" || !d.bone) break;
      for (let r = -1; r <= 1; r++) await rub(page, b, d.bone.x - d.bone.w / 2, d.bone.x + d.bone.w / 2, d.bone.y + r * d.bone.h * 0.3, 3);
    }
    return until(page, () => Dino.snapshot().found === 1 && Dino.snapshot().state === "placed", 6000);
  }],
];
for (const [pg, eng, echo, bud, canvas, what, play] of PLAYED) await section(eng, async () => {
  {
    const { context, page, errors } = await open(pg, { buddy: "dragon", standin: true });
    try {
      await until(page, (bud) => { const b = document.getElementById(bud); return b.complete && b.naturalWidth > 0; }, 5000, bud);
      const rest = await box(page, "#" + bud);
      ok(eng + " (dragon): the dragon stands opposite Echo in its rest pose, and takes no finger", file(rest.src) === "buddy-dragon-rest.webp" && rest.pe === "none" && inside(rest), rest);
      ok(eng + ": " + what + " is made", await play(page), await page.evaluate((eng) => window[eng].snapshot(), eng));
      const now = await page.evaluate(([echo, bud]) => ({ echo: document.getElementById(echo).classList.contains("hop"), bud: document.getElementById(bud).classList.contains("hop"), echoSrc: document.getElementById(echo).getAttribute("src"), budSrc: document.getElementById(bud).getAttribute("src") }), [echo, bud]);
      ok(eng + ": " + what + " hops Echo and the buddy, each in its own cheer picture", now.echo && now.bud && file(now.echoSrc) === "echo-cheer.webp" && file(now.budSrc) === "buddy-dragon-cheer.webp", now);
      await page.waitForTimeout(1000);
      const later = await page.evaluate(([echo, bud]) => ({ echoSrc: document.getElementById(echo).getAttribute("src"), budSrc: document.getElementById(bud).getAttribute("src") }), [echo, bud]);
      ok(eng + ": a second later the buddy rests again in its own picture, never Echo's", file(later.budSrc) === "buddy-dragon-rest.webp" && file(later.echoSrc) === "echo-welcome.webp", later);
      if (eng === "Dino") {
        const d = await page.evaluate(() => Dino.snapshot()), c = await page.locator("#dig").boundingBox(), b = await box(page, "#digBuddy");
        ok("Dino: the buddy stands clear of the pit", apart(b, { l: c.x + d.pit.x, t: c.y + d.pit.y, r: c.x + d.pit.x + d.pit.w, b: c.y + d.pit.y + d.pit.h }), { b, pit: d.pit });
      }
      ok(eng + " (dragon): no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  }
  {
    // a fox child stands as the fox; an engine handed something that is not
    // two picture paths has no swap at all
    const { context, page, errors } = await open(pg, { standin: true });
    try {
      await until(page, (bud) => { const b = document.getElementById(bud); return b.complete && b.naturalWidth > 0; }, 5000, bud);
      const s = await page.evaluate(([eng, bud]) => { const before = window[eng].snapshot(); window[eng].setBuddy({ rest: 1, cheer: null }); return { src: document.getElementById(bud).getAttribute("src"), ok: !!before }; }, [eng, bud]);
      ok(eng + " (fox): the fox stands there in its own rest pose", file(s.src) === "buddy-fox-rest.webp", s);
      ok(eng + ": setBuddy refuses anything but two picture paths, and then only the hop runs", await play(page) && file(await page.evaluate((bud) => document.getElementById(bud).getAttribute("src"), bud)) === "buddy-fox-rest.webp" && await page.evaluate((bud) => document.getElementById(bud).classList.contains("hop"), bud));
      ok(eng + " (fox): no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  }
});

// ── 7. Feed Echo: the buddy watches; Echo is still the one fed ──
await section("Feed Echo", async () => {
  // Echo and the plate as a page with no buddy at all lays them out
  let bare;
  {
    const { context, page } = await open("arcade-feed.html", { buddy: "dragon", age: "4", missing: ["/crafted-buddies.js"] });
    try { await page.waitForTimeout(300); bare = await page.evaluate(() => ({ echo: JSON.stringify(document.getElementById("echo").getBoundingClientRect()), plate: JSON.stringify(document.getElementById("plate").getBoundingClientRect()), shown: getComputedStyle(document.getElementById("feedBuddy")).display })); }
    finally { await context.close(); }
  }
  ok("Feed: without the helper there is no buddy, and nothing breaks", bare.shown === "none");
  const { context, page, errors } = await open("arcade-feed.html", { buddy: "dragon", age: "4" });
  try {
    await until(page, () => { const b = document.getElementById("feedBuddy"); return b && b.complete && b.naturalWidth > 0; }, 5000);
    const s = await page.evaluate(() => { const e = document.getElementById("echo"); return { src: document.getElementById("feedBuddy").getAttribute("src"), inSpot: !!document.querySelector("#echoSpot #feedBuddy"), echo: { alt: e.alt, src: e.getAttribute("src"), z: getComputedStyle(e).zIndex, rect: JSON.stringify(e.getBoundingClientRect()) }, plate: { z: getComputedStyle(document.getElementById("plate")).zIndex, rect: JSON.stringify(document.getElementById("plate").getBoundingClientRect()) } }; });
    ok("Feed: the dragon stands beside Echo, in its rest pose", s.inSpot && file(s.src) === "buddy-dragon-rest.webp", s.src);
    ok("Feed: Echo is unchanged: the same picture, place, size and layer as with no buddy, and the plate in front of both", s.echo.alt === "Echo" && file(s.echo.src) === "echo-welcome.webp" && s.echo.z === "1" && s.plate.z === "2" && s.echo.rect === bare.echo && s.plate.rect === bare.plate, { s, bare });
    const b = await box(page, "#feedBuddy"), wells = await page.evaluate(() => [...document.querySelectorAll("#plate .well")].map((w) => { const r = w.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; })), echo = await box(page, "#echo");
    // (its drawing's feet are its frame's bottom 6%)
    ok("Feed: its feet stand at the plate's rim, and it covers none of the plate's wells (the feeds counted)", wells.length === 5 && wells.every((w) => apart(b, w)) && Math.abs((b.b - b.h * 0.06) - JSON.parse(s.plate.rect).top) <= 3, { b, wells, plate: s.plate.rect });
    ok("Feed: it stands to Echo's left, overlapping his box by no more than its own empty margin", b.r <= echo.l + 12 && b.l < echo.l, { b, echo });
    // a right feed: the word heard, the right picture tapped
    await page.locator("#startBtn").click();
    await page.waitForFunction(() => document.querySelectorAll("#grid .cardBtn").length > 0);
    await until(page, () => window.__mic.live === 1, 6000); await page.waitForTimeout(450);
    await page.evaluate(() => { window.__mic.voice = true; });
    await until(page, () => !document.getElementById("grid").classList.contains("locked"), 6000);
    await page.evaluate(() => { window.__mic.voice = false; });
    const word = await page.locator("#bMain b").innerText();
    await page.locator("#grid .cardBtn").filter({ hasText: new RegExp("^" + word + "$") }).click();
    await page.waitForTimeout(250);
    const fed = await page.evaluate(() => ({ munch: document.getElementById("feedBuddy").classList.contains("munch"), src: document.getElementById("feedBuddy").getAttribute("src"), echo: document.getElementById("echo").classList.contains("munch"), wells: document.querySelectorAll("#plate .well .fd").length }));
    ok("Feed: a right feed is Echo's: he munches and the plate fills; the buddy hops in its own cheer picture", fed.echo && fed.wells === 1 && fed.munch && file(fed.src) === "buddy-dragon-cheer.webp", fed);
    await page.waitForTimeout(1000);
    ok("Feed: …and rests again a second later", file(await page.evaluate(() => document.getElementById("feedBuddy").getAttribute("src"))) === "buddy-dragon-rest.webp");
    ok("Feed: no page errors", errors.length === 0, errors);
  } finally { await context.close(); }
});

// ── 8. Fit: on screen, no finger, clear of the pictures and the pit, at 320 and 390 ──
const FIT = [["arcade-slice.html?from=charge", "#sliceBuddy"], ["arcade-stack.html?from=charge", "#stackBuddy"], ["arcade-hoops.html", "#courtBuddy"], ["arcade-soccer.html", "#pitchBuddy"], ["arcade-dino.html", "#digBuddy"], ["arcade-feed.html", "#feedBuddy"]];
for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) await section("fit at " + size.width, async () => {
  for (const [pg, sel] of FIT) {
    const feed = /feed/.test(pg);
    const { context, page, errors } = await open(pg, { buddy: "panda", size, age: feed ? "4" : "7" });
    try {
      if (feed) { await page.locator("#startBtn").click(); await page.waitForFunction(() => document.querySelectorAll("#grid .cardBtn").length > 0); }
      await until(page, (sel) => { const b = document.querySelector(sel); return b && b.complete && b.naturalWidth > 0; }, 5000, sel);
      await page.evaluate(() => document.querySelectorAll(".ovl.show").forEach((o) => o.classList.remove("show")));
      const b = await box(page, sel), L = size.width + "px " + pg.split("?")[0] + ": ";
      ok(L + sel + " is wholly on screen and takes no finger", inside(b) && b.pe === "none", b);
      if (feed) { const g = await box(page, "#grid"); ok(L + "the buddy covers none of the pictures", apart(b, g), { b, g }); }
      if (/dino/.test(pg)) {
        const d = await page.evaluate(() => Dino.snapshot()), c = await page.locator("#dig").boundingBox();
        ok(L + "the buddy stands clear of the pit", apart(b, { l: c.x + d.pit.x, t: c.y + d.pit.y, r: c.x + d.pit.x + d.pit.w, b: c.y + d.pit.y + d.pit.h }), { b, pit: d.pit });
      }
      ok(L + "no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  }
});

// ── 9. Bubble Pop and Piano Tiles: no buddy (Echo's giant bubble; nothing on the lanes) ──
await section("no buddy", async () => {
  for (const [pg, age] of [["arcade-bubbles.html", "4"], ["arcade-tiles.html?from=charge", "7"]]) {
    const { context, page, errors } = await open(pg, { buddy: "dragon", age });
    try {
      await page.waitForTimeout(1500);
      const s = await page.evaluate(() => ({ els: [...document.querySelectorAll("[id*='uddy'], img")].filter((e) => /uddy/.test(e.id) || /buddy-/.test(e.getAttribute("src") || "")).map((e) => e.id || e.getAttribute("src")), drawn: window.__ev.filter((e) => e.k === "img" && /^buddy-/.test(e.src)).length }));
      ok(pg.split("?")[0] + ": no buddy on the page or the canvas", s.els.length === 0 && s.drawn === 0, s);
      ok(pg.split("?")[0] + ": no page errors", errors.length === 0, errors);
    } finally { await context.close(); }
  }
});

console.log(fails ? `\n${fails} FAILED` : "\nall play-as-your-buddy checks passed");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
