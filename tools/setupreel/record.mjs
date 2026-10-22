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
//                                                   (--debug=1: every frame)
//
// Writes public/assets/setup/reel/<key>.mp4 (540x720, 30 fps, 3 to 4 s,
// H.264 High, no audio track, moov first) and <key>.webp (its first frame),
// and a contact sheet per clip in tools/setupreel/out/sheets/ (git ignores
// out/): LOOK at every sheet before committing a clip (an empty sky, a game
// cut off by the crop, a card or a HUD half in the frame, a dead stretch, a
// miss the finger should not have made). tests/setupreeltest.mjs checks the
// files (size, codec, length, colour tags, no audio, faststart, poster) and
// that KEYS is its list; it never runs this. A new game on the reel is a
// scene here, a key in KEYS and in that test's list, and setup's own list
// (onboarding.html). Needs ffmpeg with libx264 and
// libwebp, and ImageMagick's montage for the sheets. It is CPU heavy (about a
// minute a clip; SETUPREEL_PORT, default 9303): run it alone, not beside a
// test. The games' dice are seeded (cfg.dice, a number; never cfg.seed,
// which is capture.mjs's map of localStorage keys), so a scene films nearly
// the same round each time until a game's code changes; a scene that stalls
// says where ("stalled: …"), and --debug shows why.
//
// How it films: Playwright's virtual clock (page.clock), paused, moved on
// 1/30 s per frame, a screenshot each frame at 390x844 @2x, cropped to the
// game's action at 3:4. The games' requestAnimationFrame, timers and
// performance.now are the clock's, so a frame is exactly 1/30 s of the game
// however long the screenshot takes; their CSS animations (banners, Echo's
// hop) are held and stepped the same 1/30 s through the Web Animations API.
// A crop that leaves the screen stops the run (Playwright would trim the
// shot and ffmpeg would stretch it): every frame is 780 x 1040.
//
// It stops, and writes nothing more for that clip, when:
//   - the child's name is on the page in any frame (any case, a whole word).
//     It reads the page's text: a word drawn on a canvas is pixels, and this
//     cannot see it (no game draws a name today; one that starts to is the
//     next thing to check by eye on the sheet);
//   - a clip is still over 300 KB at CRF 36, or a poster over 60 KB at q40
//     (both are made in out/enc/ first: a failed clip never replaces the
//     one in public/);
//   - a frame is not 780 x 1040.
// The clips are tagged BT.709 (matrix, primaries, transfer; limited range)
// and converted with that matrix, so a player reads the colours the way they
// were made and the poster (a WebP, always BT.601 inside) hands over to the
// first frame without a colour jump.
//
// Whose calls these are (built on defaults, 22 Oct 2026):
//   - Travis's: which moment each clip shows, the crops, 3 to 4 s a clip,
//     Rise Up's calm clip (dropping a game from the reel is one key in KEYS
//     and the test's list), and the budgets counted strictly (300,000 and
//     60,000 bytes);
//   - Rachel's: the clips show R words inside the little kids' games too
//     (Feed Echo, Bubble Pop), so a parent of a 2-4 year old sees R played,
//     a sound not asked of that age; and they show the rewards a child earns
//     by saying the sound (Super Slice, the ball, the brush, the bubbles).
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
import { readFileSync, mkdirSync, rmSync, renameSync, statSync, readdirSync, copyFileSync } from "fs";
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

let browser, FULL = false, DEBUG = 0;
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
  // filmed (the same round a child could get: only the order is fixed).
  // cfg.dice is the number; everything else in cfg is the fake phone's
  // (device(), whose cfg.seed is a map of localStorage keys to set)
  const { dice = 7, ...phone } = cfg;
  await context.addInitScript((n) => {
    let a = n >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, Number(dice));
  await context.addInitScript(device, Object.assign({ shift: 0, ownClock: true, native: true, holdAsk: true, goalMet: true,
    outcomes: seedOutcomes(), gameReps: seedGameReps(), progress: seedProgress() }, phone));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + url);
  // the clock runs until paused: a busy machine can pass the moment asked
  // for before the call lands, so it asks again, a little further on
  for (let tries = 0, ahead = 50; ; tries++, ahead *= 2) {
    try { await page.clock.pauseAt((await page.evaluate(() => Date.now())) + ahead); break; }
    catch (e) { if (tries >= 4 || !/to the past/.test(e.message)) throw e; }
  }
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
const frameName = (f) => String(f).padStart(4, "0") + ".png";
// a PNG's own width and height (its IHDR chunk)
function pngSize(file) {
  const b = readFileSync(file);
  return b.toString("latin1", 12, 16) === "IHDR" ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : { w: 0, h: 0 };
}
// Most scenes film `seconds` straight from where stage() left the game. A
// scene with end(h) films on instead (probe() read into h every frame), up to
// `most` seconds, until end(h) says the last `seconds` of film are the clip;
// the frames before them are dropped. That is how a clip can END on a moment
// (Feed Echo's next picture glowing in the row the frame shows) that staging
// cannot see coming.
async function film(s, scene, key) {
  const { page } = s;
  const dir = path.join(OUT, "frames", key);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const frames = Math.round((scene.seconds || 4) * FPS);
  const ring = !!scene.end && !FULL;
  const most = ring ? Math.round((scene.most || 40) * FPS) : frames;
  const cropY = scene.crop ? await scene.crop(page) : scene.cropY;
  // a crop past the screen's foot is trimmed by Playwright and then
  // stretched by ffmpeg: never film one
  if (!FULL && !(cropY >= 0 && cropY <= VIEW.height - CROP_H)) throw new Error("the crop leaves the screen: y " + cropY + " (0 to " + (VIEW.height - CROP_H) + ")");
  const clip = FULL ? undefined : { x: 0, y: cropY, width: VIEW.width, height: CROP_H };
  s.cropY = cropY;
  // the child's name as a whole word, in any case
  const nameRe = "\\b" + NAME + "\\b";
  const h = [];
  let f = 0, ended = !ring;
  for (; f < most; f++) {
    if (scene.drive) await scene.drive(f);
    const dt = frameMs();
    await run(page, dt);
    await stepAnims(page, dt);
    if (DEBUG && scene.debug && f % DEBUG === 0) console.log("  " + key + " " + f + ": " + JSON.stringify(await page.evaluate(scene.debug)));
    // every frame: the page's text (a canvas's drawn words are not text, so
    // they are not covered here)
    if (await page.evaluate((re) => new RegExp(re, "i").test(document.body.innerText || ""), nameRe)) throw new Error("the child's name is on screen (frame " + f + ")");
    if (ring) h.push(await page.evaluate(scene.probe));
    if (!FULL || f % 15 === 0) {
      const file = path.join(dir, frameName(f));
      await page.screenshot({ path: file, clip });
      if (!FULL && f === 0) {
        const z = pngSize(file), want = { w: VIEW.width * DPR, h: CROP_H * DPR };
        if (z.w !== want.w || z.h !== want.h) throw new Error("frame 0 is " + z.w + "x" + z.h + ", not " + want.w + "x" + want.h);
      }
    }
    if (ring && h.length >= frames && scene.end(h, frames)) { ended = true; f++; break; }
  }
  if (!ended) throw new Error("stalled: " + (scene.what || "the clip's ending") + " (" + most + " frames)");
  // a ring scene keeps its last `frames`, numbered from 0
  if (ring) {
    const first = f - frames;
    for (let i = 0; i < first; i++) rmSync(path.join(dir, frameName(i)));
    for (let i = first; i < f; i++) renameSync(path.join(dir, frameName(i)), path.join(dir, frameName(i - first)));
  }
  return dir;
}

// ── encoding ──
function ff(args) { execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" }); }
// Both files are made in out/enc/ and copied into public/ only once both are
// within budget, so a failed run leaves the committed clip as it was.
function encode(key, dir) {
  const enc = path.join(OUT, "enc");
  mkdirSync(DEST, { recursive: true }); mkdirSync(enc, { recursive: true });
  const mp4 = path.join(enc, key + ".mp4"), webp = path.join(enc, key + ".webp");
  // H.264 High, yuv420p, a keyframe every 2 s, no audio track, moov first:
  // what an iPhone's web view plays inline and muted with no tap. Converted
  // with the BT.709 matrix into limited range, and tagged so (colr box and
  // the stream's VUI): an untagged clip is read as BT.709 by some players and
  // BT.601 by others, and its greens shift against the poster
  let crf = 28;
  for (; crf <= 36; crf++) {
    ff(["-framerate", String(FPS), "-i", path.join(dir, "%04d.png"),
      "-vf", "scale=" + SIZE.w + ":" + SIZE.h + ":flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p",
      "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.0", "-preset", "veryslow", "-tune", "animation",
      "-crf", String(crf), "-g", "60",
      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
      "-an", "-map_metadata", "-1", "-movflags", "+faststart", mp4]);
    if (statSync(mp4).size <= BUDGET.mp4) break;
  }
  if (statSync(mp4).size > BUDGET.mp4) throw new Error(key + ".mp4 over budget: " + statSync(mp4).size + " bytes at CRF 36 (at most " + BUDGET.mp4 + ")");
  // the poster is the clip's first frame, so nothing jumps when it starts
  let q = 82;
  for (; q >= 40; q -= 6) {
    ff(["-i", path.join(dir, "0000.png"), "-vf", "scale=" + SIZE.w + ":" + SIZE.h + ":flags=lanczos",
      "-c:v", "libwebp", "-quality", String(q), "-compression_level", "6", "-map_metadata", "-1", webp]);
    if (statSync(webp).size <= BUDGET.webp) break;
  }
  if (statSync(webp).size > BUDGET.webp) throw new Error(key + ".webp over budget: " + statSync(webp).size + " bytes at q40 (at most " + BUDGET.webp + ")");
  copyFileSync(mp4, path.join(DEST, key + ".mp4")); copyFileSync(webp, path.join(DEST, key + ".webp"));
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
  // the lanes down to the keys at the board's foot, and never past the
  // screen's foot (the board ends there)
  crop: (page) => page.evaluate(({ vh, ch }) => Math.min(vh - ch, Math.round(H + document.getElementById("cv").getBoundingClientRect().top - ch)), { vh: VIEW.height, ch: CROP_H }),
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
// a Say & Play word's turn just beginning (Echo asks it; nothing said yet),
// with the game's own state at rest. An expression, not a function: it runs
// in the page, where a closure over `name` would not reach
const turnBegins = (name) => "!!(window.__sayplay && window.__sayplay.phase === 'turn' && !window.__sayplay.said && window." + name + " && window." + name + ".state === 'idle')";
// a ring scene's end (see film): the game's state `st` began exactly `k`
// frames before the clip's last frame (it may be over by then: a banner
// outlasts it), and no earlier `st` is in the clip
const endsOn = (st, k) => (h, n) => {
  const w = h.slice(-n), i = w.length - k - 1;
  return i > 0 && w[i] === st && w[i - 1] !== st && !w.slice(0, i).includes(st);
};

// 7. Hoops: the word said two times, the ball, a swipe at the hoop, SWISH!
SCENES.hoops = {
  url: "/arcade-hoops.html", seconds: 3.6, most: 20,
  what: "the second basket",
  crop: sayplayCrop,
  async stage(s) {
    const { page } = s;
    await sayplayStart(page);
    s.talk = talker(page); s.finger = finger(page);
    s.shoot = shooter(page, s.finger, "court", "__hoops", (h) => (h.hoopX / 2.4) * 240);
    // one basket first (the clip is the second); filming starts as the
    // second word's turn begins (Echo asking it)
    await earnNext(page, s, both(s.talk, s.shoot), turnBegins("__hoops"), 1);
  },
  drive() { return both(this._s.talk, this._s.shoot)(); },
  probe: () => window.__hoops && window.__hoops.state,
  // it ends 20 frames after the basket (SWISH! still up), before the court
  // sits empty waiting for the next word; it opens about as Echo listens,
  // the word's two dots empty
  end: endsOn("scored", 20),
  debug: () => ({ hoops: window.__hoops && window.__hoops.state, sp: window.__sayplay && [window.__sayplay.step, window.__sayplay.listening, window.__sayplay.said, window.__sayplay.phase] }),
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

// 8. Soccer Goal: the ball rolling in, kicked past Bo into the net, GOAL!
SCENES.soccer = {
  url: "/arcade-soccer.html", seconds: 3.2,
  // the whole pitch: GOAL! is written over the crossbar, at its very top
  crop: (page) => page.evaluate(() => Math.max(0, Math.round(document.getElementById("pitch").getBoundingClientRect().top - 44))),
  async stage(s) {
    const { page } = s;
    await sayplayStart(page);
    s.talk = talker(page); s.finger = finger(page);
    // to the side Bo is not on (the first two balls he stands aside)
    s.shoot = shooter(page, s.finger, "pitch", "__soccer", (g) => ((g.keeperX >= 0 ? -1.4 : 1.4) / g.aimScale) * 240);
    // two goals first (Bo stands aside for those). The clip opens as the
    // third word is heard and its ball rolls in to the spot, and ends on
    // GOAL!, still up (the pitch only waits for the next word after it)
    await earnNext(page, s, both(s.talk, s.shoot), () => window.__soccer && window.__soccer.state === "drop", 2);
  },
  drive() { return both(this._s.talk, this._s.shoot)(); },
  debug: () => ({ soccer: window.__soccer && window.__soccer.state, sp: window.__sayplay && [window.__sayplay.step, window.__sayplay.listening, window.__sayplay.said, window.__sayplay.phase] }),
};

// 9. Dino Dig: the word said two times, the brush, the sand rubbed off a
// bone, the bone flying onto the skeleton.
SCENES.dino = {
  url: "/arcade-dino.html", seconds: 3.2, most: 20,
  what: "the third bone landing on the skeleton",
  crop: sayplayCrop,
  async stage(s) {
    const { page } = s;
    await sayplayStart(page);
    s.talk = talker(page); s.finger = finger(page); s.dig = digger(page, s.finger);
    // two bones on the skeleton first; filming starts as the third word's
    // turn begins (Echo asking it)
    await earnNext(page, s, both(s.talk, s.dig), turnBegins("__dino"), 2);
  },
  drive() { return both(this._s.talk, this._s.dig)(); },
  probe: () => window.__dino && window.__dino.state,
  // the clip ends 8 frames after the bone lands (its sparkle on the
  // skeleton), before the dug pit sits still and is made new for the next
  // word; it opens about as Echo starts listening, its two dots empty, and
  // holds no earlier bone
  end: endsOn("placed", 8),
  debug: () => ({ dino: window.__dino && window.__dino.state, sp: window.__sayplay && [window.__sayplay.step, window.__sayplay.listening, window.__sayplay.said, window.__sayplay.phase] }),
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

// 11. Feed Echo: a word heard, its picture glowing, a tap, Echo munching; the
// next word asked and heard, its picture glowing, a tap, "Yum!".
SCENES.feed = {
  url: "/arcade-feed.html", seconds: 4, most: 60,
  what: "two pictures in a row glowing in the row the frame shows",
  // Echo's bubble, Echo, the plate and the first row of pictures (the second
  // row does not fit under them at 3:4)
  crop: (page) => page.evaluate(() => Math.max(0, Math.round(document.getElementById("bubble").getBoundingClientRect().top - 12))),
  async stage(s) {
    const { page } = s;
    await must(page, "the start card", until(page, () => !!document.querySelector("#startOvl.show"), 20000));
    await images(page);
    await page.evaluate(() => document.getElementById("startBtn").click());
    await run(page, 300);
    if (await page.evaluate(() => !!document.querySelector("#primer.show"))) { await page.evaluate(() => document.getElementById("primerYes").click()); await run(page, 300); }
    s.play = feeder(page);
  },
  // filmed until the last 4 s are the clip (end): which row a picture sits
  // in is the game's dice, so turns go by on film until two in a row are in
  // the top row. A round that ends meanwhile: Play again, as a child would
  // (never in the clip)
  async drive() {
    const { page } = this._s;
    if (await page.evaluate(() => !!document.querySelector("#endOvl.show"))) { await page.evaluate(() => document.getElementById("again").click()); return; }
    return this._s.play();
  },
  probe: () => {
    const g = document.getElementById("grid"), hint = g.querySelector(".speechHint:not(.right)");
    let at = "";
    if (hint && !g.classList.contains("locked")) { const gr = g.getBoundingClientRect(), hr = hint.getBoundingClientRect(); at = hr.top < gr.top + gr.height / 2 ? "top" : "low"; }
    return { at, fed: document.getElementById("plate").dataset.fed, card: !!document.querySelector("#endOvl.show, #startOvl.show, #primer.show") };
  },
  // the clip: two pictures fed on film, every glow in it (and in the second
  // before it) in the top row, never one in the row the crop cuts off; the
  // first picture's glow on film before its tap; the second glowing in the
  // last second and fed 6 frames before the end, so the clip ends on it, still
  // in the frame, going to Echo as he cheers ("Yum!")
  end(h, n) {
    const w = h.slice(-n), before = h.slice(Math.max(0, h.length - n - FPS), h.length - n);
    if (w.some((x) => x.card) || before.concat(w).some((x) => x.at === "low")) return false;
    const fed = [];
    for (let i = 1; i < w.length; i++) if (w[i].fed !== w[i - 1].fed) fed.push(i);
    if (fed.length !== 2 || fed[1] !== w.length - 7) return false;
    return w.slice(0, fed[0]).filter((x) => x.at === "top").length >= 6;
  },
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
  // --debug: each scene's own probe, every half second of film (--debug=1:
  // every frame)
  DEBUG = "debug" in args ? Math.max(1, Number(args.debug) || 15) : 0;
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
