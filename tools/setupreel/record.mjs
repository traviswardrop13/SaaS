// Setup's game reel: short clips of the REAL games, for the "See it play"
// screen (Travis, 22 Oct 2026: "Do like a little clip of a few games so that
// parents can see it"). Nothing here is drawn or edited: each clip is the
// page in public/, served as is on tools/appstore/capture.mjs's fake phone,
// played with the page's own controls and filmed one frame at a time.
//
//   node tools/setupreel/record.mjs                 every game in KEYS
//   node tools/setupreel/record.mjs --only=slice,hoops
//   node tools/setupreel/record.mjs --frames-only   film, no encode (look first)
//   node tools/setupreel/record.mjs --full          the whole screen every half
//                                                   second, to choose a crop
//   node tools/setupreel/record.mjs --encode-only   encode the last frames again
//   node tools/setupreel/record.mjs --debug         each scene's probe, as it films
//
// Writes public/assets/setup/reel/<key>.mp4 (540x720, 30 fps, 4 s, H.264
// High, no audio track, moov first) and <key>.webp (its first frame), and a
// contact sheet per clip in tools/setupreel/out/sheets/ (git ignores out/):
// LOOK at every sheet before committing a clip (an empty sky, a game cut off
// by the crop, a card or a HUD half in the frame, a dead stretch, a miss the
// finger should not have made). tests/setupreeltest.mjs checks the files
// (size, codec, no audio, faststart, poster) and that KEYS is its list; it
// never runs this. A new game on the reel is a scene here, a key in KEYS and
// in that test's list, and setup's own list. Needs ffmpeg with libx264 and
// libwebp, and ImageMagick's montage for the sheets. It is CPU heavy (about a
// minute a clip; SETUPREEL_PORT, default 9303): run it alone, not beside a
// test. The games' dice are seeded (cfg.seed), so a scene films the same
// round each time until a game's code changes; a scene that stalls says
// where ("stalled: …"), and --debug shows why.
//
// How it films: Playwright's virtual clock (page.clock), paused, moved on
// 1/30 s per frame, a screenshot each frame at 390x844 @2x, cropped to the
// game's action at 3:4. The games' requestAnimationFrame, timers and
// performance.now are the clock's, so a frame is exactly 1/30 s of the game
// however long the screenshot takes; their CSS animations (banners, Echo's
// hop) are held and stepped the same 1/30 s through the Web Animations API.
//
// What is staged, and why it is honest:
//   - capture.mjs's household (an onboarded child on R, Premium through the
//     free-era promise, every era stamp set), as the iPhone app. R is the
//     sound because setup's reel says "Example: the R sound"; the child's
//     name is on no game page, and each clip is checked for it anyway;
//   - the "child" is capture.mjs's fake microphone: a voiced sound only while
//     a scene sets __dev.voice, as the test suites do. Super Slice, a ball, a
//     brush, the bubbles or Echo's meal is earned the way a child earns it:
//     Echo asks (for Super Slice, after a tap on him), the mic hears the
//     sound or the word (two times where the game asks two), the page's own
//     check says yes;
//   - the finger is the page's own pointer events (page.mouse), one move a
//     frame, so a swipe takes the time a child's does;
//   - Echo's mid-round ask is held (holdAsk), so a clip shows the game being
//     played, not a mic opening at a random moment;
//   - never a Coming soon game: every key below is open on Home.
// A game that cannot be staged honestly gets no clip; setup then shows its
// painted Home card in its place.
import { readFileSync, mkdirSync, rmSync, statSync, readdirSync } from "fs";
import { createServer } from "http";
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { chromium, launchOpts } from "../../tests/_env.mjs";
import { device, fileFor, MIME, seedOutcomes, seedGameReps, seedProgress } from "../appstore/capture.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const DEST = path.join(REPO, "public/assets/setup/reel");
const OUT = process.env.SETUPREEL_OUT || path.join(HERE, "out");
const PORT = Number(process.env.SETUPREEL_PORT || 9303);
const BASE = "http://127.0.0.1:" + PORT;

// An iPhone 13/14 (390 x 844 pt) at @2x: 780 px across, cut to a 780 x 1040
// window (3:4) and scaled to 540 x 720. The safe areas are that phone's.
const VIEW = { width: 390, height: 844 }, DPR = 2, INSET = { top: 47, bottom: 34 };
const CROP_H = VIEW.width * 4 / 3;              // 520 pt
const SIZE = { w: 540, h: 720 };
// in bytes, decimal: 300 KB a clip, 60 KB a poster (tests/setupreeltest.mjs)
export const BUDGET = { mp4: 300000, webp: 60000 };
const FPS = 30;
// Thursday 22 Oct 2026, 4:10 pm in Idaho.
const AT = Date.parse("2026-10-22T16:10:00-06:00");
const TZ = "America/Boise";
const NAME = "Mia";                             // capture.mjs's household

// ── the server: public/ as it is ──
const server = createServer((req, res) => {
  const u = new URL(req.url, BASE);
  if (u.pathname.startsWith("/api/")) { res.writeHead(503, { "content-type": "application/json" }); res.end("{}"); return; }
  const f = fileFor(u.pathname);
  if (!f) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[f.split(".").pop()] || "application/octet-stream" });
  res.end(readFileSync(f));
});

let browser, FULL = false, DEBUG = false;
async function open(url, cfg = {}) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, timezoneId: TZ, locale: "en-US" });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (!u.href.startsWith(BASE + "/")) return route.abort();
    if (/\.(html|css|js)$/.test(u.pathname) || u.pathname === "/") {
      const f = fileFor(u.pathname === "/" ? "/index.html" : u.pathname);
      if (f) return route.fulfill({ status: 200, contentType: MIME[f.split(".").pop()],
        body: readFileSync(f, "utf8").replace(/env\(safe-area-inset-top[^)]*\)/g, INSET.top + "px").replace(/env\(safe-area-inset-bottom[^)]*\)/g, INSET.bottom + "px").replace(/env\(safe-area-inset-(left|right)[^)]*\)/g, "0px") });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  // the clock first, so the fake phone's requestAnimationFrame wrapper wraps
  // the clock's, and the clock owns Date (ownClock)
  await page.clock.install({ time: AT });
  // the game's dice, seeded, so a scene plays the same way every time it is
  // filmed (the same round a child could get: only the order is fixed)
  await context.addInitScript((seed) => {
    let a = seed >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, cfg.seed || 7);
  await context.addInitScript(device, Object.assign({ shift: 0, ownClock: true, native: true, holdAsk: true, goalMet: true,
    outcomes: seedOutcomes(), gameReps: seedGameReps(), progress: seedProgress() }, cfg));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + url);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 50);
  return { context, page, errors };
}

// ── time ──
// A frame is 1/30 s: 33, 33, 34 ms, so three frames are exactly 100 ms.
let tick = 0;
const frameMs = () => [33, 33, 34][tick++ % 3];
async function run(page, ms) { await page.clock.runFor(ms); }
// the page's CSS animations, held and stepped with the clock (a banner that
// slides in over 400 ms takes 12 frames, not one)
const stepAnims = (page, dt) => page.evaluate((dt) => {
  const seen = window.__reelAnims || (window.__reelAnims = new WeakSet());
  for (const a of document.getAnimations()) {
    if (!seen.has(a)) { seen.add(a); a.pause(); continue; }
    if (a.playState !== "paused") a.pause();
    a.currentTime = (Number(a.currentTime) || 0) + dt;
  }
}, dt);
// wait in game time for the page to say so
async function until(page, fn, maxMs, arg, step = 50) {
  for (let t = 0; t <= maxMs; t += step) {
    if (await page.evaluate(fn, arg)) return true;
    await run(page, step);
  }
  return false;
}
async function must(page, what, ok) {
  if (!(await ok)) throw new Error("stalled: " + what);
}
async function images(page) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].filter((i) => i.src && !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); }))));
}

// ── the finger: one pointer move a frame ──
// A gesture is a list of points; frame() plays the next one before the clock
// moves, so a 5-point swipe takes 5 frames (about 170 ms), as a child's does.
function finger(page) {
  let path = null, i = 0;
  return {
    busy: () => !!path,
    start(points) { path = points; i = 0; },
    async frame() {
      if (!path) return;
      const p = path[i];
      if (i === 0) { await page.mouse.move(p.x, p.y); await page.mouse.down(); }
      else await page.mouse.move(p.x, p.y);
      i++;
      if (i >= path.length) { await page.mouse.up(); path = null; }
    },
  };
}
const line = (x0, y0, x1, y1, n) => Array.from({ length: n }, (_, k) => ({ x: x0 + (x1 - x0) * k / (n - 1), y: y0 + (y1 - y0) * k / (n - 1) }));

// one frame of game time without filming it (staging)
async function step(page, drive) {
  if (drive) await drive();
  await run(page, frameMs());
}

// ── filming ──
async function film(s, scene, key) {
  const { page } = s;
  const dir = path.join(OUT, "frames", key);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const frames = Math.round((scene.seconds || 4) * FPS);
  const cropY = scene.crop ? await scene.crop(page) : scene.cropY;
  const clip = FULL ? undefined : { x: 0, y: cropY, width: VIEW.width, height: CROP_H };
  s.cropY = cropY;
  const named = [];
  for (let f = 0; f < frames; f++) {
    if (scene.drive) await scene.drive(f);
    const dt = frameMs();
    await run(page, dt);
    await stepAnims(page, dt);
    if (DEBUG && scene.debug && f % 15 === 0) console.log("  " + key + " " + f + ": " + JSON.stringify(await page.evaluate(scene.debug)));
    if (f === 0 || f === frames - 1 || f % 30 === 0) named.push(await page.evaluate((n) => (document.body.innerText || "").includes(n), NAME));
    if (!FULL || f % 15 === 0) await page.screenshot({ path: path.join(dir, String(f).padStart(4, "0") + ".png"), clip });
  }
  if (named.some(Boolean)) throw new Error("the child's name is on screen");
  return dir;
}

// ── encoding ──
function ff(args) { execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" }); }
function encode(key, dir) {
  mkdirSync(DEST, { recursive: true });
  const mp4 = path.join(DEST, key + ".mp4"), webp = path.join(DEST, key + ".webp");
  // H.264 High, yuv420p, a keyframe every 2 s, no audio track, moov first:
  // what an iPhone's web view plays inline and muted with no tap
  let crf = 28;
  for (; crf <= 36; crf++) {
    ff(["-framerate", String(FPS), "-i", path.join(dir, "%04d.png"),
      "-vf", "scale=" + SIZE.w + ":" + SIZE.h + ":flags=lanczos,format=yuv420p",
      "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.0", "-preset", "veryslow", "-tune", "animation",
      "-crf", String(crf), "-g", "60", "-an", "-map_metadata", "-1", "-movflags", "+faststart", mp4]);
    if (statSync(mp4).size <= BUDGET.mp4) break;
  }
  // the poster is the clip's first frame, so nothing jumps when it starts
  let q = 82;
  for (; q >= 40; q -= 6) {
    ff(["-i", path.join(dir, "0000.png"), "-vf", "scale=" + SIZE.w + ":" + SIZE.h + ":flags=lanczos",
      "-c:v", "libwebp", "-quality", String(q), "-compression_level", "6", "-map_metadata", "-1", webp]);
    if (statSync(webp).size <= BUDGET.webp) break;
  }
  return { crf, q, mp4: statSync(mp4).size, webp: statSync(webp).size };
}
function sheet(key, dir, full) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
  const pick = files.filter((_, i) => full || i % 15 === 0).map((f) => path.join(dir, f));
  const out = path.join(OUT, "sheets", key + ".png");
  mkdirSync(path.dirname(out), { recursive: true });
  try { execFileSync("montage", [...pick, "-tile", pick.length + "x1", "-geometry", full ? "195x422+2+2" : "195x260+2+2", out]); } catch (e) { return null; }
  return out;
}

// ── the scenes ──
// The round games' top (the close button, the counts, Echo's pill and the
// line under it) ends about 210 pt down: a crop starts below it.
const HUD = 212;
// Each opens a fresh phone, stages the moment (game time, unfilmed), then
// films `seconds` with drive(f) playing the finger each frame.
const SCENES = {};
const ROUND = (game) => ({ "sona.play.token": "arcade-" + game + ".html", "sona.boost.sound": "R", "sona.boost.level": "isolation", "sona.boost.ask": "rrrr" });

// Echo's sound power (Super Slice): a tap on Echo, his ask, and the child's
// sound heard through the mic. The page decides; nothing is set.
async function earnPower(page) {
  for (let tries = 0; tries < 3 && !(await page.evaluate(() => slowMs > 0)); tries++) {
    const mics = await page.evaluate(() => __dev.mics);
    await page.evaluate(() => document.getElementById("slowKeys").click());
    if (!(await until(page, (m) => __dev.mics > m, 15000, mics))) continue;
    await run(page, 350);
    await page.evaluate(() => { __dev.voice = true; });
    await until(page, () => slowMs > 0, 3000);
    await page.evaluate(() => { __dev.voice = false; });
  }
  await must(page, "the sound power", page.evaluate(() => slowMs > 0));
}

// 1. Fruit Slice: Super Slice on, the stand throwing fruit, the rainbow blade
// cutting through them.
SCENES.slice = {
  // from the "Super Slice!" line under Echo's pill, through the banner and
  // the sky, down to the fence (the fox and Echo peek over the counter just
  // below it)
  url: "/arcade-slice.html?from=charge", cfg: { session: ROUND("slice") }, cropY: 184, seconds: 4,
  async stage(s) {
    const { page } = s;
    await must(page, "the game", until(page, () => window.gameEntryAllowed === true && typeof startWave === "function", 20000));
    await images(page);
    s.finger = finger(page);
    s.cut = sliceCutter(page, s.finger, this.cropY);
    // a short row first, so the counter shows a real one
    for (let t = 0; t < 900 && (await page.evaluate(() => rowN)) < 3; t++) await step(page, s.cut);
    await earnPower(page);
    // the banner says it, the stand throws five at once: the clip opens
    // with them in the air
    await until(page, (y) => fruits.filter((q) => !q.sliced && q.y < standTop() - 60 && q.y > y + 40).length >= 3, 4000, this.cropY);
  },
  drive() { return this._s.cut(); },
};
// the next fruit to cut: whole, in the crop's sky, near the top of its arc;
// the swipe crosses where it will be two frames on
function sliceCutter(page, fing, cropY) {
  let rest = 0;
  return async () => {
    if (fing.busy()) return fing.frame();
    if (rest-- > 0) return;
    const pts = await page.evaluate((cropY) => {
      const r = document.getElementById("cv").getBoundingClientRect(), fac = slowFactor() * slicePace();
      const up = fruits.filter((q) => !q.sliced && q.y < Math.min(standTop() - 50, cropY + 480) && q.y > cropY + 70 && q.vy > -2.5);
      if (!up.length) return null;
      const f = up.sort((a, b) => Math.abs(a.vy) - Math.abs(b.vy))[0], k = 4;
      const x = f.x + f.vx * fac * k, y = f.y + f.vy * fac * k + 0.5 * (f.g || G) * fac * fac * k * k;
      const dir = Math.random() < 0.5 ? -1 : 1;
      return { x0: r.left + x - dir * 85, y0: r.top + y + 40, x1: r.left + x + dir * 85, y1: r.top + y - 40 };
    }, cropY);
    if (!pts) return;
    fing.start(line(pts.x0, pts.y0, pts.x1, pts.y1, 5));
    rest = 5;
    return fing.frame();
  };
}

// 2. Piano Tiles: a song coming down the lanes, each tile played as it
// reaches the keys.
SCENES.tiles = {
  url: "/arcade-tiles.html?from=charge", cfg: { session: ROUND("tiles") }, seconds: 4,
  crop: (page) => page.evaluate(() => Math.round(H + document.getElementById("cv").getBoundingClientRect().top - 520 + 8)),
  async stage(s) {
    const { page } = s;
    await must(page, "the game", until(page, () => window.gameEntryAllowed === true && typeof startSong === "function", 20000));
    await images(page);
    s.play = tilePlayer(page);
    // into the song, past the three tiles that wait on the keys, with the
    // lanes in the crop full (never as far as the song's end)
    const top = await this.crop(page);
    await must(page, "a full song", (async () => {
      for (let t = 0; t < 600; t++) {
        await step(page, s.play);
        if (await page.evaluate((top) => phase === "song" && songIx >= 4 && songIx <= 10 && tiles.filter((q) => !q.hit && !q.gone && q.y + q.h > top - document.getElementById("cv").getBoundingClientRect().top + 30).length >= 2, top)) return true;
      }
      return false;
    })());
  },
  drive() { return this._s.play(); },
};
// a tile is played when its foot is on the keys, as a child's finger does
function tilePlayer(page) {
  return async () => {
    const t = await page.evaluate(() => {
      const q = tiles.filter((q) => !q.hit && !q.gone && q.y + q.h > HITY() + 4 && q.y < HITY() + 40).sort((a, b) => b.y - a.y)[0];
      if (!q) return null;
      const r = document.getElementById("cv").getBoundingClientRect();
      return { x: r.left + (q.lane + 0.5) * (W / 4), y: r.top + HITY() + 40 };
    });
    if (t) { await page.mouse.move(t.x, t.y); await page.mouse.down(); await page.mouse.up(); }
  };
}

// 3. Block Stacker: the tower going up, a block dropped as it swings over it.
SCENES.stack = {
  url: "/arcade-stack.html?from=charge", cfg: { session: ROUND("stack") }, seconds: 4,
  // the swinging block at the top, the tower, the fox and Echo, the board
  crop: (page) => page.evaluate(() => { const r = document.getElementById("cv").getBoundingClientRect(); return Math.max(0, Math.round(r.top + H - 554)); }),
  async stage(s) {
    const { page } = s;
    await must(page, "the game", until(page, () => window.gameEntryAllowed === true && typeof drop === "function", 20000));
    await images(page);
    s.play = stacker(page);
    // floor 1 stands on the practice page's five: one block on, the floor's
    // banner gone, and the rest of the floor (three drops) on film
    for (let t = 0; t < 900 && (await page.evaluate(() => stack.length)) < 6; t++) await step(page, s.play);
    await must(page, "floor 1 under way", page.evaluate(() => phase === "floor" && stack.length === 6));
    await until(page, () => Number(getComputedStyle(document.getElementById("banner")).opacity) < 0.05, 4000);
  },
  drive() { return this._s.play(); },
};
function stacker(page) {
  let rest = 0;
  return async () => {
    if (rest-- > 0) return;
    const go = await page.evaluate(() => {
      if (!playing || dropping || phase !== "floor" || !cur) return null;
      const top = stack[stack.length - 1];
      if (Math.abs(cur.x - top.x) > Math.max(6, top.w * 0.1)) return null;
      const r = document.getElementById("cv").getBoundingClientRect();
      return { x: r.left + W / 2, y: r.top + H * 0.75 };
    });
    if (go) { await page.mouse.move(go.x, go.y); await page.mouse.down(); await page.mouse.up(); rest = 12; }
  };
}

// 4. Sound Sprint: the runner switching lanes past the rocks, into the coins.
SCENES.run = {
  url: "/arcade-run.html?from=charge", cfg: { session: ROUND("run") }, seconds: 4,
  crop: (page) => page.evaluate(() => { const r = document.getElementById("cv").getBoundingClientRect(); return Math.max(0, Math.round(r.top + PLAYY() + 120 - 520)); }),
  async stage(s) {
    const { page } = s;
    await must(page, "the game", until(page, () => window.gameEntryAllowed === true && typeof spawnRow === "function", 20000));
    await images(page);
    s.play = runner(page);
    // a few seconds in, the clip opens on a rock coming down the runner's
    // lane, with coins on the road
    await must(page, "a rock to dodge", (async () => {
      for (let t = 0; t < 1200; t++) {
        await step(page, s.play);
        if (t > 180 && await page.evaluate(() => phase === "run" && !falling.on && things.some((q) => q.t === "o" && q.y > 60 && q.y < PLAYY() - 260) && things.some((q) => q.t === "c" && !q.got && q.y > 40 && q.y < PLAYY()))) return true;
      }
      return false;
    })());
  },
  drive() { return this._s.play(); },
};
// dodge a rock in the runner's lane, else go where the coins are
function runner(page) {
  let rest = 0;
  return async () => {
    if (rest-- > 0) return;
    const go = await page.evaluate(() => {
      if (!playing || falling.on || phase !== "run") return null;
      const near = (q) => q.y > PLAYY() - 300 && q.y < PLAYY() + 10;
      const rock = (l) => things.some((q) => q.t === "o" && q.lane === l && q.y > PLAYY() - 360 && q.y < PLAYY() + 40);
      let want = lane;
      if (rock(lane)) { const free = [0, 1, 2].filter((l) => l !== lane && !rock(l)); want = free.sort((a, b) => Math.abs(a - lane) - Math.abs(b - lane))[0]; }
      else { const c = things.filter((q) => q.t === "c" && !q.got && near(q) && !rock(q.lane)).sort((a, b) => b.y - a.y)[0]; if (c) want = c.lane; }
      if (want == null || want === lane) return null;
      const r = document.getElementById("cv").getBoundingClientRect();
      return { x: r.left + laneCX(want), y: r.top + PLAYY() };
    });
    if (go) { await page.mouse.move(go.x, go.y); await page.mouse.down(); await page.mouse.up(); rest = 8; }
  };
}

// 5. Flappy Glide: the balloon kept in the gaps with a tap now and then.
SCENES.glide = {
  url: "/arcade-glide.html?from=charge", cfg: { session: ROUND("glide") }, seconds: 4,
  // straight under the top: every gap's middle (a third to two thirds of
  // the way down) is in it, so the balloon never leaves the frame
  cropY: HUD,
  async stage(s) {
    const { page } = s;
    await must(page, "the game", until(page, () => window.gameEntryAllowed === true && typeof flap === "function", 20000));
    await images(page);
    s.play = glider(page);
    for (let t = 0; t < 600; t++) {
      await step(page, s.play);
      if (t > 150 && await page.evaluate(() => phase === "fly" && gates.some((g) => g.x > px + 70 && g.x < px + 150 && Math.abs(py - g.cy) < gapH * 0.2))) break;
    }
  },
  drive() { return this._s.play(); },
};
function glider(page) {
  let rest = 0;
  return async () => {
    if (rest-- > 0) return;
    const go = await page.evaluate(() => {
      if (!playing || phase !== "fly") return null;
      const g = gates.filter((g) => g.x + 40 > px).sort((a, b) => a.x - b.x)[0], aim = g ? g.cy + gapH * 0.24 : H * 0.5;   // the lower half of the gap: the balloon stays in the frame under a high gap
      if (!(py > aim && vy >= 0)) return null;
      const r = document.getElementById("cv").getBoundingClientRect();
      return { x: r.left + W * 0.6, y: r.top + H * 0.6 };
    });
    if (go) { await page.mouse.move(go.x, go.y); await page.mouse.down(); await page.mouse.up(); rest = 7; }
  };
}

// 6. Rise Up: the shield dragged into the falling blocks, pushing them off
// the balloon's way.
SCENES.rise = {
  url: "/arcade-rise.html?from=charge", cfg: { session: ROUND("rise") }, seconds: 4,
  crop: (page) => page.evaluate((hud) => { const r = document.getElementById("cv").getBoundingClientRect(); return Math.max(hud, Math.min(844 - 520, Math.round(r.top + Rise.balloon.y + Rise.balloon.r * 2.4 - 520))); }, HUD),
  debug: () => ({ sh: [Math.round(Rise.shield.x), Math.round(Rise.shield.y)], bl: [Math.round(Rise.balloon.x), Math.round(Rise.balloon.y)], p: Rise.pieces.filter((p) => !p.gone).map((p) => [p.kind, Math.round(p.x), Math.round(p.y)]), pushed: window.pushed }),
  async stage(s) {
    const { page } = s;
    await must(page, "the game", until(page, () => window.gameEntryAllowed === true && window.Rise && Rise.balloon, 20000));
    await images(page);
    s.play = shielder(page, HUD);
    for (let t = 0; t < 600; t++) {
      await step(page, s.play);
      // the clip opens as a group of blocks comes down over the balloon
      if (t > 200 && await page.evaluate(() => Rise.pieces.filter((p) => !p.gone && p.y > -80 && p.y < 60 && Math.abs(p.x - Rise.balloon.x) < W * 0.3).length >= 3)) break;
    }
  },
  drive() { return this._s.play(); },
};
// one finger down on the board the whole time, sliding at a child's speed:
// the shield goes under the block nearest the balloon, waits for it in the
// open sky below Echo's pill, and moves INTO it as it comes (a push is the
// shield moving into a block; one that only lands on a still shield is not)
function shielder(page, top) {
  let at = null;
  return async () => {
    const t = await page.evaluate((top) => {
      const r = document.getElementById("cv").getBoundingClientRect(), sh = Rise.shield, bl = Rise.balloon, box = Rise.shieldBox();
      // it waits well below the top of the frame and lunges up to meet a block
      const reach = Math.max(box.y0, top - r.top + sh.r + 60), wait = box.y1, near = (p) => Math.hypot(p.x - sh.x, p.y - sh.y);
      // the block nearest the balloon (not one just pushed: it is already
      // on its way out)
      const T = Rise.pieces.filter((p) => !p.gone && p.alpha > 0.6 && performance.now() - p.pushAt > 900 && Math.abs(p.vx) < 1.5 && p.y > 60 && p.y < bl.y && Math.abs(p.x - bl.x) < W * 0.36).sort((a, b) => b.y - a.y)[0];
      if (!T) return { dx: 0, dy: 0, left: r.left, top: r.top, W, H };
      const lunge = near(T) < sh.r + Rise.s + 30, want = lunge ? { x: T.x + (T.x < bl.x ? 8 : -8), y: T.y - 12 } : { x: T.x, y: T.y + sh.r + Rise.s };
      want.x = Math.max(box.x0, Math.min(box.x1, want.x)); want.y = Math.max(lunge ? reach : wait, Math.min(box.y1, want.y));
      return { dx: want.x - sh.tx, dy: want.y - sh.ty, left: r.left, top: r.top, W, H };
    }, top);
    // a finger near the screen's edge is lifted and put down again lower in
    // the middle (a finger going down moves nothing)
    if (at && (at.x < 24 || at.x > t.W - 24 || at.y < 150 || at.y > t.top + t.H - 20)) { await page.mouse.up(); at = null; }
    if (!at) { at = { x: t.left + t.W / 2, y: t.top + t.H * 0.86 }; await page.mouse.move(at.x, at.y); await page.mouse.down(); return; }
    const k = (v) => Math.max(-24, Math.min(24, v));
    if (!t.dx && !t.dy) return;
    at = { x: at.x + k(t.dx), y: at.y + k(t.dy) };
    await page.mouse.move(at.x, at.y);
  };
}

// The Say & Play games: the child's two sayings, a beat apart, whenever Echo
// is listening (sayplaytest's sayIt, frame by frame). One saying in a game
// that asks once (Bubble Pop).
function talker(page) {
  let on = 0, wait = 0;
  return async () => {
    if (on > 0) { if (--on === 0) await page.evaluate(() => { __dev.voice = false; }); return; }
    const g = await page.evaluate(() => window.__sayplay || {});
    if (!g.listening || g.phase === "play") { wait = 0; return; }
    if (wait++ < (g.said ? 10 : 4)) return;
    wait = 0; on = 9;
    await page.evaluate(() => { __dev.voice = true; });
  };
}
// the game's picture, and under it the word with its two dots (the top of
// the picture's frame and the mic's line below the dots do not fit 3:4)
const sayplayCrop = (page) => page.evaluate(() => {
  const b = [document.getElementById("word"), document.getElementById("twiceDots")].filter(Boolean).map((e) => e.getBoundingClientRect().bottom);
  return Math.max(0, Math.round(Math.max(...b) + 12 - 520));
});
// play until `steps` are done, then on until the next move is earned (the
// page's own test, `ready`), with the finger held back for that last one
async function earnNext(page, s, drive, ready, steps) {
  const done = () => page.evaluate((n) => (window.__sayplay.step || 0) >= n, steps);
  for (let t = 0; t < 1800 && !(await done()); t++) await step(page, drive);
  await must(page, steps + " steps", done());
  for (let t = 0; t < 600 && !(await page.evaluate(ready)); t++) await step(page, s.talk);
  await must(page, "the next move earned", page.evaluate(ready));
}
async function sayplayStart(page) {
  await must(page, "the start card", until(page, () => document.querySelector("#startOvl.show") && window.__sayplay, 20000));
  await images(page);
  await page.evaluate(() => document.getElementById("startBtn").click());
  await run(page, 300);
  if (await page.evaluate(() => !!document.querySelector("#primer.show"))) { await page.evaluate(() => document.getElementById("primerYes").click()); await run(page, 300); }
}
const both = (...fns) => async () => { for (const f of fns) await f(); };

// 7. Hoops: the word said twice, the ball, a swipe at the hoop, a basket.
SCENES.hoops = {
  url: "/arcade-hoops.html", seconds: 4,
  crop: sayplayCrop,
  async stage(s) {
    const { page } = s;
    await sayplayStart(page);
    s.talk = talker(page); s.finger = finger(page);
    s.shoot = shooter(page, s.finger, "court", "__hoops", (h) => (h.hoopX / 2.4) * 240);
    // one basket first, so a dot is filled; the clip opens on the next ball
    // in hand, the word said two times, and runs on into the shot, the
    // basket and the word after it
    await earnNext(page, s, both(s.talk, s.shoot), () => window.__hoops && window.__hoops.state === "ready", 1);
  },
  drive() { return both(this._s.talk, this._s.shoot)(); },
};
// once the ball is in hand, wait a beat, then flick it up at the target
function shooter(page, fing, canvasId, name, side) {
  let held = 0;
  return async () => {
    if (fing.busy()) return fing.frame();
    const st = await page.evaluate(({ id, name }) => { const g = window[name], b = document.getElementById(id).getBoundingClientRect(); return g ? { g, box: { x: b.x, y: b.y, width: b.width, height: b.height } } : null; }, { id: canvasId, name });
    if (!st || st.g.state !== "ready") { held = 0; return; }
    if (held++ < 8) return;
    const { box } = st, dx = side(st.g, box), x0 = box.x + box.width / 2, y0 = box.y + box.height * 0.86;
    fing.start(Array.from({ length: 7 }, (_, i) => ({ x: x0 + dx * i / 6, y: y0 - 240 * i / 6 })));
    held = 0;
    return fing.frame();
  };
}

// 8. Soccer Goal: the ball earned, kicked past Bo into the net.
SCENES.soccer = {
  url: "/arcade-soccer.html", seconds: 4,
  // the whole pitch: GOAL! is written over the crossbar, at its very top
  crop: (page) => page.evaluate(() => Math.max(0, Math.round(document.getElementById("pitch").getBoundingClientRect().top - 44))),
  async stage(s) {
    const { page } = s;
    await sayplayStart(page);
    s.talk = talker(page); s.finger = finger(page);
    // to the side Bo is not on (the first two balls he stands aside)
    s.shoot = shooter(page, s.finger, "pitch", "__soccer", (g) => ((g.keeperX >= 0 ? -1.4 : 1.4) / g.aimScale) * 240);
    // two goals first (Bo stands aside for those): the clip's ball is kicked
    // past him while he slides
    await earnNext(page, s, both(s.talk, s.shoot), () => window.__soccer && window.__soccer.state === "ready", 2);
  },
  drive() { return both(this._s.talk, this._s.shoot)(); },
};

// 9. Dino Dig: the brush earned, the sand rubbed off a bone, the bone flying
// onto the skeleton.
SCENES.dino = {
  url: "/arcade-dino.html", seconds: 4,
  crop: sayplayCrop,
  async stage(s) {
    const { page } = s;
    await sayplayStart(page);
    s.talk = talker(page); s.finger = finger(page); s.dig = digger(page, s.finger);
    // two bones on the skeleton first; the clip opens with the brush out
    await earnNext(page, s, both(s.talk, s.dig), () => window.__dino && window.__dino.state === "ready", 2);
  },
  drive() { return both(this._s.talk, this._s.dig)(); },
};
// back and forth across the bone, a stroke every few frames, until it is out
function digger(page, fing) {
  let held = 0, pass = 0;
  return async () => {
    if (fing.busy()) return fing.frame();
    const st = await page.evaluate(() => { const d = window.__dino, b = document.getElementById("dig").getBoundingClientRect(); return d ? { state: d.state, bone: d.bone, x: b.x, y: b.y } : null; });
    if (!st || st.state !== "ready" || !st.bone) { held = 0; pass = 0; return; }
    if (held++ < 6) return;
    const b = st.bone, y = st.y + b.y + ((pass % 3) - 1) * b.h * 0.3, xa = st.x + b.x - b.w * 0.6, xb = st.x + b.x + b.w * 0.6;
    fing.start(pass++ % 2 ? line(xb, y, xa, y, 6) : line(xa, y, xb, y, 6));
    return fing.frame();
  };
}

// 10. Bubble Pop: the word said, Echo blows the bubbles, a finger pops them.
SCENES.bubbles = {
  url: "/arcade-bubbles.html", seconds: 4,
  crop: sayplayCrop,
  async stage(s) {
    const { page } = s;
    await sayplayStart(page);
    s.talk = talker(page); s.pop = popper(page);
    // one picture in the basket first; the clip opens as Echo blows the
    // next word's bubbles
    await earnNext(page, s, both(s.talk, s.pop), () => window.__bubbles && window.__bubbles.state === "ready" && window.__bubbles.bubbles.filter((b) => b.out).length >= 4, 1);
  },
  drive() { return both(this._s.talk, this._s.pop)(); },
};
// a tap on a bubble every few frames, the plain ones first (as sayplaytest)
function popper(page) {
  let rest = 0;
  return async () => {
    if (rest-- > 0) return;
    const t = await page.evaluate(() => {
      if (!window.Bubbles || !Bubbles.snapshot) return null;
      const s = Bubbles.snapshot(), sky = document.getElementById("sky").getBoundingClientRect();
      const b = s.bubbles.find((x) => x.out && !x.gold) || s.bubbles.find((x) => x.out);
      return b ? { x: sky.x + b.x, y: sky.y + b.y } : null;
    });
    if (t) { await page.mouse.move(t.x, t.y); await page.mouse.down(); await page.mouse.up(); rest = 10; }
  };
}

// 11. Feed Echo: the word heard, the picture glowing, a tap, Echo munching.
SCENES.feed = {
  url: "/arcade-feed.html", seconds: 4,
  // Echo's bubble, Echo, the plate and the first row of pictures
  crop: (page) => page.evaluate(() => Math.max(0, Math.round(document.getElementById("bubble").getBoundingClientRect().top - 12))),
  async stage(s) {
    const { page } = s;
    await must(page, "the start card", until(page, () => !!document.querySelector("#startOvl.show"), 20000));
    await images(page);
    await page.evaluate(() => document.getElementById("startBtn").click());
    await run(page, 300);
    if (await page.evaluate(() => !!document.querySelector("#primer.show"))) { await page.evaluate(() => document.getElementById("primerYes").click()); await run(page, 300); }
    s.play = feeder(page);
    // one fed first; the clip opens on a word just heard, its picture
    // glowing in the row the frame shows (a turn whose picture sits in the
    // lower row is played through, off film)
    const glowTop = () => page.evaluate(() => {
      const g = document.getElementById("grid"), h = g.querySelector(".speechHint:not(.right)");
      if (!h || g.classList.contains("locked") || document.getElementById("plate").dataset.fed === "0/5") return false;
      const gr = g.getBoundingClientRect(), hr = h.getBoundingClientRect();
      return hr.top < gr.top + gr.height / 2;
    });
    await must(page, "a word heard, its picture in the top row", (async () => {
      for (let t = 0; t < 3600; t++) {
        await step(page, s.play);
        if (await glowTop()) return true;
        // a round that ends first: Play again, as a child would
        if (await page.evaluate(() => !!document.querySelector("#endOvl.show"))) { await page.evaluate(() => document.getElementById("again").click()); await run(page, 300); }
      }
      return false;
    })());
  },
  drive() { return this._s.play(); },
  debug: () => ({ fed: document.getElementById("plate").dataset.fed, locked: document.getElementById("grid").classList.contains("locked"), hint: [...document.querySelectorAll("#grid .speechHint")].map((h) => h.className + " " + Math.round(h.getBoundingClientRect().top)), grid: Math.round(document.getElementById("grid").getBoundingClientRect().top), mics: __dev.mics, bubble: document.getElementById("bMain").textContent }),
};
// say the word when the mic is open; tap the picture that glows
function feeder(page) {
  let on = 0, wait = 0, rest = 0;
  return async () => {
    if (on > 0) { if (--on === 0) await page.evaluate(() => { __dev.voice = false; }); return; }
    const st = await page.evaluate(() => {
      const g = document.getElementById("grid"), hint = g.querySelector(".speechHint:not(.right)");
      const live = __dev.mics > (window.__reelMics || 0);
      if (hint && !g.classList.contains("locked")) { const r = hint.getBoundingClientRect(); return { tap: { x: r.x + r.width / 2, y: r.y + r.height / 2 } }; }
      return { listen: g.classList.contains("locked") && live };
    });
    if (st.tap) { if (rest++ < 10) return; rest = 0; await page.evaluate(() => { window.__reelMics = __dev.mics; }); await page.mouse.move(st.tap.x, st.tap.y); await page.mouse.down(); await page.mouse.up(); return; }
    if (!st.listen) { wait = 0; return; }
    if (wait++ < 14) return;
    wait = 0; on = 9;
    await page.evaluate(() => { __dev.voice = true; });
  };
}

// setup's demo order (Travis's spec, 22 Oct 2026: slice, hoops, tiles,
// bubbles, soccer, dino, …) is setup's to keep; this is the list of clips
export const KEYS = ["slice", "tiles", "hoops", "soccer", "dino", "stack", "run", "glide", "rise", "feed", "bubbles"];

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
  const only = args.only ? args.only.split(",") : KEYS.filter((k) => SCENES[k]);
  // --full: the whole screen every half second, to choose a crop (no encode)
  FULL = "full" in args;
  // --debug: each scene's own probe, every half second of film
  DEBUG = "debug" in args;
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  browser = await chromium.launch(launchOpts());
  let bad = 0;
  try {
    for (const key of only) {
      const scene = SCENES[key];
      if (!scene) { console.log("SKIP " + key + ": no scene"); continue; }
      const t = Date.now();
      let s = null;
      try {
        tick = 0;
        // --encode-only: the frames already filmed, encoded again
        if ("encode-only" in args) {
          const e = encode(key, path.join(OUT, "frames", key));
          console.log("PASS " + key + "  mp4 " + (e.mp4 / 1000).toFixed(0) + " KB crf " + e.crf + ", poster " + (e.webp / 1000).toFixed(0) + " KB q" + e.q);
          continue;
        }
        s = await open(scene.url, scene.cfg);
        scene._s = s;
        await scene.stage(s);
        const dir = await film(s, scene, key);
        if (s.errors.length) throw new Error("page errors: " + s.errors.slice(0, 3).join(" | "));
        const sh = sheet(key, dir, FULL);
        const e = "frames-only" in args || FULL ? null : encode(key, dir);
        console.log("PASS " + key + " (" + ((Date.now() - t) / 1000).toFixed(0) + " s, crop y " + s.cropY + ")" + (e ? "  mp4 " + (e.mp4 / 1000).toFixed(0) + " KB crf " + e.crf + ", poster " + (e.webp / 1000).toFixed(0) + " KB q" + e.q : "") + (sh ? "  sheet " + sh : ""));
      } catch (e) {
        bad++; console.log("FAIL " + key + ": " + e.message.split("\n")[0] + (s && s.errors.length ? "  page errors: " + s.errors.slice(0, 3).join(" | ") : ""));
        if (DEBUG && s && scene.debug) console.log("  " + JSON.stringify(await s.page.evaluate(scene.debug).catch((x) => x.message)));
      } finally { if (s) await s.context.close(); }
    }
  } finally { await browser.close(); server.close(); }
  if (bad) process.exit(1);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
